import { describe, expect, test } from "bun:test"
import type { LanguageModelUsage } from "ai"

import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"

function model(input: { available: boolean; npm?: string }): Provider.Model {
  return {
    id: "usage-model",
    providerID: "usage-provider",
    name: "Usage Model",
    api: { id: "usage-model", npm: input.npm ?? "@ai-sdk/openai", url: "https://provider.test/v1" },
    status: "active",
    headers: {},
    options: {},
    cost: {
      available: input.available,
      input: 1,
      output: 2,
      cache: { read: 0.1, write: 1.25 },
    },
    limit: { context: 1_000_000, output: 64_000 },
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: { text: true, audio: false, image: true, video: false, pdf: true },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "2026-08-11",
  }
}

function usage(input?: Partial<LanguageModelUsage>): LanguageModelUsage {
  return {
    inputTokens: 1_000,
    inputTokenDetails: {
      noCacheTokens: 780,
      cacheReadTokens: 200,
      cacheWriteTokens: 20,
    },
    outputTokens: 300,
    outputTokenDetails: {
      textTokens: 220,
      reasoningTokens: 80,
    },
    totalTokens: 1_300,
    raw: undefined,
    ...input,
  }
}

describe("Provider-neutral usage normalization", () => {
  test("projects AI SDK 6 token details and charges every output token exactly once", () => {
    expect(
      Session.getUsage({
        model: model({ available: true }),
        usage: usage(),
      }),
    ).toEqual({
      billing: { status: "priced" },
      cost: 0.001425,
      tokens: {
        total: 1_300,
        input: 780,
        output: 220,
        reasoning: 80,
        cache: { read: 200, write: 20 },
      },
    })
  })

  test("keeps measured usage while exposing an unpriced Provider model", () => {
    expect(
      Session.getUsage({
        model: model({ available: false, npm: "@ai-sdk/openai-compatible" }),
        usage: usage({
          inputTokens: 120,
          inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 20, cacheWriteTokens: 0 },
          outputTokens: 30,
          outputTokenDetails: { textTokens: 30, reasoningTokens: 0 },
          totalTokens: 150,
        }),
      }),
    ).toEqual({
      billing: { status: "unpriced" },
      cost: 0.000162,
      tokens: {
        total: 150,
        input: 100,
        output: 30,
        reasoning: 0,
        cache: { read: 20, write: 0 },
      },
    })
  })

  test("uses normalized component totals when an Anthropic-family adapter omits a provider total", () => {
    expect(
      Session.getUsage({
        model: model({ available: true, npm: "@ai-sdk/anthropic" }),
        usage: usage({ totalTokens: undefined }),
      }).tokens,
    ).toEqual({
      total: 1_300,
      input: 780,
      output: 220,
      reasoning: 80,
      cache: { read: 200, write: 20 },
    })
  })

  test("uses the request-time over-200K rate without double-charging reasoning output", () => {
    const priced = model({ available: true, npm: "@ai-sdk/anthropic" })
    priced.cost.experimentalOver200K = {
      input: 2,
      output: 4,
      cache: { read: 0.2, write: 0.5 },
    }

    expect(
      Session.getUsage({
        model: priced,
        usage: usage({
          inputTokens: 250_000,
          inputTokenDetails: { noCacheTokens: 210_000, cacheReadTokens: 30_000, cacheWriteTokens: 10_000 },
          outputTokens: 1_000,
          outputTokenDetails: { textTokens: 800, reasoningTokens: 200 },
          totalTokens: 251_000,
        }),
      }),
    ).toEqual({
      billing: { status: "priced" },
      cost: 0.435,
      tokens: {
        total: 251_000,
        input: 210_000,
        output: 800,
        reasoning: 200,
        cache: { read: 30_000, write: 10_000 },
      },
    })
  })

  test("includes cache-write input when selecting the over-200K price tier", () => {
    const priced = model({ available: true, npm: "@ai-sdk/anthropic" })
    priced.cost.experimentalOver200K = {
      input: 2,
      output: 4,
      cache: { read: 0.2, write: 0.5 },
    }

    expect(
      Session.getUsage({
        model: priced,
        usage: usage({
          inputTokens: 211_000,
          inputTokenDetails: { noCacheTokens: 190_000, cacheReadTokens: 1_000, cacheWriteTokens: 20_000 },
          outputTokens: 1_000,
          outputTokenDetails: { textTokens: 1_000, reasoningTokens: 0 },
          totalTokens: 212_000,
        }),
      }).cost,
    ).toBe(0.3942)
  })
})
