import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { payloadPackageSources } from "../generated/expert-squad-payload"
import { generatedExpertSquadRevisions } from "../generated/expert-squad-revisions"
import { packageContentDigest } from "../script/generate-expert-squad-revisions"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { UsageLedger } from "../src/usage"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { EngineArtifactTable, EngineTaskTable } from "../src/engine/engine.sql"
import { insertEngineInteractionRequest } from "../src/engine/interaction-request"
import { createDispatchLineageOrigin } from "../src/engine/dispatch-lineage"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { terminalTask } from "../src/engine/state"
import { requireTask } from "../src/engine/store"
import {
  requireCurrentTerminalLifecycleReference,
  resolveTerminalLifecycleReference,
} from "../src/engine/terminal-lifecycle-reference"
import { collectTaskRunEvidence } from "../src/tool/task-run-evidence-host"
import { createExpertSquadPackageHost } from "../src/tool/expert-squad-package-host"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { candidateMutableTextPaths } from "@squads/evolution-lab/lib/evolution-lab/candidate-integrity"
import {
  TaskArtifactResourceSetLocatorSchema,
  TaskArtifactRefSchema,
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  PreparedExpertSquadCandidateSchema,
  ValidatedExpertSquadPackageSchema,
  canonicalTaskRunEvidenceJSON,
  TaskRunEvidenceBundleSchema,
  canonicalWorkspaceTreeJSON,
} from "@opencorvus-ai/plugin"
import type { ArtifactReadLocator, EngineArtifactLocator, MetricEvaluationRequest } from "@opencorvus-ai/plugin"
import {
  createTaskArtifactStoreExecution,
  publishTaskArtifactProjectFiles,
  readTaskArtifactSnapshotManifest,
} from "../src/task-artifact/store"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import {
  EvolutionArtifactIntegrityError,
  EvolutionMetricIdentityError,
  EvolutionArtifactSchemas,
  EvolutionPackagePublishableArtifactInputSchema,
} from "@squads/evolution-lab/lib/evolution-lab/artifacts"
import collectRunEvidenceTool from "@squads/evolution-lab/tools/collect-run-evidence"
import expertSquadPackageTool from "@squads/evolution-lab/tools/expert-squad-package"
import publishEvolutionArtifactTool, {
  assertEvolutionArtifactOwner,
  evolutionArtifactOwner,
  requireEvolutionWorkerProducer,
} from "@squads/evolution-lab/tools/publish-evolution-artifact"
import executeEvolutionMetricsTool from "@squads/evolution-lab/tools/execute-evolution-metrics"
import { withTaskScopedPluginToolHost } from "../src/tool/plugin-tool-host"
import { prepareCrossTaskArtifactImports } from "../src/engine/cross-task-artifact-import"
import rehydrateEvolutionResourcesTool from "@squads/evolution-lab/tools/rehydrate-evolution-resources"
import { prepareTaskProcessBinding, readTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { requireTaskPackageRevisionBinding } from "../src/engine/task-package-revision-binding"
import { insertPreparedTaskCompletionDecision, prepareTaskCompletionDecision } from "../src/engine/completion-decision"
import { writeTaskUpdateInTransaction } from "../src/engine/state"
import { EngineGit, ensureGitProjectMetadata } from "../src/engine/git"
import { Worktree } from "../src/worktree"
import {
  executionCapsuleSourceTreeDigest,
  executionCapsuleSourceTreeSnapshot,
} from "../src/execution-capsule/tree-digest"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { MetricExecutionEvidence } from "../src/metrics/types"
import { metricJudgeMessages } from "../src/tool/metric-judge-runner"

function executePublishEvolutionArtifact(
  args: Record<string, unknown> & { artifact_type: string; payload: unknown },
  context: Parameters<typeof publishEvolutionArtifactTool.execute>[1],
) {
  const { artifact_type, payload, ...publication } = args
  const artifactOwner = {
    "evolution-lab/opportunity": "evolution-observer",
    "evolution-lab/failure-attribution": "evolution-failure-analyst",
    "evolution-lab/campaign-spec": "evolution-experiment-planner",
    "evolution-lab/candidate-revision": "evolution-candidate-author",
    "evolution-lab/run-evidence-bundle": "evolution-evaluator",
    "evolution-lab/evaluation-result": "evolution-evaluator",
    "evolution-lab/integrity-review": "evolution-safety-auditor",
    "evolution-lab/comparison-recommendation": "evolution-recommendation-owner",
  } as const
  return publishEvolutionArtifactTool.execute(
    { artifact: { artifact_type, payload, ...publication } } as Parameters<
      typeof publishEvolutionArtifactTool.execute
    >[0],
    { ...context, agent: artifactOwner[artifact_type as keyof typeof artifactOwner] },
  )
}

let project: Awaited<ReturnType<typeof memoryProject>> | undefined

async function sharedProject() {
  project ??= await memoryProject()
  return project
}

async function taskProcessBinding(taskID: string, packageDigest: string, timeCreated: number) {
  await ensureGitProjectMetadata()
  return prepareTaskProcessBinding({
    mode: "native",
    taskID,
    projectID: Instance.project.id,
    rootDirectory: Instance.directory,
    packageRevisionSHA256: packageDigest,
    timeCreated,
  })
}

async function completeFixtureTaskWithDeliverables(input: {
  taskID: string
  sessionID: string
  deliverableArtifactLocators: ArtifactReadLocator[]
  completedAt: number
}) {
  const packageRevision = requireTaskPackageRevisionBinding(input.taskID)
  await Session.mergeMetadata({
    sessionID: input.sessionID,
    patch: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  // The Message carrying `complete_task` belongs to the Orchestrator Session,
  // not to the Task's root Session. A root Session carries the operator's user
  // Messages only, and the Host rejects an assistant Message written onto one.
  const orchestratorSession = await Session.create({
    kind: "orchestrator",
    parentID: input.sessionID,
    title: "Fixture Task completion",
  })
  const userMessage = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: orchestratorSession.id,
    role: "user",
    author: "orchestrator",
    time: { created: input.completedAt - 2 },
    agent: "orchestrator",
    model: { providerID: "test", modelID: "test" },
  })
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: orchestratorSession.id,
    parentID: userMessage.id,
    role: "assistant",
    author: "orchestrator",
    time: { created: input.completedAt - 1 },
    agent: "orchestrator",
    providerID: "test",
    modelID: "test",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const toolCallID = `call-complete-fixture-${input.taskID}`
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: orchestratorSession.id,
    messageID: message.id,
    type: "tool",
    callID: toolCallID,
    tool: "complete_task",
    state: { status: "running", input: {}, time: { start: input.completedAt - 1 } },
  })
  const prepared = await prepareTaskCompletionDecision({
    taskID: input.taskID,
    visibleToolName: "complete_task",
    payload: {
      orchestrator_session_id: orchestratorSession.id,
      orchestrator_message_id: message.id,
      tool_call_id: toolCallID,
      tool_part_id: part.id,
      evidence_locators: input.deliverableArtifactLocators,
      deliverable_artifact_locators: input.deliverableArtifactLocators,
      accepted_delivery_slice_revision_ids: [],
      workflow_binding: { kind: "direct", package_revision: packageRevision },
      time_recorded: input.completedAt,
    },
  })
  Database.transaction((db) => {
    const terminal = writeTaskUpdateInTransaction({
      db,
      taskID: input.taskID,
      values: { status: "completed", error: null },
      summary: "Fixture Task completed with exact deliverable evidence",
      now: input.completedAt,
    })
    insertPreparedTaskCompletionDecision(db, prepared, terminal.task)
  })
}

afterAll(async () => {
  if (project) await project[Symbol.asyncDispose]()
  await resetMemoryDatabase()
})

