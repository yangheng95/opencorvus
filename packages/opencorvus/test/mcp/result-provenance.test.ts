import { afterEach, describe, expect, test } from "bun:test"
import { materializeMcpToolResult } from "../../src/mcp/materialize"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/** A payload whose shape matches the Computer observation contract. */
function computerShapedResult() {
  return {
    content: [{ type: "text" as const, text: "done" }],
    structuredContent: {
      computer_id: "computer-1",
      display_id: "display-1",
      cursor: { x: 1, y: 2 },
      screen: { width: 100, height: 50 },
    },
  }
}

describe("MCP result semantics come from the provider, not the payload shape", () => {
  test("the Computer builtin's own result is materialized as a Computer observation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const materialized = await materializeMcpToolResult({
          projectID: Instance.project.id,
          result: computerShapedResult(),
          serverName: ComputerMCPBuiltin.ServerName,
        })
        expect(materialized.metadata).toHaveProperty("computer")
      },
    })
  }, 60_000)

  test("a generic MCP server whose payload happens to match gets no Computer treatment", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const materialized = await materializeMcpToolResult({
          projectID: Instance.project.id,
          result: computerShapedResult(),
          serverName: "some-package-mcp-server",
        })
        expect({
          computer: (materialized.metadata as Record<string, unknown>).computer,
          browser: (materialized.metadata as Record<string, unknown>).browser,
          text: materialized.text,
        }).toEqual({ computer: undefined, browser: undefined, text: "done" })
      },
    })
  }, 60_000)

  test("a caller that cannot name its provider receives neither builtin's semantics", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const materialized = await materializeMcpToolResult({
          projectID: Instance.project.id,
          result: computerShapedResult(),
        })
        expect((materialized.metadata as Record<string, unknown>).computer).toBeUndefined()
      },
    })
  }, 60_000)

  test("the Browser builtin keeps its own observation materialization", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const materialized = await materializeMcpToolResult({
          projectID: Instance.project.id,
          result: { content: [{ type: "text" as const, text: "page" }], structuredContent: { url: "https://x.test" } },
          serverName: BrowserMCPBuiltin.ServerName,
        })
        // Whatever the Browser materializer decides, the Computer one never runs.
        expect((materialized.metadata as Record<string, unknown>).computer).toBeUndefined()
      },
    })
  }, 60_000)
})
