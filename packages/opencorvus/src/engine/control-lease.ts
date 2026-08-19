import { Identifier } from "@/id/id"
import { Database, and, desc, eq, gt } from "@/storage/db"
import { EngineControlActivationLeaseTable, type EngineControlActivationTarget } from "./engine.sql"

export type ControlLease = typeof EngineControlActivationLeaseTable.$inferSelect

export function currentControlLeaseInTransaction(
  db: Database.TxOrDb,
  target: EngineControlActivationTarget,
  targetID: string,
): ControlLease | undefined {
  return db.select().from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, target), eq(EngineControlActivationLeaseTable.target_id, targetID)))
    .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id)).get()
}

export function acquireControlLease(input: {
  target: EngineControlActivationTarget
  targetID: string
  ownerOccurrenceID: string
  now: number
  leaseMilliseconds: number
  /** An immutable receipt may consume a still-unexpired physical lease. */
  supersedeLeaseID?: string
}): { acquired: true; lease: ControlLease } | { acquired: false; lease: ControlLease } {
  if (input.leaseMilliseconds <= 0) throw new Error("Control lease duration must be positive")
  return Database.immediateTransaction((db) => {
    const current = currentControlLeaseInTransaction(db, input.target, input.targetID)
    if (
      current &&
      current.expires_at > input.now &&
      current.id !== input.supersedeLeaseID
    ) return { acquired: false as const, lease: current }
    const lease = {
      id: Identifier.ascending("call"),
      target: input.target,
      target_id: input.targetID,
      owner_occurrence_id: input.ownerOccurrenceID,
      time_activated: input.now,
      expires_at: input.now + input.leaseMilliseconds,
    }
    db.insert(EngineControlActivationLeaseTable).values(lease).run()
    return { acquired: true as const, lease }
  })
}

export function assertControlLeaseInTransaction(db: Database.TxOrDb, input: {
  target: EngineControlActivationTarget
  targetID: string
  leaseID: string
  ownerOccurrenceID: string
  now: number
}): ControlLease {
  const current = currentControlLeaseInTransaction(db, input.target, input.targetID)
  if (!current || current.id !== input.leaseID || current.owner_occurrence_id !== input.ownerOccurrenceID || current.expires_at <= input.now) {
    throw new Error(`Control lease fence rejected ${input.target}/${input.targetID}/${input.leaseID}`)
  }
  return current
}

/**
 * End one lease early, so the next claim waits on the retry's own schedule.
 *
 * Leases otherwise only end by expiry, which silently becomes the retry
 * period: a caller that records "try again in 500ms" and keeps holding a
 * two-minute lease is not retried in 500ms, it is retried in two minutes.
 * Expiring in place rather than deleting keeps the attempt history that
 * `projectProtocolDeliveryInTransaction` counts.
 */
export function releaseControlLease(input: {
  target: EngineControlActivationTarget
  targetID: string
  ownerOccurrenceID: string
  now: number
}): boolean {
  return Database.immediateTransaction((db) => {
    const current = currentControlLeaseInTransaction(db, input.target, input.targetID)
    if (!current || current.owner_occurrence_id !== input.ownerOccurrenceID || current.expires_at <= input.now) {
      return false
    }
    db.update(EngineControlActivationLeaseTable)
      .set({ expires_at: input.now })
      .where(eq(EngineControlActivationLeaseTable.id, current.id))
      .run()
    return true
  })
}

export function renewControlLease(input: {
  target: EngineControlActivationTarget
  targetID: string
  leaseID: string
  ownerOccurrenceID: string
  now: number
  expiresAt: number
}): void {
  if (input.expiresAt <= input.now) throw new Error("Control lease renewal must extend into the future")
  Database.immediateTransaction((db) => {
    const current = assertControlLeaseInTransaction(db, input)
    const updated = db.update(EngineControlActivationLeaseTable).set({ expires_at: input.expiresAt })
      .where(and(eq(EngineControlActivationLeaseTable.id, input.leaseID), eq(EngineControlActivationLeaseTable.expires_at, current.expires_at), gt(EngineControlActivationLeaseTable.expires_at, input.now)))
      .returning({ id: EngineControlActivationLeaseTable.id }).get()
    if (!updated) throw new Error(`Control lease renewal lost fence ${input.leaseID}`)
  })
}
