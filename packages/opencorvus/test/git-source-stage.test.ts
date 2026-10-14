import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { hostGit } from "../src/util/git"
import { stageGitSourceEntries } from "../src/util/git-source-stage"
import { Vcs } from "../src/project/vcs"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { pinBuildObservationTree } from "../src/build/agent"
import { Snapshot } from "../src/snapshot"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { gitSourceStatus } from "../src/util/git-source-links"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function git(root: string, args: string[]) {
  const result = await hostGit(args, { cwd: root })
  expect(result.exitCode).toBe(0)
  return result
}

async function cyclic(root: string) {
  await fs.appendFile(path.join(root, ".git/info/exclude"), "\n.opencorvus/\n.gitattributes\n.gitignore\n")
  await fs.mkdir(path.join(root, "data"))
  await fs.mkdir(path.join(root, "aliases"))
  await fs.writeFile(path.join(root, "data/note.txt"), "finite source\n")
  for (const pathname of ["root-link", "aliases/root-back"])
    await fs.symlink(root, path.join(root, pathname), process.platform === "win32" ? "junction" : "dir")
}

test("real VCS commit stages each cyclic link once and reports the committed source clean", async () => {
  await using project = await memoryProject("stage-cyclic")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const committed = await Vcs.commit("Preserve actual source entries")
      expect(committed.info).toMatchObject({
        clean: true,
        dirty: false,
        staged: 0,
        modified: 0,
        untracked: 0,
        conflicts: 0,
      })
      const index = (await git(project.path, ["ls-files", "--stage", "-z"])).text().split("\0").filter(Boolean)
      expect(index.map((record) => [record.slice(0, 6), record.slice(record.indexOf("\t") + 1)])).toEqual([
        ["100644", ".opencorvus-test-project-identity"],
        ["120000", "aliases/root-back"],
        ["100644", "data/note.txt"],
        ["120000", "root-link"],
      ])
      for (const pathname of ["root-link", "aliases/root-back"])
        expect((await git(project.path, ["show", `HEAD:${pathname}`])).stdout).toEqual(
          await fs.readlink(path.join(project.path, pathname), { encoding: "buffer" }),
        )
      expect(await Vcs.diff("git")).toEqual([])
      expect(await File.status()).toEqual([])
      expect((await gitSourceStatus({ cwd: project.path })).text()).toBe("")
    },
  })
}, 60_000)

test("the real Snapshot private Git directory captures cyclic link identities", async () => {
  await using project = await memoryProject("stage-snapshot")
  await cyclic(project.path)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const tree = await Snapshot.trackRequired()
      const gitdir = ProjectRuntimePaths.snapshotCacheRoot(Instance.project.worktree, Instance.project.id)
      const result = await git(project.path, ["--git-dir", gitdir, "ls-tree", "-r", "--name-only", tree])
      expect(result.text().split("\n").filter(Boolean)).toEqual([
        ".opencorvus-test-project-identity",
        "aliases/root-back",
        "data/note.txt",
        "root-link",
      ])
      expect((await git(project.path, ["--git-dir", gitdir, "show", `${tree}:root-link`])).stdout).toEqual(
        await fs.readlink(path.join(project.path, "root-link"), { encoding: "buffer" }),
      )
    },
  })
}, 60_000)

test("real type transitions retain their file mode, content and clean commit", async () => {
  await using project = await memoryProject("stage-type-transition")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Vcs.commit("Link baseline")
      await fs.unlink(path.join(project.path, "root-link"))
      await fs.writeFile(path.join(project.path, "root-link"), "ordinary replacement\n")
      expect(
        (await Vcs.diff("git")).map(({ file, status, additions, deletions }) => ({
          file,
          status,
          additions,
          deletions,
        })),
      ).toEqual([{ file: "root-link", status: "modified", additions: 1, deletions: 1 }])
      expect((await Vcs.commit("Actual file type")).info.clean).toBe(true)
      expect((await git(project.path, ["ls-tree", "HEAD", "root-link"])).text().slice(0, 11)).toBe("100644 blob")
      expect((await git(project.path, ["show", "HEAD:root-link"])).text()).toBe("ordinary replacement\n")
    },
  })
}, 60_000)

