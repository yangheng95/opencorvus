import { asSchema, type Tool as AITool } from "ai"
import { and, eq, inArray } from "drizzle-orm"
import type { Provider } from "@/provider/provider"
import { Database } from "@/storage/db"
import { Message, Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { MessageTable, ToolPartRequestTable } from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"
import { projectCapabilityCatalogSearch } from "./catalog"
import { CapabilitySearchInput, type CapabilityDescriptor } from "./descriptor"
import type { CatalogViewSnapshotPayloadV3 } from "./catalog-binding"
import { CatalogOccurrenceBinding } from "./catalog-binding"
import { harnessGrantAllows, type HarnessProjection } from "./harness-projection"
import {
  CAPABILITY_REVEAL_MAX_ACTIVE_CHARS,
  CAPABILITY_REVEAL_RECEIPT_METADATA_KEY,
  ActivatedCapability,
  capabilityRevealMaterializationFingerprint,
  CorruptCapabilityRevealError,
  createCapabilityRevealReceipt,
  foldCapabilityRevealReceipts,
  providerToolDefinitionChars,
  providerToolDefinitionDigest,
  providerToolDefinitionTokens,
  reduceCapabilityRevealCandidate,
  type CapabilityRevealBaseDefinition,
  type NormalizedProviderToolDefinition,
} from "./reveal-receipt"
import { canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"
import { CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"

export const CAPABILITY_REVEAL_OWNER_EXTRA_KEY = "opencorvusCapabilityRevealOwnerV2" as const

type MaterializedExecutable = {
  providerName: string
  executableRef: CapabilityRef
  tool: AITool
  materializerBindingDigest: string
}

export interface CapabilityRevealOwner {
  execute(rawInput: unknown, context: { callID?: string; messageID: string; sessionID: string; toolPartID: string }): Promise<{
    title: string
    output: string
    metadata: Record<string, unknown>
  }>
}

export type MissionCapabilitySearchAuthority = {
  productPillar: "code" | "work"
  heldExpertSquadCount: number
}

export class CapabilityRevealConflictError extends Error {
  override readonly name = "CapabilityRevealConflictError"
}

export class CapabilityRevealAuthorizationError extends Error {
  override readonly name = "CapabilityRevealAuthorizationError"

  constructor(
    public readonly code: "execution_not_granted",
    message: string,
  ) {
    super(message)
  }
}

function behaviorExecutableRef(descriptor: CapabilityDescriptor): CapabilityRef {
  const behavior = descriptor.behavior
  switch (behavior.kind) {
    case "call_tool":
      return behavior.tool_ref
    case "open_skill":
    case "open_mission_skill":
      return behavior.loader_tool_ref
    case "create_task":
    case "inspect_mcp":
    case "open_mcp_prompt":
    case "open_mcp_resource":
    case "manage":
      return behavior.action_tool_ref
    case "unavailable":
      throw new Error(
        `Capability ${CapabilityRefCodec.encode(descriptor.ref)} has no executable behavior (${behavior.reason_code}).`,
      )
  }
}

export function normalizedProviderToolDefinition(
  providerName: string,
  tool: AITool,
): NormalizedProviderToolDefinition {
  const description = typeof tool.description === "string" ? tool.description : ""
  const inputSchema = (tool as { inputSchema?: unknown }).inputSchema
  if (inputSchema === undefined || inputSchema === null) {
    throw new Error(`Capability executable ${providerName} has no Provider input schema.`)
  }
  const schema = asSchema(inputSchema as never).jsonSchema ?? {}
  return {
    name: providerName,
    description,
    input_schema: JSON.parse(JSON.stringify(schema)),
    strict: (tool as { strict?: unknown }).strict === true,
  }
}

export function exactOccurrenceCapabilityDescriptor(
  payload: CatalogViewSnapshotPayloadV3,
  ref: CapabilityRef,
): CapabilityDescriptor {
  const encoded = CapabilityRefCodec.encode(ref)
  const matches = payload.descriptors.filter((descriptor) => CapabilityRefCodec.encode(descriptor.ref) === encoded)
  if (matches.length !== 1) throw new Error(`Catalog occurrence publishes ${matches.length} descriptors for ${encoded}.`)
  return matches[0]!
}

function assertRevealable(payload: CatalogViewSnapshotPayloadV3, requested: CapabilityRef): CapabilityDescriptor {
  const encoded = CapabilityRefCodec.encode(requested)
  const descriptor = exactOccurrenceCapabilityDescriptor(payload, requested)
  const view = payload.views.find((candidate) => CapabilityRefCodec.encode(candidate.descriptor_ref) === encoded)
  if (!view || !view.discoverable_by.includes(payload.context.caller)) {
    throw new Error(`Capability ${encoded} is not discoverable by ${payload.context.caller}.`)
  }
  if (view.availability === "denied" || view.availability === "requires_auth" || view.availability === "unavailable") {
    throw new Error(`Capability ${encoded} is ${view.availability} and cannot be revealed.`)
  }
  if (view.next_owner.kind === "open_settings" || view.next_owner.kind === "unavailable") {
    throw new Error(`Capability ${encoded} has no executable next owner (${view.next_owner.kind}).`)
  }
  return descriptor
}

function assertExecutableGrant(
  payload: CatalogViewSnapshotPayloadV3,
  harness: HarnessProjection,
  requested: CapabilityRef,
  executable: CapabilityRef,
): void {
  const target = CapabilityRefCodec.encode(executable)
  const direct = harness.grants.find((grant) => CapabilityRefCodec.encode(grant.ref) === target)
  if (direct && harnessGrantAllows(direct, "execute")) return
  if (
    executable.kind === "mcp_tool" &&
    payload.mcp_tool_parent_bindings.some((binding) => {
      if (CapabilityRefCodec.encode(binding.tool_ref) !== target) return false
      const parent = CapabilityRefCodec.encode(binding.server_ref)
      return harness.grants.some(
        (grant) =>
          CapabilityRefCodec.encode(grant.ref) === parent &&
          harnessGrantAllows(grant, "execute") &&
          grant.descendant_scope?.includes("mcp_tool"),
      )
    })
  ) {
    return
  }
  const requestedID = CapabilityRefCodec.encode(requested)
  const requestedGrant = harness.grants.find((grant) => CapabilityRefCodec.encode(grant.ref) === requestedID)
  if (
    requestedGrant &&
    harnessGrantAllows(requestedGrant, "execute") &&
    (requested.kind === "skill" || requested.kind === "mission_skill") &&
    executable.kind === "tool"
  ) {
    return
  }
  throw new CapabilityRevealAuthorizationError(
    "execution_not_granted",
    `Harness ${harness.projection_hash} does not grant execution of ${target}.`,
  )
}

function occurrenceAssistantMessageIDsInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  occurrenceID: string,
): string[] {
  return db
    .select({ id: MessageTable.id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.session_id, sessionID))
    .all()
    .flatMap((row) => {
      const data = row.data as { role?: unknown; parentID?: unknown }
      return data.role === "assistant" && data.parentID === occurrenceID ? [row.id] : []
    })
}

function transactionParts(
  db: Database.TxOrDb,
  sessionID: string,
  occurrenceID: string,
): Message.ToolPart[] {
  const messageIDs = occurrenceAssistantMessageIDsInTransaction(db, sessionID, occurrenceID)
  if (messageIDs.length === 0) return []
  return db
    .select()
    .from(ToolPartRequestTable)
    .where(inArray(ToolPartRequestTable.message_id, messageIDs))
    .all()
    .flatMap((row) => {
      const part = projectToolPartInTransaction(db, row)
      return part ? [part] : []
    })
}

export async function capabilityRevealOccurrenceParts(input: {
  sessionID: string
  occurrenceID: string
}): Promise<Message.Part[]> {
  const messageIDs = Database.use((db) =>
    occurrenceAssistantMessageIDsInTransaction(db, input.sessionID, input.occurrenceID),
  )
  return (await Promise.all(messageIDs.map((messageID) => MessageStore.parts(messageID)))).flat()
}

function toolPartByID(db: Database.TxOrDb, messageID: string, partID: string): Message.ToolPart {
  const row = db
    .select()
    .from(ToolPartRequestTable)
    .where(and(eq(ToolPartRequestTable.id, partID), eq(ToolPartRequestTable.message_id, messageID)))
    .get()
  const part = row ? projectToolPartInTransaction(db, row) : undefined
  if (!part) throw new CapabilityRevealConflictError(`Capability search ToolPart ${partID} disappeared.`)
  return part
}

export function createCapabilityRevealOwner(input: {
  projectID: string
  model: Provider.Model
  occurrenceID: string
  harness: HarnessProjection
  baseDefinition: CapabilityRevealBaseDefinition
  resolveMissionSearchAuthority?: (sessionID: string) => Promise<MissionCapabilitySearchAuthority>
  materialize: (requestedRef: CapabilityRef, executableRef: CapabilityRef) => Promise<MaterializedExecutable>
}): CapabilityRevealOwner {
  return {
    async execute(rawInput, context) {
      const params = CapabilitySearchInput.parse(rawInput)
      const callID = context.callID?.trim()
      if (!callID) throw new Error("capability_search requires a Provider Tool call identity.")
      const payload = await CatalogOccurrenceBinding.readAssistant({
        projectID: input.projectID,
        sessionID: context.sessionID,
        assistantMessageID: context.messageID,
      })
      const assistant = await MessageStore.get({ sessionID: context.sessionID, messageID: context.messageID })
      if (assistant.info.role !== "assistant" || assistant.info.parentID !== input.occurrenceID) {
        throw new Error(`Capability search Message ${context.messageID} is outside occurrence ${input.occurrenceID}.`)
      }
      const payloadHash = CatalogOccurrenceBinding.hash(payload)
      if (payloadHash !== input.harness.catalog_snapshot_hash) {
        throw new Error(
          `Capability reveal Harness Catalog ${input.harness.catalog_snapshot_hash} does not match occurrence payload ${payloadHash}.`,
        )
      }
      const parts = await capabilityRevealOccurrenceParts({
        sessionID: context.sessionID,
        occurrenceID: input.occurrenceID,
      })
      const prior = foldCapabilityRevealReceipts({
        occurrenceID: input.occurrenceID,
        parts,
        harnessProjectionHash: input.harness.projection_hash,
        catalogSnapshotRef: input.harness.catalog_snapshot_ref,
        catalogSnapshotHash: input.harness.catalog_snapshot_hash,
        baseDefinition: input.baseDefinition,
      })
      const priorCalls = parts.filter(
        (part): part is Message.ToolPart =>
          part.type === "tool" &&
          part.tool === "capability_search" &&
          part.callID === callID &&
          part.state.status === "completed",
      )
      if (priorCalls.length > 1) {
        throw new CorruptCapabilityRevealError(`Capability search call ${callID} has multiple completed receipts.`)
      }
      const priorCall = priorCalls[0]
      if (priorCall) {
        if (priorCall.state.status !== "completed") {
          throw new CorruptCapabilityRevealError(`Capability search call ${callID} is not completed.`)
        }
        if (
          priorCall.id !== context.toolPartID ||
          canonicalJSONValue(priorCall.state.input) !== canonicalJSONValue(params)
        ) {
          throw new CapabilityRevealConflictError(`Capability search call ${callID} changed identity or input.`)
        }
        return {
          title: priorCall.state.title,
          output: priorCall.state.output,
          metadata: priorCall.state.metadata,
        }
      }
      const snapshot = CatalogOccurrenceBinding.searchSnapshot(payload)
      const missionAuthority =
        payload.context.caller === "mission"
          ? await input.resolveMissionSearchAuthority?.(context.sessionID)
          : undefined
      if (payload.context.caller === "mission" && !missionAuthority) {
        throw new Error("Mission capability search requires its canonical Mission authority.")
      }
      if (
        missionAuthority &&
        (!Number.isSafeInteger(missionAuthority.heldExpertSquadCount) || missionAuthority.heldExpertSquadCount < 0)
      ) {
        throw new Error("Mission held Expert Squad count must be a non-negative safe integer.")
      }
      const effectiveParams = missionAuthority
        ? { ...params, product_pillar: missionAuthority.productPillar }
        : params
      const search = projectCapabilityCatalogSearch(snapshot, payload.context.caller, effectiveParams)
      const results = search.results
      const visibleExpertSquadCount = snapshot.views.filter(
        (entry) =>
          entry.descriptor_ref.kind === "expert_squad" && entry.discoverable_by.includes(payload.context.caller),
      ).length
      const productPillar = missionAuthority?.productPillar ?? params.product_pillar
      const requestedProductPillar = params.product_pillar
      const activated = await Promise.all(
        params.exact_refs.map(async (requestedRef) => {
          if (
            requestedRef.kind === "tool" &&
            requestedRef.owner_ref === "tool-registry" &&
            requestedRef.local_ref === "capability_search"
          ) {
            throw new Error("capability_search is the permanent discovery Tool and is not a revealable active leaf.")
          }
          const descriptor = assertRevealable(payload, requestedRef)
          const executableRef = behaviorExecutableRef(descriptor)
          assertExecutableGrant(payload, input.harness, requestedRef, executableRef)
          const materialized = await input.materialize(requestedRef, executableRef)
          if (CapabilityRefCodec.encode(materialized.executableRef) !== CapabilityRefCodec.encode(executableRef)) {
            throw new Error(
              `Capability materializer returned ${CapabilityRefCodec.encode(materialized.executableRef)} for ${CapabilityRefCodec.encode(executableRef)}.`,
            )
          }
          const definition = normalizedProviderToolDefinition(materialized.providerName, materialized.tool)
          const payloadChars = providerToolDefinitionChars(definition)
          if (payloadChars > CAPABILITY_REVEAL_MAX_ACTIVE_CHARS) {
            throw new Error(
              `Capability ${CapabilityRefCodec.encode(requestedRef)} definition is ${payloadChars} chars and must be split below ${CAPABILITY_REVEAL_MAX_ACTIVE_CHARS}.`,
            )
          }
          return ActivatedCapability.parse({
            requested_ref: requestedRef,
            executable_ref: executableRef,
            provider_name: materialized.providerName,
            definition,
            definition_digest: providerToolDefinitionDigest(definition),
            payload_chars: payloadChars,
            payload_tokens: providerToolDefinitionTokens(definition),
            materializer_binding_digest: materialized.materializerBindingDigest,
          })
        }),
      )
      const candidate = reduceCapabilityRevealCandidate({
        prior,
        deactivateRefs: params.deactivate_refs,
        activated,
      })
      const resultRefs = results.map((result) => result.ref).sort((left, right) =>
        compareCanonicalStrings(CapabilityRefCodec.encode(left), CapabilityRefCodec.encode(right)),
      )
      const materializationFingerprint = capabilityRevealMaterializationFingerprint({
        occurrenceID: input.occurrenceID,
        callID,
        priorRevision: prior.revision,
        harnessProjectionHash: input.harness.projection_hash,
        catalogSnapshotRef: input.harness.catalog_snapshot_ref,
        catalogSnapshotHash: input.harness.catalog_snapshot_hash,
        params,
        resultRefs,
        activated,
        activeRefs: candidate.activeRefs,
        activeDefinitionDigest: candidate.definitionDigest,
        activePayloadChars: candidate.payloadChars,
        activePayloadTokens: candidate.payloadTokens,
      })
      const receipt = createCapabilityRevealReceipt({
        occurrence_id: input.occurrenceID,
        search_call_id: callID,
        prior_revision: prior.revision,
        revision: prior.revision + 1,
        harness_projection_hash: input.harness.projection_hash,
        catalog_snapshot_ref: input.harness.catalog_snapshot_ref,
        catalog_snapshot_hash: input.harness.catalog_snapshot_hash,
        materialization_fingerprint: materializationFingerprint,
        result_refs: resultRefs,
        deactivate_refs: params.deactivate_refs,
        activated,
        active_refs: candidate.activeRefs,
        active_definition_digest: candidate.definitionDigest,
        active_payload_chars: candidate.payloadChars,
        active_payload_tokens: candidate.payloadTokens,
      })
      const visible = {
        catalog_snapshot_hash: input.harness.catalog_snapshot_hash,
        catalog_revision: snapshot.catalog_revision,
        caller: payload.context.caller,
        reveal_revision: receipt.revision,
        active_refs: receipt.active_refs,
        active_payload_chars: receipt.active_payload_chars,
        active_payload_tokens: receipt.active_payload_tokens,
        visible_expert_squad_count: visibleExpertSquadCount,
        ...(missionAuthority ? { held_expert_squad_count: missionAuthority.heldExpertSquadCount } : {}),
        ...(productPillar ? { product_pillar: productPillar } : {}),
        ...(requestedProductPillar && requestedProductPillar !== productPillar
          ? { requested_product_pillar: requestedProductPillar }
          : {}),
        filter_diagnostic: search.filterDiagnostic,
        results,
      }
      const output = JSON.stringify(visible, null, 2)
      const metadata = {
        catalog_snapshot_hash: input.harness.catalog_snapshot_hash,
        catalog_revision: snapshot.catalog_revision,
        caller: payload.context.caller,
        result_count: results.length,
        reveal_revision: receipt.revision,
        active_ref_count: receipt.active_refs.length,
        active_payload_chars: receipt.active_payload_chars,
        active_payload_tokens: receipt.active_payload_tokens,
        visible_expert_squad_count: visibleExpertSquadCount,
        ...(missionAuthority ? { held_expert_squad_count: missionAuthority.heldExpertSquadCount } : {}),
        ...(productPillar ? { product_pillar: productPillar } : {}),
        ...(requestedProductPillar && requestedProductPillar !== productPillar
          ? { requested_product_pillar: requestedProductPillar }
          : {}),
        ...(search.filterDiagnostic ? { filter_diagnostic_code: search.filterDiagnostic.code } : {}),
        [CAPABILITY_REVEAL_RECEIPT_METADATA_KEY]: receipt,
        truncated: false,
      }
      const committed = Message.ToolPart.parse({
        id: context.toolPartID,
        messageID: context.messageID,
        sessionID: context.sessionID,
        type: "tool",
        callID,
        tool: "capability_search",
        state: {
          status: "completed",
          input: params,
          output,
          title: "Capability search",
          metadata,
          time: { start: 0, end: 1 },
        },
      })
      Database.immediateTransaction((db) => {
        const message = db
          .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
          .from(MessageTable)
          .where(and(eq(MessageTable.id, context.messageID), eq(MessageTable.session_id, context.sessionID)))
          .get()
        const messageData = message?.data as { role?: unknown; parentID?: unknown } | undefined
        if (!message || messageData?.role !== "assistant" || messageData.parentID !== input.occurrenceID) {
          throw new CapabilityRevealConflictError(`Capability occurrence ${context.messageID} changed identity.`)
        }
        const currentBinding = CatalogOccurrenceBinding.bindingFromInputInTransaction(db, {
          sessionID: context.sessionID,
          inputMessageID: input.occurrenceID,
        })
        if (
          !currentBinding ||
          currentBinding.snapshot_ref !== input.harness.catalog_snapshot_ref ||
          currentBinding.snapshot_hash !== input.harness.catalog_snapshot_hash
        ) {
          throw new CapabilityRevealConflictError("Capability occurrence Catalog binding changed before reveal commit.")
        }
        const current = toolPartByID(db, context.messageID, context.toolPartID)
        if (current.tool !== "capability_search" || current.callID !== callID || current.state.status !== "running") {
          throw new CapabilityRevealConflictError(
            `Capability search ${callID} is ${current.state.status}; reveal commit requires its running request.`,
          )
        }
        if (canonicalJSONValue(current.state.input) !== canonicalJSONValue(params)) {
          throw new CapabilityRevealConflictError(`Capability search ${callID} input changed before reveal commit.`)
        }
        const currentParts = transactionParts(db, context.sessionID, input.occurrenceID)
        const openExecutions = currentParts.filter(
          (part) =>
            part.id !== context.toolPartID &&
            part.tool !== "capability_search" &&
            (part.state.status === "pending" || part.state.status === "running"),
        )
        if (openExecutions.length > 0) {
          throw new CapabilityRevealConflictError(
            `Capability reveal cannot change the active set while Tool calls ${openExecutions
              .map((part) => part.callID)
              .sort(compareCanonicalStrings)
              .join(", ")} are open.`,
          )
        }
        const currentState = foldCapabilityRevealReceipts({
          occurrenceID: input.occurrenceID,
          parts: currentParts,
          harnessProjectionHash: input.harness.projection_hash,
          catalogSnapshotRef: input.harness.catalog_snapshot_ref,
          catalogSnapshotHash: input.harness.catalog_snapshot_hash,
          baseDefinition: input.baseDefinition,
        })
        if (currentState.revision !== prior.revision) {
          throw new CapabilityRevealConflictError(
            `Capability reveal compare-and-swap expected revision ${prior.revision}, current is ${currentState.revision}.`,
          )
        }
        const currentCandidate = reduceCapabilityRevealCandidate({
          prior: currentState,
          deactivateRefs: params.deactivate_refs,
          activated,
        })
        if (
          currentCandidate.definitionDigest !== candidate.definitionDigest ||
          currentCandidate.payloadChars !== candidate.payloadChars ||
          currentCandidate.payloadTokens !== candidate.payloadTokens ||
          canonicalJSONValue(currentCandidate.activeRefs) !== canonicalJSONValue(candidate.activeRefs)
        ) {
          throw new CapabilityRevealConflictError("Capability reveal candidate changed before commit.")
        }
        Session.writePartInTransaction(
          db,
          Message.ToolPart.parse({
            id: committed.id,
            messageID: committed.messageID,
            sessionID: committed.sessionID,
            type: "tool",
            callID: committed.callID,
            tool: committed.tool,
            state: {
              status: "completed",
              input: params,
              output,
              title: "Capability search",
              metadata,
              time: {
                start: current.state.time.start,
                end: Math.max(Date.now(), current.state.time.start + 1),
              },
            },
          }),
          { publish: true },
        )
      })
      return { title: "Capability search", output, metadata }
    },
  }
}
