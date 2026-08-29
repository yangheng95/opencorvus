import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { Config } from "../src/config/config"
import { Bus } from "../src/bus"
import {
  configureTaskIngressRunner,
  waitForIngressDeliveryHooksForTest,
} from "../src/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import { requireTask } from "../src/engine/store"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import {
  currentOrchestratorControlMessage,
  materializeOrReuseCurrentOrchestratorControlMessage,
} from "../src/orchestrator/agent"
import { OrchestratorEventSchema } from "../src/orchestrator/event"
import { Instance } from "../src/project/instance"
import { AutomationService } from "../src/scheduler/automation-service"
import { Session } from "../src/session"
import { SessionPrompt } from "../src/session/prompt"
import { Database } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!check() && Date.now() < deadline) await Bun.sleep(10)
  expect(check()).toBe(true)
}

afterAll(resetMemoryDatabase)

describe("scheduled Task wait project runtime", () => {
  test("assigns Task-wait authority only to the direct scheduler Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const capability = await PromptProfileResolver.resolveSchedulerCapability({
        projectDirectory: project.path,
        config: Config.Info.parse({ prompt_profile: { active: "base" } }),
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Task wait authority",
        metadata: { configOverlay: { prompt_profile: { active: capability.packageRevision.id } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID, rootSession: root, now, title: "Task wait authority", request: "Resume once",
        productPillar: "code", source: "test", priority: "normal", metadata: { actor: "user" },
        projectID: Instance.project.id, packageRevision: capability.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory,
          packageRevisionSHA256: capability.packageRevision.packageDigest, timeCreated: now,
        }),
      })
      const rootSessionID = requireTask(taskID).session_id!
      const scheduler = await Session.create({ kind: "orchestrator", parentID: rootSessionID, title: "Direct scheduler" })
      const worker = await Session.create({ kind: "build", parentID: scheduler.id, title: "Worker" })
      expect(await Promise.all([scheduler, worker].map(async (session) => ({
        sessionID: session.id,
        taskID: await AutomationService.taskIDForDirectSchedulerActivity(session.id),
      })))).toEqual([
        { sessionID: scheduler.id, taskID },
        { sessionID: worker.id, taskID: undefined },
      ])
    } })
  }, 90_000)

  test("preserves one pending Task wait across a Host control projection and settles it from participant activity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        AutomationService.init()
        const capability = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config: Config.Info.parse({ prompt_profile: { active: "base" } }),
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Task wait control activity",
          metadata: { configOverlay: { prompt_profile: { active: capability.packageRevision.id } } },
        })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Task wait control activity",
          request: "Resume from participant activity exactly once",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: capability.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: capability.packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const scheduler = await Session.create({
          kind: "orchestrator",
          parentID: requireTask(taskID).session_id!,
          title: "Direct scheduler control activity",
        })
        configureTaskIngressRunner(async () => undefined)
        const scheduled = await AutomationService.createTaskWake({
          name: "participant activity resume",
          projectId: Instance.project.id,
          taskId: taskID,
          durationMs: 600_000,
          reason: "resume after real participant activity",
        })
        const pendingSchedule = {
          id: scheduled.id,
          projectID: Instance.project.id,
          target: { scope: "task" as const, taskID },
          nextRun: scheduled.nextRun,
          leaseUntil: 0,
          state: "scheduled" as const,
          claim: null,
        }
        const control = currentOrchestratorControlMessage(
          OrchestratorEventSchema.parse({
            taskWaitActivity: {
              source: "message.created",
              detail: "prior participant activity",
              jobIDs: ["prior_wait"],
            },
          }),
          taskID,
          "ingress_task_wait_control_contract",
        )!
        const prompt = spyOn(SessionPrompt, "prompt").mockImplementation(async (input: any) =>
          Session.persistMessage({
            info: {
              id: input.messageID,
              role: "user",
              author: input.author,
              sessionID: input.sessionID,
              time: { created: Date.now() },
              agent: input.agent,
              model: input.model,
              extra: input.extra,
            },
            parts: input.parts.map((part: any) => ({
              ...part,
              sessionID: input.sessionID,
              messageID: input.messageID,
            })),
          }),
        )
        try {
          await materializeOrReuseCurrentOrchestratorControlMessage({
            session: scheduler,
            model: { providerID: "test", modelID: "task-wait-control-activity" },
            control,
          })
        } finally {
          prompt.mockRestore()
        }
        await waitFor(() => Bus.TestHooks.outbox().length === 0)

        expect(
          AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [scheduler.id],
            taskIDs: [taskID],
          }),
        ).toEqual([pendingSchedule])

        const participantMessageID = Identifier.ascending("message")
        await Session.persistMessage({
          info: {
            id: participantMessageID,
            role: "user",
            author: "mission",
            sessionID: scheduler.id,
            time: { created: Date.now() },
            agent: "orchestrator",
            model: { providerID: "test", modelID: "task-wait-control-activity" },
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              messageID: participantMessageID,
              sessionID: scheduler.id,
              type: "text",
              text: "New participant evidence is ready.",
              time: { start: Date.now(), end: Date.now() },
            },
          ],
        })
        await waitFor(() => Bus.TestHooks.outbox().length === 0)
        await waitForIngressDeliveryHooksForTest()

        const activityIngresses = Database.use((db) => db.select().from(EngineTaskRootIngressTable).all()).flatMap(
          (row) => {
            const event = OrchestratorEventSchema.safeParse(row.inline_payload)
            return row.task_id === taskID && row.source === "inline" && event.success && event.data.taskWaitActivity
              ? [event.data]
              : []
          },
        )

        expect({
          pending: AutomationService.pendingDelayedWakeSchedule({
            projectID: Instance.project.id,
            sessionIDs: [scheduler.id],
            taskIDs: [taskID],
          }),
          activityIngresses,
        }).toEqual({
          pending: [],
          activityIngresses: [
            {
              note: expect.any(String),
              taskWaitActivity: {
                source: "message.created",
                detail: `user message ${participantMessageID} created in session ${scheduler.id}`,
                jobIDs: [scheduled.id],
              },
            },
          ],
        })
      },
    })
  }, 90_000)

  test("transfers a Task wait to one durable ingress before its long Task Turn completes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const capability = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config: Config.Info.parse({ prompt_profile: { active: "base" } }),
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Task wait atomic transfer",
          metadata: { configOverlay: { prompt_profile: { active: capability.packageRevision.id } } },
        })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Task wait atomic transfer",
          request: "Keep one accepted wait occurrence while the Task Turn is long",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: capability.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: capability.packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        let releaseTurn!: () => void
        const turnGate = new Promise<void>((resolve) => {
          releaseTurn = resolve
        })
        configureTaskIngressRunner(async () => turnGate)
        const scheduled = await AutomationService.createTaskWake({
          name: "atomic participant activity",
          projectId: Instance.project.id,
          taskId: taskID,
          durationMs: 600_000,
          reason: "resume exactly once",
        })

        const first = AutomationService.triggerTaskWaitFromActivity({
          taskId: taskID,
          projectId: Instance.project.id,
          source: "message.created",
          detail: "first exact participant occurrence",
        })
        await waitFor(
          () =>
            AutomationService.pendingDelayedWakeSchedule({
              projectID: Instance.project.id,
              taskIDs: [taskID],
            }).length === 0,
        )

        const duplicate = await AutomationService.triggerTaskWaitFromActivity({
          taskId: taskID,
          projectId: Instance.project.id,
          source: "message.part.updated",
          detail: "a later activity while the same Task Turn still owns execution",
        })
        const activityIngresses = Database.use((db) => db.select().from(EngineTaskRootIngressTable).all()).filter(
          (row) => {
            const event = OrchestratorEventSchema.safeParse(row.inline_payload)
            return row.task_id === taskID && row.source === "inline" && event.success && event.data.taskWaitActivity
          },
        )

        expect({ duplicate, activityIngresses: activityIngresses.map((row) => row.inline_payload) }).toEqual({
          duplicate: { jobIDs: [] },
          activityIngresses: [
            {
              note: expect.any(String),
              taskWaitActivity: {
                source: "message.created",
                detail: "first exact participant occurrence",
                jobIDs: [scheduled.id],
              },
            },
          ],
        })

        releaseTurn()
        await first
      },
    })
  }, 90_000)
})