test("same-byte file and directory replacements follow actual physical entry types", async () => {
  await using project = await memoryProject("stage-same-bytes")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Vcs.commit("Physical baseline")
      const target = await fs.readlink(path.join(project.path, "root-link"), { encoding: "buffer" })
      await fs.unlink(path.join(project.path, "root-link"))
      await fs.writeFile(path.join(project.path, "root-link"), target)
      expect((await Vcs.info()).modified).toBe(1)
      expect((await Vcs.commit("Same bytes, actual file")).info.clean).toBe(true)
      expect((await git(project.path, ["ls-tree", "HEAD", "root-link"])).text().slice(0, 11)).toBe("100644 blob")
      expect((await git(project.path, ["show", "HEAD:root-link"])).stdout).toEqual(target)
      await fs.unlink(path.join(project.path, "root-link"))
      await fs.mkdir(path.join(project.path, "root-link"))
      await fs.writeFile(path.join(project.path, "root-link/note.txt"), "directory entry\n")
      await fs.symlink(
        project.path,
        path.join(project.path, "root-link/back"),
        process.platform === "win32" ? "junction" : "dir",
      )
      const committed = await Vcs.commit("Finite directory replacement")
      console.log(
        "physical-directory-replacement",
        JSON.stringify({
          info: committed.info,
          status: (await git(project.path, ["status", "--porcelain=v1", "-z", "--untracked-files=no"])).text(),
          index: (await git(project.path, ["ls-files", "--stage", "-z"])).text(),
          diff: await Vcs.diff("git"),
          files: await File.status(),
        }),
      )
      expect(committed.info.clean).toBe(true)
      expect(
        (await git(project.path, ["ls-tree", "-r", "--name-only", "HEAD"])).text().split("\n").filter(Boolean),
      ).toEqual([
        ".opencorvus-test-project-identity",
        "aliases/root-back",
        "data/note.txt",
        "root-link/back",
        "root-link/note.txt",
      ])
      expect((await git(project.path, ["show", "HEAD:root-link/back"])).stdout).toEqual(target)
    },
  })
}, 60_000)

test("staged link renames preserve the index rename and actual clean working entry", async () => {
  await using project = await memoryProject("stage-link-rename")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Vcs.commit("Rename baseline")
      await fs.rename(path.join(project.path, "root-link"), path.join(project.path, "renamed-link"))
      await stageGitSourceEntries({ cwd: project.path })
      expect(await Vcs.info()).toMatchObject({ staged: 1, modified: 0, dirty: true, conflicts: 0 })
      expect((await gitSourceStatus({ cwd: project.path }, "lines")).text()).toBe("R  root-link -> renamed-link\n")
      expect((await Vcs.commit("Renamed physical entry")).info.clean).toBe(true)
    },
  })
}, 60_000)

test("a real unmerged link index is resolved to the actual current entry bytes", async () => {
  await using project = await memoryProject("stage-link-conflict")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Vcs.commit("Conflict baseline")
      const blob = (await git(project.path, ["rev-parse", "HEAD:root-link"])).text().trim()
      const records =
        `0 ${"0".repeat(blob.length)}\troot-link\0` +
        [1, 2, 3].map((stage) => `120000 ${blob} ${stage}\troot-link\0`).join("")
      const installed = await hostGit(["update-index", "-z", "--index-info"], {
        cwd: project.path,
        input: (async function* () {
          yield Buffer.from(records)
        })(),
      })
      expect(installed.exitCode).toBe(0)
      expect((await Vcs.info()).conflicts).toBe(1)
      await stageGitSourceEntries({ cwd: project.path })
      expect((await git(project.path, ["ls-files", "--stage", "-z", "--", "root-link"])).text()).toBe(
        `120000 ${blob} 0\troot-link\0`,
      )
      expect(await Vcs.info()).toMatchObject({ clean: true, dirty: false, conflicts: 0, staged: 0, modified: 0 })
    },
  })
}, 60_000)

test("native nested repositories and uninitialized gitlinks retain their parent commit identities", async () => {
  await using project = await memoryProject("stage-gitlinks")
  const child = path.join(project.path, "child")
  await fs.mkdir(child)
  await git(child, ["init"])
  await git(child, ["config", "user.name", "OpenCorvus Test"])
  await git(child, ["config", "user.email", "source-test@example.invalid"])
  await fs.writeFile(path.join(child, "note.txt"), "child source\n")
  await git(child, ["add", "note.txt"])
  await git(child, ["commit", "-m", "Child identity"])
  const commit = (await git(child, ["rev-parse", "HEAD"])).text().trim()
  await stageGitSourceEntries({ cwd: project.path })
  await fs.mkdir(path.join(project.path, "uninitialized"))
  await git(project.path, ["update-index", "--add", "--cacheinfo", `160000,${commit},uninitialized`])
  await stageGitSourceEntries({ cwd: project.path })
  expect((await git(project.path, ["ls-files", "--stage", "-z", "--", "child", "uninitialized"])).text()).toBe(
    `160000 ${commit} 0\tchild\0` + `160000 ${commit} 0\tuninitialized\0`,
  )
}, 60_000)

