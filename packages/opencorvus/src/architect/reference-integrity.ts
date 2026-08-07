import type { AcceptanceSpec } from "@/acceptance/types"
import type { ArchitectContractGraph } from "./contract-graph"

export type ArchitectReferenceIntegrityIssue = {
  code: "unknown_requirement_ids" | "unknown_contract_ids" | "unselected_research_evidence_refs"
  message: string
  references: string[]
}

export function classifyArchitectReferenceIntegrity(input: {
  goals: ReadonlyArray<{ acceptance_specs: readonly AcceptanceSpec[] }>
  graph: ArchitectContractGraph
  requirementIDs?: readonly string[]
  knownResearchEvidenceRefs: readonly string[]
}): ArchitectReferenceIntegrityIssue[] {
  const issues: ArchitectReferenceIntegrityIssue[] = []
  if (input.requirementIDs !== undefined) {
    const requirementIDs = new Set(input.requirementIDs)
    const references = [...new Set(input.goals.flatMap((goal) =>
      goal.acceptance_specs.flatMap((spec) =>
        spec.source?.kind === "requirement" && !requirementIDs.has(spec.source.id) ? [spec.source.id] : [],
      ),
    ))]
    if (references.length > 0) {
      issues.push({
        code: "unknown_requirement_ids",
        message: `Architect acceptance specs reference unknown Requirement IDs: ${references.join(", ")}`,
        references,
      })
    }
  }

  const contractIDs = new Set(input.graph.contracts.map((contract) => contract.id))
  const unknownContractIDs = [...new Set(input.goals.flatMap((goal) =>
    goal.acceptance_specs.flatMap((spec) =>
      spec.scorers.flatMap((scorer) =>
        scorer.type === "contract_audit"
          ? scorer.spec.contract_ids.filter((contractID) => !contractIDs.has(contractID))
          : [],
      ),
    ),
  ))]
  if (unknownContractIDs.length > 0) {
    issues.push({
      code: "unknown_contract_ids",
      message: `Architect acceptance specs reference unknown Contract IDs: ${unknownContractIDs.join(", ")}`,
      references: unknownContractIDs,
    })
  }

  const knownResearchEvidenceRefs = new Set(input.knownResearchEvidenceRefs)
  const unknownResearchEvidenceRefs = [...new Set(input.graph.contracts.flatMap((contract) =>
    contract.evidence_refs.filter((reference) => !knownResearchEvidenceRefs.has(reference)),
  ))]
  if (unknownResearchEvidenceRefs.length > 0) {
    issues.push({
      code: "unselected_research_evidence_refs",
      message: `Architect contracts reference unselected Research evidence: ${unknownResearchEvidenceRefs.join(", ")}`,
      references: unknownResearchEvidenceRefs,
    })
  }
  return issues
}
