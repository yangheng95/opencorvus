import { createHash } from "node:crypto"
import { z } from "zod"
import { ArtifactProducerSchema, ArtifactSHA256Schema } from "./artifact-producer"
import { ArtifactReadLocatorSchema, EngineArtifactLocatorSchema } from "./artifact-catalog"
import {
  canonicalEvolutionJSON,
  EvolutionExactRevisionSchema,
  EvolutionInstallableTargetSchema,
  EvolutionPromotionReceiptSchema,
} from "./expert-squad-evolution"
import { EvolutionArtifactSchemas, EvolutionArtifactTypeSchema } from "./expert-squad-evolution-artifact"
import { TaskArtifactPortableSegmentSchema } from "./task-artifact"

const CampaignSchema = EvolutionArtifactSchemas["evolution-lab/campaign-spec"]
const ComparisonSchema = EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"]

export const EvolutionComparisonContextSchema = z
  .object({
    context_sha256: ArtifactSHA256Schema,
    dataset_partition: z.enum(["development", "holdout", "certification"]),
    dataset_digest: ArtifactSHA256Schema,
    case_ids: z.array(TaskArtifactPortableSegmentSchema).min(1),
    scorer_digests: z.array(ArtifactSHA256Schema).min(1),
    model: z.string().min(1),
    model_configuration_digest: ArtifactSHA256Schema,
    environment_digest: ArtifactSHA256Schema,
    workspace_digest: ArtifactSHA256Schema,
    permission_snapshot_digest: ArtifactSHA256Schema,
    external_side_effect_policy: z.string().min(1),
    repetitions: z.number().int().positive(),
    arm_order: z.tuple([z.enum(["baseline", "candidate"]), z.enum(["baseline", "candidate"])]),
    statistics: z.string().min(1),
    budget: z.object({ max_runs: z.number().int().positive(), max_cost: z.number().nonnegative() }).strict(),
    inactivity_timeout_ms: z.number().int().positive(),
    ui_rubric_digest: ArtifactSHA256Schema.nullable(),
  })
  .strict()

export type EvolutionComparisonContext = z.infer<typeof EvolutionComparisonContextSchema>

export function evolutionComparisonContext(rawCampaign: unknown): EvolutionComparisonContext {
  const campaign = CampaignSchema.parse(rawCampaign)
  const identity = {
    dataset_partition: campaign.dataset_partition,
    dataset_digest: campaign.dataset_digest,
    case_ids: campaign.cases,
    scorer_digests: campaign.scorer_digests,
    model: campaign.model,
    model_configuration_digest: campaign.model_configuration_digest,
    environment_digest: campaign.environment_digest,
    workspace_digest: campaign.workspace_digest,
    permission_snapshot_digest: campaign.permission_snapshot_digest,
    external_side_effect_policy: campaign.external_side_effect_policy,
    repetitions: campaign.repetitions,
    arm_order: campaign.arm_order as ["baseline" | "candidate", "baseline" | "candidate"],
    statistics: campaign.statistics,
    budget: campaign.budget,
    inactivity_timeout_ms: campaign.inactivity_timeout_ms,
    ui_rubric_digest: campaign.ui_rubric_digest,
  }
  return EvolutionComparisonContextSchema.parse({
    context_sha256: createHash("sha256").update(canonicalEvolutionJSON(identity)).digest("hex"),
    ...identity,
  })
}

export const EvolutionHistoryAuthoritySchema = z
  .object({
    project_id: z.string().min(1),
    project_directory: z.string().min(1),
    target: EvolutionInstallableTargetSchema,
    installed_revision: EvolutionExactRevisionSchema,
  })
  .strict()

export const EvolutionHistoryArtifactIdentitySchema = z
  .object({
    task_id: z.string().min(1),
    root_session_id: z.string().min(1),
    locator: EngineArtifactLocatorSchema,
    artifact_type: EvolutionArtifactTypeSchema,
    schema_version: z.literal(1),
    producer: ArtifactProducerSchema,
    time_created: z.number().int().nonnegative(),
    time_updated: z.number().int().nonnegative(),
    partition: z.enum(["current", "historical"]),
  })
  .strict()

export const EvolutionEvidenceCompletenessSchema = z
  .object({
    expected_slots: z.number().int().nonnegative(),
    present_runs: z.number().int().nonnegative(),
    present_evaluations: z.number().int().nonnegative(),
    expected_scorer_results: z.number().int().nonnegative(),
    measured_scorer_results: z.number().int().nonnegative(),
    unavailable_scorer_results: z.number().int().nonnegative(),
    reviewed_integrity_slots: z.number().int().nonnegative(),
    required_unavailable_dimensions: z.array(z.string().min(1)),
  })
  .strict()

