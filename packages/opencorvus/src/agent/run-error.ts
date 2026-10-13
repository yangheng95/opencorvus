import { Message } from "@/session/message"
import type { SessionKind } from "@/session/session.sql"

export class AgentRunError extends Error {
  constructor(
    public readonly kind: SessionKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${kind}] ${message}`, options)
    this.name = "AgentRunError"
  }
}

/** Convert canonical model failures before a caller publishes its terminal fact.
 * Aborted replies remain subject to the caller's cancellation ownership policy. */
export function buildHardErrorFromFinalMessage(input: {
  kind: SessionKind
  agentName: string
  finalMessage: { info: { role: string; error?: unknown; finish?: string } }
  effectiveOutputLimit?: number
}): AgentRunError | null {
  const { kind, agentName, finalMessage } = input
  if (finalMessage.info.role !== "assistant") return null
  const err = finalMessage.info.error
  if (err) {
    if (Message.AbortedError.isInstance(err)) return null
    const errName = (err as { name?: string }).name ?? "UnknownError"
    const errMessage = (err as { data?: { message?: string } }).data?.message ?? errName
    return new AgentRunError(kind, `LLM error during ${agentName}: ${errName}: ${errMessage}`, { cause: err })
  }
  if (finalMessage.info.finish === "error") {
    return new AgentRunError(kind, `LLM error during ${agentName}: error finish has no recorded diagnostic`)
  }
  if (finalMessage.info.finish === "length") {
    const outputLengthMessage =
      input.effectiveOutputLimit === undefined
        ? "The model response exceeded its output limit."
        : `The model response exceeded the effective runtime output cap of ${input.effectiveOutputLimit} tokens.`
    const outputLengthError = new Message.OutputLengthError({
      message: outputLengthMessage,
      ...(input.effectiveOutputLimit === undefined ? {} : { effectiveOutputLimit: input.effectiveOutputLimit }),
    })
    const limitDetail =
      input.effectiveOutputLimit === undefined
        ? ""
        : ` The effective runtime output cap for this request was ${input.effectiveOutputLimit} tokens.`
    return new AgentRunError(
      kind,
      `LLM error during ${agentName}: ${outputLengthError.name}: The model response exceeded its output limit.${limitDetail}`,
      { cause: outputLengthError },
    )
  }
  return null
}
