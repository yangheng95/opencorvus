import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderPromptSections } from "@/agent/prompt-projection"

export namespace DelegatedWorkerAgent {
  export interface RunInput {
    /** Exact dynamic identity declared by capability_projection.agents. */
    agentID: string
    packageRevision: import("@/expert-squad/prompt-profile-resolver").PromptProfileResolver.ResolvedPackageRevision
    /** Visible instruction for this individual delegated run. */
    instruction: string
    /** Upstream task evidence supplied through the shared worker context protocol. */
    contextSections?: string[]
    sessionTitle: string
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    parentSessionID?: string
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onStatus?: (summary: string) => void | Promise<void>
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
    toolSwitches?: Record<string, boolean>
  }

  export interface RunResult {
    sessionID: string
    finalMessageID: string
  }

  export async function run(input: RunInput): Promise<RunResult | AgentCoordinationHandoffResult> {
    const instruction = input.instruction.trim()
    if (!instruction) {
      throw new Error(`Projected agent "${input.agentID}" instruction must contain non-whitespace text.`)
    }
    const out = await runAgentSession<Record<string, never>>({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      sessionTitle: `${input.agentID} (delegated-worker): ${input.sessionTitle}`,
      newSessionID: input.newSessionID,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      workScope: input.workScope,
      model: input.model,
      signal: input.signal,
      onStatus: input.onStatus,
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      toolSwitches: input.toolSwitches,
      toolKit: {
        stageOwnedToolIDs: [],
        materializeExact: () => undefined,
        getCollector: () => ({}),
      },
      buildUserPrompt: () => buildDelegatedWorkerUserPrompt(instruction, input.contextSections),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    return {
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
    }
  }
}

export function buildDelegatedWorkerUserPrompt(
  instruction: string,
  contextSections?: readonly string[],
): string {
  const sections = [
    "Complete the following delegated instruction using the capabilities exposed in this session.",
    "",
    "## Delegated instruction",
    instruction,
  ].join("\n")
  const context = renderPromptSections(contextSections)
  return context ? [sections, context].join("\n\n") : sections
}
