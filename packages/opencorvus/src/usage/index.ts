import { DateTime, IANAZone } from "luxon"
import z from "zod"

import { Database, and, asc, gte, lt } from "@/storage/db"
import { Message } from "@/session/message"
import { ProviderUsageEventTable, type UsagePurpose } from "./usage.sql"
import { OfficialUsage } from "./official"

export namespace UsageLedger {
  export function record(input: {
    occurredAt?: number
    providerID: string
    modelID: string
    purpose?: UsagePurpose
    tokens: Message.TokenUsage
    costUSD: number
    billing: Message.BillingCoverage
  }): void {
    Database.use((db) =>
      db
        .insert(ProviderUsageEventTable)
        .values({
          occurred_at: input.occurredAt ?? Date.now(),
          provider_id: input.providerID,
          model_id: input.modelID,
          purpose: input.purpose ?? "other",
          input_tokens: input.tokens.input,
          output_tokens: input.tokens.output,
          reasoning_tokens: input.tokens.reasoning,
          cache_read_tokens: input.tokens.cache.read,
          cache_write_tokens: input.tokens.cache.write,
          total_tokens: input.tokens.total,
          cost_usd: input.costUSD,
          billing_status: input.billing.status,
        })
        .run(),
    )
  }
}

export namespace UsageStats {
  export const Period = z.enum(["day", "week", "month", "year"]).meta({ ref: "UsagePeriod" })
  export type Period = z.infer<typeof Period>

  export const Query = z
    .object({
      period: Period.default("month"),
      timeZone: z
        .string()
        .trim()
        .min(1)
        .default("UTC")
        .refine((value) => IANAZone.isValidZone(value), "Expected a valid IANA time zone"),
    })
    .strict()

