// ABI means Application Binary Interface. URL means Uniform Resource Locator.

import { tool } from "@opencorvus-ai/plugin"

export const TAX_COMPLIANCE_SCHEMA_VERSION = 1
export const TAX_COMPLIANCE_WORKFLOW_ID = "tax-compliance-assessment"

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
  applicable_period: nonempty,
  url: tool.schema.string().trim().url(),
  supported_propositions: nonemptyDistinctStrings,
  limitations: distinctStrings,
}).strict()

const CalculationSchema = tool.schema.object({
  id: nonempty,
  subject: nonempty,
  inputs: nonemptyDistinctStrings,
  formula: nonempty,
  result: nonempty,
  currency_or_unit: nonempty,
  rounding: nonempty,
  authority_ids: nonemptyDistinctStrings,
}).strict()

const RiskRecordSchema = tool.schema.object({
  id: nonempty,
  subject: nonempty,
  risk_level: riskLevel,
  factual_basis: nonemptyDistinctStrings,
  authority_ids: nonemptyDistinctStrings,
  consequence: nonempty,
  remediation: nonempty,
  residual_exposure: nonempty,
}).strict()

export const TaxComplianceArtifactSchemas = {
  "tax-compliance/engagement-charter": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    entities: nonemptyDistinctStrings,
    jurisdictions: nonemptyDistinctStrings,
    reporting_framework: nonempty,
    periods: nonemptyDistinctStrings,
    as_of_date: date,
    transactions: nonemptyDistinctStrings,
    taxes_in_scope: nonemptyDistinctStrings,
    currencies: nonemptyDistinctStrings,
    materiality_rules: nonemptyDistinctStrings,
    data_cutoff: date,
    questions: nonemptyDistinctStrings,
    assumptions: distinctStrings,
    unknowns: distinctStrings,
  }).strict(),
  "tax-compliance/evidence-dossier": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    as_of_date: date,
    authorities: tool.schema.array(AuthorityRecordSchema).min(1),
    accounting_records: tool.schema.array(tool.schema.object({
      id: nonempty,
      record_type: nonempty,
      period: nonempty,
      provenance: nonempty,
      observed_value: nonempty,
      currency_or_unit: nonempty,
      limitations: distinctStrings,
    }).strict()).min(1),
    filing_facts: distinctStrings,
    reconciled_definitions: nonemptyDistinctStrings,
    conflicts: distinctStrings,
    evidence_gaps: distinctStrings,
  }).strict(),
  "tax-compliance/accounting-controls-analysis": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    treatments: tool.schema.array(tool.schema.object({
      subject: nonempty,
      reporting_period: nonempty,
      accounting_treatment: nonempty,
      journal_entry_logic: nonemptyDistinctStrings,
      authority_ids: nonemptyDistinctStrings,
      source_record_ids: nonemptyDistinctStrings,
      book_tax_difference: nonempty,
    }).strict()).min(1),
    reconciliations: tool.schema.array(CalculationSchema).min(1),
    document_chain_findings: nonemptyDistinctStrings,
    control_findings: tool.schema.array(tool.schema.object({ control: nonempty, finding: nonempty, risk_level: riskLevel, action: nonempty }).strict()).min(1),
    assumptions: distinctStrings,
    unresolved_questions: distinctStrings,
  }).strict(),
  "tax-compliance/tax-obligation-analysis": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    obligations: tool.schema.array(tool.schema.object({
      tax: nonempty,
      jurisdiction: nonempty,
      period: nonempty,
      taxable_event: nonempty,
      tax_base: nonempty,
      rate_or_treatment: nonempty,
      filing_deadline: nonempty,
      payment_deadline: nonempty,
      authority_ids: nonemptyDistinctStrings,
      conclusion: nonempty,
    }).strict()).min(1),
    calculations: tool.schema.array(CalculationSchema).min(1),
    withholding_and_indirect_tax: distinctStrings,
    filing_positions: nonemptyDistinctStrings,
    evidence_requirements: nonemptyDistinctStrings,
    unresolved_questions: distinctStrings,
  }).strict(),
  "tax-compliance/compliance-plan": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    executive_position: nonempty,
    priority_risks: tool.schema.array(RiskRecordSchema).min(1),
    book_tax_reconciliation: tool.schema.array(CalculationSchema).min(1),
    remediation_actions: tool.schema.array(tool.schema.object({ action: nonempty, owner: nonempty, due: nonempty, evidence_required: nonemptyDistinctStrings }).strict()).min(1),
    filing_calendar: tool.schema.array(tool.schema.object({ obligation: nonempty, jurisdiction: nonempty, period: nonempty, due: nonempty, owner: nonempty }).strict()).min(1),
    retention_plan: nonemptyDistinctStrings,
    residual_exposures: nonemptyDistinctStrings,
    disclaimer: nonempty,
  }).strict(),
  "tax-compliance/audit": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    reviewed_artifact_type: tool.schema.literal("tax-compliance/compliance-plan"),
    checks: tool.schema.array(tool.schema.object({
      subject: nonempty,
      result: tool.schema.enum(["verified", "correction-required", "limited"]),
      evidence: nonemptyDistinctStrings,
      recalculation: nonempty,
      explanation: nonempty,
    }).strict()).min(1),
    required_corrections: distinctStrings,
    accepted_limitations: distinctStrings,
    coverage_summary: nonempty,
    publication_guidance: nonempty,
  }).strict(),
  "tax-compliance/report": tool.schema.object({
    workflow_id: tool.schema.literal(TAX_COMPLIANCE_WORKFLOW_ID),
    title: nonempty,
    as_of_date: date,
    entities: nonemptyDistinctStrings,
    jurisdictions: nonemptyDistinctStrings,
    periods: nonemptyDistinctStrings,
    executive_summary: nonempty,
    section_inventory: nonemptyDistinctStrings,
    calculation_count: tool.schema.number().int().nonnegative(),
    citation_count: tool.schema.number().int().nonnegative(),
    audit_resolution: nonemptyDistinctStrings,
    markdown_path: tool.schema.literal("artifacts/tax-compliance/report.md"),
    disclaimer: nonempty,
  }).strict(),
} as const

