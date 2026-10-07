import { afterEach, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { createRightSidebarConversationSession } from "@/chat/session"
import { RuntimeCapabilityCatalog } from "@/tool/capability-runtime-catalog"
import { searchCapabilityCatalog } from "@/capability/catalog"
import { PanelTool } from "@/tool/panel"
import { Tool } from "@/tool/tool"
import { CreateTaskInput } from "@/engine/model"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("native Task creators search installed candidates and inspect exact capability identities", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await createRightSidebarConversationSession("work", { title: "Automatic expert selection" })
      const config = await Config.get()
      const { caller, snapshot } = await RuntimeCapabilityCatalog.snapshot({
        sessionID: session.id,
        agentID: "work",
        config,
        permission: [],
        executionToolIDs: ["capability_search", "panel_create_task", "panel_expert_squad_inspect"],
      })
      const candidates = searchCapabilityCatalog(snapshot, caller, {
        queries: ["Research Studio"],
        kinds: ["expert_squad"],
        product_pillar: "work",
        limit: 5,
      })
      expect(candidates[0]).toMatchObject({
        ref: { kind: "expert_squad", local_ref: "research-studio" },
        next_owner: { kind: "create_task_with_expert_squad", profile_id: "research-studio" },
      })
      const panel = await PanelTool.init({ agentID: "work", config })
      const result = await panel.execute(
        { action: "expert_squad_inspect", id: "research-studio" },
        {
          sessionID: session.id,
          messageID: "msg_candidate_read",
          callID: "call_candidate_read",
          agent: "work",
          abort: new AbortController().signal,
          messages: [],
          extra: { surface: "right-sidebar" },
          executionSurface: Tool.executionSurface(["panel_expert_squad_inspect"], []),
          metadata() {},
        },
      )
      const inspection = JSON.parse(result.output).squad
      expect(inspection).toMatchObject({ id: "research-studio", agent_count: 5, next_agent_cursor: null })
      expect(inspection.agents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agent_id: "research-studio-researcher",
            base_role: "deep-research",
            capability_refs: expect.arrayContaining([
              "capability:tool:platform:tool-registry:webfetch",
              "capability:tool:platform:tool-registry:websearch",
            ]),
          }),
          expect.objectContaining({ agent_id: "research-studio-writer", base_role: "build" }),
        ]),
      )
      const generated = searchCapabilityCatalog(snapshot, caller, {
        queries: ["Dynamic"],
        kinds: ["expert_squad"],
        limit: 5,
      })
      expect(generated[0]).toMatchObject({ ref: { local_ref: "dynamic" }, next_owner: { profile_id: "dynamic" } })
    },
  })
}, 30_000)

test.each(["research-studio", "dynamic", "base"])(
  "fixed Task creation preserves exact selected identity %s",
  (promptProfile) => {
    const input = CreateTaskInput.parse({
      request: "Deliver the original outcome.",
      productPillar: "work",
      promptProfile,
    })
    expect(input.promptProfile).toBe(promptProfile)
  },
)

test("fixed Task creation reports the exact missing identity field", () => {
  const parsed = CreateTaskInput.safeParse({ request: "Deliver the original outcome.", productPillar: "work" })
  expect(parsed.success ? [] : parsed.error.issues.map((issue) => ({ code: issue.code, path: issue.path }))).toEqual([
    { code: "invalid_type", path: ["promptProfile"] },
  ])
})
