import { afterEach, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type StreamHandlers,
  type StreamOpenRequest,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { openMailboxChangeStream, type MailboxChangeEvent } from "../src/services/mailbox"

function mailboxTransport(
  handlersRef: { current?: StreamHandlers },
  closeReasons: string[] = [],
  requests: StreamOpenRequest[] = [],
): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request() {
      throw new Error("request not used")
    },
    openStream(input: StreamOpenRequest, handlers: StreamHandlers) {
      requests.push(input)
      handlersRef.current = handlers
      return { close: (reason) => closeReasons.push(reason ?? "") }
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

afterEach(() => __setHostTransportForTest(undefined))

test("mailbox stream refetches on every connection and every durable change", () => {
  const handlers: { current?: StreamHandlers } = {}
  const refreshes: MailboxChangeEvent[] = []
  const requests: StreamOpenRequest[] = []
  __setHostTransportForTest(mailboxTransport(handlers, [], requests))

  openMailboxChangeStream({
    onRefresh: (event) => refreshes.push(event),
    onClose() {},
    onError(error) {
      throw error
    },
  })

  handlers.current?.onEvent(
    JSON.stringify({
      type: "mailbox.connected",
      sourceType: "mailbox.connected",
      messageID: null,
      taskID: null,
      sequence: 0,
    }),
  )
  handlers.current?.onEvent(
    JSON.stringify({
      type: "mailbox.heartbeat",
      sourceType: "mailbox.heartbeat",
      messageID: null,
      taskID: null,
      sequence: 0,
    }),
  )
  handlers.current?.onEvent(
    JSON.stringify({
      type: "mailbox.changed",
      sourceType: "task.infrastructure.failed",
      messageID: "pev_failure",
      taskID: "tsk_failure",
      sequence: 17,
    }),
  )

  expect(refreshes.map((event) => event.type)).toEqual(["mailbox.connected", "mailbox.changed"])
  expect(requests).toEqual([{ path: "mailbox/events" }])
  expect(refreshes[1]).toMatchObject({
    sourceType: "task.infrastructure.failed",
    messageID: "pev_failure",
    taskID: "tsk_failure",
  })
})

test("mailbox stream reports and closes on missing fields and unknown event types", () => {
  const invalidPayloads = [
    { type: "mailbox.changed" },
    {
      type: "mailbox.unknown",
      sourceType: "mailbox.unknown",
      messageID: null,
      taskID: null,
      sequence: 0,
    },
  ]
  for (const payload of invalidPayloads) {
    const handlers: { current?: StreamHandlers } = {}
    const closeReasons: string[] = []
    const errors: unknown[] = []
    let refreshes = 0
    __setHostTransportForTest(mailboxTransport(handlers, closeReasons))

    openMailboxChangeStream({
      onRefresh: () => {
        refreshes += 1
      },
      onClose() {},
      onError: (error) => errors.push(error),
    })
    handlers.current?.onEvent(JSON.stringify(payload))

    expect(refreshes).toBe(0)
    expect(errors).toHaveLength(1)
    expect(closeReasons).toEqual(["consumer-error"])
  }
})
