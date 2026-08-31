import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { Log } from "@/util/log"
import { createAiSdkToolFromInfo } from "@/tool/ai-sdk-adapter"
import type { Tool } from "@/tool/tool"
import { BrowserPreviewCompareReferenceRegionsTool } from "@/tool/browser-preview-compare-reference-regions"
import { BrowserPreviewCompareScrollSlicesTool } from "@/tool/browser-preview-compare-scroll-slices"
import { BrowserPreviewLayoutGeometryTool } from "@/tool/browser-preview-layout-geometry"
import { BrowserPreviewCaptureTool } from "@/tool/browser-preview-capture"
import { BrowserPreviewCaptureInteractionStateTool } from "@/tool/browser-preview-capture-interaction-state"
import { BrowserPreviewTool } from "@/tool/browser-preview"
import { VISUAL_QA_OUTPUT_TOOL_IDS } from "./static-tools"
import { createVisualQaOutputTools } from "./output-tools"
import type { VisualReview } from "./schema"
import { renderVisualQaProductDesignPrinciples } from "./product-design-principles"
import { renderPromptSections } from "@/agent/prompt-projection"
import type { VisualQaDispatchContext } from "./context"
import { Session } from "@/session"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { createStageToolMaterializerBinding } from "@/agent/stage-tool-materializer"

const log = Log.create({ service: "visual-qa" })

export namespace VisualQaAgent {
  export interface AnalyzeInput {
    taskTitle: string
    taskRequest: string
    reason: string
    focus?: string
    contextSections?: string[]
    dispatchContext?: VisualQaDispatchContext
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    projectRoot?: string
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
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

  export type AnalyzeResult = {
    outcome: "observed"
    review: VisualReview
    completenessFindings: string[]
    advisories: string[]
    sessionID: string
    finalMessageID: string
    judgmentTool?: {
      messageID: string
      partID: string
      callID: string
    }
  }

