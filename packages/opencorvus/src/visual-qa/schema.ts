import z from "zod"
import { ArtifactReadLocatorSchema, EngineArtifactLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { FactCheckItemListSchema } from "@/fact-check/schema"
import { VISUAL_QA_PRODUCT_DESIGN_PRINCIPLE_IDS } from "./product-design-principles"
import { normalizeVisualQaReferenceRegionKey } from "./reference-region-key"
import { ToolFailureCause } from "@/session/tool-failure-cause"

export const VisualQaSeveritySchema = z.enum(["critical", "major", "minor"])
export const VisualQaFindingStatusSchema = z.enum(["open", "repaired", "deferred"])
export const VisualQaCheckItemStatusSchema = z.enum(["passed", "failed", "inconclusive"])
export const VISUAL_QA_MULTI_VIEWPORT_ALIGNMENT_CATEGORY = "multi-viewport-alignment"

export const VisualQaViewportSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    device_scale_factor: z.number().positive().optional(),
  })
  .strict()

export const VisualQaDomBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  })
  .strict()

/**
 * Visual QA facts cite immutable, exact-readable Task Artifact identities.
 * Display namespaces, AttachmentStore URLs, paths, and filenames are not
 * evidence identities because none of them prove current-Task ownership or
 * the bytes that were inspected.
 */
export const VisualReviewEvidenceRefSchema = ArtifactReadLocatorSchema

export const VisualQaReferenceRegionKeySchema = z
  .string()
  .min(1)
  .transform((key, ctx) => {
    try {
      return normalizeVisualQaReferenceRegionKey(key, "Visual QA reference region key")
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : String(error),
      })
      return z.NEVER
    }
  })

export const VisualQaCoverageSchema = z
  .object({
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Visual QA check item IDs that produced this coverage row."),
    region: z.string().min(1).describe("Visible region, route, component family, or interaction surface checked."),
    viewports: z.array(VisualQaViewportSchema).default([]),
    states: z
      .array(z.string().min(1))
      .default([])
      .describe("Runtime states checked: default, narrow, hover, modal open, loading, error, etc."),
    source_refs: z
      .array(VisualReviewEvidenceRefSchema)
      .default([])
      .describe("Durable frontend-design/build/source evidence refs used as the source of truth."),
    evidence_refs: z
      .array(VisualReviewEvidenceRefSchema)
      .default([])
      .describe("Durable fresh screenshot, visual comparison, console/network, or command evidence refs."),
    notes: z.string().min(1),
  })
  .strict()

export const VisualQaCheckItemSchema = z
  .object({
    id: z.string().min(1),
    category: z
      .string()
      .min(1)
      .describe(
        "Review category or product design principle ID, for example component-truth, reference-structure, or multi-viewport-alignment.",
      ),
    question: z.string().min(1).describe("Concrete visual/product question that was checked."),
    region: z.string().min(1).describe("Visible region, route, component family, or interaction surface checked."),
    reference_region_key: VisualQaReferenceRegionKeySchema.optional().describe(
      "Required reference parity key in region_id@viewport_id form when this check covers one bound reference region.",
    ),
    status: VisualQaCheckItemStatusSchema,
    expected: z.string().min(1).describe("Expected visual or functional condition from task/source evidence."),
    observed: z.string().min(1).describe("Observed rendered result from fresh evidence."),
    viewports: z.array(VisualQaViewportSchema).default([]),
    states: z.array(z.string().min(1)).default([]),
    source_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
    evidence_refs: z
      .array(VisualReviewEvidenceRefSchema)
      .default([])
      .describe(
        "Fresh evidence refs that prove this check result when already known. Initial check registration may leave this empty; the VisualReview can expose the missing evidence without invalidating the Session.",
      ),
    required_correction: z
      .string()
      .min(1)
      .optional()
      .describe("Required correction when status is failed or inconclusive."),
  })
  .strict()

export const VisualQaFindingSchema = z
  .object({
    id: z.string().min(1),
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Visual QA check item IDs that exposed this finding."),
    severity: VisualQaSeveritySchema,
    status: VisualQaFindingStatusSchema,
    claim: z.string().min(1),
    reproduction: z.string().min(1),
    region: z.string().min(1),
    source_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
    evidence_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
  })
  .strict()

