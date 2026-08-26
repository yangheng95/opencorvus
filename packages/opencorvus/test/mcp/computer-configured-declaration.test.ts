import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("the configured declaration is the Computer provider", () => {
  test("configuration declares the builtin provider itself, not a disabled stub", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const computer = config.mcp?.[ComputerMCPBuiltin.ServerName]

        // The entry a project inherits without customizing anything is the
        // builtin's own declaration — the same one execution runs. It used to
        // be `{enabled: false}`, which nothing honoured and which made
        // configuration, status and execution describe different capabilities.
        expect(computer).toEqual(ComputerMCPBuiltin.localConfig())
      },
    })
  }, 60_000)

  test("configuration turning the provider off decides the projection, and assignment cannot resurrect it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await ConversationCapability.update("work", {
          kind: "mcp_server",
          ref: ComputerMCPBuiltin.ServerName,
          assigned: true,
        })
        await Config.updateProjectPatchAtomic(() => ({
          mcp: { [ComputerMCPBuiltin.ServerName]: { ...ComputerMCPBuiltin.localConfig(), enabled: false } },
        }))

        const config = await Config.get()
        const tools = await ConversationCapability.runtimeMcpTools(
          config,
          "work",
          "session-computer-configured-declaration",
        )

        // Assignment names the provider, configuration has turned it off, and
        // the projection reports configuration's answer instead of building a
        // runtime of its own behind it.
        expect(Object.keys(tools).filter((name) => name.startsWith(`${ComputerMCPBuiltin.ServerName}_`))).toEqual([])
      },
    })
  }, 60_000)
})
