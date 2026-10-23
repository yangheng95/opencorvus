import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { basicAuth } from "hono/basic-auth"
import {
  STREAM_INSTANCE_QUERY_KEY,
  STREAM_LIFECYCLE_EVENT_NAME,
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_TARGET_HEADER,
  STREAM_SOCKET_PROTOCOL,
  STREAM_SOCKET_TICKET_PREFIX,
  STREAM_SOCKET_OPEN_TIMEOUT_MS,
} from "@opencorvus-ai/transport-protocol"
import {
  createStreamSocketTransport,
  streamSocketWebSocketHandler,
  type StreamSocketOwner,
} from "../../src/server/stream-socket"
import { StreamTransportRoutes } from "../../src/server/routes/transport"
import { captureApiAuthority, configure } from "../../../overlay/src/services/api"
import type { StreamCloseInfo, StreamHandle } from "../../../overlay/src/services/host-transport"
import { createTauriTransport } from "../../../overlay/src/services/tauri-transport"

const handles: StreamHandle[] = []
let stop: (() => Promise<void>) | undefined

afterEach(async () => {
  for (const handle of handles.splice(0)) handle.close("superseded")
  await stop?.()
  stop = undefined
  configure({ serverUrl: "http://127.0.0.1:7878", username: "opencorvus", password: "", directory: "" })
})

function listener(dispatch: (request: Request) => Response | Promise<Response>, authenticated = false) {
  let password = "secret"
  const app = new Hono()
    .use((c, next) => {
      if (!authenticated) return next()
      return basicAuth({ username: "opencorvus", password })(c, next)
    })
    .route("/global/transport", StreamTransportRoutes())
    .get("/health", (c) => c.json({ healthy: true }))
  const bridge = createStreamSocketTransport(dispatch)
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    fetch(request, server: Bun.Server<StreamSocketOwner>) {
      if (request.method === "GET" && new URL(request.url).pathname === STREAM_SOCKET_PATH)
        return bridge.upgrade(request, server)
      return app.fetch(request, { streamSockets: bridge })
    },
    websocket: streamSocketWebSocketHandler,
  })
  stop = async () => {
    bridge.dispose()
    await server.stop(true)
  }
  configure({
    serverUrl: server.url.toString(),
    username: "opencorvus",
    password: authenticated ? password : "",
    directory: "",
  })
  return {
    url: server.url,
    rotate() {
      password = "rotated"
      configure({ password })
    },
  }
}

function body(text: string) {
  const bytes = new TextEncoder().encode(text)
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8))
        controller.enqueue(bytes.slice(8))
        controller.close()
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  )
}

test.each([false, true])(
  "GET and POST preserve canonical streaming bytes and original request (authenticated=%s)",
  async (authenticated) => {
    const received: Array<{
      method: string
      path: string
      after: string | null
      body: string
      streamID: string | null
      authorization: string | null
    }> = []
    listener(async (request) => {
      const url = new URL(request.url)
      received.push({
        method: request.method,
        path: url.pathname,
        after: url.searchParams.get("after"),
        body: await request.text(),
        streamID: url.searchParams.get(STREAM_INSTANCE_QUERY_KEY),
        authorization: request.headers.get("authorization"),
      })
      return body("data: 中文🙂  \n\ndata: first\ndata: second\n\n")
    }, authenticated)
    const lifecycle: Array<Record<string, unknown>> = []
    const observe = (event: Event) => lifecycle.push((event as CustomEvent).detail)
    globalThis.addEventListener(STREAM_LIFECYCLE_EVENT_NAME, observe)
    try {
      for (const method of ["GET", "POST"] as const) {
        const events: string[] = []
        const order: string[] = []
        const close = await new Promise<{ reason: string; info: StreamCloseInfo }>((resolve, reject) => {
          handles.push(
            createTauriTransport("browser").openStream(
              {
                path: "canonical/events",
                method,
                query: { after: 7 },
                ...(method === "POST" ? { body: { kind: "json", value: { text: "原文" } } as const } : {}),
              },
              {
                onOpen() {
                  order.push("open")
                },
                onEvent(value) {
                  order.push("event")
                  events.push(value)
                },
                onError: reject,
                onClose(reason, info) {
                  resolve({ reason, info: info! })
                },
              },
            ),
          )
        })
        expect(events).toEqual(["中文🙂  ", "first\nsecond"])
        expect(order).toEqual(["open", "event", "event"])
        expect(close).toEqual({ reason: "stream-done", info: { authority: captureApiAuthority(), current: true } })
      }
      expect(received).toEqual([
        {
          method: "GET",
          path: "/canonical/events",
          after: "7",
          body: "",
          streamID: expect.stringMatching(/^[0-9a-f-]{36}$/),
          authorization: authenticated ? "Basic " + btoa("opencorvus:secret") : null,
        },
        {
          method: "POST",
          path: "/canonical/events",
          after: "7",
          body: JSON.stringify({ text: "原文" }),
          streamID: expect.stringMatching(/^[0-9a-f-]{36}$/),
          authorization: authenticated ? "Basic " + btoa("opencorvus:secret") : null,
        },
      ])
      expect(lifecycle.map((event) => event.phase)).toEqual(["opened", "closing", "opened", "closing"])
    } finally {
      globalThis.removeEventListener(STREAM_LIFECYCLE_EVENT_NAME, observe)
    }
  },
)

