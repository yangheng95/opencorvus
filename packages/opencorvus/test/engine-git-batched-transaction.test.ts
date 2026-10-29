import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit, ensureGitProjectMetadata } from "@/engine/git"
import { EngineGitProcess } from "@/engine/git-process"
import { EngineGitCheckpointRequestTable, EngineGitCheckpointOutcomeTable } from "@/engine/engine.sql"
import { requireTask } from "@/engine/store"
import { Instance } from "@/project/instance"
import { Database, and, eq } from "@/storage/db"
import { hostGit } from "@/util/git"
import { Worktree } from "@/worktree"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory })
  expect(result.exitCode).toBe(0)
  return result.stdout.toString().trim()
}

async function state(directory: string) {
  const head = await hostGit(["rev-parse", "--verify", "HEAD"], { cwd: directory })
  const ref = await hostGit(["symbolic-ref", "-q", "HEAD"], { cwd: directory })
  const indexPath = await git(directory, ["rev-parse", "--path-format=absolute", "--git-path", "index"])
  return {
    head: { code: head.exitCode, text: head.text().trim() },
    ref: { code: ref.exitCode, text: ref.text().trim() },
    entries: await git(directory, ["ls-files", "--stage", "-z"]),
    index: await fs.readFile(indexPath),
    bytes: await fs.readFile(path.join(directory, "user.txt")),
  }
}

async function setup(directory: string, title: string) {
  await ensureGitProjectMetadata(directory)
  await fs.writeFile(path.join(directory, "user.txt"), "predecessor\n")
  await git(directory, ["add", ".gitignore", ".gitattributes", "user.txt"])
  await git(directory, ["commit", "-m", "user predecessor"])
  return createEngineGitCheckpointTask({ projectPath: directory, title })
}

function outcome(taskID: string, stage: "baseline" | "result") {
  return Database.use(
    (db) =>
      db
        .select({ result: EngineGitCheckpointOutcomeTable.result })
        .from(EngineGitCheckpointRequestTable)
        .innerJoin(
          EngineGitCheckpointOutcomeTable,
          eq(EngineGitCheckpointOutcomeTable.request_id, EngineGitCheckpointRequestTable.id),
        )
        .where(
          and(eq(EngineGitCheckpointRequestTable.task_id, taskID), eq(EngineGitCheckpointRequestTable.stage, stage)),
        )
        .get()!.result,
  )
}

test("final lease failure returns its exact error and preserves the user's repository state", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await setup(project.path, "Predecessor fixture")
      await fs.writeFile(path.join(project.path, "user.txt"), "current work\n")
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Final lease recovery" })
      const before = await state(project.path)
      const original = Worktree.withGitLock
      ;(Worktree as any).withGitLock = (fn: Parameters<typeof Worktree.withGitLock>[0]) =>
        original(async (lease) => {
          await fn(lease)
          throw new Error("project Git lease final verification failed")
        })
      let result: Awaited<ReturnType<typeof EngineGit.prepare>>
      try {
        result = await EngineGit.prepare(requireTask(taskID))
      } finally {
        Worktree.withGitLock = original
      }
      expect(result.error).toContain("project Git lease final verification failed")
      expect(outcome(taskID, "baseline")).toMatchObject({
        error: expect.stringContaining("project Git lease final verification failed"),
      })
      expect(await state(project.path)).toEqual(before)
    },
  })
}, 90_000)

