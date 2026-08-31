/**
 * RequirementsAgent — parses a user task into REQ-N requirements +
 * foundational technical decisions (runtime / framework / test strategy).
 * Seeds the Decision Log with the decisions under phase="requirements"
 * so projected consumers can use the same persisted foundation.
 *
 * This adapter deliberately does NOT produce goals, metric specs, challenge
 * seeds, acceptance-source mappings, or cross-goal contracts; those belong to a separately
 * declared planning contract when the active expert squad requires one.
 * The narrow surface is enforced by the tool list (register_requirement +
 * register_decision) and by the RequirementSet type shape.
 *
 * Implementation: shell over `runAgentSession`. The runner owns model
 * resolution, child-session creation, system-prompt composition, abort /
 * stream-error handling. Agent-specific code is the user prompt builder
 * (with prefetched repo context + clarification transcript + design
 * frontend template + optional visual anchors + multimodal attachments) and the output
 * tool kit.
 */
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { prefetchContext } from "@/agent/context-tools"
import { Log } from "@/util/log"
import { clarificationTranscriptSection } from "@/engine"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { renderUserRequestSection } from "@/intent/request-prompt"
import type { RequirementCoverageDeclaration, RequirementSet } from "./types"
import { createRequirementsOutputToolFactory, type RequirementsCollector } from "./output-tools"
import { createDecisionLog } from "@/decision-log"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { createStageToolMaterializerBinding } from "@/agent/stage-tool-materializer"
import {
  projectRequirementsInput,
  type RequirementsInputRefs,
  type RequirementsPromptProjection,
} from "./input-projection"

const log = Log.create({ service: "requirements-agent" })

// ---------------------------------------------------------------------------
// Domain artifact
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export namespace RequirementsAgent {
  export interface RunInput extends RequirementsInputRefs {
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    parentSessionID?: string
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onStatus?: (summary: string) => void | Promise<void>
    /** Fires once the runner session is created so callers (orchestrator
     *  dispatch tools) can capture the id for SSE event emission without
     *  needing a wrapper session. Rule 22 — single session per sub-agent. */
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }

  /**
   * Parse a task request into REQ-N requirements + foundational decisions.
   * Delivery Slice decomposition is outside this adapter's contract.
   */
  export async function run(
    input: RunInput,
  ): Promise<
    | (RequirementSet & {
        sessionID: string
        finalMessageID: string
        finalization?: RequirementCoverageDeclaration
      })
    | AgentCoordinationHandoffResult
  > {
    const projection = projectRequirementsInput(input)
    // Rule 11 / rule 25: the working directory is a structural fact
    // (`Instance.directory`), not something to keyword-regex out of the
    // user's free-form request. `prefetchContext()` reads the active Instance
    // projection; executable context leaves come from the occurrence Registry.
    const outputFactory = createRequirementsOutputToolFactory({
      taskID: input.taskID,
      decisionLog: createDecisionLog(input.taskID),
    })
    const stageOwnedToolIDs = DispatchAdapterContractRegistry.privateStageToolIDs("requirements")

    const context = prefetchContext(projection.taskTitle, projection.taskRequest)

    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (requirements): ${projection.taskTitle}`,
      newSessionID: input.newSessionID,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      model: input.model,
      signal: input.signal,
      onStatus: input.onStatus,
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      toolKit: {
        stageOwnedToolIDs,
        stageMaterializers: {
          register_decision: createStageToolMaterializerBinding({
            id: "requirements.register-decision",
            input: { taskID: input.taskID, decisionPhase: "requirements" },
          }),
        },
        async materializeExact(toolID) {
          if (stageOwnedToolIDs.includes(toolID)) return outputFactory.materializeExact(toolID)
          return undefined
        },
        getCollector: () => outputFactory.getCollector(),
      },
      buildUserPrompt: () => buildUserPrompt(projection, input.agentID, context),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    const collector = out.collector as RequirementsCollector
    // Collector tool-call output is the only supported path. The durable
    // publication owner reconstructs evidence provenance from the completed
    // Turn; the runner never supplies or pre-validates an authoritative copy.
    const parsed = collectorToOutput(collector)
    log.info("requirements agent output", {
      requirements: parsed.requirements.length,
      decisions: parsed.decisions.length,
    })

    return {
      ...parsed,
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
      ...(collector.finalization ? { finalization: collector.finalization } : {}),
    }
  }
}

// ---------------------------------------------------------------------------
// Collector → RequirementSet
// ---------------------------------------------------------------------------

function collectorToOutput(collector: RequirementsCollector): RequirementSet {
  return {
    requirements: collector.requirements.map((r) => ({
      id: r.id,
      type: r.type,
      description: r.description,
      acceptance: r.acceptance,
      non_goals: r.non_goals,
      evidence_refs: r.evidence_refs,
    })),
    decisions: collector.decisions.map((d) => ({
      key: d.key,
      value: d.value,
      reason: d.reason,
    })),
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildUserPrompt(input: RequirementsPromptProjection, agentID: string, prefetched: string): string {
  const sections: string[] = []

  sections.push(
    `# Delegation\n\nProjected agent "${agentID}" is asked to extract the task requirements and foundational decisions through the requirements adapter.\n\n${input.instruction}`,
  )
  sections.push(
    `## Requirements coverage authority\n\n- request_sha256: ${input.taskRequestSHA256}\n- Before finishing, call \`finalize_requirements\` exactly once with this hash, every registered REQ-N identity, the exact selected source Artifact locators, and all unresolved coverage.`,
  )
  sections.push(
    renderUserRequestSection({
      heading: "# Task",
      title: input.taskTitle,
      request: input.taskRequest,
      taskID: input.taskID,
    }),
  )

  const clarifications = clarificationTranscriptSection(input.taskID)
  if (clarifications) {
    sections.push(
      [
        clarifications,
        "Concrete stack or deliverable answers from clarifications outrank existing package.json dependencies.",
        "If the user explicitly chose a framework-free implementation, record that choice directly instead of inferring a framework from scaffold files.",
      ].join("\n\n"),
    )
  }

  const contextSection = renderPromptSections(
    withAttachmentPromptSections(input.observationSections, input.attachments),
  )
  if (contextSection) sections.push(contextSection)

  if (prefetched?.trim()) {
    sections.push(prefetched)
  }

  return sections.join("\n\n")
}
