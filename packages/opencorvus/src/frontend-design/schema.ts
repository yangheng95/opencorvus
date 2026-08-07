/**
 * Frontend Design Agent schema and output types.
 *
 * Mirrors frontend-research: Zod schemas live in this module, while
 * output-tools.ts owns collection, normalization, and report rendering.
 */
import { z } from "zod"
import { FactCheckItemListSchema } from "@/fact-check/schema"
import { VisualRegionBindingManifestSchema } from "./visual-region-binding-schema"

export const FrontendDesignModeSchema = z.enum(["greenfield_original", "reference_parity"])
export type FrontendDesignMode = z.infer<typeof FrontendDesignModeSchema>

function normalizedArtifactPath(input: string): string {
  return input.replaceAll("\\", "/")
}

function artifactBasename(input: string): string {
  const normalized = normalizedArtifactPath(input)
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase()
}

function isReferenceNamedArtifact(input: string): boolean {
  return /\breference(?:-[a-z0-9_-]+)?\.png$/i.test(artifactBasename(input))
}

function isTemporaryCaptureArtifact(input: string): boolean {
  const normalized = normalizedArtifactPath(input).toLowerCase()
  return normalized.includes("/opencorvus-capture/") || normalized.startsWith("opencorvus-capture/")
}

function isRasterScreenshotArtifact(input: string): boolean {
  return /\.(?:png|jpe?g|webp)$/i.test(artifactBasename(input))
}

function isLocalPreviewUrl(input: string): boolean {
  const normalized = normalizedArtifactPath(input)
  if (/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|\[::1\])(?:[:/?#]|$)/i.test(normalized)) return true
  try {
    const url = new URL(normalized)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
  } catch {
    return false
  }
}

function isRenderedPreviewArtifact(input: string): boolean {
  const normalized = normalizedArtifactPath(input).toLowerCase()
  const base = artifactBasename(input)
  if (isTemporaryCaptureArtifact(input)) return true
  if (isLocalPreviewUrl(input)) return true
  if (!normalized.includes("visual-html-skeleton/")) return false
  if (!/\.(?:png|jpe?g|webp|json)$/i.test(base)) return false
  if (/(?:^|\/)(?:screenshots?|previews?|captures?|renders?|diffs?|visual-diffs?)(?:\/|$)/i.test(normalized)) {
    return true
  }
  return /\b(?:screenshot|preview|capture|diff|render|visual-diff)\b/i.test(normalized)
}

function isVisualHtmlSkeletonArtifact(input: string): boolean {
  const normalized = normalizedArtifactPath(input).toLowerCase()
  return (
    normalized === "visual-html-skeleton" ||
    normalized.startsWith("visual-html-skeleton/") ||
    normalized.includes("/visual-html-skeleton/")
  )
}

const SourceReferenceStringSchema = z.string().min(1).refine((value) => !isRenderedPreviewArtifact(value), {
  message:
    "source/reference artifacts must cite source evidence; rendered skeleton previews belong in visual_validation_evidence.screenshot_artifact",
})

const SourceReferenceListSchema = z.array(SourceReferenceStringSchema)

const FrontendProjectEntrypointStringSchema = z.string().min(1).refine((value) => !isRenderedPreviewArtifact(value), {
  message:
    "frontend_project.entrypoints must name source-editable entry files; rendered screenshots/diffs belong in visual_validation_evidence",
})

const RenderedSkeletonPreviewArtifactSchema = z
  .string()
  .min(1)
  .refine(isVisualHtmlSkeletonArtifact, {
    message: "screenshot_artifact must point to a task-scoped visual-html-skeleton artifact",
  })
  .refine((value) => !isReferenceNamedArtifact(value), {
    message: "screenshot_artifact must be a rendered skeleton preview, not a source reference image",
  })
  .refine((value) => !isTemporaryCaptureArtifact(value) && !isLocalPreviewUrl(value), {
    message:
      "screenshot_artifact must point to a task-scoped visual-html-skeleton artifact, not temporary or localhost preview output",
  })
  .refine(isRenderedPreviewArtifact, {
    message: "screenshot_artifact must point to a rendered screenshot/preview under visual-html-skeleton",
  })

const VisualValidationDiffArtifactSchema = z
  .string()
  .refine((value) => value === "" || isVisualHtmlSkeletonArtifact(value), {
    message: "diff_artifact must point to a task-scoped visual-html-skeleton artifact",
  })
  .refine((value) => value === "" || (!isTemporaryCaptureArtifact(value) && !isLocalPreviewUrl(value)), {
    message:
      "diff_artifact must point to a task-scoped visual-html-skeleton artifact, not temporary or localhost preview output",
  })
  .default("")

export const VisualSpecCategory = z.enum([
  "color",
  "typography",
  "spacing",
  "layout",
  "component",
  "interaction",
  "responsive",
])
export type VisualSpecCategory = z.infer<typeof VisualSpecCategory>

export const VisualSpecSeverity = z.enum(["must", "should"])
export type VisualSpecSeverity = z.infer<typeof VisualSpecSeverity>

export const VisualSpecSchema = z.object({
  id: z.string().min(1).describe("Stable spec id, e.g. 'vis-color-primary', 'vis-comp-nav-button'"),
  category: VisualSpecCategory,
  title: z.string().min(1).describe("Short human label, e.g. 'Primary button background'"),
  requirement: z
    .string()
    .min(1)
    .describe("Concrete constraint value — '#3B82F6', 'Inter 700 24px/32px', '64px header height'"),
  applies_to: z.string().min(1).describe("Target description — component id, CSS selector, section reference"),
  severity: VisualSpecSeverity,
  rationale: z.string().optional().describe("Why this matters (only if non-obvious from the constraint itself)"),
})
export type VisualSpec = z.infer<typeof VisualSpecSchema>

export const FlexibleStringListSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return []
    if (Array.isArray(value)) return value
    if (typeof value !== "string") return [String(value)]
    return value
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean)
  },
  z.array(z.string().min(1)).default([]),
)

