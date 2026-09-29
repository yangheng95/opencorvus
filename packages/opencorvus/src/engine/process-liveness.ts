/** Physical process identity shared by every Project in this backend.
 * A stopped heartbeat is not proof that a local process exited. The durable
 * receipt names the OS process instance; only the OS observer decides death.
 * Project disposal releases local admission references, never process identity.
 */
import z from "zod"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import {
  currentRuntimeProcessOccurrence,
  observeRuntimeProcessOccurrence,
  type RuntimeProcessOccurrenceObserver,
} from "@/runtime/process-occurrence"
import { acquireControlLeaseInTransaction, currentControlLeaseInTransaction } from "./control-lease"

const ProcessIdentity = z
  .object({
    pid: z.number().int().positive(),
    processInstanceID: z.string().min(1),
    occurrenceID: z.string().min(1),
  })
  .strict()

// Existing receipt storage also serves explicit-lifetime Session deletion
// fences. This field is storage representation, not a process death deadline.
const PROCESS_RECEIPT_END = Number.MAX_SAFE_INTEGER

type ProcessOwner = {
  occurrenceID: string
  receiptID: string
  identity: string
  references: number
}

export class ProcessLivenessOwnerUnavailableError extends Error {
  override readonly name = "ProcessLivenessOwnerUnavailableError"
  readonly code = "PROCESS_LIVENESS_OWNER_UNAVAILABLE"

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
  }
}

let currentOwner: ProcessOwner | undefined

function assertOwner(owner: ProcessOwner, occurrenceID: string, db: Database.TxOrDb): void {
  const receipt = currentControlLeaseInTransaction(db, "runtime_process", occurrenceID)
  if (
    currentOwner !== owner ||
    owner.references <= 0 ||
    owner.occurrenceID !== occurrenceID ||
    receipt?.id !== owner.receiptID ||
    receipt.owner_occurrence_id !== owner.identity
  ) {
    throw new ProcessLivenessOwnerUnavailableError(
      `Runtime process identity ${occurrenceID} is not registered for this owner`,
    )
  }
}

export interface ProcessLivenessReference {
  readonly occurrenceID: string
  readonly receiptID: string
  assertOwned(expectedOccurrenceID?: string): void
  assertOwnedInTransaction(db: Database.TxOrDb, expectedOccurrenceID: string): void
  release(): void
}

export function assertProcessLivenessOwnerInTransaction(db: Database.TxOrDb, occurrenceID: string): void {
  if (!currentOwner) {
    throw new ProcessLivenessOwnerUnavailableError(`Runtime process ${occurrenceID} has no active admission reference`)
  }
  assertOwner(currentOwner, occurrenceID, db)
}

/** Register once per physical process/database, and join its local admission. */
export function joinProcessLiveness(occurrenceID: string, now = Date.now()): ProcessLivenessReference {
  let owner = currentOwner
  if (owner) {
    Database.use((db) => assertOwner(owner!, occurrenceID, db))
    owner.references += 1
  } else {
    const identity = JSON.stringify({ ...currentRuntimeProcessOccurrence(), occurrenceID })
    const receipt = Database.immediateTransaction((db) => {
      const prior = currentControlLeaseInTransaction(db, "runtime_process", occurrenceID)
      if (prior) {
        if (prior.owner_occurrence_id !== identity) {
          throw new ProcessLivenessOwnerUnavailableError(
            `Runtime process ${occurrenceID} already names another physical identity`,
          )
        }
        return prior
      }
      const acquired = acquireControlLeaseInTransaction(db, {
        target: "runtime_process",
        targetID: occurrenceID,
        ownerOccurrenceID: identity,
        now,
        leaseMilliseconds: PROCESS_RECEIPT_END - now,
        leaseID: Identifier.ascending("activity"),
      })
      if (!acquired.acquired)
        throw new ProcessLivenessOwnerUnavailableError(`Runtime process identity registration raced: ${occurrenceID}`)
      return acquired.lease
    })
    owner = { occurrenceID, receiptID: receipt.id, identity, references: 1 }
    currentOwner = owner
  }
  const joined = owner
  let released = false
  const assertReference = (db: Database.TxOrDb, expected: string) => {
    if (released)
      throw new ProcessLivenessOwnerUnavailableError(`Runtime process reference ${joined.occurrenceID} was released`)
    assertOwner(joined, expected, db)
  }
  return {
    occurrenceID: joined.occurrenceID,
    receiptID: joined.receiptID,
    assertOwned(expected = joined.occurrenceID) {
      Database.use((db) => assertReference(db, expected))
    },
    assertOwnedInTransaction: assertReference,
    release() {
      if (released) return
      released = true
      joined.references -= 1
      if (currentOwner === joined && joined.references === 0) currentOwner = undefined
    },
  }
}

/** Read the receipt, then observe the OS outside any database transaction.
 * Missing/old opaque receipts provide no physical-death proof. Report that
 * limitation instead of converting a clock deadline into abandoned work.
 */
export function observeProcessLiveness(
  occurrenceID: string,
  observe: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
) {
  const receipt = Database.use((db) => currentControlLeaseInTransaction(db, "runtime_process", occurrenceID))
  let identity: z.infer<typeof ProcessIdentity>
  try {
    identity = ProcessIdentity.parse(JSON.parse(receipt?.owner_occurrence_id ?? "null"))
    if (identity.occurrenceID !== occurrenceID) throw new Error("Process occurrence does not match its receipt")
  } catch (cause) {
    throw new ProcessLivenessOwnerUnavailableError(
      `Physical identity of runtime process ${occurrenceID} is unavailable; death is unproven`,
      cause,
    )
  }
  return observe(identity)
}
