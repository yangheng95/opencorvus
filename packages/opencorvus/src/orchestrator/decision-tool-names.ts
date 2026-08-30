/**
 * Visible Orchestrator tools that commit the outcome of one scheduler decision
 * epoch. Keep this dependency-free so durable ingress settlement can validate
 * persisted Tool facts without importing the Orchestrator tool factory.
 */
export const ORCHESTRATOR_DECISION_TOOL_NAMES = [
  "dispatch_agent",
  "dispatch_agents",
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
  if (input.tool === "dispatch_agent" || input.tool === "dispatch_agents") return "inspect_dispatch_outcome"
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

/**
 * The decision a recorded assistant turn has already committed, if any.
 *
 * A decision is durable evidence, not process memory: the reduction derives its
 * decision facts from exactly these Tool parts, so anything that has to know
 * what a turn already decided — across a Provider step, or across a restart —
 * must read them the same way rather than remember. A declaration that cannot
 * classify its own recorded input is not a committed decision; the call it
 * describes failed on its own terms.
 */
export function orchestratorCommittedDecisionInParts(
  parts: ReadonlyArray<{ type: string; tool?: string; state?: { status?: string; input?: unknown } }>,
): OrchestratorDecisionToolName | undefined {
  for (const part of parts) {
    if (part.type !== "tool" || part.state?.status !== "completed") continue
    const tool = part.tool
    if (typeof tool !== "string" || !isOrchestratorDecisionToolName(tool)) continue
    try {
      const effect = orchestratorDecisionToolCompletionEffect({ tool, stateInput: part.state.input })
      if (effect === "requires_followup_decision") continue
    } catch {
      continue
    }
    return tool
  }
  return undefined
}
