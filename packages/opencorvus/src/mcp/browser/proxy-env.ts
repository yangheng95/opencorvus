import { resolveWebResearchBrowserProxy } from "@/browser/proxy"
import { BROWSER_MCP_WEB_RESEARCH_PROXY_ENV, encodeBrowserMcpEnvironmentProxy } from "./session-proxy"

export async function browserMcpBridgeEnvironment(base: Record<string, string>): Promise<Record<string, string>> {
  const env = { ...base }
  delete env[BROWSER_MCP_WEB_RESEARCH_PROXY_ENV]

  const browserProxy = await resolveWebResearchBrowserProxy()
  if (browserProxy) {
    env[BROWSER_MCP_WEB_RESEARCH_PROXY_ENV] = encodeBrowserMcpEnvironmentProxy(browserProxy)
  }
  return env
}
