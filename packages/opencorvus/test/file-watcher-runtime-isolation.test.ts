import { afterEach, expect, test } from "bun:test"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { resetMemoryDatabase } from "./fixture/memory"

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
