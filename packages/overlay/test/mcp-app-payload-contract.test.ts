import { expect, test } from "bun:test"

import { mcpAppContentSecurityPolicy, mcpAppDownloadBytes } from "../src/services/mcp-app-payload"

test("MCP App content security policy materializes declared capability domains", () => {
  const defaultPolicy = mcpAppContentSecurityPolicy(undefined)
  expect(defaultPolicy).toContain("connect-src 'none'")
  expect(defaultPolicy).toContain("script-src 'unsafe-inline' blob:")
  expect(mcpAppContentSecurityPolicy({ connectDomains: ["https://api.example.com"] })).toContain(
    "connect-src https://api.example.com",
  )
  expect(mcpAppContentSecurityPolicy({ resourceDomains: ["https://cdn.example.com"] })).toContain(
    "script-src 'unsafe-inline' blob: https://cdn.example.com",
  )
})

test("MCP App downloads materialize valid bytes and explicit size errors", () => {
  expect([...mcpAppDownloadBytes({ text: "ok" }, 2)]).toEqual([111, 107])
  expect([...mcpAppDownloadBytes({ text: "é" }, 2)]).toEqual([195, 169])
  expect([...mcpAppDownloadBytes({ blob: btoa("abc") }, 3)]).toEqual([97, 98, 99])
  expect(() => mcpAppDownloadBytes({ text: "é" }, 1)).toThrow("exceeds")
  expect(() => mcpAppDownloadBytes({ blob: btoa("abc") }, 2)).toThrow("exceeds")
  expect(() => mcpAppDownloadBytes({}, 20)).toThrow("no text or blob")
})
