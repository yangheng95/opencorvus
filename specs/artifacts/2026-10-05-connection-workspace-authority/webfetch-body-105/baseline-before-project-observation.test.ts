import { afterEach, expect, test } from "bun:test"
import http from "node:http"
import { once } from "node:events"
import { Instance } from "../packages/opencorvus/src/project/instance"
import { Session } from "../packages/opencorvus/src/session"
import { resolveSessionExecutionAuthority } from "../packages/opencorvus/src/engine/task-session-lineage"
import { Tool } from "../packages/opencorvus/src/tool/tool"
import { executeWebFetch } from "../packages/opencorvus/src/tool/webfetch"
import { memoryProject, resetMemoryDatabase } from "../packages/opencorvus/test/fixture/memory"

afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })
type Mode = "deadline" | "parent" | "oversize"
async function measure(mode: Mode) {
  await using project = await memoryProject(`webfetch105-${mode}`)
  return Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Owned local HTTP body measurement" })
    const executionAuthority = await resolveSessionExecutionAuthority({ sessionID: session.id, projectID: Instance.project.id, expected: { kind: "conversation" } })
    const controller = new AbortController()
    const parentReason = new DOMException("Owned finite parent safety abort", "AbortError")
    const context: Tool.Context = { sessionID: session.id, messageID: "message_webfetch105", callID: `call_webfetch105_${mode}`, agent: "coding", abort: controller.signal, messages: [], executionAuthority, executionSurface: Tool.executionSurface(["webfetch"], []), metadata() {}, async ask() {} }
    const events: Array<{ type: string; at: number; bytes?: number; phase?: string }> = []
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let phase = "setup"
    const socketClosePromises: Promise<void>[] = []
    let socketCount = 0
    const sockets = new Set<import("node:net").Socket>()
    const schedule = (ms: number, action: () => void) => { const timer = setTimeout(() => { timers.delete(timer); action() }, ms); timers.add(timer) }
    let sentBytes = 0
    let resolveClosed!: () => void
    const closed = new Promise<void>(resolve => { resolveClosed = resolve })
    const server = http.createServer((request, response) => {
      events.push({ type: "request", at: Date.now() })
      response.on("close", () => { events.push({ type: "response_close", at: Date.now(), bytes: sentBytes, phase }); resolveClosed() })
      response.on("finish", () => events.push({ type: "response_finish", at: Date.now(), bytes: sentBytes }))
      request.on("aborted", () => events.push({ type: "request_aborted", at: Date.now() }))
      response.writeHead(200, { "content-type": "text/plain", "transfer-encoding": "chunked" })
      response.flushHeaders()
      events.push({ type: "headers", at: Date.now() })
      if (mode === "oversize") {
        const chunk = Buffer.alloc(64 * 1024, 97)
        let index = 0
        const send = () => {
          if (response.destroyed) return
          response.write(chunk); sentBytes += chunk.byteLength; index++
          events.push({ type: "body_chunk", at: Date.now(), bytes: sentBytes })
          if (index === 96) { events.push({ type: "body_eof", at: Date.now(), bytes: sentBytes }); response.end() }
          else schedule(5, send)
        }
        send()
      } else {
        response.write("first"); sentBytes += 5
        events.push({ type: "body_chunk", at: Date.now(), bytes: sentBytes })
        schedule(250, () => { if (!response.destroyed) { sentBytes += 5; events.push({ type: "body_eof", at: Date.now(), bytes: sentBytes }); response.end("final") } })
        if (mode === "parent") schedule(70, () => { events.push({ type: "parent_abort", at: Date.now() }); controller.abort(parentReason) })
      }
    })
    server.on("connection", socket => { sockets.add(socket); socketCount++; socketClosePromises.push(new Promise<void>(resolve => socket.once("close", () => { sockets.delete(socket); events.push({ type: "socket_close", at: Date.now(), phase }); resolve() }))) })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Owned HTTP server did not bind exact TCP address")
    const url = `http://127.0.0.1:${address.port}/${mode}`
    schedule(2500, () => { events.push({ type: "safety_close_connections", at: Date.now() }); server.closeAllConnections() })
    schedule(1500, () => { events.push({ type: "safety_abort", at: Date.now() }); controller.abort(parentReason) })
    let result: { kind: "value"; outputBytes: number; output?: string } | { kind: "error"; name: string; message: string; sameParentReason: boolean }
    try {
      try {
        phase = "tool"
        events.push({ type: "tool_started", at: Date.now(), phase })
        const fetched = await executeWebFetch({ url, format: "text", timeout: mode === "deadline" ? 0.05 : 1 }, context)
        result = { kind: "value", outputBytes: Buffer.byteLength(fetched.output), ...(mode === "deadline" ? { output: fetched.output } : {}) }
      } catch (error) {
        result = { kind: "error", name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error), sameParentReason: error === parentReason }
      }
      events.push({ type: "tool_settled", at: Date.now(), phase })
      if (events.some(event => event.type === "request")) await closed
    } finally {
      phase = "cleanup"
      events.push({ type: "cleanup_started", at: Date.now(), phase })
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      controller.abort(parentReason)
      const settlement = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      server.closeAllConnections()
      for (const socket of sockets) socket.destroy()
      await Promise.all([settlement, ...socketClosePromises])
      events.push({ type: "cleanup_completed", at: Date.now(), phase })
    }
    const facts = { mode, projectID: Instance.project.id, directory: project.path, sessionID: session.id, executionAuthority, url, requestedTimeoutMs: mode === "deadline" ? 50 : 1000, finiteServerEOFMs: mode === "oversize" ? 480 : 250, parentSafetyMs: 1500, responseLimit: 5 * 1024 * 1024, authoredMaximum: mode === "oversize" ? 6 * 1024 * 1024 : 10, sentBytes, socketCount, liveSocketCount: sockets.size, joinedSocketCount: socketClosePromises.length, events, result }
    console.log("webfetch105 actual", JSON.stringify(facts))
    return facts
  } })
}

