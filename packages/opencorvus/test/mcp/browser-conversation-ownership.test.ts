import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { MCP } from "@/mcp"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("a Conversation owns the Browser runtime it creates", () => {
  test("each Conversation projects Browser through its own connection owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const owned: { key: string; connectionIdentity: string | undefined }[] = []
        const projected = spyOn(MCP, "scopedToolsForServer")
        projected.mockImplementation(async (input) => {
          owned.push({ key: input.key, connectionIdentity: input.connectionIdentity })
          return {}
        })
        try {
          const config = await Config.get()
          await ConversationCapability.runtimeMcpTools(config, "chat", "session-browser-owner-first")
          await ConversationCapability.runtimeMcpTools(config, "chat", "session-browser-owner-second")
        } finally {
          projected.mockRestore()
        }

        // Browser reaches the model through a Conversation-scoped connection
        // owner, not the Project's shared one. That owner is the exact cleanup
        // target Conversation deletion had nothing to aim at before.
        expect(owned.filter((entry) => entry.key === BrowserMCPBuiltin.ServerName)).toEqual([
          {
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "conversation:session-browser-owner-first:browser",
          },
          {
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "conversation:session-browser-owner-second:browser",
          },
        ])
      },
    })
  }, 120_000)

  test("disposing a Conversation settles the Browser owner it held", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "session-browser-owner-dispose"
        const identity = ConversationCapability.browserRuntimeMcpOwnerIdentity(sessionID)
        const created: string[] = []
        const create = spyOn(MCP, "createScopedConnectionOwner")
        create.mockImplementation((id: string) => {
          created.push(id)
          return { id, use: async () => ({}), close: async () => {} } as never
        })
        const projected = spyOn(MCP, "scopedToolsForServer")
        projected.mockImplementation(async () => ({}))
        const single = spyOn(MCP, "scopedTool")
        single.mockImplementation(async () => ({}) as never)
        try {
          const config = await Config.get()
          await ConversationCapability.runtimeMcpTools(config, "chat", sessionID)
          await ConversationCapability.disposeRuntimeMcp(sessionID)
          await ConversationCapability.runtimeMcpTools(config, "chat", sessionID)
        } finally {
          single.mockRestore()
          projected.mockRestore()
          create.mockRestore()
        }

        // Two owners for one Conversation: the first was settled and dropped
        // by disposal, so the second projection had to mint a fresh one. A
        // Browser runtime that survived disposal would have been reused.
        expect(created.filter((id) => id === identity)).toEqual([identity, identity])
      },
    })
  }, 120_000)
})