export const ComponentReusePlanItemSchema = z
  .object({
    family_id: z
      .string()
      .min(1)
      .describe(
        "Stable component-family id. Preserve model/source naming when useful; no host-specific prefix is required.",
      ),
    name: z.string().min(1).describe("Human-readable component family name."),
    observed_surface: z.string().min(1).describe("Visible page region or behavior this component family covers."),
    source_refs: z
      .array(SourceReferenceStringSchema)
      .default([])
      .describe("Evidence anchors such as declared artifact refs, source ids, editable files, or screenshot regions."),
    implementation_strategy: z
      .enum(["existing_project_component", "mature_library", "extracted_baseline_defer", "project_specific_component"])
      .describe(
        "Chosen implementation route. Prefer existing_project_component; use mature_library for hard domains; " +
          "use extracted_baseline_defer when the generated DOM/CSS baseline must remain until a parity-preserving replacement exists; project_specific_component is last resort.",
      ),
    reuse_source: z
      .string()
      .min(1)
      .describe(
        "Concrete reuse target. Name one installed package from package.json, one existing project/source file path, or one design-system primitive identifier the agent actually inspected. Put explanations in project_specific_reason, parity_guard, or notes.",
      ),
    mature_library_candidates: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Candidate maintained libraries for task-declared complex interaction, content, or data surfaces.",
      ),
    props_states: z
      .string()
      .min(1)
      .describe(
        "Props/data/state/variants/interactions frontend_design implemented or projected implementation consumers must preserve during fine-tuning.",
      ),
    replacement_boundary: z
      .string()
      .min(1)
      .describe(
        "What exact skeleton/DOM region can be replaced by this component family, and what must remain intact until parity is proven.",
      ),
    parity_guard: z
      .string()
      .min(1)
      .describe(
        "How frontend_design verified replacement did not regress visual fidelity, plus any implementation fine-tuning verification anchors.",
      ),
    project_specific_reason: z
      .string()
      .default("")
      .describe(
        "Optional reason when implementation_strategy=project_specific_component; explain why existing components and mature libraries do not fit when known.",
      ),
  })
  .strict()

export const BaselineReplacementPlanItemSchema = z
  .object({
    boundary_id: z
      .string()
      .min(1)
      .describe(
        "Stable source-region evolution boundary id. Preserve model/source naming when useful; no host-specific prefix is required.",
      ),
    source_region: z
      .string()
      .min(1)
      .describe("Exact skeleton/source region to refine, replace, or defer, with file/source ids when available."),
    action: z
      .enum(["replace_generated_baseline", "delete_generated_region", "defer_baseline_until_parity"])
      .describe(
        "Whether frontend_design replaced a region, deleted genuinely redundant generated coverage, or temporarily deferred it until parity is safe.",
      ),
    component_family_id: z
      .string()
      .min(1)
      .describe("Component family from component_reuse_plan that owns the replacement/deletion boundary."),
    replacement_strategy: z
      .enum(["existing_project_component", "mature_library", "extracted_baseline_defer", "project_specific_component"])
      .describe(
        "Refinement route. Prefer existing_project_component, then mature_library; project_specific_component is last resort.",
      ),
    reuse_source: z
      .string()
      .min(1)
      .describe(
        "Concrete reuse target for this replacement boundary. Name one installed package from package.json, one existing project/source file path, or one design-system primitive identifier the agent actually inspected. Do not use prose as the value; explanations belong in project_specific_reason, deletion_rule, parity_guard, or notes.",
      ),
    mature_library_candidates: z
      .array(z.string().min(1))
      .default([])
      .describe("Maintained library candidates when replacement_strategy=mature_library."),
    deletion_rule: z
      .string()
      .min(1)
      .describe(
        "What redundant generated DOM/CSS/asset coverage, if any, can be removed once the replacement passes, and what evidence should remain input-only.",
      ),
    source_refs: z
      .array(SourceReferenceStringSchema)
      .default([])
      .describe(
        "Evidence anchors such as declared artifact refs, editable-region slots, or screenshot regions.",
      ),
    parity_guard: z
      .string()
      .min(1)
      .describe("Concrete visual/source checks to run before deleting or replacing a region."),
    project_specific_reason: z
      .string()
      .default("")
      .describe(
        "Optional reason when replacement_strategy=project_specific_component; explain why no project component or mature library fits when known.",
      ),
  })
  .strict()

export const CompactTemplateItemSchema = z
  .object({
    title: z.string().min(1).describe("Short stable heading for this template item."),
    detail: z
      .string()
      .min(1)
      .describe(
        "Concise implementation detail. Keep this short; refer to source artifacts by path instead of pasting dense content.",
      ),
    source_refs: z
      .array(SourceReferenceStringSchema)
      .default([])
      .describe(
        "Evidence anchors such as declared artifact refs, editable-region slots, or screenshot regions.",
      ),
  })
  .strict()

