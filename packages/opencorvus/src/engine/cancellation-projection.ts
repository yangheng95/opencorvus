import { Identifier } from "@/id/id"
import { ProtocolStore } from "@/protocol/store"
import { Database, eq } from "@/storage/db"
import { EngineTaskCancellationAuthorityTable, EngineTaskTable } from "./engine.sql"
import { isTaskTerminal } from "./task-status"
import {
  TASK_CANCELLED_EVENT_TYPE,
  TaskCancellationProjection,
  type TaskCancellationProjection as TaskCancellationProjectionValue,
  parseTaskCancellationRequestEvent,
  projectTaskCancellationEventChain,
  taskCancellationRequestEventID,
} from "./cancellation-origin"

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
  const row = Database.use((db) =>
    db
      .select({ task: EngineTaskTable, requestEventID: EngineTaskCancellationAuthorityTable.request_event_id })
      .from(EngineTaskTable)
      .leftJoin(
        EngineTaskCancellationAuthorityTable,
        eq(EngineTaskCancellationAuthorityTable.task_id, EngineTaskTable.id),
      )
      .where(eq(EngineTaskTable.id, taskID))
      .get(),
  )
  if (!row?.requestEventID || isTaskTerminal(row.task)) return undefined
  const requested = ProtocolStore.requireEvent(row.requestEventID)
  const request = parseTaskCancellationRequestEvent(taskID, requested.id, requested)
  return { requested, request }
}
