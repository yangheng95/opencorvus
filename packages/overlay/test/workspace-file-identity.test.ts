import { afterEach, expect, test } from "bun:test"
import { setBoardStore } from "../src/store/board"
import { editorTargetPath, openProjectFile, openProjectPathInEditor } from "../src/services/workspace"
import { closeFileEditor, selectedFileTarget } from "../src/services/file-workbench"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, NativeCommand } from "../src/services/host-transport"

afterEach(async () => {
  await closeFileEditor()
  setBoardStore({ selectedSource: null, board: null })
  __setHostTransportForTest(undefined)
})

test.each(["C:/repo/ source.md\u00a0", "/repo/ source.md "])("the native editor receives the literal target %j and cited location", async (path) => {
  const commands: NativeCommand[] = []
  __setHostTransportForTest({
    native: async (command: NativeCommand) => {
      commands.push(command)
      return true
    },
  } as unknown as HostTransport)
  await openProjectPathInEditor("vscode", path, { line: 2, column: 3 })
  expect(commands).toEqual([{ kind: "workspace.openProjectEditor", editor: "vscode", path, line: 2, column: 3 }])
})

test.each([
  ["C:\\repo", " Source note.md", "C:/repo/ Source note.md"],
  ["/repo", "file\\name.md ", "/repo/file\\name.md "],
])("located file references retain exact filenames from %s", async (directory, path, absolute) => {
  setBoardStore({ selectedSource: { kind: "session", id: "session-files", directory, sessionKind: "assistant" } })
  expect(editorTargetPath(path)).toBe(absolute)
  await openProjectFile(path, { line: 2 })
  expect(selectedFileTarget()).toEqual({ directory, path, range: { startLine: 2, endLine: 2 } })
})

test("an absolute located source retains its exact suffix and read-only target", async () => {
  const path = "/outside/ source.md "
  setBoardStore({ selectedSource: { kind: "session", id: "session-files", directory: "/repo", sessionKind: "assistant" } })
  expect(editorTargetPath(path)).toBe(path)
  await openProjectFile(path, { line: 3 })
  expect(selectedFileTarget()).toEqual({
    directory: "/repo", path, sourceAbsolutePath: path, range: { startLine: 3, endLine: 3 },
  })
})
