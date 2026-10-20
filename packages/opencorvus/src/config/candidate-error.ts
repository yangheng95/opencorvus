import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const ConfigCandidateValidationError = NamedError.create(
  "ConfigCandidateValidationError",
  z.object({ message: z.string() }),
)
