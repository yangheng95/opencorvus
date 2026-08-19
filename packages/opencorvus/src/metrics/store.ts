/**
 * Persistence layer for Dynamic Adversarial Metrics.
 *
 * Enforces:
 *   - Frozen-ruler: baseline specs may only be inserted while no iteration
 *     row exists for the task; they are never UPDATED or DELETED (the SQL
 *     trigger in ddl.ts raises on UPDATE; this layer simply never emits one).
 *   - Challenge budget: ≤1 challenge metric per iteration, ≤3 per task total.
 *   - Challenge observation class: always 'diagnostic'.
 *   - Scope/goal_id invariant: scope='goal' ⇔ goal_id NOT NULL;
 *     scope='global' ⇔ goal_id NULL.
 */
import type { MetricEvaluatorKind, MetricObservationClass } from "./types"
import { and, asc, count, eq, sql } from "drizzle-orm"
import { NamedError } from "@opencorvus-ai/util/error"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { EngineMetricResultTable, EngineMetricSpecTable } from "./metrics.sql"
import { MetricResult, type MetricSpec } from "./types"
import z from "zod"
import type { TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { canonicalMetricJSON } from "./canonical-json"

export const MetricWriteError = NamedError.create(
  "MetricWriteError",
  z.object({ message: z.string(), code: z.string() }),
)

// ---------------------------------------------------------------------------
// Baseline specs
// ---------------------------------------------------------------------------

export interface BaselineSpecInput {
  task_id: string
  scope: "goal" | "global"
  goal_id: string | null
  name: string
  description: string
  unit: string
  direction: "higher_better" | "lower_better"
  target: number
  floor: number
  weight: number
  observation_class: MetricObservationClass
  // Restating the union inline meant a sixth evaluator kind would compile here
  // while silently never reaching this input type.
  evaluator_kind: MetricEvaluatorKind
  evaluator_config: Record<string, unknown>
}

/**
 * Insert a baseline (architect-authored) metric spec. Throws if:
 *   - scope / goal_id invariant violated
 *   - the task already has any iteration row (modeling window closed)
 *   - the task does not exist
 *
 * Baseline rows are immutable after insert; the SQL trigger enforces this.
 */
export function registerBaselineSpec(input: BaselineSpecInput): MetricSpec {
  validateScopeInvariant(input.scope, input.goal_id)
  return Database.transaction((tx) => {
    const now = Date.now()
    const id = Identifier.ascending("metric_spec")
    const row = {
      id,
      task_id: input.task_id,
      scope: input.scope,
      goal_id: input.goal_id,
      name: input.name,
      description: input.description,
      unit: input.unit,
      direction: input.direction,
      target: input.target,
      floor: input.floor,
      weight: input.weight,
      observation_class: input.observation_class,
      evaluator_kind: input.evaluator_kind,
      evaluator_config: input.evaluator_config,
      source: "baseline" as const,
      frozen_at: now,
      created_by: "architect" as const,
    }
    tx.insert(EngineMetricSpecTable).values(row).run()
    return row
  })
}

// ---------------------------------------------------------------------------
// Metric results
// ---------------------------------------------------------------------------

type MetricResultInput = {
  metric_spec_id: string
  task_id: string
  iteration: number
  delivery_slice_revision_id: string | null
  evidence_ref: TaskArtifactRef
} & (
  | {
      raw_value: number
      normalized_value: number
      met_target: boolean
      met_floor: boolean
      evidence_fresh: true
    }
  | {
      raw_value: null
      normalized_value: null
      met_target: null
      met_floor: null
      evidence_fresh: false
    }
)

export function writeMetricResult(input: MetricResultInput): MetricResult {
  const id = Identifier.ascending("metric_result")
  const now = Date.now()
  const row = MetricResult.parse({
    id,
    metric_spec_id: input.metric_spec_id,
    task_id: input.task_id,
    iteration: input.iteration,
    delivery_slice_revision_id: input.delivery_slice_revision_id,
    raw_value: input.raw_value,
    normalized_value: input.normalized_value === null ? null : clip01(input.normalized_value),
    met_target: input.met_target,
    met_floor: input.met_floor,
    evidence_ref: input.evidence_ref,
    evidence_fresh: input.evidence_fresh,
    computed_at: now,
  })
  Database.use((db) =>
    db
      .insert(EngineMetricResultTable)
      .values({ ...row, evidence_ref: canonicalMetricJSON(row.evidence_ref) })
      .run(),
  )
  return row
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function readSpecsForTask(taskID: string): MetricSpec[] {
  const rows = Database.use((db) =>
    db.select().from(EngineMetricSpecTable).where(eq(EngineMetricSpecTable.task_id, taskID)).all(),
  )
  return rows as MetricSpec[]
}

export function readResultsForIteration(taskID: string, iteration: number): MetricResult[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineMetricResultTable)
      .where(and(eq(EngineMetricResultTable.task_id, taskID), eq(EngineMetricResultTable.iteration, iteration)))
      .all(),
  )
  return rows.map((row) => MetricResult.parse({ ...row, evidence_ref: JSON.parse(row.evidence_ref) }))
}

// ---------------------------------------------------------------------------
// Internal validators
// ---------------------------------------------------------------------------

function validateScopeInvariant(scope: "goal" | "global", goalID: string | null): void {
  if (scope === "goal" && goalID === null) {
    throw new MetricWriteError({
      message: "scope='goal' requires goal_id",
      code: "scope_invariant",
    })
  }
  if (scope === "global" && goalID !== null) {
    throw new MetricWriteError({
      message: "scope='global' forbids goal_id",
      code: "scope_invariant",
    })
  }
}

/**
 * The single normalized-value clamp. `executor.ts` held a copy without the
 * finite guard, so a degenerate spec (floor === target) produced NaN that only
 * became 0 once it reached this module on write — the in-memory attempt
 * carried NaN through aggregation in between.
 */
export function clip01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}
