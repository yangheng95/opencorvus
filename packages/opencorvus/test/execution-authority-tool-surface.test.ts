import { afterAll, describe, expect, test } from "bun:test"
import { AgentToolPool } from "../src/agent/tool-pool-contract"
import { WORK_ARTIFACT_TOOL_IDS } from "../src/tool/tool-id-catalog"
import { permissionDescriptor } from "../src/permission/invocation"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { MISSION_PANEL_LEAF_TOOL_IDS, RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS } from "../src/panel/action-ids"

afterAll(async () => {
  await resetMemoryDatabase()
})

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
        global: ["delegate_agent", "skill_market", ...conversationEffects],
        private: [],
      },
      chat: {
        global: ["delegate_agent", "skill_market", ...conversationEffects, ...RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS],
        private: [],
      },
      work: {
        global: [
          "delegate_agent",
          "skill_market",
          ...conversationEffects,
          ...RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS,
          ...WORK_ARTIFACT_TOOL_IDS,
        ],
        private: [],
      },
      mission: {
        global: [
          "skill_market",
          ...conversationEffects,
          "mission_skill",
          ...MISSION_PANEL_LEAF_TOOL_IDS,
          "scheduler_message",
          "wait",
        ],
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

  test("classifies validation as a local-write lifecycle because it persists renders and a receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const descriptor = await permissionDescriptor({
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "work_artifact_validate",
          args: { profile: "office.presentation@1", source_url: "attachment://project/source.pptx" },
        })
        expect({ effectClass: descriptor?.effectClass, resource: descriptor?.scope.resource }).toEqual({
          effectClass: "write_local",
          resource: {
            scope_type: "filesystem",
            operation: "work_artifact_validate",
            working_directory: project.path,
            payload_sha256: expect.any(String),
          },
        })
      },
    })
  })

  test("classifies Skill Market inspection and exact installation as distinct network-read and local-write effects", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const inspected = await permissionDescriptor({
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "skill_market",
          args: { action: "inspect", id: "openai/skills/pdfs" },
        })
        const installed = await permissionDescriptor({
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "skill_market",
          args: {
            action: "install",
            id: "openai/skills/pdfs",
            expected_hash: "a".repeat(64),
            policy: "deny",
          },
        })
        expect({
          inspect: { effectClass: inspected?.effectClass, resource: inspected?.scope.resource },
          install: { effectClass: installed?.effectClass, resource: installed?.scope.resource },
        }).toEqual({
          inspect: {
            effectClass: "network_read",
            resource: {
              scope_type: "skill_market",
              operation: "inspect",
              endpoint: {
                scheme: "https",
                hostname: "skills.sh",
                port: "443",
                pathname: "/",
                query_sha256: undefined,
                fragment_present: false,
              },
              query_sha256: undefined,
              candidate_id: "openai/skills/pdfs",
              expected_hash: undefined,
              policy: undefined,
              request_sha256: expect.any(String),
            },
          },
          install: {
            effectClass: "write_local",
            resource: {
              scope_type: "skill_market",
              operation: "install",
              endpoint: {
                scheme: "https",
                hostname: "skills.sh",
                port: "443",
                pathname: "/",
                query_sha256: undefined,
                fragment_present: false,
              },
              query_sha256: undefined,
              candidate_id: "openai/skills/pdfs",
              expected_hash: "a".repeat(64),
              policy: "deny",
              request_sha256: expect.any(String),
            },
          },
        })
      },
    })
  })
})
