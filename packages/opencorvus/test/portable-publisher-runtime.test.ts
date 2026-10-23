import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { executePackageToolInCapsule } from "../src/expert-squad/package-tool-capsule"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("generated portable policy executes its frozen native bundle with the current publish contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const root = path.resolve(import.meta.dir, "../../../templates/portable-expert-squad-template/package")
      const loaded = await ExpertSquadRegistry.loadSourcePackage(root)
      const prepared = loaded.packageToolBundles.get("portable-template/shared/reconciliation-policy")
      if (!prepared) throw new Error("Generated portable policy is missing its executable package definition")
      const session = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Portable native publish contract",
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: session,
        now,
        title: "Portable native publish contract",
        request: "Execute the real generated policy publisher",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
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
      const policy = JSON.parse(await fs.readFile(path.join(root, "assets/reconciliation-policy.json"), "utf8"))
      const calls: unknown[] = []
      const locator = {
        source: "engine_artifact",
        artifact_id: "art_portable_policy",
        catalog_revision: 1,
        expected_sha256: "a".repeat(64),
      }
      const result = await executePackageToolInCapsule({
        prepared,
        taskID,
        cwd: project.path,
        args: {},
        abort: new AbortController().signal,
        context: {
          sessionID: session.id,
          messageID: Identifier.ascending("message"),
          agent: "orchestrator",
          directory: project.path,
          worktree: project.path,
          configuration: {},
        },
        host: {
          kind: "task",
          engineArtifacts: {
            async publish(input: unknown) {
              calls.push(input)
              return { locator, sha256: locator.expected_sha256 }
            },
          },
        } as never,
      })
      expect(calls).toEqual([
        {
          artifact_type: "portable-template/reconciliation-policy",
          schema_version: 1,
          label: "Invoice ledger reconciliation policy",
          payload: policy,
          resources: [],
        },
      ])
      expect(JSON.parse(result.output)).toEqual({ locator, sha256: locator.expected_sha256 })
    },
  })
})
