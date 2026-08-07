import path from "path"
import os from "os"
import fs from "fs/promises"
import { Filesystem } from "../../util/filesystem"
import { Identifier } from "../../id/id"
import { Message } from "../message"
import { Log } from "../../util/log"
import { Session } from ".."
import { Provider } from "../../provider/provider"
import { resolveAgentModelRef, resolveProjectedWorkerModelRef } from "../../agent/model"
import { Instance } from "../../project/instance"
import { InstructionPrompt } from "../instruction"
import { Plugin } from "../../plugin"
import { MCP } from "../../mcp"
import { LSP } from "../../lsp"
import type { Range } from "../../lsp/schema"
import { ReadTool } from "../../tool/read"
import { FileTime } from "../../file/time"
import { ConfigMarkdown } from "../../config/markdown"
import { EffectiveConfig } from "../../config/effective"
import type { Config } from "../../config/config"
import { PermissionNext } from "@/permission/next"
import { Tool } from "@/tool/tool"
import { iife } from "@/util/iife"
import { defer } from "../../util/defer"
import { setSessionTitleFromFirstUserMessage } from "../first-message-title"
import { fileURLToPath, pathToFileURL } from "bun"
import type { PromptInput } from "./schema"
import { decodeDataUrlBase64Bytes, decodeRawBase64Payload } from "../text-mime"
import { AttachmentStore } from "@/storage/attachment-store"
import { resolveSessionMessageIdentity } from "../message-identity"
import type { SessionMessageIdentity } from "../message-identity"
import type { SessionControl } from "../control"
import { SessionRuntimeContractStore } from "../runtime-contract"

const log = Log.create({ service: "session.prompt" })

function hostFileContextLabel(args: Record<string, unknown>) {
  return `Host-provided file context (not a model tool call): ${JSON.stringify(args)}`
}

function parseFileRangeLine(value: string, name: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`file range ${name} must be a positive integer`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`file range ${name} must be a safe integer`)
  }
  return parsed
}

function requireByteMaterializationProjectID(input: PromptInput, context: string): string {
  if (input.byteMaterializationProjectID) return input.byteMaterializationProjectID
  throw new Error(`SessionPrompt.createUserMessage ${context} requires byteMaterializationProjectID`)
}

export async function resolvePromptParts(
  template: string,
  opts?: { config?: Config.Info },
): Promise<PromptInput["parts"]> {
  const parts: PromptInput["parts"] = [
    {
      type: "text",
      text: template,
    },
  ]
  const files = ConfigMarkdown.files(template)
  const seen = new Set<string>()
  await Promise.all(
    files.map(async (match) => {
      const name = match[1]
      if (seen.has(name)) return
      seen.add(name)
      const filepath = name.startsWith("~/")
        ? path.join(os.homedir(), name.slice(2))
        : path.resolve(Instance.worktree, name)

      const stats = await fs.stat(filepath).catch((error) => {
        throw new Error(`Prompt file reference ${JSON.stringify(name)} does not exist at ${filepath}`, { cause: error })
      })

      if (stats.isDirectory()) {
        parts.push({
          type: "file",
          url: pathToFileURL(filepath).href,
          filename: name,
          mime: "application/x-directory",
        })
        return
      }

      parts.push({
        type: "file",
        url: pathToFileURL(filepath).href,
        filename: name,
        mime: "text/plain",
      })
    }),
  )
  return parts
}

export type UserMessagePersistenceHooks = {
  controls?: (message: Message.User) => SessionControl.CreateInput[]
  prepared?: PreparedUserMessage
  commitBundle?: (message: Message.User, parts: Message.Part[]) => void
}

export type MaterializedUserMessage = {
  info: Message.User
  parts: Message.Part[]
  inputFingerprint: string
}
const materializedUserMessages = new WeakSet<object>()

