import { Context } from "./context"

const current = Context.create<PhysicalOperationScope>("physical operation")

/** One invocation's cancellation and actual I/O, inherited by nested Host work. */
export class PhysicalOperationScope {
  static current = current.tryUse
  readonly controller = new AbortController()
  readonly signal = this.controller.signal
  private readonly resources = new Set<Promise<unknown>>()
  private readonly failures: unknown[] = []

  constructor(readonly activity: () => void) {}

  run<T>(operation: () => T): T {
    this.signal.throwIfAborted()
    return current.provide(this, operation)
  }

  combine(signal?: AbortSignal | null): AbortSignal {
    return signal ? AbortSignal.any([this.signal, signal]) : this.signal
  }

  own(settled: Promise<unknown>, cancel: () => Promise<unknown>): void {
    let cancellation: Promise<unknown> | undefined
    const onAbort = () => {
      cancellation ??= Promise.resolve().then(cancel)
      void cancellation.catch(() => undefined)
    }
    this.signal.addEventListener("abort", onAbort, { once: true })
    if (this.signal.aborted) onAbort()
    const pending = (async () => {
      const [outcome] = await Promise.allSettled([settled])
      this.signal.removeEventListener("abort", onAbort)
      const [cancelled] = await Promise.allSettled([cancellation])
      const failures = [
        ...(outcome!.status === "rejected" ? [outcome!.reason] : []),
        ...(cancelled!.status === "rejected" ? [cancelled!.reason] : []),
      ]
      if (failures.length === 1) throw failures[0]
      if (failures.length) throw new AggregateError(failures, "Physical resource settlement and cancellation failed")
    })()
    this.resources.add(pending)
    void pending.then(
      () => this.resources.delete(pending),
      (error) => {
        this.resources.delete(pending)
        this.failures.push(error)
      },
    )
  }

  revoke(reason: unknown): void {
    this.controller.abort(reason)
  }

  async join(): Promise<void> {
    while (this.resources.size) await Promise.allSettled([...this.resources])
    if (this.failures.length) throw new AggregateError(this.failures, "Physical operation cleanup failed")
  }
}
