import { FRONTEND_DESIGN_STATIC_TOOL_IDS } from "@/frontend-design/static-tools"
import { INTEGRITY_DECLARED_TOOL_IDS } from "@/integrity/tool-ids"
import {
  FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS,
  VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS,
  WEBPAGE_EVIDENCE_DEFAULT_HOST_TOOL_IDS,
} from "@/tool/non-base-tool-ids"
import {
  GLOBAL_TOOL_IDS,
  GLOBAL_TOOL_ID_SET,
  PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
  SKILL_MARKET_TOOL_ID,
  TASK_ARTIFACT_SCHEDULER_TOOL_IDS,
  WORKER_COMMUNICATION_TOOL_IDS,
} from "@/tool/tool-id-catalog"
import { VISUAL_QA_STATIC_TOOL_IDS } from "@/visual-qa/static-tools"
import { WORK_ARTIFACT_TOOL_IDS } from "@/work/harness"
import {
  EXPLORE_PANEL_LEAF_TOOL_IDS,
  MISSION_PANEL_LEAF_TOOL_IDS,
  PANEL_LEAF_TOOL_IDS,
  RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS,
} from "@/panel/action-ids"
import type { AgentRoleID } from "./role-contract"
import type { RuntimeTemplateID } from "./runtime-template-id"

export interface ToolPoolAssignment {
  global: string[]
  private: string[]
  defaultRuntimeToolSwitches?: Record<string, boolean>
}

const BUILD_DEFAULT_DISABLED_RUNTIME_TOOL_IDS = [
  "webfetch",
  "websearch",
  "external_code_search",
  "memory",
  "planner",
] as const

const STAGE_CONTEXT_GLOBAL_TOOL_IDS = [
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
  "read",
  "glob",
  "search_code",
  "list",
  "memory",
  "skill",
  "publish_interactive_artifact",
  ...WORKER_COMMUNICATION_TOOL_IDS,
] as const

const ORCHESTRATOR_PRIVATE_TOOL_IDS = [
  "no_action",
  "scheduler_message",
  "dispatch_agent",
  "dispatch_agents",
  "manage_task",
  "explore",
  "add_goal",
  "modify_goal",
  "delete_goal",
  "read_task_message",
  "read_agent_message",
  "respond_agent_coordination",
  "cancel_subagent",
  "read_context",
  "multica_catalog",
  "multica_preview",
  "multica_import",
  "expert_squad_author",
] as const

export const ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS = [
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
  "skill",
  "question",
  "no_action",
  "scheduler_message",
  "read_context",
  "dispatch_agent",
  "manage_task",
  "wait",
  "read_task_message",
  "read_agent_message",
  "respond_agent_coordination",
  "cancel_subagent",
  ...TASK_ARTIFACT_SCHEDULER_TOOL_IDS,
  "publish_interactive_artifact",
  // The core Orchestrator prompt tells every scheduler to offer squad
  // evolution when the operator states a durable preference. A prompt that
  // names a Tool the projection withheld is an instruction the model cannot
  // follow, so this belongs to the inherited base rather than per-package
  // grants.
  "evolve_expert_squad_from_feedback",
] as const

export const ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS = [
  ...ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS,
  "dispatch_agents",
  "read",
  "browser_preview",
  "browser_preview_capture",
  "bash",
  "multica_catalog",
  "multica_preview",
  "multica_import",
  "expert_squad_author",
] as const

export const PACKAGE_PROJECTABLE_DEFAULT_HOST_TOOL_IDS: Partial<Record<RuntimeTemplateID, readonly string[]>> = {
  "frontend-design": FRONTEND_DESIGN_EXPERT_DEFAULT_TOOL_IDS,
  "frontend-research": WEBPAGE_EVIDENCE_DEFAULT_HOST_TOOL_IDS,
  "visual-qa": VISUAL_QA_EXPERT_DEFAULT_TOOL_IDS,
}

export const PACKAGE_PROJECTABLE_BUILT_IN_TOOL_IDS: Partial<Record<RuntimeTemplateID, readonly string[]>> = {
  build: WORK_ARTIFACT_TOOL_IDS,
}

export function uniqueToolIDs(input: readonly string[]): string[] {
  return [...new Set(input)]
}

export function createToolPool(input: {
  global?: readonly string[]
  private?: readonly string[]
  defaultRuntimeToolSwitches?: Readonly<Record<string, boolean>>
}): ToolPoolAssignment {
  const assignment: ToolPoolAssignment = {
    global: Object.freeze(uniqueToolIDs(input.global ?? [])) as string[],
    private: Object.freeze(uniqueToolIDs(input.private ?? [])) as string[],
    ...(input.defaultRuntimeToolSwitches
      ? { defaultRuntimeToolSwitches: Object.freeze({ ...input.defaultRuntimeToolSwitches }) }
      : {}),
  }
  return Object.freeze(assignment)
}

function fromVisibleToolIDs(input: readonly string[]): ToolPoolAssignment {
  const global: string[] = []
  const privateTools: string[] = []
  for (const id of input) {
    if (GLOBAL_TOOL_ID_SET.has(id)) global.push(id)
    else privateTools.push(id)
  }
  return createToolPool({ global, private: privateTools })
}

