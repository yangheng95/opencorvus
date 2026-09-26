import { Identifier } from "@/id/id"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import {
  canonicalEvolutionJSON,
  EngineArtifactEnvelopeSchema,
  EvolutionMutationAuthorizationRequestSchema,
  EvolutionMutationAuthorizationResultSchema,
  EvolutionMutationIntentRequestSchema,
  EvolutionInstallableTargetSchema,
  EvolutionMutationRequestSchema,
  EvolutionPromotionReceiptSchema,
  type EvolutionMutationAuthorizationRequest,
  type EvolutionMutationRequest,
  type EvolutionPromotionReceipt,
} from "@opencorvus-ai/plugin"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Instance } from "@/project/instance"
import { EngineService } from "@/task-api"
import { Database, eq } from "@/storage/db"
import { ExpertSquadPackageManager } from "./manager"
import { requireCurrentEvolutionReviews } from "./evolution-review-freshness"
import { requireEvolutionMutationAuthorization, requireEvolutionMutationRootSession } from "./mutation-authorization"
import {
  evolutionMutationConfirmationText,
  prepareEvolutionPackageMutation,
  type PreparedEvolutionMutation,
} from "./evolution-mutation-intent"

function preparedConfirmation(prepared: PreparedEvolutionMutation) {
  return evolutionMutationConfirmationText({
    projectID: Instance.project.id,
    target: prepared.target,
    beforeDigest: prepared.beforeDigest,
    afterDigest: prepared.afterDigest,
    evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
    operation: prepared.operation,
    ...(prepared.operation === "feedback_revision" ? { feedback: prepared.feedback } : {}),
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
  if (prepared.operation === "promotion")
    requireCurrentEvolutionReviews({ taskID: input.taskID, comparisonLocator: prepared.intent.comparisonResultLocator })
  const confirmationText = preparedConfirmation(prepared)
  if (input.confirmationText !== confirmationText)
    throw new Error("Evolution mutation authorization text does not equal the exact current evidence decision")
  const recorded = await EngineService.handleTaskMessage(input.taskID, {
    text: confirmationText,
    source: "expert_squad.evolution_authorization",
  })
  const persisted = recorded.user_message
  const verified = await requireEvolutionMutationAuthorization({
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

export const EvolutionMutationReceiptIdentityConflictError = NamedError.create(
  "EvolutionMutationReceiptIdentityConflictError",
  z.object({ artifactID: z.string() }),
)

type ReceiptIdentity = {
  operation: string
  authorizationMessageID: string
  authorizationMessageSHA256: string
  target: z.infer<typeof EvolutionInstallableTargetSchema>
  beforeDigest: string
  afterDigest: string
  evidenceSHA256s: readonly string[]
}

function receiptArtifactID(input: ReceiptIdentity) {
  return Identifier.deterministic("artifact", `evolution-mutation\0${canonicalEvolutionJSON(input)}`)
}

function existingReceipt(input: { taskID: string; artifactID: string; identity: ReceiptIdentity }) {
  const row = Database.use((db) =>
    db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get(),
  )
  if (!row) return undefined
  if (row.task_id !== input.taskID || row.kind !== "expert_output")
    throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
  const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
  if (
    envelope.artifact_type !== "evolution-lab/promotion-receipt" ||
    envelope.producer.owner_kind !== "core" ||
    envelope.producer.component_id !== "expert-squad-package-manager"
  )
    throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
  const receipt = EvolutionPromotionReceiptSchema.parse(envelope.payload)
  const identity = {
    operation: receipt.operation,
    authorizationMessageID: receipt.authorization.message_id,
    authorizationMessageSHA256: receipt.authorization.message_sha256,
    target: receipt.target,
    beforeDigest: receipt.before_digest,
    afterDigest: receipt.after_digest,
    evidenceSHA256s: receipt.evidence.map((locator) => {
      if (locator.source !== "engine_artifact")
        throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
      return locator.expected_sha256
    }),
  }
  if (
    envelope.producer.operation_id !== input.identity.authorizationMessageID ||
    canonicalEvolutionJSON(identity) !== canonicalEvolutionJSON(input.identity)
  )
    throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
  return receipt
}

function persistReceipt(input: {
  taskID: string
  artifactID: string
  operationID: string
  receipt: EvolutionPromotionReceipt
  prepared: PreparedEvolutionMutation
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
  Database.immediateTransaction((db) => {
    const current = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get()
    if (current) {
      if (
        current.task_id !== input.taskID ||
        current.kind !== "expert_output" ||
        canonicalEvolutionJSON(EngineArtifactEnvelopeSchema.parse(current.payload)) !== canonicalEvolutionJSON(envelope)
      )
        throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
      return
    }
    if (input.prepared.operation === "promotion")
      requireCurrentEvolutionReviews({
        taskID: input.taskID,
        comparisonLocator: input.prepared.intent.comparisonResultLocator,
      })
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
  // The request is the intent plus its authorization; removing that one field
  // yields the intent for every operation, so adding an operation does not
  // require restating its fields here.
  const { authorization: _authorization, ...intentFields } = input
  const intent = EvolutionMutationIntentRequestSchema.parse(intentFields)
  const prepared = prepareEvolutionPackageMutation({ taskID: input.authorization.taskID, intent })
  const confirmation = preparedConfirmation(prepared)
  // A feedback revision installs exactly as a promotion does — the difference
  // is what authorized it, which the receipt records — so both take this path.
  if (prepared.operation !== "restoration" && input.operation !== "restoration") {
    const authorization = await requireEvolutionMutationAuthorization({
      projectID: Instance.project.id,
      ...input.authorization,
      expectedText: confirmation,
    })
    const identity: ReceiptIdentity = {
      operation: input.operation,
      authorizationMessageID: authorization.message_id,
      authorizationMessageSHA256: authorization.message_sha256,
      target: prepared.target,
      beforeDigest: prepared.beforeDigest,
      afterDigest: prepared.afterDigest,
      evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
    }
    const artifactID = receiptArtifactID(identity)
    const prior = existingReceipt({ taskID: input.authorization.taskID, artifactID, identity })
    if (prior) {
      await ExpertSquadPackageManager.reconcileCommittedPackageMutation({
        projectDirectory: Instance.project.worktree,
        id: prepared.target.id,
        installationScope: prepared.target.scope,
      })
      return { receipt: prior, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
    }
    // Restore a pre-receipt interrupted installation before rejecting a newly
    // stale request. Committed operations took the idempotent return above.
    if (prepared.operation === "promotion") {
      await ExpertSquadPackageManager.reconcileCommittedPackageMutation({
        projectDirectory: Instance.project.worktree,
        id: prepared.target.id,
        installationScope: prepared.target.scope,
      })
      requireCurrentEvolutionReviews({
        taskID: input.authorization.taskID,
        comparisonLocator: prepared.intent.comparisonResultLocator,
      })
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
            operation: prepared.operation,
            authorization,
            target: prepared.target,
            expected_current_digest: input.expectedCurrentPackageDigest,
            before_digest: managerReceipt.before?.packageDigest,
            after_digest: managerReceipt.after.packageDigest,
            evidence: prepared.evidence,
            manager_receipt: managerReceipt,
          })
          persistReceipt({
            taskID: input.authorization.taskID,
            artifactID,
            operationID: authorization.message_id,
            receipt,
            prepared,
          })
        },
      },
    })
    return { receipt, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
  }
  if (prepared.operation !== "restoration" || input.operation !== "restoration")
    throw new Error("Evolution mutation preparation operation drift")
  const authorization = await requireEvolutionMutationAuthorization({
    projectID: Instance.project.id,
    ...input.authorization,
    expectedText: confirmation,
  })
  const identity: ReceiptIdentity = {
    operation: input.operation,
    authorizationMessageID: authorization.message_id,
    authorizationMessageSHA256: authorization.message_sha256,
    target: prepared.target,
    beforeDigest: prepared.beforeDigest,
    afterDigest: prepared.afterDigest,
    evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
  }
  const artifactID = receiptArtifactID(identity)
  const existing = existingReceipt({ taskID: input.authorization.taskID, artifactID, identity })
  if (existing) {
    await ExpertSquadPackageManager.reconcileCommittedPackageMutation({
      projectDirectory: Instance.project.worktree,
      id: prepared.target.id,
      installationScope: prepared.target.scope,
    })
    return {
      receipt: existing,
      locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }),
    }
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
        persistReceipt({
          taskID: input.authorization.taskID,
          artifactID,
          operationID: authorization.message_id,
          receipt,
          prepared,
        })
      },
    },
  })
  return { receipt, locator: exactEngineArtifactLocator({ taskID: input.authorization.taskID, artifactID }) }
}
