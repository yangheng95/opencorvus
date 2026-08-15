import { afterEach, describe, expect, test } from "bun:test"
import { insertEngineArtifact, patchEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, EngineTaskRootIngressTable, EngineTaskTable } from "@/engine/engine.sql"
import { persistTaskRootIngressInTransaction } from "@/engine/task-root-ingress-delivery"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("dispatch infrastructure fact ingress", () => {
  test("binds recovery to one immutable Artifact locator without copying its payload", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Infrastructure recovery" })
      const now = Date.now()
      const result = Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable).values({ id: taskID, project_id: Instance.project.id, session_id: root.id, source: "test", product_pillar: "code", title: "Infrastructure recovery", request: "Recover exact failure", time_created: now }).run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.infrastructure" })
        const artifactID = insertEngineArtifact(db, {
          taskID, kind: "task-infrastructure-error", label: "provider transport failed",
          payload: { operation: "dispatch", reason: "provider transport failed" }, timeCreated: now + 1,
        })
        const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!
        const ingressID = persistTaskRootIngressInTransaction(
          db, task, { processRecovery: { recoveryFactID: artifactID } }, { recoveryFactID: artifactID }, now + 2,
        )
        return { artifactID, ingressID }
      })
      expect(Database.use((db) => db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, result.ingressID)).get()))
        .toMatchObject({ task_id: taskID, source: "engine_artifact", source_id: result.artifactID, inline_payload: null })
      expect(() => Database.immediateTransaction((db) => patchEngineArtifact(db, { id: result.artifactID, payload: { operation: "dispatch", reason: "changed" } })))
        .toThrow("accepted Task-root source is immutable")
      expect(() => Database.use((db) => db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, result.artifactID)).run()))
        .toThrow("accepted Task-root source is immutable")
    } })
  })
})
