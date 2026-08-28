import z from "zod"
import {
  canonicalEvolutionJSON,
  EngineArtifactEnvelopeSchema,
  EvolutionExactRevisionSchema,
  EvolutionInstallableTargetSchema,
  EvolutionMutationIntentRequestSchema,
  EvolutionPromotionReceiptSchema,
  type EngineArtifactLocator,
  type EvolutionMutationIntentRequest,
} from "@opencorvus-ai/plugin"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import { Instance } from "@/project/instance"
import { FEEDBACK_REVISION_COMPONENT_ID } from "./feedback-revision"

export const EVOLUTION_LAB_EXPERT_SQUAD_ID = "evolution-lab"

const CampaignMutationFactsSchema = z.object({
  target: EvolutionInstallableTargetSchema,
  baseline_revision: EvolutionExactRevisionSchema,
})
const CandidateMutationFactsSchema = z.object({
  parent_revision: EvolutionExactRevisionSchema,
  candidate_revision: EvolutionExactRevisionSchema,
})
const FeedbackCandidateMutationFactsSchema = CandidateMutationFactsSchema.extend({
  feedback: z.string().min(1).nullable(),
})
const ComparisonMutationFactsSchema = z.object({
  baseline_revision: EvolutionExactRevisionSchema,
  candidate_revision: EvolutionExactRevisionSchema,
  required_unavailable_dimensions: z.array(z.string()),
  recommendation: z.enum(["promote", "retain", "inconclusive"]),
})

/**
 * The installable target of a revision that has no Campaign to declare one.
 *
 * A built-in package is installed into the current Project, which is the only
 * scope a feedback revision can reach: promoting into the built-in set would
 * change bytes the published registry already pins.
 */
function installableTargetForRevision(revision: z.infer<typeof EvolutionExactRevisionSchema>) {
  return EvolutionInstallableTargetSchema.parse({
    scope: "project",
    project_id: Instance.project.id,
    project_directory: Instance.project.worktree,
    namespace: revision.namespace,
    id: revision.id,
  })
}

type ExactArtifact = ReturnType<typeof requireEngineArtifactByLocator> & {
  envelope: z.infer<typeof EngineArtifactEnvelopeSchema>
}

function sameRevision(left: z.infer<typeof EvolutionExactRevisionSchema>, right: z.infer<typeof EvolutionExactRevisionSchema>) {
  return canonicalEvolutionJSON(left) === canonicalEvolutionJSON(right)
}

function exactArtifact(input: {
  taskID: string
  locator: EngineArtifactLocator
  artifactType: string
  /**
   * The Core component that must have authored this Artifact, when the Host
   * authored it itself rather than projecting Evolution Lab.
   */
  coreComponentID?: string
}): ExactArtifact {
  const row = requireEngineArtifactByLocator({ taskID: input.taskID, locator: input.locator })
  const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
  if (envelope.artifact_type !== input.artifactType || envelope.schema_version !== 1)
    throw new Error(`Evolution mutation locator must identify ${input.artifactType}@1`)
  const producer = envelope.producer
  if (input.coreComponentID !== undefined) {
    if (producer.owner_kind !== "core" || producer.component_id !== input.coreComponentID)
      throw new Error(
        `Evolution mutation evidence ${input.artifactType} must be produced by Core ${input.coreComponentID}`,
      )
  } else if (input.artifactType !== "evolution-lab/promotion-receipt") {
    if (producer.owner_kind !== "projected-scheduler" && producer.owner_kind !== "projected-worker")
      throw new Error(`Evolution mutation evidence ${input.artifactType} must be produced by Evolution Lab`)
    if (producer.expert_squad_id !== EVOLUTION_LAB_EXPERT_SQUAD_ID)
      throw new Error(`Evolution mutation evidence ${input.artifactType} must be produced by Evolution Lab`)
  }
  return Object.assign(row, { envelope })
}

