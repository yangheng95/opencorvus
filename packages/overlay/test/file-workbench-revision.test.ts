import { afterEach, expect, test } from "bun:test"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  closeFileEditor,
  createFileItem,
  fileEditorRevealRevision,
  fileWorkbenchRevision,
  openFileEditor,
  openSourceFileEditor,
  selectedFileTarget,
} from "../src/services/file-workbench"

afterEach(async () => {
  await closeFileEditor()
  __setHostTransportForTest(undefined)
})

test.each([
  ["C:/project", " Source note.md", " Source note.md"],
  ["C:\\project", "dir\\ Source note.md", "dir/ Source note.md"],
  ["/repo", "file\\name.ts", "file\\name.ts"],
  ["/repo", "note.md ", "note.md "],
])("editor target retains filename identity for %s / %s", async (directory, path, expected) => {
  expect(await openFileEditor(path, { directory }, { startLine: 1, endLine: 2 })).toBe(true)
  expect(selectedFileTarget()).toEqual({ directory, path: expected, range: { startLine: 1, endLine: 2 } })
})

test("read-only source target preserves a POSIX filename suffix", async () => {
  expect(await openSourceFileEditor("/outside/file\\name.md ", { directory: "/repo" })).toBe(true)
  expect(selectedFileTarget()).toEqual({
    directory: "/repo", path: "/outside/file\\name.md ", sourceAbsolutePath: "/outside/file\\name.md ",
  })
})

test("every accepted range-free open emits a reveal revision with its exact resource target", async () => {
  const beforeOpen = fileEditorRevealRevision()
  expect(await openFileEditor("acceptance-note.md", { directory: "/repo" })).toBe(true)
  const target = selectedFileTarget()
  expect({ target, revision: fileEditorRevealRevision() }).toEqual({
    target: { directory: "/repo", path: "acceptance-note.md" },
    revision: beforeOpen + 1,
  })
  expect(await openFileEditor("acceptance-note.md", { directory: "/repo" })).toBe(true)
  expect({ target: selectedFileTarget(), revision: fileEditorRevealRevision() }).toEqual({
    target,
    revision: beforeOpen + 2,
  })
  expect(await openFileEditor("next-note.md", { directory: "/repo" })).toBe(true)
  expect({ target: selectedFileTarget(), revision: fileEditorRevealRevision() }).toEqual({
    target: { directory: "/repo", path: "next-note.md" },
    revision: beforeOpen + 3,
  })
})

test("source display names update the selected target while retaining the exact resource path", async () => {
  const source = "/owned/attachments/content.md"
  const scope = { directory: "/owned" }
  const before = fileEditorRevealRevision()
  expect(await openSourceFileEditor(source, scope, { startLine: 24, endLine: 24 }, "研究记录.md")).toBe(true)
  expect(selectedFileTarget()).toEqual({
    ...scope, path: source, sourceAbsolutePath: source, displayName: "研究记录.md", range: { startLine: 24, endLine: 24 },
  })
  expect(await openSourceFileEditor(source, scope, { startLine: 24, endLine: 24 }, "原始名称.md")).toBe(true)
  expect({ target: selectedFileTarget(), reveal: fileEditorRevealRevision() }).toEqual({
    target: { ...scope, path: source, sourceAbsolutePath: source, displayName: "原始名称.md", range: { startLine: 24, endLine: 24 } },
    reveal: before + 2,
  })
})

test("file editor navigation retains and updates the exact cited line range", async () => {
  await openFileEditor("src/source.ts", { directory: "/repo" }, { startLine: 12, endLine: 18 })

  expect(selectedFileTarget()).toEqual({
    directory: "/repo",
    path: "src/source.ts",
    range: { startLine: 12, endLine: 18 },
  })

  await openFileEditor("src/source.ts", { directory: "/repo" }, { startLine: 41, endLine: 41 })

  expect(selectedFileTarget()).toEqual({
    directory: "/repo",
    path: "src/source.ts",
    range: { startLine: 41, endLine: 41 },
  })

  const beforeRepeatReveal = fileEditorRevealRevision()
  await openFileEditor("src/source.ts", { directory: "/repo" }, { startLine: 41, endLine: 41 })
  expect(fileEditorRevealRevision()).toBe(beforeRepeatReveal + 1)
})

test("absolute source navigation retains the exact read-only source path", async () => {
  await openSourceFileEditor(
    "C:\\external-worktree\\src\\source.ts",
    { directory: "D:\\active-project" },
    { startLine: 7, endLine: 9 },
  )

  expect(selectedFileTarget()).toEqual({
    directory: "D:\\active-project",
    path: "C:\\external-worktree\\src\\source.ts",
    sourceAbsolutePath: "C:\\external-worktree\\src\\source.ts",
    range: { startLine: 7, endLine: 9 },
  })

  await openSourceFileEditor(
    "/external-worktree/src/source.ts",
    { directory: "/active-project" },
    { startLine: 11, endLine: 13 },
  )

  expect(selectedFileTarget()).toEqual({
    directory: "/active-project",
    path: "/external-worktree/src/source.ts",
    sourceAbsolutePath: "/external-worktree/src/source.ts",
    range: { startLine: 11, endLine: 13 },
  })
})

test("a successful file mutation advances the exact workbench revision", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest({
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          name: "notes.md",
          path: "notes.md",
          absolute: "/repo/notes.md",
          type: "file",
          ignored: false,
        } as T,
      }
    },
    openStream() {
      throw new Error("openStream not used in file workbench contract")
    },
    async native() {
      throw new Error("native not used in file workbench contract")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as HostTransport)

  const before = fileWorkbenchRevision()
  const created = await createFileItem(
    { path: "notes.md", type: "file", content: "ready" },
    { directory: "/repo" },
  )

  expect(created.path).toBe("notes.md")
  expect(fileWorkbenchRevision()).toBe(before + 1)
  expect(requests).toHaveLength(1)
})
