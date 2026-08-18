import { Database, eq } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"
import { projectTaskRowInTransaction, type TaskRow } from "./store"
import { appendTaskReopenedInTransaction, taskLifecycleProjectionInTransaction } from "./task-lifecycle"

/**
 * Open the next execution occurrence of an already-terminal Task.
 *
 * The prior occurrence stays intact as an immutable fact at its old epoch; this
 * appends the reopen at epoch + 1. There is exactly one caller shape — an
 * explicit operator message — because that is the only thing that may create a
 * new occurrence.
 */
export function openTaskForContinuationInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  now: number
}): TaskRow {
  const current = input.db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!current) throw new Error(`task ${input.taskID} not found during continuation open`)
  const lifecycle = taskLifecycleProjectionInTransaction(input.db, input.taskID)
  if (lifecycle.status === "active" || lifecycle.status === "cancelling") {
    throw new Error(`task ${input.taskID} must be terminal before continuation open`)
  }
  if (!current.session_id) throw new Error(`task ${input.taskID} has no root Session`)
  appendTaskReopenedInTransaction({
    db: input.db,
    taskID: input.taskID,
    sessionID: current.session_id,
    now: input.now,
    source: "engine.task-intent-open",
  })
  return projectTaskRowInTransaction(input.db, current)
}
