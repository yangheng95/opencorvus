import { describe, expect, test } from "bun:test"
import { supportedLocaleFromRuntime } from "../src/utils/i18n"

describe("first-open runtime locale selection", () => {
  test("maps Chinese runtime locale variants to Chinese", () => {
    expect(
      ["zh", "zh-CN", "zh-TW", "zh-Hans-CN", "zh_HK"].map((locale) => supportedLocaleFromRuntime(locale)),
    ).toEqual(["zh-CN", "zh-CN", "zh-CN", "zh-CN", "zh-CN"])
  })

  test("maps every other runtime locale to English", () => {
    expect(
      ["en-US", "fr-FR", "ja-JP", "yue-HK", "", undefined].map((locale) => supportedLocaleFromRuntime(locale)),
    ).toEqual(["en-US", "en-US", "en-US", "en-US", "en-US", "en-US"])
  })
})