  export async function analyze(input: AnalyzeInput): Promise<AnalyzeResult | AgentCoordinationHandoffResult> {
    const dispatchContext = input.dispatchContext ?? {}
    const outputFactoryInput = {
      taskID: input.taskID,
      projectRoot: input.projectRoot,
      referenceParityRequired: dispatchContext.referenceParityRequired,
      requiredReferenceRegions: dispatchContext.requiredReferenceRegions,
    }
    const outputToolKit = createVisualQaOutputTools(outputFactoryInput)
    const materializeExact = async (toolID: string) =>
      outputToolKit.materializeExact(toolID) ??
      createVisualQaEvidenceToolExact(toolID, {
        agentID: input.agentID,
        taskID: input.taskID,
        signal: input.signal,
      })

    log.info("visual QA starting", {
      taskID: input.taskID,
      contextSections: input.contextSections?.length ?? 0,
      focus: input.focus,
    })

    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (visual-qa): ${input.taskTitle}`,
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
        stageOwnedToolIDs: VISUAL_QA_OUTPUT_TOOL_IDS,
        stageMaterializers: {
          register_visual_qa_problem_dom_region: createStageToolMaterializerBinding({
            id: "visual-qa.problem-dom-region",
            input: Object.fromEntries(
              Object.entries(outputFactoryInput).filter(([, value]) => value !== undefined),
            ),
          }),
        },
        materializeExact,
        getCollector: () => outputToolKit.getCollector(),
      },
      buildUserPrompt: () => buildVisualQaUserPrompt(input, dispatchContext),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    const snapshot = await outputToolKit.snapshotReview()
    const judgmentTool = await latestVisualQaJudgmentTool(out.session.id)

    log.info("visual QA finished", {
      sessionID: out.session.id,
      accepted: snapshot.review.accepted,
      findings: snapshot.review.findings.length,
      evidence: snapshot.review.evidence.length,
      completenessFindings: snapshot.completenessFindings.length,
    })

    return {
      outcome: "observed",
      review: snapshot.review,
      completenessFindings: snapshot.completenessFindings,
      advisories: snapshot.advisories,
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
      judgmentTool,
    }
  }
}

async function latestVisualQaJudgmentTool(sessionID: string): Promise<
  | {
      messageID: string
      partID: string
      callID: string
    }
  | undefined
> {
  const candidates = (await Session.messages({ sessionID })).flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === "tool" && part.tool === "update_visual_qa_judgment" && part.state.status === "completed"
        ? [
            {
              messageID: message.info.id,
              partID: part.id,
              callID: part.callID,
              timeCompleted: part.state.time.end,
            },
          ]
        : [],
    ),
  )
  const latest = candidates.sort((left, right) => right.timeCompleted - left.timeCompleted)[0]
  return latest
    ? {
        messageID: latest.messageID,
        partID: latest.partID,
        callID: latest.callID,
      }
    : undefined
}

function buildVisualQaUserPrompt(
  input: VisualQaAgent.AnalyzeInput,
  dispatchContext = input.dispatchContext ?? {},
): string {
  const sections = [
    `# Delegation\n\nProjected agent "${input.agentID}" is asked through the visual_qa adapter to run the frontend visual GUI and functional product review selected by the active expert-package contract.`,
    "GUI means Graphical User Interface: the visible application screen and controls. This adapter owns focused frontend visual and product-design review evidence; other projected reviewers may own different evidence dimensions when the active package declares them. Consume only the task-scoped context supplied below as upstream evidence, test the real rendered product, and register each observed fact. Visual QA is review-only: do not edit files, run shell repair commands, or claim code repair. Register each concrete review check before registering evidence, and cite only evidence that you actually inspected. Every coverage row, finding, blocker, Document Object Model problem region, unresolved module problem, and parity reference must cite registered check IDs and registered evidence refs. Review component truth and visible functionality first, layout and composition second, then spacing, typography, color, and state polish. When a visual blocker maps to a rendered node, include its locator, bounded markup, layout box, computed styles, attributes, and code-search terms. Reference fidelity is in scope only when the current task or active package explicitly requires it. When the active package projects visual-comparison tools, pass exact immutable source artifact refs and explicit source and implementation geometry; never infer a source path or treat a mutable file name as evidence identity. Read each comparison result's own guidance, status, and artifacts before citing it. The active package owns source selection, viewport scope, comparison coverage, and the distinction between formal and supporting evidence. Do not judge a whole product from one screenshot or one external score.",
    "Browser Preview evidence discipline: first establish one ready persisted `browser_preview_target`. When a service command does not print a URL, pass its exact reachable HTTP(S) URL explicitly to `browser_preview`; do not guess or continue from a missing target. Call `browser_preview_capture` for every required persisted viewport. After Browser Model Context Protocol interaction produces a modal, hover, focus, menu, edited, or other named state, call `browser_preview_capture_interaction_state` with that exact completed screenshot/observe tool part, persisted viewport, and explicit state ID. Its image attachments are the exact PNG bytes for direct inspection, while each returned `locator` is the durable identity that must be searched, completely read with its capture resource, selected, and registered against concrete checks. Browser screenshots that are not explicitly promoted through this strict state capture producer remain immediate observations only and never become acceptance evidence by themselves.",
    "Tool result acceptance discipline: `state.status=completed`, returned attachments, job IDs, or registered evidence rows are not acceptance proof. Discover the resulting Browser Preview Artifact in the current Task catalog and cite its exact `artifact_read` locator. Read that exact locator and its resource locators before registration; failed visual_diff results and diagnostic-only layout-geometry must become blockers or supporting diagnostics, not pass evidence. Never cite a job ID, display namespace, filename, AttachmentStore URL, or side-by-side path as evidence identity. `update_visual_qa_judgment` records the current facts; if its result reports completeness findings, continue acquiring or registering real evidence, or revise to an honest non-pass judgment instead of narrating acceptance.",
    "Geometry alignment discipline: broad heading or section enumeration is only a discovery aid. The submitted `browser_preview_layout_geometry` request must use explicit task-scoped region ids, and shared-rail `alignmentGroups` must include every affected downstream section such as `News` when it belongs to the same content rail.",
    renderUserRequestSection({
      heading: "# Task",
      title: input.taskTitle,
      request: input.taskRequest,
      taskID: input.taskID,
    }),
    renderVisualQaProductDesignPrinciples(),
    `# Dispatch Reason\n\n${input.reason}`,
  ]
  if (input.focus?.trim()) sections.push(`# Focus\n\n${input.focus}`)
  if (dispatchContext.appUrl?.trim()) sections.push(`# Known Preview URL\n\n${dispatchContext.appUrl}`)
  if (dispatchContext.previewCommand?.trim()) {
    sections.push(
      "# Suggested Preview Command\n\n" +
        `${dispatchContext.previewCommand}\n\n` +
        "Use Node for Playwright/browser automation on Windows. Do not launch Playwright through bun.",
    )
  }
  if (dispatchContext.referenceParityRequired) {
    sections.push(
      "# Reference Parity Evidence Contract\n\n" +
        "This task has structured visual/reference parity acceptance. Use `reference_parity.required=true`. Put only formal `reference-comparison` evidence refs in `reference_comparison_evidence_refs`; cite screenshot or visual_diff refs as supporting evidence rows, not as formal reference parity refs. List exact blockers for any region that remains unverified. " +
        "A one-shot whole-page screenshot judge is not valid completion evidence. Do not invent reference-comparison refs.",
    )
  }
  const referencedFacts = renderPromptSections(input.contextSections)
  if (referencedFacts) sections.push(referencedFacts)
  sections.push(
    "# Required Output\n\n" +
      "Register every check, evidence item, coverage row, finding, blocker, question, and parity fact you actually observed. You may call `update_visual_qa_judgment` whenever you have a current accepted judgment and concise summary; it is optional and may be revised after later facts. Missing, conflicting, or incomplete facts remain visible to the Orchestrator and never invalidate the Session. A positive judgment should have fresh screenshot-bearing exact Artifact locators tied to check_ids, coverage of checked GUI regions/viewports/states/functions, no failed/inconclusive check_items, no open critical/major finding, no production_blockers, no unresolved_code_module_problems, and evidence that coarse component/function defects named by context are absent in the current rendered product. Every source_ref, evidence_ref, evidence.ref, and reference_comparison_evidence_ref must be an exact locator returned by the current Task's artifact catalog and readable with `artifact_read`; display namespaces, bare IDs, paths, filenames, URLs, AttachmentStore refs, and command text are not evidence identities. If the review covers more than one viewport, include a `multi-viewport-alignment` check item with coverage spanning those viewports. If explicit reference parity is in scope, cite registered formal `reference-comparison` Artifact locators in `reference_comparison_evidence_refs` when available, use per-screen screenshots or scroll-slice comparisons only as supporting evidence for page-level analysis, register a check item for each required reference region, and name any remaining evidence gap instead of inventing proof. For each DOM-localizable visual blocker, add `problem_dom_regions`; for each source problem, register an unresolved code-module problem. The adapter persists one core `visual_review` from these registered facts; do not publish a generic `visual_qa_review` or any parallel prose artifact as a substitute. Finish with a visible summary of findings, limitations, and exact Artifact locators.",
  )
  return sections.join("\n\n")
}

export async function createVisualQaEvidenceToolExact(
  toolID: string,
  input: { agentID: string; taskID?: string; signal?: AbortSignal },
) {
  const toolInfos: Record<string, Tool.Info> = {
    browser_preview: BrowserPreviewTool,
    browser_preview_capture: BrowserPreviewCaptureTool,
    browser_preview_capture_interaction_state: BrowserPreviewCaptureInteractionStateTool,
    browser_preview_compare_reference_regions: BrowserPreviewCompareReferenceRegionsTool,
    browser_preview_compare_scroll_slices: BrowserPreviewCompareScrollSlicesTool,
    browser_preview_layout_geometry: BrowserPreviewLayoutGeometryTool,
  }
  const info = toolInfos[toolID]
  return info ? createVisualQaTool(info, input) : undefined
}

async function createVisualQaTool(
  info: Tool.Info,
  input: { agentID: string; taskID?: string; signal?: AbortSignal },
  initCtx?: Tool.InitContext,
) {
  return createAiSdkToolFromInfo({
    info,
    agent: input.agentID,
    taskID: input.taskID,
    signal: input.signal,
    initCtx,
  })
}

export const VisualQaTestHooks = {
  buildVisualQaUserPrompt,
}
