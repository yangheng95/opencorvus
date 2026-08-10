import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { TaskQueueTable } from "@/scheduler/task-queue.sql"
import { TaskQueueService } from "@/scheduler/task-queue-service"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function waitForQueueUpdate(taskID: string, after: number) {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    const current = TaskQueueService.getStatusByID(taskID)
    if (current && current.updatedAt > after) return current.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Queue ${taskID} did not record child Session progress after ${after}`)
}

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Task Queue child Session progress", () => {
  test("continues draining after a newly started execution settles before the live-owner snapshot", async () => {
    const events: string[] = []
    const longRunning = new Promise<void>(() => undefined)
    await TaskQueueService.TestHooks.waitForDrainProgress({
      started: [
        Promise.resolve().then(() => {
          events.push("started-settled")
        }),
      ],
      running: [longRunning],
    })
    events.push("drain-continued")
    expect(events).toEqual(["started-settled", "drain-continued"])
  })

  test("touches the running row on child creation and subsequent child Part progress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Task Queue progress root",
        })
        await Database.awaitEffectIdle(2_000)

        const queueTaskID = Identifier.ascending("task")
        const startedAt = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: queueTaskID,
              session_id: root.id,
              prompt: "child progress positive contract",
              priority: "normal",
              status: "running",
              source: "task-queue-child-progress-positive-contract",
              metadata: { kind: "session_prompt", input: {} },
              time_created: startedAt,
              time_started: startedAt,
              time_updated: startedAt,
            })
            .run(),
        )

        const stopTracking = TaskQueueService.TestHooks.trackChildSessionProgress({
          taskID: queueTaskID,
          rootSessionID: root.id,
          directory: Instance.directory,
          projectID: Instance.project.id,
        })
        try {
          const child = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            parentID: root.id,
            title: "Delegated child progress",
          })
          await Database.awaitEffectIdle(2_000)
          const createdTouchedAt = await waitForQueueUpdate(queueTaskID, startedAt)
          await new Promise((resolve) => setTimeout(resolve, 2))

          const childMessage = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: child.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "task-queue-child-progress" },
            time: { created: Date.now() },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: child.id,
            messageID: childMessage.id,
            type: "text",
            text: "real child progress",
          })
          await Database.awaitEffectIdle(2_000)
          const touchedAt = await waitForQueueUpdate(queueTaskID, createdTouchedAt)

          expect({ childSessionID: child.id, queue: TaskQueueService.getStatusByID(queueTaskID), createdTouchedAt, touchedAt }).toMatchObject({
            childSessionID: expect.stringMatching(/^ses_/),
            queue: { taskID: queueTaskID, sessionID: root.id, status: "running", updatedAt: touchedAt },
            createdTouchedAt: expect.any(Number),
            touchedAt: expect.any(Number),
          })
          expect(createdTouchedAt).toBeGreaterThan(startedAt)
          expect(touchedAt).toBeGreaterThan(startedAt)
        } finally {
          stopTracking()
        }
      },
    })
  }, 30_000)

  test("retains the Session claim until an inactive executor physically settles", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Inactive queue execution root",
        })
        const staleID = Identifier.ascending("task")
        const nextID = Identifier.ascending("task")
        const staleAt = Date.now() - 1_000_000
        Database.use((db) => {
          db.insert(TaskQueueTable)
            .values([
              {
                id: staleID,
                session_id: root.id,
                prompt: "stale physical execution",
                priority: "normal",
                status: "running",
                source: "task-queue-inactivity-contract",
                metadata: { kind: "session_prompt", input: {} },
                time_created: staleAt,
                time_started: staleAt,
                time_updated: staleAt,
              },
              {
                id: nextID,
                session_id: root.id,
                prompt: "next serialized execution",
                priority: "normal",
                status: "queued",
                source: "task-queue-inactivity-contract",
                metadata: { kind: "session_prompt", input: {} },
                time_created: staleAt + 1,
                time_updated: staleAt + 1,
              },
            ])
            .run()
        })
        let settlePhysical!: () => void
        const physicalSettlement = new Promise<void>((resolve) => (settlePhysical = resolve))
        TaskQueueService.TestHooks.trackRecoverableExecution({ taskID: staleID, physicalSettlement })
        const recovery = TaskQueueService.TestHooks.recoverAt(Date.now() + 10_000_000_000)
        const events = [`cancel:${await TaskQueueService.TestHooks.waitForRecoveryCancellation(staleID)}`]
        expect(RuntimeExecutionSettlement.snapshot()).toContainEqual({
          kind: "task_queue",
          label: `queue-execution:${staleID}`,
        })
        events.push(`next-before:${TaskQueueService.getStatusByID(nextID)?.status}`)
        settlePhysical()
        await recovery
        events.push("physical:settled")
        const deadline = Date.now() + 5_000
        let next = TaskQueueService.getStatusByID(nextID)
        while (Date.now() < deadline && next?.status === "queued") {
          await new Promise((resolve) => setTimeout(resolve, 10))
          next = TaskQueueService.getStatusByID(nextID)
        }
        events.push(`next-after:${next?.status}`)
        expect({ events, stale: TaskQueueService.getStatusByID(staleID), next }).toMatchObject({
          events: [
            "cancel:task timed out while running",
            "next-before:queued",
            "physical:settled",
            expect.stringMatching(/^next-after:(running|completed|failed)$/),
          ],
          stale: { status: "failed", error: "task timed out while running" },
          next: { taskID: nextID, startedAt: expect.any(Number) },
        })
      },
    })
  }, 30_000)

  test("continues claiming another Session after requesting stale execution cancellation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const staleSession = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Stale queue execution",
        })
        const siblingSession = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Independent queued execution",
        })
        const staleID = Identifier.ascending("task")
        const siblingID = Identifier.ascending("task")
        const staleAt = Date.now() - 1_000_000
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values([
              {
                id: staleID,
                session_id: staleSession.id,
                prompt: "stale physical execution",
                priority: "normal",
                status: "running",
                source: "task-queue-inactivity-nonblocking-contract",
                metadata: { kind: "session_prompt", input: {} },
                time_created: staleAt,
                time_started: staleAt,
                time_updated: staleAt,
              },
              {
                id: siblingID,
                session_id: siblingSession.id,
                prompt: "independent queued execution",
                priority: "normal",
                status: "queued",
                source: "task-queue-inactivity-nonblocking-contract",
                metadata: { kind: "session_prompt", input: {} },
                time_created: staleAt + 1,
                time_updated: staleAt + 1,
              },
            ])
            .run(),
        )
        let settlePhysical!: () => void
        const physicalSettlement = new Promise<void>((resolve) => (settlePhysical = resolve))
        TaskQueueService.TestHooks.trackRecoverableExecution({ taskID: staleID, physicalSettlement })

        await TaskQueueService.TestHooks.recoverAt(Date.now() + 10_000_000_000)
        const cancellation = await TaskQueueService.TestHooks.waitForRecoveryCancellation(staleID)
        const claimed = await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })

        expect({ cancellation, claimed, runtime: RuntimeExecutionSettlement.snapshot() }).toMatchObject({
          cancellation: "task timed out while running",
          claimed: [siblingID],
          runtime: expect.arrayContaining([{ kind: "task_queue", label: `queue-execution:${staleID}` }]),
        })
        settlePhysical()
      },
    })
  }, 30_000)
})
