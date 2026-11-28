import { expect, test } from "bun:test"
import Ajv from "ajv"
import Ajv2019 from "ajv/dist/2019"
import Ajv2020 from "ajv/dist/2020"
import { asSchema, jsonSchema, tool, InvalidToolInputError, type ToolExecutionOptions } from "ai"
import z from "zod"
import type { Provider } from "../src/provider/provider"
import { SessionLoop } from "../src/session/loop"
import { Message } from "../src/session/message"

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

test.each([false, true])(
  "preserves canonical nullable data with a shared discriminator, nullable first=%s",
  async (nullableFirst) => {
    const branches = [false, true].map((nullable) => ({
      type: "object",
      properties: {
        kind: { const: "record" },
        options: {
          type: "object",
          properties: { value: nullable ? { type: ["string", "null"] } : { type: "string" } },
          additionalProperties: false,
        },
      },
      required: ["kind", "options"],
      additionalProperties: false,
    }))
    if (nullableFirst) branches.reverse()
    expect(
      await captureStructured(
        {
          type: "object",
          properties: { result: { anyOf: branches } },
          required: ["result"],
          additionalProperties: false,
        },
        { result: { kind: "record", options: { value: null } } },
      ),
    ).toEqual({
      result: { kind: "record", options: { value: null } },
    })
  },
)

test("preserves real extra data authorized by an open object branch", async () => {
  expect(
    await captureStructured(
      {
        type: "object",
        properties: {
          result: {
            anyOf: [
              {
                type: "object",
                properties: { kind: { const: "note" }, text: { type: "string" } },
                required: ["kind", "text"],
                additionalProperties: true,
              },
              {
                type: "object",
                properties: { kind: { const: "data" }, rows: { type: "array", items: { type: "string" } } },
                required: ["kind", "rows"],
                additionalProperties: false,
              },
            ],
          },
        },
        required: ["result"],
        additionalProperties: false,
      },
      { result: { kind: "note", text: "交接", rows: ["N01"], total: null } },
    ),
  ).toEqual({
    result: { kind: "note", text: "交接", rows: ["N01"], total: null },
  })
})

test("returns the typed canonical input error for an active foreign field in a closed constant branch", async () => {
  const prepared = SessionLoop.prepareProviderTool({
    name: "closed_record_contract",
    source: "registry",
    model,
    tool: tool({
      inputSchema: z.union([
        z.object({ kind: z.literal("note"), text: z.string() }).strict(),
        z.object({ kind: z.literal("data"), rows: z.array(z.string()) }).strict(),
      ]),
      execute: async (input) => input,
    }),
  })
  await expect(
    prepared.execute!({ operation: { kind: "note", text: "交接", rows: ["N01"] } }, options),
  ).rejects.toBeInstanceOf(InvalidToolInputError)
})

test("preserves real null while materializing a separate optional placeholder across shared-constant branches", async () => {
  const branches = [false, true].map((nullable) => ({
    type: "object",
    properties: {
      kind: { const: "record" },
      options: {
        type: "object",
        properties: { value: nullable ? { type: ["string", "null"] } : { type: "string" }, hint: { type: "string" } },
        additionalProperties: false,
      },
    },
    required: ["kind", "options"],
    additionalProperties: false,
  }))
  expect(
    await captureStructured(
      {
        type: "object",
        properties: { result: { anyOf: branches } },
        required: ["result"],
        additionalProperties: false,
      },
      { result: { kind: "record", options: { value: null, hint: null } } },
    ),
  ).toEqual({
    result: { kind: "record", options: { value: null } },
  })
})

test("returns the canonical typed error for incomparable null interpretations", async () => {
  const prepared = SessionLoop.prepareProviderTool({
    name: "incomparable_record_contract",
    source: "registry",
    model,
    tool: tool({
      inputSchema: z.union([
        z
          .object({ kind: z.literal("record"), alpha: z.string().nullable().optional(), beta: z.string().optional() })
          .strict(),
        z
          .object({ kind: z.literal("record"), alpha: z.string().optional(), beta: z.string().nullable().optional() })
          .strict(),
      ]),
      execute: async (input) => input,
    }),
  })
  await expect(
    prepared.execute!({ operation: { kind: "record", alpha: null, beta: null } }, options),
  ).rejects.toBeInstanceOf(InvalidToolInputError)
})

test("materializes a recognized foreign null placeholder for the selected closed branch", async () => {
  const prepared = SessionLoop.prepareProviderTool({
    name: "closed_placeholder_contract",
    source: "registry",
    model,
    tool: tool({
      inputSchema: z.union([
        z.object({ kind: z.literal("note"), text: z.string() }).strict(),
        z.object({ kind: z.literal("data"), rows: z.array(z.string()) }).strict(),
      ]),
      execute: async (input) => input,
    }),
  })
  expect(await prepared.execute!({ operation: { kind: "note", text: "交接", rows: null } }, options)).toEqual({
    kind: "note",
    text: "交接",
  })
})

test("materializes referenced branches while preserving the complete outer constraint", async () => {
  expect(
    await captureStructured(
      {
        type: "object",
        properties: {
          result: {
            anyOf: [{ $ref: "#/$defs/text" }, { $ref: "#/$defs/nullable" }],
            allOf: [{ required: ["value"] }],
          },
        },
        required: ["result"],
        additionalProperties: false,
        $defs: Object.fromEntries(
          ["text", "nullable"].map((name) => [
            name,
            {
              type: "object",
              properties: {
                kind: { const: "record" },
                value: { type: name === "text" ? "string" : ["string", "null"] },
                hint: { type: "string" },
              },
              required: ["kind"],
              additionalProperties: false,
            },
          ]),
        ),
      },
      { result: { kind: "record", value: null, hint: null } },
    ),
  ).toEqual({ result: { kind: "record", value: null } })
})

test("returns the structured output error when materialized candidates violate oneOf exclusivity", async () => {
  const branch = {
    type: "object",
    properties: { kind: { const: "record" }, hint: { type: "string" } },
    required: ["kind"],
    additionalProperties: false,
  }
  await expect(
    captureStructured(
      {
        type: "object",
        properties: {
          result: {
            oneOf: [
              branch,
              {
                type: "object",
                properties: { kind: { const: "record" } },
                required: ["kind"],
                additionalProperties: false,
              },
            ],
          },
        },
        required: ["result"],
        additionalProperties: false,
      },
      { result: { kind: "record", hint: null } },
    ),
  ).rejects.toBeInstanceOf(Message.StructuredOutputPayloadError)
})
