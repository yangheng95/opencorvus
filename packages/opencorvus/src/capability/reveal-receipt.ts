import z from "zod"
import type { Message } from "@/session/message"
import { CapabilitySearchInput } from "./descriptor"
import { canonicalDigestSource, canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"
import { CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { Token } from "@/util/token"

const SHA256 = /^[a-f0-9]{64}$/

export const CAPABILITY_REVEAL_RECEIPT_METADATA_KEY = "opencorvus_capability_reveal_v2"
export const CAPABILITY_SEARCH_INITIAL_MAX_CHARS = 4_000
export const CAPABILITY_SEARCH_INITIAL_MAX_TOKENS = 1_000
export const CAPABILITY_REVEAL_MAX_RESULTS = 5
export const CAPABILITY_REVEAL_MAX_ACTIVE_REFS = 10
export const CAPABILITY_REVEAL_MAX_ACTIVE_CHARS = 32_000
export const CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS = 8_000

export const NormalizedProviderToolDefinition = z
  .object({
    name: z.string().trim().min(1),
    description: z.string(),
    input_schema: z.json(),
    strict: z.boolean(),
  })
  .strict()
export type NormalizedProviderToolDefinition = z.infer<typeof NormalizedProviderToolDefinition>

export function providerToolDefinitionDigest(definition: NormalizedProviderToolDefinition): string {
  return canonicalDigestSource("provider-tool-definition-v2", NormalizedProviderToolDefinition.parse(definition)).sha256
}

export function providerToolDefinitionChars(definition: NormalizedProviderToolDefinition): number {
  return canonicalJSONValue(NormalizedProviderToolDefinition.parse(definition)).length
}

export function providerToolDefinitionTokens(definition: NormalizedProviderToolDefinition): number {
  const parsed = NormalizedProviderToolDefinition.parse(definition)
  return (
    Token.estimate(parsed.name) +
    Token.estimate(parsed.description) +
    Token.estimate(canonicalJSONValue(parsed.input_schema))
  )
}

export type CapabilityRevealBaseDefinition = Readonly<{
  providerNames: readonly string[]
  definitionDigest: string
  payloadChars: number
  payloadTokens: number
}>

export function capabilityRevealBaseDefinitions(
  definitions: readonly NormalizedProviderToolDefinition[],
): CapabilityRevealBaseDefinition {
  const parsed = definitions
    .map((definition) => NormalizedProviderToolDefinition.parse(definition))
    .sort((left, right) => compareCanonicalStrings(left.name, right.name))
  const names = parsed.map((definition) => definition.name)
  if (new Set(names).size !== names.length) {
    throw new Error("Capability reveal base Provider Tool definitions must have unique names.")
  }
  return Object.freeze({
    providerNames: Object.freeze(names),
    definitionDigest: canonicalDigestSource(
      "capability-reveal-base-provider-tool-definitions-v2",
      parsed.map((definition) => ({
        name: definition.name,
        definition_digest: providerToolDefinitionDigest(definition),
      })),
    ).sha256,
    payloadChars: parsed.reduce((total, definition) => total + providerToolDefinitionChars(definition), 0),
    payloadTokens: parsed.reduce((total, definition) => total + providerToolDefinitionTokens(definition), 0),
  })
}

function parseBaseDefinition(value: CapabilityRevealBaseDefinition): CapabilityRevealBaseDefinition {
  const providerNamesResult = z.array(z.string().trim().min(1)).safeParse(value.providerNames)
  if (!providerNamesResult.success) throw new Error("Capability reveal base Tool definition is invalid.")
  const providerNames = providerNamesResult.data
  const sortedProviderNames = [...providerNames].sort(compareCanonicalStrings)
  if (
    new Set(providerNames).size !== providerNames.length ||
    canonicalJSONValue(providerNames) !== canonicalJSONValue(sortedProviderNames) ||
    !SHA256.test(value.definitionDigest) ||
    !Number.isSafeInteger(value.payloadChars) ||
    value.payloadChars < 0 ||
    !Number.isSafeInteger(value.payloadTokens) ||
    value.payloadTokens < 0
  ) {
    throw new Error("Capability reveal base Tool definition is invalid.")
  }
  return Object.freeze({
    ...value,
    providerNames: Object.freeze(providerNames),
  })
}

export const ActivatedCapability = z
  .object({
    requested_ref: CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
      message: "A reveal activates an exact leaf reference.",
    }),
    executable_ref: CapabilityRef.refine((ref) => ref.kind === "tool" || ref.kind === "mcp_tool", {
      message: "A reveal must materialize an executable Tool reference.",
    }),
    provider_name: z.string().trim().min(1),
    definition: NormalizedProviderToolDefinition,
    definition_digest: z.string().regex(SHA256),
    payload_chars: z.number().int().nonnegative(),
    payload_tokens: z.number().int().nonnegative(),
    materializer_binding_digest: z.string().regex(SHA256),
  })
  .strict()
  .superRefine((activation, context) => {
    const digest = providerToolDefinitionDigest(activation.definition)
    if (activation.definition_digest !== digest) {
      context.addIssue({
        code: "custom",
        path: ["definition_digest"],
        message: `Definition digest must equal ${digest}.`,
      })
    }
    const chars = providerToolDefinitionChars(activation.definition)
    if (activation.payload_chars !== chars) {
      context.addIssue({
        code: "custom",
        path: ["payload_chars"],
        message: `Definition payload chars must equal ${chars}.`,
      })
    }
    const tokens = providerToolDefinitionTokens(activation.definition)
    if (activation.payload_tokens !== tokens) {
      context.addIssue({
        code: "custom",
        path: ["payload_tokens"],
        message: `Definition payload tokens must equal ${tokens}.`,
      })
    }
    if (activation.provider_name !== activation.definition.name) {
      context.addIssue({
        code: "custom",
        path: ["provider_name"],
        message: "Provider name must equal the normalized definition name.",
      })
    }
  })
