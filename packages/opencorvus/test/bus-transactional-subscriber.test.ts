import { afterEach, expect, test } from "bun:test"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { BusPublicationDeliveryReceiptTable } from "@/bus/bus.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)
const Event = BusEvent.define("test.bus.atomic-session-title", z.object({ sessionID: z.string(), title: z.string() }))
const options = { durableID: "test.atomic-title", effect: "idempotent_by_occurrence" as const }
function title(id: string) {
  return Database.use(db => db.select({ title: SessionTable.title }).from(SessionTable).where(eq(SessionTable.id, id)).get()!.title)
}
function receipts(id: string) {
  return Database.use(db => db.select().from(BusPublicationDeliveryReceiptTable)
    .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, id)).all()).filter(row => row.subscriber_id === options.durableID)
}

test("a synchronous subscriber commits its SQL effect and original receipt together after rollback", async () => {
  await using project = await memoryProject("atomic-bus-rollback")
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Original title" })
    const notices: Array<{ directory: string; title: string; receipt: string[] }> = []
    let interrupt = true
    const stop = Bus.subscribeInTransaction(Event, ({ properties, occurrenceID }, db) => {
      db.update(SessionTable).set({ title: properties.title }).where(eq(SessionTable.id, properties.sessionID)).run()
      Database.effect(() => { notices.push({ directory: Instance.directory, title: title(session.id), receipt: receipts(occurrenceID).map(row => row.outcome) }) })
      if (interrupt) throw new Error("SQL interruption before success receipt")
    }, options)
    using suppress = Bus.TestHooks.suppressAutomaticDurableDrain()
    const publication = Bus.publishOwned(Event, { sessionID: session.id, title: "Committed title" })
    await publication.retry().catch(() => {})
    expect({ title: title(session.id), outcomes: receipts(publication.occurrenceID).map(row => row.outcome) })
      .toEqual({ title: "Original title", outcomes: ["failed"] })
    interrupt = false
    await publication.retry()
    const committed = receipts(publication.occurrenceID)
    expect({ title: title(session.id), notices, outcomes: committed.map(row => row.outcome) }).toEqual({
      title: "Committed title", notices: [{ directory: project.path, title: "Committed title", receipt: ["failed", "succeeded"] }],
      outcomes: ["failed", "succeeded"],
    })
    await publication.retry()
    expect(receipts(publication.occurrenceID)).toEqual(committed)
    stop()
  } })
})

test("synchronous delivery retains each concurrent Project's original Instance context", async () => {
  await using first = await memoryProject("atomic-bus-first")
  await using second = await memoryProject("atomic-bus-second")
  const observed: Array<{ directory: string; projectID: string; title: string }> = []
  const prepared = await Promise.all([first, second].map((project, index) => Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: `Original ${index}` })
    const stop = Bus.subscribeInTransaction(Event, ({ properties }, db) => {
      db.update(SessionTable).set({ title: properties.title }).where(eq(SessionTable.id, properties.sessionID)).run()
      Database.effect(() => { observed.push({ directory: Instance.directory, projectID: Instance.project.id, title: title(session.id) }) })
    }, options)
    return { session, stop, projectID: Instance.project.id }
  } })))
  try {
    await Promise.all(prepared.map((entry, index) => Instance.provide({ directory: [first, second][index]!.path,
      fn: () => Bus.publishOwned(Event, { sessionID: entry.session.id, title: `Committed ${index}` }).retry() })))
    expect(observed.sort((a, b) => a.title.localeCompare(b.title))).toEqual(prepared.map((entry, index) => ({
      directory: [first, second][index]!.path, projectID: entry.projectID, title: `Committed ${index}`,
    })))
  } finally { for (const entry of prepared) entry.stop() }
})

test("transactional registration keeps the original callback identity", async () => {
  await using project = await memoryProject("atomic-bus-registration")
  await Instance.provide({ directory: project.path, fn: async () => {
    const received: string[] = []
    const callback = ({ properties }: Bus.Envelope<{ sessionID: string; title: string }>) => { received.push(properties.title) }
    const first = Bus.subscribeInTransaction(Event, callback, options)
    const second = Bus.subscribeInTransaction(Event, callback, options)
    await Bus.publishOwned(Event, { sessionID: "registration", title: "Original callback" }).retry()
    expect(received).toEqual(["Original callback"])
    first(); second()
  } })
})

test("an async result maps to the synchronous contract error and rolls back the SQL effect", async () => {
  await using project = await memoryProject("atomic-bus-sync-contract")
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Original synchronous owner" })
    let valid = false
    const stop = Bus.subscribeInTransaction(Event, (({ properties }: any, db: Database.TxOrDb) => {
      db.update(SessionTable).set({ title: properties.title }).where(eq(SessionTable.id, properties.sessionID)).run()
      if (!valid) return Promise.resolve()
    }) as any, options)
    using suppress = Bus.TestHooks.suppressAutomaticDurableDrain()
    const publication = Bus.publishOwned(Event, { sessionID: session.id, title: "Valid synchronous owner" })
    await publication.retry().catch(() => {})
    expect({ title: title(session.id), outcome: receipts(publication.occurrenceID)[0]?.outcome,
      error: receipts(publication.occurrenceID)[0]?.error }).toEqual({
      title: "Original synchronous owner", outcome: "failed",
      error: `Transactional Bus subscriber ${options.durableID} must complete synchronously`,
    })
    valid = true
    await publication.retry()
    expect({ title: title(session.id), outcomes: receipts(publication.occurrenceID).map(row => row.outcome) })
      .toEqual({ title: "Valid synchronous owner", outcomes: ["failed", "succeeded"] })
    stop()
  } })
})

test("a transient event maps to the durable-publication contract before its SQL effect", async () => {
  await using project = await memoryProject("atomic-bus-transient-contract")
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Original transient owner" })
    const stop = Bus.subscribeInTransaction(Event, ({ properties }, db) => {
      db.update(SessionTable).set({ title: properties.title }).where(eq(SessionTable.id, properties.sessionID)).run()
    }, options)
    const transient = Bus.publish(Event, { sessionID: session.id, title: "Durable owner" })
    await expect(transient).rejects.toMatchObject({ name: "TransactionalPublicationRequiredError",
      code: "BUS_DURABLE_PUBLICATION_REQUIRED", occurrenceID: transient.occurrenceID, subscriberID: options.durableID })
    expect(title(session.id)).toBe("Original transient owner")
    await Bus.publishOwned(Event, { sessionID: session.id, title: "Durable owner" }).retry()
    expect(title(session.id)).toBe("Durable owner")
    stop()
  } })
})

for (const mode of ["ordinary", "transactional"] as const) {
  test(`${mode} registration maps a conflicting delivery mode to the original identity error`, async () => {
    await using project = await memoryProject(`atomic-bus-${mode}-identity`)
    await Instance.provide({ directory: project.path, fn: async () => {
      const received: string[] = []
      const callback = ({ properties }: Bus.Envelope<{ sessionID: string; title: string }>) => { received.push(properties.title) }
      const register = mode === "ordinary" ? Bus.subscribe : Bus.subscribeInTransaction
      const conflicting = mode === "ordinary" ? Bus.subscribeInTransaction : Bus.subscribe
      const stop = register(Event, callback, options)
      expect(() => conflicting(Event, callback, options)).toThrow(expect.objectContaining({
        name: "DurableBusSubscriptionIdentityConflictError",
      }))
      await Bus.publishOwned(Event, { sessionID: "original-mode", title: mode }).retry()
      expect(received).toEqual([mode])
      stop()
    } })
  })
}
