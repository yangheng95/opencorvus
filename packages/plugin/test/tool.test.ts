import { describe, expect, test } from "bun:test"
import { tool } from "../src/tool"

describe("package tool definition", () => {
  test("introspects its description and JSON Schema from the executable bundle ABI", () => {
    const definition = tool({
      description: "Publish one named result.",
      args: {
        name: tool.schema.string().min(1),
        count: tool.schema.number().int().positive(),
      },
      async execute(args) {
        return `${args.name}:${args.count}`
      },
    })

    expect(definition.introspect()).toEqual({
      description: "Publish one named result.",
      inputSchema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          count: { type: "integer", exclusiveMinimum: 0, maximum: 9007199254740991 },
        },
        required: ["name", "count"],
        additionalProperties: false,
      },
    })
  })
})