export type ActivatedCapability = z.infer<typeof ActivatedCapability>

export const CapabilityRevealReceiptV2 = z
  .object({
    schema_version: z.literal(2),
    occurrence_id: z.string().min(1),
    search_call_id: z.string().min(1),
    prior_revision: z.number().int().nonnegative(),
    revision: z.number().int().positive(),
    harness_projection_hash: z.string().regex(SHA256),
    catalog_snapshot_ref: z.string().min(1),
    catalog_snapshot_hash: z.string().regex(SHA256),
    materialization_fingerprint: z.string().regex(SHA256),
    result_refs: z.array(CapabilityRef).max(CAPABILITY_REVEAL_MAX_RESULTS),
    deactivate_refs: z.array(CapabilityRef).max(CAPABILITY_REVEAL_MAX_ACTIVE_REFS),
    activated: z.array(ActivatedCapability).max(CAPABILITY_REVEAL_MAX_RESULTS),
    active_refs: z.array(CapabilityRef).max(CAPABILITY_REVEAL_MAX_ACTIVE_REFS),
    active_definition_digest: z.string().regex(SHA256),
    active_payload_chars: z.number().int().min(0).max(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS),
    active_payload_tokens: z.number().int().min(0).max(CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.revision !== receipt.prior_revision + 1) {
      context.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Reveal revision must advance the prior revision by exactly one.",
      })
    }
    for (const field of ["result_refs", "deactivate_refs", "active_refs"] as const) {
      const encoded = receipt[field].map(CapabilityRefCodec.encode)
      if (new Set(encoded).size !== encoded.length) {
        context.addIssue({ code: "custom", path: [field], message: `${field} must contain unique references.` })
      }
      const sorted = [...encoded].sort(compareCanonicalStrings)
      if (canonicalJSONValue(encoded) !== canonicalJSONValue(sorted)) {
        context.addIssue({ code: "custom", path: [field], message: `${field} must be canonically sorted.` })
      }
    }
    const activatedRefs = receipt.activated.map((entry) => CapabilityRefCodec.encode(entry.requested_ref))
    if (new Set(activatedRefs).size !== activatedRefs.length) {
      context.addIssue({ code: "custom", path: ["activated"], message: "Activated references must be unique." })
    }
  })
export type CapabilityRevealReceiptV2 = z.infer<typeof CapabilityRevealReceiptV2>

