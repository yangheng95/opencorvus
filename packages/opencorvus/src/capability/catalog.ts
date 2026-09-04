import z from "zod"
import { createInstanceState } from "@/project/instance-state"
import { ProjectInstanceContext } from "@/project/instance-context"
import { canonicalDigestSource, canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"
import { scoreDiscoveryFields, type DiscoverySearchField } from "./fuzzy"
import {
  CapabilityCaller,
  CapabilityCatalogContext,
  CapabilityCatalogProjection,
  CapabilityCatalogSource,
  CapabilityCatalogViewEntry,
  CapabilityDescriptor,
  CapabilitySearchFilterDiagnostic,
  CapabilitySearchInput,
  CapabilitySearchResult,
  CapabilitySetDescriptor,
  createCapabilityCatalogProjection,
  createCapabilityCatalogSource,
  type CapabilityCatalogProjection as CapabilityCatalogProjectionValue,
  type CapabilityCatalogSource as CapabilityCatalogSourceValue,
  type CapabilityCatalogViewEntry as CapabilityCatalogViewEntryValue,
  type CapabilityBehavior as CapabilityBehaviorValue,
  type CapabilityDescriptor as CapabilityDescriptorValue,
  type CapabilitySearchFilterDiagnostic as CapabilitySearchFilterDiagnosticValue,
  type CapabilitySearchResult as CapabilitySearchResultValue,
  type CapabilitySetDescriptor as CapabilitySetDescriptorValue,
} from "./descriptor"
import { CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"

const MAX_SOURCE_CACHE_ENTRIES = 256
const MAX_SNAPSHOT_CACHE_ENTRIES = 128

export class CapabilityCatalogContractError extends Error {
  override readonly name = "CapabilityCatalogContractError"

  constructor(
    public readonly code:
      | "duplicate_owner"
      | "duplicate_projection_owner"
      | "duplicate_ref"
      | "duplicate_view_ref"
      | "foreign_owner_ref"
      | "unknown_projection_owner"
      | "unknown_view_ref"
      | "unknown_behavior_target"
      | "view_digest_mismatch"
      | "unknown_set_member"
      | "source_revision_conflict"
      | "noncanonical_snapshot",
    message: string,
  ) {
    super(message)
  }
}

function exactStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && typeof (value as Record<string, unknown>)[key] === "string",
  )
}

export const CapabilityOwnerRevisionVector = z.custom<Record<string, string>>(exactStringRecord, {
  message: "Owner revisions must be an own-key string record.",
})
export const CapabilityProjectionRevisionVector = CapabilityOwnerRevisionVector.refine(
  (value) => Object.values(value).every((revision) => /^[a-f0-9]{64}$/.test(revision)),
  { message: "Projection revisions must be SHA-256 strings." },
)

export const CapabilityCatalogSnapshot = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    context: CapabilityCatalogContext,
    owner_revisions: CapabilityOwnerRevisionVector,
    projection_revisions: CapabilityProjectionRevisionVector,
    descriptors: z.array(CapabilityDescriptor),
    views: z.array(CapabilityCatalogViewEntry),
    sets: z.array(CapabilitySetDescriptor),
  })
  .strict()
export type CapabilityCatalogSnapshot = z.infer<typeof CapabilityCatalogSnapshot>

function freezeDescriptor(descriptor: CapabilityDescriptorValue): CapabilityDescriptorValue {
  return Object.freeze({
    ...descriptor,
    ref: Object.freeze({ ...descriptor.ref }),
    aliases: Object.freeze([...descriptor.aliases]) as string[],
    search_terms: Object.freeze([...descriptor.search_terms]) as string[],
    ...(descriptor.product_pillars
      ? { product_pillars: Object.freeze([...descriptor.product_pillars]) as Array<"code" | "work"> }
      : {}),
    behavior: freezeBehavior(descriptor.behavior),
  })
}

function freezeBehavior(behavior: CapabilityBehaviorValue): CapabilityBehaviorValue {
  const frozen = { ...behavior } as Record<string, unknown>
  for (const key of ["tool_ref", "loader_tool_ref", "action_tool_ref", "server_ref", "prompt_ref", "resource_ref"]) {
    const ref = frozen[key]
    if (ref && typeof ref === "object") frozen[key] = Object.freeze({ ...(ref as object) })
  }
  return Object.freeze(frozen) as CapabilityBehaviorValue
}

