import { expect, test } from "bun:test"
import { captureApiAuthority } from "../src/services/api"
import { loadConversationSearchSnapshot, loadConversationSessionExport } from "../src/services/conversation-snapshot"
import { HOST_CAPABILITIES, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

const directory = "D:/projects/conversation-snapshot"
const session = { id: "ses_snapshot", title: "Original conversation", time: { created: 1, updated: 2 } }
const exported = { session, messages: [] }

type SnapshotReader = (signal: AbortSignal) => Promise<unknown>

const cases: Array<{
  title: string
  path: string
  read: SnapshotReader
  body: unknown
  expected: unknown
  interruption: "caller" | "deadline"
}> = [
  {
    title: "conversation export",
    path: "export/session/ses_snapshot",
    read: (signal) => loadConversationSessionExport(session.id, directory, { authority: captureApiAuthority(), signal }),
    body: exported,
    expected: exported,
    interruption: "deadline",
  },
  {
    title: "conversation search",
    path: "export/session/ses_snapshot",
    read: (signal) => loadConversationSearchSnapshot({ kind: "session", id: session.id, directory }, {
      authority: captureApiAuthority(), signal,
    }),
    body: exported,
    expected: { session, sessionID: session.id, title: session.title, created: 1, updated: 2, messages: [] },
    interruption: "caller",
  },
  {
    title: "Task transcript search",
    path: "task/tas_snapshot/transcript",
    read: (signal) => loadConversationSearchSnapshot({ kind: "task", id: "tas_snapshot", directory }, {
      authority: captureApiAuthority(), signal,
    }),
    body: [],
    expected: { messages: [] },
    interruption: "deadline",
  },
]

test.each(cases)("$title carries its exact directory, interruption cause and successful retry", async (entry) => {
  const originalTimeout = AbortSignal.timeout
  const deadlines: Array<{ milliseconds: number; controller: AbortController }> = []
  const received: TransportRequest[] = []
  const caller = new AbortController()
  AbortSignal.timeout = (milliseconds) => {
    const controller = new AbortController()
    deadlines.push({ milliseconds, controller })
    return controller.signal
  }
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      received.push(request)
      if (received.length === 1) {
        const signal = request.signal
        if (!signal) throw new Error("Snapshot request requires a signal")
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
      }
      return Promise.resolve({ status: 200, ok: true, headers: {}, body: entry.body as T })
    },
    openStream() { throw new Error("Snapshot reads use HTTP") },
    async native() { throw new Error("Snapshot reads use HTTP") },
  })
  try {
    const first = entry.read(caller.signal)
    const cause = entry.interruption === "caller"
      ? new DOMException("The view was closed", "AbortError")
      : new DOMException("The snapshot deadline elapsed", "TimeoutError")
    const interrupted = entry.interruption === "caller" ? caller : deadlines[0].controller
    interrupted.abort(cause)
    const failure = await first.catch((error: unknown) => error)
    expect(failure).toBe(cause)
    expect(received[0].signal?.reason).toBe(cause)

    const retry = await entry.read(new AbortController().signal)
    expect(retry).toEqual(entry.expected)
    expect(received.map(({ path, method, query }) => ({ path, method, query }))).toEqual([
      { path: entry.path, method: "GET", query: { directory } },
      { path: entry.path, method: "GET", query: { directory } },
    ])
    expect(deadlines.map(({ milliseconds }) => milliseconds)).toEqual([15_000, 15_000])
  } finally {
    caller.abort()
    AbortSignal.timeout = originalTimeout
    __setHostTransportForTest(undefined)
  }
})
