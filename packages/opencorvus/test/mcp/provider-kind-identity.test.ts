import { describe, expect, test } from "bun:test"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { mcpToolProviderKind } from "../../src/mcp/provider-kind"

describe("MCP tool provider kind", () => {
  test("the builtin servers own their provider kind", () => {
    expect(mcpToolProviderKind({ serverID: BrowserMCPBuiltin.ServerName, isMcpApp: false })).toBe("browser")
    expect(mcpToolProviderKind({ serverID: ComputerMCPBuiltin.ServerName, isMcpApp: false })).toBe("computer")
  })

  test("a builtin keeps its provider kind even when the tool also has an app binding", () => {
    expect(mcpToolProviderKind({ serverID: BrowserMCPBuiltin.ServerName, isMcpApp: true })).toBe("browser")
    expect(mcpToolProviderKind({ serverID: ComputerMCPBuiltin.ServerName, isMcpApp: true })).toBe("computer")
  })

  test("a configured server that only sanitizes into the builtin's runtime prefix is not the builtin", () => {
    // `${serverID}_${toolName}` is sanitized with /[^a-zA-Z0-9_-]/g -> "_", so
    // `browser.v2` projects tools named `browser_v2_<tool>`. Matching that
    // prefix used to hand this server the builtin's provider kind.
    const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_")
    const runtimeName = `${sanitize("browser.v2")}_${sanitize("navigate")}`
    expect(runtimeName.startsWith(`${BrowserMCPBuiltin.ServerName}_`)).toBe(true)
    expect(mcpToolProviderKind({ serverID: "browser.v2", isMcpApp: false })).toBe("mcp")
  })

  test("an ordinary server is an ordinary MCP provider, and its app tools are mcp_app", () => {
    expect(mcpToolProviderKind({ serverID: "some-package-mcp-server", isMcpApp: false })).toBe("mcp")
    expect(mcpToolProviderKind({ serverID: "some-package-mcp-server", isMcpApp: true })).toBe("mcp_app")
  })
})
