/**
 * Frontend Design Agent - produces an evidence-grounded frontend template from
 * screenshots / mockups / live URLs.
 *
 * Incremental domain tools build a FrontendDesign artifact. Session completion
 * is independent of artifact completeness.
 * Visual constraints are owned by the strict FrontendDesign artifact and are
 * only a compact anchor list beside the frontend template.
 *
 * Architecture constraints:
 * ✓ May materialize frontend-design source projects through its own tools
 * ✗ Cannot call other agents
 * ✓ Reads codebase to discover existing design patterns/component libraries
 * ✓ Works from multimodal attachments (screenshots, PDF) and task-runtime
 *   webpage evidence when the brief includes a visual URL.
 * ✓ Emits incremental frontend-design facts and a visible final message.
 *
 * Implementation: thin shell over `runAgentSession`. The runner owns
 * model / session / prompt-composition / abort / stream-error handling.
 */
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { Log } from "@/util/log"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { Instance } from "@/project/instance"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { createStageToolMaterializerBinding } from "@/agent/stage-tool-materializer"
import type { VisualSpec } from "./types"
import {
  createFrontendDesignOutputTools,
  type FrontendDesignPayload,
  type FrontendDesignCollector,
} from "./output-tools"
import { createReadAttachmentTool } from "./read-attachment-tool"
import { createVisualRegionBindingPackageToolFactory } from "./visual-region-binding-tool"
import { FRONTEND_DESIGN_STAGE_OWNED_TOOL_IDS } from "./static-tools"
import {
  projectFrontendDesignInput,
  type FrontendDesignInputRefs,
  type FrontendDesignPromptProjection,
} from "./input-projection"

const log = Log.create({ service: "frontend-design" })

export namespace FrontendDesignAgent {
  export interface Result {
    outcome: "complete"
    specs: VisualSpec[]
    designSystem: string
    techStack: string[]
    frontendTemplate: string
    finalAcceptanceMode: FrontendDesignPayload["final_acceptance_mode"]
    fillableModules: string
    componentInventory: string
    componentReusePlan: FrontendDesignPayload["component_reuse_plan"]
    baselineReplacementPlan: FrontendDesignPayload["baseline_replacement_plan"]
    implementationPhaseOutcomes: FrontendDesignPayload["implementation_phase_outcomes"]
    qualityProjectContract: string
    materialInventory: string
    frontendProject: {
      status: "created" | "not_created" | "blocked"
      role: "source_baseline_input" | "visual_baseline_input" | "implementation_target" | "blocked"
      project_root: string
      source_package: string
      entrypoints: string[]
      generation_tool: string
      notes: string[]
    }
    visualValidationEvidence: FrontendDesignPayload["visual_validation_evidence"]
    visualConsistencyContract: string
    visualRegionBindings: FrontendDesignPayload["visual_region_bindings"]
    uiDataContract: string
    templateIterationNotes: string[]
    completenessReview: string
    referenceArtifacts: string[]
    openQuestions: string[]
    designDirections: FrontendDesignPayload["design_directions"]
    selectedDesignDirectionID: string
    antiSlopReview: FrontendDesignPayload["anti_slop_review"]
    competitorReferenceEvidence: FrontendDesignPayload["competitor_reference_evidence"]
    finalMessageID: string
    completenessFindings: string[]
    artifact: FrontendDesignPayload
  }

  export interface PartialResult {
    outcome: "partial"
    sessionID: string
    finalMessageID: string
    specs: VisualSpec[]
    factSnapshot: FrontendDesignCollector
    missing: string[]
    completenessFindings: string[]
    error?: string
  }

  export interface AnalyzeInput extends FrontendDesignInputRefs {
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    /** Parent session — a child "frontend-design" session is created under it. */
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
  }

