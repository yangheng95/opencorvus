import { describe, expect, test } from "bun:test"
import { deriveComparisonRecommendation } from "../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison"
import { EvolutionArtifactSchemas } from "../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/artifacts"

describe("Evolution Lab deterministic comparison", () => {
  test("reconstructs the complete case, arm, repetition, and scorer matrix", () => {
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
    const scorer = {
      scorer_id: "correctness",
      scorer_revision: resourceDigest,
      scope: "global" as const,
      goal_id: null,
      description: "Exact correctness ratio",
      unit: "ratio",
      direction: "higher_better" as const,
      target: 1,
      floor: 0,
      weight: 1,
      observation_class: "quality" as const,
      evaluator_kind: "query" as const,
      evaluator_config: {
        scorer_revision: resourceDigest,
        query: "constant_value" as const,
        value: 1,
      },
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
      scorers: [scorer],
      frozen_inputs: {
        dataset: resource,
        cases: [{ case_id: "case-1", resource }],
        model_configuration: resource,
        environment: resource,
        workspace_template: resource,
        permission_snapshot: resource,
        scorer_assets: [{ scorer_id: "correctness", scorer_revision: resourceDigest, resource }],
      },
      model: "provider/model",
      model_configuration_digest: resourceDigest,
      environment_digest: resourceDigest,
      workspace_digest: resourceDigest,
      permission_snapshot_digest: resourceDigest,
      external_side_effect_policy: "No production side effects",
      repetitions: 1,
      arm_order: ["baseline", "candidate"],
      statistics: "paired deterministic comparison",
      budget: { max_runs: 2, max_cost: 10 },
      inactivity_timeout_ms: 60_000,
      ui_rubric_digest: null,
      mutable_paths: ["README.md"],
      trial_execution: { status: "available", installation_scope: "project" },
    })
    const candidate = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
      development_campaign_locator: locator,
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
    const evaluation = (arm: "baseline" | "candidate", value: number, digest: string) =>
      EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse({
        case_id: "case-1",
        arm,
        repetition: 0,
        scorers: [{ scorer_id: "correctness", status: "measured", value, evidence: [locator] }],
        trial_task_id: `task-${arm}`,
        trial_revision_digest: digest,
        campaign_spec_locator: locator,
        candidate_revision_locator: arm === "candidate" ? locator : null,
        run_evidence_locator: locator,
        metric_receipt_resource: resource,
        integrity_review: { status: "reviewed", findings: [], accepted_limitations: [], unknowns: [] },
      })
    const run = (
      arm: "baseline" | "candidate",
      digest: string,
      cost: number,
      tokens: number,
      duration: number,
    ) =>
      EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse({
        case_id: "case-1",
        arm,
        repetition: 0,
        workspace_digest: resourceDigest,
        run_evidence_sha256: resourceDigest,
        run_evidence_resource: resource,
        task_id: `task-${arm}`,
        terminal_time: 1,
        model: "provider/model",
        environment_digest: resourceDigest,
        token_usage: tokens,
        cost,
        last_activity_at: "2026-08-07T00:00:00.000Z",
        outcome: "success",
        activity_duration_ms: duration,
        revision_equality: {
          installed: digest,
          expected: digest,
          task_binding: digest,
          workflow_binding: digest,
          runtime_snapshot: digest,
        },
      })
    const comparison = deriveComparisonRecommendation({
      campaign,
      candidate,
      campaignLocator: locator,
      candidateLocator: locator,
      evaluations: [
        { locator, value: evaluation("baseline", 0.8, baselineDigest) },
        { locator, value: evaluation("candidate", 0.9, candidateDigest) },
      ],
      runs: [
        { locator, value: run("baseline", baselineDigest, 1, 100, 1_000) },
        { locator, value: run("candidate", candidateDigest, 1.2, 110, 1_100) },
      ],
    })
    expect(comparison).toEqual({
      baseline_revision: baselineRevision,
      candidate_revision: candidateRevision,
      paired_deltas: [{
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
      }],
      cost_delta: 0.19999999999999996,
      token_delta: 10,
      activity_duration_ms_delta: 100,
      outcome_rates: {
        baseline: { failure: 0, unavailable: 0 },
        candidate: { failure: 0, unavailable: 0 },
      },
      aggregate_score: 0.09999999999999998,
      regressions: [],
      unavailable_dimensions: [],
      required_unavailable_dimensions: [],
      unknowns: [],
      visual_review: { status: "not_applicable", evidence: [] },
      reward_hacking_review: { findings: [], evidence: [] },
      confidence: "medium",
      recommendation: "promote",
    })
  })
})
