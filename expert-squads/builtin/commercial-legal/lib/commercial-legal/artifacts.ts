// ABI means Application Binary Interface. URL means Uniform Resource Locator.

import { tool } from "@opencorvus-ai/plugin"

export const COMMERCIAL_LEGAL_SCHEMA_VERSION = 1
export const COMMERCIAL_LEGAL_WORKFLOW_ID = "commercial-legal-review"

const nonempty = tool.schema.string().trim().min(1)
const distinctStrings = tool.schema.array(nonempty).refine((values) => new Set(values).size === values.length, "values must be unique")
const nonemptyDistinctStrings = distinctStrings.min(1)
const date = tool.schema.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD")
const riskLevel = tool.schema.enum(["critical", "high", "medium", "low"])

const AuthorityRecordSchema = tool.schema.object({
  id: nonempty,
  title: nonempty,
  issuer: nonempty,
  jurisdiction: nonempty,
  authority_level: nonempty,
  status: nonempty,
  effective_date: date,
  url: tool.schema.string().trim().url(),
  supported_propositions: nonemptyDistinctStrings,
  limitations: distinctStrings,
}).strict()

const RiskRecordSchema = tool.schema.object({
  id: nonempty,
  subject: nonempty,
  risk_level: riskLevel,
  factual_basis: nonemptyDistinctStrings,
  authority_ids: nonemptyDistinctStrings,
  consequence: nonempty,
  recommendation: nonempty,
  residual_risk: nonempty,
}).strict()

export const CommercialLegalArtifactSchemas = {
  "commercial-legal/matter-charter": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    matter: tool.schema.object({
      client_position: nonempty,
      counterparties: nonemptyDistinctStrings,
      jurisdictions: nonemptyDistinctStrings,
      as_of_date: date,
      transaction: nonempty,
      documents: nonemptyDistinctStrings,
      decision_context: nonempty,
    }).strict(),
    questions: nonemptyDistinctStrings,
    source_policy: nonemptyDistinctStrings,
    materiality_rules: nonemptyDistinctStrings,
    deliverable_sections: nonemptyDistinctStrings,
    assumptions: distinctStrings,
    unknowns: distinctStrings,
  }).strict(),
  "commercial-legal/authority-dossier": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    as_of_date: date,
    authorities: tool.schema.array(AuthorityRecordSchema).min(1),
    document_clauses: tool.schema.array(tool.schema.object({
      document: nonempty,
      clause_id: nonempty,
      heading: nonempty,
      text: nonempty,
      parties_affected: nonemptyDistinctStrings,
    }).strict()).min(1),
    factual_record: nonemptyDistinctStrings,
    conflicts: distinctStrings,
    evidence_gaps: distinctStrings,
  }).strict(),
  "commercial-legal/contract-analysis": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    clause_assessments: tool.schema.array(tool.schema.object({
      document: nonempty,
      clause_id: nonempty,
      issue: nonempty,
      rule: nonempty,
      application: nonempty,
      conclusion: nonempty,
      authority_ids: nonemptyDistinctStrings,
      risk_level: riskLevel,
      recommendation: nonempty,
      proposed_language: nonempty,
    }).strict()).min(1),
    cross_clause_conflicts: distinctStrings,
    assumptions: distinctStrings,
    unresolved_questions: distinctStrings,
  }).strict(),
  "commercial-legal/regulatory-analysis": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    domains: tool.schema.array(tool.schema.object({
      domain: nonempty,
      applicability: tool.schema.enum(["applicable", "not-applicable", "uncertain"]),
      factual_basis: nonemptyDistinctStrings,
      authority_ids: nonemptyDistinctStrings,
      obligations: distinctStrings,
      exposure: distinctStrings,
      actions: distinctStrings,
    }).strict()).min(1),
    cross_domain_dependencies: distinctStrings,
    evidence_gaps: distinctStrings,
  }).strict(),
  "commercial-legal/legal-strategy": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    executive_position: nonempty,
    priority_risks: tool.schema.array(RiskRecordSchema).min(1),
    proposed_revisions: tool.schema.array(tool.schema.object({
      document: nonempty,
      clause_id: nonempty,
      current_effect: nonempty,
      proposed_language: nonempty,
      rationale: nonempty,
      authority_ids: nonemptyDistinctStrings,
    }).strict()).min(1),
    negotiation_positions: tool.schema.array(tool.schema.object({
      issue: nonempty,
      preferred_position: nonempty,
      alternative_position: nonempty,
      walk_away_condition: nonempty,
    }).strict()).min(1),
    signing_actions: tool.schema.array(tool.schema.object({ action: nonempty, owner: nonempty, due: nonempty }).strict()).min(1),
    residual_risks: nonemptyDistinctStrings,
    disclaimer: nonempty,
  }).strict(),
  "commercial-legal/audit": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    reviewed_artifact_type: tool.schema.literal("commercial-legal/legal-strategy"),
    checks: tool.schema.array(tool.schema.object({
      subject: nonempty,
      result: tool.schema.enum(["verified", "correction-required", "limited"]),
      evidence: nonemptyDistinctStrings,
      explanation: nonempty,
    }).strict()).min(1),
    required_corrections: distinctStrings,
    accepted_limitations: distinctStrings,
    coverage_summary: nonempty,
    publication_guidance: nonempty,
  }).strict(),
  "commercial-legal/report": tool.schema.object({
    workflow_id: tool.schema.literal(COMMERCIAL_LEGAL_WORKFLOW_ID),
    title: nonempty,
    as_of_date: date,
    jurisdictions: nonemptyDistinctStrings,
    executive_summary: nonempty,
    section_inventory: nonemptyDistinctStrings,
    citation_count: tool.schema.number().int().nonnegative(),
    audit_resolution: nonemptyDistinctStrings,
    markdown_path: tool.schema.literal("artifacts/commercial-legal/report.md"),
    disclaimer: nonempty,
  }).strict(),
} as const

export type CommercialLegalArtifactType = keyof typeof CommercialLegalArtifactSchemas
export const CommercialLegalArtifactTypeSchema = tool.schema.enum(Object.keys(CommercialLegalArtifactSchemas) as [CommercialLegalArtifactType, ...CommercialLegalArtifactType[]])

export const CommercialLegalPublishableArtifactInputSchema = tool.schema.discriminatedUnion("artifact_type", [
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/matter-charter"), payload: CommercialLegalArtifactSchemas["commercial-legal/matter-charter"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/authority-dossier"), payload: CommercialLegalArtifactSchemas["commercial-legal/authority-dossier"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/contract-analysis"), payload: CommercialLegalArtifactSchemas["commercial-legal/contract-analysis"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/regulatory-analysis"), payload: CommercialLegalArtifactSchemas["commercial-legal/regulatory-analysis"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/legal-strategy"), payload: CommercialLegalArtifactSchemas["commercial-legal/legal-strategy"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/audit"), payload: CommercialLegalArtifactSchemas["commercial-legal/audit"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("commercial-legal/report"), payload: CommercialLegalArtifactSchemas["commercial-legal/report"] }).strict(),
])

export function parseCommercialLegalArtifact<T extends CommercialLegalArtifactType>(artifactType: T, payload: unknown): tool.schema.infer<(typeof CommercialLegalArtifactSchemas)[T]> {
  return CommercialLegalArtifactSchemas[artifactType].parse(payload) as tool.schema.infer<(typeof CommercialLegalArtifactSchemas)[T]>
}
