import { describe, expect, test } from "bun:test"
import {
  ArtifactPublisherAuthorityError,
  artifactSnapshotTransport,
  assertGenericArtifactPublisherAuthority,
} from "../src/tool/artifact-catalog"
import {
  ArtifactReadLocatorSchema,
  ArtifactLocatorReferenceSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskArtifactResourceSetLocatorSchema } from "@opencorvus-ai/plugin/task-artifact"

describe("generic Artifact publisher authority", () => {
  test("maps the Evolution Lab strict ABI namespace to its typed publisher contract", () => {
    try {
      assertGenericArtifactPublisherAuthority("evolution-lab/candidate-revision")
      throw new Error("expected Evolution Lab publisher authority validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactPublisherAuthorityError)
      expect(error).toMatchObject({
        name: "ArtifactPublisherAuthorityError",
        code: "PACKAGE_TYPED_PUBLISHER_REQUIRED",
        artifactType: "evolution-lab/candidate-revision",
      })
    }
  })

  test("accepts an active Squad generic evidence type", () => {
    expect(assertGenericArtifactPublisherAuthority("records-ediscovery-operations/review-pack")).toBeUndefined()
  })

  test("returns Host-minted read references with the published snapshot resource set", () => {
    const snapshot = {
      schema_version: 2 as const,
      project_id: "project-1",
      task_id: "task-1",
      snapshot_id: "00000000-0000-4000-8000-000000000001",
      manifest_sha256: "a".repeat(64),
    }
    const resource = {
      snapshot,
      tree: "resources",
      path: "campaign/global-judge.json",
      media_type: "application/json",
      bytes: 1054,
      sha256: "b".repeat(64),
    }
    const transport = artifactSnapshotTransport(snapshot, [resource])

    expect(TaskArtifactResourceSetLocatorSchema.parse(transport.resource_set)).toEqual({
      snapshot,
      tree: "resources",
    })
    const expectedLocators = [
      {
      source: "task_artifact_snapshot",
      snapshot,
      },
      { source: "task_artifact_resource", ref: resource },
    ].map((locator) => ArtifactReadLocatorSchema.parse(locator))
    expect(transport.locators).toEqual([
      {
        role: "snapshot",
        locator: expectedLocators[0],
        artifact_locator_ref: expect.any(String),
      },
      {
        role: "resource",
        locator: expectedLocators[1],
        artifact_locator_ref: expect.any(String),
      },
    ])
    for (const item of transport.locators) {
      expect(ArtifactLocatorReferenceSchema.parse(item.artifact_locator_ref).length).toBe(19)
    }
    expect(transport.resource_count).toBe(1)
  })
})
