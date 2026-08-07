import { integer, real, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core"
import { EngineTaskTable, EngineGoalTable } from "@/engine/engine.sql"
import { Timestamps } from "@/storage/schema.sql"
import type {
  MetricCreatedBy,
  MetricDirection,
  MetricEvaluatorKind,
  MetricObservationClass,
  MetricScope,
  MetricSource,
} from "./types"

/**
 * Frozen metric definitions — produced once at task start by the Architect
 * (source='baseline'). Baseline rows are immutable (see store.ts).
 */
export const EngineMetricSpecTable = sqliteTable(
  "engine_metric_spec",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    scope: text().notNull().$type<MetricScope>(),
    goal_id: text().references(() => EngineGoalTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull(),
    unit: text().notNull(),
    direction: text().notNull().$type<MetricDirection>(),
    target: real().notNull(),
    floor: real().notNull(),
    weight: real().notNull(),
    observation_class: text().notNull().$type<MetricObservationClass>(),
    evaluator_kind: text().notNull().$type<MetricEvaluatorKind>(),
    evaluator_config: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    source: text().notNull().$type<MetricSource>(),
    frozen_at: integer().notNull(),
    created_by: text().notNull().$type<MetricCreatedBy>(),
    ...Timestamps,
  },
  (table) => [
    index("engine_metric_spec_task_idx").on(table.task_id),
    index("engine_metric_spec_scope_idx").on(table.task_id, table.scope),
    index("engine_metric_spec_source_idx").on(table.task_id, table.source),
    index("engine_metric_spec_goal_idx").on(table.goal_id),
  ],
)

/**
 * Per-iteration raw measurements. `evidence_fresh` records whether the
 * measurement was produced in this iteration.
 */
export const EngineMetricResultTable = sqliteTable(
  "engine_metric_result",
  {
    id: text().primaryKey(),
    metric_spec_id: text()
      .notNull()
      .references(() => EngineMetricSpecTable.id, { onDelete: "cascade" }),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    iteration: integer().notNull(),
    /** Immutable Delivery Slice contract revision observed by this measurement. */
    delivery_slice_revision_id: text(),
    raw_value: real(),
    normalized_value: real(),
    met_target: integer({ mode: "boolean" }),
    met_floor: integer({ mode: "boolean" }),
    evidence_ref: text().notNull(),
    evidence_fresh: integer({ mode: "boolean" }).notNull(),
    computed_at: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("engine_metric_result_task_iter_idx").on(table.task_id, table.iteration),
    index("engine_metric_result_spec_idx").on(table.metric_spec_id),
  ],
)

/**
 * Aggregated per-iteration observation snapshot. The Orchestrator may read
 * these facts alongside other context; the row has no scheduling authority.
 * PK (task_id, iteration) — never more than one row per iteration.
 */
export const EngineIterationTable = sqliteTable(
  "engine_iteration",
  {
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    iteration: integer().notNull(),
    aggregate_score: real(),
    /** JSON encoded {goal_id → score} map. */
    per_goal_score_json: text({ mode: "json" }).$type<Record<string, number | null>>().notNull(),
    global_score: real(),
    delta_vs_prev: real(),
    novelty_score: real().notNull(),
    unmet_target_count: integer().notNull(),
    unmeasured_target_count: integer().notNull(),
    open_counterexamples: integer().notNull(),
    regressed_target_count: integer().notNull(),
    ...Timestamps,
  },
  (table) => [primaryKey({ columns: [table.task_id, table.iteration] })],
)
