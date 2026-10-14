import { afterEach, describe, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { BusPublicationPhaseReceiptTable } from "@/bus/bus.sql"
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
const DerivedReceiptEvent = BusEvent.define("test.bus.derived-durable-receipt", z.object({ value: z.string() }))

function completedPhases(occurrenceID: string) {
  return Database.use(db => db.select({ phase: BusPublicationPhaseReceiptTable.phase })
    .from(BusPublicationPhaseReceiptTable).where(eq(BusPublicationPhaseReceiptTable.occurrence_id, occurrenceID))
    .all().map(row => row.phase).sort())
}

async function waitForPublication(occurrenceID: string) {
  await waitFor(() => completedPhases(occurrenceID).length === 3)
  expect(completedPhases(occurrenceID)).toEqual(["exact", "global", "wildcard"])
}

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
  test("settles durable publications created by an owned subscriber before disposing test state", async () => {
    await using project = await memoryProject()
    let releaseSource!: () => void
    const sourceBlocked = new Promise<void>((resolve) => (releaseSource = resolve))
    let markSourceStarted!: () => void
    const sourceStarted = new Promise<void>((resolve) => (markSourceStarted = resolve))
    let releaseDerived!: () => void
    const derivedBlocked = new Promise<void>((resolve) => (releaseDerived = resolve))
    let markDerivedStarted!: () => void
    const derivedStarted = new Promise<void>((resolve) => (markDerivedStarted = resolve))
    let stopSource!: () => void
    let stopDerived!: () => void
    const observed: string[] = []
    let sourcePublication!: Bus.Publication
    let derivedPublication!: Bus.Publication
    const provision = Instance.provide({
      directory: project.path,
      fn: () => {
        stopSource = Bus.subscribe(
          ReceiptEvent,
          async ({ properties }) => {
            observed.push("source-started")
            markSourceStarted()
            await sourceBlocked
            observed.push("source-resumed")
            derivedPublication = Bus.publishOwned(DerivedReceiptEvent, { value: properties.value })
          },
          { durableID: "test.derived-publication-source", effect: "idempotent_by_occurrence" },
        )
        stopDerived = Bus.subscribe(
          DerivedReceiptEvent,
          async () => {
            observed.push("derived-started")
            markDerivedStarted()
            await derivedBlocked
            observed.push("derived-resumed")
          },
          { durableID: "test.derived-publication-target", effect: "idempotent_by_occurrence" },
        )
        sourcePublication = Bus.publishOwned(ReceiptEvent, { value: "derived" })
      },
    })

    await sourceStarted
    const disposal = Bus.TestHooks.disposeOwnedState().then(() => {
      observed.push("disposal-settled")
    })
    releaseSource()
    await derivedStarted
    releaseDerived()
    await provision
    await disposal
    expect(observed).toEqual(["source-started", "source-resumed", "derived-started", "derived-resumed", "disposal-settled"])
    await waitForPublication(sourcePublication.occurrenceID)
    await waitForPublication(derivedPublication.occurrenceID)
    stopDerived()
    stopSource()
  })

  test("scopes one durable subscriber identity independently to each live Project Instance", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const received = { first: [] as string[], second: [] as string[] }
    let stopFirst!: () => void
    let stopSecond!: () => void
    const publications: Bus.Publication[] = []
    await Instance.provide({
      directory: first.path,
      fn: () => {
        stopFirst = Bus.subscribe(
          ReceiptEvent,
          (event) => received.first.push(event.properties.value),
          { durableID: "test.same-project-local-receipt", effect: "idempotent_by_occurrence" },
        )
      },
    })
    await Instance.provide({
      directory: second.path,
      fn: () => {
        stopSecond = Bus.subscribe(
          ReceiptEvent,
          (event) => received.second.push(event.properties.value),
          { durableID: "test.same-project-local-receipt", effect: "idempotent_by_occurrence" },
        )
      },
    })
    try {
      await Instance.provide({ directory: first.path, fn: () => { publications.push(Bus.publishOwned(ReceiptEvent, { value: "first" })) } })
      await Instance.provide({ directory: second.path, fn: () => { publications.push(Bus.publishOwned(ReceiptEvent, { value: "second" })) } })
      await Promise.all(publications.map(publication => waitForPublication(publication.occurrenceID)))
      expect(received).toEqual({ first: ["first"], second: ["second"] })
    } finally {
      stopFirst()
      stopSecond()
    }
  })

  test("recovers the exact pending publications of each Project beside completed history", async () => {
    await using first = await memoryProject("recovery-first")
    await using second = await memoryProject("recovery-second")
    const received = { first: [] as string[], second: [] as string[] }
    const stops: Array<() => void> = []
    let completed!: Bus.Publication
    let firstPending!: Bus.Publication
    let secondPending!: Bus.Publication
    try {
      await Instance.provide({ directory: first.path, fn: () => {
        stops.push(Bus.subscribe(ReceiptEvent, event => received.first.push(event.properties.value), {
          durableID: "test.pending-project-recovery", effect: "idempotent_by_occurrence",
        }))
        completed = Bus.publishOwned(ReceiptEvent, { value: "completed-first" })
      } })
      await Instance.provide({ directory: second.path, fn: () => {
        stops.push(Bus.subscribe(ReceiptEvent, event => received.second.push(event.properties.value), {
          durableID: "test.pending-project-recovery", effect: "idempotent_by_occurrence",
        }))
      } })
      await waitForPublication(completed.occurrenceID)
      await Promise.all(Bus.TestHooks.outbox().map(row => waitForPublication(row.occurrence_id)))
      {
        using _suppression = Bus.TestHooks.suppressAutomaticDurableDrain()
        await Instance.provide({ directory: first.path, fn: () => {
          firstPending = Bus.publishOwned(ReceiptEvent, { value: "pending-first" })
        } })
        await Instance.provide({ directory: second.path, fn: () => {
          secondPending = Bus.publishOwned(ReceiptEvent, { value: "pending-second" })
        } })
      }
      expect(Bus.TestHooks.outbox().map(row => row.occurrence_id).sort())
        .toEqual([firstPending.occurrenceID, secondPending.occurrenceID].sort())
      await Instance.provide({ directory: first.path, fn: () => Bus.resumeDurablePublications() })
      await waitForPublication(firstPending.occurrenceID)
      expect(Bus.TestHooks.outbox().map(row => row.occurrence_id)).toEqual([secondPending.occurrenceID])
      await Instance.provide({ directory: second.path, fn: () => Bus.resumeDurablePublications() })
      await waitForPublication(secondPending.occurrenceID)
      expect(received).toEqual({ first: ["completed-first", "pending-first"], second: ["pending-second"] })
      expect(completedPhases(completed.occurrenceID)).toEqual(["exact", "global", "wildcard"])
    } finally {
      for (const stop of stops) stop()
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
    const observed: string[] = []
    let publication!: Bus.Publication
    const provision = Instance.provide({
      directory: project.path,
      fn: () => {
        expectedProjectID = Instance.project.id
        unsubscribe = Bus.subscribe(
          ReceiptEvent,
          async () => {
            observed.push("subscriber-started")
            markStarted()
            await blocked
            observedProjectID = Instance.project.id
            observed.push("subscriber-resumed")
          },
          { durableID: "test.async-project-lease", effect: "idempotent_by_occurrence" },
        )
        publication = Bus.publishOwned(ReceiptEvent, { value: "retain-lease" })
      },
    })
    await started
    unsubscribe()
    const disposal = Instance.disposeAll().then(() => {
      observed.push("disposal-settled")
    })
    release()
    await provision
    await disposal
    expect({ observedProjectID, observed }).toEqual({
      observedProjectID: expectedProjectID,
      observed: ["subscriber-started", "subscriber-resumed", "disposal-settled"],
    })
    await waitForPublication(publication.occurrenceID)
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
          { durableID: "test.shutdown-replay", effect: "idempotent_by_occurrence" },
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
          { durableID: "test.shutdown-replay", effect: "idempotent_by_occurrence" },
        )
        try {
          await publication.retry()
        } finally {
          unsubscribe()
        }
      },
    })
    expect(replayed).toBe("shutdown-replay")
    await waitForPublication(publication.occurrenceID)
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
        await Promise.all(Bus.TestHooks.outbox().map(row => waitForPublication(row.occurrence_id)))
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
          { durableID: "test.message-created-successor", effect: "idempotent_by_occurrence" },
        )
        try {
          Bus.resumeDurablePublications()
          await waitForPublication(occurrenceID)
          expect(received).toEqual([occurrenceID])
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
          { durableID: "test.receipt.already-settled", effect: "idempotent_by_occurrence" },
        )
        const transient = Bus.subscribe(
          ReceiptEvent,
          () => {
            transientCalls += 1
            if (transientCalls === 1) throw new Error("injected subscriber receipt failure")
          },
          { durableID: "test.receipt.transient", effect: "idempotent_by_occurrence" },
        )
        try {
          const publication = Bus.publishOwned(ReceiptEvent, { value: "one-occurrence" })
          await publication.catch(() => undefined)
          await waitForPublication(publication.occurrenceID)
          expect({ settledCalls, transientCalls }).toEqual({ settledCalls: 1, transientCalls: 2 })
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
          { durableID: "test.receipt.concurrent-manual-retry", effect: "idempotent_by_occurrence" },
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
          await waitForPublication(accepted.occurrenceID)
          expect({ calls, maxConcurrent }).toEqual({
            calls: 1,
            maxConcurrent: 1,
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
          await waitForPublication(accepted.occurrenceID)
          expect({
            successfulProjectionCalls,
            failedProjectionCalls,
          }).toEqual({ successfulProjectionCalls: 1, failedProjectionCalls: 1 })
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
        GlobalBus.on("event", settled, { durableID: "test.global.already-settled", effect: "idempotent_by_occurrence" })
        GlobalBus.on("event", transient, { durableID: "test.global.transient", effect: "idempotent_by_occurrence" })
        try {
          const publication = Bus.publishOwned(ReceiptEvent, { value: "global-occurrence" })
          await waitForPublication(publication.occurrenceID)
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
          await waitForPublication(accepted.occurrenceID)
          expect(projectionCalls).toBe(1)
        } finally {
          unsubscribe()
        }
      },
    })
  })
})
