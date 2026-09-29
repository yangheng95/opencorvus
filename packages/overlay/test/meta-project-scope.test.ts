import { afterEach, expect, test } from "bun:test"
import { loadMeta } from "../src/services/meta"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { boardStore, setBoardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

afterEach(() => {
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  setBoardStore({ selectedSource: null, board: null, vcs: null, vcsDirectory: "", vcsLoading: false, vcsError: "" })
})

function transport(read: (request: TransportRequest) => unknown | Promise<unknown>) {
  __setHostTransportForTest({
    kind: "tauri",
    async request(request) {
      return { ok: true, status: 200, headers: {}, body: await read(request) }
    },
  } as HostTransport)
}

test("metadata follows the selected session directory and exposes its non-Git facts", async () => {
  setSettingsStore("directory", "D:/old-repository")
  setBoardStore({
    selectedSource: { kind: "session", id: "session-current", directory: "D:/documents" },
    vcs: { initialized: true, branch: "old" },
    vcsDirectory: "D:/old-repository",
  })
  const requests: TransportRequest[] = []
  transport((request) => {
    requests.push(request)
    return request.path === "path" ? { directory: "D:/documents" } : { initialized: false, hasRemote: false }
  })
  await loadMeta()
  expect(requests.map((request) => [request.path, request.query])).toEqual([
    ["path", { directory: "D:/documents" }],
    ["vcs", { directory: "D:/documents" }],
  ])
  expect({
    directory: boardStore.vcsDirectory,
    info: boardStore.vcs,
    loading: boardStore.vcsLoading,
    error: boardStore.vcsError,
  }).toEqual({ directory: "D:/documents", info: { initialized: false, hasRemote: false }, loading: false, error: "" })
})

test("latest metadata request owns the result when an earlier request finishes later", async () => {
  setSettingsStore("directory", "D:/project")
  let finishFirst!: (value: unknown) => void
  let vcsReads = 0
  transport((request) =>
    request.path === "path"
      ? { directory: "D:/project" }
      : ++vcsReads === 1
        ? new Promise((resolve) => {
            finishFirst = resolve
          })
        : { initialized: true, branch: "current" },
  )
  const first = loadMeta()
  await loadMeta()
  finishFirst({ initialized: true, branch: "previous" })
  await first
  expect(boardStore.vcs).toEqual({ initialized: true, branch: "current" })
  expect(boardStore.vcsDirectory).toBe("D:/project")
  expect(boardStore.vcsLoading).toBe(false)
})

test("failed metadata read yields a scoped error state", async () => {
  setSettingsStore("directory", "D:/project")
  setBoardStore({ vcsDirectory: "D:/project", vcs: { initialized: true, branch: "main" } })
  transport(() => {
    throw new Error("repository permission denied")
  })
  await expect(loadMeta()).rejects.toThrow("repository permission denied")
  expect({ info: boardStore.vcs, error: boardStore.vcsError, loading: boardStore.vcsLoading }).toEqual({
    info: null,
    error: "repository permission denied",
    loading: false,
  })
})