declare const persistedUserMessageReceiptBrand: unique symbol
export type PersistedUserMessageReceipt = {
  readonly [persistedUserMessageReceiptBrand]: true
}
const persistedUserMessageReceipts = new WeakMap<object, { message: Message.WithParts; inputFingerprint: string }>()

export function consumePersistedUserMessageReceipt(
  input: PromptInput,
  receipt: PersistedUserMessageReceipt,
): Message.WithParts {
  const persisted = persistedUserMessageReceipts.get(receipt)
  if (!persisted) {
    throw new Error(`Persisted user message receipt is unrecognized or already consumed`)
  }
  persistedUserMessageReceipts.delete(receipt)
  if (persisted.inputFingerprint !== JSON.stringify(input)) {
    throw new Error(`Persisted user message receipt does not match prompt input for session ${input.sessionID}`)
  }
  return persisted.message
}

declare const preparedUserMessageBrand: unique symbol
export type PreparedUserMessage = {
  config: Config.Info
  session: Session.Info
  identity: Omit<SessionMessageIdentity, "runtimeContract">
  model: { providerID: string; modelID: string }
  variant?: string
  inputFingerprint: string
  readonly [preparedUserMessageBrand]: true
}

type UserMessageModelPreflight = Pick<PreparedUserMessage, "model" | "variant">
const preparedUserMessages = new WeakSet<object>()
const preparedRuntimeContracts = new WeakMap<object, SessionMessageIdentity["runtimeContract"]>()

declare const preparedUserMessageRuntimeClaimBrand: unique symbol
export type PreparedUserMessageRuntimeClaim = Disposable & {
  readonly [preparedUserMessageRuntimeClaimBrand]: true
}
const preparedUserMessageRuntimeClaims = new WeakMap<object, { prepared: PreparedUserMessage; claim: Disposable }>()

function recursivelyFreezeSnapshot<T>(value: T, seen = new WeakSet<object>()): T {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  for (const child of Object.values(object)) recursivelyFreezeSnapshot(child, seen)
  return Object.freeze(value)
}

export async function preflightUserMessageModel(input: {
  prompt: PromptInput
  config: Config.Info
  identity: SessionMessageIdentity
  modelScope?: { sessionID: string }
}): Promise<UserMessageModelPreflight> {
  const { prompt, config, identity } = input
  if (
    identity.baseRole === "build" &&
    (identity.runtimeContract?.identity.identityKind !== "projected-worker" ||
      identity.runtimeContract.systemMode !== "complete")
  ) {
    throw new Error(
      `Agent "${identity.agentID}" uses runtime template "build", which requires a projected-worker runtime prompt; ` +
        'use agent "chat" or "work" for the matching right-sidebar conversation, or agent "coding" for direct coding sessions.',
    )
  }
  const projectedIdentity =
    identity.runtimeContract?.identity.identityKind === "projected-worker"
      ? identity.runtimeContract.identity
      : undefined
  const model = projectedIdentity
    ? await resolveProjectedWorkerModelRef(
        {
          expertSquadID: projectedIdentity.expertSquadID,
          agentID: projectedIdentity.agentID,
          baseRole: projectedIdentity.baseRole,
        },
        { explicitModel: prompt.model, ...input.modelScope },
      )
    : await resolveAgentModelRef(identity.baseRole, {
        explicitModel: prompt.model,
        ...input.modelScope,
      })
  const agent = identity.runtime
  const full =
    !prompt.variant && agent.variant
      ? await Provider.getModel(model.providerID, model.modelID, { config }).catch((error) => {
          log.warn("optional agent variant lookup failed", {
            sessionID: prompt.sessionID,
            agent: identity.agentID,
            providerID: model.providerID,
            modelID: model.modelID,
            error,
          })
          if (Provider.ModelNotFoundError.isInstance(error)) return undefined
          throw error
        })
      : undefined
  return {
    model,
    variant: prompt.variant ?? (agent.variant && full?.variants?.[agent.variant] ? agent.variant : undefined),
  }
}

