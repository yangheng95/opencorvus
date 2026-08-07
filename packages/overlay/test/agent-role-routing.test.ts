import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  AGENT_CARD_STAGES,
  agentIdentityLabel,
  agentStageLabel,
  classifyMessage,
  effectiveRole,
  normalizeAgentRole,
  orderedMessageParts,
  roleLabel,
} from "../src/utils/message"
import {
  isBoundaryMessagePart,
  isCardBodyMessagePart,
  isProtocolControlMessagePart,
  messagePartHasDisplayContent,
} from "../src/utils/message-part"
import { installRealOverlayI18n } from "./fixtures/i18n"

const EN_US = readFileSync(join(import.meta.dir, "../src/i18n/en-US.json"), "utf8")
const ZH_CN = readFileSync(join(import.meta.dir, "../src/i18n/zh-CN.json"), "utf8")

installRealOverlayI18n()

const SESSION_CARD_STAGES = [
  "assistant",
  "orchestrator",
  "mission",
  "intent-analysis",
  "requirements",
  "frontend-design",
  "frontend-research",
  "visual-qa",
  "goal-workload-analyst",
  "deep-research",
  "goal",
  "architect",
  "integrity",
  "fact-check",
  "executor",
  "build",
  "explore",
  "system",
] as const

test("session kinds used by message.channel have explicit agent roles and i18n labels", () => {
  for (const stage of SESSION_CARD_STAGES) {
    const role = normalizeAgentRole(stage)
    expect(AGENT_CARD_STAGES.has(role)).toBe(true)
    expect(roleLabel(role).length).toBeGreaterThan(0)
    expect(agentStageLabel(stage).length).toBeGreaterThan(0)
    if (role !== "assistant") {
      expect(roleLabel(role)).not.toBe("Assistant")
      expect(agentStageLabel(stage)).not.toBe("Assistant")
    }
    expect(EN_US).toContain(`"chat.role.${role}"`)
    expect(ZH_CN).toContain(`"chat.role.${role}"`)
  }
})

test("explore aliases and channel classification stay in the explore card", () => {
  expect(normalizeAgentRole("explorer")).toBe("explore")
  expect(
    classifyMessage(
      {
        info: {
          id: "msg_explore_dispatch",
          channel: "explore",
          resolvedRole: "orchestrator",
          role: "user",
          agent: "build",
        },
      },
      "root",
    ),
  ).toBe("explore")
})

test("message classification does not fall back from missing backend channel", () => {
  expect(() =>
    classifyMessage(
      {
        info: {
          id: "msg_missing_channel",
          resolvedRole: "build",
          role: "assistant",
          agent: "build",
        },
      },
      "root",
    ),
  ).toThrow(/missing channel/)
  expect(() =>
    effectiveRole({
      info: {
        id: "msg_missing_resolved_role",
        role: "assistant",
        agent: "build",
      },
    }),
  ).toThrow(/missing resolvedRole/)
})

test("ordered message parts exclude control-only step boundaries before CardParts", () => {
  const parts = orderedMessageParts({
    parts: [
      { id: "prt_step_start", type: "step-start" },
      { id: "prt_text_empty", type: "text", text: "" },
      { id: "prt_text_visible", type: "text", text: "visible text" },
      { id: "prt_step_finish", type: "step-finish" },
      { id: "prt_compaction", type: "compaction" },
      { id: "prt_snapshot", type: "snapshot" },
      { id: "prt_retry", type: "retry" },
      { id: "prt_reasoning_empty", type: "reasoning", text: "" },
      { id: "prt_boundary", type: "boundary" },
      { id: "prt_reasoning_visible", type: "reasoning", text: "visible reasoning" },
    ],
  })

  expect(parts.map((part) => part.id)).toEqual([
    "prt_reasoning_empty",
    "prt_reasoning_visible",
    "prt_text_empty",
    "prt_text_visible",
  ])
})

test("message part classification separates protocol controls from rendered separators", () => {
  expect(isProtocolControlMessagePart({ type: "step-start" })).toBe(true)
  expect(isProtocolControlMessagePart({ type: "step-finish" })).toBe(true)
  expect(isCardBodyMessagePart({ type: "step-start" })).toBe(false)
  expect(isCardBodyMessagePart({ type: "step-finish" })).toBe(false)

  expect(isProtocolControlMessagePart({ type: "boundary" })).toBe(false)
  expect(isBoundaryMessagePart({ type: "boundary" })).toBe(true)
  expect(isCardBodyMessagePart({ type: "boundary" })).toBe(false)
  expect(isCardBodyMessagePart({ type: "compaction" })).toBe(false)
  expect(messagePartHasDisplayContent({ type: "compaction", auto: true })).toBe(false)
  expect(isCardBodyMessagePart({ type: "snapshot", snapshot: "state" })).toBe(false)
  expect(isCardBodyMessagePart({ type: "retry", attempt: 1 })).toBe(false)

  expect(isCardBodyMessagePart({ type: "text", text: "" })).toBe(true)
  expect(messagePartHasDisplayContent({ type: "text", text: "" })).toBe(false)
  expect(isCardBodyMessagePart({ type: "reasoning", text: "[]" })).toBe(true)
  expect(messagePartHasDisplayContent({ type: "reasoning", text: "[]" })).toBe(false)
  expect(messagePartHasDisplayContent({ type: "reasoning", text: "[thinking]" })).toBe(false)
})

test("workload and deep-research session kinds do not collapse into assistant", () => {
  expect(normalizeAgentRole("goal-workload-analyst")).toBe("goal-workload-analyst")
  expect(normalizeAgentRole("workload_analysis")).toBe("goal-workload-analyst")
  expect(normalizeAgentRole("deep-research")).toBe("deep-research")
  expect(normalizeAgentRole("deep_research")).toBe("deep-research")
})

test("message identity labels preserve exact projected agent IDs", () => {
  expect(agentIdentityLabel("implementation-engineer", "build")).toBe("implementation-engineer")
  expect(agentIdentityLabel("build-repair-specialist", "build")).toBe("build-repair-specialist")
  expect(agentIdentityLabel(undefined, "user")).toBe("User")
  expect(agentIdentityLabel(undefined, "system")).toBe("System")
  expect(() => agentIdentityLabel(undefined, "build")).toThrow(/missing exact agentID/)
  expect(() => agentIdentityLabel("   ", "visual-qa")).toThrow(/missing exact agentID/)
})

test("retired acceptance identities fail instead of entering an agent card", () => {
  expect(() => normalizeAgentRole("acceptance")).toThrow(/retired Acceptance agent identity/)
})
