import z from "zod"

/** Physical caller provenance, independent of the owning Session's routing identity. */
export const StreamRequestIdentity = z
  .object({
    requestID: z.string().min(1),
    agentID: z.string().min(1),
    providerID: z.string().min(1),
    modelID: z.string().min(1),
    apiModelID: z.string().min(1),
  })
  .strict()
