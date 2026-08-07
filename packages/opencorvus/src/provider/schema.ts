import { asSchema, jsonSchema, type Schema } from "ai"
import type { JSONSchema7 } from "@ai-sdk/provider"
import z from "zod"
import type { Provider } from "./provider"
import { ProviderTransform } from "./transform"

export namespace ProviderSchema {
  export function input(model: Provider.Model, inputSchema: unknown): Schema<unknown> {
    const rawJsonSchema = asSchema(inputSchema as never).jsonSchema
    return jsonSchema(normalize(model, rawJsonSchema))
  }

  export function output<T extends z.ZodType>(model: Provider.Model, schema: T): Schema<z.infer<T>> {
    const rawJsonSchema = z.toJSONSchema(schema) as JSONSchema7
    return jsonSchema<z.infer<T>>(normalize(model, rawJsonSchema), {
      validate(value) {
        const parsed = schema.safeParse(value)
        return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error }
      },
    })
  }

  export function normalize(model: Provider.Model, rawJsonSchema: JSONSchema7 | PromiseLike<JSONSchema7>): JSONSchema7 {
    if (isPromiseLike(rawJsonSchema)) {
      throw new Error("provider schema normalization requires a synchronous JSON Schema")
    }
    return ProviderTransform.schema(model, rawJsonSchema)
  }

  function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return Boolean(value && typeof value === "object" && typeof (value as { then?: unknown }).then === "function")
  }
}
