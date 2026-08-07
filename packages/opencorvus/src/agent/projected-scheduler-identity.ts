import z from "zod"

export const ProjectedSchedulerIdentitySchema = z
  .object({
    agentID: z.literal("orchestrator"),
    baseRole: z.literal("orchestrator"),
    sessionKind: z.literal("orchestrator"),
    projectionHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export type ProjectedSchedulerIdentity = z.output<typeof ProjectedSchedulerIdentitySchema>
