import { afterEach, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type StreamHandlers,
  type StreamOpenRequest,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { openPtyOutput, type PtyOutputEvent } from "../src/services/terminal"

function terminalTransport(handlersRef: { current?: StreamHandlers }, closeReasons: string[]): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request() {
      throw new Error("request not used")
    },
    openStream(_input: StreamOpenRequest, handlers: StreamHandlers) {
      handlersRef.current = handlers
      return { close: (reason) => closeReasons.push(reason ?? "") }
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

afterEach(() => __setHostTransportForTest(undefined))

test("Pseudo Terminal output accepts every canonical event branch", () => {
  const handlers: { current?: StreamHandlers } = {}
  const events: PtyOutputEvent[] = []
  __setHostTransportForTest(terminalTransport(handlers, []))

  openPtyOutput({
    id: "pty-valid",
    directory: "D:/terminal",
    cursor: 0,
    onEvent: (event) => events.push(event),
    onError(error) {
      throw error
    },
    onClose() {},
  })

  handlers.current?.onEvent(JSON.stringify({ type: "data", data: "hello" }))
  handlers.current?.onEvent(JSON.stringify({ type: "cursor", cursor: 17 }))
  handlers.current?.onEvent(JSON.stringify({ type: "exit", code: 0, reason: "done" }))

  expect(events).toEqual([
    { type: "data", data: "hello" },
    { type: "cursor", cursor: 17 },
    { type: "exit", code: 0, reason: "done" },
  ])
})

test("Pseudo Terminal output reports and closes on missing fields and unknown event types", () => {
  for (const payload of [{ type: "data" }, { type: "unknown", data: "hello" }]) {
    const handlers: { current?: StreamHandlers } = {}
    const closeReasons: string[] = []
    const errors: Error[] = []
    let events = 0
    __setHostTransportForTest(terminalTransport(handlers, closeReasons))

    openPtyOutput({
      id: "pty-invalid",
      directory: "D:/terminal",
      cursor: 0,
      onEvent: () => {
        events += 1
      },
      onError: (error) => errors.push(error),
      onClose() {},
    })
    handlers.current?.onEvent(JSON.stringify(payload))

    expect(events).toBe(0)
    expect(errors).toHaveLength(1)
    expect(closeReasons).toEqual(["consumer-error"])
  }
})
