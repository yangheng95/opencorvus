import { afterEach, expect, test } from "bun:test"
import http from "node:http"
import { once } from "node:events"
import { Instance } from "../../src/project/instance"

import { Session } from "../../src/session"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { Tool } from "../../src/tool/tool"
import { executeWebFetch } from "../../src/tool/webfetch"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})
type Mode = "deadline" | "parent" | "oversize" | "status" | "header" | "retry"
async function measure(mode: Mode) {
  await using project = await memoryProject(`webfetch105-${mode}`)
  return await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Owned local HTTP body measurement" })
      const executionAuthority = await resolveSessionExecutionAuthority({
        sessionID: session.id,
        projectID: Instance.project.id,
        expected: { kind: "conversation" },
      })
      const controller = new AbortController()
      const parentReason = new DOMException("Owned finite parent safety abort", "AbortError")
      const context: Tool.Context = {
        sessionID: session.id,
        messageID: "message_webfetch105",
        callID: `call_webfetch105_${mode}`,
        agent: "coding",
        abort: controller.signal,
        messages: [],
        executionAuthority,
        executionSurface: Tool.executionSurface(["webfetch"], []),
        metadata() {},
      }
      const events: Array<{ type: string; at: number; bytes?: number; phase?: string }> = []
      const timers = new Set<ReturnType<typeof setTimeout>>()
      let phase = "setup"
      const socketClosePromises: Promise<void>[] = []
      let socketCount = 0
      const sockets = new Set<import("node:net").Socket>()
      const schedule = (ms: number, action: () => void) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          action()
        }, ms)
        timers.add(timer)
      }
      const requests: Array<{ method: string | undefined; userAgent: string | undefined }> = []
      let sentBytes = 0
      let resolveClosed!: () => void
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve
      })
      const server = http.createServer((request, response) => {
        events.push({ type: "request", at: Date.now() })
        requests.push({ method: request.method, userAgent: request.headers["user-agent"] })
        response.on("close", () => {
          events.push({ type: "response_close", at: Date.now(), bytes: sentBytes, phase })
        })
        response.on("finish", () => events.push({ type: "response_finish", at: Date.now(), bytes: sentBytes }))
        request.on("aborted", () => events.push({ type: "request_aborted", at: Date.now() }))
        if (mode === "retry" && requests.length === 1) {
          response.writeHead(403, {
            "content-type": "text/plain",
            "transfer-encoding": "chunked",
            "cf-mitigated": "challenge",
          })
          response.flushHeaders()
          response.write("challenge")
          sentBytes += 9
          events.push({ type: "challenge_headers_body", at: Date.now(), bytes: sentBytes })
          schedule(250, () => {
            if (!response.destroyed) response.end("finite")
          })
          return
        }
        response.writeHead(
          mode === "status" ? 418 : 200,
          mode === "header"
            ? { "content-type": "text/plain", "content-length": String(6 * 1024 * 1024) }
            : { "content-type": "text/plain", "transfer-encoding": "chunked" },
        )
        response.flushHeaders()
        events.push({ type: "headers", at: Date.now() })
        if (mode === "oversize") {
          const chunk = Buffer.alloc(256 * 1024, 97)
          let index = 0
          const send = () => {
            if (response.destroyed) return
            response.write(chunk)
            sentBytes += chunk.byteLength
            index++
            events.push({ type: "body_chunk", at: Date.now(), bytes: sentBytes })
            if (index === 24) {
              events.push({ type: "body_eof", at: Date.now(), bytes: sentBytes })
              response.end()
            } else schedule(5, send)
          }
          send()
        } else {
          response.write("first")
          sentBytes += 5
          events.push({ type: "body_chunk", at: Date.now(), bytes: sentBytes })
          schedule(250, () => {
            if (!response.destroyed) {
              sentBytes += 5
              events.push({ type: "body_eof", at: Date.now(), bytes: sentBytes })
              response.end("final")
            }
          })
          if (mode === "parent")
            schedule(70, () => {
              events.push({ type: "parent_abort", at: Date.now() })
              controller.abort(parentReason)
            })
        }
      })
      server.on("connection", (socket) => {
        sockets.add(socket)
        socketCount++
        socketClosePromises.push(
          new Promise<void>((resolve) =>
            socket.once("close", () => {
              sockets.delete(socket)
              events.push({ type: "socket_close", at: Date.now(), phase })
              resolve()
            }),
          ),
        )
      })
      server.listen(0, "127.0.0.1")
      await once(server, "listening")
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Owned HTTP server did not bind exact TCP address")
      const url = `http://127.0.0.1:${address.port}/${mode}`
      schedule(2500, () => {
        events.push({ type: "safety_close_connections", at: Date.now() })
        server.closeAllConnections()
        for (const socket of sockets) socket.destroy()
      })
      schedule(1500, () => {
        events.push({ type: "safety_abort", at: Date.now() })
        controller.abort(parentReason)
      })
      let result:
        | { kind: "value"; outputBytes: number; output?: string }
        | { kind: "error"; name: string; message: string; sameParentReason: boolean }
      try {
        try {
          phase = "tool"
          events.push({ type: "tool_started", at: Date.now(), phase })
          const fetched = await executeWebFetch(
            { url, format: "text", timeout: mode === "deadline" ? 0.05 : 1 },
            context,
          )
          result = {
            kind: "value",
            outputBytes: Buffer.byteLength(fetched.output),
            ...(mode === "deadline" ? { output: fetched.output } : {}),
          }
        } catch (error) {
          result = {
            kind: "error",
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
            sameParentReason: error === parentReason,
          }
        }
        events.push({ type: "tool_settled", at: Date.now(), phase })
        if (
          ["deadline", "parent"].includes(mode) &&
          result.kind === "error" &&
          events.some((event) => event.type === "request")
        )
          await Promise.all(socketClosePromises)
      } finally {
        phase = "cleanup"
        events.push({ type: "cleanup_started", at: Date.now(), phase })
        for (const timer of timers) clearTimeout(timer)
        timers.clear()
        controller.abort(parentReason)
        const settlement = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
        server.closeAllConnections()
        for (const socket of sockets) socket.destroy()
        await Promise.all([settlement, ...socketClosePromises])
        events.push({ type: "cleanup_completed", at: Date.now(), phase })
      }
      const facts = {
        mode,
        projectID: Instance.project.id,
        directory: project.path,
        sessionID: session.id,
        executionAuthority,
        url,
        requestedTimeoutMs: mode === "deadline" ? 50 : 1000,
        finiteServerEOFMs: mode === "oversize" ? 120 : 250,
        parentSafetyMs: 1500,
        responseLimit: 5 * 1024 * 1024,
        authoredMaximum: mode === "oversize" ? 6 * 1024 * 1024 : 10,
        sentBytes,
        requests,
        socketCount,
        liveSocketCount: sockets.size,
        joinedSocketCount: socketClosePromises.length,
        events,
        result,
      }
      console.log("webfetch105 actual", JSON.stringify(facts))
      return facts
    },
  })
}