export function preparedUserMessageFromPreflight(input: {
  prompt: PromptInput
  config: Config.Info
  session: Session.Info
  identity: SessionMessageIdentity
  modelPreflight: UserMessageModelPreflight
}): PreparedUserMessage {
  if (input.session.id !== input.prompt.sessionID) {
    throw new Error(`Cannot prepare prompt ${input.prompt.sessionID} for session ${input.session.id}`)
  }
  const prepared = recursivelyFreezeSnapshot({
    config: structuredClone(input.config),
    session: structuredClone(input.session),
    identity: {
      agentID: input.identity.agentID,
      baseRole: input.identity.baseRole,
      runtime: structuredClone(input.identity.runtime),
    },
    model: structuredClone(input.modelPreflight.model),
    variant: input.modelPreflight.variant,
    inputFingerprint: JSON.stringify(input.prompt),
  }) as PreparedUserMessage
  preparedUserMessages.add(prepared)
  preparedRuntimeContracts.set(prepared, input.identity.runtimeContract)
  return prepared
}

export async function prepareUserMessage(input: PromptInput): Promise<PreparedUserMessage> {
  const config = await EffectiveConfig.effective({ sessionID: input.sessionID })
  const session = await Session.get(input.sessionID)
  const identity = await resolveSessionMessageIdentity({
    session,
    requestedAgentID: input.agent,
    config,
  })
  const modelPreflight = await preflightUserMessageModel({
    prompt: input,
    config,
    identity,
    modelScope: { sessionID: input.sessionID },
  })
  return preparedUserMessageFromPreflight({ prompt: input, config, session, identity, modelPreflight })
}

export function consumePreparedUserMessage(input: PromptInput, prepared: PreparedUserMessage): PreparedUserMessage {
  if (!preparedUserMessages.has(prepared)) throw new Error("Unrecognized prepared user message context")
  if (prepared.session.id !== input.sessionID) {
    throw new Error(
      `Prepared user message session ${prepared.session.id} does not match prompt session ${input.sessionID}`,
    )
  }
  if (prepared.inputFingerprint !== JSON.stringify(input)) {
    throw new Error(`Prepared user message input changed for session ${input.sessionID}`)
  }
  if (input.agent !== undefined && input.agent !== prepared.identity.agentID) {
    throw new Error(
      `Prepared user message agent ${prepared.identity.agentID} does not match requested agent ${input.agent}`,
    )
  }
  if (SessionRuntimeContractStore.get(input.sessionID) !== preparedRuntimeContracts.get(prepared)) {
    throw new Error(`Prepared user message runtime contract changed for session ${input.sessionID}`)
  }
  return prepared
}

export function rebindPreparedUserMessageInput(prepared: PreparedUserMessage, input: PromptInput): PreparedUserMessage {
  if (!preparedUserMessages.has(prepared)) throw new Error("Unrecognized prepared user message context")
  if (prepared.session.id !== input.sessionID) {
    throw new Error(`Cannot bind prepared prompt ${prepared.session.id} to session ${input.sessionID}`)
  }
  const runtimeContract = preparedRuntimeContracts.get(prepared)
  const rebound = recursivelyFreezeSnapshot({
    config: prepared.config,
    session: prepared.session,
    identity: prepared.identity,
    model: prepared.model,
    variant: prepared.variant,
    inputFingerprint: JSON.stringify(input),
  }) as PreparedUserMessage
  preparedUserMessages.delete(prepared)
  preparedRuntimeContracts.delete(prepared)
  preparedUserMessages.add(rebound)
  preparedRuntimeContracts.set(rebound, runtimeContract)
  return rebound
}

