import { afterEach, expect, test } from "bun:test"
import { captureApiAuthority, renewApiAuthority } from "../src/services/api"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  closeFileEditor,
  copyFileItem,
  createFileItem,
  loadFileDirectory,
  uploadDroppedFiles,
  deleteFileItem,
  fileWorkbenchOpen,
  fileEditorReserved,
  prepareFileEditorClose,
  fileWorkbenchRevision,
  moveFileItem,
  openFileEditor,
  openSourceFileEditor,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
} from "../src/services/file-workbench"

function registerDecision(confirmLeave: () => Promise<boolean>) {
  return registerFileEditorBeforeNavigate({ confirmLeave: async () => (await confirmLeave()) ? 0 : null, getRevision: () => 0, isBusy: () => false, isDirty: () => true })
}

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
    node: { name: path.split("/").at(-1), path, absolute: `/repo/${path}`, type: "file" as const, ignored: false },
  }
}

test("rename resolves the shared decision at the original target before applying its exact receipt", async () => {
  await openFileEditor("notes.md", { directory: "/repo" }, { startLine: 2, endLine: 2 })
  const steps: unknown[] = []
  unregister = registerDecision(async () => {
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
  unregister = registerDecision(async () => false)
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
  unregister = registerDecision(() => {
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
  unregister = registerDecision(async () => true)
  transport(() => ({ body: moved("src", "lib") }))
  await moveFileItem("src", "lib", { directory: "/repo" })
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "lib/nested/notes.md" })
})

test("unrelated directories and sibling paths preserve their independent selected resource", async () => {
  await openFileEditor("src/notes.md", { directory: "/repo" })
  unregister = registerDecision(async () => false)
  transport(() => ({ body: moved("src", "lib") }))
  expect((await moveFileItem("src", "lib", { directory: "/other" })).path).toBe("lib")
  transport(() => ({ body: moved("src-copy", "copy") }))
  expect((await moveFileItem("src-copy", "copy", { directory: "/repo" })).path).toBe("copy")
  expect(selectedFileTarget()).toEqual({ directory: "/repo", path: "src/notes.md" })
})

test("deleting an approved ancestor closes the exact writable target and advances its revision", async () => {
  await openFileEditor("src/notes.md", { directory: "/repo" })
  unregister = registerDecision(async () => true)
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
  unregister = registerDecision(async () => false)
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
  unregister = registerDecision(async () => true)
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


test("prepared close holds the approved draft until durable commit and commits its boundary exactly once", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  let revision = 7
  let currentView = true
  const commits: string[] = []
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: async () => revision,
    getRevision: () => revision,
    isDirty: () => true,
    isBusy: () => false,
  })
  const result = await prepareFileEditorClose({ isCurrent: () => currentView, commit: () => commits.push("durable B") })
  expect(result.status).toBe("ready")
  if (result.status !== "ready") throw new Error("Expected ready admission")
  expect({ held: fileEditorReserved(), current: result.handle.isCurrent(), target: selectedFileTarget()?.path }).toEqual({
    held: true, current: true, target: "draft.md",
  })
  expect(await prepareFileEditorClose()).toEqual({ status: "busy" })
  expect(await openFileEditor("other.md", { directory: "/b" })).toBe(false)
  await expect(deleteFileItem("draft.md", { directory: "/a" })).rejects.toMatchObject({ name: "AbortError", reason: "busy" })
  expect(selectedFileTarget()).toEqual({ directory: "/a", path: "draft.md" })
  // Persistence has succeeded. Closing the initiating view cannot retract that fact.
  currentView = false
  result.handle.commit()
  result.handle.commit()
  result.handle.release()
  expect({ commits, held: fileEditorReserved(), target: selectedFileTarget(), revision }).toEqual({
    commits: ["durable B"], held: false, target: null, revision: 7,
  })
})

test("failed persistence releases admission and retains the exact saved or dirty owner revision", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  let revision = 3
  unregister = registerFileEditorBeforeNavigate({
    // A real Save decision may advance the buffer's saved baseline before preferences fail.
    confirmLeave: async () => ++revision,
    getRevision: () => revision,
    isBusy: () => false,
    isDirty: () => false,
  })
  const result = await prepareFileEditorClose()
  if (result.status !== "ready") throw new Error("Expected ready admission")
  expect(result.handle.isCurrent()).toBe(true)
  result.handle.release()
  expect({ revision, held: fileEditorReserved(), target: selectedFileTarget() }).toEqual({
    revision: 4, held: false, target: { directory: "/a", path: "draft.md" },
  })
  expect(await openFileEditor("next.md", { directory: "/a" })).toBe(true)
  expect(selectedFileTarget()?.path).toBe("next.md")
})

