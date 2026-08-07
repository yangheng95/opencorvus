import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const EvaluateError = NamedError.create(
  "VisualEvaluateError",
  z.object({
    reason: z.string(),
  }),
)
