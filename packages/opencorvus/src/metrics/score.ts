/**
 * Pure measurement snapshot computation.
 *
 * Given typed input data (specs, results, prior state), emit
 * an IterationSnapshot observation. No DB access — the store layer fetches
 * the inputs, feeds them in, and persists the output.
 *
 * Score composition rules — anchored in docs/spec-dynamic-adversarial-metrics.md:
 *   - Quality and diagnostic observations contribute to the aggregate.
 *   - Results with evidence_fresh=false are omitted from the current aggregate.
 *   - Per-Slice contribution: for each Delivery Slice revision, weighted mean of its fresh metrics'
 *     normalized values. Unavailable observations do not become failed metrics.
 *   - Global contribution: weighted mean over all global metrics.
 *   - S_k = α * per_goal_overall + β * global_overall, with α=β=0.5 default.
 */
import type { IterationSnapshot, MetricResult, MetricSpec } from "./types"

export interface ScoreWeights {
  /** Weight of per-Slice aggregate in S_k. Default 0.5. */
  alpha: number
  /** Weight of global aggregate in S_k. Default 0.5. */
  beta: number
}

export const SCORE_WEIGHT_DEFAULTS: ScoreWeights = { alpha: 0.5, beta: 0.5 }

export interface SnapshotInput {
  task_id: string
  iteration: number
  specs: readonly MetricSpec[]
  /** Results for the CURRENT iteration only. */
  currentResults: readonly MetricResult[]
  /** Results for the PREVIOUS iteration only — used for regression detection. */
  previousResults: readonly MetricResult[]
  /** S_{k-1}, or NULL when the previous iteration was unmeasured. */
  previousAggregateScore: number | null
  weights?: ScoreWeights
}

/** Materialize one measurement snapshot without deriving a workflow outcome. */
export function computeIterationSnapshot(input: SnapshotInput): IterationSnapshot {
  const weights = input.weights ?? SCORE_WEIGHT_DEFAULTS
  const currentBySpec = indexBySpec(input.currentResults)
  const previousBySpec = indexBySpec(input.previousResults)

  // Per-Slice contribution: weighted mean over each Slice revision's specs, then
  // uniform average across measured Slices. A Slice with no fresh result remains
  // unknown and never contributes a synthetic zero.
  const perGoalScore: Record<string, number | null> = {}
  const goalIDs = uniqueGoalIDs(input.specs)
  for (const goalID of goalIDs) {
    const goalSpecs = input.specs.filter(
      (s) => s.scope === "goal" && s.goal_id === goalID && s.observation_class !== "efficiency",
    )
    perGoalScore[goalID] = weightedMean(goalSpecs, currentBySpec)
  }
  const measuredGoalScores = Object.values(perGoalScore).filter((score): score is number => score !== null)
  const perGoalOverall =
    goalIDs.length === 0 || measuredGoalScores.length !== goalIDs.length
      ? null
      : measuredGoalScores.reduce((sum, score) => sum + score, 0) / measuredGoalScores.length

  // Global contribution: weighted mean over global specs.
  const globalSpecs = input.specs.filter((s) => s.scope === "global" && s.observation_class !== "efficiency")
  const globalOverall = weightedMean(globalSpecs, currentBySpec)

  const aggregate = weightedDimensionMean([
    ...(goalIDs.length > 0 ? [{ value: perGoalOverall, weight: weights.alpha }] : []),
    ...(globalSpecs.length > 0 ? [{ value: globalOverall, weight: weights.beta }] : []),
  ])
  const delta =
    input.iteration === 0 || aggregate === null || input.previousAggregateScore === null
      ? null
      : aggregate - input.previousAggregateScore

  // Target observations are context for the Orchestrator, not acceptance or
  // retry instructions.
  let unmetTargetCount = 0
  let unmeasuredTargetCount = 0
  let regressedTargetCount = 0
  for (const spec of input.specs) {
    if (spec.source !== "baseline" || spec.observation_class !== "quality") continue
    const curr = currentBySpec.get(spec.id)
    const prev = previousBySpec.get(spec.id)
    if (!curr || !curr.evidence_fresh) {
      unmeasuredTargetCount++
      continue
    }
    if (!curr.met_target || !curr.met_floor) unmetTargetCount++
    const regressed = prev?.evidence_fresh === true && prev.met_target && !curr.met_target
    if (regressed) regressedTargetCount++
  }

  return {
    task_id: input.task_id,
    iteration: input.iteration,
    aggregate_score: aggregate,
    per_goal_score: perGoalScore,
    global_score: globalOverall,
    delta_vs_prev: delta,
    novelty_score: 0,
    unmet_target_count: unmetTargetCount,
    unmeasured_target_count: unmeasuredTargetCount,
    open_counterexamples: 0,
    regressed_target_count: regressedTargetCount,
  }
}

function indexBySpec(results: readonly MetricResult[]): Map<string, MetricResult> {
  const m = new Map<string, MetricResult>()
  for (const r of results) m.set(r.metric_spec_id, r)
  return m
}

function uniqueGoalIDs(specs: readonly MetricSpec[]): string[] {
  const set = new Set<string>()
  for (const s of specs) {
    if (s.scope === "goal" && s.goal_id !== null) set.add(s.goal_id)
  }
  return [...set]
}

function weightedMean(specs: readonly MetricSpec[], results: Map<string, MetricResult>): number | null {
  if (specs.length === 0) return null
  let weightSum = 0
  let weightedSum = 0
  for (const spec of specs) {
    const result = results.get(spec.id)
    if (!result || !result.evidence_fresh) return null
    weightSum += spec.weight
    weightedSum += spec.weight * result.normalized_value
  }
  if (weightSum === 0) return null
  return weightedSum / weightSum
}

function weightedDimensionMean(dimensions: Array<{ value: number | null; weight: number }>): number | null {
  if (dimensions.some((dimension) => dimension.weight > 0 && dimension.value === null)) return null
  let weightSum = 0
  let weightedSum = 0
  for (const dimension of dimensions) {
    if (dimension.value === null || dimension.weight <= 0) continue
    weightSum += dimension.weight
    weightedSum += dimension.value * dimension.weight
  }
  return weightSum === 0 ? null : weightedSum / weightSum
}
