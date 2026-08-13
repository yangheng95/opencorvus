
import { describe, expect, test } from "bun:test"
import { EngineArtifactEnvelopeSchema, EvolutionArtifactSchemas } from "@opencorvus-ai/plugin"
import { deriveComparisonRecommendation } from "../../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison"
import {
  assertRandomEvolutionCampaignContract,
  eligibleRandomEvolutionTargets,
  evolutionTargetLineageInstructions,
  isolatedProviderHandoff,
  missionCollectionRoute,
  missionAbortRequest,
  settleOperationWithinDeadline,
  settleFailureAfterBoundedAbort,
  observeActivityDeadline,
  selectRandomEvolutionTarget,
  summarizeEvolutionRequests,
  summarizeEvolutionEvidence,
  recommendationInteractiveArtifactIDs,
  positiveIntegerSetting,
  summarizeArtifactFailureTransitions,
  summarizeConversationFailureTransitions,
  taskRoute,
  type EvolutionArtifactFact,
  type MarketEntry,
} from "../../script/expert-squad-evolution-e2e-support"

function marketEntry(id: string, installationScopes: string[] = []): MarketEntry {
  return {
    namespace: "builtin",
    id,
    name: id,
    label: id,
    description: `${id} description`,
    version: "1.0.0",
    installation_scopes: installationScopes,
  }
}