function behaviorTargetRefs(behavior: CapabilityBehaviorValue) {
  switch (behavior.kind) {
    case "call_tool":
      return [behavior.tool_ref]
    case "open_skill":
    case "open_mission_skill":
      return [behavior.loader_tool_ref]
    case "create_task":
    case "manage":
      return [behavior.action_tool_ref]
    case "inspect_mcp":
      return [behavior.action_tool_ref, behavior.server_ref]
    case "open_mcp_prompt":
      return [behavior.action_tool_ref, behavior.prompt_ref]
    case "open_mcp_resource":
      return [behavior.action_tool_ref, behavior.resource_ref]
    case "unavailable":
      return []
  }
}

function freezeView(entry: CapabilityCatalogViewEntryValue): CapabilityCatalogViewEntryValue {
  return Object.freeze({
    ...entry,
    descriptor_ref: Object.freeze({ ...entry.descriptor_ref }),
    discoverable_by: Object.freeze([...entry.discoverable_by]) as Array<z.infer<typeof CapabilityCaller>>,
    next_owner: Object.freeze({ ...entry.next_owner }),
  })
}

function freezeSet(set: CapabilitySetDescriptorValue): CapabilitySetDescriptorValue {
  return Object.freeze({
    ...set,
    ref: Object.freeze({ ...set.ref }),
    member_refs: Object.freeze(set.member_refs.map((ref) => Object.freeze({ ...ref }))) as typeof set.member_refs,
  })
}

function freezeSource(source: CapabilityCatalogSourceValue): CapabilityCatalogSourceValue {
  return Object.freeze({
    ...source,
    descriptors: Object.freeze(source.descriptors.map(freezeDescriptor)) as CapabilityDescriptorValue[],
    sets: Object.freeze(source.sets.map(freezeSet)) as CapabilitySetDescriptorValue[],
  })
}

function ownRecord(entries: ReadonlyMap<string, string>): Record<string, string> {
  return Object.fromEntries([...entries.entries()].sort(([left], [right]) => compareCanonicalStrings(left, right)))
}

export function capabilityCatalogRevision(input: {
  context: z.input<typeof CapabilityCatalogContext>
  owner_revisions: Record<string, string>
  projection_revisions: Record<string, string>
  descriptors: readonly CapabilityDescriptorValue[]
  views: readonly CapabilityCatalogViewEntryValue[]
  sets: readonly CapabilitySetDescriptorValue[]
}): string {
  return canonicalDigestSource("capability-catalog-snapshot-v3", {
    context: CapabilityCatalogContext.parse(input.context),
    owner_revisions: CapabilityOwnerRevisionVector.parse(input.owner_revisions),
    projection_revisions: CapabilityProjectionRevisionVector.parse(input.projection_revisions),
    descriptors: input.descriptors,
    views: input.views,
    sets: input.sets,
  }).sha256
}

