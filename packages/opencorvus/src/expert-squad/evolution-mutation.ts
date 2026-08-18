import { createHash } from "node:crypto"
import z from "zod"
import {
  EngineArtifactEnvelopeSchema,
  canonicalEvolutionJSON,
  EvolutionExactRevisionSchema,
  EvolutionInstallableTargetSchema,
  EvolutionMutationAuthorizationRequestSchema,
  EvolutionMutationAuthorizationResultSchema,
  EvolutionMutationIntentRequestSchema,
  EvolutionMutationRequestSchema,
  EvolutionPromotionReceiptSchema,
  type EvolutionMutationAuthorizationRequest,
  type EvolutionMutationIntentRequest,
  type EvolutionMutationRequest,
  type EvolutionPromotionReceipt,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { exactEngineArtifactLocator, requireEngineArtifactByLocator } from "@/artifact-catalog"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Instance } from "@/project/instance"
import { EngineService } from "@/task-api"
import { Database, eq } from "@/storage/db"
import { ExpertSquadPackageManager } from "./manager"
import {
  requireEvolutionMutationAuthorization,
  requireEvolutionMutationRootSession,
} from "./mutation-authorization"

export const EVOLUTION_LAB_EXPERT_SQUAD_ID = "evolution-lab"

const CampaignMutationFactsSchema = z.object({
  target: EvolutionInstallableTargetSchema,
  baseline_revision: EvolutionExactRevisionSchema,
})
const CandidateMutationFactsSchema = z.object({
  parent_revision: EvolutionExactRevisionSchema,
  candidate_revision: EvolutionExactRevisionSchema,
})
const ComparisonMutationFactsSchema = z.object({
  baseline_revision: EvolutionExactRevisionSchema,
  candidate_revision: EvolutionExactRevisionSchema,
  required_unavailable_dimensions: z.array(z.string()),
  recommendation: z.enum(["promote", "retain", "inconclusive"]),
})

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
}): ExactArtifact {
  const row = requireEngineArtifactByLocator({ taskID: input.taskID, locator: input.locator })
  const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
  if (envelope.artifact_type !== input.artifactType || envelope.schema_version !== 1)
    throw new Error(`Evolution mutation locator must identify ${input.artifactType}@1`)
  if (input.artifactType !== "evolution-lab/promotion-receipt") {
    const producer = envelope.producer
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

type PreparedEvolutionMutation =
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
      throw new Error("Evolution promotion requires a complete deterministic promote recommendation")
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
  if (
    intent.expectedCurrentPackageDigest !== priorReceipt.after_digest ||
    intent.restorePackageDigest !== priorReceipt.before_digest
  )
    throw new Error("Evolution restoration must exactly undo the selected prior mutation receipt")
  return {
    operation: "restoration",
    intent,
    target: priorReceipt.target,
    beforeDigest: intent.expectedCurrentPackageDigest,
    afterDigest: intent.restorePackageDigest,
    evidence: [intent.priorReceiptLocator],
  }
}

function preparedConfirmation(prepared: PreparedEvolutionMutation) {
  return evolutionMutationConfirmationText({
    projectID: Instance.project.id,
    target: prepared.target,
    beforeDigest: prepared.beforeDigest,
    afterDigest: prepared.afterDigest,
    evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
    operation: prepared.operation,
  })
}

export async function authorizeEvolutionPackageMutation(rawInput: EvolutionMutationAuthorizationRequest) {
  const input = EvolutionMutationAuthorizationRequestSchema.parse(rawInput)
  requireEvolutionMutationRootSession({
    projectID: Instance.project.id,
    taskID: input.taskID,
    sessionID: input.sessionID,
  })
  const prepared = prepareEvolutionPackageMutation({ taskID: input.taskID, intent: input.intent })
  const confirmationText = preparedConfirmation(prepared)
  if (input.confirmationText !== confirmationText)
    throw new Error("Evolution mutation authorization text does not equal the exact current evidence decision")
  const recorded = await EngineService.handleTaskMessage(input.taskID, {
    text: confirmationText,
    source: "expert_squad.evolution_authorization",
  })
  const persisted = recorded.user_message
  const verified = requireEvolutionMutationAuthorization({
    projectID: Instance.project.id,
    taskID: input.taskID,
    sessionID: input.sessionID,
    messageID: persisted.info.id,
    expectedText: confirmationText,
  })
  return EvolutionMutationAuthorizationResultSchema.parse({
    authorization: {
      taskID: input.taskID,
      sessionID: input.sessionID,
      messageID: persisted.info.id,
    },
    verified,
    confirmationText,
  })
}

export function evolutionMutationConfirmationText(input: {
  projectID: string
  target: z.infer<typeof EvolutionInstallableTargetSchema>
  beforeDigest: string
  afterDigest: string
  evidenceSHA256s: readonly string[]
  operation: "promotion" | "restoration"
}) {
  const verb = input.operation === "promotion" ? "提升" : "恢复"
  return [
    `确认将 project:${input.projectID} 的 ${input.target.namespace}/${input.target.id}`,
    `从 ${input.beforeDigest} ${verb}到 ${input.afterDigest}。`,
    ...(input.target.id === EVOLUTION_LAB_EXPERT_SQUAD_ID
      ? [`注意：该目标是进化机制自身，本次${verb}将改变后续每一次进化的证据校验与授权行为。`]
      : []),
    ...input.evidenceSHA256s.map((digest, index) => `证据${index + 1}：${digest}`),
  ].join("\n")
}

function receiptArtifactID(input: {
  operation: string
  authorizationMessageID: string
  authorizationMessageSHA256: string
  target: z.infer<typeof EvolutionInstallableTargetSchema>
  beforeDigest: string
  afterDigest: string
  evidenceSHA256s: readonly string[]
}) {
  return `art_evolution_mutation_${createHash("sha256").update(canonicalEvolutionJSON(input)).digest("hex")}`
}

function existingReceipt(input: { taskID: string; artifactID: string }) {
  const row = Database.use((db) => db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get())
  if (!row) return undefined
  if (row.task_id !== input.taskID || row.kind !== "expert_output")
    throw new Error("Evolution mutation receipt identity belongs to a foreign Artifact partition")
  const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
  if (
    envelope.artifact_type !== "evolution-lab/promotion-receipt" ||
    envelope.producer.owner_kind !== "core" ||
    envelope.producer.component_id !== "expert-squad-package-manager"
  )
    throw new Error("Evolution mutation receipt identity collision")
  return EvolutionPromotionReceiptSchema.parse(envelope.payload)
}

function persistReceipt(input: {
  taskID: string
  artifactID: string
  operationID: string
  receipt: EvolutionPromotionReceipt
}) {
  const envelope = EngineArtifactEnvelopeSchema.parse({
    artifact_type: "evolution-lab/promotion-receipt",
    schema_version: 1,
    producer: {
      owner_kind: "core",
      component_id: "expert-squad-package-manager",
      operation_id: input.operationID,
    },
    payload: input.receipt,
    resources: [],
    observed_artifact_locators: input.receipt.evidence,
    source_artifact_locators: input.receipt.evidence,
  })
  Database.transaction((db) => {
    const current = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get()
    if (current) {
      if (canonicalEvolutionJSON(EngineArtifactEnvelopeSchema.parse(current.payload)) !== canonicalEvolutionJSON(envelope))
        throw new Error("Evolution mutation receipt identity collision")
      return
    }
    insertEngineArtifact(db, {
      id: input.artifactID,
      taskID: input.taskID,
      kind: "expert_output",
      label: `evolution-lab/${input.receipt.operation}-receipt`,
      payload: envelope,
    })
  })
}

export async function executeEvolutionPackageMutation(rawInput: EvolutionMutationRequest) {
  const input = EvolutionMutationRequestSchema.parse(rawInput)
  const intent = EvolutionMutationIntentRequestSchema.parse(
    input.operation === "promotion"
      ? {
          operation: input.operation,
          campaignSpecLocator: input.campaignSpecLocator,
          candidateRevisionLocator: input.candidateRevisionLocator,
          comparisonResultLocator: input.comparisonResultLocator,
          expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        }
      : {
          operation: input.operation,
          priorReceiptLocator: input.priorReceiptLocator,
          restorePackageDigest: input.restorePackageDigest,
          expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        },
  )
  const prepared = prepareEvolutionPackageMutation({ taskID: input.authorization.taskID, intent })
  const confirmation = preparedConfirmation(prepared)
  if (prepared.operation === "promotion" && input.operation === "promotion") {
    const authorization = requireEvolutionMutationAuthorization({
      projectID: Instance.project.id,
      ...input.authorization,
      expectedText: confirmation,
    })
    const artifactID = receiptArtifactID({
      operation: input.operation,
      authorizationMessageID: authorization.message_id,
      authorizationMessageSHA256: authorization.message_sha256,
      target: prepared.target,
      beforeDigest: prepared.beforeDigest,
      afterDigest: prepared.afterDigest,
      evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
    })
    const prior = existingReceipt({ taskID: input.authorization.taskID, artifactID })
    if (prior) {
      await ExpertSquadPackageManager.reconcileCommittedPackageMutation({
        projectDirectory: Instance.project.worktree,
        id: prepared.target.id,
        installationScope: prepared.target.scope,
      })
      return { receipt: prior, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
    }
    let receipt!: EvolutionPromotionReceipt
    await ExpertSquadPackageManager.promotePackageRevision({
      projectDirectory: Instance.project.worktree,
      id: prepared.target.id,
      installationScope: prepared.target.scope,
      expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      promotePackageDigest: prepared.afterDigest,
      durableReceipt: {
        identity: { taskID: input.authorization.taskID, artifactID },
        commit: async (managerReceipt) => {
          receipt = EvolutionPromotionReceiptSchema.parse({
            operation: "promotion",
            authorization,
            target: prepared.target,
            expected_current_digest: input.expectedCurrentPackageDigest,
            before_digest: managerReceipt.before?.packageDigest,
            after_digest: managerReceipt.after.packageDigest,
            evidence: prepared.evidence,
            manager_receipt: managerReceipt,
          })
          persistReceipt({ taskID: input.authorization.taskID, artifactID, operationID: authorization.message_id, receipt })
        },
      },
    })
    return { receipt, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
  }
  if (prepared.operation !== "restoration" || input.operation !== "restoration")
    throw new Error("Evolution mutation preparation operation drift")
  const authorization = requireEvolutionMutationAuthorization({
    projectID: Instance.project.id,
    ...input.authorization,
    expectedText: confirmation,
  })
  const artifactID = receiptArtifactID({
    operation: input.operation,
    authorizationMessageID: authorization.message_id,
    authorizationMessageSHA256: authorization.message_sha256,
    target: prepared.target,
    beforeDigest: prepared.beforeDigest,
    afterDigest: prepared.afterDigest,
    evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
  })
  const existing = existingReceipt({ taskID: input.authorization.taskID, artifactID })
  if (existing) {
    await ExpertSquadPackageManager.reconcileCommittedPackageMutation({
      projectDirectory: Instance.project.worktree,
      id: prepared.target.id,
      installationScope: prepared.target.scope,
    })
    return { receipt: existing, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
  }
  let receipt!: EvolutionPromotionReceipt
  await ExpertSquadPackageManager.restorePackageRevisionWithReceipt({
    projectDirectory: Instance.project.worktree,
    id: prepared.target.id,
    installationScope: prepared.target.scope,
    expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
    restorePackageDigest: input.restorePackageDigest,
    durableReceipt: {
      identity: { taskID: input.authorization.taskID, artifactID },
      commit: async (managerReceipt) => {
        receipt = EvolutionPromotionReceiptSchema.parse({
          operation: "restoration",
          authorization,
          target: prepared.target,
          expected_current_digest: input.expectedCurrentPackageDigest,
          before_digest: managerReceipt.before?.packageDigest,
          after_digest: managerReceipt.after.packageDigest,
          evidence: prepared.evidence,
          manager_receipt: managerReceipt,
        })
        persistReceipt({ taskID: input.authorization.taskID, artifactID, operationID: authorization.message_id, receipt })
      },
    },
  })
  return { receipt, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
}
