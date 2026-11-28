import { afterEach, describe, expect, test } from "bun:test"
import { fillTemplate, loadAllLocales, setLocale, t, translationTemplate } from "../src/utils/i18n"

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("locale data loading", () => {
  for (const locale of ["en-US", "zh-CN"]) {
    const url = new URL(`../src/i18n/${locale}.json`, import.meta.url).href
    const reply = (failure: () => Response) => {
      globalThis.fetch = (async (input: RequestInfo | URL) =>
        String(input) === url ? failure() : Response.json({ contract: { value: "loaded catalog" } })) as typeof fetch
    }

    test(`reports the ${locale} resource and HTTP failure`, async () => {
      reply(() => new Response("missing", { status: 404 }))
      await expect(loadAllLocales()).rejects.toThrow(`Failed to load locale ${locale}: HTTP 404 ${url}`)
    })

    test(`retains the ${locale} JSON parse cause and resource`, async () => {
      reply(() => new Response("invalid"))
      const result = await loadAllLocales().catch((error: Error) => error)
      expect(result).toBeInstanceOf(Error)
      expect((result as Error).message).toBe(`Failed to load locale ${locale}: invalid JSON from ${url}`)
      expect((result as Error).cause).toBeInstanceOf(SyntaxError)
    })

    test(`reports the ${locale} catalog shape error`, async () => {
      reply(() => Response.json([]))
      await expect(loadAllLocales()).rejects.toThrow(`Failed to load locale ${locale}: expected JSON object from ${url}`)
    })
  }

  test("loads catalogs relative to the executing module and publishes their values", async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return Response.json({
        contract: {
          value: "loaded catalog",
          greeting: String(input).endsWith("en-US.json") ? "Hello {{name}}" : "你好，{{name}}",
        },
      })
    }) as typeof fetch
    await loadAllLocales()
    expect(new Set(urls)).toEqual(
      new Set(["zh-CN", "en-US"].map((locale) => new URL(`../src/i18n/${locale}.json`, import.meta.url).href)),
    )
    expect(t("contract.value")).toBe("loaded catalog")
    await setLocale("en-US")
    const captured = translationTemplate("contract.greeting")
    expect(captured).toBe("Hello {{name}}")
    expect(t("contract.greeting", { name: "Ada" })).toBe("Hello Ada")
    await setLocale("zh-CN")
    expect(t("contract.greeting", { name: "林" })).toBe("你好，林")
    expect(fillTemplate(captured, { name: "Grace" })).toBe("Hello Grace")
    await loadAllLocales()
    expect(t("contract.value")).toBe("loaded catalog")
  })
})
