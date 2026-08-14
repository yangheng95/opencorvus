/**
 * Single-source chunk-driven activity monitor.
 *
 * Purpose: detect "no byte moved in N ms" on any streaming surface
 * (LLM stream.fullStream, executor event queue, SSE bridge) without
 * each layer inventing its own setTimeout/reset dance.
 *
 * Semantics (physical-liveness probe, NOT a state machine):
 *   - Caller pulls `signal` and composes it into whatever `AbortSignal`
 *     its producer already honours.
 *   - Caller invokes `observe()` on every real chunk / event. Each call
 *     resets the inactivity timer.
 *   - If `idleMs` elapses with no `observe()` call AND the external
 *     `signal` has not fired, the monitor aborts its own controller with
 *     an `AbortError` carrying a deterministic reason. The chain then
 *     unwinds naturally through the existing `throwIfAborted()` / abort
 *     listeners — no custom status codes, no separate error taxonomy.
 *   - Disposal is idempotent; after `dispose()` the monitor stops all
 *     timers and stops observing.
 *
 * Rules: CLAUDE.md #1 (no fallback — we *abort*, the caller decides),
 * #22 (single source for activity monitoring), #24 (pattern is extracted,
 * not copy-pasted into each consumer), #26 (no over-engineering —
 * observe() / dispose() / signal / lastActivityAt and that's it).
 */

export interface StreamActivityMonitor {
  /** Abort signal combined from external signal + internal idle controller. */
  readonly signal: AbortSignal
  /** Call on every chunk / event. Resets the inactivity timer. */
  observe(): void
  /**
   * Suspend the inactivity timer until `resume()` is called. Use when the
   * stream is legitimately paused waiting on a long synchronous tool call —
   * the LLM provider holds the connection open but emits no chunks during
   * tool execution, so the chunk-driven probe would false-positive trip.
   * Per rule 23 we don't infer "tool running" from internal state; the
   * caller explicitly pauses around the tool-call → tool-result boundary.
   *
   * Calls nest: each `pause()` requires a matching `resume()`. Excess
   * `resume()` calls are a no-op so callers don't need pair-tracking.
   */
  pause(): void
  /** Counterpart to pause(); reschedules the idle timer. */
  resume(): void
  /** True while one or more explicit stream-pause owners remain active. */
  paused(): boolean
  /** Millisecond timestamp of the most recent observe() (or construction). */
  lastActivityAt(): number
  /** True once the monitor's own controller has aborted due to inactivity. */
  timedOut(): boolean
  /** Abort the monitor from its owning session cancellation path. */
  abort(reason?: unknown): void
  /** Idempotent. Clears all timers and detaches listeners. */
  dispose(): void
}

export interface StreamActivityOptions {
  /** Maximum idle window before the monitor aborts itself. Must be > 0. */
  idleMs: number
  /** Caller-owned signal that the monitor propagates alongside its own. */
  signal?: AbortSignal
  /**
   * Human-readable tag appended to the AbortError reason (e.g.
   * "session-llm", "executor-events"). Helps triage in logs; does NOT
   * change control flow.
   */
  label?: string
}

export type ReadableStreamActivitySettlement = "eof" | "error" | "cancelled" | "aborted"

export interface ActivityTrackedReadableStreamOptions<T> {
  source: ReadableStream<T>
  activity: StreamActivityMonitor
  onSettlement?: (settlement: ReadableStreamActivitySettlement) => void
}

/**
 * Project one physical ReadableStream through the shared activity monitor.
 *
 * The returned stream owns both the upstream reader and the monitor. Every
 * terminal edge converges on one settlement: ordinary EOF, read error,
 * consumer cancellation, or activity/external abort. Abort requests upstream
 * cancellation without awaiting an untrusted parked reader; an ordinary
 * consumer cancel still awaits the upstream cleanup contract.
 */
export function activityTrackedReadableStream<T>(options: ActivityTrackedReadableStreamOptions<T>): ReadableStream<T> {
  const reader = options.source.getReader()
  let controller: ReadableStreamDefaultController<T> | undefined
  let settled = false
  let cancelPromise: Promise<void> | undefined

  const cancelUnderlying = (reason: unknown) => {
    cancelPromise ??= reader.cancel(reason)
    return cancelPromise
  }
  const settle = (settlement: ReadableStreamActivitySettlement) => {
    if (settled) return false
    settled = true
    options.activity.signal.removeEventListener("abort", onAbort)
    options.activity.dispose()
    options.onSettlement?.(settlement)
    return true
  }
  const onAbort = () => {
    if (!settle("aborted")) return
    const reason = options.activity.signal.reason ?? new DOMException("stream activity aborted", "AbortError")
    try {
      controller?.error(reason)
    } catch {
      // The consumer may already have closed its side of the stream.
    }
    void cancelUnderlying(reason).catch(() => undefined)
  }

  return new ReadableStream<T>({
    start(streamController) {
      controller = streamController
      if (options.activity.signal.aborted) onAbort()
      else options.activity.signal.addEventListener("abort", onAbort, { once: true })
    },
    async pull(streamController) {
      try {
        const result = await reader.read()
        if (settled) return
        if (result.done) {
          settle("eof")
          streamController.close()
          return
        }
        options.activity.observe()
        streamController.enqueue(result.value)
      } catch (error) {
        if (!settle("error")) return
        streamController.error(error)
      }
    },
    async cancel(reason) {
      if (!settle("cancelled")) return
      await cancelUnderlying(reason)
    },
  })
}

