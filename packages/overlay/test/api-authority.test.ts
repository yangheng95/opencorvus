import { afterEach, expect, test } from "bun:test"
import {
  ApiAuthorityChangedError,
  ApiError,
  apiJson,
  apiJsonWithTimeout,
  apiRequest,
  captureApiAuthority,
  configure,
  fetchResourceAsObjectUrl,
  isApiAuthorityCurrent,
  onApiError,
  peekResourceObjectUrl,
  renewApiAuthority,
  serverSettledRequest,
} from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"

const originalFetch = globalThis.fetch
function fixtureFetch(respond: (...args: Parameters<typeof fetch>) => Promise<Response>): typeof fetch {
  return Object.assign(respond, { preconnect: originalFetch.preconnect })
}
afterEach(() => {
  globalThis.fetch = originalFetch
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" })
})

function start() {
  configure({ serverUrl: "http://a.invalid/prefix", username: "dummy", password: "", directory: "/owned/a" })
  const transport = createTauriTransport("browser")
  __setHostTransportForTest(transport)
  return transport
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function localError(value: unknown): ApiAuthorityChangedError {
  expect(value).toBeInstanceOf(ApiAuthorityChangedError)
  return value as ApiAuthorityChangedError
}

test("authority follows applied connection ABA and explicit same-URL renewal, while directory retains its owner", () => {
  start()
  const a = captureApiAuthority()
  configure({ directory: "/owned/other" })
  expect(captureApiAuthority()).toEqual(a)
  configure({ password: "DUMMY_NON_CREDENTIAL" })
  const b = captureApiAuthority()
  configure({ password: "" })
  const returned = captureApiAuthority()
  renewApiAuthority()
  expect([a.revision, b.revision, returned.revision, captureApiAuthority().revision]).toEqual([
    a.revision,
    a.revision + 1,
    a.revision + 2,
    a.revision + 3,
  ])
  expect(isApiAuthorityCurrent(captureApiAuthority())).toBe(true)
})

test("Response fixture current API request preserves exact target, payload and public error notification", async () => {
  start()
  const request = { url: "", method: "", body: "" }
  globalThis.fetch = fixtureFetch(async (url, init) => {
    Object.assign(request, { url: String(url), method: init?.method, body: init?.body })
    return Response.json(
      { name: "BadRequestError", data: { message: "Current rejection" } },
      {
        status: 400,
        headers: { "x-opencorvus-request-id": "current-400" },
      },
    )
  })
  const notifications: string[] = []
  const remove = onApiError((error) => notifications.push(error.requestID!))
  try {
    const result = await apiJson("config", {
      authority: captureApiAuthority(),
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dummy/model" }),
    }).catch((error) => error)
    expect(result).toBeInstanceOf(ApiError)
    expect(result).toMatchObject({ status: 400, requestID: "current-400", body: { name: "BadRequestError" } })
    expect(request).toEqual({
      url: "http://a.invalid/prefix/config?directory=%2Fowned%2Fa",
      method: "PATCH",
      body: '{"model":"dummy/model"}',
    })
    expect(notifications).toEqual(["current-400"])
  } finally {
    remove()
  }
})

test("supplied stale API and direct transport tokens produce the exact local pre-dispatch contract", async () => {
  const transport = start()
  const authority = captureApiAuthority()
  configure({ serverUrl: "http://b.invalid", directory: "" })
  for (const operation of [
    () => apiJson("config", { authority }),
    () => transport.request({ path: "global/config", authority }),
    () => apiJsonWithTimeout("global/config", 100, { authority }),
  ]) {
    const error = localError(await operation().catch((error) => error))
    expect(error.outcome).toEqual({ phase: "before_dispatch" })
    expect(error).toMatchObject({
      phase: "before_dispatch",
      expectedRevision: authority.revision,
      currentRevision: authority.revision + 1,
    })
  }
  expect(() => transport.openStream({ path: "global/event", authority }, { onEvent() {} })).toThrow(
    ApiAuthorityChangedError,
  )
})

for (const status of [200, 409]) {
  test(`Response fixture retired mutation retains its actual ${status} receipt privately`, async () => {
    start()
    const pending = deferred<Response>()
    globalThis.fetch = fixtureFetch(() => pending.promise)
    const authority = captureApiAuthority()
    const result = apiJson("config", serverSettledRequest({ authority, method: "PATCH" })).catch((error) => error)
    configure({ serverUrl: "http://b.invalid" })
    const body = { committed: true, config: { model: "origin/model" } }
    pending.resolve(Response.json(body, { status, headers: { "x-opencorvus-request-id": `origin-${status}` } }))
    const error = localError(await result)
    expect(error.phase).toBe("response")
    if (error.outcome.phase !== "response") throw new Error("Expected the original HTTP receipt")
    expect(error.outcome.response).toEqual({
      status,
      ok: status === 200,
      headers: { "content-type": "application/json;charset=utf-8", "x-opencorvus-request-id": `origin-${status}` },
      body,
    })
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "ApiAuthorityChangedError",
      phase: "response",
      expectedRevision: authority.revision,
      currentRevision: authority.revision + 1,
    })
    expect(error.message).toBe("The API connection changed during this operation.")
  })
}

