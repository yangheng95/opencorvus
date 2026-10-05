import { afterEach, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  closeFileEditor,
  deleteFileItem,
  fileWorkbenchOpen,
  fileWorkbenchRevision,
  moveFileItem,
  openFileEditor,
  openSourceFileEditor,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
} from "../src/services/file-workbench"

let unregister: (() => void) | undefined
afterEach(async () => {
  unregister?.()
  unregister = undefined
  await closeFileEditor()
  __setHostTransportForTest(undefined)
})

function transport(reply: (request: TransportRequest) => { status?: number; body: unknown }) {
  __setHostTransportForTest({
    kind: "browser",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      const result = reply(request)
      const status = result.status ?? 200
      return { status, ok: status < 400, headers: {}, body: result.body as T }
    },
  } as HostTransport)
}

function moved(previousPath: string, path: string) {
  return {
    previousPath,
    path,
    node: { name: path.split("/").at(-1), path, absolute: `/repo/${path}`, type: "file", ignored: false },
  }
}

test("rename resolves the shared decision at the original target before applying its exact receipt", async () => {
  await openFileEditor("notes.md", { directory: "/repo" }, { startLine: 2, endLine: 2 })
  const steps: unknown[] = []
  unregister = registerFileEditorBeforeNavigate(async () => {
    steps.push({ decisionTarget: selectedFileTarget()?.path })
    return true
  })
  const receipt = moved("notes.md", "renamed.md")
  transport((request) => {
    steps.push({ method: request.method, targetAtRequest: selectedFileTarget()?.path })
    return { body: receipt }
  })
  const revision = fileWorkbenchRevision()
  expect(await moveFileItem("notes.md", "renamed.md", { directory: "/repo" })).toEqual(receipt)
  expect(steps).toEqual([{ decisionTarget: "notes.md" }, { method: "PATCH", targetAtRequest: "notes.md" }])
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "renamed.md", range: { startLine: 2, endLine: 2 } })
  expect(fileWorkbenchRevision()).toBe(revision + 1)
})

test("cancelling an affected mutation returns AbortError and retains the authored resource target", async () => {
  await openFileEditor("notes.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => false)
  await expect(moveFileItem("notes.md", "renamed.md", { directory: "/repo" })).rejects.toMatchObject({
    name: "AbortError",
  })
  expect({ target: selectedFileTarget(), open: fileWorkbenchOpen() }).toEqual({
    target: { directory: "/repo", path: "notes.md" },
    open: true,
  })
})

test("a newer navigation supersedes an outstanding mutation decision", async () => {
  await openFileEditor("notes.md", { directory: "/repo" })
  let resolveDecision!: (allowed: boolean) => void
  let first = true
  unregister = registerFileEditorBeforeNavigate(() => {
    if (!first) return Promise.resolve(true)
    first = false
    return new Promise<boolean>((resolve) => {
      resolveDecision = resolve
    })
  })
  const pending = moveFileItem("notes.md", "renamed.md", { directory: "/repo" })
  expect(await openFileEditor("other.md", { directory: "/repo" })).toBe(true)
  resolveDecision(true)
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "other.md" })
})

test("ancestor moves carry the selected descendant to the authoritative returned path", async () => {
  await openFileEditor("src/nested/notes.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => true)
  transport(() => ({ body: moved("src", "lib") }))
  await moveFileItem("src", "lib", { directory: "/repo" })
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "lib/nested/notes.md" })
})

test("unrelated directories and sibling paths preserve their independent selected resource", async () => {
  await openFileEditor("src/notes.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => false)
  transport(() => ({ body: moved("src", "lib") }))
  expect((await moveFileItem("src", "lib", { directory: "/other" })).path).toBe("lib")
  transport(() => ({ body: moved("src-copy", "copy") }))
  expect((await moveFileItem("src-copy", "copy", { directory: "/repo" })).path).toBe("copy")
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "src/notes.md" })
})

test("deleting an approved ancestor closes the exact writable target and advances its revision", async () => {
  await openFileEditor("src/notes.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => true)
  transport(() => ({ body: { path: "src" } }))
  const revision = fileWorkbenchRevision()
  expect(await deleteFileItem("src", { directory: "/repo" })).toEqual({ path: "src" })
  expect({ target: selectedFileTarget(), open: fileWorkbenchOpen(), revision: fileWorkbenchRevision() }).toEqual({
    target: null,
    open: false,
    revision: revision + 1,
  })
})

test("project mutations retain the independent read-only source target", async () => {
  await openSourceFileEditor("/source/notes.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => false)
  transport(() => ({ body: { path: "source" } }))
  expect(await deleteFileItem("source", { directory: "/repo" })).toEqual({ path: "source" })
  expect(selectedFileTarget()).toEqual({
    directory: "/repo",
    path: "/source/notes.md",
    sourceAbsolutePath: "/source/notes.md",
  })
})

test("each successful mutation remains reconciled when a later batch member fails", async () => {
  await openFileEditor("first.md", { directory: "/repo" })
  unregister = registerFileEditorBeforeNavigate(async () => true)
  transport(() => ({ body: moved("first.md", "moved.md") }))
  const revision = fileWorkbenchRevision()
  await moveFileItem("first.md", "moved.md", { directory: "/repo" })
  transport(() => ({ status: 409, body: { message: "Destination already exists" } }))
  await expect(moveFileItem("second.md", "taken.md", { directory: "/repo" })).rejects.toMatchObject({
    name: "ApiError",
    status: 409,
  })
  expect({ target: selectedFileTarget(), revision: fileWorkbenchRevision() }).toEqual({
    target: { directory: "/repo", path: "moved.md" },
    revision: revision + 1,
  })
  transport(() => ({ body: { path: "moved.md" } }))
  await deleteFileItem("moved.md", { directory: "/repo" })
  transport(() => ({ status: 403, body: { message: "File is protected" } }))
  await expect(deleteFileItem("second.md", { directory: "/repo" })).rejects.toMatchObject({
    name: "ApiError",
    status: 403,
  })
  expect({ target: selectedFileTarget(), revision: fileWorkbenchRevision() }).toEqual({
    target: null,
    revision: revision + 2,
  })
})
