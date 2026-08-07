import { Identifier } from "@/id/id"
import { ProtocolStore } from "@/protocol/store"
import {
  TASK_CANCELLED_EVENT_TYPE,
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

export function taskCancellationProjection(taskID: string) {
  const terminal = ProtocolStore.latestTaskEvent(taskID, TASK_CANCELLED_EVENT_TYPE)
  const requestEventID = taskCancellationRequestEventID(taskID, terminal)
  const requested = ProtocolStore.requireEvent(requestEventID)
  return projectTaskCancellationEventChain(taskID, terminal, requested)
}
