/**
 * The promotion rule decides on the interval it computes, not on the sign of a
 * point estimate.
 *
 * The previous revision computed a 95% interval per scorer, published it, and
 * then promoted whenever the weighted mean was above zero and no scorer's mean
 * was below zero. Two consequences followed. A single repetition could promote
 * a candidate, because one sample has a positive mean as easily as it has a
 * negative one. And `scorer.weight` was inert: "no scorer below zero" already
 * forces a non-negative weighted mean, so the relative weights a campaign
 * declared could be rewritten arbitrarily without changing any recommendation.
 */
import { describe, expect, test } from "bun:test"
import { deriveComparisonRecommendation } from "@squads/evolution-lab/lib/evolution-lab/comparison"
import { EvolutionArtifactSchemas } from "@squads/evolution-lab/lib/evolution-lab/artifacts"
import { EvolutionReviewLineageError, resolveEvolutionIntegrityReviews, groupEvolutionMeasurements } from "@opencorvus-ai/plugin"

const baselineDigest = "a".repeat(64)
const candidateDigest = "b".repeat(64)
const resourceDigest = "c".repeat(64)
const snapshot = { task_id: "task-campaign", publication_sequence: 1, manifest_sha256: "d".repeat(64) }
const resource = {
  snapshot,
  tree: "campaign",
  path: "fixture.json",
  media_type: "application/json",
  bytes: 2,
  sha256: resourceDigest,
}
const locator = {
  source: "engine_artifact" as const,
  artifact_id: "artifact-evidence",
  catalog_revision: 1,
  expected_sha256: "e".repeat(64),
}
const baselineRevision = {
  namespace: "evolution-test",
  id: "target",
  version: "2026.08.07.1",
  package_digest: baselineDigest,
}
const candidateRevision = { ...baselineRevision, version: "2026.08.07.2", package_digest: candidateDigest }

type ScorerSpec = { id: string; weight: number; baseline: number[]; candidate: number[] }
type IntegrityFinding = ReturnType<
  (typeof EvolutionArtifactSchemas)["evolution-lab/integrity-review"]["parse"]
>["findings"][number]

function scorerDefinition(spec: ScorerSpec) {
  return {
    scorer_id: spec.id,
    scorer_revision: resourceDigest,
    scope: "global" as const,
    goal_id: null,
    description: `Exact ${spec.id} ratio`,
    unit: "ratio",
    direction: "higher_better" as const,
    target: 1,
    floor: 0,
    weight: spec.weight,
    observation_class: "quality" as const,
    evaluator_kind: "query" as const,
    evaluator_config: { scorer_revision: resourceDigest, query: "constant_value" as const, value: 1 },
  }
}

/**
 * One case, `repetitions` repetitions, and one measured value per scorer per
 * arm per repetition. Every scorer must supply exactly `repetitions` values.
 */
