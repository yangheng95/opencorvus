import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Config.TestHooks.beforeGlobalPersist = undefined
  Config.TestHooks.beforeProjectRuntimeSettlement = undefined
  await resetMemoryDatabase()
})

for (const scope of ["project", "global"] as const) {
  test(`${scope} writer and a first concurrent MCP status read settle with the committed generation`, async () => {
    await using project = await memoryProject()
    const file = path.join(project.path, ".opencorvus", "opencorvus.jsonc")
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({ mcp: { "qa-disabled": { enabled: false } } }))
    await Instance.provide({ directory: project.path, fn: () => Config.get() })
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const pauseWriter = async () => {
      entered.resolve()
      await release.promise
    }
    if (scope === "global") Config.TestHooks.beforeGlobalPersist = pauseWriter
    else Config.TestHooks.beforeProjectRuntimeSettlement = pauseWriter

    // Bound the original source read so the broken ownership cycle reports
    // its actual error and drains during this regression check.
    const readProject = Config.getProject.bind(Config)
    const sourceRead = spyOn(Config, "getProject").mockImplementation(() =>
      withTimeout(readProject(), 2000, "MCP initialization source generation"),
    )
    const writer = Instance.provide({
      directory: project.path,
      fn: () =>
        scope === "global"
          ? Config.updateGlobalPatch({ username: `mcp-${scope}` })
          : Config.updateProjectPatch({ username: `mcp-${scope}` }),
    })
    const writerResult = writer.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    await entered.promise
    const reader = Instance.provide({ directory: project.path, fn: () => MCP.status() })
    const readerResult = reader.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    await Bun.sleep(50)
    release.resolve()
    try {
      const [saved, observed] = await Promise.all([writerResult, readerResult])
      expect(saved).toMatchObject({ value: { username: `mcp-${scope}` } })
      expect(observed).toMatchObject({ value: { "qa-disabled": { status: "disabled" } } })
      const current = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      expect(current.username).toBe(`mcp-${scope}`)
    } finally {
      sourceRead.mockRestore()
    }
  }, 15000)
}
