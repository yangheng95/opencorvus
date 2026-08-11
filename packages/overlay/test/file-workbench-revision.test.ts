import { afterEach, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
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
