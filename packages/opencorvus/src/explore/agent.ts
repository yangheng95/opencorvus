import {
  agentCoordinationHandoffResult,
  runAgentSession,
  type AgentCoordinationHandoffResult,
} from "@/agent/runner"
import { renderPromptSections } from "@/agent/prompt-projection"
import type { SessionPrompt } from "@/session/prompt"

export namespace ExploreAgent {
  export interface RunInput {
    prompt: string
    sessionTitle: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    newSessionID?: string
    parentSessionID?: string
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    agentID: string
    packageRevision: import("@/expert-squad/prompt-profile-resolver").PromptProfileResolver.ResolvedPackageRevision
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    toolSwitches?: Record<string, boolean>
    /** Bounded context sections supplied by the scheduler. */
    contextSections?: string[]
    buildUserParts?: () => Promise<SessionPrompt.PromptInput["parts"]>
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }

  export interface RunResult {
    sessionID: string
    finalMessageID: string
  }

  export async function run(input: RunInput): Promise<RunResult | AgentCoordinationHandoffResult> {
    const promptWithContext = () => appendContextSectionsToPrompt(input.prompt, input.contextSections)
    const userParts = input.buildUserParts
      ? async () => appendContextSectionsToParts(await input.buildUserParts!(), input.contextSections)
      : undefined
    const out = await runAgentSession<Record<string, never>>({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      sessionTitle: input.sessionTitle,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      newSessionID: input.newSessionID,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      workScope: input.workScope,
      model: input.model,
      signal: input.signal,
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      toolSwitches: input.toolSwitches,
      toolKit: {
        tools: {},
        stageOwnedToolIDs: [],
        getCollector: () => ({}),
      },
      buildUserPrompt: promptWithContext,
      buildUserParts: userParts,
    })
    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff
    return {
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
    }
  }
}

function appendContextSectionsToPrompt(prompt: string, sections: readonly string[] | undefined): string {
  const context = renderPromptSections(sections)
  return context ? [prompt, context].join("\n\n") : prompt
}

function appendContextSectionsToParts(
  parts: SessionPrompt.PromptInput["parts"],
  sections: readonly string[] | undefined,
): SessionPrompt.PromptInput["parts"] {
  const context = renderPromptSections(sections)
  return context ? [...parts, { type: "text", text: context }] : parts
}
