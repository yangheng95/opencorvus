import { afterEach, describe, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { Server } from "@/server/server"
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

  test("retains the Project lease until an asynchronous durable subscriber settles", async () => {
    await using project = await memoryProject()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => (release = resolve))
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => (markStarted = resolve))
    let expectedProjectID = ""
    let observedProjectID = ""
    let unsubscribe!: () => void
    const provision = Instance.provide({
      directory: project.path,
      fn: () => {
        expectedProjectID = Instance.project.id
        unsubscribe = Bus.subscribe(
          ReceiptEvent,
          async () => {
            markStarted()
            await blocked
            observedProjectID = Instance.project.id
          },
          { durableID: "test.async-project-lease" },
        )
        Bus.publishOwned(ReceiptEvent, { value: "retain-lease" })
      },
    })
    await started
    unsubscribe()
    let disposed = false
    const disposal = Instance.disposeAll().then(() => {
      disposed = true
    })
    await Bun.sleep(25)
    expect(disposed).toBe(false)
    release()
    await provision
    await disposal
    expect({ observedProjectID, outbox: Bus.TestHooks.outbox() }).toEqual({
      observedProjectID: expectedProjectID,
      outbox: [],
    })
  })

  test("cancels a real durable subscriber at shutdown and replays its retained receipt in a successor", async () => {
    await using project = await memoryProject()
    let publication!: Bus.Publication
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => (markStarted = resolve))
    let observedAbort = ""
    const provision = Instance.provide({
      directory: project.path,
      fn: () => {
        Bus.subscribe(
          ReceiptEvent,
          async ({ signal }) => {
            markStarted()
            await new Promise<void>((_resolve, reject) => {
              if (!signal) return reject(new Error("Durable subscriber requires its physical publication signal"))
              signal.addEventListener(
                "abort",
                () => {
                  observedAbort = signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
                  reject(signal.reason)
                },
                { once: true },
              )
            })
          },
          { durableID: "test.shutdown-replay" },
        )
        publication = Bus.publishOwned(ReceiptEvent, { value: "shutdown-replay" })
      },
    })
    await started

    const settled = await Server.settleCurrentProcessExecution("durable Bus subscriber handoff", {
      disposeInstances: () => Instance.disposeAll(),
    })
    await provision
    await settled.releaseHandoff(true)
    expect({
      observedAbort,
      outbox: Bus.TestHooks.outbox().map((row) => row.occurrence_id),
      deliveries: Bus.TestHooks.deliveries(publication.occurrenceID).map((row) => ({
        subscriberID: row.subscriber_id,
        settled: row.settled,
      })),
    }).toEqual({
      observedAbort: "durable Bus subscriber handoff",
      outbox: [publication.occurrenceID],
      deliveries: expect.arrayContaining([
        { subscriberID: "test.shutdown-replay", settled: false },
      ]),
    })

    let replayed = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const unsubscribe = Bus.subscribe(
          ReceiptEvent,
          ({ properties }) => {
            replayed = properties.value
          },
          { durableID: "test.shutdown-replay" },
        )
        try {
          await publication.retry()
        } finally {
          unsubscribe()
        }
      },
    })
    expect({ replayed, outbox: Bus.TestHooks.outbox() }).toEqual({ replayed: "shutdown-replay", outbox: [] })
  })

  test("recovers a Message source commit with the same occurrence after a successor runtime starts", async () => {
    await using project = await memoryProject()
    let messageID = ""
    let occurrenceID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({
          kind: "mission",
          title: "Durable outbox source",
          metadata: {
            mission: {
              id: "durable-outbox-source",
              channelKey: "mission:durable-outbox-source",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
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
