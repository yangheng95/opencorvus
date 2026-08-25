import { describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { Instance } from "../src/project/instance"
import { memoryProject } from "./fixture/memory"

describe("config write timing", () => {
  test("two project patches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const a = Date.now()
        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const b = Date.now()
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const c = Date.now()
        console.log(JSON.stringify({ first: b - a, second: c - b }))
        expect(c - a).toBeGreaterThanOrEqual(0)
      },
    })
  }, 60_000)
})
