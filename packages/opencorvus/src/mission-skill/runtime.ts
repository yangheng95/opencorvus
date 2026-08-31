import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { skillDisabledReason, skillLoaderAvailable } from "@/skill/eligibility"
import type { ResolvedSkillSurface } from "@/skill/surface"
import { MissionSkillCatalog } from "./catalog"
import { createHarnessGrantSet, harnessLeafAccess } from "@/capability/harness-projection"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { canonicalDigestSource } from "@/util/canonical-digest"
import type { Config } from "@/config/config"

export namespace MissionSkillRuntime {
  export async function resolve(input: {
    agentID: string
    sessionKind: string
    runtime: SessionAgentRuntime
    scope: "project" | "session"
    availableToolNames?: Iterable<string>
    activeSkillNames?: Iterable<string>
  }): Promise<Extract<ResolvedSkillSurface, { family: "mission" }>> {
    if (input.agentID !== "mission") {
      throw new Error(`Mission Skill surface requires agent "mission", received ${JSON.stringify(input.agentID)}.`)
    }
    if (input.sessionKind !== "mission") {
      throw new Error(
        `Mission Skill surface requires a mission session, received ${JSON.stringify(input.sessionKind)}.`,
      )
    }
    const allowedToolIDs = AgentToolPool.visibleToolIDs(input.runtime.tools)
    if (!allowedToolIDs.has("mission_skill")) {
      throw new Error("Mission agent role does not own the mission_skill tool.")
    }
    const availableToolNames = input.availableToolNames ? new Set(input.availableToolNames) : undefined
    const toolAvailable = skillLoaderAvailable({
      runtime: input.runtime,
      toolID: "mission_skill",
      allowedToolIDs,
      availableToolNames,
    })
    const activeSkillNames = input.activeSkillNames ? new Set(input.activeSkillNames) : undefined
    const skills = (await MissionSkillCatalog.all({ refresh: true }))
      .filter((skill) => !activeSkillNames || activeSkillNames.has(skill.name))
      .map((skill) => {
      const reason = skillDisabledReason({
        skill,
        runtime: input.runtime,
        allowedToolIDs,
        toolAvailable,
        availableToolNames,
      })
      return {
        name: skill.name,
        description: skill.description,
        location: skill.location,
        enabled: reason === undefined,
        ...(reason ? { reason } : {}),
        skill,
      }
      })
    return {
      family: "mission",
      tool_id: "mission_skill",
      agent: "mission",
      base_role: "mission",
      scope: input.scope,
      tool_available: toolAvailable,
      unmounted_pool_count: 0,
      skills,
    }
  }

  export async function harnessGrants(input: {
    agentID: string
    sessionKind: string
    runtime: SessionAgentRuntime
    config: Config.Info
    includeMcpTools?: boolean
    availableToolNames?: Iterable<string>
    executionToolIDs?: Iterable<string>
  }) {
    const surface = await resolve({ ...input, scope: "session" })
    const toolIDs = [...(input.executionToolIDs ?? AgentToolPool.visibleToolIDs(input.runtime.tools))]
    const mcpServerRefs = input.includeMcpTools === false ? [] : Object.keys(input.config.mcp ?? {}).sort()
    return createHarnessGrantSet({
      context: { kind: "mission" },
      owner_revision: canonicalDigestSource("mission-harness-grants-v2", {
        tool_ids: [...toolIDs].sort(),
        mcp_server_refs: mcpServerRefs,
        skills: surface.skills.map((skill) => [skill.name, skill.description, skill.enabled]),
      }).sha256,
      grants: [
        ...toolIDs.map((toolID) => {
          const ref = capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: toolID })
          return { ref, access: harnessLeafAccess(ref) }
        }),
        ...surface.skills.map((skill) => ({
          ref: capabilityRef({
            kind: "mission_skill",
            source: skill.skill.builtin ? "platform" : "project",
            owner_ref: "mission-skill-registry",
            local_ref: skill.name,
          }),
          access: "discover_execute" as const,
        })),
        ...mcpServerRefs.map((serverID) => ({
          ref: capabilityRef({
            kind: "mcp_server" as const,
            source: "project" as const,
            owner_ref: "mcp-config",
            local_ref: serverID,
          }),
          access: "discover_execute" as const,
          descendant_scope: ["mcp_tool" as const, "mcp_prompt" as const, "mcp_resource" as const],
        })),
      ],
    })
  }
}
