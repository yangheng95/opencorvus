export class ToolLiveMetadataSink<T> {
  private latest: T | undefined
  private draining: Promise<void> | undefined
  private firstError: unknown
  private closed = false

  constructor(private readonly write: (value: T) => Promise<void>) {}

  update(value: T): void {
    if (this.closed) return
    this.latest = value
    this.startDrain()
  }

  private startDrain(): void {
    if (this.draining || this.latest === undefined || this.firstError !== undefined) return
    this.draining = this.drain()
      .catch((error) => {
        this.firstError ??= error
        this.latest = undefined
      })
      .finally(() => {
        this.draining = undefined
        if (!this.closed && this.latest !== undefined && this.firstError === undefined) {
          this.startDrain()
        }
      })
  }

  private async drain(): Promise<void> {
    for (;;) {
      const value = this.latest
      if (value === undefined) return
      this.latest = undefined
      await this.write(value)
    }
  }

  async flush(): Promise<void> {
    for (;;) {
      if (this.firstError !== undefined) break
      this.startDrain()
      const active = this.draining
      if (active) await active
      if (!this.draining && this.latest === undefined) break
    }
    if (this.firstError !== undefined) throw this.firstError
  }

  async close(): Promise<void> {
    this.closed = true
    await this.flush()
  }
}