test("Response fixture obsolete binary body retains actual bytes and request headers", async () => {
  const transport = start()
  const pending = deferred<Response>()
  globalThis.fetch = fixtureFetch(() => pending.promise)
  const result = transport
    .request<Uint8Array>({ path: "attachment/dummy", responseKind: "binary" })
    .catch((error) => error)
  renewApiAuthority()
  pending.resolve(new Response(new Uint8Array([4, 8, 16]), { headers: { "x-opencorvus-request-id": "bytes-a" } }))
  const error = localError(await result)
  if (error.outcome.phase !== "response") throw new Error("Expected the binary receipt")
  expect(error.outcome.response.body).toEqual(new Uint8Array([4, 8, 16]))
  expect(error.outcome.response.headers["x-opencorvus-request-id"]).toBe("bytes-a")
})

test("actual thrown local transport failure retains its exact object and unknown remote outcome", async () => {
  start()
  const pending = deferred<Response>()
  globalThis.fetch = fixtureFetch(() => pending.promise)
  const authority = captureApiAuthority()
  const result = apiRequest("global/config", { method: "PATCH" }).catch((error) => error)
  configure({ serverUrl: "http://b.invalid" })
  const original = new TypeError("dummy connection lost after dispatch")
  pending.reject(original)
  const error = localError(await result)
  expect(error.phase).toBe("transport_failure")
  if (error.outcome.phase !== "transport_failure") throw new Error("Expected actual transport failure")
  expect(error.outcome.cause).toBe(original)
  expect(JSON.parse(JSON.stringify(error))).toEqual({
    name: "ApiAuthorityChangedError",
    phase: "transport_failure",
    expectedRevision: authority.revision,
    currentRevision: authority.revision + 1,
  })
})

test("Response fixture caller continuation carries one authority through GET then stale PATCH", async () => {
  start()
  globalThis.fetch = fixtureFetch(async () => Response.json({ model: "a/model" }))
  const authority = captureApiAuthority()
  expect(await apiJson<{ model: string }>("global/config", { authority })).toEqual({ model: "a/model" })
  configure({ serverUrl: "http://b.invalid" })
  const error = localError(await apiJson("global/config", { method: "PATCH", authority }).catch((error) => error))
  expect(error.outcome).toEqual({ phase: "before_dispatch" })
  globalThis.fetch = fixtureFetch(async () => Response.json({ model: "b/model" }))
  expect(await apiJson<{ model: string }>("global/config")).toEqual({ model: "b/model" })
})

