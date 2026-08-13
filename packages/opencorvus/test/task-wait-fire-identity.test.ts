import { afterAll, describe, expect, test } from "bun:test"
import { EngineArtifactTable } from "../src/engine/engine.sql"
import { configureTaskLoopRunner, waitForQueueCompletionHooksForTest } from "../src/engine/queue"
import { QueuedTaskIngressSchema } from "../src/engine/queued-task-ingress"
import { terminalTask } from "../src/engine/state"
import { requireTask } from "../src/engine/store"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"
import { Session } from "../src/session"
import { Database, and, eq, sql } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForQueueCompletionHooksForTest()
  await resetMemoryDatabase()
})

describe("delayed Task-wait fire identity", () => {
  test("atomically transfers one compact durable fire into the root Task queue", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let waitID = ""
    let dueAt = 0

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskLoopRunner(async () => {})
        taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Scheduled Task wait runtime" })
        const now = Date.now()
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.09.1",
          packageDigest: "a".repeat(64),
        }
        persistEstablishedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Scheduled Task wait runtime",
          request: "Prove that a durable Task wait re-enters its root Session project",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        await terminalTask(
          requireTask(taskID),
          { status: "completed" },
          "Scheduled Task wait runtime fixture reached its completed contract",
        )
        const scheduled = await AutomationService.createTaskWake({
          name: "task wait project runtime",
          projectId: Instance.project.id,
          taskId: taskID,
          durationMs: 60_000,
          reason: "Resume from the exact durable Task snapshot",
        })
        waitID = scheduled.id
        dueAt = now - 1
        Database.use((db) =>
          db.update(AutomationTable).set({ next_run: dueAt }).where(eq(AutomationTable.id, waitID)).run(),
        )
      },
    })

    await Instance.disposeAll()
    await AutomationService.runDueNow()
    await waitForQueueCompletionHooksForTest()
    await AutomationService.runDueNow()

    expect(
      Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.id, waitID)).get()),
    ).toBeUndefined()
    const wakes = Database.use((db) =>
      db
        .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, taskID),
            eq(EngineArtifactTable.kind, "queued_operator_wake"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.wait_job_id') = ${waitID}`,
          ),
        )
        .all(),
    )
    expect(wakes).toHaveLength(1)
    const wake = QueuedTaskIngressSchema.parse(wakes[0]!.payload)
    const expectedFireID = taskWaitFireID(waitID)
    expect({
      label: wakes[0]!.label,
      sourceKind: wake.source_kind,
      jobID: wake.source_kind === "task_wait_wake" ? wake.wait_job_id : undefined,
      fireID: wake.source_kind === "task_wait_wake" ? wake.event.taskWaitWake.fireID : undefined,
      dueAt: wake.source_kind === "task_wait_wake" ? wake.event.taskWaitWake.dueAt : undefined,
      deliveryStatus: wake.delivery_result?.status,
    }).toEqual({
      label: "drained",
      sourceKind: "task_wait_wake",
      jobID: waitID,
      fireID: expectedFireID,
      dueAt,
      deliveryStatus: "terminal_inapplicable",
    })
    expect(expectedFireID.length).toBeLessThanOrEqual(Identifier.MAX_LENGTH)
  }, 90_000)
})
