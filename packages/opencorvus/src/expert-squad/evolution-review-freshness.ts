import z from "zod"
import {
  canonicalEvolutionJSON,
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  expandEvolutionMeasurementAliases,
  createEvolutionArtifactReferences,
  evolutionArtifactProvenance,
  resolveEvolutionComparisonInputs,
  requireEvolutionTrialSlotIdentity,
  EvolutionArtifactSchemas,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, and, eq, inArray } from "@/storage/db"

type Envelope = z.infer<typeof EngineArtifactEnvelopeSchema>
type EvidenceArtifact = { locator: EngineArtifactLocator; envelope: Envelope }

/** The same exact-identity difference for a live commit and a frozen history read.
 * Findings stay the Auditor's facts; this does not recalculate a recommendation.
 */
export function missingComparisonReviews(input: {
  comparison: Envelope
  measurements: readonly EvidenceArtifact[]
  catalog: readonly EvidenceArtifact[]
}): EngineArtifactLocator[] {
  const references = createEvolutionArtifactReferences([...input.measurements, ...input.catalog])
  const consumed = resolveEvolutionComparisonInputs(input.comparison, references)
  const measurements = [...consumed.runs, ...consumed.evaluations].map((item) => item.artifact)
  const evaluations = new Set(
    expandEvolutionMeasurementAliases(measurements, input.catalog, references.key)
      .filter((item) => item.envelope.artifact_type === "evolution-lab/evaluation-result")
      .map((item) => references.key(item.locator)),
  )
  const selected = new Set(consumed.reviews.map((item) => references.key(item.locator)))
  return input.catalog
    .filter(({ locator, envelope }) => {
      if (envelope.artifact_type !== "evolution-lab/integrity-review") return false
      const correlation = z
        .object({ evaluation_result_locator: EngineArtifactLocatorSchema })
        .safeParse(envelope.payload)
      // A malformed related record also changes the evidence set. A subsequent
      // publication must expose its diagnostic instead of treating it as absent.
      const related = correlation.success
        ? evaluations.has(references.key(correlation.data.evaluation_result_locator))
        : evolutionArtifactProvenance(envelope).sources.some((source) => evaluations.has(references.key(source)))
      return related && !selected.has(references.key(locator))
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
    const nativeSources = (comparison.producer.owner_kind === "mission" ? [] : comparison.source_artifact_locators).flatMap((locator) =>
      locator.source === "engine_artifact" ? [{ locator, envelope: read(locator) }] : [],
    )
    const catalog = db
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
          inArray(EngineArtifactTable.catalog_artifact_type, Object.keys(EvolutionArtifactSchemas)),
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
    const references = createEvolutionArtifactReferences([...catalog, ...nativeSources])
    const consumed = resolveEvolutionComparisonInputs(comparison, references)
    requireEvolutionTrialSlotIdentity({
      runs: consumed.runs.map(({ locator, artifact }) => ({ locator,
        value: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(artifact.envelope.payload) })),
      evaluations: consumed.evaluations.map(({ locator, artifact }) => ({ locator,
        value: EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(artifact.envelope.payload) })),
    })
    const measurements = [consumed.campaign, consumed.candidate, ...consumed.runs,
      ...consumed.evaluations, ...consumed.reviews].map((item) => item.artifact)
    const missingReviewLocators = missingComparisonReviews({ comparison, measurements, catalog })
    if (missingReviewLocators.length)
      throw new EvolutionComparisonReviewChangedError({ ...input, missingReviewLocators })
  })
}
