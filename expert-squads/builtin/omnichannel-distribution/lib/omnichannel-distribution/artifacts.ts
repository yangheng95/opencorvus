// ABI means Application Binary Interface. UTM means Urchin Tracking Module. URL means Uniform Resource Locator.

import { tool } from "@opencorvus-ai/plugin"

export const OMNICHANNEL_WORKFLOW_ID = "omnichannel-delivery-pack"
export const OMNICHANNEL_SCHEMA_VERSION = 1

const nonempty = tool.schema.string().trim().min(1)
const distinctNonempty = tool.schema.array(nonempty).refine((values) => new Set(values).size === values.length, "values must be unique")
const urlList = tool.schema.array(tool.schema.string().trim().url())

const CampaignBriefSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), campaign_name: nonempty, source_summary: nonempty, objective: nonempty, audience: nonempty, target_channels: distinctNonempty.min(2), constraints: distinctNonempty }).strict()
const ChannelSpecSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), captured_at: nonempty, channels: tool.schema.array(tool.schema.object({ channel: nonempty, format: nonempty, character_limit: tool.schema.number().int().positive().nullable(), required_fields: distinctNonempty.min(1), evidence_urls: urlList.min(1) }).strict()).min(2), unknowns: distinctNonempty }).strict()
const ComplianceSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), rights_status: tool.schema.array(tool.schema.object({ asset_or_claim: nonempty, status: tool.schema.enum(["cleared", "approval-required", "restricted"]), rationale: nonempty }).strict()).min(1), required_disclosures: distinctNonempty, approval_requirements: distinctNonempty, jurisdiction_notes: distinctNonempty }).strict()
const ChannelPackSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), versions: tool.schema.array(tool.schema.object({ channel: nonempty, headline: nonempty, body: nonempty, call_to_action: nonempty, asset_roles: distinctNonempty, disclosures: distinctNonempty }).strict()).min(2), source_claim_map: tool.schema.array(tool.schema.object({ claim: nonempty, source_urls: urlList.min(1) }).strict()), adaptation_notes: distinctNonempty }).strict()
const MeasurementPlanSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), channel_metrics: tool.schema.array(tool.schema.object({ channel: nonempty, primary_metric: nonempty, supporting_metrics: distinctNonempty, observation_window: nonempty }).strict()).min(2), utm_naming: nonempty, attribution_caveats: distinctNonempty.min(1), reporting_cadence: nonempty }).strict()
const DistributionPlanSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), launch_order: distinctNonempty.min(2), schedule_slots: tool.schema.array(tool.schema.object({ channel: nonempty, timing: nonempty, rationale: nonempty }).strict()).min(2), channel_package_count: tool.schema.number().int().positive(), measurement_checkpoints: distinctNonempty.min(1), unresolved_blockers: distinctNonempty, external_posting: tool.schema.literal("not-performed") }).strict()
const ReadinessReviewSchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), verdict: tool.schema.enum(["ready", "revision-required"]), checks: tool.schema.array(tool.schema.object({ area: nonempty, result: tool.schema.enum(["pass", "revise"]), finding: nonempty, correction: nonempty.nullable() }).strict()).min(1), required_corrections: distinctNonempty, accepted_limitations: distinctNonempty, external_posting_boundary: tool.schema.literal("prepared-and-validated-only") }).strict()
const DeliverySchema = tool.schema.object({ workflow_id: tool.schema.literal(OMNICHANNEL_WORKFLOW_ID), campaign_name: nonempty, canonical_manifest_path: nonempty, canonical_schedule_path: nonempty, channel_directories: distinctNonempty.min(2), channel_count: tool.schema.number().int().positive(), review_resolution: distinctNonempty, publish_mode: tool.schema.literal("prepared-not-posted") }).strict()

export const OmnichannelArtifactSchemas = {
  "omnichannel-distribution/campaign-brief": CampaignBriefSchema,
  "omnichannel-distribution/channel-spec-dossier": ChannelSpecSchema,
  "omnichannel-distribution/rights-compliance-matrix": ComplianceSchema,
  "omnichannel-distribution/channel-pack": ChannelPackSchema,
  "omnichannel-distribution/measurement-plan": MeasurementPlanSchema,
  "omnichannel-distribution/distribution-plan": DistributionPlanSchema,
  "omnichannel-distribution/readiness-review": ReadinessReviewSchema,
  "omnichannel-distribution/delivery": DeliverySchema,
} as const

export const OmnichannelArtifactTypeSchema = tool.schema.enum(Object.keys(OmnichannelArtifactSchemas) as [keyof typeof OmnichannelArtifactSchemas, ...(keyof typeof OmnichannelArtifactSchemas)[]])
export type OmnichannelArtifactType = tool.schema.infer<typeof OmnichannelArtifactTypeSchema>
export const OmnichannelPublishableArtifactInputSchema = tool.schema.discriminatedUnion("artifact_type", [
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/campaign-brief"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/campaign-brief"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/channel-spec-dossier"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/channel-spec-dossier"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/rights-compliance-matrix"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/rights-compliance-matrix"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/channel-pack"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/channel-pack"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/measurement-plan"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/measurement-plan"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/distribution-plan"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/distribution-plan"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/readiness-review"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/readiness-review"] }).strict(),
  tool.schema.object({ artifact_type: tool.schema.literal("omnichannel-distribution/delivery"), payload: OmnichannelArtifactSchemas["omnichannel-distribution/delivery"] }).strict(),
])
export function parseOmnichannelArtifact(type: OmnichannelArtifactType, payload: unknown) { return OmnichannelArtifactSchemas[type].parse(payload) }