describe("random Expert Squad evolution controller contracts", () => {
  test("freezes explicit isolated Provider handoff and exact target-lineage instructions", () => {
    expect(isolatedProviderHandoff({ copyAuth: true, copyModels: false })).toEqual({ auth: true, models: false })
    expect(isolatedProviderHandoff({ copyAuth: false, copyModels: true })).toEqual({ auth: false, models: true })
    expect(evolutionTargetLineageInstructions()).toEqual([
      "Treat the complete target identity above as one immutable tuple; preserve every character of project_id,",
      "project_directory, namespace, id, incumbent package digest, and Evolution Lab digest in every downstream Task.",
      "Never abbreviate, reconstruct, normalize, or copy these identifiers from prose; use the exact frozen values.",
      "If an exact target identity is unavailable, publish typed-unavailable evidence instead of inventing or weakening it.",
    ])
  })

  test("returns a typed resource deadline while the owned cleanup operation remains unsettled", async () => {
    const events: string[] = []
    const result = await settleOperationWithinDeadline({
      operation: async () => {
        events.push("cleanup-started")
        await new Promise<void>(() => {})
      },
      timeoutMs: 10,
      label: "Evolution E2E resource settlement",
    })

    expect({ result, events }).toEqual({
      result: {
        status: "timed_out",
        error: "Evolution E2E resource settlement did not settle within 10ms",
      },
      events: ["cleanup-started"],
    })
  })

  test("settles failure resources after a Mission abort stops making progress", async () => {
    const events: string[] = []
    const result = await settleFailureAfterBoundedAbort({
      abortMission: async (signal) => {
        events.push("abort-started")
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
        await new Promise<void>(() => {})
      },
      abortTimeoutMs: 10,
      settleResources: async () => {
        events.push("resources-settled")
      },
    })

    expect({ result, events }).toEqual({
      result: { abortStatus: "timed_out" },
      events: ["abort-started", "resources-settled"],
    })
  })

  test("finds recommendation renderings from the transcript message info Session identity", () => {
    expect(
      recommendationInteractiveArtifactIDs(
        [
          {
            info: { sessionID: "ses_recommendation" },
            parts: [
              { type: "interactive-artifact", artifactID: "artifact-document" },
              { type: "text", text: "done" },
              { type: "interactive-artifact", artifactID: "artifact-chart" },
            ],
          },
          {
            info: { sessionID: "ses_other" },
            parts: [{ type: "interactive-artifact", artifactID: "artifact-other" }],
          },
        ],
        "ses_recommendation",
      ),
    ).toEqual(["artifact-document", "artifact-chart"])
  })

  test("uses a bounded positive real-page action deadline", () => {
    expect(positiveIntegerSetting(undefined, 1_800_000, "ACTION_MS")).toBe(1_800_000)
    expect(positiveIntegerSetting(" 42000 ", 1_800_000, "ACTION_MS")).toBe(42_000)
  })

  test("retains the first typed Artifact failure across later current-row settlement", () => {
    expect(
      summarizeArtifactFailureTransitions([
        {
          artifact_id: "art_wake",
          task_id: "tsk_1",
          kind: "queued_operator_wake",
          label: "delivery_failed",
          catalog_revision: 43,
          time_updated: 43_000,
          payload: {
            delivery_result: {
              status: "delivery_failed",
              error_name: "QueuedWakeSettlementError",
              message: "completed without a final assistant message",
            },
          },
        },
        {
          artifact_id: "art_wake",
          task_id: "tsk_1",
          kind: "queued_operator_wake",
          label: "drained",
          catalog_revision: 45,
          time_updated: 45_000,
          payload: { delivery_result: { status: "terminal_inapplicable" } },
        },
      ]),
    ).toEqual({
      count: 1,
      first: {
        artifact_id: "art_wake",
        task_id: "tsk_1",
        kind: "queued_operator_wake",
        label: "delivery_failed",
        catalog_revision: 43,
        time_updated: 43_000,
        error_name: "QueuedWakeSettlementError",
        message: "completed without a final assistant message",
      },
      tail: [
        {
          artifact_id: "art_wake",
          task_id: "tsk_1",
          kind: "queued_operator_wake",
          label: "delivery_failed",
          catalog_revision: 43,
          time_updated: 43_000,
          error_name: "QueuedWakeSettlementError",
          message: "completed without a final assistant message",
        },
      ],
    })
  })
  test("retains a bounded tool-stream failure transition without serializing tool input", () => {
    expect(
      summarizeConversationFailureTransitions([
        {
          part_id: "prt_stalled",
          message_id: "msg_stalled",
          session_id: "ses_mission",
          time_created: 1_000,
          time_updated: 601_000,
          part_data: {
            type: "tool",
            tool: "panel",
            state: {
              status: "error",
              input: { confidential: "must-not-enter-result" },
              raw: "",
              failure: { name: "MessageAbortedError", message: "Mission inactivity deadline exceeded" },
            },
          },
          message_data: { finish: "error" },
        },
      ]),
    ).toEqual({
      count: 1,
      first: {
        part_id: "prt_stalled",
        message_id: "msg_stalled",
        session_id: "ses_mission",
        tool: "panel",
        status: "error",
        time_created: 1_000,
        time_updated: 601_000,
        raw_bytes: 0,
        raw_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        message_finish: "error",
        failure_name: "MessageAbortedError",
        failure_message: "Mission inactivity deadline exceeded",
      },
      tail: [
        {
          part_id: "prt_stalled",
          message_id: "msg_stalled",
          session_id: "ses_mission",
          tool: "panel",
          status: "error",
          time_created: 1_000,
          time_updated: 601_000,
          raw_bytes: 0,
          raw_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          message_finish: "error",
          failure_name: "MessageAbortedError",
          failure_message: "Mission inactivity deadline exceeded",
        },
      ],
    })
  })
  test("projects Task routes and Mission cancellation provenance onto the public API contract", () => {
    expect(taskRoute("task/with spaces")).toBe("/task/task%2Fwith%20spaces")
    expect(taskRoute("task/with spaces", "interactions")).toBe("/task/task%2Fwith%20spaces/interactions")
    expect(taskRoute("task/with spaces", "transcript")).toBe("/task/task%2Fwith%20spaces/transcript")
    expect(taskRoute("task/with spaces", "turn-artifacts")).toBe("/task/task%2Fwith%20spaces/turn-artifacts")
    expect(taskRoute("task/with spaces", "artifact-read")).toBe("/task/task%2Fwith%20spaces/artifact-read")
    expect(missionCollectionRoute("C:\\random project", 20)).toBe("/mission?directory=C%3A%5Crandom+project&limit=20")
    expect(missionAbortRequest("controller failure")).toEqual({
      surface: "api",
      reason: "controller failure",
    })
  })

  test("builds the eligible Market pool and selects a reproducible unbiased index", () => {
    const market = [
      marketEntry("squad-sdk"),
      marketEntry("zeta-domain"),
      marketEntry("alpha-domain"),
      marketEntry("installed-domain", ["project"]),
      marketEntry("evolution-lab"),
    ]
    expect(eligibleRandomEvolutionTargets(market).map((entry) => entry.id)).toEqual(["alpha-domain", "zeta-domain"])
    expect(selectRandomEvolutionTarget(market, "01".repeat(32))).toEqual({
      algorithm: "sha256-rejection-v1",
      seedHex: "01".repeat(32),
      poolSHA256: "208896ef175a336c561ca844d01f950f0e17764c85bec93c31349d8685a9a92f",
      poolCount: 2,
      counter: 0,
      index: 0,
      selected: marketEntry("alpha-domain"),
    })
  })

  test("advances the inactivity deadline only when the durable activity scope changes", () => {
    const first = observeActivityDeadline({
      activitySHA256: "a".repeat(64),
      observedAtMs: 1_000,
      inactivityWindowMs: 600_000,
    })
    expect(first).toEqual({ activitySHA256: "a".repeat(64), deadlineMs: 601_000 })
    expect(
      observeActivityDeadline({
        previous: first,
        activitySHA256: "a".repeat(64),
        observedAtMs: 2_000,
        inactivityWindowMs: 600_000,
      }),
    ).toEqual(first)
    expect(
      observeActivityDeadline({
        previous: first,
        activitySHA256: "b".repeat(64),
        observedAtMs: 3_000,
        inactivityWindowMs: 600_000,
      }),
    ).toEqual({ activitySHA256: "b".repeat(64), deadlineMs: 603_000 })
  })

  test("summarizes polling traffic into deterministic bounded audit evidence", () => {
    expect(
      summarizeEvolutionRequests([
        { method: "GET", route: "/mission/m1/status", status: 200, durationMs: 7 },
        { method: "GET", route: "/mission/m1/status", status: 200, durationMs: 3 },
        { method: "POST", route: "/mission/wake", status: 200, durationMs: 11 },
      ]),
    ).toEqual({
      total: 3,
      groups: [
        {
          method: "GET",
          route: "/mission/m1/status",
          status: 200,
          count: 2,
          total_duration_ms: 10,
          max_duration_ms: 7,
        },
        {
          method: "POST",
          route: "/mission/wake",
          status: 200,
          count: 1,
          total_duration_ms: 11,
          max_duration_ms: 11,
        },
      ],
      tail: [
        { method: "GET", route: "/mission/m1/status", status: 200, durationMs: 7 },
        { method: "GET", route: "/mission/m1/status", status: 200, durationMs: 3 },
        { method: "POST", route: "/mission/wake", status: 200, durationMs: 11 },
      ],
    })
  })

  test("summarizes a complete incumbent-challenger Artifact graph", () => {
    const taskID = "task-evolution"
    const digest = (character: string) => character.repeat(64)
    const locator = (id: string, character: string) => ({
      source: "engine_artifact" as const,
      artifact_id: id,
      catalog_revision: 1,
      expected_sha256: digest(character),
    })
    const locations = {
      opportunity: locator("opportunity", "1"),
      attribution: locator("attribution", "2"),
      campaign: locator("campaign", "3"),
      candidate: locator("candidate", "4"),
      baselineRun: locator("baseline-run", "5"),
      candidateRun: locator("candidate-run", "6"),
      baselineEvaluation: locator("baseline-evaluation", "7"),
      candidateEvaluation: locator("candidate-evaluation", "8"),
      recommendation: locator("recommendation", "9"),
    }
    const baselineRevision = {
      namespace: "builtin",
      id: "target",
      version: "2026.08.12.1",
      package_digest: digest("a"),
    }
    const candidateRevision = {
      ...baselineRevision,
      version: "2026.08.12.2",
      package_digest: digest("b"),
    }
    const resource = {
      path: "evolution/fixture.json",
      media_type: "application/json" as const,
      bytes: 2,
      sha256: digest("c"),
    }
    const scorer = {
      scorer_id: "quality",
      scorer_revision: digest("d"),
      scope: "global" as const,
      goal_id: null,
      description: "Decision quality",
      unit: "ratio",
      direction: "higher_better" as const,
      target: 0.8,
      floor: 0.6,
      weight: 1,
      observation_class: "quality" as const,
      evaluator_kind: "query" as const,
      evaluator_config: {
        scorer_revision: digest("d"),
        query: "constant_value" as const,
        value: 1,
      },
    }
    const target = {
      scope: "project" as const,
      project_id: "project-1",
      project_directory: "C:/project-1",
      namespace: "builtin",
      id: "target",
    }
    const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
      target,
      baseline_revision: baselineRevision,
      candidate_version_policy: "increment revision",
      candidate_hypothesis: "Improve decision quality",
      dataset_partition: "development",
      dataset_digest: resource.sha256,
      cases: ["case-1"],
      scorer_digests: [scorer.scorer_revision],
      scorers: [scorer],
      frozen_inputs: {
        dataset: resource,
        cases: [{ case_id: "case-1", resource }],
        model_configuration: resource,
        environment: resource,
        workspace_template: resource,
        permission_snapshot: resource,
        scorer_assets: [
          {
            scorer_id: scorer.scorer_id,
            scorer_revision: scorer.scorer_revision,
            resource: {
              ...resource,
              sha256: scorer.scorer_revision,
            },
          },
        ],
      },
      model: "provider/model",
      model_configuration_digest: resource.sha256,
      environment_digest: resource.sha256,
      workspace_digest: resource.sha256,
      permission_snapshot_digest: resource.sha256,
      external_side_effect_policy: "none",
      repetitions: 1,
      arm_order: ["baseline", "candidate"],
      statistics: "paired deterministic comparison",
      budget: { max_runs: 2, max_cost: 10 },
      inactivity_timeout_ms: 60_000,
      ui_rubric_digest: null,
      mutable_paths: ["README.md"],
      trial_execution: { status: "available", installation_scope: "project" },
    })
    expect(
      assertRandomEvolutionCampaignContract(campaign, {
        caseID: "case-1",
        dataset: resource,
        caseResource: resource,
        modelConfiguration: resource,
        environment: resource,
        workspaceTemplate: resource,
        workspaceDigest: resource.sha256,
        permissionSnapshot: resource,
        scorerAsset: { ...resource, sha256: scorer.scorer_revision },
        scorerID: scorer.scorer_id,
        scorerRevision: scorer.scorer_revision,
        projectID: target.project_id,
        projectDirectory: target.project_directory,
        targetNamespace: target.namespace,
        targetID: target.id,
        baselineDigest: baselineRevision.package_digest,
        model: campaign.model,
        maxRuns: 2,
        maxCost: 10,
      }),
    ).toEqual(campaign)
    const candidate = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
      development_campaign_locator: locations.campaign,
      parent_revision: baselineRevision,
      candidate_revision: candidateRevision,
      parent_resources: [resource],
      candidate_resources: [resource],
      hypothesis: campaign.candidate_hypothesis,
      changed_paths: ["README.md"],
      diff_sha256: digest("e"),
      frozen_files: [],
      manager_receipt: {
        operation: "validated",
        namespace: candidateRevision.namespace,
        id: candidateRevision.id,
        version: candidateRevision.version,
        package_digest: candidateRevision.package_digest,
      },
      provenance: [locations.campaign],
    })
    const run = (arm: "baseline" | "candidate", revision: string, cost: number) =>
      EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse({
        case_id: "case-1",
        arm,
        repetition: 0,
        workspace_digest: resource.sha256,
        run_evidence_sha256: resource.sha256,
        run_evidence_resource: resource,
        task_id: `task-${arm}`,
        terminal_time: 1,
        model: campaign.model,
        environment_digest: campaign.environment_digest,
        token_usage: arm === "baseline" ? 100 : 110,
        cost,
        last_activity_at: "2026-08-12T00:00:00.000Z",
        outcome: "success",
        activity_duration_ms: arm === "baseline" ? 1_000 : 1_100,
        revision_equality: {
          installed: revision,
          expected: revision,
          task_binding: revision,
          workflow_binding: revision,
          runtime_snapshot: revision,
        },
      })
    const baselineRun = run("baseline", baselineRevision.package_digest, 1)
    const candidateRun = run("candidate", candidateRevision.package_digest, 1.2)
    const evaluation = (
      arm: "baseline" | "candidate",
      revision: string,
      runLocator: (typeof locations)["baselineRun"],
      value: number,
    ) =>
      EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse({
        case_id: "case-1",
        arm,
        repetition: 0,
        scorers: [{ scorer_id: scorer.scorer_id, status: "measured", value, evidence: [runLocator] }],
        trial_task_id: `task-${arm}`,
        trial_revision_digest: revision,
        campaign_spec_locator: locations.campaign,
        candidate_revision_locator: arm === "candidate" ? locations.candidate : null,
        run_evidence_locator: runLocator,
        metric_receipt_resource: resource,
        integrity_review: { status: "reviewed", findings: [], accepted_limitations: [], unknowns: [] },
      })
    const baselineEvaluation = evaluation("baseline", baselineRevision.package_digest, locations.baselineRun, 0.7)
    const candidateEvaluation = evaluation("candidate", candidateRevision.package_digest, locations.candidateRun, 0.9)
    const recommendation = deriveComparisonRecommendation({
      campaign,
      campaignLocator: locations.campaign,
      candidate,
      candidateLocator: locations.candidate,
      runs: [
        { locator: locations.baselineRun, value: baselineRun },
        { locator: locations.candidateRun, value: candidateRun },
      ],
      evaluations: [
        { locator: locations.baselineEvaluation, value: baselineEvaluation },
        { locator: locations.candidateEvaluation, value: candidateEvaluation },
      ],
    })
    const fact = (
      artifactType: keyof typeof EvolutionArtifactSchemas,
      artifactLocator: (typeof locations)[keyof typeof locations],
      payload: unknown,
      agentID: string,
      sources: Array<(typeof locations)[keyof typeof locations]> = [],
    ): EvolutionArtifactFact => ({
      taskID,
      locator: artifactLocator,
      envelope: EngineArtifactEnvelopeSchema.parse({
        artifact_type: artifactType,
        schema_version: 1,
        producer: {
          owner_kind: "projected-worker",
          expert_squad_id: "evolution-lab",
          package_revision: {
            scope: "built_in",
            project_id: null,
            namespace: "builtin",
            id: "evolution-lab",
            version: "2026.08.12.1",
            package_digest: digest("f"),
          },
          agent_id: agentID,
          projection_hash: digest("0"),
          session_id: "session-evolution",
          message_id: `message-${artifactLocator.artifact_id}`,
          tool_call_id: `tool-${artifactLocator.artifact_id}`,
        },
        payload,
        resources: [],
        observed_artifact_locators: sources,
        source_artifact_locators: sources,
      }),
    })
    const recommendationSources = [
      locations.campaign,
      locations.candidate,
      locations.baselineRun,
      locations.candidateRun,
      locations.baselineEvaluation,
      locations.candidateEvaluation,
    ]
    const facts: EvolutionArtifactFact[] = [
      fact(
        "evolution-lab/opportunity",
        locations.opportunity,
        {
          target,
          current_revision: baselineRevision,
          trigger: { type: "automation", identity: "random-evolution-e2e" },
          evidence: [],
          observable_symptom: "Decision package needs improvement",
          impact_scope: "Synthetic acceptance case",
          frequency: "once",
          data_window: { started_at: "2026-08-12T00:00:00.000Z", ended_at: "2026-08-12T00:01:00.000Z" },
          owner_hypothesis: campaign.candidate_hypothesis,
          unknowns: [],
          sensitivity: "synthetic",
          suggested_budget: { runs: 2, max_cost: 10 },
        },
        "evolution-opportunity-analyst",
      ),
      fact(
        "evolution-lab/failure-attribution",
        locations.attribution,
        {
          symptom: "Decision package needs improvement",
          direct_trigger: "Incomplete synthesis",
          root_cause: "Prompt revision omits a bounded synthesis instruction",
          causal_chain: ["Instruction omission", "Incomplete synthesis"],
          owner_evidence: [locations.opportunity],
          prior_path_failure: "Incumbent prompt did not require the synthesis",
          competing_hypotheses: [],
          disproved_hypotheses: [],
          affected_surface: ["target prompt"],
          unknowns: [],
        },
        "evolution-causal-attribution-analyst",
        [locations.opportunity],
      ),
      fact("evolution-lab/campaign-spec", locations.campaign, campaign, "evolution-experiment-planner"),
      fact("evolution-lab/candidate-revision", locations.candidate, candidate, "evolution-candidate-author", [
        locations.campaign,
      ]),
      fact("evolution-lab/run-evidence-bundle", locations.baselineRun, baselineRun, "evolution-evaluator"),
      fact("evolution-lab/run-evidence-bundle", locations.candidateRun, candidateRun, "evolution-evaluator"),
      fact(
        "evolution-lab/evaluation-result",
        locations.baselineEvaluation,
        baselineEvaluation,
        "evolution-safety-auditor",
      ),
      fact(
        "evolution-lab/evaluation-result",
        locations.candidateEvaluation,
        candidateEvaluation,
        "evolution-safety-auditor",
      ),
      fact(
        "evolution-lab/comparison-recommendation",
        locations.recommendation,
        recommendation,
        "evolution-recommendation-owner",
        recommendationSources,
      ),
    ]
    const summary = summarizeEvolutionEvidence(facts)
    expect({
      counts: summary.counts,
      recommendation: {
        taskID: summary.recommendation.taskID,
        locator: summary.recommendation.locator,
        artifactType: summary.recommendation.artifactType,
        payload: summary.recommendation.payload,
      },
    }).toEqual({
      counts: {
        "evolution-lab/opportunity": 1,
        "evolution-lab/failure-attribution": 1,
        "evolution-lab/campaign-spec": 1,
        "evolution-lab/candidate-revision": 1,
        "evolution-lab/run-evidence-bundle": 2,
        "evolution-lab/evaluation-result": 2,
        "evolution-lab/comparison-recommendation": 1,
      },
      recommendation: {
        taskID,
        locator: locations.recommendation,
        artifactType: "evolution-lab/comparison-recommendation",
        payload: recommendation,
      },
    })
  })
})