export const MaterialInventoryItemSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .describe(
        "Short stable name for a required material group, such as CSS tokens, assets, fixtures, fonts, or icons.",
      ),
    detail: z
      .string()
      .min(1)
      .describe(
        "What this material contains, why the frontend skeleton or later project needs it, and any ownership or extraction note.",
      ),
    source_refs: z
      .array(SourceReferenceStringSchema)
      .default([])
      .describe(
        "Evidence anchors or file/path ids for this material group. Reference paths/ids instead of dense payloads.",
      ),
  })
  .strict()

export const DesignDirectionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^direction-[a-z0-9][a-z0-9-]*$/, "id must start with 'direction-' and contain only [a-z0-9-]"),
    name: z.string().min(1).describe("Short name for the design direction."),
    concept: z.string().min(1).describe("Product/enterprise design concept and audience fit."),
    evidence_refs: SourceReferenceListSchema.default([]).describe("Rendered, source, or manifest references inspected."),
    tradeoffs: z.string().min(1).describe("Why this direction is strong or weak against the page job and product task criteria."),
    implementation_notes: z.string().min(1).describe("What a projected implementation consumer needs to implement this direction."),
  })
  .strict()
export type DesignDirection = z.infer<typeof DesignDirectionSchema>

export const AntiSlopReviewItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^anti-slop-[a-z0-9][a-z0-9-]*$/, "id must start with 'anti-slop-' and contain only [a-z0-9-]"),
    rejected_trait: z.string().min(1).describe("The shallow, generic, or unfit design trait rejected."),
    evidence: z.string().min(1).describe("Resource-backed reason this trait is wrong for the product."),
    correction: z.string().min(1).describe("The selected design or implementation correction."),
  })
  .strict()
export type AntiSlopReviewItem = z.infer<typeof AntiSlopReviewItemSchema>

export const ImplementationPhase = z.enum([
  "evidence_lock",
  "implementation_scaffold",
  "data_component_transcription",
  "runtime_visual_verification",
  "source_quality_cleanup",
])
export type ImplementationPhase = z.infer<typeof ImplementationPhase>

export const ImplementationPhaseOutcomeSchema = z
  .object({
    id: z.string().min(1).describe("Stable phase outcome id, e.g. phase-evidence-lock."),
    phase: ImplementationPhase.describe(
      "Required maintainable handoff phase: evidence lock, implementation scaffold, transcription, runtime/visual verification, or source-quality cleanup.",
    ),
    title: z.string().min(1).describe("Short phase outcome title."),
    deliverable: z
      .string()
      .min(1)
      .describe("Concrete output downstream agents must create, preserve, verify, or audit for this phase."),
    source_refs: z
      .array(SourceReferenceStringSchema)
      .min(1)
      .describe("Evidence, project, screenshot, package, or source-file refs that bind this phase."),
    acceptance: z
      .string()
      .min(1)
      .describe("Observable acceptance condition for this phase, not a component checklist item."),
  })
  .strict()
export type ImplementationPhaseOutcome = z.infer<typeof ImplementationPhaseOutcomeSchema>

const VisualValidationEvidenceBaseSchema = z
  .object({
    id: z.string().min(1).describe("Stable visual validation evidence id, e.g. visual-render-desktop."),
    render_target: z
      .enum(["visual-html-skeleton"])
      .describe(
        "The rendered source surface. Visual baseline acceptance only supports the visual HTML skeleton target.",
      ),
    rendered_entrypoint: z
      .string()
      .min(1)
      .describe("Rendered HTML entrypoint, normally visual-html-skeleton/index.html."),
    screenshot_artifact: RenderedSkeletonPreviewArtifactSchema.describe(
      "Task-scoped rendered skeleton preview artifact under visual-html-skeleton produced from rendered_entrypoint; never a copied source reference image or temporary browser capture path.",
    ),
    renderer: z
      .enum(["task_scoped_backend_browser", "node_playwright_static_file", "preview_target_browser"])
      .describe("Renderer/provenance used to produce screenshot_artifact from rendered_entrypoint."),
    viewport: z
      .string()
      .min(1)
      .describe("Viewport/device state used for rendering, including explicit dimensions such as desktop-1440x900."),
    location_hash: z
      .string()
      .refine((value) => value === "" || (value.startsWith("#") && !/[\r\n]/.test(value)), {
        message: "location_hash must be empty or a single URL hash beginning with #",
      })
      .default("")
      .describe("Optional deterministic hash route/state applied to rendered_entrypoint for capture and fresh verification."),
    capture_mode: z
      .enum(["viewport", "full_page"])
      .describe(
        "Screenshot capture mode used for screenshot_artifact. Use viewport for a single viewport crop and full_page when the screenshot captures the complete document height.",
      ),
    screenshot_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "screenshot_sha256 must be a 64 character hex digest")
      .describe("SHA-256 of the rendered skeleton screenshot artifact."),
    review_status: z
      .enum(["reviewed_no_blocking_debt", "reviewed_with_blocking_debt"])
      .describe("Whether screenshot review found blocking visual debt."),
    review_summary: z
      .string()
      .min(1)
      .describe(
        "Concrete review of the rendered output against its declared acceptance criteria. Do not imply a source-reference comparison unless kind=reference_comparison.",
      ),
  })
  .strict()

export const GreenfieldVisualValidationEvidenceSchema = VisualValidationEvidenceBaseSchema.extend({
  kind: z
    .literal("render_review")
    .describe(
      "Rendered-original review with no source reference, source-reference digest, or visual-diff artifact.",
    ),
}).strict()

