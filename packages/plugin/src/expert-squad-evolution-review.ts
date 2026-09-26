import { artifactReadLocatorKey, type ArtifactReadLocator } from "./artifact-catalog.js"
import { EvolutionArtifactSchemas } from "./expert-squad-evolution-artifact.js"
import { canonicalEvolutionJSON } from "./expert-squad-evolution.js"

type Review = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/integrity-review"]["parse"]>

export type LocatedEvolutionReview = { locator: ArtifactReadLocator; value: Review }

export class EvolutionReviewLineageError extends Error {
  override readonly name = "EvolutionReviewLineageError"
  constructor(
    readonly code: "duplicate_identity" | "conflicting_identity" | "missing_parent" | "different_evaluation" | "duplicate_parent" | "cycle",
    detail: string,
  ) {
    super(`Evolution Review lineage ${code}: ${detail}`)
  }
}

/** Resolve declared replacement edges, never chronology or ordinary citations. */
export function resolveEvolutionIntegrityReviews<T extends LocatedEvolutionReview>(
  reviews: readonly T[],
  referenceKey: (locator: ArtifactReadLocator) => string = artifactReadLocatorKey,
) {
  const byKey = new Map<string, T[]>()
  const identities = new Set<string>()
  for (const review of reviews) {
    const identity = artifactReadLocatorKey(review.locator)
    if (identities.has(identity)) throw new EvolutionReviewLineageError("duplicate_identity", identity)
    identities.add(identity)
    const key = referenceKey(review.locator)
    const aliases = byKey.get(key) ?? []
    if (aliases.length && canonicalEvolutionJSON(aliases[0]!.value) !== canonicalEvolutionJSON(review.value))
      throw new EvolutionReviewLineageError("conflicting_identity", key)
    byKey.set(key, [...aliases, review])
  }
  const parents = new Map<string, string[]>()
  const superseded = new Set<string>()
  for (const [key, aliases] of byKey) {
    const review = aliases[0]!
    const declared = review.value.revision?.supersedes ?? []
    const declaredKeys = declared.map(artifactReadLocatorKey)
    if (new Set(declaredKeys).size !== declaredKeys.length) throw new EvolutionReviewLineageError("duplicate_parent", key)
    const keys = [...new Set(declared.map(referenceKey))]
    for (const parentKey of keys) {
      const parent = byKey.get(parentKey)?.[0]
      if (!parent) throw new EvolutionReviewLineageError("missing_parent", parentKey)
      if (
        referenceKey(parent.value.evaluation_result_locator) !==
          referenceKey(review.value.evaluation_result_locator) ||
        parent.value.case_id !== review.value.case_id ||
        parent.value.arm !== review.value.arm ||
        parent.value.repetition !== review.value.repetition
      )
        throw new EvolutionReviewLineageError("different_evaluation", `${key} -> ${parentKey}`)
      superseded.add(parentKey)
    }
    parents.set(key, keys)
  }
  const visited = new Set<string>()
  const visiting = new Set<string>()
  function visit(key: string) {
    if (visiting.has(key)) throw new EvolutionReviewLineageError("cycle", key)
    if (visited.has(key)) return
    visiting.add(key)
    for (const parent of parents.get(key)!) visit(parent)
    visiting.delete(key)
    visited.add(key)
  }
  for (const key of byKey.keys()) visit(key)
  const ordered = [...byKey.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return {
    current: ordered.filter(([key]) => !superseded.has(key)).flatMap(([, aliases]) => aliases),
    superseded: ordered.filter(([key]) => superseded.has(key)).flatMap(([, aliases]) => aliases),
  }
}
