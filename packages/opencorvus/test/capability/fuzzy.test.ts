import { describe, expect, test } from "bun:test"
import { normalizeDiscoveryText, scoreDiscoveryFields, scoreDocumentField } from "../../src/capability/fuzzy"
import { SEPARATORLESS_FILLER_CHARACTERS } from "../../src/capability/discovery-filler"

describe("capability fuzzy relevance", () => {
  test("scores identically whether or not another query was scored in between", () => {
    // The separatorless run table used to be memoized in module-level `let`
    // bindings keyed by the last query, so this module carried process state
    // across unrelated calls. Interleaving two queries is the observation that
    // distinguishes a pure scorer from one that does.
    const fields = [{ text: "把财务报表、科目余额与季度分析证据整合为可复核的财务运营资料包。", weight: 0.94 }]
    const other = [{ text: "为团队做一份可复用的排班表。", weight: 0.94 }]

    const isolated = scoreDiscoveryFields("季度财务报表分析", fields)
    scoreDiscoveryFields("排班表", other)
    const interleaved = scoreDiscoveryFields("季度财务报表分析", fields)

    expect(interleaved).toBe(isolated)
    expect(isolated).toBeGreaterThan(0.22)
  })

  test("keeps the filler table as data, and keeps compounds out of it", () => {
    // A run is dropped only when every character is filler, so a compound built
    // from two filler characters must still be scored as the request's own term.
    expect(SEPARATORLESS_FILLER_CHARACTERS).toContain("个")
    expect(SEPARATORLESS_FILLER_CHARACTERS).not.toContain("人")
    expect(scoreDiscoveryFields("帮我做一个", [{ text: "季度财务报表分析包", weight: 1 }])).toBeUndefined()
  })

  test("normalizes Unicode and ranks exact, Chinese phrase, and English typo queries with positive scores", () => {
    expect(normalizeDiscoveryText("  ＯＦＦＩＣＥ／Artifacts  ")).toBe("office artifacts")

    const exact = scoreDiscoveryFields("work-artifacts", [{ text: "work-artifacts", weight: 1 }])
    const chinese = scoreDiscoveryFields("制作办公文档和演示文稿", [
      { text: "办公文档生成 演示文稿和电子表格 制作PPT Word文档 Excel表格", weight: 0.94 },
    ])
    const typo = scoreDiscoveryFields("wrok artifcts", [{ text: "work-artifacts", weight: 1 }])

    expect(exact).toBe(1)
    expect(chinese).toBeGreaterThan(0.22)
    expect(typo).toBeGreaterThan(0.22)
  })

  test("scores a conversational Chinese request by its own terms, not by its filler", () => {
    const relevant = scoreDiscoveryFields("帮我做一份季度财务报表分析", [
      { text: "把财务报表、科目余额与季度分析证据整合为可复核的财务运营资料包。", weight: 0.94 },
    ])
    const fillerOnly = scoreDiscoveryFields("帮我做一份季度财务报表分析", [
      { text: "为团队做一份可复用的排班表，帮你把一个个班次安排好。", weight: 0.94 },
    ])

    expect(relevant).toBeGreaterThan(0.4)
    expect(fillerOnly).toBeUndefined()
  })

  test("counts whole words, inflections, and prefixes differently from an unrelated word that merely contains the token", () => {
    const own = scoreDiscoveryFields("plan a product roadmap", [
      { text: "Product discovery, prioritization, and roadmap choices.", weight: 0.9 },
    ])
    const incidental = scoreDiscoveryFields("plan a product roadmap", [
      { text: "Seasonal production planning and biosecurity evidence.", weight: 0.9 },
    ])
    const inflected = scoreDiscoveryFields("translate documentation", [
      { text: "Translation memory and locale documentation review.", weight: 0.9 },
    ])

    expect(own).toBeGreaterThan(incidental ?? 0)
    expect(inflected).toBeGreaterThan(0.22)
  })

  test("keeps scattered document tokens below a matching phrase in the same document", () => {
    const document =
      "Reserving analysis reviews the unpaid claim triangle. Legal counsel signs the contract addendum. " +
      "Review evidence is retained for the audit."
    const scattered = scoreDocumentField("review a legal contract", document)
    const phrase = scoreDocumentField("unpaid claim triangle", document)

    expect(phrase).toBeGreaterThan(scattered)
    expect(scattered).toBeLessThan(scoreDiscoveryFields("review a legal contract", [{ text: document, weight: 1 }])!)
  })
})