/**
 * Race every `next()` of an async iterable against an `AbortSignal` so the
 * iterator throws as soon as the signal aborts — even when the underlying
 * source has parked on a network read that doesn't honour signal abort
 * (Bun fetch + AI SDK readers exhibit this: AbortController.abort() closes
 * the connection but does not reject an already-pending reader.read()
 * promise, so the consumer's `for await` hangs forever).
 *
 * Pairs with `withStreamActivity` — the monitor's combined signal flips, this
 * wrapper guarantees the consumer's loop actually exits with the
 * AbortError. Requests upstream cleanup via `iter.return?.()` so
 * provider-side resources (response body, fetch socket) can be released,
 * but does not await that untrusted cleanup promise: some provider iterators
 * park `return()` on the same network read as `next()`, and awaiting it would
 * turn a completed cancellation back into an indefinitely pending one.
 */
const STREAM_EVENT_LOOP_YIELD_INTERVAL = 256

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function* abortableIterable<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T> {
  const iter = source[Symbol.asyncIterator]()
  let chunksSinceEventLoopYield = 0
  try {
    while (true) {
      if (signal.aborted) throw signal.reason
      let onAbort: (() => void) | null = null
      let result: IteratorResult<T>
      const abortPromise = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener("abort", onAbort, { once: true })
      })
      try {
        result = await Promise.race([iter.next(), abortPromise])
      } finally {
        if (onAbort) signal.removeEventListener("abort", onAbort)
      }
      if (result.done) return
      yield result.value

      chunksSinceEventLoopYield += 1
      if (chunksSinceEventLoopYield >= STREAM_EVENT_LOOP_YIELD_INTERVAL) {
        chunksSinceEventLoopYield = 0
        // Some provider/SDK iterators can resolve next() immediately forever
        // while emitting only non-semantic chunks. Promise/microtask fairness
        // alone cannot let timer-backed idle and cancellation authorities run.
        await yieldToEventLoop()
      }
    }
  } finally {
    try {
      const cleanup = iter.return?.()
      if (cleanup) {
        if (signal.aborted) void Promise.resolve(cleanup).catch(() => undefined)
        else await cleanup
      }
    } catch {
      /* upstream already torn down */
    }
  }
}

export function withStreamActivity(options: StreamActivityOptions): StreamActivityMonitor {
  if (!Number.isFinite(options.idleMs) || options.idleMs <= 0) {
    throw new Error(`withStreamActivity: idleMs must be a positive finite number (got ${options.idleMs})`)
  }
  const label = options.label ?? "stream"
  const inactivity = new AbortController()
  const manual = new AbortController()
  const combined = options.signal
    ? AbortSignal.any([options.signal, inactivity.signal, manual.signal])
    : AbortSignal.any([inactivity.signal, manual.signal])

  let last = Date.now()
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Pause depth — `pause()` increments, `resume()` decrements. The timer is
   *  scheduled only when depth === 0. Allows nested pause regions (e.g. one
   *  tool dispatched inside another). */
  let pauseDepth = 0

  const trip = () => {
    if (disposed) return
    if (inactivity.signal.aborted) return
    inactivity.abort(new DOMException(`stream idle > ${options.idleMs}ms (${label})`, "AbortError"))
  }

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = () => {
    if (disposed) return
    clear()
    if (pauseDepth > 0) return
    timer = setTimeout(trip, options.idleMs)
    // Timer is intentionally ref'd: unref would let Bun idle out while an
    // async iterator is parked on `await new Promise`, defeating the monitor.
  }

  schedule()

  return {
    signal: combined,
    observe() {
      if (disposed) return
      last = Date.now()
      schedule()
    },
    pause() {
      if (disposed) return
      pauseDepth++
      clear()
    },
    resume() {
      if (disposed) return
      if (pauseDepth === 0) return
      pauseDepth--
      if (pauseDepth === 0) {
        last = Date.now()
        schedule()
      }
    },
    paused() {
      return !disposed && pauseDepth > 0
    },
    lastActivityAt() {
      return last
    },
    timedOut() {
      return inactivity.signal.aborted
    },
    abort(reason?: unknown) {
      if (disposed) return
      if (manual.signal.aborted) return
      manual.abort(reason ?? new DOMException(`stream aborted (${label})`, "AbortError"))
    },
    dispose() {
      if (disposed) return
      disposed = true
      clear()
    },
  }
}