function canonicalSnapshot(input: {
  context: z.input<typeof CapabilityCatalogContext>
  sources: readonly CapabilityCatalogSourceValue[]
  projections: readonly CapabilityCatalogProjectionValue[]
}): CapabilityCatalogSnapshot {
  const context = CapabilityCatalogContext.parse(input.context)
  const sources = input.sources
    .map((source) => createCapabilityCatalogSource(source))
    .sort((left, right) => compareCanonicalStrings(left.owner_ref, right.owner_ref))
  const projections = input.projections
    .map((projection) => createCapabilityCatalogProjection(projection))
    .sort((left, right) => compareCanonicalStrings(left.owner_ref, right.owner_ref))
  const ownerRevisions = new Map<string, string>()
  const projectionRevisions = new Map<string, string>()
  const descriptorByRef = new Map<string, CapabilityDescriptorValue>()
  const viewByRef = new Map<string, CapabilityCatalogViewEntryValue>()
  const setByRef = new Map<string, CapabilitySetDescriptorValue>()

  for (const source of sources) {
    if (ownerRevisions.has(source.owner_ref)) {
      throw new CapabilityCatalogContractError(
        "duplicate_owner",
        `Capability catalog contains duplicate owner ${JSON.stringify(source.owner_ref)}.`,
      )
    }
    ownerRevisions.set(source.owner_ref, source.owner_revision)
    for (const descriptor of source.descriptors) {
      const encoded = CapabilityRefCodec.encode(descriptor.ref)
      if (descriptor.ref.owner_ref !== source.owner_ref) {
        throw new CapabilityCatalogContractError(
          "foreign_owner_ref",
          `Capability ${encoded} belongs to ${descriptor.ref.owner_ref}, not source ${source.owner_ref}.`,
        )
      }
      if (descriptorByRef.has(encoded) || setByRef.has(encoded)) {
        throw new CapabilityCatalogContractError(
          "duplicate_ref",
          `Capability catalog contains duplicate reference ${encoded}.`,
        )
      }
      descriptorByRef.set(encoded, freezeDescriptor(descriptor))
    }
    for (const set of source.sets) {
      const encoded = CapabilityRefCodec.encode(set.ref)
      if (set.ref.owner_ref !== source.owner_ref) {
        throw new CapabilityCatalogContractError(
          "foreign_owner_ref",
          `Capability set ${encoded} belongs to ${set.ref.owner_ref}, not source ${source.owner_ref}.`,
        )
      }
      if (descriptorByRef.has(encoded) || setByRef.has(encoded)) {
        throw new CapabilityCatalogContractError(
          "duplicate_ref",
          `Capability catalog contains duplicate reference ${encoded}.`,
        )
      }
      setByRef.set(encoded, freezeSet(set))
    }
  }

  for (const projection of projections) {
    if (projectionRevisions.has(projection.owner_ref)) {
      throw new CapabilityCatalogContractError(
        "duplicate_projection_owner",
        `Capability catalog contains duplicate projection owner ${JSON.stringify(projection.owner_ref)}.`,
      )
    }
    if (!ownerRevisions.has(projection.owner_ref)) {
      throw new CapabilityCatalogContractError(
        "unknown_projection_owner",
        `Capability projection ${JSON.stringify(projection.owner_ref)} has no owner source.`,
      )
    }
    projectionRevisions.set(projection.owner_ref, projection.projection_revision)
    for (const view of projection.entries) {
      const encoded = CapabilityRefCodec.encode(view.descriptor_ref)
      if (view.descriptor_ref.owner_ref !== projection.owner_ref) {
        throw new CapabilityCatalogContractError(
          "foreign_owner_ref",
          `Capability view ${encoded} belongs to ${view.descriptor_ref.owner_ref}, not projection ${projection.owner_ref}.`,
        )
      }
      const descriptor = descriptorByRef.get(encoded)
      if (!descriptor) {
        throw new CapabilityCatalogContractError(
          "unknown_view_ref",
          `Capability projection ${projection.owner_ref} contains unknown descriptor ${encoded}.`,
        )
      }
      if (view.descriptor_digest !== descriptor.metadata_digest) {
        throw new CapabilityCatalogContractError(
          "view_digest_mismatch",
          `Capability view ${encoded} does not bind descriptor digest ${descriptor.metadata_digest}.`,
        )
      }
      if (viewByRef.has(encoded)) {
        throw new CapabilityCatalogContractError(
          "duplicate_view_ref",
          `Capability catalog contains duplicate view reference ${encoded}.`,
        )
      }
      viewByRef.set(encoded, freezeView(view))
    }
  }

  for (const [descriptorRef, descriptor] of descriptorByRef) {
    for (const target of behaviorTargetRefs(descriptor.behavior)) {
      const encoded = CapabilityRefCodec.encode(target)
      if (!descriptorByRef.has(encoded)) {
        throw new CapabilityCatalogContractError(
          "unknown_behavior_target",
          `Capability ${descriptorRef} behavior contains unknown target ${encoded}.`,
        )
      }
    }
  }

  for (const ownerRef of ownerRevisions.keys()) {
    if (!projectionRevisions.has(ownerRef)) {
      throw new CapabilityCatalogContractError(
        "unknown_projection_owner",
        `Capability owner ${JSON.stringify(ownerRef)} has no caller projection.`,
      )
    }
  }
  for (const [setRef, set] of setByRef) {
    for (const member of set.member_refs) {
      const encoded = CapabilityRefCodec.encode(member)
      if (!descriptorByRef.has(encoded)) {
        throw new CapabilityCatalogContractError(
          "unknown_set_member",
          `Capability set ${setRef} contains unknown leaf ${encoded}.`,
        )
      }
    }
  }

  const descriptors = [...descriptorByRef.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, descriptor]) => descriptor)
  const views = [...viewByRef.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, view]) => view)
  const sets = [...setByRef.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, set]) => set)
  const ownerRevisionRecord = ownRecord(ownerRevisions)
  const projectionRevisionRecord = ownRecord(projectionRevisions)
  const payload = {
    context,
    owner_revisions: ownerRevisionRecord,
    projection_revisions: projectionRevisionRecord,
    descriptors,
    views,
    sets,
  }
  const catalogRevision = capabilityCatalogRevision(payload)
  return Object.freeze({
    catalog_revision: catalogRevision,
    context: Object.freeze({ ...context }),
    owner_revisions: Object.freeze(ownerRevisionRecord),
    projection_revisions: Object.freeze(projectionRevisionRecord),
    descriptors: Object.freeze(descriptors) as CapabilityDescriptorValue[],
    views: Object.freeze(views) as CapabilityCatalogViewEntryValue[],
    sets: Object.freeze(sets) as CapabilitySetDescriptorValue[],
  }) as CapabilityCatalogSnapshot
}

