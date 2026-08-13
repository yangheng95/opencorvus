import { MessageTable } from "@/session/session.sql"
import { and, eq, sql, type Database } from "@/storage/db"

export function schedulerWakeMessageMatchesInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; messageID: string; eventID: string; inboxID: string },
): boolean {
  const message = db
    .select({ id: MessageTable.id, data: MessageTable.data })
    .from(MessageTable)
    .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
    .get()
  const messageData = message?.data as
    | { extra?: { wake_reason?: { source?: string; eventID?: string; inboxID?: string } } }
    | undefined
  const reason = messageData?.extra?.wake_reason
  return Boolean(
    message &&
      reason?.source === "scheduler.message" &&
      reason.eventID === input.eventID &&
      reason.inboxID === input.inboxID,
  )
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
