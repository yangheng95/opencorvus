import type { AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"

export function projectedAdapterError(agentID: string, adapterID: AgentDispatchAdapterID, cause: unknown) {
  if (isExecutionCancellationError(cause)) return cause
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(`Projected agent "${agentID}" failed via adapter "${adapterID}": ${detail}`, { cause })
}
