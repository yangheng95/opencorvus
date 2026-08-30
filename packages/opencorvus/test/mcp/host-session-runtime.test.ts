import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { MCP } from "@/mcp"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { Instance } from "@/project/instance"
import type { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { SessionProcessor } from "@/session/processor"
import { EngineService } from "@/task-api"
import { Worktree } from "@/worktree"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function providerModel(): Provider.Model {
  return {
    id: "host-session-runtime-model",
    providerID: "host-session-runtime-provider",
    name: "Host Session Runtime Model",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: "host-session-runtime-model", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("host-owned native Session MCP composition", () => {
  test("binds Browser and Computer to independent owners for one native Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "ses_host_native_mcp"
        const scopedServers: Array<{
          key: string
          connectionIdentity: string | undefined
          runtimeScope?: string
          hasEndpoint?: boolean
          hasAuthorization?: boolean
        }> = []
        const browser = spyOn(MCP, "scopedToolsForServer").mockImplementation(async (input) => {
          scopedServers.push({ key: input.key, connectionIdentity: input.connectionIdentity })
          return { browser_tabs: { description: "Owned Browser tabs" } as never }
        })
        const computer = spyOn(MCP, "scopedTool").mockImplementation(async (input) => {
          const environment = input.mcp.type === "local" ? input.mcp.environment : undefined
          scopedServers.push({
            key: input.key,
            connectionIdentity: input.connectionIdentity,
            runtimeScope: environment?.OPENCORVUS_COMPUTER_RUNTIME_SCOPE,
            hasEndpoint: Boolean(environment?.OPENCORVUS_COMPUTER_HOST_ENDPOINT),
            hasAuthorization: Boolean(environment?.OPENCORVUS_COMPUTER_HOST_AUTHORIZATION),
          })
          return { description: `Owned Computer ${input.toolName}` } as never
        })
        try {
          const config = await Config.get()
          const tools = await HostSessionMcpRuntime.tools(config, sessionID, [
            BrowserMCPBuiltin.ServerName,
            ComputerMCPBuiltin.ServerName,
          ])
          expect(Object.keys(tools).sort()).toEqual([
            "browser_tabs",
            ...ComputerMCPBuiltin.ImportableToolNames.map((name) => `computer_${name}`),
          ].sort())
          expect(scopedServers[0]).toEqual({
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "session:ses_host_native_mcp:browser",
          })
          expect(scopedServers.slice(1)).toEqual(
            ComputerMCPBuiltin.ImportableToolNames.map(() => ({
              key: ComputerMCPBuiltin.ServerName,
              connectionIdentity: "session:ses_host_native_mcp:computer",
              runtimeScope: "session:ses_host_native_mcp:computer",
              hasEndpoint: true,
              hasAuthorization: true,
            })),
          )
          await HostSessionMcpRuntime.dispose(sessionID)
        } finally {
          computer.mockRestore()
          browser.mockRestore()
        }
      },
    })
  }, 60_000)

  test("resolves a real native Mission through the host Session MCP owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const model = providerModel()
        const config = await Config.get()
        const mission = await ensureMissionSession({
          missionID: "native-host-session-mcp",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "mission",
          agent: "mission",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: user.id,
          type: "text",
          text: "Resolve the exact native Mission Tool surface.",
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          agent: "mission",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: mission.id,
          model,
          abort: new AbortController().signal,
        })
        const resolved: Array<{ sessionID: string; selectedServerRefs: string[] }> = []
        const native = spyOn(HostSessionMcpRuntime, "tools").mockImplementation(
          async (_config, sessionID, selectedServerRefs) => {
            resolved.push({ sessionID, selectedServerRefs: [...selectedServerRefs].sort() })
            return {}
          },
        )
        try {
          const tools = await SessionLoop.resolveTools({
            agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("mission", { config })),
            agentID: "mission",
            model,
            session: mission,
            processor,
            messages: await Session.messages({ sessionID: mission.id }),
            config,
          })
          expect(resolved).toEqual([
            { sessionID: mission.id, selectedServerRefs: Object.keys(config.mcp ?? {}).sort() },
          ])
          expect(["mission_skill", "panel", "scheduler_message", "wait"].map((name) => Object.hasOwn(tools, name))).toEqual([
            true,
            true,
            true,
            true,
          ])
        } finally {
          native.mockRestore()
        }
      },
    })
  }, 60_000)

  test("deleting a cross-directory Session tree settles each exact active runtime owner", async () => {
    await using project = await memoryProject()
    const nestedDirectory = await Instance.provide({
      directory: project.path,
      fn: async () => (await Worktree.create({ name: "cross-directory-runtime" })).directory,
    })
    const closed = new Map<string, number>()
    const owners = new Map<string, MCP.ScopedConnectionOwner>()
    const createOwner = spyOn(MCP, "createScopedConnectionOwner").mockImplementation((id) => {
      const owner: MCP.ScopedConnectionOwner = {
        id,
        catalogSnapshot() {
          return { owner_id: id, owner_revision: "0".repeat(64), entries: [] }
        },
        async close() {
          closed.set(id, (closed.get(id) ?? 0) + 1)
        },
      }
      owners.set(id, owner)
      return owner
    })
    const browser = spyOn(MCP, "scopedToolsForServer").mockResolvedValue({})
    try {
      const root = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: "Cross-directory runtime root" })
          await HostSessionMcpRuntime.tools(await Config.get(), session.id, [BrowserMCPBuiltin.ServerName])
          return session
        },
      })
      const { child, unrelated } = await Instance.provide({
        directory: nestedDirectory,
        fn: async () => {
          const child = await Session.create({
            kind: "assistant",
            parentID: root.id,
            title: "Cross-directory runtime child",
          })
          const unrelated = await Session.create({ kind: "root", title: "Unrelated retained runtime" })
          const config = await Config.get()
          await HostSessionMcpRuntime.tools(config, child.id, [BrowserMCPBuiltin.ServerName])
          await HostSessionMcpRuntime.tools(config, unrelated.id, [BrowserMCPBuiltin.ServerName])
          return { child, unrelated }
        },
      })

      await Instance.provide({
        directory: project.path,
        fn: () => EngineService.deleteSession(root.id, { projectID: root.projectID }),
      })

      expect(
        [root.id, child.id, unrelated.id].map((id) => ({
          owner: HostSessionMcpRuntime.browserOwnerIdentity(id),
          closed: closed.get(HostSessionMcpRuntime.browserOwnerIdentity(id)) ?? 0,
        })),
      ).toEqual([
        { owner: HostSessionMcpRuntime.browserOwnerIdentity(root.id), closed: 1 },
        { owner: HostSessionMcpRuntime.browserOwnerIdentity(child.id), closed: 1 },
        { owner: HostSessionMcpRuntime.browserOwnerIdentity(unrelated.id), closed: 0 },
      ])

      await Instance.provide({
        directory: nestedDirectory,
        fn: async () => {
          const before = owners.size
          await HostSessionMcpRuntime.tools(await Config.get(), unrelated.id, [BrowserMCPBuiltin.ServerName])
          expect(owners.size).toBe(before)
          await HostSessionMcpRuntime.dispose(unrelated.id)
        },
      })
      expect(closed.get(HostSessionMcpRuntime.browserOwnerIdentity(unrelated.id))).toBe(1)
    } finally {
      browser.mockRestore()
      createOwner.mockRestore()
    }
  }, 60_000)
})
