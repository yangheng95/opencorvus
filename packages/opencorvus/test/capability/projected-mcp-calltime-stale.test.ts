import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { StaleCatalogOccurrenceError } from "../../src/capability/catalog-binding"
import { Config } from "../../src/config/config"
import { configureTaskIngressRunner } from "../../src/engine/task-root-ingress-delivery"
import { requireTask } from "../../src/engine/store"
import { ExpertSquadConversationAuthoring } from "../../src/expert-squad/conversation-authoring"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { MCP } from "../../src/mcp"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionProcessor } from "../../src/session/processor"
import { SessionRuntimeContractStore } from "../../src/session/runtime-contract"
import { createRuntimeToolOwner } from "../../src/session/runtime-tool-owner"
import { EngineService } from "../../src/task-api"
import { buildExpertSquadAuthorDefinition } from "../../src/tool/expert-squad-author"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

function model(): Provider.Model {
  return {
    id: "projected-mcp-stale",
    providerID: "projected-mcp-stale-provider",
    name: "Projected MCP stale",
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
    api: { id: "projected-mcp-stale", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a real projected scheduler receipt and extras leaf reject the same post-reveal MCP schema drift", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const statePath = path.join(project.path, "projected-mcp-state.json")
      const eventLogPath = path.join(project.path, "projected-mcp-events.jsonl")
      const serverPath = path.resolve(import.meta.dir, "../fixture/search-native-mcp-server.mjs")
      await fs.writeFile(statePath, JSON.stringify({ version: 1 }))
      await fs.writeFile(eventLogPath, "")
      const mcp = Config.Mcp.parse({
        type: "local",
        command: [process.execPath, serverPath, statePath, eventLogPath],
        timeout: 10_000,
      })
      const profileID = "projected-mcp-stale-contract"
      const defaultRef = "default/mcp/searchnative/tool/echo"
      await ExpertSquadConversationAuthoring.author({
        projectDirectory: project.path,
        installationScope: "project",
        replace: false,
        definition: buildExpertSquadAuthorDefinition({
          schema_version: 2,
          namespace: "test",
          id: profileID,
          name: "Projected MCP Stale Contract",
          label: "Projected MCP Stale Contract",
          description: "Projects one exact default MCP leaf through a scheduler occurrence.",
          version: "2026.08.31.1",
          product_pillars: ["work"],
          readme: "# Projected MCP Stale Contract\n",
          selector: {
            summary: "Exercise projected MCP call-time binding.",
            selection_guidance: "Select for projected MCP binding verification.",
            instructions: "# Selection\n\nSelect for projected MCP binding verification.\n",
          },
          scheduler: {
            prompt: "Coordinate one exact projected MCP leaf.",
            capability_refs: [
              CapabilityRefCodec.encode(
                capabilityRef({
                  kind: "tool",
                  source: "platform",
                  owner_ref: "tool-registry",
                  local_ref: "capability_search",
                }),
              ),
              CapabilityRefCodec.encode(
                capabilityRef({
                  kind: "mcp_tool",
                  source: "project",
                  owner_ref: "default-mcp-registry",
                  local_ref: defaultRef,
                }),
              ),
            ].sort(),
          },
          agents: {
            "projected-mcp-worker": {
              label: "Projected MCP Worker",
              description: "Retains the package's worker projection contract.",
              base_role: "build",
              prompt: "Execute projected MCP work when dispatched.",
            },
          },
          virtual_workflows: {},
        }),
      })
      await Config.updateProjectPatch({
        prompt_profile: { active: profileID },
        mcp: { searchnative: mcp },
      })
      const config = await Config.get()
      const { schedulerCapability: capability, skillProjection } =
        await PromptProfileResolver.resolveSchedulerTurnProjection({
          projectDirectory: project.path,
          config,
        })
      const providerName = PromptProfileResolver.defaultMcpToolProviderName(defaultRef)
      expect(capability.defaultMcpTools).toEqual([{ ref: defaultRef, providerName }])
      configureTaskIngressRunner(async () => {})
      const taskID = await EngineService.createTask(
        {
          requestID: "projected-mcp-stale-task",
          request: "Reveal the projected MCP leaf and preserve its exact occurrence binding.",
          productPillar: "work",
          model: "firmware/gpt-5",
          promptProfile: profileID,
          expectedPackageDigest: capability.packageRevision.packageDigest,
        },
        { actor: "user" },
      )
      const harnessGrants = PromptProfileResolver.schedulerHarnessGrants({
        taskID,
        capability,
        projectedToolIDs: [],
      })
      const owner = MCP.createScopedConnectionOwner("projected-mcp-stale-owner")
      const session = await Session.create({
        kind: "orchestrator",
        parentID: requireTask(taskID).session_id!,
        title: "Projected MCP stale scheduler occurrence",
      })
      let contractInstalled = false
      try {
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-scheduler",
            sessionID: session.id,
            ...capability.identity,
            expertSquadID: capability.expertSquadID,
            packageRevision: capability.packageRevision,
            taskID,
            contractKind: "orchestrator-wake",
            installedAt: Date.now(),
          },
          skillProjection,
          harnessGrants,
          projectDirectory: project.path,
          includeMcpTools: false,
          system: [],
          systemMode: "complete",
          resources: {
            mcp: owner,
            tools: createRuntimeToolOwner({ leaves: [] }),
          },
        })
        contractInstalled = true
        const providerModel = model()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          agent: "orchestrator",
          time: { created: Date.now() },
          model: { providerID: providerModel.providerID, modelID: providerModel.id },
        })
        const assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant" as const,
          author: "orchestrator",
          agent: "orchestrator",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: providerModel.id,
          providerID: providerModel.providerID,
          time: { created: Date.now() },
        }
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: session.id,
          model: providerModel,
          abort: new AbortController().signal,
        })
        const common = {
          config,
          model: providerModel,
          session: await Session.get(session.id),
          assistant,
          processor,
          agent: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config })),
          agentID: "orchestrator",
        }
        const revealed = await resolveTestCapabilityTools({
          ...common,
          messages: await Session.messages({ sessionID: session.id }),
          activeLocalRefs: [providerName],
        })
        expect(Object.keys(revealed.tools).sort()).toEqual(["capability_search", providerName].sort())
        await fs.writeFile(statePath, JSON.stringify({ version: 2 }))
        let receiptError: unknown
        try {
          await resolveTestCapabilityTools({
            ...common,
            messages: await Session.messages({ sessionID: session.id }),
          })
        } catch (error) {
          receiptError = error
        }
        let invocationError: unknown
        try {
          await revealed.tools[providerName]!.execute!(
            { value: "stale" },
            {
              toolCallId: "call_projected_mcp_stale",
              messages: [],
              abortSignal: new AbortController().signal,
            },
          )
        } catch (error) {
          invocationError = error
        }
        const events = (await fs.readFile(eventLogPath, "utf8"))
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map(JSON.parse)
          .map((entry) => [entry.event, entry.version])
        expect({
          receiptError:
            receiptError instanceof StaleCatalogOccurrenceError
              ? { name: receiptError.name, mismatches: receiptError.mismatches }
              : receiptError,
          invocationError:
            invocationError instanceof StaleCatalogOccurrenceError
              ? { name: invocationError.name, mismatches: invocationError.mismatches }
              : invocationError,
          events,
        }).toEqual({
          receiptError: {
            name: "StaleCatalogOccurrenceError",
            mismatches: [`receipt.${providerName}.definition_digest`],
          },
          invocationError: {
            name: "StaleCatalogOccurrenceError",
            mismatches: [`tool_binding.${providerName}_echo.tool_digest`],
          },
          events: [
            ["tools_list", 1],
            ["tools_list", 1],
            ["tools_list", 1],
            ["tools_list", 1],
            ["tools_list", 2],
            ["tools_list", 2],
            ["tools_list", 2],
          ],
        })
        expect(receiptError).toBeInstanceOf(StaleCatalogOccurrenceError)
        expect(invocationError).toBeInstanceOf(StaleCatalogOccurrenceError)
      } finally {
        if (contractInstalled) await SessionRuntimeContractStore.dispose(session.id)
        else await owner.close()
      }
    },
  })
}, 60_000)
