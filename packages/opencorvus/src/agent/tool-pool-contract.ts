import type { AgentRoleID } from "./role-contract"
import { TASK_ARTIFACT_TOOL_IDS } from "@/tool/tool-id-catalog"
import { RuntimeTemplateID, type RuntimeTemplateID as RuntimeTemplateIDValue } from "./runtime-template-id"
import {
  ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS,
  ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS,
  PACKAGE_PROJECTABLE_BUILT_IN_TOOL_IDS,
  PACKAGE_PROJECTABLE_DEFAULT_HOST_TOOL_IDS,
  allPackageProjectableDefaultHostToolIDs as collectPackageProjectableDefaultHostToolIDs,
  coreBuiltInToolIDs as collectCoreBuiltInToolIDs,
  createToolPool,
  reservedCoreToolIDs as collectReservedCoreToolIDs,
  roleAssignments as configuredRoleAssignments,
  runtimeTemplateAssignments as configuredRuntimeTemplateAssignments,
  uniqueToolIDs,
  type ToolPoolAssignment,
} from "./tool-pool-data"

export type { ToolPoolAssignment } from "./tool-pool-data"

export namespace AgentToolPool {
  export const roleAssignments = configuredRoleAssignments
  export const runtimeTemplateAssignments = configuredRuntimeTemplateAssignments

  export function assignment(role: AgentRoleID): ToolPoolAssignment {
    return clone(roleAssignments[role])
  }

  export function runtimeTemplateAssignment(templateID: RuntimeTemplateIDValue): ToolPoolAssignment {
    const exactID = RuntimeTemplateID.get(templateID)
    return clone(runtimeTemplateAssignments[exactID])
  }

  export function orchestratorSchedulerRoleBaseToolIDs(): string[] {
    return uniqueToolIDs(ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS)
  }

  export function orchestratorSchedulerProjectableToolIDs(): Set<string> {
    return new Set(ORCHESTRATOR_SCHEDULER_PROJECTABLE_TOOL_IDS)
  }

  export function projectableRuntimeTemplateBuiltInToolIDs(templateID: RuntimeTemplateIDValue): Set<string> {
    const exactID = RuntimeTemplateID.get(templateID)
    return new Set([
      ...visibleToolIDs(runtimeTemplateAssignments[exactID]),
      ...TASK_ARTIFACT_TOOL_IDS,
      ...(PACKAGE_PROJECTABLE_BUILT_IN_TOOL_IDS[exactID] ?? []),
    ])
  }

  export function packageProjectableDefaultHostToolIDs(role: AgentRoleID): Set<string> {
    return new Set(PACKAGE_PROJECTABLE_DEFAULT_HOST_TOOL_IDS[role as RuntimeTemplateIDValue] ?? [])
  }

  export function packageProjectableDefaultHostToolIDsForRuntimeTemplate(
    templateID: RuntimeTemplateIDValue,
  ): Set<string> {
    return new Set(PACKAGE_PROJECTABLE_DEFAULT_HOST_TOOL_IDS[RuntimeTemplateID.get(templateID)] ?? [])
  }

  export function allPackageProjectableDefaultHostToolIDs(): Set<string> {
    return collectPackageProjectableDefaultHostToolIDs()
  }

  export function normalize(input: Partial<ToolPoolAssignment> | undefined): ToolPoolAssignment {
    return createToolPool({
      global: input?.global ?? [],
      private: input?.private ?? [],
    })
  }

  export function clone(input: ToolPoolAssignment): ToolPoolAssignment {
    return createToolPool(input)
  }

  export function defaultRuntimeToolSwitchesForRuntimeTemplate(
    templateID: RuntimeTemplateIDValue,
  ): Record<string, boolean> {
    return {
      ...(runtimeTemplateAssignments[RuntimeTemplateID.get(templateID)].defaultRuntimeToolSwitches ?? {}),
    }
  }

  export function visibleToolIDs(input: Partial<ToolPoolAssignment> | undefined): Set<string> {
    const normalized = normalize(input)
    return new Set([...normalized.global, ...normalized.private])
  }

  export function hasTool(input: Partial<ToolPoolAssignment> | undefined, toolID: string): boolean {
    return visibleToolIDs(input).has(toolID)
  }

  export function coreBuiltInToolIDs(): Set<string> {
    return collectCoreBuiltInToolIDs()
  }

  export function reservedCoreToolIDs(): Set<string> {
    return collectReservedCoreToolIDs()
  }

}
