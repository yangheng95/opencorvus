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

export async function loadUsageStatistics(input: {
  period: UsagePeriod
  timeZone?: string
  signal?: AbortSignal
}): Promise<UsageStatistics> {
  const query = new URLSearchParams({
    period: input.period,
    timeZone: input.timeZone ?? userTimeZone(),
  })
  try {
    const result = await apiJson<UsageStatistics>(`/global/usage?${query}`, { signal: input.signal })
    if (result?.period !== input.period) throw new UsagePeriodMismatchError(input.period, result?.period)
    return result
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new UsageServerVersionError()
    }
    throw error
  }
}
