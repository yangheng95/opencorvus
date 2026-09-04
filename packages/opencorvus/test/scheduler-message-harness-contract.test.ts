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
      "When `mission_state` or `scheduler_message` is visible on the current Provider surface",
      "use that exact current-occurrence Tool directly and do not reveal it through `capability_search`",
      "One `snapshot` returns one revision plus all four files with exact existence, byte count, and content",
      "One `commit` must pass that exact `base_revision`",
      "Do not split one logical state read or commit into per-file Tool calls",
      "Call one `mission_state` snapshot and read `frontier.md`, `handoff.md`, and `tasks.md` from that result first",
      "Commit every changed Mission-state file together",
      "Send the correlated reply, then end the response immediately so the Session can accept the next durable inbox",
      "end the response immediately so the Session can accept the next durable inbox",
      "complete only that exact fact's causal closure in this response",
      "call them in that causal order, without copying any terminal event ID",
      "the Host binds the exact persisted query row",
      "execute every newly ready consumer dispatch or exact-Task recovery made due by that fact",
      "If accepting that exact Task makes final Mission completion due, expand this causal closure only to completion",
      "record every Host-minted `artifact_read_ref` emitted by the complete supplied chunk sequence beside its authored acceptance in `tasks.md`",
      "Supply the complete child-Task set and the full retained chunk-reference set required to prove byte coverage for each Task",
      "The Host resolves only those prior immutable reads from this Mission Session",
      "do not re-query or re-read an already accepted unchanged terminal occurrence",
      "Package-revision bindings, execution-capsule bindings, and Task-root ingress dispositions are control-plane audit facts, not acceptance inputs merely because they appear in the same catalog",
      "read its current Completion Decision as the required terminal Artifact and read an additional control-plane fact only to resolve a concrete contradiction or missing acceptance fact",
      "Treat its subject, body, correlation, delivery, and progress as fields of the scheduler Message, which remains their sole durable coordination evidence",
      "Mission state records only authored stage graph, ownership, acceptance judgment, dependency frontier, force-majeure blocker, next-wake action, and operator-visible outcome",
      "If none of those authored facts changes, do not call `mission_state`",
      "include every exact authored file thereby made stale in one `mission_state` commit",
      "activate the canonical exact refs for `panel_query_task`, `panel_query_task_artifacts`, and `panel_read_task_artifact` together",
      "deactivate the small audit group, reveal only `publish_interactive_artifact`",
      "Do not combine this large publication leaf with another exact activation",
      "activating only the canonical exact ref for `panel_complete_mission`",
      "An unchanged accepted terminal Task is not queried or read again",
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
      "owner_ref:\"runtime-projection:orchestrator\",local_ref:\"scheduler_message\"",
      "owner_ref:\"runtime-projection:orchestrator\",local_ref:\"no_action\"",
      "owner_ref:\"runtime-projection:orchestrator\",local_ref:\"manage_task\"",
      "activate all required exact refs directly in the first `capability_search`",
      "Activate `scheduler_message` and `no_action` together",
      "activate `scheduler_message` and `manage_task` together",
    ]

    expect(requiredOrchestratorGuidance.map((clause) => ORCHESTRATOR_CORE.includes(clause))).toEqual(
      requiredOrchestratorGuidance.map(() => true),
    )
  })
})
