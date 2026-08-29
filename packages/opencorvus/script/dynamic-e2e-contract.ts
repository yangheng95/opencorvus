type ProviderRequest = {
  id: string
  assistant_message_id: string
  time_created: number
}

type ProviderOutcome = {
  request_id: string
  time_created: number
  data: { outcome?: unknown; attempt_count?: unknown }
}

type AssistantMessageRef = {
  id: string
  sessionID: string
}

type WorkerTranscriptMessage = {
  info: {
    id: string
    sessionID: string
    role: string
    time?: { completed?: unknown }
    finish?: unknown
  }
  parts: Array<{ type?: unknown; text?: unknown }>
}

type WorkerLifecycleReceipt = {
  payload?: {
    inputMessageID?: unknown
    status?: {
      type?: unknown
      reason?: unknown
      final_message_id?: unknown
    }
  }
}

export type ProviderExecutionInterval = {
  requestID: string
  sessionID: string
  startedAt: number
  completedAt: number
}

export function requireAuthoritativeCompletedWorkerFinalMessage<T extends WorkerTranscriptMessage>(input: {
  sessionID: string
  inputMessageID: string
  lifecycle: WorkerLifecycleReceipt | undefined
  canonicalFinalMessageID: string | undefined
  messages: readonly T[]
}): T {
  const payload = input.lifecycle?.payload
  if (!payload) {
    throw new Error(
      `Worker Session ${input.sessionID} has no persisted lifecycle receipt for input ${input.inputMessageID}.`,
    )
  }
  if (payload.inputMessageID !== input.inputMessageID) {
    throw new Error(
      `Worker Session ${input.sessionID} lifecycle receipt does not bind input ${input.inputMessageID}.`,
    )
  }
  const status = payload.status
  if (status?.type !== "terminal" || status.reason !== "completed") {
    throw new Error(
      `Worker Session ${input.sessionID} input ${input.inputMessageID} did not settle as completed.`,
    )
  }
  const finalMessageID = typeof status.final_message_id === "string" ? status.final_message_id.trim() : ""
  if (!finalMessageID) {
    throw new Error(
      `Worker Session ${input.sessionID} completed lifecycle receipt has no final_message_id.`,
    )
  }
  const message = input.messages.find((candidate) => candidate.info.id === finalMessageID)
  if (!message) {
    throw new Error(
      `Worker Session ${input.sessionID} lifecycle final Message ${finalMessageID} is not visible in the Task transcript.`,
    )
  }
  if (message.info.sessionID !== input.sessionID) {
    throw new Error(
      `Worker Session ${input.sessionID} lifecycle final Message ${finalMessageID} belongs to Session ${message.info.sessionID}.`,
    )
  }
  if (input.canonicalFinalMessageID !== finalMessageID) {
    throw new Error(
      `Worker Session ${input.sessionID} lifecycle final Message ${finalMessageID} is not the canonical completed reply to input ${input.inputMessageID}.`,
    )
  }
  if (
    message.info.role !== "assistant" ||
    typeof message.info.time?.completed !== "number" ||
    !message.info.finish ||
    !message.parts.some((part) => part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0)
  ) {
    throw new Error(
      `Worker Session ${input.sessionID} lifecycle final Message ${finalMessageID} is not a completed visible assistant reply.`,
    )
  }
  return message
}

export function requireSingleAttemptProviderActivities(input: {
  requests: readonly ProviderRequest[]
  outcomes: readonly ProviderOutcome[]
}): void {
  const outcomeByRequest = new Map(input.outcomes.map((outcome) => [outcome.request_id, outcome]))
  for (const request of input.requests) {
    const outcome = outcomeByRequest.get(request.id)
    if (!outcome || outcome.data.outcome !== "done") {
      throw new Error(`Provider activity ${request.id} has no done terminal receipt.`)
    }
    if (outcome.data.attempt_count !== 1) {
      throw new Error(
        `Provider activity ${request.id} used ${String(outcome.data.attempt_count)} attempts; exactly one is required.`,
      )
    }
  }
}

export function requireCrossSessionProviderExecutionOverlap(input: {
  sessionIDs: readonly string[]
  messages: readonly AssistantMessageRef[]
  requests: readonly ProviderRequest[]
  outcomes: readonly ProviderOutcome[]
}): { activities: ProviderExecutionInterval[]; overlapMs: number } {
  const expectedSessions = new Set(input.sessionIDs)
  const sessionByMessage = new Map(input.messages.map((message) => [message.id, message.sessionID]))
  const outcomeByRequest = new Map(input.outcomes.map((outcome) => [outcome.request_id, outcome]))
  const activities = input.requests.flatMap((request): ProviderExecutionInterval[] => {
    const sessionID = sessionByMessage.get(request.assistant_message_id)
    const outcome = outcomeByRequest.get(request.id)
    if (!sessionID || !expectedSessions.has(sessionID) || !outcome || outcome.data.outcome !== "done") return []
    if (outcome.time_created <= request.time_created) {
      throw new Error(`Provider activity ${request.id} has a non-positive execution interval.`)
    }
    return [
      {
        requestID: request.id,
        sessionID,
        startedAt: request.time_created,
        completedAt: outcome.time_created,
      },
    ]
  })
  for (const sessionID of expectedSessions) {
    if (!activities.some((activity) => activity.sessionID === sessionID)) {
      throw new Error(`Worker Session ${sessionID} has no completed Provider activity.`)
    }
  }
  let overlapMs = 0
  for (const left of activities) {
    for (const right of activities) {
      if (left.sessionID >= right.sessionID) continue
      overlapMs = Math.max(
        overlapMs,
        Math.min(left.completedAt, right.completedAt) - Math.max(left.startedAt, right.startedAt),
      )
    }
  }
  if (overlapMs <= 0) {
    throw new Error(`Worker Provider executions did not overlap: ${JSON.stringify(activities)}`)
  }
  return { activities, overlapMs }
}
