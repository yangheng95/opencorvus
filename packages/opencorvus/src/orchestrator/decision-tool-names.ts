/**
 * Visible Orchestrator tools that commit the outcome of one scheduler decision
 * epoch. Durable ingress settlement uses the same output contracts as live
 * execution, without importing the Orchestrator tool factory.
 */
import { DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { DispatchCollectionMemberResultSchema } from "@/engine/dispatch-collection-contract"
import { normalizeToolResult } from "@/session/tool-result-normalization"
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
  stateOutput?: string
}): OrchestratorDecisionToolCompletionEffect {
  if (input.tool === "dispatch_agent" || input.tool === "dispatch_agents") {
    if (input.stateOutput === undefined) return "inspect_dispatch_outcome"
    const output = JSON.parse(input.stateOutput)
    const committed = input.tool === "dispatch_agent"
      ? DispatchOutcomeSchema.parse(output).kind !== "infrastructure_failure"
      : DispatchCollectionMemberResultSchema.array().parse(output.members).some(
          (member) => member.status === "completed" && member.outcome.kind !== "infrastructure_failure",
        )
    return committed ? "satisfies_current_epoch" : "requires_followup_decision"
  }
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

export function orchestratorDecisionToolResultCommits(tool: OrchestratorDecisionToolName, args: unknown, result: unknown): boolean {
  return orchestratorDecisionToolCompletionEffect({
    tool,
    stateInput: args,
    stateOutput: normalizeToolResult(result).output,
  }) === "satisfies_current_epoch"
}

/**
 * The decision a recorded assistant turn has already committed, if any.
 *
 * A decision is durable evidence, not process memory: the reduction derives its
 * decision facts from exactly these Tool parts, so anything that has to know
 * what a turn already decided — across a Provider step, or across a restart —
 * must read them the same way rather than remember. Invalid completed receipts
 * expose the same contract error on the live and durable readers.
 */
export function orchestratorCommittedDecisionInParts(
  parts: ReadonlyArray<{ type: string; tool?: string; state?: { status?: string; input?: unknown; output?: string } }>,
): OrchestratorDecisionToolName | undefined {
  for (const part of parts) {
    if (part.type !== "tool" || part.state?.status !== "completed") continue
    const tool = part.tool
    if (typeof tool !== "string" || !isOrchestratorDecisionToolName(tool)) continue
    if ((tool === "dispatch_agent" || tool === "dispatch_agents") && part.state.output === undefined) {
      throw new Error(`Completed ${tool} receipt is missing its durable output`)
    }
    const effect = orchestratorDecisionToolCompletionEffect({ tool, stateInput: part.state.input, stateOutput: part.state.output })
    if (effect !== "satisfies_current_epoch") continue
    return tool
  }
  return undefined
}
