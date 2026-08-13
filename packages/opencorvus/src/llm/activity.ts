/**
 * LLMActivity — single-source lifecycle for one logical LLM provider call,
 * including all internal retries, heartbeat monitoring, error classification,
 * backoff, and terminal events.
 *
 * Design: LLM activity redesign contract
 *
 * Composition:
 *   - Reuses util/stream-activity.ts as the inner mid-stream idle monitor;
 *     the activity layer adds first-byte timer, total deadline (across
 *     retries + sleeps), retry scheduler with classified backoff, and
 *     three-state terminal events.
 *
 * Strict invariants enforced by this module:
 *   1. Exactly one `started` and one `terminal` per activity ID.
 *   2. terminal outcome ∈ { "done", "failed", "aborted" }, mutually exclusive.
 *   3. heartbeat / paused / resumed events do not appear after terminal.
 *   4. retry attempts are monotonically increasing (1, 2, 3, …).
 *   5. winner cause (which abort source fired first) is preserved on the abort
 *     reason via the `_activity_cause` marker; classify() reads it from
 *     there, NEVER from string-matching AbortError.message.
 *
 * Why this exists: see incident report on tasks tsk_ddc529dfd0011ajJTgBqdlroyk
 * (G3 quota-exceeded infinite retry, G4 TLS terminal-event triple-fire).
 * Both fed back to the same root cause — there was no single layer that
 * owned "one LLM call, end to end, with bounded retries and one terminal".
 */

import { Identifier } from "@/id/id"
import { SessionStatus } from "@/session/status"
import { withStreamActivity, type StreamActivityMonitor } from "@/util/stream-activity"
import { APICallError } from "ai"
import { ProviderError } from "@/provider/error"

/**
 * Mutually exclusive error categories. Priority (high → low) when multiple
 * abort sources fire near-simultaneously: external_abort > total_timeout > first_byte
 * > idle > everything else. Priority is enforced via AbortSignal.any()'s
 * spec'd behaviour (first source to abort wins) plus our `_activity_cause`
 * marker on the reason DOMException.
 */
export type ErrorClass =
  | "external_abort"
  | "total_timeout"
  | "first_byte"
  | "idle"
  | "rate_limit"
  | "quota_exhausted"
  | "tls"
  | "network"
  | "server_5xx"
  | "stream_protocol"
  | "client_4xx"
  | "request_timeout"
  | "payload_too_large"
  | "context_overflow"
  | "unknown"

/**
 * The provider adapter MUST emit one of these on every real upstream event
 * so the idle monitor has accurate liveness signal. Missing kinds is the most
 * common cause of false-positive idle trips, so this list is the canonical
 * boundary, not a suggestion. See HEARTBEAT_FIRST_BYTE for which kinds count
 * as the first byte that hands off from the first-byte timer to the idle monitor.
 */
export type HeartbeatKind =
  | "first-byte"
  | "text-delta"
  | "reasoning-delta"
  | "tool-input-start"
  | "tool-input-delta"
  | "tool-input-end"
  | "tool-call"
  | "tool-result"
  | "tool-error"
  | "step-start"
  | "step-finish"
  | "manual"

/**
 * Map AI SDK fullStream chunks to semantic progress. Physical transport
 * arrival is reported separately as `first-byte`: unknown, empty, and no-op
 * chunks prove only that bytes are moving and cannot extend semantic idle.
 */
