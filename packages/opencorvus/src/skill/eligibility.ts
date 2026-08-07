import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { PermissionNext } from "@/permission/next"
import type { Skill } from "./skill"
import { SkillPlatform } from "./platform"

export type SkillDisabledReason =
  | "skill_tool_unavailable"
  | "permission_denied"
  | "platform_incompatible"
  | "missing_required_tool"

export function skillLoaderAvailable(input: {
  runtime: SessionAgentRuntime
  toolID: "skill" | "mission_skill"
  allowedToolIDs: ReadonlySet<string>
  availableToolNames?: ReadonlySet<string>
}): boolean {
  if (!input.allowedToolIDs.has(input.toolID)) return false
  if (input.availableToolNames && !input.availableToolNames.has(input.toolID)) return false
  return !PermissionNext.disabled([input.toolID], input.runtime.permission).has(input.toolID)
}

export function skillDisabledReason(input: {
  skill: Skill.Info
  runtime: SessionAgentRuntime
  allowedToolIDs: ReadonlySet<string>
  toolAvailable: boolean
  availableToolNames?: ReadonlySet<string>
}): SkillDisabledReason | undefined {
  if (!input.toolAvailable) return "skill_tool_unavailable"
  if (PermissionNext.evaluate("skill", input.skill.name, input.runtime.permission).action === "deny") {
    return "permission_denied"
  }
  if (!SkillPlatform.supports(input.skill.platforms)) {
    return "platform_incompatible"
  }
  for (const toolID of input.skill.required_tools) {
    if (!input.allowedToolIDs.has(toolID)) return "missing_required_tool"
    if (input.availableToolNames && !input.availableToolNames.has(toolID)) return "missing_required_tool"
    if (PermissionNext.evaluate(toolID, "*", input.runtime.permission).action === "deny") {
      return "missing_required_tool"
    }
  }
  return undefined
}
