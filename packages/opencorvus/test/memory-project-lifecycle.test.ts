import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { memoryProject } from "./fixture/memory"

describe("memory Project lifecycle", () => {
  test("settles supervised Project processes before removing the fixture directory", async () => {
    const project = await memoryProject("supervised-process-settlement")
    const owner = "test:memory-project-lifecycle"
    let disposed = false
    try {
      const handle = await ProcessSupervisor.spawnHostCommand({
        executable: process.execPath,
        args: ["-e", "setInterval(() => {}, 1_000)"],
        cwd: project.path,
        owner,
      })

      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toEqual({ count: 1, pids: [handle.pid] })
      await project[Symbol.asyncDispose]()
      disposed = true
      await expect(handle.settled).resolves.toBeUndefined()
      expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })
      expect(await fs.stat(project.path).catch(() => undefined)).toBeUndefined()
    } finally {
      if (!disposed) await project[Symbol.asyncDispose]()
    }
  }, 30_000)
})