const primaryExecutionGlobal = [
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
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

const codingGlobal = ["delegate_agent", SKILL_MARKET_TOOL_ID, ...primaryExecutionGlobal] as const

const taskBuildGlobal = [
  ...primaryExecutionGlobal,
  "browser_preview",
  "browser_preview_capture",
  ...WORKER_COMMUNICATION_TOOL_IDS,
] as const

const delegatedWorkerGlobal = [
  ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
  "question",
  "bash",
  "browser_preview",
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
  ...WORKER_COMMUNICATION_TOOL_IDS,
] as const

export const runtimeTemplateAssignments = Object.freeze({
  "delegated-worker": createToolPool({ global: delegatedWorkerGlobal }),
  build: createToolPool({
    global: taskBuildGlobal,
    defaultRuntimeToolSwitches: {
      skill: true,
      ...Object.fromEntries(BUILD_DEFAULT_DISABLED_RUNTIME_TOOL_IDS.map((toolID) => [toolID, false])),
    },
  }),
  "visual-qa": fromVisibleToolIDs([
    ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
    ...VISUAL_QA_STATIC_TOOL_IDS,
    "publish_interactive_artifact",
  ]),
  explore: createToolPool({
    global: [
      ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
      "read",
      "glob",
      "search_code",
      "external_code_search",
      "webfetch",
      "websearch",
      ...EXPLORE_PANEL_LEAF_TOOL_IDS,
      "publish_interactive_artifact",
      "memory",
      ...WORKER_COMMUNICATION_TOOL_IDS,
    ],
  }),
  requirements: createToolPool({ global: [...STAGE_CONTEXT_GLOBAL_TOOL_IDS, "websearch", "todoread", "todowrite"] }),
  architect: createToolPool({ global: [...STAGE_CONTEXT_GLOBAL_TOOL_IDS, "websearch", "todoread", "todowrite"] }),
  "frontend-design": fromVisibleToolIDs([
    ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
    ...FRONTEND_DESIGN_STATIC_TOOL_IDS,
    "publish_interactive_artifact",
  ]),
  "intent-analysis": createToolPool({ global: [...STAGE_CONTEXT_GLOBAL_TOOL_IDS, "todoread", "todowrite"] }),
  integrity: fromVisibleToolIDs([
    ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
    ...INTEGRITY_DECLARED_TOOL_IDS,
    "publish_interactive_artifact",
  ]),
  "fact-check": createToolPool({
    global: [
      ...STAGE_CONTEXT_GLOBAL_TOOL_IDS,
      "bash",
      "websearch",
      "webfetch",
      "external_code_search",
      "todoread",
      "todowrite",
    ],
  }),
  "deep-research": createToolPool({
    global: [
      ...STAGE_CONTEXT_GLOBAL_TOOL_IDS,
      "websearch",
      "webfetch",
      "external_code_search",
      "todoread",
      "todowrite",
    ],
  }),
  "frontend-research": createToolPool({
    global: [
      ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
      "read",
      "skill",
      "websearch",
      "apply_patch",
      "bash",
      "publish_interactive_artifact",
      ...WORKER_COMMUNICATION_TOOL_IDS,
    ],
    defaultRuntimeToolSwitches: {
      apply_patch: false,
      bash: false,
    },
  }),
  "goal-workload-analyst": createToolPool({ global: [...STAGE_CONTEXT_GLOBAL_TOOL_IDS, "todoread", "todowrite"] }),
} satisfies Record<RuntimeTemplateID, ToolPoolAssignment>)

export const roleAssignments = Object.freeze({
  coding: createToolPool({ global: codingGlobal }),
  chat: createToolPool({ global: [...codingGlobal, ...RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS] }),
  work: createToolPool({
    global: [...codingGlobal, ...RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS, ...WORK_ARTIFACT_TOOL_IDS],
  }),
  compaction: createToolPool({}),
  title: createToolPool({}),
  summary: createToolPool({}),
  memory: createToolPool({}),
  control: createToolPool({ global: [...PANEL_LEAF_TOOL_IDS] }),
  orchestrator: createToolPool({
    global: [
      ...PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS,
      "analytics",
      "publish_interactive_artifact",
      "browser_preview",
      "bash",
      "wait",
      "skill",
      "question",
      "todowrite",
      "todoread",
    ],
    private: ORCHESTRATOR_PRIVATE_TOOL_IDS,
  }),
  mission: createToolPool({
    global: [
      SKILL_MARKET_TOOL_ID,
      ...primaryExecutionGlobal,
      "mission_skill",
      ...MISSION_PANEL_LEAF_TOOL_IDS,
      "scheduler_message",
      "wait",
    ],
  }),
} satisfies Record<AgentRoleID, ToolPoolAssignment>)

export function allPackageProjectableDefaultHostToolIDs(): Set<string> {
  return new Set(Object.values(PACKAGE_PROJECTABLE_DEFAULT_HOST_TOOL_IDS).flatMap((toolIDs) => toolIDs ?? []))
}

export function coreBuiltInToolIDs(): Set<string> {
  const ids = new Set<string>(GLOBAL_TOOL_IDS)
  for (const assignment of [...Object.values(roleAssignments), ...Object.values(runtimeTemplateAssignments)]) {
    for (const toolID of [...assignment.global, ...assignment.private]) ids.add(toolID)
  }
  return ids
}

export function reservedCoreToolIDs(): Set<string> {
  return new Set([...coreBuiltInToolIDs(), ...allPackageProjectableDefaultHostToolIDs()])
}