describe.serial("Evolution Artifact and exact evidence Host", () => {
  test("binds every typed Evolution Artifact to its single declared worker owner", () => {
    expect(evolutionArtifactOwner).toEqual({
      "evolution-lab/opportunity": "evolution-observer",
      "evolution-lab/failure-attribution": "evolution-failure-analyst",
      "evolution-lab/campaign-spec": "evolution-experiment-planner",
      "evolution-lab/candidate-revision": "evolution-candidate-author",
      "evolution-lab/run-evidence-bundle": "evolution-evaluator",
      "evolution-lab/evaluation-result": "evolution-evaluator",
      "evolution-lab/integrity-review": "evolution-safety-auditor",
      "evolution-lab/comparison-recommendation": "evolution-recommendation-owner",
    })
    assertEvolutionArtifactOwner("evolution-lab/opportunity", "evolution-observer")
    expect(() => assertEvolutionArtifactOwner("evolution-lab/opportunity", "evolution-failure-analyst")).toThrow(
      new EvolutionArtifactIntegrityError(
        "evolution-lab/opportunity must be published by Evolution Lab worker evolution-observer",
      ),
    )
  })

  test("preserves the exact Evolution worker authority through one immutable cross-Task import", () => {
    const workerProducer = {
      owner_kind: "projected-worker" as const,
      expert_squad_id: "evolution-lab",
      package_revision: {
        scope: "project" as const,
        project_id: "project-1",
        namespace: "builtin",
        id: "evolution-lab",
        version: "2026.08.18.1",
        package_digest: "a".repeat(64),
      },
      agent_id: "evolution-observer",
      projection_hash: "b".repeat(64),
      session_id: "session-source",
      message_id: "message-source",
      tool_call_id: "call-source",
    }
    const importedEnvelope = EngineArtifactEnvelopeSchema.parse({
      artifact_type: "evolution-lab/opportunity",
      schema_version: 1,
      producer: {
        owner_kind: "mission",
        mission_id: "mission-1",
        session_id: "session-mission",
        message_id: "message-import",
        tool_call_id: "call-import",
      },
      payload: {},
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
      import_lineage: {
        source_task_id: "task-source",
        source_locator: {
          source: "engine_artifact",
          artifact_id: "artifact-source",
          catalog_revision: 1,
          expected_sha256: "c".repeat(64),
        },
        source_kind: "expert_output",
        source_producer: workerProducer,
        source_provenance: {
          observed_artifact_locators: [],
          source_artifact_locators: [],
        },
      },
    })

    requireEvolutionWorkerProducer(importedEnvelope, "evolution-observer")
    expect(importedEnvelope.import_lineage?.source_producer).toEqual(workerProducer)
    expect(() => requireEvolutionWorkerProducer(importedEnvelope, "evolution-failure-analyst")).toThrow(
      new EvolutionArtifactIntegrityError(
        "evolution-lab/opportunity must be produced by Evolution Lab worker evolution-failure-analyst",
      ),
    )
  })

  test("parses all nine package-owned evolution Artifact ABI values", () => {
    const digest = "b".repeat(64)
    const revision = { namespace: "acme", id: "target", version: "2026.08.06.1", package_digest: digest }
    const target = {
      scope: "project" as const,
      project_id: "project-1",
      project_directory: "C:/campaign",
      namespace: "acme",
      id: "target",
    }
    const locator = {
      source: "engine_artifact" as const,
      artifact_id: "artifact-1",
      catalog_revision: 1,
      expected_sha256: digest,
    }
    const resourceSet = {
      snapshot: {
        schema_version: 2 as const,
        project_id: "project-1",
        task_id: "task-1",
        snapshot_id: "00000000-0000-4000-8000-000000000001",
        manifest_sha256: digest,
      },
      tree: "candidate",
    }
    const resource = {
      snapshot: resourceSet.snapshot,
      tree: "candidate",
      path: "input.json",
      media_type: "application/json",
      bytes: 1024,
      sha256: digest,
    }
    const values = {
      "evolution-lab/opportunity": {
        target,
        current_revision: revision,
        trigger: { type: "user", identity: "message-1" },
        evidence: [locator],
        observable_symptom: "Repeated incomplete delivery",
        impact_scope: "target workflow",
        frequency: "3 of 5 runs",
        data_window: { started_at: "2026-08-01T00:00:00.000Z", ended_at: "2026-08-06T00:00:00.000Z" },
        owner_hypothesis: "Target prompt contract",
        unknowns: ["holdout behavior"],
        sensitivity: "internal",
        suggested_budget: { runs: 4, max_cost: 12 },
      },
      "evolution-lab/campaign-spec": {
        target,
        baseline_revision: revision,
        candidate_version_policy: "increment the dated revision ordinal",
        candidate_hypothesis: "Exact evidence language closes the gap",
        dataset_partition: "development",
        dataset_digest: digest,
        cases: ["case-1"],
        scorer_digests: [digest],
        scorers: [
          {
            scorer_id: "correctness",
            scorer_revision: digest,
            scope: "global",
            goal_id: null,
            description: "Exact correctness observation",
            unit: "ratio",
            direction: "higher_better",
            target: 1,
            floor: 0,
            weight: 1,
            observation_class: "quality",
            evaluator_kind: "query",
            evaluator_config: { scorer_revision: digest, query: "constant_value", value: 1 },
          },
        ],
        frozen_inputs: {
          dataset: resource,
          cases: [{ case_id: "case-1", resource }],
          model_configuration: resource,
          environment: resource,
          workspace_template: resource,
          permission_snapshot: resource,
          scorer_assets: [{ scorer_id: "correctness", scorer_revision: digest, resource }],
        },
        model: "provider/model",
        model_configuration_digest: digest,
        environment_digest: digest,
        workspace_digest: digest,
        permission_snapshot_digest: digest,
        external_side_effect_policy: "No production side effects",
        repetitions: 2,
        arm_order: ["baseline", "candidate"],
        statistics: "paired mean and variance",
        budget: { max_runs: 4, max_cost: 12 },
        inactivity_timeout_ms: 60_000,
        ui_rubric_digest: null,
        mutable_paths: ["README.md"],
        trial_execution: { status: "available", installation_scope: "project" },
      },
      "evolution-lab/failure-attribution": {
        symptom: "Incomplete delivery",
        direct_trigger: "Missing source selection",
        root_cause: "Prompt omitted exact evidence requirement",
        causal_chain: ["The prompt omitted exact evidence selection", "The run completed with partial evidence"],
        owner_evidence: [locator],
        prior_path_failure: "Previous edit changed only narration",
        competing_hypotheses: ["Provider variance"],
        disproved_hypotheses: ["Workspace corruption"],
        affected_surface: ["agents/worker/system.md"],
        unknowns: ["provider variance"],
      },
      "evolution-lab/candidate-revision": {
        development_campaign_locator: locator,
        feedback: null,
        parent_revision: revision,
        candidate_revision: { ...revision, version: "2026.08.06.2" },
        parent_resources: [resource],
        candidate_resources: [resource],
        hypothesis: "Exact evidence language closes the gap",
        changed_paths: ["README.md"],
        diff_sha256: digest,
        frozen_files: [{ path: "tools/run.ts", parent_sha256: digest, candidate_sha256: digest }],
        manager_receipt: {
          operation: "validated",
          namespace: "acme",
          id: "target",
          version: "2026.08.06.2",
          package_digest: digest,
        },
        provenance: [locator],
      },
      "evolution-lab/run-evidence-bundle": {
        case_id: "case-1",
        arm: "baseline",
        repetition: 0,
        workspace_digest: digest,
        run_evidence_sha256: digest,
        run_evidence_resource: {
          snapshot: resourceSet.snapshot,
          tree: "candidate",
          path: "run-evidence.json",
          media_type: "application/json",
          bytes: 1024,
          sha256: digest,
        },
        task_id: "task-1",
        terminal_time: 1,
        model: "provider/model",
        environment_digest: digest,
        token_usage: 100,
        cost: 1,
        last_activity_at: "2026-08-06T00:00:00.000Z",
        outcome: "success",
        activity_duration_ms: 1,
        revision_equality: {
          installed: digest,
          expected: digest,
          task_binding: digest,
          workflow_binding: digest,
          runtime_snapshot: digest,
        },
      },
      "evolution-lab/evaluation-result": {
        case_id: "case-1",
        arm: "baseline",
        repetition: 0,
        scorers: [{ scorer_id: "correctness", status: "measured", value: 0.9, evidence: [locator] }],
        trial_task_id: "task-1",
        trial_revision_digest: digest,
        campaign_spec_locator: locator,
        candidate_revision_locator: null,
        run_evidence_locator: locator,
        metric_receipt_resource: resource,
      },
      "evolution-lab/integrity-review": {
        case_id: "case-1",
        arm: "baseline",
        repetition: 0,
        evaluation_result_locator: locator,
        status: "reviewed",
        findings: [],
        accepted_limitations: [],
        unknowns: [],
      },
      "evolution-lab/comparison-recommendation": {
        baseline_revision: revision,
        candidate_revision: { ...revision, version: "2026.08.06.2" },
        paired_deltas: [
          {
            scorer_id: "correctness",
            mean: 0.1,
            median: 0.1,
            variance: 0.01,
            confidence_interval: { confidence: 0.95, lower: 0.05, upper: 0.15 },
            win_tie_loss: { wins: 2, ties: 0, losses: 0 },
          },
        ],
        cost_delta: 0.2,
        token_delta: 10,
        activity_duration_ms_delta: 100,
        outcome_rates: {
          baseline: { failure: 0, unavailable: 0 },
          candidate: { failure: 0, unavailable: 0 },
        },
        aggregate_score: 0.9,
        aggregate_interval: { confidence: 0.95, lower: 0.7, upper: 1.1 },
        regressions: [],
        unavailable_dimensions: [],
        required_unavailable_dimensions: [],
        unknowns: ["larger holdout"],
        visual_review: { status: "not_applicable", evidence: [] },
        reward_hacking_review: { findings: [], evidence: [locator] },
        confidence: "medium",
        recommendation: "promote",
      },
      "evolution-lab/promotion-receipt": {
        operation: "promotion",
        authorization: {
          project_id: "project-campaign",
          task_id: "task-promotion",
          session_id: "session-promotion",
          message_id: "message-2",
          message_sha256: "e".repeat(64),
          time_created: 1,
        },
        target,
        expected_current_digest: digest,
        before_digest: digest,
        after_digest: "c".repeat(64),
        evidence: [locator],
        manager_receipt: {
          operation: "replaced",
          before: {
            installationScope: "project",
            projectDirectory: "C:/campaign",
            namespace: "acme",
            id: "target",
            version: "2026.08.06.1",
            packageDigest: digest,
            targetRoot: "C:/campaign/.opencorvus/expert-squads/acme/target",
          },
          after: {
            installationScope: "project",
            projectDirectory: "C:/campaign",
            namespace: "acme",
            id: "target",
            version: "2026.08.06.2",
            packageDigest: "c".repeat(64),
            targetRoot: "C:/campaign/.opencorvus/expert-squads/acme/target",
          },
        },
      },
    }
    expect(Object.keys(EvolutionArtifactSchemas)).toEqual(Object.keys(values))
    expect(
      Object.entries(values).map(([type, value]) =>
        EvolutionArtifactSchemas[type as keyof typeof EvolutionArtifactSchemas].parse(value),
      ),
    ).toHaveLength(9)
    expect(
      EvolutionArtifactSchemas["evolution-lab/opportunity"].parse({
        ...values["evolution-lab/opportunity"],
        target: {
          scope: "built_in",
          project_id: null,
          project_directory: null,
          namespace: "builtin",
          id: "base",
        },
      }).target,
    ).toEqual({
      scope: "built_in",
      project_id: null,
      project_directory: null,
      namespace: "builtin",
      id: "base",
    })
    expect(
      EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
        ...values["evolution-lab/campaign-spec"],
        target: {
          scope: "built_in",
          project_id: null,
          project_directory: null,
          namespace: "builtin",
          id: "base",
        },
        trial_execution: { status: "unavailable", reason_code: "product_release_required" },
      }).trial_execution,
    ).toEqual({ status: "unavailable", reason_code: "product_release_required" })

    const integrityCases = [
      EvolutionArtifactSchemas["evolution-lab/candidate-revision"].safeParse({
        ...values["evolution-lab/candidate-revision"],
        manager_receipt: {
          ...values["evolution-lab/candidate-revision"].manager_receipt,
          package_digest: "c".repeat(64),
        },
      }),
      EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].safeParse({
        ...values["evolution-lab/run-evidence-bundle"],
        revision_equality: {
          ...values["evolution-lab/run-evidence-bundle"].revision_equality,
          runtime_snapshot: "c".repeat(64),
        },
      }),
      EvolutionArtifactSchemas["evolution-lab/promotion-receipt"].safeParse({
        ...values["evolution-lab/promotion-receipt"],
        manager_receipt: {
          ...values["evolution-lab/promotion-receipt"].manager_receipt,
          after: { ...values["evolution-lab/promotion-receipt"].manager_receipt.after, id: "another-target" },
        },
      }),
      EvolutionArtifactSchemas["evolution-lab/campaign-spec"].safeParse({
        ...values["evolution-lab/campaign-spec"],
        cases: ["../outside"],
        frozen_inputs: {
          ...values["evolution-lab/campaign-spec"].frozen_inputs,
          cases: [{ case_id: "../outside", resource }],
        },
      }),
      EvolutionArtifactSchemas["evolution-lab/campaign-spec"].safeParse({
        ...values["evolution-lab/campaign-spec"],
        cases: ["case-1", "case-1"],
        frozen_inputs: {
          ...values["evolution-lab/campaign-spec"].frozen_inputs,
          cases: [
            { case_id: "case-1", resource },
            { case_id: "case-1", resource },
          ],
        },
      }),
      EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"].safeParse({
        ...values["evolution-lab/comparison-recommendation"],
        unavailable_dimensions: ["evidence_integrity"],
        required_unavailable_dimensions: ["evidence_integrity"],
        aggregate_score: 0.9,
        aggregate_interval: { confidence: 0.95, lower: 0.7, upper: 1.1 },
      }),
    ]
    expect(
      integrityCases.map((result) => {
        if (result.success) throw new Error("Expected exact evolution Artifact integrity error")
        return result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      }),
    ).toEqual([
      [{ path: "manager_receipt", message: "candidate validation receipt must equal the exact candidate revision" }],
      [{ path: "revision_equality", message: "all run revision identities must be exactly equal" }],
      [
        {
          path: "manager_receipt",
          message: "promotion receipt Manager identities must equal the exact installable target",
        },
      ],
      [
        { path: "cases.0", message: "must be one cross-platform portable path segment" },
        { path: "frozen_inputs.cases.0.case_id", message: "must be one cross-platform portable path segment" },
      ],
      [
        { path: "cases", message: "campaign case identifiers must be unique portable path segments" },
        {
          path: "budget.max_runs",
          message: "campaign run budget must cover the complete two-arm matrix (8 runs)",
        },
        {
          path: "frozen_inputs.cases",
          message: "frozen campaign case identifiers must be unique portable path segments",
        },
      ],
      [
        {
          path: "aggregate_score",
          message: "aggregate score must be null when a required dimension is unavailable",
        },
        {
          path: "recommendation",
          message: "required unavailable dimensions force an inconclusive recommendation",
        },
      ],
    ])
  })

  test("derives the V1 mutable surface from manifest and verified model-readable Skill bytes", () => {
    const digest = "d".repeat(64)
    const files = [
      ["README.md", true],
      ["selector.md", true],
      ["agents/orchestrator/system.md", true],
      ["agents/worker/system.md", true],
      ["expert-squad.jsonc", true],
      ["skills/workflow/SKILL.md", true],
      ["skills/workflow/references/text.md", true],
      ["skills/workflow/references/blob.bin", false],
      ["skills/workflow/scripts/run.ts", true],
      ["skills/workflow/examples/example.md", true],
    ] as const
    const validated = ValidatedExpertSquadPackageSchema.parse({
      resource_set: {
        snapshot: {
          schema_version: 2,
          project_id: "project-1",
          task_id: "task-1",
          snapshot_id: "00000000-0000-4000-8000-000000000001",
          manifest_sha256: digest,
        },
        tree: "package",
      },
      package_digest: digest,
      namespace: "acme",
      id: "target",
      version: "2026.08.06.1",
      manifest: {
        readme: "README.md",
        selector: { instructions: "selector.md" },
        capability_projection: {
          scheduler: { prompt: "agents/orchestrator/system.md" },
          agents: { worker: { prompt: "agents/worker/system.md" } },
        },
      },
      skill_closures: [
        {
          source: "skills/workflow/SKILL.md",
          files: ["SKILL.md", "examples/example.md", "references/blob.bin", "references/text.md", "scripts/run.ts"],
        },
      ],
      files: files.map(([filePath, utf8Text]) => ({
        path: filePath,
        sha256: digest,
        bytes: 1,
        utf8_text: utf8Text,
      })),
    })
    expect(candidateMutableTextPaths(validated)).toEqual([
      "README.md",
      "agents/orchestrator/system.md",
      "agents/worker/system.md",
      "selector.md",
      "skills/workflow/SKILL.md",
      "skills/workflow/examples/example.md",
      "skills/workflow/references/text.md",
    ])
  })

  test("publishes and consumes exact typed predecessor evidence through the package ABI", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(
          path.resolve(import.meta.dir, "../../../expert-squads/builtin/evolution-lab"),
        )
        const publisherSchema = publishEvolutionArtifactTool.introspect().inputSchema as {
          required?: string[]
          properties?: Record<
            string,
            {
              oneOf?: Array<{ properties?: Record<string, { const?: string }>; required?: string[] }>
            }
          >
        }
        expect(Object.keys(publisherSchema.properties ?? {})).toEqual(["artifact"])
        expect(publisherSchema.required).toEqual(["artifact"])
        const publicationBranches = publisherSchema.properties?.artifact?.oneOf ?? []
        expect(publicationBranches.map((branch) => branch.properties?.artifact_type?.const)).toEqual(
          EvolutionPackagePublishableArtifactInputSchema.options.map((branch) => branch.shape.artifact_type.value),
        )
        expect(
          publicationBranches.every(
            (branch) => branch.required?.join("|") === "artifact_type|payload|resource_set|source_artifact_locators",
          ),
        ).toBe(true)
        const attributionBranch = publicationBranches.find(
          (branch) => branch.properties?.artifact_type?.const === "evolution-lab/failure-attribution",
        )
        expect(attributionBranch?.required).toEqual([
          "artifact_type",
          "payload",
          "resource_set",
          "source_artifact_locators",
        ])
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Evolution typed ABI chain",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        const missionID = "evolution-abi-chain"
        const missionSession = await Session.create({
          kind: "mission",
          title: "Evolution typed ABI chain Mission",
          metadata: {
            mission: {
              id: missionID,
              channelKey: `mission:${missionID}`,
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["evolution-lab"],
            },
          },
        })
        const missionSessionID = missionSession.id
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Evolution typed ABI chain",
          request: "Publish and consume exact evolution evidence",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: missionSessionID } },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "evolution-lab",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await taskProcessBinding(taskID, loaded.packageDigest, started),
        })
        const userMessage = await Session.updateMessage({
          id: "message-user-authority",
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: started },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: userMessage.id,
          type: "text",
          text: "Authorize an exact evolution evidence chain",
        })
        // The producer Message belongs to a child worker Session: a root
        // Session carries the operator's user Messages only, and the Host
        // rejects an assistant Message written onto one.
        const workerSession = await Session.create({
          kind: "assistant",
          parentID: session.id,
          title: "Evolution typed ABI chain worker",
        })
        await Session.updateMessage({
          id: "message-evolution-abi-chain",
          sessionID: workerSession.id,
          role: "assistant",
          author: "evolution-failure-analyst",
          time: { created: started },
          parentID: userMessage.id,
          modelID: "test",
          providerID: "test",
          agent: "evolution-failure-analyst",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const target = {
          scope: "project" as const,
          project_id: Instance.project.id,
          project_directory: project.path,
          namespace: loaded.namespace,
          id: loaded.id,
        }
        const revision = {
          namespace: loaded.namespace,
          id: loaded.id,
          version: loaded.manifest.version,
          package_digest: loaded.packageDigest,
        }
        await Session.updatePart({
          id: "part--step-evolution-abi-chain",
          sessionID: workerSession.id,
          messageID: "message-evolution-abi-chain",
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-evolution-abi-chain",
          sessionID: workerSession.id,
          messageID: "message-evolution-abi-chain",
          type: "tool",
          callID: "call-evolution-abi-chain",
          tool: "publish-evolution-artifact",
          state: { status: "running", input: {}, time: { start: started + 2 } },
        })
        const scope: TaskToolExecutionScope = {
          kind: "task" as const,
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: workerSession.id,
          messageID: "message-evolution-abi-chain",
          toolCallID: "call-evolution-abi-chain",
          toolPartID: "part-evolution-abi-chain",
          executionSurface: {},
          owner: {
            kind: "projected-worker" as const,
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "project" as const,
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "evolution-lab",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "evolution-failure-analyst",
            projectionHash: "a".repeat(64),
            workerTurnDescriptorID: "descriptor-evolution-abi-chain",
            workerTurnDescriptorHash: "b".repeat(64),
          },
        }

        let sourceOpportunityLocator!: EngineArtifactLocator
        let sourceAttributionLocator!: EngineArtifactLocator
        let sourceCampaignLocator!: EngineArtifactLocator
        let sourceRunLocator!: EngineArtifactLocator
        let sourceOpportunityInput!: Record<string, unknown>
        let sourceCampaignInput!: Record<string, unknown>
        let subjectMaterialization = ""
        await withTaskScopedPluginToolHost(scope, async (host) => {
          ;(scope.owner as { agentID: string }).agentID = "evolution-observer"
          const opportunityReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/opportunity",
                payload: {
                  target,
                  current_revision: revision,
                  trigger: { type: "user", identity: "message-user-authority" },
                  evidence: [],
                  observable_symptom: "Repeated incomplete delivery",
                  impact_scope: "target workflow",
                  frequency: "3 of 5 runs",
                  data_window: {
                    started_at: "2026-08-01T00:00:00.000Z",
                    ended_at: "2026-08-06T00:00:00.000Z",
                  },
                  owner_hypothesis: "Target prompt contract",
                  unknowns: ["provider variance"],
                  sensitivity: "internal",
                  suggested_budget: { runs: 4, max_cost: 12 },
                },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          sourceOpportunityLocator = opportunityReceipt.locator as EngineArtifactLocator
          sourceOpportunityInput = {
            target,
            current_revision: revision,
            trigger: { type: "user", identity: "message-user-authority" },
            evidence: [],
            observable_symptom: "Repeated incomplete delivery",
            impact_scope: "target workflow",
            frequency: "3 of 5 runs",
            data_window: {
              started_at: "2026-08-01T00:00:00.000Z",
              ended_at: "2026-08-06T00:00:00.000Z",
            },
            owner_hypothesis: "Target prompt contract",
            unknowns: ["provider variance"],
            sensitivity: "internal",
            suggested_budget: { runs: 4, max_cost: 12 },
          }
          const read = await host.engineArtifacts.read({
            locator: opportunityReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          expect(read.chunk.complete).toBe(true)
          await host.engineArtifacts.select({
            locator: opportunityReceipt.locator,
            purpose: "Exact opportunity predecessor for causal attribution",
          })
          ;(scope.owner as { agentID: string }).agentID = "evolution-failure-analyst"
          const attributionPayload = {
            symptom: "Incomplete delivery",
            direct_trigger: "Missing source selection",
            root_cause: "Prompt omitted exact evidence requirement",
            causal_chain: ["The prompt omitted selection", "The worker completed with partial evidence"],
            owner_evidence: [opportunityReceipt.locator],
            prior_path_failure: "Earlier edits changed narration only",
            competing_hypotheses: ["Provider variance"],
            disproved_hypotheses: ["Workspace corruption"],
            affected_surface: ["agents/worker/system.md"],
            unknowns: ["holdout behavior"],
          }
          const attributionCountBefore = Database.use(
            (db) =>
              db
                .select({ id: EngineArtifactTable.id })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.catalog_artifact_type, "evolution-lab/failure-attribution"))
                .all().length,
          )
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/failure-attribution",
                payload: attributionPayload,
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ).rejects.toThrow("failure-attribution requires exactly one opportunity Engine Artifact source")
          expect(
            Database.use(
              (db) =>
                db
                  .select({ id: EngineArtifactTable.id })
                  .from(EngineArtifactTable)
                  .where(eq(EngineArtifactTable.catalog_artifact_type, "evolution-lab/failure-attribution"))
                  .all().length,
            ),
          ).toBe(attributionCountBefore)
          const attributionReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/failure-attribution",
                payload: attributionPayload,
                resource_set: null,
                source_artifact_locators: [opportunityReceipt.locator],
              },
              { host } as never,
            ),
          ) as { artifact_type: string; locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(attributionReceipt.artifact_type).toBe("evolution-lab/failure-attribution")
          sourceAttributionLocator = attributionReceipt.locator as EngineArtifactLocator
          const attributionRead = await host.engineArtifacts.read({
            locator: attributionReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          expect(attributionRead.chunk.complete).toBe(true)
          expect(
            EngineArtifactEnvelopeSchema.parse(JSON.parse(attributionRead.chunk.text!)).source_artifact_locators,
          ).toEqual([opportunityReceipt.locator])
          await host.engineArtifacts.select({
            locator: attributionReceipt.locator,
            purpose: "Exact causal attribution for the frozen campaign specification",
          })
          const trialWorktree = await Worktree.create({ name: `evolution-trial-${taskID}` })
          await ensureGitProjectMetadata(trialWorktree.directory)
          await mkdir(path.join(trialWorktree.directory, "subject"), { recursive: true })
          await writeFile(
            path.join(trialWorktree.directory, "subject", "decision-ledger.mjs"),
            "export const decision = 'trial-workspace-only'\n",
          )
          // The scorer reads one file that differs in every place it could be
          // read from: the Evaluator project (0), the Trial workspace before
          // and after its run (2), and the Trial's terminal commit (1).
          await writeFile(path.join(trialWorktree.directory, "g43-subject.txt"), "2")
          await writeFile(path.join(project.path, "g43-subject.txt"), "0")
          const subjectScorerConfig = {
            workspace_digest: await executionCapsuleSourceTreeDigest(trialWorktree.directory),
            executable: process.execPath,
            args: ["-e", "process.stdout.write(require('node:fs').readFileSync('g43-subject.txt', 'utf8'))"],
            parse: "stdout_number" as const,
            inactivity_timeout_ms: 30_000,
          }
          const campaignWorkspaceSnapshot = canonicalWorkspaceTreeJSON(
            await executionCapsuleSourceTreeSnapshot(trialWorktree.directory),
          )
          const campaignInputNames = [
            "dataset.json",
            "case-1.json",
            "model-configuration.json",
            "environment.json",
            "workspace-template.json",
            "permission-snapshot.json",
            "scorer-correctness.json",
          ].sort()
          const campaignInputPaths = campaignInputNames.map((name) => `campaign-inputs/${name}`)
          await mkdir(path.join(project.path, "campaign-inputs"), { recursive: true })
          const campaignInputContents = new Map<string, string>([
            ["dataset.json", JSON.stringify({ schema_version: 1, partition: "development" })],
            ["case-1.json", JSON.stringify({ schema_version: 1, case_id: "case-1" })],
            [
              "model-configuration.json",
              JSON.stringify({
                schema_version: 1,
                provider_id: "provider",
                model_id: "model",
                streaming: true,
                retries: 0,
                inactivity_timeout_ms: 60_000,
                max_evidence_bytes: 65_536,
              }),
            ],
            ["environment.json", JSON.stringify({ schema_version: 1, runtime: "isolated-test" })],
            ["workspace-template.json", campaignWorkspaceSnapshot],
            ["permission-snapshot.json", JSON.stringify({ schema_version: 1, granted_permissions: [] })],
            [
              "scorer-correctness.json",
              JSON.stringify({
                schema_version: 1,
                scorer_id: "correctness",
                description: "Exact correctness observation",
                unit: "ratio",
                direction: "higher_better",
                target: 1,
                floor: 0,
                weight: 1,
                observation_class: "quality",
                evaluator_kind: "shell",
                evaluator_config: subjectScorerConfig,
              }),
            ],
          ])
          for (const name of campaignInputNames)
            await writeFile(path.join(project.path, "campaign-inputs", name), campaignInputContents.get(name)!)
          const campaignInputPublication = await publishTaskArtifactProjectFiles({
            scope,
            source: { kind: "current_task_project" },
            files: campaignInputPaths.toReversed().map((inputPath) => ({
              path: inputPath,
              mediaType: "application/json",
            })),
          })
          const campaignInputResourceSet = TaskArtifactResourceSetLocatorSchema.parse({
            snapshot: campaignInputPublication.snapshot,
            tree: "resources",
          })
          expect(campaignInputPublication.artifacts.map((resource) => resource.path)).toEqual(campaignInputPaths)
          const campaignInput = new Map(campaignInputPublication.artifacts.map((resource) => [resource.path, resource]))
          const datasetResource = campaignInput.get("campaign-inputs/dataset.json")!
          const caseResource = campaignInput.get("campaign-inputs/case-1.json")!
          const modelConfigurationResource = campaignInput.get("campaign-inputs/model-configuration.json")!
          const environmentResource = campaignInput.get("campaign-inputs/environment.json")!
          const workspaceResource = campaignInput.get("campaign-inputs/workspace-template.json")!
          const permissionResource = campaignInput.get("campaign-inputs/permission-snapshot.json")!
          const scorerResource = campaignInput.get("campaign-inputs/scorer-correctness.json")!
          const campaignWorkspaceTreeSHA256 = await executionCapsuleSourceTreeDigest(trialWorktree.directory)
          ;(scope.owner as { agentID: string }).agentID = "evolution-experiment-planner"
          const campaignDraft = {
            candidate_version_policy: "increment the dated revision ordinal",
            candidate_hypothesis: "Exact evidence language closes the gap",
            dataset_partition: "development" as const,
            resource_roles: {
              dataset_path: datasetResource.path,
              cases: [{ case_id: "case-1", resource_path: caseResource.path }],
              model_configuration_path: modelConfigurationResource.path,
              environment_path: environmentResource.path,
              workspace_template_path: workspaceResource.path,
              permission_snapshot_path: permissionResource.path,
              scorer_assets: [{ scorer_id: "correctness", resource_path: scorerResource.path }],
            },
            external_side_effect_policy: "No production side effects",
            repetitions: 1,
            arm_order: ["baseline", "candidate"] as const,
            statistics: "paired mean and variance",
            budget: { max_runs: 2, max_cost: 12 },
          }
          sourceCampaignInput = campaignDraft
          const campaignReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/campaign-spec",
                payload: campaignDraft,
                resource_set: campaignInputResourceSet,
                source_artifact_locators: [opportunityReceipt.locator, attributionReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          sourceCampaignLocator = campaignReceipt.locator as EngineArtifactLocator
          const campaignEnvelopeRead = await host.engineArtifacts.read({
            locator: campaignReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const campaignEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(campaignEnvelopeRead.chunk.text!))
          const persistedCampaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(
            campaignEnvelope.payload,
          )
          expect(persistedCampaign).toMatchObject({
            target,
            baseline_revision: revision,
            dataset_digest: datasetResource.sha256,
            scorer_digests: [scorerResource.sha256],
            model: "provider/model",
            model_configuration_digest: modelConfigurationResource.sha256,
            environment_digest: environmentResource.sha256,
            workspace_digest: campaignWorkspaceTreeSHA256,
            permission_snapshot_digest: permissionResource.sha256,
            inactivity_timeout_ms: 60_000,
            ui_rubric_digest: null,
            trial_execution: { status: "available", installation_scope: "project" },
          })
          expect(persistedCampaign.mutable_paths).toEqual(
            candidateMutableTextPaths(
              await host.expertSquadPackages.inspectRevision({
                revision: { package_digest: revision.package_digest },
              }),
            ),
          )
          expect(persistedCampaign.scorers[0]).toMatchObject({
            scorer_id: "correctness",
            scorer_revision: scorerResource.sha256,
            evaluator_kind: "shell",
            evaluator_config: { ...subjectScorerConfig, scorer_revision: scorerResource.sha256 },
          })
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/campaign-spec",
                payload: {
                  ...campaignDraft,
                  resource_roles: {
                    ...campaignDraft.resource_roles,
                    dataset_path: caseResource.path,
                  },
                },
                resource_set: campaignInputResourceSet,
                source_artifact_locators: [opportunityReceipt.locator, attributionReceipt.locator],
              },
              { host } as never,
            ),
          ).rejects.toBeInstanceOf(EvolutionArtifactIntegrityError)
          ;(scope.owner as { agentID: string }).agentID = "evolution-observer"
          const builtInOpportunity = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/opportunity",
                payload: {
                  ...EvolutionArtifactSchemas["evolution-lab/opportunity"].parse({
                    target,
                    current_revision: revision,
                    trigger: { type: "user", identity: "message-user-authority" },
                    evidence: [],
                    observable_symptom: "Repeated incomplete delivery",
                    impact_scope: "target workflow",
                    frequency: "3 of 5 runs",
                    data_window: {
                      started_at: "2026-08-01T00:00:00.000Z",
                      ended_at: "2026-08-06T00:00:00.000Z",
                    },
                    owner_hypothesis: "Target prompt contract",
                    unknowns: ["provider variance"],
                    sensitivity: "internal",
                    suggested_budget: { runs: 4, max_cost: 12 },
                  }),
                  target: {
                    scope: "built_in",
                    project_id: null,
                    project_directory: null,
                    namespace: loaded.namespace,
                    id: loaded.id,
                  },
                  current_revision: {
                    namespace: loaded.namespace,
                    id: loaded.id,
                    version: loaded.manifest.version,
                    package_digest: loaded.packageDigest,
                  },
                },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          await host.engineArtifacts.read({
            locator: builtInOpportunity.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          await host.engineArtifacts.select({
            locator: builtInOpportunity.locator,
            purpose: "Exact built-in opportunity for scope-derived campaign execution",
          })
          ;(scope.owner as { agentID: string }).agentID = "evolution-failure-analyst"
          const builtInAttribution = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/failure-attribution",
                payload: {
                  symptom: "Incomplete delivery",
                  direct_trigger: "Missing source selection",
                  root_cause: "Prompt omitted exact evidence requirement",
                  causal_chain: ["The prompt omitted selection", "The run completed with partial evidence"],
                  owner_evidence: [builtInOpportunity.locator],
                  prior_path_failure: "Earlier edits changed narration only",
                  competing_hypotheses: ["Provider variance"],
                  disproved_hypotheses: ["Workspace corruption"],
                  affected_surface: ["agents/worker/system.md"],
                  unknowns: ["holdout behavior"],
                },
                resource_set: null,
                source_artifact_locators: [builtInOpportunity.locator],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          await host.engineArtifacts.read({
            locator: builtInAttribution.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          await host.engineArtifacts.select({
            locator: builtInAttribution.locator,
            purpose: "Exact built-in attribution for scope-derived campaign execution",
          })
          ;(scope.owner as { agentID: string }).agentID = "evolution-experiment-planner"
          const builtInCampaign = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/campaign-spec",
                payload: campaignDraft,
                resource_set: campaignInputResourceSet,
                source_artifact_locators: [builtInOpportunity.locator, builtInAttribution.locator],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          const builtInCampaignRead = await host.engineArtifacts.read({
            locator: builtInCampaign.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          expect(
            EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(
              EngineArtifactEnvelopeSchema.parse(JSON.parse(builtInCampaignRead.chunk.text!)).payload,
            ).trial_execution,
          ).toEqual({ status: "unavailable", reason_code: "product_release_required" })
          // Each call creates one independent terminal baseline Trial Task.
          const createTrial = () =>
            Instance.provide({
              directory: trialWorktree.directory,
              fn: async () => {
                const trialPackageRevision = {
                  scope: "project" as const,
                  projectID: Instance.project.id,
                  namespace: "acme",
                  id: "target",
                  version: revision.version,
                  packageDigest: revision.package_digest,
                }
                const trialSession = Session.prepareRootNext({
                  kind: "root",
                  directory: Instance.directory,
                  title: "Frozen baseline Trial",
                  metadata: { configOverlay: { prompt_profile: { active: trialPackageRevision.id } } },
                })
                const trialTaskID = Identifier.ascending("task")
                const trialStarted = started + 10
                const trialCompleted = trialStarted + 1
                persistTask({
                  taskID: trialTaskID,
                  rootSession: trialSession,
                  now: trialStarted - 1,
                  title: "Frozen baseline Trial",
                  request: "Execute case-1 against the exact baseline revision",
                  productPillar: "code",
                  source: "test",
                  priority: "normal",
                  metadata: { actor: "user" },
                  projectID: Instance.project.id,
                  packageRevision: trialPackageRevision,
                  creationExpectedPackageDigest: revision.package_digest,
                  executionCapsuleBinding: await taskProcessBinding(
                    trialTaskID,
                    revision.package_digest,
                    trialStarted - 1,
                  ),
                })
                const trialBaseline = await EngineGit.prepare(requireTask(trialTaskID))
                if (trialBaseline.error) throw new Error(trialBaseline.error)
                // The Trial's own work, committed by its terminal checkpoint.
                await writeFile(path.join(trialWorktree.directory, "g43-subject.txt"), "1")
                const trialArtifactExecution = createTaskArtifactStoreExecution({
                  kind: "task",
                  projectID: Instance.project.id,
                  projectDirectory: trialWorktree.directory,
                  taskID: trialTaskID,
                  taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(trialWorktree.directory, trialTaskID),
                  sessionID: trialSession.id,
                  messageID: "message-trial-artifact",
                  toolCallID: "call-trial-artifact",
                  toolPartID: "part-trial-artifact",
                  executionSurface: {},
                  owner: {
                    kind: "projected-worker",
                    expertSquadID: "target",
                    packageRevision: {
                      scope: "project",
                      projectID: Instance.project.id,
                      namespace: "acme",
                      id: "target",
                      version: revision.version,
                      packageDigest: revision.package_digest,
                    },
                    agentID: "target-worker",
                    projectionHash: "1".repeat(64),
                    workerTurnDescriptorID: "descriptor-trial",
                    workerTurnDescriptorHash: "2".repeat(64),
                  },
                } as unknown as TaskToolExecutionScope)
                const trialStage = await trialArtifactExecution.stage({ trees: ["result"] })
                await writeFile(
                  path.join(trialStage.treeDirectories.result!, "case-1.json"),
                  campaignInputContents.get("case-1.json")!,
                )
                await writeFile(path.join(trialStage.treeDirectories.result!, "result.txt"), "exact baseline result")
                await trialArtifactExecution.publish(trialStage, {
                  snapshot_kind: "catalog",
                  files: [
                    { tree: "result", path: "case-1.json", media_type: "application/json" },
                    { tree: "result", path: "result.txt", media_type: "text/plain" },
                  ],
                })
                await trialArtifactExecution.close()
                const trialUser = await Session.updateMessage({
                  id: Identifier.ascending("message"),
                  sessionID: trialSession.id,
                  role: "user",
                  author: "user",
                  time: { created: trialStarted },
                  agent: "user",
                  model: { providerID: "test", modelID: "test" },
                })
                // Producer Messages live on a child worker Session; a root
                // Session carries the operator's user Messages only.
                const trialWorkerSession = await Session.create({
                  kind: "delegated-worker",
                  parentID: trialSession.id,
                  title: "Frozen baseline Trial worker",
                })
                const trialDispatchID = Identifier.ascending("artifact")
                recordTestDispatchLineage({
                  origin: createDispatchLineageOrigin({
                    dispatchID: trialDispatchID,
                    taskID: trialTaskID,
                    orchestratorSessionID: trialSession.id,
                    orchestratorMessageID: Identifier.ascending("message"),
                    toolPartID: Identifier.ascending("part"),
                    toolCallID: Identifier.ascending("call"),
                    targetAgentID: "target-worker",
                    projectedWorkerIdentity: {
                      agentID: "target-worker",
                      baseRole: "delegated-worker",
                      sessionKind: "delegated-worker",
                      dispatchAdapterID: "delegated_worker",
                      runtimeTemplateABIVersion: 1,
                      dispatchAdapterABIVersion: 1,
                      projectionHash: "1".repeat(64),
                    },
                    workScope: { kind: "task" },
                    workflowBinding: selectedWorkflowBinding({
                      projection: { packageRevision: trialPackageRevision, virtualWorkflows: {} },
                      workflowID: null,
                    }),
                    workflowNodeID: null,
                    adapterInput: { reason: "Execute the frozen baseline Trial" },
                  }),
                  childSessionID: trialWorkerSession.id,
                })
                const trialAssistant = await Session.updateMessage({
                  id: Identifier.ascending("message"),
                  sessionID: trialWorkerSession.id,
                  role: "assistant",
                  author: "target-worker",
                  time: { created: trialStarted, completed: trialCompleted },
                  parentID: trialUser.id,
                  modelID: "test",
                  providerID: "test",
                  agent: "target-worker",
                  path: { cwd: trialWorktree.directory, root: trialWorktree.directory },
                  cost: 0,
                  tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
                  finish: "stop",
                })
                await terminalTask(
                  requireTask(trialTaskID),
                  {
                    status: "failed",
                    time_started: trialStarted,
                    time_completed: trialCompleted,
                    error: "fixture terminal Trial",
                  },
                  "Exact baseline Trial reached a terminal fixture outcome",
                )
                // The shared workspace returns to its Campaign state, so the
                // next Trial starts from the frozen workspace digest again.
                await writeFile(path.join(trialWorktree.directory, "g43-subject.txt"), "2")
                const trialLifecycle = resolveTerminalLifecycleReference(
                  trialTaskID,
                  requireCurrentTerminalLifecycleReference(trialTaskID),
                )
                const terminalTrialTask = requireTask(trialTaskID)
                const terminalOccurrence = {
                  status: "failed" as const,
                  lifecycle: trialLifecycle,
                  completion_decision_artifact_id: null,
                }
                return {
                  trialSession,
                  trialWorkerSession,
                  trialTaskID,
                  trialStarted: terminalTrialTask.time_started,
                  trialCompleted: trialLifecycle.timeCompleted,
                  trialUser,
                  trialAssistant,
                  terminalOccurrence,
                }
              },
            })
          const trial = await createTrial()
          const {
            trialSession,
            trialWorkerSession,
            trialTaskID,
            trialStarted,
            trialCompleted,
            trialUser,
            trialAssistant,
            terminalOccurrence,
          } = trial
          // One completed upstream step of the Trial worker, served by the
          // Campaign's frozen model. The Trial's own assistant Message above
          // was written by `test/test`, and that is deliberately not what the
          // run records: the model fact is the ledger's, not the transcript's.
          UsageLedger.record({
            providerID: "provider",
            modelID: "model",
            purpose: "session",
            tokens: { input: 60, output: 20, reasoning: 5, cache: { read: 0, write: 0 }, total: 80 },
            costUSD: 1.25,
            billing: { status: "priced" },
            sessionID: trialWorkerSession.id,
            agentID: "target-worker",
          })
          const collectTrial = async () => JSON.parse(
            await collectRunEvidenceTool.execute(
              {
                task_id: trialTaskID,
                terminal_occurrence: terminalOccurrence,
                selected_messages: [
                  { session_id: trialSession.id, message_id: trialUser.id },
                  { session_id: trialWorkerSession.id, message_id: trialAssistant.id },
                ],
              },
              { host } as never,
            ),
          ) as {
            resource_set: unknown
            resource: {
              snapshot: unknown
              tree: string
              path: string
              media_type: "application/json"
              bytes: number
              sha256: string
            }
          }
          const collectorReceipt = await collectTrial()
          const collectorResourceSet = TaskArtifactResourceSetLocatorSchema.parse(collectorReceipt.resource_set)
          const readCollector = async (receipt: typeof collectorReceipt) => TaskRunEvidenceBundleSchema.parse(
            JSON.parse(new TextDecoder().decode(await host.taskArtifacts.read(TaskArtifactRefSchema.parse(receipt.resource)))),
          )
          const originalUsage = (await readCollector(collectorReceipt)).usage
          expect(originalUsage).toMatchObject({ token_usage: 80, cost: 1.25, models: ["provider/model"] })
          expect(originalUsage.ledger_event_ids).toHaveLength(1)
          const trialProcessBinding = readTaskProcessBinding(trialTaskID)
          const trialInitialTreeSHA256 =
            trialProcessBinding.protocol === "task-native-process-binding-v2"
              ? trialProcessBinding.initial_tree_sha256
              : trialProcessBinding.workspace.initial_tree_sha256
          // The Evaluator states only the Campaign slot; the publisher stamps
          // every Trial fact from the collector, the Trial's usage ledger, and
          // the sourced Campaign.
          const runSlot = { case_id: "case-1", arm: "baseline" as const, repetition: 0 }
          ;(scope.owner as { agentID: string }).agentID = "evolution-evaluator"
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: runSlot,
                resource_set: collectorResourceSet,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ).rejects.toThrow(
            "run-evidence-bundle requires exactly one source: the exact campaign-spec Engine Artifact whose slot this Trial fills",
          )
          const runReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: runSlot,
                resource_set: collectorResourceSet,
                source_artifact_locators: [campaignReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          sourceRunLocator = runReceipt.locator as EngineArtifactLocator
          const readRunPayload = async (locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"]) =>
            EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(
              EngineArtifactEnvelopeSchema.parse(
                JSON.parse(
                  (
                    await host.engineArtifacts.read({
                      locator,
                      byte_offset: 0,
                      max_bytes: 65_536,
                      delivery: "inline",
                    })
                  ).chunk.text!,
                ),
              ).payload,
            )
          const stampedRun = {
            ...runSlot,
            workspace_digest: trialInitialTreeSHA256,
            run_evidence_sha256: collectorReceipt.resource.sha256,
            run_evidence_resource: {
              path: collectorReceipt.resource.path,
              media_type: collectorReceipt.resource.media_type,
              bytes: collectorReceipt.resource.bytes,
              sha256: collectorReceipt.resource.sha256,
            },
            task_id: trialTaskID,
            terminal_time: trialCompleted,
            model: "provider/model",
            environment_digest: environmentResource.sha256,
            token_usage: 80,
            cost: 1.25,
            last_activity_at: new Date(trialCompleted).toISOString(),
            outcome: "failure",
            activity_duration_ms: trialCompleted - trialStarted,
            revision_equality: {
              installed: revision.package_digest,
              expected: revision.package_digest,
              task_binding: revision.package_digest,
              workflow_binding: revision.package_digest,
              runtime_snapshot: revision.package_digest,
            },
          }
          expect(await readRunPayload(runReceipt.locator)).toEqual(stampedRun)
          await host.engineArtifacts.select({ locator: runReceipt.locator, purpose: "Read the existing immutable run observation before republishing it" })
          const runAlias = JSON.parse(await executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/run-evidence-bundle", payload: runSlot,
            resource_set: collectorResourceSet, source_artifact_locators: [campaignReceipt.locator],
          }, { host } as never)) as typeof runReceipt
          expect(await readRunPayload(runAlias.locator)).toEqual(stampedRun)
          expect(new Set([runReceipt.locator, runAlias.locator].map((item) => JSON.stringify(item))).size).toBe(2)
          const mislabeledRunReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: { ...runSlot, arm: "candidate" },
                resource_set: collectorResourceSet,
                source_artifact_locators: [campaignReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          // A later recorded step without a price keeps the tokens and makes
          // the cost unknown instead of pretending the unpriced step was free.
          UsageLedger.record({
            providerID: "provider",
            modelID: "model",
            purpose: "session",
            tokens: { input: 15, output: 5, reasoning: 0, cache: { read: 0, write: 0 }, total: 20 },
            costUSD: 0,
            billing: { status: "unpriced" },
            sessionID: trialWorkerSession.id,
            agentID: "target-worker",
          })
          await expect(executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/run-evidence-bundle", payload: runSlot,
            resource_set: collectorResourceSet, source_artifact_locators: [campaignReceipt.locator],
          }, { host } as never)).rejects.toThrow("run-evidence-bundle resource no longer equals a fresh collection of authoritative Task facts")
          const unpricedCollector = await collectTrial()
          const unpricedUsage = (await readCollector(unpricedCollector)).usage
          expect(unpricedUsage).toMatchObject({ token_usage: 100, cost: null, models: ["provider/model"] })
          expect(unpricedUsage.ledger_event_ids).toHaveLength(2)
          expect(unpricedUsage.ledger_event_ids.slice(0, 1)).toEqual(originalUsage.ledger_event_ids)
          const unpricedRunReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: runSlot,
                resource_set: TaskArtifactResourceSetLocatorSchema.parse(unpricedCollector.resource_set),
                source_artifact_locators: [campaignReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(await readRunPayload(unpricedRunReceipt.locator)).toEqual({
            ...stampedRun,
            run_evidence_sha256: unpricedCollector.resource.sha256,
            run_evidence_resource: {
              path: unpricedCollector.resource.path, media_type: unpricedCollector.resource.media_type,
              bytes: unpricedCollector.resource.bytes, sha256: unpricedCollector.resource.sha256,
            },
            token_usage: 100,
            cost: null,
          })
          expect((await readCollector(collectorReceipt)).usage).toEqual(originalUsage)
          // A step served by a second model means this Trial did not run on
          // one model, so it cannot fill a single-model Campaign slot at all.
          UsageLedger.record({
            providerID: "openai",
            modelID: "gpt-5.6-luna",
            purpose: "session",
            tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 }, total: 15 },
            costUSD: 0.5,
            billing: { status: "priced" },
            sessionID: trialWorkerSession.id,
            agentID: "target-worker",
          })
          const mixedModelCollector = await collectTrial()
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: runSlot,
                resource_set: TaskArtifactResourceSetLocatorSchema.parse(mixedModelCollector.resource_set),
                source_artifact_locators: [campaignReceipt.locator],
              },
              { host } as never,
            ),
          ).rejects.toThrow(
            'run-evidence-bundle requires the Trial\'s Provider usage ledger to record exactly one model; expected: one model, received: ["openai/gpt-5.6-luna","provider/model"].',
          )
          // A Trial served entirely by another model publishes that model, so
          // the Campaign's frozen-model check now has something real to refuse.
          // Workspace, environment, revision, case, and repetition all match
          // the Campaign here; the model is the only differing identity.
          const otherModelTrial = await createTrial()
          UsageLedger.record({
            providerID: "openai",
            modelID: "gpt-5.6-luna",
            purpose: "session",
            tokens: { input: 40, output: 10, reasoning: 0, cache: { read: 0, write: 0 }, total: 50 },
            costUSD: 0.75,
            billing: { status: "priced" },
            sessionID: otherModelTrial.trialWorkerSession.id,
            agentID: "target-worker",
          })
          const otherModelCollectorReceipt = JSON.parse(
            await collectRunEvidenceTool.execute(
              {
                task_id: otherModelTrial.trialTaskID,
                terminal_occurrence: otherModelTrial.terminalOccurrence,
                selected_messages: [],
              },
              { host } as never,
            ),
          ) as { resource_set: unknown }
          const otherModelRunReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/run-evidence-bundle",
                payload: runSlot,
                resource_set: TaskArtifactResourceSetLocatorSchema.parse(otherModelCollectorReceipt.resource_set),
                source_artifact_locators: [campaignReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(await readRunPayload(otherModelRunReceipt.locator)).toMatchObject({
            task_id: otherModelTrial.trialTaskID,
            model: "openai/gpt-5.6-luna",
            environment_digest: environmentResource.sha256,
            token_usage: 50,
            cost: 0.75,
          })
          await expect(
            executeEvolutionMetricsTool.execute(
              {
                campaign_spec_locator: campaignReceipt.locator,
                candidate_revision_locator: null,
                run_evidence_locator: otherModelRunReceipt.locator,
                iteration: 0,
                delivery_slice_revision_id: null,
                visual_feedback_verification_artifact_locators: [],
              },
              { host } as never,
            ),
          ).rejects.toThrow("Trial execution identity differs from the frozen campaign inputs")
          await expect(
            executeEvolutionMetricsTool.execute(
              {
                campaign_spec_locator: campaignReceipt.locator,
                candidate_revision_locator: null,
                run_evidence_locator: mislabeledRunReceipt.locator,
                iteration: 0,
                delivery_slice_revision_id: null,
                visual_feedback_verification_artifact_locators: [],
              },
              { host } as never,
            ),
          ).rejects.toBeInstanceOf(EvolutionMetricIdentityError)
          // The live Trial workspace changes after collection; only its
          // terminal commit is the measured subject.
          await writeFile(path.join(trialWorktree.directory, "g43-subject.txt"), "9")
          const metricOutcome = JSON.parse(
            await executeEvolutionMetricsTool.execute(
              {
                campaign_spec_locator: campaignReceipt.locator,
                candidate_revision_locator: null,
                run_evidence_locator: runReceipt.locator,
                iteration: 0,
                delivery_slice_revision_id: null,
                visual_feedback_verification_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as {
            receipt: {
              case_id: string
              arm: "baseline" | "candidate"
              repetition: number
              trial_task_id: string
              trial_revision_digest: string
              scorers: Array<{
                scorer_id: string
                status: "measured"
                value: number
                evidence: Array<Parameters<typeof host.engineArtifacts.read>[0]["locator"]>
              }>
            }
            resource_set: unknown
            resource: unknown
          }
          expect(metricOutcome.receipt).toMatchObject({
            case_id: "case-1",
            arm: "baseline",
            repetition: 0,
            trial_task_id: trialTaskID,
            trial_revision_digest: revision.package_digest,
            scorers: [{ scorer_id: "correctness", status: "measured", value: 1 }],
          })
          const subjectEvidence = metricOutcome.receipt.scorers[0]!.evidence[0]!
          if (subjectEvidence.source !== "task_artifact_resource") throw new Error("Expected the metric attempt resource")
          const subjectAttempt = MetricExecutionEvidence.parse(
            JSON.parse(new TextDecoder().decode(await host.taskArtifacts.read(subjectEvidence.ref))),
          )
          const subjectBundle = await readCollector(collectorReceipt)
          if (subjectBundle.workspace_checkpoint.result.kind !== "terminal_git")
            throw new Error("Expected the Trial's terminal Git result")
          const collectorIdentity = {
            path: collectorReceipt.resource.path,
            bytes: collectorReceipt.resource.bytes,
            sha256: collectorReceipt.resource.sha256,
          }
          expect(subjectAttempt).toMatchObject({
            task_id: taskID,
            status: "measured",
            raw_value: 1,
            subject: {
              resource: collectorIdentity,
              trial_task_id: trialTaskID,
              canonical_sha256: subjectBundle.canonical_sha256,
              result: {
                kind: "terminal_git",
                commit: subjectBundle.workspace_checkpoint.result.commit,
                tree: subjectBundle.workspace_checkpoint.result.tree,
              },
            },
            // The exact selected input shared with the judge renderer.
            selected_evidence: [
              { locator: { source: "task_artifact_resource", ref: collectorIdentity }, sha256: collectorIdentity.sha256 },
            ],
          })
          const measuredRunEnvelope = EngineArtifactEnvelopeSchema.parse(
            JSON.parse(
              (
                await host.engineArtifacts.read({
                  locator: runReceipt.locator,
                  byte_offset: 0,
                  max_bytes: 65_536,
                  delivery: "inline",
                })
              ).chunk.text!,
            ),
          )
          expect(subjectAttempt.subject.resource).toEqual(
            measuredRunEnvelope.resources.find((resource) => resource.sha256 === collectorIdentity.sha256),
          )
          const criteria = "Evaluate the selected Trial output"
          const rubric = [{ score: 1, label: "complete", anchor: "Output satisfies the request", passes: true }]
          const judgeInput = metricJudgeMessages({
            spec: {
              id: "g43-judge-renderer", task_id: taskID, scope: "global", goal_id: null,
              name: "g43-judge-renderer", description: criteria, unit: "ordinal", direction: "higher_better",
              target: 1, floor: 0, weight: 1, observation_class: "quality", evaluator_kind: "judge",
              source: "baseline", frozen_at: 1, created_by: "architect",
              evaluator_config: {
                scorer_revision: scorerResource.sha256, provider_id: "test-driver", model_id: "test-driver",
                inactivity_timeout_ms: 30_000, max_evidence_bytes: collectorReceipt.resource.bytes,
                criteria, rubric,
              },
            },
            criteria, rubric,
            selectedEvidence: [{
              locator: subjectAttempt.selected_evidence[0]!.locator,
              mediaType: "application/json",
              sha256: collectorIdentity.sha256,
              bytes: await host.taskArtifacts.read(subjectAttempt.subject.resource),
            }],
          })
          // Production message rendering, with no Provider call: content and
          // selected Message bodies are preserved, not a claim of model understanding.
          const judgeEvidence = JSON.parse(judgeInput[1]!.content).selected_evidence[0]
          expect(judgeEvidence.content).toBe(canonicalTaskRunEvidenceJSON(subjectBundle))
          expect(JSON.parse(judgeEvidence.content).messages).toEqual(subjectBundle.messages)
          subjectMaterialization = (subjectAttempt.execution as { cwd: string }).cwd
          expect(path.dirname(subjectMaterialization)).toBe(
            path.dirname(ProjectRuntimePaths.taskArtifactMaterializationRoot(project.path, taskID, "subject")),
          )
          expect({
            evaluator: await readFile(path.join(project.path, "g43-subject.txt"), "utf8"),
            liveTrial: await readFile(path.join(trialWorktree.directory, "g43-subject.txt"), "utf8"),
            measuredCopy: await readFile(path.join(subjectMaterialization, "g43-subject.txt"), "utf8"),
          }).toEqual({ evaluator: "0", liveTrial: "9", measuredCopy: "1" })
          const metricReceiptResourceSet = TaskArtifactResourceSetLocatorSchema.parse(metricOutcome.resource_set)
          const metricReceiptResource = TaskArtifactRefSchema.parse(metricOutcome.resource)
          const metricEvidenceLocator = metricOutcome.receipt.scorers[0]!.evidence[0]!
          expect(
            (
              await host.engineArtifacts.read({
                locator: metricEvidenceLocator,
                byte_offset: 0,
                max_bytes: 65_536,
                delivery: "inline",
              })
            ).chunk.complete,
          ).toBe(true)
          await host.engineArtifacts.select({
            locator: metricEvidenceLocator,
            purpose: "Exact metric execution evidence for the baseline arm",
          })
          // A contradicting arm used to be caught by comparing the stated
          // payload against the receipt. It is now unrepresentable: the arm is
          // not a field the Evaluator may state, so a wrong one is refused as
          // an unrecognized key instead of being compared against the truth.
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/evaluation-result",
                payload: { arm: "candidate" },
                resource_set: metricReceiptResourceSet,
                source_artifact_locators: [campaignReceipt.locator, runReceipt.locator, metricEvidenceLocator],
              },
              { host } as never,
            ),
          ).rejects.toThrow(/Unrecognized key/)
          ;(scope.owner as { agentID: string }).agentID = "evolution-evaluator"
          const evaluationReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/evaluation-result",
                payload: {},
                resource_set: metricReceiptResourceSet,
                source_artifact_locators: [campaignReceipt.locator, runReceipt.locator, metricEvidenceLocator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(
            (
              await host.engineArtifacts.read({
                locator: evaluationReceipt.locator,
                byte_offset: 0,
                max_bytes: 65_536,
                delivery: "inline",
              })
            ).chunk.complete,
          ).toBe(true)
          await host.engineArtifacts.select({
            locator: evaluationReceipt.locator,
            purpose: "Measured evaluation result for independent integrity review",
          })
          const evaluationAlias = JSON.parse(await executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/evaluation-result", payload: {}, resource_set: metricReceiptResourceSet,
            source_artifact_locators: [campaignReceipt.locator, runReceipt.locator, metricEvidenceLocator],
          }, { host } as never)) as typeof evaluationReceipt
          expect(new Set([evaluationReceipt.locator, evaluationAlias.locator].map((item) => JSON.stringify(item))).size).toBe(2)
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          const integrityReviewReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/integrity-review",
                payload: {
                  case_id: metricOutcome.receipt.case_id,
                  arm: metricOutcome.receipt.arm,
                  repetition: metricOutcome.receipt.repetition,
                  evaluation_result_locator: evaluationReceipt.locator,
                  status: "reviewed",
                  findings: [
                    {
                      category: "evidence_integrity",
                      invariant: "Frozen query scorer returned fresh immutable evidence",
                      outcome: "passed",
                      evidence: [metricEvidenceLocator, evaluationReceipt.locator],
                      severity: "info",
                      owner: "evolution-safety-auditor",
                      correction: null,
                    },
                    {
                      category: "security",
                      invariant: "The frozen Trial evidence supports its declared security boundary",
                      outcome: "unavailable",
                      evidence: [evaluationReceipt.locator],
                      severity: "blocker",
                      owner: "evolution-safety-auditor",
                      correction: "Obtain the missing boundary observation in an independent Trial",
                    },
                    {
                      category: "side_effect",
                      invariant: "The Trial made no external change beyond its frozen case",
                      outcome: "unavailable",
                      evidence: [evaluationReceipt.locator],
                      severity: "warning",
                      owner: "evolution-safety-auditor",
                      correction: null,
                    },
                  ],
                  accepted_limitations: [],
                  unknowns: ["candidate arm remains a separate immutable Trial"],
                },
                resource_set: null,
                source_artifact_locators: [evaluationReceipt.locator, metricEvidenceLocator],
              },
              { host } as never,
            ),
          ) as { locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(
            (
              await host.engineArtifacts.read({
                locator: integrityReviewReceipt.locator,
                byte_offset: 0,
                max_bytes: 65_536,
                delivery: "inline",
              })
            ).chunk.complete,
          ).toBe(true)
          await host.engineArtifacts.select({
            locator: integrityReviewReceipt.locator,
            purpose: "Independent integrity review for comparison recommendation",
          })
          const candidateDigest = "c".repeat(64)
          const candidateRevision = { ...revision, version: "2026.08.06.2", package_digest: candidateDigest }
          ;(scope.owner as { agentID: string }).agentID = "evolution-candidate-author"
          const candidateSource = await host.engineArtifacts.publish({
            artifact_type: "evolution-lab/candidate-revision",
            schema_version: 1,
            label: "Exact candidate revision source",
            payload: {
              development_campaign_locator: campaignReceipt.locator,
              feedback: null,
              parent_revision: revision,
              candidate_revision: candidateRevision,
              parent_resources: [caseResource],
              candidate_resources: [caseResource],
              hypothesis: "Exact evidence language closes the gap",
              changed_paths: ["README.md"],
              diff_sha256: candidateDigest,
              frozen_files: [],
              manager_receipt: {
                operation: "validated",
                namespace: candidateRevision.namespace,
                id: candidateRevision.id,
                version: candidateRevision.version,
                package_digest: candidateRevision.package_digest,
              },
              provenance: [campaignReceipt.locator],
            },
            resources: [],
            source_artifact_locators: [campaignReceipt.locator],
          })
          ;(scope.owner as { agentID: string }).agentID = "evolution-recommendation-owner"
          const originalReviewLocator = EngineArtifactLocatorSchema.parse(integrityReviewReceipt.locator)
          const expectedComparison = {
            baseline_revision: revision,
            candidate_revision: candidateRevision,
            paired_deltas: [],
            cost_delta: null,
            token_delta: null,
            activity_duration_ms_delta: null,
            outcome_rates: {
              baseline: { failure: 1, unavailable: 0 },
              candidate: { failure: 0, unavailable: 1 },
            },
            aggregate_score: null,
            aggregate_interval: null,
            regressions: [],
            unavailable_dimensions: [
              "activity_duration_ms_delta",
              "aggregate_score",
              "cost_delta",
              "evaluation:case-1:candidate:0",
              `integrity_finding:case-1:baseline:0:${originalReviewLocator.artifact_id}:security:1`,
              `integrity_finding:case-1:baseline:0:${originalReviewLocator.artifact_id}:side_effect:2`,
              "integrity_review:case-1:candidate:0",
              "run:case-1:candidate:0",
              "scorer:correctness:case-1:candidate:0",
              "token_delta",
            ],
            required_unavailable_dimensions: [
              "aggregate_score",
              "evaluation:case-1:candidate:0",
              `integrity_finding:case-1:baseline:0:${originalReviewLocator.artifact_id}:security:1`,
              "integrity_review:case-1:candidate:0",
              "run:case-1:candidate:0",
              "scorer:correctness:case-1:candidate:0",
            ],
            unknowns: ["candidate arm remains a separate immutable Trial"],
            visual_review: { status: "not_applicable", evidence: [] },
            reward_hacking_review: { findings: [], evidence: [] },
            confidence: "low",
            recommendation: "inconclusive",
          }
          const recommendationReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/comparison-recommendation",
                payload: {},
                resource_set: null,
                source_artifact_locators: [
                  campaignReceipt.locator,
                  candidateSource.locator,
                  runReceipt.locator,
                  evaluationReceipt.locator,
                ],
              },
              { host } as never,
            ),
          ) as { artifact_type: string; locator: Parameters<typeof host.engineArtifacts.read>[0]["locator"] }
          expect(recommendationReceipt.artifact_type).toBe("evolution-lab/comparison-recommendation")
          const comparisonRead = await host.engineArtifacts.read({
            locator: recommendationReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          expect(comparisonRead.chunk.complete).toBe(true)
          const comparisonEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(comparisonRead.chunk.text!))
          expect(comparisonEnvelope.payload).toEqual(expectedComparison)
          const aliasComparison = JSON.parse(await executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/comparison-recommendation", payload: {}, resource_set: null,
            source_artifact_locators: [campaignReceipt.locator, candidateSource.locator, runReceipt.locator,
              runAlias.locator, evaluationReceipt.locator, evaluationAlias.locator],
          }, { host } as never)) as typeof recommendationReceipt
          const aliasRead = await host.engineArtifacts.read({ locator: aliasComparison.locator,
            byte_offset: 0, max_bytes: 65_536, delivery: "inline" })
          const aliasEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(aliasRead.chunk.text!))
          expect(aliasEnvelope.payload).toEqual(expectedComparison)
          expect(aliasEnvelope.source_artifact_locators.filter((item) => [runReceipt.locator, runAlias.locator,
            evaluationReceipt.locator, evaluationAlias.locator].some((alias) => JSON.stringify(alias) === JSON.stringify(item))).length).toBe(4)
          const comparisonSources = [
            campaignReceipt.locator,
            candidateSource.locator,
            runReceipt.locator,
            evaluationReceipt.locator,
          ]
          const publishComparison = async () => {
            ;(scope.owner as { agentID: string }).agentID = "evolution-recommendation-owner"
            const receipt = JSON.parse(
              await executePublishEvolutionArtifact(
                {
                  artifact_type: "evolution-lab/comparison-recommendation",
                  payload: {},
                  resource_set: null,
                  source_artifact_locators: comparisonSources,
                },
                { host } as never,
              ),
            ) as { locator: EngineArtifactLocator }
            const read = await host.engineArtifacts.read({
              locator: receipt.locator,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            })
            expect(read.chunk.complete).toBe(true)
            return EngineArtifactEnvelopeSchema.parse(JSON.parse(read.chunk.text!))
          }
          const reviewPayload = {
            case_id: metricOutcome.receipt.case_id,
            arm: metricOutcome.receipt.arm,
            repetition: metricOutcome.receipt.repetition,
            evaluation_result_locator: evaluationReceipt.locator,
            status: "reviewed",
            findings: [],
            accepted_limitations: [],
            unknowns: [],
          }
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          const parallelReview = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/integrity-review",
                payload: reviewPayload,
                resource_set: null,
                // An ordinary citation is evidence, not a replacement operation.
                source_artifact_locators: [evaluationReceipt.locator, originalReviewLocator],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          const parallelComparison = await publishComparison()
          expect(parallelComparison.payload).toEqual(expectedComparison)
          expect(parallelComparison.source_artifact_locators).toEqual(
            expect.arrayContaining([originalReviewLocator, parallelReview.locator]),
          )
          // More than one real catalog page: later independent pass findings
          // must all remain attributable, without replacing the blocker.
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          const pagedReviews: EngineArtifactLocator[] = []
          for (let index = 0; index < 100; index++) {
            const receipt = JSON.parse(
              await executePublishEvolutionArtifact(
                {
                  artifact_type: "evolution-lab/integrity-review",
                  payload: {
                    ...reviewPayload,
                    findings: [
                      {
                        category: "evidence_integrity",
                        invariant: `Independent fixture observation ${index}`,
                        outcome: "passed",
                        evidence: [evaluationReceipt.locator],
                        severity: "info",
                        owner: "evolution-safety-auditor",
                        correction: null,
                      },
                    ],
                  },
                  resource_set: null,
                  source_artifact_locators: [evaluationReceipt.locator],
                },
                { host } as never,
              ),
            ) as { locator: EngineArtifactLocator }
            pagedReviews.push(receipt.locator)
          }
          const pagedComparison = await publishComparison()
          expect(pagedComparison.payload).toEqual(expectedComparison)
          expect(pagedComparison.source_artifact_locators).toEqual(expect.arrayContaining(pagedReviews))
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/integrity-review",
                payload: {
                  ...reviewPayload,
                  revision: {
                    supersedes: [originalReviewLocator, originalReviewLocator],
                    reason: "Duplicate parent input.",
                  },
                },
                resource_set: null,
                source_artifact_locators: [evaluationReceipt.locator, originalReviewLocator],
              },
              { host } as never,
            ),
          ).rejects.toThrow("Review revision must identify each superseded Review exactly once")
          const revisedReview = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/integrity-review",
                payload: {
                  ...reviewPayload,
                  revision: {
                    supersedes: [originalReviewLocator, parallelReview.locator, ...pagedReviews],
                    reason:
                      "Reconsidering the same measured evidence establishes that both prior missing-observation claims were inapplicable; no new Trial or evidence was required.",
                  },
                },
                resource_set: null,
                source_artifact_locators: [
                  evaluationReceipt.locator,
                  originalReviewLocator,
                  parallelReview.locator,
                  ...pagedReviews,
                ],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          const revisedComparison = await publishComparison()
          expect(revisedComparison.payload).toEqual({
            ...expectedComparison,
            unavailable_dimensions: [
              "activity_duration_ms_delta",
              "aggregate_score",
              "cost_delta",
              "evaluation:case-1:candidate:0",
              "integrity_review:case-1:candidate:0",
              "run:case-1:candidate:0",
              "scorer:correctness:case-1:candidate:0",
              "token_delta",
            ],
            required_unavailable_dimensions: [
              "aggregate_score",
              "evaluation:case-1:candidate:0",
              "integrity_review:case-1:candidate:0",
              "run:case-1:candidate:0",
              "scorer:correctness:case-1:candidate:0",
            ],
            unknowns: [],
          })
          expect(revisedComparison.source_artifact_locators).toEqual(
            expect.arrayContaining([originalReviewLocator, parallelReview.locator, revisedReview.locator]),
          )
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          const aliasReview = JSON.parse(await executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/integrity-review", resource_set: null,
            payload: { ...reviewPayload, evaluation_result_locator: evaluationAlias.locator,
              findings: [{ category: "permission", invariant: "New finding on the identical measurement alias",
                outcome: "unavailable", evidence: [evaluationAlias.locator], severity: "blocker",
                owner: "evolution-safety-auditor", correction: "Investigate the declared evidence boundary." }] },
            source_artifact_locators: [evaluationAlias.locator],
          }, { host } as never)) as { locator: EngineArtifactLocator }
          const aliasReviewedComparison = await publishComparison()
          const aliasRequired = `integrity_finding:case-1:baseline:0:${aliasReview.locator.artifact_id}:permission:0`
          expect((aliasReviewedComparison.payload as typeof expectedComparison).required_unavailable_dimensions)
            .toEqual([...(revisedComparison.payload as typeof expectedComparison).required_unavailable_dimensions, aliasRequired].sort())
          expect(aliasReviewedComparison.source_artifact_locators).toEqual(expect.arrayContaining([
            runAlias.locator, evaluationAlias.locator, aliasReview.locator,
          ]))
          ;(scope.owner as { agentID: string }).agentID = "evolution-safety-auditor"
          const correctedAliasReview = JSON.parse(await executePublishEvolutionArtifact({
            artifact_type: "evolution-lab/integrity-review", resource_set: null,
            payload: { ...reviewPayload, evaluation_result_locator: evaluationAlias.locator,
              revision: { supersedes: [aliasReview.locator], reason: "The same original evidence resolves the earlier uncertainty." } },
            source_artifact_locators: [evaluationAlias.locator, aliasReview.locator],
          }, { host } as never)) as { locator: EngineArtifactLocator }
          const correctedAliasComparison = await publishComparison()
          expect(correctedAliasComparison.payload).toEqual(revisedComparison.payload)
          expect(correctedAliasComparison.source_artifact_locators).toEqual(expect.arrayContaining([
            evaluationReceipt.locator, evaluationAlias.locator, aliasReview.locator, correctedAliasReview.locator,
          ]))
        })
        // The measured copy belonged to that invocation and closed with it.
        await expect(stat(subjectMaterialization)).rejects.toMatchObject({ code: "ENOENT" })

        const sourceCompleted = Date.now()
        await completeFixtureTaskWithDeliverables({
          taskID,
          sessionID: session.id,
          deliverableArtifactLocators: [
            sourceOpportunityLocator,
            sourceAttributionLocator,
            sourceCampaignLocator,
            sourceRunLocator,
          ],
          completedAt: sourceCompleted,
        })
        const importedTaskID = Identifier.ascending("task")
        const importedSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Imported campaign evaluation",
        })
        const preparedImports = await prepareCrossTaskArtifactImports({
          imports: [
            { source_task_id: taskID, locator: sourceOpportunityLocator },
            { source_task_id: taskID, locator: sourceAttributionLocator },
            { source_task_id: taskID, locator: sourceCampaignLocator },
            { source_task_id: taskID, locator: sourceRunLocator },
          ],
          projectID: Instance.project.id,
          targetProjectDirectory: project.path,
          targetTaskID: importedTaskID,
          importer: {
            missionID,
            sessionID: missionSessionID,
            messageID: Identifier.ascending("message"),
            toolCallID: "call-campaign-import",
          },
        })
        persistTask({
          taskID: importedTaskID,
          rootSession: importedSession,
          now: sourceCompleted + 1,
          title: "Imported campaign evaluation",
          request: "Rehydrate campaign inputs and evaluate the imported baseline run",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: missionSessionID } },
          projectID: Instance.project.id,
          artifactImports: preparedImports,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "evolution-lab",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await taskProcessBinding(importedTaskID, loaded.packageDigest, sourceCompleted + 1),
        })
        const importedLocators = new Map<string, EngineArtifactLocator>()
        for (const prepared of preparedImports) {
          const envelope = EngineArtifactEnvelopeSchema.parse(prepared.importedEnvelope)
          const row = Database.use((db) =>
            db
              .select({
                id: EngineArtifactTable.id,
                catalogRevision: EngineArtifactTable.catalog_revision,
                sha256: EngineArtifactTable.payload_sha256,
              })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, prepared.importedArtifactID))
              .get(),
          )!
          importedLocators.set(envelope.artifact_type, {
            source: "engine_artifact",
            artifact_id: row.id,
            catalog_revision: row.catalogRevision,
            expected_sha256: row.sha256,
          })
        }
        const importedCampaignLocator = importedLocators.get("evolution-lab/campaign-spec")!
        const importedRunLocator = importedLocators.get("evolution-lab/run-evidence-bundle")!
        const importedOpportunityLocator = importedLocators.get("evolution-lab/opportunity")!
        const importedAttributionLocator = importedLocators.get("evolution-lab/failure-attribution")!
        const importedUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: importedSession.id,
          role: "user",
          author: "user",
          time: { created: sourceCompleted + 1 },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        // Producer Messages live on a child worker Session; a root Session
        // carries the operator's user Messages only.
        const importedWorkerSession = await Session.create({
          kind: "assistant",
          parentID: importedSession.id,
          title: "Imported campaign evaluation worker",
        })
        const importedAssistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: importedWorkerSession.id,
          role: "assistant",
          author: "evolution-evaluator",
          time: { created: sourceCompleted + 1 },
          parentID: importedUser.id,
          modelID: "test",
          providerID: "test",
          agent: "evolution-evaluator",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        await Session.updatePart({
          id: "part--step-imported-campaign-evaluation",
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-imported-campaign-evaluation",
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          type: "tool",
          callID: "call-imported-campaign-evaluation",
          tool: "rehydrate-evolution-resources",
          state: { status: "running", input: {}, time: { start: sourceCompleted + 2 } },
        })
        const importedScope = {
          kind: "task" as const,
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: importedTaskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, importedTaskID),
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          toolCallID: "call-imported-campaign-evaluation",
          toolPartID: "part-imported-campaign-evaluation",
          executionSurface: {},
          owner: {
            kind: "projected-worker" as const,
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "project" as const,
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "evolution-lab",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "evolution-evaluator",
            projectionHash: "5".repeat(64),
            workerTurnDescriptorID: "descriptor-imported-campaign",
            workerTurnDescriptorHash: "6".repeat(64),
          },
        } satisfies TaskToolExecutionScope
        await withTaskScopedPluginToolHost(importedScope, async (host) => {
          const rehydrated = JSON.parse(
            await rehydrateEvolutionResourcesTool.execute(
              { artifact_locator: importedCampaignLocator, resource_role: "campaign_inputs" },
              { host } as never,
            ),
          ) as {
            resource_set: Parameters<typeof TaskArtifactResourceSetLocatorSchema.parse>[0]
            role_resources: Array<{ role: string; resource: { path: string } }>
          }
          expect(rehydrated.role_resources.map((item) => item.role).sort()).toEqual([
            "case:case-1",
            "dataset",
            "environment",
            "model_configuration",
            "permission_snapshot",
            "scorer:correctness",
            "workspace_template",
          ])
          const resourcePathByRole = new Map(rehydrated.role_resources.map((item) => [item.role, item.resource.path]))
          const importedCampaignInput = {
            ...sourceCampaignInput,
            resource_roles: {
              dataset_path: resourcePathByRole.get("dataset")!,
              cases: [{ case_id: "case-1", resource_path: resourcePathByRole.get("case:case-1")! }],
              model_configuration_path: resourcePathByRole.get("model_configuration")!,
              environment_path: resourcePathByRole.get("environment")!,
              workspace_template_path: resourcePathByRole.get("workspace_template")!,
              permission_snapshot_path: resourcePathByRole.get("permission_snapshot")!,
              scorer_assets: [
                { scorer_id: "correctness", resource_path: resourcePathByRole.get("scorer:correctness")! },
              ],
            },
          }
          ;(importedScope.owner as { agentID: string }).agentID = "evolution-observer"
          const unrelatedOpportunity = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/opportunity",
                payload: { ...sourceOpportunityInput, observable_symptom: "Unrelated imported-task opportunity" },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          await host.engineArtifacts.read({
            locator: unrelatedOpportunity.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          await host.engineArtifacts.select({
            locator: unrelatedOpportunity.locator,
            purpose: "Different current opportunity for imported correlation mismatch",
          })
          ;(importedScope.owner as { agentID: string }).agentID = "evolution-experiment-planner"
          let mismatchedPairError: unknown
          try {
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/campaign-spec",
                payload: importedCampaignInput,
                resource_set: rehydrated.resource_set,
                source_artifact_locators: [unrelatedOpportunity.locator, importedAttributionLocator],
              },
              { host } as never,
            )
          } catch (error) {
            mismatchedPairError = error
          }
          expect(mismatchedPairError).toBeInstanceOf(EvolutionArtifactIntegrityError)
          expect((mismatchedPairError as Error).message).toBe(
            "campaign failure-attribution must directly identify its exact opportunity source",
          )
          const importedPairCampaign = await withTaskScopedPluginToolHost(importedScope, async (publicationHost) => {
            for (const [locator, purpose] of [
              [importedOpportunityLocator, "Exact imported opportunity for Campaign correlation"],
              [importedAttributionLocator, "Exact imported attribution for Campaign correlation"],
            ] as const) {
              const read = await publicationHost.engineArtifacts.read({
                locator,
                byte_offset: 0,
                max_bytes: 65_536,
                delivery: "inline",
              })
              expect(read.chunk.complete).toBe(true)
              await publicationHost.engineArtifacts.select({ locator, purpose })
            }
            return JSON.parse(
              await executePublishEvolutionArtifact(
                {
                  artifact_type: "evolution-lab/campaign-spec",
                  payload: importedCampaignInput,
                  resource_set: rehydrated.resource_set,
                  source_artifact_locators: [importedOpportunityLocator, importedAttributionLocator],
                },
                { host: publicationHost } as never,
              ),
            ) as { locator: EngineArtifactLocator }
          })
          const importedPairCampaignRead = await host.engineArtifacts.read({
            locator: importedPairCampaign.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          expect(
            EngineArtifactEnvelopeSchema.parse(JSON.parse(importedPairCampaignRead.chunk.text!))
              .source_artifact_locators.map((locator) => JSON.stringify(locator))
              .toSorted(),
          ).toEqual(
            [importedOpportunityLocator, importedAttributionLocator]
              .map((locator) => JSON.stringify(locator))
              .toSorted(),
          )
          ;(importedScope.owner as { agentID: string }).agentID = "evolution-evaluator"
          const importedMetricOutcome = JSON.parse(
            await executeEvolutionMetricsTool.execute(
              {
                campaign_spec_locator: importedCampaignLocator,
                candidate_revision_locator: null,
                run_evidence_locator: importedRunLocator,
                iteration: 0,
                delivery_slice_revision_id: null,
                visual_feedback_verification_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { receipt: { trial_task_id: string; scorers: Array<{ value: number }> } }
          expect(importedMetricOutcome.receipt).toMatchObject({
            trial_task_id: expect.any(String),
            scorers: [{ value: 1 }],
          })
        })
      },
    })
  })

  test("loads the current Evolution Lab comparison from the embedded production package", async () => {
    const source = path.resolve(import.meta.dir, "../../../expert-squads/builtin/evolution-lab")
    const sourcePackage = await ExpertSquadRegistry.loadSourcePackage(source)
    const embeddedSource = payloadPackageSources.find(
      (entry) => entry.namespace === "builtin" && entry.id === "evolution-lab",
    )
    expect(embeddedSource).toBeDefined()
    const embeddedPackage = ExpertSquadRegistry.loadEmbeddedPackage(embeddedSource!)

    expect(embeddedPackage.manifest.version).toBe("2026.09.27.5")
    expect(embeddedPackage.packageDigest).toBe(sourcePackage.packageDigest)
    expect(generatedExpertSquadRevisions["evolution-lab"]?.version).toBe(embeddedPackage.manifest.version)
    expect(generatedExpertSquadRevisions["evolution-lab"]?.contentDigest).toBe(
      packageContentDigest(path.resolve(import.meta.dir, "../../.."), source),
    )
  })

  test("loads the self-contained package ABI and materializes one exact immutable revision", async () => {
    const source = path.resolve(import.meta.dir, "../../../expert-squads/builtin/evolution-lab")
    const loaded = await ExpertSquadRegistry.loadSourcePackage(source)
    expect(loaded.id).toBe("evolution-lab")
    expect([...loaded.packageToolBundles.keys()].sort()).toEqual([
      "evolution-lab/shared/collect-run-evidence",
      "evolution-lab/shared/execute-evolution-metrics",
      "evolution-lab/shared/expert-squad-package",
      "evolution-lab/shared/publish-evolution-artifact",
      "evolution-lab/shared/rehydrate-evolution-resources",
    ])

    const project = await sharedProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Evolution package fixture",
        })
        const taskID = Identifier.ascending("task")
        const missionID = "evolution-candidate-chain"
        const missionSession = await Session.create({
          kind: "mission",
          title: "Evolution candidate chain",
          metadata: {
            mission: {
              id: missionID,
              channelKey: `mission:${missionID}`,
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["evolution-lab"],
            },
          },
        })
        const missionSessionID = missionSession.id
        const timeCreated = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now: timeCreated,
          title: "Evolution package fixture",
          request: "Materialize exact package revision",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: missionSessionID } },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "built_in",
            projectID: null,
            namespace: "builtin",
            id: "evolution-lab",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await taskProcessBinding(taskID, loaded.packageDigest, timeCreated),
        })
        const createExecution = (identity: string) =>
          createTaskArtifactStoreExecution({
            kind: "task",
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
            sessionID: session.id,
            messageID: `message-package-owner-${identity}`,
            toolCallID: `call-package-owner-${identity}`,
            toolPartID: `part-package-owner-${identity}`,
            executionSurface: {},
            owner: {
              kind: "projected-worker",
              expertSquadID: "evolution-lab",
              packageRevision: {
                scope: "built_in",
                projectID: null,
                namespace: "builtin",
                id: "evolution-lab",
                version: loaded.manifest.version,
                packageDigest: loaded.packageDigest,
              },
              agentID: "evolution-candidate-author",
              projectionHash: "b".repeat(64),
              workerTurnDescriptorID: "descriptor-package-owner",
              workerTurnDescriptorHash: "c".repeat(64),
            },
          } as unknown as TaskToolExecutionScope)
        const materializeExecution = createExecution("prepare-candidate")
        const candidateWorktree = path.join(
          ProjectRuntimePaths.taskRoot(project.path, taskID),
          "sessions",
          session.id,
          "worktree",
        )
        const preparationScope = {
          taskID,
          projectDirectory: project.path,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          executionDirectory: candidateWorktree,
          owner: { kind: "projected-worker" },
        } as TaskToolExecutionScope
        const packageHost = createExpertSquadPackageHost(materializeExecution, preparationScope)
        const artifactsBeforeInspection = Database.use(
          (db) =>
            db
              .select({ id: EngineArtifactTable.id })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.task_id, taskID))
              .all().length,
        )
        const inspected = await packageHost.inspectRevision({
          revision: { package_digest: loaded.packageDigest },
        })
        expect(inspected).toMatchObject({
          package_digest: loaded.packageDigest,
          namespace: loaded.namespace,
          id: loaded.id,
          version: loaded.manifest.version,
        })
        expect(
          Database.use(
            (db) =>
              db
                .select({ id: EngineArtifactTable.id })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.task_id, taskID))
                .all().length,
          ),
        ).toBe(artifactsBeforeInspection)
        const inspectedCandidateRoot = path.join(
          candidateWorktree,
          "expert-squad-evolution-candidates",
          taskID,
          loaded.namespace,
          loaded.id,
        )
        expect(
          await stat(inspectedCandidateRoot).catch((error: NodeJS.ErrnoException) =>
            error.code === "ENOENT" ? undefined : Promise.reject(error),
          ),
        ).toBeUndefined()
        await mkdir(candidateWorktree, { recursive: true })
        const materialized = PreparedExpertSquadCandidateSchema.parse(
          JSON.parse(
            await expertSquadPackageTool.execute(
              { action: "prepare_candidate", package_digest: loaded.packageDigest },
              {
                host: {
                  expertSquadPackages: packageHost,
                },
              } as never,
            ),
          ),
        )
        expect(materialized).toMatchObject({
          package_digest: loaded.packageDigest,
          namespace: "builtin",
          id: "evolution-lab",
          version: loaded.manifest.version,
          resource_set: { tree: "package" },
          package_root: `expert-squad-evolution-candidates/${taskID}/builtin/evolution-lab`,
        })
        expect(
          (await ExpertSquadRegistry.loadSourcePackage(path.join(candidateWorktree, materialized.package_root)))
            .packageDigest,
        ).toBe(loaded.packageDigest)
        await materializeExecution.close()

        const candidateExecution = createExecution("candidate")
        const validated = ValidatedExpertSquadPackageSchema.parse(
          JSON.parse(
            await expertSquadPackageTool.execute({ action: "validate", resource_set: materialized.resource_set }, {
              host: { expertSquadPackages: createExpertSquadPackageHost(candidateExecution) },
            } as never),
          ),
        )
        expect(validated.package_digest).toBe(loaded.packageDigest)
        expect(validated.files.map((file) => file.path)).toEqual([
          "README.md",
          "agents/evolution-candidate-author/system.md",
          "agents/evolution-evaluator/system.md",
          "agents/evolution-experiment-planner/system.md",
          "agents/evolution-failure-analyst/system.md",
          "agents/evolution-observer/system.md",
          "agents/evolution-recommendation-owner/system.md",
          "agents/evolution-safety-auditor/system.md",
          "agents/orchestrator/system.md",
          "expert-squad.jsonc",
          "lib/evolution-lab/artifacts.ts",
          "lib/evolution-lab/candidate-integrity.ts",
          "lib/evolution-lab/comparison.ts",
          "selector.md",
          "skills/campaign/SKILL.md",
          "skills/campaign/references/artifact-ownership.md",
          "skills/campaign/references/scorer-contract.json",
          "tools/collect-run-evidence.ts",
          "tools/execute-evolution-metrics.ts",
          "tools/expert-squad-package.ts",
          "tools/publish-evolution-artifact.ts",
          "tools/rehydrate-evolution-resources.ts",
        ])

        const candidateStage = await candidateExecution.stage({ trees: ["candidate"] })
        const candidateDirectory = candidateStage.treeDirectories.candidate!
        const parentMaterialization = await candidateExecution.materialize({
          snapshot: materialized.resource_set.snapshot,
          tree: materialized.resource_set.tree,
        })
        await cp(parentMaterialization.directory, candidateDirectory, { recursive: true })
        const candidateReadme = path.join(candidateDirectory, "README.md")
        await writeFile(
          candidateReadme,
          `${await readFile(candidateReadme, "utf8")}\nCandidate instruction refinement.\n`,
        )
        const candidateManifest = path.join(candidateDirectory, "expert-squad.jsonc")
        const candidateVersion = loaded.manifest.version.replace(/(\d+)$/, (ordinal) => String(Number(ordinal) + 1))
        await writeFile(
          candidateManifest,
          (await readFile(candidateManifest, "utf8")).replace(
            `"version": "${loaded.manifest.version}"`,
            `"version": "${candidateVersion}"`,
          ),
        )
        const candidatePublication = await candidateExecution.publish(candidateStage, {
          snapshot_kind: "catalog",
          files: validated.files.map((file) => ({
            tree: "candidate",
            path: file.path,
            media_type: file.utf8_text ? "text/plain" : "application/octet-stream",
          })),
        })
        const candidateResourceSet = TaskArtifactResourceSetLocatorSchema.parse({
          snapshot: candidatePublication.snapshot,
          tree: "candidate",
        })
        await candidateExecution.close()

        const compareExecution = createExecution("compare")
        const comparison = JSON.parse(
          await expertSquadPackageTool.execute(
            {
              action: "compare",
              resource_set: materialized.resource_set,
              candidate_resource_set: candidateResourceSet,
            },
            { host: { expertSquadPackages: createExpertSquadPackageHost(compareExecution) } } as never,
          ),
        ) as {
          parent_digest: string
          candidate_digest: string
          diff_sha256: string
          mutable_paths: string[]
          changed_paths: string[]
          frozen_files: Array<{ path: string; parent_sha256: string; candidate_sha256: string }>
        }
        const validatedCandidate = ValidatedExpertSquadPackageSchema.parse(
          JSON.parse(
            await expertSquadPackageTool.execute({ action: "validate", resource_set: candidateResourceSet }, {
              host: { expertSquadPackages: createExpertSquadPackageHost(compareExecution) },
            } as never),
          ),
        )
        const parentPackageResources = await compareExecution.resources(materialized.resource_set)
        const candidatePackageResources = await compareExecution.resources(candidateResourceSet)
        const portableResource = (resource: (typeof parentPackageResources)[number]) => ({
          path: resource.path,
          media_type: resource.media_type,
          bytes: resource.bytes,
          sha256: resource.sha256,
        })
        expect(validatedCandidate).toMatchObject({
          namespace: "builtin",
          id: "evolution-lab",
          version: candidateVersion,
          package_digest: comparison.candidate_digest,
          resource_set: candidateResourceSet,
        })
        expect(comparison.changed_paths).toEqual(["README.md", "expert-squad.jsonc"])
        expect(comparison.mutable_paths).toEqual([
          "README.md",
          "agents/evolution-candidate-author/system.md",
          "agents/evolution-evaluator/system.md",
          "agents/evolution-experiment-planner/system.md",
          "agents/evolution-failure-analyst/system.md",
          "agents/evolution-observer/system.md",
          "agents/evolution-recommendation-owner/system.md",
          "agents/evolution-safety-auditor/system.md",
          "agents/orchestrator/system.md",
          "selector.md",
          "skills/campaign/SKILL.md",
          "skills/campaign/references/artifact-ownership.md",
          "skills/campaign/references/scorer-contract.json",
        ])
        expect(comparison.frozen_files.map((file) => file.path)).toEqual([
          "lib/evolution-lab/artifacts.ts",
          "lib/evolution-lab/candidate-integrity.ts",
          "lib/evolution-lab/comparison.ts",
          "tools/collect-run-evidence.ts",
          "tools/execute-evolution-metrics.ts",
          "tools/expert-squad-package.ts",
          "tools/publish-evolution-artifact.ts",
          "tools/rehydrate-evolution-resources.ts",
        ])
        expect(comparison.diff_sha256).toHaveLength(64)
        await compareExecution.close()

        const candidateUserMessage = await Session.updateMessage({
          id: "message-candidate-user",
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        // Producer Messages live on a child worker Session; a root Session
        // carries the operator's user Messages only.
        const candidateWorkerSession = await Session.create({
          kind: "assistant",
          parentID: session.id,
          title: "Evolution candidate worker",
        })
        const candidateAssistantMessage = await Session.updateMessage({
          id: "message-candidate-assistant",
          sessionID: candidateWorkerSession.id,
          role: "assistant",
          author: "evolution-candidate-author",
          time: { created: Date.now() },
          parentID: candidateUserMessage.id,
          modelID: "test",
          providerID: "test",
          agent: "evolution-candidate-author",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        await Session.updatePart({
          id: "part--step-candidate-publisher",
          sessionID: candidateWorkerSession.id,
          messageID: candidateAssistantMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-candidate-publisher",
          sessionID: candidateWorkerSession.id,
          messageID: candidateAssistantMessage.id,
          type: "tool",
          callID: "call-candidate-publisher",
          tool: "publish-evolution-artifact",
          state: { status: "running", input: {}, time: { start: Date.now() } },
        })
        const candidatePublisherScope = {
          kind: "task" as const,
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: candidateWorkerSession.id,
          messageID: candidateAssistantMessage.id,
          toolCallID: "call-candidate-publisher",
          toolPartID: "part-candidate-publisher",
          executionSurface: {},
          owner: {
            kind: "projected-worker" as const,
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "built_in" as const,
              projectID: null,
              namespace: "builtin",
              id: "evolution-lab",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "evolution-candidate-author",
            projectionHash: "b".repeat(64),
            workerTurnDescriptorID: "descriptor-candidate-publisher",
            workerTurnDescriptorHash: "c".repeat(64),
          },
        } satisfies TaskToolExecutionScope
        let candidateArtifactLocator!: Parameters<typeof rehydrateEvolutionResourcesTool.execute>[0]["artifact_locator"]
        await withTaskScopedPluginToolHost(candidatePublisherScope, async (host) => {
          const developmentResource = portableResource(parentPackageResources[0]!)
          const developmentCampaign = await host.engineArtifacts.publish({
            artifact_type: "evolution-lab/campaign-spec",
            schema_version: 1,
            label: "Development campaign fixture",
            payload: {
              target: {
                scope: "built_in",
                project_id: null,
                project_directory: null,
                namespace: "builtin",
                id: "evolution-lab",
              },
              baseline_revision: {
                namespace: "builtin",
                id: "evolution-lab",
                version: loaded.manifest.version,
                package_digest: loaded.packageDigest,
              },
              candidate_version_policy: "increment the dated revision ordinal",
              candidate_hypothesis: "Refine the exact candidate author instruction",
              dataset_partition: "development",
              dataset_digest: developmentResource.sha256,
              cases: ["case-1"],
              scorer_digests: [developmentResource.sha256],
              scorers: [
                {
                  scorer_id: "correctness",
                  scorer_revision: developmentResource.sha256,
                  scope: "global",
                  goal_id: null,
                  description: "Exact package fixture scorer",
                  unit: "ratio",
                  direction: "higher_better",
                  target: 1,
                  floor: 0,
                  weight: 1,
                  observation_class: "quality",
                  evaluator_kind: "query",
                  evaluator_config: {
                    scorer_revision: developmentResource.sha256,
                    query: "constant_value",
                    value: 1,
                  },
                },
              ],
              frozen_inputs: {
                dataset: developmentResource,
                cases: [{ case_id: "case-1", resource: developmentResource }],
                model_configuration: developmentResource,
                environment: developmentResource,
                workspace_template: developmentResource,
                permission_snapshot: developmentResource,
                scorer_assets: [
                  {
                    scorer_id: "correctness",
                    scorer_revision: developmentResource.sha256,
                    resource: developmentResource,
                  },
                ],
              },
              model: "provider/model",
              model_configuration_digest: developmentResource.sha256,
              environment_digest: developmentResource.sha256,
              workspace_digest: developmentResource.sha256,
              permission_snapshot_digest: developmentResource.sha256,
              external_side_effect_policy: "No production side effects",
              repetitions: 1,
              arm_order: ["baseline", "candidate"],
              statistics: "paired descriptive result",
              budget: { max_runs: 2, max_cost: 1 },
              inactivity_timeout_ms: 60_000,
              ui_rubric_digest: null,
              mutable_paths: comparison.mutable_paths,
              trial_execution: { status: "unavailable", reason_code: "product_release_required" },
            },
            resources: [],
            source_artifact_locators: [],
          })
          const developmentCampaignRead = await host.engineArtifacts.read({
            locator: developmentCampaign.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const developmentCampaignEnvelope = EngineArtifactEnvelopeSchema.parse(
            JSON.parse(developmentCampaignRead.chunk.text!),
          )
          const holdoutCampaign = await host.engineArtifacts.publish({
            artifact_type: "evolution-lab/campaign-spec",
            schema_version: 1,
            label: "Holdout campaign fixture",
            payload: { ...developmentCampaignEnvelope.payload, dataset_partition: "holdout" },
            resources: [],
            source_artifact_locators: [],
          })
          const incompatibleCampaign = await host.engineArtifacts.publish({
            artifact_type: "evolution-lab/campaign-spec",
            schema_version: 1,
            label: "Incompatible mutable closure fixture",
            payload: { ...developmentCampaignEnvelope.payload, mutable_paths: ["README.md"] },
            resources: [],
            source_artifact_locators: [],
          })
          // The author supplies only what it owns; the publisher derives every
          // revision, manifest, digest, and receipt from the two validated
          // resource sets.
          const candidatePayload = {
            development_campaign_locator: developmentCampaign.locator,
            feedback: null,
            hypothesis: "Refine the exact candidate author instruction",
            provenance: [developmentCampaign.locator],
          }
          let incompatibleCampaignError: unknown
          try {
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/candidate-revision",
                payload: {
                  ...candidatePayload,
                  development_campaign_locator: incompatibleCampaign.locator,
                  provenance: [incompatibleCampaign.locator],
                },
                resource_set: candidateResourceSet,
                parent_resource_set: materialized.resource_set,
                source_artifact_locators: [incompatibleCampaign.locator],
              },
              { host } as never,
            )
          } catch (error) {
            incompatibleCampaignError = error
          }
          expect(incompatibleCampaignError).toBeInstanceOf(EvolutionArtifactIntegrityError)
          expect((incompatibleCampaignError as Error).message).toBe(
            "candidate parent mutable path closure must equal its exact development campaign",
          )
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/candidate-revision",
                payload: {
                  ...candidatePayload,
                  development_campaign_locator: holdoutCampaign.locator,
                  provenance: [holdoutCampaign.locator],
                },
                resource_set: candidateResourceSet,
                parent_resource_set: materialized.resource_set,
                source_artifact_locators: [holdoutCampaign.locator],
              },
              { host } as never,
            ),
          ).rejects.toBeInstanceOf(EvolutionArtifactIntegrityError)
          // A Host-derived digest is not a field the author may state at all,
          // so a false one is refused as an unrecognized key rather than
          // compared against the truth.
          await expect(
            executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/candidate-revision",
                payload: { ...candidatePayload, diff_sha256: "0".repeat(64) },
                resource_set: candidateResourceSet,
                parent_resource_set: materialized.resource_set,
                source_artifact_locators: [developmentCampaign.locator],
              },
              { host } as never,
            ),
          ).rejects.toThrow(/Unrecognized key/)
          const candidateReceipt = JSON.parse(
            await executePublishEvolutionArtifact(
              {
                artifact_type: "evolution-lab/candidate-revision",
                payload: candidatePayload,
                resource_set: candidateResourceSet,
                parent_resource_set: materialized.resource_set,
                source_artifact_locators: [developmentCampaign.locator],
              },
              { host } as never,
            ),
          ) as { artifact_type: string; locator: typeof candidateArtifactLocator }
          expect(candidateReceipt.artifact_type).toBe("evolution-lab/candidate-revision")
          candidateArtifactLocator = candidateReceipt.locator
        })

        const sourceCompleted = Date.now()
        await completeFixtureTaskWithDeliverables({
          taskID,
          sessionID: session.id,
          deliverableArtifactLocators: [candidateArtifactLocator],
          completedAt: sourceCompleted,
        })
        const importedTaskID = Identifier.ascending("task")
        const importedSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Imported candidate validation",
        })
        const preparedImports = await prepareCrossTaskArtifactImports({
          imports: [{ source_task_id: taskID, locator: candidateArtifactLocator }],
          projectID: Instance.project.id,
          targetProjectDirectory: project.path,
          targetTaskID: importedTaskID,
          importer: {
            missionID,
            sessionID: missionSessionID,
            messageID: Identifier.ascending("message"),
            toolCallID: "call-candidate-import",
          },
        })
        persistTask({
          taskID: importedTaskID,
          rootSession: importedSession,
          now: sourceCompleted + 1,
          title: "Imported candidate validation",
          request: "Rehydrate and validate imported parent and candidate packages",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: missionSessionID } },
          projectID: Instance.project.id,
          artifactImports: preparedImports,
          packageRevision: {
            scope: "built_in",
            projectID: null,
            namespace: "builtin",
            id: "evolution-lab",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await taskProcessBinding(importedTaskID, loaded.packageDigest, sourceCompleted + 1),
        })
        const importedArtifact = Database.use((db) =>
          db
            .select({
              id: EngineArtifactTable.id,
              catalogRevision: EngineArtifactTable.catalog_revision,
              sha256: EngineArtifactTable.payload_sha256,
            })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, preparedImports[0]!.importedArtifactID))
            .get(),
        )!
        const importedCandidateLocator = {
          source: "engine_artifact" as const,
          artifact_id: importedArtifact.id,
          catalog_revision: importedArtifact.catalogRevision,
          expected_sha256: importedArtifact.sha256,
        }
        const importedUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: importedSession.id,
          role: "user",
          author: "user",
          time: { created: sourceCompleted + 1 },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        // Producer Messages live on a child worker Session; a root Session
        // carries the operator's user Messages only.
        const importedWorkerSession = await Session.create({
          kind: "assistant",
          parentID: importedSession.id,
          title: "Imported candidate validation worker",
        })
        const importedAssistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: importedWorkerSession.id,
          role: "assistant",
          author: "evolution-safety-auditor",
          time: { created: sourceCompleted + 1 },
          parentID: importedUser.id,
          modelID: "test",
          providerID: "test",
          agent: "evolution-safety-auditor",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        await Session.updatePart({
          id: "part--step-rehydrate-candidate",
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-rehydrate-candidate",
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          type: "tool",
          callID: "call-rehydrate-candidate",
          tool: "rehydrate-evolution-resources",
          state: { status: "running", input: {}, time: { start: sourceCompleted + 2 } },
        })
        const importedScope = {
          kind: "task" as const,
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: importedTaskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, importedTaskID),
          sessionID: importedWorkerSession.id,
          messageID: importedAssistant.id,
          toolCallID: "call-rehydrate-candidate",
          toolPartID: "part-rehydrate-candidate",
          executionSurface: {},
          owner: {
            kind: "projected-worker" as const,
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "built_in" as const,
              projectID: null,
              namespace: "builtin",
              id: "evolution-lab",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "evolution-safety-auditor",
            projectionHash: "3".repeat(64),
            workerTurnDescriptorID: "descriptor-imported-candidate",
            workerTurnDescriptorHash: "4".repeat(64),
          },
        } satisfies TaskToolExecutionScope
        await withTaskScopedPluginToolHost(importedScope, async (host) => {
          const rehydratedParent = JSON.parse(
            await rehydrateEvolutionResourcesTool.execute(
              { artifact_locator: importedCandidateLocator, resource_role: "parent_package" },
              { host } as never,
            ),
          ) as { resource_set: unknown }
          const rehydratedCandidate = JSON.parse(
            await rehydrateEvolutionResourcesTool.execute(
              { artifact_locator: importedCandidateLocator, resource_role: "candidate_package" },
              { host } as never,
            ),
          ) as { resource_set: unknown }
          const importedParentValidation = ValidatedExpertSquadPackageSchema.parse(
            JSON.parse(
              await expertSquadPackageTool.execute(
                {
                  action: "validate",
                  resource_set: TaskArtifactResourceSetLocatorSchema.parse(rehydratedParent.resource_set),
                },
                { host } as never,
              ),
            ),
          )
          const importedCandidateValidation = ValidatedExpertSquadPackageSchema.parse(
            JSON.parse(
              await expertSquadPackageTool.execute(
                {
                  action: "validate",
                  resource_set: TaskArtifactResourceSetLocatorSchema.parse(rehydratedCandidate.resource_set),
                },
                { host } as never,
              ),
            ),
          )
          expect(importedParentValidation.package_digest).toBe(loaded.packageDigest)
          expect(importedCandidateValidation.package_digest).toBe(validatedCandidate.package_digest)
        })
      },
    })
  })

  test("collects one exact terminal occurrence with canonical identities and selected Message content", async () => {
    const project = await sharedProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const basePackageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.06.1",
          packageDigest: "a".repeat(64),
        }
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Evolution evidence fixture",
          metadata: { configOverlay: { prompt_profile: { active: basePackageRevision.id } } },
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now: started - 1,
          title: "Evolution evidence fixture",
          request: "Produce exact evidence",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: basePackageRevision,
          creationExpectedPackageDigest: "a".repeat(64),
          executionCapsuleBinding: await taskProcessBinding(taskID, "a".repeat(64), started - 1),
        })
        const evidenceBaseline = await EngineGit.prepare(requireTask(taskID))
        if (evidenceBaseline.error) throw new Error(evidenceBaseline.error)
        const taskArtifactExecution = createTaskArtifactStoreExecution({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: "message-artifact-producer",
          toolCallID: "call-artifact-producer",
          toolPartID: "part-artifact-producer",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "base",
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "base",
              version: "2026.08.06.1",
              packageDigest: "a".repeat(64),
            },
            agentID: "base-developer",
            projectionHash: "b".repeat(64),
            workerTurnDescriptorID: "descriptor-1",
            workerTurnDescriptorHash: "c".repeat(64),
          },
        } as unknown as TaskToolExecutionScope)
        const artifactStage = await taskArtifactExecution.stage({ trees: ["evidence"] })
        await writeFile(path.join(artifactStage.treeDirectories.evidence!, "result.txt"), "durable result")
        const taskArtifactPublication = await taskArtifactExecution.publish(artifactStage, {
          snapshot_kind: "catalog",
          files: [{ tree: "evidence", path: "result.txt", media_type: "text/plain" }],
        })
        await taskArtifactExecution.close()
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: started },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: message.id,
          type: "text",
          text: "selected exact body",
        })
        // The worker's Message belongs to a child Session; the root Session
        // carries the operator's user Message only.
        const evidenceWorkerSession = await Session.create({
          kind: "delegated-worker",
          parentID: session.id,
          title: "Terminal occurrence worker",
        })
        const evidenceDispatchID = Identifier.ascending("artifact")
        const evidenceCreatorMessageID = Identifier.ascending("message")
        recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID: evidenceDispatchID,
            taskID,
            orchestratorSessionID: session.id,
            orchestratorMessageID: evidenceCreatorMessageID,
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: "base-developer",
            projectedWorkerIdentity: {
              agentID: "base-developer",
              baseRole: "delegated-worker",
              sessionKind: "delegated-worker",
              dispatchAdapterID: "delegated_worker",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "b".repeat(64),
            },
            workScope: { kind: "task" },
            workflowBinding: selectedWorkflowBinding({
              projection: { packageRevision: basePackageRevision, virtualWorkflows: {} },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: { reason: "Collect the exact terminal occurrence" },
          }),
          childSessionID: evidenceWorkerSession.id,
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: evidenceWorkerSession.id,
          role: "assistant",
          author: "worker",
          time: { created: started },
          parentID: message.id,
          modelID: "test",
          providerID: "test",
          agent: "worker",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: evidenceWorkerSession.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call-1",
          tool: "artifact_read",
          state: {
            status: "completed",
            input: { locator: "artifact-1" },
            output: "exact output",
            title: "Read exact Artifact",
            metadata: { actor: "user" },
            time: { start: started, end: started + 1 },
          },
        })
        await Session.updateMessage({
          ...assistant,
          time: { ...assistant.time, completed: started + 1 },
          finish: "stop",
        })
        const completed = started + 1
        await terminalTask(
          requireTask(taskID),
          { status: "failed", time_started: started, time_completed: completed, error: "fixture failure" },
          "Fixture failure",
        )
        const terminalTaskRow = requireTask(taskID)
        const lifecycle = resolveTerminalLifecycleReference(taskID, requireCurrentTerminalLifecycleReference(taskID))

        const evidence = await collectTaskRunEvidence({
          projectID: Instance.project.id,
          request: {
            taskID,
            terminalOccurrence: {
              status: "failed",
              lifecycle,
              completion_decision_artifact_id: null,
            },
            selectedMessageLocators: [
              { session_id: session.id, message_id: message.id },
              { session_id: evidenceWorkerSession.id, message_id: assistant.id },
            ],
          },
        })
        expect(evidence.task).toMatchObject({
          id: taskID,
          project_id: Instance.project.id,
          session_id: session.id,
          status: "failed",
          time_started: terminalTaskRow.time_started,
          time_completed: terminalTaskRow.time_completed,
          error: "fixture failure",
        })
        expect(evidence.terminal_occurrence).toEqual({
          status: "failed",
          lifecycle,
          completion_decision_artifact_id: null,
        })
        expect(evidence.messages).toHaveLength(3)
        expect(
          evidence.messages.find((candidate) => candidate.locator.message_id === evidenceCreatorMessageID),
        ).toMatchObject({
          role: "assistant",
          agent: "orchestrator",
          parts: [{ type: "tool", tool: { name: "dispatch_agent" } }],
        })
        expect(evidence.messages.find((candidate) => candidate.locator.message_id === message.id)).toMatchObject({
          locator: { session_id: session.id, message_id: message.id },
          role: "user",
          agent: "user",
          body: {
            parts: [{ data: { type: "text", text: "selected exact body" } }],
          },
        })
        expect(evidence.messages.find((candidate) => candidate.locator.message_id === assistant.id)).toMatchObject({
          locator: { session_id: evidenceWorkerSession.id, message_id: assistant.id },
          role: "assistant",
          agent: "worker",
          parts: [
            {
              type: "tool",
              tool: { name: "artifact_read", call_id: "call-1", status: "completed" },
            },
          ],
        })
        expect(evidence.engine_artifacts.map((artifact) => artifact.kind)).toEqual([
          "task_package_revision_binding",
          "task_execution_capsule_binding",
          "dispatch_lineage",
        ])
        expect(evidence.revision_facts).toEqual({
          installed_resolved_digest: "a".repeat(64),
          creation_expected_digest: "a".repeat(64),
          task_binding_digest: "a".repeat(64),
          workflow_binding_digest: "a".repeat(64),
          runtime_snapshot_digests: ["a".repeat(64)],
        })
        expect(evidence.task_artifacts).toEqual([
          {
            snapshot: taskArtifactPublication.snapshot,
            snapshot_kind: "catalog",
            publication_sequence: 1,
            created_at_ms: taskArtifactPublication.manifest.created_at_ms,
            producer: taskArtifactPublication.manifest.producer,
            trees: [
              {
                tree: "evidence",
                files: [
                  {
                    path: "result.txt",
                    media_type: "text/plain",
                    bytes: 14,
                    sha256: taskArtifactPublication.artifacts[0]!.sha256,
                  },
                ],
              },
            ],
          },
        ])
        expect(evidence.canonical_sha256).toHaveLength(64)

        const evidenceOwnerSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Evolution evidence owner",
        })
        const evidenceOwnerTaskID = Identifier.ascending("task")
        persistTask({
          taskID: evidenceOwnerTaskID,
          rootSession: evidenceOwnerSession,
          now: completed + 1,
          title: "Evolution evidence owner",
          request: "Publish immutable evidence for the terminal Trial",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "built_in",
            projectID: null,
            namespace: "builtin",
            id: "evolution-lab",
            version: "2026.08.06.1",
            packageDigest: "d".repeat(64),
          },
          executionCapsuleBinding: await taskProcessBinding(evidenceOwnerTaskID, "d".repeat(64), completed + 1),
        })
        const evidenceOwnerExecution = createTaskArtifactStoreExecution({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: evidenceOwnerTaskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, evidenceOwnerTaskID),
          sessionID: evidenceOwnerSession.id,
          messageID: "message-evidence-owner",
          toolCallID: "call-evidence-owner",
          toolPartID: "part-evidence-owner",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "evolution-lab",
              version: "2026.08.06.1",
              packageDigest: "d".repeat(64),
            },
            agentID: "evolution-evaluator",
            projectionHash: "e".repeat(64),
            workerTurnDescriptorID: "descriptor-evidence-owner",
            workerTurnDescriptorHash: "f".repeat(64),
          },
        } as unknown as TaskToolExecutionScope)
        const runEvidenceReceipt = JSON.parse(
          await collectRunEvidenceTool.execute(
            {
              task_id: taskID,
              terminal_occurrence: evidence.terminal_occurrence,
              selected_messages: [
                { session_id: session.id, message_id: message.id },
                { session_id: evidenceWorkerSession.id, message_id: assistant.id },
              ],
            },
            {
              host: {
                taskRuns: {
                  collect: (request) =>
                    collectTaskRunEvidence({
                      projectID: Instance.project.id,
                      request,
                    }),
                },
                taskArtifacts: evidenceOwnerExecution,
              },
            } as never,
          ),
        ) as {
          canonical_sha256: string
          resource_set: unknown
          resource: {
            snapshot: unknown
            tree: string
            path: string
            media_type: "application/json"
            bytes: number
            sha256: string
          }
        }
        const runEvidenceResourceSet = TaskArtifactResourceSetLocatorSchema.parse(runEvidenceReceipt.resource_set)
        expect(runEvidenceReceipt.canonical_sha256).toBe(evidence.canonical_sha256)
        expect(runEvidenceReceipt.resource).toMatchObject({
          path: "run-evidence.json",
        })
        await evidenceOwnerExecution.close()

        Database.transaction((db) => {
          writeTaskUpdateInTransaction({
            db,
            taskID,
            values: { status: "active" },
            summary: "Reopen the Trial after preserving its exact terminal evidence",
            now: completed + 1,
          })
        })
        const retained = await readTaskArtifactSnapshotManifest({
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: evidenceOwnerTaskID,
          snapshot: runEvidenceResourceSet.snapshot,
        })
        expect(retained.identity).toEqual(runEvidenceResourceSet.snapshot)
        expect(retained.manifest.trees["run-evidence"]!.files).toEqual([
          {
            path: "run-evidence.json",
            media_type: "application/json",
            bytes: Buffer.byteLength(canonicalTaskRunEvidenceJSON(evidence)),
            sha256: runEvidenceReceipt.resource.sha256,
          },
        ])
        const retainedExecution = createTaskArtifactStoreExecution({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID: evidenceOwnerTaskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, evidenceOwnerTaskID),
          sessionID: evidenceOwnerSession.id,
          messageID: "message-retained-evidence-reader",
          toolCallID: "call-retained-evidence-reader",
          toolPartID: "part-retained-evidence-reader",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "evolution-lab",
              version: "2026.08.06.1",
              packageDigest: "d".repeat(64),
            },
            agentID: "evolution-evaluator",
            projectionHash: "e".repeat(64),
            workerTurnDescriptorID: "descriptor-retained-evidence-reader",
            workerTurnDescriptorHash: "f".repeat(64),
          },
        } as unknown as TaskToolExecutionScope)
        const retainedMaterialization = await retainedExecution.materialize({
          snapshot: runEvidenceResourceSet.snapshot,
          tree: runEvidenceResourceSet.tree,
        })
        const retainedBundle = JSON.parse(
          await readFile(path.join(retainedMaterialization.directory, "run-evidence.json"), "utf8"),
        )
        expect(retainedBundle).toEqual(evidence)
        await retainedExecution.close()
      },
    })
  })

  test("anchors inactive and awaiting-interaction Trial outcomes to exact durable activity", async () => {
    const project = await sharedProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Nonterminal Trial evidence fixture",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Nonterminal Trial evidence fixture",
          request: "Wait for exact evidence",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "built_in",
            projectID: null,
            namespace: "builtin",
            id: "base",
            version: "2026.08.06.1",
            packageDigest: "a".repeat(64),
          },
          executionCapsuleBinding: await taskProcessBinding(taskID, "a".repeat(64), started),
        })
        const nonterminalBaseline = await EngineGit.prepare(requireTask(taskID))
        if (nonterminalBaseline.error) throw new Error(nonterminalBaseline.error)
        const activityTime = started + 100_000
        const interactionID = Database.transaction((db) =>
          insertEngineInteractionRequest(db, {
            taskID,
            sessionID: session.id,
            externalID: "question-1",
            requestType: "question",
            title: "Choose dataset",
            body: "Which frozen dataset should this campaign use?",
            payload: {},
            timeCreated: activityTime,
            eventSource: "test",
            eventSummary: "Choose the frozen Trial dataset",
          }),
        )

        const awaiting = await collectTaskRunEvidence({
          projectID: Instance.project.id,
          request: {
            taskID,
            terminalOccurrence: {
              status: "awaiting_interaction",
              interaction_request_id: interactionID,
              time_created: activityTime,
            },
            selectedMessageLocators: [],
          },
        })
        expect(awaiting.revision_facts.creation_expected_digest).toBeNull()
        expect(awaiting.task.status).toBe("active")
        expect(awaiting.terminal_occurrence).toEqual({
          status: "awaiting_interaction",
          interaction_request_id: interactionID,
          time_created: activityTime,
        })

        const inactive = await collectTaskRunEvidence({
          projectID: Instance.project.id,
          request: {
            taskID,
            terminalOccurrence: {
              status: "inactive",
              last_activity: {
                source: "interaction_request",
                id: interactionID,
                time_updated: activityTime,
              },
            },
            selectedMessageLocators: [],
          },
        })
        expect(inactive.terminal_occurrence).toEqual({
          status: "inactive",
          last_activity: {
            source: "interaction_request",
            id: interactionID,
            time_updated: activityTime,
          },
        })
        const scope: TaskToolExecutionScope = {
          kind: "task", projectID: Instance.project.id, projectDirectory: project.path, taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID), sessionID: session.id,
          messageID: "g43-live-subject", toolCallID: "g43-live-subject", toolPartID: "g43-live-subject",
          executionSurface: {},
          owner: {
            kind: "projected-scheduler", expertSquadID: "base", agentID: "orchestrator",
            projectionHash: "a".repeat(64),
            packageRevision: {
              scope: "built_in", projectID: null, namespace: "builtin", id: "base",
              version: "2026.08.06.1", packageDigest: "a".repeat(64),
            },
          },
        }
        await withTaskScopedPluginToolHost(scope, async (host) => {
          for (const [iteration, bundle] of [awaiting, inactive].entries()) {
            const stage = await host.taskArtifacts.stage({ trees: ["subject"] })
            await writeFile(path.join(stage.treeDirectories.subject!, "bundle.json"), canonicalTaskRunEvidenceJSON(bundle))
            const publication = await host.taskArtifacts.publish(stage, {
              snapshot_kind: "engine_resource",
              files: [{ tree: "subject", path: "bundle.json", media_type: "application/json" }],
            })
            const resource = publication.artifacts[0]!
            const input: MetricEvaluationRequest = {
              iteration, delivery_slice_revision_id: null, subject: resource,
              selected_evidence_locators: [{ source: "task_artifact_resource", ref: resource }],
              visual_feedback_verification_artifact_locators: [],
              scorers: [{
                scorer_id: "live-subject-shell", scorer_revision: "a".repeat(64), scope: "global", goal_id: null,
                description: "A live observation has no immutable shell workspace", unit: "number",
                direction: "higher_better", target: 1, floor: 0, weight: 1, observation_class: "quality",
                evaluator_kind: "shell", evaluator_config: {
                  scorer_revision: "a".repeat(64), workspace_digest: awaiting.workspace_checkpoint.initial_tree_sha256,
                  executable: process.execPath, args: ["-e", "process.stdout.write('1')"],
                  parse: "stdout_number", inactivity_timeout_ms: 30_000,
                },
              }],
            }
            const outcome = await host.metrics.evaluate(input)
            expect(outcome.unavailable).toMatchObject([{ scorer_id: "live-subject-shell", reason_code: "input_unavailable" }])
            const attempt = MetricExecutionEvidence.parse(
              JSON.parse(new TextDecoder().decode(await host.taskArtifacts.read(outcome.unavailable[0]!.evidence_ref))),
            )
            expect(attempt).toMatchObject({
              status: "unavailable", reason_code: "input_unavailable", task_id: taskID,
              subject: { resource, trial_task_id: taskID, result: { kind: "live_observation" } },
            })
            await expect(host.metrics.evaluate({
              ...input, scorers: input.scorers.map((scorer) => ({ ...scorer, target: 2 })),
            })).rejects.toThrow(`Metric scorer live-subject-shell conflicts with the frozen Task scorer definition`)
          }
        })
      },
    })
  })
})
