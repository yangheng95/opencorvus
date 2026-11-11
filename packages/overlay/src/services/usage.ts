import type { UsagePeriod, UsageStatistics } from "@opencorvus-ai/sdk"

import { ApiError, apiJson } from "./api"

export type { UsagePeriod, UsageStatistics }

export const USAGE_PERIODS = ["day", "week", "month", "year"] as const satisfies readonly UsagePeriod[]

export function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export class UsageServerVersionError extends Error {
  override readonly name = "UsageServerVersionError"
}

export class UsagePeriodMismatchError extends Error {
  override readonly name = "UsagePeriodMismatchError"
  readonly received: UsagePeriod | undefined

  constructor(readonly requested: UsagePeriod, period: unknown) {
    const received = USAGE_PERIODS.find((candidate) => candidate === period)
    super(received
      ? `Requested usage period ${requested}, received ${received}.`
      : `The usage response did not identify the requested period ${requested}.`)
    this.received = received
  }
}

function reportedTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string") return
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return value
  } catch {
    return undefined
  }
}

export class UsageTimeZoneMismatchError extends Error {
  override readonly name = "UsageTimeZoneMismatchError"
  readonly received: string | undefined

  constructor(readonly requested: string, timeZone: unknown) {
    const received = reportedTimeZone(timeZone)
    super(received
      ? `Requested usage time zone ${requested}, received ${received}.`
      : `The usage response did not identify the requested time zone ${requested}.`)
    this.received = received
  }
}

export async function loadUsageStatistics(input: {
  period: UsagePeriod
  timeZone?: string
  signal?: AbortSignal
}): Promise<UsageStatistics> {
  const timeZone = (input.timeZone ?? userTimeZone()).trim()
  const query = new URLSearchParams({
    period: input.period,
    timeZone,
  })
  try {
    const result = await apiJson<UsageStatistics>(`/global/usage?${query}`, { signal: input.signal })
    if (result?.period !== input.period) throw new UsagePeriodMismatchError(input.period, result?.period)
    if (result.timeZone !== timeZone) throw new UsageTimeZoneMismatchError(timeZone, result.timeZone)
    return result
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new UsageServerVersionError()
    }
    throw error
  }
}
