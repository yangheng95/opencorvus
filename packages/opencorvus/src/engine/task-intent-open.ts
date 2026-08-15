import { Database, eq } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"
import { projectTaskRowInTransaction, type TaskRow } from "./store"
import { appendTaskReopenedInTransaction, taskLifecycleProjectionInTransaction } from "./task-lifecycle"

export function openTaskForContinuationInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  summary: string
  now: number
}): TaskRow {
  const current = input.db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  if (!current) throw new Error(`task ${input.taskID} not found during continuation open`)
  const lifecycle = taskLifecycleProjectionInTransaction(input.db, input.taskID)
  if (lifecycle.status === "active" || lifecycle.status === "cancelling" || lifecycle.status === "closing") {
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
