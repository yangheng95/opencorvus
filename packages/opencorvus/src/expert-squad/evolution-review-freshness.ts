import z from "zod"
import {
  canonicalEvolutionJSON,
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, and, eq } from "@/storage/db"

type Envelope = z.infer<typeof EngineArtifactEnvelopeSchema>
type ReviewArtifact = { locator: EngineArtifactLocator; envelope: Envelope }

/** The same exact-identity difference for a live commit and a frozen history read.
 * Findings stay the Auditor's facts; this does not recalculate a recommendation.
 */
export function missingComparisonReviews(input: {
  comparison: Envelope
  evaluations: readonly EngineArtifactLocator[]
  reviews: readonly ReviewArtifact[]
}): EngineArtifactLocator[] {
  const evaluations = new Set(input.evaluations.map(canonicalEvolutionJSON))
  const selected = new Set(input.comparison.source_artifact_locators.map(canonicalEvolutionJSON))
  return input.reviews
    .filter(({ locator, envelope }) => {
      const correlation = z
        .object({ evaluation_result_locator: EngineArtifactLocatorSchema })
        .safeParse(envelope.payload)
      // A malformed related record also changes the evidence set. A subsequent
      // publication must expose its diagnostic instead of treating it as absent.
      const related = correlation.success
        ? evaluations.has(canonicalEvolutionJSON(correlation.data.evaluation_result_locator))
        : envelope.source_artifact_locators.some((source) => evaluations.has(canonicalEvolutionJSON(source)))
      return related && !selected.has(canonicalEvolutionJSON(locator))
    })
    .map(({ locator }) => locator)
    .toSorted((left, right) => canonicalEvolutionJSON(left).localeCompare(canonicalEvolutionJSON(right)))
}

export const EvolutionComparisonReviewChangedError = NamedError.create(
  "EvolutionComparisonReviewChangedError",
  z.object({
    taskID: z.string(),
    comparisonLocator: EngineArtifactLocatorSchema,
    missingReviewLocators: z.array(EngineArtifactLocatorSchema).min(1),
  }),
)

/** Call in the receipt's immediate transaction to serialize Review publication
 * against the installation commit. Earlier calls are only useful preflight.
 */
export function requireCurrentEvolutionReviews(input: { taskID: string; comparisonLocator: EngineArtifactLocator }) {
  return Database.transaction((db) => {
    const read = (locator: EngineArtifactLocator) =>
      EngineArtifactEnvelopeSchema.parse(requireEngineArtifactByLocator({ db, taskID: input.taskID, locator }).payload)
    const comparison = read(input.comparisonLocator)
    const evaluations = comparison.source_artifact_locators.flatMap((source) =>
      source.source === "engine_artifact" && read(source).artifact_type === "evolution-lab/evaluation-result"
        ? [source]
        : [],
    )
    const reviews = db
      .select({
        artifactID: EngineArtifactTable.id,
        catalogRevision: EngineArtifactTable.catalog_revision,
        sha256: EngineArtifactTable.payload_sha256,
      })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "expert_output"),
          eq(EngineArtifactTable.catalog_artifact_type, "evolution-lab/integrity-review"),
        ),
      )
      .all()
      .map((row) => {
        const locator: EngineArtifactLocator = {
          source: "engine_artifact",
          artifact_id: row.artifactID,
          catalog_revision: row.catalogRevision,
          expected_sha256: row.sha256,
        }
        return { locator, envelope: read(locator) }
      })
    const missingReviewLocators = missingComparisonReviews({ comparison, evaluations, reviews })
    if (missingReviewLocators.length)
      throw new EvolutionComparisonReviewChangedError({ ...input, missingReviewLocators })
  })
}
