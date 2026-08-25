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

export type ControlLeaseAcquisition =
  | { acquired: true; lease: ControlLease }
  | { acquired: false; lease: ControlLease }

export interface AcquireControlLeaseInput {
  target: EngineControlActivationTarget
  targetID: string
  ownerOccurrenceID: string
  now: number
  leaseMilliseconds: number
  /** An immutable receipt may consume a still-unexpired physical lease. */
  supersedeLeaseID?: string
}

/**
 * Take the fire owner inside the caller's transaction.
 *
 * A caller that must also validate what it is claiming — the exact definition
 * revision, an active status, a due time — has to do that validation and this
 * acquisition under one write lock. Acquiring in a separate transaction leaves
 * a window in which the validated fact changes after the lease exists, and the
 * caller then abandons a live lease that no fire owner holds.
 */
export function acquireControlLeaseInTransaction(
  db: Database.TxOrDb,
  input: AcquireControlLeaseInput,
): ControlLeaseAcquisition {
  if (input.leaseMilliseconds <= 0) throw new Error("Control lease duration must be positive")
  const current = currentControlLeaseInTransaction(db, input.target, input.targetID)
  if (current && current.expires_at > input.now && current.id !== input.supersedeLeaseID) {
    return { acquired: false as const, lease: current }
  }
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
}

export function acquireControlLease(input: AcquireControlLeaseInput): ControlLeaseAcquisition {
  return Database.immediateTransaction((db) => acquireControlLeaseInTransaction(db, input))
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

export interface ReleaseControlLeaseInput {
  target: EngineControlActivationTarget
  targetID: string
  /** The exact lease being ended. Owner identity alone is not an identity. */
  leaseID: string
  ownerOccurrenceID: string
  now: number
}

/**
 * End one lease early, inside the transaction that records why it ended.
 *
 * Leases otherwise only end by expiry, which silently becomes the retry
 * period: a caller that records "try again in 500ms" and keeps holding a
 * two-minute lease is not retried in 500ms, it is retried in two minutes. A
 * completed fire that keeps its lease likewise blocks update, delete and
 * manual rerun until expiry. Settlement state and lease state are therefore
 * one fact and must commit together. Expiring in place rather than deleting
 * keeps the attempt history that `projectProtocolDeliveryInTransaction`
 * counts.
 */
export function releaseControlLeaseInTransaction(db: Database.TxOrDb, input: ReleaseControlLeaseInput): boolean {
  const current = currentControlLeaseInTransaction(db, input.target, input.targetID)
  if (
    !current ||
    current.id !== input.leaseID ||
    current.owner_occurrence_id !== input.ownerOccurrenceID ||
    current.expires_at <= input.now
  ) {
    return false
  }
  db.update(EngineControlActivationLeaseTable)
    .set({ expires_at: input.now })
    .where(eq(EngineControlActivationLeaseTable.id, current.id))
    .run()
  return true
}

export function releaseControlLease(input: ReleaseControlLeaseInput): boolean {
  return Database.immediateTransaction((db) => releaseControlLeaseInTransaction(db, input))
}

/**
 * Hand the lease back while an error is already being raised.
 *
 * Releasing is a database write, and a write can fail — on shutdown, or under
 * contention. On an error path the caller is carrying the real failure, and
 * that failure holds the keys recovery needs; a bookkeeping write must never
 * take its place. The lease then ends by expiry, which is exactly the behavior
 * that existed before it was released here at all.
 */
export function releaseControlLeaseOnErrorPath(
  input: ReleaseControlLeaseInput,
): { released: boolean; error?: unknown } {
  try {
    return { released: releaseControlLease(input) }
  } catch (error) {
    return { released: false, error }
  }
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
