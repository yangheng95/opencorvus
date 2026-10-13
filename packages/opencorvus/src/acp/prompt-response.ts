import { RequestError, type PromptResponse, type StopReason } from "@agentclientprotocol/sdk"
import type { SessionMessageResponse } from "@opencorvus-ai/sdk"
import { buildHardErrorFromFinalMessage } from "@/agent/run-error"
import { isSettledReplyToUserMessage } from "@/session/completed-reply"
import { Message } from "@/session/message"

export function acpCompactionResponse(input: {
  sessionID: string
  response: { data?: boolean; error?: unknown }
}): PromptResponse {
  if (input.response.error !== undefined) {
    throw RequestError.internalError(
      { sessionID: input.sessionID, error: input.response.error },
      "OpenCorvus session compaction request failed",
    )
  }
  if (input.response.data !== true) {
    throw RequestError.internalError({ sessionID: input.sessionID }, "OpenCorvus session compaction did not complete")
  }
  return { stopReason: "end_turn", _meta: {} }
}

export function acpPromptResponse(input: {
  sessionID: string
  inputMessageID: string
  response: { data?: SessionMessageResponse; error?: unknown }
}): PromptResponse {
  const identity = { sessionID: input.sessionID, inputMessageID: input.inputMessageID }
  if (input.response.error !== undefined) {
    throw RequestError.internalError({ ...identity, error: input.response.error }, "OpenCorvus prompt request failed")
  }
  const parsed = Message.WithParts.safeParse(input.response.data)
  const reply = parsed.success ? parsed.data : undefined
  if (!reply || reply.info.sessionID !== input.sessionID || !isSettledReplyToUserMessage(reply, input.inputMessageID)) {
    throw RequestError.internalError(identity, "OpenCorvus returned no settled assistant reply for this input")
  }
  const msg = reply.info
  const diagnostic = { ...identity, finalMessageID: msg.id, error: msg.error }
  let stopReason: StopReason
  if (msg.error && Message.AbortedError.isInstance(msg.error)) {
    stopReason = "cancelled"
  } else if (msg.error && Message.OutputLengthError.isInstance(msg.error)) {
    stopReason = "max_tokens"
  } else if (!msg.error && msg.finish === "length") {
    stopReason = "max_tokens"
  } else {
    // Preserve hard failures even if the stream also reported a stop reason.
    const hardError = buildHardErrorFromFinalMessage({ kind: "assistant", agentName: msg.agent, finalMessage: reply })
    if (hardError) throw RequestError.internalError(diagnostic, hardError.message)
    switch (msg.finish) {
      case "content-filter":
        stopReason = "refusal"
        break
      case "stop":
      case "tool-calls":
        stopReason = "end_turn"
        break
      default:
        throw RequestError.internalError(diagnostic, `OpenCorvus returned an unsupported finish reason: ${msg.finish}`)
    }
  }
  return {
    stopReason,
    usage: {
      totalTokens: msg.tokens.total,
      inputTokens: msg.tokens.input,
      outputTokens: msg.tokens.output,
      thoughtTokens: msg.tokens.reasoning || undefined,
      cachedReadTokens: msg.tokens.cache.read || undefined,
      cachedWriteTokens: msg.tokens.cache.write || undefined,
    },
    _meta: {},
  }
}
