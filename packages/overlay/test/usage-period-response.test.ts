import { afterEach, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { loadUsageStatistics, UsagePeriodMismatchError, UsageTimeZoneMismatchError } from "../src/services/usage"

afterEach(() => __setHostTransportForTest(undefined))

function usageResponse(body: unknown) {
  const requests: Array<Pick<TransportRequest, "path" | "query">> = []
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push({ path: request.path, query: request.query })
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("unexpected stream")
    },
    async native() {
      return undefined
    },
  })
  return requests
}

test("an accepted response for another usage period produces the explicit mismatch error", async () => {
  const requests = usageResponse({ period: "year", timeZone: "Asia/Shanghai" })
  const reading = loadUsageStatistics({ period: "week", timeZone: "Asia/Shanghai" })
  const error = await reading.catch((cause) => cause)
  expect(error).toBeInstanceOf(UsagePeriodMismatchError)
  expect(error).toMatchObject({
    requested: "week",
    received: "year",
    message: "Requested usage period week, received year.",
  })
  expect(requests).toEqual([{ path: "global/usage", query: { period: "week", timeZone: "Asia/Shanghai" } }])
})

test.each([
  ["another time zone", "America/Los_Angeles", "Requested usage time zone Asia/Shanghai, received America/Los_Angeles."],
  ["a missing time zone", undefined, "The usage response did not identify the requested time zone Asia/Shanghai."],
] as const)("a day response with %s settles as an explicit mismatch", async (_case, timeZone, message) => {
  const requests = usageResponse({ period: "day", timeZone })
  const error = await loadUsageStatistics({ period: "day", timeZone: "Asia/Shanghai" }).catch((cause) => cause)
  expect(error).toBeInstanceOf(UsageTimeZoneMismatchError)
  expect(error).toMatchObject({ requested: "Asia/Shanghai", received: timeZone, message })
  expect(requests).toEqual([{ path: "global/usage", query: { period: "day", timeZone: "Asia/Shanghai" } }])
})

test("the normalized requested time-zone identifier preserves a matching usage response", async () => {
  const accepted = { period: "day", timeZone: "Etc/UTC", buckets: [] }
  const requests = usageResponse(accepted)
  expect(await loadUsageStatistics({ period: "day", timeZone: "  Etc/UTC  " })).toEqual(accepted)
  expect(requests).toEqual([{ path: "global/usage", query: { period: "day", timeZone: "Etc/UTC" } }])
})
