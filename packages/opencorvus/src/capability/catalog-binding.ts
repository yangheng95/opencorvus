import { createHash } from "node:crypto"
import z from "zod"
import { and, eq } from "drizzle-orm"
import type { Config } from "@/config/config"
import type { Provider } from "@/provider/provider"
import { Plugin } from "@/plugin"
import { AttachmentStore } from "@/storage/attachment-store"
import { MessageTable, PartTable, type PartData } from "@/session/session.sql"
import { Message, Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import {
  isProjectedWorkerRuntimeContract,
  SessionRuntimeContractStore,
  type SessionRuntimeContract,
} from "@/session/runtime-contract"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import {
  CapabilityOwnerRevisionVector,
  CapabilityProjectionRevisionVector,
  capabilityCatalogRevision,
  validateCapabilityCatalogSnapshot,
  type CapabilityCatalogSnapshot as CapabilityCatalogSnapshotValue,
} from "./catalog"
import {
  CapabilityCatalogContext,
  CapabilityCatalogViewEntry,
  CapabilityDescriptor,
  CapabilitySetDescriptor,
} from "./descriptor"
import { CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { canonicalDigestSource, canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"
import { Bus } from "@/bus"
import { timelineMessageOrderKey, timelinePartOrderKey } from "@/timeline/order"
import { resolveCapabilityCaller } from "./caller-authority"

export const CATALOG_SNAPSHOT_REF_METADATA_KEY = "catalog_snapshot_ref"
export const CATALOG_SNAPSHOT_HASH_METADATA_KEY = "catalog_snapshot_hash"
export const CATALOG_SNAPSHOT_MIME = "application/json"
const SHA256 = /^[a-f0-9]{64}$/

function exactStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && typeof (value as Record<string, unknown>)[key] === "string",
  )
}

const Sha256Record = z
  .custom<Record<string, string>>(exactStringRecord, { message: "Expected an own-key string record." })
  .refine((value) => Object.values(value).every((digest) => SHA256.test(digest)), {
    message: "Every record value must be a SHA-256 digest.",
  })

export const CatalogMaterializationScopeV2 = z
  .object({
    provider_id: z.string().min(1),
    model_id: z.string().min(1),
    api_npm: z.string().min(1),
    config_revision: z.string().regex(SHA256),
    plugin_revision: z.string().regex(SHA256),
  })
  .strict()
export type CatalogMaterializationScopeV2 = z.infer<typeof CatalogMaterializationScopeV2>

const EffectfulStageToolBindingV2 = z
  .object({
    ref: CapabilityRef,
    materializer_binding_digest: z.string().regex(SHA256),
  })
  .strict()

const CollectorStageToolBindingV2 = z
  .object({
    ref: CapabilityRef,
    reducer_version: z.number().int().positive(),
    toolkit_input_refs: z.array(z.string().min(1)),
    toolkit_input_digest: z.string().regex(SHA256),
  })
  .strict()

export const DispatchStageOccurrenceBindingV2 = z
  .object({
    kind: z.literal("dispatch_stage"),
    adapter_id: z.string().min(1),
    adapter_abi_version: z.number().int().positive(),
    dispatch_turn_digest: z.string().regex(SHA256),
    effectful_tools: z.array(EffectfulStageToolBindingV2),
    collector_tools: z.array(CollectorStageToolBindingV2),
  })
  .strict()
  .superRefine((binding, context) => {
    if (!DispatchAdapterContractRegistry.isID(binding.adapter_id)) {
      context.addIssue({ code: "custom", path: ["adapter_id"], message: "Unknown dispatch adapter." })
      return
    }
    const adapter = DispatchAdapterContractRegistry.get(binding.adapter_id)
    if (binding.adapter_abi_version !== adapter.abiVersion) {
      context.addIssue({
        code: "custom",
        path: ["adapter_abi_version"],
        message: `Dispatch adapter ABI must equal ${adapter.abiVersion}.`,
      })
    }
    const refs = new Set<string>()
    for (const [group, tools] of [
      ["effectful_tools", binding.effectful_tools],
      ["collector_tools", binding.collector_tools],
    ] as const) {
      for (const [index, tool] of tools.entries()) {
        if (tool.ref.kind !== "tool" || tool.ref.owner_ref !== `dispatch-stage:${binding.adapter_id}`) {
          context.addIssue({
            code: "custom",
            path: [group, index, "ref"],
            message: "Dispatch-stage occurrence bindings require an exact stage-owned Tool ref.",
          })
        }
        const encoded = CapabilityRefCodec.encode(tool.ref)
        if (refs.has(encoded)) {
          context.addIssue({ code: "custom", path: [group, index, "ref"], message: `Duplicate stage Tool ${encoded}.` })
        }
        refs.add(encoded)
        if (
          group === "collector_tools" &&
          "reducer_version" in tool &&
          tool.reducer_version !== DispatchAdapterContractRegistry.collectorReducerVersion(binding.adapter_id)
        ) {
          context.addIssue({
            code: "custom",
            path: [group, index, "reducer_version"],
            message: "Collector reducer version does not match the dispatch adapter contract.",
          })
        }
      }
    }
  })
export type DispatchStageOccurrenceBindingV2 = z.infer<typeof DispatchStageOccurrenceBindingV2>

export const CatalogViewSnapshotPayloadV2 = z
  .object({
    schema_version: z.literal(2),
    catalog_revision: z.string().regex(SHA256),
    context: CapabilityCatalogContext,
    owner_revision_vector: CapabilityOwnerRevisionVector,
    projection_revision_vector: CapabilityProjectionRevisionVector,
    fixed_package_digests: Sha256Record,
    materialization_scope: CatalogMaterializationScopeV2,
    occurrence_owner_bindings: z.array(DispatchStageOccurrenceBindingV2),
    descriptors: z.array(CapabilityDescriptor),
    views: z.array(CapabilityCatalogViewEntry),
    sets: z.array(CapabilitySetDescriptor),
  })
  .strict()
export type CatalogViewSnapshotPayloadV2 = z.infer<typeof CatalogViewSnapshotPayloadV2>

export const CatalogSnapshotBindingV2 = z
  .object({
    snapshot_ref: z.string().min(1),
    snapshot_hash: z.string().regex(SHA256),
  })
  .strict()
export type CatalogSnapshotBindingV2 = z.infer<typeof CatalogSnapshotBindingV2>

export type CorruptCatalogOccurrenceCode =
  | "unbound"
  | "partial_binding"
  | "duplicate_binding"
  | "cross_project"
  | "missing_blob"
  | "digest_mismatch"
  | "invalid_payload"
  | "catalog_revision_mismatch"

export class CorruptCatalogOccurrenceError extends Error {
  override readonly name = "CorruptCatalogOccurrenceError"

  constructor(
    public readonly code: CorruptCatalogOccurrenceCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class StaleCatalogOccurrenceError extends Error {
  override readonly name = "StaleCatalogOccurrenceError"

  constructor(public readonly mismatches: readonly string[]) {
    super(`Catalog occurrence materialization scope is stale: ${mismatches.join(", ")}.`)
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function canonicalPayloadBytes(raw: z.input<typeof CatalogViewSnapshotPayloadV2>): Buffer {
  const payload = CatalogViewSnapshotPayloadV2.parse(raw)
  return Buffer.from(canonicalJSONValue(payload), "utf8")
}

function expectedCatalogRevision(payload: CatalogViewSnapshotPayloadV2): string {
  return capabilityCatalogRevision({
    context: payload.context,
    owner_revisions: payload.owner_revision_vector,
    projection_revisions: payload.projection_revision_vector,
    descriptors: payload.descriptors,
    views: payload.views,
    sets: payload.sets,
  })
}

function assertCatalogRevision(payload: CatalogViewSnapshotPayloadV2): void {
  const expected = expectedCatalogRevision(payload)
  if (payload.catalog_revision !== expected) {
    throw new CorruptCatalogOccurrenceError(
      "catalog_revision_mismatch",
      `Catalog payload revision ${payload.catalog_revision} does not match ${expected}.`,
    )
  }
}

function assertOccurrenceBindingTargets(payload: CatalogViewSnapshotPayloadV2): void {
  const descriptors = new Set(payload.descriptors.map((descriptor) => CapabilityRefCodec.encode(descriptor.ref)))
  for (const binding of payload.occurrence_owner_bindings) {
    for (const tool of [...binding.effectful_tools, ...binding.collector_tools]) {
      const encoded = CapabilityRefCodec.encode(tool.ref)
      if (!descriptors.has(encoded)) {
        throw new CorruptCatalogOccurrenceError(
          "invalid_payload",
          `Catalog occurrence binding references unknown descriptor ${encoded}.`,
        )
      }
    }
  }
}

function packageDigestKey(contract: SessionRuntimeContract): string {
  const revision = contract.identity.packageRevision
  return [revision.scope, revision.projectID ?? "global", revision.namespace, revision.id, revision.version].join(":")
}

function fixedPackageDigests(contract: SessionRuntimeContract | undefined): Record<string, string> {
  return contract ? { [packageDigestKey(contract)]: contract.identity.packageRevision.packageDigest } : {}
}

function exactStageRef(snapshot: CapabilityCatalogSnapshotValue, ownerRef: string, toolID: string) {
  const matches = snapshot.descriptors.filter(
    (descriptor) =>
      descriptor.ref.kind === "tool" && descriptor.ref.owner_ref === ownerRef && descriptor.ref.local_ref === toolID,
  )
  if (matches.length !== 1) {
    throw new Error(`Catalog stage owner ${ownerRef} publishes ${matches.length} descriptors for ${toolID}`)
  }
  return matches[0]!.ref
}

function durableToolkitInputRefs(payload: WorkerTurnDescriptor.Payload): string[] {
  const refs = [
    `task:${payload.lifecycle.taskID}`,
    `message:${payload.messageAuthority.user_message_id}`,
    ...(payload.lifecycle.attemptID ? [`attempt:${payload.lifecycle.attemptID}`] : []),
  ]
  const turn = payload.dispatchTurn
  if (turn) {
    refs.push(
      `dispatch:${turn.current_dispatch_id}`,
      `workflow-occurrence:${turn.workflow_occurrence_id}`,
      ...(turn.workflow_node_id ? [`workflow-node:${turn.workflow_node_id}`] : []),
      ...turn.delivery_slice_revision_ids.map((id) => `delivery-slice:${id}`),
      ...turn.evidence_locators.map((locator) => `evidence:${canonicalJSONValue(locator)}`),
    )
  }
  return [...new Set(refs)].sort(compareCanonicalStrings)
}

function occurrenceOwnerBindings(
  snapshot: CapabilityCatalogSnapshotValue,
  contract: SessionRuntimeContract | undefined,
): DispatchStageOccurrenceBindingV2[] {
  if (!contract || !isProjectedWorkerRuntimeContract(contract)) return []
  const descriptor = WorkerTurnDescriptor.get({
    id: contract.identity.workerTurnDescriptorID,
    sessionID: contract.identity.sessionID,
  })
  if (!descriptor || descriptor.hash !== contract.identity.workerTurnDescriptorHash) {
    throw new Error(
      `Catalog occurrence cannot resolve exact Worker Turn descriptor ${contract.identity.workerTurnDescriptorID}`,
    )
  }
  const payload = descriptor.payload
  const ownerRef = `dispatch-stage:${contract.identity.dispatchAdapterID}`
  const materializers = payload.tools.stageMaterializers
  const effectful = Object.keys(materializers).sort(compareCanonicalStrings)
  const effectfulSet = new Set(effectful)
  const stageOwnedSet = new Set(payload.tools.stageOwned)
  if (stageOwnedSet.size !== payload.tools.stageOwned.length) {
    throw new Error(`Catalog dispatch stage ${contract.identity.dispatchAdapterID} repeats a stage-owned Tool ID`)
  }
  for (const toolID of effectful) {
    if (!stageOwnedSet.has(toolID)) {
      throw new Error(`Catalog dispatch stage materializer ${toolID} is outside its stage-owned Tool set`)
    }
  }
  const collectors = payload.tools.stageOwned
    .filter((toolID) => !effectfulSet.has(toolID))
    .sort(compareCanonicalStrings)
  const toolkitInputRefs = durableToolkitInputRefs(payload)
  const dispatchTurnDigest = canonicalDigestSource("dispatch-stage-turn-v1", payload.dispatchTurn ?? null).sha256
  const reducerVersion = DispatchAdapterContractRegistry.collectorReducerVersion(contract.identity.dispatchAdapterID)
  return [
    DispatchStageOccurrenceBindingV2.parse({
      kind: "dispatch_stage",
      adapter_id: contract.identity.dispatchAdapterID,
      adapter_abi_version: contract.identity.dispatchAdapterABIVersion,
      dispatch_turn_digest: dispatchTurnDigest,
      effectful_tools: effectful.map((toolID) => ({
        ref: exactStageRef(snapshot, ownerRef, toolID),
        materializer_binding_digest: canonicalDigestSource(
          "dispatch-stage-effectful-materializer-v1",
          materializers[toolID],
        ).sha256,
      })),
      collector_tools: collectors.map((toolID) => ({
        ref: exactStageRef(snapshot, ownerRef, toolID),
        reducer_version: reducerVersion,
        toolkit_input_refs: toolkitInputRefs,
        toolkit_input_digest: canonicalDigestSource("dispatch-stage-toolkit-input-v1", {
          tool_id: toolID,
          reducer_version: reducerVersion,
          refs: toolkitInputRefs,
          dispatch_turn: payload.dispatchTurn ?? null,
        }).sha256,
      })),
    }),
  ]
}

export namespace CatalogOccurrenceBinding {
  export async function materializationScope(input: {
    model: Provider.Model
    config: Config.Info
  }): Promise<CatalogMaterializationScopeV2> {
    return CatalogMaterializationScopeV2.parse({
      provider_id: input.model.providerID,
      model_id: input.model.id,
      api_npm: input.model.api.npm,
      config_revision: canonicalDigestSource("catalog-materialization-config-v1", input.config).sha256,
      plugin_revision: await Plugin.revision(),
    })
  }

  export function payload(input: {
    snapshot: CapabilityCatalogSnapshotValue
    materializationScope: CatalogMaterializationScopeV2
    runtimeContract?: SessionRuntimeContract
  }): CatalogViewSnapshotPayloadV2 {
    const snapshot = validateCapabilityCatalogSnapshot(input.snapshot)
    const result = CatalogViewSnapshotPayloadV2.parse({
      schema_version: 2,
      catalog_revision: snapshot.catalog_revision,
      context: snapshot.context,
      owner_revision_vector: snapshot.owner_revisions,
      projection_revision_vector: snapshot.projection_revisions,
      fixed_package_digests: fixedPackageDigests(input.runtimeContract),
      materialization_scope: input.materializationScope,
      occurrence_owner_bindings: occurrenceOwnerBindings(snapshot, input.runtimeContract),
      descriptors: snapshot.descriptors,
      views: snapshot.views,
      sets: snapshot.sets,
    })
    assertCatalogRevision(result)
    assertOccurrenceBindingTargets(result)
    return result
  }

  export function bytes(payload: CatalogViewSnapshotPayloadV2): Buffer {
    assertCatalogRevision(payload)
    assertOccurrenceBindingTargets(payload)
    return canonicalPayloadBytes(payload)
  }

  export function hash(payload: CatalogViewSnapshotPayloadV2): string {
    return sha256(bytes(payload))
  }

  export async function publish(input: {
    projectID: string
    payload: CatalogViewSnapshotPayloadV2
  }): Promise<CatalogSnapshotBindingV2> {
    const data = bytes(input.payload)
    const expected = sha256(data)
    const reference = await AttachmentStore.write(
      input.projectID,
      data,
      CATALOG_SNAPSHOT_MIME,
      "capability-catalog.json",
    )
    if (reference.sha !== expected) {
      throw new CorruptCatalogOccurrenceError(
        "digest_mismatch",
        `AttachmentStore returned ${reference.sha} for Catalog payload ${expected}.`,
      )
    }
    return CatalogSnapshotBindingV2.parse({ snapshot_ref: reference.url, snapshot_hash: expected })
  }

  function carrierParts(parts: readonly Message.Part[]): Array<{
    part: Message.TextPart
    ref?: unknown
    hash?: unknown
  }> {
    return parts.flatMap((part) => {
      if (part.type !== "text") return []
      const metadata = part.metadata
      const hasRef = metadata ? Object.hasOwn(metadata, CATALOG_SNAPSHOT_REF_METADATA_KEY) : false
      const hasHash = metadata ? Object.hasOwn(metadata, CATALOG_SNAPSHOT_HASH_METADATA_KEY) : false
      return hasRef || hasHash
        ? [
            {
              part,
              ref: metadata?.[CATALOG_SNAPSHOT_REF_METADATA_KEY],
              hash: metadata?.[CATALOG_SNAPSHOT_HASH_METADATA_KEY],
            },
          ]
        : []
    })
  }

  export function bindingFromInput(input: Message.WithParts): CatalogSnapshotBindingV2 | undefined {
    if (input.info.role !== "user") {
      throw new CorruptCatalogOccurrenceError(
        "invalid_payload",
        `Catalog input ${input.info.id} is not a user Message.`,
      )
    }
    const carriers = carrierParts(input.parts)
    if (carriers.length === 0) return undefined
    if (carriers.length > 1) {
      throw new CorruptCatalogOccurrenceError(
        "duplicate_binding",
        `Catalog input ${input.info.id} has ${carriers.length} binding carriers.`,
      )
    }
    const carrier = carriers[0]!
    if (typeof carrier.ref !== "string" || typeof carrier.hash !== "string") {
      throw new CorruptCatalogOccurrenceError(
        "partial_binding",
        `Catalog input ${input.info.id} has a partial binding on Part ${carrier.part.id}.`,
      )
    }
    const parsed = CatalogSnapshotBindingV2.safeParse({ snapshot_ref: carrier.ref, snapshot_hash: carrier.hash })
    if (!parsed.success) {
      throw new CorruptCatalogOccurrenceError(
        "partial_binding",
        `Catalog input ${input.info.id} has an invalid binding on Part ${carrier.part.id}.`,
        { cause: parsed.error },
      )
    }
    return parsed.data
  }

  export async function read(input: {
    projectID: string
    binding: CatalogSnapshotBindingV2
  }): Promise<CatalogViewSnapshotPayloadV2> {
    const binding = CatalogSnapshotBindingV2.parse(input.binding)
    const located = AttachmentStore.nameFromUrl(binding.snapshot_ref)
    if (!located) {
      throw new CorruptCatalogOccurrenceError(
        "invalid_payload",
        `Catalog occurrence reference is not canonical: ${binding.snapshot_ref}.`,
      )
    }
    if (located.projectID !== input.projectID) {
      throw new CorruptCatalogOccurrenceError(
        "cross_project",
        `Catalog occurrence belongs to Project ${located.projectID}, expected ${input.projectID}.`,
      )
    }
    const expectedName = `${binding.snapshot_hash}.json`
    const expectedReference = `${AttachmentStore.ROUTE_PREFIX}/${input.projectID}/${expectedName}`
    if (located.name !== expectedName || binding.snapshot_ref !== expectedReference) {
      throw new CorruptCatalogOccurrenceError(
        "digest_mismatch",
        `Catalog occurrence reference ${binding.snapshot_ref} does not match its canonical digest path ${expectedReference}.`,
      )
    }
    let verified: Awaited<ReturnType<typeof AttachmentStore.readVerifiedReference>>
    try {
      verified = await AttachmentStore.readVerifiedReference({
        projectID: input.projectID,
        url: binding.snapshot_ref,
        mime: CATALOG_SNAPSHOT_MIME,
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      throw new CorruptCatalogOccurrenceError(
        code === "ENOENT" ? "missing_blob" : "digest_mismatch",
        `Catalog occurrence blob cannot be verified: ${binding.snapshot_ref}.`,
        { cause: error },
      )
    }
    const actual = sha256(verified.bytes)
    if (
      actual !== binding.snapshot_hash ||
      verified.reference.sha !== binding.snapshot_hash ||
      verified.reference.url !== binding.snapshot_ref ||
      verified.reference.mime !== CATALOG_SNAPSHOT_MIME
    ) {
      throw new CorruptCatalogOccurrenceError(
        "digest_mismatch",
        `Catalog occurrence hash ${binding.snapshot_hash} does not match verified bytes ${actual}.`,
      )
    }
    let json: unknown
    try {
      json = JSON.parse(verified.bytes.toString("utf8"))
    } catch (error) {
      throw new CorruptCatalogOccurrenceError("invalid_payload", "Catalog occurrence blob is not JSON.", {
        cause: error,
      })
    }
    const parsed = CatalogViewSnapshotPayloadV2.safeParse(json)
    if (!parsed.success) {
      throw new CorruptCatalogOccurrenceError("invalid_payload", "Catalog occurrence payload schema is invalid.", {
        cause: parsed.error,
      })
    }
    const payload = parsed.data
    if (!verified.bytes.equals(canonicalPayloadBytes(payload))) {
      throw new CorruptCatalogOccurrenceError("invalid_payload", "Catalog occurrence bytes are not canonical JSON.")
    }
    assertCatalogRevision(payload)
    assertOccurrenceBindingTargets(payload)
    validateCapabilityCatalogSnapshot({
      catalog_revision: payload.catalog_revision,
      context: payload.context,
      owner_revisions: payload.owner_revision_vector,
      projection_revisions: payload.projection_revision_vector,
      descriptors: payload.descriptors,
      views: payload.views,
      sets: payload.sets,
    })
    return payload
  }

  export async function readInput(input: {
    projectID: string
    message: Message.WithParts
  }): Promise<CatalogViewSnapshotPayloadV2> {
    const binding = bindingFromInput(input.message)
    if (!binding) {
      throw new CorruptCatalogOccurrenceError(
        "unbound",
        `Catalog occurrence input ${input.message.info.id} has no snapshot binding.`,
      )
    }
    return read({ projectID: input.projectID, binding })
  }

  export async function readAssistant(input: {
    projectID: string
    sessionID: string
    assistantMessageID: string
  }): Promise<CatalogViewSnapshotPayloadV2> {
    const assistant = await MessageStore.get({ sessionID: input.sessionID, messageID: input.assistantMessageID })
    if (assistant.info.role !== "assistant") {
      throw new CorruptCatalogOccurrenceError(
        "invalid_payload",
        `Catalog execution Message ${input.assistantMessageID} is not an assistant Message.`,
      )
    }
    const [parent, session] = await Promise.all([
      MessageStore.get({ sessionID: input.sessionID, messageID: assistant.info.parentID }),
      Session.get(input.sessionID),
    ])
    const payload = await readInput({ projectID: input.projectID, message: parent })
    const expectedCaller = resolveCapabilityCaller({
      sessionKind: session.kind,
      agentID: assistant.info.agent,
      runtimeIdentityKind: SessionRuntimeContractStore.get(input.sessionID)?.identity.identityKind,
    })
    if (payload.context.caller !== expectedCaller) {
      throw new CorruptCatalogOccurrenceError(
        "invalid_payload",
        `Catalog occurrence caller ${payload.context.caller} does not match execution caller ${expectedCaller}.`,
      )
    }
    return payload
  }

  export function assertCurrent(input: {
    payload: CatalogViewSnapshotPayloadV2
    materializationScope: CatalogMaterializationScopeV2
    runtimeContract?: SessionRuntimeContract
  }): void {
    const mismatches: string[] = []
    for (const key of Object.keys(CatalogMaterializationScopeV2.shape) as Array<keyof CatalogMaterializationScopeV2>) {
      if (input.payload.materialization_scope[key] !== input.materializationScope[key]) {
        mismatches.push(`materialization_scope.${key}`)
      }
    }
    const expectedPackages = fixedPackageDigests(input.runtimeContract)
    if (canonicalJSONValue(input.payload.fixed_package_digests) !== canonicalJSONValue(expectedPackages)) {
      mismatches.push("fixed_package_digests")
    }
    const snapshot = validateCapabilityCatalogSnapshot({
      catalog_revision: input.payload.catalog_revision,
      context: input.payload.context,
      owner_revisions: input.payload.owner_revision_vector,
      projection_revisions: input.payload.projection_revision_vector,
      descriptors: input.payload.descriptors,
      views: input.payload.views,
      sets: input.payload.sets,
    })
    const expectedBindings = occurrenceOwnerBindings(snapshot, input.runtimeContract)
    if (canonicalJSONValue(input.payload.occurrence_owner_bindings) !== canonicalJSONValue(expectedBindings)) {
      mismatches.push("occurrence_owner_bindings")
    }
    if (mismatches.length > 0) throw new StaleCatalogOccurrenceError(mismatches)
  }

  export async function bindAndBeginAssistant(input: {
    projectID: string
    assistant: Message.Assistant
    parent: Message.WithParts
    binding: CatalogSnapshotBindingV2
  }): Promise<Message.Assistant> {
    if (input.parent.info.role !== "user" || input.parent.info.id !== input.assistant.parentID) {
      throw new Error(`Catalog assistant ${input.assistant.id} parent authority is invalid`)
    }
    if (bindingFromInput(input.parent)) {
      throw new CorruptCatalogOccurrenceError(
        "duplicate_binding",
        `Catalog input ${input.parent.info.id} was already bound before assistant admission.`,
      )
    }
    const carrier = input.parent.parts.find((part): part is Message.TextPart => part.type === "text")
    if (!carrier) {
      throw new CorruptCatalogOccurrenceError(
        "unbound",
        `Catalog input ${input.parent.info.id} has no TextPart carrier.`,
      )
    }
    const binding = CatalogSnapshotBindingV2.parse(input.binding)
    await read({ projectID: input.projectID, binding })
    const admitted = await Session.beginAssistantReplyWithCommit(input.assistant, (db) => {
      const parent = db
        .select({ data: MessageTable.data, timeCreated: MessageTable.time_created })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, input.parent.info.id), eq(MessageTable.session_id, input.parent.info.sessionID)))
        .get()
      if (!parent || (parent.data as { role?: unknown }).role !== "user") {
        throw new Error(`Catalog input ${input.parent.info.id} disappeared before assistant admission`)
      }
      const rows = db
        .select({ id: PartTable.id, data: PartTable.data, messageID: PartTable.message_id, timeCreated: PartTable.time_created })
        .from(PartTable)
        .where(eq(PartTable.message_id, input.parent.info.id))
        .all()
      const persistedCarriers = rows.flatMap((candidate) => {
        const data = candidate.data as Record<string, unknown>
        if (data.type !== "text") return []
        const metadata = data.metadata
        if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) {
          throw new CorruptCatalogOccurrenceError(
            "invalid_payload",
            `Catalog input ${input.parent.info.id} has malformed TextPart metadata on ${candidate.id}.`,
          )
        }
        const record = (metadata ?? {}) as Record<string, unknown>
        const hasRef = Object.hasOwn(record, CATALOG_SNAPSHOT_REF_METADATA_KEY)
        const hasHash = Object.hasOwn(record, CATALOG_SNAPSHOT_HASH_METADATA_KEY)
        return hasRef || hasHash ? [{ id: candidate.id, hasRef, hasHash }] : []
      })
      if (persistedCarriers.length > 1) {
        throw new CorruptCatalogOccurrenceError(
          "duplicate_binding",
          `Catalog input ${input.parent.info.id} has ${persistedCarriers.length} persisted binding carriers.`,
        )
      }
      if (persistedCarriers.length === 1) {
        const persisted = persistedCarriers[0]!
        throw new CorruptCatalogOccurrenceError(
          persisted.hasRef && persisted.hasHash ? "duplicate_binding" : "partial_binding",
          `Catalog input ${input.parent.info.id} was concurrently ${persisted.hasRef && persisted.hasHash ? "bound" : "partially bound"} on Part ${persisted.id}.`,
        )
      }
      const row = rows.find((candidate) => candidate.id === carrier.id)
      if (!row || row.messageID !== input.parent.info.id) {
        throw new Error(`Catalog carrier Part ${carrier.id} disappeared before assistant admission`)
      }
      const data = row.data as Record<string, unknown>
      if (data.type !== "text") throw new Error(`Catalog carrier Part ${carrier.id} is no longer a TextPart`)
      const metadata = data.metadata
      if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) {
        throw new Error(`Catalog carrier Part ${carrier.id} metadata is malformed`)
      }
      const record = (metadata ?? {}) as Record<string, unknown>
      if (
        Object.hasOwn(record, CATALOG_SNAPSHOT_REF_METADATA_KEY) ||
        Object.hasOwn(record, CATALOG_SNAPSHOT_HASH_METADATA_KEY)
      ) {
        throw new CorruptCatalogOccurrenceError(
          "duplicate_binding",
          `Catalog carrier Part ${carrier.id} was concurrently bound.`,
        )
      }
      const nextData = {
        ...data,
        metadata: {
          ...record,
          [CATALOG_SNAPSHOT_REF_METADATA_KEY]: binding.snapshot_ref,
          [CATALOG_SNAPSHOT_HASH_METADATA_KEY]: binding.snapshot_hash,
        },
      } as unknown as PartData
      db.update(PartTable).set({ data: nextData }).where(eq(PartTable.id, carrier.id)).run()
      const outputPart = Message.Part.parse({
        ...nextData,
        id: carrier.id,
        messageID: input.parent.info.id,
        sessionID: input.parent.info.sessionID,
        orderKey: timelinePartOrderKey({ id: carrier.id, timeCreated: row.timeCreated }),
      })
      Bus.publishOwnedInTransaction(Message.Event.PartUpdated, {
        orderKey: timelineMessageOrderKey({
          info: { id: input.parent.info.id, time: { created: parent.timeCreated } },
        }),
        part: outputPart as Message.VisiblePart,
      })
    })
    return Message.Assistant.parse(admitted)
  }

  export function searchSnapshot(payload: CatalogViewSnapshotPayloadV2): CapabilityCatalogSnapshotValue {
    assertCatalogRevision(payload)
    return validateCapabilityCatalogSnapshot({
      catalog_revision: payload.catalog_revision,
      context: payload.context,
      owner_revisions: payload.owner_revision_vector,
      projection_revisions: payload.projection_revision_vector,
      descriptors: payload.descriptors,
      views: payload.views,
      sets: payload.sets,
    })
  }

  export function descriptorRefs(payload: CatalogViewSnapshotPayloadV2): string[] {
    return payload.descriptors.map((descriptor) => CapabilityRefCodec.encode(descriptor.ref))
  }
}