export class CorruptCapabilityRevealError extends Error {
  override readonly name = "CorruptCapabilityRevealError"
}

export class CapabilityRevealBaseDefinitionConflictError extends Error {
  override readonly name = "CapabilityRevealBaseDefinitionConflictError"
}

function persistedRevealReceiptEntries(parts: readonly Message.Part[]) {
  return parts.flatMap((part) => {
    if (part.type !== "tool" || part.tool !== "capability_search" || part.state.status !== "completed") return []
    const raw = part.state.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY]
    if (raw === undefined) {
      throw new CorruptCapabilityRevealError(
        `Completed capability_search ToolPart ${part.id} has no reveal receipt.`,
      )
    }
    try {
      return [{ part, receipt: CapabilityRevealReceiptV2.parse(raw) }]
    } catch (error) {
      if (error instanceof CorruptCapabilityRevealError) throw error
      throw new CorruptCapabilityRevealError(`Capability reveal receipt on ToolPart ${part.id} is invalid.`, {
        cause: error,
      })
    }
  })
}

/**
 * A reveal receipt makes the Provider base immutable for its occurrence. When
 * a later binary promotes one of those exact leaves into the base for new
 * occurrences, the old occurrence must continue reducing against the base it
 * actually recorded instead of being reinterpreted as corrupt.
 */
