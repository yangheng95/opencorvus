import { afterAll, describe, expect, test } from "bun:test"
import { acquireControlLease } from "../src/engine/control-lease"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import {
  AutomationFireTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
  AutomationTable,
} from "../src/scheduler/automation.sql"
import { projectAutomationInTransaction, projectAutomationRunInTransaction } from "../src/scheduler/automation-projection"
import { EventJobFireReceiptTable, EventJobFireTable, EventJobTable, EventOccurrenceTable } from "../src/scheduler/event.sql"
import { projectEventFireInTransaction, projectEventJobInTransaction } from "../src/scheduler/event-projection"
import { Database, eq } from "../src/storage/db"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("scheduler immutable fact control", () => {
  test("projects Automation execution only from run inputs, receipts, and a physical lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const automationID = Identifier.ascending("automation")
        const fireID = Identifier.ascending("automation")
        const runID = Identifier.ascending("automation_run")
        Database.transaction((db) => {
          db.insert(AutomationTable).values({
            id: automationID,
            definition_id: automationID,
            revision: 1,
            project_id: Instance.project.id,
            name: "fact projection",
            kind: "recurring",
            scope: "project",
            recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
            execution_mode: "local",
            prompt: "project facts",
            agent: "default",
            status: "active",
            time_created: now,
          }).run()
          db.insert(AutomationFireTable).values({
            id: fireID,
            automation_revision_id: automationID,
            scheduled_due_at: now,
            origin: "scheduled",
            time_created: now,
          }).run()
          db.insert(AutomationRunTable).values({
            id: runID,
            automation_revision_id: automationID,
            fire_id: fireID,
            target_project_id: Instance.project.id,
            started_at: now + 1,
          }).run()
        })
        expect(acquireControlLease({
          target: "automation",
          targetID: automationID,
          ownerOccurrenceID: "automation-owner:fact-projection",
          now: now + 2,
          leaseMilliseconds: 1_000,
        }).acquired).toBe(true)
        expect(Database.use((db) => projectAutomationRunInTransaction(
          db,
          db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runID)).get()!,
        ))).toMatchObject({ outcome: "running", owner: "automation-owner:fact-projection" })

        Database.use((db) => db.insert(AutomationRunReceiptTable).values({
          id: Identifier.ascending("automation_run"),
          run_id: runID,
          outcome: "failed",
          error: "provider unavailable",
          time_created: now + 3,
        }).run())
        expect(Database.use((db) => ({
          run: projectAutomationRunInTransaction(
            db,
            db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runID)).get()!,
          ),
          automation: projectAutomationInTransaction(
            db,
            db.select().from(AutomationTable).where(eq(AutomationTable.id, automationID)).get()!,
          ),
        }))).toMatchObject({
          run: { outcome: "failed", error: "provider unavailable", completed_at: now + 3 },
          automation: { failure_count: 1, last_error: "provider unavailable", last_run: now + 1 },
        })
      },
    })
  })

  test("projects Event retry and success from one fire plus ordered immutable receipts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const jobID = Identifier.ascending("event_job")
        const fireID = Identifier.ascending("call")
        Database.transaction((db) => {
          db.insert(EventJobTable).values({
            id: jobID,
            definition_id: jobID,
            revision: 1,
            project_id: Instance.project.id,
            name: "fact event",
            event_type: "test.fact.event",
            prompt: "process event",
            agent: "default",
            enabled: true,
            one_shot: false,
            cooldown_ms: 0,
            time_created: now,
          }).run()
          db.insert(BusPublicationOutboxTable).values({
            occurrence_id: "event-occurrence:fact",
            project_id: Instance.project.id,
            directory: project.path,
            event_type: "test.fact.event",
            properties: {},
            time_created: now,
          }).run()
          db.insert(EventOccurrenceTable).values({
            id: "event-occurrence:fact",
            bus_outbox_id: "event-occurrence:fact",
            project_id: null,
            event_type: null,
            properties: null,
            time_created: now,
          }).run()
          db.insert(EventJobFireTable).values({
            id: fireID,
            event_job_revision_id: jobID,
            event_occurrence_id: "event-occurrence:fact",
            created_session_id: "session:fact-target",
            time_created: now + 1,
          }).run()
          db.insert(EventJobFireReceiptTable).values({
            id: Identifier.ascending("call"),
            fire_id: fireID,
            outcome: "retry_wait",
            retry_at: now + 1_000,
            error: "temporary failure",
            time_created: now + 2,
          }).run()
        })
        expect(Database.use((db) => projectEventFireInTransaction(
          db,
          db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()!,
          now + 3,
        ))).toMatchObject({ status: "retry_wait", retry_at: now + 1_000, error: "temporary failure" })

        Database.use((db) => db.insert(EventJobFireReceiptTable).values({
          id: Identifier.ascending("call"),
          fire_id: fireID,
          outcome: "succeeded",
          message_id: "message:fact-event",
          time_created: now + 4,
        }).run())
        expect(Database.use((db) => ({
          fire: projectEventFireInTransaction(
            db,
            db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()!,
            now + 5,
          ),
          job: projectEventJobInTransaction(
            db,
            db.select().from(EventJobTable).where(eq(EventJobTable.id, jobID)).get()!,
          ),
        }))).toMatchObject({
          fire: { status: "succeeded", message_id: "message:fact-event", time_completed: now + 4 },
          job: { failure_count: 0, last_event: "event-occurrence:fact" },
        })
      },
    })
  })
})
