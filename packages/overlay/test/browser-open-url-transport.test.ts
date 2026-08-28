import { afterEach, describe, expect, test } from "bun:test"
import { createTauriTransport } from "../src/services/tauri-transport"

// What this pins
// ----------------
// The browser host implements `open-url` with `window.open`. Two things about
// that call are easy to get wrong and invisible without a test:
//
//   1. `window.open` returns null whenever `noopener` or `noreferrer` is set —
//      by specification, on success exactly as on failure. Treating that null
//      as "the popup was blocked" reports every successful open as an error.
//      The fake below returns null for that reason: a transport that inspects
//      the return value fails this file.
//   2. `noopener,noreferrer` has to actually be passed, or the opened page can
//      reach back through `window.opener`.
//
// Scheme and credential rejection is pinned here too, at the transport rather
// than only at the validator, because this is the boundary that reaches
// `window.open`.

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")

interface OpenCall {
  url: string
  target: string
  features: string
}

function installBrowserHost(): OpenCall[] {
  const calls: OpenCall[] = []
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      // Mirrors the real return value under noopener: always null.
      open(url: string, target: string, features: string) {
        calls.push({ url, target, features })
        return null
      },
    },
  })
  return calls
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
  else delete (globalThis as Record<string, unknown>).window
})

describe("browser host open-url", () => {
  test("opens the exact URL in a new tab, severed from this page", async () => {
    const calls = installBrowserHost()
    const transport = createTauriTransport("browser")

    await expect(transport.native({ kind: "open-url", url: "https://opencorvus.com/market/" })).resolves.toBe(true)

    expect(calls).toEqual([
      { url: "https://opencorvus.com/market/", target: "_blank", features: "noopener,noreferrer" },
    ])
  })

  test("resolves even though window.open returns null under noopener", async () => {
    installBrowserHost()
    const transport = createTauriTransport("browser")

    // The fake returns null, as a real browser does here. Resolving true is the
    // contract: with noopener set there is no return value that could tell an
    // opened tab from a blocked one.
    await expect(transport.native({ kind: "open-url", url: "https://example.com/" })).resolves.toBe(true)
  })

  test("normalises the target before handing it over", async () => {
    const calls = installBrowserHost()
    const transport = createTauriTransport("browser")

    await transport.native({ kind: "open-url", url: "  https://example.com/a?b=1#c  " })

    expect(calls[0]?.url).toBe("https://example.com/a?b=1#c")
  })

  test("rejects a scheme that would execute in this page", async () => {
    installBrowserHost()
    const transport = createTauriTransport("browser")

    await expect(transport.native({ kind: "open-url", url: "javascript:alert(1)" })).rejects.toThrow(
      /Only http\(s\) URLs/,
    )
  })

  test("rejects a URL carrying embedded credentials", async () => {
    installBrowserHost()
    const transport = createTauriTransport("browser")

    await expect(transport.native({ kind: "open-url", url: "https://user:secret@example.com/" })).rejects.toThrow(
      /embedded credentials/,
    )
  })
})