test("busy work, cancellation and changed approval revisions have explicit preparation outcomes", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  let busy = true
  let revision = 1
  let approval: number | null = null
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: async () => approval,
    getRevision: () => revision,
    isBusy: () => busy,
    isDirty: () => true,
  })
  expect(await prepareFileEditorClose()).toEqual({ status: "busy" })
  busy = false
  expect(await prepareFileEditorClose()).toEqual({ status: "cancelled" })
  approval = 1
  revision = 2
  expect(await prepareFileEditorClose()).toEqual({ status: "superseded" })
  expect({ held: fileEditorReserved(), target: selectedFileTarget(), revision }).toEqual({
    held: false, target: { directory: "/a", path: "draft.md" }, revision: 2,
  })
})

test("an affected rename holds its target through the actual pending transport and releases on exact failure", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  unregister = registerDecision(async () => true)
  let settle!: (value: TransportResponse<unknown>) => void
  let entered!: () => void
  const dispatched = new Promise<void>((resolve) => { entered = resolve })
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>() {
      entered()
      return await new Promise<TransportResponse<unknown>>((resolve) => { settle = resolve }) as TransportResponse<T>
    },
    openStream() { throw new Error("This fixture only implements HTTP requests") },
    async native() { throw new Error("This fixture only implements HTTP requests") },
  } as HostTransport)
  const operation = moveFileItem("draft.md", "renamed.md", { directory: "/a" })
  await dispatched
  expect({ held: fileEditorReserved(), preparation: await prepareFileEditorClose() }).toEqual({
    held: true, preparation: { status: "busy" },
  })
  settle({ status: 409, ok: false, headers: {}, body: { name: "FileWriteConflictError" } })
  await expect(operation).rejects.toMatchObject({ name: "ApiError", status: 409, body: { name: "FileWriteConflictError" } })
  expect({ held: fileEditorReserved(), target: selectedFileTarget() }).toEqual({
    held: false, target: { directory: "/a", path: "draft.md" },
  })
})

test("a retired rename retains its real response receipt and releases the original target admission", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  unregister = registerDecision(async () => true)
  let settle!: (value: TransportResponse<unknown>) => void
  let entered!: () => void
  const dispatched = new Promise<void>((resolve) => { entered = resolve })
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>() {
      entered()
      return await new Promise<TransportResponse<unknown>>((resolve) => { settle = resolve }) as TransportResponse<T>
    },
    openStream() { throw new Error("This fixture only implements HTTP requests") },
    async native() { throw new Error("This fixture only implements HTTP requests") },
  } as HostTransport)
  const operation = moveFileItem("draft.md", "renamed.md", { directory: "/a" })
  await dispatched
  renewApiAuthority()
  const receipt = moved("draft.md", "renamed.md")
  settle({ status: 200, ok: true, headers: {}, body: receipt })
  await expect(operation).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", outcome: { phase: "response", response: { status: 200, body: receipt } },
  })
  expect({ held: fileEditorReserved(), target: selectedFileTarget() }).toEqual({
    held: false, target: { directory: "/a", path: "draft.md" },
  })
})

