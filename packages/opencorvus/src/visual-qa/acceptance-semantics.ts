import type { VisualReview } from "./schema"

export function visualQaOpenBlockingFindings(report: VisualReview): VisualReview["findings"] {
  return report.findings.filter(
    (finding) => finding.status === "open" && (finding.severity === "critical" || finding.severity === "major"),
  )
}

export function visualQaReferenceRegionAuthorityIssues(
  report: Pick<VisualReview, "reference_parity">,
  referenceParityRequired: boolean,
  requiredReferenceRegions: readonly string[],
): string[] {
  const canonicalRegions = [...new Set(requiredReferenceRegions)].sort()
  const reportRegions = [...new Set(report.reference_parity.required_regions)].sort()
  const issues: string[] = []
  if (report.reference_parity.required !== referenceParityRequired) {
    issues.push(
      `report.reference_parity.required=${report.reference_parity.required} does not match canonical context.referenceParityRequired=${referenceParityRequired}.`,
    )
  }
  if (
    reportRegions.length !== canonicalRegions.length ||
    reportRegions.some((region, index) => region !== canonicalRegions[index])
  ) {
    issues.push(
      `report.reference_parity.required_regions=[${reportRegions.join(", ")}] does not exactly match canonical required regions=[${canonicalRegions.join(", ")}].`,
    )
  }
  const canonicalRegionSet = new Set(canonicalRegions)
  const unknownMissingRegions = [...new Set(report.reference_parity.missing_regions)]
    .filter((region) => !canonicalRegionSet.has(region))
    .sort()
  if (unknownMissingRegions.length > 0) {
    issues.push(
      `report.reference_parity.missing_regions contains regions outside the canonical required set: ${unknownMissingRegions.join(", ")}.`,
    )
  }
  return issues
}

export function visualReviewConsistencyFindings(report: VisualReview): string[] {
  if (!report.accepted) return []
  const issues: string[] = []
  if (report.evidence.length === 0) {
    issues.push("accepted=true was recorded without fresh visual or functional evidence items.")
  }
  if (!hasScreenshotBearingEvidence(report)) {
    issues.push("accepted=true was recorded without screenshot comparison or screen-by-screen screenshot evidence.")
  }
  if (report.coverage.length === 0) {
    issues.push("accepted=true was recorded without coverage items naming checked regions/viewports/states.")
  }
  if (report.check_items.length === 0) {
    issues.push("accepted=true was recorded without registered visual QA check_items.")
  }
  const unresolvedChecks = report.check_items
    .filter((item) => item.status === "failed" || item.status === "inconclusive")
    .map((item) => item.id)
  if (unresolvedChecks.length > 0) {
    issues.push(`accepted=true was recorded with failed/inconclusive check_items: ${unresolvedChecks.join(", ")}.`)
  }
  const openBlocking = visualQaOpenBlockingFindings(report)
  if (openBlocking.length > 0) {
    issues.push(
      `accepted=true was recorded with open critical/major findings: ${openBlocking.map((finding) => finding.id).join(", ")}.`,
    )
  }
  if (report.production_blockers.length > 0) {
    issues.push(
      `accepted=true was recorded with production blockers: ${report.production_blockers.map((blocker) => blocker.id).join(", ")}.`,
    )
  }
  if (report.unresolved_code_module_problems.length > 0) {
    issues.push(
      "accepted=true was recorded with unresolved_code_module_problems; the facts contradict the current positive judgment.",
    )
  }
  return issues
}

function hasScreenshotBearingEvidence(report: VisualReview): boolean {
  return report.evidence.some(
    (item) => item.type === "screenshot" || item.type === "reference_comparison" || item.type === "visual_diff",
  )
}