export const ReferenceVisualValidationEvidenceSchema = VisualValidationEvidenceBaseSchema.extend({
  kind: z
    .literal("reference_comparison")
    .describe(
      "Rendered comparison against an explicitly declared source reference; this branch alone carries the source-reference digest and optional visual-diff artifact.",
    ),
  source_reference_artifact: z
    .string()
    .min(1)
    .describe("Exact declared reference artifact used for this rendered comparison."),
  source_reference_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "source_reference_sha256 must be a 64 character hex digest")
    .describe("SHA-256 of the declared source reference artifact."),
  diff_artifact: VisualValidationDiffArtifactSchema.describe(
    "Optional task-scoped visual diff or comparison manifest produced from the rendered and declared reference artifacts.",
  ),
}).strict()

export const VisualValidationEvidenceSchema = z.discriminatedUnion("kind", [
  GreenfieldVisualValidationEvidenceSchema,
  ReferenceVisualValidationEvidenceSchema,
])
export type VisualValidationEvidence = z.infer<typeof VisualValidationEvidenceSchema>

const VisualValidationEvidenceListDescription =
  "Structured rendered-screenshot evidence for visual-html-skeleton acceptance. Required when frontend_project.role=visual_baseline_input. A render_review records rendered-original inspection without source-reference fields; only a reference_comparison binds the rendered artifact to an explicitly declared source reference, its digest, and an optional diff artifact. Every item records the rendered entrypoint, task-scoped renderer, rendered screenshot artifact and digest, viewport dimensions, capture mode, and review status. Text-only screenshot paths do not satisfy visual baseline acceptance."

export const CompetitorReferenceEvidenceSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^competitor-[a-z0-9][a-z0-9-]*$/, "id must start with 'competitor-' and contain only [a-z0-9-]"),
    evidence_source: z
      .enum(["user_provided", "frontend_research", "deep_research", "task_material"])
      .describe("Where this competitor/design-reference webpage evidence came from; never guessed by frontend_design."),
    source_page_ref: SourceReferenceStringSchema.describe(
      "Frontend Research source-page artifact, URL, or brief ref that motivated this competitor/reference comparison.",
    ),
    competitor_url: z
      .string()
      .url()
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
        message: "competitor_url must be an HTTP(S) webpage URL from user/frontend_research/deep_research/task evidence",
      })
      .describe("Evidence-backed competitor or design-reference webpage URL. Do not invent or infer URLs."),
    screenshot_artifact: SourceReferenceStringSchema.refine(isRasterScreenshotArtifact, {
      message: "competitor screenshot_artifact must be a task/source evidence raster image",
    }).describe("Task-scoped screenshot artifact captured from competitor_url or its materialized evidence."),
    screenshot_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "screenshot_sha256 must be a 64 character hex digest"),
    viewport: z.string().min(1).describe("Viewport/device state used for the competitor screenshot."),
    inspected_elements: z
      .array(z.string().min(1))
      .min(1)
      .describe("Concrete competitor page regions/patterns inspected before redesign."),
    influence_on_selected_direction: z
      .string()
      .min(1)
      .describe("How this reference influenced or constrained the selected HTML design draft."),
    source_refs: SourceReferenceListSchema.min(1).describe("Durable evidence refs, briefs, screenshots, or bundles."),
  })
  .strict()
export type CompetitorReferenceEvidence = z.infer<typeof CompetitorReferenceEvidenceSchema>

const OptionalMarkdownField = (description: string) =>
  z
    .string()
    .default("")
    .describe(
      `${description} Prefer concise markdown. For dense pages, omit this field and use the matching structured *_items field so the tool can render markdown safely.`,
    )

