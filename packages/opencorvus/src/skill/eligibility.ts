import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { CapabilityRules } from "@/capability/rules"
import type { Skill } from "./skill"
import { SkillPlatform } from "./platform"

export type SkillDisabledReason =
  | "skill_tool_unavailable"
  | "permission_denied"
  | "platform_incompatible"
  | "missing_required_tool"

export class SkillProjectionContractError extends Error {
  readonly code: "skill_loader_unprojected" | "skill_required_tool_unprojected"
  constructor(
    readonly capabilityRef: string,
    readonly toolID: string,
    context: string,
  ) {
    super(
      `${context}: Skill ${capabilityRef} requires projected Tool ${toolID}. Declare its exact capability within the runtime template's supported surface.`,
    )
    this.name = "SkillProjectionContractError"
    this.code = toolID === "skill" ? "skill_loader_unprojected" : "skill_required_tool_unprojected"
  }
}

export function assertSkillProjectionExecutable(input: {
  capabilityRef: string
  requiredTools: readonly string[]
  projectedToolIDs: ReadonlySet<string>
  context: string
}): void {
  for (const toolID of ["skill", ...input.requiredTools]) {
    if (!input.projectedToolIDs.has(toolID)) {
      throw new SkillProjectionContractError(input.capabilityRef, toolID, input.context)
    }
  }
}

export function skillLoaderAvailable(input: {
  runtime: SessionAgentRuntime
  toolID: "skill" | "mission_skill"
  allowedToolIDs: ReadonlySet<string>
  availableToolNames?: ReadonlySet<string>
}): boolean {
  if (!input.allowedToolIDs.has(input.toolID)) return false
  if (input.availableToolNames && !input.availableToolNames.has(input.toolID)) return false
  return !CapabilityRules.disabled([input.toolID], input.runtime.permission).has(input.toolID)
}

export function skillDisabledReason(input: {
  skill: Skill.Info
  runtime: SessionAgentRuntime
  allowedToolIDs: ReadonlySet<string>
  toolAvailable: boolean
  availableToolNames?: ReadonlySet<string>
}): SkillDisabledReason | undefined {
  if (!input.toolAvailable) return "skill_tool_unavailable"
  if (CapabilityRules.evaluate("skill", input.skill.name, input.runtime.permission).action === "deny") {
    return "permission_denied"
  }
  if (!SkillPlatform.supports(input.skill.platforms)) {
    return "platform_incompatible"
  }
  for (const toolID of input.skill.required_tools) {
    if (!input.allowedToolIDs.has(toolID)) return "missing_required_tool"
    if (input.availableToolNames && !input.availableToolNames.has(toolID)) return "missing_required_tool"
    if (CapabilityRules.evaluate(toolID, "*", input.runtime.permission).action === "deny") {
      return "missing_required_tool"
    }
  }
  return undefined
}
