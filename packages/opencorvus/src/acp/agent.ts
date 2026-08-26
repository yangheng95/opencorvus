import {
  RequestError,
  type Agent as ACPAgent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type AuthMethod,
  type CancelNotification,
  type ForkSessionRequest,
  type ForkSessionResponse,
  type InitializeRequest,
  type InitializeResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type NewSessionRequest,
  type PermissionOption,
  type PlanEntry,
  type PromptRequest,
  type ResumeSessionRequest,
  type ResumeSessionResponse,
  type SessionInfo,
  type SetSessionModelRequest,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type ToolCallContent,
  type ToolKind,
  type Usage,
} from "@agentclientprotocol/sdk"

import { Log } from "../util/log"
import { pathToFileURL } from "bun"
import { ACPSessionManager } from "./session"
import type { ACPConfig, ACPSessionState } from "./types"
import { Provider } from "../provider/provider"
import { Identifier } from "../id/id"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Installation } from "@/installation"
import { Message, Todo } from "@/session"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { z } from "zod"
import { LoadAPIKeyError } from "ai"
import type {
  Event,
  OpenCorvusClient,
  PermissionRequest,
  SessionMessageResponse,
  ToolPart,
  VisibleMessage,
} from "@opencorvus-ai/sdk"
import { renderToolFailureCause } from "@/session/tool-failure-cause"
import { AttachmentStore } from "@/storage/attachment-store"
import { decodeDataUrlBase64, decodeRawBase64Payload } from "@/session/text-mime"
import { durablePendingPermissionsForSession } from "@/permission/pending-projection"

type ModeOption = { id: string; name: string; description?: string }
type AcpPrimarySurface = { availableModes: ModeOption[]; defaultModeID: string }
type ModelOption = { modelId: string; name: string }
type AssistantMessage = Extract<VisibleMessage, { role: "assistant" }>

const DEFAULT_VARIANT_VALUE = "default"

export function resolveAcpPrimaryMode(input: {
  availableModes: readonly ModeOption[]
  currentModeID?: string
  defaultModeID: string
}): string {
  const selected = input.currentModeID ?? input.defaultModeID
  if (!input.availableModes.some((mode) => mode.id === selected)) {
    const source = input.currentModeID !== undefined ? "current" : "default"
    throw new Error(`ACP ${source} primary assistant ${JSON.stringify(selected)} is not available`)
  }
  return selected
}

export function resolvePersistedAcpPrimaryMode(
  input: AcpPrimarySurface & {
    messages: readonly { info: { id?: string; role: string; agent?: unknown } }[]
  },
): string {
  const lastUser = input.messages.findLast((message) => message.info.role === "user")?.info
  if (!lastUser) {
    return resolveAcpPrimaryMode({
      availableModes: input.availableModes,
      defaultModeID: input.defaultModeID,
    })
  }
  if (typeof lastUser.agent !== "string" || lastUser.agent.length === 0 || lastUser.agent.trim() !== lastUser.agent) {
    throw new Error(
      `ACP persisted user message ${JSON.stringify(lastUser.id ?? "<unknown>")} requires an exact primary assistant agent`,
    )
  }
  return resolveAcpPrimaryMode({
    availableModes: input.availableModes,
    currentModeID: lastUser.agent,
    defaultModeID: input.defaultModeID,
  })
}

type AcpSessionListCursor = {
  updated: number
  sessionID: string
}

type AcpSessionListItem = {
  id: string
  time: {
    updated: number
  }
}

function invalidAcpSessionListCursor(cursor: string): RequestError {
  return RequestError.invalidParams(
    { cursor },
    "ACP session list cursor must be the nextCursor token returned by unstable_listSessions",
  )
}

function decodeAcpSessionListCursor(cursor: string): AcpSessionListCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(cursor)
  } catch {
    throw invalidAcpSessionListCursor(cursor)
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidAcpSessionListCursor(cursor)
  }

  const record = parsed as Record<string, unknown>
  const updated = record.updated
  const sessionID = record.sessionID
  if (
    typeof updated !== "number" ||
    !Number.isFinite(updated) ||
    typeof sessionID !== "string" ||
    sessionID.trim() !== sessionID ||
    sessionID.length === 0
  ) {
    throw invalidAcpSessionListCursor(cursor)
  }
  return { updated, sessionID }
}

function encodeAcpSessionListCursor(session: AcpSessionListItem): string {
  return JSON.stringify({
    updated: session.time.updated,
    sessionID: session.id,
  })
}

function compareAcpSessionListItems(left: AcpSessionListItem, right: AcpSessionListItem): number {
  const updated = right.time.updated - left.time.updated
  if (updated !== 0) return updated
  return right.id.localeCompare(left.id)
}

function acpSessionListItemAfterCursor(session: AcpSessionListItem, cursor: AcpSessionListCursor): boolean {
  return (
    session.time.updated < cursor.updated || (session.time.updated === cursor.updated && session.id < cursor.sessionID)
  )
}

