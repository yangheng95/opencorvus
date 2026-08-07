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

export const PrebuiltMetricEvaluatorConfigSchema = z
  .object({
    name: z.literal("visual-feedback-verification"),
    scorer_revision: SHA256Schema,
  })
  .strict()

export const QueryMetricEvaluatorConfigSchema = z
  .object({
    scorer_revision: SHA256Schema,
    sql: z.string().min(1),
    value_column: z.string().min(1),
  })
  .strict()

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
