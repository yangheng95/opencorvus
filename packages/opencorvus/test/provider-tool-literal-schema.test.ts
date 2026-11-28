import { expect, test } from "bun:test"
import Ajv from "ajv"
import { asSchema, type ToolExecutionOptions } from "ai"
import type { Provider } from "../src/provider/provider"
import { SessionLoop } from "../src/session/loop"
import { ProviderSchema } from "../src/provider/schema"

const model = {
  id: "gpt-6.1-sol",
  providerID: "openai",
  api: { id: "gpt-6.1-sol", npm: "@ai-sdk/openai" },
} as Provider.Model
const options = {
  toolCallId: "call_literal_schema_contract",
  messages: [],
  abortSignal: new AbortController().signal,
} as ToolExecutionOptions

test("projects the exact JSON type of finite scalar domains and captures their real values", async () => {
  const properties = {
    kind: { const: "settlement" },
    version: { const: 1 },
    fraction: { const: 1.5 },
    verified: { const: true },
    missing: { const: null },
    currency: { enum: ["CNY", "USD", null] },
    mixed: { enum: ["unknown", 0, false, null] },
    declared: { type: "integer", enum: [1, 2] },
  }
  const value = {
    kind: "settlement",
    version: 1,
    fraction: 1.5,
    verified: true,
    missing: null,
    currency: null,
    mixed: 0,
    declared: 2,
  }
  let captured: unknown
  const prepared = SessionLoop.prepareProviderTool({
    name: "StructuredOutput",
    source: "structured",
    model,
    tool: SessionLoop.createStructuredOutputTool({
      schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
      onSuccess: (result) => {
        captured = result
      },
    }),
  })
  const declaration = asSchema(prepared.inputSchema).jsonSchema as { properties: Record<string, unknown> }
  expect(declaration.properties).toEqual({
    kind: { const: "settlement", type: "string" },
    version: { const: 1, type: "number" },
    fraction: { const: 1.5, type: "number" },
    verified: { const: true, type: "boolean" },
    missing: { const: null, type: "null" },
    currency: { enum: ["CNY", "USD", null], type: ["string", "null"] },
    mixed: { enum: ["unknown", 0, false, null], type: ["string", "number", "boolean", "null"] },
    declared: { type: "integer", enum: [1, 2] },
  })
  expect(new Ajv({ strict: false }).validate(declaration, value)).toBe(true)
  await prepared.execute!(value, options)
  expect(captured).toEqual(value)
})

test("preserves complete object and array literals and their schema-like business keys", async () => {
  const literal = {
    properties: { kind: "record", enabled: false },
    required: ["original"],
    type: "business-label",
    enum: ["original", null],
  }
  const properties = {
    record: { const: literal },
    choices: { enum: [literal, [literal, null]] },
    list: { const: [literal, null] },
  }
  const schema = {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    default: { properties: { kind: "default-label" } },
    examples: [{ properties: { kind: "example-label" } }],
  }
  let captured: unknown
  const prepared = SessionLoop.prepareProviderTool({
    name: "StructuredOutput",
    source: "structured",
    model,
    tool: SessionLoop.createStructuredOutputTool({
      schema,
      onSuccess: (result) => {
        captured = result
      },
    }),
  })
  const declaration = asSchema(prepared.inputSchema).jsonSchema as Record<string, unknown>
  expect(declaration).toEqual({
    ...schema,
    properties: {
      record: { const: literal, type: "object" },
      choices: { enum: [literal, [literal, null]], type: ["object", "array"] },
      list: { const: [literal, null], type: "array" },
    },
  })
  const value = { record: literal, choices: [literal, null], list: [literal, null] }
  expect(new Ajv({ strict: false, useDefaults: false }).validate(declaration, value)).toBe(true)
  await prepared.execute!(value, options)
  expect(captured).toEqual(value)
})

test("preserves distinct literal business descriptions when merging root union value domains", () => {
  const values = [{ value: { description: "北仓" } }, { value: { description: "南仓" } }]
  const declaration = ProviderSchema.normalize(model, {
    anyOf: values.map((value) => ({
      type: "object",
      properties: { value: { const: value.value } },
      required: ["value"],
      additionalProperties: false,
    })),
  })
  const validate = new Ajv({ strict: false }).compile(declaration)
  expect(values.map((value) => validate(value))).toEqual([true, true])
})

test("projects schema map entries named after keywords with original-root references", async () => {
  let captured: unknown
  const prepared = SessionLoop.prepareProviderTool({
    name: "StructuredOutput",
    source: "structured",
    model,
    tool: SessionLoop.createStructuredOutputTool({
      schema: {
        type: "object",
        properties: { missing: { $ref: "#/$defs/const" }, label: { $ref: "#/$defs/properties" } },
        required: ["missing", "label"],
        additionalProperties: false,
        $defs: { const: { const: null }, properties: { enum: ["原始"] } },
      },
      onSuccess: (result) => {
        captured = result
      },
    }),
  })
  const declaration = asSchema(prepared.inputSchema).jsonSchema as Record<string, unknown>
  expect(declaration.$defs).toEqual({
    const: { const: null, type: "null" },
    properties: { enum: ["原始"], type: "string" },
  })
  const value = { missing: null, label: "原始" }
  expect(new Ajv({ strict: false }).validate(declaration, value)).toBe(true)
  await prepared.execute!(value, options)
  expect(captured).toEqual(value)
})

test("projects finite values at standard 2019 and 2020 schema positions", () => {
  const declaration = ProviderSchema.normalize(model, {
    type: "object",
    properties: {},
    dependentSchemas: { "属性~/": { type: "object", properties: { flag: { const: true } } } },
    unevaluatedProperties: { const: null },
    allOf: [
      {
        required: ["tuple", "document"],
        properties: {
          tuple: { type: "array", prefixItems: [{ const: "原始" }], unevaluatedItems: { const: null } },
          document: { type: "string", contentSchema: { const: { description: "原文" } } },
        },
      },
    ],
  } as never) as Record<string, any>
  expect({
    dependent: declaration.dependentSchemas["属性~/"].properties.flag,
    unevaluatedProperties: declaration.unevaluatedProperties,
    tuple: declaration.allOf[0].properties.tuple,
    content: declaration.allOf[0].properties.document.contentSchema,
  }).toEqual({
    dependent: { anyOf: [{ const: true, type: "boolean" }, { type: "null" }] },
    unevaluatedProperties: { const: null, type: "null" },
    tuple: {
      type: "array",
      prefixItems: [{ const: "原始", type: "string" }],
      unevaluatedItems: { const: null, type: "null" },
    },
    content: { const: { description: "原文" }, type: "object" },
  })
})
