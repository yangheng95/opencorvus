import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { apiJson, apiJsonWithTimeout, ApiError, configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

// What this pins
// ----------------
// The previous `if (!res.ok) throw new Error(`API ${status}: ${path}`)`
// path silently dropped the response body, so every overlay caller that
// catch'd an apiJson failure ended up with `"API 400: config"` and no
// way to surface the actual server-side reason — the root of the
// "添加自定义模型面板静默错误" symptom. This file pins:
//   - 4xx/5xx throws an `ApiError` (not a plain Error)
//   - the thrown instance carries `status`, `path`, raw `body`
//   - `message` prefers common server fields (message, error, detail)
//   - 2xx returns the parsed body unchanged (no behavior regression)

function fakeTransport(responder: (req: TransportRequest) => TransportResponse<unknown>): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return responder(req) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used in apiJson tests")
    },
    async native() {
      throw new Error("native not used in apiJson tests")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as unknown as HostTransport
}

const TEST_DIRECTORY = "D:/opencorvus/api-error-test"

beforeEach(() => configure({ directory: TEST_DIRECTORY }))

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

describe("apiJson + ApiError", () => {
  test("2xx returns the parsed body unchanged", async () => {
    __setHostTransportForTest(fakeTransport(() => ({ status: 200, ok: true, headers: {}, body: { hello: "world" } })))
    const result = await apiJson("config")
    expect(result).toEqual({ hello: "world" })
  })

  test("4xx throws ApiError carrying status / path / body / readable message", async () => {
    __setHostTransportForTest(
      fakeTransport(() => ({
        status: 400,
        ok: false,
        headers: {},
        body: { error: "config.provider.foo: name: Expected string" },
      })),
    )
    let caught: unknown
    try {
      await apiJson("config", { method: "PATCH" })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    const err = caught as ApiError
    expect(err.status).toBe(400)
    expect(err.path).toBe("config")
    expect(err.body).toEqual({ error: "config.provider.foo: name: Expected string" })
    expect(err.message).toContain("400")
    expect(err.message).toContain("config.provider.foo")
  })

  test("ApiError prefers `message` over `error` when both are present", async () => {
    __setHostTransportForTest(
      fakeTransport(() => ({
        status: 422,
        ok: false,
        headers: {},
        body: { message: "primary", error: "fallback" },
      })),
    )
    let caught: ApiError | undefined
    try {
      await apiJson("x")
    } catch (e) {
      caught = e as ApiError
    }
    expect(caught?.message).toContain("primary")
  })

  test("ApiError renders the message carried by a NamedError envelope", async () => {
    const body = {
      name: "ExpertSquadPackageError",
      data: { message: "Installed expert squad does not match the current manifest schema" },
    }
    __setHostTransportForTest(fakeTransport(() => ({ status: 500, ok: false, headers: {}, body })))

    let caught: ApiError | undefined
    try {
      await apiJson("expert-squad/catalog")
    } catch (error) {
      caught = error as ApiError
    }

    expect(caught?.body).toEqual(body)
    expect(caught?.message).toBe(
      "API 500 expert-squad/catalog: Installed expert squad does not match the current manifest schema",
    )
  })

  test("ApiError falls back to status + path when body is empty", async () => {
    __setHostTransportForTest(fakeTransport(() => ({ status: 500, ok: false, headers: {}, body: null })))
    let caught: ApiError | undefined
    try {
      await apiJson("nope")
    } catch (e) {
      caught = e as ApiError
    }
    expect(caught?.message).toBe("API 500 nope")
  })

  test("ApiError with a string body uses the string as detail", async () => {
    __setHostTransportForTest(fakeTransport(() => ({ status: 502, ok: false, headers: {}, body: "Bad Gateway" })))
    let caught: ApiError | undefined
    try {
      await apiJson("upstream")
    } catch (e) {
      caught = e as ApiError
    }
    expect(caught?.message).toContain("Bad Gateway")
  })

  test("apiJsonWithTimeout preserves ApiError status / path / body", async () => {
    __setHostTransportForTest(
      fakeTransport(() => ({
        status: 400,
        ok: false,
        headers: {},
        body: { message: "provider config failed before model list loaded" },
      })),
    )

    let caught: unknown
    try {
      await apiJsonWithTimeout("config/providers", 100)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiError)
    const err = caught as ApiError
    expect(err.status).toBe(400)
    expect(err.path).toBe("config/providers")
    expect(err.body).toEqual({ message: "provider config failed before model list loaded" })
    expect(err.message).toContain("provider config failed")
  })
})