// Snapshot schema derived from the current incremental frontend fact collector.
export const FrontendDesignPayloadSchema = z
  .object({
    design_system: z
      .string()
      .min(1)
      .describe("Detected design system — e.g. 'Material 3', 'custom dark with teal accents'."),
    tech_stack: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        "Recommended implementation stack hints for this frontend, including framework, styling, mock-data/API, " +
          "mock-data, and runtime choices when the observed requirements call for them. Prefer the existing repository " +
          "stack and declared data contracts unless inspected evidence establishes additional runtime needs. " +
          "Do not name implementation infrastructure or services unless they are explicitly declared by task evidence.",
      ),
    final_acceptance_mode: z
      .enum(["visual_baseline_allowed", "maintainable_replacement_required"])
      .describe(
        "Explicit acceptance mode. Use visual_baseline_allowed with frontend_project.role=visual_baseline_input only when the visual surface has rendered screenshot review evidence. Use maintainable_replacement_required when the declared task requires a production-mergeable implementation, target design-system/component reuse, accessibility/component semantics, or replacement of generated output in the same task.",
      ),
    frontend_template: OptionalMarkdownField(
      "Authoritative frontend template for the frontend_design-delivered visual surface: static route/file, layout slots, source entrypoints, visible regions, states, explicitly scoped viewport evidence, and acceptance anchors.",
    ),
    frontend_template_sections: z
      .array(CompactTemplateItemSchema)
      .default([])
      .describe(
        "Preferred compact replacement for a long frontend_template string. Use one item per route, layout slot, scoped viewport evidence item, or acceptance anchor.",
      ),
    design_directions: z
      .array(DesignDirectionSchema)
      .default([])
      .describe(
        "Competing named design directions considered before the selected handoff when the declared task calls for alternatives.",
      ),
    selected_design_direction_id: z
      .string()
      .default("")
      .describe("The id from design_directions selected for downstream implementation, empty when no alternatives were needed."),
    anti_slop_review: z
      .array(AntiSlopReviewItemSchema)
      .default([])
      .describe(
        "Rejected shallow or generic design traits and the evidence-backed corrections applied before handoff.",
      ),
    competitor_reference_evidence: z
      .array(CompetitorReferenceEvidenceSchema)
      .default([])
      .describe(
        "Competitor or design-reference evidence inspected when declared by the task. Each item must come from user, frontend_research, deep_research, or task material evidence; frontend_design must not invent URLs.",
      ),
    fillable_modules: OptionalMarkdownField(
      "Modules/slots frontend_design filled or left as explicit source debt: page modules, data modules, interactions, state, adapters, and verification modules.",
    ),
    fillable_module_items: z
      .array(CompactTemplateItemSchema)
      .default([])
      .describe("Preferred compact replacement for a long fillable_modules string. Use one item per module or slot."),
    component_inventory: OptionalMarkdownField(
      "Concise component-family cross-check. Do not use this as a standalone checklist; direct downstream agents to component_reuse_plan, quality_project_contract, completeness_review, open_questions, and named source artifacts. If omitted, it is rendered as a compact reuse-family summary from component_reuse_plan.",
    ),
    component_reuse_plan: z
      .array(ComponentReusePlanItemSchema)
      .min(1)
      .describe(
        "Structured, auditable reuse plan for the implementation surface. Each reusable family must say whether frontend_design reused an existing project component/design-system primitive, used a mature maintained library, kept the extracted DOM/CSS baseline until replacement is safe, or used a justified project-specific component. This keeps complex controls tied to project/library ownership without turning the handoff into a component catalog.",
      ),
    baseline_replacement_plan: z
      .array(BaselineReplacementPlanItemSchema)
      .default([])
      .describe(
        "Optional source-region evolution plan. Use it only when a specific raw/generated skeleton region should be replaced, deleted, or deferred during in-place refinement. It is diagnostic/planning evidence, not a schema requirement and not a requirement to delete the whole skeleton.",
      ),
    quality_project_contract: OptionalMarkdownField(
      "The skeleton-to-project transcription contract for the later workflow. It explains how the screenshot-validated visual HTML skeleton plus source IR/content/style/token evidence becomes maintainable project source with semantic components, data modules, styling, asset ownership, runtime entrypoints, and verification evidence; if screenshot validation is missing, it must name the blocker instead. The current skeleton is not the implementation target or acceptance app root.",
    ),
    quality_project_items: z
      .array(CompactTemplateItemSchema)
      .default([])
      .describe(
        "Preferred compact replacement for a long quality_project_contract string. Use one item per source module, component group, data module, style module, asset strategy, or verification requirement.",
      ),
    implementation_phase_outcomes: z
      .array(ImplementationPhaseOutcomeSchema)
      .default([])
      .describe(
        "Structured phase outcomes for maintainable replacement. Required when final_acceptance_mode=maintainable_replacement_required and must cover evidence_lock, implementation_scaffold, data_component_transcription, runtime_visual_verification, and source_quality_cleanup. Projected planning consumers use this before component_inventory/component_reuse_plan.",
      ),
    material_inventory: OptionalMarkdownField(
      "Material and asset inventory: CSS/tokens, sidecar SVG/image/canvas assets, data fixtures, text samples, icons, fonts, and dense resources.",
    ),
    material_inventory_items: z
      .array(MaterialInventoryItemSchema)
      .min(1)
      .describe(
        "Required compact material inventory. Include at least one item covering the CSS/tokens, sidecar SVG/image/canvas assets, data fixtures, text samples, icons, fonts, or dense resources needed to reproduce the frontend. Reference paths/ids instead of dense payloads.",
      ),
    frontend_project: z
      .object({
        status: z.enum(["created", "not_created", "blocked"]).default("not_created"),
        role: z
          .enum(["source_baseline_input", "implementation_target", "visual_baseline_input", "blocked"])
          .default("source_baseline_input"),
        project_root: z.string().default(""),
        source_package: z.string().default(""),
        entrypoints: z
          .array(FrontendProjectEntrypointStringSchema)
          .default([])
          .describe(
            "Role-specific entrypoint paths. For role=implementation_target, every item must be a real project-root-relative file under project_root. For role=visual_baseline_input, name source-editable visual-html-skeleton entry files such as index.html and token/region CSS. Rendered screenshots, preview captures, and diff outputs belong in visual_validation_evidence, not entrypoints. Do not put .opencorvus report paths or prose here.",
          ),
        generation_tool: z.string().default(""),
        notes: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({
        status: "not_created",
        role: "source_baseline_input",
        project_root: "",
        source_package: "",
        entrypoints: [],
        generation_tool: "",
        notes: [],
      })
      .describe(
        "Concrete frontend-design project output. Identify the declared output role, project root, source-editable entrypoints, explicit source/evidence identity when applicable, generation tool, completed work, unfinished visual debt, and materialization defects.",
      ),
    visual_consistency_contract: OptionalMarkdownField(
      "Binding visual-fidelity frontend template section: declared viewport inventory, pixel hierarchy, colors, typography, spacing, states, explicitly scoped layout rules, comparison criteria, and evidence artifacts.",
    ),
    visual_consistency_items: z
      .array(CompactTemplateItemSchema)
      .default([])
      .describe(
        "Preferred compact replacement for a long visual_consistency_contract string. Use one item per scoped viewport, region, or visual rule.",
      ),
    visual_validation_evidence: z
      .array(VisualValidationEvidenceSchema)
      .default([])
      .describe(VisualValidationEvidenceListDescription),
    visual_region_bindings: z
      .array(VisualRegionBindingManifestSchema)
      .default([])
      .describe(
        "Structured VisualRegionBinding crop manifests completed by frontend_design for projected planning consumers that own reference_coverage.reference_regions.",
      ),
    ui_data_contract: OptionalMarkdownField(
      "UI data contract required to reproduce the frontend: local mock/static data, observable endpoints when present, state transitions, and error/loading behavior.",
    ),
    ui_data_contract_items: z
      .array(CompactTemplateItemSchema)
      .default([])
      .describe(
        "Preferred compact replacement for a long ui_data_contract string. Use one item per entity, fixture, endpoint, or state model.",
      ),
    template_iteration_notes: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        "One or more genuine frontend template review findings completed before handoff. Each item must name what was checked, what was missing or corrected, and why the resulting frontend template is now safe for downstream agents.",
      ),
    completeness_review: z
      .string()
      .min(1)
      .describe(
        "Completeness audit and primary human-readable problem/handoff section. Cover known implementation risks, visual/source gaps, extraction-vs-rewrite uncertainty, project source organization, component/library reuse constraints, reference artifacts, and remaining open questions. Record the current evidence honestly; missing or conflicting facts remain visible in the FrontendDesign artifact.",
      ),
    reference_artifacts: z
      .array(SourceReferenceStringSchema)
      .default([])
      .describe(
        "Compact declared artifact anchors used as evidence. Prefer immutable manifest/reference refs and small editable entrypoints. Do not enumerate dense raw/generated inventories when their committed manifest is the authority.",
      ),
    open_questions: FlexibleStringListSchema.default([]).describe(
      "Only truly unobservable product/API facts that downstream agents must not hallucinate.",
    ),
    // Optional fact-check registration: missing means no items registered.
    fact_check_items: FactCheckItemListSchema.default([]).describe(
      "Every factual claim (third-party design system name, API behaviour, library version) you have NOT verified via tool calls in this session. Empty when only design observations or in-session-verified statements.",
    ),
  })
  .strict()
