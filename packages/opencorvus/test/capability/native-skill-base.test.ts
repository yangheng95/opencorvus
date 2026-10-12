import { afterEach, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionProcessor } from "../../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

afterEach(resetMemoryDatabase)

test.each(["chat", "work", "coding"] as const)(
  "native %s exposes its loader and exact authorized Skill scope before discovery",
  async (agentID) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          primary_assistant_capabilities: {
            chat: { skill_refs: ["research-report"], mcp_server_refs: [] },
            work: { skill_refs: ["work-artifacts"], mcp_server_refs: [] },
          },
        })
        const config = await Config.get()
        const model = {
          id: "native-skill-model",
          providerID: "native-skill-provider",
          name: "Native Skill contract",
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
          api: { id: "native-skill", npm: "@ai-sdk/anthropic" },
          options: {},
        } as any
        const session = await Session.create({ kind: "assistant", title: `${agentID} Skill scope` })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: agentID,
          agent: agentID,
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "List my configured Skills.",
          source: "user",
          kind: "user_content",
        })
        const assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant" as const,
          author: agentID,
          agent: agentID,
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
        const common = {
          config,
          model,
          session,
          assistant,
          processor,
          agentID,
          agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get(agentID, { config })),
          messages: await Session.messages({ sessionID: session.id }),
        }
        const resolved = await resolveTestCapabilityTools(common)
        expect(resolved.occurrence.payload.permanent_provider_base_definition.provider_names).toContain("skill")
        const list = (await resolved.tools.skill!.execute!(
          {},
          { toolCallId: "call_list_native_skills", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
        expect(list.metadata.names).toEqual(
          agentID === "chat" ? ["research-report"] : agentID === "work" ? ["work-artifacts"] : [],
        )
        await processor.completeRecoveredToolPart({
          toolCallID: "call_list_native_skills",
          toolInput: {},
          output: list,
        })
        const restored = await resolveTestCapabilityTools({
          ...common,
          messages: await Session.messages({ sessionID: session.id }),
        })
        expect(restored.occurrence.payload.permanent_provider_base_definition).toEqual(
          resolved.occurrence.payload.permanent_provider_base_definition,
        )
      },
    })
  },
  30_000,
)
