import { afterEach, describe, expect, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"

import { streamText } from "../../src/llm/api"
import { Instance } from "../../src/project/instance"
import { ProviderLLM } from "../../src/provider/llm"
import type { Provider } from "../../src/provider/provider"
import { UsageStats } from "../../src/usage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model: Provider.Model = {
  id: "ledger-model",
  providerID: "ledger-provider",
  name: "Ledger model",
  api: { id: "ledger-model", npm: "@ai-sdk/openai-compatible", url: "https://provider.test/v1" },
  status: "active",
  headers: {},
  options: {},
  cost: { available: true, input: 1, output: 2, cache: { read: 0.1, write: 0.5 } },
  limit: { context: 100_000, output: 10_000 },
  capabilities: {
    temperature: true,
    reasoning: true,
    attachment: false,
    toolcall: true,
    input: { text: true, audio: false, image: false, video: false, pdf: false },
    output: { text: true, audio: false, image: false, video: false, pdf: false },
    interleaved: false,
  },
  release_date: "2026-08-11",
  variants: {},
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("shared streamed-call usage ledger", () => {
  test("records a non-Session helper stream exactly once at the common wrapper", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const language = new MockLanguageModelV3({
          provider: model.providerID,
          modelId: model.id,
          async doStream() {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "text" },
                  { type: "text-delta", id: "text", delta: "ok" },
                  { type: "text-end", id: "text" },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: "stop" },
                    usage: {
                      inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 0 },
                      outputTokens: { total: 30, text: 25, reasoning: 5 },
                    },
                  },
                ],
              }),
            }
          },
        })
        const result = streamText({
          model: ProviderLLM.wrapModel(language, model, {}),
          usagePurpose: "metric-judge",
          prompt: "measure this",
          timeoutMs: false,
        })
        for await (const _part of result.fullStream) {
          // Exhausting the real stream reaches the shared onStepFinish persistence callback.
        }

        const stats = await UsageStats.read({ period: "month", timeZone: "UTC" })
        expect(stats.current.summary).toMatchObject({
          tokens: { input: 100, output: 25, reasoning: 5, cacheRead: 20, cacheWrite: 0, total: 150 },
          calls: 1,
          billing: { pricedTokens: 150, percent: 100 },
        })
        expect(stats.providers).toHaveLength(1)
        expect(stats.providers[0]).toMatchObject({ providerID: "ledger-provider", modelCount: 1 })
      },
    })
  })
})
