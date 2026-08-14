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

async function createQueueInputMessage(sessionID: string, modelID: string) {
  return await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "chat",
    model: { providerID: "test", modelID },
    time: { created: Date.now() },
  })
}

async function createQueueAssistantMessage(sessionID: string, parentID: string, modelID: string) {
  return await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    parentID,
    role: "assistant",
    author: "assistant",
    time: { created: Date.now() },
    agent: "chat",
    providerID: "test",
    modelID,
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
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

  test("retains the exact runtime owner until a failed handoff disposition is durably retried", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Task Queue durable handoff settlement",
        })
        const queueTaskID = Identifier.ascending("task")
        const startedAt = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: queueTaskID,
              session_id: root.id,
              prompt: "durable handoff settlement retry",
              priority: "normal",
              status: "running",
              source: "task-queue-durable-handoff-settlement-contract",
              metadata: { kind: "session_prompt", input: {} },
              time_created: startedAt,
              time_started: startedAt,
              time_updated: startedAt,
            })
            .run(),
        )

        let rejectPhysical!: (error: Error) => void
        const physicalSettlement = new Promise<void>((_resolve, reject) => {
          rejectPhysical = reject
        })
        let reportFirstAttempt!: () => void
        const firstAttempt = new Promise<void>((resolve) => {
          reportFirstAttempt = resolve
        })
        let releaseFirstAttempt!: () => void
        const firstAttemptRelease = new Promise<void>((resolve) => {
          releaseFirstAttempt = resolve
        })
        const attempts: string[] = []
        using _settlementFailure = TaskQueueService.TestHooks.installBeforeExecutionFailureSettlement(
          async ({ taskID, attempt }) => {
            attempts.push(`${taskID}:attempt-${attempt}`)
            if (attempt !== 1) return
            reportFirstAttempt()
            await firstAttemptRelease
            throw new Error("injected one-time handoff persistence failure")
          },
        )
        const disposition = TaskQueueService.TestHooks.trackRecoverableExecution({
          taskID: queueTaskID,
          physicalSettlement,
        })
        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        try {
          gate.closeAdmission(["task_queue"])
          gate.requestCancellation(["task_queue"], new Error("runtime ownership handoff"))
          rejectPhysical(new Error("physical execution cancelled for handoff"))
          await firstAttempt
          const retained = {
            queue: TaskQueueService.getStatusByID(queueTaskID),
            runtime: RuntimeExecutionSettlement.snapshot(),
          }
          const gateSettlement = gate.waitForIdle(["task_queue"])
          releaseFirstAttempt()
          const [handoff] = await Promise.all([disposition, gateSettlement])

          expect({ attempts, retained, handoff, settled: TaskQueueService.getStatusByID(queueTaskID) }).toMatchObject({
            attempts: [`${queueTaskID}:attempt-1`, `${queueTaskID}:attempt-2`],
            retained: {
              queue: { taskID: queueTaskID, status: "running" },
              runtime: expect.arrayContaining([{ kind: "task_queue", label: `queue-execution:${queueTaskID}` }]),
            },
            handoff: {
              name: "RuntimeExecutionHandoffCancellation",
              taskID: queueTaskID,
              queueOccurrenceID: queueTaskID,
            },
            settled: { taskID: queueTaskID, status: "queued" },
          })
        } finally {
          releaseFirstAttempt()
          gate[Symbol.dispose]()
        }
      },
    })
  }, 30_000)

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
        const queueInput = await createQueueInputMessage(root.id, "task-queue-child-progress")
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
          inputMessageID: queueInput.id,
          directory: Instance.directory,
          projectID: Instance.project.id,
        })
        try {
          const queueAssistant = await createQueueAssistantMessage(
            root.id,
            queueInput.id,
            "task-queue-child-progress",
          )
          const child = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            parentID: root.id,
            title: "Delegated child progress",
            metadata: {
              delegation: {
                kind: "session-local",
                parentAgent: "chat",
                parentMessageID: queueAssistant.id,
                parentToolCallID: "task-queue-child-progress-call",
              },
            },
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

          expect({
            childSessionID: child.id,
            queue: TaskQueueService.getStatusByID(queueTaskID),
            createdTouchedAt,
            touchedAt,
          }).toMatchObject({
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

  test("attributes progress to the live queue lineage instead of historical descendants", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Task Queue exact progress root",
        })
        const historicalChild = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          parentID: root.id,
          title: "Historical detached child",
        })
        const queueInput = await createQueueInputMessage(root.id, "task-queue-exact-progress")
        await Database.awaitEffectIdle(2_000)

        const queueTaskID = Identifier.ascending("task")
        const startedAt = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: queueTaskID,
              session_id: root.id,
              prompt: "exact progress lineage",
              priority: "normal",
              status: "running",
              source: "task-queue-exact-progress-positive-contract",
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
          inputMessageID: queueInput.id,
          directory: Instance.directory,
          projectID: Instance.project.id,
        })
        try {
          const historicalMessage = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: historicalChild.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "task-queue-exact-progress" },
            time: { created: Date.now() },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: historicalChild.id,
            messageID: historicalMessage.id,
            type: "text",
            text: "historical activity",
          })
          await Database.awaitEffectIdle(2_000)
          const afterHistorical = TaskQueueService.getStatusByID(queueTaskID)

          const parallelChild = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            parentID: root.id,
            title: "Parallel root child without queue causation",
          })
          await Database.awaitEffectIdle(2_000)
          const parallelMessage = await createQueueInputMessage(parallelChild.id, "task-queue-parallel-progress")
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: parallelChild.id,
            messageID: parallelMessage.id,
            type: "text",
            text: "parallel activity",
          })
          await Database.awaitEffectIdle(2_000)
          const afterParallel = TaskQueueService.getStatusByID(queueTaskID)

          const queueAssistant = await createQueueAssistantMessage(root.id, queueInput.id, "task-queue-exact-progress")
          const liveChild = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            parentID: root.id,
            title: "Current causally delegated child",
            metadata: {
              delegation: {
                kind: "session-local",
                parentAgent: "chat",
                parentMessageID: queueAssistant.id,
                parentToolCallID: "task-queue-exact-progress-call",
              },
            },
          })
          await Database.awaitEffectIdle(2_000)
          const liveTouchedAt = await waitForQueueUpdate(queueTaskID, startedAt)

          expect({
            afterHistorical,
            afterParallel,
            beforeLiveProgress: TaskQueueService.getStatusByID(queueTaskID),
            liveChildSessionID: liveChild.id,
            liveTouchedAt,
          }).toMatchObject({
            afterHistorical: { taskID: queueTaskID, updatedAt: startedAt },
            afterParallel: { taskID: queueTaskID, updatedAt: startedAt },
            beforeLiveProgress: { taskID: queueTaskID, updatedAt: liveTouchedAt },
            liveChildSessionID: expect.stringMatching(/^ses_/),
            liveTouchedAt: expect.any(Number),
          })
          expect(liveTouchedAt).toBeGreaterThan(startedAt)
        } finally {
          stopTracking()
        }
      },
    })
  }, 30_000)

  test("coalesces burst progress behind one durable touch and preserves the live execution during recovery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.createNext({
          directory: Instance.directory,
          kind: "assistant",
          title: "Task Queue coalesced progress root",
        })
        const queueInput = await createQueueInputMessage(root.id, "task-queue-progress-coalescing")
        await Database.awaitEffectIdle(2_000)

        const queueTaskID = Identifier.ascending("task")
        const staleAt = Date.now() - 1_000_000
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: queueTaskID,
              session_id: root.id,
              prompt: "coalesced durable progress touch",
              priority: "normal",
              status: "running",
              source: "task-queue-coalesced-progress-positive-contract",
              metadata: { kind: "session_prompt", input: {} },
              time_created: staleAt,
              time_started: staleAt,
              time_updated: staleAt,
            })
            .run(),
        )

        let releaseTouch!: () => void
        const touchRelease = new Promise<void>((resolve) => (releaseTouch = resolve))
        let reportTouchStarted!: () => void
        const touchStarted = new Promise<void>((resolve) => (reportTouchStarted = resolve))
        let durableTouchOwners = 0
        using _progressTouch = TaskQueueService.TestHooks.installBeforeProgressTouch(async ({ taskID }) => {
          expect(taskID).toBe(queueTaskID)
          durableTouchOwners += 1
          reportTouchStarted()
          await touchRelease
        })
        const stopTracking = TaskQueueService.TestHooks.trackChildSessionProgress({
          taskID: queueTaskID,
          rootSessionID: root.id,
          inputMessageID: queueInput.id,
          directory: Instance.directory,
          projectID: Instance.project.id,
        })
        try {
          const message = await createQueueAssistantMessage(
            root.id,
            queueInput.id,
            "task-queue-progress-coalescing",
          )
          const partID = Identifier.ascending("part")
          await Session.updatePart({
            id: partID,
            sessionID: root.id,
            messageID: message.id,
            type: "text",
            text: "progress-0",
          })
          await touchStarted

          for (let index = 1; index <= 8; index += 1) {
            await Session.updatePart({
              id: partID,
              sessionID: root.id,
              messageID: message.id,
              type: "text",
              text: `progress-${index}`,
            })
          }
          await Database.awaitEffectIdle(2_000)

          const recovered = await TaskQueueService.TestHooks.recoverAt(Date.now() + 10_000_000_000)
          const whileBlocked = TaskQueueService.getStatusByID(queueTaskID)
          releaseTouch()
          const touchedAt = await waitForQueueUpdate(queueTaskID, staleAt)

          expect({
            durableTouchOwners,
            recovered,
            whileBlocked,
            settled: TaskQueueService.getStatusByID(queueTaskID),
          }).toMatchObject({
            durableTouchOwners: 1,
            recovered: 0,
            whileBlocked: { taskID: queueTaskID, status: "running", updatedAt: staleAt },
            settled: { taskID: queueTaskID, status: "running", updatedAt: touchedAt },
          })
          expect(touchedAt).toBeGreaterThan(staleAt)
        } finally {
          releaseTouch()
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
