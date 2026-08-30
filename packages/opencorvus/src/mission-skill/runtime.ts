import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { skillDisabledReason, skillLoaderAvailable } from "@/skill/eligibility"
import type { ResolvedSkillSurface } from "@/skill/surface"
import { MissionSkillCatalog } from "./catalog"
import { createHarnessProjection } from "@/capability/harness-projection"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"

export namespace MissionSkillRuntime {
  export async function resolve(input: {
    agentID: string
    sessionKind: string
    runtime: SessionAgentRuntime
    scope: "project" | "session"
    availableToolNames?: Iterable<string>
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
    const skills = (await MissionSkillCatalog.all({ refresh: true })).map((skill) => {
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

  export async function harnessProjection(input: {
    agentID: string
    sessionKind: string
    runtime: SessionAgentRuntime
    availableToolNames?: Iterable<string>
    executionToolIDs?: Iterable<string>
  }) {
    const surface = await resolve({ ...input, scope: "session" })
    const toolIDs = [...(input.executionToolIDs ?? AgentToolPool.visibleToolIDs(input.runtime.tools))]
    return createHarnessProjection({
      context: { kind: "mission" },
      owner_revision: String(
        Bun.hash.xxHash64(
          JSON.stringify({
            tool_ids: [...toolIDs].sort(),
            skills: surface.skills.map((skill) => [skill.name, skill.description, skill.enabled]),
          }),
        ),
      ),
      tool_refs: toolIDs.map((toolID) =>
        capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: toolID }),
      ),
      skill_refs: [],
      mission_skill_refs: surface.skills.map((skill) =>
        capabilityRef({
          kind: "mission_skill",
          source: skill.skill.builtin ? "platform" : "project",
          owner_ref: "mission-skill-registry",
          local_ref: skill.name,
        }),
      ),
      mcp_server_refs: [],
      mcp_tool_refs: [],
      mcp_prompt_refs: [],
      mcp_resource_refs: [],
    })
  }
}
