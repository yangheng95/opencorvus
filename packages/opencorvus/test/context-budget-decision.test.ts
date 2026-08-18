import { describe, expect, test } from "bun:test"
import { Token } from "../src/util/token"
import { SessionLoop } from "../src/session/loop"

describe("token estimate", () => {
  test("splits a string into dense-script and latin characters", () => {
    expect(Token.countScripts("abc")).toEqual({ dense: 0, latin: 3 })
    expect(Token.countScripts("财务报表")).toEqual({ dense: 4, latin: 0 })
    expect(Token.countScripts("報表 report")).toEqual({ dense: 2, latin: 7 })
    // Surrogate pairs count as one character, not two code units.
    expect(Token.countScripts("\u{20000}")).toEqual({ dense: 1, latin: 0 })
  })

  test("charges Han, Kana, and Hangul more per character than latin prose", () => {
    const latin = "abcdefghijkl" // 12 characters
    const han = "财务报表分析统计汇总合并" // 12 characters

    expect(Token.estimate(latin)).toBe(3)
    expect(Token.estimate(han)).toBe(8)
    expect(Token.estimate("ひらがなカタカナ")).toBeGreaterThan(Token.estimate("hiraganakatakana"))
    expect(Token.estimate("한글문서")).toBeGreaterThan(Token.estimate("hang"))
  })

  test("does not regress the latin ratio the character fallback assumes", () => {
    const latin = "x".repeat(400)
    expect(Token.estimate(latin)).toBe(Token.estimateCharacters(latin.length))
  })

  test("treats empty and non-finite input as zero", () => {
    expect(Token.estimate("")).toBe(0)
    expect(Token.estimateCharacters(0)).toBe(0)
    expect(Token.estimateCharacters(Number.NaN)).toBe(0)
    expect(Token.estimateCharacters(-10)).toBe(0)
  })
})

describe("predictive compaction decision", () => {
  const base = {
    totalTokensEst: 100_000,
    limit: 90_000,
    usableBudget: 100_000,
    systemTokensEst: 5_000,
    toolSchemaTokensEst: 5_000,
    messagePayloadTokensEst: 80_000,
    mediaTokensEst: 0,
    toolSchemaBudgetRatio: 0.5,
    lastFinishedSummary: false,
  }

  test("skips when the model reports no context, the last turn summarized, or the estimate fits", () => {
    expect(SessionLoop.predictiveCompactionDecision({ ...base, usableBudget: 0 })).toEqual({ kind: "skip" })
    expect(SessionLoop.predictiveCompactionDecision({ ...base, lastFinishedSummary: true })).toEqual({ kind: "skip" })
    expect(SessionLoop.predictiveCompactionDecision({ ...base, totalTokensEst: 80_000 })).toEqual({ kind: "skip" })
  })

  test("compacts when the compressible body can absorb the overflow", () => {
    expect(SessionLoop.predictiveCompactionDecision(base)).toEqual({ kind: "compact" })
  })

  test("fails fast when tool schemas alone overrun their share of the budget", () => {
    expect(
      SessionLoop.predictiveCompactionDecision({ ...base, toolSchemaTokensEst: 60_000 }),
    ).toEqual({ kind: "fail-tool-schema" })
  })

  test("fails when even a perfect compaction leaves the request over budget", () => {
    expect(
      SessionLoop.predictiveCompactionDecision({
        ...base,
        systemTokensEst: 45_000,
        toolSchemaTokensEst: 44_000,
      }),
    ).toEqual({ kind: "fail-prompt-budget", reason: "post-compaction-still-over" })
  })

  test("fails when the compressible body is smaller than the overflow it must absorb", () => {
    expect(
      SessionLoop.predictiveCompactionDecision({ ...base, messagePayloadTokensEst: 8_000 }),
    ).toEqual({ kind: "fail-prompt-budget", reason: "nothing-to-compress" })
  })

  test("counts media against the post-compaction floor", () => {
    expect(SessionLoop.predictiveCompactionDecision({ ...base, mediaTokensEst: 85_000 })).toEqual({
      kind: "fail-prompt-budget",
      reason: "post-compaction-still-over",
    })
  })

  test("a Chinese payload reaches the compaction decision the latin ratio would have missed", () => {
    // 40,000 Han characters: the old chars/4 estimate read 10,000 tokens and
    // skipped; the script-aware estimate reads ~26,667 and compacts.
    const payload = "财务报表分析".repeat(6_666) + "财务报表"
    const messagePayloadTokensEst = Token.estimate(payload)

    expect(Token.estimateCharacters(payload.length)).toBeLessThan(20_000)
    expect(messagePayloadTokensEst).toBeGreaterThan(20_000)

    expect(
      SessionLoop.predictiveCompactionDecision({
        ...base,
        totalTokensEst: 10_000 + messagePayloadTokensEst,
        limit: 20_000,
        usableBudget: 25_000,
        systemTokensEst: 5_000,
        toolSchemaTokensEst: 5_000,
        messagePayloadTokensEst,
      }),
    ).toEqual({ kind: "compact" })
  })
})

describe("model message payload estimate", () => {
  test("reports characters and a script-aware token estimate for the same payload", () => {
    const estimate = SessionLoop.estimateModelMessagePayload([
      { role: "user", content: [{ type: "text", text: "把季度财务报表整理成可复核的资料包" }] },
    ] as never)

    expect(estimate.messagePayloadChars).toBeGreaterThan(0)
    expect(estimate.messagePayloadTokensEst).toBeGreaterThan(
      Token.estimateCharacters(estimate.messagePayloadChars),
    )
  })

  test("keeps inline media out of the text estimate and charges it as media", () => {
    const estimate = SessionLoop.estimateModelMessagePayload([
      {
        role: "user",
        content: [{ type: "file", mediaType: "image/png", data: `data:image/png;base64,${"A".repeat(50_000)}` }],
      },
    ] as never)

    expect(estimate.messagePayloadChars).toBeLessThan(1_000)
    expect(estimate.mediaCounts.image).toBeGreaterThan(0)
    expect(estimate.mediaTokensEst).toBeGreaterThan(0)
  })
})
