/**
 * Durable liveness for runtime processes.
 *
 * Recovery decides that work is abandoned and settles it as an infrastructure
 * failure. That decision is destructive, so it must rest on evidence every
 * participant can read. Process-local registries cannot supply it: a second
 * backend sharing the same database sees an empty map for *every* dispatch the
 * first backend owns, and would terminalize live workers on each sweep.
 *
 * Each process therefore renews one lease row keyed by its own occurrence, and
 * "that owner is gone" means "its lease expired" — the same physical ownership
 * coordinate the rest of the control plane already uses. The lease grants no
 * authority over any Task; it only answers whether its holder still exists.
 */
import { Identifier } from "@/id/id"
import { Database, and, desc, eq } from "@/storage/db"
import { EngineControlActivationLeaseTable } from "./engine.sql"

/** Generous relative to the renewal period: a process pausing for GC or a slow
 * disk must not be declared dead, because the cost of a false positive is a
 * killed live worker. */
export const PROCESS_LIVENESS_LEASE_MS = 90_000
export const PROCESS_LIVENESS_RENEWAL_MS = 30_000

function latestLeaseInTransaction(db: Database.TxOrDb, occurrenceID: string) {
  return db
    .select()
    .from(EngineControlActivationLeaseTable)
    .where(
      and(
        eq(EngineControlActivationLeaseTable.target, "runtime_process"),
        eq(EngineControlActivationLeaseTable.target_id, occurrenceID),
      ),
    )
    .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id))
    .get()
}

/** Insert or renew this process's liveness lease in the current project. */
export function assertProcessLivenessLease(occurrenceID: string, now = Date.now()): void {
  Database.immediateTransaction((db) => {
    const existing = latestLeaseInTransaction(db, occurrenceID)
    const expiresAt = now + PROCESS_LIVENESS_LEASE_MS
    if (existing) {
      db.update(EngineControlActivationLeaseTable)
        .set({ expires_at: expiresAt })
        .where(eq(EngineControlActivationLeaseTable.id, existing.id))
        .run()
      return
    }
    db.insert(EngineControlActivationLeaseTable)
      .values({
        id: Identifier.ascending("activity"),
        target: "runtime_process",
        target_id: occurrenceID,
        owner_occurrence_id: occurrenceID,
        time_activated: now,
        expires_at: expiresAt,
      })
      .run()
  })
}

/** Whether the process that claimed `occurrenceID` still holds a live lease. */
export function isProcessOccurrenceLive(db: Database.TxOrDb, occurrenceID: string, now: number): boolean {
  const lease = latestLeaseInTransaction(db, occurrenceID)
  return Boolean(lease && lease.expires_at > now)
}

/** Expire this process's lease on a graceful shutdown so peers can recover its
 * work immediately instead of waiting out the full lease. */
export function expireProcessLivenessLease(occurrenceID: string, now = Date.now()): void {
  Database.immediateTransaction((db) => {
    const existing = latestLeaseInTransaction(db, occurrenceID)
    if (!existing || existing.expires_at <= now) return
    db.update(EngineControlActivationLeaseTable)
      .set({ expires_at: now })
      .where(eq(EngineControlActivationLeaseTable.id, existing.id))
      .run()
  })
}