export function chunkHeartbeatKind(chunk: Record<string, unknown>): HeartbeatKind | null {
  const nonEmpty = (...keys: string[]) =>
    keys.some((key) => typeof chunk[key] === "string" && (chunk[key] as string).length > 0)
  switch (chunk?.type) {
    case "start":
      return null
    case "start-step":
      return "step-start"
    case "finish-step":
      return "step-finish"
    case "finish":
      return null
    case "text-start":
    case "text-end":
      return nonEmpty("id") ? "text-delta" : null
    case "text-delta":
      return nonEmpty("text") ? "text-delta" : null
    case "reasoning-start":
    case "reasoning-end":
      return nonEmpty("id") ? "reasoning-delta" : null
    case "reasoning-delta":
      return nonEmpty("text") ? "reasoning-delta" : null
    case "tool-input-start":
      return nonEmpty("toolCallId", "id") && nonEmpty("toolName") ? "tool-input-start" : null
    case "tool-input-delta":
      return nonEmpty("toolCallId", "id") && nonEmpty("inputTextDelta", "delta") ? "tool-input-delta" : null
    case "tool-input-end":
      return nonEmpty("toolCallId", "id") ? "tool-input-end" : null
    case "tool-call":
      return nonEmpty("toolCallId") && nonEmpty("toolName") ? "tool-call" : null
    case "tool-result":
      return "tool-result"
    case "tool-error":
      return "tool-error"
    default:
      return null
  }
}

/** Any of these counts as "first byte received" for the monitor handoff. */
const HEARTBEAT_FIRST_BYTE: ReadonlySet<HeartbeatKind> = new Set([
  "first-byte",
  "text-delta",
  "reasoning-delta",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
  "tool-call",
  "tool-result",
  "tool-error",
  "step-start",
  "step-finish",
  "manual",
])

export type LLMActivityEvent =
  | {
      type: "started"
      id: string
      ts: number
      sessionID: string
      provider: string
      model: string
    }
  | { type: "heartbeat"; id: string; ts: number; kind: HeartbeatKind }
  | { type: "paused"; id: string; ts: number; reason: string }
  | { type: "resumed"; id: string; ts: number; reason: string }
  | {
      type: "retry"
      id: string
      ts: number
      attempt: number
      cls: ErrorClass
      backoffMs: number
      reason: string
      lastHeartbeat?: { kind: HeartbeatKind; ts: number }
    }
  | {
      type: "terminal"
      id: string
      ts: number
      outcome: "done" | "failed" | "aborted"
      cls?: ErrorClass
      error?: { name: string; message: string }
    }

export interface LLMActivityContext {
  sessionID: string
  provider: string
  model: string
}

export interface ClassifyContext {
  httpStatus?: number
  bodyHead?: string
  abortReason?: unknown
}

export interface LLMActivityPolicy {
  /** Hard cap from start to terminal across all retries + backoff sleeps.
   *  Once exceeded, the activity terminates as failed cls=total_timeout
   *  even if the attempt or sleep is still in flight. */
  totalMs: number

  /** Mid-stream silence threshold. Started lazily on first heartbeat;
   *  before that the first-byte timer is responsible. */
  idleMs: number

  /** Maximum gap between request dispatch and first heartbeat. Once any
   *  heartbeat is observed, this timer is cleared and idle monitoring takes over. */
  firstByteMs: number

  /** Per-class retry caps. Non-retryable classes (external_abort,
   *  total_timeout, client_4xx, request_timeout, payload_too_large,
   *  context_overflow) ignore these — shouldRetry hard-rejects them. */
  maxRetries: Partial<Record<ErrorClass, number>> & { default: number }

  classify(err: unknown, ctx: ClassifyContext): ErrorClass
  /** Pure-class retryability. Return false for hard non-retryable categories
   *  (external_abort, total_timeout, client_4xx, request_timeout,
   *  payload_too_large, context_overflow). The runner combines this with
   *  the attempt cap (from maxRetries) and the remaining total deadline —
   *  callers do NOT also re-implement those checks here. */
  isRetryable(cls: ErrorClass): boolean
  /** Must return ≤ remainingTotalMs; runner will additionally clamp to
   *  remaining and race the sleep against external+total deadlines. */
  backoffMs(cls: ErrorClass, attempt: number, remainingTotalMs: number): number
}

export class LLMActivityError extends Error {
  override name: "LLMActivityError" | "LLMActivityAbortedError" = "LLMActivityError"
  constructor(
    public readonly cls: ErrorClass,
    public readonly attempts: number,
    public override readonly cause?: unknown,
    message?: string,
  ) {
    super(message ?? `LLMActivity failed cls=${cls} attempts=${attempts}`)
  }
}

