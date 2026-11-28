import { expect, test } from "bun:test"
import Ajv from "ajv"
import Ajv2019 from "ajv/dist/2019"
import Ajv2020 from "ajv/dist/2020"
import { asSchema, jsonSchema, tool, type ToolExecutionOptions } from "ai"
import type { Provider } from "../src/provider/provider"
import { SessionLoop } from "../src/session/loop"

const model = {
  id: "gpt-6.1-sol",
  providerID: "openai",
  api: { id: "gpt-6.1-sol", npm: "@ai-sdk/openai" },
} as Provider.Model
const options = {
  toolCallId: "call_null_value_contract",
  messages: [],
  abortSignal: new AbortController().signal,
} as ToolExecutionOptions

async function captureStructured(schema: Record<string, unknown>, value: Record<string, unknown>) {
  let captured: unknown
  const prepared = SessionLoop.prepareProviderTool({
    name: "StructuredOutput",
    source: "structured",
    model,
    tool: SessionLoop.createStructuredOutputTool({
      schema,
      onSuccess: (output) => {
        captured = output
      },
    }),
  })
  const declaration = asSchema(prepared.inputSchema)
  const validate = new Ajv({ strict: false, validateFormats: false }).compile(declaration.jsonSchema)
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true)
  await prepared.execute!(value, options)
  return captured
}

test("captures real null values accepted by const, enum, unrestricted and boolean schemas", async () => {
  expect(
    await captureStructured(
      {
        type: "object",
        properties: {
          fixed: { const: null },
          choice: { enum: ["known", null] },
          unrestricted: {},
          permitted: true,
          optionalHint: { type: "string" },
        },
        additionalProperties: false,
      },
      { fixed: null, choice: null, unrestricted: null, permitted: null, optionalHint: null },
    ),
  ).toEqual({
    fixed: null,
    choice: null,
    unrestricted: null,
    permitted: null,
  })
})

test("materializes a provider optional placeholder according to all canonical constraints", async () => {
  expect(
    await captureStructured(
      {
        type: "object",
        properties: { selected: { type: ["string", "null"], enum: ["known"] } },
        additionalProperties: false,
      },
      { selected: null },
    ),
  ).toEqual({})
})

test("applies complete compound constraints and original-root references to optional null values", async () => {
  expect(
    await captureStructured(
      {
        type: "object",
        properties: {
          "金额~/原值 #1": { $ref: "#/$defs/blank" },
          combined: { allOf: [{ enum: [null, "known"] }, { not: { type: "string" } }] },
          exclusive: { oneOf: [{ const: null }, { type: "string" }] },
          conditional: { if: { type: "null" }, then: { const: null }, else: { type: "string" } },
          omitted: { oneOf: [{ type: ["string", "null"] }, { const: null }] },
        },
        $defs: { blank: { const: null } },
        additionalProperties: false,
      },
      { "金额~/原值 #1": null, combined: null, exclusive: null, conditional: null, omitted: null },
    ),
  ).toEqual({
    "金额~/原值 #1": null,
    combined: null,
    exclusive: null,
    conditional: null,
  })
})

test.each([
  ["http://json-schema.org/draft-07/schema#", Ajv],
  ["https://json-schema.org/draft/2019-09/schema", Ajv2019],
  ["https://json-schema.org/draft/2020-12/schema", Ajv2020],
] as const)("materializes referenced MCP input using its declared %s dialect", async (dialect, Validator) => {
  const prepared = SessionLoop.prepareProviderTool({
    name: "null_value_contract",
    source: "mcp",
    model,
    tool: tool({
      inputSchema: jsonSchema({
        $schema: dialect,
        type: "object",
        properties: { preserved: { $ref: "#/$defs/blank" }, hint: { type: "string" } },
        $defs: { blank: { allOf: [{ const: null }, { type: ["null", "string"] }] } },
        additionalProperties: false,
      }),
      execute: async (input) => input,
    }),
  })
  const input = { preserved: null, hint: null }
  const validate = new Validator({ strict: false, validateFormats: false }).compile(
    asSchema(prepared.inputSchema).jsonSchema,
  )
  expect(validate(input), JSON.stringify(validate.errors)).toBe(true)
  expect(await prepared.execute!(input, options)).toEqual({ preserved: null })
})