test("eight concurrent logical streams retain ordinary HTTP access and release their original requests", async () => {
  const aborted: string[] = []
  let completed!: () => void
  const settled = new Promise<void>((resolve) => {
    completed = resolve
  })
  const server = listener((request) => {
    const path = new URL(request.url).pathname
    request.signal.addEventListener(
      "abort",
      () => {
        aborted.push(path)
        if (aborted.length === 8) completed()
      },
      { once: true },
    )
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: ready\n\n"))
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    )
  })
  await Promise.all(
    Array.from(
      { length: 8 },
      (_, index) =>
        new Promise<void>((resolve, reject) => {
          handles.push(
            createTauriTransport().openStream(
              { path: "stream/" + index },
              {
                onEvent(value) {
                  expect(value).toBe("ready")
                  resolve()
                },
                onError: reject,
              },
            ),
          )
        }),
    ),
  )
  const response = await fetch(new URL("health", server.url))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ healthy: true })
  for (const handle of handles) handle.close("superseded")
  await settled
  expect(aborted.sort()).toEqual(Array.from({ length: 8 }, (_, index) => "/stream/" + index))
})

test("authority rotation settles the original stream and admits the successor with current credentials", async () => {
  const server = listener(
    () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode("data: current\n\n"))
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    true,
  )
  const original = captureApiAuthority()
  const closes: Array<{ reason: string; info: StreamCloseInfo }> = []
  await new Promise<void>((resolve, reject) => {
    handles.push(
      createTauriTransport().openStream(
        { path: "events" },
        {
          onEvent() {
            resolve()
          },
          onError: reject,
          onClose(reason, info) {
            closes.push({ reason, info: info! })
          },
        },
      ),
    )
  })
  server.rotate()
  expect(closes).toEqual([{ reason: "auth-changed", info: { authority: original, current: false } }])
  const value = await new Promise<string>((resolve, reject) => {
    handles.push(createTauriTransport().openStream({ path: "events" }, { onEvent: resolve, onError: reject }))
  })
  expect(value).toBe("current")
})

test("canonical error responses settle as transport failures for the reconnect owner", async () => {
  listener(() => Response.json({ name: "ProjectNotFoundError", data: { message: "project removed" } }, { status: 404 }))
  const errors: string[] = []
  const reason = await new Promise<string>((resolve) => {
    handles.push(
      createTauriTransport().openStream(
        { path: "events" },
        {
          onEvent() {},
          onError(error) {
            errors.push(error.message)
          },
          onClose: resolve,
        },
      ),
    )
  })
  expect(JSON.parse(errors[0]!)).toEqual({ name: "ProjectNotFoundError", data: { message: "project removed" } })
  expect(reason).toBe("stream-socket-error")
})

