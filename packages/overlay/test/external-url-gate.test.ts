import { describe, expect, test } from "bun:test"
import { externalUrl } from "../src/utils/external-url"

// What this pins
// ----------------
// The desktop host hands a URL to the OS opener, which refuses schemes it does
// not recognise. A browser has no such backstop: `window.open("javascript:…")`
// executes in the opener's origin. Now that the browser host implements
// `open-url`, this gate is what stands between an untrusted URL — the MCP App
// bridge forwards links authored by the app on screen — and `window.open`.
//
// Each rejection is pinned by its error contract, not by "did not open".

describe("externalUrl accepts", () => {
  test("http and https, preserving the exact target", () => {
    expect(externalUrl("https://opencorvus.com/docs").href).toBe("https://opencorvus.com/docs")
    expect(externalUrl("http://localhost:7878/ui/").href).toBe("http://localhost:7878/ui/")
  })

  test("query strings, fragments and ports", () => {
    const url = externalUrl("https://example.com:8443/a/b?q=1&r=2#frag")
    expect(url.port).toBe("8443")
    expect(url.search).toBe("?q=1&r=2")
    expect(url.hash).toBe("#frag")
  })

  test("surrounding whitespace", () => {
    expect(externalUrl("  https://example.com/  ").href).toBe("https://example.com/")
  })
})

describe("externalUrl rejects", () => {
  test("a scheme that would run in the page", () => {
    expect(() => externalUrl("javascript:alert(1)")).toThrow(/Only http\(s\) URLs/)
    expect(() => externalUrl("data:text/html,<script>alert(1)</script>")).toThrow(/Only http\(s\) URLs/)
  })

  test("other non-web schemes", () => {
    expect(() => externalUrl("file:///C:/Windows/System32")).toThrow(/Only http\(s\) URLs/)
    expect(() => externalUrl("vbscript:msgbox(1)")).toThrow(/Only http\(s\) URLs/)
  })

  test("embedded credentials", () => {
    expect(() => externalUrl("https://user:secret@example.com/")).toThrow(/embedded credentials/)
    expect(() => externalUrl("https://user@example.com/")).toThrow(/embedded credentials/)
  })

  test("a value that is not a URL at all", () => {
    expect(() => externalUrl("not a url")).toThrow(/Not a valid URL/)
    expect(() => externalUrl("/only/a/path")).toThrow(/Not a valid URL/)
  })

  test("an empty target", () => {
    expect(() => externalUrl("   ")).toThrow(/An external URL is required/)
  })
})
