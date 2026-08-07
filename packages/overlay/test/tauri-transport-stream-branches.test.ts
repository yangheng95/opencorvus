import { afterEach, describe, expect, test } from "bun:test"
import { STREAM_INSTANCE_QUERY_KEY, STREAM_LIFECYCLE_EVENT_NAME } from "@opencorvus-ai/transport-protocol"
import { configure } from "../src/services/api"
import { createTauriTransport } from "../src/services/tauri-transport"

const originalFetch = globalThis.fetch
const originalEventSource = globalThis.EventSource

type Listener = (event?: MessageEvent) => void

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  readonly url: string
  readyState = FakeEventSource.CONNECTING
  closed = false
  listeners = new Map<string, Listener[]>()

  constructor(url: string) {
    this.url = url
    createdSources.push(this)
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }

  emit(type: string, data = ""): void {
    if (type === "open") this.readyState = FakeEventSource.OPEN
    const event = { data } as MessageEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

const createdSources: FakeEventSource[] = []

afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.EventSource = originalEventSource
  createdSources.length = 0
  configure({
    serverUrl: "http://127.0.0.1:7878",
    username: "opencorvus",
    password: "",
    directory: "",
  })
})

describe("tauri HostTransport stream branch coverage", () => {
  test("unauthenticated GET streams deliver the native EventSource lifecycle", () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    configure({ serverUrl: "http://overlay.test", password: "", directory: "" })

    const events: string[] = []
    const opens: string[] = []
    const closes: string[] = []
    const lifecycle: Array<Record<string, unknown>> = []
    const lifecycleListener = (event: Event) => lifecycle.push((event as CustomEvent).detail)
    globalThis.addEventListener(STREAM_LIFECYCLE_EVENT_NAME, lifecycleListener)
    const handle = createTauriTransport().openStream(
      { path: "task/tsk_stream/events", query: { after: "5" } },
      {
        onOpen: () => opens.push("open"),
        onEvent: (event) => events.push(event),
        onClose: (reason) => closes.push(reason ?? ""),
      },
    )

    expect(createdSources).toHaveLength(1)
    const streamURL = new URL(createdSources[0]!.url)
    expect(`${streamURL.origin}${streamURL.pathname}`).toBe("http://overlay.test/task/tsk_stream/events")
    expect(streamURL.searchParams.get("after")).toBe("5")
    expect(streamURL.searchParams.get(STREAM_INSTANCE_QUERY_KEY)).toMatch(/^[0-9a-f-]{36}$/)
    createdSources[0]!.emit("open")
    createdSources[0]!.emit("message", '{"type":"task.updated"}')
    expect(opens).toEqual(["open"])
    expect(events).toEqual(['{"type":"task.updated"}'])

    handle.close("superseded")
    expect(createdSources[0]!.closed).toBe(true)
    expect(closes).toEqual(["superseded"])
    expect(lifecycle).toEqual([
      expect.objectContaining({
        protocol: "opencorvus.stream-lifecycle.v1",
        streamID: streamURL.searchParams.get(STREAM_INSTANCE_QUERY_KEY),
        phase: "opened",
        requestURL: streamURL.toString(),
      }),
      expect.objectContaining({
        protocol: "opencorvus.stream-lifecycle.v1",
        streamID: streamURL.searchParams.get(STREAM_INSTANCE_QUERY_KEY),
        phase: "closing",
        requestURL: streamURL.toString(),
        initiator: "superseded",
        reason: "superseded",
      }),
    ])
    expect(Number(lifecycle[0]?.sequence)).toBeLessThan(Number(lifecycle[1]?.sequence))
    globalThis.removeEventListener(STREAM_LIFECYCLE_EVENT_NAME, lifecycleListener)
  })

  test("auth changes close native EventSource streams so business reconnect can reopen them", () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    configure({ serverUrl: "http://overlay.test", username: "opencorvus", password: "", directory: "" })

    const errors: string[] = []
    const closes: string[] = []
    createTauriTransport().openStream(
      { path: "task/tsk_stream/events", query: { after: "9" } },
      {
        onError: (error) => errors.push(error.message),
        onClose: (reason) => closes.push(reason ?? ""),
        onEvent: () => undefined,
      },
    )

    expect(createdSources).toHaveLength(1)
    createdSources[0]!.emit("open")
    configure({ password: "rotated" })

    expect(errors).toEqual(["event-source auth-changed"])
    expect(closes).toEqual(["auth-changed"])
    expect(createdSources[0]!.closed).toBe(true)

  })

  test("native EventSource publishes one terminal transport failure to the business reconnect owner", () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    configure({ serverUrl: "http://overlay.test", password: "", directory: "" })

    const lifecycle: Array<Record<string, unknown>> = []
    const businessOrder: string[] = []
    const lifecycleListener = (event: Event) => lifecycle.push((event as CustomEvent).detail)
    globalThis.addEventListener(STREAM_LIFECYCLE_EVENT_NAME, lifecycleListener)
    try {
      const closes: string[] = []
      createTauriTransport().openStream(
        { path: "task/tsk_failed/events" },
        {
          onEvent: () => undefined,
          onError: () => businessOrder.push(String(lifecycle.at(-1)?.phase)),
          onClose: (reason) => closes.push(reason ?? ""),
        },
      )
      createdSources[0]!.emit("open")
      createdSources[0]!.readyState = FakeEventSource.CONNECTING
      createdSources[0]!.emit("error")

      expect(lifecycle.map((event) => event.phase)).toEqual(["opened", "failed", "closing"])
      expect(lifecycle[1]).toEqual(
        expect.objectContaining({
          failureProvenance: "transport",
          reason: "event-source-error",
        }),
      )
      expect(businessOrder).toEqual(["failed"])
      expect(closes).toEqual(["event-source-error"])
      expect(createdSources[0]!.closed).toBe(true)
    } finally {
      globalThis.removeEventListener(STREAM_LIFECYCLE_EVENT_NAME, lifecycleListener)
    }
  })

  test("authenticated GET streams use fetch SSE so Authorization headers are sent", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init })
      return sseResponse("data: first\n\ndata: second\n\n")
    }) as typeof fetch
    configure({ serverUrl: "http://overlay.test", username: "opencorvus", password: "secret", directory: "" })

    const events: string[] = []
    const opens: string[] = []
    const closed = new Promise<string>((resolve) => {
      createTauriTransport().openStream(
        { path: "task/tsk_stream/events", query: { after: "7" } },
        {
          onOpen: () => opens.push("open"),
          onEvent: (event) => events.push(event),
          onClose: (reason) => resolve(reason ?? ""),
        },
      )
    })

    await expect(closed).resolves.toBe("post-stream-done")
    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe("http://overlay.test/task/tsk_stream/events?after=7")
    expect(requests[0]!.init?.method).toBe("GET")
    expect((requests[0]!.init?.headers as Record<string, string>).Authorization).toBe("Basic b3BlbmNvcnZ1czpzZWNyZXQ=")
    expect(opens).toEqual(["open"])
    expect(events).toEqual(["first", "second"])
  })

  test("auth changes abort authenticated fetch SSE streams and report auth-changed once", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    let aborted = false
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    globalThis.fetch = ((input, init) => {
      requests.push({ url: String(input), init })
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            aborted = true
            reject(new DOMException("Aborted", "AbortError"))
          },
          { once: true },
        )
      })
    }) as typeof fetch
    configure({ serverUrl: "http://overlay.test", username: "opencorvus", password: "secret", directory: "" })

    const errors: string[] = []
    const closes: string[] = []
    createTauriTransport().openStream(
      { path: "task/tsk_stream/events", query: { after: "11" } },
      {
        onError: (error) => errors.push(error.message),
        onClose: (reason) => closes.push(reason ?? ""),
        onEvent: () => undefined,
      },
    )
    await Promise.resolve()

    configure({ password: "rotated" })
    await Promise.resolve()

    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe("http://overlay.test/task/tsk_stream/events?after=11")
    expect((requests[0]!.init?.headers as Record<string, string>).Authorization).toBe("Basic b3BlbmNvcnZ1czpzZWNyZXQ=")
    expect(aborted).toBe(true)
    expect(closes).toEqual(["auth-changed"])
  })

  test("POST streams use fetch SSE with the JSON request body", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init })
      return sseResponse('data: {"kind":"accepted"}\n\n')
    }) as typeof fetch
    configure({ serverUrl: "http://overlay.test", password: "", directory: "" })

    const events: string[] = []
    const closed = new Promise<string>((resolve) => {
      createTauriTransport().openStream(
        {
          path: "panel/message/stream",
          method: "POST",
          body: { kind: "json", value: { taskID: "tsk_stream", text: "hello" } },
        },
        {
          onEvent: (event) => events.push(event),
          onClose: (reason) => resolve(reason ?? ""),
        },
      )
    })

    await expect(closed).resolves.toBe("post-stream-done")
    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe("http://overlay.test/panel/message/stream")
    expect(requests[0]!.init?.method).toBe("POST")
    expect((requests[0]!.init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
    expect(requests[0]!.init?.body).toBe(JSON.stringify({ taskID: "tsk_stream", text: "hello" }))
    expect(events).toEqual(['{"kind":"accepted"}'])
  })
})

function sseResponse(body: string): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body))
        controller.close()
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  )
}