test("authority renewal during a file decision yields its typed retirement and preserves the authored target", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  let approve!: (revision: number) => void
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: () => new Promise<number>((resolve) => { approve = resolve }),
    getRevision: () => 9,
    isDirty: () => true,
    isBusy: () => false,
  })
  const preparation = prepareFileEditorClose()
  renewApiAuthority()
  approve(9)
  await expect(preparation).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", outcome: { phase: "before_dispatch" },
  })
  expect({ held: fileEditorReserved(), target: selectedFileTarget() }).toEqual({
    held: false, target: { directory: "/a", path: "draft.md" },
  })
})


test("all file operation entry points preserve a caller's retired logical authority", async () => {
  const scope = { directory: "/a", authority: captureApiAuthority() }
  renewApiAuthority()
  const operations = [
    () => loadFileDirectory("", scope),
    () => uploadDroppedFiles("", [], scope),
    () => createFileItem({ path: "created.md", type: "file" }, scope),
    () => moveFileItem("first.md", "moved.md", scope),
    () => copyFileItem("first.md", "copied.md", scope),
    () => deleteFileItem("first.md", scope),
  ]
  for (const operation of operations) {
    await expect(operation()).rejects.toMatchObject({
      name: "ApiAuthorityChangedError", expectedRevision: scope.authority.revision,
      outcome: { phase: "before_dispatch" },
    })
  }
})

test("a batch retains its first accepted copy and uses the same authority for the next member", async () => {
  const scope = { directory: "/a", authority: captureApiAuthority() }
  const receipt = { sourcePath: "first.md", path: "copied.md", node: moved("first.md", "copied.md").node }
  transport(() => ({ body: receipt }))
  expect(await copyFileItem("first.md", "copied.md", scope)).toEqual(receipt)
  const committedRevision = fileWorkbenchRevision()
  renewApiAuthority()
  await expect(copyFileItem("second.md", "copied-second.md", scope)).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", outcome: { phase: "before_dispatch" },
  })
  expect(fileWorkbenchRevision()).toBe(committedRevision)
})


test("file opens consume the caller's exact current authority while retaining resource-only target identity", async () => {
  const scope = { directory: "/owned/project", authority: captureApiAuthority() }
  expect(await openFileEditor("notes.md", scope, { startLine: 2, endLine: 3 })).toBe(true)
  expect(selectedFileTarget()).toEqual({ directory: "/owned/project", path: "notes.md", range: { startLine: 2, endLine: 3 } })
  expect(await openSourceFileEditor("/owned/source.ts", scope)).toBe(true)
  expect(selectedFileTarget()).toEqual({ directory: "/owned/project", path: "/owned/source.ts", sourceAbsolutePath: "/owned/source.ts" })
  renewApiAuthority()
  for (const operation of [
    () => openFileEditor("later.md", scope),
    () => openSourceFileEditor("/owned/later.ts", scope),
  ]) {
    await expect(operation()).rejects.toMatchObject({
      name: "ApiAuthorityChangedError", expectedRevision: scope.authority.revision,
      outcome: { phase: "before_dispatch" },
    })
  }
  expect(selectedFileTarget()).toEqual({ directory: "/owned/project", path: "/owned/source.ts", sourceAbsolutePath: "/owned/source.ts" })
})

test("the supplied open authority remains the decision owner across its actual wait", async () => {
  await openFileEditor("draft.md", { directory: "/a" })
  const authority = captureApiAuthority()
  let approve!: (revision: number) => void
  unregister = registerFileEditorBeforeNavigate({
    confirmLeave: () => new Promise<number>((resolve) => { approve = resolve }),
    getRevision: () => 12, isDirty: () => true, isBusy: () => false,
  })
  const opened = openFileEditor("next.md", { directory: "/a", authority })
  renewApiAuthority()
  approve(12)
  await expect(opened).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", expectedRevision: authority.revision,
    outcome: { phase: "before_dispatch" },
  })
  expect({ held: fileEditorReserved(), target: selectedFileTarget() }).toEqual({
    held: false, target: { directory: "/a", path: "draft.md" },
  })
})
