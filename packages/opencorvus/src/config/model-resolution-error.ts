import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const MissingModelConfigError = NamedError.create(
  "MissingModelConfigError",
  z.object({
    agent: z.string().optional(),
    message: z.string(),
  }),
)
