/**
 * Structural validation and normalization of a submitted integrity review.
 *
 * Pure functions over a report: unknown-check-id detection, evidence-support
 * checks, the check graph audit, requirement coverage, and the canonical
 * normalization applied before persistence. Split out of `team-agent.ts` so a
 * correctness change here is not a change to prompt copy or to session
 * orchestration. The consensus-collector upserts stay behind — they are part
 * of the live review session, not of judging a finished report.
 */
import type { ParsedRequirement } from "@/requirements/types"
import { integrityFindingFingerprint, stableList } from "./finding-manifest"
import type {
  IntegrityFinding,
  IntegrityRequiredRepair,
  IntegrityReview,
  IntegrityReviewerReview,
} from "./team-schema"

export function unknownIntegrityCheckIDIssues(
  knownCheckIDs: ReadonlySet<string>,
  label: string,
  id: string,
  checkIDs: readonly string[],
): string[] {
  if (checkIDs.length === 0) return [`${label} "${id}" has no checkIDs; register a check item and reference it.`]
  const unknown = checkIDs.filter((checkID) => !knownCheckIDs.has(checkID))
  return unknown.length > 0 ? [`${label} "${id}" references unknown checkIDs: ${unknown.join(", ")}.`] : []
}

export function integrityUnknownCheckIDIssues(
  report: IntegrityReview,
  label: string,
  id: string,
  checkIDs: readonly string[],
): string[] {
  return unknownIntegrityCheckIDIssues(new Set(report.checkItems.map((item) => item.id)), label, id, checkIDs)
}