test("declared webfetch deadline remains active through actual delayed HTTP body", async () => {
  const facts = await measure("deadline")
  expect(facts.events.filter(event => ["tool_started", "headers", "body_chunk"].includes(event.type)).map(event => event.type)).toEqual(["tool_started", "headers", "body_chunk"])
  expect({ live: facts.liveSocketCount, joined: facts.joinedSocketCount }).toEqual({ live: 0, joined: facts.socketCount })
  expect(facts.result).toMatchObject({ kind: "error", name: "AbortError" })
}, 15000)
test("actual parent abort terminates a finite delayed HTTP body", async () => {
  const facts = await measure("parent")
  expect(facts.events.filter(event => ["tool_started", "headers", "body_chunk", "parent_abort"].includes(event.type)).map(event => event.type)).toEqual(["tool_started", "headers", "body_chunk", "parent_abort"])
  expect(facts.events.find(event => event.type === "response_close")?.phase).toBe("tool")
  expect({ live: facts.liveSocketCount, joined: facts.joinedSocketCount }).toEqual({ live: 0, joined: facts.socketCount })
  expect(facts.result).toMatchObject({ kind: "error", name: "AbortError" })
  expect(facts.events.filter(event => event.type === "response_close").length).toBe(1)
}, 15000)
test("unknown-length finite six-MiB response returns current exact oversize error", async () => {
  const facts = await measure("oversize")
  expect(facts.result).toMatchObject({ kind: "error", name: "Error", message: "Response too large (exceeds 5MB limit)" })
  expect(facts.sentBytes).toBe(6 * 1024 * 1024)
  expect(facts.events.filter(event => event.type === "body_eof").map(event => event.bytes)).toEqual([6 * 1024 * 1024])
}, 15000)
