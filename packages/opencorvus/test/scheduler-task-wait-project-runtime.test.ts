import { afterAll, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { EngineArtifactTable } from "../src/engine/engine.sql"
import { waitForIngressDeliveryHooksForTest } from "../src/engine/task-root-ingress-delivery"
import { terminalTask } from "../src/engine/state"
import { requireTask } from "../src/engine/store"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { taskWaitFireID } from "../src/scheduler/task-wait-fire-identity"
import { TaskRootIngressSchema } from "../src/engine/task-root-ingress"
import { Database, and, eq, sql } from "../src/storage/db"
import { Session } from "../src/session"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForIngressDeliveryHooksForTest()
  await resetMemoryDatabase()
})

describe("scheduled Task wait project runtime", () => {
  async function establishTask(input: {
    request: string
    packageRevision: Awaited<ReturnType<typeof PromptProfileResolver.resolveSchedulerCapability>>["packageRevision"]
  }) {
    const taskID = Identifier.ascending("task")
    const root = await Session.create({
      kind: "root",
      title: input.request,
      metadata: { configOverlay: { prompt_profile: { active: input.packageRevision.id } } },
    })
    const now = Date.now()
    persistTask({
      taskID,
      sessionID: root.id,
      now,
      title: input.request,
      request: input.request,
      productPillar: "code",
      source: "test",
      priority: "normal",
      metadata: { actor: "user" },
      projectID: Instance.project.id,
      packageRevision: input.packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({
        mode: "native",
        taskID,
        projectID: Instance.project.id,
        rootDirectory: Instance.directory,
        packageRevisionSHA256: input.packageRevision.packageDigest,
        timeCreated: now,
      }),
    })
    return taskID
  }

  test("assigns early Task-wait activity to the direct scheduler Session", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "base" } })
        const capability = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const taskID = await establishTask({
          request: "Resolve the Session that owns early Task-wait activity",
          packageRevision: capability.packageRevision,
        })
        const rootSessionID = requireTask(taskID).session_id
        if (!rootSessionID) throw new Error("Task wait activity fixture expected a root Session")
        const scheduler = await Session.create({
          kind: "orchestrator",
          parentID: rootSessionID,
          title: "Direct Task scheduler",
        })
        const worker = await Session.create({
          kind: "build",
          parentID: scheduler.id,
          title: "Descendant worker",
        })

        const ownership = await Promise.all(
          [scheduler, worker].map(async (session) => ({
            sessionID: session.id,
            taskID: await AutomationService.taskIDForDirectSchedulerActivity(session.id),
          })),
        )
        expect(ownership).toEqual([
          { sessionID: scheduler.id, taskID },
          { sessionID: worker.id, taskID: undefined },
        ])
      },
    })
  }, 90_000)

  test("atomically transfers one durable wait occurrence into the root Session project", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let waitID = ""
    let dueAt = 0

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "base" } })
        const capability = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        taskID = await establishTask({
          request: "Prove that a durable Task wait re-enters its root Session project",
          packageRevision: capability.packageRevision,
        })
        const now = Date.now()
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
    await waitForIngressDeliveryHooksForTest()
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
            eq(EngineArtifactTable.kind, "task_root_ingress"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.wait_job_id') = ${waitID}`,
          ),
        )
        .all(),
    )
    expect(wakes).toHaveLength(1)
    const wake = TaskRootIngressSchema.parse(wakes[0]!.payload)
    expect({
      label: wakes[0]!.label,
      sourceKind: wake.source_kind,
      taskID: wake.task_id,
      jobID: wake.source_kind === "task_wait_wake" ? wake.wait_job_id : undefined,
      fireID: wake.source_kind === "task_wait_wake" ? wake.event.taskWaitWake.fireID : undefined,
      dueAt: wake.source_kind === "task_wait_wake" ? wake.event.taskWaitWake.dueAt : undefined,
      deliveryStatus: wake.delivery_result?.status,
    }).toEqual({
      label: "delivered",
      sourceKind: "task_wait_wake",
      taskID,
      jobID: waitID,
      fireID: taskWaitFireID(waitID),
      dueAt,
      deliveryStatus: "terminal_inapplicable",
    })
  }, 90_000)
})
