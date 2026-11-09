import type { SQLWrapper } from "drizzle-orm"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { and, eq, sql, type Database } from "@/storage/db"

function sessionDeletionCondition(sessionID: string | SQLWrapper) {
  return and(
    eq(ProtocolEventTable.aggregate_type, "session"),
    sql`${ProtocolEventTable.aggregate_id} = ${sessionID}`,
    eq(ProtocolEventTable.type, "session.deleted"),
  )
}

export function sessionDeletionEventIDInTransaction(db: Database.TxOrDb, sessionID: string) {
  return db.select({ id: ProtocolEventTable.id }).from(ProtocolEventTable)
    .where(sessionDeletionCondition(sessionID)).get()?.id
}

export function sessionDeletedInTransaction(db: Database.TxOrDb, sessionID: string): boolean {
  return sessionDeletionEventIDInTransaction(db, sessionID) !== undefined
}

/** Apply before sorting or limiting an ordinary Session projection. */
export function sessionNotDeletedSql(sessionID: SQLWrapper) {
  return sql`NOT EXISTS (SELECT 1 FROM ${ProtocolEventTable} WHERE ${sessionDeletionCondition(sessionID)})`
}
