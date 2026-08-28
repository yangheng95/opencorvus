import { describe, expect, test } from "bun:test"
import {
  browserMcpIsolatedFallbackPermitted,
  resolveBrowserMcpConnectionConfig,
} from "../../src/mcp/browser/sessions"

describe("Browser launch policy states its identity boundary", () => {
  test("the default policy asks for the attached Chrome and does not permit another identity", () => {
    expect({
      config: resolveBrowserMcpConnectionConfig({}, "win32"),
      crossing: browserMcpIsolatedFallbackPermitted({}),
    }).toEqual({
      config: { mode: "cdp", channel: "chrome" },
      crossing: false,
    })
  })

  test("an explicit chrome policy still refuses to cross into an isolated browser", () => {
    const env = { OPENCORVUS_BROWSER_MODE: "chrome" }
    expect({
      config: resolveBrowserMcpConnectionConfig(env, "win32"),
      crossing: browserMcpIsolatedFallbackPermitted(env),
    }).toEqual({
      config: { mode: "cdp", channel: "chrome" },
      crossing: false,
    })
  })

  test("a caller that accepts the other identity says so, and still asks for Chrome first", () => {
    const env = { OPENCORVUS_BROWSER_MODE: "chrome_or_isolated" }
    expect({
      config: resolveBrowserMcpConnectionConfig(env, "win32"),
      crossing: browserMcpIsolatedFallbackPermitted(env),
    }).toEqual({
      config: { mode: "cdp", channel: "chrome" },
      crossing: true,
    })
  })

  test("choosing isolated outright is its own mode, not a crossing", () => {
    const env = { OPENCORVUS_BROWSER_MODE: "isolated" }
    expect(resolveBrowserMcpConnectionConfig(env, "linux")).toMatchObject({ mode: "isolated" })
  })

  test("an explicit CDP endpoint is an attached identity the caller named", () => {
    expect(
      resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_CDP_ENDPOINT: "http://127.0.0.1:9222" }, "win32"),
    ).toEqual({ mode: "cdp", endpointURL: "http://127.0.0.1:9222" })
  })

  test("an unknown policy is refused rather than interpreted", () => {
    expect(() => resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_MODE: "whatever" }, "win32")).toThrow(
      "Expected chrome, chrome_or_isolated or isolated",
    )
  })
})