export class LLMActivityAbortedError extends LLMActivityError {
  override name = "LLMActivityAbortedError" as const
  constructor(attempts: number, cause?: unknown) {
    super("external_abort", attempts, cause, "LLMActivity aborted by external signal")
  }
}

export interface LLMActivityRun {
  /** Composite signal: external | total | first-byte | idle. Each source
   *  carries an `_activity_cause` marker on its DOMException reason so
   *  classify() can recover the cause without string-matching. */
  signal: AbortSignal
  /** Refresh liveness on every real upstream event. */
  bump(kind: HeartbeatKind): void
  /** Suspend idle monitoring (e.g. while a long synchronous tool call runs).
   *  Distinct owners nest; acquiring the same owner again is idempotent.
   *  Pair each owner with one matching resume(). */
  pause(owner: string): void
  resume(owner: string): void
  /** 0-indexed attempt counter. */
  attempt: number
}

export interface LLMActivityRetryBoundary {
  event: Extract<LLMActivityEvent, { type: "retry" }>
  error: unknown
}

export interface LLMActivityOptions {
  beforeRetry?: (input: LLMActivityRetryBoundary) => void | Promise<void>
}

// ---- Default policy --------------------------------------------------------

function classify(err: unknown, ctx: ClassifyContext): ErrorClass {
  // Highest priority — the abort reason carries an explicit cause marker
  // we set ourselves (no string-matching).
  const reason = ctx.abortReason
  if (reason && typeof reason === "object" && "_activity_cause" in (reason as object)) {
    const cause = (reason as { _activity_cause: ErrorClass })._activity_cause
    if (cause === "external_abort" || cause === "total_timeout" || cause === "first_byte" || cause === "idle") {
      return cause
    }
  }

  // HTTP status — APICallError carries it directly; ctx.httpStatus is the
  // explicit override path for callers that already extracted it.
  let httpStatus = ctx.httpStatus
  let bodyHead = ctx.bodyHead
  const message = err instanceof Error ? err.message : String(err)
  if (APICallError.isInstance(err)) {
    httpStatus = httpStatus ?? err.statusCode
    bodyHead = bodyHead ?? (typeof err.responseBody === "string" ? err.responseBody.slice(0, 1024) : undefined)
  }
  if (typeof httpStatus === "number") {
    if (httpStatus === 408) return "request_timeout"
    if (httpStatus === 413) return "payload_too_large"
    if (httpStatus === 429) {
      if (
        ProviderError.quotaExhaustedSignal({
          statusCode: httpStatus,
          responseBody: bodyHead,
          message,
        })
      ) {
        return "quota_exhausted"
      }
      return "rate_limit"
    }
    if (httpStatus >= 500 && httpStatus < 600) return "server_5xx"
    if (httpStatus >= 400 && httpStatus < 500) {
      // 422 with context-overflow body wording is provider-specific;
      // prefer context_overflow when the body shouts about token limits.
      if (
        bodyHead &&
        /context.{0,12}overflow|maximum context|context.{0,8}length|too many tokens|prompt is too long|exceeds.*context|range of input length should be/i.test(
          bodyHead,
        )
      ) {
        return "context_overflow"
      }
      return "client_4xx"
    }
  }

  if (
    /context.{0,12}overflow|maximum context|context.{0,8}length|too many tokens|prompt is too long|exceeds.*context|range of input length should be/i.test(
      message,
    )
  ) {
    return "context_overflow"
  }
  if (/certificate|TLS|SSL|self.signed|handshake/i.test(message)) return "tls"
  if (/Unexpected end|Unterminated|invalid SSE|tool_use missing|malformed stream|invalid frame/i.test(message)) {
    return "stream_protocol"
  }
  if (
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|socket connection was closed unexpectedly/i.test(
      message,
    )
  ) {
    return "network"
  }
  return "unknown"
}

