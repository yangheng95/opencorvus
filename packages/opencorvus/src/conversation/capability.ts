import z from "zod"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { Config } from "@/config/config"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { Instance } from "@/project/instance"
import { skillDisabledReason, skillLoaderAvailable } from "@/skill/eligibility"
import { SkillManager } from "@/skill/manager"
import { withSkillCatalogReferenceRead } from "@/skill/reference-lock"
import type { ResolvedSkillSurface } from "@/skill/surface"
import { WORK_DEFAULT_CAPABILITY_ASSIGNMENT } from "@/work/harness"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHarnessProjection } from "@/capability/harness-projection"
import { capabilityRef } from "@/capability/ref"

const CHAT_AGENT_ID = "chat" as const
export const CONVERSATION_AGENT_IDS = ["chat", "work"] as const
export type ConversationAgentID = (typeof CONVERSATION_AGENT_IDS)[number]
const DEFAULT_ASSIGNMENTS: Readonly<Record<ConversationAgentID, Readonly<AssignmentSeed>>> = Object.freeze({
  chat: Object.freeze({ skill_refs: [], mcp_server_refs: [] }),
  work: WORK_DEFAULT_CAPABILITY_ASSIGNMENT,
})

type AssignmentSeed = {
  skill_refs: readonly string[]
  mcp_server_refs: readonly string[]
}

