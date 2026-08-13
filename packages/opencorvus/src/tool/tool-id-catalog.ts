import {
  PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS,
  PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS,
  PLATFORM_ARTIFACT_TOOL_IDS,
} from "./platform-artifact-tool-ids"
import { WORK_ARTIFACT_TOOL_IDS } from "@/work/harness"

export { WORK_ARTIFACT_TOOL_IDS } from "@/work/harness"

export const BATCH_TOOL_ID = "batch" as const
export const PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS = ["capability_search"] as const

export const WORKER_COMMUNICATION_TOOL_IDS = ["request_orchestrator_decision", "send_mailbox_message"] as const
export const TASK_ARTIFACT_DISCOVERY_TOOL_IDS = PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS
export const TASK_ARTIFACT_PUBLISH_TOOL_IDS = PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS
export const TASK_ARTIFACT_SCHEDULER_TOOL_IDS = [
  ...TASK_ARTIFACT_DISCOVERY_TOOL_IDS,
  "artifact_snapshot",
] as const
export const TASK_ARTIFACT_TOOL_IDS = PLATFORM_ARTIFACT_TOOL_IDS

export const GLOBAL_TOOL_IDS = [
  "delegate_agent",
  "question",
  "bash",
  "browser_preview",
  "browser_preview_capture",
  "browser_preview_capture_interaction_state",
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
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
  "panel",
  "expert_squad_author",
  "mission_state",
  "scheduler_message",
  "wait",
  ...WORKER_COMMUNICATION_TOOL_IDS,
  "analytics",
  BATCH_TOOL_ID,
] as const

export const GLOBAL_TOOL_ID_SET = new Set<string>(GLOBAL_TOOL_IDS)
