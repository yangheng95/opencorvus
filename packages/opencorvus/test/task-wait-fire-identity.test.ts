import { afterAll, describe, expect, test } from "bun:test"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import { configureTaskIngressRunner, waitForIngressDeliveryHooksForTest } from "../src/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationDefinitionTombstoneTable, AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForIngressDeliveryHooksForTest()
  await resetMemoryDatabase()
})

describe("delayed Task-wait immutable occurrence", () => {
  test("binds accepted ingress to the exact Automation run and definition revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => ({}))
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Task wait facts" })
        const now = Date.now()
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base", version: "2026.08.09.1", packageDigest: "a".repeat(64) }
        persistEstablishedTask({
          taskID, sessionID: root.id, now, title: "Task wait facts", request: "Resume once", productPillar: "code",
          source: "test", priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory, packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }),
        })
        const scheduled = await AutomationService.createTaskWake({ name: "resume", projectId: Instance.project.id, taskId: taskID, durationMs: 1, reason: "resume exact task" })
        await new Promise((resolve) => setTimeout(resolve, 5))
        await AutomationService.runDueNow()
        await waitForIngressDeliveryHooksForTest()
        const definition = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, scheduled.id)).orderBy(AutomationTable.revision).all())
        expect(definition.map((row) => row.revision)).toEqual([1])
        expect(Database.use((db) => db.select().from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, scheduled.id)).get()))
          .toMatchObject({ definition_id: scheduled.id, revision: 2 })
        const run = Database.use((db) => db.select().from(AutomationRunTable).where(eq(AutomationRunTable.automation_revision_id, definition[0]!.id)).get())
        expect(run?.fire_id).toBe(taskWaitFireID(scheduled.id))
        const ingress = Database.use((db) => db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.source_id, run!.id)).get())
        expect(ingress).toMatchObject({ task_id: taskID, source: "automation_run", inline_payload: null })
      },
    })
  }, 30_000)
})