async function toolImageAttachmentContent(attachments: Message.FilePart[] | undefined): Promise<ToolCallContent[]> {
  if (!attachments?.length) return []
  const content: ToolCallContent[] = []
  for (const attachment of attachments) {
    if (!attachment.mime.startsWith("image/")) continue
    const dataUrl =
      (await AttachmentStore.dataUrlFromReference(attachment.url, attachment.mime)) ??
      (attachment.url.startsWith("data:") ? attachment.url : undefined)
    if (!dataUrl) {
      throw new Error(
        `ACP tool image attachment ${attachment.filename ?? attachment.url} is not a stored attachment or data URL`,
      )
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (!match) {
      throw new Error(
        `ACP tool image attachment ${attachment.filename ?? attachment.url} is not a valid base64 data URL`,
      )
    }
    const payload = decodeDataUrlBase64(dataUrl, `ACP tool image attachment ${attachment.filename ?? attachment.url}`)
    decodeRawBase64Payload(payload, `ACP tool image attachment ${attachment.filename ?? attachment.url}`)
    content.push({
      type: "content",
      content: {
        type: "image",
        mimeType: match[1] || attachment.mime,
        data: payload,
        uri: pathToFileURL(attachment.filename ?? "tool-result-image.png").href,
      },
    })
  }
  return content
}

export namespace ACP {
  const log = Log.create({ service: "acp-agent" })

  async function getContextLimit(
    sdk: OpenCorvusClient,
    providerID: string,
    modelID: string,
    directory: string,
  ): Promise<number | null> {
    const providers = await sdk.config
      .providers({ directory })
      .then((x) => x.data?.providers ?? [])
      .catch((error) => {
        log.error("failed to get providers for context limit", { error })
        return []
      })

    const provider = providers.find((p) => p.id === providerID)
    const model = provider?.models[modelID]
    return model?.limit.context ?? null
  }

  async function sendUsageUpdate(
    connection: AgentSideConnection,
    sdk: OpenCorvusClient,
    sessionID: string,
    directory: string,
    history?: readonly SessionMessageResponse[],
  ): Promise<void> {
    const messages =
      history ??
      (await sdk.session
        .messages({ sessionID, directory }, { throwOnError: true })
        .then((x) => x.data)
        .catch((error) => {
          log.error("failed to fetch messages for usage update", { error })
          return undefined
        }))

    if (!messages) return

    const assistantMessages = messages.filter(
      (m): m is { info: AssistantMessage; parts: SessionMessageResponse["parts"] } => m.info.role === "assistant",
    )

    const lastAssistant = assistantMessages[assistantMessages.length - 1]
    if (!lastAssistant) return

    const msg = lastAssistant.info
    const size = await getContextLimit(sdk, msg.providerID, msg.modelID, directory)

    if (!size) {
      // Cannot calculate usage without known context size
      return
    }

    const used = msg.tokens.input + (msg.tokens.cache?.read ?? 0)
    const totalCost = assistantMessages.reduce((sum, m) => sum + m.info.cost, 0)

    await connection
      .sessionUpdate({
        sessionId: sessionID,
        update: {
          sessionUpdate: "usage_update",
          used,
          size,
          cost: { amount: totalCost, currency: "USD" },
        },
      })
      .catch((error) => {
        log.error("failed to send usage update", { error })
      })
  }

  export async function init({ sdk: _sdk }: { sdk: OpenCorvusClient }) {
    return {
      create: (connection: AgentSideConnection, fullConfig: ACPConfig) => {
        return new Agent(connection, fullConfig)
      },
    }
  }

  export class Agent implements ACPAgent {
    private connection: AgentSideConnection
    private config: ACPConfig
    private sdk: OpenCorvusClient
    private sessionManager: ACPSessionManager
    private eventAbort = new AbortController()
    private eventStarted = false
    private bashSnapshots = new Map<string, string>()
    private toolStarts = new Set<string>()
    private permissionQueues = new Map<string, Promise<void>>()
    private projectedPermissionRequests = new Set<string>()
    constructor(connection: AgentSideConnection, config: ACPConfig) {
      this.connection = connection
      this.config = config
      this.sdk = config.sdk
      this.sessionManager = new ACPSessionManager(this.sdk)
      // AgentSideConnection invokes its Agent factory before its internal
      // transport field is assigned. Bind on the next microtask, once the
      // official SDK constructor has finished establishing the connection.
      queueMicrotask(() => {
        if (connection.signal.aborted) this.eventAbort.abort(connection.signal.reason)
        else
          connection.signal.addEventListener("abort", () => this.eventAbort.abort(connection.signal.reason), {
            once: true,
          })
      })
      this.startEventSubscription()
    }

    private startEventSubscription() {
      if (this.eventStarted) return
      this.eventStarted = true
      this.runEventSubscription().catch((error) => {
        if (this.eventAbort.signal.aborted) return
        log.error("event subscription failed", { error })
      })
    }

    private async runEventSubscription() {
      while (true) {
        if (this.eventAbort.signal.aborted) return
        const events = await this.sdk.global.event({
          signal: this.eventAbort.signal,
        })
        for await (const event of events.stream) {
          if (this.eventAbort.signal.aborted) return
          const payload = (event as any)?.payload
          if (!payload) continue
          await this.handleEvent(payload as Event).catch((error) => {
            log.error("failed to handle event", { error, type: payload.type })
          })
        }
      }
    }

    private async handleEvent(event: Event) {
      switch (event.type) {
        case "permission.asked": {
          this.projectPermissionRequest(event.properties)
          return
        }

        case "message.part.updated": {
          log.info("message part updated", { event: event.properties })
          const props = event.properties
          const part = props.part
          const session = this.sessionManager.tryGet(part.sessionID)
          if (!session) return
          const sessionId = session.id

          if (part.type === "tool") {
            await this.toolStart(sessionId, part)

            switch (part.state.status) {
              case "pending":
                this.bashSnapshots.delete(part.callID)
                return

              case "running":
                const output = this.bashOutput(part)
                const content: ToolCallContent[] = []
                if (output) {
                  const hash = String(Bun.hash(output))
                  if (part.tool === "bash") {
                    if (this.bashSnapshots.get(part.callID) === hash) {
                      await this.connection
                        .sessionUpdate({
                          sessionId,
                          update: {
                            sessionUpdate: "tool_call_update",
                            toolCallId: part.callID,
                            status: "in_progress",
                            kind: toToolKind(part.tool),
                            title: part.tool,
                            locations: toLocations(part.tool, part.state.input),
                            rawInput: part.state.input,
                          },
                        })
                        .catch((error) => {
                          log.error("failed to send tool in_progress to ACP", { error })
                        })
                      return
                    }
                    this.bashSnapshots.set(part.callID, hash)
                  }
                  content.push({
                    type: "content",
                    content: {
                      type: "text",
                      text: output,
                    },
                  })
                }
                await this.connection
                  .sessionUpdate({
                    sessionId,
                    update: {
                      sessionUpdate: "tool_call_update",
                      toolCallId: part.callID,
                      status: "in_progress",
                      kind: toToolKind(part.tool),
                      title: part.tool,
                      locations: toLocations(part.tool, part.state.input),
                      rawInput: part.state.input,
                      ...(content.length > 0 && { content }),
                    },
                  })
                  .catch((error) => {
                    log.error("failed to send tool in_progress to ACP", { error })
                  })
                return

              case "completed": {
                this.toolStarts.delete(part.callID)
                this.bashSnapshots.delete(part.callID)
                const kind = toToolKind(part.tool)
                const content: ToolCallContent[] = [
                  {
                    type: "content",
                    content: {
                      type: "text",
                      text: part.state.output,
                    },
                  },
                ]
                content.push(...(await toolImageAttachmentContent(part.state.attachments)))

                if (kind === "edit") {
                  // P0 (commit f4b08c75b) relaxed ToolStatePending/Running/
                  // Error.input to `z.unknown()`. Narrow before keyed access.
                  const rawInput = part.state.input
                  const input: Record<string, unknown> =
                    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
                      ? (rawInput as Record<string, unknown>)
                      : {}
                  const filePath = typeof input["filePath"] === "string" ? input["filePath"] : ""
                  const oldText = typeof input["oldString"] === "string" ? input["oldString"] : ""
                  const newText =
                    typeof input["newString"] === "string"
                      ? input["newString"]
                      : typeof input["content"] === "string"
                        ? input["content"]
                        : ""
                  content.push({
                    type: "diff",
                    path: filePath,
                    oldText,
                    newText,
                  })
                }

                if (part.tool === "todowrite") {
                  const parsedTodos = z.array(Todo.Info).safeParse(JSON.parse(part.state.output))
                  if (parsedTodos.success) {
                    await this.connection
                      .sessionUpdate({
                        sessionId,
                        update: {
                          sessionUpdate: "plan",
                          entries: parsedTodos.data.map((todo) => {
                            const status: PlanEntry["status"] =
                              todo.status === "cancelled" ? "completed" : (todo.status as PlanEntry["status"])
                            return {
                              priority: "medium",
                              status,
                              content: todo.content,
                            }
                          }),
                        },
                      })
                      .catch((error) => {
                        log.error("failed to send session update for todo", { error })
                      })
                  } else {
                    log.error("failed to parse todo output", { error: parsedTodos.error })
                  }
                }

                await this.connection.sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: part.callID,
                    status: "completed",
                    kind,
                    content,
                    title: part.state.title,
                    rawInput: part.state.input,
                    rawOutput: {
                      output: part.state.output,
                      metadata: part.state.metadata,
                    },
                  },
                })
                return
              }
              case "error":
                this.toolStarts.delete(part.callID)
                this.bashSnapshots.delete(part.callID)
                await this.connection
                  .sessionUpdate({
                    sessionId,
                    update: {
                      sessionUpdate: "tool_call_update",
                      toolCallId: part.callID,
                      status: "failed",
                      kind: toToolKind(part.tool),
                      title: part.tool,
                      rawInput: part.state.input,
                      content: [
                        {
                          type: "content",
                          content: {
                            type: "text",
                            text: renderToolFailureCause((part.state as any).failure),
                          },
                        },
                      ],
                      rawOutput: {
                        error: renderToolFailureCause((part.state as any).failure),
                        metadata: part.state.metadata,
                      },
                    },
                  })
                  .catch((error) => {
                    log.error("failed to send tool error to ACP", { error })
                  })
                return
            }
          }
          return
        }

        case "message.part.delta": {
          const props = event.properties
          const session = this.sessionManager.tryGet(props.sessionID)
          if (!session) return
          const sessionId = session.id

          const message = await this.sdk.session
            .message(
              {
                sessionID: props.sessionID,
                messageID: props.messageID,
                directory: session.cwd,
              },
              { throwOnError: true },
            )
            .then((x) => x.data)
            .catch((error) => {
              log.error("unexpected error when fetching message", { error })
              return undefined
            })

          if (!message || message.info.role !== "assistant") return

          const part = message.parts.find((p) => p.id === props.partID)
          if (!part) return

          if (part.type === "text" && props.field === "text") {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: {
                    type: "text",
                    text: props.delta,
                  },
                },
              })
              .catch((error) => {
                log.error("failed to send text delta to ACP", { error })
              })
            return
          }

          if (part.type === "reasoning" && props.field === "text") {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "agent_thought_chunk",
                  content: {
                    type: "text",
                    text: props.delta,
                  },
                },
              })
              .catch((error) => {
                log.error("failed to send reasoning delta to ACP", { error })
              })
          }
          return
        }
      }
    }

    private projectPermissionRequest(permission: PermissionRequest): void {
      if (this.projectedPermissionRequests.has(permission.id)) return
      const session = this.sessionManager.tryGet(permission.sessionID)
      if (!session) return
      this.projectedPermissionRequests.add(permission.id)

      const prev = this.permissionQueues.get(permission.sessionID) ?? Promise.resolve()
      const next = prev
        .then(async () => {
          const directory = session.cwd
          const res = await this.connection
            .requestPermission({
              sessionId: permission.sessionID,
              toolCall: {
                toolCallId: permission.toolCallID,
                status: "pending",
                title: permission.summary,
                rawInput: permission.scope,
                kind: toToolKind(permission.toolName),
                locations: toLocations(permission.toolName, permission.scope),
              },
              options: permission.choices.map((decision) => {
                if (decision === "allow_once") {
                  return { optionId: decision, kind: "allow_once", name: "Allow once" } satisfies PermissionOption
                }
                if (decision === "deny") {
                  return { optionId: decision, kind: "reject_once", name: "Deny" } satisfies PermissionOption
                }
                return {
                  optionId: decision,
                  kind: "allow_always",
                  name: decision === "allow_task" ? "Allow for this task" : "Always allow this exact scope",
                } satisfies PermissionOption
              }),
            })
            .catch(async (error) => {
              log.error("failed to request permission from ACP", {
                error,
                permissionID: permission.id,
                sessionID: permission.sessionID,
              })
              // A disconnected or failing transport is not an operator denial.
              // Keep the durable request pending and allow a later ACP hydration
              // to project the same request again.
              this.projectedPermissionRequests.delete(permission.id)
              return undefined
            })

          if (!res) return
          if (res.outcome.outcome !== "selected") {
            this.projectedPermissionRequests.delete(permission.id)
            return
          }
          await this.sdk.permission.reply({
            requestID: permission.id,
            decision: res.outcome.optionId as "allow_once" | "allow_task" | "allow_project" | "deny",
            actorID: "acp-operator",
            directory,
          })
        })
        .catch((error) => {
          log.error("failed to handle permission", { error, permissionID: permission.id })
        })
        .finally(() => {
          if (this.permissionQueues.get(permission.sessionID) === next) {
            this.permissionQueues.delete(permission.sessionID)
          }
        })
      this.permissionQueues.set(permission.sessionID, next)
    }

    private async hydratePendingPermissions(sessionID: string, directory: string): Promise<void> {
      for (const permission of await durablePendingPermissionsForSession({ sdk: this.sdk, sessionID, directory })) {
        this.projectPermissionRequest(permission)
      }
    }

    async initialize(params: InitializeRequest): Promise<InitializeResponse> {
      log.info("initialize", { protocolVersion: params.protocolVersion })

      const authMethod: AuthMethod = {
        description: "Run `opencorvus auth login` in the terminal",
        name: "Login with opencorvus",
        id: "opencorvus-login",
      }

      // If client supports terminal-auth capability, use that instead.
      if (params.clientCapabilities?._meta?.["terminal-auth"] === true) {
        authMethod._meta = {
          "terminal-auth": {
            command: "opencorvus",
            args: ["auth", "login"],
            label: "OpenCorvus Login",
          },
        }
      }

      return {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: true,
          mcpCapabilities: {
            http: true,
            sse: true,
          },
          promptCapabilities: {
            embeddedContext: true,
            image: true,
          },
          sessionCapabilities: {
            fork: {},
            list: {},
            resume: {},
          },
        },
        authMethods: [authMethod],
        agentInfo: {
          name: "OpenCorvus",
          version: Installation.VERSION,
        },
      }
    }

    async authenticate(_params: AuthenticateRequest) {
      throw new Error("Authentication not implemented")
    }

    async newSession(params: NewSessionRequest) {
      const directory = params.cwd
      let sessionId: string | undefined
      try {
        const [model, primarySurface] = await Promise.all([
          defaultModel(this.config, directory),
          this.loadPrimarySurface(directory),
        ])
        const modeId = resolveAcpPrimaryMode({
          availableModes: primarySurface.availableModes,
          defaultModeID: primarySurface.defaultModeID,
        })

        // Store ACP session state
        const state = await this.sessionManager.create(params.cwd, params.mcpServers, model, modeId)
        sessionId = state.id

        log.info("creating_session", { sessionId, mcpServers: params.mcpServers.length })

        const load = await this.loadSessionMode(
          {
            cwd: directory,
            mcpServers: params.mcpServers,
            sessionId,
          },
          { model, primarySurface },
        )

        return {
          sessionId,
          models: load.models,
          modes: load.modes,
          _meta: load._meta,
        }
      } catch (e) {
        return await this.cleanupRejectedSessionInitializationAndThrow({
          errorValue: e,
          sessionId,
          directory,
          previousState: undefined,
          deletePersistent: sessionId !== undefined,
        })
      }
    }

    async loadSession(params: LoadSessionRequest) {
      const directory = params.cwd
      const sessionId = params.sessionId
      const previousState = this.sessionManager.snapshot(sessionId)

      try {
        const [model, primarySurface, messages] = await Promise.all([
          defaultModel(this.config, directory),
          this.loadPrimarySurface(directory),
          this.loadSessionHistory(directory, sessionId),
        ])
        const modeId = resolvePersistedAcpPrimaryMode({ ...primarySurface, messages })

        // Store ACP session state
        await this.sessionManager.load(sessionId, params.cwd, params.mcpServers, model, modeId)

        log.info("load_session", { sessionId, mcpServers: params.mcpServers.length })

        const result = await this.loadSessionMode(
          {
            cwd: directory,
            mcpServers: params.mcpServers,
            sessionId,
          },
          { model, primarySurface },
        )

        // Replay the same history snapshot used to restore the exact Primary identity.
        for (const msg of messages) {
          log.debug("replay message", msg)
          await this.processMessage(msg)
        }

        await sendUsageUpdate(this.connection, this.sdk, sessionId, directory, messages)
        await this.hydratePendingPermissions(sessionId, directory)

        return result
      } catch (e) {
        return await this.cleanupRejectedSessionInitializationAndThrow({
          errorValue: e,
          sessionId,
          directory,
          previousState,
          deletePersistent: false,
        })
      }
    }

    async unstable_listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
      try {
        const cursor =
          params.cursor === undefined || params.cursor === null ? undefined : decodeAcpSessionListCursor(params.cursor)
        const limit = 100

        const sessions = await this.sdk.session
          .list(
            {
              directory: params.cwd ?? undefined,
              roots: "true",
            },
            { throwOnError: true },
          )
          .then((x) => x.data ?? [])

        const sorted = sessions.toSorted(compareAcpSessionListItems)
        const filtered = cursor ? sorted.filter((session) => acpSessionListItemAfterCursor(session, cursor)) : sorted
        const page = filtered.slice(0, limit)

        const entries: SessionInfo[] = page.map((session) => ({
          sessionId: session.id,
          cwd: session.directory ?? "",
          title: session.title,
          updatedAt: new Date(session.time.updated).toISOString(),
        }))

        const last = page[page.length - 1]
        const next = filtered.length > limit && last ? encodeAcpSessionListCursor(last) : undefined

        const response: ListSessionsResponse = {
          sessions: entries,
        }
        if (next) response.nextCursor = next
        return response
      } catch (e) {
        const error = Message.fromError(e, {
          providerID: "unknown",
        })
        if (LoadAPIKeyError.isInstance(error)) {
          throw RequestError.authRequired()
        }
        throw e
      }
    }

    async unstable_forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse> {
      const directory = params.cwd
      const mcpServers = params.mcpServers ?? []
      let sessionId: string | undefined
      let previousState: ACPSessionState | undefined

      try {
        const [model, primarySurface] = await Promise.all([
          defaultModel(this.config, directory),
          this.loadPrimarySurface(directory),
        ])

        const forked = await this.sdk.session
          .fork(
            {
              sessionID: params.sessionId,
              directory,
            },
            { throwOnError: true },
          )
          .then((x) => x.data)

        if (!forked) {
          throw new Error("Fork session returned no data")
        }

        sessionId = forked.id
        previousState = this.sessionManager.snapshot(sessionId)
        const messages = await this.loadSessionHistory(directory, sessionId)
        const modeId = resolvePersistedAcpPrimaryMode({ ...primarySurface, messages })
        await this.sessionManager.load(sessionId, directory, mcpServers, model, modeId)

        log.info("fork_session", { sessionId, mcpServers: mcpServers.length })

        const mode = await this.loadSessionMode(
          {
            cwd: directory,
            mcpServers,
            sessionId,
          },
          { model, primarySurface },
        )

        for (const msg of messages) {
          log.debug("replay message", msg)
          await this.processMessage(msg)
        }

        await sendUsageUpdate(this.connection, this.sdk, sessionId, directory, messages)
        await this.hydratePendingPermissions(sessionId, directory)

        return mode
      } catch (e) {
        return await this.cleanupRejectedSessionInitializationAndThrow({
          errorValue: e,
          sessionId,
          directory,
          previousState,
          deletePersistent: sessionId !== undefined,
        })
      }
    }

    async unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse> {
      const directory = params.cwd
      const sessionId = params.sessionId
      const mcpServers = params.mcpServers ?? []
      const previousState = this.sessionManager.snapshot(sessionId)

      try {
        const [model, primarySurface, messages] = await Promise.all([
          defaultModel(this.config, directory),
          this.loadPrimarySurface(directory),
          this.loadSessionHistory(directory, sessionId),
        ])
        const modeId = resolvePersistedAcpPrimaryMode({ ...primarySurface, messages })
        await this.sessionManager.load(sessionId, directory, mcpServers, model, modeId)

        log.info("resume_session", { sessionId, mcpServers: mcpServers.length })

        const result = await this.loadSessionMode(
          {
            cwd: directory,
            mcpServers,
            sessionId,
          },
          { model, primarySurface },
        )

        await sendUsageUpdate(this.connection, this.sdk, sessionId, directory, messages)
        await this.hydratePendingPermissions(sessionId, directory)

        return result
      } catch (e) {
        return await this.cleanupRejectedSessionInitializationAndThrow({
          errorValue: e,
          sessionId,
          directory,
          previousState,
          deletePersistent: false,
        })
      }
    }

    private async processMessage(message: SessionMessageResponse) {
      log.debug("process message", message)
      if (message.info.role !== "assistant" && message.info.role !== "user") return
      const sessionId = message.info.sessionID as string

      for (const rawPart of message.parts) {
        const part = rawPart as Record<string, unknown>
        if (part["type"] === "tool") {
          const toolPart = part as unknown as ToolPart
          await this.toolStart(sessionId, toolPart)
          switch (toolPart.state.status) {
            case "pending":
              this.bashSnapshots.delete(toolPart.callID)
              break
            case "running":
              const output = this.bashOutput(toolPart)
              const runningContent: ToolCallContent[] = []
              if (output) {
                runningContent.push({
                  type: "content",
                  content: {
                    type: "text",
                    text: output,
                  },
                })
              }
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: toolPart.callID,
                    status: "in_progress",
                    kind: toToolKind(toolPart.tool),
                    title: toolPart.tool,
                    locations: toLocations(toolPart.tool, toolPart.state.input),
                    rawInput: toolPart.state.input,
                    ...(runningContent.length > 0 && { content: runningContent }),
                  },
                })
                .catch((err) => {
                  log.error("failed to send tool in_progress to ACP", { error: err })
                })
              break
            case "completed":
              this.toolStarts.delete(toolPart.callID)
              this.bashSnapshots.delete(toolPart.callID)
              const kind = toToolKind(toolPart.tool)
              const content: ToolCallContent[] = [
                {
                  type: "content",
                  content: {
                    type: "text",
                    text: toolPart.state.output,
                  },
                },
              ]
              content.push(...(await toolImageAttachmentContent(toolPart.state.attachments)))

              if (kind === "edit") {
                // P0 (commit f4b08c75b) relaxed ToolStatePending/Running/
                // Error.input to `z.unknown()`. Narrow before field access.
                const rawInput = toolPart.state.input
                const input: Record<string, unknown> =
                  rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
                    ? (rawInput as Record<string, unknown>)
                    : {}
                const filePath = typeof input["filePath"] === "string" ? input["filePath"] : ""
                const oldText = typeof input["oldString"] === "string" ? input["oldString"] : ""
                const newText =
                  typeof input["newString"] === "string"
                    ? input["newString"]
                    : typeof input["content"] === "string"
                      ? input["content"]
                      : ""
                content.push({
                  type: "diff",
                  path: filePath,
                  oldText,
                  newText,
                })
              }

              if (toolPart.tool === "todowrite") {
                const parsedTodos = z.array(Todo.Info).safeParse(JSON.parse(toolPart.state.output))
                if (parsedTodos.success) {
                  await this.connection
                    .sessionUpdate({
                      sessionId,
                      update: {
                        sessionUpdate: "plan",
                        entries: parsedTodos.data.map((todo) => {
                          const status: PlanEntry["status"] =
                            todo.status === "cancelled" ? "completed" : (todo.status as PlanEntry["status"])
                          return {
                            priority: "medium",
                            status,
                            content: todo.content,
                          }
                        }),
                      },
                    })
                    .catch((err) => {
                      log.error("failed to send session update for todo", { error: err })
                    })
                } else {
                  log.error("failed to parse todo output", { error: parsedTodos.error })
                }
              }

              await this.connection.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "tool_call_update",
                  toolCallId: toolPart.callID,
                  status: "completed",
                  kind,
                  content,
                  title: toolPart.state.title,
                  rawInput: toolPart.state.input,
                  rawOutput: {
                    output: toolPart.state.output,
                    metadata: toolPart.state.metadata,
                  },
                },
              })
              break
            case "error":
              this.toolStarts.delete(toolPart.callID)
              this.bashSnapshots.delete(toolPart.callID)
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: toolPart.callID,
                    status: "failed",
                    kind: toToolKind(toolPart.tool),
                    title: toolPart.tool,
                    rawInput: toolPart.state.input,
                    content: [
                      {
                        type: "content",
                        content: {
                          type: "text",
                          text: renderToolFailureCause((toolPart.state as any).failure),
                        },
                      },
                    ],
                    rawOutput: {
                      error: renderToolFailureCause((toolPart.state as any).failure),
                      metadata: toolPart.state.metadata,
                    },
                  },
                })
                .catch((err) => {
                  log.error("failed to send tool error to ACP", { error: err })
                })
              break
          }
        } else if (part["type"] === "text") {
          const textStr = part["text"] as string | undefined
          if (textStr) {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: message.info.role === "user" ? "user_message_chunk" : "agent_message_chunk",
                  content: {
                    type: "text",
                    text: textStr,
                  },
                },
              })
              .catch((err) => {
                log.error("failed to send text to ACP", { error: err })
              })
          }
        } else if (part["type"] === "file") {
          // Replay file attachments as appropriate ACP content blocks.
          // OpenCorvus stores files internally as { type: "file", url, filename, mime }.
          // We convert these back to ACP blocks based on the URL scheme and MIME type:
          // - file:// URLs → resource_link
          // - data: URLs with image/* → image block
          // - data: URLs with text/* or application/json → resource with text
          // - data: URLs with other types → resource with blob
          const url = part["url"] as string | undefined
          const filename = (part["filename"] as string | undefined) ?? "file"
          const mime = (part["mime"] as string | undefined) || "application/octet-stream"
          const messageChunk = message.info.role === "user" ? "user_message_chunk" : "agent_message_chunk"

          const storedAttachment = url ? AttachmentStore.nameFromUrl(url) : undefined
          const replayUrl = storedAttachment ? await AttachmentStore.dataUrlFromReference(url!, mime) : url
          if (storedAttachment && !replayUrl) {
            throw new Error(`ACP replay attachment ${url} is not resolvable`)
          }

          if (replayUrl && (replayUrl.startsWith("http://") || replayUrl.startsWith("https://"))) {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: messageChunk,
                  content: { type: "resource_link", uri: replayUrl, name: filename, mimeType: mime },
                },
              })
              .catch((err) => {
                log.error("failed to send remote resource_link to ACP", { error: err })
              })
          } else if (replayUrl && replayUrl.startsWith("file://")) {
            // Local file reference - send as resource_link
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: messageChunk,
                  content: { type: "resource_link", uri: replayUrl, name: filename, mimeType: mime },
                },
              })
              .catch((err) => {
                log.error("failed to send resource_link to ACP", { error: err })
              })
          } else if (replayUrl && replayUrl.startsWith("data:")) {
            // Embedded content - parse data URL and send as appropriate block type
            const base64Data = decodeDataUrlBase64(replayUrl, `ACP replay file URL ${filename}`)
            const dataMime = replayUrl.slice("data:".length, replayUrl.indexOf(",")).split(";")[0]
            const decodedBytes = decodeRawBase64Payload(base64Data, `ACP replay file URL ${filename}`)
            const effectiveMime = dataMime || mime

            if (effectiveMime.startsWith("image/")) {
              // Image - send as image block
              await this.connection.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: messageChunk,
                  content: {
                    type: "image",
                    mimeType: effectiveMime,
                    data: base64Data,
                    uri: pathToFileURL(filename).href,
                  },
                },
              })
            } else {
              // Non-image: text types get decoded, binary types stay as blob
              const isText = effectiveMime.startsWith("text/") || effectiveMime === "application/json"
              const fileUri = pathToFileURL(filename).href
              const resource = isText
                ? {
                    uri: fileUri,
                    mimeType: effectiveMime,
                    text: decodedBytes.toString("utf-8"),
                  }
                : { uri: fileUri, mimeType: effectiveMime, blob: base64Data }

              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: messageChunk,
                    content: { type: "resource", resource },
                  },
                })
                .catch((err) => {
                  log.error("failed to send resource to ACP", { error: err })
                })
            }
          }
          if (!replayUrl || !/^data:|^file:\/\/|^https?:\/\//.test(replayUrl)) {
            throw new Error(`ACP replay file URL ${url ?? "<missing>"} is not supported`)
          }
        } else if (part["type"] === "reasoning") {
          const textStr = part["text"] as string | undefined
          if (textStr) {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "agent_thought_chunk",
                  content: {
                    type: "text",
                    text: textStr,
                  },
                },
              })
              .catch((err) => {
                log.error("failed to send reasoning to ACP", { error: err })
              })
          }
        }
      }
    }

    private bashOutput(part: ToolPart) {
      if (part.tool !== "bash") return
      if (!("metadata" in part.state) || !part.state.metadata || typeof part.state.metadata !== "object") return
      const output = part.state.metadata["output"]
      if (typeof output !== "string") return
      return output
    }

    private async toolStart(sessionId: string, part: ToolPart) {
      if (this.toolStarts.has(part.callID)) return
      this.toolStarts.add(part.callID)
      await this.connection
        .sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: part.callID,
            title: part.tool,
            kind: toToolKind(part.tool),
            status: "pending",
            locations: [],
            rawInput: {},
          },
        })
        .catch((error) => {
          log.error("failed to send tool pending to ACP", { error })
        })
    }

    private async loadPrimarySurface(directory: string): Promise<AcpPrimarySurface> {
      return Instance.provide({
        directory,
        fn: async () => {
          const config = await Config.get()
          const primaries = await PrimaryAssistantRegistry.list({ config })
          const availableModes = primaries
            .filter((primary) => primary.hidden !== true)
            .map((primary) => ({
              id: primary.name,
              name: primary.name,
              description: primary.description,
            }))
          const defaultModeID = await PrimaryAssistantRegistry.defaultID({ config })
          return { availableModes, defaultModeID }
        },
      })
    }

    private async loadSessionHistory(directory: string, sessionId: string): Promise<SessionMessageResponse[]> {
      return this.sdk.session
        .messages(
          {
            sessionID: sessionId,
            directory,
          },
          { throwOnError: true },
        )
        .then((response) => {
          if (!Array.isArray(response.data)) {
            throw new Error(`Session ${sessionId} history response missing messages`)
          }
          return response.data
        })
    }

    private async loadSessionMode(
      params: LoadSessionRequest,
      input: { model: { providerID: string; modelID: string }; primarySurface: AcpPrimarySurface },
    ) {
      const directory = params.cwd
      const model = input.model
      const sessionId = params.sessionId

      const providers = await this.sdk.config.providers({ directory }).then((x) => x.data!.providers)
      const entries = sortProvidersByName(providers)
      const availableVariants = modelVariantsFromProviders(entries, model)
      const currentVariant = this.sessionManager.getVariant(sessionId)
      if (currentVariant && !availableVariants.includes(currentVariant)) {
        this.sessionManager.setVariant(sessionId, undefined)
      }
      const availableModels = buildAvailableModels(entries, { includeVariants: true })
      const modes = {
        availableModes: input.primarySurface.availableModes,
        currentModeId: this.sessionManager.get(sessionId).modeId,
      }

      const commands = await this.config.sdk.command
        .list(
          {
            directory,
          },
          { throwOnError: true },
        )
        .then((resp) => resp.data!)

      const availableCommands = commands.map((command) => ({
        name: command.name,
        description: command.description ?? "",
      }))
      const names = new Set(availableCommands.map((c) => c.name))
      if (!names.has("compact"))
        availableCommands.push({
          name: "compact",
          description: "compact the session",
        })

      const mcpServers: Record<string, Config.Mcp> = {}
      for (const server of params.mcpServers) {
        if ("type" in server) {
          mcpServers[server.name] = {
            url: server.url,
            transport: "sse",
            headers: server.headers.reduce<Record<string, string>>((acc, { name, value }) => {
              acc[name] = value
              return acc
            }, {}),
            type: "remote",
          }
        } else {
          mcpServers[server.name] = {
            type: "local",
            command: [server.command, ...server.args],
            environment: server.env.reduce<Record<string, string>>((acc, { name, value }) => {
              acc[name] = value
              return acc
            }, {}),
          }
        }
      }

      await Promise.all(
        Object.entries(mcpServers).map(async ([key, mcp]) => {
          const response = await this.sdk.mcp.add(
            {
              directory,
              name: key,
              config: mcp,
            },
            { throwOnError: true },
          )
          assertMcpServerAttached(key, response)
        }),
      )

      setTimeout(() => {
        this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands,
          },
        })
      }, 0)

      return {
        sessionId,
        models: {
          currentModelId: formatModelIdWithVariant(model, currentVariant, availableVariants, true),
          availableModels,
        },
        modes,
        _meta: buildVariantMeta({
          model,
          variant: this.sessionManager.getVariant(sessionId),
          availableVariants,
        }),
      }
    }

    private async cleanupRejectedSessionInitialization(params: {
      sessionId: string | undefined
      directory: string
      previousState: ACPSessionState | undefined
      deletePersistent: boolean
    }) {
      if (!params.sessionId) return
      this.sessionManager.restore(params.sessionId, params.previousState)
      if (!params.deletePersistent) return
      await this.sdk.session.delete(
        {
          sessionID: params.sessionId,
          directory: params.directory,
        },
        { throwOnError: true },
      )
    }

    private async cleanupRejectedSessionInitializationAndThrow(params: {
      errorValue: unknown
      sessionId: string | undefined
      directory: string
      previousState: ACPSessionState | undefined
      deletePersistent: boolean
    }): Promise<never> {
      try {
        await this.cleanupRejectedSessionInitialization(params)
      } catch (cleanupError) {
        throw new AggregateError(
          [params.errorValue, cleanupError],
          `ACP session initialization cleanup failed for ${params.sessionId ?? "uncreated session"}`,
        )
      }
      this.throwACPRequestError(params.errorValue)
    }

    private throwACPRequestError(errorValue: unknown): never {
      const error = Message.fromError(errorValue, {
        providerID: "unknown",
      })
      if (LoadAPIKeyError.isInstance(error)) {
        throw RequestError.authRequired()
      }
      throw errorValue
    }

    async unstable_setSessionModel(params: SetSessionModelRequest) {
      const session = this.sessionManager.get(params.sessionId)
      const providers = await this.sdk.config
        .providers({ directory: session.cwd }, { throwOnError: true })
        .then((x) => x.data!.providers)

      const selection = parseModelSelection(params.modelId, providers)
      this.sessionManager.setModel(session.id, selection.model)
      this.sessionManager.setVariant(session.id, selection.variant)

      const entries = sortProvidersByName(providers)
      const availableVariants = modelVariantsFromProviders(entries, selection.model)

      return {
        _meta: buildVariantMeta({
          model: selection.model,
          variant: selection.variant,
          availableVariants,
        }),
      }
    }

    async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
      const session = this.sessionManager.get(params.sessionId)
      const primarySurface = await this.loadPrimarySurface(session.cwd)
      const modeId = resolveAcpPrimaryMode({
        availableModes: primarySurface.availableModes,
        currentModeID: params.modeId,
        defaultModeID: primarySurface.defaultModeID,
      })
      this.sessionManager.setMode(params.sessionId, modeId)
    }

    async prompt(params: PromptRequest) {
      const sessionID = params.sessionId
      const session = this.sessionManager.get(sessionID)
      const directory = session.cwd

      const current = session.model
      const model = current ?? (await defaultModel(this.config, directory))
      if (!current) {
        this.sessionManager.setModel(session.id, model)
      }
      if (typeof session.modeId !== "string" || session.modeId.length === 0) {
        throw new Error(`ACP session ${sessionID} has no initialized primary assistant mode`)
      }
      const primarySurface = await this.loadPrimarySurface(directory)
      const agent = resolveAcpPrimaryMode({
        availableModes: primarySurface.availableModes,
        currentModeID: session.modeId,
        defaultModeID: primarySurface.defaultModeID,
      })

      const parts: Array<
        { type: "text"; text: string } | { type: "file"; url: string; filename: string; mime: string }
      > = []
      for (const part of params.prompt) {
        switch (part.type) {
          case "text":
            parts.push({
              type: "text" as const,
              text: part.text,
            })
            break
          case "image": {
            const parsed = parseUri(part.uri ?? "")
            const filename = parsed.type === "file" ? parsed.filename : "image"
            if (part.data) {
              parts.push({
                type: "file",
                url: `data:${part.mimeType};base64,${part.data}`,
                filename,
                mime: part.mimeType,
              })
            } else if (part.uri && isHttpUri(part.uri)) {
              parts.push({
                type: "file",
                url: part.uri,
                filename,
                mime: part.mimeType,
              })
            } else if (parsed.type === "file") {
              parts.push({
                type: "file",
                url: parsed.url,
                filename: parsed.filename,
                mime: part.mimeType,
              })
            } else {
              throw new Error(`Unsupported ACP image URI: ${part.uri ?? "<missing>"}`)
            }
            break
          }

          case "resource_link":
            const parsed = parseUri(part.uri)
            // Use the name from resource_link if available
            if (part.name && parsed.type === "file") {
              parsed.filename = part.name
            }
            parts.push(parsed)

            break

          case "resource": {
            const resource = part.resource
            if ("text" in resource && resource.text) {
              parts.push({
                type: "text",
                text: resource.text,
              })
            } else if ("blob" in resource && resource.blob && resource.mimeType) {
              // Binary resource (PDFs, etc.): store as file part with data URL
              const parsed = parseUri(resource.uri ?? "")
              const filename = parsed.type === "file" ? parsed.filename : "file"
              parts.push({
                type: "file",
                url: `data:${resource.mimeType};base64,${resource.blob}`,
                filename,
                mime: resource.mimeType,
              })
            }
            break
          }

          default:
            break
        }
      }

      log.info("parts", { parts })

      const cmd = (() => {
        const text = parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("")
          .trim()

        if (!text.startsWith("/")) return

        const [name, ...rest] = text.slice(1).split(/\s+/)
        return { name, args: rest.join(" ").trim() }
      })()

      const buildUsage = (msg: AssistantMessage): Usage => ({
        totalTokens:
          msg.tokens.input +
          msg.tokens.output +
          msg.tokens.reasoning +
          (msg.tokens.cache?.read ?? 0) +
          (msg.tokens.cache?.write ?? 0),
        inputTokens: msg.tokens.input,
        outputTokens: msg.tokens.output,
        thoughtTokens: msg.tokens.reasoning || undefined,
        cachedReadTokens: msg.tokens.cache?.read || undefined,
        cachedWriteTokens: msg.tokens.cache?.write || undefined,
      })

      if (!cmd) {
        const response = await this.sdk.session.prompt({
          sessionID,
          messageID: Identifier.ascending("message"),
          model: {
            providerID: model.providerID,
            modelID: model.modelID,
          },
          variant: this.sessionManager.getVariant(sessionID),
          parts,
          agent,
          directory,
        })
        const msg = response.data?.info as AssistantMessage | undefined

        await sendUsageUpdate(this.connection, this.sdk, sessionID, directory)

        return {
          stopReason: "end_turn" as const,
          usage: msg ? buildUsage(msg) : undefined,
          _meta: {},
        }
      }

      const command = await this.config.sdk.command
        .list({ directory }, { throwOnError: true })
        .then((x) => x.data!.find((c) => c.name === cmd.name))
      if (command) {
        const response = await this.sdk.session.command({
          sessionID,
          messageID: Identifier.ascending("message"),
          command: command.name,
          arguments: cmd.args,
          model: model.providerID + "/" + model.modelID,
          agent,
          directory,
        })
        const msg = response.data?.info as AssistantMessage | undefined

        await sendUsageUpdate(this.connection, this.sdk, sessionID, directory)

        return {
          stopReason: "end_turn" as const,
          usage: msg ? buildUsage(msg) : undefined,
          _meta: {},
        }
      }

      switch (cmd.name) {
        case "compact":
          await this.config.sdk.session.summarize(
            {
              sessionID,
              directory,
              providerID: model.providerID,
              modelID: model.modelID,
            },
            { throwOnError: true },
          )
          break
      }

      await sendUsageUpdate(this.connection, this.sdk, sessionID, directory)

      return {
        stopReason: "end_turn" as const,
        _meta: {},
      }
    }

    async cancel(params: CancelNotification) {
      const session = this.sessionManager.get(params.sessionId)
      await this.config.sdk.session.abort(
        {
          sessionID: params.sessionId,
          directory: session.cwd,
        },
        { throwOnError: true },
      )
    }
  }

  function toToolKind(toolName: string): ToolKind {
    const tool = toolName.toLocaleLowerCase()
    switch (tool) {
      case "bash":
        return "execute"
      case "webfetch":
        return "fetch"

      case "edit":
      case "patch":
      case "write":
        return "edit"

      case "search_code":
      case "external_code_search":
      case "glob":
      case "context7_resolve_library_id":
      case "context7_get_library_docs":
        return "search"

      case "list":
      case "read":
        return "read"

      default:
        return "other"
    }
  }

  function toLocations(toolName: string, rawInput: unknown): { path: string }[] {
    // P0 (commit f4b08c75b) relaxed ToolStatePending/Running/Error.input to
    // `z.unknown()` — narrow to an object surface before keyed access; treat
    // any non-string field as absent.
    const input: Record<string, unknown> =
      rawInput && typeof rawInput === "object" && !Array.isArray(rawInput) ? (rawInput as Record<string, unknown>) : {}
    const tool = toolName.toLocaleLowerCase()
    const filePath = typeof input["filePath"] === "string" ? input["filePath"] : ""
    const dirPath = typeof input["path"] === "string" ? input["path"] : ""
    switch (tool) {
      case "read":
      case "edit":
      case "write":
        return filePath ? [{ path: filePath }] : []
      case "glob":
      case "search_code":
        return dirPath ? [{ path: dirPath }] : []
      case "bash":
        return []
      case "list":
        return dirPath ? [{ path: dirPath }] : []
      default:
        return []
    }
  }

  // R5.1 item 8: the ACP default model has exactly ONE source — the single
  // `resolveConfiguredModelRef` resolver (session overlay > project base).
  // The previous `config.defaultModel` short-circuit was a parallel
  // production model source (rule 8) and is removed (rule 16, no compat).
  async function defaultModel(_config: ACPConfig, cwd?: string) {
    const directory = cwd ?? process.cwd()
    const { resolveConfiguredModelRef } = await import("@/agent/model")
    return Instance.provide({
      directory,
      fn: () => resolveConfiguredModelRef(),
    })
  }

  function parseUri(
    uri: string,
  ): { type: "file"; url: string; filename: string; mime: string } | { type: "text"; text: string } {
    try {
      if (uri.startsWith("file://")) {
        const path = uri.slice(7)
        const name = path.split("/").pop() || path
        return {
          type: "file",
          url: uri,
          filename: name,
          mime: "text/plain",
        }
      }
      if (uri.startsWith("zed://")) {
        const url = new URL(uri)
        const path = url.searchParams.get("path")
        if (path) {
          const name = path.split("/").pop() || path
          return {
            type: "file",
            url: pathToFileURL(path).href,
            filename: name,
            mime: "text/plain",
          }
        }
      }
      return {
        type: "text",
        text: uri,
      }
    } catch {
      return {
        type: "text",
        text: uri,
      }
    }
  }

  function isHttpUri(uri: string): boolean {
    try {
      const protocol = new URL(uri).protocol
      return protocol === "http:" || protocol === "https:"
    } catch {
      return false
    }
  }

  function sortProvidersByName<T extends { name: string }>(providers: T[]): T[] {
    return [...providers].sort((a, b) => {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      if (nameA < nameB) return -1
      if (nameA > nameB) return 1
      return 0
    })
  }

  function modelVariantsFromProviders(
    providers: Array<{ id: string; models: Record<string, { variants?: Record<string, any> }> }>,
    model: { providerID: string; modelID: string },
  ): string[] {
    const provider = providers.find((entry) => entry.id === model.providerID)
    if (!provider) return []
    const modelInfo = provider.models[model.modelID]
    if (!modelInfo?.variants) return []
    return Object.keys(modelInfo.variants)
  }

  function buildAvailableModels(
    providers: Array<{ id: string; name: string; models: Record<string, any> }>,
    options: { includeVariants?: boolean } = {},
  ): ModelOption[] {
    const includeVariants = options.includeVariants ?? false
    return providers.flatMap((provider) => {
      const models = Provider.sort(Object.values(provider.models) as any)
      return models.flatMap((model) => {
        const base: ModelOption = {
          modelId: `${provider.id}/${model.id}`,
          name: `${provider.name}/${model.name}`,
        }
        if (!includeVariants || !model.variants) return [base]
        const variants = Object.keys(model.variants).filter((variant) => variant !== DEFAULT_VARIANT_VALUE)
        const variantOptions = variants.map((variant) => ({
          modelId: `${provider.id}/${model.id}/${variant}`,
          name: `${provider.name}/${model.name} (${variant})`,
        }))
        return [base, ...variantOptions]
      })
    })
  }

  function formatModelIdWithVariant(
    model: { providerID: string; modelID: string },
    variant: string | undefined,
    availableVariants: string[],
    includeVariant: boolean,
  ) {
    const base = `${model.providerID}/${model.modelID}`
    if (!includeVariant || !variant || !availableVariants.includes(variant)) return base
    return `${base}/${variant}`
  }

  function buildVariantMeta(input: {
    model: { providerID: string; modelID: string }
    variant?: string
    availableVariants: string[]
  }) {
    return {
      opencorvus: {
        modelId: `${input.model.providerID}/${input.model.modelID}`,
        variant: input.variant ?? null,
        availableVariants: input.availableVariants,
      },
    }
  }

  function parseModelSelection(
    modelId: string,
    providers: Array<{ id: string; models: Record<string, { variants?: Record<string, any> }> }>,
  ): { model: { providerID: string; modelID: string }; variant?: string } {
    const parsed = Provider.parseModel(modelId)
    const provider = providers.find((p) => p.id === parsed.providerID)
    if (!provider) {
      return { model: parsed, variant: undefined }
    }

    // Check if modelID exists directly
    if (provider.models[parsed.modelID]) {
      return { model: parsed, variant: undefined }
    }

    // Try to extract variant from end of modelID (e.g., "claude-sonnet-4/high" -> model: "claude-sonnet-4", variant: "high")
    const segments = parsed.modelID.split("/")
    if (segments.length > 1) {
      const candidateVariant = segments[segments.length - 1]
      const baseModelId = segments.slice(0, -1).join("/")
      const baseModelInfo = provider.models[baseModelId]
      if (baseModelInfo?.variants && candidateVariant in baseModelInfo.variants) {
        return {
          model: { providerID: parsed.providerID, modelID: baseModelId },
          variant: candidateVariant,
        }
      }
    }

    return { model: parsed, variant: undefined }
  }
}

function assertMcpServerAttached(name: string, response: unknown): void {
  const data =
    response && typeof response === "object" && "data" in response ? (response as { data?: unknown }).data : undefined
  const status =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, { status?: unknown; error?: unknown }>)[name]
      : undefined
  if (!status || typeof status !== "object") {
    throw new Error(`MCP server ${name} did not return an attachment status`)
  }
  if (status.status !== "connected") {
    const reason = typeof status.error === "string" && status.error.trim() ? `: ${status.error.trim()}` : ""
    throw new Error(`MCP server ${name} failed to attach with status ${String(status.status)}${reason}`)
  }
}
