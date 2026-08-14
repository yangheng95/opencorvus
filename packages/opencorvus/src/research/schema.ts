import { createHash } from "node:crypto"
import { z } from "zod"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

export const RESEARCH_VOLATILE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
export const RESEARCH_PROMPT_LIMITS = {
  summaryChars: 1800,
  itemChars: 600,
  evidenceItems: 40,
  factItems: 80,
  problemItems: 40,
  needItems: 40,
  constraintItems: 40,
  documentOutlineItems: 80,
  webpageContractItems: 80,
  openQuestionItems: 40,
} as const
export const RESEARCH_BUNDLE_LIMITS = {
  fullMarkdownChars: 200_000,
  evidenceJsonChars: 100_000,
  citationMapJsonChars: 100_000,
} as const

export const ResearchEvidenceRefSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["web", "code", "memory", "user"]),
    pointer: z.string().min(1),
    title: z.string().min(1),
    retrieved_at: z.string().min(1),
    reliability: z.enum(["primary", "secondary", "community", "unknown"]),
    excerpt: z.string().min(1).max(800),
    bundle_ref: z.string().min(1).optional(),
    volatile: z.boolean().default(false),
  })
  .transform((item) => ({
    ...item,
    bundle_ref: item.bundle_ref ?? `research-bundle.md#${item.id}`,
  }))
export type ResearchEvidenceRef = z.infer<typeof ResearchEvidenceRefSchema>

export const ResearchFactSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1),
})
export type ResearchFact = z.infer<typeof ResearchFactSchema>

export const ResearchInferenceSchema = z.object({
  id: z.string().min(1),
  inference: z.string().min(1),
  based_on_fact_ids: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
})
export type ResearchInference = z.infer<typeof ResearchInferenceSchema>

export const ResearchProblemStatementSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  fact_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchProblemStatement = z.infer<typeof ResearchProblemStatementSchema>

