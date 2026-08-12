import { describe, expect, test } from "bun:test"
import { AgentToolPool } from "../src/agent/tool-pool-contract"
import { OFFICE_ARTIFACT_TOOL_IDS } from "../src/tool/tool-id-catalog"

const conversationEffects = [
  "capability_search",
  "question",
  "bash",
  "publish_interactive_artifact",
  "read",
  "glob",
  "search_code",
  "edit",
  "write",
  "webfetch",
  "todowrite",
  "todoread",
  "websearch",
  "external_code_search",
  "skill",
  "apply_patch",
  "memory",
  "schedule",
  "planner",
  "mission_state",
  "batch",
] as const

describe("execution authority Tool surfaces", () => {
  test("projects the complete standalone and Task-owned Tool contracts", () => {
    expect({
      coding: AgentToolPool.assignment("coding"),
      chat: AgentToolPool.assignment("chat"),
      work: AgentToolPool.assignment("work"),
      mission: AgentToolPool.assignment("mission"),
      taskBuild: AgentToolPool.runtimeTemplateAssignment("build"),
    }).toEqual({
      coding: {
        global: ["delegate_agent", ...conversationEffects],
        private: [],
      },
      chat: {
        global: ["delegate_agent", ...conversationEffects, "panel"],
        private: [],
      },
      work: {
        global: ["delegate_agent", ...conversationEffects, "panel", ...OFFICE_ARTIFACT_TOOL_IDS],
        private: [],
      },
      mission: {
        global: [...conversationEffects, "mission_skill", "panel", "scheduler_message", "wait"],
        private: [],
      },
      taskBuild: {
        global: [
          ...conversationEffects,
          "browser_preview",
          "browser_preview_capture",
          "request_orchestrator_decision",
          "send_mailbox_message",
        ],
        private: [],
        defaultRuntimeToolSwitches: {
          skill: true,
          webfetch: false,
          websearch: false,
          external_code_search: false,
          memory: false,
          planner: false,
        },
      },
    })
  })

  test("projects durable scheduler communication to both scheduler roles", () => {
    expect({
      mission: AgentToolPool.assignment("mission").global.includes("scheduler_message"),
      orchestrator: AgentToolPool.assignment("orchestrator").private.includes("scheduler_message"),
    }).toEqual({
      mission: true,
      orchestrator: true,
    })
  })
})
