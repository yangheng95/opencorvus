import { expect, test } from "bun:test"
import http from "node:http"
import { once } from "node:events"

test("real finite HTTP body reader records original read and cancel abort error identities", async () => {
  const events: Array<{ type: string; at: number }> = []
  const sockets = new Set<import("node:net").Socket>()
  const socketClosures: Promise<void>[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const schedule = (ms: number, fn: () => void) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
  const controller = new AbortController()
  const reason = new DOMException("Owned reader probe abort", "AbortError")
  const server = http.createServer((_request, response) => {
    response.on("close", () => events.push({ type: "response_close", at: Date.now() }))
    response.writeHead(200, { "content-type": "text/plain", "transfer-encoding": "chunked" })
    response.flushHeaders(); response.write("first")
    events.push({ type: "headers_first_chunk", at: Date.now() })
    schedule(250, () => { if (!response.destroyed) response.end("final") })
  })
  server.on("connection", socket => { sockets.add(socket); socketClosures.push(new Promise(resolve => socket.once("close", () => { sockets.delete(socket); events.push({ type: "socket_close", at: Date.now() }); resolve() }))) })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Owned reader probe HTTP bind failed")
  schedule(1500, () => controller.abort(reason))
  schedule(2500, () => server.closeAllConnections())
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let readError: unknown, cancelError: unknown
  let firstBytes = 0
  let readStatus = "", cancelStatus = ""
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/reader-abort`, { signal: controller.signal })
    if (!response.body) throw new Error("Actual HTTP response omitted body")
    reader = response.body.getReader()
    const first = await reader.read()
    firstBytes = first.value?.byteLength ?? 0
    events.push({ type: "first_read", at: Date.now() })
    schedule(70, () => { events.push({ type: "parent_abort", at: Date.now() }); controller.abort(reason) })
    try { await reader.read(); readStatus = "fulfilled" } catch (error) { readStatus = "rejected"; readError = error }
    try { await reader.cancel(reason); cancelStatus = "fulfilled" } catch (error) { cancelStatus = "rejected"; cancelError = error }
  } finally {
    events.push({ type: "cleanup_started", at: Date.now() })
    for (const timer of timers) clearTimeout(timer)
    controller.abort(reason)
    reader?.releaseLock()
    const stopped = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    server.closeAllConnections(); for (const socket of sockets) socket.destroy()
    await Promise.all([stopped, ...socketClosures])
    events.push({ type: "cleanup_completed", at: Date.now() })
  }
  const facts = { firstBytes, readStatus, cancelStatus, readError: readError instanceof Error ? { name: readError.name, message: readError.message } : null, cancelError: cancelError instanceof Error ? { name: cancelError.name, message: cancelError.message } : null, exactSameError: readError === cancelError, readEqualsParent: readError === reason, cancelEqualsParent: cancelError === reason, joinedSockets: socketClosures.length, liveSockets: sockets.size, events }
  console.log("webfetch105 reader actual", JSON.stringify(facts))
  expect({ firstBytes, readStatus, cancelStatus }).toEqual({ firstBytes: 5, readStatus: "rejected", cancelStatus: "rejected" })
  expect(facts.readError?.name).toBe("AbortError")
  expect(facts.cancelError?.name).toBe("AbortError")
  expect(facts.liveSockets).toBe(0)
}, 15000)
