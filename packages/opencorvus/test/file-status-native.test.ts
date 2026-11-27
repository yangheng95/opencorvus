import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { Vcs } from "../src/project/vcs"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "default" })
  expect(result.exitCode).toBe(0)
}

async function prepare(directory: string, marker: string) {
  await fs.writeFile(path.join(directory, ".gitattributes"), "*.txt text eol=lf\n")
  await fs.writeFile(path.join(directory, "deleted.txt"), "old first\nold second\n")
  await fs.writeFile(path.join(directory, "modified.txt"), "before\n")
  await git(directory, ["add", ".gitattributes", "deleted.txt", "modified.txt"])
  await git(directory, ["commit", "-m", "Native status baseline"])
  await fs.unlink(path.join(directory, "deleted.txt"))
  await fs.writeFile(path.join(directory, "modified.txt"), marker + "\nsecond\n")
  await fs.writeFile(path.join(directory, "staged.txt"), marker + " staged\n")
  await git(directory, ["add", "staged.txt"])
  await fs.writeFile(path.join(directory, "fresh.txt"), marker + " fresh\n")
  await fs.writeFile(path.join(directory, "empty.txt"), "")
  await fs.writeFile(path.join(directory, "binary.bin"), Buffer.from([0, 10, 65, 10, 0]))
  await fs.writeFile(path.join(directory, "unterminated.txt"), marker + " tail")
}

test("file status reports native physical states and statistics for parallel projects", async () => {
  await using first = await memoryProject("native-file-status-first")
  await using second = await memoryProject("native-file-status-second")
  await prepare(first.path, "FIRST")
  await prepare(second.path, "SECOND")
  const results = await Promise.all([first, second].map((project) => Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const index = await fs.readFile(path.join(project.path, ".git/index"))
      const files = await File.status()
      const diffs = await Vcs.diff("git", { context: 0 })
      expect(await fs.readFile(path.join(project.path, ".git/index"))).toEqual(index)
      expect(await fs.readFile(path.join(project.path, "binary.bin"))).toEqual(Buffer.from([0, 10, 65, 10, 0]))
      return { files, diffs }
    },
  })))
  const expected = [
    { path: "binary.bin", status: "added", added: 0, removed: 0 },
    { path: "deleted.txt", status: "deleted", added: 0, removed: 2 },
    { path: "empty.txt", status: "added", added: 0, removed: 0 },
    { path: "fresh.txt", status: "added", added: 1, removed: 0 },
    { path: "modified.txt", status: "modified", added: 2, removed: 1 },
    { path: "staged.txt", status: "added", added: 1, removed: 0 },
    { path: "unterminated.txt", status: "added", added: 1, removed: 0 },
  ]
  for (const [index, result] of results.entries()) {
    expect(result.files).toEqual(expected)
    expect(result.diffs.map(({ file, status, additions, deletions }) => ({
      path: file, status, added: additions, removed: deletions,
    }))).toEqual(expected)
    expect(result.diffs.find((file) => file.file === "fresh.txt")?.patch).toContain(
      `+${index === 0 ? "FIRST" : "SECOND"} fresh`,
    )
    expect(result.diffs.find((file) => file.file === "modified.txt")?.patch).toContain(
      `+${index === 0 ? "FIRST" : "SECOND"}\n+second`,
    )
  }
}, 60_000)
