import { expect, test } from "bun:test"
import { normalizeProjectFilePath, pathWithForwardSeparators, resolveDocumentFilePath } from "../src/utils/server-path"
import { projectDirectoryKey } from "../src/utils/project-directory"

test.each([
  ["C:/repo", "notes/guide.md", "photo.png", "notes/photo.png"],
  ["C:/repo", "notes/guide.md", "../report.md", "report.md"],
  ["/repo", "notes/guide.md", "./photo.png", "notes/photo.png"],
  ["/repo", "notes/guide.md", "../notes/photo.png", "notes/photo.png"],
  ["/repo", "notes/guide.md", "file\\name.png", "notes/file\\name.png"],
  ["C:/repo", "guide.md", "C:/Other/Photo.png", "C:/Other/Photo.png"],
])("document resources resolve %s / %s / %s", (directory, path, reference, expected) => {
  expect(resolveDocumentFilePath(reference, { directory, path })).toBe(expected)
})

test("absolute source documents retain the server parent and filename identity", () => {
  expect(resolveDocumentFilePath("../Photo.PNG", {
    directory: "C:/repo", path: "C:\\sources\\docs\\guide.md", sourceAbsolutePath: "C:\\sources\\docs\\guide.md",
  })).toBe("C:/sources/Photo.PNG")
  expect(resolveDocumentFilePath("image\\name.png", {
    directory: "/repo", path: "/sources/guide.md", sourceAbsolutePath: "/sources/guide.md",
  })).toBe("/sources/image\\name.png")
})

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

test.each([
  ["/repo", "./README.md", "README.md"],
  ["/repo", "folder/../README.md", "README.md"],
  ["/repo", "missing/../README.md", "README.md"],
  ["/repo", "../repo/README.md", "README.md"],
  ["/repo", "../../repo/README.md", "README.md"],
  ["/repo", "../../../outside.md", "../outside.md"],
  ["/repo", "../outside.md", "../outside.md"],
  ["/", "../../README.md", "README.md"],
  ["C:/repo", ".\\README.md", "README.md"],
  ["C:/repo", "folder\\..\\README.md", "README.md"],
  ["C:/repo", "..\\repo\\README.md", "README.md"],
  ["C:/Repo", "../repo/Note.MD", "Note.MD"],
  ["C:/Repo", "../../REPO/Note.MD", "Note.MD"],
  ["C:/repo", "..\\..\\repo\\README.md", "README.md"],
  ["C:/repo", "..\\..\\..\\outside.md", "../outside.md"],
  ["C:/", "../../README.md", "README.md"],
  ["//host/share/repo", "../repo/README.md", "README.md"],
  ["//Host/Share/Repo", "../repo/Note.MD", "Note.MD"],
  ["//Host/Share/Repo", "../../REPO/Note.MD", "Note.MD"],
  ["//host/share/repo", "../../repo/README.md", "README.md"],
  ["//host/share/repo", "../../../outside.md", "../outside.md"],
  ["//host/share", "../../README.md", "README.md"],
  ["/repo", "./资料/../ Note.md ", " Note.md "],
  ["/repo", "./file\\name.md ", "file\\name.md "],
  ["/repo", "folder\\/../file\\name.md", "file\\name.md"],
  ["/repo", "./ . /file.md", " . /file.md"],
  ["/repo", "./link/file.md", "link/file.md"],
  ["/repo", "./README.MD", "README.MD"],
])("project keys resolve server lexical location for %s / %s", (directory, input, expected) => {
  expect(normalizeProjectFilePath(input, directory)).toBe(expected)
})

test.each([
  ["  C:\\Repo\\sub\\..\\ ", "c:/repo"],
  ["C:Repo/./sub/..", "c:repo"],
  ["C:../Repo", "c:../repo"],
  ["C:/../../../Repo", "c:/repo"],
  ["//HOST/Share/Repo/../../..", "//host/share"],
  ["/Repo/sub/..", "/Repo"],
  ["/Repo\\sub/..", "/Repo"],
  ["../Repo/sub/..", "../Repo"],
  ["/", "/"],
  ["C:/", "c:/"],
  ["C:", "c:"],
  ["", "__opencorvus_unassigned_project__"],
])("project directory identity retains its existing policy for %s", (input, expected) => {
  expect(projectDirectoryKey(input)).toBe(expected)
})
