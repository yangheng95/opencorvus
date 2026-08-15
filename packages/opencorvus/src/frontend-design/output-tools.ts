/**
 * Structured output tools for the Frontend Design Agent.
 *
 * Update tools accumulate inspectable frontend-design facts. The Host derives
 * a snapshot when the Turn ends; no terminal tool closes the collector.
 */
import { tool } from "ai"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"
import { BrowserRuntime } from "@/browser/runtime"
import { runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { requireRuntimePackage } from "@/runtime/package-require"
import {
  ColorSchema,
  ComponentSchema,
  CompetitorReferenceEvidenceSchema,
  DesignDirectionSchema,
  FrontendDesignPayloadSchema,
  FrontendDesignModeSchema,
  FrontendDesignBasicsToolInputSchema,
  FrontendDesignCompactItemToolInputSchema,
  FrontendDesignMarkdownSectionToolInputSchema,
  FrontendReferenceArtifactToolInputSchema,
  FrontendDesignStringItemToolInputSchema,
  FrontendDesignDraftSchema,
  FrontendReferenceComparisonCaptureToolInputSchema,
  FrontendRenderReviewCaptureToolInputSchema,
  FrontendVisualEvidenceCaptureToolInputSchema,
  FrontendVisualRegionBindingManifestToolInputSchema,
  FrontendProjectToolInputSchema,
  InteractionSchema,
  LayoutSchema,
  ResponsiveSchema,
  SpacingSchema,
  AntiSlopReviewItemSchema,
  ToolBaselineReplacementPlanItemSchema,
  ToolComponentReusePlanItemSchema,
  ToolDesignDirectionSelectionSchema,
  ToolImplementationPhaseOutcomeSchema,
  ToolMaterialInventoryItemSchema,
  ToolVisualValidationEvidenceSchema,
  TypographySchema,
  type FrontendDesignPayload,
  type FrontendDesignMode,
  type VisualValidationEvidence,
  type VisualSpec,
  type VisualSpecCategory,
} from "./schema"
import { VisualRegionBindingManifestSchema, type VisualRegionBindingManifest } from "./visual-region-binding-schema"
import { markdownList } from "@/util/markdown"
import { Filesystem } from "@/util/filesystem"
import { bindStageToolMaterializer } from "@/agent/stage-tool-materializer"

export type { FrontendDesignPayload } from "./schema"

const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")
type FrontendDesignDraft = z.infer<typeof FrontendDesignDraftSchema>
type FrontendDesignDraftState = Partial<FrontendDesignDraft>
type VisualEvidenceCaptureMode = VisualValidationEvidence["capture_mode"]
type VisualEvidenceValidationDiagnostic = {
  code: string
  message: string
}
type VisualEvidenceValidationResult =
  | { ok: true }
  | {
      ok: false
      diagnostic: VisualEvidenceValidationDiagnostic
    }

const StaticHtmlScreenshotScript = String.raw`
const { chromium } = require(process.argv[3]);

function opencorvusActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.message === "string") return event + " " + payload.message;
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.text === "string") return event + " " + payload.text;
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

function opencorvusTaggedInactivityError(message) {
  const error = new Error(message);
  error.opencorvusBrowserInactivity = true;
  return error;
}

function opencorvusIsBrowserInactivityError(error) {
  return Boolean(error && error.opencorvusBrowserInactivity === true);
}

function opencorvusTaggedPageValidationError(message) {
  const error = new Error(message);
  error.opencorvusPageValidation = true;
  return error;
}

function installOpencorvusBrowserFailureTracker(page, label) {
  const failures = [];
  const listeners = [];
  const record = (source) => {
    if (!failures.includes(source)) failures.push(source);
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    if (status >= 400) record(opencorvusActivityLabel("response", payload) + " HTTP " + status);
  });
  on("requestfailed", (payload) => record(opencorvusActivityLabel("requestfailed", payload)));
  on("pageerror", (payload) => record(opencorvusActivityLabel("pageerror", payload)));
  return {
    assertNoFailures(stage) {
      if (failures.length > 0) throw opencorvusTaggedPageValidationError(label + " browser failure before " + stage + ": " + failures.join("; "));
    },
    dispose() {
      for (const [event, handler] of listeners) page.off(event, handler);
    },
  };
}

async function opencorvusWithBrowserInactivity(page, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
  });
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const reset = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    timer = setTimeout(() => {
      rejectInactive(opencorvusTaggedInactivityError(label + " browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    rejectInactive(opencorvusTaggedPageValidationError(label + " browser failure before evidence capture: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(opencorvusActivityLabel("console", payload)));
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    if (status >= 400) {
      fail(opencorvusActivityLabel("response", payload) + " HTTP " + status);
      return;
    }
    reset(opencorvusActivityLabel("response", payload));
  });
  on("requestfailed", (payload) => fail(opencorvusActivityLabel("requestfailed", payload)));
  on("pageerror", (payload) => fail(opencorvusActivityLabel("pageerror", payload)));
  reset("start");
  try {
    return await Promise.race([action(), inactive]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

function decodePayload() {
  const raw = Buffer.from(process.argv[2], "base64").toString("utf8");
  return JSON.parse(raw);
}

(async () => {
  const payload = decodePayload();
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: payload.executablePath,
      headless: true,
      args: payload.launchArgs,
      timeout: payload.timeoutMs,
    });
    const page = await browser.newPage({
      viewport: { width: payload.viewport.width, height: payload.viewport.height },
      deviceScaleFactor: 1,
    });
    const browserFailures = installOpencorvusBrowserFailureTracker(page, "static HTML screenshot");
    let bytes;
    try {
      await opencorvusWithBrowserInactivity(
        page,
        "navigate " + payload.url,
        payload.timeoutMs,
        () => page.goto(payload.url, { waitUntil: "domcontentloaded", timeout: 0 }),
      );
      await opencorvusWithBrowserInactivity(
        page,
        "networkidle " + payload.url,
        Math.min(5000, payload.timeoutMs),
        () => page.waitForLoadState("networkidle", { timeout: 0 }),
      ).catch((error) => {
        if (opencorvusIsBrowserInactivityError(error)) return undefined;
        throw error;
      });
      browserFailures.assertNoFailures("evidence capture");
      bytes = await page.screenshot({ type: "png", fullPage: payload.captureMode === "full_page" });
      browserFailures.assertNoFailures("evidence capture");
    } finally {
      browserFailures.dispose();
    }
    process.stdout.write(JSON.stringify({ ok: true, screenshotBase64: bytes.toString("base64") }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      kind: error && error.opencorvusPageValidation === true ? "page_validation" : "toolchain",
      error: error instanceof Error ? error.message : String(error),
    }));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
`

// ---------------------------------------------------------------------------
// Collector — private. Callers read through getSpecs() / getStats().
//
// Cross-field completeness is reported as inspectable findings. The agent may
// under-register optional anchors; callers consume the current FrontendDesign
// fact snapshot and its findings.
// ---------------------------------------------------------------------------

export interface FrontendDesignCollector {
  mode: FrontendDesignMode
  specs: VisualSpec[]
  draft: FrontendDesignDraftState
  semantic_error?: string
}

const VISUAL_ANCHOR_BUDGET = 80
const REQUIRED_IMPLEMENTATION_PHASES = [
  "evidence_lock",
  "implementation_scaffold",
  "data_component_transcription",
  "runtime_visual_verification",
  "source_quality_cleanup",
] as const
const artifactValidatedVisualDesigns = new WeakSet<FrontendDesignPayload>()

function emptyCollector(mode: FrontendDesignMode): FrontendDesignCollector {
  return { mode, specs: [], draft: {} }
}

function titleFromMarkdown(text: string): string | undefined {
  const line = text
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith("# "))
  return line?.replace(/^#+\s*/, "").trim()
}

function renderComponentReusePlan(items: readonly FrontendDesignPayload["component_reuse_plan"][number][]): string {
  if (items.length === 0) return "- no component reuse plan recorded"
  return items
    .map((item) => {
      const lines = [
        `- ${item.family_id} — ${item.name}`,
        `  - strategy: ${item.implementation_strategy}`,
        `  - surface: ${item.observed_surface}`,
        `  - reuse_source: ${item.reuse_source}`,
        `  - props_states: ${item.props_states}`,
        `  - replacement_boundary: ${item.replacement_boundary}`,
        `  - parity_guard: ${item.parity_guard}`,
      ]
      if (item.mature_library_candidates.length > 0) {
        lines.push(`  - mature_library_candidates: ${item.mature_library_candidates.join(", ")}`)
      }
      if (item.source_refs.length > 0) {
        lines.push(`  - source_refs: ${item.source_refs.join(", ")}`)
      }
      if (item.project_specific_reason) {
        lines.push(`  - project_specific_reason: ${item.project_specific_reason}`)
      }
      return lines.join("\n")
    })
    .join("\n")
}

function renderBaselineReplacementPlan(
  items: readonly FrontendDesignPayload["baseline_replacement_plan"][number][],
): string {
  if (items.length === 0) return "- no source-region evolution plan recorded"
  return items
    .map((item) => {
      const lines = [
        `- ${item.boundary_id} — ${item.source_region}`,
        `  - action: ${item.action}`,
        `  - component_family_id: ${item.component_family_id}`,
        `  - replacement_strategy: ${item.replacement_strategy}`,
        `  - reuse_source: ${item.reuse_source}`,
        `  - deletion_rule: ${item.deletion_rule}`,
        `  - parity_guard: ${item.parity_guard}`,
      ]
      if (item.mature_library_candidates.length > 0) {
        lines.push(`  - mature_library_candidates: ${item.mature_library_candidates.join(", ")}`)
      }
      if (item.source_refs.length > 0) {
        lines.push(`  - source_refs: ${item.source_refs.join(", ")}`)
      }
      if (item.project_specific_reason) {
        lines.push(`  - project_specific_reason: ${item.project_specific_reason}`)
      }
      return lines.join("\n")
    })
    .join("\n")
}

function renderImplementationPhaseOutcomes(
  items: readonly FrontendDesignPayload["implementation_phase_outcomes"][number][],
): string {
  if (items.length === 0) return "- no implementation phase outcomes recorded"
  return items
    .map((item) =>
      [
        `- ${item.id} — ${item.title}`,
        `  - phase: ${item.phase}`,
        `  - deliverable: ${item.deliverable}`,
        `  - acceptance: ${item.acceptance}`,
        `  - source_refs: ${item.source_refs.join(", ")}`,
      ].join("\n"),
    )
    .join("\n")
}

function renderNamedItems(
  title: string,
  items: readonly {
    title: string
    detail: string
    source_refs?: string[]
  }[],
): string {
  if (items.length === 0) return ""
  const lines = [`## ${title}`]
  for (const item of items) {
    lines.push(`- ${item.title}: ${item.detail}`)
    if (item.source_refs && item.source_refs.length > 0) {
      lines.push(`  - source_refs: ${item.source_refs.join(", ")}`)
    }
  }
  return lines.join("\n")
}

function renderDesignDirections(items: readonly FrontendDesignPayload["design_directions"][number][]): string {
  if (items.length === 0) return "- no competing design directions recorded"
  return items
    .map((item) =>
      [
        `- ${item.id} — ${item.name}`,
        `  - concept: ${item.concept}`,
        `  - tradeoffs: ${item.tradeoffs}`,
        `  - implementation_notes: ${item.implementation_notes}`,
        item.evidence_refs.length > 0 ? `  - evidence_refs: ${item.evidence_refs.join(", ")}` : undefined,
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n"),
    )
    .join("\n")
}

function renderAntiSlopReview(items: readonly FrontendDesignPayload["anti_slop_review"][number][]): string {
  if (items.length === 0) return "- no rejected generic traits review rows recorded"
  return items
    .map((item) =>
      [
        `- ${item.id}: ${item.rejected_trait}`,
        `  - evidence: ${item.evidence}`,
        `  - correction: ${item.correction}`,
      ].join("\n"),
    )
    .join("\n")
}

function renderCompetitorReferenceEvidence(
  items: readonly FrontendDesignPayload["competitor_reference_evidence"][number][],
): string {
  if (items.length === 0) return "- no competitor/reference webpage screenshot evidence recorded"
  return items
    .map((item) =>
      [
        `- ${item.id}: ${item.competitor_url}`,
        `  - evidence_source: ${item.evidence_source}`,
        `  - source_page_ref: ${item.source_page_ref}`,
        `  - screenshot_artifact: ${item.screenshot_artifact}`,
        `  - screenshot_sha256: ${item.screenshot_sha256}`,
        `  - viewport: ${item.viewport}`,
        `  - inspected_elements: ${item.inspected_elements.join(", ")}`,
        `  - influence_on_selected_direction: ${item.influence_on_selected_direction}`,
        `  - source_refs: ${item.source_refs.join(", ")}`,
      ].join("\n"),
    )
    .join("\n")
}

function renderVisualValidationEvidence(
  items: readonly FrontendDesignPayload["visual_validation_evidence"][number][],
): string {
  if (items.length === 0) return "- no structured rendered screenshot evidence recorded"
  return items
    .map((item) =>
      [
        `- ${item.id}: ${item.review_status}`,
        `  - render_target: ${item.render_target}`,
        `  - rendered_entrypoint: ${item.rendered_entrypoint}`,
        `  - renderer: ${item.renderer}`,
        `  - viewport: ${item.viewport}`,
        `  - location_hash: ${item.location_hash || "(none)"}`,
        `  - capture_mode: ${item.capture_mode}`,
        `  - rendered_skeleton_preview_artifact: ${item.screenshot_artifact}`,
        `  - evidence_kind: ${item.kind}`,
        `  - screenshot_sha256: ${item.screenshot_sha256}`,
        item.kind === "reference_comparison"
          ? `  - source_reference_artifact: ${item.source_reference_artifact}`
          : undefined,
        item.kind === "reference_comparison"
          ? `  - source_reference_sha256: ${item.source_reference_sha256}`
          : undefined,
        item.kind === "reference_comparison" && item.diff_artifact
          ? `  - diff_artifact: ${item.diff_artifact}`
          : undefined,
        `  - review_summary: ${item.review_summary}`,
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n"),
    )
    .join("\n")
}

function renderVisualRegionBindings(items: readonly VisualRegionBindingManifest[]): string {
  if (items.length === 0) return "- no structured VisualRegionBinding manifests recorded"
  return items
    .map((item) =>
      [
        `- ${item.manifest_path}: ${item.slicing_strategy}`,
        `  - source_image: ${item.source_image}`,
        `  - bbox_overlay_artifact: ${item.bbox_overlay_artifact}`,
        `  - contact_sheet_artifact: ${item.contact_sheet_artifact}`,
        `  - regions: ${item.regions
          .map(
            (region) => `${region.source_order}:${region.reference_region_key} -> ${region.source_reference_artifact}`,
          )
          .join(", ")}`,
      ].join("\n"),
    )
    .join("\n")
}

function renderComponentInventoryFromReusePlan(
  items: readonly FrontendDesignPayload["component_reuse_plan"][number][],
): string {
  if (items.length === 0) return ""
  return [
    "Component-family cross-check.",
    "Do not treat this field as a standalone component checklist; use component_reuse_plan, quality_project_contract, completeness_review, open_questions, and named source artifacts for implementation decisions.",
    `Reuse families captured: ${items.map((item) => item.family_id).join(", ")}`,
  ].join("\n")
}

function renderQualityProjectContract(design: FrontendDesignPayload, mode: FrontendDesignMode): string {
  if (design.frontend_project.role === "visual_baseline_input") {
    if (mode === "greenfield_original") {
      return [
        "## Original Visual HTML Design",
        "- Current deliverable: a source-editable static HTML/CSS design whose authority is the explicit task, product, system, API, interaction, and supplied material contracts.",
        "- The rendered evidence proves that the authored design was inspected at the declared viewport; it does not claim parity with an absent source screenshot.",
        "- Projected implementation consumers should transcribe the reviewed design into maintainable project source while preserving its declared behavior and visual contract.",
        "- The HTML design is not the acceptance app root unless the active task explicitly declares it as the implementation target.",
      ].join("\n")
    }
    const declaredReferences = design.visual_validation_evidence
      .filter((item) => item.kind === "reference_comparison")
      .map((item) => item.source_reference_artifact)
    return [
      "## Reference-Grounded Visual HTML Design",
      "- Current deliverable: a source-editable static HTML/CSS design reviewed against explicitly declared reference evidence.",
      `- Declared comparison authority: ${declaredReferences.join(", ") || "none recorded"}.`,
      "- Tokens, layout, content, assets, and state visuals must cite declared evidence rather than an inferred package path.",
      "- Active-package consumers may plan, implement, or review this design only through its explicit handoff and evidence refs.",
      "- The HTML design is not an implementation target or acceptance app root unless the active task explicitly declares it as such.",
    ].join("\n")
  }
  if (design.final_acceptance_mode === "visual_baseline_allowed") {
    return [
      "## Visual Design Handoff Incomplete",
      "- The selected acceptance mode requires `frontend_project.role=visual_baseline_input` with source-editable HTML/CSS and structured rendered evidence.",
      "- The recorded project facts do not satisfy that declared output shape; downstream consumers should treat the handoff as incomplete context.",
      "- Frontend design should provide editable entrypoints, owned styles/assets, and mode-appropriate rendered evidence; missing items remain visible findings.",
    ].join("\n")
  }
  const lines = [
    "## Maintainable Target Project",
    "- The frontend-design high-fidelity skeleton project is source evidence, not the implementation target.",
    "- Projected implementation consumers should preserve the readable target-project source ownership frontend_design delivered: React/Vue components, data modules, CSS modules/sidecars, asset references, runtime entrypoints, and verification commands.",
    "- Repeated rows/cards/items must be rendered from arrays and component loops.",
    "- Complex controls must follow component_reuse_plan; use baseline_replacement_plan only for specifically named raw/generated regions that need in-place evolution.",
  ]
  if (design.component_reuse_plan.length > 0) {
    lines.push("", "## Component Targets")
    for (const item of design.component_reuse_plan) {
      lines.push(`- ${item.family_id}: ${item.name} via ${item.implementation_strategy} (${item.reuse_source})`)
    }
  }
  if (design.baseline_replacement_plan.length > 0) {
    lines.push("", "## Baseline Replacement Boundaries")
    for (const item of design.baseline_replacement_plan) {
      lines.push(`- ${item.boundary_id}: ${item.action} using ${item.component_family_id}`)
    }
  }
  return lines.join("\n")
}

function normalizeFrontendDesignPayload(design: FrontendDesignPayload, mode: FrontendDesignMode): FrontendDesignPayload {
  const next = {
    ...design,
    frontend_project: design.frontend_project,
  }
  next.frontend_template =
    next.frontend_template.trim() || renderNamedItems("Frontend Template", next.frontend_template_sections)
  next.fillable_modules =
    next.fillable_modules.trim() || renderNamedItems("Fillable Modules", next.fillable_module_items)
  next.component_inventory =
    next.component_inventory.trim() || renderComponentInventoryFromReusePlan(next.component_reuse_plan)
  next.quality_project_contract =
    next.quality_project_contract.trim() ||
    renderNamedItems("Quality Project Contract", next.quality_project_items) ||
    renderQualityProjectContract(next, mode)
  next.material_inventory =
    next.material_inventory.trim() || renderNamedItems("Material Inventory", next.material_inventory_items)
  next.visual_consistency_contract =
    next.visual_consistency_contract.trim() ||
    renderNamedItems("Visual Consistency Contract", next.visual_consistency_items)
  next.ui_data_contract =
    next.ui_data_contract.trim() || renderNamedItems("UI Data Contract", next.ui_data_contract_items)
  return next
}

function normalizeProjectRootForReport(projectRoot: string): string {
  return normalizeReportPath(projectRoot)
}

function normalizeReportPath(value: string): string {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/").trim())
  if (normalized === ".") return ""
  return normalized.replace(/^\.\/+/, "").replace(/\/+$/, "")
}

function referencesVisualHtmlSkeletonRoot(normalizedProjectRoot: string): boolean {
  const root = normalizedProjectRoot.toLowerCase()
  const windowsEquivalentRoot = stripWindowsEquivalentSegmentSuffixes(root)
  return (
    root.split("/").includes("visual-html-skeleton") ||
    windowsEquivalentRoot.split("/").includes("visual-html-skeleton")
  )
}

function isValidVisualHtmlSkeletonRoot(normalizedProjectRoot: string, artifactRootRelative?: string): boolean {
  const root = normalizedProjectRoot.toLowerCase()
  if (root === ".." || root.startsWith("../")) return false
  if (root === "visual-html-skeleton") return true
  if (!artifactRootRelative) return false
  const fdRoot = normalizeReportPath(artifactRootRelative).toLowerCase()
  return root === `${fdRoot}/visual-html-skeleton`
}

function stripWindowsEquivalentSegmentSuffixes(normalizedPath: string): string {
  return normalizedPath
    .split("/")
    .map((segment) => segment.replace(/[ .]+$/g, ""))
    .join("/")
}

function parseMaybeStringArray(value: unknown): unknown {
  if (Array.isArray(value)) return value
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return []
  if (!trimmed.startsWith("[")) return value
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : value
  } catch {
    return value
  }
}

function normalizeFrontendDesignDraft(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const source = input as Record<string, unknown>
  const normalized: Record<string, unknown> = { ...source }

  // Some providers flatten a nested tool object into keys like
  // `frontend_project<arg_key>status`; rebuild that object before Zod parsing.
  const frontendProject: Record<string, unknown> = {
    ...(source.frontend_project &&
    typeof source.frontend_project === "object" &&
    !Array.isArray(source.frontend_project)
      ? (source.frontend_project as Record<string, unknown>)
      : {}),
  }
  let sawFlattenedFrontendProject = false
  for (const [key, value] of Object.entries(source)) {
    const match = /^frontend_project<arg_key>(.+)$/.exec(key)
    if (!match) continue
    sawFlattenedFrontendProject = true
    const field = match[1]
    frontendProject[field] = field === "entrypoints" || field === "notes" ? parseMaybeStringArray(value) : value
    delete normalized[key]
  }
  if (sawFlattenedFrontendProject || source.frontend_project) {
    normalized.frontend_project = frontendProject
  }
  return normalized
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function arrayField<T>(draft: FrontendDesignDraftState, key: keyof FrontendDesignDraft): T[] {
  const record = draft as Record<string, unknown>
  const existing = record[key as string]
  if (Array.isArray(existing)) return existing as T[]
  const created: T[] = []
  record[key as string] = created
  return created
}

function upsertByStringKey<T extends Record<string, unknown>>(
  items: T[],
  item: T,
  key: keyof T,
): "registered" | "overwritten" {
  const value = item[key]
  const idx = items.findIndex((existing) => existing[key] === value)
  if (idx >= 0) {
    items[idx] = item
    return "overwritten"
  }
  items.push(item)
  return "registered"
}

function appendUniqueString(list: string[], value: string): "registered" | "already_registered" {
  if (list.includes(value)) return "already_registered"
  list.push(value)
  return "registered"
}

function requiredImplementationPhaseMissingActions(draft: FrontendDesignDraftState): string[] {
  if (draft.final_acceptance_mode !== "maintainable_replacement_required") return []
  const covered = new Set((draft.implementation_phase_outcomes ?? []).map((item) => item.phase))
  return REQUIRED_IMPLEMENTATION_PHASES.filter((phase) => !covered.has(phase)).map(
    (phase) => `update_frontend_phase({ phase: "${phase}", id, title, deliverable, source_refs, acceptance })`,
  )
}

function frontendDraftMissingActions(collector: FrontendDesignCollector): string[] {
  const draft = collector.draft
  const actions: string[] = []

  if (!hasText(draft.design_system) || !hasItems(draft.tech_stack) || !hasText(draft.final_acceptance_mode)) {
    actions.push(
      'update_frontend_basics({ design_system, tech_stack, final_acceptance_mode: "visual_baseline_allowed" | "maintainable_replacement_required" })',
    )
  }
  if (!hasText(draft.frontend_template) && !hasItems(draft.frontend_template_sections)) {
    actions.push(
      'update_frontend_text({ section: "frontend_template", content }) or update_frontend_item({ target: "frontend_template_sections", item })',
    )
  }
  if (hasItems(draft.design_directions) && !hasText(draft.selected_design_direction_id)) {
    actions.push("select_frontend_design_direction({ id })")
  }
  if (!hasText(draft.fillable_modules) && !hasItems(draft.fillable_module_items)) {
    actions.push(
      'update_frontend_text({ section: "fillable_modules", content }) or update_frontend_item({ target: "fillable_module_items", item })',
    )
  }
  if (!hasItems(draft.component_reuse_plan)) {
    actions.push(
      "update_frontend_component_reuse({ family_id, name, observed_surface, implementation_strategy, reuse_source, props_states, replacement_boundary, parity_guard, ... })",
    )
  }
  if (!hasItems(draft.material_inventory_items)) {
    actions.push("update_frontend_material({ title, detail, source_refs })")
  }
  if (!hasText(draft.visual_consistency_contract) && !hasItems(draft.visual_consistency_items)) {
    actions.push(
      'update_frontend_text({ section: "visual_consistency_contract", content }) or update_frontend_item({ target: "visual_consistency_items", item })',
    )
  }
  if (!hasText(draft.ui_data_contract) && !hasItems(draft.ui_data_contract_items)) {
    actions.push(
      'update_frontend_text({ section: "ui_data_contract", content }) or update_frontend_item({ target: "ui_data_contract_items", item })',
    )
  }
  if (!hasText(draft.completeness_review)) {
    actions.push('update_frontend_text({ section: "completeness_review", content })')
  }
  if ((draft.template_iteration_notes?.length ?? 0) < 1) {
    actions.push("update_frontend_iteration_note({ value })")
  }
  actions.push(...requiredImplementationPhaseMissingActions(draft))
  if (draft.frontend_project?.role === "visual_baseline_input" && !hasItems(draft.visual_validation_evidence)) {
    actions.push(
      collector.mode === "greenfield_original"
        ? 'capture_frontend_visual_evidence({ kind: "render_review", id, rendered_entrypoint, screenshot_artifact, viewport: { width, height, label }, location_hash, capture_mode, review_status, review_summary })'
        : 'capture_frontend_visual_evidence({ kind: "reference_comparison", id, rendered_entrypoint, screenshot_artifact, source_reference_artifact, viewport: { width, height, label }, location_hash, capture_mode, review_status, review_summary })',
    )
  }
  return actions
}

async function frontendDesignFactStatus(
  collector: FrontendDesignCollector,
  options: {
    artifactRoot: string
    artifactRootRelative?: string
    workspaceRoot: string
    mode: FrontendDesignMode
    processIdentity: Readonly<{ taskID: string; cwd: string }>
  },
): Promise<string> {
  const missing = frontendDraftMissingActions(collector)
  const draft = collector.draft
  let status = missing.length > 0 ? "incomplete" : "snapshot_shape_complete"
  const diagnostics: string[] = []
  if (missing.length === 0 && draft.frontend_project?.role === "visual_baseline_input") {
    try {
      const parsed = FrontendDesignDraftSchema.parse(normalizeFrontendDesignDraft(draft))
      const design = normalizeFrontendDesignPayload(FrontendDesignPayloadSchema.parse(parsed), collector.mode)
      assertVisualEvidenceAuthority(design, collector.mode)
      const quality = await inspectVisualBaselineQualityForSnapshot(design, {
        artifactRoot: options.artifactRoot,
        artifactRootRelative: options.artifactRootRelative,
        requireArtifactVerification: true,
        processIdentity: options.processIdentity,
      })
      if (quality.status !== "high_fidelity_evidence_reported") {
        status = "visual_evidence_missing_or_inconsistent"
        if (quality.diagnostic) diagnostics.push(formatVisualEvidenceDiagnostic(quality.diagnostic))
      }
    } catch (err) {
      status = "snapshot_validation_findings"
      diagnostics.push(err instanceof Error ? err.message : String(err))
    }
  }
  const lines = [
    `FRONTEND_DESIGN_FACT_STATUS: ${status}`,
    `registered: template_items=${draft.frontend_template_sections?.length ?? 0}, design_directions=${draft.design_directions?.length ?? 0}, selected_direction=${draft.selected_design_direction_id || ""}, anti_slop_review=${draft.anti_slop_review?.length ?? 0}, competitor_evidence=${draft.competitor_reference_evidence?.length ?? 0}, fillable_items=${draft.fillable_module_items?.length ?? 0}, component_reuse=${draft.component_reuse_plan?.length ?? 0}, material_items=${draft.material_inventory_items?.length ?? 0}, quality_items=${draft.quality_project_items?.length ?? 0}, visual_items=${draft.visual_consistency_items?.length ?? 0}, data_items=${draft.ui_data_contract_items?.length ?? 0}, phase_outcomes=${draft.implementation_phase_outcomes?.length ?? 0}, visual_evidence=${draft.visual_validation_evidence?.length ?? 0}, visual_region_bindings=${draft.visual_region_bindings?.length ?? 0}, iteration_notes=${draft.template_iteration_notes?.length ?? 0}`,
  ]
  if (collector.semantic_error) lines.push(`last_validation_error: ${collector.semantic_error}`)
  for (const diagnostic of diagnostics) lines.push(`visual_evidence_error: ${diagnostic}`)
  if (missing.length > 0) {
    lines.push("next_required_update_calls:", markdownList(missing))
  } else if (status === "visual_evidence_missing_or_inconsistent") {
    lines.push(
      "next: repair the visual-html-skeleton, then recapture it with capture_frontend_visual_evidence.",
    )
  } else if (status === "snapshot_validation_findings") {
    lines.push("next: correct the invalid frontend result fragment named above.")
  } else {
    lines.push("next: continue refining facts or finish the visible Turn; the Host snapshots the collector.")
  }
  return lines.join("\n")
}

function assertVisualEvidenceAuthority(design: FrontendDesignPayload, mode: FrontendDesignMode): void {
  if (mode === "greenfield_original") {
    const comparison = design.visual_validation_evidence.find((item) => item.kind === "reference_comparison")
    if (comparison) {
      throw new Error(
        `greenfield_original visual evidence must use kind=render_review; ${comparison.id} claims undeclared reference parity`,
      )
    }
    return
  }
  const comparisons = design.visual_validation_evidence.filter((item) => item.kind === "reference_comparison")
  if (comparisons.length === 0) {
    throw new Error("reference_parity requires at least one kind=reference_comparison visual evidence row")
  }
  const declared = new Set(design.reference_artifacts.map(normalizeReportPath))
  for (const comparison of comparisons) {
    if (!declared.has(normalizeReportPath(comparison.source_reference_artifact))) {
      throw new Error(
        `reference_parity visual evidence ${comparison.id} must cite a source_reference_artifact declared in reference_artifacts`,
      )
    }
  }
}

async function snapshotFrontendDesignFacts(input: {
  collector: FrontendDesignCollector
  artifactRoot: string
  artifactRootRelative?: string
  workspaceRoot: string
  mode: FrontendDesignMode
  processIdentity: Readonly<{ taskID: string; cwd: string }>
}): Promise<FrontendDesignPayload | undefined> {
  const missing = frontendDraftMissingActions(input.collector)
  if (missing.length > 0) {
    input.collector.semantic_error = `frontend template fragments are incomplete: ${missing.join("; ")}`
    return undefined
  }

  let design: FrontendDesignPayload
  try {
    const parsed = FrontendDesignDraftSchema.parse(normalizeFrontendDesignDraft(input.collector.draft))
    design = normalizeFrontendDesignPayload(
      FrontendDesignPayloadSchema.parse({
        ...parsed,
        fact_check_items: [],
      }),
      input.mode,
    )
  } catch (err) {
    input.collector.semantic_error = err instanceof Error ? err.message : String(err)
    return undefined
  }
  try {
    assertVisualEvidenceAuthority(design, input.mode)
    await inspectFrontendDesignSnapshot(design, {
      artifactRoot: input.artifactRoot,
      artifactRootRelative: input.artifactRootRelative,
      workspaceRoot: input.workspaceRoot,
      mode: input.mode,
      processIdentity: input.processIdentity,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    input.collector.semantic_error = msg
    return design
  }
  if (design.frontend_project.role === "visual_baseline_input") {
    artifactValidatedVisualDesigns.add(design)
  }
  input.collector.semantic_error = undefined
  return design
}

async function inspectFrontendDesignSnapshot(
  design: FrontendDesignPayload,
  options: {
    artifactRoot: string
    artifactRootRelative?: string
    workspaceRoot: string
    mode: FrontendDesignMode
    processIdentity: Readonly<{ taskID: string; cwd: string }>
  },
): Promise<void> {
  const requiredRenderedFields = [
    ["frontend_template", design.frontend_template],
    ["fillable_modules", design.fillable_modules],
    ["quality_project_contract", design.quality_project_contract],
    ["material_inventory", design.material_inventory],
    ["visual_consistency_contract", design.visual_consistency_contract],
    ["ui_data_contract", design.ui_data_contract],
  ] as const
  for (const [key, value] of requiredRenderedFields) {
    if (!value.trim())
      throw new Error(`${key} is required; provide concise markdown or the matching structured *_items field`)
  }
  if (design.design_directions.length > 0 && !design.selected_design_direction_id.trim()) {
    throw new Error(
      "selected_design_direction_id is required when design_directions are recorded; select the direction declared implementation consumers should implement.",
    )
  }
  if (design.selected_design_direction_id.trim()) {
    const ids = new Set(design.design_directions.map((item) => item.id))
    if (!ids.has(design.selected_design_direction_id)) {
      throw new Error(
        `selected_design_direction_id "${design.selected_design_direction_id}" does not match any recorded design_directions id.`,
      )
    }
  }
  if (
    design.final_acceptance_mode === "maintainable_replacement_required" &&
    design.frontend_project.role === "visual_baseline_input"
  ) {
    throw new Error(
      "final_acceptance_mode=maintainable_replacement_required conflicts with frontend_project.role=visual_baseline_input; " +
        "report a real implementation_target scaffold or role=blocked with the missing implementation/screenshot evidence.",
    )
  }
  const normalizedProjectRoot = normalizeProjectRootForReport(design.frontend_project.project_root)
  if (
    design.frontend_project.role === "implementation_target" &&
    referencesVisualHtmlSkeletonRoot(normalizedProjectRoot)
  ) {
    throw new Error(
      "frontend_project.role=implementation_target cannot point at visual-html-skeleton; " +
        "visual-html-skeleton is a static visual baseline/source artifact. Use role=visual_baseline_input for a validated visual-baseline workflow, or report a real maintainable implementation target / role=blocked for production tasks.",
    )
  }
  if (
    design.frontend_project.role === "visual_baseline_input" &&
    !isValidVisualHtmlSkeletonRoot(normalizedProjectRoot, options.artifactRootRelative)
  ) {
    throw new Error(
      "frontend_project.role=visual_baseline_input requires frontend_project.project_root to point at visual-html-skeleton; " +
        "do not record traversed paths, evidence packages, or unrelated source roots as the visual baseline project root.",
    )
  }
  if (design.frontend_project.role === "visual_baseline_input") {
      const quality = await inspectVisualBaselineQualityForSnapshot(design, {
      ...options,
      requireArtifactVerification: true,
    })
    if (quality.status === "evidence_missing") {
      const diagnostic = quality.diagnostic ? ` ${formatVisualEvidenceDiagnostic(quality.diagnostic)}.` : ""
      throw new Error(
        "frontend_project.role=visual_baseline_input requires artifact-backed rendered screenshot review evidence for the visual-html-skeleton output; " +
          (options.mode === "reference_parity"
            ? "record structured reference_comparison evidence whose rendered_entrypoint, screenshot_artifact, source_reference_artifact, optional diff_artifact, viewport, capture_mode, and SHA-256 digests match real files under the task artifact root, or preserve the missing source evidence as a completeness finding."
            : "record structured render_review evidence whose rendered_entrypoint, screenshot_artifact, viewport, capture_mode, and SHA-256 digest match real files under the task artifact root, or preserve the missing rendered evidence as a completeness finding.") +
          diagnostic,
      )
    }
    if (quality.status === "incomplete_visual_fidelity") {
      const diagnostic = quality.diagnostic ? ` ${formatVisualEvidenceDiagnostic(quality.diagnostic)}.` : ""
      throw new Error(
        "frontend_project.role=visual_baseline_input facts contain blocking visual debt; " +
          "repair the visual-html-skeleton or preserve the named unfinished visual debt in the current snapshot." +
          diagnostic,
      )
    }
  }
  if (design.final_acceptance_mode === "maintainable_replacement_required") {
    assertMaintainablePhaseOutcomes(design)
  }
  if (design.frontend_project.role === "implementation_target") {
    const projectRoot = assertImplementationTargetEntrypoints(design, options.workspaceRoot)
    assertConcreteReuseSourceEvidence(design, projectRoot)
  }
}

function assertMaintainablePhaseOutcomes(design: FrontendDesignPayload): void {
  const present = new Set(design.implementation_phase_outcomes.map((item) => item.phase))
  const missing = REQUIRED_IMPLEMENTATION_PHASES.filter((phase) => !present.has(phase))
  if (missing.length > 0) {
    throw new Error(
      "final_acceptance_mode=maintainable_replacement_required requires structured implementation_phase_outcomes covering " +
        `${REQUIRED_IMPLEMENTATION_PHASES.join(", ")}; missing ${missing.join(", ")}. ` +
        "Projected planning consumers must use implementation_phase_outcomes instead of deriving phase goals from component_inventory or component_reuse_plan.",
    )
  }
}

function assertImplementationTargetEntrypoints(design: FrontendDesignPayload, workspaceRoot: string): string {
  const project = design.frontend_project
  if (!project.project_root.trim()) {
    throw new Error("frontend_project.role=implementation_target requires a non-empty project_root.")
  }
  if (project.entrypoints.length === 0) {
    throw new Error(
      "frontend_project.role=implementation_target requires at least one project-root-relative entrypoint.",
    )
  }
  const projectRoot = resolveWorkspaceReportPath(workspaceRoot, project.project_root)
  if (!projectRoot || !isDirectory(projectRoot)) {
    throw new Error(
      `frontend_project.role=implementation_target requires project_root to resolve to an existing directory under the workspace: ${project.project_root}`,
    )
  }
  const missingEntrypoints = project.entrypoints.filter((entrypoint) => {
    const entrypointFile = resolveProjectRootRelativeFile(projectRoot, entrypoint)
    return !entrypointFile || !isReadableFile(entrypointFile)
  })
  if (missingEntrypoints.length > 0) {
    throw new Error(
      "frontend_project.role=implementation_target requires every entrypoint to be a real project-root-relative file; missing or invalid: " +
        missingEntrypoints.join(", "),
    )
  }
  return projectRoot
}

function assertConcreteReuseSourceEvidence(design: FrontendDesignPayload, projectRoot: string): void {
  const packageDeps = readPackageDependencies(projectRoot)
  const invalid: string[] = []
  for (const item of design.component_reuse_plan) {
    if (item.implementation_strategy === "mature_library") {
      if (!reuseSourceNamesInstalledPackageOrExistingPath(item.reuse_source, projectRoot, packageDeps)) {
        invalid.push(`component_reuse_plan.${item.family_id}.reuse_source=${item.reuse_source}`)
      }
    }
    if (item.implementation_strategy === "existing_project_component") {
      if (!reuseSourceNamesInstalledPackageOrExistingPath(item.reuse_source, projectRoot, packageDeps)) {
        invalid.push(`component_reuse_plan.${item.family_id}.reuse_source=${item.reuse_source}`)
      }
    }
  }
  for (const item of design.baseline_replacement_plan) {
    if (item.replacement_strategy === "mature_library" || item.replacement_strategy === "existing_project_component") {
      if (!reuseSourceNamesInstalledPackageOrExistingPath(item.reuse_source, projectRoot, packageDeps)) {
        invalid.push(`baseline_replacement_plan.${item.boundary_id}.reuse_source=${item.reuse_source}`)
      }
    }
  }
  if (invalid.length > 0) {
    throw new Error(
      "maintainable implementation reuse sources must bind to an installed package in project_root/package.json or an existing project source file; invalid: " +
        invalid.join(", "),
    )
  }
}

function resolveWorkspaceReportPath(workspaceRoot: string, reportPath: string): string | undefined {
  const root = path.resolve(workspaceRoot)
  if (reportPath.replaceAll("\\", "/").trim().replace(/\/+$/, "") === ".") return root
  const normalized = normalizeReportPath(reportPath)
  if (!normalized) return undefined
  const absolute = path.isAbsolute(reportPath) ? path.resolve(reportPath) : path.resolve(root, ...normalized.split("/"))
  const relative = path.relative(root, absolute)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined
  return absolute
}

function resolveProjectRootRelativeFile(projectRoot: string, reportPath: string): string | undefined {
  if (path.isAbsolute(reportPath)) return undefined
  const normalized = normalizeReportPath(reportPath)
  if (!normalized || normalized === ".." || normalized.startsWith("../")) return undefined
  const absolute = path.resolve(projectRoot, ...normalized.split("/"))
  const relative = path.relative(projectRoot, absolute)
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return undefined
  return absolute
}

function isDirectory(file: string): boolean {
  try {
    return fs.statSync(file).isDirectory()
  } catch {
    return false
  }
}

function readPackageDependencies(projectRoot: string): Set<string> {
  const packageFile = path.join(projectRoot, "package.json")
  if (!isReadableFile(packageFile)) return new Set()
  try {
    const parsed = JSON.parse(fs.readFileSync(packageFile, "utf8")) as {
      dependencies?: Record<string, unknown>
      devDependencies?: Record<string, unknown>
      peerDependencies?: Record<string, unknown>
      optionalDependencies?: Record<string, unknown>
    }
    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
      ...Object.keys(parsed.peerDependencies ?? {}),
      ...Object.keys(parsed.optionalDependencies ?? {}),
    ])
  } catch {
    return new Set()
  }
}

function reuseSourceNamesInstalledPackageOrExistingPath(
  reuseSource: string,
  projectRoot: string,
  packageDeps: ReadonlySet<string>,
): boolean {
  const projectFile = resolveProjectRootRelativeFile(projectRoot, reuseSource)
  if (projectFile && isReadableFile(projectFile)) return true
  const packageName = packageNameFromReuseSource(reuseSource)
  return packageName ? packageDeps.has(packageName) : false
}

function packageNameFromReuseSource(reuseSource: string): string | undefined {
  const trimmed = reuseSource.trim()
  const scoped = /^(@[a-z0-9._-]+\/[a-z0-9._-]+)/i.exec(trimmed)
  if (scoped) return scoped[1]
  const bare = /^([a-z0-9._-]+)(?:\/[a-z0-9._-]+)?$/i.exec(trimmed)
  return bare ? bare[1] : undefined
}

function visualEvidenceDiagnostic(code: string, message: string): VisualEvidenceValidationDiagnostic {
  return { code, message }
}

function visualEvidenceFailure(code: string, message: string): VisualEvidenceValidationResult {
  return { ok: false, diagnostic: visualEvidenceDiagnostic(code, message) }
}

function formatVisualEvidenceDiagnostic(diagnostic: VisualEvidenceValidationDiagnostic): string {
  return `${diagnostic.code}: ${diagnostic.message}`
}

function visualEvidenceLabel(item: VisualValidationEvidence): string {
  return `visual_validation_evidence[${item.id}]`
}

async function inspectVisualBaselineQualityForSnapshot(
  design: FrontendDesignPayload,
  options: {
    artifactRoot: string
    artifactRootRelative?: string
    requireArtifactVerification: boolean
    processIdentity: Readonly<{ taskID: string; cwd: string }>
  },
): Promise<{
  status: "high_fidelity_evidence_reported" | "incomplete_visual_fidelity" | "evidence_missing"
  hasRemainingDebt: boolean
  diagnostic?: VisualEvidenceValidationDiagnostic
}> {
  const text = collectVisualBaselineText(design)
  const hasRemainingDebt = hasBlockingVisualDebt(text)
  const renderedScreenshotEvidence = await inspectStructuredRenderedScreenshotEvidenceForSnapshot(design, options)
  const hasStructuredDebt = design.visual_validation_evidence.some(
    (item) => item.review_status === "reviewed_with_blocking_debt",
  )

  if (hasRemainingDebt) {
    return {
      status: "incomplete_visual_fidelity",
      hasRemainingDebt: true,
      diagnostic: visualEvidenceDiagnostic(
        "visual_debt_reported",
        "recorded visual baseline text still names blocking, remaining, unresolved, open, or deferred visual debt",
      ),
    }
  }
  if (hasStructuredDebt) {
    const item = design.visual_validation_evidence.find(
      (candidate) => candidate.review_status === "reviewed_with_blocking_debt",
    )
    return {
      status: "incomplete_visual_fidelity",
      hasRemainingDebt: true,
      diagnostic: visualEvidenceDiagnostic(
        "visual_review_blocking_debt",
        `${item ? visualEvidenceLabel(item) : "visual_validation_evidence"} has review_status=reviewed_with_blocking_debt`,
      ),
    }
  }
  if (renderedScreenshotEvidence.ok) return { status: "high_fidelity_evidence_reported", hasRemainingDebt }
  return {
    status: "evidence_missing",
    hasRemainingDebt,
    diagnostic: renderedScreenshotEvidence.diagnostic,
  }
}

function inspectVisualBaselineQuality(
  design: FrontendDesignPayload,
  options: { artifactRoot: string; artifactRootRelative?: string; requireArtifactVerification: boolean },
): {
  status: "high_fidelity_evidence_reported" | "incomplete_visual_fidelity" | "evidence_missing"
  hasRemainingDebt: boolean
  diagnostic?: VisualEvidenceValidationDiagnostic
} {
  const text = collectVisualBaselineText(design)
  const hasRemainingDebt = hasBlockingVisualDebt(text)
  const renderedScreenshotEvidence = inspectStructuredRenderedScreenshotEvidence(design, options)
  const hasStructuredDebt = design.visual_validation_evidence.some(
    (item) => item.review_status === "reviewed_with_blocking_debt",
  )

  if (hasRemainingDebt) {
    return {
      status: "incomplete_visual_fidelity",
      hasRemainingDebt: true,
      diagnostic: visualEvidenceDiagnostic(
        "visual_debt_reported",
        "recorded visual baseline text still names blocking, remaining, unresolved, open, or deferred visual debt",
      ),
    }
  }
  if (hasStructuredDebt) {
    const item = design.visual_validation_evidence.find(
      (candidate) => candidate.review_status === "reviewed_with_blocking_debt",
    )
    return {
      status: "incomplete_visual_fidelity",
      hasRemainingDebt: true,
      diagnostic: visualEvidenceDiagnostic(
        "visual_review_blocking_debt",
        `${item ? visualEvidenceLabel(item) : "visual_validation_evidence"} has review_status=reviewed_with_blocking_debt`,
      ),
    }
  }
  if (renderedScreenshotEvidence.ok) return { status: "high_fidelity_evidence_reported", hasRemainingDebt }
  return { status: "evidence_missing", hasRemainingDebt, diagnostic: renderedScreenshotEvidence.diagnostic }
}

function hasBlockingVisualDebt(text: string): boolean {
  const positiveText = text
    .replace(
      /\b(?:no|none|without|not|zero|0)\s+(?:blocking|remaining|unresolved|open|deferred)\s+(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\b/gi,
      "",
    )
    .replace(
      /\b(?:no|none|without|not|zero|0)\s+(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\s+(?:remain(?:s|ing)?|blocking|unresolved|open|deferred)\b/gi,
      "",
    )
  const labelDebt =
    /\b(?:remaining|blocking|unresolved|open|deferred)\s+(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\s*[:\-]\s*(?!\s*(?:none|no|0|n\/a|\(\s*none\s*\))\b)/i.test(
      positiveText,
    )
  const reversedLabelDebt =
    /\b(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\s+(?:remain(?:s|ing)?|blocking|unresolved|open|deferred)\s*[:\-]\s*(?!\s*(?:none|no|0|n\/a|\(\s*none\s*\))\b)/i.test(
      positiveText,
    )
  const sentenceDebt =
    /\b(?:rendered screenshot|screenshot review|task-scoped preview|preview evidence|visual diff)\b[^\n.]{0,160}\b(?:blocking|remaining|unresolved|open|deferred)\s+(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\b/i.test(
      positiveText,
    )
  const reversedSentenceDebt =
    /\b(?:rendered screenshot|screenshot review|task-scoped preview|preview evidence|visual diff)\b[^\n.]{0,160}\b(?:visual\s+)?(?:debt|mismatch(?:es)?|gap(?:s)?|defect(?:s)?|blocker(?:s)?)\s+(?:remain(?:s|ing)?|blocking|unresolved|open|deferred)\b/i.test(
      positiveText,
    )
  return labelDebt || reversedLabelDebt || sentenceDebt || reversedSentenceDebt
}

function inspectStructuredRenderedScreenshotEvidence(
  design: FrontendDesignPayload,
  options: { artifactRoot: string; artifactRootRelative?: string; requireArtifactVerification: boolean },
): VisualEvidenceValidationResult {
  let firstDiagnostic: VisualEvidenceValidationDiagnostic | undefined
  for (const item of design.visual_validation_evidence) {
    const result = validateRenderedScreenshotEvidenceMetadata(item, options)
    if (result.ok) return result
    firstDiagnostic ??= result.diagnostic
  }
  return firstDiagnostic
    ? { ok: false, diagnostic: firstDiagnostic }
    : visualEvidenceFailure(
        "visual_validation_evidence_empty",
        "no structured rendered screenshot evidence was recorded",
      )
}

async function inspectStructuredRenderedScreenshotEvidenceForSnapshot(
  design: FrontendDesignPayload,
  options: {
    artifactRoot: string
    artifactRootRelative?: string
    requireArtifactVerification: boolean
    processIdentity: Readonly<{ taskID: string; cwd: string }>
  },
): Promise<VisualEvidenceValidationResult> {
  let firstDiagnostic: VisualEvidenceValidationDiagnostic | undefined
  for (const item of design.visual_validation_evidence) {
    const result = await validateRenderedScreenshotEvidenceForSnapshot(item, options)
    if (result.ok) return result
    firstDiagnostic ??= result.diagnostic
  }
  return firstDiagnostic
    ? { ok: false, diagnostic: firstDiagnostic }
    : visualEvidenceFailure(
        "visual_validation_evidence_empty",
        "no structured rendered screenshot evidence was recorded",
      )
}

function validateRenderedScreenshotEvidenceMetadata(
  item: VisualValidationEvidence,
  options: { artifactRoot: string; artifactRootRelative?: string; requireArtifactVerification: boolean },
): VisualEvidenceValidationResult {
  const label = visualEvidenceLabel(item)
  if (item.render_target !== "visual-html-skeleton") {
    return visualEvidenceFailure("render_target_invalid", `${label} render_target must be visual-html-skeleton`)
  }
  if (item.review_status !== "reviewed_no_blocking_debt") {
    return visualEvidenceFailure(
      "review_status_blocking",
      `${label} review_status must be reviewed_no_blocking_debt before claiming a positive visual-baseline judgment`,
    )
  }
  if (
    item.kind === "reference_comparison" &&
    item.screenshot_sha256.toLowerCase() === item.source_reference_sha256.toLowerCase()
  ) {
    return visualEvidenceFailure(
      "screenshot_equals_source_reference",
      `${label} screenshot_sha256 must not equal source_reference_sha256`,
    )
  }

  const entrypoint = resolveEvidenceArtifactPath(options, item.rendered_entrypoint, "visual-html-skeleton")
  const screenshot = resolveEvidenceArtifactPath(options, item.screenshot_artifact, "visual-html-skeleton")
  const sourceReference =
    item.kind === "reference_comparison"
      ? resolveEvidenceArtifactPath(options, item.source_reference_artifact)
      : undefined
  const diff = item.kind === "reference_comparison" && item.diff_artifact
    ? resolveEvidenceArtifactPath(options, item.diff_artifact, "visual-html-skeleton")
    : undefined
  if (!entrypoint) {
    return visualEvidenceFailure(
      "rendered_entrypoint_path_invalid",
      `${label} rendered_entrypoint must resolve under visual-html-skeleton within the task artifact root`,
    )
  }
  if (!screenshot) {
    return visualEvidenceFailure(
      "screenshot_artifact_path_invalid",
      `${label} screenshot_artifact must resolve under visual-html-skeleton within the task artifact root`,
    )
  }
  if (item.kind === "reference_comparison" && !sourceReference) {
    return visualEvidenceFailure(
      "source_reference_artifact_path_invalid",
      `${label} source_reference_artifact must resolve within the task artifact root`,
    )
  }
  if (item.kind === "reference_comparison" && item.diff_artifact && !diff) {
    return visualEvidenceFailure(
      "diff_artifact_path_invalid",
      `${label} diff_artifact must resolve under visual-html-skeleton within the task artifact root`,
    )
  }
  if (!entrypoint.relativePath.endsWith(".html")) {
    return visualEvidenceFailure(
      "rendered_entrypoint_not_html",
      `${label} rendered_entrypoint must name a source-editable HTML file`,
    )
  }
  if (!isRenderedVisualSkeletonArtifactRelativePath(screenshot.relativePath)) {
    return visualEvidenceFailure(
      "screenshot_artifact_not_rendered_preview",
      `${label} screenshot_artifact must be a rendered screenshot/preview artifact, not source/reference evidence`,
    )
  }
  if (diff && !isRenderedVisualSkeletonArtifactRelativePath(diff.relativePath)) {
    return visualEvidenceFailure(
      "diff_artifact_not_rendered_preview",
      `${label} diff_artifact must be a rendered visual diff/comparison artifact`,
    )
  }
  if (options.requireArtifactVerification) {
    return visualEvidenceFailure(
      "artifact_verification_required",
      `${label} metadata is structurally valid, but artifact verification is required before treating the visual baseline as ready`,
    )
  }
  return { ok: true }
}

async function validateRenderedScreenshotEvidenceForSnapshot(
  item: VisualValidationEvidence,
  options: {
    artifactRoot: string
    artifactRootRelative?: string
    requireArtifactVerification: boolean
    processIdentity: Readonly<{ taskID: string; cwd: string }>
  },
): Promise<VisualEvidenceValidationResult> {
  const label = visualEvidenceLabel(item)
  const metadata = validateRenderedScreenshotEvidenceMetadata(item, { ...options, requireArtifactVerification: false })
  if (!metadata.ok) return metadata

  const entrypoint = resolveEvidenceArtifactPath(options, item.rendered_entrypoint, "visual-html-skeleton")
  const screenshot = resolveEvidenceArtifactPath(options, item.screenshot_artifact, "visual-html-skeleton")
  const sourceReference =
    item.kind === "reference_comparison"
      ? resolveEvidenceArtifactPath(options, item.source_reference_artifact)
      : undefined
  const diff = item.kind === "reference_comparison" && item.diff_artifact
    ? resolveEvidenceArtifactPath(options, item.diff_artifact, "visual-html-skeleton")
    : undefined
  if (
    !entrypoint ||
    !screenshot ||
    (item.kind === "reference_comparison" && (!sourceReference || (item.diff_artifact && !diff)))
  ) {
    return visualEvidenceFailure(
      "visual_evidence_path_recheck_failed",
      `${label} failed artifact path recheck during snapshot validation`,
    )
  }
  if (!options.requireArtifactVerification) return { ok: true }

  const verifiedEntrypoint = verifyEvidenceFile(options.artifactRoot, entrypoint, "visual-html-skeleton")
  const verifiedScreenshot = verifyEvidenceFile(options.artifactRoot, screenshot, "visual-html-skeleton")
  const verifiedSourceReference = sourceReference
    ? verifyEvidenceFile(options.artifactRoot, sourceReference)
    : undefined
  if (!verifiedEntrypoint) {
    return visualEvidenceFailure(
      "rendered_entrypoint_file_missing",
      `${label} rendered_entrypoint is not a readable file under the real visual-html-skeleton artifact root`,
    )
  }
  if (!verifiedScreenshot) {
    return visualEvidenceFailure(
      "screenshot_artifact_file_missing",
      `${label} screenshot_artifact is not a readable file under the real visual-html-skeleton artifact root`,
    )
  }
  if (item.kind === "reference_comparison" && !verifiedSourceReference) {
    return visualEvidenceFailure(
      "source_reference_artifact_file_missing",
      `${label} source_reference_artifact is not a readable file under the real task artifact root`,
    )
  }
  if (diff && !verifyEvidenceFile(options.artifactRoot, diff, "visual-html-skeleton")) {
    return visualEvidenceFailure(
      "diff_artifact_file_missing",
      `${label} diff_artifact is not a readable file under the real visual-html-skeleton artifact root`,
    )
  }
  if (!(await isDecodedRasterImageFile(verifiedScreenshot))) {
    return visualEvidenceFailure(
      "screenshot_artifact_not_raster",
      `${label} screenshot_artifact must decode as a PNG, JPEG, or WebP image`,
    )
  }
  if (verifiedSourceReference && !(await isDecodedRasterImageFile(verifiedSourceReference))) {
    return visualEvidenceFailure(
      "source_reference_artifact_not_raster",
      `${label} source_reference_artifact must decode as a PNG, JPEG, or WebP image`,
    )
  }

  const screenshotSha = sha256File(verifiedScreenshot)
  if (screenshotSha !== item.screenshot_sha256.toLowerCase()) {
    return visualEvidenceFailure(
      "screenshot_sha256_mismatch",
      `${label} screenshot_sha256=${item.screenshot_sha256.toLowerCase()} does not match file hash ${screenshotSha}`,
    )
  }
  const sourceReferenceSha = verifiedSourceReference ? sha256File(verifiedSourceReference) : undefined
  if (
    item.kind === "reference_comparison" &&
    sourceReferenceSha !== item.source_reference_sha256.toLowerCase()
  ) {
    return visualEvidenceFailure(
      "source_reference_sha256_mismatch",
      `${label} source_reference_sha256=${item.source_reference_sha256.toLowerCase()} does not match file hash ${sourceReferenceSha}`,
    )
  }
  if (sourceReferenceSha && screenshotSha === sourceReferenceSha) {
    return visualEvidenceFailure(
      "screenshot_equals_source_reference",
      `${label} screenshot_artifact and source_reference_artifact have the same SHA-256 digest`,
    )
  }

  const rendered = await renderedEntrypointScreenshotHash({
    processIdentity: options.processIdentity,
    entrypointFile: verifiedEntrypoint,
    viewportLabel: item.viewport,
    captureMode: item.capture_mode,
    locationHash: item.location_hash,
  })
  if (!rendered.ok) return rendered
  if (rendered.sha256 !== screenshotSha) {
    return visualEvidenceFailure(
      "rendered_entrypoint_hash_mismatch",
      `${label} screenshot_artifact hash ${screenshotSha} does not match fresh ${item.capture_mode} render hash ${rendered.sha256} from ${item.rendered_entrypoint}${item.location_hash} at ${rendered.viewport.width}x${rendered.viewport.height}`,
    )
  }
  return { ok: true }
}

function isRenderedVisualSkeletonArtifactRelativePath(relativePath: string): boolean {
  const normalizedPath = normalizeReportPath(relativePath).toLowerCase()
  const basename = normalizedPath.split("/").pop() ?? normalizedPath
  if (/(?:^|[-_.])(reference|source|original)(?:[-_.]|$)/i.test(basename)) return false
  return (
    /(?:^|\/)(?:screenshots?|previews?|renders?|visual-diffs?|diffs?)(?:\/|$)/i.test(normalizedPath) ||
    /(?:screenshot|preview|render|visual-diff|diff)/i.test(basename)
  )
}

function resolveEvidenceArtifactPath(
  options: { artifactRoot: string; artifactRootRelative?: string },
  artifactPath: string,
  expectedRoot?: "visual-html-skeleton",
): { absolutePath: string; relativePath: string } | undefined {
  const root = path.resolve(options.artifactRoot)
  const normalizedArtifactPath = normalizeReportPath(artifactPath)
  const normalizedArtifactRootRelative = options.artifactRootRelative
    ? normalizeReportPath(options.artifactRootRelative)
    : ""
  const rootRelativePath =
    normalizedArtifactRootRelative &&
    (normalizedArtifactPath === normalizedArtifactRootRelative ||
      normalizedArtifactPath.startsWith(`${normalizedArtifactRootRelative}/`))
      ? normalizeReportPath(normalizedArtifactPath.slice(normalizedArtifactRootRelative.length).replace(/^\/+/, ""))
      : normalizedArtifactPath
  const file = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(root, ...rootRelativePath.split("/"))
  const relative = path.relative(root, file)
  if (relative === "") return undefined
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined
  const relativePath = normalizeReportPath(relative)
  if (expectedRoot && !isPathInsideExpectedEvidenceRoot(relativePath, expectedRoot)) return undefined
  return { absolutePath: file, relativePath }
}

function isPathInsideExpectedEvidenceRoot(relativePath: string, expectedRoot: string): boolean {
  const normalized = normalizeReportPath(relativePath)
  return normalized === expectedRoot || normalized.startsWith(`${expectedRoot}/`)
}

function verifyEvidenceFile(
  artifactRoot: string,
  resolved: { absolutePath: string; relativePath: string },
  expectedRoot?: "visual-html-skeleton",
): string | undefined {
  if (!isReadableFile(resolved.absolutePath)) return undefined
  let rootReal: string
  let fileReal: string
  try {
    rootReal = fs.realpathSync(artifactRoot)
    fileReal = fs.realpathSync(resolved.absolutePath)
  } catch {
    return undefined
  }
  const realRelativePath = normalizeReportPath(path.relative(rootReal, fileReal))
  if (!realRelativePath || realRelativePath.startsWith("..") || path.isAbsolute(realRelativePath)) return undefined
  if (expectedRoot && !isPathInsideExpectedEvidenceRoot(realRelativePath, expectedRoot)) return undefined
  return fileReal
}

function isReadableFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function sha256File(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function resolveProjectRootFile(projectRoot: string, artifactPath: string, label: string): string {
  const root = path.resolve(projectRoot)
  const resolved = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(root, ...normalizeReportPath(artifactPath).split("/"))
  const relative = path.relative(root, resolved)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the task project root: ${artifactPath}`)
  }
  if (!isReadableFile(resolved)) throw new Error(`${label} is not a readable file: ${artifactPath}`)
  return resolved
}

function readVisualRegionBindingManifest(projectRoot: string, manifestPath: string): VisualRegionBindingManifest {
  const manifestFile = resolveProjectRootFile(projectRoot, manifestPath, "visual_region_binding manifest_path")
  const parsed = VisualRegionBindingManifestSchema.parse(JSON.parse(fs.readFileSync(manifestFile, "utf8")))
  if (normalizeReportPath(parsed.manifest_path) !== normalizeReportPath(manifestPath)) {
    throw new Error(
      `visual_region_binding manifest_path mismatch: expected ${manifestPath}, got ${parsed.manifest_path}`,
    )
  }
  resolveProjectRootFile(projectRoot, parsed.source_image, "visual_region_binding source_image")
  resolveProjectRootFile(projectRoot, parsed.bbox_overlay_artifact, "visual_region_binding bbox_overlay_artifact")
  resolveProjectRootFile(projectRoot, parsed.contact_sheet_artifact, "visual_region_binding contact_sheet_artifact")
  for (const region of parsed.regions) {
    resolveProjectRootFile(
      projectRoot,
      region.source_reference_artifact,
      `visual_region_binding ${region.reference_region_key} source_reference_artifact`,
    )
  }
  return parsed
}

async function isDecodedRasterImageFile(file: string): Promise<boolean> {
  try {
    const metadata = await sharp(file).metadata()
    return (
      (metadata.format === "png" || metadata.format === "jpeg" || metadata.format === "webp") &&
      typeof metadata.width === "number" &&
      metadata.width > 0 &&
      typeof metadata.height === "number" &&
      metadata.height > 0
    )
  } catch {
    return false
  }
}

type RenderedEntrypointScreenshotHashResult =
  | {
      ok: true
      sha256: string
      viewport: { width: number; height: number }
      captureMode: VisualEvidenceCaptureMode
    }
  | {
      ok: false
      diagnostic: VisualEvidenceValidationDiagnostic
    }

async function renderedEntrypointScreenshotHash(input: {
  processIdentity: Readonly<{ taskID: string; cwd: string }>
  entrypointFile: string
  viewportLabel: string
  captureMode: VisualEvidenceCaptureMode
  locationHash: string
}): Promise<RenderedEntrypointScreenshotHashResult> {
  try {
    const viewport = viewportDimensionsFromLabel(input.viewportLabel)
    if (!viewport) {
      return {
        ok: false,
        diagnostic: visualEvidenceDiagnostic(
          "viewport_dimensions_missing",
          `visual_validation_evidence viewport "${input.viewportLabel}" must include explicit WIDTHxHEIGHT dimensions for ${input.captureMode} re-rendering`,
        ),
      }
    }
    const rendered = await renderVisualHtmlSkeletonScreenshotForValidation({
      processIdentity: input.processIdentity,
      entrypointFile: input.entrypointFile,
      viewport,
      captureMode: input.captureMode,
      locationHash: input.locationHash,
    })
    return {
      ok: true,
      sha256: createHash("sha256").update(rendered).digest("hex"),
      viewport,
      captureMode: input.captureMode,
    }
  } catch (err) {
    return {
      ok: false,
      diagnostic: visualEvidenceDiagnostic(
        "rendered_entrypoint_render_failed",
        `fresh ${input.captureMode} render failed for ${input.entrypointFile}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    }
  }
}

function viewportDimensionsFromLabel(label: string): { width: number; height: number } | undefined {
  const match = /(?:^|[^0-9])([1-9][0-9]{1,4})\s*x\s*([1-9][0-9]{1,4})(?:[^0-9]|$)/i.exec(label)
  if (!match) return undefined
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return undefined
  return { width, height }
}

export async function renderVisualHtmlSkeletonScreenshotForValidation(input: {
  processIdentity: Readonly<{ taskID: string; cwd: string }>
  entrypointFile: string
  viewport: { width: number; height: number }
  captureMode: VisualEvidenceCaptureMode
  locationHash?: string
  timeoutMs?: number
}): Promise<Buffer> {
  const timeoutMs = input.timeoutMs ?? 60_000
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const url = pathToFileURL(input.entrypointFile)
  url.hash = input.locationHash ?? ""
  const sidecar = await runTaskBrowserNodeSidecar<
    { ok: true; screenshotBase64: string } | { ok: false; kind: "toolchain" | "page_validation"; error: string }
  >(input.processIdentity, {
    script: StaticHtmlScreenshotScript,
    payload: {
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      timeoutMs,
      url: url.href,
      viewport: input.viewport,
      captureMode: input.captureMode,
    },
    inactivityTimeoutMs: timeoutMs + 10_000,
    label: "frontend visual baseline static render",
  })
  if (!sidecar.result.ok) {
    if (sidecar.result.kind === "page_validation") {
      throw new FrontendVisualEvidencePageValidationError(sidecar.result.error)
    }
    throw new Error(`frontend visual baseline static render failed: ${sidecar.result.error}`)
  }
  return Buffer.from(sidecar.result.screenshotBase64, "base64")
}

export class FrontendVisualEvidencePageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FrontendVisualEvidencePageValidationError"
  }
}

export function frontendVisualEvidencePageValidationFailureResult(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return JSON.stringify({
    ok: false,
    error: {
      code: "frontend_visual_evidence_page_validation_failed",
      message,
      retry: "correct_page_then_retry",
      next:
        "Correct the reported page, request, or runtime defect, then retry capture. This is page validation evidence, not a renderer-toolchain outage.",
    },
  })
}

export function frontendVisualEvidenceToolchainFailureResult(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error"
  const message = error instanceof Error ? error.message : String(error)
  const signature = createHash("sha256").update(`${name}\0${message}`, "utf8").digest("hex").slice(0, 16)
  return JSON.stringify({
    ok: false,
    error: {
      code: "frontend_visual_evidence_toolchain_unavailable",
      signature,
      message,
      retry: "retry_once_after_concrete_correction",
      next:
        "Retry only after one concrete input or toolchain correction. If the same signature returns again, preserve the current design facts, record the blocker, and finish the Turn so partial/domain-incomplete settlement can proceed. Do not install renderer dependencies into the user project or inspect private Host binaries.",
    },
  })
}

function collectVisualBaselineText(design: FrontendDesignPayload): string {
  return [
    design.frontend_template,
    design.fillable_modules,
    design.component_inventory,
    design.quality_project_contract,
    design.material_inventory,
    design.visual_consistency_contract,
    design.ui_data_contract,
    design.completeness_review,
    ...design.design_directions.map(
      (item) =>
        `${item.id}: ${item.name}\n${item.concept}\n${item.tradeoffs}\n${item.implementation_notes}\n${item.evidence_refs.join("\n")}`,
    ),
    design.selected_design_direction_id,
    ...design.anti_slop_review.map((item) => `${item.id}: ${item.rejected_trait}\n${item.evidence}\n${item.correction}`),
    ...design.competitor_reference_evidence.map(
      (item) =>
        `${item.id}: ${item.competitor_url}\n${item.screenshot_artifact}\n${item.influence_on_selected_direction}\n${item.source_refs.join("\n")}`,
    ),
    ...design.frontend_project.entrypoints,
    ...design.frontend_project.notes,
    ...design.visual_validation_evidence.map((item) => `${item.review_status}: ${item.review_summary}`),
    ...design.visual_region_bindings.map(
      (item) =>
        `${item.manifest_path}\n${item.bbox_overlay_artifact}\n${item.contact_sheet_artifact}\n${item.regions.map((region) => region.reference_region_key).join("\n")}`,
    ),
    ...design.template_iteration_notes,
    ...design.reference_artifacts,
    ...design.open_questions,
  ].join("\n")
}

// Row builders — each flattens its category-specific schema into a VisualSpec
// ---------------------------------------------------------------------------

function buildRequirement(category: VisualSpecCategory, input: Record<string, unknown>): string {
  switch (category) {
    case "color":
      return `${input.role} = ${input.hex}`
    case "typography": {
      const lh = input.line_height_px ? `/${input.line_height_px}px` : ""
      const ls = input.letter_spacing ? ` ${input.letter_spacing}` : ""
      return `${input.font_family} ${input.font_weight} ${input.font_size_px}px${lh}${ls}`
    }
    case "spacing":
      return `${input.property}-${input.side} = ${input.value_px}px`
    case "layout": {
      const parent = input.parent_id ? ` inside ${input.parent_id}` : ""
      return `${input.section_role} [${input.layout_method}] @ ${input.position}, ${input.dimensions}${parent} · geometry=${input.coordinate_space}/${input.implementation_use}`
    }
    case "component": {
      const refs =
        Array.isArray(input.visual_refs) && input.visual_refs.length > 0
          ? ` · refs=[${(input.visual_refs as string[]).join(", ")}]`
          : ""
      const layout = input.within_layout_id ? ` · in=${input.within_layout_id}` : ""
      return `${input.component_type}/${input.variant} — ${input.props}${layout}${refs}`
    }
    case "interaction":
      return `${input.trigger} → ${input.effect} on [${(input.target_component_ids as string[]).join(", ")}]`
    case "responsive":
      return `${input.breakpoint}: ${input.change} (layouts=[${(input.affected_layout_ids as string[]).join(", ")}])`
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

const FrontendCaptureMaterializerInput = z
  .object({
    mode: FrontendDesignModeSchema,
    artifactRoot: z.string().min(1),
    artifactRootRelative: z.string().min(1).optional(),
    workspaceRoot: z.string().min(1),
    taskID: z.string().min(1),
  })
  .strict()

export function materializeFrontendCaptureVisualEvidenceTool(
  raw: Record<string, unknown>,
  onEvidence?: (evidence: VisualValidationEvidence) => "registered" | "overwritten",
  dependencies: {
    renderScreenshot?: typeof renderVisualHtmlSkeletonScreenshotForValidation
  } = {},
) {
  const context = FrontendCaptureMaterializerInput.parse(raw)
  const mode = context.mode
  const artifactRoot = path.resolve(context.artifactRoot)
  const workspaceRoot = path.resolve(context.workspaceRoot)
  const processIdentity = Object.freeze({ taskID: context.taskID, cwd: workspaceRoot })
  const execute = async (input: z.infer<typeof FrontendVisualEvidenceCaptureToolInputSchema>): Promise<string> => {
    if (mode === "greenfield_original" && input.kind !== "render_review") {
      return "Error: greenfield_original canonical capture accepts only kind=render_review and does not require external visual authority."
    }
    if (mode === "reference_parity" && input.kind !== "reference_comparison") {
      return "Error: reference_parity canonical capture requires kind=reference_comparison with declared source-reference evidence."
    }
    const rootInput = { artifactRoot, artifactRootRelative: context.artifactRootRelative }
    const entrypoint = resolveEvidenceArtifactPath(rootInput, input.rendered_entrypoint, "visual-html-skeleton")
    const screenshot = resolveEvidenceArtifactPath(rootInput, input.screenshot_artifact, "visual-html-skeleton")
    if (!entrypoint || !entrypoint.relativePath.endsWith(".html")) {
      return "Error: rendered_entrypoint must resolve to an HTML file under the task visual-html-skeleton artifact root."
    }
    if (!screenshot || !isRenderedVisualSkeletonArtifactRelativePath(screenshot.relativePath)) {
      return "Error: screenshot_artifact must resolve to a rendered screenshot path under the task visual-html-skeleton artifact root."
    }
    const verifiedEntrypoint = verifyEvidenceFile(artifactRoot, entrypoint, "visual-html-skeleton")
    if (!verifiedEntrypoint) {
      return "Error: rendered_entrypoint is not a readable file under the real visual-html-skeleton artifact root."
    }
    let verifiedSourceReference: string | undefined
    if (input.kind === "reference_comparison") {
      const sourceReference = resolveEvidenceArtifactPath(rootInput, input.source_reference_artifact)
      verifiedSourceReference = sourceReference ? verifyEvidenceFile(artifactRoot, sourceReference) : undefined
      if (!verifiedSourceReference || !(await isDecodedRasterImageFile(verifiedSourceReference))) {
        return "Error: source_reference_artifact must resolve to a readable raster image under the real task artifact root."
      }
    }
    let rendered: Buffer
    try {
      rendered = await (dependencies.renderScreenshot ?? renderVisualHtmlSkeletonScreenshotForValidation)({
        processIdentity,
        entrypointFile: verifiedEntrypoint,
        viewport: { width: input.viewport.width, height: input.viewport.height },
        captureMode: input.capture_mode,
        locationHash: input.location_hash,
      })
    } catch (error) {
      if (error instanceof FrontendVisualEvidencePageValidationError) {
        return frontendVisualEvidencePageValidationFailureResult(error)
      }
      return frontendVisualEvidenceToolchainFailureResult(error)
    }
    await Filesystem.writeAtomic(screenshot.absolutePath, rendered)
    const screenshotSha256 = createHash("sha256").update(rendered).digest("hex")
    const base = {
      id: input.id,
      render_target: "visual-html-skeleton" as const,
      rendered_entrypoint: input.rendered_entrypoint,
      screenshot_artifact: input.screenshot_artifact,
      renderer: "node_playwright_static_file" as const,
      viewport: `${input.viewport.width}x${input.viewport.height} ${input.viewport.label}`,
      location_hash: input.location_hash,
      capture_mode: input.capture_mode,
      screenshot_sha256: screenshotSha256,
      review_status: input.review_status,
      review_summary: input.review_summary,
    }
    const evidence: VisualValidationEvidence = input.kind === "render_review"
      ? ToolVisualValidationEvidenceSchema.parse({ ...base, kind: input.kind })
      : ToolVisualValidationEvidenceSchema.parse({
          ...base,
          kind: input.kind,
          source_reference_artifact: input.source_reference_artifact,
          source_reference_sha256: sha256File(verifiedSourceReference!),
          diff_artifact: input.diff_artifact,
        })
    const updateMode = onEvidence?.(evidence) ?? "registered"
    return `OK: canonical visual evidence "${input.id}" ${updateMode}; screenshot_artifact=${input.screenshot_artifact}; screenshot_sha256=${screenshotSha256}`
  }
  const runtimeTool = mode === "greenfield_original"
    ? tool({
        description: "Render a visual-html-skeleton entrypoint with the canonical task-scoped Node/Playwright browser, atomically write the screenshot artifact, derive its SHA-256 digest, and register a greenfield render_review row.",
        inputSchema: FrontendRenderReviewCaptureToolInputSchema,
        execute: async (value) => execute(FrontendRenderReviewCaptureToolInputSchema.parse(value)),
      })
    : tool({
        description: "Render a visual-html-skeleton entrypoint with the canonical task-scoped Node/Playwright browser, atomically write the screenshot artifact, derive its SHA-256 digest, and register a reference_comparison row against declared source evidence.",
        inputSchema: FrontendReferenceComparisonCaptureToolInputSchema,
        execute: async (value) => execute(FrontendReferenceComparisonCaptureToolInputSchema.parse(value)),
      })
  return bindStageToolMaterializer(runtimeTool, { id: "frontend-design.capture-visual-evidence", input: context })
}

export function createFrontendDesignOutputTools(
  options: {
    mode: FrontendDesignMode
    artifactRoot?: string
    artifactRootRelative?: string
    workspaceRoot?: string
    taskID: string
  },
) {
  const mode = FrontendDesignModeSchema.parse(options.mode)
  const artifactRoot = path.resolve(options.artifactRoot ?? process.cwd())
  const artifactRootRelative = options.artifactRootRelative
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const processIdentity = Object.freeze({ taskID: options.taskID, cwd: workspaceRoot })
  let collector = emptyCollector(mode)

  function assertIdFree(id: string): string | null {
    if (collector.specs.some((s) => s.id === id)) return `Error: spec id "${id}" already registered`
    return null
  }

  function assertIdsExist(ids: readonly string[], label: string): string | null {
    const missing = ids.filter((id) => !collector.specs.some((s) => s.id === id))
    if (missing.length === 0) return null
    return `Error: ${label} not registered: [${missing.join(", ")}] — register them first`
  }

  function push(category: VisualSpecCategory, input: any): string {
    if (collector.specs.length >= VISUAL_ANCHOR_BUDGET) {
      return (
        `VISUAL_ANCHOR_BUDGET_REACHED: ${VISUAL_ANCHOR_BUDGET} visual anchors are already registered. ` +
        "Stop registering per-item visual rows; consolidate remaining detail in frontend_template/fillable_modules/completeness_review/material_inventory/visual_consistency_contract/ui_data_contract, " +
        "record the frontend template review findings, then finish the visible Turn."
      )
    }
    const spec: VisualSpec = {
      id: input.id,
      category,
      title: input.title,
      requirement: buildRequirement(category, input),
      applies_to: input.applies_to,
      severity: input.severity,
      rationale: input.rationale,
    }
    collector.specs.push(spec)
    return `OK: ${category} spec "${input.id}" registered (${collector.specs.length} total)`
  }

  const captureFrontendVisualEvidenceTool = materializeFrontendCaptureVisualEvidenceTool(
    { mode, artifactRoot, artifactRootRelative, workspaceRoot, taskID: options.taskID },
    (evidence) => {
      const items = arrayField<VisualValidationEvidence>(collector.draft, "visual_validation_evidence")
      const updateMode = upsertByStringKey(items, evidence, "id")
      collector.semantic_error = undefined
      return updateMode
    },
  )

  const tools = {
    register_color_spec: tool({
      description:
        "Register an exact reusable color constraint from the visual input. Use exact hex values and consolidate repeated rows/items under one role spec instead of per-item specs.",
      inputSchema: ColorSchema,
      execute: async (input) => assertIdFree(input.id) ?? push("color", input),
    }),

    register_typography_spec: tool({
      description:
        "Register an exact reusable typography constraint (font family + size + weight, plus line-height and letter-spacing when discernible). Register roles, not every repeated text instance.",
      inputSchema: TypographySchema,
      execute: async (input) => assertIdFree(input.id) ?? push("typography", input),
    }),

    register_spacing_spec: tool({
      description:
        "Register an exact reusable spacing constraint (margin / padding / gap / inset). Use declared evidence when applicable and consolidate repeated surfaces under one spacing role.",
      inputSchema: SpacingSchema,
      execute: async (input) => assertIdFree(input.id) ?? push("spacing", input),
    }),

    register_layout_spec: tool({
      description:
        "Register a reusable layout section with position, dimensions, and layout method. Register parents before children and avoid one spec per repeated item.",
      inputSchema: LayoutSchema,
      execute: async (input) => {
        const existErr = assertIdFree(input.id)
        if (existErr) return existErr
        if (input.coordinate_space === "source_capture_viewport_px") {
          return (
            "Error: source_capture_viewport_px geometry is source evidence, not an implementable layout spec. " +
            "Keep source-capture x/y/width/height in reference evidence or visual consistency notes; register_layout_spec only accepts implementation_layout visible layout constraints."
          )
        }
        if (
          input.coordinate_space === "implementation_layout" &&
          input.implementation_use !== "visible_layout_constraint"
        ) {
          return "Error: implementation_layout geometry must be registered as visible_layout_constraint."
        }
        if (input.parent_id) {
          const parentErr = assertIdsExist([input.parent_id], "parent layout")
          if (parentErr) return parentErr
          const parent = collector.specs.find((s) => s.id === input.parent_id)
          if (parent && parent.category !== "layout") {
            return `Error: parent_id "${input.parent_id}" is category "${parent.category}" — must be a layout spec`
          }
        }
        return push("layout", input)
      },
    }),

    register_component_spec: tool({
      description:
        "Register a reusable user-interface component. Reference the layout it lives in and avoid one spec per repeated data item.",
      inputSchema: ComponentSchema,
      execute: async (input) => {
        const existErr = assertIdFree(input.id)
        if (existErr) return existErr
        if (input.within_layout_id) {
          const layoutErr = assertIdsExist([input.within_layout_id], "within_layout_id")
          if (layoutErr) return layoutErr
          const layout = collector.specs.find((s) => s.id === input.within_layout_id)
          if (layout && layout.category !== "layout") {
            return `Error: within_layout_id "${input.within_layout_id}" is category "${layout.category}" — must be a layout spec`
          }
        }
        if (input.visual_refs.length > 0) {
          const refErr = assertIdsExist(input.visual_refs, "visual_refs")
          if (refErr) return refErr
        }
        return push("component", input)
      },
    }),

    register_interaction_spec: tool({
      description:
        "Register an interaction pattern (hover / click / focus / scroll effect). target_component_ids must all reference registered component specs.",
      inputSchema: InteractionSchema,
      execute: async (input) => {
        const existErr = assertIdFree(input.id)
        if (existErr) return existErr
        const refErr = assertIdsExist(input.target_component_ids, "target_component_ids")
        if (refErr) return refErr
        for (const cid of input.target_component_ids) {
          const comp = collector.specs.find((s) => s.id === cid)
          if (comp && comp.category !== "component") {
            return `Error: target_component_id "${cid}" is category "${comp.category}" — must be a component spec`
          }
        }
        return push("interaction", input)
      },
    }),

    register_responsive_spec: tool({
      description:
        "Register an explicitly authorized non-desktop or breakpoint rule. Use only when the current operator asked for tablet/mobile/responsive/multi-end migration as a separate task scope; affected_layout_ids must reference registered layout specs.",
      inputSchema: ResponsiveSchema,
      execute: async (input) => {
        const existErr = assertIdFree(input.id)
        if (existErr) return existErr
        const refErr = assertIdsExist(input.affected_layout_ids, "affected_layout_ids")
        if (refErr) return refErr
        for (const lid of input.affected_layout_ids) {
          const layout = collector.specs.find((s) => s.id === lid)
          if (layout && layout.category !== "layout") {
            return `Error: affected_layout_id "${lid}" is category "${layout.category}" — must be a layout spec`
          }
        }
        return push("responsive", input)
      },
    }),

    update_frontend_basics: tool({
      description:
        "Update the required top-level frontend result basics: design system, implementation stack hints, and acceptance mode.",
      inputSchema: FrontendDesignBasicsToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendDesignBasicsToolInputSchema.parse(rawInput)
        collector.draft.design_system = input.design_system
        collector.draft.tech_stack = input.tech_stack
        collector.draft.final_acceptance_mode = input.final_acceptance_mode
        collector.semantic_error = undefined
        return "OK: frontend basics updated"
      },
    }),

    update_frontend_text: tool({
      description:
        "Update one markdown/text section of the frontend result. Use compact, evidence-grounded prose; use update_frontend_item for repeatable rows.",
      inputSchema: FrontendDesignMarkdownSectionToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendDesignMarkdownSectionToolInputSchema.parse(rawInput)
        collector.draft[input.section] = input.content
        collector.semantic_error = undefined
        return `OK: frontend text section "${input.section}" updated`
      },
    }),

    update_frontend_item: tool({
      description:
        "Update one compact frontend result item for template sections, fillable modules, quality project requirements, visual consistency, or UI data. Items are keyed by title.",
      inputSchema: FrontendDesignCompactItemToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendDesignCompactItemToolInputSchema.parse(rawInput)
        const items = arrayField<typeof input.item>(collector.draft, input.target)
        const mode = upsertByStringKey(items, input.item, "title")
        collector.semantic_error = undefined
        return `OK: frontend item "${input.item.title}" ${mode} in ${input.target} (${items.length} total)`
      },
    }),

    update_frontend_design_direction: tool({
      description:
        "Update one evidence-backed product design direction considered before handoff when the declared task calls for alternatives.",
      inputSchema: DesignDirectionSchema,
      execute: async (rawInput) => {
        const input = DesignDirectionSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "design_directions")
        const mode = upsertByStringKey(items, input, "id")
        collector.semantic_error = undefined
        return `OK: frontend design direction "${input.id}" ${mode} (${items.length} total)`
      },
    }),

    select_frontend_design_direction: tool({
      description:
        "Select the registered design direction declared implementation consumers should implement. The id must match a direction registered with update_frontend_design_direction.",
      inputSchema: ToolDesignDirectionSelectionSchema,
      execute: async (rawInput) => {
        const input = ToolDesignDirectionSelectionSchema.parse(rawInput)
        const directions = arrayField<z.infer<typeof DesignDirectionSchema>>(collector.draft, "design_directions")
        if (!directions.some((item) => item.id === input.id)) {
          return `Error: selected design direction "${input.id}" is not registered. Call update_frontend_design_direction first.`
        }
        collector.draft.selected_design_direction_id = input.id
        collector.semantic_error = undefined
        return `OK: frontend design direction selected (${input.id})`
      },
    }),

    update_frontend_anti_slop_review: tool({
      description:
        "Update one rejected-traits review row naming a shallow/generic design trait rejected from the selected direction and the resource-backed correction.",
      inputSchema: AntiSlopReviewItemSchema,
      execute: async (rawInput) => {
        const input = AntiSlopReviewItemSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "anti_slop_review")
        const mode = upsertByStringKey(items, input, "id")
        collector.semantic_error = undefined
        return `OK: rejected-traits review "${input.id}" ${mode} (${items.length} total)`
      },
    }),

    update_frontend_competitor_reference: tool({
      description:
        "Update one evidence-backed competitor or design-reference row declared by the task. The URL must come from user input, frontend_research, deep_research, or task material evidence; never invent URLs.",
      inputSchema: CompetitorReferenceEvidenceSchema,
      execute: async (rawInput) => {
        const input = CompetitorReferenceEvidenceSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "competitor_reference_evidence")
        const mode = upsertByStringKey(items, input, "id")
        collector.semantic_error = undefined
        return `OK: competitor reference evidence "${input.id}" ${mode} (${items.length} total)`
      },
    }),

    update_frontend_material: tool({
      description:
        "Update one material/asset inventory item. Include CSS/tokens, assets, data fixtures, text samples, icons, fonts, or dense resources needed for reproduction.",
      inputSchema: ToolMaterialInventoryItemSchema,
      execute: async (rawInput) => {
        const input = ToolMaterialInventoryItemSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "material_inventory_items")
        const mode = upsertByStringKey(items, input, "title")
        collector.semantic_error = undefined
        return `OK: frontend material "${input.title}" ${mode} (${items.length} total)`
      },
    }),

    update_frontend_project: tool({
      description:
        "Update the concrete frontend project/skeleton output metadata, including role, root, source package, entrypoints, generation tool, and notes.",
      inputSchema: FrontendProjectToolInputSchema,
      execute: async (rawInput) => {
        collector.draft.frontend_project = FrontendProjectToolInputSchema.parse(rawInput)
        collector.semantic_error = undefined
        return `OK: frontend project updated (${collector.draft.frontend_project.role})`
      },
    }),

    update_frontend_component_reuse: tool({
      description: "Update one structured component-family reuse plan item. Items are keyed by family_id.",
      inputSchema: ToolComponentReusePlanItemSchema,
      execute: async (rawInput) => {
        const input = ToolComponentReusePlanItemSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "component_reuse_plan")
        const mode = upsertByStringKey(items, input, "family_id")
        collector.semantic_error = undefined
        return `OK: component reuse "${input.family_id}" ${mode} (${items.length} total)`
      },
    }),

    update_frontend_baseline: tool({
      description: "Update one source-region baseline replacement/evolution plan item. Items are keyed by boundary_id.",
      inputSchema: ToolBaselineReplacementPlanItemSchema,
      execute: async (rawInput) => {
        const input = ToolBaselineReplacementPlanItemSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "baseline_replacement_plan")
        const mode = upsertByStringKey(items, input, "boundary_id")
        collector.semantic_error = undefined
        return `OK: baseline replacement "${input.boundary_id}" ${mode} (${items.length} total)`
      },
    }),

    update_frontend_phase: tool({
      description:
        "Update one maintainable-replacement implementation phase outcome. Required phases are keyed by phase.",
      inputSchema: ToolImplementationPhaseOutcomeSchema,
      execute: async (rawInput) => {
        const input = ToolImplementationPhaseOutcomeSchema.parse(rawInput)
        const items = arrayField<typeof input>(collector.draft, "implementation_phase_outcomes")
        const mode = upsertByStringKey(items, input, "phase")
        collector.semantic_error = undefined
        return `OK: implementation phase "${input.phase}" ${mode} (${items.length} total)`
      },
    }),

    capture_frontend_visual_evidence: captureFrontendVisualEvidenceTool,

    update_frontend_visual_evidence: tool({
      description:
        "Update one structured rendered screenshot validation evidence row for a visual HTML skeleton. Include capture_mode=viewport for viewport crops or capture_mode=full_page for complete document screenshots. Items are keyed by id.",
      inputSchema: ToolVisualValidationEvidenceSchema,
      execute: async (rawInput) => {
        const input = ToolVisualValidationEvidenceSchema.parse(rawInput)
        if (mode === "greenfield_original" && input.kind !== "render_review") {
          return "Error: greenfield_original accepts only kind=render_review visual evidence."
        }
        if (mode === "reference_parity" && input.kind !== "reference_comparison") {
          return "Error: reference_parity accepts only kind=reference_comparison visual evidence."
        }
        const items = arrayField<typeof input>(collector.draft, "visual_validation_evidence")
        const updateMode = upsertByStringKey(items, input, "id")
        collector.semantic_error = undefined
        return `OK: visual validation evidence "${input.id}" ${updateMode} (${items.length} total)`
      },
    }),

    update_frontend_iteration_note: tool({
      description: "Update frontend review-pass notes. Repeated identical notes are ignored.",
      inputSchema: FrontendDesignStringItemToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendDesignStringItemToolInputSchema.parse(rawInput)
        const items = arrayField<string>(collector.draft, "template_iteration_notes")
        const mode = appendUniqueString(items, input.value)
        collector.semantic_error = undefined
        return `OK: frontend iteration note ${mode} (${items.length} total)`
      },
    }),

    update_frontend_reference: tool({
      description:
        "Update one canonical source/reference artifact path or id used as evidence. Repeated identical references are ignored. Rendered skeleton screenshots/previews must first be materialized under visual-html-skeleton/... and then registered only through update_frontend_visual_evidence.screenshot_artifact.",
      inputSchema: FrontendReferenceArtifactToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendReferenceArtifactToolInputSchema.parse(rawInput)
        const items = arrayField<string>(collector.draft, "reference_artifacts")
        const mode = appendUniqueString(items, input.value)
        collector.semantic_error = undefined
        return `OK: frontend reference ${mode} (${items.length} total)`
      },
    }),

    update_frontend_visual_region_binding: tool({
      description:
        "Register one structured VisualRegionBinding manifest produced by create_visual_region_binding_package. Use the manifestPath returned by that tool; this reads the JSON manifest and stores verified crop rows for projected planning consumers that bind reference_coverage.",
      inputSchema: FrontendVisualRegionBindingManifestToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendVisualRegionBindingManifestToolInputSchema.parse(rawInput)
        const manifest = readVisualRegionBindingManifest(workspaceRoot, input.manifest_path)
        const items = arrayField<VisualRegionBindingManifest>(collector.draft, "visual_region_bindings")
        const mode = upsertByStringKey(items, manifest, "manifest_path")
        collector.semantic_error = undefined
        return `OK: frontend visual region binding ${mode} (${manifest.regions.length} regions from ${manifest.manifest_path})`
      },
    }),

    update_frontend_question: tool({
      description: "Update one truly unobservable open question. Repeated identical questions are ignored.",
      inputSchema: FrontendDesignStringItemToolInputSchema,
      execute: async (rawInput) => {
        const input = FrontendDesignStringItemToolInputSchema.parse(rawInput)
        const items = arrayField<string>(collector.draft, "open_questions")
        const mode = appendUniqueString(items, input.value)
        collector.semantic_error = undefined
        return `OK: frontend open question ${mode} (${items.length} total)`
      },
    }),

    inspect_frontend_result_status: tool({
      description:
        "Inspect the current frontend fact snapshot after update_* calls, including missing fragments and validation findings.",
      inputSchema: z.object({}).strict(),
      execute: async () =>
        frontendDesignFactStatus(collector, {
          artifactRoot,
          artifactRootRelative,
          workspaceRoot,
          mode,
          processIdentity,
        }),
    }),

  }

  return {
    tools,
    getCollector(): FrontendDesignCollector {
      return {
        specs: [...collector.specs],
        mode,
        draft: { ...collector.draft },
        semantic_error: collector.semantic_error,
      }
    },
    missingActions() {
      return frontendDraftMissingActions(collector)
    },
    async snapshotCurrent() {
      return snapshotFrontendDesignFacts({
        collector,
        artifactRoot,
        artifactRootRelative,
        workspaceRoot,
        mode,
        processIdentity,
      })
    },
    getSpecs(): VisualSpec[] {
      return [...collector.specs]
    },
    reset() {
      collector = emptyCollector(mode)
    },
  }
}