export const EvolutionGraphIssueSchema = z.discriminatedUnion("code", [
  z
    .object({
      code: z.literal("MISSING_EXACT_SOURCE"),
      owner: EvolutionHistoryArtifactIdentitySchema,
      missing_locator: EngineArtifactLocatorSchema,
    })
    .strict(),
  z
    .object({
      code: z.literal("INVALID_ARTIFACT_PAYLOAD"),
      artifact: EvolutionHistoryArtifactIdentitySchema,
      diagnostic: z.string().min(1),
    })
    .strict(),
  z
    .object({
      code: z.literal("REVISION_IDENTITY_MISMATCH"),
      owner: EvolutionHistoryArtifactIdentitySchema,
      related_locators: z.array(EngineArtifactLocatorSchema).min(1),
      diagnostic: z.string().min(1),
    })
    .strict(),
  z
    .object({
      code: z.literal("RECEIPT_EVIDENCE_MISMATCH"),
      receipt: EvolutionHistoryArtifactIdentitySchema,
      evidence: z.array(ArtifactReadLocatorSchema),
      diagnostic: z.string().min(1),
    })
    .strict(),
])

export const EvolutionUnlinkedIssueSchema = z.discriminatedUnion("code", [
  z
    .object({
      code: z.literal("UNLINKED_INVALID_ARTIFACT"),
      task_id: z.string().min(1),
      root_session_id: z.string().min(1),
      locator: EngineArtifactLocatorSchema,
      catalog_artifact_type: EvolutionArtifactTypeSchema,
      diagnostic: z.string().min(1),
    })
    .strict(),
  z
    .object({
      code: z.literal("UNLINKED_EVOLUTION_ARTIFACT"),
      artifact: EvolutionHistoryArtifactIdentitySchema,
      diagnostic: z.string().min(1),
    })
    .strict(),
])

const PromotionIntentSchema = z
  .object({
    operation: z.literal("promotion"),
    confirmation_text: z.string().min(1),
    request: z
      .object({
        operation: z.literal("promotion"),
        campaignSpecLocator: EngineArtifactLocatorSchema,
        candidateRevisionLocator: EngineArtifactLocatorSchema,
        comparisonResultLocator: EngineArtifactLocatorSchema,
        expectedCurrentPackageDigest: ArtifactSHA256Schema,
      })
      .strict(),
  })
  .strict()

const RestorationIntentSchema = z
  .object({
    operation: z.literal("restoration"),
    confirmation_text: z.string().min(1),
    request: z
      .object({
        operation: z.literal("restoration"),
        priorReceiptLocator: EngineArtifactLocatorSchema,
        restorePackageDigest: ArtifactSHA256Schema,
        expectedCurrentPackageDigest: ArtifactSHA256Schema,
      })
      .strict(),
  })
  .strict()

export const EvolutionHistoryReceiptSchema = z
  .object({
    artifact: EvolutionHistoryArtifactIdentitySchema,
    receipt: EvolutionPromotionReceiptSchema,
  })
  .strict()

export const EvolutionHistoryComparisonSchema = z
  .object({
    artifact: EvolutionHistoryArtifactIdentitySchema,
    baseline_revision: EvolutionExactRevisionSchema,
    candidate_revision: EvolutionExactRevisionSchema,
    paired_deltas: ComparisonSchema.shape.paired_deltas,
    cost_delta: z.number().nullable(),
    token_delta: z.number().nullable(),
    activity_duration_ms_delta: z.number().nullable(),
    outcome_rates: ComparisonSchema.shape.outcome_rates,
    aggregate_score: z.number().nullable(),
    regressions: z.array(z.string().min(1)),
    unavailable_dimensions: z.array(z.string().min(1)),
    required_unavailable_dimensions: z.array(z.string().min(1)),
    unknowns: ComparisonSchema.shape.unknowns,
    visual_review: ComparisonSchema.shape.visual_review,
    reward_hacking_review: ComparisonSchema.shape.reward_hacking_review,
    confidence: z.enum(["high", "medium", "low"]),
    recommendation: z.enum(["promote", "retain", "inconclusive"]),
    completeness: EvolutionEvidenceCompletenessSchema,
    receipts: z.array(EvolutionHistoryReceiptSchema),
    promotion_intent: PromotionIntentSchema.nullable(),
    restoration_intents: z.array(RestorationIntentSchema),
    graph_issues: z.array(EvolutionGraphIssueSchema),
  })
  .strict()

export const EvolutionHistoryCandidateSchema = z
  .object({
    artifact: EvolutionHistoryArtifactIdentitySchema,
    parent_revision: EvolutionExactRevisionSchema,
    candidate_revision: EvolutionExactRevisionSchema,
    hypothesis: z.string().min(1),
    changed_paths: z.array(z.string().min(1)).min(1),
    diff_sha256: ArtifactSHA256Schema,
    comparisons: z.array(EvolutionHistoryComparisonSchema),
    runs: z.array(EvolutionHistoryArtifactIdentitySchema),
    evaluations: z.array(EvolutionHistoryArtifactIdentitySchema),
    related_artifacts: z.array(EvolutionHistoryArtifactIdentitySchema),
    graph_issues: z.array(EvolutionGraphIssueSchema),
  })
  .strict()

