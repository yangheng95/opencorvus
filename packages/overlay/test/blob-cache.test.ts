import { expect, test, describe, beforeEach, afterEach } from "bun:test"
import { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT } from "@opencorvus-ai/transport-protocol"
import { ApiError, configure, fetchResourceAsObjectUrl, peekResourceObjectUrl } from "../src/services/api"

// Local Response fixtures qualify service cache, byte and cancellation contracts.
// Native Blob URLs hold actual bytes; no renderer or DOM is involved.
const originalFetch = globalThis.fetch
const bytes = [137, 80, 78, 71]
const response = (value = bytes) => new Response(new Uint8Array(value), { headers: { "content-type": "image/png" } })
const blobBytes = async (url: string) => [...new Uint8Array(await (await originalFetch(url)).arrayBuffer())]
type RequestFact = { url: string; init?: RequestInit }

describe("blob URL cache", () => {
  let requests: RequestFact[]
  let respond: (url: string, init?: RequestInit) => Promise<Response>
  beforeEach(() => {
    configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
    requests = []
    respond = async () => response()
    globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      return respond(url, init)
    }, { preconnect: originalFetch.preconnect })
  })
  afterEach(() => { globalThis.fetch = originalFetch })

  const expectedRequest = (raw: string) => ({
    url: `http://127.0.0.1:7878${raw}`,
    init: { method: "GET", headers: { Accept: "application/json" }, signal: expect.any(AbortSignal) },
  })

  test("repeated reads and peek share the materialized Blob and its exact bytes", async () => {
    const raw = "/attachment/proj/cache-a.png"
    const first = await fetchResourceAsObjectUrl(raw)
    const repeated = await fetchResourceAsObjectUrl(raw)
    expect(repeated).toBe(first)
    expect(peekResourceObjectUrl(raw)).toBe(first)
    expect(await blobBytes(first)).toEqual(bytes)
    expect(requests).toEqual([expectedRequest(raw)])
  })

  test("server-relative query and successful content type reach the materialized Blob", async () => {
    const raw = `/attachment/proj/shot.png?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}`
    respond = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } })
    const materialized = await fetchResourceAsObjectUrl(raw)
    expect(requests).toEqual([expectedRequest(raw)])
    expect(peekResourceObjectUrl(raw)).toBe(materialized)
    const blob = await (await originalFetch(materialized)).blob()
    expect(blob.type).toBe("image/webp")
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3])
  })

  test("concurrent consumers receive the same completed Blob and request identity", async () => {
    const raw = "/attachment/proj/cache-c.png"
    const urls = await Promise.all([fetchResourceAsObjectUrl(raw), fetchResourceAsObjectUrl(raw), fetchResourceAsObjectUrl(raw)])
    expect(urls).toEqual([urls[0], urls[0], urls[0]])
    expect(await blobBytes(urls[0]!)).toEqual(bytes)
    expect(requests).toEqual([expectedRequest(raw)])
  })

  test("last-consumer cancellation reports its reason and a fresh retry completes with bytes", async () => {
    const raw = "/attachment/proj/abort.png"
    let started!: () => void
    const requestStarted = new Promise<void>(resolve => { started = resolve })
    let transportAbort: unknown
    respond = async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => {
        transportAbort = init!.signal!.reason
        reject(transportAbort)
      }, { once: true })
      started()
    })
    const controller = new AbortController()
    const pending = fetchResourceAsObjectUrl(raw, { signal: controller.signal })
    await requestStarted
    controller.abort(new DOMException("thumbnail unmounted", "AbortError"))
    await expect(pending).rejects.toMatchObject({ name: "AbortError", message: "thumbnail unmounted" })
    expect(transportAbort).toMatchObject({ name: "AbortError", message: "Resource request has no active consumers" })
    respond = async () => response([7, 8, 9])
    const fresh = await fetchResourceAsObjectUrl(raw)
    expect(await blobBytes(fresh)).toEqual([7, 8, 9])
    expect(peekResourceObjectUrl(raw)).toBe(fresh)
    expect(requests).toEqual([expectedRequest(raw), expectedRequest(raw)])
  })

  test("a remaining shared consumer completes after the other consumer receives AbortError", async () => {
    const raw = "/attachment/proj/shared-abort.png"
    let started!: () => void
    let complete!: (value: Response) => void
    const requestStarted = new Promise<void>(resolve => { started = resolve })
    respond = async (_url, init) => new Promise<Response>((resolve, reject) => {
      const abort = () => reject(init!.signal!.reason)
      init!.signal!.addEventListener("abort", abort, { once: true })
      complete = value => { init!.signal!.removeEventListener("abort", abort); resolve(value) }
      started()
    })
    const controller = new AbortController()
    const first = fetchResourceAsObjectUrl(raw, { signal: controller.signal })
    const second = fetchResourceAsObjectUrl(raw)
    await requestStarted
    controller.abort(new DOMException("one consumer left", "AbortError"))
    await expect(first).rejects.toMatchObject({ name: "AbortError", message: "one consumer left" })
    complete(response([10, 11, 12]))
    const url = await second
    expect(await blobBytes(url)).toEqual([10, 11, 12])
    expect(peekResourceObjectUrl(raw)).toBe(url)
    expect(requests).toEqual([expectedRequest(raw)])
  })

  test("host-relative failure preserves its raw path and public body before a successful retry", async () => {
    const raw = "/attachment/proj/error.png?variant=thumbnail&directory=D%3A%2Fowned"
    const body = { name: "NotFoundError", data: { message: "Owned image is unavailable" } }
    respond = async () => new Response(JSON.stringify(body), { status: 404, headers: {
      "content-type": "application/json", "x-opencorvus-request-id": "resource-response-1",
    } })
    const error = await fetchResourceAsObjectUrl(raw).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, path: raw, body, requestID: "resource-response-1" })
    expect((error as ApiError).summary).toBe("API 404: Owned image is unavailable")
    respond = async () => response([15, 16])
    const url = await fetchResourceAsObjectUrl(raw)
    expect(await blobBytes(url)).toEqual([15, 16])
    expect(peekResourceObjectUrl(raw)).toBe(url)
    expect(requests).toEqual([expectedRequest(raw), expectedRequest(raw)])
  })

  test("a failed full-window request releases the next resource slot to complete", async () => {
    const finish = new Map<string, (value: Response) => void>()
    let windowReady!: () => void
    let queuedStarted!: () => void
    const ready = new Promise<void>(resolve => { windowReady = resolve })
    const next = new Promise<void>(resolve => { queuedStarted = resolve })
    respond = async (url) => new Promise<Response>(resolve => {
      const pathname = new URL(url).pathname
      finish.set(pathname, resolve)
      if (finish.size === 64) windowReady()
      if (pathname === "/attachment/proj/slot-64.png") queuedStarted()
    })
    const paths = Array.from({ length: 65 }, (_, index) => `/attachment/proj/slot-${index}.png`)
    const pending = paths.map(raw => fetchResourceAsObjectUrl(raw).then(url => ({ url }), error => ({ error })))
    await ready
    finish.get(paths[0]!)!(new Response('{"message":"Resource unavailable"}', { status: 503, headers: { "content-type": "application/json" } }))
    const failed = await pending[0]!
    expect(failed).toMatchObject({ error: { name: "ApiError", status: 503, body: { message: "Resource unavailable" } } })
    await next
    for (let index = 1; index < paths.length; index++) finish.get(paths[index]!)!(response([index]))
    const results = await Promise.all(pending)
    expect(await blobBytes((results[64] as { url: string }).url)).toEqual([64])
    expect(await blobBytes((results[63] as { url: string }).url)).toEqual([63])
    expect(requests).toEqual(paths.map(expectedRequest))
  })
})
