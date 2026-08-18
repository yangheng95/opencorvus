/**
 * The integrity check-graph audit decides whether a submitted review is
 * structurally complete: whether it registered check items at all, whether its
 * rows cite check IDs that exist, whether a `pass` was recorded over failed
 * checks, and whether the selected requirement facts were actually covered.
 *
 * Until now nothing asserted any of it directly. The functions lived unexported
 * inside `team-agent.ts`, so the only way to observe a wrong verdict was to run
 * a whole integrity sub-agent session end to end — the same shape the memory
 * ranking math was in before it was pulled out and tested.
 */
import { describe, expect, test } from "bun:test"
import {
  integrityCheckGraphIssues,
  integrityRequirementCoverageIssues,
  unknownIntegrityCheckIDIssues,
  unsupportedIntegrityEvidenceIssues,
} from "../../src/integrity/review-validation"
import { IntegrityReviewSchema, type IntegrityReview } from "../../src/integrity/team-schema"
import type { ParsedRequirement } from "../../src/requirements/types"

function review(overrides: Record<string, unknown> = {}): IntegrityReview {
  return IntegrityReviewSchema.parse({ fact_check_items: [], ...overrides })
}

function checkItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "chk-1",
    category: "requirement",
    target: "REQ-1",
    question: "Does the delivery preserve the requested behavior?",
    status: "passed",
    expected: "The route returns the persisted row.",
    observed: "The route returned the persisted row.",
    evidence: ["ev-1"],
    requirementIDs: ["REQ-1"],
    specIDs: [],
    targetIDs: [],
    userRequestQuotes: [],
    ...overrides,
  }
}

function requirement(id: string): ParsedRequirement {
  return {
    id,
    type: "explicit",
    description: `${id} description`,
    acceptance: `${id} acceptance`,
    non_goals: "",
    evidence_refs: [],
  } as ParsedRequirement
}

describe("integrity check ID references", () => {
  const known = new Set(["chk-1", "chk-2"])

  test("treats an empty checkID list as its own defect, not as vacuously valid", () => {
    expect(unknownIntegrityCheckIDIssues(known, "finding", "f-1", [])).toEqual([
      'finding "f-1" has no checkIDs; register a check item and reference it.',
    ])
  })

  test("names every unregistered checkID it was handed", () => {
    const issues = unknownIntegrityCheckIDIssues(known, "finding", "f-1", ["chk-1", "chk-9", "chk-8"])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("chk-9")
    expect(issues[0]).toContain("chk-8")
    expect(issues[0]).not.toContain("chk-1")
  })

  test("stays silent when every cited checkID is registered", () => {
    expect(unknownIntegrityCheckIDIssues(known, "finding", "f-1", ["chk-1", "chk-2"])).toEqual([])
  })
})

describe("integrity check graph audit", () => {
  test("stops at the first structural gap: a review with no registered check items", () => {
    const issues = integrityCheckGraphIssues(review())
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("no registered checkItems")
  })

  test("reports an active requirement that no check item claims", () => {
    const issues = integrityCheckGraphIssues(review({ checkItems: [checkItem()] }), [
      requirement("REQ-1"),
      requirement("REQ-2"),
    ])
    expect(issues.some((issue) => issue.includes("active requirement REQ-2 has no registered integrity check item")))
      .toBe(true)
    expect(issues.some((issue) => issue.includes("active requirement REQ-1"))).toBe(false)
  })

  test("refuses a pass recorded over a failed check item", () => {
    const issues = integrityCheckGraphIssues(
      review({ verdict: "pass", checkItems: [checkItem({ id: "chk-1", status: "failed" })] }),
    )
    expect(issues.some((issue) => issue.includes("pass judgment was recorded with failed/inconclusive checkItems")))
      .toBe(true)
  })

  test("accepts the same failed check item when the verdict is not a pass", () => {
    const issues = integrityCheckGraphIssues(
      review({ verdict: "needs_correction", checkItems: [checkItem({ id: "chk-1", status: "failed" })] }),
    )
    expect(issues.some((issue) => issue.includes("pass judgment was recorded"))).toBe(false)
  })
})

describe("integrity evidence support", () => {
  test("flags a check item that no reviewer row supports", () => {
    const issues = unsupportedIntegrityEvidenceIssues(review({ checkItems: [checkItem()] }))
    expect(issues).toEqual([
      'checkItem "chk-1" has no reviewer evidence, drilldown, or coverage support row.',
    ])
  })
})

describe("integrity requirement coverage", () => {
  test("says nothing when no persisted requirement facts were selected", () => {
    // No requirements is not the same as no coverage: with nothing selected
    // there is no promise to have missed.
    expect(integrityRequirementCoverageIssues(review(), undefined)).toEqual([])
    expect(integrityRequirementCoverageIssues(review(), [])).toEqual([])
  })

  test("names the requirements that no coverage row, finding, or repair touched", () => {
    const issues = integrityRequirementCoverageIssues(review(), [requirement("REQ-1"), requirement("REQ-2")])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("REQ-1")
    expect(issues[0]).toContain("REQ-2")
  })

  test("counts a requirement as touched when a finding carries it", () => {
    const touched = review({
      checkItems: [checkItem()],
      findings: [
        {
          id: "f-1",
          checkIDs: ["chk-1"],
          severity: "advisory",
          verdictImpact: "needs_correction",
          canonicalSymptom: "REQ-1 is not met",
          title: "REQ-1 regression",
          description: "The route drops the persisted row.",
          evidence: ["ev-1"],
          targetIDs: [],
          requirementIDs: ["REQ-1"],
          specIDs: [],
          userRequestQuotes: [],
          filePaths: [],
          affectedSymbols: [],
          repair: "Restore the persisted row on the route response.",
          verify: ["Re-run the route contract test."],
          sourceFindingIDs: [],
          priorReviewRefs: [],
          reviewers: ["reviewer-1"],
          consensus: "agreed",
        },
      ],
    })
    expect(integrityRequirementCoverageIssues(touched, [requirement("REQ-1")])).toEqual([])
  })
})
