import z from "zod"

export const OrchestratorControlMessageExtra = z
  .object({
    orchestrator_control_ingress: z
      .object({
        ingress_id: z.string().min(1),
        predecessor_id: z.string().min(1),
      })
      .strict(),
  })
  .strict()

export type OrchestratorControlMessageExtra = z.infer<typeof OrchestratorControlMessageExtra>
