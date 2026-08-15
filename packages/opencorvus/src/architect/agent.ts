/**
 * Goal-graph adapter — authoritative goal decomposer + cross-goal coordinator.
 *
 * The active expert package decides when to dispatch this capability and which
 * projected consumers use its persisted goal graph.
 *
 * Authority:
 * ✓ Produces the final goal set (add / modify / split / remove)
 * ✓ Records REQ-N coverage through goal-local acceptance spec sources
 * ✓ Records fidelity coverage and assembly ownership
 * ✓ Resolves cross-goal interfaces into binding Decision Log contracts
 *
 * Constraints:
 * ✗ Cannot execute code / commands
 * ✗ Cannot write or modify user files
 * ✗ Cannot call other projected agents
 * ✗ Cannot modify persisted requirement rows
 *
 * Implementation: thin shell over `runAgentSession`. Agent-specific code
 * is the user-prompt constructor and the architect output tool kit; the
 * runner owns model resolution, session creation, system-prompt
 * composition (base-role runtime template + projected agent prompt + mounted skills),
 * stream-error capture, and abort signal propagation.
 */
import {
  agentCoordinationHandoffResult,
  runAgentSession,
  type AgentCoordinationHandoffResult,
  type RunAgentSessionOutput,
} from "@/agent/runner"
import { createAgentContextTools } from "@/agent/context-tools"
import { createAgentCoordinationRuntimeTools } from "@/agent/coordination-runtime-tools"
import { filterAgentTools } from "@/agent/filter-tools"
import { Log } from "@/util/log"
import type { GoalContractFields } from "@/pipeline/types"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import type { ArchitectArtifact } from "./types"
import {
  createArchitectOutputTools,
  type ArchitectCollector,
  type ArchitectSelectedExistingGoals,
  type RegisteredGoal,
} from "./output-tools"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { projectArchitectInput, type ArchitectInputRefs, type ArchitectPromptProjection } from "./input-projection"
import { artifactProvenanceForAgentTurn, selectedArtifactLocatorsBeforePublication } from "@/agent/artifact-read-facts"
import {
  resolveCurrentGoalGraphProjectionArtifactLocator,
  resolveGoalMembershipForProjectionArtifact,
} from "@/engine/store"
import { Instance } from "@/project/instance"
import { artifactReadLocatorKey } from "@opencorvus-ai/plugin/artifact-catalog"
import { resolveArchitectSelectedArtifactRoles, type ArchitectSelectedArtifactRoles } from "./selected-artifact-roles"
import { assertArchitectOutputToolTurnIdentity } from "./output-tool-turn-identity"

const log = Log.create({ service: "architect-agent" })

