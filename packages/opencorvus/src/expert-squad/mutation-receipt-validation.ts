import {
  EngineArtifactEnvelopeSchema,
  EvolutionPromotionReceiptSchema,
  type EngineArtifactEnvelope,
  type EvolutionPromotionReceipt,
} from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const EvolutionMutationReceiptIdentityConflictError = NamedError.create(
  "EvolutionMutationReceiptIdentityConflictError",
  z.object({ artifactID: z.string() }),
)

export type ExpertSquadMutationReceiptProjection = {
  artifactID: string
  taskID: string
  kind: string
  payload: unknown
}
type ManagerEnvelope = EngineArtifactEnvelope & {
  producer: Extract<EngineArtifactEnvelope["producer"], { owner_kind: "core" }>
}

/** Pure validation shared by the original Artifact writer and versioned migration.
 * Imported reports describe a source commit; they never authorize another one. */
export function parseExpertSquadMutationReceiptProjection(
  input: ExpertSquadMutationReceiptProjection,
): { envelope: ManagerEnvelope; receipt: EvolutionPromotionReceipt } | undefined {
  const raw = input.payload
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  if (Object.hasOwn(value, "import_lineage")) return undefined
  const producer = value.producer
  if (!producer || typeof producer !== "object" || Array.isArray(producer)) return undefined
  const identity = producer as Record<string, unknown>
  if (
    value.artifact_type !== "evolution-lab/promotion-receipt" ||
    identity.owner_kind !== "core" ||
    identity.component_id !== "expert-squad-package-manager"
  )
    return undefined
  const envelope = EngineArtifactEnvelopeSchema.safeParse(raw)
  const receipt = envelope.success ? EvolutionPromotionReceiptSchema.safeParse(envelope.data.payload) : undefined
  if (
    input.kind !== "expert_output" ||
    !envelope.success ||
    envelope.data.schema_version !== 1 ||
    !receipt?.success ||
    receipt.data.authorization.task_id !== input.taskID ||
    identity.operation_id !== receipt.data.authorization.message_id
  )
    throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
  return { envelope: raw as ManagerEnvelope, receipt: receipt.data }
}