function comparisonInputs(
  scorers: ScorerSpec[],
  options?: {
    uiRubricDigest?: string | null
    candidateFinding?: IntegrityFinding
    /** Replaces the whole candidate repetition-0 review; null omits it. */
    candidateReview?: {
      status: "reviewed" | "unavailable"
      findings: IntegrityFinding[]
      accepted_limitations: string[]
      unknowns: string[]
    } | null
    candidateFirstRunOutcome?: "success" | "failure" | "unavailable"
    candidateFirstRunCost?: number | null
    candidateFirstRunModel?: string
  },
) {
  const repetitions = scorers[0]!.baseline.length
  for (const spec of scorers) {
    if (spec.baseline.length !== repetitions || spec.candidate.length !== repetitions) {
      throw new Error(`scorer ${spec.id} must supply ${repetitions} values per arm`)
    }
  }

  const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
    target: {
      scope: "project",
      project_id: "project-1",
      project_directory: "C:/project-1",
      namespace: baselineRevision.namespace,
      id: baselineRevision.id,
    },
    baseline_revision: baselineRevision,
    candidate_version_policy: "increment revision",
    candidate_hypothesis: "Improve exact correctness",
    dataset_partition: "holdout",
    dataset_digest: resourceDigest,
    cases: ["case-1"],
    scorer_digests: [resourceDigest],
    scorers: scorers.map(scorerDefinition),
    frozen_inputs: {
      dataset: resource,
      cases: [{ case_id: "case-1", resource }],
      model_configuration: resource,
      environment: resource,
      workspace_template: resource,
      permission_snapshot: resource,
      scorer_assets: scorers.map((spec) => ({
        scorer_id: spec.id,
        scorer_revision: resourceDigest,
        resource,
      })),
    },
    model: "provider/model",
    model_configuration_digest: resourceDigest,
    environment_digest: resourceDigest,
    workspace_digest: resourceDigest,
    permission_snapshot_digest: resourceDigest,
    external_side_effect_policy: "No production side effects",
    repetitions,
    arm_order: ["baseline", "candidate"],
    statistics: "paired deterministic comparison",
    budget: { max_runs: repetitions * 2, max_cost: 100 },
    inactivity_timeout_ms: 60_000,
    ui_rubric_digest: options?.uiRubricDigest ?? null,
    mutable_paths: ["README.md"],
    trial_execution: { status: "available", installation_scope: "project" },
  })

  const candidate = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
    development_campaign_locator: locator,
    feedback: null,
    parent_revision: baselineRevision,
    candidate_revision: candidateRevision,
    parent_resources: [resource],
    candidate_resources: [resource],
    hypothesis: "Improve exact correctness",
    changed_paths: ["README.md"],
    diff_sha256: "f".repeat(64),
    frozen_files: [],
    manager_receipt: {
      operation: "validated",
      namespace: candidateRevision.namespace,
      id: candidateRevision.id,
      version: candidateRevision.version,
      package_digest: candidateRevision.package_digest,
    },
    provenance: [locator],
  })

  const arms = ["baseline", "candidate"] as const
  const indices = Array.from({ length: repetitions }, (_, index) => index)

  const evaluations = arms.flatMap((arm) =>
    indices.map((repetition) => ({
      locator,
      value: EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse({
        case_id: "case-1",
        arm,
        repetition,
        scorers: scorers.map((spec) => ({
          scorer_id: spec.id,
          status: "measured",
          value: spec[arm][repetition],
          evidence: [locator],
        })),
        trial_task_id: `task-${arm}-${repetition}`,
        trial_revision_digest: arm === "baseline" ? baselineDigest : candidateDigest,
        campaign_spec_locator: locator,
        candidate_revision_locator: arm === "candidate" ? locator : null,
        run_evidence_locator: locator,
        metric_receipt_resource: resource,
      }),
    })),
  )

  const reviews = arms.flatMap((arm) =>
    indices.flatMap((repetition) => {
      const candidateSlot = arm === "candidate" && repetition === 0
      if (candidateSlot && options?.candidateReview === null) return []
      const review =
        candidateSlot && options?.candidateReview
          ? options.candidateReview
          : {
              status: "reviewed" as const,
              findings: candidateSlot && options?.candidateFinding ? [options.candidateFinding] : [],
              accepted_limitations: [],
              unknowns: [],
            }
      return [
        {
          locator: { ...locator, artifact_id: `review-${arm}-${repetition}` },
          value: EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse({
            case_id: "case-1",
            arm,
            repetition,
            evaluation_result_locator: locator,
            ...review,
          }),
        },
      ]
    }),
  )

  const runs = arms.flatMap((arm) =>
    indices.map((repetition) => ({
      locator,
      value: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse({
        case_id: "case-1",
        arm,
        repetition,
        workspace_digest: resourceDigest,
        run_evidence_sha256: resourceDigest,
        run_evidence_resource: resource,
        task_id: `task-${arm}-${repetition}`,
        terminal_time: 1,
        model:
          arm === "candidate" && repetition === 0
            ? (options?.candidateFirstRunModel ?? "provider/model")
            : "provider/model",
        environment_digest: resourceDigest,
        token_usage: arm === "baseline" ? 100 : 110,
        // `??` would turn an explicit null cost back into 1.2; only an absent
        // option takes the default.
        cost:
          arm === "candidate" && repetition === 0 && options?.candidateFirstRunCost !== undefined
            ? options.candidateFirstRunCost
            : arm === "baseline"
              ? 1
              : 1.2,
        last_activity_at: "2026-08-07T00:00:00.000Z",
        outcome: arm === "candidate" && repetition === 0 ? (options?.candidateFirstRunOutcome ?? "success") : "success",
        activity_duration_ms: arm === "baseline" ? 1_000 : 1_100,
        revision_equality: {
          installed: arm === "baseline" ? baselineDigest : candidateDigest,
          expected: arm === "baseline" ? baselineDigest : candidateDigest,
          task_binding: arm === "baseline" ? baselineDigest : candidateDigest,
          workflow_binding: arm === "baseline" ? baselineDigest : candidateDigest,
          runtime_snapshot: arm === "baseline" ? baselineDigest : candidateDigest,
        },
      }),
    })),
  )

  return {
    campaign,
    candidate,
    campaignLocator: locator,
    candidateLocator: locator,
    evaluations,
    reviews,
    runs,
  }
}

