import { describe, expect, test } from "bun:test"
import { ExpertSquadGenerationMetadataSchema } from "../../src/expert-squad/installation-metadata"
import { MulticaExpertSquadImport } from "../../src/expert-squad/multica-import"

describe("Multica project generation provenance", () => {
  test("binds the accepted source and mapping digests to the current Task and scheduler Session", () => {
    const sourceDigest = "a".repeat(64)
    const mappingDigest = "b".repeat(64)
    const generation = ExpertSquadGenerationMetadataSchema.parse(
      MulticaExpertSquadImport.generationMetadata({
        generationTrace: { taskID: "task_multica_import", sessionID: "session_multica_scheduler" },
        sourceDigest,
        mappingDigest,
      }),
    )

    expect(generation).toMatchObject({
      generator_expert_squad_id: "squad-sdk",
      method: "heterogeneous_import",
      task_id: "task_multica_import",
      session_id: "session_multica_scheduler",
      source_digest: sourceDigest,
      mapping_digest: mappingDigest,
    })
    expect(Date.parse(generation.generated_at)).toBeGreaterThan(0)
  })
})
