import { expect, test } from "bun:test"
import z from "zod"
import Ajv from "ajv"
import { asSchema, jsonSchema } from "ai"
import { materializeToolExecutionInput } from "../src/provider/tool-execution-input"
import { ProviderSchema } from "../src/provider/schema"
import type { Provider } from "../src/provider/provider"
import { WorkArtifactAuthorTool } from "../src/tool/work-artifact"

const target = z
  .object({
    filePath: z.string(),
    note: z.string().optional(),
  })
  .strict()
const input = z.union([target.extend({ content: z.string() }), target.extend({ attachmentUrl: z.string() })])

test("materializes both uniquely shaped object branches through the root Provider envelope", () => {
  const providerValues = [
    { operation: { filePath: "/project/report.txt", content: "Report", note: null } },
    {
      operation: {
        filePath: "/project/report.csv",
        attachmentUrl: "/attachment/project/report.csv",
        note: "Original bytes",
      },
    },
  ]
  expect(providerValues.map((value) => input.parse(materializeToolExecutionInput(input, value)))).toEqual([
    { filePath: "/project/report.txt", content: "Report" },
    { filePath: "/project/report.csv", attachmentUrl: "/attachment/project/report.csv", note: "Original bytes" },
  ])
})

test("retains canonical union validation for conflicting active fields", () => {
  const result = input.safeParse(
    materializeToolExecutionInput(input, {
      operation: {
        filePath: "/project/report.txt",
        content: "Report",
        attachmentUrl: "/attachment/project/report.csv",
      },
    }),
  )
  expect(result.error?.issues.map((issue) => issue.code)).toEqual(["invalid_union"])
})

test("preserves a real nullable value in a nested discriminated object branch", () => {
  const text = z
    .object({
      kind: z.literal("text"),
      options: z.object({ value: z.string().optional() }).strict(),
    })
    .strict()
  const values = z.discriminatedUnion("kind", [
    z
      .object({ kind: z.literal("data"), options: z.object({ value: z.string().nullable().optional() }).strict() })
      .strict(),
    z.object({ kind: z.literal("count"), options: z.object({ value: z.number().optional() }).strict() }).strict(),
  ])
  const schema = z.union([text, values])
  expect(
    schema.parse(
      materializeToolExecutionInput(schema, {
        operation: { kind: "data", options: { value: null } },
      }),
    ),
  ).toEqual({ kind: "data", options: { value: null } })
})

test("materializes the production Office author default locale and literal blank cells", async () => {
  const parameters = (await WorkArtifactAuthorTool.init()).parameters
  const model = {
    id: "gpt-6.1-sol",
    providerID: "openai",
    api: { id: "gpt-6.1-sol", npm: "@ai-sdk/openai" },
  } as Provider.Model
  const prepared = asSchema(ProviderSchema.input(model, parameters))
  const providerInput = {
    operation: {
      profile: "office.spreadsheet@1",
      filename: "Handoff.xlsx",
      locale: null,
      sheets: [
        {
          name: "Records",
          columns: ["ID", "Amount"],
          rows: [
            ["N03", null],
            ["N04", 0],
          ],
        },
      ],
    },
  }
  const validate = new Ajv({ allErrors: true, strict: false, formats: { "date-time": true } }).compile(
    prepared.jsonSchema,
  )
  expect(validate(providerInput), JSON.stringify(validate.errors)).toBe(true)
  expect(await prepared.validate!(providerInput)).toEqual({
    success: true,
    value: {
      profile: "office.spreadsheet@1",
      filename: "Handoff.xlsx",
      locale: "en-US",
      sheets: [
        {
          name: "Records",
          columns: ["ID", "Amount"],
          rows: [
            ["N03", null],
            ["N04", 0],
          ],
        },
      ],
    },
  })
})

test("resolves nested object leaves and their payload references from the original schema root", () => {
  const schema = jsonSchema({
    anyOf: [{ $ref: "#/$defs/text" }, { oneOf: [{ $ref: "#/$defs/data" }] }],
    $defs: {
      text: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "payload"],
        properties: { kind: { const: "text" }, payload: { type: "string" } },
      },
      data: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "payload"],
        properties: { kind: { const: "data" }, payload: { $ref: "#/$defs/payload" } },
      },
      payload: {
        type: "object",
        additionalProperties: false,
        required: ["value"],
        properties: { value: { type: ["string", "null"] }, note: { type: "string" } },
      },
    },
  })
  expect(
    materializeToolExecutionInput(schema, {
      operation: { kind: "data", payload: { value: null, note: null } },
    }),
  ).toEqual({ kind: "data", payload: { value: null } })
})

test("reaches a valid object leaf through a recursive union reference", () => {
  const schema = jsonSchema({
    anyOf: [{ $ref: "#/$defs/nested" }],
    $defs: {
      nested: { anyOf: [{ $ref: "#/$defs/nested" }, { $ref: "#/$defs/data" }] },
      data: {
        type: "object",
        additionalProperties: false,
        required: ["kind"],
        properties: { kind: { const: "data" }, note: { type: "string" } },
      },
    },
  })
  expect(
    materializeToolExecutionInput(schema, {
      operation: { kind: "data", note: null },
    }),
  ).toEqual({ kind: "data" })
})
