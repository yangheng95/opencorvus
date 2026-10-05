import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  closeFileEditor,
  openFileEditor,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
} from "../src/services/file-workbench"
import {
  activeDirectory,
  beginWorkspaceSelection,
  requestWorkspaceSelection,
  resolveGlobalComposerProject,
} from "../src/services/workspace"
import { boardStore, setBoardStore } from "../src/store/board"
import { setSettingsStore } from "../src/store/settings"

const DIRECTORY = "D:/owned/anonymous"
const originalFrame = globalThis.requestAnimationFrame
globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
  queueMicrotask(() => callback(0))
  return 0
}) as typeof requestAnimationFrame
afterAll(() => {
  globalThis.requestAnimationFrame = originalFrame
})

let unregister: (() => void) | undefined
beforeEach(() => {
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false, taskSelectionError: null })
  setSettingsStore({ directory: "", savedDirectory: "", initGit: false })
  configure({ directory: "" })
  beginWorkspaceSelection()
})
afterEach(async () => {
  unregister?.()
  unregister = undefined
  await closeFileEditor()
  __setHostTransportForTest(undefined)
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false, taskSelectionError: null })
  setSettingsStore({ directory: "", savedDirectory: "" })
  configure({ directory: "" })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function installTransport(reply?: (request: TransportRequest) => Promise<unknown>) {
  const creations: string[] = []
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      if (request.path === "global/projects/anonymous") creations.push(request.method)
      const body = reply
        ? await reply(request)
        : request.path === "global/projects/anonymous"
          ? { directory: DIRECTORY }
          : {}
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      return { close() {} }
    },
  } as HostTransport)
  return creations
}

test("concurrent attachment inputs share one admission, anonymous Project and complete receipt", async () => {
  const creations = installTransport()
  await openFileEditor("draft.md", { directory: "D:/owned/previous" })
  const decisions: string[] = []
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: async () => {
      decisions.push("approved")
      return true
    },
    isDirty: () => true,
  })
  const origin = boardStore.selectEpoch
  const receipts = await Promise.all(
    [1, 2, 3].map(() => resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin })),
  )
  expect(receipts).toEqual(Array.from({ length: 3 }, () => ({ directory: DIRECTORY, selectionEpoch: origin + 1 })))
  expect({ decisions, creations, active: activeDirectory(), file: selectedFileTarget() }).toEqual({
    decisions: ["approved"],
    creations: ["POST"],
    active: DIRECTORY,
    file: null,
  })
})

test("a shared cancelled decision returns AbortError to every input and retains its original facts", async () => {
  installTransport()
  await openFileEditor("draft.md", { directory: "D:/owned/previous" })
  unregister = registerFileEditorBeforeNavigate({ confirmLeave: async () => false, isDirty: () => true })
  const origin = boardStore.selectEpoch
  const first = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin })
  const second = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin })
  expect(await Promise.allSettled([first, second])).toMatchObject([
    { status: "rejected", reason: { name: "AbortError" } },
    { status: "rejected", reason: { name: "AbortError" } },
  ])
  expect({ file: selectedFileTarget(), epoch: boardStore.selectEpoch, directory: activeDirectory() }).toEqual({
    file: { path: "draft.md", directory: "D:/owned/previous" },
    epoch: origin,
    directory: "",
  })
})

test("a newer admission sequence invalidates same-lineage joins before the public epoch changes", async () => {
  installTransport()
  await openFileEditor("draft.md", { directory: "D:/owned/previous" })
  const entered = deferred<void>()
  const decision = deferred<boolean>()
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: () => {
      entered.resolve()
      return decision.promise
    },
    isDirty: () => true,
  })
  const origin = boardStore.selectEpoch
  const first = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin })
  await entered.promise
  const navigation = requestWorkspaceSelection()
  const outcomes = Promise.allSettled([first, navigation])
  await expect(resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin })).rejects.toMatchObject({
    name: "AbortError",
  })
  decision.resolve(false)
  expect(await outcomes).toMatchObject([
    { status: "rejected", reason: { name: "AbortError" } },
    { status: "rejected", reason: { name: "AbortError" } },
  ])
  expect({ epoch: boardStore.selectEpoch, directory: activeDirectory(), path: selectedFileTarget()?.path }).toEqual({
    epoch: origin,
    directory: "",
    path: "draft.md",
  })
})

