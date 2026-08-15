import { ProtocolStore } from "@/protocol/store"
import { findTask, type TaskRow } from "./store"
import { isTaskTerminal } from "./task-status"
import { Event } from "./model"
import { taskLifecycleProjection } from "./task-lifecycle"
import {
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "./terminal-lifecycle-reference-schema"

export { TerminalLifecycleReferenceSchema, type TerminalLifecycleReference }

export function sameTerminalLifecycleReference(
  left: TerminalLifecycleReference,
  right: TerminalLifecycleReference,
): boolean {
  return left.terminalEventID === right.terminalEventID
}

export function terminalLifecycleReferenceMatchesTaskRow(
  reference: TerminalLifecycleReference,
  task: TaskRow,
): boolean {
  if (!isTaskTerminal(task)) return false
  return taskLifecycleProjection(task.id).terminalEventID === reference.terminalEventID
}

const terminalTypes = new Set<string>([Event.TaskCompleted.type, Event.TaskFailed.type, Event.TaskCancelled.type])

export function requireTerminalLifecycleReferenceEvent(taskID: string, input: TerminalLifecycleReference) {
  const reference = TerminalLifecycleReferenceSchema.parse(input)
  const event = ProtocolStore.requireEvent(reference.terminalEventID)
  if (
    event.aggregate !== "task" ||
    event.aggregateID !== taskID ||
    event.taskID !== taskID ||
    !terminalTypes.has(event.type)
  ) {
    throw new Error(`Task ${taskID} terminal lifecycle reference conflicts with event ${event.id}`)
  }
  return event
}

export type ResolvedTerminalLifecycleReference = TerminalLifecycleReference & {
  terminalStatus: "completed" | "failed" | "cancelled"
  timeCompleted: number
  terminalError?: string
  terminalReason?: "interrupted"
}

export function resolveTerminalLifecycleReference(
  taskID: string,
  input: TerminalLifecycleReference,
): ResolvedTerminalLifecycleReference {
  const event = requireTerminalLifecycleReferenceEvent(taskID, input)
  const terminalStatus = event.type === Event.TaskCompleted.type
    ? "completed"
    : event.type === Event.TaskFailed.type
      ? "failed"
      : "cancelled"
  return {
    terminalEventID: event.id,
    terminalStatus,
    timeCompleted: event.time.emitted,
    ...(typeof event.payload?.error === "string" ? { terminalError: event.payload.error } : {}),
    ...(event.payload?.terminalReason === "interrupted" ? { terminalReason: "interrupted" as const } : {}),
  }
}

export function requireCurrentTerminalLifecycleReference(taskID: string): TerminalLifecycleReference {
  const task = findTask(taskID)
  if (!task) throw new Error(`Task ${taskID} does not exist while resolving terminal lifecycle`)
  const lifecycle = taskLifecycleProjection(taskID)
  if (!lifecycle.terminalEventID || lifecycle.terminalAt === undefined || !isTaskTerminal(task)) {
    throw new Error(`Task ${taskID} is not terminal while resolving terminal lifecycle`)
  }
  return TerminalLifecycleReferenceSchema.parse({
    terminalEventID: lifecycle.terminalEventID,
  })
}
