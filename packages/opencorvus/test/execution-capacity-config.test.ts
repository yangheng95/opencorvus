import { describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

describe.serial("global execution capacity configuration", () => {
  test("parses the one bounded global policy surface", () => {
    expect(
      Config.Info.parse({
        execution_capacity: {
          scheduler_message: 1,
          automation: 2,
          event: 3,
          provider: 64,
        },
      }).execution_capacity,
    ).toEqual({ scheduler_message: 1, automation: 2, event: 3, provider: 64 })
  })

  test("maps a Project-owned physical-capacity policy to the canonical typed config error", async () => {
    await using project = await memoryProject()
    let captured: unknown
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        try {
          await Config.updateProjectPatch({ execution_capacity: { provider: 1 } })
        } catch (error) {
          captured = error
        }
      },
    })
    expect(captured).toMatchObject({
      name: "ConfigInvalidError",
      data: {
        issues: [{ path: ["execution_capacity"] }],
      },
    })
  })
})
