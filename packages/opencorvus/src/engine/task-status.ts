/**
 * Derive task status from persistent facts — no FSM cache column.
 *
 * The status field is a projection of immutable Task lifecycle Protocol
 * Events for the current execution epoch. Call-sites that
 * need a status string for display / logging / LLM prompts use
 * `deriveTaskStatus(task)`. These predicates describe facts for UI,
 * diagnostics and deletion cleanup; they must not be used
 * to block operator messages from continuing the same task.
 *
 * Replaces the old `engine_task.status` column deleted in 6-f-2.
 *
 * `terminalReason` is the more precise cause projection for diagnostics/UI.
 */

export type DerivedTaskStatus = "active" | "completed" | "failed" | "cancelled"
export type TaskTerminalReason = "completed" | "failed" | "cancelled" | "interrupted"

type TaskStatusFields = {
  lifecycle_status: "active" | "cancelling" | "closing" | "completed" | "failed" | "cancelled"
  terminal_reason?: "interrupted"
}

export function isTaskCancelled(task: TaskStatusFields): boolean {
  return task.lifecycle_status === "cancelled"
}

export function isTaskInterrupted(task: TaskStatusFields): boolean {
  return task.terminal_reason === "interrupted"
}

export function isTaskTerminal(task: TaskStatusFields): boolean {
  return task.lifecycle_status === "completed" || task.lifecycle_status === "failed" || task.lifecycle_status === "cancelled"
}

export function isTaskCompleted(task: TaskStatusFields): boolean {
  return task.lifecycle_status === "completed"
}

export function isTaskFailed(task: TaskStatusFields): boolean {
  return task.lifecycle_status === "failed"
}

export function isTaskActive(task: TaskStatusFields): boolean {
  return task.lifecycle_status === "active" || task.lifecycle_status === "cancelling" || task.lifecycle_status === "closing"
}

export function deriveTaskStatus(task: TaskStatusFields): DerivedTaskStatus {
  if (task.lifecycle_status === "cancelled") return "cancelled"
  if (task.lifecycle_status === "failed") return "failed"
  if (task.lifecycle_status === "completed") return "completed"
  if (task.lifecycle_status === "active" || task.lifecycle_status === "cancelling" || task.lifecycle_status === "closing") return "active"
  throw new Error(`Unknown Task lifecycle projection: ${task.lifecycle_status satisfies never}`)
}

export function taskTerminalReason(task: TaskStatusFields): TaskTerminalReason | undefined {
  if (!isTaskTerminal(task)) return undefined
  if (isTaskCancelled(task)) return "cancelled"
  if (isTaskInterrupted(task)) return "interrupted"
  return task.lifecycle_status === "failed" ? "failed" : "completed"
}
