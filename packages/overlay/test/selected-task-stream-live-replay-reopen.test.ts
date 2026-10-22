import { afterEach, expect, spyOn, test } from "bun:test"

import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { HostTransport, StreamHandlers, StreamOpenRequest, TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { startSSE, stopSSE } from "../src/services/sse"
import { STREAM_RECONNECT_DELAY_MS } from "../src/services/host-transport"
import { setBoardStore } from "../src/store/board"
import { messageStore } from "../src/store/messages"
import * as messages from "../src/store/messages"
import type { BoardSource } from "../src/store/board"

const TASK_ID = "tsk_live_replay_reopen"
const CONVERSATION_TAIL_PATH = `task/${TASK_ID}/conversation`

afterEach(() => {
  stopSSE()
  setBoardStore("selectedSource", null)
  __setHostTransportForTest(undefined)
})

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for the selected task stream to reopen")
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test("a live-replay-expired close reopens immediately instead of paying the failure backoff", async () => {
  const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers }> = []
  const requestedPaths: string[] = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request(input: TransportRequest) {
      requestedPaths.push(input.path)
      // Reopening after an expired live replay re-reads the conversation tail
      // first. This test observes only *when* that work starts, so the reply
      // itself is irrelevant.
      throw new Error("transport request is not served by this test")
    },
    openStream(request, handlers) {
      opens.push({ request, handlers })
      return { close() {} }
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)
  setBoardStore("selectedSource", { kind: "task", id: TASK_ID })

  startSSE({ kind: "task", id: TASK_ID }, 12, { directory: "/tmp/live-replay-project" })
  expect(messageStore.sseStatus).toBe("connecting")
  expect(opens).toHaveLength(1)
  // A freshly selected task presents no live cursor. The server contract is
  // that this means "consumed nothing yet", not "resuming from a stale point".
  expect(opens[0]!.request.query?.after_live).toBe("0")

  const closedAt = Date.now()
  opens[0]!.handlers.onEvent(
    JSON.stringify({
      type: "task.live_replay_expired",
      task_id: TASK_ID,
      sequence: 0,
      properties: { taskID: TASK_ID, reason: "selected task live replay retention expired" },
    }),
  )
  opens[0]!.handlers.onClose?.("server-close")

  await waitFor(() => requestedPaths.includes(CONVERSATION_TAIL_PATH))
  // The server directed this reopen and answered us while doing it, so the
  // failure backoff must not apply — waiting it out is what left the live
  // stream dark long enough to paint the disconnected banner.
  expect(Date.now() - closedAt).toBeLessThan(STREAM_RECONNECT_DELAY_MS)
})

test("selected stream lifecycle distinguishes initial connection from failure reconnect", () => {
  const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers }> = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request() {
      throw new Error("not used")
    },
    openStream(request, handlers) {
      opens.push({ request, handlers })
      return { close() {} }
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)
  setBoardStore("selectedSource", { kind: "task", id: TASK_ID })

  startSSE({ kind: "task", id: TASK_ID }, 0, { directory: "/tmp/stream-status-project" })
  expect(messageStore.sseStatus).toBe("connecting")

  opens[0]!.handlers.onOpen?.()
  expect(messageStore.sseStatus).toBe("connected")

  opens[0]!.handlers.onError(new Error("transport dropped"))
  expect(messageStore.sseStatus).toBe("reconnecting")
})

test("an initial stream error remains initial connection work until a stream has opened", () => {
  const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers }> = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request() {
      throw new Error("not used")
    },
    openStream(request, handlers) {
      opens.push({ request, handlers })
      return { close() {} }
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)
  setBoardStore("selectedSource", { kind: "task", id: TASK_ID })

  startSSE({ kind: "task", id: TASK_ID }, 0, { directory: "/tmp/initial-stream-status-project" })
  opens[0]!.handlers.onError(new Error("initial open timed out"))

  expect(messageStore.sseStatus).toBe("connecting")
})

test("an initial stream close retries as initial connection work", async () => {
  const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers }> = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request() {
      throw new Error("not used")
    },
    openStream(request, handlers) {
      opens.push({ request, handlers })
      return { close() {} }
    },
    async native() {
      throw new Error("not used")
    },
  }
  __setHostTransportForTest(transport)
  setBoardStore("selectedSource", { kind: "task", id: TASK_ID })

  startSSE({ kind: "task", id: TASK_ID }, 0, { directory: "/tmp/initial-stream-retry-project" })
  opens[0]!.handlers.onClose?.("initial-open-failed")
  await waitFor(() => opens.length === 2, STREAM_RECONNECT_DELAY_MS + 1000)

  expect(messageStore.sseStatus).toBe("connecting")
})

const retrySources: BoardSource[] = [
  { kind: "task", id: TASK_ID },
  { kind: "session", id: "ses_retry_chat", sessionKind: "conversation" },
  { kind: "session", id: "ses_retry_mission", sessionKind: "mission" },
]

for (const source of retrySources) {
  test(`${source.kind === "task" ? "task" : source.sessionKind} retries publish a continuous recovery lifecycle`, async () => {
    const opens: Array<{ request: StreamOpenRequest; handlers: StreamHandlers }> = []
    const closed: string[] = []
    const transport: HostTransport = {
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request() {
        throw new Error("Unexpected request in stream lifecycle contract")
      },
      openStream(request, handlers) {
        opens.push({ request, handlers })
        return {
          close(reason) {
            closed.push(reason ?? "")
            handlers.onClose?.(reason)
          },
        }
      },
      async native() {
        throw new Error("Unexpected native call in stream lifecycle contract")
      },
    }
    __setHostTransportForTest(transport)
    setBoardStore("selectedSource", source)
    setBoardStore("taskSequence", 12)
    const statuses = spyOn(messages, "setSseStatus")
    try {
      startSSE(source, 12, { directory: "/tmp/stream-lifecycle-project" })
      opens[0]!.handlers.onOpen?.()
      opens[0]!.handlers.onError(new Error("Established stream interrupted"))
      await waitFor(() => opens.length === 2, STREAM_RECONNECT_DELAY_MS + 1000)
      opens[1]!.handlers.onClose?.("retry-interrupted")
      await waitFor(() => opens.length === 3, STREAM_RECONNECT_DELAY_MS + 1000)
      opens[2]!.handlers.onOpen?.()
      stopSSE()

      expect(statuses.mock.calls.map(([status]) => status)).toEqual([
        "connecting",
        "connected",
        "reconnecting",
        "reconnecting",
        "reconnecting",
        "reconnecting",
        "reconnecting",
        "connected",
        "idle",
      ])
      expect(opens.map(({ request }) => request.path)).toEqual(Array(3).fill(`${source.kind}/${source.id}/events`))
      expect(opens[2]!.request.query?.directory).toBe("/tmp/stream-lifecycle-project")
      expect(closed).toEqual(["transport-error", "consumer-dispose"])
      expect(messageStore.sseStatus).toBe("idle")
    } finally {
      statuses.mockRestore()
    }
  })
}
