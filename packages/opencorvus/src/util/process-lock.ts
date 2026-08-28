import { Filesystem } from "./filesystem"
import { withKeyedLock } from "./lock"
import lockfile, { type LockOptions } from "proper-lockfile"

/**
 * Cross-process file locks with a compromise policy the caller can survive.
 *
 * `proper-lockfile` renews a held lock on a timer. When renewal cannot keep
 * the lockfile's mtime inside the stale threshold — the machine suspended, IO
 * starved the timer, another process removed the lock directory — it declares
 * the lock compromised and calls `onCompromised`, whose library default is
 * `(err) => { throw err }`. That throw happens inside the renewal timer and
 * inside `fs` callbacks, so it is an uncaught exception: no `try`/`catch`
 * around the locked work can see it, and it takes the whole host process down
 * over a lock hiccup on one file.
 *
 * Six call sites took that default. Acquiring through here captures the
 * compromise and raises it from `release()` instead, so losing exclusivity
 * fails the one operation that lost it and reads as a fault rather than a
 * crash. Callers already release in `finally`, so they surface it without
 * restructuring: a body that completed without exclusivity must not be
 * reported as a success.
 *
 * `worktree/git-lock.ts` keeps calling `proper-lockfile` directly. It hands a
 * long-lived lease across await points and needs `assertOwned()` mid-flight,
 * which this release-bounded shape does not model — and it already passes its
 * own non-throwing `onCompromised`.
 */
export class ProcessLockCompromisedError extends Error {
  constructor(
    readonly target: string,
    cause: unknown,
  ) {
    super(
      `Process lock ${target} was compromised while the operation held it, so the work was not exclusive. ` +
        `expected: sole ownership until release, received: ownership lost while the operation was in flight.`,
      { cause },
    )
    this.name = "ProcessLockCompromisedError"
  }
}

/**
 * Same shape as `lockfile.lock`, except the returned release rejects with
 * `ProcessLockCompromisedError` when ownership was lost. The lockfile is
 * always released first, so a compromised lock never also leaks the handle.
 */
export async function acquireProcessLock(
  target: string,
  options: Omit<LockOptions, "onCompromised"> = {},
): Promise<() => Promise<void>> {
  let compromised: unknown
  const release = await lockfile.lock(target, {
    ...options,
    onCompromised(error) {
      compromised ??= error
    },
  })
  let releasePromise: Promise<void> | undefined
  return () => {
    releasePromise ??= (async () => {
      try {
        await release()
      } catch (error) {
        // Declaring a lock compromised already marks it released inside the
        // library, so releasing afterwards rejects with `ERELEASED`. That is
        // bookkeeping about the compromise, not a second independent failure,
        // and reporting it would bury the reason the lock was lost.
        if (!compromised) throw error
      }
      if (compromised) throw new ProcessLockCompromisedError(target, compromised)
    })()
    return releasePromise
  }
}

/** Scope-bounded form for callers that do not need the release handle. */
export async function withProcessLock<T>(
  target: string,
  options: Omit<LockOptions, "onCompromised">,
  run: () => Promise<T>,
): Promise<T> {
  const release = await acquireProcessLock(target, options)
  let released = false
  try {
    const result = await run()
    released = true
    await release()
    return result
  } finally {
    if (!released) await release().catch(() => undefined)
  }
}

/**
 * How long a caller queues behind other callers in this process for one fact.
 *
 * Long enough that a genuine cross-process wait is never mistaken for a
 * deadlock, short enough that a re-entrant acquisition surfaces as an error
 * naming the file instead of hanging the process.
 */
export const SHARED_JSON_FACT_QUEUE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * How a cross-process lock waits for the current holder.
 *
 * Every critical section behind these locks is short and bounded by its own
 * work, so waiting is the correct answer to contention: failing instead would
 * turn a concurrent credential write into a lost update or a user-visible
 * error for something the caller can simply queue behind.
 */
export const CROSS_PROCESS_LOCK_RETRY = {
  forever: true,
  factor: 1.2,
  minTimeout: 25,
  maxTimeout: 250,
  randomize: true,
} as const

/**
 * Cross-process read-modify-write for one shared JSON fact file.
 *
 * `withKeyedLock` serializes writers inside one process. The current data
 * architecture explicitly supports more than one backend over a single data
 * root, so two processes can read the same snapshot, update different keys, and
 * have the later atomic replacement discard the earlier update. Atomic
 * replacement prevents torn bytes; it does not prevent a lost update. The read
 * therefore has to happen inside the cross-process lock, not before it.
 *
 * `proper-lockfile` locks an existing path, so the fact file is provisioned
 * with its empty representation first. Every reader of these stores already
 * treats a missing file as empty, so provisioning changes nothing observable.
 */
export async function withSharedJsonFactLock<T>(input: {
  /** Process-local writer queue for this exact path. */
  locks: Map<string, Promise<unknown>>
  filepath: string
  /** The bytes a reader would synthesize for a missing file. */
  empty: string
  mode?: number
  run: () => Promise<T>
}): Promise<T> {
  await Filesystem.writeAtomicIfAbsent(input.filepath, input.empty, input.mode)
  // The in-process queue must outlast a real cross-process wait: with the
  // keyed lock's own 30-second default, the first caller in this process waits
  // for the file lock while every other caller of the same file fails with an
  // error naming the wrong lock. It must still end, though — waiting forever
  // would turn a re-entrant acquisition into a hang instead of an error.
  return withKeyedLock(
    input.locks,
    input.filepath,
    () => withProcessLock(input.filepath, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, input.run),
    SHARED_JSON_FACT_QUEUE_TIMEOUT_MS,
  )
}
