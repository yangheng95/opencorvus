import { CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"

type CatalogProjection = { capability_refs: string[] }
type CatalogCapabilitySet = { member_refs: string[] }

export function catalogProjectionLeaves(
  selected: Record<string, unknown>,
  projection: Record<string, unknown>,
): CapabilityRef[] {
  const capabilitySets = selected.capability_sets as Record<string, CatalogCapabilitySet>
  return (projection as CatalogProjection).capability_refs.flatMap((encoded) => {
    const ref = CapabilityRefCodec.decode(encoded)
    if (ref.kind !== "capability_set") return [ref]
    if (ref.source !== "package") return []
    const definition = capabilitySets[ref.local_ref]
    if (!definition) throw new Error(`Catalog projection references missing capability set ${ref.local_ref}`)
    return definition.member_refs.map(CapabilityRefCodec.decode)
  })
}

export function catalogPackageSkillRefs(
  selected: Record<string, unknown>,
  projection: Record<string, unknown>,
): string[] {
  return catalogProjectionLeaves(selected, projection)
    .filter((ref) => ref.kind === "skill" && ref.source === "package")
    .map((ref) => ref.local_ref)
    .sort()
}
