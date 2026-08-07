import { ArchitectContractGraphSchema } from "@/architect/contract-graph"
import { ArchitectFidelityStateSchema } from "@/architect/fidelity"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  EngineArtifactLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { z } from "zod"

export const ArchitectTurnProducerSchema = z
  .object({
    kind: z.literal("architect_turn"),
    session_id: z.string().min(1),
    final_message_id: z.string().min(1),
  })
  .strict()

/** Immutable Architect-owned domain topology. It never owns current Goal membership. */
export const ArchitectContractGraphArtifactPayloadSchema =
  ArtifactConsumptionProvenanceSchema.safeExtend({
    producer: ArchitectTurnProducerSchema,
    requirement_set_artifact_locator: EngineArtifactLocatorSchema.nullable(),
    prior_contract_graph_artifact_locator: EngineArtifactLocatorSchema.nullable(),
    graph: ArchitectContractGraphSchema,
    fidelity: ArchitectFidelityStateSchema,
  })

export type ArchitectTurnProducer = z.infer<typeof ArchitectTurnProducerSchema>
export type ArchitectContractGraphArtifactPayload = z.infer<
  typeof ArchitectContractGraphArtifactPayloadSchema
>