function selectedCurrentGoalSeed(input: {
  taskID: string
  roles: ArchitectSelectedArtifactRoles
}): ArchitectSelectedExistingGoals | undefined {
  const selected = input.roles.currentGoalGraphProjection
  if (!selected) return undefined
  const membership = resolveGoalMembershipForProjectionArtifact({
    taskID: input.taskID,
    projectionArtifactLocator: selected.locator,
  })
  return {
    sourceKey: artifactReadLocatorKey(selected.locator),
    goals: membership.goals.map(({ goal }) => ({
      id: goal.id,
      title: goal.title,
      objective: goal.objective,
      acceptance_specs: parseAcceptanceSpecs(goal.acceptance_specs, `goal ${goal.id} acceptance_specs`),
      owned_paths: [...goal.owned_paths],
      priority: goal.priority,
      kind: goal.kind as RegisteredGoal["kind"],
    })),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export namespace ArchitectAgent {
  export type CoordinateResult = ArchitectArtifact & { sessionID: string; finalMessageID: string }

  export interface CoordinateInput extends ArchitectInputRefs {
    /** Parent session — a child "architect" session is created under it. */
    parentSessionID?: string
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onStatus?: (summary: string) => void | Promise<void>
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
    onTurnCompleted?: (turn: { sessionID: string; finalMessageID: string }) => void | Promise<void>
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
  }

  export async function coordinate(input: CoordinateInput): Promise<CoordinateResult | AgentCoordinationHandoffResult> {
    const projection = projectArchitectInput(input)
    const eligiblePriorLocators = () => {
      const current = resolveCurrentGoalGraphProjectionArtifactLocator(input.taskID)
      return current ? [current] : []
    }
    const priorBySourceKey = new Map<
      string,
      {
        role: NonNullable<ArchitectSelectedArtifactRoles["currentGoalGraphProjection"]>
        seed: ArchitectSelectedExistingGoals
      }
    >()
    let outputToolKit: ReturnType<typeof createArchitectOutputTools>
    outputToolKit = createArchitectOutputTools({
      selectedExistingGoals: (options, toolName) => {
        const turn = assertArchitectOutputToolTurnIdentity({
          taskID: input.taskID,
          toolName,
          options,
        })
        const frozenSourceKey = outputToolKit.selectedExistingGoalSourceKey()
        if (frozenSourceKey) return priorBySourceKey.get(frozenSourceKey)?.seed
        const sourceArtifactLocators = selectedArtifactLocatorsBeforePublication({
          sessionID: turn.sessionID,
          assistantMessageID: turn.messageID,
        })
        const roles = resolveArchitectSelectedArtifactRoles({
          taskID: input.taskID,
          sourceArtifactLocators,
          eligiblePriorGoalGraphProjectionArtifactLocators: eligiblePriorLocators,
        })
        const role = roles.currentGoalGraphProjection
        const seed = selectedCurrentGoalSeed({ taskID: input.taskID, roles })
        if (role && seed) priorBySourceKey.set(seed.sourceKey, { role, seed })
        return seed
      },
    })
    const coordinationTools = await createAgentCoordinationRuntimeTools({
      agentID: input.agentID,
      taskID: input.taskID,
      signal: input.signal,
    })
    const contextTools = await filterAgentTools({ ...createAgentContextTools(), ...coordinationTools }, "architect", {
      taskID: input.taskID,
      sessionID: input.parentSessionID,
    })

    const completeOutput = async (out: RunAgentSessionOutput<ArchitectCollector>): Promise<CoordinateResult> => {
      await input.onTurnCompleted?.({
        sessionID: out.session.id,
        finalMessageID: out.finalMessage.info.id,
      })

      log.info("architect agent finished", {
        sessionID: out.session.id,
        streamErrors: out.streamErrors.length,
      })

      const provenance = artifactProvenanceForAgentTurn(out.session.id, out.finalMessage.info.id)
      const sourceArtifactLocators = provenance.sourceArtifactLocators
      const selectedRoles = resolveArchitectSelectedArtifactRoles({
        taskID: input.taskID,
        sourceArtifactLocators,
        eligiblePriorGoalGraphProjectionArtifactLocators: eligiblePriorLocators,
      })
      const selectedRequirementSet = selectedRoles.requirementSet
      const requirementSet = selectedRequirementSet?.artifact
      const frozenPriorSourceKey = outputToolKit.selectedExistingGoalSourceKey()
      const selectedPriorGoalGraph = frozenPriorSourceKey
        ? priorBySourceKey.get(frozenPriorSourceKey)?.role
        : selectedRoles.currentGoalGraphProjection
      const finalSelectedSourceKeys = new Set(sourceArtifactLocators.map(artifactReadLocatorKey))
      if (frozenPriorSourceKey && (!selectedPriorGoalGraph || !finalSelectedSourceKeys.has(frozenPriorSourceKey))) {
        throw new Error(
          `Architect collector prior ${frozenPriorSourceKey} is absent from final persisted selection provenance.`,
        )
      }
      const collector = outputToolKit.snapshot()
      const goals: GoalContractFields[] = collector.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        objective: goal.objective,
        acceptance_specs: goal.acceptance_specs,
        owned_paths: goal.owned_paths,
        priority: goal.priority,
        kind: goal.kind,
      }))

      log.info("architect agent output", {
        goals: goals.length,
        removed: collector.removed_goals.length,
        sourceCoverage: collector.source_coverage.length,
        referenceCoverage: collector.reference_coverage.length,
        assemblyOwners: collector.assembly_owners.length,
        contracts: collector.contract_graph.contracts.length,
      })

      return {
        inputFacts: {
          ...(selectedRequirementSet ? { requirementSetArtifactLocator: selectedRequirementSet.locator } : {}),
          ...(selectedPriorGoalGraph
            ? { priorGoalGraphProjectionArtifactLocator: selectedPriorGoalGraph.locator }
            : {}),
          sourceArtifactLocators,
          observedArtifactLocators: provenance.observedArtifactLocators,
        },
        goals,
        removedGoals: collector.removed_goals,
        fidelity: {
          sourceCoverage: collector.source_coverage,
          referenceCoverage: collector.reference_coverage,
          assemblyOwners: collector.assembly_owners,
        },
        contractGraph: collector.contract_graph,
        sessionID: out.session.id,
        finalMessageID: out.finalMessage.info.id,
      }
    }

    log.info("architect agent starting", {
      seedGoals: projection.goals.length,
      requirements: projection.requirements.length,
      decisions: projection.requirementDecisions.length,
    })

    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (architect): ${projection.taskTitle}`,
      newSessionID: input.newSessionID,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      model: input.model,
      signal: input.signal,
      onStatus: input.onStatus ?? (() => {}),
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      toolKit: {
        tools: { ...contextTools, ...outputToolKit.tools },
        stageOwnedToolIDs: Object.keys(outputToolKit.tools),
        getCollector: () => outputToolKit.getCollector(),
      },
      buildUserPrompt: () => buildArchitectUserPrompt(projection, input.agentID),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff
    return await completeOutput(out)
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

export function buildArchitectUserPrompt(input: ArchitectPromptProjection, agentID: string): string {
  const sections: string[] = []

  sections.push(
    `# Delegation\n\nOrchestrator is asking projected agent "${agentID}" to decompose this Task into versioned Delivery Slice contracts via the architect adapter. Every selected workflow node executes once for the Task; the Slices are delivery and acceptance subjects only.\n\n${input.instruction}`,
  )
  sections.push(
    renderUserRequestSection({
      heading: "# Task",
      title: input.taskTitle,
      request: input.taskRequest,
      taskID: input.taskID,
    }),
  )
  sections.push(
    [
      "# Input Contract",
      "",
      "The task title and bounded request excerpt above are the prompt-visible user input for this stage.",
      "If requirements, foundational decisions, or selected artifact observations appear below, they are also authoritative.",
      "When the excerpt is not enough, read or grep the exact request bundle path named above instead of relying on upstream summaries.",
    ].join("\n"),
  )

  const contextSection = renderPromptSections(
    withAttachmentPromptSections(input.observationSections, input.attachments),
  )
  if (contextSection) sections.push(contextSection)

  if (input.goals.length > 0) {
    const goalsText = input.goals
      .map((g) => {
        const specs = g.acceptance_specs ?? []
        return [
          `## #G${(g.order_index ?? 0) + 1} ${g.id}: ${g.title}`,
          `objective: ${g.objective}`,
          `acceptance_specs (${specs.length}):\n${renderSpecsAsText(specs)}`,
          `owned_paths: ${g.owned_paths.join(", ") || "(none)"}`,
          `kind: ${g.kind}`,
        ].join("\n")
      })
      .join("\n\n")
    sections.push(`# Existing Goals (${input.goals.length})\n\n${goalsText}`)
  }

  const dlSection = input.decisionLog.toPromptSection()
  if (dlSection) sections.push(dlSection)

  sections.push(
    "Explore the codebase, then register or refine the final goal set, " +
      "including optional diagnostics and the goal contract graph. " +
      "Inspect the registered graph facts when useful, then summarize the exact recorded facts and any missing or contradictory evidence in the visible final message.",
  )

  return sections.join("\n\n")
}
