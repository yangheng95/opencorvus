import { describe, expect, test } from "bun:test"

import { aggregateTurnUsage, type TurnUsageContribution } from "../src/utils/turn-usage"

describe("Conversation turn model usage projection", () => {
  test("returns complete totals and chronological per-model usage", () => {
    const contributions: TurnUsageContribution[] = [
      {
        messageID: "message-2",
        observedAt: 200,
        providerID: "anthropic",
        modelID: "claude-sonnet",
        display: "anthropic/claude-sonnet",
        inputTokens: 700,
        outputTokens: 120,
        reasoningTokens: 0,
        cacheReadTokens: 80,
        cacheWriteTokens: 20,
        totalTokens: 920,
        costUSD: 0.0552,
      },
      {
        messageID: "message-1",
        observedAt: 100,
        providerID: "openai",
        modelID: "gpt-5",
        display: "openai/gpt-5",
        inputTokens: 1_100,
        outputTokens: 190,
        reasoningTokens: 60,
        cacheReadTokens: 40,
        cacheWriteTokens: 0,
        totalTokens: 1_390,
        costUSD: 0.0982,
      },
      {
        messageID: "message-3",
        observedAt: 300,
        providerID: "openai",
        modelID: "gpt-5",
        display: "openai/gpt-5",
        inputTokens: 300,
        outputTokens: 50,
        reasoningTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 360,
        costUSD: 0.01,
      },
    ]

    expect(aggregateTurnUsage(contributions)).toEqual({
      inputTokens: 2_100,
      outputTokens: 360,
      reasoningTokens: 70,
      cacheReadTokens: 120,
      cacheWriteTokens: 20,
      totalTokens: 2_670,
      costUSD: 0.1634,
      models: [
        {
          providerID: "openai",
          modelID: "gpt-5",
          display: "openai/gpt-5",
          messageCount: 2,
          inputTokens: 1_400,
          outputTokens: 240,
          reasoningTokens: 70,
          cacheReadTokens: 40,
          cacheWriteTokens: 0,
          totalTokens: 1_750,
          costUSD: 0.1082,
        },
        {
          providerID: "anthropic",
          modelID: "claude-sonnet",
          display: "anthropic/claude-sonnet",
          messageCount: 1,
          inputTokens: 700,
          outputTokens: 120,
          reasoningTokens: 0,
          cacheReadTokens: 80,
          cacheWriteTokens: 20,
          totalTokens: 920,
          costUSD: 0.0552,
        },
      ],
    })
  })
})
