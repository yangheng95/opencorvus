import { afterAll, describe, expect, test } from "bun:test"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { EngineArtifactEnvelopeSchema, EvolutionArtifactSchemas } from "@opencorvus-ai/plugin"
import { rm } from "node:fs/promises"
import path from "node:path"
import { Config } from "../src/config/config"
import { EffectiveConfig } from "../src/config/effective"
import { exactEngineArtifactLocator, requireEngineArtifactByLocator } from "../src/artifact-catalog"
import { recordEngineArtifact, updateEngineArtifact } from "../src/engine/artifact"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { requireTaskPackageRevisionBinding } from "../src/engine/task-package-revision-binding"
import {
  authorizeEvolutionPackageMutation,
  evolutionMutationConfirmationText,
  executeEvolutionPackageMutation,
} from "../src/expert-squad/evolution-mutation"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { readEvolutionCampaignDetail, readEvolutionHistory } from "../src/expert-squad/evolution-history"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { Global } from "../src/global"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageStore } from "../src/session/message-store"
import { EngineService } from "../src/task-api"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { deriveComparisonRecommendation } from "@squads/evolution-lab/lib/evolution-lab/comparison"

function emptyProjectionResources() {
  return {
    inherit_base_tools: false,
    built_in_tool_ids: [] as string[],
    default_skill_refs: [] as string[],
    package_skill_refs: [] as string[],
    default_tool_refs: [] as string[],
    package_tool_refs: [] as string[],
    default_mcp_server_refs: [] as string[],
    package_mcp_server_refs: [] as string[],
    default_mcp_tool_refs: [] as string[],
    package_mcp_tool_refs: [] as string[],
    default_mcp_prompt_refs: [] as string[],
    package_mcp_prompt_refs: [] as string[],
    default_mcp_resource_refs: [] as string[],
    package_mcp_resource_refs: [] as string[],
  }
}

function packageDefinition(version: string, marker: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 1,
      namespace: "evolution-test",
      id: "evolution-mutation-squad",
      label: "Evolution mutation squad",
      description: "Exercises authorized package evolution mutation receipts.",
      version,
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Evolution mutation contract package.",
        selection_guidance: "Select only for the evolution mutation contract.",
        instructions: "selector.md",
      },
      capability_projection: {
        scheduler: { ...emptyProjectionResources(), base_role: "orchestrator" },
        agents: {
          "evolution-mutation-worker": {
            ...emptyProjectionResources(),
            label: "Evolution mutation worker",
            description: "Owns the evolution mutation contract fixture.",
            base_role: "build",
            prompt: "agents/evolution-mutation-worker/system.md",
          },
        },
        virtual_workflows: {},
      },
    },
    files: {
      "README.md": `# Evolution mutation squad\n\n${marker}\n`,
      "selector.md": "# Evolution mutation selector\n",
      "agents/evolution-mutation-worker/system.md": `# Evolution mutation worker\n\n${marker}\n`,
    },
  }
}

async function writeSource(root: string, version: string, marker: string) {
  const directory = path.join(root, version)
  await writeExpertSquadPackage({ directory, definition: packageDefinition(version, marker) })
  return directory
}

async function createTask(input: {
  title: string
  revision: { namespace: string; id: string; version: string; packageDigest: string }
}) {
  const session = await Session.create({
    kind: "root",
    title: input.title,
    metadata: {
      configOverlay: {
        model: "firmware/gpt-5",
        prompt_profile: { active: input.revision.id },
      },
    },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  persistTask({
    taskID,
    sessionID: session.id,
    now,
    title: input.title,
    request: input.title,
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision: {
      scope: "project",
      projectID: Instance.project.id,
      ...input.revision,
    },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: input.revision.packageDigest,
      timeCreated: now,
    }),
  })
  return { session, taskID }
}

