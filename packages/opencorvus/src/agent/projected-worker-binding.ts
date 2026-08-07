import z from "zod"
import { ProjectedWorkerIdentitySchema, sameProjectedWorkerIdentity } from "./projected-worker-identity"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ProjectedWorkerBindingSchema = z
  .object({
    identity: ProjectedWorkerIdentitySchema,
    expertSquadID: z.string().trim().min(1),
    workerTurnDescriptorID: z.string().trim().min(1),
    workerTurnDescriptorHash: SHA256Schema,
  })
  .strict()

export type ProjectedWorkerBinding = z.infer<typeof ProjectedWorkerBindingSchema>

export function materializeProjectedWorkerBinding(input: ProjectedWorkerBinding): ProjectedWorkerBinding {
  return ProjectedWorkerBindingSchema.parse({
    identity: {
      agentID: input.identity.agentID,
      baseRole: input.identity.baseRole,
      sessionKind: input.identity.sessionKind,
      dispatchAdapterID: input.identity.dispatchAdapterID,
      runtimeTemplateABIVersion: input.identity.runtimeTemplateABIVersion,
      dispatchAdapterABIVersion: input.identity.dispatchAdapterABIVersion,
      projectionHash: input.identity.projectionHash,
    },
    expertSquadID: input.expertSquadID,
    workerTurnDescriptorID: input.workerTurnDescriptorID,
    workerTurnDescriptorHash: input.workerTurnDescriptorHash,
  })
}

export function sameProjectedWorkerBinding(left: ProjectedWorkerBinding, right: ProjectedWorkerBinding): boolean {
  return (
    sameProjectedWorkerIdentity(left.identity, right.identity) &&
    left.expertSquadID === right.expertSquadID &&
    left.workerTurnDescriptorID === right.workerTurnDescriptorID &&
    left.workerTurnDescriptorHash === right.workerTurnDescriptorHash
  )
}
