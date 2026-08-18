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
