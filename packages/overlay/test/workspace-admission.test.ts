import { afterEach, expect, test } from "bun:test"
import { boardStore, setBoardStore, type BoardSource } from "../src/store/board"
import {
  beginWorkspaceSelection,
  isWorkspaceSelectionReady,
  requestWorkspaceSelection,
  resolveGlobalComposerProject,
} from "../src/services/workspace"
import {
  closeFileEditor,
  hasUnsavedFileChanges,
  openFileEditor,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
} from "../src/services/file-workbench"

const sourceA: BoardSource = { kind: "session", id: "session-a", directory: "/repo", sessionKind: "mission" }
const sourceB: BoardSource = { kind: "session", id: "session-b", directory: "/repo", sessionKind: "mission" }
const file = { directory: "/repo", path: "draft.md" }
let unregister: (() => void) | undefined

afterEach(async () => {
  unregister?.()
  unregister = undefined
  await closeFileEditor()
  setBoardStore({ selectedSource: null, board: null, taskSwitching: false, taskSelectionError: null })
  beginWorkspaceSelection()
})

async function prepare(confirmLeave: () => Promise<boolean>) {
  setBoardStore({
    selectedSource: { ...sourceA },
    board: { kind: "session", sessionID: sourceA.id },
    taskSwitching: false,
  })
  await openFileEditor(file.path, file)
  unregister = registerFileEditorBeforeNavigate({ confirmLeave, isDirty: () => true })
  return boardStore.selectEpoch
}