export const ResearchUserNeedSchema = z.object({
  id: z.string().min(1),
  need: z.string().min(1),
  fact_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchUserNeed = z.infer<typeof ResearchUserNeedSchema>

export const ResearchConstraintSchema = z.object({
  id: z.string().min(1),
  constraint: z.string().min(1),
  fact_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchConstraint = z.infer<typeof ResearchConstraintSchema>

export const ResearchDocumentSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchDocumentSection = z.infer<typeof ResearchDocumentSectionSchema>

const WebpageEvidenceBackedItemBase = z.object({
  id: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1),
})

export const ResearchWebpageFunctionalSurfaceSchema = WebpageEvidenceBackedItemBase.extend({
  title: z.string().min(1),
  user_visible_behavior: z.string().min(1),
  component_kind_hypothesis: z.string().min(1),
  required_interactions: z.array(z.string().min(1)).default([]),
})
export type ResearchWebpageFunctionalSurface = z.infer<typeof ResearchWebpageFunctionalSurfaceSchema>

export const ResearchWebpageVisualLayoutSchema = WebpageEvidenceBackedItemBase.extend({
  viewport: z.enum(["desktop", "tablet", "mobile", "responsive"]),
  region: z.string().min(1),
  layout_contract: z.string().min(1),
  spacing_and_alignment: z.string().min(1),
})
export type ResearchWebpageVisualLayout = z.infer<typeof ResearchWebpageVisualLayoutSchema>

export const ResearchWebpageStyleRequirementSchema = WebpageEvidenceBackedItemBase.extend({
  token_or_selector: z.string().min(1),
  requirement: z.string().min(1),
})
export type ResearchWebpageStyleRequirement = z.infer<typeof ResearchWebpageStyleRequirementSchema>

export const ResearchWebpageInteractionStateSchema = WebpageEvidenceBackedItemBase.extend({
  component: z.string().min(1),
  state: z.string().min(1),
  behavior: z.string().min(1),
})
export type ResearchWebpageInteractionState = z.infer<typeof ResearchWebpageInteractionStateSchema>

export const ResearchWebpageDataInventorySchema = WebpageEvidenceBackedItemBase.extend({
  surface: z.string().min(1),
  content_contract: z.string().min(1),
})
export type ResearchWebpageDataInventory = z.infer<typeof ResearchWebpageDataInventorySchema>

export const ResearchWebpageAcceptanceCriterionSchema = WebpageEvidenceBackedItemBase.extend({
  target: z.string().min(1),
  criterion: z.string().min(1),
})
export type ResearchWebpageAcceptanceCriterion = z.infer<typeof ResearchWebpageAcceptanceCriterionSchema>

export const ResearchWebpageFidelityRiskSchema = WebpageEvidenceBackedItemBase.extend({
  risk: z.string().min(1),
  impact: z.string().min(1),
})
export type ResearchWebpageFidelityRisk = z.infer<typeof ResearchWebpageFidelityRiskSchema>

export const ResearchWebpageContractSchema = z.object({
  source_url: z.string().min(1),
  reference_image_evidence_ids: z.array(z.string().min(1)).default([]),
  functional_surfaces: z.array(ResearchWebpageFunctionalSurfaceSchema).min(1),
  visual_layout: z.array(ResearchWebpageVisualLayoutSchema).min(1),
  style_requirements: z.array(ResearchWebpageStyleRequirementSchema).min(1),
  interaction_states: z.array(ResearchWebpageInteractionStateSchema).default([]),
  data_content_inventory: z.array(ResearchWebpageDataInventorySchema).min(1),
  fidelity_acceptance: z.array(ResearchWebpageAcceptanceCriterionSchema).min(1),
  fidelity_risks: z.array(ResearchWebpageFidelityRiskSchema).default([]),
})
export type ResearchWebpageContract = z.infer<typeof ResearchWebpageContractSchema>

export const ResearchSubpageTaskSchema = z.object({
  id: z.string().min(1),
  parent_url: z.string().min(1),
  url: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  suggested_focus: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  evidence_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchSubpageTask = z.infer<typeof ResearchSubpageTaskSchema>

export const ResearchOpenQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  blocking: z.boolean().default(false),
  related_fact_ids: z.array(z.string().min(1)).default([]),
})
export type ResearchOpenQuestion = z.infer<typeof ResearchOpenQuestionSchema>

export const ResearchScopeSchema = z.object({
  user_goal: z.string().min(1),
  deliverable_type: z.enum(["prd", "spec", "research_report", "implementation_input", "mixed"]),
  audience: z.string().min(1),
  explicit_non_goals: z.array(z.string()).default([]),
  assumed_non_goals: z.array(z.string()).default([]),
})
export type ResearchScope = z.infer<typeof ResearchScopeSchema>

export const ResearchBriefSchema = z.object({
  metadata: z.object({
    research_session_id: z.string().min(1),
    created_for_message_id: z.string().min(1),
    request_hash: z.string().min(1),
    source_digest: z.string().min(1),
    created_at: z.string().min(1),
    stale_after: z.string().optional(),
  }),
  scope: ResearchScopeSchema,
  bundle: z.object({
    full_markdown_path: z.string().min(1),
    evidence_json_path: z.string().min(1),
    citation_map_path: z.string().min(1),
  }),
  summary: z.string().min(1),
  evidence_index: z.array(ResearchEvidenceRefSchema),
  facts: z.array(ResearchFactSchema),
  inferences: z.array(ResearchInferenceSchema),
  problem_statements: z.array(ResearchProblemStatementSchema),
  user_needs: z.array(ResearchUserNeedSchema),
  constraints: z.array(ResearchConstraintSchema),
  document_outline: z.array(ResearchDocumentSectionSchema),
  webpage_contract: ResearchWebpageContractSchema.optional(),
  subpage_research_tasks: z.array(ResearchSubpageTaskSchema).default([]),
  open_questions: z.array(ResearchOpenQuestionSchema),
})
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>

export const ResearchBundleSchema = z.object({
  full_markdown: z.string().min(1).max(RESEARCH_BUNDLE_LIMITS.fullMarkdownChars),
  evidence_json: z.string().min(1).max(RESEARCH_BUNDLE_LIMITS.evidenceJsonChars),
  citation_map_json: z.string().min(1).max(RESEARCH_BUNDLE_LIMITS.citationMapJsonChars),
})
export type ResearchBundle = z.infer<typeof ResearchBundleSchema>

const ResearchBundleLine = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]+$/, "must be single-line text; split multiline notes into multiple array items")

export const ResearchBundleMarkdownSectionSchema = z.object({
  title: ResearchBundleLine(160),
  evidence_ids: z.array(z.string().min(1)).default([]),
  points: z.array(ResearchBundleLine(1200)).min(1).max(80),
})
export type ResearchBundleMarkdownSection = z.infer<typeof ResearchBundleMarkdownSectionSchema>

export const ResearchBundleEvidenceNoteSchema = z.object({
  evidence_id: z.string().min(1),
  observations: z.array(ResearchBundleLine(1200)).min(1).max(80),
  artifact_refs: z.array(ResearchBundleLine(500)).default([]),
})
export type ResearchBundleEvidenceNote = z.infer<typeof ResearchBundleEvidenceNoteSchema>

export const ResearchBundleCitationEntrySchema = z.object({
  claim_id: ResearchBundleLine(160).describe(
    "Bundle-local citation key for the cited claim. It may match a structured brief item id, but does not have to.",
  ),
  evidence_ids: z.array(z.string().min(1)).min(1),
  pointer: ResearchBundleLine(500),
  usage: ResearchBundleLine(1200),
})
export type ResearchBundleCitationEntry = z.infer<typeof ResearchBundleCitationEntrySchema>

export const ResearchBundleInputSchema = z.object({
  full_markdown_sections: z.array(ResearchBundleMarkdownSectionSchema).min(1).max(80),
  evidence_notes: z.array(ResearchBundleEvidenceNoteSchema).min(1).max(160),
  citation_map: z.array(ResearchBundleCitationEntrySchema).min(1).max(240),
})
export type ResearchBundleInput = z.infer<typeof ResearchBundleInputSchema>

export type ResearchStaleness = {
  stale: boolean
  reasons: string[]
}

function ensureUnique(ids: string[], label: string): string | undefined {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return `${label} id "${id}" is duplicated.`
    seen.add(id)
  }
  return undefined
}

