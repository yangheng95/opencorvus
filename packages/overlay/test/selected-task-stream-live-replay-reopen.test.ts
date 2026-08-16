import { afterEach, expect, test } from "bun:test"

import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type {
  HostTransport,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { STREAM_RECONNECT_DELAY_MS, startSSE, stopSSE } from "../src/services/sse"
import { setBoardStore } from "../src/store/board"

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