function runtimeClaimReceipt(prepared: PreparedUserMessage, claim: Disposable): PreparedUserMessageRuntimeClaim {
  const receipt = {
    [Symbol.dispose]: () => {
      const owned = preparedUserMessageRuntimeClaims.get(receipt)
      if (!owned) return
      preparedUserMessageRuntimeClaims.delete(receipt)
      owned.claim[Symbol.dispose]()
    },
  } as PreparedUserMessageRuntimeClaim
  preparedUserMessageRuntimeClaims.set(receipt, { prepared, claim })
  return receipt
}

export function claimPreparedUserMessageRuntime(prepared: PreparedUserMessage): PreparedUserMessageRuntimeClaim {
  return runtimeClaimReceipt(
    prepared,
    SessionRuntimeContractStore.claimMessageWrite(prepared.session.id, preparedRuntimeContracts.get(prepared)),
  )
}

export function installAndClaimPreparedUserMessageRuntime(
  prepared: PreparedUserMessage,
  contract: Parameters<typeof SessionRuntimeContractStore.set>[1],
): PreparedUserMessageRuntimeClaim {
  if (!preparedUserMessages.has(prepared)) throw new Error("Unrecognized prepared user message context")
  const installed = SessionRuntimeContractStore.setAndClaimMessageWrite(prepared.session.id, contract)
  preparedRuntimeContracts.set(prepared, installed.contract)
  return runtimeClaimReceipt(prepared, installed.claim)
}

export function consumePreparedUserMessageRuntimeClaim(
  prepared: PreparedUserMessage,
  receipt: PreparedUserMessageRuntimeClaim,
): Disposable {
  const owned = preparedUserMessageRuntimeClaims.get(receipt)
  if (!owned || owned.prepared !== prepared) {
    throw new Error(`Prepared user message runtime claim is unrecognized or belongs to another prompt`)
  }
  preparedUserMessageRuntimeClaims.delete(receipt)
  return owned.claim
}

