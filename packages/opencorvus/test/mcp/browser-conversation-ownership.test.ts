import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { MCP } from "@/mcp"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
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
        const browserTools = {
          browser_navigate: { description: "Navigate through the owned Browser connection" } as never,
          browser_tabs: { description: "List tabs through the owned Browser connection" } as never,
        }
        const projected = spyOn(MCP, "scopedToolsForServer")
        projected.mockImplementation(async (input) => {
          owned.push({ key: input.key, connectionIdentity: input.connectionIdentity })
          return browserTools
        })
        try {
          const base = await Config.get()
          const config: Config.Info = {
            ...base,
            primary_assistant_capabilities: {
              ...base.primary_assistant_capabilities,
              chat: { skill_refs: [], mcp_server_refs: [BrowserMCPBuiltin.ServerName] },
            },
          }
          const first = await ConversationCapability.runtimeMcpTools(config, "chat", "session-browser-owner-first")
          const second = await ConversationCapability.runtimeMcpTools(config, "chat", "session-browser-owner-second")
          expect(first).toEqual(browserTools)
          expect(second).toEqual(browserTools)
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

  test("Computer takeover replaces its adapter while Browser stays owned until Conversation disposal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "session-builtin-owner-lifecycle"
        const browserIdentity = ConversationCapability.browserRuntimeMcpOwnerIdentity(sessionID)
        const computerIdentity = ConversationCapability.runtimeMcpOwnerIdentity(sessionID)
        const generations = new Map<string, number>()
        const created: { id: string; generation: number }[] = []
        const settled: { id: string; generation: number }[] = []
        const timeline: string[] = []
        const closeGates = new Map<string, { promise: Promise<void>; release: () => void }>()
        const create = spyOn(MCP, "createScopedConnectionOwner")
        create.mockImplementation((id: string) => {
          const generation = (generations.get(id) ?? 0) + 1
          generations.set(id, generation)
          const receipt = { id, generation }
          const gateKey = `${id}#${generation}`
          const needsDisposeGate =
            (id === browserIdentity && generation === 1) || (id === computerIdentity && generation === 2)
          if (needsDisposeGate) {
            let release = () => {}
            const promise = new Promise<void>((resolve) => {
              release = resolve
            })
            closeGates.set(gateKey, { promise, release })
          }
          created.push(receipt)
          return {
            id,
            use: async () => ({}),
            close: async () => {
              await closeGates.get(gateKey)?.promise
              settled.push(receipt)
              timeline.push(`closed:${gateKey}`)
            },
          } as never
        })
        const projected = spyOn(MCP, "scopedToolsForServer")
        projected.mockImplementation(async () => ({ browser_tabs: {} as never }))
        const single = spyOn(MCP, "scopedTool")
        single.mockImplementation(async () => ({}) as never)
        try {
          const base = await Config.get()
          const config: Config.Info = {
            ...base,
            primary_assistant_capabilities: {
              ...base.primary_assistant_capabilities,
              chat: {
                skill_refs: [],
                mcp_server_refs: [BrowserMCPBuiltin.ServerName, ComputerMCPBuiltin.ServerName],
              },
            },
          }
          await ConversationCapability.runtimeMcpTools(config, "chat", sessionID)
          await ConversationCapability.disconnectRuntimeMcp(sessionID)
          await ConversationCapability.runtimeMcpTools(config, "chat", sessionID)
          const disposal = ConversationCapability.disposeRuntimeMcp(sessionID).then(() => {
            timeline.push("disposed")
          })
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
          closeGates.get(`${computerIdentity}#2`)?.release()
          closeGates.get(`${browserIdentity}#1`)?.release()
          await disposal
          await ConversationCapability.runtimeMcpTools(config, "chat", sessionID)
        } finally {
          single.mockRestore()
          projected.mockRestore()
          create.mockRestore()
        }

        expect(created).toEqual([
          { id: browserIdentity, generation: 1 },
          { id: computerIdentity, generation: 1 },
          { id: computerIdentity, generation: 2 },
          { id: browserIdentity, generation: 2 },
          { id: computerIdentity, generation: 3 },
        ])
        expect(settled).toEqual([
          { id: computerIdentity, generation: 1 },
          { id: computerIdentity, generation: 2 },
          { id: browserIdentity, generation: 1 },
        ])
        expect(timeline).toEqual([
          `closed:${computerIdentity}#1`,
          `closed:${computerIdentity}#2`,
          `closed:${browserIdentity}#1`,
          "disposed",
        ])
      },
    })
  }, 120_000)
})
