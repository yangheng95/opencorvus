import type { AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"

export function projectedAdapterError(agentID: string, adapterID: AgentDispatchAdapterID, cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(`Projected agent "${agentID}" failed via adapter "${adapterID}": ${detail}`, { cause })
}
