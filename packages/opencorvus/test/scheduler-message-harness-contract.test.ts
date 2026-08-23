import { describe, expect, test } from "bun:test"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import MISSION_CORE from "../src/prompt/core/mission-core.txt" with { type: "text" }
import ORCHESTRATOR_CORE from "../src/prompt/core/orchestrator-core.txt" with { type: "text" }

describe("scheduler message model harness", () => {
  test("teaches Mission when to initiate and resolve durable Task communication", () => {
    const requiredMissionGuidance = [
      "`scheduler_message` is the durable scheduler-to-scheduler channel between this Mission and one active owned Task",
      "Use it proactively when a running Task needs a Mission decision, a dependency-bearing directive, or context that another scheduler must receive",
      "Delivery means the recipient ingress is durable; it is not the answer",
      "Use `reply` only for the current scheduler request and pass its exact `event_id` as `reply_to`",
      "Use `panel.query_task` for lifecycle and acceptance facts, `resume_task` for a reviewed inactive Task",
      "Resolve it in this wake and send the correlated reply before unrelated reconciliation",
    ]

    expect(requiredMissionGuidance.map((clause) => MISSION_CORE.includes(clause))).toEqual(
      requiredMissionGuidance.map(() => true),
    )
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("mission")).toContain(MISSION_CORE)
  })

  test("teaches the Task Orchestrator proactive Mission and sibling coordination", () => {
    const requiredOrchestratorGuidance = [
      "`scheduler_message` is this Task Orchestrator's durable channel to its owning Mission and to a sibling Task scheduler owned by that same Mission",
      "Use it proactively for cross-Task dependencies, peer coordination, or a Mission decision or directive",
      "A durable delivery receipt is not the answer",
      "Use `reply` only for the current scheduler request and pass its exact `event_id` as `reply_to`",
      "Target `mission` for an owning-Mission decision or update",
      "resolve its requested scheduler action in this wake and send the exact correlated reply",
      "It never closes, suspends, or supplies future progress for a non-terminal Task",
      "A scheduler reply or notification does not itself provide future Task progress",
      "A Mission acceptance resume always opened a new non-terminal repair occurrence",
      "send its correlated reply and make that lifecycle decision in the same wake",
    ]

    expect(requiredOrchestratorGuidance.map((clause) => ORCHESTRATOR_CORE.includes(clause))).toEqual(
      requiredOrchestratorGuidance.map(() => true),
    )
  })
})
