import { Database, eq } from "@/storage/db"
import { EngineTaskCancellationAuthorityTable, EngineTaskTable } from "./engine.sql"
import { writeTaskUpdateInTransaction } from "./state"
import { isTaskTerminal } from "./task-status"
import type { TaskRow } from "./store"
import { metadataWithoutTaskCompletionClosure } from "./task-completion-closure"

export function openTaskForContinuationInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  summary: string
  now: number
}): TaskRow {
  const current = input.db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!current) throw new Error(`task ${input.taskID} not found during continuation open`)
  if (!isTaskTerminal(current)) {
    throw new Error(`task ${input.taskID} must be terminal before continuation open`)
  }
  const metadata = metadataWithoutTaskCompletionClosure(current.metadata)
  delete metadata.cancelled
  delete metadata.interrupted
  // A continuation is another terminal occurrence of the same Task and the
  // same immutable creation workspace, not a newly-created Task. Keep the
  // original baseline and the prior result checkpoint so EngineGit.prepare
  // does not compare a post-result workspace with the creation capsule as if
  // no execution had ever occurred. EngineGit.complete owns appending the
  // prior result to result_history when this continuation closes.
  input.db
    .delete(EngineTaskCancellationAuthorityTable)
    .where(eq(EngineTaskCancellationAuthorityTable.task_id, input.taskID))
    .run()
  return writeTaskUpdateInTransaction({
    db: input.db,
    taskID: input.taskID,
    values: { status: "active", error: null, metadata },
    summary: input.summary,
    now: input.now,
  }).task
}

export function openTaskForOperatorIntentInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  intent: "retry" | "replan"
  now: number
}): TaskRow {
  return openTaskForContinuationInTransaction({
    db: input.db,
    taskID: input.taskID,
    summary: `${input.intent === "retry" ? "Retry" : "Replan"} requested by operator`,
    now: input.now,
  })
}
