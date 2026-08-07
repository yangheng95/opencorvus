import type { BrowserRuntime } from "@/browser/runtime"

export const BROWSER_MCP_WEB_RESEARCH_PROXY_ENV = "OPENCORVUS_BROWSER_MCP_WEB_RESEARCH_PROXY"

export async function resolveBrowserMcpSessionProxy(
  explicitProxy?: BrowserRuntime.BrowserProxyConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BrowserRuntime.BrowserProxyConfig | undefined> {
  if (explicitProxy) return explicitProxy
  return resolveBrowserMcpEnvironmentProxy(env)
}

export function encodeBrowserMcpEnvironmentProxy(proxy: BrowserRuntime.BrowserProxyConfig): string {
  return JSON.stringify(proxy)
}

export function resolveBrowserMcpEnvironmentProxy(
  env: NodeJS.ProcessEnv = process.env,
): BrowserRuntime.BrowserProxyConfig | undefined {
  const raw = env[BROWSER_MCP_WEB_RESEARCH_PROXY_ENV]?.trim()
  if (!raw) return undefined
  return assertBrowserProxyConfig(JSON.parse(raw))
}

function assertBrowserProxyConfig(input: unknown): BrowserRuntime.BrowserProxyConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${BROWSER_MCP_WEB_RESEARCH_PROXY_ENV} must be a JSON object`)
  }
  const record = input as Record<string, unknown>
  if (typeof record.server !== "string" || !record.server.trim()) {
    throw new Error(`${BROWSER_MCP_WEB_RESEARCH_PROXY_ENV}.server must be a non-empty string`)
  }
  const proxy: BrowserRuntime.BrowserProxyConfig = { server: record.server }
  if (typeof record.bypass === "string" && record.bypass.trim()) proxy.bypass = record.bypass
  if (typeof record.username === "string" && record.username.trim()) proxy.username = record.username
  if (typeof record.password === "string" && record.password.trim()) proxy.password = record.password
  return proxy
}
