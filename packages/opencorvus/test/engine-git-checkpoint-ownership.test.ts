import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit, ensureGitProjectMetadata } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { terminalTask, updateTask } from "@/engine/state"
import { Instance } from "@/project/instance"
import { hostGit } from "@/util/git"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory })
  expect(result.exitCode).toBe(0)
  return result.stdout
}

async function userState(directory: string) {
  const index = (await git(directory, ["rev-parse", "--path-format=absolute", "--git-path", "index"])).toString().trim()
  return {
    head: (await git(directory, ["rev-parse", "HEAD"])).toString().trim(),
    ref: (await git(directory, ["symbolic-ref", "HEAD"])).toString().trim(),
    entries: (await git(directory, ["ls-files", "--stage", "-z"])).toString(),
    index: await fs.readFile(index),
    working: await fs.readFile(path.join(directory, "user.txt")),
  }
}

async function captured(directory: string, checkpoint: any, contents: string) {
  expect(structuredClone(checkpoint)).toMatchObject({
    mode: "created_commit",
    commit: expect.any(String),
    checkpoint_ref: expect.stringMatching(/^refs\/opencorvus\/task-checkpoints\//),
    checkpoint_receipt: { outcome: "success" },
  })
  expect((await git(directory, ["rev-parse", checkpoint.checkpoint_ref])).toString().trim()).toBe(checkpoint.commit)
  expect((await git(directory, ["show", `${checkpoint.commit}:user.txt`])).toString()).toBe(contents)
}

test("baseline, acceptance and result retain exact snapshots with the user's staged and working state", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await fs.writeFile(path.join(project.path, ".gitignore"), "declared.log\n")
      await ensureGitProjectMetadata(project.path)
      await fs.writeFile(path.join(project.path, "user.txt"), "original\n")
      await git(project.path, ["add", ".gitattributes", ".gitignore", "user.txt"])
      await git(project.path, ["commit", "-m", "user predecessor"])
      await fs.writeFile(path.join(project.path, "user.txt"), "user staged\n")
      await git(project.path, ["add", "user.txt"])
      await fs.writeFile(path.join(project.path, "user.txt"), "baseline working\n")
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Private checkpoints" })
      const before = await userState(project.path)
      const prepared = await EngineGit.prepare(requireTask(taskID))
      expect(await userState(project.path)).toEqual(before)
      await captured(project.path, (prepared.task.metadata as any).git.baseline, "baseline working\n")
      await fs.writeFile(path.join(project.path, "user.txt"), "result working\n")
      await fs.writeFile(path.join(project.path, "declared.log"), "declared artifact\n")
      const expected = await userState(project.path)
      const accepted = await EngineGit.commitAcceptanceRound({
        task: requireTask(taskID),
        iteration: 1,
        verdict: { verdict: "accepted", summary: "Retain actual declared artifact", rejection_count: 0 },
        declaredChangedFiles: ["declared.log"],
      })
      expect(accepted.mode).toBe("created_commit")
      expect((await git(project.path, ["show", `${accepted.commit}:declared.log`])).toString()).toBe(
        "declared artifact\n",
      )
      expect(await userState(project.path)).toEqual(expected)
      const completed = await EngineGit.complete(requireTask(taskID))
      const result = (completed.task.metadata as any).git.result
      await captured(project.path, result, "result working\n")
      expect((await git(project.path, ["show", `${result.commit}:declared.log`])).toString()).toBe(
        "declared artifact\n",
      )
      expect(await userState(project.path)).toEqual(expected)
    },
  })
}, 120_000)

test("parallel Tasks retain distinct checkpoint anchors within and across Projects", async () => {
  await using left = await memoryProject()
  await using right = await memoryProject()
  const refs = await Promise.all(
    [left, right].map((project, index) =>
      Instance.provide({
        directory: project.path,
        fn: async () => {
          await ensureGitProjectMetadata(project.path)
          await fs.writeFile(path.join(project.path, "user.txt"), `project ${index} baseline\n`)
          await git(project.path, ["add", ".gitattributes", ".gitignore", "user.txt"])
          await git(project.path, ["commit", "-m", "project predecessor"])
          const tasks = await Promise.all(
            [0, 1].map((member) =>
              createEngineGitCheckpointTask({
                projectPath: project.path,
                title: `Project ${index} Task ${member}`,
              }),
            ),
          )
          const before = await userState(project.path)
          const baselines = await Promise.all(tasks.map((taskID) => EngineGit.prepare(requireTask(taskID))))
          expect(await userState(project.path)).toEqual(before)
          await fs.writeFile(path.join(project.path, "user.txt"), `project ${index} result\n`)
          const expected = await userState(project.path)
          const results = await Promise.all(tasks.map((taskID) => EngineGit.complete(requireTask(taskID))))
          expect(await userState(project.path)).toEqual(expected)
          const checkpoints = [
            ...baselines.map((row) => (row.task.metadata as any).git.baseline),
            ...results.map((row) => (row.task.metadata as any).git.result),
          ]
          for (const [position, checkpoint] of checkpoints.entries()) {
            const contents = position < 2 ? `project ${index} baseline\n` : `project ${index} result\n`
            expect((await git(project.path, ["show", `${checkpoint.commit}:user.txt`])).toString()).toBe(contents)
            expect((await git(project.path, ["rev-parse", checkpoint.checkpoint_ref])).toString().trim()).toBe(
              checkpoint.commit,
            )
          }
          return checkpoints.map((checkpoint) => checkpoint.checkpoint_ref as string)
        },
      }),
    ),
  )
  expect(new Set(refs.flat()).size).toBe(8)
}, 180_000)

test("a real failed terminal transition retains readable evidence and the original user staging", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await ensureGitProjectMetadata(project.path)
      await fs.writeFile(path.join(project.path, "user.txt"), "original\n")
      await git(project.path, ["add", ".gitattributes", ".gitignore", "user.txt"])
      await git(project.path, ["commit", "-m", "terminal predecessor"])
      await fs.writeFile(path.join(project.path, "user.txt"), "user staged\n")
      await git(project.path, ["add", "user.txt"])
      await fs.writeFile(path.join(project.path, "user.txt"), "failed working\n")
      const taskID = await createEngineGitCheckpointTask({
        projectPath: project.path,
        title: "Failed terminal snapshot",
      })
      await updateTask(requireTask(taskID), { metadata: { actor: "user" } }, "Establish actual fixture creator")
      const before = await userState(project.path)
      await terminalTask(
        requireTask(taskID),
        { status: "failed", error: "Provider failed after saving work" },
        "Actual failed terminal",
      )
      const task = requireTask(taskID)
      expect(structuredClone(task)).toMatchObject({
        error: "Provider failed after saving work",
        time_completed: expect.any(Number),
      })
      expect(await userState(project.path)).toEqual(before)
      await captured(project.path, EngineGit.terminalEvidenceCheckpoint(task), "failed working\n")
    },
  })
}, 120_000)
