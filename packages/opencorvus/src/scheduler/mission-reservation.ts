import { missionSchedulerOccurrenceBindingInTransaction, missionSchedulerOccurrenceDisposition } from "@/protocol/delivery"
import { SessionTable } from "@/session/session.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Database, and, eq, sql } from "@/storage/db"

export type SchedulerMissionReservation =
  | { kind: "non_mission"; openedEventID: null; disposition: null; closureEventID: null }
  | { kind: "active"; openedEventID: string; disposition: null; closureEventID: null }
  | { kind: "mission_closed"; openedEventID: null; disposition: "mission_closed"; closureEventID: string }

/** Reduce the Mission frontier while the scheduler occurrence holds SQLite's
 * writer reservation. The returned union is persisted with the immutable
 * run/fire, so a terminal target cannot become an unbound nullable row before
 * its receipt is written. */
export function schedulerMissionReservationInTransaction(
  db: Database.TxOrDb,
  sessionID?: string | null,
): SchedulerMissionReservation {
  if (!sessionID) return { kind: "non_mission", openedEventID: null, disposition: null, closureEventID: null }
  const session = db.select({ kind: SessionTable.kind }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
  if (session?.kind !== "mission") {
    return { kind: "non_mission", openedEventID: null, disposition: null, closureEventID: null }
  }
  const openedEventID = missionSchedulerOccurrenceBindingInTransaction(db, sessionID)
  const disposition = missionSchedulerOccurrenceDisposition({ sessionID, openedEventID })
  if (disposition.kind === "active") {
    return { kind: "active", openedEventID: disposition.openedEventID, disposition: null, closureEventID: null }
  }
  return {
    kind: "mission_closed",
    openedEventID: null,
    disposition: "mission_closed",
    closureEventID: disposition.closureEventID,
  }
}

export function assertSchedulerMissionReservationInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  stored: {
    mission_opened_event_id: string | null
    mission_disposition: "mission_closed" | null
    mission_closure_event_id: string | null
  },
): SchedulerMissionReservation {
  const target = db.select({ kind: SessionTable.kind }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
  if (target?.kind !== "mission") {
    if (stored.mission_opened_event_id || stored.mission_disposition || stored.mission_closure_event_id) {
      throw new Error(`Non-Mission Session ${sessionID} carries Mission scheduler reservation authority`)
    }
    return { kind: "non_mission", openedEventID: null, disposition: null, closureEventID: null }
  }
  if (stored.mission_opened_event_id && !stored.mission_disposition && !stored.mission_closure_event_id) {
    const opened = db.select({ id: ProtocolEventTable.id }).from(ProtocolEventTable).where(and(
      eq(ProtocolEventTable.id, stored.mission_opened_event_id),
      eq(ProtocolEventTable.aggregate_type, "session"),
      eq(ProtocolEventTable.aggregate_id, sessionID),
      eq(ProtocolEventTable.type, "mission.execution.opened"),
    )).get()
    if (!opened) throw new Error(`Mission Session ${sessionID} has invalid active scheduler reservation ${stored.mission_opened_event_id}`)
    return { kind: "active", openedEventID: opened.id, disposition: null, closureEventID: null }
  }
  if (!stored.mission_opened_event_id && stored.mission_disposition === "mission_closed" && stored.mission_closure_event_id) {
    const closure = db.select({ id: ProtocolEventTable.id }).from(ProtocolEventTable).where(and(
      eq(ProtocolEventTable.id, stored.mission_closure_event_id),
      eq(ProtocolEventTable.aggregate_type, "session"),
      eq(ProtocolEventTable.aggregate_id, sessionID),
      sql`${ProtocolEventTable.type} IN ('mission.execution.closing','mission.execution.closed')`,
    )).get()
    if (!closure) throw new Error(`Mission Session ${sessionID} has invalid terminal scheduler reservation ${stored.mission_closure_event_id}`)
    return { kind: "mission_closed", openedEventID: null, disposition: "mission_closed", closureEventID: closure.id }
  }
  throw new Error(`Mission Session ${sessionID} has no exact scheduler reservation authority`)
}
