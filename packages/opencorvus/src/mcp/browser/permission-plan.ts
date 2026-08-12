// Stable Browser provider identity. Authorization is enforced centrally by
// PermissionAuthority at the shared invocation boundary.
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