export type FrontendDesignPayload = z.infer<typeof FrontendDesignPayloadSchema>

export const ToolCompactTemplateItemSchema = z
  .object({
    title: z.string().min(1),
    detail: z.string().min(1),
    source_refs: SourceReferenceListSchema.default([]),
  })
  .strict()

export const ToolMaterialInventoryItemSchema = z
  .object({
    title: z.string().min(1),
    detail: z.string().min(1),
    source_refs: SourceReferenceListSchema.default([]),
  })
  .strict()

export const ToolDesignDirectionSelectionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^direction-[a-z0-9][a-z0-9-]*$/, "id must start with 'direction-' and contain only [a-z0-9-]"),
  })
  .strict()
export const ToolImplementationPhaseOutcomeSchema = z
  .object({
    id: z.string().min(1),
    phase: ImplementationPhase,
    title: z.string().min(1),
    deliverable: z.string().min(1),
    source_refs: SourceReferenceListSchema.min(1),
    acceptance: z.string().min(1),
  })
  .strict()

export const ToolComponentReusePlanItemSchema = z
  .object({
    family_id: z.string().min(1),
    name: z.string().min(1),
    observed_surface: z.string().min(1),
    source_refs: SourceReferenceListSchema.default([]),
    implementation_strategy: z.enum([
      "existing_project_component",
      "mature_library",
      "extracted_baseline_defer",
      "project_specific_component",
    ]),
    reuse_source: z
      .string()
      .min(1)
      .describe(
        "Concrete reuse target: installed package, existing project/source file path, or inspected design-system primitive identifier. Explanatory prose belongs in project_specific_reason, parity_guard, or notes.",
      ),
    mature_library_candidates: z.array(z.string().min(1)).default([]),
    props_states: z.string().min(1),
    replacement_boundary: z.string().min(1),
    parity_guard: z.string().min(1),
    project_specific_reason: z.string().default(""),
  })
  .strict()

export const ToolBaselineReplacementPlanItemSchema = z
  .object({
    boundary_id: z.string().min(1),
    source_region: z.string().min(1),
    action: z.enum(["replace_generated_baseline", "delete_generated_region", "defer_baseline_until_parity"]),
    component_family_id: z.string().min(1),
    replacement_strategy: z.enum([
      "existing_project_component",
      "mature_library",
      "extracted_baseline_defer",
      "project_specific_component",
    ]),
    reuse_source: z
      .string()
      .min(1)
      .describe(
        "Concrete reuse target for this boundary: installed package, existing project/source file path, or inspected design-system primitive identifier. Explanatory prose belongs in project_specific_reason, deletion_rule, parity_guard, or notes.",
      ),
    mature_library_candidates: z.array(z.string().min(1)).default([]),
    deletion_rule: z.string().min(1),
    source_refs: SourceReferenceListSchema.default([]),
    parity_guard: z.string().min(1),
    project_specific_reason: z.string().default(""),
  })
  .strict()

export const ToolVisualValidationEvidenceSchema = VisualValidationEvidenceSchema

