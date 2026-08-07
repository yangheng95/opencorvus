import { afterEach, describe, expect, test } from "bun:test"
import { loadAllLocales } from "../src/utils/i18n"

const originalFetch = globalThis.fetch
const originalAssetBase = (globalThis as any).__OPENCORVUS_ASSET_BASE__

afterEach(() => {
  globalThis.fetch = originalFetch
  ;(globalThis as any).__OPENCORVUS_ASSET_BASE__ = originalAssetBase
})

describe("i18n asset loading", () => {
  test("throws when a locale file cannot be loaded", async () => {
    ;(globalThis as any).__OPENCORVUS_ASSET_BASE__ = "vscode-webview://media-root/ui/"
    globalThis.fetch = (async () => {
      return new Response("missing", { status: 404 })
    }) as typeof fetch

    await expect(loadAllLocales()).rejects.toThrow(/Failed to load locale zh-CN: HTTP 404/)
  })

  test("uses the host-provided asset base for VS Code webview locale files", async () => {
    const urls: string[] = []
    ;(globalThis as any).__OPENCORVUS_ASSET_BASE__ = "vscode-webview://media-root/ui/"
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response(JSON.stringify({ welcome: { headline: "OpenCorvus" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    await loadAllLocales()

    expect(urls).toEqual([
      "vscode-webview://media-root/ui/i18n/zh-CN.json",
      "vscode-webview://media-root/ui/i18n/en-US.json",
    ])
  })

  test("does not refetch locale files once every supported locale is loaded", async () => {
    const urls: string[] = []
    ;(globalThis as any).__OPENCORVUS_ASSET_BASE__ = "vscode-webview://media-root/ui/"
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response("missing", { status: 500 })
    }) as typeof fetch

    await loadAllLocales()

    expect(urls).toEqual([])
  })
})