export type TaxComplianceArtifactType = keyof typeof TaxComplianceArtifactSchemas
export const TaxComplianceArtifactTypeSchema = tool.schema.enum(Object.keys(TaxComplianceArtifactSchemas) as [TaxComplianceArtifactType, ...TaxComplianceArtifactType[]])

export const TaxCompliancePublishableArtifactInputSchema = tool.schema.discriminatedUnion("artifact_type", [
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/engagement-charter"), payload: TaxComplianceArtifactSchemas["tax-compliance/engagement-charter"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/evidence-dossier"), payload: TaxComplianceArtifactSchemas["tax-compliance/evidence-dossier"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/accounting-controls-analysis"), payload: TaxComplianceArtifactSchemas["tax-compliance/accounting-controls-analysis"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/tax-obligation-analysis"), payload: TaxComplianceArtifactSchemas["tax-compliance/tax-obligation-analysis"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/compliance-plan"), payload: TaxComplianceArtifactSchemas["tax-compliance/compliance-plan"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/audit"), payload: TaxComplianceArtifactSchemas["tax-compliance/audit"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("tax-compliance/report"), payload: TaxComplianceArtifactSchemas["tax-compliance/report"] }).strict(),
])

export function parseTaxComplianceArtifact<T extends TaxComplianceArtifactType>(artifactType: T, payload: unknown): tool.schema.infer<(typeof TaxComplianceArtifactSchemas)[T]> {
  return TaxComplianceArtifactSchemas[artifactType].parse(payload) as tool.schema.infer<(typeof TaxComplianceArtifactSchemas)[T]>
}
