import { expect, test } from "bun:test"
import { normalizeProjectFilePath, pathWithForwardSeparators } from "../src/utils/server-path"

test.each([
  ["C:/repo", "folder\\ name.md", "folder/ name.md"],
  ["\\\\server\\share\\repo", "folder\\ name.md", "folder/ name.md"],
  ["/repo", "folder\\name.md", "folder\\name.md"],
  ["/repo", " folder/name.md ", " folder/name.md "],
  ["/repo", "folder\\/name.md", "folder\\/name.md"],
])("project-relative keys preserve server filename characters for %s", (directory, input, expected) => {
  expect(normalizeProjectFilePath(input, directory)).toBe(expected)
})

test("absolute path presentation retains roots, case and filename whitespace", () => {
  expect(pathWithForwardSeparators("C:\\Folder\\ File.md", "C:\\repo")).toBe("C:/Folder/ File.md")
  expect(pathWithForwardSeparators("/Folder/file\\name.md ", "/repo")).toBe("/Folder/file\\name.md ")
})
