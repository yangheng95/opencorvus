// ABI means Application Binary Interface. JSON means JavaScript Object Notation.
// URL means Uniform Resource Locator.

import { tool } from "@opencorvus-ai/plugin"

const nonempty = tool.schema.string().trim().min(1)
const distinctStrings = tool.schema.array(nonempty).refine(
  (values) => new Set(values).size === values.length,
  "values must be unique",
)
const EvidenceSchema = tool.schema.object({
  id: nonempty,
  source: nonempty,
  observed_at: nonempty,
  statement: nonempty,
  limitation: nonempty.nullable(),
}).strict()
const FindingSchema = tool.schema.object({
  claim: nonempty,
  method: nonempty,
  result: nonempty,
  evidence_ids: distinctStrings,
  confidence: tool.schema.enum(["high", "medium", "low"]),
}).strict()
const ActionSchema = tool.schema.object({
  action: nonempty,
  rationale: nonempty,
  owner: nonempty,
  timing: nonempty,
  success_measure: nonempty,
}).strict()
const stageSchema = <T extends string, D extends ReturnType<typeof tool.schema.object>>(type: T, details: D) =>
  tool.schema.object({
    artifact_type: tool.schema.literal(type),
    as_of_date: nonempty,
    summary: nonempty,
    evidence: tool.schema.array(EvidenceSchema),
    findings: tool.schema.array(FindingSchema),
    actions: tool.schema.array(ActionSchema),
    unknowns: distinctStrings,
    details,
  }).strict()

export const DataAnalysisArtifactSchemas = {
  "data-analysis/analysis-charter": stageSchema("data-analysis/analysis-charter", tool.schema.object({ objective: nonempty, audience: nonempty, scope: distinctStrings, decision_questions: distinctStrings, source_policy: distinctStrings, stopping_conditions: distinctStrings }).strict()),
  "data-analysis/data-dossier": stageSchema("data-analysis/data-dossier", tool.schema.object({ sources: tool.schema.array(EvidenceSchema).min(1), coverage: distinctStrings, data_quality: distinctStrings, conflicts: distinctStrings, gaps: distinctStrings }).strict()),
  "data-analysis/performance-analysis": stageSchema("data-analysis/performance-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "data-analysis/segment-analysis": stageSchema("data-analysis/segment-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "data-analysis/insight-brief": stageSchema("data-analysis/insight-brief", tool.schema.object({ priorities: distinctStrings, tradeoffs: distinctStrings, recommended_sequence: distinctStrings, measurement_plan: distinctStrings }).strict()),
  "data-analysis/audit": stageSchema("data-analysis/audit", tool.schema.object({ audited_claims: distinctStrings, numerical_checks: distinctStrings, source_checks: distinctStrings, required_corrections: distinctStrings, publication_guidance: nonempty }).strict()),
  "data-analysis/report": stageSchema("data-analysis/report", tool.schema.object({ title: nonempty, sections: distinctStrings, audit_resolution: distinctStrings, markdown_path: nonempty, interactive_renderer: tool.schema.literal("document@1") }).strict()),
} as const

export const DataAnalysisArtifactLabels = {
  "data-analysis/analysis-charter": "Data analysis charter",
  "data-analysis/data-dossier": "Data analysis dossier",
  "data-analysis/performance-analysis": "Performance analysis",
  "data-analysis/segment-analysis": "Segment analysis",
  "data-analysis/insight-brief": "Operating insight brief",
  "data-analysis/audit": "Data analysis audit",
  "data-analysis/report": "Operating insight report",
} as const

export const DataAnalysisArtifactTypeSchema = tool.schema.enum(["data-analysis/analysis-charter", "data-analysis/data-dossier", "data-analysis/performance-analysis", "data-analysis/segment-analysis", "data-analysis/insight-brief", "data-analysis/audit", "data-analysis/report"])
export type DataAnalysisArtifactType = tool.schema.infer<typeof DataAnalysisArtifactTypeSchema>
export const DATAANALYSIS_TERMINAL_ARTIFACT_TYPE = "data-analysis/report"

export function parseDataAnalysisArtifact(type: DataAnalysisArtifactType, payload: unknown) {
  return DataAnalysisArtifactSchemas[type].parse(payload)
}
