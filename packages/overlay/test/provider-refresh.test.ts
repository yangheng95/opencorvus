import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { requestProviderCatalogRefresh, requestProviderModelsRefresh } from "../src/services/provider-refresh"
import { setAppStore } from "../src/store/app"
import { AppLog } from "../src/utils/log"

function fakeTransport(
  requests: TransportRequest[],
  response: { ok: boolean; error?: string; issues?: Array<{ message: string }> },
): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return { status: 200, ok: true, headers: {}, body: response as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

beforeEach(() => {
  configure({ directory: "" })
  setAppStore({ connected: false })
  AppLog.clear()
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  AppLog.clear()
})

describe("provider refresh requests", () => {
  test("refreshes project models through the directory-scoped route", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests, { ok: true }))

    await requestProviderModelsRefresh("D:/work/project one")

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      path: "provider/models/refresh",
      query: { directory: "D:/work/project one" },
      method: "POST",
    })
  })

  test("refreshes the global provider catalog when no directory is active", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport(requests, { ok: true }))

    await requestProviderCatalogRefresh("")

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ path: "global/providers/refresh", method: "POST" })
  })

  test("records unsuccessful refresh results and partial issues in the application log", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(
      fakeTransport(requests, {
        ok: false,
        error: "registry unavailable",
        issues: [{ message: "cached provider projection retained" }],
      }),
    )

    await requestProviderCatalogRefresh("D:/work/project")

    expect(AppLog.entries.slice(-2).map((entry) => [entry.level, entry.service, entry.message])).toEqual([
      ["error", "provider-refresh", "Provider catalog refresh failed"],
      ["warn", "provider-refresh", "Provider catalog refresh completed with issues"],
    ])
  })

  test("records transport failures before rethrowing them", async () => {
    __setHostTransportForTest({
      ...fakeTransport([], { ok: true }),
      async request(): Promise<never> {
        throw new Error("network offline")
      },
    })

    await expect(requestProviderModelsRefresh("D:/work/project")).rejects.toThrow("network offline")
    expect(AppLog.entries.at(-1)).toMatchObject({
      level: "error",
      service: "provider-refresh",
      message: "Provider models refresh request failed",
    })
  })
})