export function persistedCapabilityRevealProviderNames(input: {
  occurrenceID: string
  parts: readonly Message.Part[]
}): readonly string[] {
  const names = new Set<string>()
  for (const { receipt } of persistedRevealReceiptEntries(input.parts)) {
    if (receipt.occurrence_id !== input.occurrenceID) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal revision ${receipt.revision} belongs to occurrence ${receipt.occurrence_id}, not ${input.occurrenceID}.`,
      )
    }
    for (const activation of receipt.activated) names.add(activation.provider_name)
  }
  return Object.freeze([...names].sort(compareCanonicalStrings))
}

function canonicalRefs(refs: readonly CapabilityRef[]): CapabilityRef[] {
  const values = new Map<string, CapabilityRef>()
  for (const value of refs) {
    const ref = CapabilityRef.parse(value)
    const encoded = CapabilityRefCodec.encode(ref)
    if (values.has(encoded)) throw new Error(`Capability reveal repeats reference ${encoded}.`)
    values.set(encoded, ref)
  }
  return [...values.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, ref]) => ref)
}

function canonicalActivations(values: readonly ActivatedCapability[]): ActivatedCapability[] {
  const parsed = values.map((value) => ActivatedCapability.parse(value))
  return parsed.sort((left, right) =>
    compareCanonicalStrings(CapabilityRefCodec.encode(left.requested_ref), CapabilityRefCodec.encode(right.requested_ref)),
  )
}

export function capabilityRevealMaterializationFingerprint(input: {
  occurrenceID: string
  callID: string
  priorRevision: number
  harnessProjectionHash: string
  catalogSnapshotRef: string
  catalogSnapshotHash: string
  params: unknown
  resultRefs: readonly CapabilityRef[]
  activated: readonly ActivatedCapability[]
  activeRefs: readonly CapabilityRef[]
  activeDefinitionDigest: string
  activePayloadChars: number
  activePayloadTokens: number
}): string {
  return canonicalDigestSource("capability-reveal-preparation-v2", {
    occurrence_id: input.occurrenceID,
    call_id: input.callID,
    prior_revision: input.priorRevision,
    harness_projection_hash: input.harnessProjectionHash,
    catalog_snapshot_ref: input.catalogSnapshotRef,
    catalog_snapshot_hash: input.catalogSnapshotHash,
    params: CapabilitySearchInput.parse(input.params),
    result_refs: canonicalRefs(input.resultRefs),
    activated: canonicalActivations(input.activated),
    active_refs: canonicalRefs(input.activeRefs),
    active_definition_digest: input.activeDefinitionDigest,
    active_payload_chars: input.activePayloadChars,
    active_payload_tokens: input.activePayloadTokens,
  }).sha256
}

function activeDefinitionState(
  active: ReadonlyMap<string, ActivatedCapability>,
  baseDefinition: CapabilityRevealBaseDefinition,
) {
  const base = parseBaseDefinition(baseDefinition)
  const baseProviderNames = new Set(base.providerNames)
  const byProviderName = new Map<string, ActivatedCapability>()
  for (const activation of active.values()) {
    if (baseProviderNames.has(activation.provider_name)) {
      throw new CorruptCapabilityRevealError(
        `Provider Tool name ${activation.provider_name} is already owned by the permanent base definition.`,
      )
    }
    const previous = byProviderName.get(activation.provider_name)
    if (
      previous &&
      (previous.definition_digest !== activation.definition_digest ||
        CapabilityRefCodec.encode(previous.executable_ref) !== CapabilityRefCodec.encode(activation.executable_ref))
    ) {
      throw new CorruptCapabilityRevealError(
        `Provider Tool name ${activation.provider_name} maps to conflicting active executable definitions.`,
      )
    }
    byProviderName.set(activation.provider_name, activation)
  }
  const definitions = [...byProviderName.values()].sort((left, right) =>
    compareCanonicalStrings(left.provider_name, right.provider_name),
  )
  const payloadChars = definitions.reduce((total, activation) => total + activation.payload_chars, base.payloadChars)
  const payloadTokens = definitions.reduce((total, activation) => total + activation.payload_tokens, base.payloadTokens)
  const digest = canonicalDigestSource(
    "active-provider-tool-definitions-v2",
    {
      base_definition_digest: base.definitionDigest,
      leaves: definitions.map((activation) => ({
        provider_name: activation.provider_name,
        executable_ref: activation.executable_ref,
        definition_digest: activation.definition_digest,
        materializer_binding_digest: activation.materializer_binding_digest,
      })),
    },
  ).sha256
  return { definitions, payloadChars, payloadTokens, digest }
}

export function createCapabilityRevealReceipt(input: Omit<CapabilityRevealReceiptV2, "schema_version">) {
  return CapabilityRevealReceiptV2.parse({
    schema_version: 2,
    ...input,
    result_refs: canonicalRefs(input.result_refs),
    deactivate_refs: canonicalRefs(input.deactivate_refs),
    activated: canonicalActivations(input.activated),
    active_refs: canonicalRefs(input.active_refs),
  })
}

export type CapabilityRevealState = Readonly<{
  revision: number
  active: ReadonlyMap<string, ActivatedCapability>
  definitions: readonly ActivatedCapability[]
  payloadChars: number
  payloadTokens: number
  definitionDigest: string
  baseDefinition: CapabilityRevealBaseDefinition
  receipts: readonly CapabilityRevealReceiptV2[]
}>

export const TurnCapabilityProjectionV2 = z
  .object({
    schema_version: z.literal(2),
    occurrence_id: z.string().min(1),
    revision: z.number().int().nonnegative(),
    harness_projection_hash: z.string().regex(SHA256),
    catalog_snapshot_ref: z.string().min(1),
    catalog_snapshot_hash: z.string().regex(SHA256),
    active_refs: z.array(CapabilityRef).max(CAPABILITY_REVEAL_MAX_ACTIVE_REFS),
    active_definition_digest: z.string().regex(SHA256),
    active_payload_chars: z.number().int().min(0).max(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS),
    active_payload_tokens: z.number().int().min(0).max(CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS),
    projection_hash: z.string().regex(SHA256),
  })
  .strict()
export type TurnCapabilityProjectionV2 = z.infer<typeof TurnCapabilityProjectionV2>

export function createTurnCapabilityProjection(input: {
  occurrenceID: string
  harnessProjectionHash: string
  catalogSnapshotRef: string
  catalogSnapshotHash: string
  state: CapabilityRevealState
}): TurnCapabilityProjectionV2 {
  const value = {
    schema_version: 2 as const,
    occurrence_id: input.occurrenceID,
    revision: input.state.revision,
    harness_projection_hash: input.harnessProjectionHash,
    catalog_snapshot_ref: input.catalogSnapshotRef,
    catalog_snapshot_hash: input.catalogSnapshotHash,
    active_refs: canonicalRefs([...input.state.active.values()].map((activation) => activation.requested_ref)),
    active_definition_digest: input.state.definitionDigest,
    active_payload_chars: input.state.payloadChars,
    active_payload_tokens: input.state.payloadTokens,
  }
  return TurnCapabilityProjectionV2.parse({
    ...value,
    projection_hash: canonicalDigestSource("turn-capability-projection-v2", value).sha256,
  })
}

export function foldCapabilityRevealReceipts(input: {
  occurrenceID: string
  parts: readonly Message.Part[]
  harnessProjectionHash: string
  catalogSnapshotRef: string
  catalogSnapshotHash: string
  baseDefinition: CapabilityRevealBaseDefinition
}): CapabilityRevealState {
  const entries = persistedRevealReceiptEntries(input.parts)
  entries.sort((left, right) => left.receipt.revision - right.receipt.revision)
  const callIDs = new Set<string>()
  const active = new Map<string, ActivatedCapability>()
  let revision = 0
  for (const { part, receipt } of entries) {
    if (receipt.search_call_id !== part.callID) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal receipt on ToolPart ${part.id} belongs to call ${receipt.search_call_id}, not ${part.callID}.`,
      )
    }
    if (callIDs.has(receipt.search_call_id)) {
      throw new CorruptCapabilityRevealError(
        `Capability search call ${receipt.search_call_id} has multiple completed receipts.`,
      )
    }
    callIDs.add(receipt.search_call_id)
    if (
      receipt.occurrence_id !== input.occurrenceID ||
      receipt.harness_projection_hash !== input.harnessProjectionHash ||
      receipt.catalog_snapshot_ref !== input.catalogSnapshotRef ||
      receipt.catalog_snapshot_hash !== input.catalogSnapshotHash
    ) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal revision ${receipt.revision} changed occurrence authority: ` +
          `occurrence ${receipt.occurrence_id} != ${input.occurrenceID}; ` +
          `harness ${receipt.harness_projection_hash} != ${input.harnessProjectionHash}; ` +
          `catalog_ref ${receipt.catalog_snapshot_ref} != ${input.catalogSnapshotRef}; ` +
          `catalog_hash ${receipt.catalog_snapshot_hash} != ${input.catalogSnapshotHash}.`,
      )
    }
    if (receipt.prior_revision !== revision || receipt.revision !== revision + 1) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal revision chain expected ${revision + 1}, found ${receipt.revision}.`,
      )
    }
    for (const ref of receipt.deactivate_refs) active.delete(CapabilityRefCodec.encode(ref))
    for (const activation of receipt.activated) {
      active.set(CapabilityRefCodec.encode(activation.requested_ref), activation)
    }
    if (active.size > CAPABILITY_REVEAL_MAX_ACTIVE_REFS) {
      throw new CorruptCapabilityRevealError(`Capability reveal revision ${receipt.revision} exceeds active-ref budget.`)
    }
    const expectedRefs = [...active.values()]
      .map((activation) => activation.requested_ref)
      .sort((left, right) => compareCanonicalStrings(CapabilityRefCodec.encode(left), CapabilityRefCodec.encode(right)))
    if (canonicalJSONValue(expectedRefs) !== canonicalJSONValue(receipt.active_refs)) {
      throw new CorruptCapabilityRevealError(`Capability reveal revision ${receipt.revision} active refs do not reduce.`)
    }
    const definitions = activeDefinitionState(active, input.baseDefinition)
    if (
      definitions.payloadChars !== receipt.active_payload_chars ||
      definitions.payloadTokens !== receipt.active_payload_tokens ||
      definitions.digest !== receipt.active_definition_digest
    ) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal revision ${receipt.revision} active definition totals do not reduce.`,
      )
    }
    let expectedFingerprint: string
    try {
      const params = CapabilitySearchInput.parse(part.state.input)
      const requestedRefs = canonicalRefs(params.exact_refs)
      const activatedRefs = canonicalRefs(receipt.activated.map((activation) => activation.requested_ref))
      if (canonicalJSONValue(requestedRefs) !== canonicalJSONValue(activatedRefs)) {
        throw new Error("Activated refs do not match persisted exact_refs.")
      }
      if (
        canonicalJSONValue(canonicalRefs(params.deactivate_refs)) !==
        canonicalJSONValue(receipt.deactivate_refs)
      ) {
        throw new Error("Deactivated refs do not match persisted deactivate_refs.")
      }
      expectedFingerprint = capabilityRevealMaterializationFingerprint({
        occurrenceID: input.occurrenceID,
        callID: part.callID,
        priorRevision: revision,
        harnessProjectionHash: input.harnessProjectionHash,
        catalogSnapshotRef: input.catalogSnapshotRef,
        catalogSnapshotHash: input.catalogSnapshotHash,
        params,
        resultRefs: receipt.result_refs,
        activated: receipt.activated,
        activeRefs: receipt.active_refs,
        activeDefinitionDigest: receipt.active_definition_digest,
        activePayloadChars: receipt.active_payload_chars,
        activePayloadTokens: receipt.active_payload_tokens,
      })
    } catch (error) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal receipt on ToolPart ${part.id} has invalid persisted search input.`,
        { cause: error },
      )
    }
    if (receipt.materialization_fingerprint !== expectedFingerprint) {
      throw new CorruptCapabilityRevealError(
        `Capability reveal receipt on ToolPart ${part.id} does not match its call identity and persisted search input.`,
      )
    }
    revision = receipt.revision
  }
  const definitions = activeDefinitionState(active, input.baseDefinition)
  if (
    definitions.payloadChars > CAPABILITY_REVEAL_MAX_ACTIVE_CHARS ||
    definitions.payloadTokens > CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS
  ) {
    throw new CorruptCapabilityRevealError("Capability reveal active Provider Tool payload exceeds its budget.")
  }
  return Object.freeze({
    revision,
    active: new Map(active),
    definitions: Object.freeze(definitions.definitions),
    payloadChars: definitions.payloadChars,
    payloadTokens: definitions.payloadTokens,
    definitionDigest: definitions.digest,
    baseDefinition: Object.freeze({ ...parseBaseDefinition(input.baseDefinition) }),
    receipts: Object.freeze(entries.map((entry) => entry.receipt)),
  })
}

