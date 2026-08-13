import { asSchema, jsonSchema, type Schema } from "ai"
import type { JSONSchema7 } from "@ai-sdk/provider"
import z from "zod"
import type { Provider } from "./provider"
import { ProviderTransform } from "./transform"
import { requiresOpenAIStrictToolSchema } from "./strict-tool-schema"
import { materializeToolExecutionInput } from "./tool-execution-input"

const STRICT_ROOT_UNION_ENVELOPE_KEY = "operation"

export namespace ProviderSchema {
  export function input(model: Provider.Model, inputSchema: unknown): Schema<unknown> {
    const rawJsonSchema = asSchema(inputSchema as never).jsonSchema
    if (isPromiseLike(rawJsonSchema)) {
      throw new Error("provider schema normalization requires a synchronous JSON Schema")
    }
    const enveloped = requiresStrictRootUnionEnvelope(model, rawJsonSchema)
    const providerJsonSchema = enveloped ? strictRootUnionEnvelope(rawJsonSchema) : rawJsonSchema
    const canonical = asSchema(inputSchema as never) as {
      validate?: (
        value: unknown,
      ) =>
        | { success: true; value: unknown }
        | { success: false; error: Error }
        | Promise<{ success: true; value: unknown } | { success: false; error: Error }>
    }
    return jsonSchema(normalize(model, providerJsonSchema), {
      async validate(value) {
        const materialized = materializeInput(model, inputSchema, value)
        if (typeof canonical.validate !== "function") return { success: true, value: materialized }
        return canonical.validate(materialized)
      },
    })
  }

  /**
   * Convert the provider ABI back to the canonical Tool input before either
   * execution or persistence. OpenAI strict mode cannot accept a root
   * anyOf/oneOf, so root unions are exposed under one `operation` property;
   * the original schema remains the sole branch validator and runtime ABI.
   */
  export function materializeInput(model: Provider.Model, inputSchema: unknown, value: unknown): unknown {
    const rawJsonSchema = asSchema(inputSchema as never).jsonSchema
    if (isPromiseLike(rawJsonSchema)) {
      throw new Error("provider schema materialization requires a synchronous JSON Schema")
    }
    return requiresOpenAIStrictToolSchema(model) ? materializeToolExecutionInput(inputSchema, value) : value
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

  function requiresStrictRootUnionEnvelope(model: Provider.Model, schema: unknown): boolean {
    if (!requiresOpenAIStrictToolSchema(model)) return false
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false
    const record = schema as Record<string, unknown>
    return record.type === undefined && (Array.isArray(record.anyOf) || Array.isArray(record.oneOf))
  }

  function strictRootUnionEnvelope(schema: JSONSchema7): JSONSchema7 {
    const variants = schema.anyOf ?? schema.oneOf
    if (!variants) throw new Error("strict root union Tool schema has no variants")
    for (const variant of variants ?? []) {
      if (!variant || typeof variant !== "object" || Array.isArray(variant)) continue
      const properties = (variant as JSONSchema7).properties
      if (properties && typeof properties === "object" && !Array.isArray(properties) && "operation" in properties) {
        throw new Error('strict root union Tool schema reserves the provider envelope field "operation"')
      }
    }
    const annotations = Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== "anyOf" && key !== "oneOf"),
    ) as JSONSchema7
    return {
      type: "object" as const,
      properties: {
        [STRICT_ROOT_UNION_ENVELOPE_KEY]: {
          ...annotations,
          anyOf: variants,
          description: "Select exactly one operation and provide the fields declared by that operation branch.",
        },
      },
      required: [STRICT_ROOT_UNION_ENVELOPE_KEY],
      additionalProperties: false,
    }
  }
}
