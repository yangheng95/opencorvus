import { describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import type { Provider } from "@/provider/provider"
import { ContextBudget } from "@/session/context-budget"
import { SessionLoop } from "@/session/loop"

const model = { limit: { context: 1_050_000, input: 922_000, output: 128_000 } } as Provider.Model

describe("configured compaction context window", () => {
  test("uses a 256k default window and compacts before its ceiling", () => {
    const budget = ContextBudget.predictiveLimit({ config: {}, model })!
    expect(ContextBudget.capacity({ config: {}, model })).toEqual({ status: "known", tokens: 256_000 })
    expect(budget).toEqual({ usableBudget: 256_000, threshold: 0.9, limit: 230_400 })
    expect(ContextBudget.preserveRecent({ config: {}, model })).toBe(64_000)
    expect(
      SessionLoop.predictiveCompactionDecision({
        ...budget,
        totalTokensEst: 240_000,
        systemTokensEst: 5_000,
        toolSchemaTokensEst: 5_000,
        messagePayloadTokensEst: 230_000,
        mediaTokensEst: 0,
        toolSchemaBudgetRatio: 0.5,
      }),
    ).toEqual({ kind: "compact" })
  })

  test("accepts an explicit larger window within model and output capacity", () => {
    const config = Config.Info.parse({ compaction: { max_context_tokens: 512_000 } })
    expect(ContextBudget.capacity({ config, model })).toEqual({ status: "known", tokens: 512_000 })
    expect(ContextBudget.predictiveLimit({ config, model })).toEqual({
      usableBudget: 512_000,
      threshold: 0.9,
      limit: 460_800,
    })
    expect(
      ContextBudget.capacity({
        config: Config.Info.parse({ compaction: { max_context_tokens: 2_000_000 } }),
        model,
      }),
    ).toEqual({ status: "known", tokens: 922_000 })
    expect(
      ContextBudget.capacity({
        config,
        model: { limit: { context: 200_000, input: 190_000, output: 40_000 } } as Provider.Model,
        effectiveOutputTokens: 30_000,
      }),
    ).toEqual({ status: "known", tokens: 170_000 })
  })

  test("bounds requested recent retention and unknown model capacity by the runtime window", () => {
    const config = Config.Info.parse({ compaction: { preserve_recent_tokens: 800_000 } })
    expect(ContextBudget.preserveRecent({ config, model })).toBe(230_400)
    expect(
      ContextBudget.capacity({
        config: {},
        model: { limit: { context: 0, output: 8_000 } } as Provider.Model,
      }),
    ).toEqual({ status: "known", tokens: 256_000 })
    expect(
      ContextBudget.capacity({
        config: Config.Info.parse({ compaction: { auto: false } }),
        model,
      }),
    ).toEqual({ status: "known", tokens: 256_000 })
  })

  test("validates a positive whole-token ceiling", () => {
    for (const [value, code] of [
      [0, "too_small"],
      [1.5, "invalid_type"],
    ] as const) {
      const result = Config.Info.safeParse({ compaction: { max_context_tokens: value } })
      if (result.success) throw new Error("Expected a configuration validation error")
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code, path: ["compaction", "max_context_tokens"] })]),
      )
    }
  })
})
