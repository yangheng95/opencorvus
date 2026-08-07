import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test"
import { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT } from "@opencorvus-ai/transport-protocol"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

// Guards Phase 3: blob object URL lifetime is owned by the module-level
// cache in services/api, not by the rendering component. These tests pin
// the contract:
//   1. Repeated `fetchResourceAsObjectUrl` calls for the same raw URL hit
//      the cache and return the same blob URL without re-fetching — so
//      remounting the FilePart subtree never triggers a network roundtrip
//      nor a momentarily-empty <img>.
//   2. Concurrent callers for the same URL share a single in-flight fetch
//      so a burst of mounts does not amplify network traffic.
//   3. `peekResourceObjectUrl` returns the cached URL synchronously once
//      the resource has been materialised — that's what keeps Solid's
//      createResource signal non-pending on the first read after remount.

const originalFetch = globalThis.fetch
const originalCreateObjectURL = (globalThis.URL as any).createObjectURL
const originalRevokeObjectURL = (globalThis.URL as any).revokeObjectURL

describe("blob URL cache", () => {
  let blobCounter = 0
  let fetchCalls: string[]

  beforeEach(() => {
    blobCounter = 0
    fetchCalls = []
    ;(globalThis.URL as any).createObjectURL = (_blob: any) => `blob:fake-${++blobCounter}`
    ;(globalThis.URL as any).revokeObjectURL = (_url: string) => {}
    globalThis.fetch = mock(async (url: string) => {
      fetchCalls.push(String(url))
      // audit-2026-04-29 W2-V25 — the mock blob must provide
      // arrayBuffer() because the binary path in
      // tauri-transport.readResponse calls `blob.arrayBuffer()` to
      // materialise the bytes (see tauri-transport.ts:115-116).
      // Pre-fix the mock returned `{}` which crashed with
      // "blob.arrayBuffer is not a function" — so all 3 cache
      // tests had been silently failing.
      return {
        ok: true,
        status: 200,
        headers: new Map([["content-type", "image/png"]]) as any,
        blob: async () => ({
          arrayBuffer: async () => new Uint8Array(0).buffer,
        }),
        // Mirror Response.headers iterator shape used by
        // headersToObject in tauri-transport.ts:246-251.
        forEach: () => {},
      } as any
    })
  })

  afterEach(() => {
    __setHostTransportForTest(undefined)
    globalThis.fetch = originalFetch
    ;(globalThis.URL as any).createObjectURL = originalCreateObjectURL
    ;(globalThis.URL as any).revokeObjectURL = originalRevokeObjectURL
  })

  test("second call with same raw URL returns the cached blob and does not refetch", async () => {
    // Deferred import so the fetch/URL stubs above are in place before the
    // module-level cache gets any live values.
    const { fetchResourceAsObjectUrl } = await import("../src/services/api")
    const url1 = await fetchResourceAsObjectUrl("/attachment/proj/cache-a.png")
    const url2 = await fetchResourceAsObjectUrl("/attachment/proj/cache-a.png")
    expect(url1).toBe(url2)
    expect(fetchCalls.length).toBe(1)
  })

  test("peekResourceObjectUrl returns the cached URL synchronously after first fetch", async () => {
    const { fetchResourceAsObjectUrl, peekResourceObjectUrl } = await import("../src/services/api")
    expect(peekResourceObjectUrl("/attachment/proj/cache-b.png")).toBeUndefined()
    const materialised = await fetchResourceAsObjectUrl("/attachment/proj/cache-b.png")
    expect(peekResourceObjectUrl("/attachment/proj/cache-b.png")).toBe(materialised)
  })

  test("server-relative resource URLs preserve query parameters through host transport", async () => {
    const { fetchResourceAsObjectUrl, peekResourceObjectUrl } = await import("../src/services/api")
    const requests: TransportRequest[] = []
    const transport = {
      kind: "tauri",
      capabilities: HOST_CAPABILITIES.tauri,
      async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(req)
        return {
          status: 200,
          ok: true,
          headers: { "content-type": "image/webp" },
          body: new Uint8Array([1, 2, 3]) as T,
        }
      },
      openStream() {
        throw new Error("openStream not used")
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport
    __setHostTransportForTest(transport)

    const raw = `/attachment/proj/shot.png?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}`
    const materialised = await fetchResourceAsObjectUrl(raw)

    expect(materialised).toBe("blob:fake-1")
    expect(requests).toHaveLength(1)
    expect(requests[0]?.path).toBe("attachment/proj/shot.png")
    expect(requests[0]?.query).toEqual({ variant: SCREENSHOT_BROWSER_THUMBNAIL_VARIANT })
    expect(peekResourceObjectUrl(raw)).toBe(materialised)
  })

  test("concurrent callers for the same URL share a single in-flight fetch", async () => {
    const { fetchResourceAsObjectUrl } = await import("../src/services/api")
    const [u1, u2, u3] = await Promise.all([
      fetchResourceAsObjectUrl("/attachment/proj/cache-c.png"),
      fetchResourceAsObjectUrl("/attachment/proj/cache-c.png"),
      fetchResourceAsObjectUrl("/attachment/proj/cache-c.png"),
    ])
    expect(u1).toBe(u2)
    expect(u2).toBe(u3)
    expect(fetchCalls.length).toBe(1)
  })

  test("aborting the only consumer cancels the underlying resource request without caching", async () => {
    const { fetchResourceAsObjectUrl, peekResourceObjectUrl } = await import("../src/services/api")
    let started!: () => void
    let transportSignal: AbortSignal | undefined
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const transport = {
      kind: "tauri",
      capabilities: HOST_CAPABILITIES.tauri,
      async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        expect(req.path).toBe("attachment/proj/abort.png")
        transportSignal = req.signal
        started()
        return await new Promise<TransportResponse<T>>((_resolve, reject) => {
          req.signal?.addEventListener(
            "abort",
            () => reject(req.signal?.reason ?? new DOMException("transport aborted", "AbortError")),
            { once: true },
          )
        })
      },
      openStream() {
        throw new Error("openStream not used")
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport
    __setHostTransportForTest(transport)

    const controller = new AbortController()
    const pending = fetchResourceAsObjectUrl("/attachment/proj/abort.png", { signal: controller.signal })
    await requestStarted
    controller.abort(new DOMException("thumbnail unmounted", "AbortError"))

    await expect(pending).rejects.toThrow("thumbnail unmounted")
    expect(transportSignal?.aborted).toBe(true)
    expect(peekResourceObjectUrl("/attachment/proj/abort.png")).toBeUndefined()
  })

  test("aborting one shared consumer keeps the in-flight request for remaining consumers", async () => {
    const { fetchResourceAsObjectUrl, peekResourceObjectUrl } = await import("../src/services/api")
    let requestCount = 0
    let markRequestStarted!: () => void
    let resolveRequest!: () => void
    let transportSignal: AbortSignal | undefined
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve
    })
    const requestReady = new Promise<void>((resolve) => {
      resolveRequest = resolve
    })
    const transport = {
      kind: "tauri",
      capabilities: HOST_CAPABILITIES.tauri,
      async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        requestCount += 1
        expect(req.path).toBe("attachment/proj/shared-abort.png")
        transportSignal = req.signal
        markRequestStarted()
        await requestReady
        return {
          status: 200,
          ok: true,
          headers: { "content-type": "image/png" },
          body: new Uint8Array([1, 2, 3]) as T,
        }
      },
      openStream() {
        throw new Error("openStream not used")
      },
      async native() {
        throw new Error("native not used")
      },
    } satisfies HostTransport
    __setHostTransportForTest(transport)

    const controller = new AbortController()
    const first = fetchResourceAsObjectUrl("/attachment/proj/shared-abort.png", { signal: controller.signal })
    const second = fetchResourceAsObjectUrl("/attachment/proj/shared-abort.png")
    await requestStarted
    controller.abort(new DOMException("only one consumer left", "AbortError"))

    await expect(first).rejects.toThrow("only one consumer left")
    expect(transportSignal?.aborted).toBe(false)
    resolveRequest()
    const resolved = await second

    expect(requestCount).toBe(1)
    expect(resolved).toBe("blob:fake-1")
    expect(peekResourceObjectUrl("/attachment/proj/shared-abort.png")).toBe(resolved)
  })
})