test("declared webfetch deadline remains active through actual delayed HTTP body", async () => {
  const facts = await measure("deadline")
  expect(
    facts.events
      .filter((event) => ["tool_started", "headers", "body_chunk"].includes(event.type))
      .map((event) => event.type),
  ).toEqual(["tool_started", "headers", "body_chunk"])
  expect({ live: facts.liveSocketCount, joined: facts.joinedSocketCount }).toEqual({
    live: 0,
    joined: facts.socketCount,
  })
  expect(facts.result).toMatchObject({ kind: "error", name: "AbortError" })
}, 15000)
test("actual parent abort terminates a finite delayed HTTP body", async () => {
  const facts = await measure("parent")
  expect(
    facts.events
      .filter((event) => ["tool_started", "headers", "body_chunk", "parent_abort"].includes(event.type))
      .map((event) => event.type),
  ).toEqual(["tool_started", "headers", "body_chunk", "parent_abort"])
  expect(facts.events.find((event) => event.type === "socket_close")?.phase).toBe("tool")
  expect({ live: facts.liveSocketCount, joined: facts.joinedSocketCount }).toEqual({
    live: 0,
    joined: facts.socketCount,
  })
  expect(facts.result).toMatchObject({ kind: "error", name: "AbortError" })
  expect(facts.events.filter((event) => event.type === "socket_close").length).toBe(1)
}, 15000)
test("unknown-length finite six-MiB response returns current exact oversize error", async () => {
  const facts = await measure("oversize")
  expect(facts.result).toMatchObject({
    kind: "error",
    name: "Error",
    message: "Response too large (exceeds 5MB limit)",
  })
  expect(facts.sentBytes).toBeGreaterThan(5 * 1024 * 1024)
  expect(facts.sentBytes).toBeLessThan(6 * 1024 * 1024)
  expect({ live: facts.liveSocketCount, joined: facts.joinedSocketCount }).toEqual({
    live: 0,
    joined: facts.socketCount,
  })
}, 15000)

test("HTTP status rejection preserves its exact error and joins owned server sockets", async () => {
  const facts = await measure("status")
  expect(facts.result).toMatchObject({ kind: "error", name: "Error", message: "Request failed with status code: 418" })
  expect(facts.requests.map((request) => request.method)).toEqual(["GET"])
  expect(facts.events.filter((event) => event.type === "cleanup_completed").map((event) => event.phase)).toEqual([
    "cleanup",
  ])
  expect({ joined: facts.joinedSocketCount, live: facts.liveSocketCount }).toEqual({
    joined: facts.socketCount,
    live: 0,
  })
}, 15000)
test("oversized declared Content-Length disposes the actual body with existing error", async () => {
  const facts = await measure("header")
  expect(facts.result).toMatchObject({
    kind: "error",
    name: "Error",
    message: "Response too large (exceeds 5MB limit)",
  })
  expect(facts.sentBytes).toBe(5)
  expect({ joined: facts.joinedSocketCount, live: facts.liveSocketCount }).toEqual({
    joined: facts.socketCount,
    live: 0,
  })
}, 15000)
test("actual challenge response is disposed before the current honest-UA retry returns", async () => {
  const facts = await measure("retry")
  expect(facts.requests.map((request) => request.method)).toEqual(["GET", "GET"])
  expect(facts.requests.map((request) => request.userAgent)).toEqual([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    "opencorvus",
  ])
  expect(facts.result).toMatchObject({ kind: "value", outputBytes: 10 })
  expect({ joined: facts.joinedSocketCount, live: facts.liveSocketCount }).toEqual({
    joined: facts.socketCount,
    live: 0,
  })
}, 15000)
