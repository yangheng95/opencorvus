import { describe, expect, test } from "bun:test"

import { assertLocaleCatalogParity, LocaleCatalogMismatchError } from "../script/check-i18n"

describe("i18n catalog contract", () => {
  test("accepts unordered locale keys with the same placeholder contract", () => {
    expect(() =>
      assertLocaleCatalogParity(
        "en-US",
        { usage: { count: "{{count}} calls for {{provider}}", title: "Usage" } },
        "zh-CN",
        { usage: { title: "用量", count: "{{provider}} 的调用数：{{count}}" } },
      ),
    ).not.toThrow()
  })

  test("maps a placeholder mismatch to the catalog contract error", () => {
    const mismatch = () =>
      assertLocaleCatalogParity("en-US", { usage: { count: "{{count}} calls" } }, "zh-CN", {
        usage: { count: "{{value}} 次调用" },
      })
    expect(mismatch).toThrow(LocaleCatalogMismatchError)
    expect(mismatch).toThrow("Locale placeholder mismatch at usage.count")
  })
})
