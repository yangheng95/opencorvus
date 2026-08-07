import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { ProjectedAgentWorkScopeSchema, type ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { DispatchAgentLineageHandle } from "./dispatch-agent-tool"
import { DispatchTurnSchema, renderDispatchContinuationTurn } from "./dispatch-turn-projection"

export interface DispatchAdapterExecutionContext {
  readonly agentID: string
  readonly projectedAgent: PromptProfileResolver.ResolvedProjectedAgent
  readonly workScope: ProjectedAgentWorkScope
  /** Preallocated fresh child Session identity for a managed Task worktree. */
  readonly newSessionID?: string
  /** Exact prior child Session identity for continuation or coordination redispatch. */
  readonly existingSessionID?: string
  readonly dispatch: DispatchAgentLineageHandle
  readonly toolOptions: unknown
}

export function createDispatchAdapterExecutionContext(input: {
  projectedAgent: PromptProfileResolver.ResolvedProjectedAgent
  workScope: ProjectedAgentWorkScope
  newSessionID?: string
  existingSessionID?: string
  dispatch: DispatchAgentLineageHandle
  toolOptions: unknown
}): DispatchAdapterExecutionContext {
  const agentID = input.projectedAgent.identity.agentID
  if (!agentID) throw new Error("dispatch adapter execution requires an exact projected agent identity")
  const workScope = ProjectedAgentWorkScopeSchema.parse(input.workScope)
  if (input.newSessionID !== undefined && input.newSessionID.length === 0) {
    throw new Error("dispatch adapter execution requires a non-empty newSessionID")
  }
  if (input.existingSessionID !== undefined && input.existingSessionID.length === 0) {
    throw new Error("dispatch adapter execution requires a non-empty existingSessionID")
  }
  if (input.newSessionID && input.existingSessionID) {
    throw new Error("dispatch adapter execution cannot create and reuse a Session simultaneously")
  }
  return Object.freeze({
    agentID,
    projectedAgent: input.projectedAgent,
    workScope,
    newSessionID: input.newSessionID,
    existingSessionID: input.existingSessionID,
    dispatch: input.dispatch,
    toolOptions: input.toolOptions,
  })
}

export function requireDispatchAdapterExecutionContext(input: unknown): DispatchAdapterExecutionContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("dispatch adapter execution context is required")
  }
  const context = input as Partial<DispatchAdapterExecutionContext>
  if (typeof context.agentID !== "string" || context.agentID.length === 0) {
    throw new Error("dispatch adapter execution context requires agentID")
  }
  if (!context.projectedAgent || context.projectedAgent.identity.agentID !== context.agentID) {
    throw new Error("dispatch adapter execution context agentID does not match its projected identity")
  }
  if (!ProjectedAgentWorkScopeSchema.safeParse(context.workScope).success) {
    throw new Error("dispatch adapter execution context requires an exact projected work scope")
  }
  if (!context.dispatch || typeof context.dispatch.dispatchID !== "string") {
    throw new Error("dispatch adapter execution context requires dispatch_agent lineage")
  }
  DispatchTurnSchema.parse(context.dispatch.turn)
  if (!("toolOptions" in context)) {
    throw new Error("dispatch adapter execution context requires toolOptions evidence")
  }
  return context as DispatchAdapterExecutionContext
}

export function dispatchAdapterContinuationPrompt(
  context: DispatchAdapterExecutionContext,
): string | undefined {
  return renderDispatchContinuationTurn({
    turn: context.dispatch.turn,
    guidance: context.dispatch.continuationGuidance ?? "",
  })
}
