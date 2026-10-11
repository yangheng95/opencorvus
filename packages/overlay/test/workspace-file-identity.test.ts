import { afterEach, expect, test } from "bun:test"
import { setBoardStore } from "../src/store/board"
import { editorTargetPath, openProjectFile } from "../src/services/workspace"
import { closeFileEditor, selectedFileTarget } from "../src/services/file-workbench"

afterEach(async () => {
  await closeFileEditor()
  setBoardStore({ selectedSource: null, board: null })
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