export async function materializeUserMessage(
  input: PromptInput,
  persistence: Pick<UserMessagePersistenceHooks, "prepared"> = {},
): Promise<MaterializedUserMessage> {
  const prepared = consumePreparedUserMessage(input, persistence.prepared ?? (await prepareUserMessage(input)))
  const { config, identity } = prepared
  const { agentID, runtime: agent } = identity
  const { model, variant } = prepared

  const info: Message.Info = {
    id: input.messageID ?? Identifier.ascending("message"),
    role: "user",
    author: input.author,
    sessionID: input.sessionID,
    time: {
      created: Date.now(),
    },
    tools: input.tools,
    agent: agentID,
    model,
    includeMcpTools: input.includeMcpTools,
    format: input.format,
    variant,
    extra: input.extra,
  }
  using _ = defer(() => InstructionPrompt.clear(info.id))

  type Draft<T> = T extends Message.Part ? Omit<T, "id"> & { id?: string } : never
  const assign = (part: Draft<Message.Part>): Message.Part => ({
    ...part,
    id: part.id ?? Identifier.ascending("part"),
  })

  // Legacy spec/plan mode reminders were removed with the spec/plan agents
  // and spec_enter / plan_enter / *_exit tools. Nothing else injects into
  // this slot today, so we skip straight to the user-supplied parts.
  const parts = [
    ...(
      await Promise.all(
        input.parts.map(async (part): Promise<Draft<Message.Part>[]> => {
          if (part.type === "file") {
            // before checking the protocol we check if this is an mcp resource because it needs special handling
            if (part.source?.type === "resource") {
              const { clientName, uri } = part.source
              const resourceSource = {
                type: "resource" as const,
                clientName,
                uri,
                text: part.source.text ?? { value: uri, start: 0, end: uri.length },
              }
              log.info("mcp resource", { clientName, uri, mime: part.mime })

              const pieces: Draft<Message.Part>[] = [
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  text: `Reading MCP resource: ${part.filename} (${uri})`,
                },
              ]

              const resourceContent = await MCP.readResource(clientName, uri)
              if (!resourceContent) {
                throw new Error(`Resource not found: ${clientName}/${uri}`)
              }

              const contents = Array.isArray(resourceContent.contents)
                ? resourceContent.contents
                : resourceContent.contents
                  ? [resourceContent.contents]
                  : []
              let materializedResourceContent = false

              for (const content of contents) {
                if (!content || typeof content !== "object") {
                  throw new Error(`MCP resource content for ${clientName}/${uri} must be an object`)
                }
                if ("text" in content && typeof content.text === "string" && content.text.length > 0) {
                  pieces.push({
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    text: content.text as string,
                  })
                  materializedResourceContent = true
                } else if ("blob" in content && content.blob) {
                  if (typeof content.blob !== "string") {
                    throw new Error(`MCP resource blob for ${clientName}/${uri} must be a base64 string`)
                  }
                  const mimeType =
                    "mimeType" in content && typeof content.mimeType === "string" && content.mimeType
                      ? content.mimeType
                      : part.mime
                  const fileRef = await AttachmentStore.write(
                    requireByteMaterializationProjectID(input, `MCP resource blob for ${clientName}/${uri}`),
                    decodeRawBase64Payload(content.blob, `MCP resource blob for ${clientName}/${uri}`),
                    mimeType,
                    part.filename,
                  )
                  pieces.push({
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    text: `[Binary content: ${mimeType}]`,
                  })
                  pieces.push({
                    ...part,
                    messageID: info.id,
                    sessionID: input.sessionID,
                    url: fileRef.url,
                    mime: fileRef.mime,
                    filename: fileRef.filename ?? part.filename,
                    source: resourceSource,
                  })
                  materializedResourceContent = true
                }
              }

              if (!materializedResourceContent) {
                throw new Error(`MCP resource ${clientName}/${uri} did not return usable text or blob content`)
              }

              return pieces
            }
            const stored = AttachmentStore.nameFromUrl(part.url)
            if (stored) {
              const reference = await AttachmentStore.requireReference({
                projectID: requireByteMaterializationProjectID(input, `stored file part ${part.filename ?? part.mime}`),
                url: part.url,
                mime: part.mime,
              })
              return [
                {
                  ...part,
                  messageID: info.id,
                  sessionID: input.sessionID,
                  url: reference.url,
                  mime: reference.mime,
                  filename: part.filename ?? reference.filename,
                },
              ]
            }
            const url = new URL(part.url)
            switch (url.protocol) {
              case "data:": {
                const bytes = decodeDataUrlBase64Bytes(
                  part.url,
                  `SessionPrompt.createUserMessage data URL file part ${part.filename ?? part.mime}`,
                )
                const fileRef = await AttachmentStore.write(
                  requireByteMaterializationProjectID(input, `data URL file part ${part.filename ?? part.mime}`),
                  bytes,
                  part.mime,
                  part.filename,
                )
                const persistedPart: Draft<Message.Part> = {
                  ...part,
                  messageID: info.id,
                  sessionID: input.sessionID,
                  url: fileRef.url,
                  mime: fileRef.mime,
                }
                return [persistedPart]
              }
              case "file:": {
                log.info("file", { mime: part.mime })
                const filepath = fileURLToPath(part.url)
                const s = Filesystem.stat(filepath)

                if (s?.isDirectory()) {
                  part.mime = "application/x-directory"
                }

                if (Filesystem.isTextLikeMime(part.mime)) {
                  part.mime = "text/plain"
                }

                if (part.mime === "text/plain") {
                  let offset: number | undefined = undefined
                  let limit: number | undefined = undefined
                  const range = {
                    start: url.searchParams.get("start"),
                    end: url.searchParams.get("end"),
                  }
                  if (range.start != null) {
                    const filePathURI = part.url.split("?")[0]
                    let start = parseFileRangeLine(range.start, "start")
                    let end = range.end != null ? parseFileRangeLine(range.end, "end") : undefined
                    if (end !== undefined && end < start) {
                      throw new Error("file range end must be greater than or equal to start")
                    }
                    if (start === end) {
                      const symbols = await LSP.documentSymbol(filePathURI)
                      for (const symbol of symbols) {
                        let range: Range | undefined
                        if ("range" in symbol) {
                          range = symbol.range
                        } else if ("location" in symbol) {
                          range = symbol.location.range
                        }
                        if (range?.start?.line && range.start.line === start) {
                          start = range.start.line
                          end = range.end?.line ?? start
                          break
                        }
                      }
                    }
                    offset = start
                    if (end !== undefined) {
                      limit = end - (offset - 1)
                    }
                  }
                  const args = { filePath: filepath, offset, limit }

                  const pieces: Draft<Message.Part>[] = [
                    {
                      messageID: info.id,
                      sessionID: input.sessionID,
                      type: "text",
                      text: hostFileContextLabel(args),
                    },
                  ]

                  const t = await ReadTool.init()
                  const model = await Provider.getModel(info.model.providerID, info.model.modelID, { config })
                  const readCtx: Tool.Context = {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    agent: input.agent!,
                    messageID: info.id,
                    extra: { bypassCwdCheck: true, model },
                    messages: [],
                    executionSurface: Tool.executionSurface([], []),
                    metadata: async () => {},
                    ask: async () => {},
                  }
                  const result = await t.execute(args, readCtx)
                  const completedExplicitRange = limit !== undefined && result.metadata.lines === limit
                  if (result.metadata.truncated === true && !completedExplicitRange) {
                    throw new Error(
                      `Host-provided file context ${filepath} exceeds one complete read and has no model tool recovery path. Request an explicit start/end range.`,
                    )
                  }
                  pieces.push({
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    text: result.output,
                  })
                  if (result.attachments?.length) {
                    pieces.push(
                      ...result.attachments.map((attachment) => ({
                        ...attachment,
                        filename: attachment.filename ?? part.filename,
                        messageID: info.id,
                        sessionID: input.sessionID,
                      })),
                    )
                  } else {
                    pieces.push({
                      ...part,
                      messageID: info.id,
                      sessionID: input.sessionID,
                    })
                  }

                  return pieces
                }

                if (part.mime === "application/x-directory") {
                  const args = { filePath: filepath }
                  const listCtx: Tool.Context = {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    agent: input.agent!,
                    messageID: info.id,
                    extra: { bypassCwdCheck: true },
                    messages: [],
                    executionSurface: Tool.executionSurface([], []),
                    metadata: async () => {},
                    ask: async () => {},
                  }
                  const result = await ReadTool.init().then((t) => t.execute(args, listCtx))
                  if (result.metadata.truncated === true) {
                    throw new Error(
                      `Host-provided directory context ${filepath} exceeds one complete read and has no model tool recovery path.`,
                    )
                  }
                  return [
                    {
                      messageID: info.id,
                      sessionID: input.sessionID,
                      type: "text",
                      text: hostFileContextLabel(args),
                    },
                    {
                      messageID: info.id,
                      sessionID: input.sessionID,
                      type: "text",
                      text: result.output,
                    },
                    {
                      ...part,
                      messageID: info.id,
                      sessionID: input.sessionID,
                    },
                  ]
                }

                FileTime.read(input.sessionID, filepath)
                // Read tool binary content used to land in part.url as a
                // raw `data:<mime>;base64,...` string, which trips the
                // Session.updatePart inline-base64 guard
                // (attachment-store single-source contract).
                // Route through AttachmentStore so the persisted url is a
                // canonical ref and the bytes round-trip via toModelOutput's
                // ref → base64 reader at LLM call time.
                const fileRef = await AttachmentStore.writeFromPath(
                  requireByteMaterializationProjectID(input, `binary file part ${part.filename ?? filepath}`),
                  filepath,
                  part.mime,
                  part.filename!,
                )
                return [
                  {
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    text: hostFileContextLabel({ filePath: filepath }),
                  },
                  {
                    id: part.id,
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "file",
                    url: fileRef.url,
                    mime: fileRef.mime,
                    filename: part.filename!,
                    source: part.source,
                  },
                ]
              }
            }
          }

          return [
            {
              ...part,
              messageID: info.id,
              sessionID: input.sessionID,
            },
          ]
        }),
      )
    ).flat(),
  ].map(assign)

  await Plugin.trigger(
    "chat.message",
    {
      sessionID: input.sessionID,
      agent: input.agent,
      model: input.model,
      messageID: input.messageID,
      variant: input.variant,
    },
    {
      message: info,
      parts,
    },
  )

  const materialized = recursivelyFreezeSnapshot({ info, parts, inputFingerprint: JSON.stringify(input) })
  materializedUserMessages.add(materialized)
  return materialized
}