type CatalogCacheState = {
  sources: Map<string, CapabilityCatalogSourceValue>
  snapshots: Map<string, CapabilityCatalogSnapshot>
  ownerGenerations: Map<string, number>
}

const cacheState = createInstanceState<CatalogCacheState>(
  () => ({ sources: new Map(), snapshots: new Map(), ownerGenerations: new Map() }),
  undefined,
  "capability-catalog-v3",
)

function retainBounded<K, V>(map: Map<K, V>, key: K, value: V, maximum: number): V {
  map.set(key, value)
  while (map.size > maximum) map.delete(map.keys().next().value!)
  return value
}

export namespace CapabilityCatalogCache {
  export async function publishSource(
    raw: z.input<typeof CapabilityCatalogSource>,
  ): Promise<CapabilityCatalogSourceValue> {
    const source = createCapabilityCatalogSource(raw)
    const cache = await cacheState()
    const key = canonicalDigestSource("capability-catalog-source-cache-key-v1", [
      source.owner_ref,
      source.owner_revision,
    ]).sha256
    const existing = cache.sources.get(key)
    if (existing) {
      if (canonicalJSONValue(existing) !== canonicalJSONValue(source)) {
        throw new CapabilityCatalogContractError(
          "source_revision_conflict",
          `Capability owner ${source.owner_ref} published different descriptors for owner revision ${source.owner_revision}.`,
        )
      }
      return existing
    }
    return retainBounded(cache.sources, key, freezeSource(source), MAX_SOURCE_CACHE_ENTRIES)
  }

  export async function publishSnapshot(input: {
    context: z.input<typeof CapabilityCatalogContext>
    sources: readonly CapabilityCatalogSourceValue[]
    projections: readonly CapabilityCatalogProjectionValue[]
  }): Promise<CapabilityCatalogSnapshot> {
    const snapshot = canonicalSnapshot(input)
    const cache = await cacheState()
    const existing = cache.snapshots.get(snapshot.catalog_revision)
    if (existing) return existing
    return retainBounded(cache.snapshots, snapshot.catalog_revision, snapshot, MAX_SNAPSHOT_CACHE_ENTRIES)
  }

  export async function reset(): Promise<void> {
    await cacheState.reset()
  }

