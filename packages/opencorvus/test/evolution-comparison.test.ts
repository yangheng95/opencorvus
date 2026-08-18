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
function comparisonFor(scorers: ScorerSpec[], options?: { uiRubricDigest?: string | null }) {
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
    indices.map((repetition) => ({
      locator,
      value: EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse({
        case_id: "case-1",
        arm,
        repetition,
        evaluation_result_locator: locator,
        status: "reviewed",
        findings: [],
        accepted_limitations: [],
        unknowns: [],
      }),
    })),
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
        model: "provider/model",
        environment_digest: resourceDigest,
        token_usage: arm === "baseline" ? 100 : 110,
        cost: arm === "baseline" ? 1 : 1.2,
        last_activity_at: "2026-08-07T00:00:00.000Z",
        outcome: "success",
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

  return deriveComparisonRecommendation({
    campaign,
    candidate,
    campaignLocator: locator,
    candidateLocator: locator,
    evaluations,
    reviews,
    runs,
  })
}

describe("Evolution Lab deterministic comparison", () => {
  test("reconstructs the complete case, arm, repetition, and scorer matrix", () => {
    const comparison = comparisonFor([
      { id: "correctness", weight: 1, baseline: [0.8], candidate: [0.9] },
    ])

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

  test("does not open the visual gate for a Campaign that declares no visual scorer", () => {
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

  test("does not promote a positive mean whose interval still spans zero", () => {
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
