import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { StaleCatalogOccurrenceError } from "../../src/capability/catalog-binding"
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
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: '@skill("work-artifacts") Prepare the report.',
          source: "user",
          kind: "user_content",
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
        const routineNames = [
          "capability_search",
          "bash",
          "delegate_agent",
          "edit",
          "external_code_search",
          "glob",
          "memory",
          "mission_state",
          "panel_cancel_task",
          "panel_create_task",
          "panel_delete_goal",
          "panel_query_task",
          "panel_query_task_artifacts",
          "panel_respond_interaction",
          "panel_select_workspace",
          "panel_send_task_message",
          "panel_update_checks",
          "panel_update_goal",
          "panel_wake_mission",
          "panel_wake_work",
          "planner",
          "publish_interactive_artifact",
          "question",
          "read",
          "schedule",
          "search_code",
          "skill_market",
          "todo",
          "webfetch",
          "websearch",
          "work_artifact_author",
          "work_artifact_deliver",
          "work_artifact_inspect",
          "work_artifact_validate",
          "write",
          "skill",
        ]
        expect(Object.keys(initial.tools)).toEqual(routineNames)
        const loaderRef = initial.occurrence.ref("skill")
        expect(
          initial.occurrence.grants.grants.find((grant) => grant.ref.kind === "tool" && grant.ref.local_ref === "skill")
            ?.access,
        ).toBe("execute")
        await expect(
          initial.tools.capability_search!.execute!(
            { queries: ["skill"], exact_refs: [loaderRef], deactivate_refs: [], limit: 5 },
            { toolCallId: "call_reveal_direct_skill_loader", messages: [], abortSignal: new AbortController().signal },
          ),
        ).rejects.toThrow("not discoverable")

        const skill = initial.tools.skill
        if (!skill?.execute) throw new Error("Explicit Skill loader is unavailable in the permanent base")
        expect(skill.description).toStartWith("Load an exact")
        expect(skill.description).toContain("exact Skill name is already visible in the request")
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
        const expanded = await resolveTestCapabilityTools({
          ...common,
          messages: await Session.messages({ sessionID: session.id }),
          activeLocalRefs: ["research-report"],
        })
        const expandedList = (await expanded.tools.skill!.execute!(
          {},
          { toolCallId: "call_list_expanded_skills", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"] & { metadata: { names: string[] } }
        expect(expandedList.metadata.names.sort()).toEqual(["research-report", "work-artifacts"])
        await processor.completeRecoveredToolPart({
          toolCallID: "call_list_expanded_skills",
          toolInput: {},
          output: expandedList,
        })
        const reconstructed = await resolveTestCapabilityTools(common)
        const report = (await reconstructed.tools.skill!.execute!(
          { name: "research-report" },
          { toolCallId: "call_load_reconstructed_report", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
        expect(report.metadata.name).toBe("research-report")
        expect(report.output).toContain('<skill_content name="research-report">')
        await processor.completeRecoveredToolPart({
          toolCallID: "call_load_reconstructed_report",
          toolInput: { name: "research-report" },
          output: report,
        })
        await expect(resolveTestCapabilityTools({ ...common, tools: { skill: false } })).rejects.toBeInstanceOf(
          StaleCatalogOccurrenceError,
        )
        await Session.setPermission({
          sessionID: session.id,
          permission: [{ permission: "skill", pattern: "research-report", action: "deny" }],
        })
        await expect(
          resolveTestCapabilityTools({
            ...common,
            session: await Session.get(session.id),
          }),
        ).rejects.toBeInstanceOf(StaleCatalogOccurrenceError)

        const deniedSession = await Session.create({ kind: "assistant", title: "Denied explicit Skill reveal" })
        await Session.setPermission({
          sessionID: deniedSession.id,
          permission: [{ permission: "skill", pattern: "work-artifacts", action: "deny" }],
        })
        const deniedUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: deniedSession.id,
          role: "user",
          author: "work",
          agent: "work",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: deniedSession.id,
          messageID: deniedUser.id,
          type: "text",
          text: '@skill("work-artifacts") Find another applicable Skill.',
          source: "user",
          kind: "user_content",
        })
        const deniedAssistant = {
          ...assistant,
          id: Identifier.ascending("message"),
          parentID: deniedUser.id,
          sessionID: deniedSession.id,
        }
        const deniedProcessor = SessionProcessor.create({
          assistantMessage: deniedAssistant,
          sessionID: deniedSession.id,
          model,
          abort: new AbortController().signal,
        })
        const deniedCommon = {
          ...common,
          session: await Session.get(deniedSession.id),
          assistant: deniedAssistant,
          processor: deniedProcessor,
          messages: await Session.messages({ sessionID: deniedSession.id }),
        }
        const deniedInitial = await resolveTestCapabilityTools(deniedCommon)
        const deniedList = (await deniedInitial.tools.skill!.execute!(
          {},
          { toolCallId: "call_list_denied_explicit_skill", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof deniedProcessor.completeRecoveredToolPart>[0]["output"] & {
          metadata: { names: string[] }
        }
        expect({ description: deniedInitial.tools.skill!.description, names: deniedList.metadata.names }).toEqual({
          description: expect.stringContaining("Current agent: work"),
          names: [],
        })
        await deniedProcessor.completeRecoveredToolPart({
          toolCallID: "call_list_denied_explicit_skill",
          toolInput: {},
          output: deniedList,
        })
        const allowedExpansion = await resolveTestCapabilityTools({
          ...deniedCommon,
          messages: await Session.messages({ sessionID: deniedSession.id }),
          activeLocalRefs: ["research-report"],
        })
        const allowedList = (await allowedExpansion.tools.skill!.execute!(
          {},
          { toolCallId: "call_list_allowed_expansion", messages: [], abortSignal: new AbortController().signal },
        )) as Parameters<typeof deniedProcessor.completeRecoveredToolPart>[0]["output"] & {
          metadata: { names: string[] }
        }
        expect(allowedList.metadata.names).toEqual(["research-report"])
        await deniedProcessor.completeRecoveredToolPart({
          toolCallID: "call_list_allowed_expansion",
          toolInput: {},
          output: allowedList,
        })
      },
    })
  }, 30_000)
})
