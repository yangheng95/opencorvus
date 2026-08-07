/**
 * Derive task status from persistent facts — no FSM cache column.
 *
 * Rule-23 compliance: the "status" field is a **projection** of
 * `(time_started, time_completed, error, metadata.cancelled)`. Call-sites that
 * need a status string for display / logging / LLM prompts use
 * `deriveTaskStatus(task)`. These predicates describe facts for UI,
 * diagnostics, deletion cleanup, and queue projection; they must not be used
 * to block operator messages from continuing the same task.
 *
 * Replaces the old `engine_task.status` column deleted in 6-f-2.
 *
 * Cancelled / interrupted / failed all have `time_completed != null &&
 * error != null`. `status` stays lifecycle-shaped for existing API clients;
 * `terminalReason` is the more precise cause projection for diagnostics/UI.
 */

export type DerivedTaskStatus = "queued" | "active" | "completed" | "failed" | "cancelled"
export type TaskTerminalReason = "completed" | "failed" | "cancelled" | "interrupted"

type TaskStatusFields = {
  time_started?: number | null
  time_completed?: number | null
  error?: string | null
  metadata?: Record<string, unknown> | null
}

export function isTaskCancelled(task: TaskStatusFields): boolean {
  const meta = task.metadata
  if (!meta || typeof meta !== "object") return false
  return (meta as Record<string, unknown>).cancelled === true
}

export function isTaskInterrupted(task: TaskStatusFields): boolean {
  const meta = task.metadata
  if (!meta || typeof meta !== "object") return false
  return (meta as Record<string, unknown>).interrupted === true
}

export function isTaskTerminal(task: TaskStatusFields): boolean {
  return task.time_completed != null
}

export function isTaskCompleted(task: TaskStatusFields): boolean {
  return isTaskTerminal(task) && !task.error && !isTaskCancelled(task)
}

export function isTaskFailed(task: TaskStatusFields): boolean {
  return isTaskTerminal(task) && !!task.error && !isTaskCancelled(task)
}

export function isTaskActive(task: TaskStatusFields): boolean {
  return task.time_started != null && task.time_completed == null
}

export function isTaskQueued(task: TaskStatusFields): boolean {
  return task.time_started == null && task.time_completed == null
}

export function deriveTaskStatus(task: TaskStatusFields): DerivedTaskStatus {
  if (isTaskCancelled(task)) return "cancelled"
  if (task.time_completed != null) return task.error ? "failed" : "completed"
  if (task.time_started != null) return "active"
  return "queued"
}

export function taskTerminalReason(task: TaskStatusFields): TaskTerminalReason | undefined {
  if (!isTaskTerminal(task)) return undefined
  if (isTaskCancelled(task)) return "cancelled"
  if (isTaskInterrupted(task)) return "interrupted"
  return task.error ? "failed" : "completed"
}
