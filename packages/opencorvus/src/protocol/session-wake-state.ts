import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { and, eq, sql, type Database } from "@/storage/db"

/**
 * Whether the persisted wake Message is the one this scheduler delivery owns.
 *
 * Decoded through `SessionWake.WakeReason`, the same schema `event-service.ts`
 * and `automation-service.ts` read it with. The hand-written type assertion
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
    .select({ id: MessageTable.id, data: MessageTable.data })
    .from(MessageTable)
    .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
    .get()
  if (!message) return false
  const info = Message.User.safeParse(message.data)
  if (!info.success) return false
  const reason = SessionWake.WakeReason.safeParse(info.data.extra?.wake_reason)
  if (!reason.success || reason.data.source !== "scheduler.message") return false
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
