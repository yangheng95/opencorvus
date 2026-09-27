import { afterEach, expect, test } from "bun:test"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
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
import { artifactCatalogAuthority, readTaskArtifact } from "../../src/artifact-catalog"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("current package Tool identity reaches formal publication through the real native runtime", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const id = "artifact-authority-contract"
      const ref = (tool: string) => `${id}/shared/${tool}`
      const encoded = (tool: string) =>
        CapabilityRefCodec.encode(
          capabilityRef({ kind: "tool", source: "package", owner_ref: id, local_ref: ref(tool) }),
        )
      const source = `import { tool } from "@opencorvus-ai/plugin"
export default tool({ description: "Publish the given local contract value.",
args: { artifact_type: tool.schema.string(), value: tool.schema.string() },
async execute(args, context) { return JSON.stringify(await context.host.engineArtifacts.publish({
artifact_type: args.artifact_type, schema_version: 1, label: "Authority check", payload: { value: args.value }, resources: [] })) } })`
      const definition = buildExpertSquadAuthorDefinition({
        schema_version: 2,
        namespace: "test",
        id,
        label: "Artifact authority contract",
        description: "Local caller authority test",
        version: "2026.09.27.1",
        product_pillars: ["work"],
        readme: "# Local authority test",
        selector: {
          summary: "Local authority",
          selection_guidance: "Local authority test only",
          instructions: "# Local selection",
        },
        artifact_publishers: { [`${id}/report`]: encoded("publish"), [`${id}/receipt`]: null },
        capability_sets: {},
        scheduler: {
          prompt: "Run the local contract.",
          capability_refs: [encoded("publish"), encoded("other")].sort(),
        },
        agents: {
          "authority-worker": {
            label: "Worker",
            description: "Local projection",
            base_role: "build",
            prompt: "Local work",
            capability_refs: [],
          },
        },
        virtual_workflows: {},
        extra_files: { "tools/publish.ts": source, "tools/other.ts": source },
      })
      expect(definition.manifest.artifact_publishers).toEqual({
        [`${id}/report`]: encoded("publish"),
        [`${id}/receipt`]: null,
      })
      await ExpertSquadConversationAuthoring.author({
        projectDirectory: project.path,
        installationScope: "project",
        definition,
      })
      await Config.updateProjectPatch({ prompt_profile: { active: id } })
      const config = await Config.get()
      const { schedulerCapability: capability, skillProjection } =
        await PromptProfileResolver.resolveSchedulerTurnProjection({ projectDirectory: project.path, config })
      configureTaskIngressRunner(async () => {})
      const taskID = await EngineService.createTask(
        {
          requestID: "formal-publication-authority",
          request: "Exercise the local publication authority",
          productPillar: "work",
          model: "firmware/gpt-5",
          promptProfile: id,
          expectedPackageDigest: capability.packageRevision.packageDigest,
        },
        { actor: "user" },
      )
      const session = await Session.create({
        kind: "orchestrator",
        parentID: requireTask(taskID).session_id!,
        title: "Publication caller",
      })
      const mcp = MCP.createScopedConnectionOwner(`publication-${session.id}`)
      try {
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-scheduler",
            sessionID: session.id,
            ...capability.identity,
            expertSquadID: id,
            packageRevision: capability.packageRevision,
            taskID,
            contractKind: "orchestrator-wake",
            installedAt: Date.now(),
          },
          skillProjection,
          harnessGrants: PromptProfileResolver.schedulerHarnessGrants({ taskID, capability, projectedToolIDs: [] }),
          projectDirectory: project.path,
          includeMcpTools: false,
          system: [],
          systemMode: "complete",
          resources: { mcp, tools: createRuntimeToolOwner({ leaves: [] }) },
        })
        const model = {
          id: "local-authority",
          providerID: "test",
          name: "Local contract",
          api: { id: "local-authority", npm: "@ai-sdk/anthropic" },
          options: {},
          limit: { context: 100000, input: 90000, output: 4096 },
          cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
          capabilities: {
            toolcall: true,
            attachment: false,
            reasoning: false,
            temperature: true,
            input: { text: true, image: false, audio: false, video: false },
            output: { text: true, image: false, audio: false, video: false },
          },
        } as Provider.Model
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          agent: "orchestrator",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Exercise the local publication contract.",
          kind: "user_content",
        })
        const invoke = async (tool: string, artifactType: string) => {
          const providerName = capability.packageTools.find((entry) => entry.ref === ref(tool))!.providerName
          const assistant = {
            id: Identifier.ascending("message"),
            sessionID: session.id,
            parentID: user.id,
            role: "assistant" as const,
            author: "orchestrator",
            agent: "orchestrator",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: model.id,
            providerID: model.providerID,
            time: { created: Date.now() },
          }
          const processor = SessionProcessor.create({
            assistantMessage: assistant,
            sessionID: session.id,
            model,
            abort: new AbortController().signal,
          })
          const resolved = await resolveTestCapabilityTools({
            config,
            model,
            session: await Session.get(session.id),
            assistant,
            processor,
            agent: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config })),
            agentID: "orchestrator",
            messages: await Session.messages({ sessionID: session.id }),
            activeLocalRefs: [providerName],
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistant.id,
            type: "step-start",
          })
          const args = { artifact_type: artifactType, value: "original local payload" }
          const call = Identifier.ascending("tool")
          const result = (await resolved.tools[providerName]!.execute!(args, {
            toolCallId: call,
            messages: [],
            abortSignal: new AbortController().signal,
          })) as { output: string; title: string; metadata: Record<string, unknown> }
          await processor.completeRecoveredToolPart({ toolCallID: call, toolInput: args, output: result })
          return JSON.parse(result.output)
        }
        const published = await invoke("publish", `${id}/report`)
        const read = await readTaskArtifact({
          authority: artifactCatalogAuthority(taskID),
          read: { locator: published.locator, byte_offset: 0, max_bytes: 65536, delivery: "inline" },
        })
        expect(JSON.parse(read.chunk.text!)).toMatchObject({
          artifact_type: `${id}/report`,
          payload: { value: "original local payload" },
          producer: { owner_kind: "projected-scheduler", expert_squad_id: id },
        })
        await expect(invoke("other", `${id}/report`)).rejects.toThrow(
          `requires ${ref("publish")}; received ${ref("other")}`,
        )
        await expect(invoke("publish", `${id}/receipt`)).rejects.toThrow("Host-owned publication")
        const note = await invoke("other", `${id}/note`)
        const noteRead = await readTaskArtifact({
          authority: artifactCatalogAuthority(taskID),
          read: { locator: note.locator, byte_offset: 0, max_bytes: 65536, delivery: "inline" },
        })
        expect(JSON.parse(noteRead.chunk.text!).artifact_type).toBe(`${id}/note`)
      } finally {
        await SessionRuntimeContractStore.dispose(session.id)
      }
    },
  })
})