export const VisualQaProductionBlockerSchema = z
  .object({
    id: z.string().min(1),
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered failed or inconclusive Visual QA check item IDs that justify this blocker."),
    principle_ids: z
      .array(z.enum(VISUAL_QA_PRODUCT_DESIGN_PRINCIPLE_IDS))
      .min(1)
      .describe("Product design QA principle IDs that make this issue block production delivery."),
    region: z.string().min(1),
    reason: z
      .string()
      .min(1)
      .describe("Why a professional design reviewer would block this surface from production delivery."),
    impact: z.string().min(1).describe("User-visible or product-quality impact if shipped as-is."),
    required_correction: z.string().min(1).describe("Concrete correction required before the product can ship."),
    source_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
    evidence_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
  })
  .strict()

export const VisualQaCodeModuleReferenceSchema = z
  .object({
    entity: z
      .string()
      .min(1)
      .describe(
        "Concrete code module reference entity: file path, component, tool, service, route, schema, table, class, or function.",
      ),
    problem: z
      .string()
      .min(1)
      .describe("Observed problem tied to that entity. Generic project improvement text is not a valid problem."),
  })
  .strict()

export const VisualQaUnresolvedCodeModuleProblemSchema = z
  .object({
    id: z.string().min(1),
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Visual QA check item IDs that exposed this unresolved module problem."),
    code_module_reference: VisualQaCodeModuleReferenceSchema,
    reason: z
      .string()
      .min(1)
      .describe(
        "Evidence-backed reason this code module problem must be repaired by the current workflow implementation owner before Visual QA can accept the surface.",
      ),
    blocker_ids: z.array(z.string().min(1)).min(1).describe("Production blocker IDs that expose this problem."),
    evidence_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
  })
  .strict()

export const VisualQaProblemDomRegionSchema = z
  .object({
    id: z.string().min(1),
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Visual QA check item IDs that localized this DOM region."),
    blocker_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Production blocker IDs exposed by this rendered Document Object Model (DOM) region."),
    region: z.string().min(1).describe("Human-readable rendered region name."),
    route: z.string().min(1).optional().describe("Rendered app route where this DOM region was observed."),
    viewport: VisualQaViewportSchema.optional(),
    locator: z.string().min(1).describe("Stable selector or locator expression for the problematic rendered DOM node."),
    dom_path: z.string().min(1).optional().describe("Concise path from the target node through relevant ancestors."),
    outer_html_excerpt: z.string().min(1).describe("Bounded HTML excerpt for the target DOM node."),
    ancestor_context: z
      .array(z.string().min(1))
      .default([])
      .describe("Nearby parent container summaries relevant to the visual defect."),
    sibling_context: z
      .array(z.string().min(1))
      .default([])
      .describe("Adjacent sibling summaries relevant to layout, spacing, or ordering."),
    text_content: z.string().optional(),
    role: z.string().optional(),
    accessible_name: z.string().optional(),
    bbox: VisualQaDomBoxSchema.optional().describe("Rendered CSS pixel box for the target DOM node."),
    computed_style: z
      .record(z.string(), z.string())
      .default({})
      .describe(
        "Selected computed style values such as display, position, margin, padding, font, color, overflow, width, and height.",
      ),
    attributes: z
      .record(z.string(), z.string())
      .default({})
      .describe("Repair-relevant id, class, data, ARIA, and role attributes."),
    code_search_terms: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Strings the current workflow implementation owner should grep first when mapping the DOM region to source code.",
      ),
    evidence_refs: z.array(VisualReviewEvidenceRefSchema).default([]),
    annotated_evidence_refs: z
      .array(VisualReviewEvidenceRefSchema)
      .default([])
      .describe(
        "Host-generated annotated screenshot refs with this Document Object Model (DOM) region's bbox, locator, blocker IDs, and repair hints drawn directly on the image.",
      ),
    notes: z.string().min(1).describe("Concise repair guidance tied to these DOM facts."),
  })
  .strict()

