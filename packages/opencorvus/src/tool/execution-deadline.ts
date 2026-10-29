/** A fixed deadline actually armed by the executing Tool, never result metadata. */
export interface ToolExecutionDeadline extends Disposable {
  readonly deadlineAt: number
  readonly settlementDeadlineAt: number
  readonly signal: AbortSignal
  readonly timeoutReason: DOMException
}

const armed = new WeakSet<object>()

export function assertToolExecutionDurations(timeoutMs: number, settlementMs: number): void {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(settlementMs) ||
    settlementMs <= 0 ||
    !Number.isSafeInteger(Date.now() + timeoutMs + settlementMs)
  ) {
    throw new Error("Tool execution and settlement durations must fit the finite clock range")
  }
}

export function assertToolExecutionDeadline(value: ToolExecutionDeadline): void {
  if (!armed.has(value)) throw new Error("Tool execution deadline must come from the armed executor")
}

export function createToolExecutionDeadline(input: {
  timeoutMs: number
  settlementMs: number
  signal: AbortSignal
}): ToolExecutionDeadline {
  assertToolExecutionDurations(input.timeoutMs, input.settlementMs)
  const deadlineAt = Date.now() + input.timeoutMs
  const settlementDeadlineAt = deadlineAt + input.settlementMs
  if (!Number.isSafeInteger(settlementDeadlineAt)) throw new Error("Tool execution deadline exceeds the clock range")
  const controller = new AbortController()
  const timeoutReason = new DOMException(`Tool execution deadline ${deadlineAt} exceeded`, "TimeoutError")
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const arm = () => {
    if (disposed) return
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) {
      controller.abort(timeoutReason)
      return
    }
    timer = setTimeout(arm, Math.min(remaining, 2_147_483_647))
  }
  arm()
  const value: ToolExecutionDeadline = Object.freeze({
    deadlineAt,
    settlementDeadlineAt,
    timeoutReason,
    signal: AbortSignal.any([input.signal, controller.signal]),
    [Symbol.dispose]() {
      disposed = true
      armed.delete(value)
      clearTimeout(timer)
    },
  })
  armed.add(value)
  return value
}

export type ToolExecutionDeadlineObserver = (deadline: ToolExecutionDeadline) => Promise<AsyncDisposable>

/** Direct non-Session callers still use the same armed deadline without a parent observer. */
export async function observeToolExecutionDeadline(
  extra: Record<string, unknown> | undefined,
  deadline: ToolExecutionDeadline,
): Promise<AsyncDisposable> {
  assertToolExecutionDeadline(deadline)
  const observer = extra?.toolExecutionDeadlineObserver as ToolExecutionDeadlineObserver | undefined
  return observer ? observer(deadline) : { async [Symbol.asyncDispose]() {} }
}
