import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { apiHeaders, apiJson, apiJsonWithTimeout, ApiError, configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { formatErrorDetails } from "../src/utils/error-details"
import { downloadZipArchive } from "../src/services/project-archive"

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
  configure({ username: "opencorvus", password: "", directory: "" })
})

describe("apiJson + ApiError", () => {
  test.each([
    { name: "named UTF8 JSON", status: 404, text: '{"name":"NotFoundError","data":{"message":"原产物不可用"}}', body: { name: "NotFoundError", data: { message: "原产物不可用" } }, detail: "原产物不可用" },
    { name: "message JSON", status: 409, text: '{"message":"Read conflict"}', body: { message: "Read conflict" }, detail: "Read conflict" },
    { name: "problem JSON", status: 429, text: '{"detail":"Read limit reached"}', body: { detail: "Read limit reached" }, detail: "Read limit reached" },
    { name: "plain authentication response", status: 401, text: " Unauthorized ", body: "Unauthorized", detail: "Unauthorized" },
    { name: "malformed JSON text", status: 502, text: '{"message": upstream unavailable', body: '{"message": upstream unavailable', detail: '{"message": upstream unavailable' },
    { name: "empty bytes", status: 503, text: "", body: "", detail: "" },
  ])("materializes one binary $name body for every diagnostic", ({ status, text, body, detail }) => {
    const error = new ApiError(status, "binary/read", new TextEncoder().encode(text), {
      "X-OpenCorvus-Request-ID": "binary-response-1",
    })
    expect(error.body).toEqual(body)
    expect(error.message).toBe(`API ${status} binary/read${detail ? `: ${detail}` : ""}`)
    expect(error.summary).toBe(`API ${status}${detail ? `: ${detail}` : ""}`)
    expect(error.requestID).toBe("binary-response-1")
    error.stack = "ApiError: binary fixture stack"
    const rendered = typeof body === "string" ? body : JSON.stringify(body, null, 2)
    expect(formatErrorDetails(error)).toBe(
      `HTTP ${status} binary/read\n\nRequest ID: binary-response-1\n\nApiError: binary fixture stack${rendered ? `\n\nresponse body:\n${rendered}` : ""}`,
    )
  })

  test.each(["x-opencorvus-request-id", "X-OpenCorvus-Request-ID"])(
    "preserves the actual %s response correlation in complete diagnostics",
    async (headerName) => {
      const requestID = "8433fb94-caeb-4a6e-bff6-b6995a771b66"
      const body = { name: "UnknownError", data: { message: "Public explanation" } }
      __setHostTransportForTest(
        fakeTransport(() => ({ status: 500, ok: false, headers: { [headerName]: ` ${requestID} ` }, body })),
      )
      const error = await apiJson("attachment").catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(ApiError)
      const typed = error as ApiError
      expect(typed.requestID).toBe(requestID)
      expect(typed.status).toBe(500)
      expect(typed.path).toBe("attachment")
      expect(typed.body).toBe(body)
      expect(typed.message).toBe("API 500 attachment: Public explanation")
      expect(typed.summary).toBe("API 500: Public explanation")
      typed.stack = "ApiError: fixture stack"
      expect(formatErrorDetails(typed)).toBe(
        `HTTP 500 attachment\n\nRequest ID: ${requestID}\n\nApiError: fixture stack\n\nresponse body:\n${JSON.stringify(body, null, 2)}`,
      )
    },
  )

  test("binary archive failure preserves decoded public body and its response correlation", async () => {
    const body = { message: "Archive is unavailable" }
    __setHostTransportForTest(
      fakeTransport(() => ({
        status: 409,
        ok: false,
        headers: { "x-opencorvus-request-id": "archive-response-1" },
        body: new TextEncoder().encode(JSON.stringify(body)),
      })),
    )
    const error = await downloadZipArchive({ path: "project/archive" }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    const typed = error as ApiError
    expect(typed.requestID).toBe("archive-response-1")
    expect(typed.body).toEqual(body)
    expect(typed.message).toBe("API 409 project/archive: Archive is unavailable")
  })

  test.each([
    {
      status: 500,
      body: { name: "StorageError", data: { message: "Storage is unavailable" } },
      summary: "API 500: Storage is unavailable",
      message: "API 500 attachment?directory=D%3A%2Fproject: Storage is unavailable",
    },
    {
      status: 400,
      body: { message: "Invalid file", error: "Secondary explanation" },
      summary: "API 400: Invalid file",
      message: "API 400 attachment?directory=D%3A%2Fproject: Invalid file",
    },
    {
      status: 502,
      body: "Bad Gateway",
      summary: "API 502: Bad Gateway",
      message: "API 502 attachment?directory=D%3A%2Fproject: Bad Gateway",
    },
    {
      status: 503,
      body: null,
      summary: "API 503",
      message: "API 503 attachment?directory=D%3A%2Fproject",
    },
  ])("derives a concise summary and preserves the complete $status diagnostic", ({ status, body, summary, message }) => {
    const error = new ApiError(status, "attachment?directory=D%3A%2Fproject", body, {})
    expect(error.summary).toBe(summary)
    expect(error.message).toBe(message)
    expect(error.status).toBe(status)
    expect(error.path).toBe("attachment?directory=D%3A%2Fproject")
    expect(error.body).toBe(body)
  })

  test("applies an explicit empty Basic Auth username", () => {
    configure({ username: "", password: "secret" })
    expect(apiHeaders().Authorization).toBe("Basic OnNlY3JldA==")
  })

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
        headers: { "x-opencorvus-request-id": "timed-response-1" },
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
    expect(err.requestID).toBe("timed-response-1")
    expect(err.message).toContain("provider config failed")
  })
})
