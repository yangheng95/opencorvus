import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ensureGitProjectMetadata } from "../src/engine/git"
import { Instance } from "../src/project/instance"
import { Project } from "../src/project/project"
import { Worktree } from "../src/worktree"
import { WorktreeReadiness } from "../src/worktree/readiness"
import { Filesystem } from "../src/util/filesystem"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function runGit(directory: string, args: string[]) {
  const process = Bun.spawn(["git", ...args], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `git ${args.join(" ")} failed`)
  return { stdout, stderr }
}

async function freezeMetadata(directory: string) {
  await runGit(directory, ["config", "core.autocrlf", "true"])
  await ensureGitProjectMetadata(directory)
  await runGit(directory, ["add", ".gitattributes", ".gitignore"])
  await runGit(directory, ["commit", "-m", "freeze project metadata"])
}

describe("worktree readiness receipts", () => {
  test("a registered but unpopulated tree is resumed to readiness instead of being reused bare", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)

        // The exact durable state a create killed after `git worktree add
        // --no-checkout` leaves behind: a registered tree that passes
        // isValid, with nothing checked out and no ready receipt.
        const name = "resume-probe"
        const root = Worktree.worktreesRoot(project.path)
        await fs.mkdir(root, { recursive: true })
        const directory = path.join(root, name)
        await runGit(project.path, ["worktree", "add", "--no-checkout", "-b", `opencorvus/${name}`, directory])
        expect(await Filesystem.exists(path.join(directory, ".gitattributes"))).toBe(false)

        const reused = await Worktree.create({ name, reuseIfValid: true })
        expect({
          directory: reused.directory,
          populated: await Filesystem.exists(path.join(reused.directory, ".gitattributes")),
          ready: await WorktreeReadiness.isReady(reused.directory),
        }).toEqual({
          directory,
          populated: true,
          ready: true,
        })
      },
    })
  }, 120_000)

  test("a completed create commits the ready receipt and reuse honors it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const name = "receipt-probe"
        const created = await Worktree.create({ name })
        expect(await WorktreeReadiness.isReady(created.directory)).toBe(true)

        const reused = await Worktree.create({ name, reuseIfValid: true })
        expect({
          directory: reused.directory,
          ready: await WorktreeReadiness.isReady(reused.directory),
        }).toEqual({ directory: created.directory, ready: true })
      },
    })
  }, 120_000)

  test("a failed population converges: the retry creates a fresh ready tree", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const name = "converge-probe"
        // Only the project start command can fail population; the extra
        // worktree script is fire-and-forget by contract.
        await Project.update({ projectID: Instance.project.id, commands: { start: "exit 1" } })
        await expect(Worktree.create({ name })).rejects.toThrow()

        await Project.update({ projectID: Instance.project.id, commands: { start: "" } })
        const retried = await Worktree.create({ name })
        expect({
          populated: await Filesystem.exists(path.join(retried.directory, ".gitattributes")),
          ready: await WorktreeReadiness.isReady(retried.directory),
        }).toEqual({ populated: true, ready: true })
      },
    })
  }, 120_000)
})