function sourceIncludes(envelope: z.infer<typeof EngineArtifactEnvelopeSchema>, locator: unknown) {
  return envelope.source_artifact_locators.some((source) => canonicalEvolutionJSON(source) === canonicalEvolutionJSON(locator))
}

export type PreparedEvolutionMutation =
  | {
      operation: "promotion"
      intent: Extract<EvolutionMutationIntentRequest, { operation: "promotion" }>
      target: z.infer<typeof EvolutionInstallableTargetSchema>
      beforeDigest: string
      afterDigest: string
      evidence: EngineArtifactLocator[]
    }
  | {
      operation: "restoration"
      intent: Extract<EvolutionMutationIntentRequest, { operation: "restoration" }>
      target: z.infer<typeof EvolutionInstallableTargetSchema>
      beforeDigest: string
      afterDigest: string
      evidence: EngineArtifactLocator[]
    }
  | {
      operation: "feedback_revision"
      intent: Extract<EvolutionMutationIntentRequest, { operation: "feedback_revision" }>
      target: z.infer<typeof EvolutionInstallableTargetSchema>
      feedback: string
      beforeDigest: string
      afterDigest: string
      evidence: EngineArtifactLocator[]
    }

export function prepareEvolutionPackageMutation(input: {
  taskID: string
  intent: EvolutionMutationIntentRequest
}): PreparedEvolutionMutation {
  const intent = EvolutionMutationIntentRequestSchema.parse(input.intent)
  if (intent.operation === "promotion") {
    const campaignArtifact = exactArtifact({
      taskID: input.taskID,
      locator: intent.campaignSpecLocator,
      artifactType: "evolution-lab/campaign-spec",
    })
    const candidateArtifact = exactArtifact({
      taskID: input.taskID,
      locator: intent.candidateRevisionLocator,
      artifactType: "evolution-lab/candidate-revision",
    })
    const comparisonArtifact = exactArtifact({
      taskID: input.taskID,
      locator: intent.comparisonResultLocator,
      artifactType: "evolution-lab/comparison-recommendation",
    })
    if (
      !sourceIncludes(comparisonArtifact.envelope, intent.campaignSpecLocator) ||
      !sourceIncludes(comparisonArtifact.envelope, intent.candidateRevisionLocator)
    )
      throw new Error("Evolution comparison must directly source its exact Campaign and Candidate Artifacts")
    const campaign = CampaignMutationFactsSchema.parse(campaignArtifact.envelope.payload)
    const candidate = CandidateMutationFactsSchema.parse(candidateArtifact.envelope.payload)
    const comparison = ComparisonMutationFactsSchema.parse(comparisonArtifact.envelope.payload)
    if (
      !sameRevision(campaign.baseline_revision, candidate.parent_revision) ||
      !sameRevision(campaign.baseline_revision, comparison.baseline_revision) ||
      !sameRevision(candidate.candidate_revision, comparison.candidate_revision)
    )
      throw new Error("Evolution promotion evidence does not share one exact baseline and candidate revision pair")
    if (comparison.required_unavailable_dimensions.length > 0 || comparison.recommendation !== "promote")
      throw new Error(
        "Evolution promotion requires a complete deterministic promote recommendation. " +
          `received: ${JSON.stringify({
            recommendation: comparison.recommendation,
            required_unavailable_dimensions: comparison.required_unavailable_dimensions,
          })}, expected: ${JSON.stringify({ recommendation: "promote", required_unavailable_dimensions: [] })}.`,
      )
    if (intent.expectedCurrentPackageDigest !== campaign.baseline_revision.package_digest)
      throw new Error("Evolution promotion CAS digest must equal the frozen Campaign baseline")
    if (
      campaign.target.scope === "project" &&
      (campaign.target.project_id !== Instance.project.id || campaign.target.project_directory !== Instance.project.worktree)
    )
      throw new Error("Evolution project-scope target must equal the current exact Project")
    return {
      operation: "promotion",
      intent,
      target: campaign.target,
      beforeDigest: campaign.baseline_revision.package_digest,
      afterDigest: candidate.candidate_revision.package_digest,
      evidence: [intent.campaignSpecLocator, intent.candidateRevisionLocator, intent.comparisonResultLocator],
    }
  }

  if (intent.operation === "feedback_revision") {
    const candidateArtifact = exactArtifact({
      taskID: input.taskID,
      locator: intent.candidateRevisionLocator,
      artifactType: "evolution-lab/candidate-revision",
      coreComponentID: FEEDBACK_REVISION_COMPONENT_ID,
    })
    const candidate = FeedbackCandidateMutationFactsSchema.parse(candidateArtifact.envelope.payload)
    if (candidate.feedback === null)
      throw new Error("Evolution feedback revision requires a candidate authored from exact user feedback")
    if (intent.expectedCurrentPackageDigest !== candidate.parent_revision.package_digest)
      throw new Error("Evolution feedback revision CAS digest must equal the exact candidate parent revision")
    return {
      operation: "feedback_revision",
      intent,
      target: installableTargetForRevision(candidate.parent_revision),
      feedback: candidate.feedback,
      beforeDigest: candidate.parent_revision.package_digest,
      afterDigest: candidate.candidate_revision.package_digest,
      evidence: [intent.candidateRevisionLocator],
    }
  }

  const priorArtifact = exactArtifact({
    taskID: input.taskID,
    locator: intent.priorReceiptLocator,
    artifactType: "evolution-lab/promotion-receipt",
  })
  if (
    priorArtifact.envelope.producer.owner_kind !== "core" ||
    priorArtifact.envelope.producer.component_id !== "expert-squad-package-manager"
  )
    throw new Error("Evolution restoration requires a Core-owned prior mutation receipt")
  const priorReceipt = EvolutionPromotionReceiptSchema.parse(priorArtifact.envelope.payload)
  const witnessed = [priorReceipt.before_digest, priorReceipt.after_digest].filter(
    (digest): digest is string => typeof digest === "string",
  )
  if (!witnessed.includes(intent.restorePackageDigest))
    throw new Error(
      `Evolution restoration target must be a revision the cited receipt witnessed; expected one of ${witnessed.join(", ")}, received ${intent.restorePackageDigest}`,
    )
  if (intent.restorePackageDigest === intent.expectedCurrentPackageDigest)
    throw new Error(
      `Evolution restoration must change the installed revision; expected a digest other than ${intent.expectedCurrentPackageDigest}, received ${intent.restorePackageDigest}`,
    )
  return {
    operation: "restoration",
    intent,
    target: priorReceipt.target,
    beforeDigest: intent.expectedCurrentPackageDigest,
    afterDigest: intent.restorePackageDigest,
    evidence: [intent.priorReceiptLocator],
  }
}

export function evolutionMutationConfirmationText(input: {
  projectID: string
  target: z.infer<typeof EvolutionInstallableTargetSchema>
  beforeDigest: string
  afterDigest: string
  evidenceSHA256s: readonly string[]
  operation: "promotion" | "restoration" | "feedback_revision"
  /** Verbatim user feedback a feedback revision was authored from. */
  feedback?: string
}) {
  const verb = input.operation === "restoration" ? "恢复" : "提升"
  return [
    `确认将 project:${input.projectID} 的 ${input.target.namespace}/${input.target.id}`,
    `从 ${input.beforeDigest} ${verb}到 ${input.afterDigest}。`,
    ...(input.target.id === EVOLUTION_LAB_EXPERT_SQUAD_ID
      ? [`注意：该目标是进化机制自身，本次${verb}将改变后续每一次进化的证据校验与授权行为。`]
      : []),
    ...(input.feedback === undefined
      ? []
      : [`本次修订依据你的反馈撰写，未经过对照试验：`, input.feedback, `不满意可按本次回执撤回。`]),
    ...input.evidenceSHA256s.map((digest, index) => `证据${index + 1}：${digest}`),
  ].join("\n")
}
