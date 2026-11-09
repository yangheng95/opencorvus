import { expect, test } from "bun:test"
import { HOST_CAPABILITIES, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { loadArchivedWorkLedger, loadWorkLedger } from "../src/services/work-ledger"

test.each([
  ["work-ledger", loadWorkLedger],
  ["work-ledger/archive", loadArchivedWorkLedger],
] as const)("%s forwards the list query and retains the deadline error with a caller signal", async (path, load) => {
  const caller = new AbortController()
  const deadline = new AbortController()
  const originalTimeout = AbortSignal.timeout
  let deadlineMs: number | undefined
  let received: TransportRequest | undefined
  AbortSignal.timeout = (ms) => {
    deadlineMs = ms
    return deadline.signal
  }
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    request(request) {
      received = request
      return new Promise((_, reject) => {
        request.signal?.addEventListener("abort", () => reject(request.signal?.reason), { once: true })
      })
    },
    openStream() { throw new Error("List reads use HTTP") },
    async native() { throw new Error("List reads use HTTP") },
  })
  try {
    const result = load({ search: " Ledger deadline ", limit: 7, signal: caller.signal }).catch((cause) => cause)
    expect(received).toMatchObject({ path, method: "GET", query: { search: "Ledger deadline", limit: "7" } })
    expect(deadlineMs).toBe(15_000)
    const reason = new DOMException("The list request timed out", "TimeoutError")
    deadline.abort(reason)
    expect(received?.signal?.reason).toBe(reason)
    expect(await result).toBe(reason)
  } finally {
    caller.abort()
    __setHostTransportForTest(undefined)
    AbortSignal.timeout = originalTimeout
  }
})
