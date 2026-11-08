import { afterEach, expect, test } from "bun:test"

import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { HostTransport, StreamHandlers } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { captureApiAuthority, configure, DEFAULT_SERVER, type ApiAuthority } from "../src/services/api"
import {
  subscribeWorkLedgerChanges,
  startWorkLedgerSSE,
  stopWorkLedgerSSE,
  subscribeMailboxChanges,
} from "../src/services/sse"

const subscriptions: Array<() => void> = []

afterEach(() => {
  for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
  stopWorkLedgerSSE()
  __setHostTransportForTest(undefined)
  configure({ serverUrl: DEFAULT_SERVER, username: "opencorvus", password: "", directory: "" })
})

function transportFixture() {
  const streamRequests: Array<{ path: string; authority?: ApiAuthority; handlers: StreamHandlers }> = []
  const closeReasons: string[] = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request() {
      throw new Error("not used")
    },
    openStream(request, handlers) {
      streamRequests.push({ path: request.path, authority: request.authority, handlers })
      return {
        close(reason?: unknown) {
          closeReasons.push(String(reason))
        },
      }
    },
    async native() {
      throw new Error("not used")
    },
  }
  return { transport, streamRequests, closeReasons }
}

test("Work Ledger consumers and Mailbox share one app-lifetime physical stream", () => {
  const { transport, streamRequests, closeReasons } = transportFixture()
  __setHostTransportForTest(transport)
  configure({ serverUrl: "http://ledger-first.test", password: "", directory: "" })

  const workLedgerEvents: string[] = []
  const projectUpdates: unknown[] = []
  let mailboxRefreshes = 0
  subscriptions.push(subscribeWorkLedgerChanges((event) => {
    if (event.type === "work-ledger.changed" && event.sourceType === "project.updated") {
      throw new Error("one project consumer failed")
    }
  }))
  subscriptions.push(subscribeWorkLedgerChanges((event) => {
    workLedgerEvents.push(event.type)
  }))
  subscriptions.push(subscribeWorkLedgerChanges((event) => {
    if (event.type === "work-ledger.changed" && event.projectID) projectUpdates.push(event)
  }))
  const unsubscribeFailingMailbox = subscribeMailboxChanges(() => {
    throw new Error("one mailbox consumer failed")
  })
  const unsubscribeMailbox = subscribeMailboxChanges(() => {
    mailboxRefreshes += 1
  })
  subscriptions.push(unsubscribeFailingMailbox, unsubscribeMailbox)
  startWorkLedgerSSE()
  startWorkLedgerSSE()
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

  const renamedProject = {
    type: "work-ledger.changed", sourceType: "project.updated",
    projectID: "original-project", directory: "D:/original-project", sequence: 13,
  }
  streamRequests[0]!.handlers.onEvent(JSON.stringify(renamedProject))
  expect(projectUpdates).toEqual([renamedProject])
  expect(mailboxRefreshes).toBe(3)
  expect(workLedgerEvents).toEqual(["work-ledger.changed", "work-ledger.connected", "work-ledger.changed"])
  unsubscribeFailingMailbox()
  unsubscribeMailbox()
  streamRequests[0]!.handlers.onEvent(
    JSON.stringify({ type: "work-ledger.changed", sourceType: "task.completed", taskID: null, sequence: 12 }),
  )
  expect(workLedgerEvents).toEqual(["work-ledger.changed", "work-ledger.connected", "work-ledger.changed", "work-ledger.changed"])
  stopWorkLedgerSSE()
  expect(closeReasons).toEqual(["consumer-dispose"])
  startWorkLedgerSSE()
  expect(streamRequests[1]!.authority).toEqual(captureApiAuthority())
  configure({ serverUrl: "http://ledger-second.test" })
  startWorkLedgerSSE()
  expect(streamRequests.map((request) => request.path)).toEqual([
    "work-ledger/events",
    "work-ledger/events",
    "work-ledger/events",
  ])
  expect(streamRequests[2]!.authority).toEqual(captureApiAuthority())
  stopWorkLedgerSSE()
  expect(closeReasons).toEqual(["consumer-dispose", "consumer-dispose", "consumer-dispose"])
})

test("a remaining subscriber receives current events and the last owner closes its stream", () => {
  const { transport, streamRequests, closeReasons } = transportFixture()
  __setHostTransportForTest(transport)
  configure({ serverUrl: "http://ledger-owners.test", password: "", directory: "" })
  const firstEvents: unknown[] = []
  const secondEvents: unknown[] = []
  const first = subscribeWorkLedgerChanges((event) => firstEvents.push(event))
  const second = subscribeWorkLedgerChanges((event) => secondEvents.push(event))
  subscriptions.push(first, second)
  startWorkLedgerSSE()
  const connected = { type: "work-ledger.connected", sourceType: "work-ledger.connected", sequence: 0 }
  streamRequests[0]!.handlers.onEvent(JSON.stringify(connected))
  expect(firstEvents).toEqual([connected])
  expect(secondEvents).toEqual([connected])
  first()
  const renamedProject = {
    type: "work-ledger.changed", sourceType: "project.updated", projectID: "owned-project",
    directory: "D:/owned-project", sequence: 42,
  }
  streamRequests[0]!.handlers.onEvent(JSON.stringify(renamedProject))
  expect(secondEvents).toEqual([connected, renamedProject])
  expect(streamRequests.map((request) => request.path)).toEqual(["work-ledger/events"])
  second()
  expect(closeReasons).toEqual(["consumer-dispose"])
})
