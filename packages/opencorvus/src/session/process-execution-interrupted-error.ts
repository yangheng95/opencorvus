import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const ProcessExecutionInterruptedError = NamedError.create(
  "ProcessExecutionInterruptedError",
  z
    .object({
      message: z.string().min(1),
    })
    .strict(),
)
