import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { Database, and, desc, eq, gt, inArray } from "@/storage/db"
import { EngineControlActivationLeaseTable, type EngineControlActivationTarget } from "./engine.sql"

const log = Log.create({ service: "control-lease" })

/**
 * The exact lease this caller held is no longer current. Distinct from every
 * transient failure — a busy database, shutdown in progress — because the
 * correct reactions differ: a lost fence ends renewal and defers to the new
 * owner, a transient failure retries.
 */
export class ControlLeaseFenceLostError extends Error {
  override readonly name = "ControlLeaseFenceLostError"
}

export type ControlLease = typeof EngineControlActivationLeaseTable.$inferSelect

export function currentControlLeasesInTransaction(
  db: Database.TxOrDb,
  target: EngineControlActivationTarget,
  targetIDs: readonly string[],
): Map<string, ControlLease> {
  const ids = [...new Set(targetIDs)]
  if (ids.length === 0) return new Map()
  const current = new Map<string, ControlLease>()
  for (const row of db
    .select()
    .from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, target), inArray(EngineControlActivationLeaseTable.target_id, ids)))
    .orderBy(
      EngineControlActivationLeaseTable.target_id,
      desc(EngineControlActivationLeaseTable.time_activated),
      desc(EngineControlActivationLeaseTable.id),
    )
    .all()) {
    if (!current.has(row.target_id)) current.set(row.target_id, row)
  }
  return current
}

export function currentControlLeaseInTransaction(
  db: Database.TxOrDb,
  target: EngineControlActivationTarget,
  targetID: string,
): ControlLease | undefined {
  return currentControlLeasesInTransaction(db, target, [targetID]).get(targetID)
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
  /** Domain occurrences such as Task activations may also be the physical lease identity. */
  leaseID?: string
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
  const leaseID = input.leaseID === undefined ? Identifier.ascending("call") : input.leaseID.trim()
  if (!leaseID) throw new Error("Control lease identity must be non-empty")
  const lease = {
    id: leaseID,
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

export function currentControlLease(target: EngineControlActivationTarget, targetID: string): ControlLease | undefined {
  return Database.use((db) => currentControlLeaseInTransaction(db, target, targetID))
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
    throw new ControlLeaseFenceLostError(`Control lease fence rejected ${input.target}/${input.targetID}/${input.leaseID}`)
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
    // Report here rather than relying on the caller: an error path is exactly
    // where a caller has something more important to do with its control flow,
    // and a handback that silently did not happen is how a lease outlives its
    // owner unnoticed.
    log.warn("control lease could not be handed back on an error path", {
      target: input.target,
      targetID: input.targetID,
      leaseID: input.leaseID,
      error: error instanceof Error ? error.message : String(error),
    })
    return { released: false, error }
  }
}

export interface RenewControlLeaseInput {
  target: EngineControlActivationTarget
  targetID: string
  leaseID: string
  ownerOccurrenceID: string
  now: number
  expiresAt: number
}

export function renewControlLeaseInTransaction(db: Database.TxOrDb, input: RenewControlLeaseInput): void {
  if (input.expiresAt <= input.now) throw new Error("Control lease renewal must extend into the future")
  const current = assertControlLeaseInTransaction(db, input)
  const updated = db.update(EngineControlActivationLeaseTable).set({ expires_at: input.expiresAt })
    .where(and(eq(EngineControlActivationLeaseTable.id, input.leaseID), eq(EngineControlActivationLeaseTable.expires_at, current.expires_at), gt(EngineControlActivationLeaseTable.expires_at, input.now)))
    .returning({ id: EngineControlActivationLeaseTable.id }).get()
  if (!updated) throw new ControlLeaseFenceLostError(`Control lease renewal lost fence ${input.leaseID}`)
}

export function renewControlLease(input: RenewControlLeaseInput): void {
  Database.immediateTransaction((db) => renewControlLeaseInTransaction(db, input))
}
