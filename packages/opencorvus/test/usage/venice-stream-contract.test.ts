import { afterEach, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { Config } from "@/config/config"
import { streamText } from "@/llm/api"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import { Server } from "@/server/server"
import { Session } from "@/session"
import type { UsageStats } from "@/usage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const require = createRequire(import.meta.url)
const scenarios = [
  {
    name: "default reporting preserves the official total",
    raw: { prompt_tokens: 612, completion_tokens: 146, total_tokens: 758 },
    expected: { total: 758, input: 612, output: 146, reasoning: 0, cache: { read: 0, write: 0 } },
    cost: 0.000904,
  },
  {
    name: "input cache and output reasoning are exclusive components",
    constructorUsage: true,
    raw: {
      prompt_tokens: 1000,
      completion_tokens: 300,
      total_tokens: 1300,
      prompt_tokens_details: { cached_tokens: 200, cache_creation_input_tokens: 20 },
      completion_tokens_details: { reasoning_tokens: 80 },
    },
    expected: { total: 1300, input: 780, output: 220, reasoning: 80, cache: { read: 200, write: 20 } },
    cost: 0.001425,
  },
  {
    name: "per-call reporting overrides the provider setting",
    constructorUsage: false,
    callUsage: true,
    raw: { prompt_tokens: 612, completion_tokens: 146, total_tokens: 758 },
    expected: { total: 758, input: 612, output: 146, reasoning: 0, cache: { read: 0, write: 0 } },
    cost: 0.000904,
  },
  {
    name: "an explicit provider false remains the protocol value",
    constructorUsage: false,
    raw: { prompt_tokens: 612, completion_tokens: 146, total_tokens: 758 },
  },
  {
    name: "an explicit per-call false is sent as the protocol value",
    constructorUsage: true,
    callUsage: false,
    raw: { prompt_tokens: 612, completion_tokens: 146, total_tokens: 758 },
  },
]

afterEach(async () => {
  await Provider.resetAll()
  await resetMemoryDatabase()
})

for (const format of ["registry-esm", "published-commonjs"] as const) {
  for (const scenario of scenarios) {
    test(`${format}: ${scenario.name}`, async () => {
      const packets: Record<string, any>[] = []
      const participant = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const packet = (await request.json()) as Record<string, any>
          packets.push(packet)
          const base = { id: "owned-venice-contract", object: "chat.completion.chunk", created: 1, model: packet.model }
          const delta = {
            ...base,
            choices: [{ index: 0, delta: { content: "Owned protocol result" }, finish_reason: null }],
          }
          const stop = {
            ...base,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            ...(packet.stream_options?.include_usage === true ? { usage: scenario.raw } : {}),
          }
          return new Response(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`, {
            headers: { "Content-Type": "text/event-stream" },
          })
        },
      })
      try {
        await using project = await memoryProject()
        const http = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
        try {
          await Instance.provide({
            directory: project.path,
            fn: async () => {
              const options = {
                apiKey: "owned-local-participant",
                timeout: false,
                ...("constructorUsage" in scenario ? { includeUsage: scenario.constructorUsage } : {}),
              }
              const config = Config.Info.parse({
                enabled_providers: ["venice-contract"],
                provider: {
                  "venice-contract": {
                    api: new URL("v1", participant.url).href,
                    npm: "venice-ai-sdk-provider",
                    options,
                    models: {
                      "exact-protocol-model": {
                        name: "Owned protocol model",
                        reasoning: true,
                        limit: { context: 10000, output: 1000 },
                        cost: { input: 1, output: 2, cache_read: 0.1, cache_write: 1.25 },
                      },
                    },
                  },
                },
              })
              const model = await Provider.getModel("venice-contract", "exact-protocol-model", { config })
              const language =
                format === "registry-esm"
                  ? await Provider.getLanguage(model, { config })
                  : require("venice-ai-sdk-provider")
                      .createVenice({
                        name: model.providerID,
                        baseURL: new URL("v1", participant.url).href,
                        ...options,
                      })
                      .languageModel(model.api.id)
              const result = streamText({
                model: ProviderLLM.wrapModel(language, model, {}),
                timeoutMs: false,
                prompt: "Measure the declared local protocol input",
                ...("callUsage" in scenario
                  ? { providerOptions: { [model.providerID]: { streamOptions: { includeUsage: scenario.callUsage } } } }
                  : {}),
              })
              expect(await result.text).toBe("Owned protocol result")
              expect(packets).toHaveLength(1)
              expect(packets[0]).toMatchObject({
                model: "exact-protocol-model",
                stream: true,
                stream_options: { include_usage: scenario.callUsage ?? scenario.constructorUsage ?? true },
              })
              const usage = await result.usage
              const response = await fetch(`http://${http.hostname}:${http.port}/global/usage?period=day&timeZone=UTC`)
              expect(response.status).toBe(200)
              const stats = (await response.json()) as UsageStats.Response
              expect(stats.current.summary.calls).toBe(1)
              if ("expected" in scenario) {
                expect(usage.totalTokens).toBe(scenario.expected.total)
                expect(Session.getUsage({ model, usage })).toEqual({
                  tokens: scenario.expected,
                  cost: scenario.cost,
                  billing: { status: "priced" },
                })
                const tokens = {
                  total: scenario.expected.total,
                  input: scenario.expected.input,
                  output: scenario.expected.output,
                  reasoning: scenario.expected.reasoning,
                  cacheRead: scenario.expected.cache.read,
                  cacheWrite: scenario.expected.cache.write,
                }
                expect(stats.current.summary.tokens).toEqual(tokens)
                expect(stats.current.summary.costUSD).toBeCloseTo(scenario.cost, 12)
                expect(stats.current.summary.billing.pricedTokens).toBe(scenario.expected.total)
                expect(stats.providers[0]).toMatchObject({
                  providerID: model.providerID,
                  modelCount: 1,
                  summary: { tokens },
                })
                expect(stats.models[0]).toMatchObject({
                  providerID: model.providerID,
                  modelID: model.id,
                  summary: { calls: 1, tokens },
                })
                expect(stats.buckets.reduce((total, bucket) => total + bucket.tokens.total, 0)).toBe(
                  scenario.expected.total,
                )
              }
            },
          })
        } finally {
          await http.stop(true)
        }
      } finally {
        await participant.stop(true)
      }
    }, 30000)
  }
}