  export async function analyze(
    input: AnalyzeInput,
  ): Promise<(Result & { sessionID: string }) | PartialResult | AgentCoordinationHandoffResult> {
    const projection = projectFrontendDesignInput(input)
    const frontendRuntimePaths = frontendDesignPathsForTask(input.taskID)
    const captureFactoryInput = {
      mode: input.mode,
      artifactRoot: frontendRuntimePaths.absoluteDir,
      artifactRootRelative: frontendRuntimePaths.relativeDir,
      workspaceRoot: Instance.worktree,
      taskID: input.taskID,
    }
    const outputToolKit = createFrontendDesignOutputTools(captureFactoryInput)
    const visualRegionFactory = createVisualRegionBindingPackageToolFactory({ taskID: input.taskID })
    const materializeExact = async (toolID: string) =>
      outputToolKit.materializeExact(toolID) ??
      visualRegionFactory.materializeExact(toolID) ??
      createReadAttachmentTool(Instance.project.id)[toolID as "read_attachment"]
    log.info("frontend design starting", {
      taskID: input.taskID,
      selectedAttachmentCount: input.attachments.length,
    })

    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (frontend-design): ${projection.taskTitle}`,
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
        stageOwnedToolIDs: FRONTEND_DESIGN_STAGE_OWNED_TOOL_IDS,
        stageMaterializers: {
          capture_frontend_visual_evidence: createStageToolMaterializerBinding({
            id: "frontend-design.capture-visual-evidence",
            input: captureFactoryInput,
          }),
        },
        materializeExact,
        getCollector: () => outputToolKit.getCollector(),
      },
      buildUserPrompt: () => buildUserPrompt(projection, input.agentID),
      buildUserParts: () => buildPromptParts(projection, input.agentID),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    const collector = out.collector as FrontendDesignCollector
    const structured = await outputToolKit.snapshotCurrent()
    const snapshotCollector = outputToolKit.getCollector()
    const specs = collector.specs

    log.info("frontend design finished", {
      specs: specs.length,
      structuredMissing: !structured,
    })

    if (!structured) {
      return {
        outcome: "partial",
        sessionID: out.session.id,
        finalMessageID: out.finalMessage.info.id,
        specs,
        factSnapshot: snapshotCollector,
        missing: outputToolKit.missingActions(),
        completenessFindings: snapshotCollector.semantic_error ? [snapshotCollector.semantic_error] : [],
        ...(snapshotCollector.semantic_error ? { error: snapshotCollector.semantic_error } : {}),
      }
    }

    return {
      outcome: "complete",
      specs,
      designSystem: structured.design_system,
      techStack: structured.tech_stack,
      frontendTemplate: structured.frontend_template,
      finalAcceptanceMode: structured.final_acceptance_mode,
      fillableModules: structured.fillable_modules,
      componentInventory: structured.component_inventory,
      componentReusePlan: structured.component_reuse_plan,
      baselineReplacementPlan: structured.baseline_replacement_plan,
      implementationPhaseOutcomes: structured.implementation_phase_outcomes,
      qualityProjectContract: structured.quality_project_contract,
      materialInventory: structured.material_inventory,
      frontendProject: structured.frontend_project,
      visualValidationEvidence: structured.visual_validation_evidence,
      visualConsistencyContract: structured.visual_consistency_contract,
      visualRegionBindings: structured.visual_region_bindings,
      uiDataContract: structured.ui_data_contract,
      templateIterationNotes: structured.template_iteration_notes,
      completenessReview: structured.completeness_review,
      referenceArtifacts: structured.reference_artifacts,
      openQuestions: structured.open_questions,
      designDirections: structured.design_directions,
      selectedDesignDirectionID: structured.selected_design_direction_id,
      antiSlopReview: structured.anti_slop_review,
      competitorReferenceEvidence: structured.competitor_reference_evidence,
      finalMessageID: out.finalMessage.info.id,
      completenessFindings: snapshotCollector.semantic_error ? [snapshotCollector.semantic_error] : [],
      artifact: structured,
      sessionID: out.session.id,
    }
  }

}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

async function buildPromptParts(input: FrontendDesignPromptProjection, agentID: string) {
  return [{ type: "text" as const, text: buildUserPrompt(input, agentID) }]
}

function buildUserPrompt(input: FrontendDesignPromptProjection, agentID: string): string {
  const visualSkeletonRef = ProjectRuntimePaths.taskRelative(
    input.taskID,
    "frontend-design",
    "visual-html-skeleton",
  )
  const sections = [
    `# Delegation\n\nProjected agent "${agentID}" is asked through the frontend_design adapter to produce the high-fidelity visual HTML skeleton contract, frontend template, fillable modules, material inventory, visual/data contracts, known transcription problems, and projected-consumer handoff notes for this task. Read the exact DesignResourceManifest locator before assigning intent, authority, or relationships to neutral file refs; never infer semantics from MIME, filename, order, or task wording.`,
    `# Dispatch instruction\n\n${input.instruction}`,
    renderUserRequestSection({
      heading: "# Task",
      title: input.taskTitle,
      request: input.taskRequest,
      taskID: input.taskID,
    }),
  ]
  const referencedFacts = renderPromptSections(
    withAttachmentPromptSections(input.observationSections, input.attachments),
  )
  if (referencedFacts) {
    sections.push(
      referencedFacts +
        "\n\nFiles are neutral refs, not a semantic handoff. Use `artifact_read` on the exact manifest locator for intent and relationships, then inspect listed refs through visible tools before making visual, PDF, audio, video, or file-content claims.",
    )
  }

