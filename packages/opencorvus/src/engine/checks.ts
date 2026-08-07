import { Database } from "@/storage/db"
import { requireTask, type TaskRow, viewTask } from "./store"
import { setEngineTaskMetadata } from "./task"

export function writeTaskChecks(task: TaskRow, checks: Record<string, unknown> | undefined) {
  const metadata = {
    ...(task.metadata ?? {}),
    ...(checks ? { checks } : {}),
  }
  if (!checks) delete metadata.checks
  Database.use((db) => setEngineTaskMetadata(db, { taskID: task.id, metadata }))
  return viewTask(requireTask(task.id))
}
