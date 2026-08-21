/**
 * Visible Orchestrator tools that commit the outcome of one scheduler decision
 * epoch. Keep this dependency-free so durable ingress settlement can validate
 * persisted Tool facts without importing the Orchestrator tool factory.
 */
export const ORCHESTRATOR_DECISION_TOOL_NAMES = [
  "dispatch_agent",
  "respond_agent_coordination",
  "manage_task",
  "question",
  "wait",
  "no_action",
] as const

export type OrchestratorDecisionToolName = (typeof ORCHESTRATOR_DECISION_TOOL_NAMES)[number]

export type OrchestratorDecisionToolCompletionEffect =
  | "satisfies_current_epoch"
  | "requires_followup_decision"
  | "inspect_dispatch_outcome"

const ORCHESTRATOR_DECISION_TOOL_NAME_SET = new Set<string>(ORCHESTRATOR_DECISION_TOOL_NAMES)

export function isOrchestratorDecisionToolName(value: string): value is OrchestratorDecisionToolName {
  return ORCHESTRATOR_DECISION_TOOL_NAME_SET.has(value)
}

/**
 * Interpret the durable completion contract of one visible decision Tool.
 * A completed interaction Tool has already returned its new operator fact, and
 * a coordination redispatch has only frozen authority for a later dispatch.
 * Neither is itself the next scheduling decision.
 */
export function orchestratorDecisionToolCompletionEffect(input: {
  tool: OrchestratorDecisionToolName
  stateInput: unknown
}): OrchestratorDecisionToolCompletionEffect {
  if (input.tool === "dispatch_agent") return "inspect_dispatch_outcome"
  if (input.tool === "question") return "requires_followup_decision"
  if (input.tool === "manage_task") {
    const taskInput = input.stateInput && typeof input.stateInput === "object" && !Array.isArray(input.stateInput)
      ? (input.stateInput as Record<string, unknown>)
      : undefined
    const action = taskInput?.action
    if (
      action === "add_goal" ||
      action === "modify_goal" ||
      action === "delete_goal" ||
      taskInput?.goal !== undefined ||
      taskInput?.goalID !== undefined ||
      taskInput?.updates !== undefined
    ) {
      return "requires_followup_decision"
    }
  }
  if (input.tool === "respond_agent_coordination") {
    if (!input.stateInput || typeof input.stateInput !== "object" || Array.isArray(input.stateInput)) {
      throw new Error("respond_agent_coordination input is not an object")
    }
    const decision = (input.stateInput as { decision?: unknown }).decision
    if (!isAgentCoordinationDecision(decision)) {
      throw new Error("respond_agent_coordination input has no recognized decision")
    }
    return decision === "redispatch" || decision === "ask_user"
      ? "requires_followup_decision"
      : "satisfies_current_epoch"
  }
  return "satisfies_current_epoch"
}
import { isAgentCoordinationDecision } from "@/engine/agent-coordination-decision"
