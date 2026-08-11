import { describe, expect, test } from "bun:test"

import { OfficialUsage } from "../../src/usage/official"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function openRouterKey(index: number) {
  return {
    created_at: "2026-08-01T00:00:00+00:00",
    updated_at: index === 100 ? null : "2026-08-02T00:00:00+00:00",
    hash: `hash-${index}`,
    label: `sk-or-v1-${index}`,
    name: `Key ${index}`,
    disabled: index === 100,
    limit: index % 2 === 0 ? 10 : null,
    limit_remaining: index % 2 === 0 ? 9.9 : null,
    limit_reset: index % 2 === 0 ? "monthly" : null,
    include_byok_in_limit: false,
    usage: 0.1,
    usage_daily: 0.01,
    usage_weekly: 0.02,
    usage_monthly: 0.03,
    byok_usage: 0.04,
    byok_usage_daily: 0.004,
    byok_usage_weekly: 0.008,
    byok_usage_monthly: 0.012,
  }
}

describe("official Provider usage aggregation", () => {
  test("paginates verified official interfaces and reconciles without adding overlapping ledgers", async () => {
    const requests: string[] = []
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url)
      requests.push(url.toString())
      if (url.hostname === "api.openai.com" && url.pathname.endsWith("/usage/completions")) {
        if (!url.searchParams.has("page")) {
          return json({
            data: [
              { results: [{ input_tokens: 100, output_tokens: 40, input_cached_tokens: 20, num_model_requests: 2 }] },
            ],
            has_more: true,
            next_page: "openai-next",
          })
        }
        return json({
          data: [{ results: [{ input_tokens: 10, output_tokens: 5, input_cached_tokens: 0, num_model_requests: 1 }] }],
          has_more: false,
          next_page: null,
        })
      }
      if (url.hostname === "api.openai.com" && url.pathname.endsWith("/organization/costs")) {
        expect(url.searchParams.getAll("group_by[]")).toEqual([])
        return json({
          data: [{ results: [{ amount: { currency: "usd", value: 1.25 } }] }],
          has_more: false,
          next_page: null,
        })
      }
      if (url.hostname === "api.anthropic.com" && url.pathname.endsWith("/usage_report/messages")) {
        return json({
          data: [
            {
              results: [
                {
                  uncached_input_tokens: 100,
                  cache_creation: { ephemeral_1h_input_tokens: 10, ephemeral_5m_input_tokens: 5 },
                  cache_read_input_tokens: 20,
                  output_tokens: 30,
                },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      }
      if (url.hostname === "api.anthropic.com" && url.pathname.endsWith("/cost_report")) {
        expect(url.searchParams.getAll("group_by[]")).toEqual(["description"])
        return json({
          data: [{ results: [{ amount: "123.45", currency: "USD" }] }],
          has_more: false,
          next_page: null,
        })
      }
      if (url.hostname === "openrouter.ai" && url.pathname === "/api/v1/credits") {
        return json({ data: { total_credits: 0.3, total_usage: 0.2 } })
      }
      if (url.hostname === "openrouter.ai" && url.pathname === "/api/v1/keys") {
        expect(url.searchParams.get("include_disabled")).toBe("true")
        expect(url.searchParams.has("workspace_id")).toBe(false)
        const offset = Number(url.searchParams.get("offset") ?? 0)
        return json({
          data: offset === 0 ? Array.from({ length: 100 }, (_, index) => openRouterKey(index)) : [openRouterKey(100)],
        })
      }
      throw new Error(`Unexpected official request ${url}`)
    }

    const result = await OfficialUsage.read(
      {
        start: Date.UTC(2026, 7, 1),
        end: Date.UTC(2026, 8, 1),
        local: [
          { providerID: "openai", tokens: 120, estimatedCostUSD: 0.2 },
          { providerID: "anthropic", tokens: 150, estimatedCostUSD: 1.1 },
        ],
      },
      {
        fetch: fetcher,
        env: (name) => `${name}-secret`,
        now: () => 1_786_406_400_000,
      },
    )

    const openai = result.sources.find((source) => source.id === "openai-organization")!
    expect(openai).toMatchObject({
      status: "available",
      tokens: { input: 110, output: 45, cacheRead: 20, total: 155, calls: 3, inputIncludesCache: true },
      costUSD: 1.25,
      reconciliation: {
        localTokens: 120,
        officialTokens: 155,
        tokenDelta: 35,
        localEstimatedCostUSD: 0.2,
        officialCostUSD: 1.25,
        costDeltaUSD: 1.05,
        additive: false,
      },
    })
    const anthropic = result.sources.find((source) => source.id === "anthropic-organization")!
    expect(anthropic).toMatchObject({
      status: "available",
      tokens: {
        input: 100,
        output: 30,
        cacheRead: 20,
        cacheWrite: 15,
        total: 165,
        calls: null,
        inputIncludesCache: false,
      },
      costUSD: 1.2345,
      reconciliation: { tokenDelta: 15, additive: false },
    })
    expect(result.sources.find((source) => source.id === "openrouter-account")).toMatchObject({
      status: "available",
      credits: { purchasedUSD: 0.3, usedUSD: 0.2, remainingUSD: 0.1 },
      keyUsage: {
        count: 101,
        activeCount: 100,
        limitedCount: 51,
        usageUSD: 10.1,
        usageMonthlyUSD: 3.03,
        byokUsageMonthlyUSD: 1.212,
      },
    })
    expect(result.sources.find((source) => source.id === "openrouter-account")!.keyUsage!.items[100]).toMatchObject({
      hash: "hash-100",
      disabled: true,
      usageUSD: 0.1,
      usageMonthlyUSD: 0.03,
      byokUsageUSD: 0.04,
      updatedAt: null,
    })
    expect(result.sources.filter((source) => source.status === "requires_configuration")).toHaveLength(3)
    expect(requests.filter((url) => url.includes("api.openai.com/v1/organization/usage/completions"))).toHaveLength(2)
    expect(requests.filter((url) => url.includes("openrouter.ai/api/v1/keys"))).toEqual([
      "https://openrouter.ai/api/v1/keys?include_disabled=true",
      "https://openrouter.ai/api/v1/keys?include_disabled=true&offset=100",
    ])
    expect(result.rule).toBe("compare_never_sum")
  })

  test("reports missing administrative scopes without issuing network requests or inventing zero usage", async () => {
    let calls = 0
    const result = await OfficialUsage.read(
      { start: 0, end: 1, local: [] },
      {
        fetch: async () => {
          calls++
          return json({})
        },
        env: () => undefined,
        now: () => 1,
      },
    )
    expect(calls).toBe(0)
    expect(result.sources.slice(0, 3).map((source) => source.status)).toEqual([
      "unconfigured",
      "unconfigured",
      "unconfigured",
    ])
    expect(result.sources.slice(0, 3).every((source) => source.tokens === null && source.costUSD === null)).toBe(true)
  })

  test("retains valid official usage when the independent financial ledger is unavailable", async () => {
    const result = await OfficialUsage.read(
      {
        start: Date.UTC(2026, 7, 1),
        end: Date.UTC(2026, 8, 1),
        local: [{ providerID: "openai", tokens: 10, estimatedCostUSD: 0.1 }],
      },
      {
        env: (name) => (name === "OPENAI_ADMIN_KEY" ? "secret" : undefined),
        fetch: async (input) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url)
          if (url.pathname.endsWith("/organization/costs")) return json({ error: "temporarily unavailable" }, 503)
          return json({
            data: [
              { results: [{ input_tokens: 10, output_tokens: 5, input_cached_tokens: 2, num_model_requests: 1 }] },
            ],
            has_more: false,
            next_page: null,
          })
        },
      },
    )
    expect(result.sources.find((source) => source.id === "openai-organization")).toMatchObject({
      status: "partial",
      tokens: { total: 15, calls: 1 },
      costUSD: null,
      reconciliation: { officialTokens: 15, officialCostUSD: null, costDeltaUSD: null, additive: false },
    })
  })

  test("marks OpenAI financial data partial when a cost row omits its amount", async () => {
    const result = await OfficialUsage.read(
      {
        start: Date.UTC(2026, 7, 1),
        end: Date.UTC(2026, 8, 1),
        local: [{ providerID: "openai", tokens: 10, estimatedCostUSD: 0.2 }],
      },
      {
        env: (name) => (name === "OPENAI_ADMIN_KEY" ? "secret" : undefined),
        fetch: async (input) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url)
          if (url.pathname.endsWith("/organization/costs")) {
            return json({ data: [{ results: [{}] }], has_more: false, next_page: null })
          }
          return json({
            data: [
              { results: [{ input_tokens: 10, output_tokens: 5, input_cached_tokens: 2, num_model_requests: 1 }] },
            ],
            has_more: false,
            next_page: null,
          })
        },
      },
    )
    expect(result.sources.find((source) => source.id === "openai-organization")).toMatchObject({
      status: "partial",
      tokens: { total: 15 },
      costUSD: null,
      reconciliation: { officialCostUSD: null, costDeltaUSD: null },
    })
  })

  test("keeps OpenRouter credits when its independent key ledger is unavailable", async () => {
    const result = await OfficialUsage.read(
      { start: 0, end: 1, local: [] },
      {
        env: (name) => (name === "OPENROUTER_MANAGEMENT_KEY" ? "secret" : undefined),
        fetch: async (input) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url)
          if (url.pathname === "/api/v1/keys") return json({ error: "forbidden" }, 403)
          return json({ data: { total_credits: 1, total_usage: 0.7 } })
        },
      },
    )
    expect(result.sources.find((source) => source.id === "openrouter-account")).toMatchObject({
      status: "partial",
      credits: { purchasedUSD: 1, usedUSD: 0.7, remainingUSD: 0.3 },
      keyUsage: null,
    })
  })
})
