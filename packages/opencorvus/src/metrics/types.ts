/**
 * Architect-authored metrics — typed surface.
 *
 * The modeling layer (Architect / RequirementsAgent) produces MetricSpec rows
 * exactly once at task start; the ruler is frozen after that.
 */
import z from "zod"
import { ArtifactReadLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskArtifactRefSchema } from "@opencorvus-ai/plugin/task-artifact"

export const MetricScope = z.enum(["goal", "global"])
export type MetricScope = z.infer<typeof MetricScope>

export const MetricDirection = z.enum(["higher_better", "lower_better"])
export type MetricDirection = z.infer<typeof MetricDirection>

/**
 * Observation class controls only how a measurement is summarized:
 *  - quality     → contributes to the quality aggregate and target counts
 *  - diagnostic  → contributes to the aggregate with its authored weight
 *  - efficiency  → remains a separate trend observation
 *
 * No class can accept, reject, stall, abort, or dispatch work.
 */
export const MetricObservationClass = z.enum(["quality", "diagnostic", "efficiency"])
export type MetricObservationClass = z.infer<typeof MetricObservationClass>

export const MetricEvaluatorKind = z.enum([
  "shell", // invoke a shell command, map exit/stdout to raw_value
  "judge", // LLM-judge with rubric → ordinal level → normalized value
  "prebuilt", // deterministic built-in evaluator such as visual-feedback-verification
  "query", // SQL query over engine_* tables
  "aggregator", // composes other metric_result rows by op (mean/min/max/sum)
])
export type MetricEvaluatorKind = z.infer<typeof MetricEvaluatorKind>

export const MetricSource = z.enum(["baseline", "challenge"])
export type MetricSource = z.infer<typeof MetricSource>

export const MetricCreatedBy = z.enum(["architect"])
export type MetricCreatedBy = z.infer<typeof MetricCreatedBy>

/**
 * Immutable metric definition. `frozen_at` is set on insert; the store layer
 * rejects every UPDATE/DELETE on baseline rows to preserve comparability of
 * S_k across iterations.
 */
export const MetricSpec = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  scope: MetricScope,
  /** NULL iff scope='global'; NOT NULL iff scope='goal'. Enforced at write. */
  goal_id: z.string().nullable(),
  name: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1), // 'ratio'|'count'|'latency_ms'|...
  direction: MetricDirection,
  target: z.number(),
  floor: z.number(),
  weight: z.number().min(0),
  observation_class: MetricObservationClass,
  evaluator_kind: MetricEvaluatorKind,
  /** JSON config interpreted by the Metric Executor dispatcher. */
  evaluator_config: z.record(z.string(), z.unknown()),
  source: MetricSource,
  frozen_at: z.number().int(),
  created_by: MetricCreatedBy,
})
export type MetricSpec = z.infer<typeof MetricSpec>

const MetricResultIdentity = z.object({
  id: z.string().min(1),
  metric_spec_id: z.string().min(1),
  task_id: z.string().min(1),
  iteration: z.number().int().min(0),
  delivery_slice_revision_id: z.string().nullable(),
  /** Exact immutable Task Artifact containing the complete evaluation attempt. */
  evidence_ref: TaskArtifactRefSchema,
  computed_at: z.number().int(),
})

/** Raw measurement fact. Unavailable evidence has no synthetic numeric or
 * threshold result: NULL is the exact persisted representation of unknown. */
export const MetricResult = z.discriminatedUnion("evidence_fresh", [
  MetricResultIdentity.extend({
    raw_value: z.number(),
    /** Direction-adjusted, clipped to [0,1]. */
    normalized_value: z.number().min(0).max(1),
    met_target: z.boolean(),
    met_floor: z.boolean(),
    evidence_fresh: z.literal(true),
  }),
  MetricResultIdentity.extend({
    raw_value: z.null(),
    normalized_value: z.null(),
    met_target: z.null(),
    met_floor: z.null(),
    evidence_fresh: z.literal(false),
  }),
])
export type MetricResult = z.infer<typeof MetricResult>

export const MetricUnavailableReasonCode = z.enum([
  "configuration_invalid",
  "selected_evidence_unavailable",
  "execution_failed",
  "inactivity_timeout",
  "parse_failed",
  "provider_unavailable",
  "input_unavailable",
])
export type MetricUnavailableReasonCode = z.infer<typeof MetricUnavailableReasonCode>

const MetricExecutionEvidenceIdentity = z.object({
  schema_version: z.literal(1),
  metric_spec_id: z.string().min(1),
  task_id: z.string().min(1),
  iteration: z.number().int().nonnegative(),
  evaluator_kind: MetricEvaluatorKind,
  selected_evidence: z.array(
    z
      .object({
        locator: ArtifactReadLocatorSchema,
        media_type: z.string().min(1),
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  ),
})

/** Complete immutable scorer attempt. Failure remains typed unavailable and
 * never receives a synthetic numeric value. */
export const MetricExecutionEvidence = z.discriminatedUnion("status", [
  MetricExecutionEvidenceIdentity.extend({
    status: z.literal("measured"),
    raw_value: z.number(),
    execution: z.unknown(),
  }).strict(),
  MetricExecutionEvidenceIdentity.extend({
    status: z.literal("unavailable"),
    reason_code: MetricUnavailableReasonCode,
    message: z.string().min(1),
    execution: z.unknown(),
  }).strict(),
])
export type MetricExecutionEvidence = z.infer<typeof MetricExecutionEvidence>

/** Materialized per-iteration measurement snapshot. */
export const IterationSnapshot = z.object({
  task_id: z.string().min(1),
  iteration: z.number().int().min(0),
  aggregate_score: z.number().nullable(),
  /** {goal_id → score}. JSON text in DB; typed object in memory. */
  per_goal_score: z.record(z.string(), z.number().nullable()),
  global_score: z.number().nullable(),
  delta_vs_prev: z.number().nullable(),
  novelty_score: z.number().min(0),
  unmet_target_count: z.number().int().min(0),
  unmeasured_target_count: z.number().int().min(0),
  open_counterexamples: z.number().int().min(0),
  regressed_target_count: z.number().int().min(0),
})
export type IterationSnapshot = z.infer<typeof IterationSnapshot>
