import type { HeartbeatKind } from "../llm/activity"

export const LLM_STREAM_EVENT_TYPES = [
  "start",
  "start-step",
  "finish-step",
  "finish",
  "abort",
  "error",
  "raw",
  "text-start",
  "text-delta",
  "text-end",
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
  "tool-call",
  "tool-result",
  "tool-error",
  "tool-output-denied",
  "source",
  "file",
  "unknown",
] as const
export const LLM_STREAM_REJECTION_REASONS = [
  "missing_id",
  "empty_delta",
  "unknown_tool",
  "not_pending",
  "stream_mismatch",
  "duplicate_start",
  "control",
  "unsupported",
  "nonsemantic",
  "aborted",
] as const
export type LLMStreamRejectionReason = (typeof LLM_STREAM_REJECTION_REASONS)[number]
export type LLMStreamObservationPhase =
  | "not_started"
  | "awaiting_event"
  | "hook"
  | "handler"
  | "failed_hook"
  | "failed_handler"
  | "aborted"

export function llmStreamEventType(chunk: unknown): (typeof LLM_STREAM_EVENT_TYPES)[number] {
  try {
    const type = chunk && typeof chunk === "object" ? (chunk as Record<string, unknown>).type : undefined
    return LLM_STREAM_EVENT_TYPES.find((candidate) => candidate === type) ?? "unknown"
  } catch {
    return "unknown"
  }
}

const heartbeatKinds: readonly HeartbeatKind[] = [
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
]
function counts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>
}

/** Scalar bookkeeping only. It never retains a received chunk or changes execution. */
export function createLLMStreamObservation({ now = Date.now }: { now?: () => number } = {}) {
  let phase: LLMStreamObservationPhase = "not_started"
  const state = {
    received: 0,
    finished: 0,
    handlerAccepted: 0,
    heartbeatEligible: 0,
    heartbeats: 0,
    deltaUTF16Length: 0,
    deltaNonWhitespaceLength: 0,
    bookkeepingFailures: 0,
    startedAt: null as number | null,
    lastReceivedAt: null as number | null,
    lastHookFinishedAt: null as number | null,
    lastDecisionAt: null as number | null,
    lastHeartbeatAt: null as number | null,
    lastFinishedAt: null as number | null,
    lastFailureAt: null as number | null,
    types: counts(LLM_STREAM_EVENT_TYPES),
    reasons: counts(LLM_STREAM_REJECTION_REASONS),
    acceptedTypes: counts(LLM_STREAM_EVENT_TYPES),
    eligibleTypes: counts(LLM_STREAM_EVENT_TYPES),
    heartbeatTypes: counts(LLM_STREAM_EVENT_TYPES),
    heartbeatKinds: counts(heartbeatKinds),
    failures: counts(["hook", "handler", "abort"] as const),
  }
  const safe = (action: () => void) => {
    try {
      action()
    } catch {
      state.bookkeepingFailures++
    }
  }
  const time = () => {
    try {
      const value = now()
      if (!Number.isFinite(value)) throw new Error("Observation clock returned a nonfinite value")
      return value
    } catch {
      state.bookkeepingFailures++
      return null
    }
  }
  const failed = () => phase === "failed_hook" || phase === "failed_handler" || phase === "aborted"
  return {
    get phase(): LLMStreamObservationPhase {
      return phase
    },
    start() {
      safe(() => {
        phase = "awaiting_event"
        state.startedAt = time()
      })
    },
    received(chunk: unknown) {
      safe(() => {
        state.received++
        state.lastReceivedAt = time()
        if (!failed()) phase = "hook"
        const value = chunk && typeof chunk === "object" ? (chunk as Record<string, unknown>) : undefined
        const known = llmStreamEventType(chunk)
        state.types[known]++
        const delta =
          known === "tool-input-delta"
            ? typeof value?.inputTextDelta === "string"
              ? value.inputTextDelta
              : value?.delta
            : known === "text-delta" || known === "reasoning-delta"
              ? value?.text
              : undefined
        if (typeof delta === "string") {
          state.deltaUTF16Length += delta.length
          state.deltaNonWhitespaceLength += delta.replace(/\s/g, "").length
        }
      })
    },
    hookFinished() {
      safe(() => {
        state.lastHookFinishedAt = time()
        if (!failed()) phase = "handler"
      })
    },
    reject(reason: LLMStreamRejectionReason) {
      safe(() => {
        state.reasons[reason]++
      })
    },
    decision(handlerAccepted: boolean, heartbeatEligible: boolean, chunk?: unknown) {
      safe(() => {
        state.lastDecisionAt = time()
        const type = llmStreamEventType(chunk)
        if (handlerAccepted) {
          state.handlerAccepted++
          state.acceptedTypes[type]++
        }
        if (heartbeatEligible) {
          state.heartbeatEligible++
          state.eligibleTypes[type]++
        }
      })
    },
    heartbeat(kind: HeartbeatKind, chunk?: unknown) {
      safe(() => {
        state.heartbeats++
        state.heartbeatKinds[kind]++
        state.lastHeartbeatAt = time()
        state.heartbeatTypes[llmStreamEventType(chunk)]++
      })
    },
    chunkFinished() {
      safe(() => {
        state.finished++
        state.lastFinishedAt = time()
        if (!failed()) phase = "awaiting_event"
      })
    },
    failed(stage: "hook" | "handler" | "abort") {
      safe(() => {
        phase = stage === "abort" ? "aborted" : stage === "hook" ? "failed_hook" : "failed_handler"
        state.failures[stage]++
        state.lastFailureAt = time()
      })
    },
    snapshot() {
      return {
        ...state,
        phase,
        types: { ...state.types },
        reasons: { ...state.reasons },
        acceptedTypes: { ...state.acceptedTypes },
        eligibleTypes: { ...state.eligibleTypes },
        heartbeatTypes: { ...state.heartbeatTypes },
        heartbeatKinds: { ...state.heartbeatKinds },
        failures: { ...state.failures },
      }
    },
  }
}