test("Response fixture named errors publish only the current connection's actual notification", async () => {
  start()
  const a = deferred<Response>()
  globalThis.fetch = fixtureFetch(() => a.promise)
  const notices: string[] = []
  const remove = onApiError((error) => notices.push(error.requestID!))
  try {
    const retired = apiJson("global/config").catch((error) => error)
    configure({ serverUrl: "http://b.invalid" })
    a.resolve(
      Response.json(
        { name: "ProjectDirectoryMissingError" },
        { status: 404, headers: { "x-opencorvus-request-id": "a-missing" } },
      ),
    )
    const error = localError(await retired)
    if (error.outcome.phase !== "response") throw new Error("Expected A's real named response")
    expect(error.outcome.response).toMatchObject({ status: 404, body: { name: "ProjectDirectoryMissingError" } })
    globalThis.fetch = fixtureFetch(async () =>
      Response.json({ name: "BadRequestError" }, { status: 400, headers: { "x-opencorvus-request-id": "b-current" } }),
    )
    expect(await apiJson("global/config").catch((error) => error)).toBeInstanceOf(ApiError)
    expect(notices).toEqual(["b-current"])
  } finally {
    remove()
  }
})

test("Response fixture resource cache retires A bytes and joins only B's exact pending owner", async () => {
  start()
  const a = deferred<Response>()
  const b = deferred<Response>()
  globalThis.fetch = fixtureFetch((url) => (String(url).startsWith("http://a.invalid/") ? a.promise : b.promise))
  const raw = "/attachment/authority-shared"
  const aResult = fetchResourceAsObjectUrl(raw).catch((error) => error)
  await Promise.resolve()
  configure({ serverUrl: "http://b.invalid" })
  const bResult = fetchResourceAsObjectUrl(raw)
  await Promise.resolve()
  a.resolve(new Response(new Uint8Array([1, 2])))
  const old = localError(await aResult)
  if (old.outcome.phase !== "response") throw new Error("Expected A's original resource bytes")
  expect(old.outcome.response.body).toEqual(new Uint8Array([1, 2]))
  const bJoined = fetchResourceAsObjectUrl(raw)
  b.resolve(new Response(new Uint8Array([8, 9]), { headers: { "content-type": "application/octet-stream" } }))
  const [bUrl, joinedUrl] = await Promise.all([bResult, bJoined])
  expect(joinedUrl).toBe(bUrl)
  expect(peekResourceObjectUrl(raw)).toBe(bUrl)
  expect(new Uint8Array(await (await originalFetch(bUrl)).arrayBuffer())).toEqual(new Uint8Array([8, 9]))
  const revoked: string[] = []
  const originalRevoke = URL.revokeObjectURL
  URL.revokeObjectURL = (url) => {
    revoked.push(url)
    originalRevoke(url)
  }
  try {
    renewApiAuthority()
    expect(revoked).toEqual([bUrl])
    globalThis.fetch = fixtureFetch(async () => new Response(new Uint8Array([21, 34])))
    const renewedUrl = await fetchResourceAsObjectUrl(raw)
    expect(peekResourceObjectUrl(raw)).toBe(renewedUrl)
    expect(new Uint8Array(await (await originalFetch(renewedUrl)).arrayBuffer())).toEqual(new Uint8Array([21, 34]))
  } finally {
    URL.revokeObjectURL = originalRevoke
  }
})

test("external resource Blob keeps its original cache ownership across API authority renewal", async () => {
  start()
  const raw = "https://external.invalid/authority-resource"
  globalThis.fetch = fixtureFetch(async () => new Response(new Uint8Array([55, 89])))
  const url = await fetchResourceAsObjectUrl(raw)
  renewApiAuthority()
  expect(await fetchResourceAsObjectUrl(raw)).toBe(url)
  expect(new Uint8Array(await (await originalFetch(url)).arrayBuffer())).toEqual(new Uint8Array([55, 89]))
})
