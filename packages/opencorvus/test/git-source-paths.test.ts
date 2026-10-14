import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { gitSourcePaths } from "../src/util/git-source-paths"
import { hostGit } from "../src/util/git"
import { EngineGitProcess } from "../src/engine/git-process"
import { executionCapsuleSourceTreeSnapshot } from "../src/execution-capsule/tree-digest"
import { tmpdir } from "./fixture/fixture"

async function git(root: string, args: string[]) {
  const result = await hostGit(args, { cwd: root, timeoutProfile: "default" })
  expect(result.exitCode).toBe(0)
  return result.stdout
}

async function link(target: string, filename: string) {
  await fs.symlink(target, filename, process.platform === "win32" ? "junction" : "dir")
}

test("source entries preserve the Git index and real nested ignore/negation rules", async () => {
  await using root = await tmpdir({ git: true })
  await fs.writeFile(path.join(root.path, "tracked.txt"), "tracked\n")
  await fs.writeFile(path.join(root.path, "removed.txt"), "removed\n")
  await git(root.path, ["add", "tracked.txt", "removed.txt"])
  await git(root.path, ["mv", "tracked.txt", "renamed.txt"])
  await fs.unlink(path.join(root.path, "removed.txt"))
  await fs.mkdir(path.join(root.path, "scratch"))
  await fs.mkdir(path.join(root.path, "nested"))
  await fs.mkdir(path.join(root.path, "empty"))
  await fs.writeFile(path.join(root.path, ".gitignore"), "scratch/*\n!scratch/keep.md\nnested/*.tmp\n")
  await fs.writeFile(path.join(root.path, "nested/.gitignore"), "!retained.tmp\n")
  for (const filename of [
    "scratch/keep.md",
    "scratch/drop.md",
    "nested/retained.tmp",
    "nested/drop.tmp",
    "space 汉字 [a] #!.txt",
  ]) {
    await fs.writeFile(path.join(root.path, filename), filename + "\n")
  }
  const result = await gitSourcePaths(root.path)
  expect(result).toEqual({
    tracked: ["removed.txt", "renamed.txt"],
    untracked: [".gitignore", "nested/.gitignore", "nested/retained.tmp", "scratch/keep.md", "space 汉字 [a] #!.txt"],
    paths: [
      ".gitignore",
      "nested/.gitignore",
      "nested/retained.tmp",
      "removed.txt",
      "renamed.txt",
      "scratch/keep.md",
      "space 汉字 [a] #!.txt",
    ],
  })
  expect(await EngineGitProcess.sourceSnapshotPaths(root.path)).toEqual(result.paths)
}, 60_000)

test("healthy, self, ancestor, broken and outside directory links are terminal entries", async () => {
  await using root = await tmpdir({ git: true })
  await using outside = await tmpdir()
  await fs.mkdir(path.join(root.path, "data"))
  await fs.mkdir(path.join(root.path, "aliases"))
  await fs.writeFile(path.join(root.path, "data/note.txt"), "one physical file\n")
  await fs.writeFile(path.join(outside.path, "private.txt"), "outside\n")
  await link(path.join(root.path, "data"), path.join(root.path, "healthy"))
  await link(root.path, path.join(root.path, "root-link"))
  await link(root.path, path.join(root.path, "aliases/root-back"))
  await link(outside.path, path.join(root.path, "outside"))
  await link(path.join(root.path, "missing"), path.join(root.path, "broken"))
  const expected = ["aliases/root-back", "broken", "data/note.txt", "healthy", "outside", "root-link"]
  const [first, second] = await Promise.all([gitSourcePaths(root.path), gitSourcePaths(root.path)])
  expect({ first: first.paths, second: second.paths, untracked: first.untracked }).toEqual({
    first: expected,
    second: expected,
    untracked: expected,
  })
  const snapshot = await executionCapsuleSourceTreeSnapshot(root.path)
  expect(snapshot.files.map((file) => file.path)).toEqual(expected)
  const contents = new Map(snapshot.files.map((file) => [file.path, Buffer.from(file.bytes_base64, "base64")]))
  expect(contents.get("data/note.txt")).toEqual(Buffer.from("one physical file\n"))
  for (const filename of expected.filter((value) => value !== "data/note.txt")) {
    expect(contents.get(filename)).toEqual(await fs.readlink(path.join(root.path, filename), { encoding: "buffer" }))
  }
}, 60_000)

test("Engine repository enumeration keeps external git-dir input paths and ignore authority", async () => {
  await using root = await tmpdir()
  await using storage = await tmpdir()
  const gitDir = path.join(storage.path, "private.git")
  await git(root.path, ["init", "--quiet", `--separate-git-dir=${gitDir}`])
  await fs.mkdir(path.join(root.path, "data"))
  await fs.writeFile(path.join(root.path, ".gitignore"), "data/*.tmp\n!data/keep.tmp\n")
  await fs.writeFile(path.join(root.path, "data/keep.tmp"), "kept\n")
  await fs.writeFile(path.join(root.path, "data/drop.tmp"), "ignored\n")
  expect(await EngineGitProcess.snapshotPaths({ workTree: root.path, gitDir })).toEqual([".gitignore", "data/keep.tmp"])
}, 60_000)

test("nested repositories retain a parent entry and independently enumerate their own source", async () => {
  await using root = await tmpdir({ git: true })
  const nested = path.join(root.path, "nested")
  await fs.mkdir(nested)
  await git(nested, ["init", "--quiet"])
  await fs.writeFile(path.join(nested, "source.txt"), "nested source\n")
  expect((await gitSourcePaths(root.path)).paths).toEqual(["nested"])
  expect((await gitSourcePaths(nested)).paths).toEqual(["source.txt"])
  expect((await executionCapsuleSourceTreeSnapshot(root.path)).files).toEqual([
    { path: "nested/source.txt", bytes_base64: Buffer.from("nested source\n").toString("base64") },
  ])
}, 60_000)

test("an indexed descendant through a replacement link returns the exact identity error", async () => {
  await using root = await tmpdir({ git: true })
  await fs.mkdir(path.join(root.path, "tracked"))
  await fs.writeFile(path.join(root.path, "tracked/note.txt"), "tracked source\n")
  await git(root.path, ["add", "tracked/note.txt"])
  await fs.rename(path.join(root.path, "tracked"), path.join(root.path, "retained"))
  await link(path.join(root.path, "retained"), path.join(root.path, "tracked"))
  await expect(gitSourcePaths(root.path)).rejects.toMatchObject({
    name: "GitSourceEnumerationError",
    data: {
      reason: "linked_ancestor",
      path: "tracked/note.txt",
      message: "Git source path tracked/note.txt crosses link tracked",
    },
  })
}, 60_000)
