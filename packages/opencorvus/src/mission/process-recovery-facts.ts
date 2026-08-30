import { Message } from "@/session/message"
import {
  MissionProcessRecoveryWakeReason,
  type MissionProcessRecoveryWakeReason as MissionProcessRecoveryReason,
} from "@/session/mission-process-recovery-schema"
import { MessageTable } from "@/session/session.sql"
import { Database, and, desc, eq, inArray, sql } from "@/storage/db"

export type { MissionProcessRecoveryReason }

export type PersistedMissionProcessRecoveryWake = {
  messageID: string
  reason: MissionProcessRecoveryReason
}

export function readIncompleteMissionAssistantMessageIDs(
  sessionID: string,
  messageIDs: readonly string[],
): string[] {
  if (messageIDs.length === 0) return []
  return Database.use((db) =>
    db
      .select({ id: MessageTable.id })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          inArray(MessageTable.id, [...messageIDs]),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NULL`,
        ),
      )
      .all()
      .map((row) => row.id)
      .toSorted(),
  )
}

export function readActionableMissionProcessRecoveryWake(input: {
  sessionID: string
  missionID: string
  openedEventID: string
}): PersistedMissionProcessRecoveryWake | undefined {
  const rows = Database.use((db) =>
    db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, input.sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'user'`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source') = 'mission.process_recovery'`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.version') = 3`,
          sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.openedEventID') = ${input.openedEventID}`,
          sql`NOT EXISTS (
            SELECT 1 FROM message AS terminal_recovery_reply
            WHERE terminal_recovery_reply.session_id = ${input.sessionID}
              AND json_extract(terminal_recovery_reply.data, '$.role') = 'assistant'
              AND json_extract(terminal_recovery_reply.data, '$.parentID') = ${MessageTable.id}
              AND json_extract(terminal_recovery_reply.data, '$.time.completed') IS NOT NULL
              AND NOT (
                json_extract(terminal_recovery_reply.data, '$.finish') = 'error'
                AND json_extract(terminal_recovery_reply.data, '$.error.name') = 'ProcessExecutionInterruptedError'
                AND json_type(terminal_recovery_reply.data, '$.error') = 'object'
                AND (SELECT COUNT(*) FROM json_each(json_extract(terminal_recovery_reply.data, '$.error'))) = 2
                AND json_type(terminal_recovery_reply.data, '$.error.data') = 'object'
                AND (SELECT COUNT(*) FROM json_each(json_extract(terminal_recovery_reply.data, '$.error.data'))) = 1
                AND json_type(terminal_recovery_reply.data, '$.error.data.message') = 'text'
                AND length(json_extract(terminal_recovery_reply.data, '$.error.data.message')) > 0
              )
          )`,
        ),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .limit(2)
      .all(),
  )
  if (rows.length > 1) {
    throw new Error(
      `Mission ${input.missionID} opened event ${input.openedEventID} has multiple actionable recovery Messages`,
    )
  }
  const row = rows[0]
  if (!row) return undefined
  const info = Message.User.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
  const parsed = MissionProcessRecoveryWakeReason.safeParse(info.extra?.wake_reason)
  if (
    !parsed.success ||
    parsed.data.source !== "mission.process_recovery" ||
    parsed.data.missionID !== input.missionID ||
    parsed.data.openedEventID !== input.openedEventID
  ) {
    throw new Error(`Mission recovery Message ${row.id} does not match its strict durable reason`)
  }
  return { messageID: row.id, reason: parsed.data }
}
