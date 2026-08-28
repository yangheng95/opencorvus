import { BrowserMCPBuiltin } from "./browser/builtin"
import { ComputerMCPBuiltin } from "./computer/builtin"

export type McpToolProviderKind = "browser" | "computer" | "mcp_app" | "mcp"

/**
 * The provider kind of a projected MCP tool, decided by the configured server
 * ID the tool was projected from — the same identity `browserMcpToolKey` and
 * `computerMcpToolKey` bind at projection time.
 *
 * The runtime tool name is not an identity. It is `${sanitize(serverID)}_${sanitize(toolName)}`,
 * and sanitization maps every character outside `[A-Za-z0-9_-]` to `_`, so a
 * configured server named `browser.v2` produces the same `browser_…` prefix the
 * builtin does. Matching that prefix handed an unrelated server the builtin's
 * provider kind, and with it the builtin's permission treatment and result
 * materialization.
 *
 * Server-ID equality is a sufficient identity here because the configuration
 * authority reserves both IDs: `Config` refuses a `browser` or a `computer`
 * entry that is not that builtin's own declaration, so no other server can
 * occupy either ID. This mapping therefore never has to re-prove what the
 * configuration already guarantees.
 */
export function mcpToolProviderKind(input: { serverID: string; isMcpApp: boolean }): McpToolProviderKind {
  if (input.serverID === BrowserMCPBuiltin.ServerName) return "browser"
  if (input.serverID === ComputerMCPBuiltin.ServerName) return "computer"
  return input.isMcpApp ? "mcp_app" : "mcp"
}
