import {
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  createEvolutionArtifactReferences,
  type EngineArtifactEnvelope,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, and, eq, inArray } from "@/storage/db"

type ExactArtifact = { locator: EngineArtifactLocator; envelope: EngineArtifactEnvelope }

/** A live Task catalog plus its caller's exact versions and native calculation sources. */
export function readCurrentEvolutionArtifactContext(
  db: Database.TxOrDb,
  input: { taskID: string; exactArtifacts: readonly ExactArtifact[] },
) {
  const read = (locator: EngineArtifactLocator) =>
    EngineArtifactEnvelopeSchema.parse(requireEngineArtifactByLocator({ db, taskID: input.taskID, locator }).payload)
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
  const nativeSources = input.exactArtifacts.flatMap(({ envelope }) =>
    envelope.artifact_type === "evolution-lab/comparison-recommendation" && envelope.producer.owner_kind !== "mission"
      ? envelope.source_artifact_locators.flatMap((locator) =>
          locator.source === "engine_artifact" ? [{ locator, envelope: read(locator) }] : [],
        )
      : [],
  )
  return {
    catalog,
    references: createEvolutionArtifactReferences([...catalog, ...nativeSources, ...input.exactArtifacts]),
  }
}
