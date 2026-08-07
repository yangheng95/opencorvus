import { SessionTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import type { TaskRow } from "./store"

export class TaskQueueError extends Error {
  override readonly name = "TaskQueueError"

  constructor(
    message: string,
    readonly code:
      | "task_not_found"
      | "task_terminal"
      | "session_not_bound"
      | "session_not_found"
      | "project_mismatch"
      | "invalid_root_lineage"
      | "directory_missing"
      | "directory_mismatch",
    readonly taskID: string,
  ) {
    super(message)
  }
}

/**
 * The Task root Session is the single durable execution-directory authority
 * shared by queueing, artifacts, prompt re-entry, and projected workers.
 */
export function taskRootDirectory(task: Pick<TaskRow, "id" | "session_id" | "project_id">): string {
  if (!task.session_id) {
    throw new TaskQueueError(`Task ${task.id} has no root session`, "session_not_bound", task.id)
  }
  const session = Database.use((db) =>
    db
      .select({
        projectID: SessionTable.project_id,
        directory: SessionTable.directory,
        kind: SessionTable.kind,
        parentID: SessionTable.parent_id,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, task.session_id!))
      .get(),
  )
  if (!session) {
    throw new TaskQueueError(
      `Task ${task.id} root session ${task.session_id} does not exist`,
      "session_not_found",
      task.id,
    )
  }
  if (session.projectID !== task.project_id) {
    throw new TaskQueueError(
      `Task ${task.id} project ${task.project_id} does not match root session project ${session.projectID}`,
      "project_mismatch",
      task.id,
    )
  }
  if (session.kind !== "root" || session.parentID) {
    throw new TaskQueueError(
      `Task ${task.id} session ${task.session_id} must be a parentless root session`,
      "invalid_root_lineage",
      task.id,
    )
  }
  if (!session.directory.trim()) {
    throw new TaskQueueError(`Task ${task.id} root session has no directory`, "directory_missing", task.id)
  }
  return session.directory
}
