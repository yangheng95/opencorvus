import {
  PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS,
  PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS,
  PLATFORM_ARTIFACT_TOOL_IDS,
} from "./platform-artifact-tool-ids"
// Sourced from the profile registry rather than @/work/harness, which only re-exports it. The
// harness pulls prompt text and default-capability wiring, and that pulled this catalog into an
// import cycle: loading tool-id-catalog first threw a TDZ error on its own constants. The registry
// module is pure data with no imports, so the catalog now loads standalone.
import { WORK_ARTIFACT_TOOL_IDS } from "@/work-artifact/profile-registry"
import { PANEL_LEAF_TOOL_IDS } from "@/panel/action-ids"

export { WORK_ARTIFACT_TOOL_IDS } from "@/work-artifact/profile-registry"

export const SKILL_MARKET_TOOL_ID = "skill_market" as const
export const PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS = ["capability_search"] as const
export const NATIVE_MISSION_TRANSPORT_TOOL_IDS = ["mission_state", "scheduler_message"] as const

export const WORKER_COMMUNICATION_TOOL_IDS = ["request_orchestrator_decision", "send_mailbox_message"] as const
export const TASK_ARTIFACT_DISCOVERY_TOOL_IDS = PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS
export const TASK_ARTIFACT_PUBLISH_TOOL_IDS = PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS
export const TASK_ARTIFACT_SCHEDULER_TOOL_IDS = [...TASK_ARTIFACT_DISCOVERY_TOOL_IDS, "artifact_snapshot"] as const
export const TASK_ARTIFACT_TOOL_IDS = PLATFORM_ARTIFACT_TOOL_IDS

export const GLOBAL_TOOL_IDS = [
  "delegate_agent",
  "question",
  "bash",
  "browser_preview",
  "browser_preview_capture",
  "browser_preview_capture_interaction_state",
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
  SKILL_MARKET_TOOL_ID,
  ...TASK_ARTIFACT_TOOL_IDS,
  "publish_interactive_artifact",
  ...WORK_ARTIFACT_TOOL_IDS,
  "read",
  "glob",
  "search_code",
  "list",
  "edit",
  "write",
  "webfetch",
  "todowrite",
  "todoread",
  "websearch",
  "external_code_search",
  "skill",
  "mission_skill",
  "apply_patch",
  "memory",
  "schedule",
  "planner",
  ...PANEL_LEAF_TOOL_IDS,
  "expert_squad_author",
  "evolve_expert_squad_from_feedback",
  ...NATIVE_MISSION_TRANSPORT_TOOL_IDS,
  "wait",
  ...WORKER_COMMUNICATION_TOOL_IDS,
  "analytics",
] as const

export const GLOBAL_TOOL_ID_SET = new Set<string>(GLOBAL_TOOL_IDS)
