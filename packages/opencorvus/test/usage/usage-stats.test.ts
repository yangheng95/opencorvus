import { afterEach, describe, expect, test } from "bun:test"
import { DateTime } from "luxon"

import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { UsageLedger, UsageStats } from "../../src/usage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function tokens(total: number, input: number, output: number, reasoning = 0) {
  return { total, input, output, reasoning, cache: { read: 0, write: 0 } }
}

function measuredRecord(id: string, occurredAt: number, total = 100): UsageStats.Record {
  return {
    id,
    occurredAt,
    providerID: "usage-time-contract",
    modelID: "measured-model",
    tokens: {
      total,
      input: total * 0.6,
      output: total * 0.2,
      reasoning: total * 0.1,
      cache: { read: total * 0.05, write: total * 0.05 },
    },
    costUSD: total / 100_000,
    billing: { status: "priced" },
  }
}

function expectMeasuredBuckets(
  result: UsageStats.Response,
  expected: { calls: number; tokens: number; costUSD: number },
) {
  const expectedTokens = {
    input: expected.tokens * 0.6,
    output: expected.tokens * 0.2,
    reasoning: expected.tokens * 0.1,
    cacheRead: expected.tokens * 0.05,
    cacheWrite: expected.tokens * 0.05,
    total: expected.tokens,
  }
  expect(result.current.summary).toMatchObject({
    calls: expected.calls,
    tokens: expectedTokens,
    costUSD: expected.costUSD,
  })
  const summed = result.buckets.reduce(
    (total, bucket) => ({
      calls: total.calls + bucket.calls,
      costUSD: total.costUSD + bucket.costUSD,
      tokens: {
        input: total.tokens.input + bucket.tokens.input,
        output: total.tokens.output + bucket.tokens.output,
        reasoning: total.tokens.reasoning + bucket.tokens.reasoning,
        cacheRead: total.tokens.cacheRead + bucket.tokens.cacheRead,
        cacheWrite: total.tokens.cacheWrite + bucket.tokens.cacheWrite,
        total: total.tokens.total + bucket.tokens.total,
      },
    }),
    { calls: 0, costUSD: 0, tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  )
  expect(summed.calls).toBe(expected.calls)
  expect(summed.tokens).toEqual(expectedTokens)
  expect(summed.costUSD).toBeCloseTo(expected.costUSD, 12)
  expect(result.buckets.map((bucket) => bucket.start)).toEqual([
    result.current.start,
    ...result.buckets.slice(0, -1).map((bucket) => bucket.end),
  ])
  expect(result.buckets.at(-1)!.end).toBe(result.current.end)
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

  test("starts natural weeks on Monday", () => {
    const window = UsageStats.resolveWindow({
      period: "week",
      timeZone: "Asia/Shanghai",
      now: DateTime.fromISO("2026-08-11T12:00:00", { zone: "Asia/Shanghai" }).toMillis(),
    })
    expect(DateTime.fromMillis(window.current.start, { zone: window.timeZone }).weekday).toBe(1)
  })

  test.each(["local", "system", "UTC+3"])("returns the canonical time-zone validation error for %s", (timeZone) => {
    const result = UsageStats.Query.safeParse({ period: "month", timeZone })
    expect({ success: result.success, name: result.error?.name, issues: result.error?.issues }).toEqual({
      success: false,
      name: "ZodError",
      issues: [{ code: "custom", path: ["timeZone"], message: "Expected a valid IANA time zone" }],
    })
  })

  test.each([
    {
      name: "forward",
      day: "2026-10-04",
      previous: "2026-10-03T00:00:00+10:30",
      start: "2026-10-04T00:00:00+10:30",
      end: "2026-10-05T00:00:00+11:00",
      beforeOffset: "+10:30",
      afterOffset: "+11:00",
      hours: 23.5,
      count: 24,
      occupied: [
        "2026-10-04T01:00:00+10:30",
        "2026-10-04T02:30:00+11:00",
        "2026-10-04T11:30:00+11:00",
        "2026-10-04T23:30:00+11:00",
      ],
    },
    {
      name: "backward",
      day: "2026-04-05",
      previous: "2026-04-04T00:00:00+11:00",
      start: "2026-04-05T00:00:00+11:00",
      end: "2026-04-06T00:00:00+10:30",
      beforeOffset: "+11:00",
      afterOffset: "+10:30",
      hours: 24.5,
      count: 25,
      occupied: [
        "2026-04-05T01:00:00+11:00",
        "2026-04-05T02:30:00+10:30",
        "2026-04-05T11:30:00+10:30",
        "2026-04-05T23:30:00+10:30",
      ],
    },
  ])("assigns measured calls across Lord Howe's half-hour $name transition", (sample) => {
    const window = UsageStats.resolveWindow({
      period: "day",
      timeZone: "Australia/Lord_Howe",
      now: Date.parse(`${sample.day}T12:00:00${sample.afterOffset}`),
    })
    expect(window.current).toEqual({ start: Date.parse(sample.start), end: Date.parse(sample.end) })
    expect(window.previous).toEqual({ start: Date.parse(sample.previous), end: Date.parse(sample.start) })
    const records = [
      measuredRecord("last", Date.parse(`${sample.day}T23:45:00${sample.afterOffset}`)),
      measuredRecord("first", Date.parse(`${sample.day}T01:15:00${sample.beforeOffset}`)),
      measuredRecord("noon", Date.parse(`${sample.day}T12:15:00${sample.afterOffset}`)),
      measuredRecord("after-transition", Date.parse(`${sample.day}T03:15:00${sample.afterOffset}`)),
    ]
    const original = structuredClone(records)
    const result = UsageStats.aggregate(records, window)
    expectMeasuredBuckets(result, { calls: 4, tokens: 400, costUSD: 0.004 })
    expect(records).toEqual(original)
    expect(result.current.end - result.current.start).toBe(sample.hours * 3_600_000)
    expect(result.buckets).toHaveLength(sample.count)
    expect(result.buckets.slice(0, -1).map((bucket) => bucket.end - bucket.start)).toEqual(
      Array(sample.count - 1).fill(3_600_000),
    )
    expect(result.buckets.at(-1)!.end - result.buckets.at(-1)!.start).toBe(1_800_000)
    expect(result.buckets.filter((bucket) => bucket.calls > 0).map((bucket) => bucket.start)).toEqual(
      sample.occupied.map((value) => Date.parse(value)),
    )
  })

  test("assigns both Lord Howe 01:45 instants to their distinct real-hour intervals", () => {
    const window = UsageStats.resolveWindow({
      period: "day",
      timeZone: "Australia/Lord_Howe",
      now: Date.parse("2026-04-05T12:00:00+10:30"),
    })
    const result = UsageStats.aggregate(
      [
        measuredRecord("second-0145", Date.parse("2026-04-05T01:45:00+10:30"), 200),
        measuredRecord("first-0145", Date.parse("2026-04-05T01:45:00+11:00"), 100),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 2, tokens: 300, costUSD: 0.003 })
    expect(
      result.buckets
        .filter((bucket) => bucket.calls > 0)
        .map((bucket) => ({
          start: bucket.start,
          calls: bucket.calls,
          tokens: bucket.tokens.total,
        })),
    ).toEqual([
      { start: Date.parse("2026-04-05T01:00:00+11:00"), calls: 1, tokens: 100 },
      { start: Date.parse("2026-04-05T01:30:00+10:30"), calls: 1, tokens: 200 },
    ])
  })

  test("resolves Santiago's missing midnight to exact adjacent natural days", () => {
    const window = UsageStats.resolveWindow({
      period: "day",
      timeZone: "America/Santiago",
      now: Date.parse("2026-09-06T12:00:00-03:00"),
    })
    const previousStart = Date.parse("2026-09-05T00:00:00-04:00")
    const start = Date.parse("2026-09-06T01:00:00-03:00")
    const end = Date.parse("2026-09-07T00:00:00-03:00")
    expect(window).toEqual({
      period: "day",
      timeZone: "America/Santiago",
      grain: "hour",
      previous: { start: previousStart, end: start },
      current: { start, end },
    })
    const result = UsageStats.aggregate(
      [
        measuredRecord("following-day", Date.parse("2026-09-07T00:30:00-03:00"), 600),
        measuredRecord("previous-end", start - 1, 200),
        measuredRecord("current-end", end - 1, 400),
        measuredRecord("current-start", start, 300),
        measuredRecord("following-start", end, 500),
        measuredRecord("previous-start", previousStart, 100),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 2, tokens: 700, costUSD: 0.007 })
    expect(result.previous.summary).toMatchObject({ calls: 2, tokens: { total: 300 }, costUSD: 0.003 })
    expect(result.buckets).toHaveLength(23)
  })

  test.each([
    {
      period: "week" as const,
      previous: "2026-08-24T00:00:00-04:00",
      start: "2026-08-31T00:00:00-04:00",
      end: "2026-09-07T00:00:00-03:00",
      count: 7,
      calls: 2,
    },
    {
      period: "month" as const,
      previous: "2026-08-01T00:00:00-04:00",
      start: "2026-09-01T00:00:00-04:00",
      end: "2026-10-01T00:00:00-03:00",
      count: 30,
      calls: 4,
    },
    {
      period: "year" as const,
      previous: "2025-01-01T00:00:00-03:00",
      start: "2026-01-01T00:00:00-03:00",
      end: "2027-01-01T00:00:00-03:00",
      count: 365,
      calls: 4,
    },
  ])("fills Santiago's $period with natural-day intervals through the midnight transition", (sample) => {
    const window = UsageStats.resolveWindow({
      period: sample.period,
      timeZone: "America/Santiago",
      now: Date.parse("2026-09-06T12:00:00-03:00"),
    })
    expect(window.current).toEqual({ start: Date.parse(sample.start), end: Date.parse(sample.end) })
    expect(window.previous).toEqual({ start: Date.parse(sample.previous), end: Date.parse(sample.start) })
    const records = [
      "2026-09-20T12:15:00-03:00",
      "2026-09-05T12:15:00-04:00",
      "2026-09-07T12:15:00-03:00",
      "2026-09-06T12:15:00-03:00",
    ].map((value, index) => measuredRecord(String(index), Date.parse(value)))
    const result = UsageStats.aggregate(records, window)
    expectMeasuredBuckets(result, { calls: sample.calls, tokens: sample.calls * 100, costUSD: sample.calls / 1_000 })
    expect(result.buckets).toHaveLength(sample.count)
    const expectedStarts = [
      "2026-09-05T00:00:00-04:00",
      "2026-09-06T01:00:00-03:00",
      "2026-09-07T00:00:00-03:00",
      "2026-09-20T00:00:00-03:00",
    ]
    expect(result.buckets.filter((bucket) => bucket.calls > 0).map((bucket) => bucket.start)).toEqual(
      expectedStarts.slice(0, sample.calls).map((value) => Date.parse(value)),
    )
  })

  test.each([
    { timeZone: "Asia/Shanghai", start: "2026-10-13T00:00:00+08:00", end: "2026-10-14T00:00:00+08:00", hours: 24 },
    { timeZone: "America/New_York", start: "2026-03-08T00:00:00-05:00", end: "2026-03-09T00:00:00-04:00", hours: 23 },
    { timeZone: "America/New_York", start: "2026-11-01T00:00:00-04:00", end: "2026-11-02T00:00:00-05:00", hours: 25 },
  ])("assigns both ends of the $hours-hour $timeZone day to the correct half-open window", (sample) => {
    const start = Date.parse(sample.start)
    const end = Date.parse(sample.end)
    const window = UsageStats.resolveWindow({ period: "day", timeZone: sample.timeZone, now: start + 12 * 3_600_000 })
    expect(window.current).toEqual({ start, end })
    const result = UsageStats.aggregate(
      [
        measuredRecord("next-start", end, 500),
        measuredRecord("last", end - 1, 200),
        measuredRecord("previous-last", start - 1, 400),
        measuredRecord("first", start, 100),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 2, tokens: 300, costUSD: 0.003 })
    expect(result.previous.summary).toMatchObject({ calls: 1, tokens: { total: 400 }, costUSD: 0.004 })
    expect(result.buckets).toHaveLength(sample.hours)
    expect(result.buckets[0]).toMatchObject({ calls: 1, tokens: { total: 100 } })
    expect(result.buckets.at(-1)).toMatchObject({ calls: 1, tokens: { total: 200 } })
  })

  test("includes the measured leap day and exact year endpoints in Shanghai's leap year", () => {
    const window = UsageStats.resolveWindow({
      period: "year",
      timeZone: "Asia/Shanghai",
      now: Date.parse("2028-02-29T12:00:00+08:00"),
    })
    const start = Date.parse("2028-01-01T00:00:00+08:00")
    const end = Date.parse("2029-01-01T00:00:00+08:00")
    expect(window.current).toEqual({ start, end })
    const result = UsageStats.aggregate(
      [
        measuredRecord("last", end - 1, 300),
        measuredRecord("leap-day", Date.parse("2028-02-29T12:00:00+08:00"), 200),
        measuredRecord("first", start, 100),
        measuredRecord("next-year", end, 400),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 3, tokens: 600, costUSD: 0.006 })
    expect(result.buckets).toHaveLength(366)
    expect(result.buckets[59]).toMatchObject({
      start: Date.parse("2028-02-29T00:00:00+08:00"),
      end: Date.parse("2028-03-01T00:00:00+08:00"),
      calls: 1,
      tokens: { total: 200 },
    })
  })

  for (const period of ["day", "month"] as const) {
    test.each([
      { observation: "first 00:30", now: "2026-11-01T00:30:00-04:00" },
      { observation: "second 00:30", now: "2026-11-01T00:30:00-05:00" },
      { observation: "noon", now: "2026-11-01T12:00:00-05:00" },
    ])(`uses Havana's first real midnight for the ${period} observed at $observation`, (sample) => {
      const window = UsageStats.resolveWindow({ period, timeZone: "America/Havana", now: Date.parse(sample.now) })
      const start = Date.parse("2026-11-01T00:00:00-04:00")
      const dayEnd = Date.parse("2026-11-02T00:00:00-05:00")
      const end = period === "day" ? dayEnd : Date.parse("2026-12-01T00:00:00-05:00")
      expect(window.current).toEqual({ start, end })
      expect(window.previous).toEqual({
        start: Date.parse(period === "day" ? "2026-10-31T00:00:00-04:00" : "2026-10-01T00:00:00-04:00"),
        end: start,
      })
      const result = UsageStats.aggregate(
        [
          measuredRecord("second-midnight-hour", Date.parse("2026-11-01T00:30:00-05:00"), 200),
          measuredRecord("previous-period", Date.parse("2026-10-31T12:00:00-04:00"), 400),
          measuredRecord("first-midnight-hour", Date.parse("2026-11-01T00:30:00-04:00"), 100),
        ],
        window,
      )
      expectMeasuredBuckets(result, { calls: 2, tokens: 300, costUSD: 0.003 })
      expect(result.previous.summary).toMatchObject({ calls: 1, tokens: { total: 400 }, costUSD: 0.004 })
      expect(result.buckets).toHaveLength(period === "day" ? 25 : 30)
      if (period === "day") {
        expect(
          result.buckets
            .slice(0, 2)
            .map((bucket) => ({ start: bucket.start, calls: bucket.calls, tokens: bucket.tokens.total })),
        ).toEqual([
          { start, calls: 1, tokens: 100 },
          { start: Date.parse("2026-11-01T00:00:00-05:00"), calls: 1, tokens: 200 },
        ])
      } else {
        expect(result.buckets[0]).toMatchObject({
          start,
          end: dayEnd,
          calls: 2,
          tokens: { total: 300 },
          costUSD: 0.003,
        })
      }
    })
  }

  test.each([
    {
      period: "day" as const,
      now: "2026-11-02T12:00:00-05:00",
      start: "2026-11-02T00:00:00-05:00",
      end: "2026-11-03T00:00:00-05:00",
    },
    {
      period: "month" as const,
      now: "2026-12-15T12:00:00-05:00",
      start: "2026-12-01T00:00:00-05:00",
      end: "2027-01-01T00:00:00-05:00",
    },
  ])("includes both Havana midnight hours in the previous $period", (sample) => {
    const window = UsageStats.resolveWindow({
      period: sample.period,
      timeZone: "America/Havana",
      now: Date.parse(sample.now),
    })
    const start = Date.parse(sample.start)
    expect(window.current).toEqual({ start, end: Date.parse(sample.end) })
    expect(window.previous).toEqual({ start: Date.parse("2026-11-01T00:00:00-04:00"), end: start })
    const result = UsageStats.aggregate(
      [
        measuredRecord("second-midnight-hour", Date.parse("2026-11-01T00:30:00-05:00"), 200),
        measuredRecord("current-period", start + 1_800_000, 300),
        measuredRecord("first-midnight-hour", Date.parse("2026-11-01T00:30:00-04:00"), 100),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 1, tokens: 300, costUSD: 0.003 })
    expect(result.previous.summary).toMatchObject({ calls: 2, tokens: { total: 300 }, costUSD: 0.003 })
  })

  test.each([
    { period: "week" as const, start: "2026-10-26T00:00:00-04:00", end: "2026-11-02T00:00:00-05:00" },
    { period: "year" as const, start: "2026-01-01T00:00:00-05:00", end: "2027-01-01T00:00:00-05:00" },
  ])("places both Havana midnight hours in one natural-day bucket within the $period", (sample) => {
    const window = UsageStats.resolveWindow({
      period: sample.period,
      timeZone: "America/Havana",
      now: Date.parse("2026-11-01T12:00:00-05:00"),
    })
    expect(window.current).toEqual({ start: Date.parse(sample.start), end: Date.parse(sample.end) })
    const result = UsageStats.aggregate(
      [
        measuredRecord("second-midnight-hour", Date.parse("2026-11-01T00:30:00-05:00"), 200),
        measuredRecord("first-midnight-hour", Date.parse("2026-11-01T00:30:00-04:00"), 100),
      ],
      window,
    )
    expectMeasuredBuckets(result, { calls: 2, tokens: 300, costUSD: 0.003 })
    expect(result.buckets.find((bucket) => bucket.start === Date.parse("2026-11-01T00:00:00-04:00"))).toMatchObject({
      start: Date.parse("2026-11-01T00:00:00-04:00"),
      end: Date.parse("2026-11-02T00:00:00-05:00"),
      calls: 2,
      tokens: { total: 300 },
      costUSD: 0.003,
    })
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
