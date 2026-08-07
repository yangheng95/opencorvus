import { describe, expect, test } from "bun:test"
import { normalizeDiscoveryText, scoreDiscoveryFields } from "../../src/capability/fuzzy"

describe("capability fuzzy relevance", () => {
  test("normalizes Unicode and ranks exact, Chinese phrase, and English typo queries with positive scores", () => {
    expect(normalizeDiscoveryText("  ＯＦＦＩＣＥ／Artifacts  ")).toBe("office artifacts")

    const exact = scoreDiscoveryFields("office-artifacts", [{ text: "office-artifacts", weight: 1 }])
    const chinese = scoreDiscoveryFields("制作办公文档和演示文稿", [
      { text: "办公文档生成 演示文稿和电子表格 制作PPT Word文档 Excel表格", weight: 0.94 },
    ])
    const typo = scoreDiscoveryFields("offce artifcts", [{ text: "office-artifacts", weight: 1 }])

    expect(exact).toBe(1)
    expect(chinese).toBeGreaterThan(0.22)
    expect(typo).toBeGreaterThan(0.22)
  })
})
