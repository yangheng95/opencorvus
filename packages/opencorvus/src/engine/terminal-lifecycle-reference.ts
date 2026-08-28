import { ProtocolStore } from "@/protocol/store"
import { findTask, type TaskRow } from "./store"
import { isTaskTerminal } from "./task-status"
import { TASK_TERMINAL_EVENT_TYPES, taskLifecycleProjection } from "./task-lifecycle"
import {
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "./terminal-lifecycle-reference-schema"

export { TerminalLifecycleReferenceSchema, type TerminalLifecycleReference }

export function terminalLifecycleReferenceMatchesTaskRow(
  reference: TerminalLifecycleReference,
  task: TaskRow,
): boolean {
  if (!isTaskTerminal(task)) return false
  return taskLifecycleProjection(task.id).terminalEventID === reference.terminalEventID
}

const terminalTypes = new Set<string>(TASK_TERMINAL_EVENT_TYPES)

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
  const terminalStatus = event.type === "task.completed"
    ? "completed"
    : event.type === "task.failed"
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
