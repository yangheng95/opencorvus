import { describe, expect, test } from "bun:test"
import {
  ArtifactReadLocatorInputListSchema,
  ArtifactReadLocatorListSchema,
  EngineArtifactLocatorSchema,
  EvidenceLocatorInputListSchema,
  EvidenceLocatorListSchema,
} from "../src/artifact-catalog"

const snapshot = {
  schema_version: 2,
  project_id: "prj_test",
  task_id: "tsk_test",
  snapshot_id: "3f1a6c22-0000-4000-8000-0123456789ab",
  manifest_sha256: "a".repeat(64),
} as const

const digest = "b".repeat(64)

describe("model-facing Artifact locator inputs", () => {
  test("name an exact Engine Artifact revision without restating its digest", () => {
    const named = { source: "engine_artifact", artifact_id: "art_test", catalog_revision: 12 }

    expect(EvidenceLocatorInputListSchema.parse([named])).toEqual([named])
    expect(ArtifactReadLocatorInputListSchema.parse([named])).toEqual([named])

    // The durable unions still carry the complete Host-owned digest.
    expect(EvidenceLocatorListSchema.parse([{ ...named, expected_sha256: digest }])).toEqual([
      { ...named, expected_sha256: digest },
    ])
  })

  test("name an exact snapshot resource without restating its content facts", () => {
    const named = { source: "task_artifact_resource", ref: { snapshot, tree: "resources", path: "report.md" } }

    expect(EvidenceLocatorInputListSchema.parse([named])).toEqual([named])
    expect(ArtifactReadLocatorInputListSchema.parse([named])).toEqual([named])

    expect(
      ArtifactReadLocatorListSchema.parse([
        { ...named, ref: { ...named.ref, media_type: "text/markdown", bytes: 15044, sha256: digest } },
      ]),
    ).toHaveLength(1)
  })

  test("reject a transcribed digest instead of silently trusting it", () => {
    for (const schema of [EvidenceLocatorInputListSchema, ArtifactReadLocatorInputListSchema]) {
      expect(
        schema.safeParse([
          { source: "engine_artifact", artifact_id: "art_test", catalog_revision: 12, expected_sha256: digest },
        ]).success,
      ).toBe(false)
      expect(
        schema.safeParse([
          {
            source: "task_artifact_resource",
            ref: { snapshot, tree: "resources", path: "report.md", media_type: "text/markdown", bytes: 1, sha256: digest },
          },
        ]).success,
      ).toBe(false)
    }
  })

  test("a truncated digest can no longer reach the model-facing boundary at all", () => {
    // The exact luna7 failure: 56 of 64 hexadecimal characters survived the copy.
    const truncated = digest.slice(0, 56)
    expect(EngineArtifactLocatorSchema.safeParse({
      source: "engine_artifact",
      artifact_id: "art_test",
      catalog_revision: 12,
      expected_sha256: truncated,
    }).success).toBe(false)
    expect(
      EvidenceLocatorInputListSchema.safeParse([
        { source: "engine_artifact", artifact_id: "art_test", catalog_revision: 12 },
      ]).success,
    ).toBe(true)
  })

  test("digest-free evidence sources are unchanged", () => {
    const locators = [
      { source: "session", session_id: "ses_test" },
      { source: "goal_revision", goal_id: "gol_test" },
      { source: "coordination_request", request_id: "req_test" },
    ]
    expect(EvidenceLocatorInputListSchema.parse(locators)).toEqual(locators)
  })
})