export const EvolutionCampaignHistoryRecordSchema = z
  .object({
    campaign: z
      .object({
        artifact: EvolutionHistoryArtifactIdentitySchema,
        target: EvolutionInstallableTargetSchema,
        baseline_revision: EvolutionExactRevisionSchema,
        candidate_hypothesis: z.string().min(1),
        trial_execution: z.discriminatedUnion("status", [
          z.object({ status: z.literal("available"), installation_scope: z.enum(["project", "global"]) }).strict(),
          z.object({ status: z.literal("unavailable"), reason_code: z.literal("product_release_required") }).strict(),
        ]),
      })
      .strict(),
    context: EvolutionComparisonContextSchema,
    related_artifacts: z.array(EvolutionHistoryArtifactIdentitySchema),
    candidates: z.array(EvolutionHistoryCandidateSchema),
    graph_issues: z.array(EvolutionGraphIssueSchema),
  })
  .strict()

const HistoryCursorSchema = z
  .object({
    catalog_revision_upper: z.number().int().nonnegative(),
    before_catalog_revision: z.number().int().positive(),
  })
  .strict()

export const EvolutionHistoryListQuerySchema = z
  .object({
    directory: z.string().min(1).optional(),
    namespace: z.string().min(1),
    id: z.string().min(1),
    installationScope: z.enum(["project", "global"]),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    catalogRevisionUpper: z.coerce.number().int().nonnegative().optional(),
    beforeCatalogRevision: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.catalogRevisionUpper === undefined) !== (value.beforeCatalogRevision === undefined))
      context.addIssue({
        code: "custom",
        path: ["catalogRevisionUpper"],
        message: "history cursor requires both catalogRevisionUpper and beforeCatalogRevision",
      })
  })

export const EvolutionHistoryListResponseSchema = z
  .object({
    authority: EvolutionHistoryAuthoritySchema,
    catalog_revision_upper: z.number().int().nonnegative(),
    records: z.array(EvolutionCampaignHistoryRecordSchema),
    integrity_issues: z.array(EvolutionUnlinkedIssueSchema),
    next_cursor: HistoryCursorSchema.nullable(),
  })
  .strict()

const ScorerSlotSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("measured"),
      scorer_id: TaskArtifactPortableSegmentSchema,
      value: z.number(),
      evidence: z.array(ArtifactReadLocatorSchema),
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      scorer_id: TaskArtifactPortableSegmentSchema,
      reason: z.string().min(1),
      evidence: z.array(ArtifactReadLocatorSchema),
    })
    .strict(),
  z.object({ status: z.literal("missing"), scorer_id: TaskArtifactPortableSegmentSchema }).strict(),
])

export const EvolutionEvidenceSlotSchema = z
  .object({
    case_id: TaskArtifactPortableSegmentSchema,
    arm: z.enum(["baseline", "candidate"]),
    repetition: z.number().int().nonnegative(),
    expected_revision_digest: ArtifactSHA256Schema,
    run: EvolutionHistoryArtifactIdentitySchema.nullable(),
    evaluation: EvolutionHistoryArtifactIdentitySchema.nullable(),
    review: EvolutionHistoryArtifactIdentitySchema.nullable(),
    scorer_results: z.array(ScorerSlotSchema),
    integrity_review: EvolutionArtifactSchemas["evolution-lab/integrity-review"].nullable(),
  })
  .strict()

export const EvolutionCampaignDetailResponseSchema = z
  .object({
    authority: EvolutionHistoryAuthoritySchema,
    catalog_revision_upper: z.number().int().nonnegative(),
    record: EvolutionCampaignHistoryRecordSchema,
    selected_candidate_locator: EngineArtifactLocatorSchema,
    selected_comparison_locator: EngineArtifactLocatorSchema,
    slots: z.array(EvolutionEvidenceSlotSchema),
    integrity_issues: z.array(EvolutionUnlinkedIssueSchema),
  })
  .strict()

export const EvolutionCampaignDetailRequestSchema = z
  .object({
    namespace: z.string().min(1),
    id: z.string().min(1),
    installationScope: z.enum(["project", "global"]),
    campaignTaskID: z.string().min(1),
    campaignLocator: EngineArtifactLocatorSchema,
    candidateLocator: EngineArtifactLocatorSchema,
    comparisonLocator: EngineArtifactLocatorSchema,
    catalogRevisionUpper: z.number().int().nonnegative(),
  })
  .strict()

export type EvolutionCampaignHistoryRecord = z.infer<typeof EvolutionCampaignHistoryRecordSchema>
export type EvolutionHistoryListResponse = z.infer<typeof EvolutionHistoryListResponseSchema>
export type EvolutionCampaignDetailResponse = z.infer<typeof EvolutionCampaignDetailResponseSchema>
