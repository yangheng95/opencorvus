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
      "Use `panel_query_task` for lifecycle and acceptance facts, `panel_resume_task` for a reviewed inactive Task",
      "treat the exact visible Message as the sufficient current coordination fact and resolve it in this wake",
      "A visible scheduler Message instead follows the bounded coordination path under SCHEDULER COMMUNICATION",
      "In the first `capability_search`, activate the canonical `{kind:\"tool\",source:\"platform\",owner_ref:\"tool-registry\",local_ref:\"scheduler_message\"}` exact ref",
      "Send the correlated reply, then end the response immediately so the Session can accept the next durable inbox",
      "end the response immediately so the Session can accept the next durable inbox",
      "complete only that exact fact's causal closure in this response",
      "first reveal and call `panel_query_task` for its exact Task",
      "carry only the returned `terminal_lifecycle_reference` into canonical Artifact enumeration",
      "execute every newly ready consumer dispatch or exact-Task recovery made due by that fact",
      "If accepting that exact Task makes final Mission completion due, expand this causal closure only to the completion preflight",
      "re-query the complete current child-Task set, read and bind every accepted Task's required canonical evidence in this same physical Turn, and then call `panel_complete_mission`",
      "Before the first final-preflight activation, deactivate every active leaf whose final result is already durable",
      "Activate at most one new final-preflight Tool exact ref in each `capability_search`",
      "deactivate it in the same search that activates the next exact leaf",
      "Do not combine this large publication leaf with another exact activation",
      "End the response only after that exact causal closure reaches its next durable stop",
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
      "bind that evidence with one `session` locator naming the current Orchestrator Session",
      "scheduler Protocol event IDs are not coordination-request evidence",
      "the recipient scheduler independently owns the answer and its reply ingress owns the future wake",
      "do not schedule `wait` for that reply",
    ]

    expect(requiredOrchestratorGuidance.map((clause) => ORCHESTRATOR_CORE.includes(clause))).toEqual(
      requiredOrchestratorGuidance.map(() => true),
    )
  })
})
