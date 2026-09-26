import { artifactReadLocatorKey, type ArtifactReadLocator } from "./artifact-catalog.js"
import { EvolutionArtifactSchemas } from "./expert-squad-evolution-artifact.js"

type Review = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/integrity-review"]["parse"]>

export type LocatedEvolutionReview = { locator: ArtifactReadLocator; value: Review }

export class EvolutionReviewLineageError extends Error {
  override readonly name = "EvolutionReviewLineageError"
  constructor(
    readonly code: "duplicate_identity" | "missing_parent" | "different_evaluation" | "duplicate_parent" | "cycle",
    detail: string,
  ) {
    super(`Evolution Review lineage ${code}: ${detail}`)
  }
}

/** Resolve declared replacement edges, never chronology or ordinary citations. */
export function resolveEvolutionIntegrityReviews<T extends LocatedEvolutionReview>(reviews: readonly T[]) {
  const byKey = new Map<string, T>()
  for (const review of reviews) {
    const key = artifactReadLocatorKey(review.locator)
    if (byKey.has(key)) throw new EvolutionReviewLineageError("duplicate_identity", key)
    byKey.set(key, review)
  }
  const parents = new Map<string, string[]>()
  const superseded = new Set<string>()
  for (const [key, review] of byKey) {
    const declared = review.value.revision?.supersedes ?? []
    const keys = declared.map(artifactReadLocatorKey)
    if (new Set(keys).size !== keys.length) throw new EvolutionReviewLineageError("duplicate_parent", key)
    for (const parentKey of keys) {
      const parent = byKey.get(parentKey)
      if (!parent) throw new EvolutionReviewLineageError("missing_parent", parentKey)
      if (
        artifactReadLocatorKey(parent.value.evaluation_result_locator) !==
          artifactReadLocatorKey(review.value.evaluation_result_locator) ||
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
    current: ordered.filter(([key]) => !superseded.has(key)).map(([, review]) => review),
    superseded: ordered.filter(([key]) => superseded.has(key)).map(([, review]) => review),
  }
}