function comparisonFor(...args: Parameters<typeof comparisonInputs>) {
  return deriveComparisonRecommendation(comparisonInputs(...args))
}

describe("Evolution Lab deterministic comparison", () => {
  test("counts complete identical measurement aliases once and accepts their exact references", () => {
    const input = comparisonInputs([{ id: "quality", weight: 1, baseline: [0.2, 0.2], candidate: [0.8, 0.8] }])
    const expected = deriveComparisonRecommendation(input)
    const run = input.runs.find((item) => item.value.arm === "candidate")!
    const evaluation = input.evaluations.find((item) => item.value.arm === "candidate")!
    const aliasRun = { ...run, locator: { ...run.locator, artifact_id: "aaa-run-alias" } }
    const aliasEvaluation = { ...evaluation, locator: { ...evaluation.locator, artifact_id: "aaa-evaluation-alias" } }
    const observations = groupEvolutionMeasurements([run, aliasRun, run]).get("case-1:candidate:0")!
    expect(observations.map((aliases) => aliases.map((item) => item.locator.artifact_id))).toEqual([
      ["aaa-run-alias", run.locator.artifact_id],
    ])
    const withAliases = { ...input, runs: [...input.runs, aliasRun], evaluations: [...input.evaluations, aliasEvaluation] }
    expect(deriveComparisonRecommendation(withAliases)).toEqual(expected)
    const originalReview = input.reviews.find((item) => item.value.arm === "candidate")!
    const aliasReview = { locator: { ...originalReview.locator, artifact_id: "review-of-alias" }, value: {
      ...originalReview.value, evaluation_result_locator: aliasEvaluation.locator,
      findings: [{ category: "security" as const, invariant: "Alias evidence still requires independent review", outcome: "failed" as const,
        evidence: [aliasEvaluation.locator], severity: "blocker" as const, owner: "evolution-safety-auditor", correction: "Resolve the observed defect." }],
    } }
    expect(deriveComparisonRecommendation({ ...withAliases, reviews: [...input.reviews, aliasReview] }).recommendation).toBe("inconclusive")
  })

  test.each(["cost", "tokens", "trial", "terminal"] as const)("keeps different run %s facts as conflicting observations", (field) => {
    const input = comparisonInputs([{ id: "quality", weight: 1, baseline: [0.2, 0.2], candidate: [0.8, 0.8] }])
    const original = input.runs[0]!
    const value = { ...original.value }
    if (field === "cost") value.cost = null
    if (field === "tokens") value.token_usage += 20
    if (field === "trial") value.task_id = "different-trial"
    if (field === "terminal") value.terminal_time += 1
    const changed = { value, locator: { ...original.locator, artifact_id: "different-run-observation" } }
    expect(groupEvolutionMeasurements([original, changed]).get("case-1:baseline:0")!.length).toBe(2)
    expect(() => deriveComparisonRecommendation({ ...input, runs: [...input.runs, changed] })).toThrow(
      "comparison has conflicting run observations for slot case-1:baseline:0",
    )
  })

  test("keeps a different metric receipt distinct even if the reported values agree", () => {
    const input = comparisonInputs([{ id: "quality", weight: 1, baseline: [0.2, 0.2], candidate: [0.8, 0.8] }])
    const original = input.evaluations[0]!
    const changed = { locator: { ...original.locator, artifact_id: "another-measurement" }, value: {
      ...original.value, metric_receipt_resource: { ...original.value.metric_receipt_resource, sha256: "1".repeat(64) },
    } }
    expect(() => deriveComparisonRecommendation({ ...input, evaluations: [...input.evaluations, changed] })).toThrow(
      "comparison has conflicting evaluation observations for slot case-1:baseline:0",
    )
  })
  const findingCategories = ["evidence_integrity", "reward_hacking", "permission", "side_effect", "security"] as const
  const improvedScores = [{ id: "correctness", weight: 1, baseline: [0.2, 0.2, 0.2], candidate: [0.8, 0.8, 0.8] }]
  function finding(
    category: IntegrityFinding["category"],
    outcome: IntegrityFinding["outcome"],
    severity: IntegrityFinding["severity"],
  ): IntegrityFinding {
    return {
      category,
      outcome,
      severity,
      invariant: "declared audit dimension",
      evidence: [locator],
      owner: "evolution-safety-auditor",
      correction: null,
    }
  }

  test("consumes both independent reviews of one measured slot", () => {
    const input = comparisonInputs(improvedScores, { candidateFinding: finding("security", "unavailable", "blocker") })
    const prior = input.reviews.find((item) => item.value.arm === "candidate" && item.value.repetition === 0)!
    input.reviews.push({
      locator: { ...prior.locator, artifact_id: "review-parallel" },
      value: { ...prior.value, findings: [] },
    })
    const result = deriveComparisonRecommendation(input)
    expect(result.recommendation).toBe("inconclusive")
    expect(result.required_unavailable_dimensions).toEqual([
      "integrity_finding:case-1:candidate:0:review-candidate-0:security:0",
    ])
    expect(resolveEvolutionIntegrityReviews(input.reviews).current).toHaveLength(7)
  })

  test("an explicit same-evidence revision supersedes both prior review branches", () => {
    const input = comparisonInputs(improvedScores, { candidateFinding: finding("security", "failed", "blocker") })
    const prior = input.reviews.find((item) => item.value.arm === "candidate" && item.value.repetition === 0)!
    const parallel = {
      locator: { ...prior.locator, artifact_id: "review-parallel" },
      value: { ...prior.value, findings: [finding("permission", "unavailable", "blocker")] },
    }
    const revised = {
      locator: { ...prior.locator, artifact_id: "review-corrected" },
      value: {
        ...prior.value,
        findings: [finding("security", "passed", "blocker")],
        revision: {
          supersedes: [prior.locator, parallel.locator],
          reason:
            "Re-deriving the declared boundaries from the same immutable evidence corrects both earlier interpretations.",
        },
      },
    }
    input.reviews.push(parallel, revised)
    const result = deriveComparisonRecommendation(input)
    expect(result.recommendation).toBe("promote")
    expect(result.aggregate_score).toBeCloseTo(0.6)
    expect(result.required_unavailable_dimensions).toEqual([])
    const lineage = resolveEvolutionIntegrityReviews(input.reviews)
    expect(lineage.current.map((item) => item.locator.artifact_id)).toContain("review-corrected")
    expect(lineage.superseded.map((item) => item.locator.artifact_id)).toEqual([
      "review-candidate-0",
      "review-parallel",
    ])
    expect(deriveComparisonRecommendation({ ...input, reviews: [...input.reviews].reverse() })).toEqual(result)
  })

  test("a remaining independent branch contributes its unresolved blocker after another branch is revised", () => {
    const input = comparisonInputs(improvedScores, { candidateFinding: finding("security", "failed", "blocker") })
    const prior = input.reviews.find((item) => item.value.arm === "candidate" && item.value.repetition === 0)!
    input.reviews.push({
      locator: { ...prior.locator, artifact_id: "review-parallel" },
      value: { ...prior.value, findings: [finding("permission", "unavailable", "blocker")] },
    })
    input.reviews.push({
      locator: { ...prior.locator, artifact_id: "review-corrected" },
      value: {
        ...prior.value,
        findings: [],
        revision: { supersedes: [prior.locator], reason: "The prior logic used an inapplicable condition." },
      },
    })
    const result = deriveComparisonRecommendation(input)
    expect(result.recommendation).toBe("inconclusive")
    expect(result.required_unavailable_dimensions).toEqual([
      "integrity_finding:case-1:candidate:0:review-parallel:permission:0",
    ])
  })

  test.each(["missing_parent", "different_evaluation", "cycle", "duplicate_parent"] as const)(
    "reports exact %s review lineage",
    (code) => {
      const input = comparisonInputs(improvedScores)
      const prior = input.reviews[0]!
      const revised = {
        locator: { ...prior.locator, artifact_id: "review-revision" },
        value: {
          ...prior.value,
          revision: { supersedes: [prior.locator], reason: "Reconsider prior evidence." },
        },
      }
      if (code === "missing_parent") revised.value.revision.supersedes = [{ ...locator, artifact_id: "review-missing" }]
      if (code === "different_evaluation") revised.value.repetition = prior.value.repetition + 1
      if (code === "cycle") revised.value.revision.supersedes = [revised.locator]
      if (code === "duplicate_parent") revised.value.revision.supersedes = [prior.locator, prior.locator]
      try {
        resolveEvolutionIntegrityReviews([...input.reviews, revised])
        throw new Error("Expected the exact declared lineage error")
      } catch (error) {
        expect(error).toBeInstanceOf(EvolutionReviewLineageError)
        expect((error as EvolutionReviewLineageError).code).toBe(code)
      }
    },
  )

  test.each(findingCategories)("completed review with passed %s blocker supports promotion", (category) => {
    const result = comparisonFor(improvedScores, { candidateFinding: finding(category, "passed", "blocker") })
    expect(result.recommendation).toBe("promote")
    expect(result.aggregate_score).toBeCloseTo(0.6)
  })

  test.each(findingCategories)(
    "completed review with failed %s blocker yields an inconclusive recommendation",
    (category) => {
      const result = comparisonFor(improvedScores, { candidateFinding: finding(category, "failed", "blocker") })
      expect(result.recommendation).toBe("inconclusive")
      expect(result.aggregate_score).toBeCloseTo(0.6)
      expect(result.paired_deltas[0]!.mean).toBeCloseTo(0.6)
    },
  )

  test.each(findingCategories)(
    "completed review with unavailable %s blocker exposes its required dimension",
    (category) => {
      const result = comparisonFor(improvedScores, { candidateFinding: finding(category, "unavailable", "blocker") })
      const dimension = `integrity_finding:case-1:candidate:0:review-candidate-0:${category}:0`
      expect(result.recommendation).toBe("inconclusive")
      expect(result.aggregate_score).toBeNull()
      expect(result.required_unavailable_dimensions).toEqual([dimension])
      expect(result.unavailable_dimensions).toEqual([dimension])
    },
  )

  test.each(["evidence_integrity", "permission", "side_effect", "security"] as const)(
    "a nonblocking %s warning retains the measured promotion decision",
    (category) => {
      const result = comparisonFor(improvedScores, { candidateFinding: finding(category, "failed", "warning") })
      expect(result.recommendation).toBe("promote")
      expect(result.aggregate_score).toBeCloseTo(0.6)
      // An observed failure is not an unobserved dimension.
      expect(result.unavailable_dimensions).toEqual([])
    },
  )

  test.each(findingCategories)(
    "an unavailable nonblocking %s observation is reported without blocking the measured promotion",
    (category) => {
      const result = comparisonFor(improvedScores, { candidateFinding: finding(category, "unavailable", "warning") })
      expect(result.recommendation).toBe("promote")
      expect(result.aggregate_score).toBeCloseTo(0.6)
      expect(result.unavailable_dimensions).toEqual([
        `integrity_finding:case-1:candidate:0:review-candidate-0:${category}:0`,
      ])
      expect(result.required_unavailable_dimensions).toEqual([])
    },
  )

  test("a completed review with no findings is the auditor's claim that nothing needed reporting", () => {
    const result = comparisonFor(improvedScores, {
      candidateReview: { status: "reviewed", findings: [], accepted_limitations: [], unknowns: [] },
    })
    expect(result.recommendation).toBe("promote")
    expect(result.unavailable_dimensions).toEqual([])
    expect(result.unknowns).toEqual([])
  })

  test("every applicable category passed with cited evidence supports promotion", () => {
    const result = comparisonFor(improvedScores, {
      candidateReview: {
        status: "reviewed",
        findings: findingCategories.map((category) => finding(category, "passed", "info")),
        accepted_limitations: [],
        unknowns: [],
      },
    })
    expect(result.recommendation).toBe("promote")
    expect(result.unavailable_dimensions).toEqual([])
  })

  test("an inapplicable category stated as an accepted limitation is reported rather than treated as unobserved", () => {
    const limitation = "side_effect not applicable: the frozen case grants no external action"
    const result = comparisonFor(improvedScores, {
      candidateReview: {
        status: "reviewed",
        findings: findingCategories
          .filter((category) => category !== "side_effect")
          .map((category) => finding(category, "passed", "info")),
        accepted_limitations: [limitation],
        unknowns: [],
      },
    })
    expect(result.recommendation).toBe("promote")
    expect(result.unavailable_dimensions).toEqual([])
    expect(result.unknowns).toEqual([limitation])
  })

  test("an unavailable review is required unavailable and carries the auditor's stated reason", () => {
    const reason = "Trial tool inputs were not disclosed, so external side effects could not be observed"
    const result = comparisonFor(improvedScores, {
      candidateReview: { status: "unavailable", findings: [], accepted_limitations: [], unknowns: [reason] },
    })
    expect(result.recommendation).toBe("inconclusive")
    expect(result.aggregate_score).toBeNull()
    expect(result.required_unavailable_dimensions).toEqual(["integrity_review:case-1:candidate:0"])
    expect(result.unknowns).toEqual([reason])
  })

  test("a slot without any review is a required unavailable dimension", () => {
    const result = comparisonFor(improvedScores, { candidateReview: null })
    expect(result.recommendation).toBe("inconclusive")
    expect(result.required_unavailable_dimensions).toEqual(["integrity_review:case-1:candidate:0"])
  })

  test("reconstructs the complete case, arm, repetition, and scorer matrix", () => {
    const comparison = comparisonFor([{ id: "correctness", weight: 1, baseline: [0.8], candidate: [0.9] }])

    expect(comparison).toEqual({
      baseline_revision: baselineRevision,
      candidate_revision: candidateRevision,
      paired_deltas: [
        {
          scorer_id: "correctness",
          mean: 0.09999999999999998,
          median: 0.09999999999999998,
          variance: 0,
          confidence_interval: {
            confidence: 0.95,
            lower: 0.09999999999999998,
            upper: 0.09999999999999998,
          },
          win_tie_loss: { wins: 1, ties: 0, losses: 0 },
        },
      ],
      cost_delta: 0.19999999999999996,
      token_delta: 10,
      activity_duration_ms_delta: 100,
      outcome_rates: {
        baseline: { failure: 0, unavailable: 0 },
        candidate: { failure: 0, unavailable: 0 },
      },
      aggregate_score: 0.09999999999999998,
      // One measurement per arm supports a point estimate and no interval.
      aggregate_interval: null,
      regressions: [],
      unavailable_dimensions: [],
      required_unavailable_dimensions: [],
      unknowns: [],
      visual_review: { status: "not_applicable", evidence: [] },
      reward_hacking_review: { findings: [], evidence: [] },
      confidence: "low",
      recommendation: "retain",
    })
  })

  test("promotes a consistent improvement measured enough times to bound it", () => {
    const comparison = comparisonFor([
      { id: "correctness", weight: 1, baseline: [0.8, 0.8, 0.8, 0.8], candidate: [0.9, 0.9, 0.9, 0.9] },
    ])

    expect(comparison.recommendation).toBe("promote")
    expect(comparison.confidence).toBe("high")
    expect(comparison.regressions).toEqual([])
    expect(comparison.aggregate_interval?.lower).toBeGreaterThan(0)
  })

  test("a measured candidate slot with an unavailable Trial outcome is inconclusive", () => {
    const comparison = comparisonFor(
      [{ id: "correctness", weight: 1, baseline: [0.8, 0.8, 0.8, 0.8], candidate: [0.9, 0.9, 0.9, 0.9] }],
      { candidateFirstRunOutcome: "unavailable" },
    )

    expect(comparison.outcome_rates.candidate).toEqual({ failure: 0, unavailable: 0.25 })
    expect(comparison.paired_deltas[0]!.mean).toBeCloseTo(0.1)
    expect(comparison.required_unavailable_dimensions).toEqual(["run_outcome:case-1:candidate:0"])
    expect(comparison.unavailable_dimensions).toEqual(["run_outcome:case-1:candidate:0"])
    expect(comparison.aggregate_score).toBeNull()
    expect(comparison.recommendation).toBe("inconclusive")
  })

  test("a failed candidate Trial remains a measured failure rather than an unavailable Trial", () => {
    const comparison = comparisonFor(
      [{ id: "correctness", weight: 1, baseline: [0.8, 0.8, 0.8, 0.8], candidate: [0.9, 0.9, 0.9, 0.9] }],
      { candidateFirstRunOutcome: "failure" },
    )

    expect(comparison.outcome_rates.candidate).toEqual({ failure: 0.25, unavailable: 0 })
    expect(comparison.aggregate_score).toBeCloseTo(0.1)
    expect(comparison.required_unavailable_dimensions).toEqual([])
    expect(comparison.recommendation).toBe("retain")
  })

  test("unpriced Trial cost keeps the cost delta unknown while preserving measured quality", () => {
    const comparison = comparisonFor(
      [{ id: "correctness", weight: 1, baseline: [0.8, 0.8, 0.8, 0.8], candidate: [0.9, 0.9, 0.9, 0.9] }],
      { candidateFirstRunCost: null },
    )

    expect(comparison.cost_delta).toBeNull()
    expect(comparison.unavailable_dimensions).toEqual(["cost_delta"])
    expect(comparison.aggregate_score).toBeCloseTo(0.1)
    expect(comparison.recommendation).toBe("promote")
  })

  test("a Trial served by another model cannot enter the frozen-model comparison", () => {
    expect(() => comparisonFor(improvedScores, { candidateFirstRunModel: "openai/gpt-5.6-luna" })).toThrow(
      "comparison run slot case-1:candidate:0 differs from the frozen Campaign runtime",
    )
  })

  test("reports not_applicable visual review for a nonvisual Campaign", () => {
    // `ui_rubric_digest` is the digest of the first `judge` scorer's resource,
    // so a Campaign that declares a judge scorer for something other than UI —
    // code quality, say — used to set it, take the `unavailable` branch for
    // want of any `visual-feedback-verification` scorer, and sit at
    // `inconclusive` no matter how the measurements came out. The gate applies
    // when there are visual scorers to review, and not otherwise.
    const comparison = comparisonFor(
      [{ id: "correctness", weight: 1, baseline: [0.8, 0.8, 0.8, 0.8], candidate: [0.9, 0.9, 0.9, 0.9] }],
      { uiRubricDigest: resourceDigest },
    )

    expect(comparison.visual_review).toEqual({ status: "not_applicable", evidence: [] })
    expect(comparison.recommendation).toBe("promote")
  })

  test("retains the baseline when a positive mean interval spans zero", () => {
    // Mean delta is +0.05 across four repetitions, so the old rule promoted.
    // The spread is far wider than the effect, so the interval covers zero.
    const comparison = comparisonFor([
      { id: "correctness", weight: 1, baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.9, 0.2, 0.9, 0.2] },
    ])

    expect(comparison.aggregate_score).toBeGreaterThan(0)
    expect(comparison.aggregate_interval!.lower).toBeLessThan(0)
    expect(comparison.recommendation).toBe("retain")
    expect(comparison.confidence).toBe("low")
  })

  test("counts a scorer as regressed only when its whole interval sits below zero", () => {
    // A consistent decline is confirmed; a noisy dip of the same sign is not.
    const confirmed = comparisonFor([
      { id: "quality", weight: 1, baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.9, 0.9, 0.9, 0.9] },
      { id: "safety", weight: 1, baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.4, 0.4, 0.4, 0.4] },
    ])
    expect(confirmed.regressions).toEqual(["safety"])
    expect(confirmed.recommendation).toBe("retain")

    const noisy = comparisonFor([
      { id: "quality", weight: 1, baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.9, 0.9, 0.9, 0.9] },
      { id: "safety", weight: 1, baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.3, 0.6, 0.3, 0.6] },
    ])
    expect(noisy.regressions).toEqual([])
  })

  test("declared scorer weights change the recommendation", () => {
    // Identical measurements in both campaigns: a large consistent gain on one
    // scorer and a small noisy dip on the other. Only the declared weights
    // differ. Under the previous rule the noisy dip vetoed both regardless of
    // weight, which is exactly how the weights became decorative.
    const quality = { id: "quality", baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.9, 0.9, 0.9, 0.9] }
    const noise = { id: "noise", baseline: [0.5, 0.5, 0.5, 0.5], candidate: [0.3, 0.6, 0.3, 0.6] }

    const qualityLed = comparisonFor([
      { ...quality, weight: 4 },
      { ...noise, weight: 1 },
    ])
    const noiseLed = comparisonFor([
      { ...quality, weight: 1 },
      { ...noise, weight: 4 },
    ])

    expect(qualityLed.recommendation).toBe("promote")
    expect(noiseLed.recommendation).toBe("retain")
    expect(qualityLed.aggregate_interval!.lower).toBeGreaterThan(0)
    expect(noiseLed.aggregate_interval!.lower).toBeLessThan(0)
    expect(qualityLed.regressions).toEqual([])
    expect(noiseLed.regressions).toEqual([])
  })
})