export namespace ConversationCapability {
  export function isAgentID(value: string): value is ConversationAgentID {
    return CONVERSATION_AGENT_IDS.includes(value as ConversationAgentID)
  }
  export const Assignment = z
    .object({
      skill_refs: z.array(z.string().trim().min(1)),
      mcp_server_refs: z.array(z.string().trim().min(1)),
    })
    .strict()
  export type Assignment = z.output<typeof Assignment>
  export const Update = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("skill"), ref: z.string().trim().min(1), assigned: z.boolean() }).strict(),
      z.object({ kind: z.literal("mcp_server"), ref: z.string().trim().min(1), assigned: z.boolean() }).strict(),
    ])
    .meta({ ref: "ConversationCapabilityUpdate" })
  export type Update = z.output<typeof Update>
  export const InvalidAssignmentError = NamedError.create(
    "ConversationCapabilityInvalidAssignmentError",
    z.object({ message: z.string() }),
  )

  export const Settings = z
    .object({
      scope: z.object({ kind: z.literal("project"), directory: z.string() }).strict(),
      agent_id: z.enum(CONVERSATION_AGENT_IDS),
      tools: z
        .object({
          declared: z.array(z.string()),
        })
        .strict(),
      skills: z
        .object({
          assigned_refs: z.array(z.string()),
          installed: z.array(SkillManager.Installed),
        })
        .strict(),
      mcp: z
        .object({
          assigned_server_refs: z.array(z.string()),
          configured_server_refs: z.array(z.string()),
        })
        .strict(),
    })
    .strict()
    .meta({ ref: "ConversationCapabilitySettings" })

  export function settingsSchema(agentID: ConversationAgentID) {
    const label = agentID === "chat" ? "Chat" : "Work"
    return Settings.extend({ agent_id: z.literal(agentID) }).meta({ ref: `${label}CapabilitySettings` })
  }

  function unique(values: readonly string[], label: string) {
    const result = [...new Set(values)]
    if (result.length !== values.length) {
      throw new InvalidAssignmentError({ message: `${label} must not contain duplicate references.` })
    }
    return result
  }

  export function assignment(config: Config.Info, agentID: ConversationAgentID = CHAT_AGENT_ID): Assignment {
    const configured = config.primary_assistant_capabilities?.[agentID]
    const defaults = DEFAULT_ASSIGNMENTS[agentID]
    return Assignment.parse({
      skill_refs: configured?.skill_refs ?? defaults.skill_refs,
      mcp_server_refs: configured?.mcp_server_refs ?? defaults.mcp_server_refs,
    })
  }

  export async function assertConfig(config: Config.Info) {
    const assignments = CONVERSATION_AGENT_IDS.map((agentID) => ({
      agentID,
      selected: assignment(config, agentID),
    }))
    const skillAssignments = assignments.flatMap(({ agentID, selected }) =>
      unique(selected.skill_refs, `${agentID} skill_refs`).map((ref) => ({ agentID, ref })),
    )
    if (skillAssignments.length) {
      await withSkillCatalogReferenceRead(async () => {
        const installed = new Set((await SkillManager.installed()).map((skill) => skill.name))
        for (const { agentID, ref } of skillAssignments) {
          if (!installed.has(ref)) {
            throw new InvalidAssignmentError({
              message: `${agentID} skill_refs references an uninstalled Skill: ${ref}`,
            })
          }
        }
      })
    }
    for (const { agentID, selected } of assignments) {
      const mcpRefs = unique(selected.mcp_server_refs, `${agentID} mcp_server_refs`)
      for (const ref of mcpRefs) {
        if (!Object.hasOwn(config.mcp ?? {}, ref)) {
          throw new InvalidAssignmentError({
            message: `${agentID} mcp_server_refs references an unknown MCP server: ${ref}`,
          })
        }
      }
    }
  }

  export async function resolveSkillSurface(input: {
    agentID: ConversationAgentID
    config: Config.Info
    runtime: SessionAgentRuntime
    availableToolNames?: Iterable<string>
    explicitSkillNames?: Iterable<string>
    scope: "project" | "session"
  }): Promise<Extract<ResolvedSkillSurface, { family: "production" }>> {
    return withSkillCatalogReferenceRead(async () => {
      const allowedToolIDs = AgentToolPool.visibleToolIDs(input.runtime.tools)
      if (!allowedToolIDs.has("skill")) {
        throw new Error(`Native ${input.agentID} harness does not own the "skill" tool.`)
      }
      const availableToolNames = input.availableToolNames ? new Set(input.availableToolNames) : undefined
      const toolAvailable = skillLoaderAvailable({
        runtime: input.runtime,
        toolID: "skill",
        allowedToolIDs,
        availableToolNames,
      })
      const installed = await SkillManager.installed()
      const installedByName = new Map(installed.map((skill) => [skill.name, skill]))
      const selected = assignment(input.config, input.agentID)
      const explicitSkillNames = unique([...(input.explicitSkillNames ?? [])], `${input.agentID} explicit Skill names`)
      const effectiveSkillNames = [...new Set([...selected.skill_refs, ...explicitSkillNames])]
      const skills = effectiveSkillNames.map((ref) => {
        const skill = installedByName.get(ref)
        if (!skill) {
          throw new InvalidAssignmentError({
            message: `${input.agentID} turn references an uninstalled Skill: ${ref}`,
          })
        }
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
        family: "production",
        tool_id: "skill",
        agent: input.agentID,
        base_role: input.agentID,
        scope: input.scope,
        tool_available: toolAvailable,
        unmounted_pool_count: installed.length - skills.length,
        skills,
      }
    })
  }

  export async function settings(agentID: ConversationAgentID, inputConfig?: Config.Info) {
    return withSkillCatalogReferenceRead(async () => {
      const config = inputConfig ?? (await Config.get())
      await assertConfig(config)
      const agent = await PrimaryAssistantRegistry.get(agentID, { config })
      const selected = assignment(config, agentID)
      const installed = await SkillManager.installed()
      const declared = [...AgentToolPool.visibleToolIDs(agent.tools)].sort()
      return Settings.parse({
        scope: { kind: "project", directory: Instance.project.worktree },
        agent_id: agentID,
        tools: { declared },
        skills: {
          assigned_refs: selected.skill_refs,
          installed,
        },
        mcp: {
          assigned_server_refs: selected.mcp_server_refs,
          configured_server_refs: Object.keys(config.mcp ?? {}).sort(),
        },
      })
    })
  }

  export async function harnessProjection(
    agentID: ConversationAgentID,
    input?: {
      config?: Config.Info
      executionToolIDs?: Iterable<string>
      executionMcpToolIDs?: Iterable<string>
      skillRefs?: Iterable<string>
    },
  ) {
    const config = input?.config ?? (await Config.get())
    const agent = await PrimaryAssistantRegistry.get(agentID, { config })
    const selected = assignment(config, agentID)
    const mcpToolIDs = new Set(input?.executionMcpToolIDs ?? [])
    const toolIDs = [...(input?.executionToolIDs ?? AgentToolPool.visibleToolIDs(agent.tools))].filter(
      (toolID) => !mcpToolIDs.has(toolID),
    )
    const skillRefs = [...new Set(input?.skillRefs ?? selected.skill_refs)]
    return createHarnessProjection({
      context: { kind: "conversation", agent_id: agentID },
      owner_revision: String(
        Bun.hash.xxHash64(
          JSON.stringify({
            agent_id: agentID,
            tool_ids: [...toolIDs].sort(),
            skill_refs: [...skillRefs].sort(),
            mcp_server_refs: [...selected.mcp_server_refs].sort(),
            mcp_tool_refs: [...mcpToolIDs].sort(),
          }),
        ),
      ),
      tool_refs: toolIDs.map((toolID) =>
        capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: toolID }),
      ),
      skill_refs: skillRefs.map((ref) =>
        capabilityRef({ kind: "skill", source: "project", owner_ref: `${agentID}-capability`, local_ref: ref }),
      ),
      mission_skill_refs: [],
      mcp_server_refs: selected.mcp_server_refs.map((ref) =>
        capabilityRef({ kind: "mcp_server", source: "project", owner_ref: "mcp-config", local_ref: ref }),
      ),
      mcp_tool_refs: [...mcpToolIDs].map((ref) =>
        capabilityRef({ kind: "mcp_tool", source: "project", owner_ref: "mcp-config", local_ref: ref }),
      ),
      mcp_prompt_refs: [],
      mcp_resource_refs: [],
    })
  }

  export async function update(agentID: ConversationAgentID, raw: z.input<typeof Update>) {
    const mutation = Update.parse(raw)
    const apply = () =>
      Config.updateProjectPatchAtomic((currentProject) => {
        const selected = assignment(currentProject, agentID)
        const skillRefs = new Set(selected.skill_refs)
        const mcpRefs = new Set(selected.mcp_server_refs)
        if (mutation.kind === "skill") {
          mutation.assigned ? skillRefs.add(mutation.ref) : skillRefs.delete(mutation.ref)
        } else {
          mutation.assigned ? mcpRefs.add(mutation.ref) : mcpRefs.delete(mutation.ref)
        }
        return {
          primary_assistant_capabilities: {
            [agentID]: {
              skill_refs: [...skillRefs],
              mcp_server_refs: [...mcpRefs],
            },
          },
        }
      })
    await apply()
    return settings(agentID)
  }

  export async function runtimeMcpTools(config: Config.Info, agentID: ConversationAgentID, sessionID: string) {
    const selected = assignment(config, agentID)
    return HostSessionMcpRuntime.tools(config, sessionID, selected.mcp_server_refs)
  }
}
