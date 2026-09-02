export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []

  push(item: T) {
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
  }

  async next(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise((resolve) => this.resolvers.push(resolve))
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.next()
  }
}

export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}

export async function settledWork<T, R>(input: {
  concurrency: number
  items: readonly T[]
  run: (item: T, index: number) => Promise<R>
  signal?: AbortSignal
}): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isSafeInteger(input.concurrency) || input.concurrency < 1) {
    throw new Error(`Work concurrency must be a positive safe integer: ${input.concurrency}`)
  }
  const results = new Array<PromiseSettledResult<R>>(input.items.length)
  let nextIndex = 0
  const worker = async () => {
    while (true) {
      input.signal?.throwIfAborted()
      const index = nextIndex
      nextIndex += 1
      if (index >= input.items.length) return
      try {
        results[index] = { status: "fulfilled", value: await input.run(input.items[index]!, index) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(input.concurrency, input.items.length) }, worker))
  return results
}

type PermitWaiter = {
  resolve: (release: () => void) => void
  reject: (reason: unknown) => void
  signal?: AbortSignal
  onAbort?: () => void
}

/** Process-local physical admission only. It owns no business occurrence,
 * retry, lease, due time or settlement state. */
export class FifoPermitPool {
  private active = 0
  private readonly waiters: PermitWaiter[] = []
  private capacity: number

  constructor(limit: number) {
    this.capacity = FifoPermitPool.assertLimit(limit)
  }

  get limit(): number {
    return this.capacity
  }

  get snapshot(): { active: number; pending: number; limit: number } {
    return { active: this.active, pending: this.waiters.length, limit: this.limit }
  }

  resize(limit: number): void {
    this.capacity = FifoPermitPool.assertLimit(limit)
    this.drain()
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    if (this.active < this.limit && this.waiters.length === 0) return this.grant()
    return new Promise<() => void>((resolve, reject) => {
      const waiter: PermitWaiter = { resolve, reject, signal }
      waiter.onAbort = () => {
        const index = this.waiters.indexOf(waiter)
        if (index < 0) return
        this.waiters.splice(index, 1)
        reject(signal?.reason)
        this.drain()
      }
      signal?.addEventListener("abort", waiter.onAbort, { once: true })
      this.waiters.push(waiter)
      if (signal?.aborted) waiter.onAbort()
      else this.drain()
    })
  }

  async run<R>(fn: () => Promise<R>, signal?: AbortSignal): Promise<R> {
    const release = await this.acquire(signal)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  private grant(): () => void {
    this.active += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.active -= 1
      this.drain()
    }
  }

  private drain(): void {
    while (this.active < this.limit && this.waiters.length > 0) {
      const waiter = this.waiters.shift()!
      waiter.signal?.removeEventListener("abort", waiter.onAbort!)
      if (waiter.signal?.aborted) {
        waiter.reject(waiter.signal.reason)
        continue
      }
      waiter.resolve(this.grant())
    }
  }

  private static assertLimit(limit: number): number {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error(`Permit limit must be a positive safe integer: ${limit}`)
    }
    return limit
  }
}
