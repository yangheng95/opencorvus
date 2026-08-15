import { Identifier } from "@/id/id"
import { ProtocolStore } from "@/protocol/store"
import { Database } from "@/storage/db"
import {
  TASK_CANCELLED_EVENT_TYPE,
  TaskCancellationProjection,
  type TaskCancellationProjection as TaskCancellationProjectionValue,
  parseTaskCancellationRequestEvent,
  projectTaskCancellationEventChain,
  taskCancellationRequestEventID,
} from "./cancellation-origin"
import {
  ExecutionCancellationError,
  createExecutionCancellationOrigin,
} from "@/session/prompt/cancellation"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"

export function taskCancellationAuthorityExecutionError(
  taskID: string,
  operation: string,
): ExecutionCancellationError | undefined {
  return Database.use((db) => taskCancellationAuthorityExecutionErrorInTransaction(db, taskID, operation))
}

export function taskCancellationAuthorityExecutionErrorInTransaction(
  db: Database.TxOrDb,
  taskID: string,
  operation: string,
): ExecutionCancellationError | undefined {
  const projection = taskLifecycleProjectionInTransaction(db, taskID)
  if (projection.status !== "cancelling" || !projection.requestEventID) return undefined
  const request = requireTaskCancellationRequestEvent(taskID, projection.requestEventID)
  const origin = request.origin
  return new ExecutionCancellationError({
    source: "dispatch_preparation",
    message: `${operation} is inapplicable under Task ${taskID} cancellation ${projection.requestEventID}`,
    origin: createExecutionCancellationOrigin({
      actor: origin.actor,
      source: origin.source,
      surface: origin.surface,
      requestID: origin.requestID,
      reason: origin.reason,
      taskID,
      ...(origin.missionID ? { missionID: origin.missionID } : {}),
      ...(origin.messageID ? { messageID: origin.messageID } : {}),
      ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
      ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
      causationEventID: projection.requestEventID,
    }),
  })
}

export function requireTaskCancellationRequestEvent(taskID: string, eventID: string) {
  const parsedEventID = Identifier.schema("protocol_event").parse(eventID)
  const event = ProtocolStore.requireEvent(parsedEventID)
  const parsed = parseTaskCancellationRequestEvent(taskID, parsedEventID, event)
  return {
    ...parsed,
    event,
  }
}

export function taskCancellationProjection(
  taskID: string,
): Extract<TaskCancellationProjectionValue, { status: "cancelled" }> {
  const terminal = ProtocolStore.latestTaskEvent(taskID, TASK_CANCELLED_EVENT_TYPE)
  const requestEventID = taskCancellationRequestEventID(taskID, terminal)
  const requested = ProtocolStore.requireEvent(requestEventID)
  return projectTaskCancellationEventChain(taskID, terminal, requested) as Extract<
    TaskCancellationProjectionValue,
    { status: "cancelled" }
  >
}

export function pendingTaskCancellationProjection(taskID: string) {
  const pending = findPendingTaskCancellationRequestEvent(taskID)
  if (!pending) return undefined
  const { requested, request } = pending
  const origin = request.origin
  return TaskCancellationProjection.parse({
    status: "cancelling",
    requestEventID: requested.id,
    requestedAt: requested.time.emitted,
    source: origin.source,
    requestID: origin.requestID,
    actor: origin.actor,
    surface: origin.surface,
    reason: origin.reason,
    ...(origin.sessionID ? { sessionID: origin.sessionID } : {}),
    ...(origin.messageID ? { messageID: origin.messageID } : {}),
    ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
    ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
    ...(origin.missionID ? { missionID: origin.missionID } : {}),
  })
}

export function findPendingTaskCancellationRequestEvent(taskID: string) {
  const requestEventID = Database.use((db) => {
    const projection = taskLifecycleProjectionInTransaction(db, taskID)
    if (projection.status !== "cancelling") return undefined
    return projection.requestEventID
  })
  if (!requestEventID) return undefined
  const requested = ProtocolStore.requireEvent(requestEventID)
  const request = parseTaskCancellationRequestEvent(taskID, requested.id, requested)
  return { requested, request }
}