  /**
   * Advance only process-local composition lifecycle for exact owners. Durable
   * owner revisions remain the cross-process fact, and already-bound Catalog
   * payloads remain immutable. Clearing matching content-addressed entries
   * prevents a mutation event from retaining stale process references without
   * introducing a second inventory or a generation-based read shortcut.
   */
  export async function invalidate(ownerRefs: string | readonly string[]): Promise<Record<string, number>> {
    const owners = [...new Set((typeof ownerRefs === "string" ? [ownerRefs] : ownerRefs).map((owner) => owner.trim()))]
    if (owners.some((owner) => owner.length === 0)) throw new Error("Capability owner invalidation requires exact IDs")
    const ownerSet = new Set(owners)
    const caches = ProjectInstanceContext.tryUse()
      ? [await cacheState()]
      : cacheState.inspectAll().map((entry) => entry.state)
    const advanced = new Map<string, number>()
    for (const cache of caches) {
      for (const [key, source] of [...cache.sources]) {
        if (ownerSet.has(source.owner_ref)) cache.sources.delete(key)
      }
      for (const [key, snapshot] of [...cache.snapshots]) {
        if (owners.some((owner) => Object.hasOwn(snapshot.owner_revisions, owner))) cache.snapshots.delete(key)
      }
      for (const owner of owners.sort(compareCanonicalStrings)) {
        const generation = (cache.ownerGenerations.get(owner) ?? 0) + 1
        cache.ownerGenerations.set(owner, generation)
        advanced.set(owner, Math.max(advanced.get(owner) ?? 0, generation))
      }
    }
    return Object.fromEntries(advanced)
  }

  export async function ownerGeneration(ownerRef: string): Promise<number> {
    return (await cacheState()).ownerGenerations.get(ownerRef) ?? 0
  }
}

export function createCapabilityCatalogSnapshot(input: {
  context: z.input<typeof CapabilityCatalogContext>
  sources: readonly CapabilityCatalogSourceValue[]
  projections: readonly CapabilityCatalogProjectionValue[]
}): CapabilityCatalogSnapshot {
  return canonicalSnapshot(input)
}

/** Rebuild and cross-validate every source/projection relation in a persisted view. */
export function validateCapabilityCatalogSnapshot(raw: unknown): CapabilityCatalogSnapshot {
  const parsed = CapabilityCatalogSnapshot.parse(raw)
  const ownerRefs = Object.keys(parsed.owner_revisions).sort(compareCanonicalStrings)
  const projectionOwnerRefs = Object.keys(parsed.projection_revisions).sort(compareCanonicalStrings)
  const canonical = canonicalSnapshot({
    context: parsed.context,
    sources: ownerRefs.map((ownerRef) =>
      createCapabilityCatalogSource({
        owner_ref: ownerRef,
        owner_revision: parsed.owner_revisions[ownerRef]!,
        descriptors: parsed.descriptors.filter((descriptor) => descriptor.ref.owner_ref === ownerRef),
        sets: parsed.sets.filter((set) => set.ref.owner_ref === ownerRef),
      }),
    ),
    projections: projectionOwnerRefs.map((ownerRef) =>
      createCapabilityCatalogProjection({
        owner_ref: ownerRef,
        projection_revision: parsed.projection_revisions[ownerRef]!,
        entries: parsed.views.filter((view) => view.descriptor_ref.owner_ref === ownerRef),
      }),
    ),
  })
  if (canonicalJSONValue(canonical) !== canonicalJSONValue(parsed)) {
    throw new CapabilityCatalogContractError(
      "noncanonical_snapshot",
      `Capability catalog snapshot ${parsed.catalog_revision} is not in canonical owner/ref order.`,
    )
  }
  return canonical
}

function searchFields(descriptor: CapabilityDescriptorValue): DiscoverySearchField[] {
  return [
    { text: descriptor.name, weight: 1 },
    { text: descriptor.ref.local_ref, weight: 1 },
    ...descriptor.aliases.map((alias) => ({ text: alias, weight: 0.94 })),
    ...(descriptor.aliases.length > 1 ? [{ text: descriptor.aliases.join(" "), weight: 0.92 }] : []),
    ...descriptor.search_terms.map((term) => ({ text: term, weight: 0.9 })),
    { text: descriptor.description, weight: 0.78 },
    { text: descriptor.ref.kind, weight: 0.45 },
    { text: descriptor.ref.owner_ref, weight: 0.35 },
  ]
}

export function searchCapabilityCatalog(
  snapshot: CapabilityCatalogSnapshot,
  caller: z.infer<typeof CapabilityCaller>,
  rawInput: z.input<typeof CapabilitySearchInput>,
): CapabilitySearchResultValue[] {
  return projectCapabilityCatalogSearch(snapshot, caller, rawInput).results
}

export type CapabilityCatalogSearchProjection = {
  results: CapabilitySearchResultValue[]
  filterDiagnostic: CapabilitySearchFilterDiagnosticValue | null
}

