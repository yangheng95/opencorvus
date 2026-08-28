import { ComputerMCPBuiltin } from "./builtin"

// Stable Computer provider identity. Authorization is enforced centrally by
// PermissionAuthority at the shared invocation boundary.
export type ComputerMcpToolKey = `computer_${ComputerMCPBuiltin.ToolName}`

const COMPUTER_MCP_TOOL_KEYS = new Set<ComputerMcpToolKey>(
  ComputerMCPBuiltin.ImportableToolNames.map((toolName): ComputerMcpToolKey => `computer_${toolName}`),
)

const computerMcpPermissionKey = Symbol("opencorvus.computer-mcp-permission-key")

export function computerMcpToolKey(serverName: string, toolName: string): ComputerMcpToolKey | undefined {
  if (serverName !== ComputerMCPBuiltin.ServerName) return undefined
  const key = `computer_${toolName}` as ComputerMcpToolKey
  return COMPUTER_MCP_TOOL_KEYS.has(key) ? key : undefined
}

export function bindComputerMcpPermissionKey<T extends object>(tool: T, key: ComputerMcpToolKey): T {
  Object.defineProperty(tool, computerMcpPermissionKey, {
    value: key,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function computerMcpPermissionKeyOf(tool: object | undefined): ComputerMcpToolKey | undefined {
  return tool && (tool as { [computerMcpPermissionKey]?: ComputerMcpToolKey })[computerMcpPermissionKey]
}
