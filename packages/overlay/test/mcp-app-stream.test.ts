import { afterEach, expect, test } from "bun:test"
import { openMcpAppHostEventStream, type McpAppHostEvent } from "../src/services/interactive-artifact"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  STREAM_RECONNECT_DELAY_MS,
  type HostTransport,
  type StreamHandle,
  type StreamHandlers,
  type StreamOpenRequest,
} from "../src/services/host-transport"

const handles: StreamHandle[] = []
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.close("consumer-dispose"))
  __setHostTransportForTest(undefined)
})
function setup() {
  const opens: { request: StreamOpenRequest; handlers: StreamHandlers }[] = []
  const closed: string[] = []
  __setHostTransportForTest({
    kind: "browser",
    openStream(request, handlers) {
      opens.push({ request, handlers })
      return {
        close(reason) {
          closed.push(reason)
          handlers.onClose?.(reason)
        },
      }
    },
  } as HostTransport)
  const subscribe = (artifactID: string, events: McpAppHostEvent[], directory = "D:/one") => {
    const handle = openMcpAppHostEventStream({
      artifactID,
      sessionID: "session-one",
      directory,
      onEvent: (event) => events.push(event),
      onError() {},
    })
    handles.push(handle)
    return handle
  }
  return { opens, closed, subscribe }
}

test("late artifact subscribers receive the actual connection boundary and live changes", async () => {
  const { opens, subscribe } = setup()
  const first: McpAppHostEvent[] = []
  const later: McpAppHostEvent[] = []
  subscribe("one", first)
  opens[0].handlers.onEvent(JSON.stringify({ type: "mcp-app.connected" }))
  subscribe("two", later)
  await Promise.resolve()
  opens[0].handlers.onEvent(JSON.stringify({ type: "mcp-app.lifecycle_changed", artifactID: "two" }))
  expect(later).toEqual([{ type: "mcp-app.connected" }, { type: "mcp-app.lifecycle_changed", artifactID: "two" }])
  expect(first).toEqual(later)
  expect(opens.length).toBe(1)
})

test("separate project streams retain scope and last-consumer closure releases the owner", () => {
  const { opens, closed, subscribe } = setup()
  const one: McpAppHostEvent[] = []
  const two: McpAppHostEvent[] = []
  const a = subscribe("one", one)
  const b = subscribe("two", [], "D:/one")
  subscribe("other-project", two, "D:/two")
  opens[0].handlers.onEvent(JSON.stringify({ type: "mcp-app.connected" }))
  opens[1].handlers.onEvent(JSON.stringify({ type: "mcp-app.lifecycle_changed", artifactID: "other-project" }))
  expect(one).toEqual([{ type: "mcp-app.connected" }])
  expect(two).toEqual([{ type: "mcp-app.lifecycle_changed", artifactID: "other-project" }])
  expect(opens.map((open) => open.request.query?.directory)).toEqual(["D:/one", "D:/two"])
  a.close("consumer-dispose")
  b.close("consumer-dispose")
  expect(closed).toEqual(["consumer-dispose"])
  subscribe("fresh", [])
  expect(opens.length).toBe(3)
})

test("a dropped shared stream reconnects and delivers a new recovery boundary", async () => {
  const { opens, subscribe } = setup()
  const events: McpAppHostEvent[] = []
  subscribe("one", events)
  opens[0].handlers.onEvent(JSON.stringify({ type: "mcp-app.connected" }))
  opens[0].handlers.onClose?.("server-close")
  await new Promise((resolve) => setTimeout(resolve, STREAM_RECONNECT_DELAY_MS + 100))
  opens[1].handlers.onEvent(JSON.stringify({ type: "mcp-app.connected" }))
  expect(events).toEqual([{ type: "mcp-app.connected" }, { type: "mcp-app.connected" }])
  expect(opens[1].request).toEqual(opens[0].request)
}, 5000)
