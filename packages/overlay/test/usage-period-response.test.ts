import { afterEach, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { loadUsageStatistics, UsagePeriodMismatchError } from "../src/services/usage"

afterEach(() => __setHostTransportForTest(undefined))

test("an accepted response for another usage period produces the explicit mismatch error", async () => {
  const requests: Array<Pick<TransportRequest, "path" | "query">> = []
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push({ path: request.path, query: request.query })
      const body: unknown = { period: "year" }
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("unexpected stream")
    },
    async native() {
      return undefined
    },
  })

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
