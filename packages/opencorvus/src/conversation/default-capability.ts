import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"

export const DEFAULT_INTERACTIVE_MCP_SERVER_REFS = Object.freeze([
  BrowserMCPBuiltin.ServerName,
  ComputerMCPBuiltin.ServerName,
] as const)