  const TokenTotals = z
    .object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cacheRead: z.number(),
      cacheWrite: z.number(),
      total: z.number(),
    })
    .strict()
    .meta({ ref: "UsageTokenTotals" })
  export type TokenTotals = z.infer<typeof TokenTotals>

  const BillingCoverage = z
    .object({
      pricedTokens: z.number(),
      unpricedTokens: z.number(),
      unknownTokens: z.number(),
      percent: z.number().min(0).max(100).nullable(),
    })
    .strict()
    .meta({ ref: "UsageBillingCoverage" })

  const Summary = z
    .object({
      tokens: TokenTotals,
      costUSD: z.number(),
      calls: z.number().int().nonnegative(),
      averageTokensPerCall: z.number().nonnegative(),
      billing: BillingCoverage,
    })
    .strict()
    .meta({ ref: "UsageSummary" })
  export type Summary = z.infer<typeof Summary>

  const Comparison = z
    .object({
      tokensPercent: z.number().nullable(),
      costPercent: z.number().nullable(),
      callsPercent: z.number().nullable(),
    })
    .strict()
    .meta({ ref: "UsageComparison" })

  const Bucket = z
    .object({
      start: z.number().int(),
      end: z.number().int(),
      tokens: TokenTotals,
      costUSD: z.number(),
      calls: z.number().int().nonnegative(),
    })
    .strict()
    .meta({ ref: "UsageBucket" })

  const ProviderRow = z
    .object({
      providerID: z.string(),
      modelCount: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
      summary: Summary,
    })
    .strict()
    .meta({ ref: "UsageProviderRow" })

  const ModelRow = z
    .object({
      providerID: z.string(),
      modelID: z.string(),
      share: z.number().min(0).max(1),
      summary: Summary,
    })
    .strict()
    .meta({ ref: "UsageModelRow" })

  export const Response = z
    .object({
      period: Period,
      timeZone: z.string(),
      grain: z.enum(["hour", "day", "month"]),
      current: z.object({ start: z.number().int(), end: z.number().int(), summary: Summary }).strict(),
      previous: z.object({ start: z.number().int(), end: z.number().int(), summary: Summary }).strict(),
      comparison: Comparison,
      buckets: Bucket.array(),
      providers: ProviderRow.array(),
      models: ModelRow.array(),
      official: OfficialUsage.Result,
    })
    .strict()
    .meta({ ref: "UsageStatistics" })
  export type Response = z.infer<typeof Response>

  export type Record = {
    id: string
    occurredAt: number
    providerID: string
    modelID: string
    tokens: Message.TokenUsage
    costUSD: number
    billing?: Message.BillingCoverage
  }

  export type Window = {
    period: Period
    timeZone: string
    grain: Response["grain"]
    current: { start: number; end: number }
    previous: { start: number; end: number }
  }

  type MutableSummary = Summary

  function emptyTokens(): TokenTotals {
    return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  }

  function emptySummary(): MutableSummary {
    return {
      tokens: emptyTokens(),
      costUSD: 0,
      calls: 0,
      averageTokensPerCall: 0,
      billing: { pricedTokens: 0, unpricedTokens: 0, unknownTokens: 0, percent: null },
    }
  }

  function roundCost(value: number): number {
    return Number(value.toFixed(12))
  }

  function addRecord(summary: MutableSummary, record: Record): void {
    summary.tokens.input += record.tokens.input
    summary.tokens.output += record.tokens.output
    summary.tokens.reasoning += record.tokens.reasoning
    summary.tokens.cacheRead += record.tokens.cache.read
    summary.tokens.cacheWrite += record.tokens.cache.write
    summary.tokens.total += record.tokens.total
    summary.costUSD = roundCost(summary.costUSD + record.costUSD)
    summary.calls += 1
    if (record.billing?.status === "priced") summary.billing.pricedTokens += record.tokens.total
    else if (record.billing?.status === "unpriced") summary.billing.unpricedTokens += record.tokens.total
    else summary.billing.unknownTokens += record.tokens.total
  }

  function finishSummary(summary: MutableSummary): Summary {
    const measured = summary.billing.pricedTokens + summary.billing.unpricedTokens + summary.billing.unknownTokens
    summary.averageTokensPerCall = summary.calls === 0 ? 0 : summary.tokens.total / summary.calls
    summary.billing.percent = measured === 0 ? null : (summary.billing.pricedTokens / measured) * 100
    return summary
  }

  function periodStart(now: DateTime, period: Period): DateTime {
    if (period === "day") return now.startOf("day")
    if (period === "week") return now.startOf("week")
    if (period === "month") return now.startOf("month")
    return now.startOf("year")
  }

  function plusPeriod(value: DateTime, period: Period, amount: number): DateTime {
    if (period === "day") return value.plus({ days: amount })
    if (period === "week") return value.plus({ weeks: amount })
    if (period === "month") return value.plus({ months: amount })
    return value.plus({ years: amount })
  }

  export function resolveWindow(input: { period: Period; timeZone: string; now?: number }): Window {
    const now = DateTime.fromMillis(input.now ?? Date.now(), { zone: input.timeZone })
    if (!now.isValid) throw new Error(`Invalid time zone ${input.timeZone}`)
    const start = periodStart(now, input.period)
    const end = plusPeriod(start, input.period, 1)
    const previousStart = plusPeriod(start, input.period, -1)
    return {
      period: input.period,
      timeZone: input.timeZone,
      grain: input.period === "day" ? "hour" : "day",
      current: { start: start.toMillis(), end: end.toMillis() },
      previous: { start: previousStart.toMillis(), end: start.toMillis() },
    }
  }

  function nextBucket(value: DateTime, grain: Window["grain"]): DateTime {
    if (grain === "hour") return value.plus({ hours: 1 })
    if (grain === "day") return value.plus({ days: 1 })
    return value.plus({ months: 1 })
  }

  function changePercent(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null
    return ((current - previous) / previous) * 100
  }

  function summaryRows(
    records: readonly Record[],
    totalTokens: number,
  ): { providers: z.infer<typeof ProviderRow>[]; models: z.infer<typeof ModelRow>[] } {
    const providers = new Map<string, { summary: MutableSummary; models: Set<string> }>()
    const models = new Map<string, { providerID: string; modelID: string; summary: MutableSummary }>()
    for (const record of records) {
      const provider = providers.get(record.providerID) ?? { summary: emptySummary(), models: new Set<string>() }
      addRecord(provider.summary, record)
      provider.models.add(record.modelID)
      providers.set(record.providerID, provider)

      const key = JSON.stringify([record.providerID, record.modelID])
      const model = models.get(key) ?? {
        providerID: record.providerID,
        modelID: record.modelID,
        summary: emptySummary(),
      }
      addRecord(model.summary, record)
      models.set(key, model)
    }
    const ordering = (left: { summary: Summary }, right: { summary: Summary }) =>
      right.summary.tokens.total - left.summary.tokens.total || right.summary.costUSD - left.summary.costUSD
    return {
      providers: [...providers.entries()]
        .map(([providerID, value]) => ({
          providerID,
          modelCount: value.models.size,
          share: totalTokens === 0 ? 0 : value.summary.tokens.total / totalTokens,
          summary: finishSummary(value.summary),
        }))
        .sort((left, right) => ordering(left, right) || left.providerID.localeCompare(right.providerID)),
      models: [...models.values()]
        .map((value) => ({
          providerID: value.providerID,
          modelID: value.modelID,
          share: totalTokens === 0 ? 0 : value.summary.tokens.total / totalTokens,
          summary: finishSummary(value.summary),
        }))
        .sort(
          (left, right) =>
            ordering(left, right) ||
            left.providerID.localeCompare(right.providerID) ||
            left.modelID.localeCompare(right.modelID),
        ),
    }
  }

  export function aggregate(
    records: readonly Record[],
    window: Window,
    official: OfficialUsage.Result = OfficialUsage.empty(),
  ): Response {
    const currentRecords = records.filter(
      (record) => record.occurredAt >= window.current.start && record.occurredAt < window.current.end,
    )
    const previousRecords = records.filter(
      (record) => record.occurredAt >= window.previous.start && record.occurredAt < window.previous.end,
    )
    const currentSummary = finishSummary(
      currentRecords.reduce((summary, record) => {
        addRecord(summary, record)
        return summary
      }, emptySummary()),
    )
    const previousSummary = finishSummary(
      previousRecords.reduce((summary, record) => {
        addRecord(summary, record)
        return summary
      }, emptySummary()),
    )
    const bucketRecords = new Map<number, Record[]>()
    for (const record of currentRecords) {
      const value = DateTime.fromMillis(record.occurredAt, { zone: window.timeZone })
      const bucketStart =
        window.grain === "hour"
          ? value.startOf("hour")
          : window.grain === "day"
            ? value.startOf("day")
            : value.startOf("month")
      const start = bucketStart.toMillis()
      bucketRecords.set(start, [...(bucketRecords.get(start) ?? []), record])
    }
    const buckets: z.infer<typeof Bucket>[] = []
    let cursor = DateTime.fromMillis(window.current.start, { zone: window.timeZone })
    const end = DateTime.fromMillis(window.current.end, { zone: window.timeZone })
    while (cursor < end) {
      const next = nextBucket(cursor, window.grain)
      const summary = finishSummary(
        (bucketRecords.get(cursor.toMillis()) ?? []).reduce((value, record) => {
          addRecord(value, record)
          return value
        }, emptySummary()),
      )
      buckets.push({
        start: cursor.toMillis(),
        end: next.toMillis(),
        tokens: summary.tokens,
        costUSD: summary.costUSD,
        calls: summary.calls,
      })
      cursor = next
    }
    const rows = summaryRows(currentRecords, currentSummary.tokens.total)
    return Response.parse({
      period: window.period,
      timeZone: window.timeZone,
      grain: window.grain,
      current: { ...window.current, summary: currentSummary },
      previous: { ...window.previous, summary: previousSummary },
      comparison: {
        tokensPercent: changePercent(currentSummary.tokens.total, previousSummary.tokens.total),
        costPercent: changePercent(currentSummary.costUSD, previousSummary.costUSD),
        callsPercent: changePercent(currentSummary.calls, previousSummary.calls),
      },
      buckets,
      ...rows,
      official,
    })
  }

  function records(window: Window): Record[] {
    const rows = Database.use((db) =>
      db
        .select({
          id: ProviderUsageEventTable.id,
          occurredAt: ProviderUsageEventTable.occurred_at,
          providerID: ProviderUsageEventTable.provider_id,
          modelID: ProviderUsageEventTable.model_id,
          input: ProviderUsageEventTable.input_tokens,
          output: ProviderUsageEventTable.output_tokens,
          reasoning: ProviderUsageEventTable.reasoning_tokens,
          cacheRead: ProviderUsageEventTable.cache_read_tokens,
          cacheWrite: ProviderUsageEventTable.cache_write_tokens,
          total: ProviderUsageEventTable.total_tokens,
          costUSD: ProviderUsageEventTable.cost_usd,
          billing: ProviderUsageEventTable.billing_status,
        })
        .from(ProviderUsageEventTable)
        .where(
          and(
            gte(ProviderUsageEventTable.occurred_at, window.previous.start),
            lt(ProviderUsageEventTable.occurred_at, window.current.end),
          ),
        )
        .orderBy(asc(ProviderUsageEventTable.occurred_at), asc(ProviderUsageEventTable.id))
        .all(),
    )
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      providerID: row.providerID,
      modelID: row.modelID,
      tokens: {
        input: row.input,
        output: row.output,
        reasoning: row.reasoning,
        cache: { read: row.cacheRead, write: row.cacheWrite },
        total: row.total,
      },
      costUSD: row.costUSD,
      billing: row.billing === "unknown" ? undefined : { status: row.billing },
    }))
  }

  export async function read(input: z.input<typeof Query>): Promise<Response> {
    const query = Query.parse(input)
    const window = resolveWindow(query)
    const recorded = records(window)
    const local = aggregate(recorded, window)
    const official = await OfficialUsage.read({
      start: window.current.start,
      end: window.current.end,
      local: local.providers.map((provider) => ({
        providerID: provider.providerID,
        tokens: provider.summary.tokens.total,
        estimatedCostUSD: provider.summary.costUSD,
      })),
    })
    return aggregate(recorded, window, official)
  }
}
