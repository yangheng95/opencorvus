import { afterEach, describe, expect, test } from "bun:test"
import { loadAllLocales, t } from "../src/utils/i18n"

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("locale data loading", () => {
  test("reports the requested locale URL and HTTP failure", async () => {
    globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch
    const url = new URL("../src/i18n/zh-CN.json", import.meta.url).href
    await expect(loadAllLocales()).rejects.toThrow(`Failed to load locale zh-CN: HTTP 404 ${url}`)
  })

  test("retains the parse cause and resource address for invalid JSON", async () => {
    globalThis.fetch = (async () => new Response("invalid")) as typeof fetch
    const result = await loadAllLocales().catch((error: Error) => error)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe(
      `Failed to load locale zh-CN: invalid JSON from ${new URL("../src/i18n/zh-CN.json", import.meta.url).href}`,
    )
    expect((result as Error).cause).toBeInstanceOf(SyntaxError)
  })

  test("reports an invalid catalog shape", async () => {
    globalThis.fetch = (async () => Response.json([])) as typeof fetch
    await expect(loadAllLocales()).rejects.toThrow(
      `Failed to load locale zh-CN: expected JSON object from ${new URL("../src/i18n/zh-CN.json", import.meta.url).href}`,
    )
  })

  test("loads catalogs relative to the executing module and publishes their values", async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return Response.json({ welcome: { headline: "OpenCorvus" } })
    }) as typeof fetch
    await loadAllLocales()
    expect(urls).toEqual(
      ["zh-CN", "en-US"].map((locale) => new URL(`../src/i18n/${locale}.json`, import.meta.url).href),
    )
    expect(t("welcome.headline")).toBe("OpenCorvus")
    await loadAllLocales()
    expect(t("welcome.headline")).toBe("OpenCorvus")
  })
})
