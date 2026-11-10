import { afterEach, expect, test } from "bun:test"
import { createComputed, createRoot } from "solid-js"
import { loadMeta, retireMetaProjection } from "../src/services/meta"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { boardStore, setBoardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

afterEach(() => {
  retireMetaProjection()
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  setBoardStore({ selectedSource: null, selectEpoch: 0, board: null })
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
  }).toEqual({ directory: "D:/documents", info: { initialized: false, hasRemote: false }, loading: false, error: null })
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

test.each(["path", "vcs"] as const)("the other metadata read settles while %s is pending and keeps its result when it fails", async (failing) => {
  const directory = "D:/project"
  const initialPath = { directory }
  const initialVcs = { initialized: true, branch: "main" }
  const nextPath = { directory: "D:/project/physical" }
  const nextVcs = { initialized: true, branch: "next" }
  const pathFails = failing === "path"
  const pending = Promise.withResolvers<unknown>()
  const cause = new Error(`${failing} permission denied`)
  setSettingsStore("directory", directory)
  transport((request) => request.path === "path" ? initialPath : initialVcs)
  await loadMeta()
  transport((request) => {
    if (request.path === failing) return pending.promise
    return request.path === "path" ? nextPath : nextVcs
  })
  const firstSettlement = Promise.withResolvers<void>()
  const dispose = createRoot((dispose) => {
    createComputed(() => {
      if (pathFails ? boardStore.vcs?.branch === "next" : boardStore.path?.directory === nextPath.directory) {
        firstSettlement.resolve()
      }
    })
    return dispose
  })
  try {
    const refresh = loadMeta().catch((error: unknown) => error)
    await firstSettlement.promise
    const published = { path: pathFails ? initialPath : nextPath, vcs: pathFails ? nextVcs : initialVcs }
    expect({ path: boardStore.path, vcs: boardStore.vcs, pathLoading: boardStore.pathLoading, vcsLoading: boardStore.vcsLoading })
      .toEqual({ ...published, pathLoading: pathFails, vcsLoading: !pathFails })
    pending.reject(cause)
    expect(await refresh).toBe(cause)
    expect({ path: boardStore.path, vcs: boardStore.vcs, pathLoading: boardStore.pathLoading, vcsLoading: boardStore.vcsLoading })
      .toEqual({ ...published, pathLoading: false, vcsLoading: false })
    expect((pathFails ? boardStore.pathError : boardStore.vcsError)?.cause).toBe(cause)
    transport((request) => request.path === "path" ? nextPath : nextVcs)
    await loadMeta()
    expect({ path: boardStore.path, vcs: boardStore.vcs, pathError: boardStore.pathError, vcsError: boardStore.vcsError })
      .toEqual({ path: nextPath, vcs: nextVcs, pathError: null, vcsError: null })
  } finally {
    dispose()
  }
})

test("two failed metadata reads return both original diagnostics in path and Git order", async () => {
  const path = new Error("path unavailable")
  const vcs = new Error("Git unavailable")
  setSettingsStore("directory", "D:/project")
  transport((request) => { throw request.path === "path" ? path : vcs })
  const error = await loadMeta().catch((cause: unknown) => cause)
  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual([path, vcs])
  expect([boardStore.pathError?.cause, boardStore.vcsError?.cause]).toEqual([path, vcs])
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
  setBoardStore({ selectEpoch: 12, selectedSource: { kind: "session", id: "ses_current", directory } })
  transport((request) => request.path === "path" ? { directory } : { branch: "current-view" })
  await loadMeta()
  if (outcome === "response") pending.resolve({ branch: "old-read" })
  else pending.reject(new Error("retired read error"))
  await loading
  expect({ path: boardStore.path, vcs: boardStore.vcs, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({
    path: { directory }, vcs: { branch: "current-view" }, loading: false, error: null,
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
  expect({ directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({ directory: "D:/owned/meta-b", loading: true, error: null })
  second.resolve({ branch: "b-current" })
  await current
  expect({ path: boardStore.path, vcs: boardStore.vcs, loading: boardStore.vcsLoading }).toEqual({ path: { directory: "D:/owned/meta-b" }, vcs: { branch: "b-current" }, loading: false })
})

test("an empty current scope settles the canonical metadata projection", async () => {
  setSettingsStore("directory", "")
  setBoardStore({ selectedSource: null, board: null, path: { directory: "D:/old" }, vcs: { branch: "old" }, vcsDirectory: "D:/old", vcsLoading: true, vcsError: { cause: new Error("old failure") } })
  await loadMeta()
  expect({ path: boardStore.path, vcs: boardStore.vcs, directory: boardStore.vcsDirectory, loading: boardStore.vcsLoading, error: boardStore.vcsError }).toEqual({ path: null, vcs: null, directory: "", loading: false, error: null })
})
