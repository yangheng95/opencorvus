import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { Vcs } from "@/project/vcs"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a terminal native watcher reports its diagnostic and releases its complete subscription group", async () => {
  let disposals = 0
  const diagnostics: string[] = []
  const controller = FileWatcher.createSubscriptionController(() => {
    disposals += 1
  })
  const group = FileWatcher.createSubscriptionGroup([controller.subscription], (error) => {
    diagnostics.push(error instanceof Error ? error.message : String(error))
  })

  controller.fail(new Error("git metadata watch ended"))
  await group.dispose()

  expect(diagnostics).toEqual(["git metadata watch ended"])
  expect(disposals).toBe(1)
  expect(group.assertInitialized()).toBe("initialized")
})

test("branch refresh represents repository removal as the undefined branch state", async () => {
  await using project = await memoryProject()
  const gitDirectory = path.join(project.path, ".git")
  const detachedGitDirectory = path.join(project.path, ".git-detached-for-test")

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      expect(await Vcs.branch()).toBeTruthy()
      await fs.rename(gitDirectory, detachedGitDirectory)
      try {
        await Bus.publish(FileWatcher.Event.Updated, {
          file: path.join(gitDirectory, "HEAD"),
          event: "unlink",
        })
        expect(await Vcs.branch()).toBeUndefined()
      } finally {
        await fs.rename(detachedGitDirectory, gitDirectory)
      }
    },
  })
})
