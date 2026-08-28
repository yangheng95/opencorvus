/**
 * Durable liveness for one runtime process occurrence.
 *
 * Recovery may settle another backend's dispatch as abandoned, so liveness is
 * a process-wide durable fact rather than a Project-local timer. Every active
 * Project driver joins this owner; only the final reference publishes the
 * graceful-exit boundary. A lost fence is absorbing because resurrecting an
 * occurrence after peers observed it dead would make two contradictory
 * recovery decisions authoritative.
 */
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  ControlLeaseFenceLostError,
  currentControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "./control-lease"

const log = Log.create({ service: "engine.process-liveness" })

/** Generous relative to the renewal period: a process pausing for garbage
 * collection or a slow disk must not be declared dead, because the cost of a
 * false positive is a killed live worker. */
export const PROCESS_LIVENESS_LEASE_MS = 90_000
export const PROCESS_LIVENESS_RENEWAL_MS = 30_000

type ProcessLivenessOwner = {
  occurrenceID: string
  leaseID: string
  references: number
  expiresAt: number
  renewalTimer?: ReturnType<typeof setInterval>
  fenceError?: ControlLeaseFenceLostError
}

let currentOwner: ProcessLivenessOwner | undefined
const lostFences = new Map<string, ControlLeaseFenceLostError>()

function fenceLost(message: string, cause?: unknown): ControlLeaseFenceLostError {
  const error = new ControlLeaseFenceLostError(message)
  if (cause !== undefined) Object.assign(error, { cause })
  return error
}

function recordFenceLoss(owner: ProcessLivenessOwner, error: ControlLeaseFenceLostError): ControlLeaseFenceLostError {
  owner.fenceError ??= error
  lostFences.set(owner.occurrenceID, owner.fenceError)
  if (owner.renewalTimer) clearInterval(owner.renewalTimer)
  return owner.fenceError
}

function assertOwnerInTransaction(
  owner: ProcessLivenessOwner,
  expectedOccurrenceID: string,
  db: Database.TxOrDb,
  now: number,
): void {
  if (currentOwner !== owner || owner.references <= 0) {
    throw fenceLost(`Runtime process liveness owner ${owner.occurrenceID} is no longer active`)
  }
  if (owner.occurrenceID !== expectedOccurrenceID) {
    throw fenceLost(
      `Runtime process liveness owner ${owner.occurrenceID} cannot authorize occurrence ${expectedOccurrenceID}`,
    )
  }
  if (owner.fenceError) throw owner.fenceError
  try {
    assertControlLeaseInTransaction(db, {
      target: "runtime_process",
      targetID: owner.occurrenceID,
      leaseID: owner.leaseID,
      ownerOccurrenceID: owner.occurrenceID,
      now,
    })
  } catch (error) {
    if (error instanceof ControlLeaseFenceLostError) throw recordFenceLoss(owner, error)
    throw error
  }
}

function assertOwner(owner: ProcessLivenessOwner, expectedOccurrenceID: string): void {
  Database.use((db) => assertOwnerInTransaction(owner, expectedOccurrenceID, db, Date.now()))
}

function renewOwner(owner: ProcessLivenessOwner): void {
  if (currentOwner !== owner || owner.references <= 0 || owner.fenceError) return
  const now = Date.now()
  try {
    renewControlLease({
      target: "runtime_process",
      targetID: owner.occurrenceID,
      leaseID: owner.leaseID,
      ownerOccurrenceID: owner.occurrenceID,
      now,
      expiresAt: now + PROCESS_LIVENESS_LEASE_MS,
    })
    owner.expiresAt = now + PROCESS_LIVENESS_LEASE_MS
  } catch (error) {
    if (error instanceof ControlLeaseFenceLostError) {
      recordFenceLoss(owner, error)
      return
    }
    if (now + PROCESS_LIVENESS_RENEWAL_MS >= owner.expiresAt) {
      recordFenceLoss(owner, fenceLost(`Runtime process liveness renewal expired for ${owner.occurrenceID}`, error))
      return
    }
    log.warn("Runtime process liveness renewal failed; retrying before expiry", {
      occurrenceID: owner.occurrenceID,
      leaseID: owner.leaseID,
      expiresAt: owner.expiresAt,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export interface ProcessLivenessReference {
  readonly occurrenceID: string
  readonly leaseID: string
  assertOwned(expectedOccurrenceID?: string): void
  assertOwnedInTransaction(db: Database.TxOrDb, expectedOccurrenceID: string, now: number): void
  release(): void
}

/** Join the one liveness owner for this runtime process. */
export function joinProcessLivenessLease(occurrenceID: string, now = Date.now()): ProcessLivenessReference {
  const lost = lostFences.get(occurrenceID)
  if (lost) throw lost
  let owner = currentOwner
  if (owner) {
    assertOwner(owner, occurrenceID)
    owner.references += 1
  } else {
    const leaseID = Identifier.ascending("activity")
    const acquired = acquireControlLease({
      target: "runtime_process",
      targetID: occurrenceID,
      ownerOccurrenceID: occurrenceID,
      now,
      leaseMilliseconds: PROCESS_LIVENESS_LEASE_MS,
      leaseID,
    })
    if (!acquired.acquired) {
      throw fenceLost(`Runtime process occurrence ${occurrenceID} already has live lease ${acquired.lease.id}`)
    }
    owner = {
      occurrenceID,
      leaseID: acquired.lease.id,
      references: 1,
      expiresAt: acquired.lease.expires_at,
    }
    currentOwner = owner
    owner.renewalTimer = setInterval(() => renewOwner(owner!), PROCESS_LIVENESS_RENEWAL_MS)
    ;(owner.renewalTimer as { unref?: () => void }).unref?.()
  }

  const joinedOwner = owner
  let released = false
  return {
    occurrenceID: joinedOwner.occurrenceID,
    leaseID: joinedOwner.leaseID,
    assertOwned(expectedOccurrenceID = joinedOwner.occurrenceID) {
      assertOwner(joinedOwner, expectedOccurrenceID)
    },
    assertOwnedInTransaction(db, expectedOccurrenceID, assertionNow) {
      assertOwnerInTransaction(joinedOwner, expectedOccurrenceID, db, assertionNow)
    },
    release() {
      if (released) return
      released = true
      if (currentOwner !== joinedOwner || joinedOwner.references <= 0) return
      joinedOwner.references -= 1
      if (joinedOwner.references > 0) return
      if (joinedOwner.renewalTimer) clearInterval(joinedOwner.renewalTimer)
      const handback = releaseControlLeaseOnErrorPath({
        target: "runtime_process",
        targetID: joinedOwner.occurrenceID,
        leaseID: joinedOwner.leaseID,
        ownerOccurrenceID: joinedOwner.occurrenceID,
        now: Date.now(),
      })
      if (!handback.released && !joinedOwner.fenceError) {
        recordFenceLoss(
          joinedOwner,
          fenceLost(`Runtime process liveness handback lost fence ${joinedOwner.leaseID}`, handback.error),
        )
      }
      currentOwner = undefined
    },
  }
}

/** Whether another process occurrence still owns a live durable receipt. */
export function isProcessOccurrenceLive(db: Database.TxOrDb, occurrenceID: string, now: number): boolean {
  const lease = currentControlLeaseInTransaction(db, "runtime_process", occurrenceID)
  return Boolean(lease && lease.expires_at > now)
}
