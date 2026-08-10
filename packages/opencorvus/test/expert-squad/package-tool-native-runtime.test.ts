import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { persistQueuedTask } from "../../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import {
  introspectPackageToolInCapsule,
  nativePackageToolEnvironment,
} from "../../src/expert-squad/package-tool-capsule"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "viral-content")
const publisherRef = "viral-content/shared/publish-viral-content-artifact"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("native Task package-tool process authority", () => {
  test("publishes and introspects concurrent frozen workers through one native Task process binding", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const prepared = loaded.packageToolBundles.get(publisherRef)
        if (!prepared) throw new Error(`Missing prepared package tool ${publisherRef}`)

        const session = await Session.create({ kind: "root", title: "Native package-tool authority" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now,
          title: "Native package-tool authority",
          request: "Introspect the exact frozen package tool",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          queue: false,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: loaded.manifest.namespace,
            id: loaded.manifest.id,
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: loaded.packageDigest,
            timeCreated: now,
          }),
        })

        const [introspection, concurrentIntrospection] = await Promise.all([
          introspectPackageToolInCapsule({ prepared, taskID, cwd: project.path }),
          introspectPackageToolInCapsule({ prepared, taskID, cwd: project.path }),
        ])
        expect(concurrentIntrospection).toEqual(introspection)
        expect(introspection.description).toBe(
          "Validate and publish one strict viral-content Artifact with exact typed predecessors and immutable resources.",
        )
        expect(introspection.inputSchema.type).toBe("object")
        expect(Object.keys(introspection.inputSchema.properties as Record<string, unknown>)).toEqual([
          "artifact_type",
          "payload",
          "resource_set",
          "source_artifact_locators",
        ])
        expect(introspection.inputSchema.required).toEqual([
          "artifact_type",
          "payload",
          "resource_set",
          "source_artifact_locators",
        ])
        expect(
          (introspection.inputSchema.properties as Record<string, { enum?: string[] }>).artifact_type?.enum,
        ).toEqual([
          "viral-content/campaign-brief",
          "viral-content/audience-dossier",
          "viral-content/trend-dossier",
          "viral-content/concept-set",
          "viral-content/copy-pack",
          "viral-content/review",
          "viral-content/delivery",
        ])
        expect(nativePackageToolEnvironment()).toEqual(
          process.platform === "win32" ? { SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT } : {},
        )
      },
    })
  }, 0)
})
