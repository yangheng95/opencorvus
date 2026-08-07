import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

/**
 * Process-local Session continuation cannot proceed because its exact runtime
 * contract is absent or no longer accepts more physical turns. This is a
 * runtime ownership fact, not an Agent business outcome.
 */
export const SessionRuntimeContractMissingError = NamedError.create(
  "SessionRuntimeContractMissingError",
  z.object({
    message: z.string(),
    sessionID: z.string(),
    agentID: z.string().optional(),
    sessionKind: z.string().optional(),
    reason: z.literal("missing"),
  }),
)
