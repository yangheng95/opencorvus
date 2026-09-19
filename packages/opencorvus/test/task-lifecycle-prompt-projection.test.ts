import { afterEach, expect, test } from "bun:test"
import { describeTask, renderTaskExecutionFact } from "@/engine/describe"
import { requireTask } from "@/engine/store"
import { appendTaskReopenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { applyTaskProjectionDelta, renderTaskProjectionDelta } from "@/orchestrator/agent"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Database } from "@/storage/db"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("Task prompt projection follows exact open, terminal, reopen and cancellation epochs", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Current repair epoch" })
    const otherID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Independent Task" })
    const other = await describeTask(otherID)
    const sessionID = requireTask(taskID).session_id!
    const first = await describeTask(taskID)
    expect(first.execution_lifecycle).toEqual(taskLifecycleProjection(taskID))
    expect(first).toMatchObject({ status: "active", execution_lifecycle: { taskID, epoch: 1, status: "active" } })
    const append = (type: string, epoch: number, error?: string) => Database.immediateTransaction((db) =>
      ProtocolStore.appendEventInTransaction({ kind: "event", type, aggregate: "task", aggregate_id: taskID,
        task_id: null, session_id: sessionID, source: "test.lifecycle-projection", emitted_at: Date.now(),
        payload: { execution_epoch: epoch, ...(error ? { error } : {}) } }),
    )
    const terminal = append("task.completed", 1)
    const completed = await describeTask(taskID)
    expect(completed).toMatchObject({ status: "completed", execution_lifecycle: {
      epoch: 1, openedEventID: first.execution_lifecycle.openedEventID, terminalEventID: terminal.id, status: "completed",
    } })
    const reopened = Database.immediateTransaction((db) => appendTaskReopenedInTransaction({
      db, taskID, sessionID, now: Date.now(), source: "test.lifecycle-projection",
    }))
    const active = await describeTask(taskID)
    expect(active.execution_lifecycle).toEqual(reopened)
    expect(renderTaskExecutionFact(active.execution_lifecycle)).toBe(
      `CURRENT TASK LIFECYCLE FACT: task_id=${taskID}; execution_epoch=2; task_status=active; ` +
      `opened_event_id=${reopened.openedEventID}; terminal_event_id=null. ` +
      "This is the current Task occurrence, distinct from every worker Session lifecycle and every historical Task occurrence.",
    )
    expect(active).toMatchObject({ status: "active", execution_lifecycle: { epoch: 2, status: "active" } })
    const reconstructed = applyTaskProjectionDelta(completed, renderTaskProjectionDelta(completed, active))
    expect(reconstructed.execution_lifecycle).toEqual(reopened)
    expect(reconstructed.status).toBe("active")
    const request = append("task.cancellation.requested", 2)
    expect(await describeTask(taskID)).toMatchObject({ status: "active", execution_lifecycle: {
      epoch: 2, status: "cancelling", openedEventID: reopened.openedEventID, requestEventID: request.id,
    } })
    const cancelled = append("task.cancelled", 2)
    expect(await describeTask(taskID)).toMatchObject({ status: "cancelled", execution_lifecycle: {
      epoch: 2, status: "cancelled", openedEventID: reopened.openedEventID, terminalEventID: cancelled.id,
    } })
    Database.immediateTransaction((db) => appendTaskReopenedInTransaction({
      db, taskID, sessionID, now: Date.now(), source: "test.lifecycle-projection",
    }))
    const failure = append("task.failed", 3, "Current epoch failure")
    expect(await describeTask(taskID)).toMatchObject({ status: "failed", error: "Current epoch failure", execution_lifecycle: {
      epoch: 3, status: "failed", terminalEventID: failure.id, terminalError: "Current epoch failure",
    } })
    expect((await describeTask(otherID)).execution_lifecycle).toEqual(other.execution_lifecycle)
  } })
})
