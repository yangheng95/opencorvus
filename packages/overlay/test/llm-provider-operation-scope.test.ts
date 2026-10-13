import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { readProviderTestResult, testProviderConnection, type ProviderTestResult } from "../src/services/llm"

const requests: TransportRequest[] = []
const accepted: ProviderTestResult = {
  ok: true,
  status: "connected",
  code: "connected",
  providerID: "openai",
  modelID: "gpt-5",
  message: "Provider is reachable.",
  output: "OK",
}

function transport(body: ProviderTestResult = accepted, status = 200): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return {
        status,
        ok: status === 200,
        headers: {},
        body: body as T,
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
    await expect(testProviderConnection("openai", "gpt-5")).resolves.toEqual(accepted)
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

  for (const [scope, options, path, query] of [
    ["global", {}, "global/providers/openai/test", undefined],
    ["project", { directory: "D:/workspace/demo" }, "provider/openai/test", { directory: "D:/workspace/demo" }],
  ] as const) {
    test(`${scope} connection test delegates the effective default selection and retains its receipt`, async () => {
      await expect(testProviderConnection("openai", undefined, options)).resolves.toEqual(accepted)
      expect(requests).toEqual([
        expect.objectContaining({ path, query, method: "POST", body: { kind: "json", value: {} } }),
      ])
    })
  }

  test("a model-selection error retains the original HTTP error and its complete result", async () => {
    const receipt: ProviderTestResult = {
      ok: false,
      status: "error",
      code: "no_models",
      providerID: "owned-zero",
      modelID: "",
      message: "Provider has no available models.",
      output: "",
    }
    __setHostTransportForTest(transport(receipt, 400))
    const error = await testProviderConnection("owned-zero", undefined).catch((error: unknown) => error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      method: "POST",
      path: "global/providers/owned-zero/test",
      body: receipt,
    })
    const result = readProviderTestResult((error as ApiError).body)
    expect(result).toBe((error as ApiError).body)
    expect(result).toEqual(receipt)
  })
})
