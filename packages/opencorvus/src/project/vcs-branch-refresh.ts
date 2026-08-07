export class VcsBranchRefreshOwner {
  private tail: Promise<void> = Promise.resolve()
  private active = true

  constructor(
    private branch: string | undefined,
    private readonly resolveBranch: () => Promise<string | undefined>,
    private readonly publish: (branch: string | undefined, previous: string | undefined) => void | Promise<void>,
  ) {}

  current() {
    return this.branch
  }

  refresh(): Promise<void> {
    const run = async () => {
      if (!this.active) return
      const next = await this.resolveBranch()
      if (!this.active || next === this.branch) return
      const previous = this.branch
      this.branch = next
      await this.publish(next, previous)
    }
    const operation = this.tail.then(run, run)
    this.tail = operation.catch(() => undefined)
    return operation
  }

  async dispose(): Promise<void> {
    this.active = false
    await this.tail
  }
}