export function bindMaterializedUserMessagePersistenceAuthority(
  materialized: MaterializedUserMessage,
  input: { extra: Message.User["extra"]; inputFingerprint: string },
): MaterializedUserMessage {
  if (!materializedUserMessages.has(materialized)) {
    throw new Error("Unrecognized materialized user message")
  }
  materializedUserMessages.delete(materialized)
  const bound = recursivelyFreezeSnapshot({
    info: { ...materialized.info, extra: input.extra },
    parts: materialized.parts,
    inputFingerprint: input.inputFingerprint,
  })
  materializedUserMessages.add(bound)
  return bound
}

export async function persistMaterializedUserMessage(
  materialized: MaterializedUserMessage,
  persistence: Omit<UserMessagePersistenceHooks, "prepared"> = {},
) {
  const { info, parts } = consumeMaterializedUserMessageForPersistence(materialized)

  // Persist the message atomically so no observer can ever see a header-only
  // message if the process dies between the message row and its parts.
  const bundle = {
    info,
    parts,
    controls: persistence.controls?.(info),
  }
  const persisted = persistence.commitBundle
    ? await Session.persistMessageWithCommit(bundle, () => persistence.commitBundle!(info, parts))
    : await Session.persistMessage(bundle)
  return persistedUserMessageReceipt(materialized, persisted)
}

