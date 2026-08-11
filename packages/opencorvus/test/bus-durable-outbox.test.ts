import { afterEach, describe, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession } from "@/chat/session"
import { TaskQueueEvent, TaskQueueService } from "@/scheduler/task-queue-service"
import { TaskQueueTable } from "@/scheduler/task-queue.sql"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const ReceiptEvent = BusEvent.define("test.bus.durable-receipt", z.object({ value: z.string() }))

async function waitFor(condition: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (!condition() && Date.now() < deadline) await Bun.sleep(10)
  expect(condition()).toBe(true)
}

afterEach(async () => {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState().catch(() => undefined)
  await resetMemoryDatabase()
})

describe("durable Bus publication outbox", () => {
  test("scopes one durable subscriber identity independently to each live Project Instance", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const received = { first: [] as string[], second: [] as string[] }
    let stopFirst!: () => void
    let stopSecond!: () => void
    await Instance.provide({
      directory: first.path,
      fn: () => {
        stopFirst = Bus.subscribe(
          ReceiptEvent,
          (event) => received.first.push(event.properties.value),
          { durableID: "test.same-project-local-receipt" },
        )
      },
    })
    await Instance.provide({
      directory: second.path,
      fn: () => {
        stopSecond = Bus.subscribe(
          ReceiptEvent,
          (event) => received.second.push(event.properties.value),
          { durableID: "test.same-project-local-receipt" },
        )
      },
    })
    try {
      await Instance.provide({ directory: first.path, fn: () => Bus.publishOwned(ReceiptEvent, { value: "first" }) })
      await Instance.provide({ directory: second.path, fn: () => Bus.publishOwned(ReceiptEvent, { value: "second" }) })
      await waitFor(() => Bus.TestHooks.outbox().length === 0)
      expect(received).toEqual({ first: ["first"], second: ["second"] })
    } finally {
      stopFirst()
      stopSecond()
    }
  })

  test("recovers a Message source commit with the same occurrence after a successor runtime starts", async () => {
    await using project = await memoryProject()
    let messageID = ""
    let occurrenceID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "mission", title: "Durable outbox source" })
        await waitFor(() => Bus.TestHooks.outbox().length === 0)
        using _interruption = Bus.TestHooks.suppressAutomaticDurableDrain()
        messageID = Identifier.ascending("message")
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        })
        const source = Database.use((db) =>
          db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get(),
        )
        const publication = Bus.TestHooks.outbox().find(
          (row) => row.event_type === Message.Event.Created.type,
        )
        expect(source).toEqual({ id: messageID })
        expect(publication).toBeDefined()
        occurrenceID = publication!.occurrence_id
      },
    })

    await Instance.disposeAll()
    const received: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const unsubscribe = Bus.subscribe(
          Message.Event.Created,
          (event) => {
            if (event.properties.info.id === messageID) received.push(event.occurrenceID)
          },
          { durableID: "test.message-created-successor" },
        )
        try {
          Bus.resumeDurablePublications()
          const deadline = Date.now() + 5_000
          while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === occurrenceID) && Date.now() < deadline) {
            await Bun.sleep(10)
          }
          expect({
            occurrence: Bus.TestHooks.outbox().find((row) => row.occurrence_id === occurrenceID),
            deliveries: Bus.TestHooks.deliveries(occurrenceID),
            received,
            owned: Bus.TestHooks.ownedPublications(),
          }).toEqual({ occurrence: undefined, deliveries: [], received: [occurrenceID], owned: [] })
        } finally {
          unsubscribe()
        }
      },
    })
  })

  test("recovers the atomically committed Message, queued task, and Changed occurrence", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let messageID = ""
    let queuedOccurrenceID = ""
    let releaseClaim!: () => void
    const claimBlocked = new Promise<void>((resolve) => (releaseClaim = resolve))
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.mergeMetadata({
          sessionID: (await createRightSidebarConversationSession("work")).id,
          patch: { configOverlay: { model: "openai/gpt-5.6-sol" } },
        })
        await waitFor(() => Bus.TestHooks.outbox().length === 0)
        using _claimBarrier = TaskQueueService.TestHooks.installBeforeQueueClaimReservation(async () => {
          await claimBlocked
        })
        using _interruption = Bus.TestHooks.suppressAutomaticDurableDrain()
        const enqueued = await TaskQueueService.enqueuePromptAfterPersistingUserMessage({
          sessionID: session.id,
          source: "durable-enqueue-boundary",
          prompt: {
            agent: "work",
            author: "work",
            parts: [{ type: "text", text: "durable enqueue boundary" }],
          },
        })
        taskID = enqueued.taskID
        messageID = enqueued.userMessage.info.id
        const source = Database.use((db) => ({
          message: db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get(),
          task: db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get(),
        }))
        const queuedPublication = Bus.TestHooks.outbox().find(
          (row) =>
            row.event_type === TaskQueueEvent.Changed.type &&
            (row.properties as { queueTaskID?: string; status?: string }).queueTaskID === taskID &&
            (row.properties as { status?: string }).status === "queued",
        )
        expect({
          message: source.message,
          task: source.task && {
            id: source.task.id,
            messageID: source.task.metadata.kind === "session_wake" ? source.task.metadata.messageID : undefined,
            status: source.task.status,
          },
          queuedPublication: queuedPublication && {
            occurrenceID: queuedPublication.occurrence_id,
            properties: queuedPublication.properties,
          },
        }).toEqual({
          message: { id: messageID },
          task: { id: taskID, messageID, status: "queued" },
          queuedPublication: {
            occurrenceID: expect.stringContaining("bus-occurrence:"),
            properties: {
              queueTaskID: taskID,
              sessionID: session.id,
              status: "queued",
              sequence: expect.any(Number),
            },
          },
        })
        queuedOccurrenceID = queuedPublication!.occurrence_id
        TaskQueueService.cancelSessionPrompts({
          sessionIDs: [session.id],
          source: "durable-enqueue-boundary",
          reason: "release enqueue boundary fixture",
          origin: {
            actor: "scheduler",
            source: "bus-durable-outbox.test",
            surface: "scheduler",
            reason: "release enqueue boundary fixture",
          },
        })
        releaseClaim()
      },
    })

    await Instance.disposeAll()
    const received: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const unsubscribe = Bus.subscribe(
          TaskQueueEvent.Changed,
          (event) => {
            if (event.occurrenceID === queuedOccurrenceID) received.push(event.occurrenceID)
          },
          { durableID: "test.task-queue.enqueue-recovery" },
        )
        try {
          Bus.resumeDurablePublications()
          await waitFor(() => !Bus.TestHooks.outbox().some((row) => row.occurrence_id === queuedOccurrenceID))
          expect(received).toEqual([queuedOccurrenceID])
        } finally {
          unsubscribe()
        }
      },
    })
  })

  test("recovers one Completed occurrence committed with the running-to-completed transition", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let sessionID = ""
    let completedOccurrenceID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "durable queue completion" })
        sessionID = session.id
        await waitFor(() => Bus.TestHooks.outbox().length === 0)
        taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: taskID,
              session_id: session.id,
              prompt: "durable completion",
              priority: "normal",
              status: "running",
              source: "durable-completion-boundary",
              metadata: { kind: "session_wake", messageID: Identifier.ascending("message"), input: {} },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        using _interruption = Bus.TestHooks.suppressAutomaticDurableDrain()
        expect(TaskQueueService.TestHooks.completeRunning(taskID)).toBe(true)
        const row = Database.use((db) =>
          db.select({ status: TaskQueueTable.status }).from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get(),
        )
        const publication = Bus.TestHooks.outbox().find(
          (item) =>
            item.event_type === TaskQueueEvent.Completed.type &&
            (item.properties as { queueTaskID?: string }).queueTaskID === taskID,
        )
        expect({ row, properties: publication?.properties }).toEqual({
          row: { status: "completed" },
          properties: { queueTaskID: taskID, sessionID: session.id },
        })
        completedOccurrenceID = publication!.occurrence_id
      },
    })

    await Instance.disposeAll()
    const received: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const unsubscribe = Bus.subscribe(
          TaskQueueEvent.Completed,
          (event) => received.push(event.occurrenceID),
          { durableID: "test.task-queue.completed-recovery" },
        )
        try {
          expect(TaskQueueService.getStatusByID(taskID)).toMatchObject({ sessionID, status: "completed" })
          Bus.resumeDurablePublications()
          await waitFor(() => !Bus.TestHooks.outbox().some((row) => row.occurrence_id === completedOccurrenceID))
          expect(received).toEqual([completedOccurrenceID])
        } finally {
          unsubscribe()
        }
      },
    })
  })

  test("recovers failed queue, Error, and terminal lifecycle occurrences from one failure transition", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let sessionID = ""
    let inputMessageID = ""
    let occurrenceIDs: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "durable queue failure" })
        sessionID = session.id
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "assistant",
          model: { providerID: "test", modelID: "test" },
        })
        inputMessageID = input.id
        await waitFor(() => Bus.TestHooks.outbox().length === 0)
        SessionStatus.beginExecutionOccurrence(session.id, input.id, new AbortController().signal)
        taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(TaskQueueTable)
            .values({
              id: taskID,
              session_id: session.id,
              prompt: "durable failure",
              priority: "normal",
              status: "running",
              source: "durable-failure-boundary",
              metadata: { kind: "session_wake", messageID: input.id, input: {} },
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        using _interruption = Bus.TestHooks.suppressAutomaticDurableDrain()
        await TaskQueueService.TestHooks.failRunning(taskID, new Error("injected terminal failure"))
        const rows = Bus.TestHooks.outbox().filter((row) =>
          [TaskQueueEvent.Changed.type, Session.Event.Error.type, SessionStatus.Event.Status.type].includes(
            row.event_type,
          ),
        )
        occurrenceIDs = rows.map((row) => row.occurrence_id)
        expect({
          task: TaskQueueService.getStatusByID(taskID),
          eventTypes: rows.map((row) => row.event_type).sort(),
          changed: rows.find((row) => row.event_type === TaskQueueEvent.Changed.type)?.properties,
          lifecycle: rows.find((row) => row.event_type === SessionStatus.Event.Status.type)?.properties,
        }).toEqual({
          task: expect.objectContaining({ taskID, sessionID: session.id, status: "failed", error: "injected terminal failure" }),
          eventTypes: [Session.Event.Error.type, SessionStatus.Event.Status.type, TaskQueueEvent.Changed.type].sort(),
          changed: {
            queueTaskID: taskID,
            sessionID: session.id,
            status: "failed",
            sequence: expect.any(Number),
          },
          lifecycle: {
            sessionID: session.id,
            inputMessageID: input.id,
            orderKey: expect.any(String),
            status: { type: "terminal", reason: "error", error: "injected terminal failure" },
          },
        })
      },
    })

    await Instance.disposeAll()
    const received: string[] = []
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const unsubscribers = [
          Bus.subscribe(TaskQueueEvent.Changed, (event) => received.push(event.occurrenceID), {
            durableID: "test.task-queue.failed-recovery",
          }),
          Bus.subscribe(Session.Event.Error, (event) => received.push(event.occurrenceID), {
            durableID: "test.task-queue.error-recovery",
          }),
          Bus.subscribe(SessionStatus.Event.Status, (event) => received.push(event.occurrenceID), {
            durableID: "test.task-queue.lifecycle-recovery",
          }),
        ]
        try {
          expect(TaskQueueService.getStatusByID(taskID)).toMatchObject({ sessionID, status: "failed" })
          Bus.resumeDurablePublications()
          await waitFor(() => occurrenceIDs.every((id) => !Bus.TestHooks.outbox().some((row) => row.occurrence_id === id)))
          expect(received.sort()).toEqual([...occurrenceIDs].sort())
          expect(SessionStatus.getExecution(sessionID, inputMessageID)).toEqual({
            type: "terminal",
            reason: "error",
            error: "injected terminal failure",
          })
        } finally {
          for (const unsubscribe of unsubscribers) unsubscribe()
        }
      },
    })
  })

  test("retries only the unsettled subscriber receipt within one exact phase", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let settledCalls = 0
        let transientCalls = 0
        const settled = Bus.subscribe(
          ReceiptEvent,
          () => {
            settledCalls += 1
          },
          { durableID: "test.receipt.already-settled" },
        )
        const transient = Bus.subscribe(
          ReceiptEvent,
          () => {
            transientCalls += 1
            if (transientCalls === 1) throw new Error("injected subscriber receipt failure")
          },
          { durableID: "test.receipt.transient" },
        )
        try {
          const publication = Bus.publishOwned(ReceiptEvent, { value: "one-occurrence" })
          await publication.catch(() => undefined)
          const deadline = Date.now() + 5_000
          while (
            Bus.TestHooks.outbox().some((row) => row.occurrence_id === publication.occurrenceID) &&
            Date.now() < deadline
          ) {
            await Bun.sleep(10)
          }
          expect({
            occurrence: Bus.TestHooks.outbox().find((row) => row.occurrence_id === publication.occurrenceID),
            deliveries: Bus.TestHooks.deliveries(publication.occurrenceID),
            settledCalls,
            transientCalls,
            owned: Bus.TestHooks.ownedPublications(),
          }).toEqual({ occurrence: undefined, deliveries: [], settledCalls: 1, transientCalls: 2, owned: [] })
        } finally {
          settled()
          transient()
        }
      },
    })
  })

  test("coalesces concurrent manual retries behind one durable occurrence owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let calls = 0
        let concurrent = 0
        let maxConcurrent = 0
        let release!: () => void
        const blocked = new Promise<void>((resolve) => (release = resolve))
        let started!: () => void
        const observed = new Promise<void>((resolve) => (started = resolve))
        const unsubscribe = Bus.subscribe(
          ReceiptEvent,
          async () => {
            calls += 1
            concurrent += 1
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            started()
            await blocked
            concurrent -= 1
          },
          { durableID: "test.receipt.concurrent-manual-retry" },
        )
        try {
          using _interruption = Bus.TestHooks.suppressAutomaticDurableDrain()
          const accepted = Bus.publishOwned(ReceiptEvent, { value: "single-flight" })
          const first = accepted.retry()
          const second = accepted.retry()
          await observed
          expect({ sameOwner: first === second, calls, maxConcurrent, owned: Bus.TestHooks.ownedPublications() }).toEqual({
            sameOwner: true,
            calls: 1,
            maxConcurrent: 1,
            owned: [{ directory: project.path, id: accepted.occurrenceID, pending: true, failed: false }],
          })
          release()
          await Promise.all([first, second])
          expect({ calls, maxConcurrent, outbox: Bus.TestHooks.outbox() }).toEqual({
            calls: 1,
            maxConcurrent: 1,
            outbox: [],
          })
        } finally {
          release()
          unsubscribe()
        }
      },
    })
  })

  test("settles durable scheduler acceptance despite a failed transient Global projection", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let successfulProjectionCalls = 0
        let failedProjectionCalls = 0
        const successfulProjection = () => {
          successfulProjectionCalls += 1
        }
        const failedProjection = () => {
          failedProjectionCalls += 1
          throw new Error("injected disconnected Global projection")
        }
        GlobalBus.on("event", successfulProjection)
        GlobalBus.on("event", failedProjection)
        try {
          const accepted = Bus.publishOwned(ReceiptEvent, { value: "global-projection-is-not-a-gate" })
          await accepted
          const deadline = Date.now() + 5_000
          while (Bus.TestHooks.outbox().length > 0 && Date.now() < deadline) await Bun.sleep(10)
          expect({
            outbox: Bus.TestHooks.outbox(),
            owners: Bus.TestHooks.ownedPublications(),
            successfulProjectionCalls,
            failedProjectionCalls,
          }).toEqual({ outbox: [], owners: [], successfulProjectionCalls: 1, failedProjectionCalls: 1 })
        } finally {
          GlobalBus.off("event", successfulProjection)
          GlobalBus.off("event", failedProjection)
        }
      },
    })
  })

  test("retries only the unsettled Global subscriber receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let settledCalls = 0
        let transientCalls = 0
        const settled = () => {
          settledCalls += 1
        }
        const transient = () => {
          transientCalls += 1
          if (transientCalls === 1) throw new Error("injected Global receipt failure")
        }
        GlobalBus.on("event", settled, { durableID: "test.global.already-settled" })
        GlobalBus.on("event", transient, { durableID: "test.global.transient" })
        try {
          const publication = Bus.publishOwned(ReceiptEvent, { value: "global-occurrence" })
          await waitFor(
            () => !Bus.TestHooks.outbox().some((row) => row.occurrence_id === publication.occurrenceID),
          )
          expect({ settledCalls, transientCalls }).toEqual({ settledCalls: 1, transientCalls: 2 })
        } finally {
          GlobalBus.off("event", settled)
          GlobalBus.off("event", transient)
        }
      },
    })
  })

  test("settles a failed non-durable local projection after one delivery attempt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let projectionCalls = 0
        const unsubscribe = Bus.subscribe(ReceiptEvent, () => {
          projectionCalls += 1
          throw new Error("injected transient local projection failure")
        })
        try {
          const accepted = Bus.publishOwned(ReceiptEvent, { value: "local-projection-is-not-a-gate" })
          await accepted
          const deadline = Date.now() + 5_000
          while (Bus.TestHooks.outbox().length > 0 && Date.now() < deadline) await Bun.sleep(10)
          expect({ outbox: Bus.TestHooks.outbox(), owners: Bus.TestHooks.ownedPublications(), projectionCalls }).toEqual({
            outbox: [],
            owners: [],
            projectionCalls: 1,
          })
        } finally {
          unsubscribe()
        }
      },
    })
  })
})
