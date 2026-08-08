import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { AutomationRunTable, AutomationTable } from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { TaskQueueTable, type TaskQueuePriority } from "../src/scheduler/task-queue.sql"
import { TaskQueueService } from "../src/scheduler/task-queue-service"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

function insertQueuedTask(input: { id: string; sessionID: string; priority: TaskQueuePriority; timeCreated: number }) {
  Database.use((db) =>
    db
      .insert(TaskQueueTable)
      .values({
        id: input.id,
        session_id: input.sessionID,
        prompt: input.id,
        priority: input.priority,
        status: "queued",
        source: "scheduler-positive-contract",
        metadata: { kind: "session_prompt", input: {} },
        time_created: input.timeCreated,
        time_updated: input.timeCreated,
      })
      .run(),
  )
}

async function createSession(title: string) {
  return Session.createNext({
    directory: Instance.directory,
    kind: "assistant",
    title,
  })
}

describe("scheduler atomic identity and progress contracts", () => {
  test("claims the current highest-priority queued task after asynchronous validation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await createSession("priority claim")
        const lowID = Identifier.ascending("task")
        const highID = Identifier.ascending("task")
        const now = Date.now()
        insertQueuedTask({ id: lowID, sessionID: session.id, priority: "low", timeCreated: now })

        let insertedHigh = false
        const firstClaim = await TaskQueueService.TestHooks.claimReadyTaskIDs({
          limit: 1,
          beforeValidation: () => {
            if (insertedHigh) return
            insertedHigh = true
            insertQueuedTask({ id: highID, sessionID: session.id, priority: "high", timeCreated: now + 1 })
          },
        })
        expect(firstClaim).toEqual([highID])

        Database.use((db) =>
          db
            .update(TaskQueueTable)
            .set({ status: "completed", time_completed: now + 2, time_updated: now + 2 })
            .where(eq(TaskQueueTable.id, highID))
            .run(),
        )
        expect(await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })).toEqual([lowID])
      },
    })
  })

  test("refills capacity after rejected head candidates and claims the later valid task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const firstRejected = await createSession("first rejected candidate")
        const secondRejected = await createSession("second rejected candidate")
        const valid = await createSession("later valid candidate")
        const firstRejectedID = Identifier.ascending("task")
        const secondRejectedID = Identifier.ascending("task")
        const validID = Identifier.ascending("task")
        const now = Date.now()
        insertQueuedTask({ id: firstRejectedID, sessionID: firstRejected.id, priority: "normal", timeCreated: now })
        insertQueuedTask({
          id: secondRejectedID,
          sessionID: secondRejected.id,
          priority: "normal",
          timeCreated: now + 1,
        })
        insertQueuedTask({ id: validID, sessionID: valid.id, priority: "normal", timeCreated: now + 2 })

        const rejectedSessions = new Set([firstRejected.id, secondRejected.id])
        const claimed = await TaskQueueService.TestHooks.claimReadyTaskIDs({
          limit: 2,
          beforeValidation: (sessionID) => {
            if (rejectedSessions.has(sessionID)) throw new Error(`Rejected Session ${sessionID}`)
          },
        })
        expect(claimed).toEqual([validID])
        expect(
          Database.use((db) =>
            db
              .select({ id: TaskQueueTable.id, status: TaskQueueTable.status })
              .from(TaskQueueTable)
              .where(eq(TaskQueueTable.source, "scheduler-positive-contract"))
              .all(),
          )
            .filter((row) => [firstRejectedID, secondRejectedID, validID].includes(row.id))
            .sort((left, right) => left.id.localeCompare(right.id)),
        ).toEqual(
          [
            { id: firstRejectedID, status: "failed" },
            { id: secondRejectedID, status: "failed" },
            { id: validID, status: "running" },
          ].sort((left, right) => left.id.localeCompare(right.id)),
        )
      },
    })
  })

  test("manual automation returns the run set bound to its allocated fire identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automation = await AutomationService.create({
          name: "manual fire identity",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "manual fire identity",
        })
        const manualFireID = Identifier.ascending("call")
        const laterFireID = Identifier.ascending("call")
        const manualRunID = Identifier.ascending("automation_run")
        const laterRunID = Identifier.ascending("automation_run")

        const runs = await AutomationService.TestHooks.runNowWithExecutor(automation.id, async (job, owner, now) => {
          Database.transaction((db) => {
            db.insert(AutomationRunTable)
              .values([
                {
                  id: manualRunID,
                  automation_id: job.id,
                  fire_id: manualFireID,
                  target_scope: "global",
                  owner,
                  outcome: "succeeded",
                  started_at: now,
                  completed_at: now,
                },
                {
                  id: laterRunID,
                  automation_id: job.id,
                  fire_id: laterFireID,
                  target_scope: "global",
                  owner: "poll-owner",
                  outcome: "succeeded",
                  started_at: now + 1,
                  completed_at: now + 1,
                },
              ])
              .run()
            db.update(AutomationTable)
              .set({ lease_owner: null, lease_until: 0 })
              .where(eq(AutomationTable.id, job.id))
              .run()
          })
          return manualFireID
        })

        expect(runs.map((run) => ({ id: run.id, fireID: run.fireId, outcome: run.outcome }))).toEqual([
          { id: manualRunID, fireID: manualFireID, outcome: "succeeded" },
        ])
      },
    })
  })
})
