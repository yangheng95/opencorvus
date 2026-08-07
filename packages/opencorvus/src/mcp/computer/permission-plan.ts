import { PermissionNext } from "@/permission/next"
import type { McpPermissionPlan } from "@/mcp/browser/permission-plan"
import { ComputerMCPBuiltin } from "./builtin"

export const COMPUTER_MCP_PERMISSION_BASELINE: PermissionNext.Ruleset = [
  { permission: "computer.session.create", pattern: "*", action: "allow" },
  { permission: "computer.observe", pattern: "*", action: "allow" },
  { permission: "computer.input", pattern: "*", action: "allow" },
  { permission: "computer.session.destroy", pattern: "*", action: "allow" },
]

// MCP means Model Context Protocol. Direct Conversation and exact Expert Squad
// projections retain this stable identity for the canonical Session evaluator.
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

export function computerMcpToolKeyFromRuntimeName(toolKey: string): ComputerMcpToolKey | undefined {
  return COMPUTER_MCP_TOOL_KEYS.has(toolKey as ComputerMcpToolKey) ? (toolKey as ComputerMcpToolKey) : undefined
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

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const stringIdentity = (args: unknown, snake: string, camel: string): string => {
  const input = record(args)
  const value = input?.[snake] ?? input?.[camel]
  return typeof value === "string" && value.length > 0 ? value : "*"
}

export function computerMcpPermissionPlan(key: ComputerMcpToolKey, args: unknown): McpPermissionPlan {
  const computerId = stringIdentity(args, "computer_id", "computerId")
  const displayId = stringIdentity(args, "display_id", "displayId")
  const metadata = { tool: key, computerId, displayId }
  if (key === "computer_session_create") {
    return {
      permission: "computer.session.create",
      patterns: ["vm-only"],
      always: ["vm-only"],
      metadata: { tool: key, target: "vm-only" },
    }
  }
  if (key === "computer_observe") {
    return {
      permission: "computer.observe",
      patterns: [computerId],
      always: [computerId],
      metadata,
    }
  }
  if (key === "computer_session_destroy") {
    return {
      permission: "computer.session.destroy",
      patterns: [computerId],
      always: [computerId],
      metadata,
    }
  }
  return {
    permission: "computer.input",
    patterns: [computerId],
    always: [computerId],
    metadata,
  }
}

export async function executeComputerMcpToolWithPermission<T>(input: {
  key: ComputerMcpToolKey
  args: unknown
  sessionID: string
  messageID: string
  callID: string
  rulesets: readonly (PermissionNext.Ruleset | undefined)[]
  execute: () => Promise<T>
}): Promise<T> {
  await PermissionNext.ask({
    ...computerMcpPermissionPlan(input.key, input.args),
    sessionID: input.sessionID,
    tool: { messageID: input.messageID, callID: input.callID },
    ruleset: PermissionNext.merge(COMPUTER_MCP_PERMISSION_BASELINE, ...input.rulesets),
  })
  return input.execute()
}
