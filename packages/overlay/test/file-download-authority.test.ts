import { afterAll, afterEach, expect, spyOn, test } from "bun:test"
import { artifactExportBlob } from "../src/services/file-download"
import { ApiAuthorityChangedError, captureApiAuthority, configure, renewApiAuthority } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"

const originalFetch = globalThis.fetch
const fetchSpy = spyOn(globalThis, "fetch")
const remote = { filename: "owned.bin", mime: "application/octet-stream", url: "/attachment/owned/download.bin" }
const data = new Uint8Array([0, 31, 128, 255])
afterAll(() => fetchSpy.mockRestore())
function observeFetch(implementation: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  fetchSpy.mockImplementation(Object.assign(implementation, { preconnect: originalFetch.preconnect }))
}
function setup() {
  configure({ serverUrl: "http://download-a.invalid", username: "dummy", password: "", directory: "" })
  const requests: TransportRequest[] = []
  __setHostTransportForTest({ ...createTauriTransport("browser"), request: async (input: TransportRequest) => {
    requests.push(input)
    return { ok: true, status: 200, headers: { "content-type": remote.mime }, body: data }
  }} as HostTransport)
  return { authority: captureApiAuthority(), requests }
}
afterEach(() => {
  fetchSpy.mockImplementation(originalFetch)
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" })
})

test("authored CSV returns its exact BOM and UTF-8 bytes across unrelated API renewal", async () => {
  setup()
  const pending = artifactExportBlob({ filename: "data.csv", mime: "text/csv;charset=utf-8", text: '"你好"' })
  renewApiAuthority()
  const blob = await pending
  expect(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await blob.arrayBuffer())).toBe('\uFEFF"你好"')
  expect(blob.type).toBe("text/csv;charset=utf-8")
})

test("API resource uses the supplied original authority and returns exact native Blob bytes", async () => {
  const { authority, requests } = setup()
  const blob = await artifactExportBlob(remote, { authority })
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data)
  expect(blob.type).toBe(remote.mime)
  expect(requests[0]!.authority).toBe(authority)
  expect(requests[0]!.path).toBe("attachment/owned/download.bin")
})

test("API retirement during the second native blob-body await retains its exact outcome", async () => {
  const { authority } = setup()
  observeFetch(async (...args) => {
    const response = await originalFetch(...args)
    const body = await response.blob()
    Object.defineProperty(response, "blob", { value: async () => {
      renewApiAuthority()
      return body
    }})
    return response
  })
  await expect(artifactExportBlob(remote, { authority })).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", expectedRevision: authority.revision, currentRevision: authority.revision + 1,
    phase: "before_dispatch",
  })
})

test("retired original local-fetch failure reports precise API control cause", async () => {
  const { authority } = setup()
  const cause = new TypeError("owned local blob failed")
  observeFetch(async () => {
    renewApiAuthority()
    throw cause
  })
  try {
    await artifactExportBlob(remote, { authority })
    throw new Error("Expected the original authority retirement")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiAuthorityChangedError)
    expect((error as ApiAuthorityChangedError).outcome).toEqual({ phase: "transport_failure", cause })
  }
})

test("current local blob HTTP failure retains its explicit error contract", async () => {
  const { authority } = setup()
  observeFetch(async () => new Response("current error", { status: 503 }))
  await expect(artifactExportBlob(remote, { authority })).rejects.toThrow("File download failed with HTTP 503")
})

test("caller cancellation returns the original precise abort reason", async () => {
  setup()
  const controller = new AbortController()
  const cause = new DOMException("Original export was retired", "AbortError")
  controller.abort(cause)
  await expect(artifactExportBlob(remote, { signal: controller.signal })).rejects.toBe(cause)
})

test("independent data resource keeps exact bytes through unrelated API rotation", async () => {
  setup()
  const file = { filename: "data.txt", mime: "text/plain", url: "data:text/plain;charset=utf-8,%E4%BD%A0%E5%A5%BD" }
  observeFetch(async (...args) => {
    const response = await originalFetch(...args)
    renewApiAuthority()
    return response
  })
  const blob = await artifactExportBlob(file)
  expect(await blob.text()).toBe("你好")
})
