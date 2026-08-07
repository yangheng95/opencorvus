import {
  MetricEvaluationOutcomeSchema,
  MetricEvaluationRequestSchema,
  type MetricEvaluationHost,
  type MetricScorerSpec,
  type TaskArtifactHost,
} from "@opencorvus-ai/plugin"
import { readTaskArtifact } from "@/artifact-catalog"
import { executeMetrics } from "@/metrics/executor"
import { canonicalMetricJSON } from "@/metrics/canonical-json"
import { readSpecsForTask, registerBaselineSpec } from "@/metrics/store"
import type { TaskToolExecutionScope } from "./task-tool-execution-scope"
import { createMetricJudgeRunner } from "./metric-judge-runner"

function evaluatorConfig(scorer: MetricScorerSpec, physicalIDs: ReadonlyMap<string, string>): Record<string, unknown> {
  if (scorer.evaluator_kind !== "aggregator") return scorer.evaluator_config
  return {
    ...scorer.evaluator_config,
    of: scorer.evaluator_config.of.map((logicalID) => {
      const physicalID = physicalIDs.get(logicalID)
      if (!physicalID) throw new Error(`Aggregator scorer ${scorer.scorer_id} references unknown scorer ${logicalID}`)
      return physicalID
    }),
  }
}

function semanticSpec(taskID: string, scorer: MetricScorerSpec, physicalIDs: ReadonlyMap<string, string>) {
  return {
    task_id: taskID,
    scope: scorer.scope,
    goal_id: scorer.goal_id,
    name: scorer.scorer_id,
    description: scorer.description,
    unit: scorer.unit,
    direction: scorer.direction,
    target: scorer.target,
    floor: scorer.floor,
    weight: scorer.weight,
    observation_class: scorer.observation_class,
    evaluator_kind: scorer.evaluator_kind,
    evaluator_config: evaluatorConfig(scorer, physicalIDs),
    source: "baseline" as const,
    created_by: "architect" as const,
  }
}

function ensureFrozenScorers(taskID: string, scorers: readonly MetricScorerSpec[]): Map<string, string> {
  const existing = readSpecsForTask(taskID)
  const physicalIDs = new Map(existing.map((spec) => [spec.name, spec.id]))
  if (existing.length === 0) {
    for (const scorer of [
      ...scorers.filter((candidate) => candidate.evaluator_kind !== "aggregator"),
      ...scorers.filter((candidate) => candidate.evaluator_kind === "aggregator"),
    ]) {
      const registered = registerBaselineSpec(semanticSpec(taskID, scorer, physicalIDs))
      physicalIDs.set(scorer.scorer_id, registered.id)
    }
    return physicalIDs
  }

  const existingByName = new Map(existing.map((spec) => [spec.name, spec]))
  if (existing.length !== scorers.length) {
    throw new Error(`Metric scorer set for Task ${taskID} differs from its frozen campaign scorer set`)
  }
  for (const scorer of scorers) {
    const persisted = existingByName.get(scorer.scorer_id)
    if (!persisted) throw new Error(`Metric scorer ${scorer.scorer_id} is absent from Task ${taskID}`)
    const { id: _id, frozen_at: _frozenAt, ...persistedSemantic } = persisted
    if (canonicalMetricJSON(persistedSemantic) !== canonicalMetricJSON(semanticSpec(taskID, scorer, physicalIDs))) {
      throw new Error(`Metric scorer ${scorer.scorer_id} conflicts with the frozen Task scorer definition`)
    }
  }
  return physicalIDs
}

export function createMetricEvaluationHost(
  scope: TaskToolExecutionScope,
  taskArtifacts: Pick<TaskArtifactHost, "stage" | "publish">,
): MetricEvaluationHost {
  return Object.freeze({
    async evaluate(rawInput) {
      const input = MetricEvaluationRequestSchema.parse(rawInput)
      const physicalIDs = ensureFrozenScorers(scope.taskID, input.scorers)
      const logicalIDs = new Map([...physicalIDs].map(([logical, physical]) => [physical, logical]))
      const outcome = await executeMetrics(
        {
          task_id: scope.taskID,
          iteration: input.iteration,
          delivery_slice_revision_id: input.delivery_slice_revision_id,
          selected_evidence_locators: input.selected_evidence_locators,
          visual_feedback_verification_artifact_locators: input.visual_feedback_verification_artifact_locators,
        },
        {
          workDir: scope.projectDirectory,
          taskArtifacts,
          evidenceReader: {
            read: (read) =>
              readTaskArtifact({
                authority: {
                  projectID: scope.projectID,
                  projectDirectory: scope.projectDirectory,
                  taskID: scope.taskID,
                },
                read,
              }),
          },
          judge: createMetricJudgeRunner(scope),
        },
      )
      return MetricEvaluationOutcomeSchema.parse({
        results: outcome.results.map((result) => ({
          scorer_id: logicalIDs.get(result.metric_spec_id)!,
          metric_spec_id: result.metric_spec_id,
          raw_value: result.raw_value,
          normalized_value: result.normalized_value,
          met_target: result.met_target,
          met_floor: result.met_floor,
          evidence_ref: result.evidence_ref,
          evidence_fresh: result.evidence_fresh,
        })),
        unavailable: outcome.unavailable.map((item) => ({
          scorer_id: logicalIDs.get(item.spec_id)!,
          reason_code: item.reason_code,
          evidence_ref: item.evidence_ref,
        })),
      })
    },
  })
}
