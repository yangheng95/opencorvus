import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Truncate } from "@/tool/truncation"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

test("retention settles expired outputs in both current runtime ownership roots", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskOutput = path.join(
        ProjectRuntimePaths.toolOutputDir(
          project.path,
          Identifier.ascending("task"),
          Identifier.ascending("session"),
        ),
        Identifier.ascending("tool"),
      )
      const conversationOutput = path.join(
        ProjectRuntimePaths.rootSessionToolOutputDir(project.path, Identifier.ascending("session")),
        Identifier.ascending("tool"),
      )
      for (const output of [taskOutput, conversationOutput]) {
        await fs.mkdir(path.dirname(output), { recursive: true })
        await fs.writeFile(output, "expired tool output")
        const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000)
        await fs.utimes(output, expired, expired)
      }

      const receipt = await Truncate.cleanup()

      expect(receipt.scanned).toBeGreaterThanOrEqual(2)
      expect(receipt.removed).toEqual(expect.arrayContaining([taskOutput, conversationOutput]))
    },
  })
})
