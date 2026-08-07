export class Channel<T> {
  buf: T[] = []
  waiters: Array<(item: T | null) => void> = []
  closed = false

  send(item: T) {
    if (this.closed) return false
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(item)
      return true
    }
    this.buf.push(item)
    return true
  }

  recv(signal?: AbortSignal, timeoutMs?: number): Promise<T | null> | T | null {
    if (this.buf.length > 0) return this.buf.shift()!
    if (this.closed) return null
    if (signal?.aborted) return null
    return new Promise<T | null>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const done = (item: T | null) => {
        if (settled) return
        settled = true
        if (timer !== undefined) clearTimeout(timer)
        signal?.removeEventListener("abort", abort)
        resolve(item)
      }
      const abort = () => {
        const index = this.waiters.indexOf(done)
        if (index >= 0) this.waiters.splice(index, 1)
        done(null)
      }
      const timeout = () => {
        if (settled) return
        settled = true
        const index = this.waiters.indexOf(done)
        if (index >= 0) this.waiters.splice(index, 1)
        signal?.removeEventListener("abort", abort)
        reject(new Error(`Channel.recv timed out after ${timeoutMs}ms`))
      }

      this.waiters.push(done)
      signal?.addEventListener("abort", abort, { once: true })
      if (timeoutMs !== undefined) timer = setTimeout(timeout, timeoutMs)
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    for (const waiter of this.waiters.splice(0)) waiter(null)
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const item = await this.recv()
      if (item === null) return
      yield item
    }
  }
}
