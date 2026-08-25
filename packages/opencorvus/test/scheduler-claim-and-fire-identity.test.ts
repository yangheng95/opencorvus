import { afterAll, describe, expect, test } from "bun:test"
import { acquireControlLease, currentControlLeaseInTransaction } from "../src/engine/control-lease"
import { EngineControlActivationLeaseTable } from "../src/engine/engine.sql"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { AutomationDefinitionTombstoneTable, AutomationRunReceiptTable, AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationRunningConflictError, AutomationService } from "../src/scheduler/automation-service"
import { Database, and, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

describe("scheduler immutable definition and fire identity", () => {
  test("manual execution returns only runs bound to its exact definition revision and fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "manual", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const runs = await AutomationService.TestHooks.runNowWithExecutor(automation.id, async (job) => {
        const fireID = Identifier.ascending("call")
        const runID = Identifier.ascending("automation")
        Database.transaction((db) => {
          db.insert(AutomationRunTable).values({ id: runID, automation_revision_id: job.revision_id, fire_id: fireID, target_project_id: Instance.project.id, started_at: Date.now() }).run()
          db.insert(AutomationRunReceiptTable).values({ id: Identifier.ascending("automation"), run_id: runID, outcome: "succeeded", time_created: Date.now() }).run()
        })
        return fireID
      })
      expect(runs).toHaveLength(1)
      expect(runs[0]).toMatchObject({ automationId: automation.id, outcome: "succeeded" })
    } })
  })

  test("updates and removal append revisions while historical runs retain their exact definition", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const created = await AutomationService.create({ name: "v1", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "first" })
      const updated = await AutomationService.update({ id: created.id, name: "v2", prompt: "second" })
      expect(updated).toMatchObject({ id: created.id, name: "v2", prompt: "second" })
      expect(AutomationService.remove(created.id)).toEqual({ id: created.id, name: "v2" })
      const revisions = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, created.id)).orderBy(AutomationTable.revision).all())
      expect(revisions.map((row) => ({ revision: row.revision, name: row.name }))).toEqual([
        { revision: 1, name: "v1" },
        { revision: 2, name: "v2" },
      ])
      expect(Database.use((db) => db.select().from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, created.id)).get()))
        .toMatchObject({ definition_id: created.id, revision: 3 })
      expect(AutomationService.list().some((row) => row.id === created.id)).toBe(false)
    } })
  })

  test("a claim takes the fire owner for the exact current revision and a refused claim leaves that owner in place", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "fenced", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      const now = Date.now()
      const claimed = AutomationService.TestHooks.claim(automation.id, "owner:first", now, true)
      const current = Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, automation.id)).orderBy(AutomationTable.revision).all()).at(-1)!
      expect(claimed).toMatchObject({ id: automation.id, revision_id: current.id, revision: current.revision })
      expect(AutomationService.TestHooks.claim(automation.id, "owner:second", now, true)).toBeUndefined()
      expect(Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id)))
        .toMatchObject({ owner_occurrence_id: "owner:first", expires_at: now + 2 * 60 * 1000 })
      expect(Database.use((db) => db.select().from(EngineControlActivationLeaseTable)
        .where(and(eq(EngineControlActivationLeaseTable.target, "automation"), eq(EngineControlActivationLeaseTable.target_id, automation.id))).all()))
        .toHaveLength(1)
    } })
  })

  test("a completed fire ends its execution lease with its terminal receipt, so the definition is immediately mutable", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "settling", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: true as const }),
      }))
      const runs = await AutomationService.runNow(automation.id)
      expect(runs.map((run) => run.outcome)).toEqual(["succeeded"])
      const settled = Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id))!
      expect(settled.expires_at).toBeLessThanOrEqual(Date.now())
      expect(AutomationService.remove(automation.id)).toEqual({ id: automation.id, name: "settling" })
    } })
  }, 30_000)

  test("a failed fire ends its execution lease with its retry receipt, so the recorded retry time is the only deferral", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const automation = await AutomationService.create({ name: "retrying", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "run" })
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
        sessionID: input.sessionID!,
        messageID: input.messageID!,
        activation: Promise.resolve({ owner: new AbortController().signal }),
        completion: Promise.resolve({ ok: false as const, error: "wake refused" }),
      }))
      const runs = await AutomationService.runNow(automation.id)
      expect(runs.map((run) => run.outcome)).toEqual(["retry_wait"])
      const settled = Database.use((db) => currentControlLeaseInTransaction(db, "automation", automation.id))!
      expect(settled.expires_at).toBeLessThanOrEqual(Date.now())
      expect(AutomationService.remove(automation.id)).toEqual({ id: automation.id, name: "retrying" })
    } })
  }, 30_000)

  test("a live execution lease atomically rejects definition mutation", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const created = await AutomationService.create({ name: "leased", target: { scope: "project", projectIds: [Instance.project.id] }, recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY", prompt: "first" })
      expect(acquireControlLease({ target: "automation", targetID: created.id, ownerOccurrenceID: "owner:race", now: Date.now(), leaseMilliseconds: 30_000 }).acquired).toBe(true)
      await expect(AutomationService.update({ id: created.id, prompt: "conflict" })).rejects.toBeInstanceOf(AutomationRunningConflictError)
      expect(Database.use((db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, created.id)).all())).toHaveLength(1)
    } })
  })
})
