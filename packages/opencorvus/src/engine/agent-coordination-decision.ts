export const AGENT_COORDINATION_ACTIVE_DECISIONS = ["cancel_worker", "redispatch", "fail_task", "ask_user"] as const

export const AGENT_COORDINATION_DECISIONS = [...AGENT_COORDINATION_ACTIVE_DECISIONS, "acknowledge_terminal"] as const

export type AgentCoordinationDecision = (typeof AGENT_COORDINATION_DECISIONS)[number]

const AGENT_COORDINATION_DECISION_SET = new Set<string>(AGENT_COORDINATION_DECISIONS)

export function isAgentCoordinationDecision(value: unknown): value is AgentCoordinationDecision {
  return typeof value === "string" && AGENT_COORDINATION_DECISION_SET.has(value)
}
