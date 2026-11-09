import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { readProjectDirectoryTree } from "../../src/file/project-directory-tree"
import { memoryProject } from "../fixture/memory"

test("renders actual project directories in breadth-first order and reports the bounded remainder", async () => {
  await using project = await memoryProject("project-directory-tree")
  for (const relative of [
    "branch/empty-child",
    "empty",
    "filled/nested",
    ".opencorvus-handbook",
    ".opencorvus/runtime-only",
    "ignored",
  ]) {
    await fs.mkdir(path.join(project.path, relative), { recursive: true })
  }
  await fs.writeFile(path.join(project.path, ".gitignore"), "ignored/\n")
  await fs.writeFile(path.join(project.path, "filled", "nested", "note.txt"), "project file\n")
  await fs.writeFile(path.join(project.path, ".opencorvus-handbook", "manual.txt"), "user documentation\n")
  const expected = [
    ".opencorvus-handbook",
    "branch",
    "empty",
    "filled",
    "branch/empty-child",
    "filled/nested",
  ]
  expect(await readProjectDirectoryTree({ cwd: project.path })).toBe(expected.join("\n"))
  expect(await readProjectDirectoryTree({ cwd: project.path, limit: 3 })).toBe(
    [...expected.slice(0, 3), "[3 truncated]"].join("\n"),
  )
  const missing = path.join(project.path, "absent-directory")
  await expect(readProjectDirectoryTree({ cwd: missing })).rejects.toMatchObject({
    code: "ENOENT",
    path: missing,
  })
})
