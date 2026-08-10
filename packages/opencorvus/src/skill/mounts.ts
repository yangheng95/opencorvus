import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { runtimeOverrideLayers } from "@/agent/runtime-override"
import { sessionRuntimeFromProjectedTemplate, type SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { PromptProfile } from "@/agent/prompt-profile"
import { DynamicAgentIDSchema } from "@/agent/dynamic-agent-id"
import { ExpertSquadVirtualWorkflowsSchema } from "@/expert-squad/protocol-schema"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { compareCanonicalStrings } from "@/expert-squad/projection-hash"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import z from "zod"
import { DefaultSkillRefSchema, defaultSkillRefFromName } from "./default-skill-ref"
import { Skill } from "./skill"
import { SkillManager } from "./manager"
import { skillDisabledReason, skillLoaderAvailable } from "./eligibility"
import { taskPackageRevisionForSession } from "@/engine/task-package-projection"

export namespace SkillMount {
  export const DisabledReason = z.enum([
    "skill_tool_unavailable",
    "permission_denied",
    "platform_incompatible",
    "missing_required_tool",
  ])
  export type DisabledReason = z.infer<typeof DisabledReason>

  export const MountedSkill = z
    .object({
      ref: z.string(),
      source: z.enum(["default", "package"]),
      authorities: z.array(z.enum(["manifest", "operator"])),
      name: z.string(),
      description: z.string(),
      location: z.string(),
      enabled: z.boolean(),
      reason: DisabledReason.optional(),
    })
    .strict()
  export type MountedSkill = z.infer<typeof MountedSkill>

  export const AgentEntry = z
    .object({
      agent_id: z.string(),
      base_role: z.string(),
      label: z.string(),
      description: z.string().optional(),
      skill_mountable: z.boolean(),
      skill_tool_available: z.boolean(),
      projected_tool_ids: z.array(z.string()),
    })
    .strict()
  export type AgentEntry = z.infer<typeof AgentEntry>

  export const PoolSkill = SkillManager.Installed.safeExtend({
    ref: z.string(),
    projection_source: z.enum(["default", "package"]),
  }).strict()
  export type PoolSkill = z.infer<typeof PoolSkill>

  export const MatrixRelation = z
    .object({
      expert_squad_id: z.string(),
      agent_id: z.string(),
      base_role: z.string(),
      ref: z.string(),
      source: z.enum(["default", "package"]),
      name: z.string(),
      manifest_grant: z.boolean(),
      project_override: z.boolean().nullable(),
      session_override: z.boolean().nullable(),
      effective: z.boolean(),
      enabled: z.boolean().nullable(),
      reason: DisabledReason.optional(),
    })
    .strict()
  export type MatrixRelation = z.infer<typeof MatrixRelation>

  export const MatrixRow = z
    .object({
      agent_id: z.string(),
      base_role: z.string(),
      grants: z.array(MatrixRelation),
    })
    .strict()
  export type MatrixRow = z.infer<typeof MatrixRow>

  export const Matrix = z
    .object({
      scope: z.enum(["project", "session"]),
      active_profile: z.string(),
      projection_hash: z.string(),
      projected_tool_ids: z.array(z.string()),
      projected_agents: z.array(z.string()),
      virtual_workflows: ExpertSquadVirtualWorkflowsSchema,
      selector_skill_names: z.array(z.string()),
      production_skill_names: z.array(z.string()),
      projected_skill_names: z.array(z.string()),
      skills: z.array(PoolSkill),
      agents: z.array(AgentEntry),
      matrix: z.array(MatrixRow),
      unmounted_count: z.number().int().nonnegative(),
    })
    .strict()
  export type Matrix = z.infer<typeof Matrix>

  const MutationFields = {
    expertSquadID: z.string().trim().min(1),
    agentID: z.string().trim().min(1),
    defaultSkillRef: DefaultSkillRefSchema,
    override: z.boolean().nullable(),
  }

  export const SetOverrideInput = z.discriminatedUnion("scope", [
    z.object({ scope: z.literal("project"), ...MutationFields }).strict(),
    z.object({ scope: z.literal("session"), sessionID: z.string().min(1), ...MutationFields }).strict(),
  ])

  export type ResolvedSkill = MountedSkill & {
    skill: Skill.Info
  }

  export type ResolvedAgentSkillSurface = {
    family: "production"
    tool_id: "skill"
    agent: string
    base_role: string
    scope: "project" | "session"
    tool_available: boolean
    unmounted_pool_count: number
    active_profile: string
    projection_hash: string
    projected_tool_ids: string[]
    projected_agents: string[]
    selector_skill_names: string[]
    production_skill_names: string[]
    projected_skill_names: string[]
    skills: ResolvedSkill[]
  }

  type ProjectedAgent = PromptProfileResolver.ResolvedProjectedAgent
  type ProjectedScheduler = PromptProfileResolver.ResolvedProjectedScheduler
  type ProjectedSkillOwner = ProjectedAgent | ProjectedScheduler
  type RuntimeProjectedSkillOwnerIdentity = ProjectedSkillOwner["identity"] & { expertSquadID: string }

  function exactProjectedOwner(
    projection: PromptProfileResolver.ResolvedSkillProjection,
    agentID: string,
  ): ProjectedSkillOwner {
    if (agentID === "orchestrator") return projection.projectedScheduler
    const projected = [...projection.schedulerOnlyAgents, ...projection.projectedAgents].find(
      (candidate) => candidate.identity.agentID === agentID,
    )
    if (!projected) {
      throw new Error(
        `Active expert squad ${projection.expertSquadID} does not project skill owner ${JSON.stringify(agentID)}.`,
      )
    }
    return projected
  }

  function booleanLeaf(root: unknown, keys: readonly string[]): boolean | undefined {
    let current = root
    for (const key of keys) {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return typeof current === "boolean" ? current : undefined
  }

  function recordNode(root: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
    let current = root
    for (const key of keys) {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : undefined
  }

  function grantMapForAgent(
    projection: PromptProfileResolver.ResolvedSkillProjection,
    agentID: string,
  ): Map<string, PromptProfileResolver.ProductionSkillGrant> {
    const grants = new Map<string, PromptProfileResolver.ProductionSkillGrant>()
    for (const grant of projection.productionSkills) {
      if (!grant.agentIDs.includes(agentID)) continue
      if (grants.has(grant.ref)) {
        throw new Error(
          `Active expert squad ${projection.expertSquadID} agent ${agentID} has duplicate effective skill ref ${grant.ref}.`,
        )
      }
      grants.set(grant.ref, grant)
    }
    return grants
  }

  export function agentCanUseSkillTool(input: {
    runtime: SessionAgentRuntime
    projectedToolIDs: ReadonlySet<string>
    availableToolNames?: ReadonlySet<string>
  }): boolean {
    return skillLoaderAvailable({
      runtime: input.runtime,
      toolID: "skill",
      allowedToolIDs: input.projectedToolIDs,
      availableToolNames: input.availableToolNames,
    })
  }

  export async function resolve(input: {
    identity: RuntimeProjectedSkillOwnerIdentity
    runtime: SessionAgentRuntime
    scope: "project" | "session"
    projectDirectory: string
    skillProjection: PromptProfileResolver.ResolvedSkillProjection
    availableToolNames?: Iterable<string>
  }): Promise<ResolvedAgentSkillSurface> {
    if (input.identity.expertSquadID !== input.skillProjection.expertSquadID) {
      throw new Error(
        `Runtime skill owner ${input.identity.agentID} belongs to expert squad ${input.identity.expertSquadID}, not active projection ${input.skillProjection.expertSquadID}.`,
      )
    }
    if (!input.projectDirectory.trim()) throw new Error("Skill resolution requires an explicit project directory.")
    const projected = exactProjectedOwner(input.skillProjection, input.identity.agentID)
    if (
      projected.identity.baseRole !== input.identity.baseRole ||
      projected.identity.sessionKind !== input.identity.sessionKind ||
      projected.identity.projectionHash !== input.identity.projectionHash
    ) {
      throw new Error(
        `Projected skill owner ${input.identity.agentID} runtime identity does not match the active resolved projection.`,
      )
    }
    if (
      "dispatchAdapterID" in projected.identity &&
      (!("dispatchAdapterID" in input.identity) ||
        projected.identity.dispatchAdapterID !== input.identity.dispatchAdapterID)
    ) {
      throw new Error(
        `Projected skill owner ${input.identity.agentID} runtime dispatch adapter does not match the active resolved projection.`,
      )
    }
    const projectedToolIDs = new Set(projected.projectedToolIDs)
    const availableToolNames = input.availableToolNames ? new Set(input.availableToolNames) : undefined
    const toolAvailable = agentCanUseSkillTool({
      runtime: input.runtime,
      projectedToolIDs,
      availableToolNames,
    })
    const grants = grantMapForAgent(input.skillProjection, input.identity.agentID)
    const skills = [...grants.values()]
      .sort((left, right) => compareCanonicalStrings(left.ref, right.ref))
      .map((grant) => {
        const reason = skillDisabledReason({
          skill: grant.skill,
          runtime: input.runtime,
          allowedToolIDs: projectedToolIDs,
          toolAvailable,
          availableToolNames,
        })
        return {
          ref: grant.ref,
          source: grant.source,
          authorities: [grant.authority],
          name: grant.skill.name,
          description: grant.skill.description,
          location: grant.skill.location,
          enabled: reason === undefined,
          ...(reason ? { reason } : {}),
          skill: grant.skill,
        } satisfies ResolvedSkill
      })
    const grantedDefaultRefs = new Set(
      [...grants.values()].filter((grant) => grant.source === "default").map((grant) => grant.ref),
    )

    return {
      family: "production",
      tool_id: "skill",
      agent: input.identity.agentID,
      base_role: projected.identity.baseRole,
      scope: input.scope,
      tool_available: toolAvailable,
      unmounted_pool_count: input.skillProjection.skillInventory.filter(
        (skill) => !grantedDefaultRefs.has(defaultSkillRefFromName(skill.name)),
      ).length,
      active_profile: input.skillProjection.expertSquadID,
      projection_hash: input.skillProjection.projectionHash,
      projected_tool_ids: [...projected.projectedToolIDs],
      projected_agents: [...input.skillProjection.projectedAgentIDs],
      selector_skill_names: [...input.skillProjection.selectorSkillNames],
      production_skill_names: [...input.skillProjection.productionSkillNames],
      projected_skill_names: [...input.skillProjection.projectedSkillNames],
      skills,
    }
  }

  function poolSkill(skill: Skill.Info, ref: string, projectionSource: "default" | "package"): PoolSkill {
    const candidate = skill as Skill.Info & Partial<z.infer<typeof SkillManager.Installed>>
    return PoolSkill.parse({
      ...skill,
      ref,
      projection_source: projectionSource,
      dir: candidate.dir,
      source_type: candidate.source_type ?? (skill.builtin ? "builtin" : "unknown"),
      source: candidate.source,
      trust: candidate.trust ?? (skill.builtin ? "builtin" : "local"),
      risk:
        candidate.risk ??
        (skill.bundle
          ? Skill.bundleRisk(skill.bundle)
          : {
              level: "low",
              has_scripts: false,
              has_agents: false,
              has_references: false,
              has_templates: false,
            }),
      recommended_policy: candidate.recommended_policy ?? "ask",
      policy: candidate.policy ?? "ask",
      managed: candidate.managed ?? false,
      writable: candidate.writable ?? false,
    })
  }

  function relationsForAgent(input: {
    projection: PromptProfileResolver.ResolvedSkillProjection
    projected: ProjectedAgent
    runtime: SessionAgentRuntime
    projectConfig: Config.Info
    sessionOverlay?: Config.Overlay
    effectiveConfig: Config.Info
    availableToolNames?: ReadonlySet<string>
  }): MatrixRelation[] {
    const { projection, projected } = input
    const agentID = projected.identity.agentID
    const effectiveGrants = grantMapForAgent(projection, agentID)
    const manifestRefs = new Set(
      projection.productionSkills
        .filter((grant) => grant.authority === "manifest" && grant.agentIDs.includes(agentID))
        .map((grant) => grant.ref),
    )
    const refs = new Set(projection.skillInventory.map((skill) => defaultSkillRefFromName(skill.name)))
    for (const ref of effectiveGrants.keys()) refs.add(ref)
    const projectAgentOverrides = input.projectConfig.skill_mounts?.[projection.expertSquadID]?.[agentID]
    for (const ref of Object.keys(projectAgentOverrides ?? {})) refs.add(ref)
    const sessionAgentOverrides = recordNode(input.sessionOverlay?.skill_mounts, [projection.expertSquadID, agentID])
    for (const ref of Object.keys(sessionAgentOverrides ?? {})) refs.add(ref)
    const inventoryByRef = new Map(
      projection.skillInventory.map((skill) => [defaultSkillRefFromName(skill.name), skill]),
    )
    const projectedToolIDs = new Set(projected.projectedToolIDs)
    const toolAvailable = agentCanUseSkillTool({
      runtime: input.runtime,
      projectedToolIDs,
      availableToolNames: input.availableToolNames,
    })

    return [...refs].sort(compareCanonicalStrings).map((ref) => {
      const grant = effectiveGrants.get(ref)
      const skill = grant?.skill ?? inventoryByRef.get(ref)
      if (!skill) {
        throw new Error(`Active expert squad ${projection.expertSquadID} relation ${ref} has no resolved skill.`)
      }
      const projectOverride = booleanLeaf(input.projectConfig.skill_mounts, [projection.expertSquadID, agentID, ref])
      const sessionOverride = booleanLeaf(input.sessionOverlay?.skill_mounts, [projection.expertSquadID, agentID, ref])
      const effectiveOverride = booleanLeaf(input.effectiveConfig.skill_mounts, [
        projection.expertSquadID,
        agentID,
        ref,
      ])
      const manifestGrant = manifestRefs.has(ref)
      const effective = manifestGrant || effectiveOverride === true
      if (effective !== Boolean(grant)) {
        throw new Error(
          `Active expert squad ${projection.expertSquadID} agent ${agentID} relation ${ref} disagrees with its resolved production grant.`,
        )
      }
      const reason = effective
        ? skillDisabledReason({
            skill,
            runtime: input.runtime,
            allowedToolIDs: projectedToolIDs,
            toolAvailable,
            availableToolNames: input.availableToolNames,
          })
        : undefined
      return {
        expert_squad_id: projection.expertSquadID,
        agent_id: agentID,
        base_role: projected.identity.baseRole,
        ref,
        source: grant?.source ?? "default",
        name: skill.name,
        manifest_grant: manifestGrant,
        project_override: projectOverride ?? null,
        session_override: sessionOverride ?? null,
        effective,
        enabled: effective ? reason === undefined : null,
        ...(reason ? { reason } : {}),
      }
    })
  }

  export async function matrix(input?: {
    sessionID?: string
    refresh?: boolean
    expertSquadID?: string
  }): Promise<Matrix> {
    if (input?.refresh) await SkillManager.refreshDiscoveryState()
    const scope = input?.sessionID ? "session" : "project"
    const [effectiveConfig, projectConfig, projectDirectory, sessionOverlay] = input?.sessionID
      ? await Promise.all([
          EffectiveConfig.effective({ sessionID: input.sessionID }),
          EffectiveConfig.base({ sessionID: input.sessionID }),
          EffectiveConfig.capabilityProjectDirectory({ sessionID: input.sessionID }),
          EffectiveConfig.overlay({ sessionID: input.sessionID }),
        ])
      : await Config.get().then((config) => [config, config, Instance.project.worktree, undefined] as const)
    const packageRevision = input?.sessionID ? taskPackageRevisionForSession(input.sessionID) : undefined
    const activeExpertSquadID = packageRevision?.id ?? PromptProfile.activeID(effectiveConfig)
    if (input?.sessionID && input.expertSquadID && input.expertSquadID !== activeExpertSquadID) {
      throw new Error(
        `Session skill mount matrix targets expert squad ${input.expertSquadID}, but the session is active on ${activeExpertSquadID}.`,
      )
    }
    const projectionExpertSquadID = input?.expertSquadID ?? activeExpertSquadID
    const projectionConfig: Config.Info =
      projectionExpertSquadID === activeExpertSquadID
        ? effectiveConfig
        : { ...effectiveConfig, prompt_profile: { active: projectionExpertSquadID } }
    const installed = await SkillManager.installed()
    const projection = await PromptProfileResolver.resolveSkillProjection({
      projectDirectory,
      config: projectionConfig,
      defaultSkills: installed,
      packageRevision,
    })
    const rows: MatrixRow[] = []
    const agents: AgentEntry[] = []
    for (const projected of projection.projectedAgents) {
      const template = RuntimeTemplateRegistry.get(projected.identity.baseRole)
      const overrides = runtimeOverrideLayers(effectiveConfig, {
        expertSquadID: projection.expertSquadID,
        agentID: projected.identity.agentID,
        baseRole: projected.identity.baseRole,
      })
      const runtime = sessionRuntimeFromProjectedTemplate({
        template,
        templateOverride: overrides.template,
        projectedAgentOverride: overrides.projectedAgent,
      })
      const projectedToolIDs = new Set(projected.projectedToolIDs)
      const mountable = RuntimeTemplateRegistry.get(projected.identity.baseRole).skillMountable
      agents.push({
        agent_id: projected.identity.agentID,
        base_role: projected.identity.baseRole,
        label: projected.label,
        ...(projected.description ? { description: projected.description } : {}),
        skill_mountable: mountable,
        skill_tool_available: agentCanUseSkillTool({ runtime, projectedToolIDs }),
        projected_tool_ids: [...projected.projectedToolIDs],
      })
      rows.push({
        agent_id: projected.identity.agentID,
        base_role: projected.identity.baseRole,
        grants: relationsForAgent({
          projection,
          projected,
          runtime,
          projectConfig,
          sessionOverlay,
          effectiveConfig,
        }),
      })
    }
    const poolByRef = new Map<string, PoolSkill>()
    for (const skill of installed) {
      const ref = defaultSkillRefFromName(skill.name)
      poolByRef.set(ref, poolSkill(skill, ref, "default"))
    }
    for (const grant of projection.productionSkills) {
      if (grant.source !== "package" || poolByRef.has(grant.ref)) continue
      poolByRef.set(grant.ref, poolSkill(grant.skill, grant.ref, "package"))
    }
    const skills = [...poolByRef.values()].sort((left, right) => compareCanonicalStrings(left.ref, right.ref))
    const effectiveRefs = new Set(
      rows.flatMap((row) => row.grants.filter((grant) => grant.effective).map((grant) => grant.ref)),
    )
    return Matrix.parse({
      scope,
      active_profile: projection.expertSquadID,
      projection_hash: projection.projectionHash,
      projected_tool_ids: projection.projectedToolIDs,
      projected_agents: projection.projectedAgentIDs,
      virtual_workflows: projection.projectedScheduler.virtualWorkflows,
      selector_skill_names: projection.selectorSkillNames,
      production_skill_names: projection.productionSkillNames,
      projected_skill_names: projection.projectedSkillNames,
      skills,
      agents,
      matrix: rows,
      unmounted_count: skills.filter((skill) => skill.projection_source === "default" && !effectiveRefs.has(skill.ref))
        .length,
    })
  }

  function assertOverrideTarget(candidate: Matrix, input: z.infer<typeof SetOverrideInput>): void {
    const agent = candidate.agents.find((entry) => entry.agent_id === input.agentID)
    if (!agent) {
      throw new Error(`Skill mount agent ${input.agentID} is not projected by expert squad ${input.expertSquadID}.`)
    }
    if (!agent.skill_mountable) {
      throw new Error(`Agent ${input.agentID} does not allow operator Skill mounts.`)
    }
    if (
      !candidate.skills.some((skill) => skill.ref === input.defaultSkillRef && skill.projection_source === "default")
    ) {
      throw new Error(`Default Skill ${input.defaultSkillRef} is not installed in this project.`)
    }
  }

  export async function setOverride(raw: z.input<typeof SetOverrideInput>): Promise<Matrix> {
    const input = SetOverrideInput.parse(raw)
    const dynamicAgentID = DynamicAgentIDSchema.safeParse(input.agentID)
    if (!dynamicAgentID.success) {
      throw new Error(dynamicAgentID.error.issues[0]?.message ?? "Invalid dynamic agent id.")
    }
    const [config, projectDirectory] =
      input.scope === "session"
        ? await Promise.all([
            EffectiveConfig.effective({ sessionID: input.sessionID }),
            EffectiveConfig.capabilityProjectDirectory({ sessionID: input.sessionID }),
          ])
        : [await Config.get(), Instance.project.worktree]
    const active = PromptProfile.activeID(config)
    if (input.scope === "session" && input.expertSquadID !== active) {
      throw new Error(
        `Skill mount mutation targets expert squad ${input.expertSquadID}, but scope ${input.scope} is active on ${active}.`,
      )
    }
    const candidate =
      input.scope === "project"
        ? await matrix({ expertSquadID: input.expertSquadID })
        : await matrix({ sessionID: input.sessionID, expertSquadID: input.expertSquadID })
    assertOverrideTarget(candidate, input)
    const patch = {
      skill_mounts: {
        [input.expertSquadID]: {
          [input.agentID]: {
            [input.defaultSkillRef]: input.override,
          },
        },
      },
    }
    if (input.scope === "project") {
      await Config.updateProjectPatch(patch)
      return matrix({ expertSquadID: input.expertSquadID })
    }
    await Instance.provide({
      directory: projectDirectory,
      fn: () =>
        Session.mergeConfigOverlayInProject({
          sessionID: input.sessionID,
          projectID: Instance.project.id,
          patch: Config.Overlay.parse(patch),
        }),
    })
    return matrix({ sessionID: input.sessionID })
  }
}
