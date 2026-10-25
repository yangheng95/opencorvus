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

        const reused = await Worktree.create({ name, reuseIfValid: true })
        expect({
          directory: reused.directory,
          populated: await Filesystem.exists(path.join(reused.directory, ".gitattributes")),
          ready: await WorktreeReadiness.isReady(reused.directory),
        }).toEqual({
          directory: await fs.realpath(directory),
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

  test("an aliased registered tree recovers its exact branch and reports a later branch rename", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const name = "alias-recovery"
        const created = await Worktree.create({ name })
        const alias = path.join(project.path, "registered-alias")
        await fs.symlink(created.directory, alias, process.platform === "win32" ? "junction" : "dir")
        try {
          expect(await Worktree.recoverRecorded({ directory: alias, branch: created.branch })).toEqual({
            status: "recovered",
            directory: alias,
            branch: created.branch,
          })
          await runGit(created.directory, ["branch", "-m", "operator-preserved-branch"])
          await fs.writeFile(path.join(created.directory, "operator.txt"), "preserved operator bytes\n")
          expect(await Worktree.recoverRecorded({ directory: alias, branch: created.branch })).toEqual({
            status: "unrecoverable",
            reason: `Worktree branch identity changed: expected ${created.branch}, found operator-preserved-branch; existing bytes are preserved`,
          })
          const reuse = await Worktree.create({ name, reuseIfValid: true }).catch((error) => error)
          expect(reuse).toMatchObject({
            name: "WorktreeCreateFailedError",
            data: {
              message: `Worktree branch identity changed: expected ${created.branch}, found operator-preserved-branch. The existing tree is preserved.`,
            },
          })
          expect(await fs.readFile(path.join(alias, "operator.txt"), "utf8")).toBe("preserved operator bytes\n")
        } finally {
          if (process.platform === "win32") await fs.rmdir(alias)
          else await fs.unlink(alias)
        }
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
        // Both project and extra startup scripts must complete successfully.
        await Project.update({ projectID: Instance.project.id, commands: { start: "exit 1" } })
        const failure = await Worktree.create({ name }).catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(Worktree.StartCommandFailedError)

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
