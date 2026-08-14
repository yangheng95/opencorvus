const DEFAULT_KEYED_LOCK_TIMEOUT_MS = 30_000

/**
 * Run an async function under a keyed mutex (one concurrent execution per key).
 * @param timeoutMs  Maximum time to wait for the lock before throwing (default 30s).
 */
export async function withKeyedLock<T>(
  locks: Map<string, Promise<unknown>>,
  key: string,
  fn: () => Promise<T>,
  timeoutMs = DEFAULT_KEYED_LOCK_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted()
  const deadline = Date.now() + timeoutMs
  while (locks.has(key)) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error(`withKeyedLock timeout: key="${key}" waited ${timeoutMs}ms`)
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const wait = Promise.race([
        locks.get(key)!.catch(() => undefined),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, remaining)
          timeout.unref?.()
        }),
      ])
      if (signal) {
        signal.throwIfAborted()
        let abort!: () => void
        await new Promise<void>((resolve, reject) => {
          abort = () => reject(signal.reason)
          signal.addEventListener("abort", abort, { once: true })
          wait.then(() => resolve(), reject)
        }).finally(() => signal.removeEventListener("abort", abort))
      } else {
        await wait
      }
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
  signal?.throwIfAborted()
  const promise = fn()
  locks.set(key, promise)
  try {
    return await promise
  } finally {
    if (locks.get(key) === promise) locks.delete(key)
  }
}

export namespace Lock {
  const locks = new Map<
    string,
    {
      readers: number
      writer: boolean
      waitingReaders: (() => void)[]
      waitingWriters: Array<{ acquire(): void }>
    }
  >()

  function get(key: string) {
    if (!locks.has(key)) {
      locks.set(key, {
        readers: 0,
        writer: false,
        waitingReaders: [],
        waitingWriters: [],
      })
    }
    return locks.get(key)!
  }

  function process(key: string) {
    const lock = locks.get(key)
    if (!lock || lock.writer || lock.readers > 0) return

    // Prioritize writers to prevent starvation
    if (lock.waitingWriters.length > 0) {
      const nextWriter = lock.waitingWriters.shift()!
      try {
        nextWriter.acquire()
      } catch {
        // If the resolve callback throws, the writer never acquired the lock.
        // Re-run process to wake the next waiter and prevent permanent deadlock.
        process(key)
      }
      return
    }

    // Wake up all waiting readers
    while (lock.waitingReaders.length > 0) {
      const nextReader = lock.waitingReaders.shift()!
      try {
        nextReader()
      } catch {
        // Same safety: if a reader resolve throws, continue waking others.
      }
    }

    // Clean up empty locks — must re-check because waking readers increments lock.readers
    if (lock.readers === 0 && !lock.writer && lock.waitingReaders.length === 0 && lock.waitingWriters.length === 0) {
      locks.delete(key)
    }
  }

  export async function read(key: string, onAcquire?: () => void): Promise<Disposable> {
    const lock = get(key)

    return new Promise((resolve, reject) => {
      const acquire = () => {
        lock.readers++
        try {
          onAcquire?.()
        } catch (error) {
          lock.readers--
          process(key)
          reject(error)
          return
        }
        resolve({
          [Symbol.dispose]: () => {
            lock.readers--
            process(key)
          },
        })
      }
      if (!lock.writer && lock.waitingWriters.length === 0) {
        acquire()
      } else {
        lock.waitingReaders.push(acquire)
      }
    })
  }

  export function reserveWrite(key: string): { acquired: Promise<Disposable>; cancel(): void } {
    const lock = get(key)
    let acquiredLease: Disposable | undefined
    let cancelled = false
    let resolveAcquired!: (lease: Disposable) => void
    const acquired = new Promise<Disposable>((resolve) => {
      resolveAcquired = resolve
    })
    const noop: Disposable = { [Symbol.dispose]: () => undefined }
    const waiter = {
      acquire() {
        if (cancelled) {
          resolveAcquired(noop)
          process(key)
          return
        }
        lock.writer = true
        let released = false
        acquiredLease = {
          [Symbol.dispose]: () => {
            if (released) return
            released = true
            lock.writer = false
            process(key)
          },
        }
        resolveAcquired(acquiredLease)
      },
    }
    if (!lock.writer && lock.readers === 0) {
      waiter.acquire()
    } else {
      lock.waitingWriters.push(waiter)
    }
    return {
      acquired,
      cancel() {
        if (cancelled) return
        cancelled = true
        if (acquiredLease) {
          acquiredLease[Symbol.dispose]()
          return
        }
        const index = lock.waitingWriters.indexOf(waiter)
        if (index >= 0) lock.waitingWriters.splice(index, 1)
        resolveAcquired(noop)
        process(key)
      },
    }
  }

  export async function write(key: string): Promise<Disposable> {
    return reserveWrite(key).acquired
  }
}
