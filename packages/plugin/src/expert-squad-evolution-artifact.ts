// ABI means Application Binary Interface. ID means Identifier.
import { z } from "zod"
import { ArtifactReadLocatorSchema, EngineArtifactLocatorSchema } from "./artifact-catalog"
import { EvolutionExactRevisionSchema, EvolutionPromotionReceiptSchema } from "./expert-squad-evolution"
import { MetricScorerSpecSchema } from "./metric-evaluation"
import {
  TaskArtifactMediaTypeSchema,
  TaskArtifactPortableSegmentSchema,
  TaskArtifactRelativePathSchema,
} from "./task-artifact"

const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const portableIdentity = TaskArtifactPortableSegmentSchema
const exactRevision = EvolutionExactRevisionSchema
const builtInTarget = z
  .object({
    scope: z.literal("built_in"),
    project_id: z.null(),
    project_directory: z.null(),
    namespace: z.string().min(1),
    id: z.string().min(1),
  })
  .strict()
const projectTarget = z
  .object({
    scope: z.literal("project"),
    project_id: z.string().min(1),
    project_directory: z.string().min(1),
    namespace: z.string().min(1),
    id: z.string().min(1),
  })
  .strict()
const globalTarget = z
  .object({
    scope: z.literal("global"),
    project_id: z.null(),
    project_directory: z.null(),
    namespace: z.string().min(1),
    id: z.string().min(1),
  })
  .strict()
const exactTarget = z.discriminatedUnion("scope", [builtInTarget, projectTarget, globalTarget])
const validatedPackageReceipt = z
  .object({
    operation: z.literal("validated"),
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1),
    package_digest: sha256,
  })
  .strict()
