import { afterEach, expect, test } from "bun:test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { AgentToolPool } from "../../src/agent/tool-pool-contract"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { createHarnessGrantSet } from "../../src/capability/harness-projection"
import { routineToolRefs } from "../../src/capability/routine-tools"
import { CapabilityRules } from "../../src/capability/rules"
import { searchCapabilityCatalog } from "../../src/capability/catalog"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"
import { RuntimeCapabilityCatalog } from "../../src/tool/capability-runtime-catalog"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

test("each interactive role materializes its complete authorized file tools across model identities", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = await Config.get()
      const expected = ["apply_patch", "edit", "read", "write"]
      for (const role of ["coding", "chat", "work"] as const) {
        const native = await PrimaryAssistantRegistry.get(role, { config })
        const agent = sessionRuntimeFromNativeAgent(native)
        const session = await Session.create({ kind: "assistant", title: `${role} file authority` })
        const roleIDs = AgentToolPool.visibleToolIDs(agent.tools)
        const requested = expected.filter((id) => roleIDs.has(id))
        expect(requested).toEqual(expected)
        const grants = createHarnessGrantSet({
          context: { kind: "conversation", agent_id: role },
          owner_revision: "file-authority",
          grants: requested.map((local_ref) => ({
            ref: capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref }),
            access: "discover_execute",
          })),
        })
        for (const modelID of ["gpt-6.1-sol", "gpt-4-contract", "gpt-oss-contract", "streamed-owner"]) {
          const model = { providerID: "file-authority", modelID }
          const ids = await ToolRegistry.projectableRuntimeToolIDs(model, agent, config, requested)
          expect(ids.sort()).toEqual(expected)
          const catalog = await RuntimeCapabilityCatalog.snapshot({
            config, sessionID: session.id, agentID: role, executionToolIDs: ids,
            harnessGrants: grants, permission: CapabilityRules.merge(native.permission),
          })
          const results = searchCapabilityCatalog(catalog.snapshot, catalog.caller, { kinds: ["tool"] })
            .filter((entry) => expected.includes(entry.ref.local_ref))
          expect(results.map((entry) => entry.ref.local_ref).sort()).toEqual(expected)
          for (const entry of results) {
            expect(entry.next_owner).toEqual({ kind: "call_tool", tool_id: entry.ref.local_ref })
          }
          expect(routineToolRefs({ harness: grants, visibleToolIDs: ids }).map((ref) => ref.local_ref).sort()).toEqual(expected)
          const tools = await ToolRegistry.exactRuntimeTools(model, agent, role, config, ids)
          expect(tools.map((tool) => tool.id).sort()).toEqual(expected)
          for (const tool of tools) {
            expect(tool.description.length).toBeGreaterThan(0)
            expect(typeof tool.execute).toBe("function")
          }
          const write = tools.find((tool) => tool.id === "write")!
          expect(write.parameters.parse({ filePath: `${project.path}/exact.txt`, content: "exact UTF-8\n" })).toEqual({
            filePath: `${project.path}/exact.txt`, content: "exact UTF-8\n",
          })
        }
      }
    },
  })
}, 60_000)
