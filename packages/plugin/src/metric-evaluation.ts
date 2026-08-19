import { z } from "zod"
import { ArtifactReadLocatorListSchema, EngineArtifactLocatorSchema } from "./artifact-catalog"
import { TaskArtifactRefSchema } from "./task-artifact"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ShellMetricEvaluatorConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    workspace_digest: SHA256Schema,
    executable: z.string().min(1),
    args: z.array(z.string()),
    cwd: z.string().min(1).optional(),
    parse: z.enum(["exit_code", "stdout_number", "stdout_pattern"]),
    pattern: z.string().min(1).optional(),
    inactivity_timeout_ms: z.number().int().positive(),
    expected_exit_code: z.number().int().optional(),
  })
  .strict()

export const JudgeMetricEvaluatorConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    provider_id: z.string().min(1),
    model_id: z.string().min(1),
    inactivity_timeout_ms: z.number().int().positive(),
    max_evidence_bytes: z.number().int().positive(),
    criteria: z.string().min(1),
    rubric: z
      .array(
        z
          .object({
            score: z.number(),
            label: z.string().min(1),
            anchor: z.string().min(1),
            passes: z.boolean(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

/**
 * The one name a prebuilt evaluator can carry. Declared here because the Host
 * that implements it and the Campaign comparison that looks for it live in
 * different packages, and a literal repeated across that boundary is a rename
 * waiting to silently disable a gate.
 */
export const VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME = "visual-feedback-verification" as const

export const PrebuiltMetricEvaluatorConfigSchema = z
  .object({
    name: z.literal(VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME),
    scorer_revision: SHA256Schema,
  })
  .strict()

const ConstantValueQueryConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    query: z.literal("constant_value"),
    value: z.number(),
  })
  .strict()

const MetricResultValueQueryConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    query: z.literal("metric_result_value"),
    metric_spec_id: z.string().min(1),
    iteration_offset: z.number().int(),
    result_column: z.enum(["raw_value", "normalized_value"]),
  })
  .strict()

export const QueryMetricEvaluatorConfigSchema = z.discriminatedUnion("query", [
  ConstantValueQueryConfigSchema,
  MetricResultValueQueryConfigSchema,
])

export const AggregatorMetricEvaluatorConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    of: z.array(z.string().min(1)).min(1),
    op: z.enum(["mean", "min", "max", "sum"]),
    iteration_offset: z.number().int(),
  })
  .strict()

const MetricScorerIdentitySchema = z
  .object({
    scorer_id: z.string().min(1),
    scorer_revision: SHA256Schema,
    scope: z.enum(["goal", "global"]),
    goal_id: z.string().min(1).nullable(),
    description: z.string().min(1),
    unit: z.string().min(1),
    direction: z.enum(["higher_better", "lower_better"]),
    target: z.number(),
    floor: z.number(),
    weight: z.number().nonnegative(),
    observation_class: z.enum(["quality", "diagnostic", "efficiency"]),
  })
  .strict()

export const MetricScorerSpecSchema = z
  .discriminatedUnion("evaluator_kind", [
    MetricScorerIdentitySchema.extend({
      evaluator_kind: z.literal("shell"),
      evaluator_config: ShellMetricEvaluatorConfigSchema,
    }),
    MetricScorerIdentitySchema.extend({
      evaluator_kind: z.literal("judge"),
      evaluator_config: JudgeMetricEvaluatorConfigSchema,
    }),
    MetricScorerIdentitySchema.extend({
      evaluator_kind: z.literal("prebuilt"),
      evaluator_config: PrebuiltMetricEvaluatorConfigSchema,
    }),
    MetricScorerIdentitySchema.extend({
      evaluator_kind: z.literal("query"),
      evaluator_config: QueryMetricEvaluatorConfigSchema,
    }),
    MetricScorerIdentitySchema.extend({
      evaluator_kind: z.literal("aggregator"),
      evaluator_config: AggregatorMetricEvaluatorConfigSchema,
    }),
  ])
  .superRefine((value, context) => {
    if ((value.scope === "goal") !== (value.goal_id !== null)) {
      context.addIssue({
        code: "custom",
        path: ["goal_id"],
        message: "goal metric requires goal_id and global metric requires null",
      })
    }
    if (value.evaluator_config.scorer_revision !== value.scorer_revision) {
      context.addIssue({
        code: "custom",
        path: ["evaluator_config", "scorer_revision"],
        message: "evaluator config scorer revision must equal the frozen scorer revision",
      })
    }
  })

export type MetricScorerSpec = z.infer<typeof MetricScorerSpecSchema>

/**
 * Host-stamped facts. An author never transcribes a 64-hex digest, and a
 * Campaign fixes placement by construction, so the authoring shape omits them
 * and the Host supplies them from the published asset bytes.
 */
