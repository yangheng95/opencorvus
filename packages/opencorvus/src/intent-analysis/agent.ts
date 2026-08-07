/**
 * Intent Analysis capability adapter for intent disambiguation.
 *
 * Reads the raw user request and returns a structured IntentAnalysisResult
 * (intent class, complexity band, extracted slots, missing info keys,
 * clarification questions, overall confidence, one-sentence summary).
 *
 * Hard boundaries:
 *   ✗ Cannot modify files, run shell, call other agents
 *   ✗ Cannot persist state outside of its return value
 *   ✓ May use read-only codebase tools (read/find/search/list) to ground
 *     complexity estimation in the repo's actual shape
 *   ✓ Records independent intent facts through typed domain tools
 *
 * Implementation: the agent is a thin shell over `runAgentSession` — the
 * runner owns model resolution, child-session creation, system-prompt
 * composition (core + config-append + skills), prompt invocation, abort
 * propagation, stream-error capture. Agent-specific code is limited to
 * the user-prompt text and the structured output tools.
 */
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { createAgentContextTools } from "@/agent/context-tools"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { createAgentCoordinationRuntimeTools } from "@/agent/coordination-runtime-tools"
import { filterAgentTools } from "@/agent/filter-tools"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Log } from "@/util/log"
import type { IntentAnalysisResult } from "./types"
import { collectorToResult, createIntentOutputTools, type IntentCollector } from "./output-tools"
import {
  projectIntentAnalysisInput,
  type IntentAnalysisInputRefs,
  type IntentAnalysisPromptProjection,
} from "./input-projection"

const log = Log.create({ service: "intent-analysis-agent" })

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export namespace IntentAnalysisAgent {
  export interface AnalyzeInput extends IntentAnalysisInputRefs {
    /** Parent session — a child "intent-analysis" session is created under it. */
    parentSessionID?: string
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
    onStatus?: (summary: string) => void | Promise<void>
  }

  export interface AnalyzeOutput {
    result?: IntentAnalysisResult
    facts: IntentCollector
    /** Child session created by the runner. */
    sessionID: string
    finalMessageID: string
  }

  export async function analyze(input: AnalyzeInput): Promise<AnalyzeOutput | AgentCoordinationHandoffResult> {
    const projection = projectIntentAnalysisInput(input)
    const toolKit = await buildToolKit({
      agentID: input.agentID,
      taskID: input.taskID,
      sessionID: input.parentSessionID,
      signal: input.signal,
    })
    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (intent-analysis): ${projection.taskTitle}`,
      newSessionID: input.newSessionID,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      model: input.model,
      signal: input.signal,
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      onStatus: input.onStatus,
      toolKit: {
        tools: toolKit.tools,
        stageOwnedToolIDs: toolKit.stageOwnedToolIDs,
        getCollector: toolKit.getCollector,
      },
      buildUserPrompt: () => buildUserPrompt(projection, input.agentID),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    const result = collectorToResult(out.collector)
    log.info("intent-analysis agent finished", {
      intent_class: result?.intent_class,
      complexity: result?.complexity,
      slots: out.collector.slots.length,
      missing: out.collector.missing.length,
      clarifications: out.collector.clarifications.length,
      confidence: result?.confidence,
    })

    return {
      result,
      facts: out.collector,
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
    }
  }
}

// ---------------------------------------------------------------------------
// Tool kit — shared read-only context tools + intent-specific collector tools.
// ---------------------------------------------------------------------------

async function buildToolKit(opts: { agentID: string; taskID?: string; sessionID?: string; signal?: AbortSignal }) {
  const coordinationTools = await createAgentCoordinationRuntimeTools({
    agentID: opts.agentID,
    taskID: opts?.taskID,
    signal: opts?.signal,
  })
  const contextTools = await filterAgentTools(
    { ...createAgentContextTools(), ...coordinationTools },
    "intent-analysis",
    opts,
  )
  const outputToolKit = createIntentOutputTools()
  return {
    tools: { ...contextTools, ...outputToolKit.tools },
    stageOwnedToolIDs: Object.keys(outputToolKit.tools),
    getCollector: () => outputToolKit.getCollector(),
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildUserPrompt(input: IntentAnalysisPromptProjection, agentID: string): string {
  const sections: string[] = []
  sections.push(
    `# Delegation\n\nProjected agent "${agentID}" is asked to read this task request and return a grounded analysis through the analyze_intent adapter.\n\n${input.instruction}`,
  )
  sections.push(`# Title\n\n${input.taskTitle}`)
  sections.push(
    renderUserRequestSection({ heading: "# User Request", request: input.taskRequest, taskID: input.taskID }),
  )
  const contextSection = renderPromptSections(
    withAttachmentPromptSections(input.observationSections, input.attachments),
  )
  if (contextSection) sections.push(contextSection)
  return sections.join("\n\n")
}
