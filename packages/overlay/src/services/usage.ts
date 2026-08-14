import type { UsagePeriod, UsageStatistics } from "@opencorvus-ai/sdk"

import { ApiError, apiJson } from "./api"

export type { UsagePeriod, UsageStatistics }

export function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export class UsageServerVersionError extends Error {
  override readonly name = "UsageServerVersionError"
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
    return await apiJson<UsageStatistics>(`/global/usage?${query}`, { signal: input.signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new UsageServerVersionError()
    }
    throw error
  }
}