test("link target edits and deletion produce actual link patches and a new clean commit", async () => {
  await using project = await memoryProject("stage-link-edit")
  await cyclic(project.path)
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Vcs.commit("Link baseline")
      await fs.unlink(path.join(project.path, "root-link"))
      await fs.symlink(
        path.join(project.path, "data"),
        path.join(project.path, "root-link"),
        process.platform === "win32" ? "junction" : "dir",
      )
      await fs.unlink(path.join(project.path, "aliases/root-back"))
      const diff = await Vcs.diff("git", { context: 0 })
      expect(diff.map(({ file, status, additions, deletions }) => ({ file, status, additions, deletions }))).toEqual([
        { file: "aliases/root-back", status: "deleted", additions: 0, deletions: 1 },
        { file: "root-link", status: "modified", additions: 1, deletions: 1 },
      ])
      expect(diff[1]!.patch!.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"))).toEqual([
        "+" + (await fs.readlink(path.join(project.path, "root-link"))),
      ])
      expect((await Vcs.info()).modified).toBe(2)
      expect(
        (await File.status()).map(({ path, status, added, removed }) => ({ path, status, added, removed })),
      ).toEqual([
        { path: path.join("aliases", "root-back"), status: "deleted", added: 0, removed: 1 },
        { path: "root-link", status: "modified", added: 1, removed: 1 },
      ])
      expect((await Vcs.commit("Updated entry identities")).info.clean).toBe(true)
    },
  })
}, 60_000)

test("native filters, literal path names, deletion and subdirectory index names stay correct", async () => {
  await using project = await memoryProject("stage-native-files")
  await fs.writeFile(path.join(project.path, ".gitattributes"), "*.txt text eol=lf\n")
  await fs.writeFile(path.join(project.path, "old.txt"), "old\n")
  await stageGitSourceEntries({ cwd: project.path })
  await git(project.path, ["commit", "-m", "Native file baseline"])
  await fs.unlink(path.join(project.path, "old.txt"))
  await fs.mkdir(path.join(project.path, " sub"))
  const filename = "[a] #!.txt"
  await fs.writeFile(path.join(project.path, " sub", filename), "native\r\nfilter\r\n")
  await fs.symlink(
    project.path,
    path.join(project.path, " sub", "alias"),
    process.platform === "win32" ? "junction" : "dir",
  )
  await stageGitSourceEntries({ cwd: path.join(project.path, " sub") })
  const blob = (await git(project.path, ["show", `: sub/${filename}`])).text()
  expect(blob).toBe("native\nfilter\n")
  expect((await git(project.path, ["show", ": sub/alias"])).stdout).toEqual(
    await fs.readlink(path.join(project.path, " sub/alias"), { encoding: "buffer" }),
  )
  await stageGitSourceEntries({ cwd: project.path })
  expect((await git(project.path, ["diff", "--cached", "--name-status", "-z"])).text()).toBe(
    `A\0 sub/${filename}\0A\0 sub/alias\0D\0old.txt\0`,
  )
}, 60_000)

test("an actual concurrent canonical index write returns the predecessor conflict and preserves that index", async () => {
  await using project = await memoryProject("stage-index-race")
  await fs.writeFile(path.join(project.path, "new.txt"), "source\n")
  let changed = false
  let error: unknown
  try {
    await stageGitSourceEntries({
      cwd: project.path,
      run: async (args, opts) => {
        const result = await hostGit(args, opts)
        if (args.includes("add") && opts.env?.GIT_INDEX_FILE && !changed) {
          changed = true
          await git(project.path, ["add", "new.txt"])
        }
        return result
      },
    })
  } catch (cause) {
    error = cause
  }
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe(`Canonical Git index changed during checkpoint preparation: ${project.path}`)
  expect((await git(project.path, ["show", ":new.txt"])).text()).toBe("source\n")
  expect((await git(project.path, ["diff", "--cached", "--name-status", "-z"])).text()).toBe("A\0new.txt\0")
}, 60_000)

test("parallel build observations preserve each cyclic project link and the user index", async () => {
  await using first = await memoryProject("stage-pin-first")
  await using second = await memoryProject("stage-pin-second")
  await Promise.all(
    [first, second].map(async (project, index) => {
      await cyclic(project.path)
      const before = await fs.readFile(path.join(project.path, ".git/index"))
      const tree = await pinBuildObservationTree({
        worktreeDir: project.path,
        refName: `refs/opencorvus/observations/test-${index}`,
      })
      expect(
        (await git(project.path, ["ls-tree", "-r", "--name-only", tree])).text().split("\n").filter(Boolean),
      ).toEqual([".opencorvus-test-project-identity", "aliases/root-back", "data/note.txt", "root-link"])
      expect((await git(project.path, ["show", `${tree}:root-link`])).stdout).toEqual(
        await fs.readlink(path.join(project.path, "root-link"), { encoding: "buffer" }),
      )
      expect(await fs.readFile(path.join(project.path, ".git/index"))).toEqual(before)
    }),
  )
}, 60_000)