function ensureRefs(ids: string[], known: Set<string>, label: string): string | undefined {
  const missing = ids.filter((id) => !known.has(id))
  if (missing.length > 0) return `${label} references unknown id(s): ${missing.join(", ")}.`
  return undefined
}

function collectUniqueError(errors: string[], ids: string[], label: string): void {
  const err = ensureUnique(ids, label)
  if (err) errors.push(err)
}

function collectRefError(errors: string[], ids: string[], known: Set<string>, label: string): void {
  const err = ensureRefs(ids, known, label)
  if (err) errors.push(err)
}

export function validateResearchBriefSemantics(brief: ResearchBrief): string | undefined {
  const evidenceIDs = new Set(brief.evidence_index.map((item) => item.id))
  const factIDs = new Set(brief.facts.map((item) => item.id))
  const errors: string[] = []

  collectUniqueError(
    errors,
    brief.evidence_index.map((item) => item.id),
    "evidence",
  )
  collectUniqueError(
    errors,
    brief.facts.map((item) => item.id),
    "fact",
  )
  collectUniqueError(
    errors,
    brief.inferences.map((item) => item.id),
    "inference",
  )
  collectUniqueError(
    errors,
    brief.problem_statements.map((item) => item.id),
    "problem_statement",
  )
  collectUniqueError(
    errors,
    brief.user_needs.map((item) => item.id),
    "user_need",
  )
  collectUniqueError(
    errors,
    brief.constraints.map((item) => item.id),
    "constraint",
  )
  collectUniqueError(
    errors,
    brief.document_outline.map((item) => item.id),
    "document_outline",
  )
  const webpageUniqueError = ensureWebpageContractUniqueIDs(brief.webpage_contract)
  if (webpageUniqueError) errors.push(webpageUniqueError)
  collectUniqueError(
    errors,
    brief.subpage_research_tasks.map((item) => item.id),
    "subpage_research_task",
  )
  collectUniqueError(
    errors,
    brief.open_questions.map((item) => item.id),
    "open_question",
  )

  for (const fact of brief.facts) {
    collectRefError(errors, fact.evidence_ids, evidenceIDs, `fact ${fact.id}.evidence_ids`)
  }
  for (const inference of brief.inferences) {
    collectRefError(errors, inference.based_on_fact_ids, factIDs, `inference ${inference.id}.based_on_fact_ids`)
  }
  for (const item of brief.problem_statements) {
    collectRefError(errors, item.fact_ids, factIDs, `problem_statement ${item.id}.fact_ids`)
  }
  for (const item of brief.user_needs) {
    collectRefError(errors, item.fact_ids, factIDs, `user_need ${item.id}.fact_ids`)
  }
  for (const item of brief.constraints) {
    collectRefError(errors, item.fact_ids, factIDs, `constraint ${item.id}.fact_ids`)
  }
  for (const item of brief.document_outline) {
    collectRefError(errors, item.evidence_ids, evidenceIDs, `document_outline ${item.id}.evidence_ids`)
  }
  const webpageContractError = ensureWebpageContractRefs(brief.webpage_contract, evidenceIDs)
  if (webpageContractError) errors.push(webpageContractError)
  for (const item of brief.subpage_research_tasks) {
    collectRefError(errors, item.evidence_ids, evidenceIDs, `subpage_research_task ${item.id}.evidence_ids`)
  }
  for (const item of brief.open_questions) {
    collectRefError(errors, item.related_fact_ids, factIDs, `open_question ${item.id}.related_fact_ids`)
  }
  return errors.length > 0 ? errors.join("\n") : undefined
}

