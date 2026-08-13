import { describe, expect, test } from "bun:test"
import { browserMcpLiveViewUrl } from "../../src/mcp/browser/tools"
import { resolveBrowserMcpHeadless } from "../../src/mcp/browser/sessions"
import { browserMcpMonitorSelectionJson } from "../../src/mcp/browser/monitor"

describe("Browser MCP Live View contract", () => {
  test("publishes a session-selected loopback Live View URL", () => {
    expect(browserMcpLiveViewUrl("http://127.0.0.1:43127", "session a/b")).toBe(
      "http://127.0.0.1:43127/monitor?session=session+a%2Fb",
    )
  })

  test("embeds the selected session as script-safe JSON", () => {
    expect(browserMcpMonitorSelectionJson('session</script>&\u2028next')).toBe(
      '"session\\u003c/script\\u003e\\u0026\\u2028next"',
    )
  })

  test("opens a visible browser on desktop platforms by default", () => {
    expect(resolveBrowserMcpHeadless({}, "win32")).toBe(false)
    expect(resolveBrowserMcpHeadless({}, "darwin")).toBe(false)
  })

  test("uses headless mode for displayless Linux and explicit deployments", () => {
    expect(resolveBrowserMcpHeadless({}, "linux")).toBe(true)
    expect(resolveBrowserMcpHeadless({ DISPLAY: ":1" }, "linux")).toBe(false)
    expect(resolveBrowserMcpHeadless({ BROWSER_HEADLESS: "true" }, "win32")).toBe(true)
    expect(resolveBrowserMcpHeadless({ BROWSER_HEADLESS: "false" }, "linux")).toBe(false)
  })
})