function isRetryable(cls: ErrorClass): boolean {
  return !(
    cls === "external_abort" ||
    cls === "total_timeout" ||
    cls === "quota_exhausted" ||
    cls === "client_4xx" ||
    cls === "request_timeout" ||
    cls === "payload_too_large" ||
    cls === "context_overflow"
  )
}

function backoffMs(cls: ErrorClass, attempt: number, remainingTotalMs: number): number {
  const baseByCls: Partial<Record<ErrorClass, number>> = {
    rate_limit: 5_000,
    tls: 1_000,
    network: 1_000,
    server_5xx: 2_000,
    stream_protocol: 1_500,
    idle: 1_000,
    first_byte: 1_000,
    unknown: 2_000,
  }
  const capByCls: Partial<Record<ErrorClass, number>> = { rate_limit: 60_000 }
  const base = baseByCls[cls] ?? 2_000
  const cap = capByCls[cls] ?? 30_000
  const exp = Math.min(cap, base * Math.pow(2, attempt))
  const jittered = exp + Math.random() * Math.min(1_000, exp * 0.2)
  return Math.min(jittered, Math.max(0, remainingTotalMs))
}

export const DefaultLLMActivityPolicy: LLMActivityPolicy = {
  totalMs: 60 * 60_000,
  idleMs: 180_000,
  firstByteMs: 5 * 60_000,
  maxRetries: { default: 5, rate_limit: 15 },
  classify,
  isRetryable,
  backoffMs,
}

// ---- Internals -------------------------------------------------------------

interface MarkedReason extends DOMException {
  _activity_cause: ErrorClass
}

function makeAbortReason(cause: ErrorClass, message: string): MarkedReason {
  const e = new DOMException(message, "AbortError") as MarkedReason
  Object.defineProperty(e, "_activity_cause", { value: cause, enumerable: true })
  return e
}

function readAbortCause(reason: unknown): ErrorClass | undefined {
  if (reason && typeof reason === "object" && "_activity_cause" in (reason as object)) {
    return (reason as MarkedReason)._activity_cause
  }
  return undefined
}

function sleepRace(ms: number, externalProxy: AbortSignal, total: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const cleanup = () => {
      clearTimeout(timer)
      externalProxy.removeEventListener("abort", onAbort)
      total.removeEventListener("abort", onAbort)
    }
    const onAbort = () => {
      cleanup()
      resolve()
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    if (externalProxy.aborted || total.aborted) onAbort()
    else {
      externalProxy.addEventListener("abort", onAbort, { once: true })
      total.addEventListener("abort", onAbort, { once: true })
    }
  })
}

// ---- Public runner ---------------------------------------------------------

