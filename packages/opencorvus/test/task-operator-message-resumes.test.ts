/**
 * An operator message resumes the Task it addresses.
 *
 * A Task is terminal to the machinery, never to the operator. Before this, a
 * message on a terminal Task woke a conversation-only Turn — the agent replied
 * and nothing executed — and resuming required a separate Retry control in a
 * title dropdown. Reopening on the message is one durable act: a new execution
 * epoch, with the prior terminal occurrence left intact at its old epoch.
 *
 * Every terminal state resumes this way, cancelled included: cancellation ends
 * an occurrence, not the Task. Deletion is the one boundary that fences a
 * reopen, and the tracked contract says so explicitly.
 */
import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction, taskLifecycleProjection } from "../src/engine/task-lifecycle"
import { deriveTaskStatus } from "../src/engine/task-status"
import { requireTask } from "../src/engine/store"
import { ProtocolStore } from "../src/protocol/store"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import { EngineService } from "../src/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const { reopenTerminalTaskForOperatorMessage } = EngineService.OperatorMessageResumeTestHooks

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function seedTask(title: string): Promise<{ taskID: string; sessionID: string }> {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title })
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title,
        request: "Operator message resume contract.",
        time_started: now,
        time_created: now,
        time_updated: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.operator-message-resume" })
  })
  return { taskID, sessionID: root.id }
}

/** Append the terminal lifecycle fact directly. `terminalTask` also runs git
 *  preparation and process-authority checks that this rule does not depend on. */
function seedTerminal(taskID: string, sessionID: string, type: "task.failed" | "task.completed" | "task.cancelled") {
  Database.immediateTransaction(() => {
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type,
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: sessionID,
      source: "test.operator-message-resume",
      emitted_at: Date.now(),
      payload: { execution_epoch: 1, ...(type === "task.completed" ? {} : { error: "seeded terminal" }) },
    })
  })
}

test("reopens a failed Task and leaves the prior terminal epoch intact", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID, sessionID } = await seedTask("Operator message resumes a failed Task")
      seedTerminal(taskID, sessionID, "task.failed")
      expect(deriveTaskStatus(requireTask(taskID))).toBe("failed")
      const terminalEpoch = taskLifecycleProjection(taskID).epoch

      reopenTerminalTaskForOperatorMessage(taskID)

      expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      // The reopen is an epoch boundary, exactly like Retry: the terminal
      // occurrence stays an immutable fact at the epoch it settled on.
      expect(taskLifecycleProjection(taskID).epoch).toBeGreaterThan(terminalEpoch)
    },
  })
})

test("reopens a completed Task", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID, sessionID } = await seedTask("Operator message resumes a completed Task")
      seedTerminal(taskID, sessionID, "task.completed")
      expect(deriveTaskStatus(requireTask(taskID))).toBe("completed")
      const terminalEpoch = taskLifecycleProjection(taskID).epoch

      reopenTerminalTaskForOperatorMessage(taskID)

      expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      expect(taskLifecycleProjection(taskID).epoch).toBeGreaterThan(terminalEpoch)
    },
  })
})

// Cancellation ends an occurrence, not the Task. Leaving it out made cancelled
// the one terminal state whose only exit was a dedicated Retry control, which is
// the shape this reform removes: a state no ordinary action can leave.
test("resumes a cancelled Task, because cancellation ended an occurrence and not the Task", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID, sessionID } = await seedTask("Operator message resumes a cancelled Task")
      seedTerminal(taskID, sessionID, "task.cancelled")
      expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")
      const cancelledEpoch = taskLifecycleProjection(taskID).epoch

      reopenTerminalTaskForOperatorMessage(taskID)

      expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      expect(taskLifecycleProjection(taskID).epoch).toBeGreaterThan(cancelledEpoch)
    },
  })
})

// Deletion is the boundary that does fence a reopen; the tracked contract lists
// `reopen` among what `task.deleted` fences.
test("leaves a deleted Task's epoch alone", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID, sessionID } = await seedTask("Operator message on a deleted Task")
      seedTerminal(taskID, sessionID, "task.completed")
      const deletedEpoch = taskLifecycleProjection(taskID).epoch
      Database.transaction(() => {
        ProtocolStore.appendEventInTransaction({
          kind: "event",
          type: "task.deleted",
          aggregate: "task",
          aggregate_id: taskID,
          task_id: null,
          session_id: sessionID,
          source: "test",
          emitted_at: Date.now(),
          payload: { execution_epoch: deletedEpoch },
        })
      })

      reopenTerminalTaskForOperatorMessage(taskID)

      expect(taskLifecycleProjection(taskID).epoch).toBe(deletedEpoch)
    },
  })
})

test("leaves an active Task's epoch alone", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID } = await seedTask("Operator message on an active Task")
      expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      const activeEpoch = taskLifecycleProjection(taskID).epoch

      reopenTerminalTaskForOperatorMessage(taskID)

      expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      expect(taskLifecycleProjection(taskID).epoch).toBe(activeEpoch)
    },
  })
})
