export {
  EvolutionArtifactSchemas,
  EvolutionArtifactTypeSchema,
  EvolutionCampaignPublishInputSchema,
  EvolutionMetricReceiptSchema,
  EvolutionPackagePublishableArtifactInputSchema,
  EvolutionPackagePublishableArtifactTypeSchema,
  parseEvolutionArtifact,
  type EvolutionArtifactType,
} from "@opencorvus-ai/plugin"

export class EvolutionArtifactIntegrityError extends Error {
  override readonly name = "EvolutionArtifactIntegrityError"
}

export class EvolutionTrialUnavailableError extends Error {
  override readonly name = "EvolutionTrialUnavailableError"
}

export class EvolutionMetricIdentityError extends Error {
  override readonly name = "EvolutionMetricIdentityError"
}
