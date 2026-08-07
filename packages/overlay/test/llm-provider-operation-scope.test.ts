import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { testProviderConnection } from "../src/services/llm"

const requests: TransportRequest[] = []

function transport(): HostTransport {
  return {
    kind: "browser",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: { ok: true, message: "reachable" } as T,
      }
    },
    openStream() {
      return { close() {} }
    },
    async native() {
      throw new Error("native transport is not used")
    },
  }
}

describe("Provider operation scope", () => {
  beforeEach(() => {
    requests.length = 0
    configure({ directory: "" })
    __setHostTransportForTest(transport())
  })

  afterEach(() => {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
  })

  test("connection test uses the global control plane without an active project", async () => {
    await expect(testProviderConnection("openai", "gpt-5")).resolves.toEqual({
      ok: true,
      message: "reachable",
    })
    expect(requests).toEqual([
      expect.objectContaining({
        path: "global/providers/openai/test",
        query: undefined,
        method: "POST",
        body: { kind: "json", value: { modelID: "gpt-5" } },
      }),
    ])
  })

  test("connection test preserves explicit project ownership", async () => {
    await testProviderConnection("openai", "gpt-5", { directory: "D:/workspace/demo" })
    expect(requests).toEqual([
      expect.objectContaining({
        path: "provider/openai/test",
        query: { directory: "D:/workspace/demo" },
        method: "POST",
        body: { kind: "json", value: { modelID: "gpt-5" } },
      }),
    ])
  })
})
