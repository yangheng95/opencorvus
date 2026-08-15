import { afterAll, describe, expect, test } from "bun:test"
import { EventJobDefinitionTombstoneTable, EventJobFireReceiptTable, EventJobTable, EventOccurrenceTable } from "../src/scheduler/event.sql"
import { EventService } from "../src/scheduler/event-service"
import { Instance } from "../src/project/instance"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const TYPE = "test.scheduler.event.fact"

describe("Event Job durable fact authority", () => {
  test("persists a transient Bus input once and binds one successful fire to the exact definition revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "one shot", eventType: TYPE, prompt: "wake", projectId: Instance.project.id, oneShot: true })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:transient:1", type: TYPE, properties: { value: 1 } })
      await EventService.TestHooks.waitForIdle()
      const occurrence = Database.use((db) => db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, "event:transient:1")).get())
      expect(occurrence).toMatchObject({ bus_outbox_id: null, project_id: Instance.project.id, event_type: TYPE, properties: { value: 1 } })
      expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
        expect.objectContaining({ event_job_id: job.id, event_occurrence_id: "event:transient:1", status: "succeeded" }),
      ])
      expect(EventService.list(Instance.project.id)[0]).toMatchObject({ id: job.id, enabled: false, lastEvent: "event:transient:1" })
      expect(Database.use((db) => db.select().from(EventJobTable).where(eq(EventJobTable.definition_id, job.id)).get())?.enabled).toBe(true)
    } })
  })

  test("definition removal appends a tombstone without erasing an already accepted fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "removable", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      using _accepted = EventService.TestHooks.installFireAcceptedHook(async () => gate)
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      const accepted = EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:remove:1", type: TYPE, properties: {} })
      while (EventService.TestHooks.fires(Instance.project.id).length === 0) await Bun.sleep(5)
      expect(EventService.remove(job.id, Instance.project.id)).toBe(true)
      release()
      await accepted
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)[0]).toMatchObject({ event_job_id: job.id, status: "succeeded" })
      const revisions = Database.use((db) => db.select().from(EventJobTable).where(eq(EventJobTable.definition_id, job.id)).orderBy(EventJobTable.revision).all())
      expect(revisions).toHaveLength(1)
      expect(Database.use((db) => db.select().from(EventJobDefinitionTombstoneTable).where(eq(EventJobDefinitionTombstoneTable.definition_id, job.id)).get()))
        .toMatchObject({ definition_id: job.id, revision: 2 })
    } })
  })

  test("a retry keeps the same fire identity and appends ordered receipts", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "retry", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      let calls = 0
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
        calls += 1
        if (calls === 1) throw new Error("retryable")
        return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
      })
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:retry:1", type: TYPE, properties: {} })
      while (EventService.TestHooks.fires(Instance.project.id)[0]?.status !== "retry_wait") await Bun.sleep(5)
      await Bun.sleep(1_050)
      EventService.TestHooks.recoverProjectFires()
      await EventService.TestHooks.waitForIdle()
      const fire = EventService.TestHooks.fires(Instance.project.id)[0]!
      expect({ calls, fire }).toMatchObject({ calls: 2, fire: { event_job_id: job.id, event_occurrence_id: "event:retry:1", status: "succeeded" } })
      expect(Database.use((db) => db.select().from(EventJobFireReceiptTable).where(eq(EventJobFireReceiptTable.fire_id, fire.id)).orderBy(EventJobFireReceiptTable.time_created).all()).map((row) => row.outcome)).toEqual(["retry_wait", "succeeded"])
    } })
  }, 10_000)

  test("duplicate acceptance is idempotent and preserves one fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await EventService.create({ name: "dedupe", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      const envelope = { occurrenceID: "event:dedupe:1", type: TYPE, properties: { exact: true } }
      await EventService.TestHooks.acceptEnvelope(envelope)
      await EventService.TestHooks.acceptEnvelope(envelope)
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)).toHaveLength(1)
    } })
  })

  test("same occurrence identity rejects a different immutable input", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await EventService.create({ name: "conflict", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:conflict:1", type: TYPE, properties: { value: 1 } })
      await expect(EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:conflict:1", type: TYPE, properties: { value: 2 } }))
        .rejects.toThrow("conflicts with its immutable input fact")
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)).toHaveLength(1)
    } })
  })
})
