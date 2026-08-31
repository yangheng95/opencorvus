import { afterAll, describe, expect, test } from "bun:test"
import { asSchema } from "ai"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"
import {
  CAPABILITY_REVEAL_MAX_ACTIVE_CHARS,
  CAPABILITY_SEARCH_INITIAL_MAX_CHARS,
  CAPABILITY_SEARCH_INITIAL_MAX_TOKENS,
} from "../../src/capability/reveal-receipt"
import { Token } from "../../src/util/token"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("search-native Tool definition budgets", () => {
  test("keeps every projectable built-in leaf below the individual reveal budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const measurements: Array<{ id: string; chars: number; tokens: number }> = []
        for (const id of await ToolRegistry.ids()) {
          const tools = await ToolRegistry.exactRuntimeTools(
            { providerID: "opencorvus", modelID: "gpt-5.6" },
            runtime,
            "coding",
            config,
            [id],
          )
          for (const tool of tools) {
            const schema = JSON.stringify(asSchema(tool.parameters).jsonSchema ?? {})
            measurements.push({
              id: tool.id,
              chars: tool.id.length + tool.description.length + schema.length,
              tokens: Token.estimate(tool.id) + Token.estimate(tool.description) + Token.estimate(schema),
            })
          }
        }
        measurements.sort((left, right) => right.chars - left.chars)
        expect(measurements.filter((measurement) => measurement.chars > CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)).toEqual([])
        const search = measurements.find((measurement) => measurement.id === "capability_search")
        expect(search).toEqual({
          id: "capability_search",
          chars: expect.any(Number),
          tokens: expect.any(Number),
        })
        expect(search!.chars).toBeLessThanOrEqual(CAPABILITY_SEARCH_INITIAL_MAX_CHARS)
        expect(search!.tokens).toBeLessThanOrEqual(CAPABILITY_SEARCH_INITIAL_MAX_TOKENS)
      },
    })
  }, 0)
})