  if (input.mode === "reference_parity") {
    sections.push(
        "# Reference-Parity Design Contract\n\n" +
          "The only reference authority is the set of canonical refs declared by the exact DesignResourceManifest and projected durable facts. Read the manifest with `artifact_read`, then inspect every authority ref it names through visible tools before making visual, structural, content, token, or interaction claims. If the manifest or its required evidence is missing, report that exact blocker instead of inventing a substitute. Do not infer package names, directory layouts, filenames, acquisition steps, or evidence from a URL or task wording. " +
          `Author the handoff as a task-scoped, source-editable HTML/CSS skeleton under \`${visualSkeletonRef}\`. Create bounded HTML, external token/layout/region CSS, representative states, and owned assets by tracing each material decision to an explicit projected ref. ` +
          "Render the skeleton through a real task-scoped browser or static harness, personally inspect the screenshot against the declared visual refs, and repair visible hierarchy, density, spacing, readability, state, overflow, and content mismatches. Do not use build success, a fixed score, or an external verdict as visual proof. " +
          'Capture and register parity proof through `capture_frontend_visual_evidence({ kind: "reference_comparison", ... })`. This canonical tool renders through the same task-scoped Node/Playwright browser used by snapshot verification, writes the screenshot, derives hashes, and binds an explicitly declared source reference artifact; provide `location_hash` for deterministic hash-routed states and an optional diff only when it is a real produced artifact. Use `update_frontend_visual_evidence` only to correct metadata for an already materialized canonical artifact. ' +
          "Set `frontend_project.role=visual_baseline_input` and `final_acceptance_mode=visual_baseline_allowed` only after the rendered skeleton has reference-comparison evidence and no blocking design debt. Use `maintainable_replacement_required` and role=implementation_target only when the task actually requires and the handoff contains a maintainable application implementation. " +
          "Before finishing, review reference coverage, visual fidelity, and projected implementation feasibility together. Put actual uncovered refs, mismatching regions, implementation constraints, corrections, and blockers into `template_iteration_notes`, `completeness_review`, `quality_project_contract`, and `open_questions`; never claim parity for an uninspected or undeclared source.",
      )
  } else {
    sections.push(
      "# Greenfield Original Design Contract\n\n" +
        `Author the selected original direction as a task-scoped, source-editable HTML/CSS skeleton under \`${visualSkeletonRef}\`. Read every declared textual design resource through its manifest ref. The explicit task requirements and projected product, interaction, accessibility, implementation, and no-brand-copy constraints are the sole design authority. ` +
        "A pre-existing visual reference or production application scaffold is not a prerequisite. Do not report `frontend_project.role=blocked` merely because reference-parity inputs do not exist. " +
        "Create bounded `index.html`, external token/layout/region CSS, representative states, and owned source assets with the file-edit tools. Use multiple named design directions, select one, record rejected generic traits, and materialize the selected direction rather than stopping at prose. " +
        'Render and register the skeleton through `capture_frontend_visual_evidence({ kind: "render_review", ... })`, provide `location_hash` for deterministic hash-routed states, then personally inspect that task-scoped screenshot, repair visible hierarchy, density, spacing, readability, state, and overflow defects, and recapture the same evidence row. This canonical tool uses the same Node/Playwright browser as snapshot verification and derives the screenshot hash; do not launch a separate browser command or invent a digest. Greenfield evidence requires no external visual reference and must not cite a source-reference comparison or claim parity. The rendered skeleton is the visual ground truth for the projected implementation consumer, so set `final_acceptance_mode=visual_baseline_allowed` and `frontend_project.role=visual_baseline_input` only after this evidence exists and no blocking design debt remains. ' +
        "Before finishing, review visual hierarchy, state completeness, and projected implementation feasibility together, and record the actual findings and corrections in `template_iteration_notes` and `completeness_review`. Preserve every task-declared functional surface and use suitable maintained project dependencies where the projected implementation contract requires them. Do not claim production implementation or reference parity from the HTML design draft.",
    )
  }

  return sections.join("\n\n")
}

function frontendDesignPathsForTask(taskID: string): ReturnType<typeof ProjectRuntimePaths.frontendDesignPaths> {
  return ProjectRuntimePaths.frontendDesignPaths(
    taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id }),
    taskID,
  )
}

function buildUserPromptForTest(
  input: Omit<FrontendDesignPromptProjection, "instruction" | "attachments" | "observationSections"> & {
    agentID: string
    instruction?: string
    attachments?: FrontendDesignPromptProjection["attachments"]
    observationSections?: string[]
  },
) {
  const { agentID, ...projection } = input
  return buildUserPrompt(
    {
      ...projection,
      instruction: input.instruction ?? "Test Frontend Design instruction.",
      attachments: input.attachments ?? [],
      observationSections: input.observationSections ?? [],
    },
    agentID,
  )
}

export const FrontendDesignTestHooks = {
  buildPromptParts,
  buildUserPrompt: buildUserPromptForTest,
  projectFrontendDesignInput,
}
