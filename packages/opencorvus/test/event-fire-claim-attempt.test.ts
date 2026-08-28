import { afterAll, describe, expect, test } from "bun:test"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import { currentControlLeaseInTransaction, releaseControlLease } from "../src/engine/control-lease"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { EventService } from "../src/scheduler/event-service"
import { EventJobFireReceiptTable, EventJobFireTable, EventJobTable, EventOccurrenceTable } from "../src/scheduler/event.sql"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

function seedFire(input: { projectID: string; directory: string; now: number }) {
  const jobID = Identifier.ascending("event_job")
  const fireID = Identifier.ascending("call")
  const occurrenceID = `event-occurrence:${fireID}`
  Database.transaction((db) => {
    db.insert(EventJobTable).values({
      id: jobID,
      definition_id: jobID,
      revision: 1,
      project_id: input.projectID,
      name: "attempt counting",
      event_type: "test.attempt.event",
      prompt: "process event",
      agent: "default",
      enabled: true,
      one_shot: false,
      cooldown_ms: 0,
      time_created: input.now,
    }).run()
    db.insert(BusPublicationOutboxTable).values({
      occurrence_id: occurrenceID,
      project_id: input.projectID,
      directory: input.directory,
      event_type: "test.attempt.event",
      properties: {},
      time_created: input.now,
    }).run()
    db.insert(EventOccurrenceTable).values({
      id: occurrenceID,
      bus_outbox_id: occurrenceID,
      project_id: null,
      event_type: null,
      properties: null,
      time_created: input.now,
    }).run()
    db.insert(EventJobFireTable).values({
      id: fireID,
      event_job_revision_id: jobID,
      event_occurrence_id: occurrenceID,
      created_session_id: `session:${fireID}`,
      time_created: input.now + 1,
    }).run()
  })
  return { jobID, fireID }
}

function currentLeaseID(fireID: string): string {
  return Database.use((db) => currentControlLeaseInTransaction(db, "event_fire", fireID))!.id
}

describe("event fire claim attempt counting", () => {
  test("a claim reports the attempt it just took, which is the retry backoff exponent", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const { fireID } = seedFire({ projectID: Instance.project.id, directory: project.path, now })

        const first = EventService.TestHooks.claimFire(fireID, "owner:attempt-one")
        expect(first).toMatchObject({ id: fireID, status: "running", attempt: 1, owner_id: "owner:attempt-one" })

        // Settle that attempt the way `scheduleRetry` does: a retry receipt,
        // and the lease it was holding handed back with it.
        Database.immediateTransaction((db) => {
          db.insert(EventJobFireReceiptTable).values({
            id: Identifier.ascending("call"),
            fire_id: fireID,
            outcome: "retry_wait",
            retry_at: now - 1,
            error: "temporary failure",
            time_created: now + 2,
          }).run()
        })
        expect(
          releaseControlLease({
            target: "event_fire",
            targetID: fireID,
            leaseID: currentLeaseID(fireID),
            ownerOccurrenceID: "owner:attempt-one",
            now: Date.now(),
          }),
        ).toBe(true)

        const second = EventService.TestHooks.claimFire(fireID, "owner:attempt-two")
        expect(second).toMatchObject({ attempt: 2, owner_id: "owner:attempt-two", status: "running" })
      },
    })
  }, 30_000)
})
