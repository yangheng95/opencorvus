import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { and, eq, sql, type Database } from "@/storage/db"
import { SchedulerMessageWakeReason } from "./scheduler-message-wake-reason"

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

export function completedSchedulerWakeReplyExistsInTransaction(
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
        ),
      )
      .get(),
  )
}