export const VisualQaEvidenceSchema = z
  .object({
    check_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Visual QA check item IDs supported by this evidence."),
    type: z.enum([
      "screenshot",
      "reference_comparison",
      "visual_diff",
      "text_diff",
      "console",
      "network",
      "command",
      "source_artifact",
      "other",
    ]),
    ref: VisualReviewEvidenceRefSchema.describe(
      "Exact artifact_read locator for evidence already published into the current Task catalog.",
    ),
    viewport: VisualQaViewportSchema.optional(),
    state: z.string().optional(),
    note: z.string().min(1),
  })
  .strict()

export const VisualQaReferenceComparisonEvidenceRefSchema = z
  .object(EngineArtifactLocatorSchema.shape)
  .strict()
  .describe("Exact Engine Artifact locator for a Browser Preview reference-comparison evidence envelope.")

export const VisualQaReferenceParitySchema = z
  .object({
    required: z.boolean().default(false),
    required_regions: z.array(VisualQaReferenceRegionKeySchema).default([]),
    reference_comparison_evidence_refs: z
      .array(VisualQaReferenceComparisonEvidenceRefSchema)
      .default([])
      .describe("Formal evidence refs for persisted reference-comparison evidence."),
    missing_regions: z.array(VisualQaReferenceRegionKeySchema).default([]),
    blocker_ids: z
      .array(z.string().min(1))
      .default([])
      .describe("Production blocker IDs explaining missing comparison evidence when accepted=false."),
  })
  .strict()

export const VisualReviewSchema = z
  .object({
    accepted: z
      .boolean()
      .optional()
      .describe("Optional reviewer judgment. Absence means the reviewer did not reach a verdict during this turn."),
    summary: z
      .string()
      .min(1)
      .optional()
      .describe("Optional reviewer summary. The visible final assistant message remains the narrative source."),
    check_items: z.array(VisualQaCheckItemSchema).default([]),
    coverage: z.array(VisualQaCoverageSchema).default([]),
    findings: z.array(VisualQaFindingSchema).default([]),
    production_blockers: z.array(VisualQaProductionBlockerSchema).default([]),
    unresolved_code_module_problems: z.array(VisualQaUnresolvedCodeModuleProblemSchema).default([]),
    problem_dom_regions: z.array(VisualQaProblemDomRegionSchema).default([]),
    evidence: z.array(VisualQaEvidenceSchema).default([]),
    reference_parity: VisualQaReferenceParitySchema.default({
      required: false,
      required_regions: [],
      reference_comparison_evidence_refs: [],
      missing_regions: [],
      blocker_ids: [],
    }),
    open_questions: z.array(z.string().min(1)).default([]),
    fact_check_items: FactCheckItemListSchema.default([]),
  })
  .strict()

export const VisualQaExecutionFailureToolSchema = z.discriminatedUnion("status", [
  z
    .object({
      call_id: z.string().min(1),
      tool: z.string().min(1),
      tool_ref: z.string().min(1),
      server_config_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      status: z.literal("completed_mcp_error"),
      input: z.unknown(),
      mcp_tool_result: z.object({ is_error: z.literal(true) }).strict(),
    })
    .strict(),
  z
    .object({
      call_id: z.string().min(1),
      tool: z.string().min(1),
      tool_ref: z.string().min(1),
      server_config_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      status: z.literal("thrown_error"),
      input: z.unknown(),
      failure: ToolFailureCause,
    })
    .strict(),
])

export const VisualQaExecutionFailureSchema = z
  .object({
    outcome: z.literal("execution_failed"),
    summary: z.string().min(1),
    failed_tool_calls: z.array(VisualQaExecutionFailureToolSchema).min(1),
    production_blocker: z
      .object({
        id: z.literal("visual-qa-execution-failed"),
        reason: z.string().min(1),
        impact: z.string().min(1),
        required_correction: z.string().min(1),
      })
      .strict(),
    runtime_owner_id: z.string().min(1),
    projection_hash: z.string().regex(/^[a-f0-9]{64}$/),
    attempt_id: z.string().min(1).optional(),
    failure_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export type VisualReview = z.infer<typeof VisualReviewSchema>
export type VisualQaExecutionFailure = z.infer<typeof VisualQaExecutionFailureSchema>
