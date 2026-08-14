export type RuntimeExecutionKind =
  | "task_root_ingress_delivery"
  | "task_cancellation"
  | "scheduler_event_fire"
  | "scheduler_automation_fire"
  | "session_wake_loop"
  | "protocol_publication"
  | "detached_dispatch_pipeline"

export class RuntimeExecutionAdmissionClosedError extends Error {
  override readonly name = "RuntimeExecutionAdmissionClosedError"

  constructor(public readonly kind: RuntimeExecutionKind) {
    super(`Runtime execution admission is closed for ${kind}`)
  }
}

export class RuntimeExecutionSettlementInactivityError extends Error {
  override readonly name = "RuntimeExecutionSettlementInactivityError"

  constructor(
    public readonly kinds: readonly RuntimeExecutionKind[],
    public readonly labels: readonly string[],
    public readonly inactivityTimeoutMilliseconds: number,
  ) {
    super(
      `Runtime execution settlement made no progress for ${inactivityTimeoutMilliseconds}ms; ` +
        `${labels.length} execution(s) remain: ${labels.join(", ")}`,
    )
  }
}

export async function waitForRuntimeSettlementIdle(input: {
  snapshot(): Array<{ label: string; settled: Promise<void> }>
  inactivityTimeoutMilliseconds: number
  inactivityError(labels: string[]): Error
}): Promise<void> {
  if (!Number.isInteger(input.inactivityTimeoutMilliseconds) || input.inactivityTimeoutMilliseconds <= 0) {
    throw new Error(`Invalid runtime settlement inactivity timeout ${input.inactivityTimeoutMilliseconds}`)
  }
  for (;;) {
    const pending = input.snapshot()
    if (pending.length === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        ...pending.map(({ settled }) => settled.then(() => undefined, () => undefined)),
        new Promise<void>((_, reject) => {
          timer = setTimeout(
            () => reject(input.inactivityError(input.snapshot().map(({ label }) => label))),
            input.inactivityTimeoutMilliseconds,
          )
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

type Entry = {
  kind: RuntimeExecutionKind
  label: string
  settled: Promise<void>
  finish(): void
  requestCancellation(reason: unknown): void
}

export type RuntimeExecutionReservation = {
  readonly kind: RuntimeExecutionKind
  readonly label: string
  readonly signal: AbortSignal
  cancel(reason: unknown): void
  onCancel(cancel: (reason: unknown) => void): void
  settleWith(operation: Promise<unknown>): void
  settle(): void
}

export type RuntimeExecutionSettlementGate = Disposable & {
  closeAdmission(kinds: readonly RuntimeExecutionKind[]): void
  requestCancellation(kinds: readonly RuntimeExecutionKind[], reason: unknown): void
  waitForIdle(kinds: readonly RuntimeExecutionKind[], inactivityTimeoutMilliseconds?: number): Promise<void>
  commit(): void
}

const entries = new Set<Entry>()
const closedAdmission = new Map<RuntimeExecutionKind, symbol>()
const admissionReopenedListeners = new Map<RuntimeExecutionKind, Set<() => void>>()
let activeGate: symbol | undefined

export namespace RuntimeExecutionSettlement {
  export function reserve(kind: RuntimeExecutionKind, label: string): RuntimeExecutionReservation {
    if (closedAdmission.has(kind)) throw new RuntimeExecutionAdmissionClosedError(kind)
    const controller = new AbortController()
    const cancellationCallbacks = new Set<(reason: unknown) => void>()
    let finish!: () => void
    const settled = new Promise<void>((resolve) => {
      finish = resolve
    })
    let attached = false
    let finished = false
    const complete = () => {
      if (finished) return
      finished = true
      entries.delete(entry)
      finish()
    }
    const entry: Entry = {
      kind,
      label,
      settled,
      finish: complete,
      requestCancellation(reason) {
        if (!controller.signal.aborted) controller.abort(reason)
        const failures: unknown[] = []
        for (const cancel of cancellationCallbacks) {
          try {
            cancel(reason)
          } catch (error) {
            failures.push(error)
          }
        }
        if (failures.length > 0) {
          throw new AggregateError(failures, `Runtime execution cancellation failed for ${label}`)
        }
      },
    }
    entries.add(entry)
    return {
      kind,
      label,
      signal: controller.signal,
      cancel(reason) {
        entry.requestCancellation(reason)
      },
      onCancel(cancel) {
        if (finished) return
        cancellationCallbacks.add(cancel)
        if (controller.signal.aborted) cancel(controller.signal.reason)
      },
      settleWith(operation) {
        if (attached || finished) throw new Error(`Runtime execution reservation ${label} was already settled`)
        attached = true
        void Promise.resolve(operation).finally(complete).catch(() => undefined)
      },
      settle() {
        if (attached || finished) return
        attached = true
        complete()
      },
    }
  }

  export function acquireSettlementGate(): RuntimeExecutionSettlementGate {
    if (activeGate) throw new Error("Runtime execution settlement is already in progress")
    const token = Symbol("runtime-execution-settlement")
    activeGate = token
    const ownedKinds = new Set<RuntimeExecutionKind>()
    let committed = false
    return {
      closeAdmission(kinds) {
        for (const kind of kinds) {
          const owner = closedAdmission.get(kind)
          if (owner && owner !== token) throw new Error(`Runtime execution admission for ${kind} is already closed`)
          closedAdmission.set(kind, token)
          ownedKinds.add(kind)
        }
      },
      requestCancellation(kinds, reason) {
        const selected = new Set(kinds)
        const failures: unknown[] = []
        for (const entry of entries) {
          if (!selected.has(entry.kind)) continue
          try {
            entry.requestCancellation(reason)
          } catch (error) {
            failures.push(error)
          }
        }
        if (failures.length > 0) {
          throw new AggregateError(failures, "Runtime execution cancellation request failed")
        }
      },
      async waitForIdle(kinds, inactivityTimeoutMilliseconds) {
        if (
          inactivityTimeoutMilliseconds !== undefined &&
          (!Number.isInteger(inactivityTimeoutMilliseconds) || inactivityTimeoutMilliseconds <= 0)
        ) {
          throw new Error(`Invalid runtime execution settlement inactivity timeout ${inactivityTimeoutMilliseconds}`)
        }
        const selected = new Set(kinds)
        if (inactivityTimeoutMilliseconds === undefined) {
          for (;;) {
            const pending = [...entries].filter((entry) => selected.has(entry.kind)).map((entry) => entry.settled)
            if (pending.length === 0) return
            await Promise.allSettled(pending)
          }
        }
        await waitForRuntimeSettlementIdle({
          snapshot: () =>
            [...entries]
              .filter((entry) => selected.has(entry.kind))
              .map((entry) => ({ label: entry.label, settled: entry.settled })),
          inactivityTimeoutMilliseconds,
          inactivityError: (labels) =>
            new RuntimeExecutionSettlementInactivityError([...selected], labels, inactivityTimeoutMilliseconds),
        })
      },
      commit() {
        if (activeGate !== token) throw new Error("Runtime execution settlement gate is no longer authoritative")
        committed = true
      },
      [Symbol.dispose]() {
        if (activeGate !== token) return
        const reopened: RuntimeExecutionKind[] = []
        for (const kind of ownedKinds) {
          if (closedAdmission.get(kind) !== token) continue
          closedAdmission.delete(kind)
          reopened.push(kind)
        }
        activeGate = undefined
        if (committed) return
        const failures: unknown[] = []
        for (const kind of reopened) {
          for (const listener of admissionReopenedListeners.get(kind) ?? []) {
            try {
              listener()
            } catch (error) {
              failures.push(error)
            }
          }
        }
        if (failures.length > 0) {
          throw new AggregateError(failures, "Runtime execution admission reopen listeners failed")
        }
      },
    }
  }

  export function onAdmissionReopened(kind: RuntimeExecutionKind, listener: () => void): Disposable {
    const listeners = admissionReopenedListeners.get(kind) ?? new Set<() => void>()
    listeners.add(listener)
    admissionReopenedListeners.set(kind, listeners)
    return {
      [Symbol.dispose]() {
        listeners.delete(listener)
        if (listeners.size === 0 && admissionReopenedListeners.get(kind) === listeners) {
          admissionReopenedListeners.delete(kind)
        }
      },
    }
  }

  export function snapshot(): Array<{ kind: RuntimeExecutionKind; label: string }> {
    return [...entries].map(({ kind, label }) => ({ kind, label }))
  }
}
