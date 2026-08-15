import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import { Database, and, asc, eq } from "@/storage/db"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "./protocol.sql"
import { ProtocolDeliveryReceipt, type ProtocolInboxDeliveryResult, type ProtocolInboxStatus } from "./schema"

export type ProtocolDeliveryRow = typeof ProtocolInboxTable.$inferSelect & {
  status: ProtocolInboxStatus
  lease_owner: string | null
  lease_until: number | null
  attempt: number
  last_error: string | null
  delivery_result: ProtocolInboxDeliveryResult | null
  time_completed: number | null
  time_updated: number
}

export function projectProtocolDeliveryInTransaction(db: Database.TxOrDb, row: typeof ProtocolInboxTable.$inferSelect, now = Date.now()): ProtocolDeliveryRow {
  const receipts = db.select().from(ProtocolDeliveryReceiptTable).where(eq(ProtocolDeliveryReceiptTable.inbox_id, row.id))
    .orderBy(asc(ProtocolDeliveryReceiptTable.time_created), asc(ProtocolDeliveryReceiptTable.id)).all()
  const latest = receipts.at(-1)
  const latestReceipt = latest ? ProtocolDeliveryReceipt.parse(latest.receipt) : undefined
  const leases = db.select().from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, "protocol_delivery"), eq(EngineControlActivationLeaseTable.target_id, row.id)))
    .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id)).all()
  const lease = currentControlLeaseInTransaction(db, "protocol_delivery", row.id)
  const status: ProtocolInboxStatus = latestReceipt?.kind === "dead_letter" ? "dead_letter" : latestReceipt && latestReceipt.kind !== "retry_wait" ? "delivered" : lease && lease.expires_at > now ? "leased" : "pending"
  const terminal = status === "delivered" || status === "dead_letter"
  return {
    ...row,
    visible_at: latestReceipt?.kind === "retry_wait" ? latestReceipt.visible_at : row.visible_at,
    status,
    lease_owner: lease?.owner_occurrence_id ?? null,
    lease_until: lease?.expires_at ?? null,
    attempt: leases.length,
    last_error: latestReceipt?.kind === "retry_wait" ? latestReceipt.error : latestReceipt?.kind === "dead_letter" ? latestReceipt.message : null,
    delivery_result: ([...receipts].reverse().map((receipt) => ProtocolDeliveryReceipt.parse(receipt.receipt)).find((receipt) => receipt.kind !== "retry_wait") as ProtocolInboxDeliveryResult | undefined) ?? null,
    time_completed: terminal ? (latest?.time_created ?? null) : null,
    time_updated: latest?.time_created ?? lease?.time_activated ?? row.time_created,
  }
}