test("an old completion preserves a replacement allocation and its concurrent join", async () => {
  const firstPost = deferred<void>()
  const secondPost = deferred<void>()
  const firstResponse = deferred<unknown>()
  const secondResponse = deferred<unknown>()
  let count = 0
  const creations = installTransport(async (request) => {
    if (request.path !== "global/projects/anonymous") return {}
    count += 1
    if (count === 1) {
      firstPost.resolve()
      return firstResponse.promise
    }
    if (count === 2) {
      secondPost.resolve()
      return secondResponse.promise
    }
    throw new Error("Unexpected extra allocation")
  })
  const old = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: boardStore.selectEpoch })
  await firstPost.promise
  const newOrigin = beginWorkspaceSelection()
  const current = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: newOrigin })
  await secondPost.promise
  firstResponse.resolve({ directory: "D:/owned/superseded" })
  await expect(old).rejects.toMatchObject({ name: "AbortError" })
  const joined = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: boardStore.selectEpoch })
  secondResponse.resolve({ directory: DIRECTORY })
  expect(await Promise.all([current, joined])).toEqual([
    { directory: DIRECTORY, selectionEpoch: newOrigin + 1 },
    { directory: DIRECTORY, selectionEpoch: newOrigin + 1 },
  ])
  expect({ creations, active: activeDirectory() }).toEqual({ creations: ["POST", "POST"], active: DIRECTORY })
})

test("same-lineage inputs join until directory activation finishes even after directory becomes visible", async () => {
  const activation = deferred<void>()
  const release = deferred<void>()
  const order: string[] = []
  const creations = installTransport(async (request) => {
    if (request.path === "global/projects/anonymous") return { directory: DIRECTORY }
    if (request.query?.directory === DIRECTORY) {
      activation.resolve()
      await release.promise
    }
    return {}
  })
  const origin = boardStore.selectEpoch
  const first = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin }).then((receipt) => {
    order.push("first receipt")
    return receipt
  })
  await activation.promise
  expect(activeDirectory()).toBe(DIRECTORY)
  const second = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: boardStore.selectEpoch }).then(
    (receipt) => {
      order.push("second receipt")
      return receipt
    },
  )
  const originalLineage = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: origin }).then(
    (receipt) => {
      order.push("original lineage receipt")
      return receipt
    },
  )
  order.push("activation released")
  release.resolve()
  expect(await Promise.all([first, second, originalLineage])).toEqual([
    { directory: DIRECTORY, selectionEpoch: origin + 1 },
    { directory: DIRECTORY, selectionEpoch: origin + 1 },
    { directory: DIRECTORY, selectionEpoch: origin + 1 },
  ])
  expect({ order, creations }).toEqual({
    order: ["activation released", "first receipt", "second receipt", "original lineage receipt"],
    creations: ["POST"],
  })
})

test("admitted Mission input consumes its exact epoch and established attachment input returns that owner", async () => {
  const creations = installTransport()
  const epoch = boardStore.selectEpoch
  expect(await resolveGlobalComposerProject({ kind: "admitted", selectionEpoch: epoch })).toEqual({
    directory: DIRECTORY,
    selectionEpoch: epoch,
  })
  expect(await resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: epoch })).toEqual({
    directory: DIRECTORY,
    selectionEpoch: epoch,
  })
  expect({ epoch: boardStore.selectEpoch, creations }).toEqual({ epoch, creations: ["POST"] })
})

test("a late allocation response reports AbortError and retains a newer established Project", async () => {
  const started = deferred<void>()
  const response = deferred<unknown>()
  installTransport(async (request) => {
    if (request.path !== "global/projects/anonymous") return {}
    started.resolve()
    return response.promise
  })
  const old = resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: boardStore.selectEpoch })
  await started.promise
  const currentEpoch = beginWorkspaceSelection()
  setSettingsStore("directory", "D:/owned/current")
  response.resolve({ directory: DIRECTORY })
  await expect(old).rejects.toMatchObject({ name: "AbortError" })
  expect(await resolveGlobalComposerProject({ kind: "attachment", selectionEpoch: currentEpoch })).toEqual({
    directory: "D:/owned/current",
    selectionEpoch: currentEpoch,
  })
})