export function integrityReviewerCheckIDRows(report: IntegrityReviewerReview): Array<{
  label: string
  id: string
  checkIDs: readonly string[]
}> {
  return [
    { label: "reviewer", id: report.reviewerID, checkIDs: report.checkIDs },
    ...report.drilldowns.map((row, index) => ({
      label: `reviewerDrilldown:${report.reviewerID}`,
      id: `${row.target}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.coverage.map((row, index) => ({
      label: `reviewerCoverage:${report.reviewerID}`,
      id: `${row.requirementID ?? row.specID ?? row.userRequestQuote ?? "coverage"}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.evidence.map((row, index) => ({
      label: `reviewerEvidence:${report.reviewerID}`,
      id: `${row.note}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
  ]
}

function addIntegrityEvidenceSupport(
  map: Map<string, Set<string>>,
  checkIDs: readonly string[],
  evidence: string,
): void {
  for (const checkID of checkIDs) {
    const set = map.get(checkID) ?? new Set<string>()
    set.add(evidence)
    map.set(checkID, set)
  }
}

function integrityReviewerEvidenceSupportByCheckID(report: IntegrityReview): Map<string, Set<string>> {
  const support = new Map<string, Set<string>>()
  for (const reviewer of report.reviewers) {
    for (const row of reviewer.evidence) addIntegrityEvidenceSupport(support, row.checkIDs, row.note)
    for (const row of reviewer.coverage) addIntegrityEvidenceSupport(support, row.checkIDs, row.evidence)
    for (const row of reviewer.drilldowns) addIntegrityEvidenceSupport(support, row.checkIDs, row.result)
  }
  return support
}

function integrityCheckEvidenceByID(report: IntegrityReview): Map<string, Set<string>> {
  return new Map(report.checkItems.map((item) => [item.id, new Set(item.evidence)]))
}

export function unsupportedIntegrityEvidenceIssues(report: IntegrityReview): string[] {
  const issues: string[] = []
  const reviewerSupport = integrityReviewerEvidenceSupportByCheckID(report)
  for (const item of report.checkItems) {
    const support = reviewerSupport.get(item.id) ?? new Set<string>()
    if (support.size === 0) {
      issues.push(`checkItem "${item.id}" has no reviewer evidence, drilldown, or coverage support row.`)
      continue
    }
    const missing = item.evidence.filter((evidence) => !support.has(evidence))
    if (missing.length > 0) {
      issues.push(`checkItem "${item.id}" evidence is not backed by reviewer support rows: ${missing.join(" | ")}.`)
    }
  }

  const checkEvidence = integrityCheckEvidenceByID(report)
  const linkedEvidenceIssues = (
    label: string,
    id: string,
    checkIDs: readonly string[],
    evidenceItems: readonly string[],
  ): void => {
    const supported = new Set<string>()
    for (const checkID of checkIDs) for (const evidence of checkEvidence.get(checkID) ?? []) supported.add(evidence)
    const missing = evidenceItems.filter((evidence) => !supported.has(evidence))
    if (missing.length > 0) {
      issues.push(
        `${label} "${id}" evidence is not present on its cited checkItems (${checkIDs.join(", ")}): ${missing.join(" | ")}.`,
      )
    }
  }
  for (const finding of report.findings) {
    linkedEvidenceIssues("finding", finding.id, finding.checkIDs, finding.evidence)
  }
  for (const repair of report.requiredRepairs) {
    linkedEvidenceIssues("requiredRepair", repair.id, repair.checkIDs, repair.evidence)
  }
  return issues
}

export function integrityCheckGraphIssues(report: IntegrityReview, requirements?: ParsedRequirement[]): string[] {
  const issues: string[] = []
  if (report.checkItems.length === 0) {
    issues.push("IntegrityReview has no registered checkItems; register each inspected requirement/problem first.")
    return issues
  }
  if (report.coverageAudit.length === 0) {
    issues.push("integrity review has no registered coverageAudit rows; the coverage facts are incomplete.")
  }
  for (const reviewer of report.reviewers) {
    if (reviewer.drilldowns.length === 0) {
      issues.push(`reviewer "${reviewer.reviewerID}" has no drilldowns; register row-level inspected evidence.`)
    }
    if (reviewer.coverage.length === 0) {
      issues.push(
        `reviewer "${reviewer.reviewerID}" has no coverage rows; register what requirement, spec, or user promise was covered.`,
      )
    }
    if (reviewer.evidence.length === 0) {
      issues.push(`reviewer "${reviewer.reviewerID}" has no evidence rows; register evidence rows tied to checkIDs.`)
    }
  }
  const checkByID = new Map(report.checkItems.map((item) => [item.id, item]))
  const activeRequirementIDs = (requirements ?? []).map((requirement) => requirement.id)
  for (const requirementID of activeRequirementIDs) {
    const covered = report.checkItems.some((item) => item.requirementIDs.includes(requirementID))
    if (!covered) {
      issues.push(`active requirement ${requirementID} has no registered integrity check item.`)
    }
  }
  const unresolvedCheckIDs = report.checkItems
    .filter((item) => item.status === "failed" || item.status === "inconclusive")
    .map((item) => item.id)
  if (report.verdict === "pass" && unresolvedCheckIDs.length > 0) {
    issues.push(`pass judgment was recorded with failed/inconclusive checkItems: ${unresolvedCheckIDs.join(", ")}.`)
  }
  if (report.verdict === "pass") {
    const nonCoveredReviewerRows = report.reviewers.flatMap((reviewer) =>
      reviewer.coverage
        .filter((row) => row.status !== "covered")
        .map(
          (row) => `${reviewer.reviewerID}:${row.requirementID ?? row.specID ?? row.userRequestQuote ?? "coverage"}`,
        ),
    )
    if (nonCoveredReviewerRows.length > 0) {
      issues.push(
        `pass judgment was recorded with missing/inconclusive reviewer coverage: ${nonCoveredReviewerRows.join(", ")}.`,
      )
    }
    const nonCoveredAuditRows = report.coverageAudit.filter((row) => row.status !== "covered").map((row) => row.promise)
    if (nonCoveredAuditRows.length > 0) {
      issues.push(
        `pass judgment was recorded with missing/inconclusive coverageAudit rows: ${nonCoveredAuditRows.join(", ")}.`,
      )
    }
  }
  const rows: Array<{ label: string; id: string; checkIDs: readonly string[] }> = [
    ...report.reviewers.flatMap((row) => integrityReviewerCheckIDRows(row)),
    ...report.findings.map((row) => ({ label: "finding", id: row.id, checkIDs: row.checkIDs })),
    ...report.requiredRepairs.map((row) => ({ label: "requiredRepair", id: row.id, checkIDs: row.checkIDs })),
    ...report.coverageAudit.map((row, index) => ({
      label: "coverageAudit",
      id: `${row.promise}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.uninspectedRisks.map((row, index) => ({
      label: "uninspectedRisk",
      id: `${row.risk}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.unresolvedDisagreements.map((row) => ({
      label: "unresolvedDisagreement",
      id: row.id,
      checkIDs: row.checkIDs,
    })),
  ]
  for (const row of rows) issues.push(...integrityUnknownCheckIDIssues(report, row.label, row.id, row.checkIDs))
  issues.push(...unsupportedIntegrityEvidenceIssues(report))
  for (const finding of report.findings) {
    if (finding.severity !== "blocking") continue
    const linked = finding.checkIDs.map((checkID) => checkByID.get(checkID)).filter((item) => item !== undefined)
    if (linked.length > 0 && linked.every((item) => item.status === "passed")) {
      issues.push(
        `blocking finding "${finding.id}" references only passed checkItems; blockers require a failed or inconclusive check.`,
      )
    }
  }
  return issues
}

export function integrityRequirementCoverageIssues(
  report: IntegrityReview,
  requirements: readonly ParsedRequirement[] | undefined,
): string[] {
  const knownRequirementIDs = [...new Set((requirements ?? []).map((requirement) => requirement.id).filter(Boolean))]
  if (knownRequirementIDs.length === 0) return []

  const touchedRequirementIDs = new Set<string>()
  for (const reviewer of report.reviewers) {
    for (const row of reviewer.coverage) {
      if (row.requirementID) touchedRequirementIDs.add(row.requirementID)
    }
  }
  for (const finding of report.findings) {
    for (const requirementID of finding.requirementIDs) touchedRequirementIDs.add(requirementID)
  }
  for (const repair of report.requiredRepairs) {
    for (const requirementID of repair.requirementIDs) touchedRequirementIDs.add(requirementID)
  }

  const missing = knownRequirementIDs.filter((requirementID) => !touchedRequirementIDs.has(requirementID))
  if (missing.length === 0) return []
  return [
    `${missing.join(", ")} missing from reviewer coverage rows, findings, and requiredRepairs; the selected persisted requirement facts are incomplete.`,
  ]
}

export function normalizeIntegrityReview(report: IntegrityReview): IntegrityReview {
  const findings = report.findings.map(normalizeManifestFinding)
  const requiredRepairs = report.requiredRepairs.map((repair) => normalizeManifestRepair(repair, findings))
  return {
    ...report,
    findings,
    requiredRepairs,
  }
}

function normalizeManifestFinding(finding: IntegrityFinding): IntegrityFinding {
  const canonicalSymptom = finding.canonicalSymptom
  const fingerprint = integrityFindingFingerprint({ ...finding, canonicalSymptom })
  return {
    ...finding,
    fingerprint,
    canonicalSymptom,
    priorReviewRefs: stableList(finding.priorReviewRefs),
  }
}

function normalizeManifestRepair(
  repair: IntegrityRequiredRepair,
  findings: IntegrityFinding[],
): IntegrityRequiredRepair {
  const findingIDs = new Set(findings.map((finding) => finding.id))
  for (const sourceFindingID of repair.sourceFindingIDs) {
    if (!findingIDs.has(sourceFindingID)) {
      throw new Error(
        `integrity required repair ${repair.id} must reference current finding ${sourceFindingID} by exact id`,
      )
    }
  }
  const canonicalSymptom = repair.canonicalSymptom
  const fingerprint = integrityFindingFingerprint({ ...repair, canonicalSymptom })
  return {
    ...repair,
    fingerprint,
    canonicalSymptom,
    priorReviewRefs: stableList(repair.priorReviewRefs),
  }
}
