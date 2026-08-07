import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export type ModelRef = {
  providerID: string
  modelID: string
}

export const InvalidModelReferenceError = NamedError.create(
  "ProviderInvalidModelReferenceError",
  z.object({
    value: z.string(),
    message: z.string(),
  }),
)

export function isModelReference(value: string): boolean {
  const slash = value.indexOf("/")
  return value.trim() === value && slash > 0 && slash < value.length - 1 && !/\s/.test(value)
}

export function parseModelReference(value: string): ModelRef {
  if (!isModelReference(value)) {
    throw new InvalidModelReferenceError({
      value,
      message: `Invalid model reference "${value}". Model must be in the format "provider/model".`,
    })
  }
  const [providerID, ...rest] = value.split("/")
  return {
    providerID,
    modelID: rest.join("/"),
  }
}