function ensureWebpageContractUniqueIDs(contract: ResearchWebpageContract | undefined): string | undefined {
  if (!contract) return undefined
  return (
    ensureUnique(
      contract.functional_surfaces.map((item) => item.id),
      "webpage_contract.functional_surface",
    ) ??
    ensureUnique(
      contract.visual_layout.map((item) => item.id),
      "webpage_contract.visual_layout",
    ) ??
    ensureUnique(
      contract.style_requirements.map((item) => item.id),
      "webpage_contract.style_requirement",
    ) ??
    ensureUnique(
      contract.interaction_states.map((item) => item.id),
      "webpage_contract.interaction_state",
    ) ??
    ensureUnique(
      contract.data_content_inventory.map((item) => item.id),
      "webpage_contract.data_content_inventory",
    ) ??
    ensureUnique(
      contract.fidelity_acceptance.map((item) => item.id),
      "webpage_contract.fidelity_acceptance",
    ) ??
    ensureUnique(
      contract.fidelity_risks.map((item) => item.id),
      "webpage_contract.fidelity_risk",
    )
  )
}

function ensureWebpageContractRefs(
  contract: ResearchWebpageContract | undefined,
  evidenceIDs: Set<string>,
): string | undefined {
  if (!contract) return undefined
  const errors: string[] = []
  collectRefError(
    errors,
    contract.reference_image_evidence_ids,
    evidenceIDs,
    "webpage_contract.reference_image_evidence_ids",
  )
  for (const item of contract.functional_surfaces) {
    collectRefError(
      errors,
      item.evidence_ids,
      evidenceIDs,
      `webpage_contract.functional_surface ${item.id}.evidence_ids`,
    )
  }
  for (const item of contract.visual_layout) {
    collectRefError(errors, item.evidence_ids, evidenceIDs, `webpage_contract.visual_layout ${item.id}.evidence_ids`)
  }
  for (const item of contract.style_requirements) {
    collectRefError(
      errors,
      item.evidence_ids,
      evidenceIDs,
      `webpage_contract.style_requirement ${item.id}.evidence_ids`,
    )
  }
  for (const item of contract.interaction_states) {
    collectRefError(
      errors,
      item.evidence_ids,
      evidenceIDs,
      `webpage_contract.interaction_state ${item.id}.evidence_ids`,
    )
  }
  for (const item of contract.data_content_inventory) {
    collectRefError(
      errors,
      item.evidence_ids,
      evidenceIDs,
      `webpage_contract.data_content_inventory ${item.id}.evidence_ids`,
    )
  }
  for (const item of contract.fidelity_acceptance) {
    collectRefError(
      errors,
      item.evidence_ids,
      evidenceIDs,
      `webpage_contract.fidelity_acceptance ${item.id}.evidence_ids`,
    )
  }
  for (const item of contract.fidelity_risks) {
    collectRefError(errors, item.evidence_ids, evidenceIDs, `webpage_contract.fidelity_risk ${item.id}.evidence_ids`)
  }
  return errors.length > 0 ? errors.join("\n") : undefined
}

export function validateResearchBriefIntegrity(brief: ResearchBrief): string | undefined {
  const semanticError = validateResearchBriefSemantics(brief)
  if (semanticError) return semanticError

  const expectedDigest = researchSourceDigest(brief.evidence_index)
  if (brief.metadata.source_digest !== expectedDigest) {
    return `source_digest mismatch: expected ${expectedDigest}.`
  }

  const bundlePaths = [brief.bundle.full_markdown_path, brief.bundle.evidence_json_path, brief.bundle.citation_map_path]
  const runtimePrefix = `${ProjectRuntimePaths.relativeRuntimeRoot()}/`
  for (const bundlePath of bundlePaths) {
    const normalized = bundlePath.replaceAll("\\", "/")
    if (
      normalized.startsWith("/") ||
      normalized.includes("..") ||
      !normalized.startsWith(runtimePrefix)
    ) {
      return `bundle path is outside the task research runtime boundary: ${bundlePath}.`
    }
  }
  return undefined
}

export function validateResearchBriefTaskBoundary(brief: ResearchBrief, taskID: string): string | undefined {
  const expectedPrefixes = [
    `${ProjectRuntimePaths.taskRelative(taskID, "research", "deep")}/`,
    `${ProjectRuntimePaths.taskRelative(taskID, "research", "frontend")}/`,
  ]
  const bundlePaths = [brief.bundle.full_markdown_path, brief.bundle.evidence_json_path, brief.bundle.citation_map_path]
  for (const bundlePath of bundlePaths) {
    const normalized = bundlePath.replaceAll("\\", "/")
    if (!expectedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return `bundle path does not belong to task ${taskID}: ${bundlePath}.`
    }
  }
  return undefined
}

export function researchRequestHash(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export function researchSourceDigest(evidence: ResearchEvidenceRef[]): string {
  const normalized = evidence
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      pointer: item.pointer,
      title: item.title,
      retrieved_at: item.retrieved_at,
      reliability: item.reliability,
      volatile: item.volatile,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}
