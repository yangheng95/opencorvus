import { expect, test } from "bun:test"
import { createOpenCorvusClient } from "../src/client"

const directory = "C:\\owned project\\中文"

function environment(options: { retryEventOnce?: boolean } = {}) {
  const requests: Array<{ url: string; method: string; body: Uint8Array; mime: string | null }> = []
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({ url: request.url, method: request.method, body: new Uint8Array(await request.arrayBuffer()), mime: request.headers.get("content-type") })
      if (url.pathname.endsWith("/event")) {
        if (options.retryEventOnce && requests.length === 1) return new Response("Owned temporary event failure", { status: 503 })
        return new Response('data: {"type":"server.connected","properties":{}}\n\n', { headers: { "Content-Type": "text/event-stream" } })
      }
      if (url.pathname.endsWith("/global/health")) return Response.json({ healthy: true, version: "owned" })
      if (request.method === "POST") return Response.json({ projectID: "owned-project", url: "/attachment/owned-project/original.bin", mime: "application/octet-stream", size: 4 })
      return Response.json({ id: "owned-project", worktree: url.searchParams.get("directory") })
    },
  })
  return { requests, origin: server.url.origin, [Symbol.dispose]() { server.stop(true) } }
}

test("SSE reconnect applies the same logical project directory to the next request", async () => {
  using env = environment({ retryEventOnce: true })
  const baseUrl = env.origin + "/global/selected"
  const sdk = createOpenCorvusClient({ baseUrl, directory })
  const stream = await sdk.event.subscribe(undefined, { sseMaxRetryAttempts: 2, sseDefaultRetryDelay: 1 })
  const events = []
  for await (const event of stream.stream) events.push(event)
  expect(events).toEqual([{ type: "server.connected", properties: {} }])
  expect(env.requests.map(row => row.url)).toEqual([scopedUrl(baseUrl, "/event"), scopedUrl(baseUrl, "/event")])
})

function scopedUrl(base: string, route: string, selected = directory) {
  const url = new URL(base + route)
  url.searchParams.set("directory", selected)
  return url.href
}

for (const prefix of ["", "/api/opencorvus", "/global/opencorvus"]) {
  test(`logical project and global endpoints retain their actual scope at ${prefix || "/"}`, async () => {
    using env = environment()
    const baseUrl = env.origin + prefix
    const sdk = createOpenCorvusClient({ baseUrl, directory })
    expect((await sdk.project.current()).data).toMatchObject({ id: "owned-project", worktree: directory })
    expect((await sdk.global.health()).data).toEqual({ healthy: true, version: "owned" })
    expect(env.requests.map(row => ({ url: row.url, method: row.method }))).toEqual([
      { url: scopedUrl(baseUrl, "/project/current"), method: "GET" },
      { url: baseUrl + "/global/health", method: "GET" },
    ])
  })
}

test("a per-request service address receives the factory's project directory", async () => {
  using env = environment()
  const sdk = createOpenCorvusClient({ baseUrl: env.origin + "/api", directory })
  const baseUrl = env.origin + "/global/selected"
  expect((await sdk.project.current(undefined, { baseUrl })).data?.worktree).toBe(directory)
  expect(env.requests.map(row => row.url)).toEqual([scopedUrl(baseUrl, "/project/current")])
})

test("a per-request fetch carries the same logical project scope", async () => {
  using env = environment()
  const selections: string[] = []
  const sdk = createOpenCorvusClient({ baseUrl: env.origin, directory })
  const selectedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    selections.push("selected-request-fetch")
    return fetch(input, init)
  }) as typeof fetch
  expect((await sdk.project.current(undefined, { fetch: selectedFetch })).data?.worktree).toBe(directory)
  expect(selections).toEqual(["selected-request-fetch"])
  expect(env.requests.map(row => row.url)).toEqual([scopedUrl(env.origin, "/project/current")])
})

test("an explicitly selected directory overrides the factory default", async () => {
  using env = environment()
  const sdk = createOpenCorvusClient({ baseUrl: env.origin + "/global/selected", directory })
  const selected = "D:\\another selected project"
  expect((await sdk.project.current({ directory: selected })).data?.worktree).toBe(selected)
  const observed = new URL(env.requests[0].url)
  expect({ origin: observed.origin, path: observed.pathname, directory: observed.searchParams.get("directory") })
    .toEqual({ origin: env.origin, path: "/global/selected/project/current", directory: selected })
})

test("scoped uploads deliver their actual binary body and declared content type", async () => {
  using env = environment()
  const baseUrl = env.origin + "/global/selected"
  const sdk = createOpenCorvusClient({ baseUrl, directory })
  const bytes = new Uint8Array([0, 255, 13, 10])
  expect((await sdk.attachment.create({ filename: "original.bin", body: new Blob([bytes]) },
    { headers: { "Content-Type": "application/octet-stream" }, throwOnError: true })).data)
    .toMatchObject({ projectID: "owned-project", size: bytes.length })
  const url = new URL(scopedUrl(baseUrl, "/attachment"))
  url.searchParams.set("filename", "original.bin")
  const observed = new URL(env.requests[0].url)
  expect({ pathname: observed.pathname, query: Object.fromEntries(observed.searchParams) })
    .toEqual({ pathname: url.pathname, query: Object.fromEntries(url.searchParams) })
  expect(env.requests[0]).toMatchObject({ method: "POST", body: bytes, mime: "application/octet-stream" })
})

for (const customFetch of [false, true]) {
  test(`SSE project events carry the logical directory with ${customFetch ? "request" : "configured"} fetch`, async () => {
    using env = environment()
    const baseUrl = env.origin + "/global/selected"
    const sdk = createOpenCorvusClient({ baseUrl, directory })
    const stream = await sdk.event.subscribe(undefined, { sseMaxRetryAttempts: 1, ...(customFetch ? { fetch } : {}) })
    for await (const event of stream.stream) {
      expect(event).toEqual({ type: "server.connected", properties: {} })
      break
    }
    expect(env.requests.map(row => row.url)).toEqual([scopedUrl(baseUrl, "/event")])
  })
}