export function reduceCapabilityRevealCandidate(input: {
  prior: CapabilityRevealState
  deactivateRefs: readonly CapabilityRef[]
  activated: readonly ActivatedCapability[]
}) {
  const baseProviderNames = new Set(parseBaseDefinition(input.prior.baseDefinition).providerNames)
  const active = new Map(input.prior.active)
  for (const ref of canonicalRefs(input.deactivateRefs)) active.delete(CapabilityRefCodec.encode(ref))
  for (const activation of canonicalActivations(input.activated)) {
    if (baseProviderNames.has(activation.provider_name)) {
      throw new CapabilityRevealBaseDefinitionConflictError(
        `Provider Tool name ${activation.provider_name} is already owned by the permanent base definition.`,
      )
    }
    active.set(CapabilityRefCodec.encode(activation.requested_ref), activation)
  }
  if (active.size > CAPABILITY_REVEAL_MAX_ACTIVE_REFS) {
    throw new Error(`Capability reveal would activate ${active.size} refs; maximum is ${CAPABILITY_REVEAL_MAX_ACTIVE_REFS}.`)
  }
  const definitions = activeDefinitionState(active, input.prior.baseDefinition)
  if (definitions.payloadChars > CAPABILITY_REVEAL_MAX_ACTIVE_CHARS) {
    throw new Error(
      `Capability reveal Tool payload would be ${definitions.payloadChars} chars; maximum is ${CAPABILITY_REVEAL_MAX_ACTIVE_CHARS}.`,
    )
  }
  if (definitions.payloadTokens > CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS) {
    throw new Error(
      `Capability reveal Tool payload would be ${definitions.payloadTokens} estimated tokens; maximum is ${CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS}.`,
    )
  }
  return {
    active,
    activeRefs: canonicalRefs([...active.values()].map((activation) => activation.requested_ref)),
    definitions: definitions.definitions,
    payloadChars: definitions.payloadChars,
    payloadTokens: definitions.payloadTokens,
    definitionDigest: definitions.digest,
  }
}
