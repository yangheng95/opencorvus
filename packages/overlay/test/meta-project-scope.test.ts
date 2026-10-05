import { afterEach, expect, test } from "bun:test"
import { loadMeta, retireMetaProjection } from "../src/services/meta"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { boardStore, setBoardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

afterEach(() => {
  retireMetaProjection()
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  setBoardStore({ selectedSource: null, selectEpoch: 0, board: null, path: null, vcs: null, vcsDirectory: "", vcsLoading: false, vcsError: "" })
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

test.each(["response", "error"] as const)("selection ABA settles the original metadata %s owner", async (outcome) => {
  const pending = Promise.withResolvers<unknown>()
  const started = Promise.withResolvers<void>()
  const directory = "D:/owned/meta-a"
  setSettingsStore("directory", directory)
  setBoardStore({ selectedSource: null, selectEpoch: 10, vcsDirectory: directory })
  transport((request) => {
    if (request.path === "path") return { directory: "D:/obsolete-meta-result" }
    started.resolve()
    return pending.promise
  })
  const loading = loadMeta()
  await started.promise
  setBoardStore({ selectEpoch: 11, selectedSource: { kind: "session", id: "ses_other", directory: "D:/owned/meta-b" } })
  setBoardStore({ selectEpoch: 12, selectedSource: { kind: "session", id: "ses_current", directory }, path: { directory }, vcs: { branch: "current-view" } })
  if (outcome === "response") pending.resolve({ branch: "old-read" })
  else pending.reject(new Error("retired read error"))
  await loading
  expect({ path: boardStore.path, vcs: boardStore.vcs, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({
    path: { directory }, vcs: { branch: "current-view" }, loading: false, error: "",
  })
})

test.each(["response", "error"] as const)("successor metadata retains busy ownership after old %s settlement", async (outcome) => {
  const first = Promise.withResolvers<unknown>()
  const second = Promise.withResolvers<unknown>()
  const started = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
  let index = 0
  setSettingsStore("directory", "D:/owned/meta-a")
  setBoardStore({ selectedSource: null, selectEpoch: 20 })
  transport((request) => {
    if (request.path === "path") return { directory: request.query?.directory }
    const current = index++
    started[current].resolve()
    return current === 0 ? first.promise : second.promise
  })
  const previous = loadMeta()
  await started[0].promise
  setBoardStore({ selectEpoch: 21, selectedSource: { kind: "session", id: "ses_b", directory: "D:/owned/meta-b" } })
  const current = loadMeta()
  await started[1].promise
  // A stale explicit refresh must leave the actual B request and its visible state intact.
  await loadMeta("D:/owned/meta-a")
  if (outcome === "response") first.resolve({ branch: "old" })
  else first.reject(new Error("old failure"))
  await previous
  expect({ directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({ directory: "D:/owned/meta-b", loading: true, error: "" })
  second.resolve({ branch: "b-current" })
  await current
  expect({ path: boardStore.path, vcs: boardStore.vcs, loading: boardStore.vcsLoading }).toEqual({ path: { directory: "D:/owned/meta-b" }, vcs: { branch: "b-current" }, loading: false })
})

test("an empty current scope settles the canonical metadata projection", async () => {
  setSettingsStore("directory", "")
  setBoardStore({ selectedSource: null, board: null, path: { directory: "D:/old" }, vcs: { branch: "old" }, vcsDirectory: "D:/old", vcsLoading: true, vcsError: "old failure" })
  await loadMeta()
  expect({ path: boardStore.path, vcs: boardStore.vcs, directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({ path: null, vcs: null, directory: "", loading: false, error: "" })
})