export function projectCapabilityCatalogSearch(
  snapshot: CapabilityCatalogSnapshot,
  caller: z.infer<typeof CapabilityCaller>,
  rawInput: z.input<typeof CapabilitySearchInput>,
): CapabilityCatalogSearchProjection {
  const input = CapabilitySearchInput.parse(rawInput)
  const kinds = input.kinds?.length ? new Set(input.kinds) : undefined
  const nextOwnerKinds = input.next_owner_kinds?.length ? new Set(input.next_owner_kinds) : undefined
  const owners = input.owner_refs?.length ? new Set(input.owner_refs) : undefined
  const descriptorByRef = new Map(
    snapshot.descriptors.map((descriptor) => [CapabilityRefCodec.encode(descriptor.ref), descriptor]),
  )
  const structuralCandidates = snapshot.views.flatMap((view) => {
    const descriptor = descriptorByRef.get(CapabilityRefCodec.encode(view.descriptor_ref))!
    if (!view.discoverable_by.includes(caller)) return []
    if (kinds && !kinds.has(descriptor.ref.kind)) return []
    if (owners && !owners.has(descriptor.ref.owner_ref)) return []
    if (
      input.product_pillar &&
      descriptor.ref.kind === "expert_squad" &&
      !descriptor.product_pillars?.includes(input.product_pillar)
    ) {
      return []
    }
    return [{ descriptor, view }]
  })
  const candidates = nextOwnerKinds
    ? structuralCandidates.filter(({ view }) => nextOwnerKinds.has(view.next_owner.kind))
    : structuralCandidates
  const requestedKinds = [...new Set(input.kinds ?? [])].sort(compareCanonicalStrings)
  const requestedNextOwnerKinds = [...new Set(input.next_owner_kinds ?? [])].sort(compareCanonicalStrings)
  const compatibleNextOwnerKinds = [...new Set(structuralCandidates.map(({ view }) => view.next_owner.kind))].sort(
    compareCanonicalStrings,
  )
  const filterDiagnostic =
    requestedKinds.length > 0 &&
    requestedNextOwnerKinds.length > 0 &&
    structuralCandidates.length > 0 &&
    candidates.length === 0
      ? CapabilitySearchFilterDiagnostic.parse({
          code: "incompatible_structural_filters",
          requested_kinds: requestedKinds,
          requested_next_owner_kinds: requestedNextOwnerKinds,
          compatible_next_owner_kinds: compatibleNextOwnerKinds,
          message:
            `The requested capability kinds are visible, but none have the requested next-owner kinds. ` +
            `Use one of ${JSON.stringify(compatibleNextOwnerKinds)} or omit next_owner_kinds.`,
        })
      : null
  const needles = [...new Set(input.queries.map((query) => query.trim()))]
  const ranked: Array<{
    descriptor: CapabilityDescriptorValue
    view: CapabilityCatalogViewEntryValue
    score: number | null
  }> = []
  for (const candidate of candidates) {
    if (needles.every((needle) => !needle)) {
      ranked.push({ ...candidate, score: null })
      continue
    }
    const scores = needles.flatMap((needle) => {
      if (!needle) return []
      const score = scoreDiscoveryFields(needle, searchFields(candidate.descriptor))
      return score === undefined ? [] : [score]
    })
    if (scores.length > 0) ranked.push({ ...candidate, score: Math.max(...scores) })
  }
  ranked.sort((left, right) => {
    if (left.score !== right.score) {
      if (left.score === null) return -1
      if (right.score === null) return 1
      return right.score - left.score
    }
    return compareCanonicalStrings(
      CapabilityRefCodec.encode(left.descriptor.ref),
      CapabilityRefCodec.encode(right.descriptor.ref),
    )
  })
  return {
    results: ranked.slice(0, input.limit).map(({ descriptor, view, score }) =>
      CapabilitySearchResult.parse({
        ref: descriptor.ref,
        name: descriptor.name,
        description: descriptor.description,
        aliases: descriptor.aliases,
        discoverable_by: view.discoverable_by,
        ...(descriptor.product_pillars ? { product_pillars: descriptor.product_pillars } : {}),
        availability: view.availability,
        next_owner: view.next_owner,
        catalog_revision: snapshot.catalog_revision,
        score,
      }),
    ),
    filterDiagnostic,
  }
}
