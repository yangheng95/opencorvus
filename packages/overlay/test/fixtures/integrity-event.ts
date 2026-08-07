import type { EventIntegrityReviewCompleted } from "@opencorvus-ai/sdk"

export function integrityCompletedProperties(
  overrides: Partial<EventIntegrityReviewCompleted["properties"]> = {},
): EventIntegrityReviewCompleted["properties"] {
  return {
    taskID: "task-integrity-fixture",
    sessionID: "session-integrity-fixture",
    agentID: "integrity-reviewer",
    verdict: "pass",
    summary: "Canonical Integrity report fixture",
    teamReportMarkdown: "The structured report is the canonical evidence source.",
    checkItems: [
      {
        id: "check-overlay-sentinel",
        reviewerID: "check-owner-overlay-sentinel",
        category: "integration",
        target: "overlay canonical projection",
        question: "Does every report field remain visible?",
        status: "passed",
        expected: "Every field remains visible.",
        observed: "Every field remained visible.",
        evidence: ["check-evidence-overlay-sentinel"],
        requirementIDs: ["requirement-overlay-sentinel"],
        specIDs: ["spec-overlay-sentinel"],
        targetIDs: ["target-overlay-sentinel"],
        userRequestQuotes: ["user-quote-overlay-sentinel"],
      },
    ],
    reviewers: [
      {
        reviewerID: "perspective-overlay-sentinel",
        checkIDs: ["reviewer-check-link-overlay-sentinel"],
        scope: "overlay projection",
        verdict: "pass",
        summary: "perspective-summary-overlay-sentinel",
        investigationPlan: {
          requestPromise: "request-promise-overlay-sentinel",
          hypothesis: "hypothesis-overlay-sentinel",
          evidencePlan: ["evidence-plan-overlay-sentinel"],
          passCriteria: ["pass-criteria-overlay-sentinel"],
        },
        drilldowns: [
          {
            checkIDs: ["check-overlay-sentinel"],
            kind: "drilldown-kind-overlay-sentinel",
            target: "drilldown-target-overlay-sentinel",
            purpose: "drilldown-purpose-overlay-sentinel",
            result: "drilldown-result-overlay-sentinel",
          },
        ],
        coverage: [
          {
            checkIDs: ["check-overlay-sentinel"],
            requirementID: "requirement-overlay-sentinel",
            status: "covered",
            evidence: "reviewer-coverage-overlay-sentinel",
          },
        ],
        evidence: [{ checkIDs: ["check-overlay-sentinel"], note: "reviewer-evidence-overlay-sentinel" }],
        openQuestions: ["open-question-overlay-sentinel"],
      },
    ],
    coverageAudit: [
      {
        checkIDs: ["check-overlay-sentinel"],
        promise: "coverage-promise-overlay-sentinel",
        reviewerIDs: ["perspective-overlay-sentinel"],
        status: "covered",
        notes: "coverage-notes-overlay-sentinel",
      },
    ],
    uninspectedRisks: [
      {
        checkIDs: ["check-overlay-sentinel"],
        risk: "risk-overlay-sentinel",
        reason: "risk-reason-overlay-sentinel",
        action: "advisory",
      },
    ],
    findings: [],
    rounds: [
      {
        roundID: "round-overlay-sentinel",
        prompt: "round-prompt-overlay-sentinel",
        reviewerIDs: ["perspective-overlay-sentinel"],
        outcome: "round-outcome-overlay-sentinel",
      },
    ],
    requiredRepairs: [],
    unresolvedDisagreements: [],
    fact_check_items: [
      {
        claim: "fact-check-claim-overlay-sentinel is a complete factual assertion.",
        confidence: "low",
        category: "protocol",
        source: "fact-check-source-overlay-sentinel",
      },
    ],
    attempts: 1,
    ...overrides,
  }
}

export function integrityNeedsCorrectionProperties(
  overrides: Partial<EventIntegrityReviewCompleted["properties"]> = {},
): EventIntegrityReviewCompleted["properties"] {
  const finding = {
    id: "missing-x",
    checkIDs: ["check-overlay-sentinel"],
    severity: "blocking" as const,
    verdictImpact: "needs_correction" as const,
    canonicalSymptom: "Required behavior X is missing.",
    title: "Missing X",
    description: "Required behavior X is missing.",
    evidence: ["request asks for X"],
    targetIDs: ["target-overlay-sentinel"],
    requirementIDs: ["requirement-overlay-sentinel"],
    specIDs: ["spec-overlay-sentinel"],
    userRequestQuotes: ["Implement X."],
    filePaths: ["src/x.ts"],
    affectedSymbols: ["implementX"],
    repair: "Add X.",
    verify: ["Exercise X through the runtime."],
    sourceFindingIDs: [],
    priorAttemptRefs: [],
    reviewers: ["finding-reviewer-overlay-sentinel"],
    consensus: "agreed" as const,
  }
  return integrityCompletedProperties({
    verdict: "needs_correction",
    summary: "The review found a blocking gap.",
    findings: [finding],
    requiredRepairs: [
      {
        id: "repair-x",
        checkIDs: finding.checkIDs,
        severity: "blocking",
        title: "Add required behavior X",
        canonicalSymptom: finding.canonicalSymptom,
        description: "Add X.",
        evidence: finding.evidence,
        targetIDs: finding.targetIDs,
        requirementIDs: finding.requirementIDs,
        specIDs: finding.specIDs,
        filePaths: finding.filePaths,
        affectedSymbols: finding.affectedSymbols,
        repair: finding.repair,
        verify: finding.verify,
        sourceFindingIDs: [finding.id],
        priorAttemptRefs: [],
      },
    ],
    ...overrides,
  })
}