function recordEvolutionArtifact(input: {
  taskID: string
  type: string
  payload: Record<string, unknown>
  sources?: ReturnType<typeof exactEngineArtifactLocator>[]
}) {
  const artifactID = recordEngineArtifact({
    taskID: input.taskID,
    kind: "expert_output",
    label: input.type,
    payload: EngineArtifactEnvelopeSchema.parse({
      artifact_type: input.type,
      schema_version: 1,
      producer: {
        owner_kind: "projected-worker",
        expert_squad_id: "evolution-lab",
        package_revision: {
          scope: "built_in",
          project_id: null,
          namespace: "builtin",
          id: "evolution-lab",
          version: "2026.08.07.1",
          package_digest: "a".repeat(64),
        },
        agent_id: "evolution-recommendation-owner",
        projection_hash: "b".repeat(64),
        session_id: "session-evolution-mutation-test",
        message_id: "message-evolution-mutation-test",
        tool_call_id: input.type,
      },
      payload: input.payload,
      resources: [],
      observed_artifact_locators: input.sources ?? [],
      source_artifact_locators: input.sources ?? [],
    }),
  })
  return exactEngineArtifactLocator({ taskID: input.taskID, artifactID })
}

function evolutionResource(pathname: string, sha256: string) {
  return { path: pathname, media_type: "application/json", bytes: 2, sha256 }
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("authorized expert squad evolution mutation", () => {
  test("promotes and restores exact snapshots while preserving existing Task revision pins", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-evolution-mutation-")
    await using project = await memoryProject()
    await using foreignProject = await memoryProject()
    try {
      const baselineSource = await writeSource(sourceRoot, "2026.08.07.1", "baseline")
      const candidateSource = await writeSource(sourceRoot, "2026.08.07.2", "candidate")
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          configureTaskIngressRunner(async () => {})
          const installed = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: baselineSource,
            installationScope: "project",
          })
          await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: baselineSource,
            installationScope: "global",
          })
          const candidate = await ExpertSquadRegistry.loadSourcePackage(candidateSource)
          const baselineRevision = {
            namespace: installed.after.namespace,
            id: installed.after.id,
            version: installed.after.version!,
            package_digest: installed.after.packageDigest,
          }
          const candidateRevision = {
            namespace: candidate.namespace,
            id: candidate.id,
            version: candidate.version,
            package_digest: candidate.packageDigest,
          }
          const oldTask = await createTask({
            title: "Existing baseline target Task",
            revision: {
              namespace: baselineRevision.namespace,
              id: baselineRevision.id,
              version: baselineRevision.version,
              packageDigest: baselineRevision.package_digest,
            },
          })
          const operationTask = await createTask({
            title: "Authorized evolution operation",
            revision: {
              namespace: baselineRevision.namespace,
              id: baselineRevision.id,
              version: baselineRevision.version,
              packageDigest: baselineRevision.package_digest,
            },
          })
          const target = {
            scope: "project" as const,
            project_id: Instance.project.id,
            project_directory: Instance.project.worktree,
            namespace: baselineRevision.namespace,
            id: baselineRevision.id,
          }
          const digests = {
            dataset: "1".repeat(64),
            case: "2".repeat(64),
            scorer: "3".repeat(64),
            model: "4".repeat(64),
            environment: "5".repeat(64),
            workspace: "6".repeat(64),
            permission: "7".repeat(64),
            baselineRun: "8".repeat(64),
            candidateRun: "9".repeat(64),
            baselineMetric: "c".repeat(64),
            candidateMetric: "d".repeat(64),
            diff: "e".repeat(64),
          }
          const scorer = {
            scorer_id: "quality",
            scorer_revision: digests.scorer,
            scope: "global" as const,
            goal_id: null,
            description: "Exact quality observation",
            unit: "score",
            direction: "higher_better" as const,
            target: 1,
            floor: 0,
            weight: 1,
            observation_class: "quality" as const,
            evaluator_kind: "shell" as const,
            evaluator_config: {
              scorer_revision: digests.scorer,
              workspace_digest: digests.workspace,
              executable: "quality-scorer",
              args: [],
              parse: "stdout_number" as const,
              inactivity_timeout_ms: 1_000,
            },
          }
          const campaignPayload = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
            target,
            baseline_revision: baselineRevision,
            candidate_version_policy: "increment exact package version",
            candidate_hypothesis: "Improve the exact quality scorer without changing frozen resources.",
            dataset_partition: "development",
            dataset_digest: digests.dataset,
            cases: ["case-a"],
            scorer_digests: [digests.scorer],
            scorers: [scorer],
            frozen_inputs: {
              dataset: evolutionResource("dataset.json", digests.dataset),
              cases: [{ case_id: "case-a", resource: evolutionResource("cases/case-a.json", digests.case) }],
              model_configuration: evolutionResource("model.json", digests.model),
              environment: evolutionResource("environment.json", digests.environment),
              workspace_template: evolutionResource("workspace.json", digests.workspace),
              permission_snapshot: evolutionResource("permission.json", digests.permission),
              scorer_assets: [
                {
                  scorer_id: "quality",
                  scorer_revision: digests.scorer,
                  resource: evolutionResource("scorers/quality.json", digests.scorer),
                },
              ],
            },
            model: "test-model",
            model_configuration_digest: digests.model,
            environment_digest: digests.environment,
            workspace_digest: digests.workspace,
            permission_snapshot_digest: digests.permission,
            external_side_effect_policy: "no external side effects",
            repetitions: 2,
            arm_order: ["baseline", "candidate"],
            statistics: "paired population statistics",
            budget: { max_runs: 4, max_cost: 1 },
            inactivity_timeout_ms: 1_000,
            ui_rubric_digest: null,
            mutable_paths: ["README.md"],
            trial_execution: { status: "available", installation_scope: "project" },
          })
          const campaign = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/campaign-spec",
            payload: campaignPayload,
          })
          const frozenCampaignHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          expect({
            campaigns: frozenCampaignHistory.records.length,
            hypothesis: frozenCampaignHistory.records[0]!.campaign.candidate_hypothesis,
            candidates: frozenCampaignHistory.records[0]!.candidates.length,
          }).toEqual({
            campaigns: 1,
            hypothesis: campaignPayload.candidate_hypothesis,
            candidates: 0,
          })
          const candidatePayload = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
            development_campaign_locator: campaign,
            feedback: null,
            parent_revision: baselineRevision,
            candidate_revision: candidateRevision,
            parent_resources: [evolutionResource("README.md", baselineRevision.package_digest)],
            candidate_resources: [evolutionResource("README.md", candidateRevision.package_digest)],
            hypothesis: campaignPayload.candidate_hypothesis,
            changed_paths: ["README.md"],
            diff_sha256: digests.diff,
            frozen_files: [],
            manager_receipt: {
              operation: "validated",
              namespace: candidateRevision.namespace,
              id: candidateRevision.id,
              version: candidateRevision.version,
              package_digest: candidateRevision.package_digest,
            },
            provenance: [campaign],
          })
          const candidateArtifact = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/candidate-revision",
            payload: candidatePayload,
            sources: [campaign],
          })
          const candidateDevelopmentHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          expect({
            candidates: candidateDevelopmentHistory.records[0]!.candidates.length,
            candidateDigest: candidateDevelopmentHistory.records[0]!.candidates[0]!.candidate_revision.package_digest,
            comparisons: candidateDevelopmentHistory.records[0]!.candidates[0]!.comparisons.length,
          }).toEqual({
            candidates: 1,
            candidateDigest: candidateRevision.package_digest,
            comparisons: 0,
          })
          // Promotion needs the whole aggregate interval above zero, so the fixture measures each
          // arm more than once. One repetition per arm supports a point estimate and no interval,
          // and a candidate that cannot be bounded is deliberately not promotable.
          const repetitionDigest = (base: string, repetition: number) =>
            `${base.slice(0, 62)}${String(repetition).padStart(2, "0")}`
          const recordRun = (
            arm: "baseline" | "candidate",
            digest: string,
            revision: string,
            repetition: number,
          ) => {
            const payload = EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse({
              case_id: "case-a",
              arm,
              repetition,
              workspace_digest: digests.workspace,
              run_evidence_sha256: repetitionDigest(digest, repetition),
              run_evidence_resource: evolutionResource(
                `runs/${arm}-${repetition}.json`,
                repetitionDigest(digest, repetition),
              ),
              task_id: `${operationTask.taskID}-${arm}-${repetition}`,
              terminal_time: Date.now(),
              model: "test-model",
              environment_digest: digests.environment,
              token_usage: arm === "baseline" ? 100 : 90,
              cost: arm === "baseline" ? 0.1 : 0.09,
              last_activity_at: new Date().toISOString(),
              outcome: "success",
              activity_duration_ms: arm === "baseline" ? 1000 : 900,
              revision_equality: {
                installed: revision,
                expected: revision,
                task_binding: revision,
                workflow_binding: revision,
                runtime_snapshot: revision,
              },
            })
            const locator = recordEvolutionArtifact({
              taskID: operationTask.taskID,
              type: "evolution-lab/run-evidence-bundle",
              payload,
              sources: [campaign, candidateArtifact],
            })
            return { locator, value: payload }
          }
          const repetitions = [0, 1]
          const baselineRuns = repetitions.map((repetition) =>
            recordRun("baseline", digests.baselineRun, baselineRevision.package_digest, repetition),
          )
          const candidateRuns = repetitions.map((repetition) =>
            recordRun("candidate", digests.candidateRun, candidateRevision.package_digest, repetition),
          )
          const baselineRun = baselineRuns[0]!
          const candidateRun = candidateRuns[0]!
          const recordEvaluation = (
            arm: "baseline" | "candidate",
            run: typeof baselineRun,
            score: number,
            metricDigest: string,
            repetition: number,
          ) => {
            const payload = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse({
              case_id: "case-a",
              arm,
              repetition,
              scorers: [{ scorer_id: "quality", status: "measured", value: score, evidence: [run.locator] }],
              trial_task_id: run.value.task_id,
              trial_revision_digest:
                arm === "baseline" ? baselineRevision.package_digest : candidateRevision.package_digest,
              campaign_spec_locator: campaign,
              candidate_revision_locator: arm === "candidate" ? candidateArtifact : null,
              run_evidence_locator: run.locator,
              metric_receipt_resource: evolutionResource(
                `metrics/${arm}-${repetition}.json`,
                repetitionDigest(metricDigest, repetition),
              ),
            })
            const locator = recordEvolutionArtifact({
              taskID: operationTask.taskID,
              type: "evolution-lab/evaluation-result",
              payload,
              sources: [campaign, candidateArtifact, run.locator],
            })
            return { locator, value: payload }
          }
          const baselineEvaluations = repetitions.map((repetition) =>
            recordEvaluation("baseline", baselineRuns[repetition]!, 0.5, digests.baselineMetric, repetition),
          )
          const candidateEvaluations = repetitions.map((repetition) =>
            recordEvaluation("candidate", candidateRuns[repetition]!, 0.8, digests.candidateMetric, repetition),
          )
          const baselineEvaluation = baselineEvaluations[0]!
          const candidateEvaluation = candidateEvaluations[0]!
          const recordReview = (
            arm: "baseline" | "candidate",
            evaluation: typeof baselineEvaluation,
            repetition: number,
          ) => {
            const payload = EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse({
              case_id: "case-a",
              arm,
              repetition,
              evaluation_result_locator: evaluation.locator,
              status: "reviewed",
              findings: [],
              accepted_limitations: [],
              unknowns: [],
            })
            const locator = recordEvolutionArtifact({
              taskID: operationTask.taskID,
              type: "evolution-lab/integrity-review",
              payload,
              sources: [evaluation.locator],
            })
            return { locator, value: payload }
          }
          const baselineReviews = repetitions.map((repetition) =>
            recordReview("baseline", baselineEvaluations[repetition]!, repetition),
          )
          const candidateReviews = repetitions.map((repetition) =>
            recordReview("candidate", candidateEvaluations[repetition]!, repetition),
          )
          const baselineReview = baselineReviews[0]!
          const candidateReview = candidateReviews[0]!
          const trialEvidenceHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          expect({
            runs: trialEvidenceHistory.records[0]!.candidates[0]!.runs.length,
            evaluations: trialEvidenceHistory.records[0]!.candidates[0]!.evaluations.length,
            candidateDigest: trialEvidenceHistory.records[0]!.candidates[0]!.candidate_revision.package_digest,
          }).toEqual({
            // Two repetitions per arm: the interval the promotion rule decides on
            // cannot be formed from a single measurement.
            runs: 4,
            evaluations: 4,
            candidateDigest: candidateRevision.package_digest,
          })
          const comparisonPayload = deriveComparisonRecommendation({
            campaign: campaignPayload,
            campaignLocator: campaign,
            candidate: candidatePayload,
            candidateLocator: candidateArtifact,
            evaluations: [...baselineEvaluations, ...candidateEvaluations],
            reviews: [...baselineReviews, ...candidateReviews],
            runs: [...baselineRuns, ...candidateRuns],
          })
          const comparisonSources = [
            campaign,
            candidateArtifact,
            ...baselineRuns.map((run) => run.locator),
            ...candidateRuns.map((run) => run.locator),
            ...baselineEvaluations.map((evaluation) => evaluation.locator),
            ...candidateEvaluations.map((evaluation) => evaluation.locator),
            ...baselineReviews.map((review) => review.locator),
            ...candidateReviews.map((review) => review.locator),
          ]
          const comparison = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/comparison-recommendation",
            payload: comparisonPayload,
            sources: comparisonSources,
          })
          const promotionText = evolutionMutationConfirmationText({
            projectID: Instance.project.id,
            target,
            beforeDigest: baselineRevision.package_digest,
            afterDigest: candidateRevision.package_digest,
            evidenceSHA256s: [campaign, candidateArtifact, comparison].map((locator) => locator.expected_sha256),
            operation: "promotion",
          })
          const authorization = await authorizeEvolutionPackageMutation({
            taskID: operationTask.taskID,
            sessionID: operationTask.session.id,
            confirmationText: promotionText,
            intent: {
              operation: "promotion",
              campaignSpecLocator: campaign,
              candidateRevisionLocator: candidateArtifact,
              comparisonResultLocator: comparison,
              expectedCurrentPackageDigest: baselineRevision.package_digest,
            },
          })
          const authorizationMessage = await MessageStore.get({
            sessionID: operationTask.session.id,
            messageID: authorization.verified.message_id,
          })
          expect({
            info: {
              id: authorizationMessage.info.id,
              sessionID: authorizationMessage.info.sessionID,
              role: authorizationMessage.info.role,
              author: authorizationMessage.info.author,
              agent: authorizationMessage.info.agent,
              time: authorizationMessage.info.time,
              taskRootMessage:
                authorizationMessage.info.role === "user"
                  ? authorizationMessage.info.extra?.task_root_message
                  : undefined,
            },
            parts: authorizationMessage.parts.map((part) =>
              part.type === "text"
                ? { type: part.type, text: part.text, kind: part.kind, source: part.source }
                : { type: part.type },
            ),
          }).toEqual({
            info: {
              id: authorization.verified.message_id,
              sessionID: operationTask.session.id,
              role: "user",
              author: "user",
              agent: "orchestrator",
              time: { created: authorization.verified.time_created },
              taskRootMessage: {
                protocol: "task-root-message",
                taskID: operationTask.taskID,
                kind: "operator",
                source: "expert_squad.evolution_authorization",
              },
            },
            parts: [{ type: "text", text: promotionText, kind: "user_content", source: "user" }],
          })
          const mutationRequest = {
            operation: "promotion",
            authorization: authorization.authorization,
            campaignSpecLocator: campaign,
            candidateRevisionLocator: candidateArtifact,
            comparisonResultLocator: comparison,
            expectedCurrentPackageDigest: baselineRevision.package_digest,
          } as const
          const restoreInterruption = ExpertSquadPackageManager.TestHooks.interruptAfterTargetInstallBeforeReceiptOnce()
          let interruption: unknown
          try {
            await executeEvolutionPackageMutation(mutationRequest)
          } catch (error) {
            interruption = error
          } finally {
            restoreInterruption()
          }
          expect(interruption).toBeInstanceOf(ExpertSquadPackageManager.EvolutionMutationAbruptTerminationForTest)
          const recoveryTaskID = await EngineService.createTask(
            {
              requestID: `post-crash-recovery-${Identifier.ascending("artifact")}`,
              request: "Create a Task only after pending package mutation reconciliation",
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: candidate.id,
            },
            { actor: "user" },
          )
          expect(requireTaskPackageRevisionBinding(recoveryTaskID).package_digest).toBe(baselineRevision.package_digest)
          const receiptReadFailure = ExpertSquadPackageManager.TestHooks.failFirstReceiptReadAfterCommit()
          let promotion!: Awaited<ReturnType<typeof executeEvolutionPackageMutation>>
          try {
            promotion = await executeEvolutionPackageMutation(mutationRequest)
          } finally {
            receiptReadFailure.restore()
          }
          expect(receiptReadFailure.wasTriggered()).toBe(true)
          expect({
            receipt: {
              operation: promotion.receipt.operation,
              before: promotion.receipt.before_digest,
              after: promotion.receipt.after_digest,
              producer: EngineArtifactEnvelopeSchema.parse(
                requireEngineArtifactByLocator({ taskID: operationTask.taskID, locator: promotion.locator }).payload,
              ).producer,
            },
            oldTaskRevision: requireTaskPackageRevisionBinding(oldTask.taskID).package_digest,
          }).toEqual({
            receipt: {
              operation: "promotion",
              before: baselineRevision.package_digest,
              after: candidateRevision.package_digest,
              producer: {
                owner_kind: "core",
                component_id: "expert-squad-package-manager",
                operation_id: authorization.verified.message_id,
              },
            },
            oldTaskRevision: baselineRevision.package_digest,
          })
          const repeated = await executeEvolutionPackageMutation({
            operation: "promotion",
            authorization: {
              taskID: operationTask.taskID,
              sessionID: operationTask.session.id,
              messageID: authorization.verified.message_id,
            },
            campaignSpecLocator: campaign,
            candidateRevisionLocator: candidateArtifact,
            comparisonResultLocator: comparison,
            expectedCurrentPackageDigest: baselineRevision.package_digest,
          })
          expect(repeated.locator).toEqual(promotion.locator)
          const historyAfterPromotion = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          const promotionCampaign = historyAfterPromotion.records[0]!
          const promotionCandidate = promotionCampaign.candidates[0]!
          const promotionComparison = promotionCandidate.comparisons[0]!
          expect({
            installed: historyAfterPromotion.authority.installed_revision.package_digest,
            records: historyAfterPromotion.records.length,
            candidates: promotionCampaign.candidates.length,
            comparisons: promotionCandidate.comparisons.length,
            context: promotionCampaign.context,
            completeness: promotionComparison.completeness,
            receipts: promotionComparison.receipts.map((item) => item.receipt.operation),
            promotionIntent: promotionComparison.promotion_intent,
            restorationIntent: promotionComparison.restoration_intents[0]?.request,
          }).toEqual({
            installed: candidateRevision.package_digest,
            records: 1,
            candidates: 1,
            comparisons: 1,
            context: {
              context_sha256: promotionCampaign.context.context_sha256,
              dataset_partition: "development",
              dataset_digest: digests.dataset,
              case_ids: ["case-a"],
              scorer_digests: [digests.scorer],
              model: "test-model",
              model_configuration_digest: digests.model,
              environment_digest: digests.environment,
              workspace_digest: digests.workspace,
              permission_snapshot_digest: digests.permission,
              external_side_effect_policy: "no external side effects",
              repetitions: 2,
              arm_order: ["baseline", "candidate"],
              statistics: "paired population statistics",
              budget: { max_runs: 4, max_cost: 1 },
              inactivity_timeout_ms: 1_000,
              ui_rubric_digest: null,
            },
            completeness: {
              expected_slots: 4,
              present_runs: 4,
              present_evaluations: 4,
              expected_scorer_results: 4,
              measured_scorer_results: 4,
              unavailable_scorer_results: 0,
              reviewed_integrity_slots: 4,
              required_unavailable_dimensions: [],
            },
            receipts: ["promotion"],
            promotionIntent: null,
            restorationIntent: {
              operation: "restoration",
              priorReceiptLocator: promotion.locator,
              restorePackageDigest: baselineRevision.package_digest,
              expectedCurrentPackageDigest: candidateRevision.package_digest,
            },
          })
          const historyDetail = await readEvolutionCampaignDetail({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            campaignTaskID: promotionCampaign.campaign.artifact.task_id,
            campaignLocator: promotionCampaign.campaign.artifact.locator,
            candidateLocator: promotionCandidate.artifact.locator,
            comparisonLocator: promotionComparison.artifact.locator,
            catalogRevisionUpper: historyAfterPromotion.catalog_revision_upper,
          })
          expect(
            historyDetail.slots
              .map((slot) => ({
                caseID: slot.case_id,
                arm: slot.arm,
                repetition: slot.repetition,
                run: slot.run?.artifact_type,
                evaluation: slot.evaluation?.artifact_type,
                scorer: slot.scorer_results[0]?.status,
                integrity: slot.integrity_review?.status,
              }))
              .toSorted((left, right) =>
                left.arm === right.arm ? left.repetition - right.repetition : left.arm.localeCompare(right.arm),
              ),
          ).toEqual(
            // One complete slot per arm per repetition: the promotion rule reads an
            // interval, and an interval needs more than one measurement per arm.
            (["baseline", "candidate"] as const).flatMap((arm) =>
              repetitions.map((repetition) => ({
                caseID: "case-a",
                arm,
                repetition,
                run: "evolution-lab/run-evidence-bundle",
                evaluation: "evolution-lab/evaluation-result",
                scorer: "measured",
                integrity: "reviewed",
              })),
            ),
          )
          const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
            prompt_profile: { active: candidate.id },
          })
          expect(
            (
              await PromptProfileResolver.resolveActivePackageRevision({
                projectDirectory: Instance.project.worktree,
                config,
              })
            ).packageDigest,
          ).toBe(candidateRevision.package_digest)
          const newTaskID = await EngineService.createTask(
            {
              requestID: `post-promotion-${Identifier.ascending("artifact")}`,
              request: "Bind a new Task to the promoted expert squad revision",
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: candidate.id,
              expectedPackageDigest: candidateRevision.package_digest,
            },
            { actor: "user" },
          )
          expect(requireTaskPackageRevisionBinding(newTaskID)).toEqual({
            scope: "project",
            project_id: Instance.project.id,
            namespace: candidateRevision.namespace,
            id: candidateRevision.id,
            version: candidateRevision.version,
            package_digest: candidateRevision.package_digest,
          })

          const restorationText = evolutionMutationConfirmationText({
            projectID: Instance.project.id,
            target,
            beforeDigest: candidateRevision.package_digest,
            afterDigest: baselineRevision.package_digest,
            evidenceSHA256s: [promotion.locator.expected_sha256],
            operation: "restoration",
          })
          const restorationAuthorization = await authorizeEvolutionPackageMutation({
            taskID: operationTask.taskID,
            sessionID: operationTask.session.id,
            confirmationText: restorationText,
            intent: {
              operation: "restoration",
              priorReceiptLocator: promotion.locator,
              restorePackageDigest: baselineRevision.package_digest,
              expectedCurrentPackageDigest: candidateRevision.package_digest,
            },
          })
          const restoration = await executeEvolutionPackageMutation({
            operation: "restoration",
            authorization: restorationAuthorization.authorization,
            priorReceiptLocator: promotion.locator,
            restorePackageDigest: baselineRevision.package_digest,
            expectedCurrentPackageDigest: candidateRevision.package_digest,
          })
          expect({
            operation: restoration.receipt.operation,
            before: restoration.receipt.before_digest,
            after: restoration.receipt.after_digest,
            installed: (
              await PromptProfileResolver.resolveActivePackageRevision({
                projectDirectory: Instance.project.worktree,
                config,
              })
            ).packageDigest,
          }).toEqual({
            operation: "restoration",
            before: candidateRevision.package_digest,
            after: baselineRevision.package_digest,
            installed: baselineRevision.package_digest,
          })
          const historyAfterRestoration = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          const restoredComparison = historyAfterRestoration.records[0]!.candidates[0]!.comparisons[0]!
          expect({
            installed: historyAfterRestoration.authority.installed_revision.package_digest,
            receiptChain: restoredComparison.receipts.map((item) => item.receipt.operation),
            promotion: restoredComparison.promotion_intent?.request,
            restoration: restoredComparison.restoration_intents[0]?.request,
          }).toEqual({
            installed: baselineRevision.package_digest,
            receiptChain: ["promotion", "restoration"],
            promotion: {
              operation: "promotion",
              campaignSpecLocator: campaign,
              candidateRevisionLocator: candidateArtifact,
              comparisonResultLocator: comparison,
              expectedCurrentPackageDigest: baselineRevision.package_digest,
            },
            restoration: {
              operation: "restoration",
              priorReceiptLocator: restoration.locator,
              restorePackageDigest: candidateRevision.package_digest,
              expectedCurrentPackageDigest: baselineRevision.package_digest,
            },
          })
          const comparisonEnvelope = requireEngineArtifactByLocator({
            taskID: operationTask.taskID,
            locator: comparison,
          }).payload
          updateEngineArtifact({ id: comparison.artifact_id, payload: comparisonEnvelope })
          const versionedHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          expect(
            versionedHistory.records[0]!.candidates[0]!.comparisons.map((comparisonRecord) => ({
              revision: comparisonRecord.artifact.locator.catalog_revision,
              partition: comparisonRecord.artifact.partition,
              receiptChain: comparisonRecord.receipts.map((item) => item.receipt.operation),
            })),
          ).toEqual([
            {
              revision: versionedHistory.records[0]!.candidates[0]!.comparisons[0]!.artifact.locator.catalog_revision,
              partition: "current",
              receiptChain: [],
            },
            {
              revision: comparison.catalog_revision,
              partition: "historical",
              receiptChain: ["promotion", "restoration"],
            },
          ])
          await Instance.provide({
            directory: foreignProject.path,
            fn: async () => {
              await ExpertSquadPackageManager.importDirectory({
                projectDirectory: foreignProject.path,
                sourceDirectory: baselineSource,
                installationScope: "project",
              })
              let authorityError: unknown
              try {
                await readEvolutionCampaignDetail({
                  namespace: target.namespace,
                  id: target.id,
                  installationScope: "project",
                  campaignTaskID: operationTask.taskID,
                  campaignLocator: campaign,
                  candidateLocator: candidateArtifact,
                  comparisonLocator: comparison,
                  catalogRevisionUpper: versionedHistory.catalog_revision_upper,
                })
              } catch (error) {
                authorityError = error
              }
              expect(authorityError).toMatchObject({
                name: "EvolutionHistoryAuthorityError",
                data: {
                  code: "EVOLUTION_HISTORY_FOREIGN_PROJECT",
                  task_id: operationTask.taskID,
                  expected_project_id: Instance.project.id,
                },
              })
            },
          })

          const unlinkedCandidate = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/candidate-revision",
            payload: candidatePayload,
          })
          const globalCampaign = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/campaign-spec",
            payload: {
              ...campaignPayload,
              target: {
                scope: "global",
                project_id: null,
                project_directory: null,
                namespace: target.namespace,
                id: target.id,
              },
              trial_execution: { status: "available", installation_scope: "global" },
              candidate_hypothesis: "Global scope identity remains separate from the project scope graph.",
            },
          })
          const unlinkedGlobalCandidate = recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/candidate-revision",
            payload: {
              ...candidatePayload,
              development_campaign_locator: globalCampaign,
            },
          })
          const integrityHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          const globalIntegrityHistory = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "global",
            limit: 20,
          })
          expect({
            project: integrityHistory.integrity_issues.map((issue) =>
              issue.code === "UNLINKED_EVOLUTION_ARTIFACT" ? issue.artifact.locator : issue.locator,
            ),
            global: globalIntegrityHistory.integrity_issues.map((issue) =>
              issue.code === "UNLINKED_EVOLUTION_ARTIFACT" ? issue.artifact.locator : issue.locator,
            ),
          }).toEqual({
            project: [unlinkedCandidate],
            global: [unlinkedGlobalCandidate],
          })

          for (let index = 0; index < 21; index++) {
            recordEvolutionArtifact({
              taskID: operationTask.taskID,
              type: "evolution-lab/campaign-spec",
              payload: {
                ...campaignPayload,
                candidate_hypothesis: `Frozen pagination campaign ${index + 1}`,
              },
            })
          }
          const firstPage = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          const frozenCursor = firstPage.next_cursor!
          recordEvolutionArtifact({
            taskID: operationTask.taskID,
            type: "evolution-lab/campaign-spec",
            payload: {
              ...campaignPayload,
              candidate_hypothesis: "Campaign published after the frozen cursor",
            },
          })
          const secondPage = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
            catalogRevisionUpper: frozenCursor.catalog_revision_upper,
            beforeCatalogRevision: frozenCursor.before_catalog_revision,
          })
          const refreshedPage = await readEvolutionHistory({
            namespace: target.namespace,
            id: target.id,
            installationScope: "project",
            limit: 20,
          })
          expect({
            frozenFirstPage: firstPage.records.length,
            frozenSecondPage: secondPage.records.length,
            frozenCampaigns: new Set(
              [...firstPage.records, ...secondPage.records].map(
                (record) => `${record.campaign.artifact.task_id}:${record.campaign.artifact.locator.artifact_id}`,
              ),
            ).size,
            refreshedFirstCampaign: refreshedPage.records[0]!.campaign.candidate_hypothesis,
          }).toEqual({
            frozenFirstPage: 20,
            frozenSecondPage: 2,
            frozenCampaigns: 22,
            refreshedFirstCampaign: "Campaign published after the frozen cursor",
          })
        },
      })
    } finally {
      await rm(sourceRoot, { recursive: true, force: true })
    }
  }, 0)
})
