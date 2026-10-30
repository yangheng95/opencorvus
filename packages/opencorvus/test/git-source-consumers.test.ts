import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js"
import { hostGit } from "../src/util/git"
import { Vcs } from "../src/project/vcs"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { buildTaskProjectArchive } from "../src/engine/task-project-archive"
import { EngineGit } from "../src/engine/git"
import { requireTask } from "../src/engine/store"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function prepare(root: string, branch: string) {
  const rename = await hostGit(["branch", "-m", branch], { cwd: root })
  expect(rename.exitCode).toBe(0)
  await fs.appendFile(path.join(root, ".git/info/exclude"), "\n.opencorvus/\n.gitattributes\n.gitignore\n")
  await fs.mkdir(path.join(root, "data"))
  await fs.mkdir(path.join(root, "aliases"))
  await fs.writeFile(path.join(root, "data/note.txt"), branch + "\n")
  await fs.symlink(root, path.join(root, "root-link"), process.platform === "win32" ? "junction" : "dir")
  await fs.symlink(root, path.join(root, "aliases/root-back"), process.platform === "win32" ? "junction" : "dir")
}

test("parallel VCS reads return exact physical entries for each cyclic project", async () => {
  await using first = await memoryProject("entry-source-first")
  await using second = await memoryProject("entry-source-second")
  await prepare(first.path, "entry-first")
  await prepare(second.path, "entry-second")
  const results = await Promise.all(
    [first, second].map((project) =>
      Instance.provideProjectIdentity({
        directory: project.path,
        fn: async () => {
          const info = await Vcs.info()
          const diff = await Vcs.diff("git", { context: 0 })
          const status = await File.status()
          return {
            branch: info.branch,
            untracked: info.untracked,
            dirty: info.dirty,
            diff: diff.map(({ file, status, additions, deletions }) => ({ file, status, additions, deletions })),
            status: status.map(({ path, status, added, removed }) => ({ path, status, added, removed })),
            linkText: diff
              .find(({ file }) => file === "root-link")
              ?.patch?.split("\n")
              .find((line) => line.startsWith("+") && !line.startsWith("+++"))
              ?.slice(1),
          }
        },
      }),
    ),
  )
  for (const [index, branch] of ["entry-first", "entry-second"].entries()) {
    expect(results[index]).toEqual({
      branch,
      untracked: 3,
      dirty: true,
      diff: ["aliases/root-back", "data/note.txt", "root-link"].map((file) => ({
        file,
        status: "added",
        additions: 1,
        deletions: 0,
      })),
      status: ["aliases/root-back", "data/note.txt", "root-link"].map((pathname) => ({
        path: path.join(...pathname.split("/")),
        status: "added",
        added: pathname === "data/note.txt" ? 2 : 1,
        removed: 0,
      })),
      linkText: await fs.readlink(path.join(index === 0 ? first.path : second.path, "root-link")),
    })
  }
}, 60_000)

test("a real Task ZIP reports the number of ordinary project files actually exported", async () => {
  await using project = await memoryProject("entry-source-archive")
  await prepare(project.path, "entry-archive")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = await createEngineGitCheckpointTask({
        projectPath: project.path,
        title: "Physical source archive",
      })
      const archive = await buildTaskProjectArchive({ taskID, transcript: [] })
      const reader = new ZipReader(new BlobReader(new Blob([archive.bytes])))
      try {
        const entries = await reader.getEntries()
        const source = entries.filter((entry) => entry.filename.startsWith("project/"))
        expect({ count: archive.fileCount, files: source.map((entry) => entry.filename) }).toEqual({
          count: 2,
          files: ["project/.opencorvus-test-project-identity", "project/data/note.txt"],
        })
        const note = source.find((entry) => entry.filename === "project/data/note.txt")!
        expect(await note.getData!(new TextWriter())).toBe("entry-archive\n")
        const manifest = entries.find((entry) => entry.filename.endsWith("/manifest.json"))!
        expect(JSON.parse(await manifest.getData!(new TextWriter()))).toMatchObject({ taskID, projectFileCount: 2 })
      } finally {
        await reader.close()
      }
    },
  })
}, 60_000)

test("Task baseline and result checkpoints preserve terminal link blobs and current file bytes", async () => {
  await using project = await memoryProject("entry-source-checkpoint")
  await prepare(project.path, "entry-checkpoint")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const originalIndex = await hostGit(["ls-files", "--stage", "-z"], { cwd: project.path })
      expect(originalIndex.exitCode).toBe(0)
      const taskID = await createEngineGitCheckpointTask({
        projectPath: project.path,
        title: "Terminal link checkpoint",
      })
      const baseline = await EngineGit.prepare(requireTask(taskID))
      const first = (baseline.task.metadata.git as { baseline: { commit: string } }).baseline.commit
      expect(baseline.task.id).toBe(taskID)
      expect(typeof first).toBe("string")
      const target = await fs.readlink(path.join(project.path, "root-link"), { encoding: "buffer" })
      const tree = await hostGit(["ls-tree", "-r", "-z", first], { cwd: project.path })
      console.log(
        "terminal-link-checkpoint-tree",
        JSON.stringify({
          commit: first,
          code: tree.exitCode,
          records: tree.stdout.toString().split("\0").filter(Boolean),
          targetBase64: target.toString("base64"),
        }),
      )
      for (const filename of ["root-link", "aliases/root-back"]) {
        const result = await hostGit(["show", `${first}:${filename}`], { cwd: project.path })
        console.log(
          "terminal-link-checkpoint-blob",
          JSON.stringify({
            filename,
            code: result.exitCode,
            stdoutBase64: result.stdout.toString("base64"),
            stderr: result.stderr.toString(),
          }),
        )
        expect({ code: result.exitCode, bytes: result.stdout }).toEqual({ code: 0, bytes: target })
      }
      await fs.writeFile(path.join(project.path, "data/note.txt"), "checkpoint result\n")
      const completed = await EngineGit.complete(requireTask(taskID))
      const second = (completed.task.metadata.git as { result: { commit: string } }).result.commit
      expect(completed.task.id).toBe(taskID)
      expect(typeof second).toBe("string")
      const result = await hostGit(["show", `${second}:data/note.txt`], { cwd: project.path })
      expect({ code: result.exitCode, bytes: result.stdout }).toEqual({
        code: 0,
        bytes: Buffer.from("checkpoint result\n"),
      })
      const index = await hostGit(["ls-files", "--stage", "-z"], { cwd: project.path })
      expect({ code: index.exitCode, bytes: index.stdout }).toEqual({ code: 0, bytes: originalIndex.stdout })
    },
  })
}, 120_000)