function consumeMaterializedUserMessageForPersistence(materialized: MaterializedUserMessage) {
  if (!materializedUserMessages.has(materialized)) {
    throw new Error("Unrecognized materialized user message")
  }
  materializedUserMessages.delete(materialized)
  return { info: materialized.info, parts: materialized.parts }
}

function persistedUserMessageReceipt(materialized: MaterializedUserMessage, persisted: Message.WithParts) {
  const receipt = Object.freeze({}) as PersistedUserMessageReceipt
  persistedUserMessageReceipts.set(receipt, {
    message: persisted,
    inputFingerprint: materialized.inputFingerprint,
  })
  return receipt
}

export function persistMaterializedUserMessageInTransaction(
  materialized: MaterializedUserMessage,
  persistence: Omit<UserMessagePersistenceHooks, "prepared"> & {
    commitBundle: NonNullable<UserMessagePersistenceHooks["commitBundle"]>
  },
) {
  const { info, parts } = consumeMaterializedUserMessageForPersistence(materialized)

  const bundle = {
    info,
    parts,
    controls: persistence.controls?.(info),
  }
  const persisted = Session.persistMessageWithCommitInTransaction(bundle, () => persistence.commitBundle(info, parts))
  return {
    complete: async () => persistedUserMessageReceipt(materialized, await persisted.complete()),
  }
}

export async function createUserMessage(input: PromptInput, persistence: UserMessagePersistenceHooks = {}) {
  const materialized = await materializeUserMessage(input, persistence)
  const receipt = await persistMaterializedUserMessage(materialized, persistence)
  const message = consumePersistedUserMessageReceipt(input, receipt)
  await setSessionTitleFromFirstUserMessage({
    sessionID: input.sessionID,
    messageID: message.info.id,
    parts: message.parts,
  })
  return message
}