test("ticket admission reports exact target, origin, consumption and expiry contracts", async () => {
  const bridge = createStreamSocketTransport(() => body("data: original\n\n"))
  const prepare = (target: string, origin = "http://localhost:19167") =>
    bridge.prepare(
      new Request("http://localhost:19167" + STREAM_SOCKET_PATH, {
        method: "POST",
        headers: { [STREAM_SOCKET_METHOD_HEADER]: "GET", [STREAM_SOCKET_TARGET_HEADER]: target, origin },
      }),
    )
  const upgrade = (ticket: string, origin = "http://localhost:19167") =>
    bridge.upgrade(
      new Request("http://localhost:19167" + STREAM_SOCKET_PATH, {
        headers: {
          origin,
          "sec-websocket-protocol": STREAM_SOCKET_PROTOCOL + ", " + STREAM_SOCKET_TICKET_PREFIX + ticket,
        },
      }),
      {
        upgrade() {
          return false
        },
      },
    )!
  try {
    const invalid = await prepare("//remote.example/events")
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).data.code).toBe("invalid-target")
    const { ticket } = await (await prepare("/events")).json()
    const forbidden = upgrade(ticket, "https://remote.example")
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).data.code).toBe("origin-forbidden")
    const mismatched = upgrade(ticket, "http://localhost:19169")
    expect(mismatched.status).toBe(401)
    expect((await mismatched.json()).data.code).toBe("ticket-required")
    const consumed = upgrade(ticket)
    expect(consumed.status).toBe(400)
    expect((await consumed.json()).data.code).toBe("upgrade-required")
    const reused = upgrade(ticket)
    expect(reused.status).toBe(401)
    expect((await reused.json()).data.code).toBe("ticket-required")
    const expiring = await (await prepare("/events")).json()
    await new Promise((resolve) => setTimeout(resolve, STREAM_SOCKET_OPEN_TIMEOUT_MS + 30))
    const expired = upgrade(expiring.ticket)
    expect(expired.status).toBe(401)
    expect((await expired.json()).data.code).toBe("ticket-required")
  } finally {
    bridge.dispose()
  }
})

test("listener disposal settles an admitted reader through the original request abort", async () => {
  let abort!: () => void
  const aborted = new Promise<void>((resolve) => {
    abort = resolve
  })
  listener((request) => {
    request.signal.addEventListener("abort", abort, { once: true })
    return new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode("data: admitted\n\n"))
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    )
  })
  const received = await new Promise<string>((resolve, reject) => {
    handles.push(createTauriTransport().openStream({ path: "events" }, { onEvent: resolve, onError: reject }))
  })
  expect(received).toBe("admitted")
  await stop!()
  stop = undefined
  await aborted
  expect(await aborted.then(() => "settled")).toBe("settled")
})

test("Basic Auth admission errors retain their HTTP status for the stream owner", async () => {
  listener(() => body("data: authorized\n\n"), true)
  configure({ password: "wrong" })
  const errors: string[] = []
  const reason = await new Promise<string>((resolve) => {
    handles.push(
      createTauriTransport().openStream(
        { path: "events" },
        {
          onEvent() {},
          onError(error) {
            errors.push(error.message)
          },
          onClose: resolve,
        },
      ),
    )
  })
  expect(errors).toEqual(["Stream admission 401: Unauthorized"])
  expect(reason).toBe("stream-socket-error")
})

test("response byte forwarding resumes in order through the native drain contract", async () => {
  const chunks = [new TextEncoder().encode("data: first\n\n"), new TextEncoder().encode("data: second\n\n")]
  const bridge = createStreamSocketTransport(
    () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            for (const chunk of chunks) c.enqueue(chunk)
            c.close()
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  )
  const admission = await bridge.prepare(
    new Request("http://localhost:19167" + STREAM_SOCKET_PATH, {
      method: "POST",
      headers: { [STREAM_SOCKET_METHOD_HEADER]: "GET", [STREAM_SOCKET_TARGET_HEADER]: "/events" },
    }),
  )
  const { ticket } = await admission.json()
  let owner!: StreamSocketOwner
  bridge.upgrade(
    new Request("http://localhost:19167" + STREAM_SOCKET_PATH, {
      headers: { "sec-websocket-protocol": STREAM_SOCKET_PROTOCOL + ", " + STREAM_SOCKET_TICKET_PREFIX + ticket },
    }),
    {
      upgrade(_request, options) {
        owner = options.data
        return true
      },
    },
  )
  const controls: string[] = [],
    forwarded: string[] = []
  const terminal = await new Promise<{ code?: number; reason?: string }>((resolve) => {
    owner.open({
      send(data) {
        if (typeof data === "string") {
          controls.push(JSON.parse(data).type)
          return data.length
        }
        forwarded.push(new TextDecoder().decode(data))
        queueMicrotask(() => owner.drain())
        return -1
      },
      close(code, reason) {
        resolve({ code, reason })
      },
    })
  })
  expect(forwarded).toEqual(chunks.map((chunk) => new TextDecoder().decode(chunk)))
  expect(controls).toEqual(["response", "end"])
  expect(terminal).toEqual({ code: 1000, reason: "stream-done" })
  bridge.dispose()
})
