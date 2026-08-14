import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { createLocalMcpProcessDiagnostics } from "@/mcp/local-process-diagnostics"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("local MCP process diagnostics", () => {
  test("publishes a correlated safe failure and structured redacted child diagnostics", async () => {
    await using project = await memoryProject()
    const fixture = path.join(project.path, "diagnostic-mcp.mjs")
    await fs.writeFile(
      fixture,
      [
        'import readline from "node:readline";',
        "const write = (value) => process.stderr.write(value);",
        'write("authorization: Bear");',
        'setTimeout(() => write("er header-fixture-value\\n"), 1);',
        'setTimeout(() => write("x-api-key=api-fixture-value\\n"), 2);',
        'setTimeout(() => write("cookie: session=cookie-fixture-value\\n"), 3);',
        'setTimeout(() => write(`opaque ${process.env.MCP_DIAGNOSTIC_TEST_SECRET}\\n`), 4);',
        'const unicode = Buffer.from(`unicode 你 ${process.env.MCP_DIAGNOSTIC_TEST_SECRET}\\n`);',
        'setTimeout(() => write(unicode.subarray(0, 9)), 5);',
        'setTimeout(() => write(unicode.subarray(9)), 6);',
        'setTimeout(() => write("x".repeat(4_100) + "\\n"), 7);',
        "const rl = readline.createInterface({ input: process.stdin });",
        "rl.on('line', (line) => {",
        "  const request = JSON.parse(line);",
        "  if (request.method !== 'initialize') return;",
        "  setTimeout(() => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: process.env.MCP_DIAGNOSTIC_TEST_SECRET } }) + '\\n'), 20);",
        "});",
      ].join("\n"),
    )

    const key = `diagnostic-${crypto.randomUUID()}`
    const result = await Instance.provide({
      directory: project.path,
      fn: () =>
        MCP.add(key, {
          type: "local",
          command: [process.execPath, fixture],
          environment: { MCP_DIAGNOSTIC_TEST_SECRET: "environment-fixture-value" },
          timeout: 10_000,
        }),
    })
    const status = result.status[key]
    expect(status).toMatchObject({ status: "failed" })
    if (!status || status.status !== "failed") throw new Error("Expected local MCP startup to fail")
    const match = /^Local MCP startup failed \(diagnostic ID: ([0-9a-f-]{36})\)$/.exec(status.error)
    expect(match?.[1]).toBeString()

    await Log.flush()
    const records = (await Log.read({ lines: 400 })).lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((record) => record["service"] === "mcp" && record["key"] === key)
    expect(
      records.filter((record) => record["message"] === "local mcp stderr").map((record) => record["diagnostic"]),
    ).toEqual([
      "authorization: <redacted>",
      "x-api-key=<redacted>",
      "cookie: <redacted>",
      "opaque <redacted>",
      "unicode 你 <redacted>",
      "[local MCP stderr line omitted: exceeded 4000 characters]",
    ])
    expect(records.find((record) => record["message"] === "local mcp startup failed")).toMatchObject({
      diagnosticID: match![1],
      cwd: project.path,
      stderr: [
        "authorization: <redacted>",
        "x-api-key=<redacted>",
        "cookie: <redacted>",
        "opaque <redacted>",
        "unicode 你 <redacted>",
        "[local MCP stderr line omitted: exceeded 4000 characters]",
      ].join("\\x0a"),
      error: "MCP error -32000: <redacted>",
    })
  }, 30_000)

  test("protects labelled credentials before replacing short exact environment values across UTF-8 chunks", () => {
    const diagnostics: string[] = []
    const collector = createLocalMcpProcessDiagnostics({
      environment: { TOKEN: "a" },
      onDiagnostic: (line) => diagnostics.push(line),
    })
    const bytes = Buffer.from("authorization: second-secret\nunicode 你 a\n")
    const split = Buffer.byteLength("authorization: second-secret\nunicode ") + 1
    collector.write(bytes.subarray(0, split))
    collector.write(bytes.subarray(split))
    collector.finish()

    expect(diagnostics).toEqual(["authorization: <redacted>", "unicode 你 <redacted>"])
  })
})
