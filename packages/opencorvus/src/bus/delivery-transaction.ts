import { Database } from "../storage/db"

type PendingWrite = {
  write: (db: Database.TxOrDb) => unknown
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

// Each caller remains owned by its existing publication/Project lifetime.
// Bound synchronous work per turn while sharing physical SQLite commits.
const DELIVERY_WRITE_BATCH_SIZE = 256
const pending: PendingWrite[] = []
let scheduled = false

function schedule() {
  if (scheduled || pending.length === 0) return
  scheduled = true
  Database.runOutsideContext(() => setTimeout(flush, 0))
}

function flush() {
  scheduled = false
  const writes = pending.splice(0, DELIVERY_WRITE_BATCH_SIZE)
  try {
    const results = Database.immediateTransaction((db) => writes.map((entry) => {
      try {
        return { ok: true as const, value: Database.savepoint(db, () => entry.write(db)) }
      } catch (error) {
        // A storage failure invalidates the whole physical commit. An input or
        // lease rejection rolls back only its own write and post-commit effects.
        if (Database.isUnavailableError(error)) throw error
        return { ok: false as const, error }
      }
    }))
    for (const [index, result] of results.entries()) {
      if (result.ok) writes[index]!.resolve(result.value)
      else writes[index]!.reject(result.error)
    }
  } catch (error) {
    for (const entry of writes) entry.reject(error)
  }
  schedule()
}

/** Write delivery facts after source commit; resolve only after their own commit.
 * Subscriber effects stay outside this queue and its database transactions. */
export function commitDeliveryTransaction<T>(
  write: (db: Database.TxOrDb) => T,
  ..._synchronousOnly: T extends PromiseLike<unknown> ? [never] : []
): Promise<T> {
  if (Database.hasActiveContext()) {
    throw new Error("Bus delivery writes require the source database context to be retired")
  }
  return new Promise<T>((resolve, reject) => {
    pending.push({ write, resolve: (value) => resolve(value as T), reject })
    schedule()
  })
}