const HOST_STAMPED_SCORER_FACTS = { scorer_revision: true, scope: true, goal_id: true } as const
const HOST_STAMPED_CONFIG_FACTS = { scorer_revision: true } as const

const MetricScorerAuthoringIdentitySchema = MetricScorerIdentitySchema.omit(HOST_STAMPED_SCORER_FACTS).extend({
  schema_version: z.literal(1),
})

/**
 * Authoring shape for one scorer asset: the same kind set and the same
 * per-kind evaluator config as {@link MetricScorerSpecSchema}, minus the facts
 * the Host stamps. Deriving it from those declarations is what keeps an
 * authoring surface from silently accepting fewer kinds than the executor runs.
 */
export const MetricScorerAuthoringSpecSchema = z.discriminatedUnion("evaluator_kind", [
  MetricScorerAuthoringIdentitySchema.extend({
    evaluator_kind: z.literal("shell"),
    evaluator_config: ShellMetricEvaluatorConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
  }),
  MetricScorerAuthoringIdentitySchema.extend({
    evaluator_kind: z.literal("judge"),
    evaluator_config: JudgeMetricEvaluatorConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
  }),
  MetricScorerAuthoringIdentitySchema.extend({
    evaluator_kind: z.literal("prebuilt"),
    evaluator_config: PrebuiltMetricEvaluatorConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
  }),
  MetricScorerAuthoringIdentitySchema.extend({
    evaluator_kind: z.literal("query"),
    evaluator_config: z.discriminatedUnion("query", [
      ConstantValueQueryConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
      MetricResultValueQueryConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
    ]),
  }),
  MetricScorerAuthoringIdentitySchema.extend({
    evaluator_kind: z.literal("aggregator"),
    evaluator_config: AggregatorMetricEvaluatorConfigSchema.omit(HOST_STAMPED_CONFIG_FACTS),
  }),
])

export type MetricScorerAuthoringSpec = z.infer<typeof MetricScorerAuthoringSpecSchema>

/**
 * Expand one authored scorer into the canonical spec by stamping the
 * Host-owned facts. The single expansion point replaces per-kind transcription
 * at every authoring surface.
 */
export function metricScorerSpecFromAuthoring(
  authored: MetricScorerAuthoringSpec,
  stamp: Readonly<{ scorer_revision: string; scope: "goal" | "global"; goal_id: string | null }>,
): MetricScorerSpec {
  const { schema_version: _schema_version, evaluator_config, ...identity } = authored
  return MetricScorerSpecSchema.parse({
    ...identity,
    scorer_revision: stamp.scorer_revision,
    scope: stamp.scope,
    goal_id: stamp.goal_id,
    evaluator_config: { ...evaluator_config, scorer_revision: stamp.scorer_revision },
  })
}

export const MetricEvaluationRequestSchema = z
  .object({
    iteration: z.number().int().nonnegative(),
    delivery_slice_revision_id: z.string().min(1).nullable(),
    scorers: z.array(MetricScorerSpecSchema).min(1),
    selected_evidence_locators: ArtifactReadLocatorListSchema,
    visual_feedback_verification_artifact_locators: z.array(EngineArtifactLocatorSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.scorers.map((scorer) => scorer.scorer_id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", path: ["scorers"], message: "scorer IDs must be unique" })
    }
  })

export type MetricEvaluationRequest = z.infer<typeof MetricEvaluationRequestSchema>

const MetricEvaluationResultSchema = z
  .object({
    scorer_id: z.string().min(1),
    metric_spec_id: z.string().min(1),
    raw_value: z.number().nullable(),
    normalized_value: z.number().min(0).max(1).nullable(),
    met_target: z.boolean().nullable(),
    met_floor: z.boolean().nullable(),
    evidence_ref: TaskArtifactRefSchema,
    evidence_fresh: z.boolean(),
  })
  .strict()

export const MetricEvaluationOutcomeSchema = z
  .object({
    results: z.array(MetricEvaluationResultSchema).min(1),
    unavailable: z.array(
      z
        .object({
          scorer_id: z.string().min(1),
          reason_code: z.enum([
            "configuration_invalid",
            "selected_evidence_unavailable",
            "execution_failed",
            "inactivity_timeout",
            "parse_failed",
            "provider_unavailable",
            "input_unavailable",
          ]),
          evidence_ref: TaskArtifactRefSchema,
        })
        .strict(),
    ),
  })
  .strict()

export type MetricEvaluationOutcome = z.infer<typeof MetricEvaluationOutcomeSchema>

export type MetricEvaluationHost = Readonly<{
  evaluate(input: MetricEvaluationRequest): Promise<MetricEvaluationOutcome>
}>
