import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { exactConversationMcpTools } from "../fixture/conversation-mcp"
import { MCP } from "@/mcp"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
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
        const projected = spyOn(MCP, "inspectScopedCapabilitySnapshot")
        projected.mockImplementation(async (input) => {
          owned.push({ key: input.key, connectionIdentity: input.connectionIdentity })
          return {
            tool_definitions: ["navigate", "tabs"].map((name) => ({
              name,
              description: browserTools[`browser_${name}` as keyof typeof browserTools].description,
              inputSchema: { type: "object", properties: {} },
            })),
            prompt_definitions: [],
            resource_definitions: [],
            inventory_revision: "5".repeat(64),
          }
        })
        const exact = spyOn(MCP, "scopedTool").mockImplementation(async (input) => {
          const runtimeName = MCP.runtimeToolName(input.key, input.toolName) as keyof typeof browserTools
          return Object.assign(browserTools[runtimeName], { __runtimeName: runtimeName })
        })
        const originalAuthority = MCP.toolAuthorityBinding
        const authority = spyOn(MCP, "toolAuthorityBinding").mockImplementation((tool) => {
          const runtimeName = (tool as { __runtimeName?: string }).__runtimeName
          if (!runtimeName) return originalAuthority(tool)
          const binding = ["session-browser-owner-first", "session-browser-owner-second"]
            .flatMap((sessionID) => HostSessionMcpRuntime.catalogSnapshots(sessionID))
            .map((snapshot) => snapshot.tool_bindings[runtimeName])
            .find(Boolean)
          return binding
            ? { serverID: binding.server_id, configDigest: binding.config_digest, toolDigest: binding.tool_digest }
            : undefined
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
          const first = await exactConversationMcpTools(config, "chat", "session-browser-owner-first")
          const second = await exactConversationMcpTools(config, "chat", "session-browser-owner-second")
          expect(first).toEqual(browserTools)
          expect(second).toEqual(browserTools)
        } finally {
          authority.mockRestore()
          exact.mockRestore()
          projected.mockRestore()
        }

        // Browser reaches the model through a Conversation-scoped connection
        // owner, not the Project's shared one. That owner is the exact cleanup
        // target Conversation deletion had nothing to aim at before.
        expect(owned.filter((entry) => entry.key === BrowserMCPBuiltin.ServerName)).toEqual([
          {
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "session:session-browser-owner-first:browser",
          },
          {
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "session:session-browser-owner-second:browser",
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
        const browserIdentity = HostSessionMcpRuntime.browserOwnerIdentity(sessionID)
        const computerIdentity = HostSessionMcpRuntime.computerOwnerIdentity(sessionID)
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
            catalogSnapshot: () => ({
              owner_id: id,
              owner_revision: String(generation).padStart(64, "0"),
              entries: [],
            }),
            close: async () => {
              await closeGates.get(gateKey)?.promise
              settled.push(receipt)
              timeline.push(`closed:${gateKey}`)
            },
          } as never
        })
        const projected = spyOn(MCP, "inspectScopedCapabilitySnapshot")
        projected.mockResolvedValue({
          tool_definitions: [],
          prompt_definitions: [],
          resource_definitions: [],
          inventory_revision: "6".repeat(64),
        })
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
          await exactConversationMcpTools(config, "chat", sessionID)
          await HostSessionMcpRuntime.disconnectComputer(sessionID)
          await exactConversationMcpTools(config, "chat", sessionID)
          const disposal = HostSessionMcpRuntime.dispose(sessionID).then(() => {
            timeline.push("disposed")
          })
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
          closeGates.get(`${computerIdentity}#2`)?.release()
          closeGates.get(`${browserIdentity}#1`)?.release()
          await disposal
          await exactConversationMcpTools(config, "chat", sessionID)
        } finally {
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