function deferredDecision() {
  let resolve!: (allowed: boolean) => void
  const promise = new Promise<boolean>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

test("cancelled admission retains the exact source, file and public epoch", async () => {
  const epoch = await prepare(async () => false)
  await expect(requestWorkspaceSelection(sourceB)).rejects.toMatchObject({ name: "AbortError" })
  expect({ source: boardStore.selectedSource, file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({
    source: sourceA,
    file,
    epoch,
  })
})

test("a failed save decision retains the authored target with its typed failure", async () => {
  const error = new Error("Save failed")
  const epoch = await prepare(async () => {
    throw error
  })
  await expect(requestWorkspaceSelection(sourceB)).rejects.toBe(error)
  expect({ source: boardStore.selectedSource, file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({
    source: sourceA,
    file,
    epoch,
  })
})

test("approved admission closes the file and produces exactly one new selection epoch", async () => {
  const epoch = await prepare(async () => true)
  expect(await requestWorkspaceSelection(sourceB)).toEqual({ kind: "admitted", epoch: epoch + 1 })
  expect({ source: boardStore.selectedSource, file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({
    source: sourceA,
    file: null,
    epoch: epoch + 1,
  })
})

test("a committed background fact supersedes a waiting decision while retaining its file owner", async () => {
  const decision = deferredDecision()
  const epoch = await prepare(() => decision.promise)
  const pending = requestWorkspaceSelection(sourceB)
  beginWorkspaceSelection()
  setBoardStore("selectedSource", { ...sourceB })
  decision.resolve(true)
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  expect({ source: boardStore.selectedSource, file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({
    source: sourceB,
    file,
    epoch: epoch + 1,
  })
})

test("the latest user request consumes a shared decision and owns the sole new epoch", async () => {
  const decision = deferredDecision()
  const epoch = await prepare(() => decision.promise)
  const older = requestWorkspaceSelection(sourceB)
  const newer = requestWorkspaceSelection({ ...sourceB, id: "session-c" })
  decision.resolve(true)
  await expect(older).rejects.toMatchObject({ name: "AbortError" })
  expect(await newer).toEqual({ kind: "admitted", epoch: epoch + 1 })
  expect(selectedFileTarget()).toBe(null)
})

test("selecting the current ready source invalidates an older navigation and preserves the draft", async () => {
  const decision = deferredDecision()
  const epoch = await prepare(() => decision.promise)
  const pending = requestWorkspaceSelection(sourceB)
  expect(await requestWorkspaceSelection(sourceA)).toEqual({ kind: "unchanged" })
  decision.resolve(true)
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  expect({ source: boardStore.selectedSource, file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({
    source: sourceA,
    file,
    epoch,
  })
})

test("explicitly revealing the same file supersedes an outstanding close", async () => {
  const decision = deferredDecision()
  const epoch = await prepare(() => decision.promise)
  const pending = requestWorkspaceSelection(sourceB)
  expect(await openFileEditor(file.path, file)).toBe(true)
  decision.resolve(true)
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  expect({ file: selectedFileTarget(), epoch: boardStore.selectEpoch }).toEqual({ file, epoch })
})

test("the null-target fast path respects the external commit predicate", async () => {
  let committed = 0
  expect(
    await closeFileEditor({
      isCurrent: () => false,
      commit: () => {
        committed += 1
      },
    }),
  ).toBe(false)
  expect({ file: selectedFileTarget(), committed }).toEqual({ file: null, committed: 0 })
  expect(
    await closeFileEditor({
      isCurrent: () => true,
      commit: () => {
        committed += 1
      },
    }),
  ).toBe(true)
  expect({ file: selectedFileTarget(), committed }).toEqual({ file: null, committed: 1 })
})

test("a superseded composer allocation returns AbortError even when another source has a directory", async () => {
  setBoardStore("selectedSource", { ...sourceA })
  const previousEpoch = boardStore.selectEpoch
  beginWorkspaceSelection()
  await expect(
    resolveGlobalComposerProject({ kind: "admitted", selectionEpoch: previousEpoch }).promise,
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(boardStore.selectedSource).toEqual(sourceA)
})

test("dirty state reads the registered owner and follows its lifetime", () => {
  let dirty = true
  unregister = registerFileEditorBeforeNavigate({ confirmLeave: async () => true, isDirty: () => dirty })
  expect(hasUnsavedFileChanges()).toBe(true)
  dirty = false
  expect(hasUnsavedFileChanges()).toBe(false)
  dirty = true
  unregister()
  expect(hasUnsavedFileChanges()).toBe(false)
})

test("ready Task, Chat and Mission identities include their directory and matching view", () => {
  const task: BoardSource = { kind: "task", id: "task-a", directory: "/repo" }
  const chat: BoardSource = { ...sourceA, sessionKind: "conversation", experience: "chat" }
  for (const source of [task, chat, sourceA]) {
    setBoardStore({
      selectedSource: { ...source },
      board: source.kind === "task" ? { task: { id: source.id } } : { kind: "session", sessionID: source.id },
    })
    expect(isWorkspaceSelectionReady(source)).toBe(true)
    expect(isWorkspaceSelectionReady({ ...source, directory: "/other" })).toBe(false)
    setBoardStore("board", null)
    expect(isWorkspaceSelectionReady(source)).toBe(false)
    setBoardStore("taskSwitching", true)
    expect(isWorkspaceSelectionReady(source)).toBe(true)
    setBoardStore("taskSwitching", false)
  }
  setBoardStore({
    selectedSource: { ...task },
    board: { task: { id: task.id } },
    taskSelectionError: { taskID: task.id, directory: "/repo", title: "Retry", details: "Read failed" },
  })
  expect(isWorkspaceSelectionReady(task)).toBe(false)
})

test("a prior Task error leaves the ready current Chat and Mission selectable as unchanged", async () => {
  setBoardStore("taskSelectionError", {
    taskID: "failed-task",
    directory: "/repo",
    title: "Retry",
    details: "Read failed",
  })
  for (const source of [sourceA, { ...sourceA, sessionKind: "conversation" as const, experience: "work" as const }]) {
    setBoardStore({ selectedSource: { ...source }, board: { kind: "session", sessionID: source.id } })
    expect(await requestWorkspaceSelection(source)).toEqual({ kind: "unchanged" })
  }
})
