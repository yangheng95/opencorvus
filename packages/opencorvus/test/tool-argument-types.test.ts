import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { resolveSessionExecutionAuthority } from "../src/engine/task-session-lineage"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { EditTool } from "../src/tool/edit"
import { ReadTool } from "../src/tool/read"
import { Tool } from "../src/tool/tool"
import { WriteTool } from "../src/tool/write"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function withContext(run: (directory: string, context: Tool.Context) => Promise<void>) {
  await using project = await memoryProject("tool-argument-types")
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Tool argument type contract" })
    await run(project.path, {
      sessionID: session.id, messageID: "message_tool_argument_types", callID: "call_tool_argument_types",
      agent: "coding", abort: new AbortController().signal, messages: [],
      executionAuthority: await resolveSessionExecutionAuthority({
        sessionID: session.id, projectID: Instance.project.id, expected: { kind: "conversation" },
      }),
      executionSurface: Tool.executionSurface(["read", "write", "edit"], []),
      metadata() {},
    })
  } })
}

test.each(["true", "false"])("reads the literal file named %s", async (name) => {
  await withContext(async (directory, ctx) => {
    await fs.writeFile(path.join(directory, name), `literal path ${name}\n`)
    const result = await (await ReadTool.init()).execute({ filePath: name }, ctx)
    expect(result.output).toContain(`1: literal path ${name}`)
    expect(result.sources![0]).toMatchObject({ title: name, path: path.join(directory, name) })
  })
}, 30_000)

test.each(["true", "false"])("writes the exact literal content %s", async (content) => {
  await withContext(async (directory, ctx) => {
    const filePath = path.join(directory, `written-${content}.txt`)
    const result = await (await WriteTool.init()).execute({ filePath, content }, ctx)
    expect(result.output).toBe("Wrote file successfully.")
    expect(await fs.readFile(filePath, "utf8")).toBe(content)
  })
}, 30_000)

test("edits literal boolean-looking text with both real boolean options", async () => {
  await withContext(async (directory, ctx) => {
    const filePath = path.join(directory, "toggle.txt")
    await fs.writeFile(filePath, "false false")
    await (await ReadTool.init()).execute({ filePath }, ctx)
    const edit = await EditTool.init()
    const all = await edit.execute({ filePath, oldString: "false", newString: "true", replaceAll: true }, ctx)
    expect(await fs.readFile(filePath, "utf8")).toBe("true true")
    expect(all.metadata.filediff).toMatchObject({ before: "false false", after: "true true" })
    const one = await edit.execute({ filePath, oldString: "true true", newString: "false", replaceAll: false }, ctx)
    expect(await fs.readFile(filePath, "utf8")).toBe("false")
    expect(one.metadata.filediff).toMatchObject({ before: "true true", after: "false" })
  })
}, 30_000)

test("a union preserves the actual string and boolean input variants", async () => {
  await withContext(async (_directory, ctx) => {
    const tool = await Tool.define("argument-union-contract", {
      description: "Observe the declared parameter value",
      parameters: z.object({ value: z.union([z.string(), z.boolean()]) }),
      async execute(args) { return { title: "Union value", output: JSON.stringify(args), metadata: { ...args, truncated: false } } },
    }).init()
    for (const value of ["true", "false", true, false]) {
      expect((await tool.execute({ value }, ctx)).metadata.value).toBe(value)
    }
  })
}, 30_000)

test("the declared schema owns scalar conversion and nested literal strings", async () => {
  await withContext(async (_directory, ctx) => {
    const tool = await Tool.define("argument-schema-contract", {
      description: "Observe the parsed parameter object",
      parameters: z.object({
        label: z.string(), count: z.coerce.number().int(),
        nested: z.object({ label: z.string(), enabled: z.boolean() }), values: z.array(z.string()),
      }),
      async execute(args) { return { title: "Parsed values", output: JSON.stringify(args), metadata: { args, truncated: false } } },
    }).init()
    const args = { label: "true", count: "3", nested: { label: "false", enabled: false }, values: ["true", "false"] }
    expect((await tool.execute(args as never, ctx)).metadata.args).toEqual({ ...args, count: 3 })
  })
}, 30_000)

test("boolean fields accept booleans and defaults and return a typed error for a string", async () => {
  await withContext(async (_directory, ctx) => {
    const tool = await Tool.define("argument-boolean-contract", {
      description: "Observe the declared boolean",
      parameters: z.object({ enabled: z.boolean().default(false) }),
      async execute(args) { return { title: "Boolean value", output: JSON.stringify(args), metadata: { ...args, truncated: false } } },
    }).init()
    for (const enabled of [true, false]) expect((await tool.execute({ enabled }, ctx)).metadata.enabled).toBe(enabled)
    expect((await tool.execute({} as never, ctx)).metadata.enabled).toBe(false)
    await expect(tool.execute({ enabled: "false" } as never, ctx)).rejects.toMatchObject({
      cause: { name: "ZodError", issues: [{ code: "invalid_type", expected: "boolean", path: ["enabled"] }] },
    })
  })
}, 30_000)
