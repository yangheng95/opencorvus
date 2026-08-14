import { afterEach, expect, test } from "bun:test"

import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { HostTransport, StreamHandlers } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  setWorkLedgerChangeHandler,
  startWorkLedgerSSE,
  stopWorkLedgerSSE,
  subscribeMailboxChanges,
} from "../src/services/sse"

afterEach(() => {
  setWorkLedgerChangeHandler(null)
  stopWorkLedgerSSE()
  __setHostTransportForTest(undefined)
})

test("Work Ledger and Mailbox notifications share one app-lifetime physical stream", () => {
  const streamRequests: Array<{ path: string; handlers: StreamHandlers }> = []
  let closes = 0
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request() {
      throw new Error("not used")
    },
    openStream(request, handlers) {
      streamRequests.push({ path: request.path, handlers })
      return {
        close() {
          closes += 1
        },
      }
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)

  const workLedgerEvents: string[] = []
  let mailboxRefreshes = 0
  setWorkLedgerChangeHandler((event) => workLedgerEvents.push(event.type))
  const unsubscribeFailingMailbox = subscribeMailboxChanges(() => {
    throw new Error("one mailbox consumer failed")
  })
  const unsubscribeMailbox = subscribeMailboxChanges(() => {
    mailboxRefreshes += 1
  })
  startWorkLedgerSSE()

  expect(streamRequests.map((request) => request.path)).toEqual(["work-ledger/events"])
  streamRequests[0]!.handlers.onEvent(
    JSON.stringify({
      type: "mailbox.changed",
      sourceType: "task.completed",
      messageID: "message-1",
      taskID: "task-1",
      sequence: 10,
    }),
  )
  streamRequests[0]!.handlers.onEvent(
    JSON.stringify({
      type: "work-ledger.changed",
      sourceType: "task.completed",
      taskID: null,
      sequence: 11,
    }),
  )
  streamRequests[0]!.handlers.onEvent(
    JSON.stringify({
      type: "work-ledger.connected",
      sourceType: "work-ledger.connected",
      sequence: 0,
    }),
  )

  expect(mailboxRefreshes).toBe(2)
  expect(workLedgerEvents).toEqual(["work-ledger.changed"])
  unsubscribeFailingMailbox()
  unsubscribeMailbox()
  expect(closes).toBe(0)
  stopWorkLedgerSSE()
  expect(closes).toBe(1)
})
