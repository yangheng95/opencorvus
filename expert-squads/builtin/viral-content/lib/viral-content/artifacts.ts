// ABI means Application Binary Interface. URL means Uniform Resource Locator.

import { tool } from "@opencorvus-ai/plugin"

export const VIRAL_CONTENT_WORKFLOW_ID = "evidence-backed-content-campaign"
export const VIRAL_CONTENT_SCHEMA_VERSION = 1

const nonempty = tool.schema.string().trim().min(1)
const urlList = tool.schema.array(tool.schema.string().trim().url())
const distinctNonempty = tool.schema.array(nonempty).refine((values) => new Set(values).size === values.length, "values must be unique")

const CampaignBriefSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  campaign_name: nonempty,
  goal: nonempty,
  audience_hypotheses: distinctNonempty.min(1),
  offer: nonempty,
  channels: distinctNonempty.min(1),
  constraints: distinctNonempty,
  evidence_questions: distinctNonempty.min(1),
  success_hypotheses: distinctNonempty.min(1),
}).strict()

const AudienceDossierSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  segments: tool.schema.array(tool.schema.object({ name: nonempty, need: nonempty, evidence_urls: urlList.min(1) }).strict()).min(1),
  tensions: distinctNonempty.min(1),
  language_patterns: distinctNonempty.min(1),
  unknowns: distinctNonempty,
}).strict()

const TrendDossierSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  observed_patterns: tool.schema.array(tool.schema.object({ pattern: nonempty, evidence_urls: urlList.min(1), observed_at: nonempty }).strict()).min(1),
  lifecycle_assessment: nonempty,
  imitation_risks: distinctNonempty,
  unknowns: distinctNonempty,
}).strict()

const ConceptSetSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  concepts: tool.schema.array(tool.schema.object({ id: nonempty, hook: nonempty, promise: nonempty, proof_points: distinctNonempty.min(1), distribution_hypothesis: nonempty, why_now: nonempty }).strict()).min(2),
  selected_id: nonempty,
  selection_rationale: nonempty,
}).strict().refine((value) => value.concepts.some((concept) => concept.id === value.selected_id), "selected_id must name one concept")

const CopyPackSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  concept_id: nonempty,
  title: nonempty,
  long_form_markdown: nonempty,
  short_variants: tool.schema.array(tool.schema.object({ channel: nonempty, copy: nonempty, call_to_action: nonempty }).strict()).min(1),
  claim_source_map: tool.schema.array(tool.schema.object({ claim: nonempty, source_urls: urlList.min(1) }).strict()),
  disclosed_inferences: distinctNonempty,
  unresolved_claims: distinctNonempty,
}).strict()

const ReviewSchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  verdict: tool.schema.enum(["approved", "revision-required"]),
  checks: tool.schema.array(tool.schema.object({ area: nonempty, result: tool.schema.enum(["pass", "revise"]), finding: nonempty, correction: nonempty.nullable() }).strict()).min(1),
  required_corrections: distinctNonempty,
  accepted_limitations: distinctNonempty,
  publication_guidance: nonempty,
}).strict()

const DeliverySchema = tool.schema.object({
  workflow_id: tool.schema.literal(VIRAL_CONTENT_WORKFLOW_ID),
  campaign_name: nonempty,
  canonical_markdown_path: nonempty,
  canonical_json_path: nonempty,
  included_assets: distinctNonempty.min(2),
  copy_count: tool.schema.number().int().positive(),
  review_resolution: distinctNonempty,
  release_boundary: nonempty,
}).strict()

export const ViralContentArtifactSchemas = {
  "viral-content/campaign-brief": CampaignBriefSchema,
  "viral-content/audience-dossier": AudienceDossierSchema,
  "viral-content/trend-dossier": TrendDossierSchema,
  "viral-content/concept-set": ConceptSetSchema,
  "viral-content/copy-pack": CopyPackSchema,
  "viral-content/review": ReviewSchema,
  "viral-content/delivery": DeliverySchema,
} as const

export const ViralContentArtifactTypeSchema = tool.schema.enum(Object.keys(ViralContentArtifactSchemas) as [keyof typeof ViralContentArtifactSchemas, ...(keyof typeof ViralContentArtifactSchemas)[]])
export type ViralContentArtifactType = tool.schema.infer<typeof ViralContentArtifactTypeSchema>

export function parseViralContentArtifact(type: ViralContentArtifactType, payload: unknown) {
  return ViralContentArtifactSchemas[type].parse(payload)
}
