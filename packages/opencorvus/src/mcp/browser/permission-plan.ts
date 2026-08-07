import { PermissionNext } from "@/permission/next"

export type McpPermissionPlan = Pick<PermissionNext.Request, "permission" | "patterns" | "metadata" | "always">

export const BROWSER_MCP_PERMISSION_BASELINE: PermissionNext.Ruleset = [
  { permission: "browser.navigate.localhost", pattern: "*", action: "allow" },
  { permission: "browser.navigate.external", pattern: "*", action: "allow" },
  { permission: "browser.evaluate", pattern: "*", action: "allow" },
  { permission: "browser.upload_file", pattern: "*", action: "allow" },
  { permission: "browser.profile.persist", pattern: "*", action: "allow" },
  { permission: "browser.profile.reuse", pattern: "*", action: "allow" },
  { permission: "browser.storage.export", pattern: "*", action: "allow" },
  { permission: "browser.storage.import", pattern: "*", action: "allow" },
  { permission: "browser.download", pattern: "*", action: "allow" },
  { permission: "browser.trace", pattern: "*", action: "allow" },
  { permission: "browser.click.force", pattern: "*", action: "allow" },
]

// MCP means Model Context Protocol. This identity is bound to projected Browser
// tools so their hashed provider names do not erase the underlying permission key.
export type BrowserMcpToolKey = `browser_${string}`

const browserMcpPermissionKey = Symbol("opencorvus.browser-mcp-permission-key")

export function browserMcpToolKey(serverName: string, toolName: string): BrowserMcpToolKey | undefined {
  return serverName === "browser" ? `browser_${toolName}` : undefined
}

export function browserMcpToolKeyFromRuntimeName(toolKey: string): BrowserMcpToolKey | undefined {
  return toolKey.startsWith("browser_") ? (toolKey as BrowserMcpToolKey) : undefined
}

export function bindBrowserMcpPermissionKey<T extends object>(tool: T, key: BrowserMcpToolKey): T {
  Object.defineProperty(tool, browserMcpPermissionKey, {
    value: key,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function browserMcpPermissionKeyOf(tool: object | undefined): BrowserMcpToolKey | undefined {
  return tool && (tool as { [browserMcpPermissionKey]?: BrowserMcpToolKey })[browserMcpPermissionKey]
}

export async function executeBrowserMcpToolWithPermission<T>(input: {
  key: BrowserMcpToolKey
  args: unknown
  sessionID: string
  messageID: string
  callID: string
  rulesets: readonly (PermissionNext.Ruleset | undefined)[]
  execute: () => Promise<T>
}): Promise<T> {
  await PermissionNext.ask({
    ...mcpPermissionPlan(input.key, input.args),
    sessionID: input.sessionID,
    tool: { messageID: input.messageID, callID: input.callID },
    ruleset: PermissionNext.merge(BROWSER_MCP_PERMISSION_BASELINE, ...input.rulesets),
  })
  return input.execute()
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

const stringArg = (args: unknown, key: string): string | undefined => {
  if (!isPlainRecord(args)) return
  const value = args[key]
  return typeof value === "string" ? value : undefined
}

const booleanArg = (args: unknown, key: string): boolean | undefined => {
  if (!isPlainRecord(args)) return
  const value = args[key]
  return typeof value === "boolean" ? value : undefined
}

const originPattern = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.origin === "null" ? parsed.href : parsed.origin
  } catch {
    return url
  }
}

const isLocalhostUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost")
  } catch {
    return false
  }
}

export function mcpPermissionPlan(key: string, args: unknown): McpPermissionPlan {
  if (key === "browser_navigate") {
    const url = stringArg(args, "url") ?? "*"
    const pattern = originPattern(url)
    const localhost = isLocalhostUrl(url)
    return {
      permission: localhost ? "browser.navigate.localhost" : "browser.navigate.external",
      patterns: [pattern],
      always: [pattern],
      metadata: { tool: key, url, origin: pattern },
    }
  }

  if (key === "browser_evaluate") {
    const expression = stringArg(args, "expression") ?? ""
    return {
      permission: "browser.evaluate",
      patterns: ["*"],
      always: ["*"],
      metadata: {
        tool: key,
        expressionPreview: expression.slice(0, 120),
        expressionChars: expression.length,
      },
    }
  }

  if (key === "browser_upload_file") {
    const filePath = stringArg(args, "filePath") ?? "*"
    return {
      permission: "browser.upload_file",
      patterns: [filePath],
      always: [filePath],
      metadata: { tool: key, filePath, selector: stringArg(args, "selector") },
    }
  }

  if (key === "browser_storage_state_export") {
    const sessionId = stringArg(args, "sessionId") ?? "*"
    return {
      permission: "browser.storage.export",
      patterns: [sessionId],
      always: [sessionId],
      metadata: { tool: key, sessionId },
    }
  }

  if (key === "browser_storage_state_import") {
    return {
      permission: "browser.storage.import",
      patterns: ["*"],
      always: ["*"],
      metadata: { tool: key },
    }
  }

  if (key === "browser_download") {
    const selector = stringArg(args, "selector")
    return {
      permission: "browser.download",
      patterns: [selector ?? "*"],
      always: [selector ?? "*"],
      metadata: { tool: key, selector },
    }
  }

  if (key === "browser_session_create" && stringArg(args, "profileId")) {
    const profileId = stringArg(args, "profileId")!
    return {
      permission: "browser.profile.reuse",
      patterns: [profileId],
      always: [profileId],
      metadata: { tool: key, profileId },
    }
  }

  if (key === "browser_session_destroy" && stringArg(args, "preserveProfile")) {
    const preserveProfile = stringArg(args, "preserveProfile")!
    return {
      permission: "browser.profile.persist",
      patterns: [preserveProfile],
      always: [preserveProfile],
      metadata: { tool: key, preserveProfile },
    }
  }

  if ((key === "browser_click" || key === "browser_double_click") && booleanArg(args, "force")) {
    return {
      permission: "browser.click.force",
      patterns: ["*"],
      always: ["*"],
      metadata: { tool: key, x: isPlainRecord(args) ? args.x : undefined, y: isPlainRecord(args) ? args.y : undefined },
    }
  }

  return {
    permission: key,
    patterns: ["*"],
    always: ["*"],
    metadata: {},
  }
}
