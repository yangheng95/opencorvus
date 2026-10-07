import { afterEach, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { HOST_CAPABILITIES, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { setAppStore } from "../src/store/app"
import {
  loadExpertSquadCatalog,
  loadExpertSquadSettings,
  loadExpertSquadMarket,
  retireExpertSquadProjection,
} from "../src/services/expert-squad"
const directory = "D:/owned/catalog"
afterEach(() => {
  __setHostTransportForTest(null)
  retireExpertSquadProjection()
})
for (const [name, load] of [
  ["catalog", () => loadExpertSquadCatalog({ kind: "project", directory })],
  ["settings", () => loadExpertSquadSettings(directory, "base", "built_in")],
  ["market", () => loadExpertSquadMarket(directory)],
] as const) {
  test(`${name} preserves original typed transport failure`, async () => {
    configure({ serverUrl: "http://owned.invalid", directory, password: "" })
    setAppStore({ connected: true })
    const records: TransportRequest[] = []
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request<T>(request: TransportRequest) {
        records.push(request)
        return {
          status: 400,
          ok: false,
          headers: { "x-opencorvus-request-id": "owned-error-80" },
          body: { name: "ProviderModelNotFoundError" },
        } as unknown as TransportResponse<T>
      },
      openStream() {
        throw new Error("local transport only")
      },
      async native() {
        throw new Error("local transport only")
      },
    })
    const error = await load().then(
      () => undefined,
      (error) => error,
    )
    expect(error instanceof ApiError).toBe(true)
    expect({
      method: error.method,
      status: error.status,
      path: error.path,
      body: error.body,
      requestID: error.requestID,
    }).toEqual({
      method: "GET",
      status: 400,
      path: records[0]!.path + "?" + new URLSearchParams(records[0]!.query as Record<string, string>).toString(),
      body: { name: "ProviderModelNotFoundError" },
      requestID: "owned-error-80",
    })
  })
  test(`${name} preserves original non-HTTP failure identity`, async () => {
    configure({ serverUrl: "http://owned.invalid", directory, password: "" })
    setAppStore({ connected: true })
    const failure = new Error("owned local transport failure")
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request<T>(): Promise<TransportResponse<T>> {
        throw failure
      },
      openStream() {
        throw new Error("local transport only")
      },
      async native() {
        throw new Error("local transport only")
      },
    })
    const result = await load().then(
      () => undefined,
      (error) => error,
    )
    expect(result).toBe(failure)
  })
}