const FrontendVisualEvidenceCaptureBaseSchema = z
  .object({
    id: z.string().min(1),
    rendered_entrypoint: z.string().min(1),
    screenshot_artifact: RenderedSkeletonPreviewArtifactSchema,
    viewport: z
      .object({
        width: z.number().int().positive().max(10_000),
        height: z.number().int().positive().max(10_000),
        label: z.string().min(1).default("desktop"),
      })
      .strict(),
    location_hash: z
      .string()
      .refine((value) => value === "" || (value.startsWith("#") && !/[\r\n]/.test(value)), {
        message: "location_hash must be empty or a single URL hash beginning with #",
      })
      .default(""),
    capture_mode: z.enum(["viewport", "full_page"]),
    review_status: z.enum(["reviewed_no_blocking_debt", "reviewed_with_blocking_debt"]),
    review_summary: z.string().min(1),
  })
  .strict()

export const FrontendRenderReviewCaptureToolInputSchema = FrontendVisualEvidenceCaptureBaseSchema.extend({
  kind: z.literal("render_review"),
}).strict()

export const FrontendReferenceComparisonCaptureToolInputSchema = FrontendVisualEvidenceCaptureBaseSchema.extend({
  kind: z.literal("reference_comparison"),
  source_reference_artifact: SourceReferenceStringSchema,
  diff_artifact: VisualValidationDiffArtifactSchema,
}).strict()

export const FrontendVisualEvidenceCaptureToolInputSchema = z.discriminatedUnion("kind", [
  FrontendRenderReviewCaptureToolInputSchema,
  FrontendReferenceComparisonCaptureToolInputSchema,
])

export const FrontendDesignBasicsToolInputSchema = z
  .object({
    design_system: z.string().min(1),
    tech_stack: z.array(z.string().min(1)).min(1),
    final_acceptance_mode: z.enum(["visual_baseline_allowed", "maintainable_replacement_required"]),
  })
  .strict()

export const FrontendDesignMarkdownSectionNameSchema = z.enum([
  "frontend_template",
  "fillable_modules",
  "component_inventory",
  "quality_project_contract",
  "material_inventory",
  "visual_consistency_contract",
  "ui_data_contract",
  "completeness_review",
])

export const FrontendDesignMarkdownSectionToolInputSchema = z
  .object({
    section: FrontendDesignMarkdownSectionNameSchema,
    content: z.string().min(1),
  })
  .strict()

export const FrontendTemplateCompactItemTargetSchema = z.enum([
  "frontend_template_sections",
  "fillable_module_items",
  "quality_project_items",
  "visual_consistency_items",
  "ui_data_contract_items",
])

export const FrontendDesignCompactItemToolInputSchema = z
  .object({
    target: FrontendTemplateCompactItemTargetSchema,
    item: ToolCompactTemplateItemSchema,
  })
  .strict()

