import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable } from "./protocol.sql"
import { and, eq, sql, type Database } from "@/storage/db"
import { SchedulerMessageWakeReason } from "./scheduler-message-wake-reason"
import {
  MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE,
  MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE,
  MissionSchedulerWakeHistoricalAuthority,
} from "./mission-scheduler-wake-authority"

/**
 * Whether the persisted wake Message is the one this scheduler delivery owns.
 *
 * Decoded through the scheduler Message branch composed into the broader
 * Session wake schema. The hand-written type assertion
 * this replaced named `source`/`eventID`/`inboxID` itself, so renaming a field
 * on the `scheduler.message` branch would have compiled here and quietly
 * matched nothing — and this predicate gates delivery settlement, so a silent
 * `false` surfaces as `SchedulerMessageConflictError` on every lawful
 * settlement rather than as the rename it actually was.
 */
export function schedulerWakeMessageMatchesInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; messageID: string; eventID: string; inboxID: string },
): boolean {
  const message = db
    .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
    .from(MessageTable)
    .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
    .get()
  if (!message) return false
  // `data` never carries the row's own identity: `upsertMessageRow` splits `id`
  // and `sessionID` out into their SQL columns before writing the JSON. Decoding
  // the column alone therefore fails on every persisted row, so the identity has
  // to be put back the same way every other Message decode site does it.
  const info = Message.User.safeParse({ ...message.data, id: message.id, sessionID: message.sessionID })
  if (!info.success) return false
  const reason = SchedulerMessageWakeReason.safeParse(info.data.extra?.wake_reason)
  if (!reason.success) return false
  return reason.data.eventID === input.eventID && reason.data.inboxID === input.inboxID
}

export type SchedulerMissionWakeDisposition =
  | { kind: "answered"; integrityBoundaryEventID?: string }
  | { kind: "mission_closed"; closureEventID: string }
  | { kind: "unanswered" }
  | { kind: "integrity_boundary"; boundaryEventID: string; reason: string }
  | { kind: "invalid_binding"; reason: string }

function schedulerWakeReasonInTransaction(db: Database.TxOrDb, input: { sessionID: string; messageID: string }) {
  const message = db
    .select({
      id: MessageTable.id,
      sessionID: MessageTable.session_id,
      timeCreated: MessageTable.time_created,
      data: MessageTable.data,
    })
    .from(MessageTable)
    .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
    .get()
  if (!message) return undefined
  const info = Message.User.safeParse({ ...message.data, id: message.id, sessionID: message.sessionID })
  if (!info.success) return undefined
  const reason = SchedulerMessageWakeReason.safeParse(info.data.extra?.wake_reason)
  return reason.success ? { reason: reason.data, timeCreated: message.timeCreated } : undefined
}

/**
 * Reduce a materialized Mission scheduler wake from its immutable Message
 * binding and Mission closure history. The inbox keeps its one `session_wake`
 * terminal receipt; this reducer is the only business-level closure view.
 */
export function schedulerMissionWakeDispositionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; messageID: string; eventID: string; inboxID: string },
): SchedulerMissionWakeDisposition {
  const wakeMessage = schedulerWakeReasonInTransaction(db, input)
  const reason = wakeMessage?.reason
  if (
    !reason ||
    reason.eventID !== input.eventID ||
    reason.inboxID !== input.inboxID ||
    reason.targetEndpoint.kind !== "mission_scheduler" ||
    reason.targetEndpoint.session_id !== input.sessionID
  ) {
    return {
      kind: "invalid_binding",
      reason: "wake Message does not name its exact scheduler inbox and Mission Session",
    }
  }
  const terminalReceipts = db
    .select()
    .from(ProtocolDeliveryReceiptTable)
    .where(
      and(
        eq(ProtocolDeliveryReceiptTable.inbox_id, input.inboxID),
        sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') = 'session_wake'`,
      ),
    )
    .all()
  if (
    terminalReceipts.length !== 1 ||
    terminalReceipts[0]?.receipt.kind !== "session_wake" ||
    terminalReceipts[0].receipt.message_id !== input.messageID
  ) {
    return { kind: "invalid_binding", reason: "wake Message does not own one exact session_wake receipt" }
  }
  const terminalReceipt = terminalReceipts[0]
  const authorities = db
    .select()
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, input.sessionID),
        eq(ProtocolEventTable.correlation_id, input.inboxID),
        sql`${ProtocolEventTable.type} IN (${MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE},${MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE})`,
      ),
    )
    .all()
  if (authorities.length > 1) {
    return { kind: "invalid_binding", reason: "wake Message has multiple historical occurrence authorities" }
  }
  const authorityEvent = authorities[0]
  if (reason.missionOccurrence && authorityEvent) {
    return { kind: "invalid_binding", reason: "wake Message has both inline and historical occurrence authorities" }
  }
  let occurrence = reason.missionOccurrence
  let historicalClosureEventID: string | undefined
  let historicalAuthority:
    | { openedEventID: string; openedOperationID: string; historicalClosureEventID?: string }
    | undefined
  let integrityBoundary: { eventID: string; reason: string } | undefined
  if (authorityEvent) {
    const authority = MissionSchedulerWakeHistoricalAuthority.safeParse({
      type: authorityEvent.type,
      payload: authorityEvent.payload,
    })
    if (
      !authority.success ||
      authorityEvent.source !== "storage.mission-scheduler-wake-migration" ||
      authorityEvent.causation_id !== input.eventID ||
      authority.data.payload.inboxID !== input.inboxID ||
      authority.data.payload.messageID !== input.messageID ||
      authority.data.payload.schedulerEventID !== input.eventID
    ) {
      return { kind: "invalid_binding", reason: "historical wake occurrence authority has an invalid envelope" }
    }
    if (authority.data.type === MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE) {
      integrityBoundary = { eventID: authorityEvent.id, reason: authority.data.payload.reason }
    } else {
      occurrence = {
        openedEventID: authority.data.payload.openedEventID,
        openedOperationID: authority.data.payload.openedOperationID,
      }
      historicalClosureEventID = authority.data.payload.historicalClosureEventID
      historicalAuthority = authority.data.payload
    }
  }
  if (!reason.missionOccurrence && !authorityEvent) {
    return { kind: "invalid_binding", reason: "wake Message has no inline or historical occurrence authority" }
  }
  const answered = successfulSchedulerWakeReplyExistsInTransaction(db, input)
  if (integrityBoundary) {
    if (answered) return { kind: "answered", integrityBoundaryEventID: integrityBoundary.eventID }
    return { kind: "integrity_boundary", boundaryEventID: integrityBoundary.eventID, reason: integrityBoundary.reason }
  }
  if (answered) return { kind: "answered" }
  if (!occurrence) return { kind: "invalid_binding", reason: "wake occurrence authority is incomplete" }
  const closureTypes = [
    "mission.execution.opened",
    "mission.execution.closing",
    "mission.execution.closed",
  ]
  const events = db
    .select()
    .from(ProtocolEventTable)
    .where(and(eq(ProtocolEventTable.aggregate_type, "session"), eq(ProtocolEventTable.aggregate_id, input.sessionID)))
    .all()
    .filter((event) => closureTypes.includes(event.type))
    .toSorted((left, right) => left.seq - right.seq || left.id.localeCompare(right.id))
  if (historicalAuthority) {
    const openedEvent = events.find(
      (event) =>
        event.type === "mission.execution.opened" &&
        event.id === historicalAuthority.openedEventID &&
        event.correlation_id === historicalAuthority.openedOperationID,
    )
    if (
      !openedEvent ||
      !wakeMessage ||
      openedEvent.emitted_at >= wakeMessage.timeCreated ||
      terminalReceipt.time_created < wakeMessage.timeCreated
    ) {
      return { kind: "invalid_binding", reason: "historical wake authority has an invalid persisted wake order" }
    }
    if (historicalClosureEventID) {
      const closure = events.find((event) => event.id === historicalClosureEventID)
      if (
        !closure ||
        (closure.type !== "mission.execution.closing" && closure.type !== "mission.execution.closed") ||
        closure.seq <= openedEvent.seq ||
        closure.emitted_at <= terminalReceipt.time_created
      ) {
        return { kind: "invalid_binding", reason: "historical wake authority has an invalid closure order" }
      }
    }
  }
  const closing = events.find((event) => {
    if (event.type !== "mission.execution.closing" && event.type !== "mission.execution.closed") return false
    const payload = event.payload as {
      openedOccurrence?: { eventID?: unknown; operationID?: unknown }
    } | null
    return (
      payload?.openedOccurrence?.eventID === occurrence.openedEventID &&
      payload.openedOccurrence.operationID === occurrence.openedOperationID
    )
  })
  if (closing) return { kind: "mission_closed", closureEventID: closing.id }
  if (historicalClosureEventID) {
    const historicalClosure = events.find(
      (event) =>
        event.id === historicalClosureEventID &&
        (event.type === "mission.execution.closing" || event.type === "mission.execution.closed"),
    )
    if (!historicalClosure) {
      return { kind: "invalid_binding", reason: "historical wake authority names a missing Mission closure" }
    }
    return { kind: "mission_closed", closureEventID: historicalClosure.id }
  }
  const current = events.at(-1)
  if (
    current?.type === "mission.execution.opened" &&
    current.id === occurrence.openedEventID &&
    current.correlation_id === occurrence.openedOperationID
  )
    return { kind: "unanswered" }
  return {
    kind: "invalid_binding",
    reason: "wake Message occurrence is neither the current opened Mission occurrence nor bound to an exact closure",
  }
}

export function successfulSchedulerWakeReplyExistsInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; messageID: string },
): boolean {
  return Boolean(
    db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, input.sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.parentID') = ${input.messageID}`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL`,
          sql`json_extract(${MessageTable.data}, '$.error') IS NULL`,
        ),
      )
      .get(),
  )
}
