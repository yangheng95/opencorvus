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
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

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
  test("publishes Browser and Computer inventory through independent owners for one native Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "ses_host_native_mcp"
        const discoveredServers: Array<{
          key: string
          connectionIdentity: string | undefined
          runtimeScope?: string
          hasEndpoint?: boolean
          hasAuthorization?: boolean
        }> = []
        const inspect = spyOn(MCP, "inspectScopedCapabilitySnapshot").mockImplementation(async (input) => {
          const environment = input.mcp.type === "local" ? input.mcp.environment : undefined
          discoveredServers.push({
            key: input.key,
            connectionIdentity: input.connectionIdentity,
            runtimeScope: environment?.OPENCORVUS_COMPUTER_RUNTIME_SCOPE,
            hasEndpoint: Boolean(environment?.OPENCORVUS_COMPUTER_HOST_ENDPOINT),
            hasAuthorization: Boolean(environment?.OPENCORVUS_COMPUTER_HOST_AUTHORIZATION),
          })
          const names =
            input.key === BrowserMCPBuiltin.ServerName
              ? ["tabs"]
              : input.key === ComputerMCPBuiltin.ServerName
                ? [...ComputerMCPBuiltin.ImportableToolNames]
                : []
          return {
            tool_definitions: names.map((name) => ({
              name,
              description: `Owned ${input.key} ${name}`,
              inputSchema: { type: "object", properties: {} },
            })),
            prompt_definitions: [],
            resource_definitions: [],
            inventory_revision: "1".repeat(64),
          }
        })
        try {
          const config = await Config.get()
          await HostSessionMcpRuntime.prepareCatalog(config, sessionID, [
            BrowserMCPBuiltin.ServerName,
            ComputerMCPBuiltin.ServerName,
          ])
          const names = HostSessionMcpRuntime.catalogSnapshots(sessionID)
            .flatMap((snapshot) => Object.keys(snapshot.tool_bindings))
            .sort()
          expect(names).toEqual([
            "browser_tabs",
            ...ComputerMCPBuiltin.ImportableToolNames.map((name) => `computer_${name}`),
          ].sort())
          expect(discoveredServers[0]).toEqual({
            key: BrowserMCPBuiltin.ServerName,
            connectionIdentity: "session:ses_host_native_mcp:browser",
            runtimeScope: undefined,
            hasEndpoint: false,
            hasAuthorization: false,
          })
          expect(discoveredServers[1]).toEqual({
            key: ComputerMCPBuiltin.ServerName,
            connectionIdentity: "session:ses_host_native_mcp:computer",
            runtimeScope: "session:ses_host_native_mcp:computer",
            hasEndpoint: true,
            hasAuthorization: true,
          })
          await HostSessionMcpRuntime.dispose(sessionID)
        } finally {
          inspect.mockRestore()
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
        const resolved: Array<{ key: string; connectionIdentity: string | undefined }> = []
        const native = spyOn(MCP, "inspectScopedCapabilitySnapshot").mockImplementation(async (input) => {
          resolved.push({ key: input.key, connectionIdentity: input.connectionIdentity })
          return {
            tool_definitions: [],
            prompt_definitions: [],
            resource_definitions: [],
            inventory_revision: "2".repeat(64),
          }
        })
        try {
          const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("mission", { config }))
          const { tools } = await resolveTestCapabilityTools({
            agent: runtime,
            agentID: "mission",
            model,
            session: mission,
            assistant,
            processor,
            messages: await Session.messages({ sessionID: mission.id }),
            config,
            activeLocalRefs: ["wait"],
          })
          expect(resolved.map((entry) => entry.key).sort()).toEqual(Object.keys(config.mcp ?? {}).sort())
          expect(HostSessionMcpRuntime.catalogSnapshots(mission.id).map((snapshot) => snapshot.owner.owner_id).sort()).toEqual(
            resolved.map((entry) => entry.connectionIdentity).filter((entry): entry is string => Boolean(entry)).sort(),
          )
          expect(Object.keys(tools).sort()).toEqual(["capability_search", "wait"])
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
    const browser = spyOn(MCP, "inspectScopedCapabilitySnapshot").mockResolvedValue({
      tool_definitions: [],
      prompt_definitions: [],
      resource_definitions: [],
      inventory_revision: "3".repeat(64),
    })
    try {
      const root = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: "Cross-directory runtime root" })
          await HostSessionMcpRuntime.prepareCatalog(await Config.get(), session.id, [BrowserMCPBuiltin.ServerName])
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
          await HostSessionMcpRuntime.prepareCatalog(config, child.id, [BrowserMCPBuiltin.ServerName])
          await HostSessionMcpRuntime.prepareCatalog(config, unrelated.id, [BrowserMCPBuiltin.ServerName])
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
          await HostSessionMcpRuntime.prepareCatalog(await Config.get(), unrelated.id, [BrowserMCPBuiltin.ServerName])
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