export const FrontendProjectToolInputSchema = z
  .object({
    status: z.enum(["created", "not_created", "blocked"]).default("not_created"),
    role: z
      .enum(["source_baseline_input", "implementation_target", "visual_baseline_input", "blocked"])
      .default("source_baseline_input"),
    project_root: z.string().default(""),
    source_package: z.string().default(""),
    entrypoints: z
      .array(FrontendProjectEntrypointStringSchema)
      .default([])
      .describe(
        "Role-specific entrypoint paths. For role=implementation_target, every item must be a real project-root-relative file under project_root. For role=visual_baseline_input, name source-editable visual-html-skeleton entry files only. Rendered screenshots, preview captures, and diff outputs belong in visual_validation_evidence. Do not put .opencorvus report paths or prose here.",
      ),
    generation_tool: z.string().default(""),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()

export const FrontendDesignStringItemToolInputSchema = z
  .object({
    value: z.string().min(1),
  })
  .strict()

export const FrontendReferenceArtifactToolInputSchema = z
  .object({
    value: SourceReferenceStringSchema,
  })
  .strict()

export const FrontendVisualRegionBindingManifestToolInputSchema = z
  .object({
    manifest_path: SourceReferenceStringSchema.describe(
      "Project-root-relative JSON manifest path returned by create_visual_region_binding_package.",
    ),
  })
  .strict()

export const FrontendDesignDraftSchema = z
  .object({
    design_system: z.string().min(1),
    tech_stack: z.array(z.string().min(1)).min(1),
    final_acceptance_mode: z.enum(["visual_baseline_allowed", "maintainable_replacement_required"]),
    frontend_template: z.string().default(""),
    frontend_template_sections: z.array(ToolCompactTemplateItemSchema).default([]),
    design_directions: z.array(DesignDirectionSchema).default([]),
    selected_design_direction_id: z.string().default(""),
    anti_slop_review: z.array(AntiSlopReviewItemSchema).default([]),
    competitor_reference_evidence: z.array(CompetitorReferenceEvidenceSchema).default([]),
    fillable_modules: z.string().default(""),
    fillable_module_items: z.array(ToolCompactTemplateItemSchema).default([]),
    component_inventory: z.string().default(""),
    component_reuse_plan: z.array(ToolComponentReusePlanItemSchema).min(1),
    baseline_replacement_plan: z.array(ToolBaselineReplacementPlanItemSchema).default([]),
    quality_project_contract: z.string().default(""),
    quality_project_items: z.array(ToolCompactTemplateItemSchema).default([]),
    implementation_phase_outcomes: z.array(ToolImplementationPhaseOutcomeSchema).default([]),
    material_inventory: z.string().default(""),
    material_inventory_items: z.array(ToolMaterialInventoryItemSchema).min(1),
    frontend_project: FrontendProjectToolInputSchema.default({
      status: "not_created",
      role: "source_baseline_input",
      project_root: "",
      source_package: "",
      entrypoints: [],
      generation_tool: "",
      notes: [],
    }),
    visual_consistency_contract: z.string().default(""),
    visual_consistency_items: z.array(ToolCompactTemplateItemSchema).default([]),
    visual_validation_evidence: z
      .array(ToolVisualValidationEvidenceSchema)
      .default([])
      .describe(VisualValidationEvidenceListDescription),
    visual_region_bindings: z.array(VisualRegionBindingManifestSchema).default([]),
    ui_data_contract: z.string().default(""),
    ui_data_contract_items: z.array(ToolCompactTemplateItemSchema).default([]),
    template_iteration_notes: z.array(z.string().min(1)).default([]),
    completeness_review: z.string().default(""),
    reference_artifacts: SourceReferenceListSchema.default([]),
    open_questions: FlexibleStringListSchema,
  })
  .strict()

const IdField = z
  .string()
  .min(1)
  .regex(/^vis-[a-z0-9][a-z0-9-]*$/, "id must start with 'vis-' and contain only [a-z0-9-]")
  .describe("Stable spec id, e.g. 'vis-color-primary', 'vis-comp-nav-button'")

const AppliesToField = z
  .string()
  .min(1)
  .describe("Target description — component id, CSS selector, or section reference the constraint applies to")

const SeverityField = z
  .enum(["must", "should"])
  .describe("'must' for exact visual contracts; 'should' for lower-specificity constraints acceptance still verifies")

const RationaleField = z
  .string()
  .optional()
  .describe("Why this matters (include only when non-obvious from the constraint itself)")

// ---------------------------------------------------------------------------
// Per-category tool input schemas — each compiles to the same VisualSpec row
// ---------------------------------------------------------------------------

export const ColorSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Primary button background'"),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, "hex must be #rgb, #rgba, #rrggbb, or #rrggbbaa")
    .describe("Exact color value in hex"),
  role: z
    .enum([
      "primary",
      "secondary",
      "accent",
      "background",
      "surface",
      "text",
      "border",
      "error",
      "success",
      "warning",
      "other",
    ])
    .describe("Semantic role of the color"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const TypographySchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Page heading', 'Body text'"),
  font_family: z.string().min(1).describe("e.g. 'Inter', 'SF Pro Display'"),
  font_size_px: z.number().positive().describe("Font size in px"),
  font_weight: z.number().int().min(100).max(900).describe("Font weight, 100-900"),
  line_height_px: z.number().positive().optional().describe("Line height in px, if discernible"),
  letter_spacing: z.string().optional().describe("Letter spacing, e.g. '-0.01em', '0.5px'"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const SpacingSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Card inner padding', 'Section gap'"),
  property: z.enum(["margin", "padding", "gap", "inset"]).describe("Which spacing property"),
  value_px: z.number().nonnegative().describe("Value in px"),
  side: z.enum(["all", "top", "right", "bottom", "left", "vertical", "horizontal"]).default("all"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const LayoutSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Header bar', 'Left sidebar'"),
  section_role: z
    .enum([
      "header",
      "nav",
      "sidebar",
      "hero",
      "content",
      "card-grid",
      "list",
      "form",
      "footer",
      "modal",
      "toolbar",
      "panel",
      "other",
    ])
    .describe("Semantic section role"),
  position: z.string().min(1).describe("e.g. 'top fixed', 'left 280px', 'centered below hero'"),
  dimensions: z.string().min(1).describe("e.g. 'full-width 64px height', '280px width 100vh'"),
  layout_method: z.enum(["flex", "grid", "absolute", "fixed", "sticky", "flow"]),
  coordinate_space: z.enum(["implementation_layout", "source_capture_viewport_px"]),
  implementation_use: z.enum(["visible_layout_constraint", "evidence_only"]),
  parent_id: z.string().optional().describe("Parent layout spec id if this section nests inside another"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const ComponentSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Primary CTA button'"),
  component_type: z.string().min(1).describe("Stable user-interface component type."),
  variant: z.string().default("default").describe("e.g. 'primary', 'ghost', 'outlined'"),
  within_layout_id: z
    .string()
    .optional()
    .describe("Layout spec id this component sits inside (should reference a register_layout_spec id)"),
  visual_refs: z
    .array(z.string().min(1))
    .default([])
    .describe("Other spec ids this component MUST satisfy — e.g. color/typography/spacing ids that style it"),
  props: z.string().min(1).describe("Key props / states / slots this component needs"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const InteractionSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Card hover shadow', 'Dropdown on click'"),
  trigger: z.enum(["hover", "click", "focus", "scroll", "drag", "resize", "keypress"]),
  effect: z.string().min(1).describe("e.g. 'shadow lifts to md', 'dropdown expands 240px', 'card scales 1.02'"),
  target_component_ids: z.array(z.string().min(1)).min(1).describe("Component spec ids affected"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})

export const ResponsiveSchema = z.object({
  id: IdField,
  title: z.string().min(1).describe("Human label, e.g. 'Mobile sidebar collapse'"),
  breakpoint: z.string().min(1).describe("e.g. '< 768px', '768px-1024px', '>= 1280px'"),
  change: z.string().min(1).describe("What changes at this breakpoint"),
  affected_layout_ids: z.array(z.string().min(1)).min(1).describe("Layout spec ids that change"),
  applies_to: AppliesToField,
  severity: SeverityField,
  rationale: RationaleField,
})
