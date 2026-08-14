import { ProtocolStore } from "@/protocol/store"
import { findTask, type TaskRow } from "./store"
import { deriveTaskStatus, isTaskTerminal } from "./task-status"
import { Event } from "./model"
import {
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "./terminal-lifecycle-reference-schema"

export { TerminalLifecycleReferenceSchema, type TerminalLifecycleReference }

export function sameTerminalLifecycleReference(
  left: TerminalLifecycleReference,
  right: TerminalLifecycleReference,
): boolean {
  return (
    left.terminalEventID === right.terminalEventID &&
    left.terminalStatus === right.terminalStatus &&
    left.timeCompleted === right.timeCompleted &&
    left.terminalError === right.terminalError &&
    left.terminalReason === right.terminalReason
  )
}

export function terminalLifecycleReferenceMatchesTaskRow(
  reference: TerminalLifecycleReference,
  task: TaskRow,
): boolean {
  if (!isTaskTerminal(task)) return false
  const status = deriveTaskStatus(task)
  const interrupted =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? task.metadata.interrupted === true
      : false
  return (
    reference.terminalStatus === status &&
    reference.timeCompleted === task.time_completed &&
    reference.terminalError === (task.error ?? undefined) &&
    (reference.terminalReason === "interrupted") === interrupted
  )
}

const terminalTypes = new Set<string>([Event.TaskCompleted.type, Event.TaskFailed.type, Event.TaskCancelled.type])

const terminalEventTypeByStatus = {
  completed: Event.TaskCompleted.type,
  failed: Event.TaskFailed.type,
  cancelled: Event.TaskCancelled.type,
} as const

export function requireTerminalLifecycleReferenceEvent(taskID: string, input: TerminalLifecycleReference) {
  const reference = TerminalLifecycleReferenceSchema.parse(input)
  const event = ProtocolStore.requireEvent(reference.terminalEventID)
  const payload = event.payload ?? {}
  if (
    event.aggregate !== "task" ||
    event.aggregateID !== taskID ||
    event.taskID !== taskID ||
    event.type !== terminalEventTypeByStatus[reference.terminalStatus] ||
    payload.taskID !== taskID ||
    payload.status !== reference.terminalStatus ||
    payload.timeCompleted !== reference.timeCompleted ||
    payload.error !== reference.terminalError ||
    payload.terminalReason !== reference.terminalReason
  ) {
    throw new Error(`Task ${taskID} terminal lifecycle reference conflicts with event ${event.id}`)
  }
  return event
}

export function requireCurrentTerminalLifecycleReference(taskID: string): TerminalLifecycleReference {
  const task = findTask(taskID)
  if (!task) throw new Error(`Task ${taskID} does not exist while resolving terminal lifecycle`)
  if (!isTaskTerminal(task) || task.time_completed === null) {
    throw new Error(`Task ${taskID} is not terminal while resolving terminal lifecycle`)
  }
  const events = ProtocolStore.listTaskEvents(taskID)
  const latestNonterminalSequence = events
    .filter((event) => event.type === Event.TaskUpdated.type && event.payload?.status === "active")
    .reduce((latest, event) => Math.max(latest, event.sequence), 0)
  const terminal = events
    .filter((event) => terminalTypes.has(event.type) && event.sequence > latestNonterminalSequence)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    .at(-1)
  if (!terminal) throw new Error(`Task ${taskID} has no current terminal lifecycle event`)
  const status = deriveTaskStatus(task)
  const payload = terminal.payload ?? {}
  if (
    payload.taskID !== task.id ||
    payload.status !== status ||
    payload.timeCompleted !== task.time_completed ||
    (status !== "completed" && payload.error !== task.error) ||
    (status === "completed" && payload.error !== undefined)
  ) {
    throw new Error(`Task ${taskID} current terminal lifecycle event ${terminal.id} conflicts with the Task row`)
  }
  const interrupted =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? task.metadata.interrupted === true
      : false
  if ((payload.terminalReason === "interrupted") !== interrupted) {
    throw new Error(`Task ${taskID} terminal interrupted reason conflicts with event ${terminal.id}`)
  }
  return TerminalLifecycleReferenceSchema.parse({
    terminalEventID: terminal.id,
    terminalStatus: status,
    timeCompleted: task.time_completed,
    ...(task.error ? { terminalError: task.error } : {}),
    ...(interrupted ? { terminalReason: "interrupted" } : {}),
  })
}
