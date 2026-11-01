import { afterEach, beforeEach, expect, test } from "bun:test"
import { captureApiAuthority, configure, renewApiAuthority } from "../src/services/api"
import { readToolPart } from "../src/services/tool-part"
import { readRecordedToolComparison } from "../src/services/diff"
import { createTauriTransport } from "../src/services/tauri-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

const originalFetch = globalThis.fetch
const directory = "D:/recorded-comparison"
const receipt = {
  sessionID: "ses_original",
  messageID: "msg_original",
  partID: "prt_original",
  directory,
  fileIndex: 1,
}
const state = {
  status: "completed",
  output: "Updated two files",
  metadata: {
    files: [
      { filePath: `${directory}/first.txt`, type: "add", before: "", after: "first\n" },
      { filePath: `${directory}/notes.md`, type: "update", before: "one\n", after: "one\ntwo\n" },
    ],
  },
}
const part = {
  type: "tool",
  id: receipt.partID,
  sessionID: receipt.sessionID,
  messageID: receipt.messageID,
  tool: "apply_patch",
  state,
}

beforeEach(() => {
  renewApiAuthority()
  configure({ serverUrl: "http://127.0.0.1:7878", directory })
  __setHostTransportForTest(createTauriTransport("browser"))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("an original file index returns that producer's actual endpoints and counts", async () => {
  const requests: { path: string; directory: string | null; method: string }[] = []
  globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(String(input))
    requests.push({ path: url.pathname, directory: url.searchParams.get("directory"), method: init?.method ?? "GET" })
    return Response.json(part)
  }, originalFetch)
  const result = await readRecordedToolComparison(receipt)
  expect(result).toMatchObject({
    file: "notes.md",
    status: "modified",
    before: "one\n",
    after: "one\ntwo\n",
    additions: 1,
    deletions: 0,
    evidence: { kind: "complete", receipts: [{ ...receipt }] },
  })
  expect(requests).toEqual([
    { path: "/session/ses_original/message/msg_original/part/prt_original", directory, method: "GET" },
  ])
})

test("the shared reader accepts the exact immutable deferred outcome", async () => {
  const deferredPart = { ...part, state: { ...state, output: "Recorded immutable outcome\n".repeat(200) } }
  const serialized = JSON.stringify(deferredPart.state)
  const integrity = {
    kind: "deferred" as const,
    outputBytes: new TextEncoder().encode(deferredPart.state.output).byteLength,
    stateBytes: new TextEncoder().encode(serialized).byteLength,
    stateSha256: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
  }
  globalThis.fetch = Object.assign(async () => Response.json(deferredPart), originalFetch)
  const loaded = await readToolPart({ ...receipt, authority: captureApiAuthority(), integrity })
  expect(loaded).toEqual(deferredPart)
  expect(await readRecordedToolComparison({ ...receipt, deferredState: integrity })).toMatchObject({
    before: "one\n",
    after: "one\ntwo\n",
    additions: 1,
    deletions: 0,
  })
})

test("a mismatched persisted identity returns the explicit recorded-part error", async () => {
  globalThis.fetch = Object.assign(async () => Response.json({ ...part, id: "prt_other" }), originalFetch)
  const result = await readToolPart({ ...receipt, authority: captureApiAuthority() }).catch((error) => error)
  expect(result).toBeInstanceOf(Error)
  expect(result.message).toBe("Recorded Tool Part prt_original returned drifted persisted identity")
})

test("an unfinished outcome returns the explicit completed-outcome error", async () => {
  globalThis.fetch = Object.assign(async () => Response.json({ ...part, state: { status: "running" } }), originalFetch)
  const result = await readToolPart({ ...receipt, authority: captureApiAuthority() }).catch((error) => error)
  expect(result).toBeInstanceOf(Error)
  expect(result.message).toBe("Recorded Tool Part prt_original has no completed outcome")
})
