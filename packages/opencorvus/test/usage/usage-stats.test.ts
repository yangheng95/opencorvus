import { afterEach, describe, expect, test } from "bun:test"
import { DateTime } from "luxon"

import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { UsageLedger, UsageStats } from "../../src/usage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function tokens(total: number, input: number, output: number, reasoning = 0) {
  return { total, input, output, reasoning, cache: { read: 0, write: 0 } }
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("natural-period Provider usage", () => {
  test("aggregates current and previous calendar months with deterministic Provider and model rows", () => {
    const timeZone = "Asia/Shanghai"
    const window = UsageStats.resolveWindow({
      period: "month",
      timeZone,
      now: DateTime.fromISO("2026-08-11T12:00:00", { zone: timeZone }).toMillis(),
    })
    const result = UsageStats.aggregate(
      [
        {
          id: "previous",
          occurredAt: DateTime.fromISO("2026-07-07T08:00:00", { zone: timeZone }).toMillis(),
          providerID: "openai",
          modelID: "gpt-5",
          tokens: tokens(500, 400, 100),
          costUSD: 0.02,
          billing: { status: "priced" },
        },
        {
          id: "current-openai",
          occurredAt: DateTime.fromISO("2026-08-02T09:00:00", { zone: timeZone }).toMillis(),
          providerID: "openai",
          modelID: "gpt-5",
          tokens: tokens(1_000, 700, 250, 50),
          costUSD: 0.04,
          billing: { status: "priced" },
        },
        {
          id: "current-anthropic",
          occurredAt: DateTime.fromISO("2026-08-10T18:00:00", { zone: timeZone }).toMillis(),
          providerID: "anthropic",
          modelID: "claude-sonnet",
          tokens: tokens(600, 500, 100),
          costUSD: 0,
          billing: { status: "unpriced" },
        },
      ],
      window,
    )

    expect(result.current.summary).toEqual({
      tokens: { input: 1_200, output: 350, reasoning: 50, cacheRead: 0, cacheWrite: 0, total: 1_600 },
      costUSD: 0.04,
      calls: 2,
      averageTokensPerCall: 800,
      billing: { pricedTokens: 1_000, unpricedTokens: 600, unknownTokens: 0, percent: 62.5 },
    })
    expect(result.previous.summary.tokens.total).toBe(500)
    expect(result.comparison).toEqual({ tokensPercent: 220.00000000000003, costPercent: 100, callsPercent: 100 })
    expect(result.buckets).toHaveLength(31)
    expect(result.providers.map((row) => [row.providerID, row.summary.tokens.total])).toEqual([
      ["openai", 1_000],
      ["anthropic", 600],
    ])
    expect(result.models.map((row) => `${row.providerID}/${row.modelID}`)).toEqual([
      "openai/gpt-5",
      "anthropic/claude-sonnet",
    ])
  })

  test("uses the real IANA day length across daylight-saving time", () => {
    const window = UsageStats.resolveWindow({
      period: "day",
      timeZone: "America/New_York",
      now: DateTime.fromISO("2026-03-08T12:00:00", { zone: "America/New_York" }).toMillis(),
    })
    const result = UsageStats.aggregate([], window)

    expect(result.buckets).toHaveLength(23)
    expect(result.current.end - result.current.start).toBe(23 * 60 * 60 * 1_000)
    expect(result.current.summary.billing.percent).toBeNull()
  })

  test("uses the 25-hour IANA day across the daylight-saving fallback", () => {
    const window = UsageStats.resolveWindow({
      period: "day",
      timeZone: "America/New_York",
      now: DateTime.fromISO("2026-11-01T12:00:00", { zone: "America/New_York" }).toMillis(),
    })
    const result = UsageStats.aggregate([], window)

    expect(result.buckets).toHaveLength(25)
    expect(result.current.end - result.current.start).toBe(25 * 60 * 60 * 1_000)
  })

  test("starts natural weeks on Monday and rejects non-IANA zone aliases", () => {
    const window = UsageStats.resolveWindow({
      period: "week",
      timeZone: "Asia/Shanghai",
      now: DateTime.fromISO("2026-08-11T12:00:00", { zone: "Asia/Shanghai" }).toMillis(),
    })
    expect(DateTime.fromMillis(window.current.start, { zone: window.timeZone }).weekday).toBe(1)
    expect(() => UsageStats.Query.parse({ period: "month", timeZone: "local" })).toThrow()
    expect(() => UsageStats.Query.parse({ period: "month", timeZone: "system" })).toThrow()
    expect(() => UsageStats.Query.parse({ period: "month", timeZone: "UTC+3" })).toThrow()
  })

  test("projects a natural year as daily activity buckets", () => {
    const window = UsageStats.resolveWindow({
      period: "year",
      timeZone: "Asia/Shanghai",
      now: DateTime.fromISO("2026-08-11T12:00:00", { zone: "Asia/Shanghai" }).toMillis(),
    })
    const result = UsageStats.aggregate([], window)

    expect(result.grain).toBe("day")
    expect(result.buckets).toHaveLength(365)
    expect(DateTime.fromMillis(result.buckets[0].start, { zone: result.timeZone }).toISODate()).toBe("2026-01-01")
    expect(DateTime.fromMillis(result.buckets.at(-1)!.start, { zone: result.timeZone }).toISODate()).toBe("2026-12-31")
  })

  test("serves canonical streamed-call ledger occurrences through the global usage API", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        UsageLedger.record({
          providerID: "openai",
          modelID: "gpt-5",
          purpose: "vcs-commit-message",
          costUSD: 0.003,
          tokens: tokens(240, 180, 60),
          billing: { status: "priced" },
        })

        const response = await Server.App().request("/global/usage?period=month&timeZone=Asia%2FShanghai")
        expect(response.status).toBe(200)
        const body = UsageStats.Response.parse(await response.json())
        expect(body.current.summary).toMatchObject({
          tokens: { total: 240 },
          calls: 1,
          costUSD: 0.003,
          billing: { pricedTokens: 240, percent: 100 },
        })
        expect(body.providers[0]).toMatchObject({ providerID: "openai", modelCount: 1 })
      },
    })
  })
})
