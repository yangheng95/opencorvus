import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { MCP } from "@/mcp"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { RuntimeCapabilityCatalog } from "@/tool/capability-runtime-catalog"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("round-trips exact configured MCP names and canonical package references", () => {
  const identity = { kind: "mcp_server", source: "project", owner_ref: "mcp-config" } as const
  for (const [name, encoded] of [
    ["", "capability:mcp_server:project:mcp-config:"],
    [" review-tools ", "capability:mcp_server:project:mcp-config:%20review-tools%20"],
    ["review-tools", "capability:mcp_server:project:mcp-config:review-tools"],
    ["文档:review", "capability:mcp_server:project:mcp-config:%E6%96%87%E6%A1%A3%3Areview"],
  ] as const) {
    const ref = capabilityRef({ ...identity, local_ref: name })
    expect(CapabilityRefCodec.encode(ref)).toBe(encoded)
    expect(CapabilityRefCodec.decode(encoded)).toEqual({ ...identity, local_ref: name })
  }
  const packageRef = { kind: "mcp_server", source: "package", owner_ref: "fixture" } as const
  const encoded = CapabilityRefCodec.encode({ ...packageRef, local_ref: " review-tools " })
  expect(CapabilityRefCodec.decode(encoded)).toEqual({ ...packageRef, local_ref: "review-tools" })
})

test("uses exact configured MCP names in native grants and discovery across projects", async () => {
  await using primary = await memoryProject()
  await using alternate = await memoryProject()
  const longName = "a".repeat(241)
  const projects = [
    { directory: primary.path, names: ["", " review-tools ", "review-tools", longName] },
    { directory: alternate.path, names: [" review-tools ", "review-tools"] },
  ]
  const projectsSeen = await Promise.all(projects.map(({ directory, names }) => Instance.provide({
    directory,
    async fn() {
      await Config.updateProjectPatch({ mcp: Object.fromEntries(names.map((name) => [name, { enabled: false }])) })
      const config = await Config.get()
      const assistant = await Session.create({ kind: "assistant", title: "Project MCP references" })
      const mission = await Session.create({ kind: "mission", title: "Mission MCP references", metadata: {
        mission: {
          id: "project-mcp-names",
          channelKey: "mission:project-mcp-names",
          cwd: directory,
          productPillar: "work",
          visibleExpertSquadIDs: ["base"],
        },
      } })
      const expectedRefs = [...names, "browser", "computer"].sort()
      for (const [agentID, session] of [["chat", assistant], ["work", assistant], ["coding", assistant], ["mission", mission]] as const) {
        const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get(agentID, { config }))
        const harnessGrants = await SessionLoop.resolveOccurrenceHarnessGrants({ agentID, session, agent, config })
        const refs = harnessGrants.grants.filter(({ ref }) => ref.kind === "mcp_server").map(({ ref }) => ref.local_ref)
        expect(refs.sort()).toEqual(agentID === "chat" || agentID === "work" ? [] : expectedRefs)

        const { snapshot } = await RuntimeCapabilityCatalog.snapshot({
          config, sessionID: session.id, agentID, executionToolIDs: [], permission: [], harnessGrants,
        })
        const descriptors = snapshot.descriptors.filter(({ ref }) => ref.kind === "mcp_server" && ref.owner_ref === "mcp-config")
        expect(descriptors.map(({ ref }) => ref.local_ref).sort()).toEqual(expectedRefs)
        const labels = new Map(descriptors.map(({ ref, name }) => [ref.local_ref, name]))
        expect(labels.get(" review-tools ")).toBe('" review-tools "')
        expect(labels.get("review-tools")).toBe("review-tools")
        if (names.includes("")) {
          expect(labels.get("")).toBe('""')
          expect(labels.get(longName)).toBe(`${"a".repeat(239)}…`)
        }
      }
      return Instance.project.id
    },
  })))
  expect(new Set(projectsSeen).size).toBe(2)
}, 90_000)

test("executes each exact MCP parent and records its original provider identity", async () => {
  await using project = await memoryProject()
  const fixture = path.resolve(import.meta.dir, "../fixture/search-native-mcp-server.mjs")
  const connections = [
    { name: "review-tools", version: 1, args: { value: "plain" } },
    { name: "review-tools ", version: 2, args: { replacement: "trailing" } },
    { name: "", version: 3, args: { replacement: "empty" } },
  ]
  await Instance.provide({
    directory: project.path,
    async fn() {
      const mcp: Record<string, Config.Mcp | { enabled: false }> = {
        browser: { enabled: false },
        computer: { enabled: false },
      }
      for (const { name, version } of connections) {
        const state = path.join(project.path, `mcp-state-${version}.json`)
        const log = path.join(project.path, `mcp-calls-${version}.jsonl`)
        await Bun.write(state, JSON.stringify({ version }))
        mcp[name] = { type: "local", command: [process.execPath, fixture, state, log], timeout: 10_000 }
      }
      await Config.updateProjectPatch({ mcp, permission_mode: "full_access" })
      const config = await Config.get()
      const session = await Session.create({ kind: "assistant", title: "Exact project MCP calls" })
      const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
      const harnessGrants = await SessionLoop.resolveOccurrenceHarnessGrants({ agentID: "coding", session, agent, config })
      const { mcpToolParentBindings } = await RuntimeCapabilityCatalog.snapshot({
        config, sessionID: session.id, agentID: "coding", executionToolIDs: [], permission: [], harnessGrants,
      })

      for (const { name, version, args } of connections) {
        const runtimeName = MCP.runtimeToolName(name, "echo")
        const binding = mcpToolParentBindings.find((entry) => entry.tool_ref.local_ref === runtimeName)!
        expect(binding.server_ref.local_ref).toBe(name)
        const owner = HostSessionMcpRuntime.catalogSnapshots(session.id).find(({ owner }) =>
          HostSessionMcpRuntime.catalogOwnerRef(owner.owner_id) === binding.tool_ref.owner_ref,
        )!
        const tool = await HostSessionMcpRuntime.exactTool(config, session.id, runtimeName, owner.owner_revision)
        const authority = MCP.toolAuthorityBinding(tool)!
        const toolCallID = `project-mcp-name-${version}`
        const result = await PermissionAuthority.authorizeAndExecute({
          projectID: Instance.project.id,
          sessionID: session.id,
          messageID: Identifier.ascending("message"),
          toolCallID,
          providerKind: "mcp_app",
          providerID: authority.serverID,
          providerDigest: `${authority.configDigest}:${authority.toolDigest}`,
          toolName: runtimeName,
          args,
        }, async () => {
          await MCP.exactToolAssertion(tool)?.()
          return tool.execute!(args, { toolCallId: toolCallID, messages: [] })
        })
        expect(result).toMatchObject({ content: [{ type: "text", text: `executed-v${version}` }] })
      }

      const history = await PermissionAuthority.history()
      const requests = history.filter((row) => row.event_type === "requested")
      expect(requests.map((row) => row.provider_id).sort()).toEqual(connections.map(({ name }) => name).sort())
      expect(history.filter((row) => row.event_type === "execution_succeeded").map((row) => row.request_id).sort())
        .toEqual(requests.map((row) => row.request_id).sort())
    },
  })
}, 90_000)
