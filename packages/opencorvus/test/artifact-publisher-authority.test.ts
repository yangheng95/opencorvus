import path from "node:path"
import fs from "node:fs/promises"
import { Global } from "../src/global"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { assertArtifactPublicationAuthority, ArtifactPublisherAuthorityError } from "../src/expert-squad/artifact-publication-authority"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import { EvolutionArtifactSchemas } from "@opencorvus-ai/plugin"
import { describe, expect, test } from "bun:test"
import {
  artifactSnapshotTransport,
} from "../src/tool/artifact-catalog"
import {
  ArtifactReadLocatorSchema,
  ArtifactLocatorReferenceSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskArtifactResourceSetLocatorSchema } from "@opencorvus-ai/plugin/task-artifact"

describe("generic Artifact publisher authority", () => {
  test("preserves the bound undeclared revision after a new declared revision is loaded", async () => {
    const root = await Global.createTemporaryDirectory("publication-revision-")
    try {
      await fs.cp(path.resolve(import.meta.dir, "../../../expert-squads/builtin/data-analysis"), root, { recursive: true })
      const file = path.join(root, "expert-squad.jsonc")
      const original = await fs.readFile(file, "utf8")
      const manifest = JSON.parse(original)
      delete manifest.artifact_publishers
      manifest.version = "2026.09.26.1"
      await fs.writeFile(file, JSON.stringify(manifest))
      const undeclared = await ExpertSquadRegistry.loadSourcePackage(root)
      await fs.writeFile(file, original)
      const declared = await ExpertSquadRegistry.loadSourcePackage(root)
      const scopeFor = (loaded: typeof declared) => ({ packageToolRef: null, owner: { packageRevision: {
        namespace: loaded.namespace, id: loaded.id, version: loaded.manifest.version, packageDigest: loaded.packageDigest,
      } } } as TaskToolExecutionScope)
      expect(await assertArtifactPublicationAuthority(scopeFor(undeclared), "data-analysis/report").then(() => "generic")).toBe("generic")
      await expect(assertArtifactPublicationAuthority(scopeFor(declared), "data-analysis/report"))
        .rejects.toMatchObject({ code: "PACKAGE_TYPED_PUBLISHER_REQUIRED", expectedPublisher: "data-analysis/shared/publish-data-analysis-artifact" })
      expect(await assertArtifactPublicationAuthority(scopeFor(undeclared), "data-analysis/report").then(() => "generic")).toBe("generic")
    } finally { await fs.rm(root, { recursive: true, force: true }) }
  })
  test("reads exact declared publishers from the immutable Lab revision", async () => {
    const loaded = await ExpertSquadRegistry.loadPackage(path.resolve(import.meta.dir, "../../../expert-squads/builtin/evolution-lab"))
    expect(Object.keys(loaded.manifest.artifact_publishers!).sort()).toEqual(Object.keys(EvolutionArtifactSchemas).sort())
    const scope = { packageToolRef: null, owner: { packageRevision: {
      namespace: loaded.namespace, id: loaded.id, version: loaded.manifest.version, packageDigest: loaded.packageDigest,
    } } } as TaskToolExecutionScope
    await expect(assertArtifactPublicationAuthority(scope, "evolution-lab/candidate-revision"))
      .rejects.toMatchObject({ code: "PACKAGE_TYPED_PUBLISHER_REQUIRED", expectedPublisher: "evolution-lab/shared/publish-evolution-artifact", actualPublisher: null })
    await expect(assertArtifactPublicationAuthority({ ...scope, packageToolRef: "evolution-lab/shared/collect-run-evidence" }, "evolution-lab/candidate-revision"))
      .rejects.toBeInstanceOf(ArtifactPublisherAuthorityError)
    expect(await assertArtifactPublicationAuthority({ ...scope, packageToolRef: "evolution-lab/shared/publish-evolution-artifact" }, "evolution-lab/candidate-revision").then(() => "authorized")).toBe("authorized")
    await expect(assertArtifactPublicationAuthority({ ...scope, packageToolRef: "evolution-lab/shared/publish-evolution-artifact" }, "evolution-lab/promotion-receipt"))
      .rejects.toMatchObject({ code: "PACKAGE_TYPED_PUBLISHER_REQUIRED", expectedPublisher: null })
    expect(await assertArtifactPublicationAuthority(scope, "evolution-lab/operator-note").then(() => "generic")).toBe("generic")
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
    ] as const
    expectedLocators.forEach((locator) => ArtifactReadLocatorSchema.parse(locator))
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
