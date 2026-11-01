import { describe, expect, test } from "bun:test"

import { assertLocaleCatalogParity, LocaleCatalogMismatchError, readLocaleCatalog } from "../script/check-i18n"

describe("i18n catalog contract", () => {
  test("reads nested catalog values and independently scoped property names", () => {
    expect(readLocaleCatalog("example", '{"left":{"label":"A"},"right":{"label":"B"},"items":["C",2,true,null]}'))
      .toEqual({ left: { label: "A" }, right: { label: "B" }, items: ["C", 2, true, null] })
  })

  test("maps decoded duplicate properties to a catalog error with the original location", () => {
    const parse = () => readLocaleCatalog("example", '{"entry":1,"\\u0065ntry":2}')
    expect(parse).toThrow(LocaleCatalogMismatchError)
    expect(parse).toThrow("Locale example has duplicate key at entry (offset 11)")
  })

  test("reports duplicate properties inside nested array objects", () => {
    expect(() => readLocaleCatalog("example", '{"items":[{"label":"A","label":"B"}]}'))
      .toThrow("Locale example has duplicate key at items[0].label")
  })

  test("maps malformed JSON to a catalog error with its parser diagnosis", () => {
    expect(() => readLocaleCatalog("example", '{"entry":}'))
      .toThrow("Locale example has invalid JSON at offset 9: ValueExpected")
  })

  test("maps a non-object root to the declared catalog error", () => {
    expect(() => readLocaleCatalog("example", '["value"]'))
      .toThrow("Locale example must be a JSON object")
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
