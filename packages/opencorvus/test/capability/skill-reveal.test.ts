import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionProcessor } from "../../src/session/processor"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("search-native Skill reveal", () => {
  test("materializes exact selected Skills and reconstructs an expanded loader from receipts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          primary_assistant_capabilities: {
            work: { skill_refs: ["work-artifacts", "research-report"], mcp_server_refs: [] },
          },
        })
        const config = await Config.get()
        const model = {
          id: "skill-reveal-model",
          providerID: "skill-reveal-provider",
          name: "Skill reveal",
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
          api: { id: "skill-reveal", npm: "@ai-sdk/anthropic" },
          options: {},
        } as any
        const session = await Session.create({ kind: "assistant", title: "Exact Skill reveal" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "work",
          agent: "work",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant" as const,
          author: "work",
          agent: "work",
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
          agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("work", { config })),
          agentID: "work",
          messages: await Session.messages({ sessionID: session.id }),
        }
        const initial = await resolveTestCapabilityTools(common)
        expect(Object.keys(initial.tools)).toEqual(["capability_search"])
        const loaderRef = initial.occurrence.ref("skill")
        expect(
          initial.occurrence.grants.grants.find(
            (grant) => grant.ref.kind === "tool" && grant.ref.local_ref === "skill",
          )?.access,
        ).toBe("execute")
        await expect(
          initial.tools.capability_search!.execute!(
            { queries: ["skill"], exact_refs: [loaderRef], deactivate_refs: [], limit: 5 },
            { toolCallId: "call_reveal_direct_skill_loader", messages: [], abortSignal: new AbortController().signal },
          ),
        ).rejects.toThrow("not discoverable")

        const { tools } = await resolveTestCapabilityTools({
          ...common,
          messages: await Session.messages({ sessionID: session.id }),
          activeLocalRefs: ["work-artifacts"],
        })
        expect(Object.keys(tools).sort()).toEqual(["capability_search", "skill"])
        const skill = tools.skill
        if (!skill?.execute) throw new Error("Exact Skill loader is unavailable after reveal")
        const loaded = (await skill.execute(
          { name: "work-artifacts" },
          { toolCallId: "call_load_exact_work_artifacts", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
        expect(loaded.output).toContain("Work Artifacts")
        await processor.completeRecoveredToolPart({
          toolCallID: "call_load_exact_work_artifacts",
          toolInput: { name: "work-artifacts" },
          output: loaded,
        })
        const expanded = await resolveTestCapabilityTools({ ...common, activeLocalRefs: ["research-report"] })
        const expandedList = await expanded.tools.skill!.execute!(
          {},
          { toolCallId: "call_list_expanded_skills", messages: [], abortSignal: new AbortController().signal },
        ) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"] & { metadata: { names: string[] } }
        expect(expandedList.metadata.names.sort()).toEqual(["research-report", "work-artifacts"])
        await processor.completeRecoveredToolPart({
          toolCallID: "call_list_expanded_skills",
          toolInput: {},
          output: expandedList,
        })
        const reconstructed = await resolveTestCapabilityTools(common)
        const report = await reconstructed.tools.skill!.execute!(
          { name: "research-report" },
          { toolCallId: "call_load_reconstructed_report", messages: [], abortSignal: new AbortController().signal },
        ) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
        expect(report.metadata.name).toBe("research-report")
        expect(report.output).toContain('<skill_content name="research-report">')
        await processor.completeRecoveredToolPart({
          toolCallID: "call_load_reconstructed_report",
          toolInput: { name: "research-report" },
          output: report,
        })
      },
    })
  }, 30_000)
})
