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

export const HrOperationsArtifactSchemas = {
  "hr-operations/operating-charter": stageSchema("hr-operations/operating-charter", tool.schema.object({ objective: nonempty, audience: nonempty, scope: distinctStrings, decision_questions: distinctStrings, source_policy: distinctStrings, stopping_conditions: distinctStrings }).strict()),
  "hr-operations/evidence-dossier": stageSchema("hr-operations/evidence-dossier", tool.schema.object({ sources: tool.schema.array(EvidenceSchema).min(1), coverage: distinctStrings, data_quality: distinctStrings, conflicts: distinctStrings, gaps: distinctStrings }).strict()),
  "hr-operations/workforce-analysis": stageSchema("hr-operations/workforce-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "hr-operations/process-analysis": stageSchema("hr-operations/process-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "hr-operations/operating-plan-draft": stageSchema("hr-operations/operating-plan-draft", tool.schema.object({ priorities: distinctStrings, tradeoffs: distinctStrings, recommended_sequence: distinctStrings, measurement_plan: distinctStrings }).strict()),
  "hr-operations/audit": stageSchema("hr-operations/audit", tool.schema.object({ audited_claims: distinctStrings, numerical_checks: distinctStrings, source_checks: distinctStrings, required_corrections: distinctStrings, publication_guidance: nonempty }).strict()),
  "hr-operations/operating-plan": stageSchema("hr-operations/operating-plan", tool.schema.object({ title: nonempty, sections: distinctStrings, audit_resolution: distinctStrings, markdown_path: nonempty, interactive_renderer: tool.schema.literal("document@1") }).strict()),
} as const

export const HrOperationsArtifactLabels = {
  "hr-operations/operating-charter": "Human Resources operating charter",
  "hr-operations/evidence-dossier": "Human Resources evidence dossier",
  "hr-operations/workforce-analysis": "Aggregate workforce analysis",
  "hr-operations/process-analysis": "People process analysis",
  "hr-operations/operating-plan-draft": "Organization operating-plan draft",
  "hr-operations/audit": "Human Resources operating-plan audit",
  "hr-operations/operating-plan": "Human Resources operating plan",
} as const

export const HrOperationsArtifactTypeSchema = tool.schema.enum(["hr-operations/operating-charter", "hr-operations/evidence-dossier", "hr-operations/workforce-analysis", "hr-operations/process-analysis", "hr-operations/operating-plan-draft", "hr-operations/audit", "hr-operations/operating-plan"])
export type HrOperationsArtifactType = tool.schema.infer<typeof HrOperationsArtifactTypeSchema>
export const HROPERATIONS_TERMINAL_ARTIFACT_TYPE = "hr-operations/operating-plan"

export function parseHrOperationsArtifact(type: HrOperationsArtifactType, payload: unknown) {
  return HrOperationsArtifactSchemas[type].parse(payload)
}
