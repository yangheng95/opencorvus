/**
 * Wall-clock timeout race for an arbitrary promise.
 *
 * cancelTask and other tear-down paths await internal prompt and queue owners.
 * If an owner never resolves, the await pins the entire cancel chain — task row stays active,
 * UI spinner never clears, deleteTask blocks. `withTimeout` provides an
 * upper bound; the caller decides whether timeout is fatal (throw) or
 * tolerable (catch + log + proceed).
 */
export class AwaitTimeoutError extends Error {
  readonly label: string
  readonly ms: number

  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`)
    this.name = "AwaitTimeoutError"
    this.label = label
    this.ms = ms
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AwaitTimeoutError(label, ms)), ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