test("a partial nested-ref failure settles its recovery and the next Task retains exact child gitlinks", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await setup(project.path, "Nested predecessor")
      const child = path.join(project.path, "child")
      await fs.mkdir(child)
      await git(child, ["init"])
      await git(child, ["config", "user.name", "OpenCorvus Test"])
      await git(child, ["config", "user.email", "test@example.invalid"])
      await fs.writeFile(path.join(child, "child.txt"), "child predecessor\n")
      await git(child, ["add", "child.txt"])
      await git(child, ["commit", "-m", "child predecessor"])
      await git(project.path, ["add", "child"])
      await git(project.path, ["commit", "-m", "nested predecessor"])
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Nested snapshots" })
      await EngineGit.prepare(requireTask(taskID))
      await fs.writeFile(path.join(child, "child.txt"), "child result\n")
      await fs.writeFile(path.join(project.path, "user.txt"), "root result\n")
      const before = await state(project.path)
      const childHead = await git(child, ["rev-parse", "HEAD"])
      const original = EngineGitProcess.compareAndSwapRef
      EngineGitProcess.compareAndSwapRef = (repository, ref, next, previous, options) =>
        original(
          repository,
          ref,
          next,
          path.resolve(repository.workTree) === path.resolve(project.path) ? "f".repeat(40) : previous,
          options,
        )
      let failed: Awaited<ReturnType<typeof EngineGit.complete>>
      try {
        failed = await EngineGit.complete(requireTask(taskID))
      } finally {
        EngineGitProcess.compareAndSwapRef = original
      }
      expect(failed.error).toContain("cannot lock ref")
      expect(outcome(taskID, "result")).toMatchObject({
        recovery: {
          restored: true,
            createdAnchors: [expect.objectContaining({ path: "child", commit: expect.any(String) })],
        },
      })
      expect(await state(project.path)).toEqual(before)
      expect(await git(child, ["rev-parse", "HEAD"])).toBe(childHead)
      const retryID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Nested successor" })
      const prepared = await EngineGit.prepare(requireTask(retryID))
      const repositories = (prepared.task.metadata as any).git.baseline.repositories
      const root = repositories.find((row: any) => row.path === ".")
      const leaf = repositories.find((row: any) => row.path === "child")
      expect(await git(project.path, ["ls-tree", root.commit, "child"])).toBe(`160000 commit ${leaf.commit}\tchild`)
      expect(await git(child, ["show", `${leaf.commit}:child.txt`])).toBe("child result")
      expect(await git(project.path, ["rev-parse", root.checkpoint_ref])).toBe(root.commit)
      expect(await git(child, ["rev-parse", leaf.checkpoint_ref])).toBe(leaf.commit)
      expect(await state(project.path)).toEqual(before)
    },
  })
}, 120_000)

test("a competing private-ref winner retains its exact commit and external user staging on recovery conflict", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = await setup(project.path, "External winner")
      await EngineGit.prepare(requireTask(taskID))
      const predecessor = await git(project.path, ["rev-parse", "HEAD"])
      const tree = await git(project.path, ["rev-parse", "HEAD^{tree}"])
      const external = await git(project.path, ["commit-tree", tree, "-p", predecessor, "-m", "external owner"])
      await fs.writeFile(path.join(project.path, "user.txt"), "Task working state\n")
      const original = Worktree.withGitLock
      let winnerRef = ""
      let expected: Awaited<ReturnType<typeof state>> | undefined
      ;(Worktree as any).withGitLock = (fn: Parameters<typeof Worktree.withGitLock>[0]) =>
        original(async (lease) => {
          const checkpoint = (await fn(lease)) as any
          winnerRef = checkpoint.checkpoint_ref
          await git(project.path, ["update-ref", "--no-deref", winnerRef, external, checkpoint.commit])
          await git(project.path, ["update-ref", "HEAD", external, predecessor])
          await fs.writeFile(path.join(project.path, "user.txt"), "external staged state\n")
          await git(project.path, ["add", "user.txt"])
          expected = await state(project.path)
          throw new Error("project Git lease final verification failed after external update")
        })
      let result: Awaited<ReturnType<typeof EngineGit.complete>>
      try {
        result = await EngineGit.complete(requireTask(taskID))
      } finally {
        Worktree.withGitLock = original
      }
      expect(result.error).toContain("recovery conflict: checkpoint ref")
      expect(await git(project.path, ["rev-parse", winnerRef])).toBe(external)
      expect(await state(project.path)).toEqual(expected)
    },
  })
}, 90_000)

test.each(["detached", "unborn"] as const)(
  "%s checkout retains its original identity and a readable private snapshot",
  async (mode) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await setup(project.path, "Checkout predecessor")
        if (mode === "detached") await git(project.path, ["checkout", "--detach"])
        else await git(project.path, ["update-ref", "-d", "HEAD"])
        await fs.writeFile(path.join(project.path, "user.txt"), `${mode} working state\n`)
        const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: `${mode} snapshot` })
        const before = await state(project.path)
        const prepared = await EngineGit.prepare(requireTask(taskID))
        const checkpoint = (prepared.task.metadata as any).git.baseline
        expect(await git(project.path, ["show", `${checkpoint.commit}:user.txt`])).toBe(`${mode} working state`)
        expect(await git(project.path, ["rev-parse", checkpoint.checkpoint_ref])).toBe(checkpoint.commit)
        expect(await state(project.path)).toEqual(before)
      },
    })
  },
  90_000,
)
