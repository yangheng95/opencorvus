import { Database as SQLite } from "bun:sqlite"
import { Identifier } from "@/id/id"
import {
  MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE,
  MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE,
  MissionSchedulerWakeHistoricalAuthority,
  MissionSchedulerWakeExactAuthority,
  MissionSchedulerWakeUnavailableAuthority,
} from "@/protocol/mission-scheduler-wake-authority"

type RawDatabase = SQLite

function rows<T>(db: RawDatabase, sql: string): T[] {
  const statement = db.query(sql)
  try {
    return statement.all() as T[]
  } finally {
    statement.finalize()
  }
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function tableExists(db: RawDatabase, name: string): boolean {
  return Boolean(rows(db, `SELECT name FROM sqlite_schema WHERE type='table' AND name=${literal(name)}`)[0])
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Append one immutable authority for every pre-occurrence-fence Mission
 * scheduler wake. The original Message and its sole terminal receipt remain
 * unchanged. Attribution is exact only when the durable history contains one
 * opened occurrence, the opened fact predates the Message/receipt and every
 * attached historical closure follows that wake. Every other topology is
 * terminalized as a recipient-local integrity boundary rather than guessed.
 */
export function migrateMissionSchedulerWakeOccurrenceAuthorities(sqlite: RawDatabase): number {
  if (
    !tableExists(sqlite, "protocol_event") ||
    !tableExists(sqlite, "protocol_inbox") ||
    !tableExists(sqlite, "protocol_delivery_receipt") ||
    !tableExists(sqlite, "message")
  )
    return 0
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    let appended = 0
    const wakes = rows<{
      inbox_id: string
      event_id: string
      session_id: string
      message_id: string
      message_session_id: string
      message_time_created: number
      message_data: string
      receipt_time_created: number
    }>(sqlite, `
      SELECT
        inbox.id AS inbox_id,
        event.id AS event_id,
        inbox.actor_id AS session_id,
        json_extract(receipt.receipt,'$.message_id') AS message_id,
        message.session_id AS message_session_id,
        message.time_created AS message_time_created,
        message.data AS message_data,
        receipt.time_created AS receipt_time_created
      FROM protocol_inbox AS inbox
      JOIN protocol_event AS event ON event.id=inbox.envelope_id
      JOIN protocol_delivery_receipt AS receipt ON receipt.inbox_id=inbox.id
      JOIN message ON message.id=json_extract(receipt.receipt,'$.message_id')
      WHERE inbox.actor='session'
        AND event.type='scheduler.message'
        AND json_extract(receipt.receipt,'$.kind')='session_wake'
      ORDER BY inbox.actor_id,event.seq,event.id,inbox.id
    `)
    for (const wake of wakes) {
      let messageData: Record<string, unknown>
      try {
        messageData = JSON.parse(wake.message_data) as Record<string, unknown>
      } catch {
        throw new Error(`Historical Mission scheduler wake ${wake.inbox_id} has invalid Message JSON`)
      }
      const extra = messageData.extra as Record<string, unknown> | undefined
      const reason = extra?.wake_reason as Record<string, unknown> | undefined
      const target = reason?.targetEndpoint as Record<string, unknown> | undefined
      if (
        reason?.source !== "scheduler.message" ||
        reason.eventID !== wake.event_id ||
        reason.inboxID !== wake.inbox_id ||
        target?.kind !== "mission_scheduler" ||
        target.session_id !== wake.session_id ||
        wake.message_session_id !== wake.session_id
      ) {
        throw new Error(`Historical Mission scheduler wake ${wake.inbox_id} has an invalid immutable binding`)
      }
      if (reason.missionOccurrence !== undefined) continue

      const id = Identifier.deterministic("protocol_event", `mission-scheduler-wake-authority\0${wake.inbox_id}`)
      const existing = rows<{
        type: string
        aggregate_id: string
        source: string
        causation_id: string | null
        correlation_id: string | null
        payload: string
      }>(
        sqlite,
        `SELECT type,aggregate_id,source,causation_id,correlation_id,payload FROM protocol_event WHERE id=${literal(id)}`,
      )[0]
      if (existing) {
        let parsedPayload: unknown
        try {
          parsedPayload = JSON.parse(existing.payload)
        } catch {
          throw new Error(`Mission scheduler wake authority ${id} has invalid JSON`)
        }
        const authority = MissionSchedulerWakeHistoricalAuthority.safeParse({
          type: existing.type,
          payload: parsedPayload,
        })
        if (
          !authority.success ||
          existing.aggregate_id !== wake.session_id ||
          existing.source !== "storage.mission-scheduler-wake-migration" ||
          existing.causation_id !== wake.event_id ||
          existing.correlation_id !== wake.inbox_id ||
          authority.data.payload.inboxID !== wake.inbox_id ||
          authority.data.payload.messageID !== wake.message_id ||
          authority.data.payload.schedulerEventID !== wake.event_id
        ) {
          throw new Error(`Mission scheduler wake authority ${id} conflicts with inbox ${wake.inbox_id}`)
        }
        if (authority.data.type === MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE) {
          const opened = rows<{ id: string; seq: number; emitted_at: number }>(sqlite, `
            SELECT id,seq,emitted_at FROM protocol_event
            WHERE id=${literal(authority.data.payload.openedEventID)}
              AND type='mission.execution.opened'
              AND aggregate_type='session'
              AND aggregate_id=${literal(wake.session_id)}
              AND correlation_id=${literal(authority.data.payload.openedOperationID)}
          `)[0]
          if (!opened) throw new Error(`Mission scheduler wake authority ${id} lost its exact opened occurrence`)
          if (
            opened.emitted_at >= wake.message_time_created ||
            wake.receipt_time_created < wake.message_time_created
          ) {
            throw new Error(`Mission scheduler wake authority ${id} has an invalid persisted wake order`)
          }
          if (authority.data.payload.historicalClosureEventID) {
            const closure = rows<{ id: string; seq: number; emitted_at: number }>(sqlite, `
              SELECT id,seq,emitted_at FROM protocol_event
              WHERE id=${literal(authority.data.payload.historicalClosureEventID)}
                AND type IN ('mission.execution.closing','mission.execution.closed')
                AND aggregate_type='session'
                AND aggregate_id=${literal(wake.session_id)}
            `)[0]
            if (!closure) throw new Error(`Mission scheduler wake authority ${id} lost its historical closure`)
            if (closure.seq <= opened.seq || closure.emitted_at <= wake.receipt_time_created) {
              throw new Error(`Mission scheduler wake authority ${id} has an invalid historical closure order`)
            }
          }
        }
        continue
      }

      const opened = rows<{
        id: string
        correlation_id: string | null
        seq: number
        emitted_at: number
      }>(sqlite, `
        SELECT id,correlation_id,seq,emitted_at
        FROM protocol_event
        WHERE aggregate_type='session'
          AND aggregate_id=${literal(wake.session_id)}
          AND type='mission.execution.opened'
        ORDER BY seq,id
      `)
      let type: string
      let payload: Record<string, unknown>
      if (opened.length === 1 && opened[0]) {
        const occurrence = opened[0]
        if (!occurrence.correlation_id || !UUID.test(occurrence.correlation_id)) {
          type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
          payload = MissionSchedulerWakeUnavailableAuthority.parse({
            version: 1,
            inboxID: wake.inbox_id,
            messageID: wake.message_id,
            schedulerEventID: wake.event_id,
            reason: "invalid_opened_occurrence_identity",
          })
        } else if (occurrence.emitted_at >= wake.message_time_created) {
          type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
          payload = MissionSchedulerWakeUnavailableAuthority.parse({
            version: 1,
            inboxID: wake.inbox_id,
            messageID: wake.message_id,
            schedulerEventID: wake.event_id,
            reason: "opened_occurrence_not_before_message",
          })
        } else if (wake.receipt_time_created < wake.message_time_created) {
          type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
          payload = MissionSchedulerWakeUnavailableAuthority.parse({
            version: 1,
            inboxID: wake.inbox_id,
            messageID: wake.message_id,
            schedulerEventID: wake.event_id,
            reason: "invalid_wake_persistence_order",
          })
        } else {
          const closures = rows<{ id: string; seq: number; emitted_at: number }>(sqlite, `
            SELECT id,seq,emitted_at
            FROM protocol_event
            WHERE aggregate_type='session'
              AND aggregate_id=${literal(wake.session_id)}
              AND type IN ('mission.execution.closing','mission.execution.closed')
            ORDER BY seq DESC,id DESC
          `)
          if (closures.some((closure) => closure.seq < occurrence.seq)) {
            type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
            payload = MissionSchedulerWakeUnavailableAuthority.parse({
              version: 1,
              inboxID: wake.inbox_id,
              messageID: wake.message_id,
              schedulerEventID: wake.event_id,
              reason: "preceding_closure_without_opened_occurrence",
            })
          } else if (
            closures.some(
              (closure) => closure.seq <= occurrence.seq || closure.emitted_at <= wake.receipt_time_created,
            )
          ) {
            type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
            payload = MissionSchedulerWakeUnavailableAuthority.parse({
              version: 1,
              inboxID: wake.inbox_id,
              messageID: wake.message_id,
              schedulerEventID: wake.event_id,
              reason: "closure_not_after_wake",
            })
          } else {
            const historicalClosure = closures[0]
            type = MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE
            payload = MissionSchedulerWakeExactAuthority.parse({
              version: 1,
              inboxID: wake.inbox_id,
              messageID: wake.message_id,
              schedulerEventID: wake.event_id,
              openedEventID: occurrence.id,
              openedOperationID: occurrence.correlation_id,
              ...(historicalClosure ? { historicalClosureEventID: historicalClosure.id } : {}),
            })
          }
        }
      } else {
        type = MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE
        payload = MissionSchedulerWakeUnavailableAuthority.parse({
          version: 1,
          inboxID: wake.inbox_id,
          messageID: wake.message_id,
          schedulerEventID: wake.event_id,
          reason: opened.length === 0 ? "no_opened_occurrence" : "multiple_opened_occurrences",
        })
      }

      const authorityPayload = JSON.stringify(payload)
      const seq =
        rows<{ seq: number }>(
          sqlite,
          `SELECT coalesce(max(seq),0)+1 AS seq FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=${literal(wake.session_id)}`,
        )[0]?.seq ?? 1
      const insert = sqlite.query(`
          INSERT INTO protocol_event(
            id,kind,type,aggregate_type,aggregate_id,task_id,session_id,source,
            causation_id,correlation_id,seq,emitted_at,payload
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `)
      try {
        insert.run(
          id,
          "event",
          type,
          "session",
          wake.session_id,
          null,
          null,
          "storage.mission-scheduler-wake-migration",
          wake.event_id,
          wake.inbox_id,
          seq,
          wake.receipt_time_created,
          authorityPayload,
        )
      } finally {
        insert.finalize()
      }
      appended += 1
    }
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS protocol_event_mission_scheduler_wake_authority_idx
      ON protocol_event(correlation_id)
      WHERE type IN (
        'scheduler.message.mission_occurrence_binding.historical',
        'scheduler.message.mission_occurrence_binding.unavailable'
      );
    `)
    sqlite.exec("COMMIT")
    return appended
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }
}