const evidence = z.array(ArtifactReadLocatorSchema)
const unknowns = z.array(z.string().min(1))
const taskArtifactResourceIdentity = z.object({
  path: TaskArtifactRelativePathSchema,
  media_type: TaskArtifactMediaTypeSchema,
  bytes: z.number().int().nonnegative(),
  sha256,
})
const metricScorerResult = z.discriminatedUnion("status", [
  z.object({ scorer_id: portableIdentity, status: z.literal("measured"), value: z.number(), evidence }).strict(),
  z
    .object({
      scorer_id: portableIdentity,
      status: z.literal("unavailable"),
      reason: z.string().min(1),
      evidence,
    })
    .strict(),
])
const frozenCampaignInputs = z
  .object({
    dataset: taskArtifactResourceIdentity,
    cases: z.array(z.object({ case_id: portableIdentity, resource: taskArtifactResourceIdentity }).strict()).min(1),
    model_configuration: taskArtifactResourceIdentity,
    environment: taskArtifactResourceIdentity,
    workspace_template: taskArtifactResourceIdentity,
    permission_snapshot: taskArtifactResourceIdentity,
    scorer_assets: z
      .array(
        z
          .object({
            scorer_id: portableIdentity,
            scorer_revision: sha256,
            resource: taskArtifactResourceIdentity,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

const evolutionCampaignPublishInputShape = {
  target: exactTarget,
  baseline_revision: exactRevision,
  candidate_version_policy: z.string().min(1),
  candidate_hypothesis: z.string().min(1),
  dataset_partition: z.enum(["development", "holdout", "certification"]),
  dataset_digest: sha256,
  cases: z.array(portableIdentity).min(1),
  scorer_digests: z.array(sha256).min(1),
  scorers: z.array(MetricScorerSpecSchema).min(1),
  frozen_inputs: frozenCampaignInputs,
  model: z.string().min(1),
  model_configuration_digest: sha256,
  environment_digest: sha256,
  permission_snapshot_digest: sha256,
  external_side_effect_policy: z.string().min(1),
  repetitions: z.number().int().positive(),
  arm_order: z.array(z.enum(["baseline", "candidate"])).min(2),
  statistics: z.string().min(1),
  budget: z.object({ max_runs: z.number().int().positive(), max_cost: z.number().nonnegative() }).strict(),
  inactivity_timeout_ms: z.number().int().positive(),
  ui_rubric_digest: sha256.nullable(),
  mutable_paths: z.array(z.string().min(1)),
  trial_execution: z.discriminatedUnion("status", [
    z.object({ status: z.literal("available"), installation_scope: z.enum(["project", "global"]) }).strict(),
    z.object({ status: z.literal("unavailable"), reason_code: z.literal("product_release_required") }).strict(),
  ]),
} as const

/**
 * Model-facing candidate-revision publication input.
 *
 * The publisher already validates both package resource sets and compares
 * them, so every revision identity, resource manifest, changed path, frozen
 * file digest, diff digest, and validation receipt is a fact it derives. Asking
 * the author to restate them meant transcribing dozens of 64-character digests
 * byte-for-byte: in the 2026-08-18 luna12 run that produced ten consecutive
 * publication rejections and zero candidate revisions. The author supplies only
 * what it owns — which campaign, why, and the evidence it read.
 */
export const EvolutionCandidateRevisionPublishInputSchema = z
  .object({
    // A campaign-driven candidate names its frozen development Campaign. A
    // feedback-driven candidate has none: one piece of user feedback has
    // nothing to measure, so it carries the verbatim feedback instead and the
    // user's own acceptance is the verdict.
    development_campaign_locator: EngineArtifactLocatorSchema.nullable(),
    feedback: z.string().min(1).nullable(),
    hypothesis: z.string().min(1),
    provenance: evidence,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.development_campaign_locator === null) === (value.feedback === null))
      context.addIssue({
        code: "custom",
        path: ["feedback"],
        message: "a candidate revision is driven by exactly one of a development Campaign or user feedback",
      })
  })

/**
 * Model-facing evaluation-result publication input.
 *
 * Every field of the published artifact — case, arm, repetition, trial task,
 * revision digest, scorer values, and all three predecessor locators — already
 * exists in the immutable metric receipt the Host produced. The Evaluator owns
 * no semantics here at all; its only decision is which receipt to publish, and
 * the publisher requires exactly one receipt resource, so even that is derived.
 * The payload is therefore empty: an empty object is the honest statement that
 * this artifact is a Host projection of a Host fact.
 */
export const EvolutionEvaluationResultPublishInputSchema = z.object({}).strict()

export const EvolutionCampaignPublishInputSchema = z
  .object({
    candidate_version_policy: z.string().min(1),
    candidate_hypothesis: z.string().min(1),
    dataset_partition: z.enum(["development", "holdout", "certification"]),
    resource_roles: z
      .object({
        dataset_path: TaskArtifactRelativePathSchema,
        cases: z
          .array(
            z
              .object({
                case_id: portableIdentity,
                resource_path: TaskArtifactRelativePathSchema,
              })
              .strict(),
          )
          .min(1),
        model_configuration_path: TaskArtifactRelativePathSchema,
        environment_path: TaskArtifactRelativePathSchema,
        workspace_template_path: TaskArtifactRelativePathSchema,
        permission_snapshot_path: TaskArtifactRelativePathSchema,
        scorer_assets: z
          .array(
            z
              .object({
                scorer_id: portableIdentity,
                resource_path: TaskArtifactRelativePathSchema,
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    external_side_effect_policy: z.string().min(1),
    repetitions: z.number().int().positive(),
    arm_order: z.array(z.enum(["baseline", "candidate"])).min(2),
    statistics: z.string().min(1),
    budget: z.object({ max_runs: z.number().int().positive(), max_cost: z.number().nonnegative() }).strict(),
  })
  .strict()

export const EvolutionMetricReceiptSchema = z
  .object({
    campaign_spec_locator: ArtifactReadLocatorSchema,
    candidate_revision_locator: ArtifactReadLocatorSchema.nullable(),
    run_evidence_locator: ArtifactReadLocatorSchema,
    case_id: portableIdentity,
    arm: z.enum(["baseline", "candidate"]),
    repetition: z.number().int().nonnegative(),
    trial_task_id: z.string().min(1),
    trial_revision_digest: sha256,
    scorers: z.array(metricScorerResult).min(1),
  })
  .strict()

export const EvolutionArtifactSchemas = {
  "evolution-lab/opportunity": z
    .object({
      target: exactTarget,
      current_revision: exactRevision,
      trigger: z.object({ type: z.enum(["user", "automation", "mission"]), identity: z.string().min(1) }).strict(),
      evidence,
      observable_symptom: z.string().min(1),
      impact_scope: z.string().min(1),
      frequency: z.string().min(1),
      data_window: z.object({ started_at: z.string().datetime(), ended_at: z.string().datetime() }).strict(),
      owner_hypothesis: z.string().min(1),
      unknowns,
      sensitivity: z.string().min(1),
      suggested_budget: z.object({ runs: z.number().int().positive(), max_cost: z.number().nonnegative() }).strict(),
    })
    .strict(),
  "evolution-lab/campaign-spec": z
    .object({
      ...evolutionCampaignPublishInputShape,
      workspace_digest: sha256,
    })
    .strict()
    .superRefine((value, context) => {
      if (new Set(value.cases).size !== value.cases.length)
        context.addIssue({
          code: "custom",
          path: ["cases"],
          message: "campaign case identifiers must be unique portable path segments",
        })
      if (new Set(value.scorers.map((scorer) => scorer.scorer_id)).size !== value.scorers.length)
        context.addIssue({
          code: "custom",
          path: ["scorers"],
          message: "campaign scorer identifiers must be unique",
        })
      if (
        value.arm_order.length !== 2 ||
        new Set(value.arm_order).size !== 2 ||
        !value.arm_order.includes("baseline") ||
        !value.arm_order.includes("candidate")
      )
        context.addIssue({
          code: "custom",
          path: ["arm_order"],
          message: "campaign arm order must contain baseline and candidate exactly once",
        })
      const requiredRuns = value.cases.length * value.repetitions * 2
      if (value.budget.max_runs < requiredRuns)
        context.addIssue({
          code: "custom",
          path: ["budget", "max_runs"],
          message: `campaign run budget must cover the complete two-arm matrix (${requiredRuns} runs)`,
        })
      if (new Set(value.frozen_inputs.cases.map((item) => item.case_id)).size !== value.frozen_inputs.cases.length)
        context.addIssue({
          code: "custom",
          path: ["frozen_inputs", "cases"],
          message: "frozen campaign case identifiers must be unique portable path segments",
        })
      if (
        new Set(value.frozen_inputs.scorer_assets.map((item) => item.scorer_id)).size !==
        value.frozen_inputs.scorer_assets.length
      )
        context.addIssue({
          code: "custom",
          path: ["frozen_inputs", "scorer_assets"],
          message: "frozen scorer identifiers must be unique portable path segments",
        })
      const declared = [...new Set(value.scorer_digests)].sort()
      const specified = [...new Set(value.scorers.map((scorer) => scorer.scorer_revision))].sort()
      if (JSON.stringify(declared) !== JSON.stringify(specified)) {
        context.addIssue({
          code: "custom",
          path: ["scorer_digests"],
          message: "scorer digests must equal the complete frozen scorer specification revisions",
        })
      }
      const frozen = value.frozen_inputs
      if (
        frozen.dataset.sha256 !== value.dataset_digest ||
        frozen.model_configuration.sha256 !== value.model_configuration_digest ||
        frozen.environment.sha256 !== value.environment_digest ||
        frozen.permission_snapshot.sha256 !== value.permission_snapshot_digest
      )
        context.addIssue({
          code: "custom",
          path: ["frozen_inputs"],
          message: "campaign resource digests must equal their exact immutable resources",
        })
      const caseIDs = [...new Set(frozen.cases.map((item) => item.case_id))].sort()
      if (JSON.stringify(caseIDs) !== JSON.stringify([...new Set(value.cases)].sort()))
        context.addIssue({
          code: "custom",
          path: ["frozen_inputs", "cases"],
          message: "campaign cases must equal the complete immutable case resource set",
        })
      const assetIdentity = frozen.scorer_assets
        .map((asset) => `${asset.scorer_id}:${asset.scorer_revision}:${asset.resource.sha256}`)
        .sort()
      const scorerIdentity = value.scorers
        .map((scorer) => `${scorer.scorer_id}:${scorer.scorer_revision}:${scorer.scorer_revision}`)
        .sort()
      if (JSON.stringify(assetIdentity) !== JSON.stringify(scorerIdentity))
        context.addIssue({
          code: "custom",
          path: ["frozen_inputs", "scorer_assets"],
          message: "scorer assets must equal every frozen scorer identity and revision",
        })
      const executionMatchesTarget =
        value.target.scope === "built_in"
          ? value.trial_execution.status === "unavailable"
          : value.trial_execution.status === "available" &&
            value.trial_execution.installation_scope === value.target.scope
      if (!executionMatchesTarget)
        context.addIssue({
          code: "custom",
          path: ["trial_execution"],
          message:
            'target.scope === "built_in" requires product release; target.scope === "project" or "global" requires available execution in that exact scope',
        })
    }),
  "evolution-lab/failure-attribution": z
    .object({
      symptom: z.string().min(1),
      direct_trigger: z.string().min(1),
      root_cause: z.string().min(1),
      causal_chain: z.array(z.string().min(1)).min(1),
      owner_evidence: evidence,
      prior_path_failure: z.string().min(1),
      competing_hypotheses: z.array(z.string().min(1)),
      disproved_hypotheses: z.array(z.string().min(1)),
      affected_surface: z.array(z.string().min(1)).min(1),
      unknowns,
    })
    .strict(),
  "evolution-lab/candidate-revision": z
    .object({
      development_campaign_locator: EngineArtifactLocatorSchema.nullable(),
      feedback: z.string().min(1).nullable(),
      parent_revision: exactRevision,
      candidate_revision: exactRevision,
      // A Campaign-driven candidate is authored by a worker that read the
      // package as materialized Task Artifact resources, so it names them. A
      // feedback-driven candidate is authored by the Host directly against the
      // content-addressed revision store: the exact bytes are already named by
      // parent_revision/candidate_revision, and staging a second copy would be
      // a second source for one fact.
      parent_resources: z.array(taskArtifactResourceIdentity),
      candidate_resources: z.array(taskArtifactResourceIdentity),
      hypothesis: z.string().min(1),
      changed_paths: z.array(z.string().min(1)).min(1),
      diff_sha256: sha256,
      frozen_files: z.array(
        z.object({ path: z.string().min(1), parent_sha256: sha256, candidate_sha256: sha256 }).strict(),
      ),
      manager_receipt: validatedPackageReceipt,
      provenance: evidence,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.manager_receipt.namespace !== value.candidate_revision.namespace ||
        value.manager_receipt.id !== value.candidate_revision.id ||
        value.manager_receipt.version !== value.candidate_revision.version ||
        value.manager_receipt.package_digest !== value.candidate_revision.package_digest
      )
        context.addIssue({
          code: "custom",
          path: ["manager_receipt"],
          message: "candidate validation receipt must equal the exact candidate revision",
        })
      if ((value.development_campaign_locator === null) === (value.feedback === null))
        context.addIssue({
          code: "custom",
          path: ["feedback"],
          message: "a candidate revision is driven by exactly one of a development Campaign or user feedback",
        })
      const campaignDriven = value.development_campaign_locator !== null
      for (const [key, resources] of [
        ["parent_resources", value.parent_resources],
        ["candidate_resources", value.candidate_resources],
      ] as const) {
        if (campaignDriven === resources.length > 0) continue
        context.addIssue({
          code: "custom",
          path: [key],
          message: campaignDriven
            ? "a Campaign-driven candidate names the materialized package resources it was authored from"
            : "a feedback-driven candidate is authored from the revision store and names no Task Artifact resources",
        })
      }
    }),
  "evolution-lab/run-evidence-bundle": z
    .object({
      case_id: portableIdentity,
      arm: z.enum(["baseline", "candidate"]),
      repetition: z.number().int().nonnegative(),
      workspace_digest: sha256,
      run_evidence_sha256: sha256,
      run_evidence_resource: taskArtifactResourceIdentity.extend({ media_type: z.literal("application/json") }),
      task_id: z.string().min(1),
      terminal_time: z.number().int().nonnegative(),
      model: z.string().min(1),
      environment_digest: sha256,
      token_usage: z.number().nonnegative(),
      cost: z.number().nonnegative(),
      last_activity_at: z.string().datetime(),
      outcome: z.enum(["success", "failure", "unavailable"]),
      activity_duration_ms: z.number().int().nonnegative().nullable(),
      revision_equality: z
        .object({
          installed: sha256,
          expected: sha256,
          task_binding: sha256,
          workflow_binding: sha256,
          runtime_snapshot: sha256,
        })
        .strict(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.run_evidence_resource.sha256 !== value.run_evidence_sha256)
        context.addIssue({
          code: "custom",
          path: ["run_evidence_sha256"],
          message: "run evidence digest must equal the exact immutable JSON resource",
        })
      const revisions = Object.values(value.revision_equality)
      if (!revisions.every((revision) => revision === revisions[0]))
        context.addIssue({
          code: "custom",
          path: ["revision_equality"],
          message: "all run revision identities must be exactly equal",
        })
    }),
  "evolution-lab/evaluation-result": z
    .object({
      case_id: portableIdentity,
      arm: z.enum(["baseline", "candidate"]),
      repetition: z.number().int().nonnegative(),
      scorers: z.array(metricScorerResult).min(1),
      trial_task_id: z.string().min(1),
      trial_revision_digest: sha256,
      campaign_spec_locator: ArtifactReadLocatorSchema,
      candidate_revision_locator: ArtifactReadLocatorSchema.nullable(),
      run_evidence_locator: ArtifactReadLocatorSchema,
      metric_receipt_resource: taskArtifactResourceIdentity,
    })
    .strict(),
  "evolution-lab/integrity-review": z
    .object({
      case_id: portableIdentity,
      arm: z.enum(["baseline", "candidate"]),
      repetition: z.number().int().nonnegative(),
      evaluation_result_locator: ArtifactReadLocatorSchema,
      status: z.enum(["reviewed", "unavailable"]),
      findings: z.array(
        z
          .object({
            category: z.enum(["evidence_integrity", "reward_hacking", "permission", "side_effect", "security"]),
            invariant: z.string().min(1),
            outcome: z.enum(["passed", "failed", "unavailable"]),
            evidence,
            severity: z.enum(["info", "warning", "blocker"]),
            owner: z.string().min(1),
            correction: z.string().min(1).nullable(),
          })
          .strict(),
      ),
      accepted_limitations: z.array(z.string().min(1)),
      unknowns,
    })
    .strict(),
  "evolution-lab/comparison-recommendation": z
    .object({
      baseline_revision: exactRevision,
      candidate_revision: exactRevision,
      paired_deltas: z.array(
        z
          .object({
            scorer_id: portableIdentity,
            mean: z.number(),
            median: z.number(),
            variance: z.number().nonnegative(),
            confidence_interval: z
              .object({ confidence: z.number().positive().max(1), lower: z.number(), upper: z.number() })
              .strict()
              .refine(
                (interval) => interval.lower <= interval.upper,
                "confidence interval lower must not exceed upper",
              ),
            win_tie_loss: z
              .object({
                wins: z.number().int().nonnegative(),
                ties: z.number().int().nonnegative(),
                losses: z.number().int().nonnegative(),
              })
              .strict(),
          })
          .strict(),
      ),
      cost_delta: z.number().nullable(),
      token_delta: z.number().nullable(),
      activity_duration_ms_delta: z.number().nullable(),
      outcome_rates: z
        .object({
          baseline: z.object({ failure: z.number().min(0).max(1), unavailable: z.number().min(0).max(1) }).strict(),
          candidate: z.object({ failure: z.number().min(0).max(1), unavailable: z.number().min(0).max(1) }).strict(),
        })
        .strict(),
      aggregate_score: z.number().nullable(),
      /**
       * Interval around `aggregate_score` on the same normalized scale. The
       * promotion rule is decided on these bounds rather than on the point
       * estimate, so publishing them is what makes the recommendation
       * reproducible from the artifact alone.
       */
      aggregate_interval: z
        .object({ confidence: z.number().positive().max(1), lower: z.number(), upper: z.number() })
        .strict()
        .refine((interval) => interval.lower <= interval.upper, "confidence interval lower must not exceed upper")
        .nullable(),
      regressions: z.array(z.string().min(1)),
      unavailable_dimensions: z.array(z.string().min(1)),
      required_unavailable_dimensions: z.array(z.string().min(1)),
      unknowns,
      visual_review: z.object({ status: z.enum(["reviewed", "not_applicable", "unavailable"]), evidence }).strict(),
      reward_hacking_review: z.object({ findings: z.array(z.string().min(1)), evidence }).strict(),
      confidence: z.enum(["high", "medium", "low"]),
      recommendation: z.enum(["promote", "retain", "inconclusive"]),
    })
    .strict()
    .superRefine((value, context) => {
      if (new Set(value.paired_deltas.map((delta) => delta.scorer_id)).size !== value.paired_deltas.length)
        context.addIssue({
          code: "custom",
          path: ["paired_deltas"],
          message: "comparison scorer identifiers must be unique",
        })
      if (value.required_unavailable_dimensions.length > 0 && value.aggregate_score !== null)
        context.addIssue({
          code: "custom",
          path: ["aggregate_score"],
          message: "aggregate score must be null when a required dimension is unavailable",
        })
      // The reverse pairing is deliberately not required: a campaign whose
      // scorers were each measured once still has a legitimate point estimate,
      // but supports no interval around it. That asymmetry is the signal the
      // recommendation reads — no interval means it cannot promote.
      if (value.aggregate_score === null && value.aggregate_interval !== null)
        context.addIssue({
          code: "custom",
          path: ["aggregate_interval"],
          message: "aggregate interval must be null when aggregate score is null",
        })
      if (
        value.aggregate_interval &&
        value.aggregate_score !== null &&
        (value.aggregate_score < value.aggregate_interval.lower ||
          value.aggregate_score > value.aggregate_interval.upper)
      )
        context.addIssue({
          code: "custom",
          path: ["aggregate_interval"],
          message: "aggregate score must lie inside its own interval",
        })
      if (value.required_unavailable_dimensions.length > 0 && value.recommendation !== "inconclusive")
        context.addIssue({
          code: "custom",
          path: ["recommendation"],
          message: "required unavailable dimensions force an inconclusive recommendation",
        })
      if (value.required_unavailable_dimensions.some((dimension) => !value.unavailable_dimensions.includes(dimension)))
        context.addIssue({
          code: "custom",
          path: ["required_unavailable_dimensions"],
          message: "required unavailable dimensions must be included in all unavailable dimensions",
        })
    }),
  "evolution-lab/promotion-receipt": EvolutionPromotionReceiptSchema,
} as const

export type EvolutionArtifactType = keyof typeof EvolutionArtifactSchemas

export const EvolutionArtifactTypeSchema = z.enum(
  Object.keys(EvolutionArtifactSchemas) as [EvolutionArtifactType, ...EvolutionArtifactType[]],
)

export const EvolutionPackagePublishableArtifactTypeSchema = z.enum(
  Object.keys(EvolutionArtifactSchemas).filter((type) => type !== "evolution-lab/promotion-receipt") as [
    Exclude<EvolutionArtifactType, "evolution-lab/promotion-receipt">,
    ...Array<Exclude<EvolutionArtifactType, "evolution-lab/promotion-receipt">>,
  ],
)

export const EvolutionPackagePublishableArtifactInputSchema = z.discriminatedUnion("artifact_type", [
  z.object({
    artifact_type: z.literal("evolution-lab/opportunity"),
    payload: EvolutionArtifactSchemas["evolution-lab/opportunity"],
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/failure-attribution"),
    payload: EvolutionArtifactSchemas["evolution-lab/failure-attribution"],
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/campaign-spec"),
    payload: EvolutionCampaignPublishInputSchema,
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/candidate-revision"),
    payload: EvolutionCandidateRevisionPublishInputSchema,
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/run-evidence-bundle"),
    payload: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"],
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/evaluation-result"),
    payload: EvolutionEvaluationResultPublishInputSchema,
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/integrity-review"),
    payload: EvolutionArtifactSchemas["evolution-lab/integrity-review"],
  }),
  z.object({
    artifact_type: z.literal("evolution-lab/comparison-recommendation"),
    payload: EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"],
  }),
])

export function parseEvolutionArtifact(type: EvolutionArtifactType, payload: unknown) {
  return EvolutionArtifactSchemas[type].parse(payload)
}

/**
 * Artifact-type namespaces whose members must be published by their own typed
 * publisher rather than the generic catalog tool. Derived from the schemas
 * above so the Host does not restate a package's namespace as a string
 * literal — it asks the ABI that owns it.
 */
export const PACKAGE_OWNED_ARTIFACT_TYPE_NAMESPACES: readonly string[] = Object.freeze([
  ...new Set(Object.keys(EvolutionArtifactSchemas).map((artifactType) => `${artifactType.split("/")[0]}/`)),
])
