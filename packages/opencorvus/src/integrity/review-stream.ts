import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import type { TextHooks } from "@/llm/api"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
} from "@/runtime/execution-settlement"
import { Log } from "@/util/log"

export type ReviewStreamPhase = "integrity"
export type ReviewStreamStep = "manifest" | "runtime" | "visual" | "specialist" | "agent" | "post_repair"

const log = Log.create({ service: "review-stream" })

function publishReviewEvent(operation: string, emit: () => Promise<unknown>): void {
  let authority
  try {
    authority = RuntimeExecutionSettlement.reserve("protocol_publication", `review-stream:${operation}`)
  } catch (error) {
    if (error instanceof RuntimeExecutionAdmissionClosedError) return
    throw error
  }
  let publication: Promise<unknown>
  try {
    publication = emit()
  } catch (error) {
    authority.settle()
    throw error
  }
  authority.settleWith(publication)
  void publication.catch((error) => {
    log.warn("review stream protocol publication failed", {
      operation,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}

export function reviewIDForIntegrity(sessionID: string): string {
  return `integrity:${sessionID}`
}

export function emitReviewStreamStarted(input: {
  taskID?: string
  reviewID?: string
  phase: ReviewStreamPhase
  sessionID?: string
  agentID: string
  source: string
}): void {
  if (!input.taskID || !input.reviewID) return
  publishReviewEvent("started", () =>
    EngineProtocol.emit(
      Event.ReviewStreamStarted,
      {
        taskID: input.taskID!,
        reviewID: input.reviewID!,
        phase: input.phase,
        sessionID: input.sessionID,
        agentID: input.agentID,
      },
      { source: input.source },
    ),
  )
}

export function emitReviewStreamProgress(input: {
  taskID?: string
  reviewID?: string
  phase: ReviewStreamPhase
  agentID: string
  currentStep?: ReviewStreamStep
  activity?: string
  reviewerID?: string
  roundID?: string
  attempt: number
  elapsedMs: number
  summary?: string
  source: string
}): void {
  if (!input.taskID || !input.reviewID) return
  publishReviewEvent("progress", () =>
    EngineProtocol.emit(
      Event.ReviewStreamProgress,
      {
        taskID: input.taskID!,
        reviewID: input.reviewID!,
        phase: input.phase,
        agentID: input.agentID,
        currentStep: input.currentStep,
        activity: input.activity,
        reviewerID: input.reviewerID,
        roundID: input.roundID,
        attempt: input.attempt,
        elapsedMs: input.elapsedMs,
        summary: input.summary,
      },
      { source: input.source },
    ),
  )
}

export function emitReviewStreamChunk(input: {
  taskID?: string
  reviewID?: string
  phase: ReviewStreamPhase
  agentID: string
  attempt: number
  delta: string
  source: string
}): void {
  if (!input.taskID || !input.reviewID) return
  if (!input.delta.replace(/[\[\]\s]/g, "")) return
  publishReviewEvent("chunk", () =>
    EngineProtocol.emit(
      Event.ReviewStreamChunk,
      {
        taskID: input.taskID!,
        reviewID: input.reviewID!,
        phase: input.phase,
        agentID: input.agentID,
        kind: "reasoning",
        delta: input.delta,
        attempt: input.attempt,
      },
      { source: input.source },
    ),
  )
}

export function createReviewReasoningForwarder(input: {
  taskID?: string
  reviewID?: string | (() => string | undefined)
  phase: ReviewStreamPhase
  agentID: string
  attempt: () => number
  source: string
}): TextHooks {
  const reviewID = () => (typeof input.reviewID === "function" ? input.reviewID() : input.reviewID)
  let buffer = ""
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    const delta = buffer
    buffer = ""
    emitReviewStreamChunk({
      taskID: input.taskID,
      reviewID: reviewID(),
      phase: input.phase,
      agentID: input.agentID,
      attempt: input.attempt(),
      delta,
      source: input.source,
    })
  }
  return {
    onChunk: async ({ chunk }) => {
      const value = chunk as { type?: string; text?: string }
      if (value.type !== "reasoning-delta") return
      const text = typeof value.text === "string" ? value.text : ""
      if (!text) return
      buffer += text
      if (!timer) timer = setTimeout(flush, 500)
    },
    onFinish: async () => flush(),
    onError: async (event) => {
      flush()
      log.warn("review stream forwarder saw LLM error", {
        phase: input.phase,
        reviewID: input.reviewID,
        error: event.error instanceof Error ? event.error.message : String(event.error),
      })
    },
    onAbort: async () => flush(),
  }
}
