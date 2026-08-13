import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const ProviderAuthRequiredError = NamedError.create(
  "ProviderAuthRequiredError",
  z
    .object({
      providerID: z.string().min(1),
      message: z.string().min(1),
    })
    .strict(),
)
