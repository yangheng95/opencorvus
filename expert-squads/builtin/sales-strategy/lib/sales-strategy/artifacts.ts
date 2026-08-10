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
const stageSchema = <T extends string, D extends ReturnType<typeof tool.schema.object>>(_type: T, details: D) =>
  tool.schema.object({
    as_of_date: nonempty,
    summary: nonempty,
    evidence: tool.schema.array(EvidenceSchema),
    findings: tool.schema.array(FindingSchema),
    actions: tool.schema.array(ActionSchema),
    unknowns: distinctStrings,
    details,
  }).strict()

export const SalesStrategyArtifactSchemas = {
  "sales-strategy/research-charter": stageSchema("sales-strategy/research-charter", tool.schema.object({ objective: nonempty, audience: nonempty, scope: distinctStrings, decision_questions: distinctStrings, source_policy: distinctStrings, stopping_conditions: distinctStrings }).strict()),
  "sales-strategy/customer-dossier": stageSchema("sales-strategy/customer-dossier", tool.schema.object({ sources: tool.schema.array(EvidenceSchema).min(1), coverage: distinctStrings, data_quality: distinctStrings, conflicts: distinctStrings, gaps: distinctStrings }).strict()),
  "sales-strategy/opportunity-analysis": stageSchema("sales-strategy/opportunity-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "sales-strategy/positioning-analysis": stageSchema("sales-strategy/positioning-analysis", tool.schema.object({ analytical_frame: nonempty, comparisons: distinctStrings, calculations: distinctStrings, implications: distinctStrings }).strict()),
  "sales-strategy/strategy-brief": stageSchema("sales-strategy/strategy-brief", tool.schema.object({ priorities: distinctStrings, tradeoffs: distinctStrings, recommended_sequence: distinctStrings, measurement_plan: distinctStrings }).strict()),
  "sales-strategy/audit": stageSchema("sales-strategy/audit", tool.schema.object({ audited_claims: distinctStrings, numerical_checks: distinctStrings, source_checks: distinctStrings, required_corrections: distinctStrings, publication_guidance: nonempty }).strict()),
  "sales-strategy/playbook": stageSchema("sales-strategy/playbook", tool.schema.object({ title: nonempty, sections: distinctStrings, audit_resolution: distinctStrings, markdown_path: nonempty, interactive_renderer: tool.schema.literal("document@1") }).strict()),
} as const

export const SalesStrategyArtifactLabels = {
  "sales-strategy/research-charter": "Sales research charter",
  "sales-strategy/customer-dossier": "Customer research dossier",
  "sales-strategy/opportunity-analysis": "Sales opportunity analysis",
  "sales-strategy/positioning-analysis": "Sales positioning analysis",
  "sales-strategy/strategy-brief": "Sales strategy brief",
  "sales-strategy/audit": "Sales strategy audit",
  "sales-strategy/playbook": "Sales strategy playbook",
} as const

export const SalesStrategyArtifactTypeSchema = tool.schema.enum(["sales-strategy/research-charter", "sales-strategy/customer-dossier", "sales-strategy/opportunity-analysis", "sales-strategy/positioning-analysis", "sales-strategy/strategy-brief", "sales-strategy/audit", "sales-strategy/playbook"])
export type SalesStrategyArtifactType = tool.schema.infer<typeof SalesStrategyArtifactTypeSchema>
export const SALESSTRATEGY_TERMINAL_ARTIFACT_TYPE = "sales-strategy/playbook"

export function parseSalesStrategyArtifact(type: SalesStrategyArtifactType, payload: unknown) {
  SalesStrategyArtifactTypeSchema.parse(type)
  return SalesStrategyArtifactSchemas[type].parse(payload)
}