export async function withLLMActivity<T>(
  ctx: LLMActivityContext,
  policy: LLMActivityPolicy,
  external: AbortSignal,
  attemptFn: (run: LLMActivityRun) => Promise<T>,
  sink: (event: LLMActivityEvent) => void,
  options: LLMActivityOptions = {},
): Promise<T> {
  // Surface bad numeric config loudly. firstByteMs and idleMs intentionally
  // have no ordering constraint: first-byte runs before the first upstream
  // event, while idle starts only after that event.
  if (!Number.isFinite(policy.totalMs) || policy.totalMs <= 0) {
    throw new Error(`LLMActivityPolicy.totalMs must be positive (got ${policy.totalMs})`)
  }
  if (!Number.isFinite(policy.idleMs) || policy.idleMs <= 0) {
    throw new Error(`LLMActivityPolicy.idleMs must be positive (got ${policy.idleMs})`)
  }
  if (!Number.isFinite(policy.firstByteMs) || policy.firstByteMs <= 0) {
    throw new Error(`LLMActivityPolicy.firstByteMs must be positive (got ${policy.firstByteMs})`)
  }

  const id = Identifier.ascending("activity")
  const startedAt = Date.now()
  let pausedStartedAt: number | undefined
  let pausedTotalMs = 0
  const pauseOwners = new Set<string>()
  let totalTimer: ReturnType<typeof setTimeout> | undefined
  const activeElapsedMs = () => {
    const livePausedMs = pausedStartedAt === undefined ? 0 : Date.now() - pausedStartedAt
    return Math.max(0, Date.now() - startedAt - pausedTotalMs - livePausedMs)
  }
  const remainingTotalMs = () => Math.max(0, policy.totalMs - activeElapsedMs())

  let terminalEmitted = false

  const emitStarted = () => {
    sink({
      type: "started",
      id,
      ts: startedAt,
      sessionID: ctx.sessionID,
      provider: ctx.provider,
      model: ctx.model,
    })
  }

  const emitTerminal = (outcome: "done" | "failed" | "aborted", cls?: ErrorClass, err?: unknown) => {
    if (terminalEmitted) return
    terminalEmitted = true
    sink({
      type: "terminal",
      id,
      ts: Date.now(),
      outcome,
      cls,
      error: err instanceof Error ? { name: err.name, message: err.message } : undefined,
    })
  }

  emitStarted()

  // External signal proxy preserves the initiating boundary's exact reason.
  // Classification remains external_abort, while provenance stays available
  // to the Session processor and durable assistant error.
  const externalProxy = new AbortController()
  const onExternal = () => {
    if (externalProxy.signal.aborted) return
    externalProxy.abort(external.reason)
  }
  if (external.aborted) onExternal()
  else external.addEventListener("abort", onExternal)

  // Total deadline — single timer across the whole activity's active LLM time.
  // `run.pause()` marks periods where the provider stream is waiting for a
  // tool/sub-agent and no LLM inactivity has occurred; those periods do not
  // consume totalMs. Retry backoff is not a pause and remains counted.
  const totalCtrl = new AbortController()
  const armTotalTimer = () => {
    if (totalTimer) clearTimeout(totalTimer)
    totalTimer = undefined
    if (totalCtrl.signal.aborted || pauseOwners.size > 0) return
    const remain = remainingTotalMs()
    if (remain <= 0) {
      totalCtrl.abort(makeAbortReason("total_timeout", `LLMActivity total deadline ${policy.totalMs}ms exceeded`))
      return
    }
    totalTimer = setTimeout(() => {
      totalCtrl.abort(makeAbortReason("total_timeout", `LLMActivity total deadline ${policy.totalMs}ms exceeded`))
    }, remain)
  }
  const beginPause = (owner: string) => {
    if (pauseOwners.has(owner)) return false
    pauseOwners.add(owner)
    if (pauseOwners.size !== 1) return true
    pausedStartedAt = Date.now()
    if (totalTimer) clearTimeout(totalTimer)
    totalTimer = undefined
    return true
  }
  const endPause = (owner: string) => {
    if (!pauseOwners.delete(owner)) return false
    if (pauseOwners.size !== 0) return true
    if (pausedStartedAt !== undefined) {
      pausedTotalMs += Date.now() - pausedStartedAt
      pausedStartedAt = undefined
    }
    armTotalTimer()
    return true
  }
  const closePauseWindow = () => {
    if (pauseOwners.size <= 0) return
    if (pausedStartedAt !== undefined) {
      pausedTotalMs += Date.now() - pausedStartedAt
      pausedStartedAt = undefined
    }
    pauseOwners.clear()
    armTotalTimer()
  }
  armTotalTimer()

  let attempt = 0

  try {
    while (true) {
      // Pre-attempt deadline check — covers the case where the prior attempt
      // returned but a deadline has since fired and we shouldn't start a new
      // attempt.
      if (externalProxy.signal.aborted) {
        const cause = readAbortCause(externalProxy.signal.reason) ?? "external_abort"
        emitTerminal("aborted", cause, externalProxy.signal.reason)
        throw new LLMActivityAbortedError(attempt, externalProxy.signal.reason)
      }
      if (totalCtrl.signal.aborted) {
        emitTerminal("failed", "total_timeout", totalCtrl.signal.reason)
        throw new LLMActivityError("total_timeout", attempt, totalCtrl.signal.reason)
      }
      if (remainingTotalMs() <= 0) {
        const reason = makeAbortReason("total_timeout", `LLMActivity total deadline ${policy.totalMs}ms exceeded`)
        totalCtrl.abort(reason)
        emitTerminal("failed", "total_timeout", reason)
        throw new LLMActivityError("total_timeout", attempt, reason)
      }

      // Per-attempt: first-byte timer + lazy idle monitor.
      const firstByteCtrl = new AbortController()
      const firstByteTimer = setTimeout(() => {
        firstByteCtrl.abort(makeAbortReason("first_byte", `LLMActivity first byte > ${policy.firstByteMs}ms`))
      }, policy.firstByteMs)
      let firstByteSeen = false

      // Held in a 1-element holder so TypeScript narrowing inside the inner
      // closures (bump/pause/resume) doesn't collapse the type to null after
      // the synchronous initialiser. With `let idleMonitor: T | null = null`
      // the compiler narrows `idleMonitor` to `never` when it sees `idleMonitor?.x`
      // because no in-scope assignment widens it back.
      const idleHolder: { monitor: StreamActivityMonitor | null } = { monitor: null }
      let unregisterActivityMonitor: (() => void) | undefined
      const idleCtrl = new AbortController()
      let lastHeartbeat: { kind: HeartbeatKind; ts: number } | undefined

      const composed = AbortSignal.any([externalProxy.signal, totalCtrl.signal, firstByteCtrl.signal, idleCtrl.signal])

      const startIdleMonitor = () => {
        if (idleHolder.monitor) return
        const monitor = withStreamActivity({ idleMs: policy.idleMs, label: `act:${id}` })
        idleHolder.monitor = monitor
        unregisterActivityMonitor = SessionStatus.registerActivityMonitor(ctx.sessionID, monitor)
        monitor.signal.addEventListener("abort", () => {
          if (monitor.timedOut() && !idleCtrl.signal.aborted) {
            idleCtrl.abort(makeAbortReason("idle", `LLMActivity idle > ${policy.idleMs}ms`))
          }
        })
      }
      const disposeIdleMonitor = () => {
        unregisterActivityMonitor?.()
        unregisterActivityMonitor = undefined
        idleHolder.monitor?.dispose()
        idleHolder.monitor = null
      }

      const run: LLMActivityRun = {
        signal: composed,
        attempt,
        bump: (kind: HeartbeatKind) => {
          if (terminalEmitted) return
          if (kind === "first-byte" && firstByteSeen) return
          if (!firstByteSeen && HEARTBEAT_FIRST_BYTE.has(kind)) {
            firstByteSeen = true
            clearTimeout(firstByteTimer)
            startIdleMonitor()
            const ts = Date.now()
            lastHeartbeat = { kind: "first-byte", ts }
            sink({ type: "heartbeat", id, ts, kind: "first-byte" })
            // Fall through and also emit the original kind unless caller
            // explicitly bumped "first-byte" (in which case we already did).
            if (kind === "first-byte") return
          }
          idleHolder.monitor?.observe()
          const ts = Date.now()
          lastHeartbeat = { kind, ts }
          sink({ type: "heartbeat", id, ts, kind })
        },
        pause: (owner: string) => {
          if (terminalEmitted) return
          if (!beginPause(owner)) return
          idleHolder.monitor?.pause()
          sink({ type: "paused", id, ts: Date.now(), reason: owner })
        },
        resume: (owner: string) => {
          if (terminalEmitted) return
          if (!endPause(owner)) return
          idleHolder.monitor?.resume()
          sink({ type: "resumed", id, ts: Date.now(), reason: owner })
        },
      }

      try {
        const value = await attemptFn(run)
        closePauseWindow()
        clearTimeout(firstByteTimer)
        disposeIdleMonitor()
        if (externalProxy.signal.aborted || external.aborted) {
          emitTerminal("aborted", "external_abort", externalProxy.signal.reason)
          throw new LLMActivityAbortedError(attempt, externalProxy.signal.reason)
        }
        if (totalCtrl.signal.aborted || remainingTotalMs() <= 0) {
          const reason =
            totalCtrl.signal.reason ??
            makeAbortReason("total_timeout", `LLMActivity total deadline ${policy.totalMs}ms exceeded`)
          if (!totalCtrl.signal.aborted) totalCtrl.abort(reason)
          emitTerminal("failed", "total_timeout", reason)
          throw new LLMActivityError("total_timeout", attempt, reason)
        }
        emitTerminal("done")
        return value
      } catch (err) {
        closePauseWindow()
        clearTimeout(firstByteTimer)
        disposeIdleMonitor()

        // External takes priority over everything else — even if the throw
        // looks like a different class, an external abort means the caller
        // wants the activity stopped, not retried.
        if (externalProxy.signal.aborted || external.aborted) {
          emitTerminal("aborted", "external_abort", externalProxy.signal.reason ?? err)
          throw new LLMActivityAbortedError(attempt, externalProxy.signal.reason ?? err)
        }

        // Determine cause. Priority: composed.reason marker > APICallError
        // status > thrown error message.
        const composedReason = composed.aborted ? composed.reason : undefined
        const apiErr = APICallError.isInstance(err) ? err : undefined
        const cls = policy.classify(err, {
          httpStatus: apiErr?.statusCode,
          bodyHead: typeof apiErr?.responseBody === "string" ? apiErr.responseBody.slice(0, 1024) : undefined,
          abortReason: composedReason,
        })

        const remain = remainingTotalMs()
        // Three independent reasons NOT to retry, in priority order:
        //   1. cls itself is hard non-retryable (e.g. client_4xx, context_overflow)
        //   2. we've exhausted maxRetries[cls] / .default
        //   3. total deadline has 0 budget left → upgrade cls to total_timeout
        if (!policy.isRetryable(cls)) {
          emitTerminal("failed", cls, err)
          throw new LLMActivityError(cls, attempt, err)
        }
        const cap = policy.maxRetries[cls] ?? policy.maxRetries.default
        if (attempt >= cap) {
          emitTerminal("failed", cls, err)
          throw new LLMActivityError(cls, attempt, err)
        }
        if (remain <= 0) {
          emitTerminal("failed", "total_timeout", err)
          throw new LLMActivityError("total_timeout", attempt, err)
        }

        const wait = Math.max(0, Math.min(policy.backoffMs(cls, attempt, remain), remain))
        const retryEvent: Extract<LLMActivityEvent, { type: "retry" }> = {
          type: "retry",
          id,
          ts: Date.now(),
          attempt: attempt + 1,
          cls,
          backoffMs: wait,
          reason: err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : String(err).slice(0, 200),
          ...(lastHeartbeat ? { lastHeartbeat } : {}),
        }

        if (options.beforeRetry) {
          try {
            await options.beforeRetry({ event: retryEvent, error: err })
          } catch (retryBoundaryError) {
            emitTerminal("failed", cls, retryBoundaryError)
            throw new LLMActivityError(cls, attempt, retryBoundaryError)
          }
        }

        sink(retryEvent)

        await sleepRace(wait, externalProxy.signal, totalCtrl.signal)

        if (externalProxy.signal.aborted) {
          emitTerminal("aborted", "external_abort", externalProxy.signal.reason ?? err)
          throw new LLMActivityAbortedError(attempt + 1, externalProxy.signal.reason ?? err)
        }
        if (totalCtrl.signal.aborted) {
          emitTerminal("failed", "total_timeout", err)
          throw new LLMActivityError("total_timeout", attempt + 1, err)
        }

        attempt++
      }
    }
  } finally {
    if (totalTimer) clearTimeout(totalTimer)
    external.removeEventListener("abort", onExternal)
    if (!terminalEmitted) {
      // Defensive guard — every path above should have emitted, but if a
      // synchronous throw bypassed them, guarantee one terminal so
      // downstream subscribers can clean up.
      emitTerminal("failed", "unknown")
    }
  }
}
