import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { jsonSchema, tool } from "ai"
import z from "zod"
import {
  DEFAULT_PROMPT_PROFILE_ID,
  PromptProfile,
  PromptProfileIDSchema,
  type PromptProfileConfig,
} from "@/agent/prompt-profile"
import { AgentRoleContract, type AgentRoleID } from "@/agent/role-contract"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { ProjectedSchedulerIdentitySchema, type ProjectedSchedulerIdentity } from "@/agent/projected-scheduler-identity"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { UNIVERSAL_BUILD_AGENT_ID, UNIVERSAL_BUILD_DESCRIPTION, UNIVERSAL_BUILD_LABEL } from "@/agent/universal-build"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { Config } from "@/config/config"
import type { ExpertSquadPackageRevision } from "@/expert-squad/package-revision"
import { Instance } from "@/project/instance"
import { Skill } from "@/skill/skill"
import { defaultSkillNameFromRef } from "@/skill/default-skill-ref"
import { Truncate } from "@/tool/truncation"
import { MCP } from "@/mcp"
import { materializeMcpToolResult, materializedMcpAttachmentsToFileParts } from "@/mcp/materialize"
import { bindBrowserMcpPermissionKey, browserMcpToolKey } from "@/mcp/browser/permission-plan"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { ComputerHostRuntime } from "@/mcp/computer/host-runtime"
import { bindComputerMcpPermissionKey, computerMcpToolKey } from "@/mcp/computer/permission-plan"
import { withTaskScopedPluginToolHost } from "@/tool/plugin-tool-host"
import {
  bindPackageToolRuntime,
  bindProjectedTaskToolRuntime,
  resolvePackageTaskToolExecutionScope,
  resolveProjectedTaskToolExecutionScope,
  executionAuthorityFromTaskToolScope,
  type PackageToolRuntimeBinding,
  type ProjectedTaskToolRuntimeBinding,
} from "@/tool/task-tool-execution-scope"
import { assertBuiltInToolProviderClosure, builtInToolProviderState } from "@/tool/global-tools"
import { assertNoInlineBase64Payload } from "@/util/inline-base64"
import { builtInPackageSources, getLoadedBuiltInPackages } from "./builtin"
import { executePackageToolInCapsule, introspectPackageToolInCapsule } from "./package-tool-capsule"
import {
  ExpertSquadCatalogSchema,
  ExpertSquadRecommendationSchema,
  type ExpertSquadCatalog,
  type ExpertSquadCatalogSummary,
  type ExpertSquadRecommendation,
} from "./catalog"
import { catalogSummaryFromPackage as catalogSummaryFromCapabilityPackage } from "./catalog-profile"
import {
  defaultMcpPromptProviderName as defaultMcpPromptProviderNameFromRef,
  defaultMcpResourceProviderName as defaultMcpResourceProviderNameFromRef,
  defaultMcpToolProviderName as defaultMcpToolProviderNameFromRef,
  defaultToolNameFromRef as defaultToolNameFromCapabilityRef,
  defaultToolProviderName as defaultToolProviderNameFromRef,
  packageMcpPromptProviderName as packageMcpPromptProviderNameFromRef,
  packageMcpResourceProviderName as packageMcpResourceProviderNameFromRef,
  packageMcpToolProviderName as packageMcpToolProviderNameFromRef,
  packageToolProviderName as packageToolProviderNameFromRef,
} from "./provider-names"
import {
  ProjectionHashDomain,
  canonicalProjectionHash,
  canonicalStringSet,
  compareCanonicalStrings,
  textSHA256,
} from "./projection-hash"
import { TASK_ARTIFACT_DISCOVERY_TOOL_IDS, TASK_ARTIFACT_TOOL_IDS } from "@/tool/tool-id-catalog"
import { ExpertSquadRegistry } from "./registry"
import { runtimeOverrideLayers } from "@/agent/runtime-override"
import { sessionRuntimeFromProjectedTemplate, type SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { configuredProjectedWorkerModelRef } from "@/agent/model"
import { ExpertSquadConfigurationStore } from "./configuration"
import { createHarnessProjection } from "@/capability/harness-projection"
import { capabilityRef, type CapabilityKind, type CapabilityRef } from "@/capability/ref"

type ConfigLike = {
  model?: Config.Info["model"]
  prompt_profile?: PromptProfileConfig
  skill_mounts?: Config.Info["skill_mounts"]
  mcp?: Config.Info["mcp"]
  assistant?: Config.Info["assistant"]
  experimental?: Config.Info["experimental"]
  runtime_templates?: Config.Info["runtime_templates"]
  expert_squads?: Config.Info["expert_squads"]
}

export namespace PromptProfileResolver {
  export type ResolvedPackageRevision = ExpertSquadPackageRevision
  export interface ProjectScope {
    projectDirectory?: string
  }

  export interface ExpertSquadCatalogInput {
    config: ConfigLike
    projectActive: string
    sessionOverride: string | null
    scope: { kind: "project"; directory: string } | { kind: "session"; directory: string; sessionID: string }
    defaultSkills?: Skill.Info[]
  }

  export interface ResolvedComposeInput {
    taskID: string
    base: string
    userAppend?: string | null
    projectDirectory: string
    capability: ResolvedSchedulerCapability | ResolvedWorkerCapability
  }

  export interface ProfileIDInput extends ProjectScope {
    profileID: string
    config: ConfigLike
    scope?: "project" | "global"
  }

  export interface SchedulerCapabilityInput extends ProjectScope {
    config: ConfigLike
    defaultSkills?: Skill.Info[]
    packageRevision?: ExpertSquadPackageRevision
    reconcileEvolutionMutations?: boolean
  }

  export type ProductionSkillGrant =
    | {
        kind: "production"
        authority: "manifest" | "operator"
        source: "default"
        ref: string
        agentIDs: string[]
        skill: Skill.Info
      }
    | {
        kind: "production"
        authority: "manifest"
        source: "package"
        ref: string
        agentIDs: string[]
        skill: Skill.Info
        snapshot: ExpertSquadRegistry.PackageSkillSnapshot
      }

  export interface ResolvedSelectorSkill {
    kind: "selector"
    expertSquadID: string
    name: string
    description: string
    instructions: string
    digest: string
    location: string
    requiredTools: []
  }

  export type PreparedPackageTool =
    ExpertSquadRegistry.LoadedPackage["packageToolBundles"] extends ReadonlyMap<string, infer Prepared>
      ? Prepared
      : never

  export interface ResolvedProviderRef {
    ref: string
    providerName: string
  }

  export interface ResolvedPackageTool extends ResolvedProviderRef {
    prepared: PreparedPackageTool
    configuration?: ExpertSquadRegistry.LoadedPackage["manifest"]["configuration"]
    installationScope: "project" | "global"
    namespace: string
  }

  export interface ResolvedPackageMcpRef extends ResolvedProviderRef {
    prepared: ExpertSquadRegistry.PreparedPackageMcpCapability
  }

  export interface ResolvedSchedulerCapability {
    expertSquadID: string
    packageRevision: ResolvedPackageRevision
    identity: ProjectedSchedulerIdentity
    builtIn: boolean
    projectionHash: string
    scheduler: ExpertSquadRegistry.SchedulerProjection
    virtualWorkflows: ExpertSquadRegistry.VirtualWorkflows
    builtInToolIDs: string[]
    defaultTools: ResolvedProviderRef[]
    packageTools: ResolvedPackageTool[]
    defaultMcpTools: ResolvedProviderRef[]
    defaultMcpPrompts: ResolvedProviderRef[]
    defaultMcpResources: ResolvedProviderRef[]
    defaultMcpServers: Record<string, Config.Mcp>
    globalMcpTimeout?: number
    packageMcpTools: ResolvedPackageMcpRef[]
    packageMcpPrompts: ResolvedPackageMcpRef[]
    packageMcpResources: ResolvedPackageMcpRef[]
    productionSkills: ProductionSkillGrant[]
    readmeContent: string
    promptOverlay?: string
    includeMcpTools: false
  }

  export interface WorkerCapabilityInput extends ProjectScope {
    config: ConfigLike
    agentID: string
    defaultSkills?: Skill.Info[]
    packageRevision?: ExpertSquadPackageRevision
  }

  export interface ResolvedWorkerCapability {
    expertSquadID: string
    packageRevision: ResolvedPackageRevision
    identity: ProjectedWorkerIdentity
    builtIn: boolean
    capabilityOwner: "package" | "platform"
    projection: ExpertSquadRegistry.AgentProjection
    builtInToolIDs: string[]
    defaultTools: ResolvedProviderRef[]
    packageTools: ResolvedPackageTool[]
    defaultMcpTools: ResolvedProviderRef[]
    defaultMcpPrompts: ResolvedProviderRef[]
    defaultMcpResources: ResolvedProviderRef[]
    defaultMcpServers: Record<string, Config.Mcp>
    globalMcpTimeout?: number
    packageMcpTools: ResolvedPackageMcpRef[]
    packageMcpPrompts: ResolvedPackageMcpRef[]
    packageMcpResources: ResolvedPackageMcpRef[]
    productionSkills: ProductionSkillGrant[]
    promptOverlay?: string
    runtime: SessionAgentRuntime
    promptLayers: {
      templateAppend?: string
      projectedAgentAppend?: string
    }
    includeMcpTools: false
  }

  export interface ResolvedWorkerTurnProjection {
    workerCapability: ResolvedWorkerCapability
    skillProjection: ResolvedSkillProjection
  }

  export interface ResolvedSchedulerTurnProjection {
    schedulerCapability: ResolvedSchedulerCapability
    skillProjection: ResolvedSkillProjection
  }

  function harnessRefs(
    kind: CapabilityKind,
    source: CapabilityRef["source"],
    ownerRef: string,
    refs: readonly string[],
  ): CapabilityRef[] {
    return refs.map((localRef) =>
      capabilityRef({
        kind,
        source,
        owner_ref: ownerRef,
        local_ref: localRef,
      }),
    )
  }

  function capabilityHarnessRefs(capability: ResolvedSchedulerCapability | ResolvedWorkerCapability) {
    const projection = "scheduler" in capability ? capability.scheduler : capability.projection
    return {
      tool_refs: [
        ...harnessRefs("tool", "platform", "tool-registry", capability.builtInToolIDs),
        ...harnessRefs(
          "tool",
          "platform",
          "default-tool-registry",
          capability.defaultTools.map((entry) => entry.providerName),
        ),
        ...harnessRefs(
          "tool",
          "package",
          capability.expertSquadID,
          capability.packageTools.map((entry) => entry.providerName),
        ),
      ],
      skill_refs: capability.productionSkills.map((grant) =>
        capabilityRef({
          kind: "skill",
          source: grant.source === "package" ? "package" : "platform",
          owner_ref: capability.expertSquadID,
          local_ref: grant.ref,
        }),
      ),
      mcp_server_refs: [
        ...harnessRefs("mcp_server", "project", "mcp-config", projection.default_mcp_server_refs),
        ...harnessRefs("mcp_server", "package", capability.expertSquadID, projection.package_mcp_server_refs),
      ],
      mcp_tool_refs: [
        ...harnessRefs(
          "mcp_tool",
          "project",
          "default-mcp-registry",
          capability.defaultMcpTools.map((entry) => entry.providerName),
        ),
        ...harnessRefs(
          "mcp_tool",
          "package",
          capability.expertSquadID,
          capability.packageMcpTools.map((entry) => entry.providerName),
        ),
      ],
      mcp_prompt_refs: [
        ...harnessRefs(
          "mcp_prompt",
          "project",
          "default-mcp-registry",
          capability.defaultMcpPrompts.map((entry) => entry.ref),
        ),
        ...harnessRefs(
          "mcp_prompt",
          "package",
          capability.expertSquadID,
          capability.packageMcpPrompts.map((entry) => entry.ref),
        ),
      ],
      mcp_resource_refs: [
        ...harnessRefs(
          "mcp_resource",
          "project",
          "default-mcp-registry",
          capability.defaultMcpResources.map((entry) => entry.ref),
        ),
        ...harnessRefs(
          "mcp_resource",
          "package",
          capability.expertSquadID,
          capability.packageMcpResources.map((entry) => entry.ref),
        ),
      ],
    }
  }

  export function schedulerHarnessProjection(input: { taskID: string; capability: ResolvedSchedulerCapability }) {
    const refs = capabilityHarnessRefs(input.capability)
    return createHarnessProjection({
      context: {
        kind: "task_scheduler",
        task_id: input.taskID,
        profile_id: input.capability.expertSquadID,
      },
      owner_revision: input.capability.projectionHash,
      ...refs,
      mission_skill_refs: [],
    })
  }

  export function workerHarnessProjection(input: { taskID: string; capability: ResolvedWorkerCapability }) {
    const refs = capabilityHarnessRefs(input.capability)
    return createHarnessProjection({
      context: {
        kind: "task_agent",
        task_id: input.taskID,
        profile_id: input.capability.expertSquadID,
        agent_id: input.capability.identity.agentID,
      },
      owner_revision: input.capability.identity.projectionHash,
      ...refs,
      mission_skill_refs: [],
    })
  }

  export interface ResolvedProjectedAgent {
    identity: ProjectedWorkerIdentity
    packageRevision: ResolvedPackageRevision
    virtualWorkflows: ExpertSquadRegistry.VirtualWorkflows
    capabilityOwner: "package" | "platform"
    label: string
    description?: string
    builtInToolIDs: string[]
    projectedToolIDs: string[]
  }

  export interface ResolvedProjectedScheduler {
    identity: ProjectedSchedulerIdentity
    label: string
    description?: string
    virtualWorkflows: ExpertSquadRegistry.VirtualWorkflows
    builtInToolIDs: string[]
    projectedToolIDs: string[]
  }

  export interface ResolvedWorkerRuntimeTools<T> {
    projectedTools: Record<string, T>
    stageTools: Record<string, T>
  }

  export interface SkillProjectionInput extends ProjectScope {
    config: ConfigLike
    defaultSkills?: Skill.Info[]
    packageRevision?: ExpertSquadPackageRevision
  }

  export interface ResolvedSkillProjection {
    expertSquadID: string
    builtIn: boolean
    projectionHash: string
    projectedToolIDs: string[]
    projectedAgentIDs: string[]
    projectedScheduler: ResolvedProjectedScheduler
    projectedAgents: ResolvedProjectedAgent[]
    schedulerOnlyAgents: ResolvedProjectedAgent[]
    selectorSkillNames: string[]
    productionSkillNames: string[]
    projectedSkillNames: string[]
    selectorSkills: ResolvedSelectorSkill[]
    productionSkills: ProductionSkillGrant[]
    skillInventory: Skill.Info[]
  }

  type BuiltInPackage = ReturnType<typeof getLoadedBuiltInPackages>[number]
  type PackageMcpRefInventory = Pick<
    ExpertSquadRegistry.LoadedPackage,
    "packageMcpDeclarations" | "packageMcpTools" | "packageMcpPrompts" | "packageMcpResources"
  >
  type ActiveProfilePackage =
    | {
        profileID: string
        builtIn: true
        pkg: ExpertSquadRegistry.LoadedPackage
      }
    | {
        profileID: string
        builtIn: false
        pkg: ExpertSquadRegistry.LoadedPackage
      }

  interface SkillMountProfilePackage {
    profileID: string
    builtIn: boolean
    pkg: Pick<ExpertSquadRegistry.CatalogPackage, "id" | "manifest">
  }

  interface CapabilityResolutionContext {
    active: ActiveProfilePackage
    projectID: string | null
    defaultSkills: Skill.Info[]
    defaultSkillsByName: ReadonlyMap<string, Skill.Info>
  }

  function resolvedPackageRevision(context: CapabilityResolutionContext): ResolvedPackageRevision {
    const active = context.active
    if (!active.builtIn && !active.pkg.installationScope) {
      throw new Error(`Active external expert squad ${active.profileID} is missing installation scope.`)
    }
    return {
      scope: active.builtIn ? "built_in" : active.pkg.installationScope!,
      projectID: active.builtIn || active.pkg.installationScope === "global" ? null : context.projectID,
      namespace: active.pkg.namespace,
      id: active.pkg.id,
      version: active.pkg.version,
      packageDigest: active.pkg.packageDigest,
    }
  }

  interface ResolvedPackageCapabilitySet {
    context: CapabilityResolutionContext
    scheduler: ResolvedSchedulerCapability
    workers: ResolvedWorkerCapability[]
    schedulerOnlyWorkers: ResolvedWorkerCapability[]
  }

  const universalBuildProjection: ExpertSquadRegistry.AgentProjection = Object.freeze({
    label: UNIVERSAL_BUILD_LABEL,
    description: UNIVERSAL_BUILD_DESCRIPTION,
    base_role: "build",
    inherit_base_tools: true,
    built_in_tool_ids: [],
    default_skill_refs: [],
    package_skill_refs: [],
    default_tool_refs: [],
    package_tool_refs: [],
    default_mcp_server_refs: [],
    package_mcp_server_refs: [],
    default_mcp_tool_refs: [],
    package_mcp_tool_refs: [],
    default_mcp_prompt_refs: [],
    package_mcp_prompt_refs: [],
    default_mcp_resource_refs: [],
    package_mcp_resource_refs: [],
  })

  function freezeResolvedProjection<T>(value: T, seen = new WeakSet<object>()): T {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return value
    const object = value as object
    if (Object.isFrozen(object) || seen.has(object)) return value
    seen.add(object)
    for (const key of Reflect.ownKeys(object)) {
      freezeResolvedProjection((object as Record<PropertyKey, unknown>)[key], seen)
    }
    return Object.freeze(value)
  }

  function builtInPackages() {
    return Object.fromEntries(getLoadedBuiltInPackages().map((pkg) => [pkg.id, pkg])) as Record<string, BuiltInPackage>
  }

  function assertNoBuiltInCollision(profileID: string) {
    if (Object.hasOwn(builtInPackages(), profileID)) {
      throw new Error(
        `External expert squad package id ${JSON.stringify(profileID)} collides with a built-in expert squad id.`,
      )
    }
  }

  async function discoverExternalPackages(
    projectDirectory: string,
  ): Promise<ExpertSquadRegistry.PackageCatalogEntry[]> {
    const entries = await ExpertSquadRegistry.discover(projectDirectory)
    for (const entry of entries) assertNoBuiltInCollision(entry.id)
    return entries
  }

  async function discoverAvailableExternalPackages(
    projectDirectory?: string,
    reconcileEvolutionMutations = true,
  ) {
    const result = projectDirectory
      ? await ExpertSquadRegistry.discoverAvailable(projectDirectory, { reconcileEvolutionMutations })
      : await ExpertSquadRegistry.discoverGlobalAvailable()
    const items: ExpertSquadRegistry.PackageCatalogEntry[] = []
    const issues = [...result.issues]
    for (const entry of result.items) {
      if (Object.hasOwn(builtInPackages(), entry.id)) {
        issues.push({
          phase: "identity.duplicate",
          location: entry.root,
          namespace: entry.namespace,
          id: entry.id,
          message: `External expert squad package id ${JSON.stringify(entry.id)} collides with a built-in expert squad id.`,
        })
        continue
      }
      items.push(entry)
    }
    if (projectDirectory) {
      const effective = result as ExpertSquadRegistry.EffectiveDiscoveryResult<ExpertSquadRegistry.PackageCatalogEntry>
      return { items, issues, installations: effective.installations, warnings: effective.warnings }
    }
    return { items, issues, installations: result.items, warnings: [] as ExpertSquadRegistry.DiscoveryWarning[] }
  }

  async function externalCatalogPackages(projectDirectory?: string): Promise<{
    packages: Record<string, ExpertSquadRegistry.CatalogPackage>
    installations: ExpertSquadRegistry.CatalogPackage[]
    issues: ExpertSquadRegistry.DiscoveryIssue[]
    warnings: ExpertSquadRegistry.DiscoveryWarning[]
  }> {
    const result: Record<string, ExpertSquadRegistry.CatalogPackage> = {}
    const discovered = await discoverAvailableExternalPackages(projectDirectory)
    const issues = [...discovered.issues]
    for (const entry of discovered.items) {
      try {
        const loaded = {
          ...(await ExpertSquadRegistry.loadCatalogPackage(entry.root)),
          installationScope: entry.installationScope,
        }
        if (loaded.id !== entry.id) {
          throw new Error(
            `Discovered expert squad ${JSON.stringify(entry.id)} loaded mismatched manifest id ${JSON.stringify(loaded.id)}.`,
          )
        }
        assertNoBuiltInCollision(loaded.id)
        if (Object.hasOwn(result, loaded.id)) {
          throw new Error(`External expert squad catalog loaded duplicate id ${JSON.stringify(loaded.id)}.`)
        }
        result[loaded.id] = loaded
      } catch (error) {
        issues.push({
          phase: "package.catalog",
          location: entry.root,
          namespace: entry.namespace,
          id: entry.id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    const installations: ExpertSquadRegistry.CatalogPackage[] = []
    for (const entry of discovered.installations) {
      try {
        const loaded = {
          ...(await ExpertSquadRegistry.loadCatalogPackage(entry.root)),
          installationScope: entry.installationScope,
        }
        assertNoBuiltInCollision(loaded.id)
        installations.push(loaded)
      } catch (error) {
        if (!issues.some((issue) => issue.location === entry.root && issue.phase === "package.catalog")) {
          issues.push({
            phase: "package.catalog",
            location: entry.root,
            namespace: entry.namespace,
            id: entry.id,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
    return { packages: result, installations, issues, warnings: discovered.warnings }
  }

  async function loadExternalPackageByID(
    projectDirectory: string,
    profileID: string,
    reconcileEvolutionMutations = true,
  ): Promise<ExpertSquadRegistry.LoadedPackage | undefined> {
    ExpertSquadRegistry.parseID(profileID)
    const discovered = await discoverAvailableExternalPackages(projectDirectory, reconcileEvolutionMutations)
    const entry = discovered.items.find((candidate) => candidate.id === profileID)
    if (!entry) {
      const issue = discovered.issues.find((candidate) => candidate.id === profileID)
      if (issue) throw new Error(issue.message)
      return undefined
    }
    const loaded = await ExpertSquadRegistry.loadPackage(entry.root)
    if (loaded.id !== profileID) {
      throw new Error(
        `Discovered expert squad ${JSON.stringify(profileID)} loaded mismatched manifest id ${JSON.stringify(loaded.id)}.`,
      )
    }
    assertNoBuiltInCollision(loaded.id)
    return { ...loaded, installationScope: entry.installationScope }
  }

  async function loadGlobalExternalPackageByID(
    profileID: string,
  ): Promise<ExpertSquadRegistry.LoadedPackage | undefined> {
    ExpertSquadRegistry.parseID(profileID)
    const identities = await ExpertSquadRegistry.findInstalledPackageIdentitiesForProjects([], profileID)
    const identity = identities[0]
    if (!identity) return undefined
    const loaded = await ExpertSquadRegistry.loadPackage(identity.root)
    if (loaded.id !== profileID) {
      throw new Error(
        `Discovered global expert squad ${JSON.stringify(profileID)} loaded mismatched manifest id ${JSON.stringify(loaded.id)}.`,
      )
    }
    assertNoBuiltInCollision(loaded.id)
    return { ...loaded, installationScope: identity.location }
  }

  async function loadBuiltInRuntimePackage(profileID: string): Promise<ExpertSquadRegistry.LoadedPackage> {
    const source = builtInPackageSources.find((candidate) => candidate.id === profileID)
    if (!source) throw new Error(`Built-in expert squad source is missing: ${profileID}`)
    const snapshot = await ExpertSquadRegistry.materializeEmbeddedPackageSnapshot(source)
    const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(snapshot.digest)
    if (loaded.id !== profileID) {
      throw new Error(
        `Built-in expert squad ${JSON.stringify(profileID)} loaded mismatched manifest id ${JSON.stringify(loaded.id)}.`,
      )
    }
    return loaded
  }

  async function packageForActiveProfile(input: SchedulerCapabilityInput): Promise<ActiveProfilePackage> {
    if (input.packageRevision) {
      const revision = input.packageRevision
      const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.packageDigest)
      if (
        loaded.id !== revision.id ||
        loaded.namespace !== revision.namespace ||
        loaded.version !== revision.version ||
        loaded.packageDigest !== revision.packageDigest
      ) {
        throw new Error(`Pinned expert squad package revision ${revision.packageDigest} does not match its binding`)
      }
      if (revision.scope === "built_in") {
        return { profileID: revision.id, builtIn: true, pkg: loaded }
      }
      return {
        profileID: revision.id,
        builtIn: false,
        pkg: { ...loaded, installationScope: revision.scope },
      }
    }
    const profileID = PromptProfile.activeID(input.config)
    const builtIn = builtInPackages()[profileID]
    if (builtIn) {
      if (input.projectDirectory) {
        for (const entry of (
          await discoverAvailableExternalPackages(input.projectDirectory, input.reconcileEvolutionMutations)
        ).items) {
          if (entry.id === profileID) {
            throw new Error(
              `External expert squad package id ${JSON.stringify(profileID)} collides with a built-in expert squad id.`,
            )
          }
        }
      }
      return { profileID, builtIn: true, pkg: await loadBuiltInRuntimePackage(profileID) }
    }
    const externalPackage = input.projectDirectory
      ? await loadExternalPackageByID(input.projectDirectory, profileID, input.reconcileEvolutionMutations)
      : undefined
    if (externalPackage) return { profileID, builtIn: false, pkg: externalPackage }
    throw new Error(`Unknown prompt profile ${JSON.stringify(profileID)}`)
  }

  function skillInventoryByName(skills: Skill.Info[]): ReadonlyMap<string, Skill.Info> {
    const result = new Map<string, Skill.Info>()
    for (const skill of skills) {
      if (result.has(skill.name)) throw new Error(`Default skill inventory repeats name ${JSON.stringify(skill.name)}.`)
      result.set(skill.name, skill)
    }
    return result
  }

  function assertPackageSkillMounts(input: {
    active: SkillMountProfilePackage
    defaultSkillsByName: ReadonlyMap<string, Skill.Info>
    skillMounts: Config.Info["skill_mounts"]
  }): void {
    const mounts = input.skillMounts?.[input.active.profileID]
    if (!mounts) return
    const projections = new Map(
      ExpertSquadRegistry.agentProjectionEntries(input.active.pkg.manifest).map((entry) => [entry.agentID, entry]),
    )
    for (const [agentID, overrides] of Object.entries(mounts)) {
      const baseRole = agentID === "orchestrator" ? "orchestrator" : projections.get(agentID)?.baseRole
      if (!baseRole) {
        throw new Error(
          `Expert squad ${input.active.profileID} skill_mounts references undeclared dynamic agent ${JSON.stringify(agentID)}.`,
        )
      }
      const skillMountable = baseRole === "orchestrator" ? false : RuntimeTemplateRegistry.get(baseRole).skillMountable
      if (!skillMountable) {
        throw new Error(
          `Expert squad ${input.active.profileID} agent ${agentID} uses base role ${baseRole}, which does not allow operator skill mounts.`,
        )
      }
      for (const ref of Object.keys(overrides)) {
        const name = defaultSkillNameFromRef(ref)
        if (!input.defaultSkillsByName.has(name)) {
          throw new Error(
            `Expert squad ${input.active.profileID} agent ${agentID} skill_mounts references missing default skill ${ref}.`,
          )
        }
      }
    }
  }

  export async function assertSkillMountConfig(input: {
    projectDirectory: string
    config: ConfigLike
    defaultSkills?: Skill.Info[]
  }): Promise<void> {
    const defaultSkills =
      input.defaultSkills ?? (await Instance.provide({ directory: input.projectDirectory, fn: () => Skill.all() }))
    const defaultSkillsByName = skillInventoryByName(defaultSkills)
    const projectEntries = await discoverExternalPackages(input.projectDirectory)
    const projectEntriesByID = new Map(projectEntries.map((entry) => [entry.id, entry]))
    for (const expertSquadID of Object.keys(input.config.skill_mounts ?? {}).sort(compareCanonicalStrings)) {
      ExpertSquadRegistry.parseID(expertSquadID)
      const builtIn = builtInPackages()[expertSquadID]
      const projectEntry = projectEntriesByID.get(expertSquadID)
      if (builtIn && projectEntry) {
        throw new Error(
          `External expert squad package id ${JSON.stringify(expertSquadID)} collides with a built-in expert squad id.`,
        )
      }
      const active: SkillMountProfilePackage = builtIn
        ? { profileID: expertSquadID, builtIn: true, pkg: builtIn }
        : projectEntry
          ? {
              profileID: expertSquadID,
              builtIn: false,
              pkg: await ExpertSquadRegistry.loadCatalogPackage(projectEntry.root),
            }
          : (() => {
              throw new Error(`skill_mounts references unknown expert squad ${JSON.stringify(expertSquadID)}.`)
            })()
      if (active.pkg.id !== expertSquadID) {
        throw new Error(
          `Discovered expert squad ${JSON.stringify(expertSquadID)} loaded mismatched manifest id ${JSON.stringify(active.pkg.id)}.`,
        )
      }
      assertPackageSkillMounts({
        active,
        defaultSkillsByName,
        skillMounts: input.config.skill_mounts,
      })
    }
  }

  async function capabilityResolutionContext(input: SchedulerCapabilityInput): Promise<CapabilityResolutionContext> {
    const loadDefaultSkills = () => {
      if (input.defaultSkills !== undefined) return Promise.resolve(input.defaultSkills)
      if (!input.projectDirectory) return Skill.all()
      return Instance.provide({ directory: input.projectDirectory, fn: () => Skill.all() })
    }
    const [active, defaultSkills] = await Promise.all([packageForActiveProfile(input), loadDefaultSkills()])
    const projectID =
      !active.builtIn && active.pkg.installationScope === "project"
        ? input.projectDirectory
          ? await Instance.provide({ directory: input.projectDirectory, fn: () => Instance.project.id })
          : Instance.project.id
        : null
    const context = {
      active,
      projectID,
      defaultSkills,
      defaultSkillsByName: skillInventoryByName(defaultSkills),
    }
    if (input.packageRevision) {
      const resolvedRevision = resolvedPackageRevision(context)
      if (
        resolvedRevision.scope !== input.packageRevision.scope ||
        resolvedRevision.projectID !== input.packageRevision.projectID ||
        resolvedRevision.namespace !== input.packageRevision.namespace ||
        resolvedRevision.id !== input.packageRevision.id ||
        resolvedRevision.version !== input.packageRevision.version ||
        resolvedRevision.packageDigest !== input.packageRevision.packageDigest
      ) {
        throw new Error(
          `Resolved expert squad package revision does not match Task binding ${input.packageRevision.packageDigest}`,
        )
      }
    }
    assertPackageSkillMounts({
      active: context.active,
      defaultSkillsByName: context.defaultSkillsByName,
      skillMounts: input.config.skill_mounts,
    })
    return context
  }

  export const packageToolProviderName = packageToolProviderNameFromRef
  export const packageMcpToolProviderName = packageMcpToolProviderNameFromRef
  export const packageMcpPromptProviderName = packageMcpPromptProviderNameFromRef
  export const packageMcpResourceProviderName = packageMcpResourceProviderNameFromRef
  export const defaultToolProviderName = defaultToolProviderNameFromRef
  export const defaultMcpToolProviderName = defaultMcpToolProviderNameFromRef
  export const defaultMcpPromptProviderName = defaultMcpPromptProviderNameFromRef
  export const defaultMcpResourceProviderName = defaultMcpResourceProviderNameFromRef
  const defaultToolNameFromRef = defaultToolNameFromCapabilityRef

  function contentDigest(content: string | undefined): string | null {
    return content === undefined ? null : textSHA256(content)
  }

  function canonicalAutoDetect(autoDetect: Skill.Info["auto_detect"]): unknown {
    if (!autoDetect) return null
    const signals = autoDetect.task_signals
    return {
      files: autoDetect.files ? canonicalStringSet(autoDetect.files, "skill.auto_detect.files") : [],
      deps: autoDetect.deps ? canonicalStringSet(autoDetect.deps, "skill.auto_detect.deps") : [],
      task_signals: signals
        ? {
            has_attachment_image: signals.has_attachment_image ?? null,
            request_contains_url: signals.request_contains_url ?? null,
            package_has_script: signals.package_has_script
              ? canonicalStringSet(signals.package_has_script, "skill.auto_detect.task_signals.package_has_script")
              : [],
            request_text_any: signals.request_text_any
              ? canonicalStringSet(signals.request_text_any, "skill.auto_detect.task_signals.request_text_any")
              : [],
          }
        : null,
    }
  }

  function canonicalSkillDefinition(skill: Skill.Info) {
    return {
      name: skill.name,
      description: skill.description,
      content_sha256: textSHA256(skill.content),
      platforms: canonicalStringSet(skill.platforms, `skill ${skill.name}.platforms`),
      builtin: skill.builtin,
      auto_detect: canonicalAutoDetect(skill.auto_detect),
      priority: skill.priority,
      required_tools: canonicalStringSet(skill.required_tools, `skill ${skill.name}.required_tools`),
      expires_at: skill.expires_at ?? null,
    }
  }

  function canonicalProductionSkillGrant(grant: ProductionSkillGrant) {
    return {
      source: grant.source,
      ref: grant.ref,
      agent_ids: canonicalStringSet(grant.agentIDs, `production skill ${grant.ref}.agentIDs`),
      definition: canonicalSkillDefinition(grant.skill),
      package_snapshot: grant.source === "package" ? grant.snapshot : null,
    }
  }

  function canonicalProviderRefs(entries: readonly ResolvedProviderRef[], context: string) {
    return [...entries]
      .map((entry) => ({ ref: entry.ref, provider_name: entry.providerName }))
      .sort(
        (left, right) =>
          compareCanonicalStrings(left.ref, right.ref) ||
          compareCanonicalStrings(left.provider_name, right.provider_name),
      )
      .map((entry, index, all) => {
        if (index > 0 && all[index - 1]!.ref === entry.ref) throw new Error(`${context} repeats ref ${entry.ref}`)
        return entry
      })
  }

  function canonicalPackageTools(entries: readonly ResolvedPackageTool[]) {
    return [...entries]
      .map((entry) => ({ ref: entry.ref, provider_name: entry.providerName, snapshot: entry.prepared.snapshot }))
      .sort((left, right) => compareCanonicalStrings(left.ref, right.ref))
  }

  function canonicalPackageMcpRefs(entries: readonly ResolvedPackageMcpRef[]) {
    return [...entries]
      .map((entry) => ({
        ref: entry.ref,
        provider_name: entry.providerName,
        declaration_snapshot: entry.prepared.declaration.snapshot,
      }))
      .sort((left, right) => compareCanonicalStrings(left.ref, right.ref))
  }

  function capabilityProjectionPayload(input: {
    expertSquadID: string
    agentID: string
    baseRole: string
    sessionKind: string
    dispatchAdapterID: string | null
    runtimeTemplateABIVersion: number | null
    dispatchAdapterABIVersion: number | null
    corePromptSeed: string | undefined
    templateRuntimeOverride?: unknown
    projectedAgentRuntimeOverride?: unknown
    label: string | null
    description: string | null
    promptOverlay: string | undefined
    readmeContent: string | undefined
    builtInToolIDs: string[]
    defaultTools: ResolvedProviderRef[]
    packageTools: ResolvedPackageTool[]
    defaultMcpTools: ResolvedProviderRef[]
    defaultMcpPrompts: ResolvedProviderRef[]
    defaultMcpResources: ResolvedProviderRef[]
    defaultMcpServers: Record<string, Config.Mcp>
    packageMcpTools: ResolvedPackageMcpRef[]
    packageMcpPrompts: ResolvedPackageMcpRef[]
    packageMcpResources: ResolvedPackageMcpRef[]
    productionSkills: ProductionSkillGrant[]
    globalMcpTimeout: number | undefined
    virtualWorkflows: ExpertSquadRegistry.VirtualWorkflows | null
  }) {
    return {
      expert_squad_id: input.expertSquadID,
      agent_id: input.agentID,
      base_role: input.baseRole,
      session_kind: input.sessionKind,
      dispatch_adapter_id: input.dispatchAdapterID,
      runtime_template_abi_version: input.runtimeTemplateABIVersion,
      dispatch_adapter_abi_version: input.dispatchAdapterABIVersion,
      core_prompt_sha256: contentDigest(input.corePromptSeed),
      template_runtime_override: input.templateRuntimeOverride ?? null,
      projected_agent_runtime_override: input.projectedAgentRuntimeOverride ?? null,
      label: input.label,
      description: input.description,
      prompt_sha256: contentDigest(input.promptOverlay),
      readme_sha256: contentDigest(input.readmeContent),
      built_in_tool_ids: canonicalStringSet(input.builtInToolIDs, `${input.agentID}.builtInToolIDs`),
      default_tools: canonicalProviderRefs(input.defaultTools, `${input.agentID}.defaultTools`),
      package_tools: canonicalPackageTools(input.packageTools),
      default_mcp_tools: canonicalProviderRefs(input.defaultMcpTools, `${input.agentID}.defaultMcpTools`),
      default_mcp_prompts: canonicalProviderRefs(input.defaultMcpPrompts, `${input.agentID}.defaultMcpPrompts`),
      default_mcp_resources: canonicalProviderRefs(input.defaultMcpResources, `${input.agentID}.defaultMcpResources`),
      default_mcp_servers: input.defaultMcpServers,
      package_mcp_tools: canonicalPackageMcpRefs(input.packageMcpTools),
      package_mcp_prompts: canonicalPackageMcpRefs(input.packageMcpPrompts),
      package_mcp_resources: canonicalPackageMcpRefs(input.packageMcpResources),
      production_skills: [...input.productionSkills]
        .map(canonicalProductionSkillGrant)
        .sort((left, right) => compareCanonicalStrings(left.ref, right.ref)),
      global_mcp_timeout: input.globalMcpTimeout ?? null,
      virtual_workflows: input.virtualWorkflows,
    }
  }

  function catalogSummaryFromPackage(input: {
    pkg: BuiltInPackage | ExpertSquadRegistry.CatalogPackage | ExpertSquadRegistry.LoadedPackage
    builtIn: boolean
  }): ExpertSquadCatalogSummary {
    return catalogSummaryFromCapabilityPackage({
      pkg: input.pkg,
      builtIn: input.builtIn,
    })
  }

  type McpCapabilityKind = "tool" | "prompt" | "resource"

  function defaultMcpTypedPartsFromRef(
    ref: string,
    expectedKind?: McpCapabilityKind,
  ): { serverName: string; kind: McpCapabilityKind; itemName: string } {
    const match = /^default\/mcp\/([^/\\]+)\/(tool|prompt|resource)\/([^/\\]+)$/.exec(ref)
    if (!match) throw new Error(`Invalid default MCP ref ${JSON.stringify(ref)}`)
    const kind = match[2]! as McpCapabilityKind
    if (expectedKind && kind !== expectedKind) {
      throw new Error(`Invalid default MCP ${expectedKind} ref ${JSON.stringify(ref)}`)
    }
    return { serverName: match[1]!, kind, itemName: match[3]! }
  }

  function defaultMcpToolPartsFromRef(ref: string): { serverName: string; toolName: string } {
    const { serverName, itemName } = defaultMcpTypedPartsFromRef(ref, "tool")
    return { serverName, toolName: itemName }
  }

  function defaultMcpPromptPartsFromRef(ref: string): { serverName: string; promptName: string } {
    const { serverName, itemName } = defaultMcpTypedPartsFromRef(ref, "prompt")
    return { serverName, promptName: itemName }
  }

  function defaultMcpResourcePartsFromRef(ref: string): { serverName: string; resourceName: string } {
    const { serverName, itemName } = defaultMcpTypedPartsFromRef(ref, "resource")
    return { serverName, resourceName: itemName }
  }

  function defaultMcpServersForRefs(config: ConfigLike, refs: readonly string[]): Record<string, Config.Mcp> {
    const result: Record<string, Config.Mcp> = {}
    for (const ref of refs) {
      const { serverName } = defaultMcpTypedPartsFromRef(ref)
      const server = config.mcp?.[serverName]
      if (!server) throw new Error(`Active expert squad projects missing default MCP server default/mcp/${serverName}.`)
      result[serverName] =
        serverName === ComputerMCPBuiltin.ServerName
          ? ComputerMCPBuiltin.localConfig()
          : Config.Mcp.parse(server)
    }
    return result
  }

  function packageMcpKindRefs(
    pkg: PackageMcpRefInventory,
    kind: McpCapabilityKind,
  ): ReadonlyMap<string, ExpertSquadRegistry.PreparedPackageMcpCapability> {
    if (kind === "tool") return pkg.packageMcpTools
    if (kind === "prompt") return pkg.packageMcpPrompts
    return pkg.packageMcpResources
  }

  function projectionPackageMcpKindRefs(
    projection: ExpertSquadRegistry.Projection,
    kind: McpCapabilityKind,
  ): readonly string[] {
    if (kind === "tool") return projection.package_mcp_tool_refs
    if (kind === "prompt") return projection.package_mcp_prompt_refs
    return projection.package_mcp_resource_refs
  }

  function effectivePackageMcpRefs(input: {
    active:
      | { builtIn: true }
      | {
          builtIn: false
          pkg: PackageMcpRefInventory
        }
    projection: ExpertSquadRegistry.Projection
    kind: McpCapabilityKind
    context: string
  }): string[] {
    if (input.active.builtIn) return []
    const available = packageMcpKindRefs(input.active.pkg, input.kind)
    const result: string[] = []
    const seen = new Map<string, string>()
    const add = (ref: string, source: string) => {
      const previous = seen.get(ref)
      if (previous) {
        throw new Error(
          `${input.context}: package MCP ${input.kind} ref ${ref} is declared by both ${previous} and ${source}`,
        )
      }
      if (!available.has(ref)) {
        throw new Error(`${input.context}: package MCP ${input.kind} ref ${ref} is not declared in the active package`)
      }
      seen.set(ref, source)
      result.push(ref)
    }

    for (const serverRef of input.projection.package_mcp_server_refs) {
      if (!input.active.pkg.packageMcpDeclarations.has(serverRef)) {
        throw new Error(`${input.context}: package MCP server ref ${serverRef} is not declared in the active package`)
      }
      const prefix = `${serverRef}/${input.kind}/`
      const expanded = [...available.keys()].filter((item) => item.startsWith(prefix)).sort(compareCanonicalStrings)
      for (const ref of expanded) add(ref, `package_mcp_server_refs.${serverRef}`)
    }
    for (const ref of projectionPackageMcpKindRefs(input.projection, input.kind)) {
      add(ref, `package_mcp_${input.kind}_refs`)
    }
    return result
  }

  function activeProjectedSchedulerToolIDs(capability: ResolvedSchedulerCapability): string[] {
    return unique([
      ...capability.builtInToolIDs,
      ...capability.defaultTools.map((entry) => entry.providerName),
      ...capability.packageTools.map((entry) => entry.providerName),
      ...capability.defaultMcpTools.map((entry) => entry.providerName),
      ...capability.packageMcpTools.map((entry) => entry.providerName),
    ])
  }

  function assertProjectableBuiltInToolIDs(
    toolIDs: Iterable<string>,
    projectableToolIDs: ReadonlySet<string>,
    context: string,
  ) {
    for (const toolID of toolIDs) {
      if (!projectableToolIDs.has(toolID)) {
        throw new Error(`${context} cannot project built-in tool ${JSON.stringify(toolID)} from this runtime template`)
      }
    }
  }

  function providerEnvironment(config: ConfigLike) {
    return { batchToolEnabled: config.experimental?.batch_tool === true }
  }

  function expandedProjectedBuiltInToolIDs(input: {
    inheritedToolIDs: Iterable<string>
    explicitToolIDs: Iterable<string>
    projectableToolIDs: ReadonlySet<string>
    config: ConfigLike
    context: string
  }): string[] {
    const toolIDs = new Set<string>()
    const environment = providerEnvironment(input.config)
    for (const toolID of input.inheritedToolIDs) {
      if (builtInToolProviderState(toolID, environment) !== "unavailable") toolIDs.add(toolID)
    }
    for (const toolID of input.explicitToolIDs) {
      if (builtInToolProviderState(toolID, environment) === "unavailable") {
        throw new Error(`${input.context} cannot project unavailable built-in tool ${JSON.stringify(toolID)}`)
      }
      toolIDs.add(toolID)
    }
    assertProjectableBuiltInToolIDs(toolIDs, input.projectableToolIDs, input.context)
    assertBuiltInToolProviderClosure(toolIDs, environment, input.context)
    return [...toolIDs]
  }

  function expandedSchedulerBuiltInToolIDs(projection: ExpertSquadRegistry.Projection, config: ConfigLike): string[] {
    return expandedProjectedBuiltInToolIDs({
      inheritedToolIDs: [
        ...(projection.inherit_base_tools ? AgentToolPool.orchestratorSchedulerRoleBaseToolIDs() : []),
        ...TASK_ARTIFACT_DISCOVERY_TOOL_IDS,
        "publish_interactive_artifact",
      ],
      explicitToolIDs: projection.built_in_tool_ids,
      projectableToolIDs: AgentToolPool.orchestratorSchedulerProjectableToolIDs(),
      config,
      context: "Orchestrator scheduler template",
    })
  }

  function expandedWorkerBuiltInToolIDs(
    baseRole: RuntimeTemplateID,
    projection: ExpertSquadRegistry.Projection,
    config: ConfigLike,
  ): string[] {
    return expandedProjectedBuiltInToolIDs({
      inheritedToolIDs: [
        ...(projection.inherit_base_tools
          ? AgentToolPool.visibleToolIDs(AgentToolPool.runtimeTemplateAssignment(baseRole))
          : []),
        ...TASK_ARTIFACT_TOOL_IDS,
        "publish_interactive_artifact",
      ],
      explicitToolIDs: projection.built_in_tool_ids,
      projectableToolIDs: AgentToolPool.projectableRuntimeTemplateBuiltInToolIDs(baseRole),
      config,
      context: `Worker base-role template ${baseRole}`,
    })
  }

  function workerProjectionForAgentID(
    active: ActiveProfilePackage,
    agentID: string,
  ): ExpertSquadRegistry.AgentProjectionEntry | undefined {
    if (agentID === UNIVERSAL_BUILD_AGENT_ID) {
      return { agentID, baseRole: "build", projection: universalBuildProjection }
    }
    return ExpertSquadRegistry.agentProjectionForID(
      active.pkg.manifest,
      agentID,
      `Active expert squad ${JSON.stringify(active.profileID)}`,
    )
  }

  function resolvedProviderRefs(
    refs: readonly string[],
    providerNameForRef: (ref: string) => string,
    context: string,
  ): ResolvedProviderRef[] {
    const seenProviderNames = new Set<string>()
    return refs.map((ref) => {
      const providerName = providerNameForRef(ref)
      if (seenProviderNames.has(providerName)) {
        throw new Error(`${context} provider name collision for ${ref}: ${providerName}`)
      }
      seenProviderNames.add(providerName)
      return { ref, providerName }
    })
  }

  function assertDefaultToolsDoNotRepeatBuiltIns(
    builtInToolIDs: readonly string[],
    defaultTools: readonly ResolvedProviderRef[],
    context: string,
  ): void {
    const builtIns = new Set(builtInToolIDs)
    for (const entry of defaultTools) {
      if (builtIns.has(entry.providerName)) {
        throw new Error(`${context} declares ${entry.ref} as both a built-in and default tool`)
      }
    }
  }

  function assertProjectableDefaultHostTools(
    defaultTools: readonly ResolvedProviderRef[],
    baseRole: RuntimeTemplateID,
    context: string,
  ): void {
    const projectable = AgentToolPool.packageProjectableDefaultHostToolIDsForRuntimeTemplate(baseRole)
    for (const entry of defaultTools) {
      if (!projectable.has(entry.providerName)) {
        throw new Error(`${context} cannot project default host tool ${entry.ref} from base-role template ${baseRole}`)
      }
    }
  }

  function assertProjectableSchedulerDefaultHostTools(
    defaultTools: readonly ResolvedProviderRef[],
    context: string,
  ): void {
    const projectable = AgentToolPool.packageProjectableDefaultHostToolIDs("orchestrator")
    for (const entry of defaultTools) {
      if (!projectable.has(entry.providerName)) {
        throw new Error(`${context} cannot project default host tool ${entry.ref} from scheduler template orchestrator`)
      }
    }
  }

  function resolvedPackageTools(active: ActiveProfilePackage, refs: readonly string[]): ResolvedPackageTool[] {
    if (active.builtIn) return []
    return resolvedProviderRefs(
      refs,
      packageToolProviderName,
      `Active expert squad ${active.profileID} package tools`,
    ).map((entry) => {
      const prepared = active.pkg.packageToolBundles.get(entry.ref)
      if (!prepared) {
        throw new Error(`Active expert squad ${active.profileID} has no prepared package tool ${entry.ref}.`)
      }
      if (!active.pkg.installationScope) {
        throw new Error(`Active external expert squad ${active.profileID} is missing installation scope.`)
      }
      return {
        ...entry,
        prepared,
        configuration: active.pkg.manifest.configuration,
        installationScope: active.pkg.installationScope,
        namespace: active.pkg.namespace,
      }
    })
  }

  function resolvedPackageMcpRefs(
    active: ActiveProfilePackage,
    refs: readonly string[],
    kind: McpCapabilityKind,
    providerNameForRef: (ref: string) => string,
    context: string,
  ): ResolvedPackageMcpRef[] {
    if (active.builtIn) return []
    const preparedByRef = packageMcpKindRefs(active.pkg, kind)
    return resolvedProviderRefs(refs, providerNameForRef, context).map((entry) => {
      const prepared = preparedByRef.get(entry.ref)
      if (!prepared) {
        throw new Error(`Active expert squad ${active.profileID} has no prepared package MCP ${kind} ${entry.ref}.`)
      }
      return { ...entry, prepared }
    })
  }

  async function resolveSchedulerCapabilityForContext(
    context: CapabilityResolutionContext,
    config: ConfigLike,
  ): Promise<ResolvedSchedulerCapability> {
    const active = context.active
    const scheduler = active.pkg.manifest.capability_projection.scheduler
    const schedulerContract = AgentRoleContract.get("orchestrator")
    if (schedulerContract.sessionKind === null) {
      throw new Error("orchestrator role contract requires a session kind")
    }
    const builtInToolIDs = expandedSchedulerBuiltInToolIDs(scheduler, config)
    const defaultTools = resolvedProviderRefs(
      scheduler.default_tool_refs,
      defaultToolProviderName,
      "capability_projection.scheduler.default_tool_refs",
    )
    assertProjectableSchedulerDefaultHostTools(defaultTools, "capability_projection.scheduler")
    assertDefaultToolsDoNotRepeatBuiltIns(builtInToolIDs, defaultTools, "capability_projection.scheduler")
    const packageTools = resolvedPackageTools(active, active.builtIn ? [] : scheduler.package_tool_refs)
    const defaultMcpTools = resolvedProviderRefs(
      scheduler.default_mcp_tool_refs,
      defaultMcpToolProviderName,
      "capability_projection.scheduler.default_mcp_tool_refs",
    )
    const defaultMcpPrompts = resolvedProviderRefs(
      scheduler.default_mcp_prompt_refs,
      defaultMcpPromptProviderName,
      "capability_projection.scheduler.default_mcp_prompt_refs",
    )
    const defaultMcpResources = resolvedProviderRefs(
      scheduler.default_mcp_resource_refs,
      defaultMcpResourceProviderName,
      "capability_projection.scheduler.default_mcp_resource_refs",
    )
    const defaultMcpServers = defaultMcpServersForRefs(config, [
      ...defaultMcpTools.map((entry) => entry.ref),
      ...defaultMcpPrompts.map((entry) => entry.ref),
      ...defaultMcpResources.map((entry) => entry.ref),
    ])
    const globalMcpTimeout = config.experimental?.mcp_timeout
    const packageMcpTools = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({
        active,
        projection: scheduler,
        kind: "tool",
        context: "capability_projection.scheduler",
      }),
      "tool",
      packageMcpToolProviderName,
      "capability_projection.scheduler.package_mcp_tool_refs",
    )
    const packageMcpPrompts = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({
        active,
        projection: scheduler,
        kind: "prompt",
        context: "capability_projection.scheduler",
      }),
      "prompt",
      packageMcpPromptProviderName,
      "capability_projection.scheduler.package_mcp_prompt_refs",
    )
    const packageMcpResources = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({
        active,
        projection: scheduler,
        kind: "resource",
        context: "capability_projection.scheduler",
      }),
      "resource",
      packageMcpResourceProviderName,
      "capability_projection.scheduler.package_mcp_resource_refs",
    )
    const productionSkills = effectiveProductionSkillGrants(context, scheduler, "orchestrator", config)
    const promptOverlay = active.pkg.promptProfile.agents.orchestrator
    const readmeContent = active.pkg.readmeContent
    const projectionHash = canonicalProjectionHash(
      ProjectionHashDomain.scheduler,
      capabilityProjectionPayload({
        expertSquadID: active.pkg.id,
        agentID: "orchestrator",
        baseRole: "orchestrator",
        sessionKind: schedulerContract.sessionKind,
        dispatchAdapterID: null,
        runtimeTemplateABIVersion: null,
        dispatchAdapterABIVersion: null,
        corePromptSeed: undefined,
        label: active.pkg.promptProfile.label,
        description: active.pkg.promptProfile.description ?? null,
        promptOverlay,
        readmeContent,
        builtInToolIDs,
        defaultTools,
        packageTools,
        defaultMcpTools,
        defaultMcpPrompts,
        defaultMcpResources,
        defaultMcpServers,
        packageMcpTools,
        packageMcpPrompts,
        packageMcpResources,
        productionSkills,
        globalMcpTimeout,
        virtualWorkflows: active.pkg.manifest.capability_projection.virtual_workflows,
      }),
    )
    const identity = ProjectedSchedulerIdentitySchema.parse({
      agentID: "orchestrator",
      baseRole: "orchestrator",
      sessionKind: schedulerContract.sessionKind,
      projectionHash,
    })
    return freezeResolvedProjection<ResolvedSchedulerCapability>({
      expertSquadID: active.pkg.id,
      packageRevision: resolvedPackageRevision(context),
      identity,
      builtIn: active.builtIn,
      projectionHash,
      scheduler,
      virtualWorkflows: active.pkg.manifest.capability_projection.virtual_workflows,
      builtInToolIDs,
      defaultTools,
      packageTools,
      defaultMcpTools,
      defaultMcpPrompts,
      defaultMcpResources,
      defaultMcpServers,
      globalMcpTimeout,
      packageMcpTools,
      packageMcpPrompts,
      packageMcpResources,
      productionSkills,
      readmeContent,
      ...(promptOverlay ? { promptOverlay } : {}),
      includeMcpTools: false,
    })
  }

  export async function resolveSchedulerCapability(
    input: SchedulerCapabilityInput,
  ): Promise<ResolvedSchedulerCapability> {
    const context = await capabilityResolutionContext(input)
    return resolveSchedulerCapabilityForContext(context, input.config)
  }

  /** Resolve and materialize the exact immutable package revision selected by
   * the effective active profile. Callers cannot provide scope, path, version,
   * or digest; Registry and the effective catalog remain the only authority. */
  export async function resolveActivePackageRevision(
    input: Omit<SchedulerCapabilityInput, "packageRevision">,
  ): Promise<ResolvedPackageRevision> {
    return resolvedPackageRevision(await capabilityResolutionContext(input))
  }

  /** Resolve an exact already-materialized external revision without changing
   * the installed catalog. The active package supplies only the immutable
   * logical identity and installation scope; the requested digest supplies
   * the complete runtime bytes and version. */
  export async function resolveExternalPackageRevisionSnapshot(input: {
    activeRevision: ResolvedPackageRevision
    expectedPackageDigest: string
  }): Promise<ResolvedPackageRevision> {
    if (input.activeRevision.scope === "built_in") {
      throw new Error(`Built-in expert squad ${input.activeRevision.id} cannot bind an unpublished revision`)
    }
    const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(input.expectedPackageDigest)
    if (loaded.id !== input.activeRevision.id || loaded.namespace !== input.activeRevision.namespace) {
      throw new Error(
        `Expert squad revision ${input.expectedPackageDigest} has identity ${loaded.namespace}/${loaded.id}, ` +
          `expected ${input.activeRevision.namespace}/${input.activeRevision.id}`,
      )
    }
    return {
      scope: input.activeRevision.scope,
      projectID: input.activeRevision.projectID,
      namespace: loaded.namespace,
      id: loaded.id,
      version: loaded.version,
      packageDigest: loaded.packageDigest,
    }
  }

  async function resolveWorkerCapabilityForContext(input: {
    context: CapabilityResolutionContext
    config: ConfigLike
    agentID: string
  }): Promise<ResolvedWorkerCapability> {
    const active = input.context.active
    const projectionEntry = workerProjectionForAgentID(active, input.agentID)
    if (!projectionEntry) {
      throw new Error(
        `Active expert squad ${JSON.stringify(active.profileID)} does not define a projection for agent ${input.agentID}`,
      )
    }
    const { agentID, baseRole, projection } = projectionEntry
    const capabilityOwner = agentID === UNIVERSAL_BUILD_AGENT_ID ? "platform" : "package"
    const template = RuntimeTemplateRegistry.get(baseRole)
    const adapter = DispatchAdapterContractRegistry.get(template.dispatchAdapterID)
    const runtimeOverrides = runtimeOverrideLayers(input.config, {
      expertSquadID: active.pkg.id,
      agentID,
      baseRole,
      capabilityOwner,
    })
    const runtime = sessionRuntimeFromProjectedTemplate({
      template,
      templateOverride: runtimeOverrides.template,
      projectedAgentOverride: runtimeOverrides.projectedAgent,
      model: configuredProjectedWorkerModelRef(input.config, {
        expertSquadID: active.pkg.id,
        agentID,
        baseRole,
        capabilityOwner,
      }),
    })
    const builtInToolIDs = expandedWorkerBuiltInToolIDs(baseRole, projection, input.config)
    const context =
      capabilityOwner === "platform"
        ? `platform.scheduler_capabilities.${agentID}`
        : `capability_projection.agents.${agentID}`
    const defaultTools = resolvedProviderRefs(
      projection.default_tool_refs,
      defaultToolProviderName,
      `${context}.default_tool_refs`,
    )
    assertProjectableDefaultHostTools(defaultTools, baseRole, context)
    assertDefaultToolsDoNotRepeatBuiltIns(builtInToolIDs, defaultTools, context)
    const packageTools = resolvedPackageTools(active, active.builtIn ? [] : projection.package_tool_refs)
    const defaultMcpTools = resolvedProviderRefs(
      projection.default_mcp_tool_refs,
      defaultMcpToolProviderName,
      `${context}.default_mcp_tool_refs`,
    )
    const defaultMcpPrompts = resolvedProviderRefs(
      projection.default_mcp_prompt_refs,
      defaultMcpPromptProviderName,
      `${context}.default_mcp_prompt_refs`,
    )
    const defaultMcpResources = resolvedProviderRefs(
      projection.default_mcp_resource_refs,
      defaultMcpResourceProviderName,
      `${context}.default_mcp_resource_refs`,
    )
    const defaultMcpServers = defaultMcpServersForRefs(input.config, [
      ...defaultMcpTools.map((entry) => entry.ref),
      ...defaultMcpPrompts.map((entry) => entry.ref),
      ...defaultMcpResources.map((entry) => entry.ref),
    ])
    const globalMcpTimeout = input.config.experimental?.mcp_timeout
    const packageMcpTools = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, projection, kind: "tool", context }),
      "tool",
      packageMcpToolProviderName,
      `${context}.package_mcp_tool_refs`,
    )
    const packageMcpPrompts = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, projection, kind: "prompt", context }),
      "prompt",
      packageMcpPromptProviderName,
      `${context}.package_mcp_prompt_refs`,
    )
    const packageMcpResources = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, projection, kind: "resource", context }),
      "resource",
      packageMcpResourceProviderName,
      `${context}.package_mcp_resource_refs`,
    )
    const productionSkills = effectiveProductionSkillGrants(input.context, projection, agentID, input.config)
    const promptOverlay = capabilityOwner === "platform" ? undefined : active.pkg.promptProfile.agents[agentID]
    const workerProjectionHash = canonicalProjectionHash(
      ProjectionHashDomain.worker,
      capabilityProjectionPayload({
        expertSquadID: active.pkg.id,
        agentID,
        baseRole,
        sessionKind: adapter.sessionKind,
        dispatchAdapterID: template.dispatchAdapterID,
        runtimeTemplateABIVersion: template.templateABIVersion,
        dispatchAdapterABIVersion: adapter.abiVersion,
        corePromptSeed: template.corePromptSeed,
        templateRuntimeOverride: runtimeOverrides.template,
        projectedAgentRuntimeOverride: runtimeOverrides.projectedAgent,
        label: projection.label,
        description: projection.description ?? null,
        promptOverlay,
        readmeContent: undefined,
        builtInToolIDs,
        defaultTools,
        packageTools,
        defaultMcpTools,
        defaultMcpPrompts,
        defaultMcpResources,
        defaultMcpServers,
        packageMcpTools,
        packageMcpPrompts,
        packageMcpResources,
        productionSkills,
        globalMcpTimeout,
        virtualWorkflows: null,
      }),
    )
    const identity = ProjectedWorkerIdentitySchema.parse({
      agentID,
      baseRole,
      sessionKind: adapter.sessionKind,
      dispatchAdapterID: template.dispatchAdapterID,
      runtimeTemplateABIVersion: template.templateABIVersion,
      dispatchAdapterABIVersion: adapter.abiVersion,
      projectionHash: workerProjectionHash,
    })
    return freezeResolvedProjection<ResolvedWorkerCapability>({
      expertSquadID: active.pkg.id,
      packageRevision: resolvedPackageRevision(input.context),
      identity,
      builtIn: active.builtIn,
      capabilityOwner,
      projection,
      builtInToolIDs,
      defaultTools,
      packageTools,
      defaultMcpTools,
      defaultMcpPrompts,
      defaultMcpResources,
      defaultMcpServers,
      globalMcpTimeout,
      packageMcpTools,
      packageMcpPrompts,
      packageMcpResources,
      productionSkills,
      ...(promptOverlay ? { promptOverlay } : {}),
      runtime,
      promptLayers: {
        ...(runtimeOverrides.template?.prompt_append
          ? { templateAppend: runtimeOverrides.template.prompt_append }
          : {}),
        ...(runtimeOverrides.projectedAgent?.prompt_append
          ? { projectedAgentAppend: runtimeOverrides.projectedAgent.prompt_append }
          : {}),
      },
      includeMcpTools: false,
    })
  }

  export async function resolveWorkerCapability(input: WorkerCapabilityInput): Promise<ResolvedWorkerCapability> {
    const context = await capabilityResolutionContext(input)
    return resolveWorkerCapabilityForContext({
      context,
      config: input.config,
      agentID: input.agentID,
    })
  }

  async function resolvePackageCapabilitySet(
    context: CapabilityResolutionContext,
    config: ConfigLike,
  ): Promise<ResolvedPackageCapabilitySet> {
    const agentIDs = ExpertSquadRegistry.agentProjectionEntries(context.active.pkg.manifest)
      .map((entry) => entry.agentID)
      .sort(compareCanonicalStrings)
    const [scheduler, universalBuild, ...workers] = await Promise.all([
      resolveSchedulerCapabilityForContext(context, config),
      resolveWorkerCapabilityForContext({ context, config, agentID: UNIVERSAL_BUILD_AGENT_ID }),
      ...agentIDs.map((agentID) => resolveWorkerCapabilityForContext({ context, config, agentID })),
    ])
    return { context, scheduler, workers, schedulerOnlyWorkers: [universalBuild] }
  }

  export async function resolveWorkerTurnProjection(
    input: WorkerCapabilityInput,
  ): Promise<ResolvedWorkerTurnProjection> {
    const context = await capabilityResolutionContext(input)
    const capabilitySet = await resolvePackageCapabilitySet(context, input.config)
    const workerCapability = [...capabilitySet.schedulerOnlyWorkers, ...capabilitySet.workers].find(
      (worker) => worker.identity.agentID === input.agentID,
    )
    if (!workerCapability) {
      throw new Error(
        `Active expert squad ${JSON.stringify(context.active.profileID)} does not define a projection for agent ${input.agentID}`,
      )
    }
    const skillProjection = await resolveSkillProjectionForContext({
      context,
      config: input.config,
      projectDirectory: input.projectDirectory,
      capabilitySet,
    })
    return freezeResolvedProjection({ workerCapability, skillProjection })
  }

  export async function resolveSchedulerTurnProjection(
    input: SchedulerCapabilityInput,
  ): Promise<ResolvedSchedulerTurnProjection> {
    const context = await capabilityResolutionContext(input)
    const capabilitySet = await resolvePackageCapabilitySet(context, input.config)
    const skillProjection = await resolveSkillProjectionForContext({
      context,
      config: input.config,
      projectDirectory: input.projectDirectory,
      capabilitySet,
    })
    return freezeResolvedProjection({ schedulerCapability: capabilitySet.scheduler, skillProjection })
  }

  function projectedTaskToolBinding(input: {
    capability: ResolvedSchedulerCapability | ResolvedWorkerCapability
    taskID: string
    projectDirectory: string
    ownerKind: ProjectedTaskToolRuntimeBinding["ownerKind"]
    providerKind: ProjectedTaskToolRuntimeBinding["providerKind"]
    toolRef: string
    providerName: string
    mcpServerConfigSHA256?: string
  }): ProjectedTaskToolRuntimeBinding {
    return {
      taskID: input.taskID,
      projectDirectory: input.projectDirectory,
      ownerKind: input.ownerKind,
      expertSquadID: input.capability.expertSquadID,
      packageRevision: input.capability.packageRevision,
      agentID: input.capability.identity.agentID,
      projectionHash: input.capability.identity.projectionHash,
      providerKind: input.providerKind,
      toolRef: input.toolRef,
      providerName: input.providerName,
      runtimeToolID: randomUUID(),
      ...(input.mcpServerConfigSHA256 ? { mcpServerConfigSHA256: input.mcpServerConfigSHA256 } : {}),
    }
  }

  function mcpServerConfigSHA256(config: unknown): string {
    const stable = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
      if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
          .join(",")}}`
      }
      return JSON.stringify(value)
    }
    return createHash("sha256").update(stable(config)).digest("hex")
  }

  async function packageToolFromDefinition(input: {
    packageID: string
    ref: string
    providerName: string
    prepared: PreparedPackageTool
    configuration?: ExpertSquadRegistry.LoadedPackage["manifest"]["configuration"]
    installationScope: "project" | "global"
    namespace: string
    binding: PackageToolRuntimeBinding
    executionDirectory: string
  }) {
    if (input.prepared.snapshot.ref !== input.ref) {
      throw new Error(
        `Active expert squad ${input.packageID} package tool ${input.ref} resolved bundle for ${input.prepared.snapshot.ref}.`,
      )
    }
    const definition = await introspectPackageToolInCapsule({
      prepared: input.prepared,
      taskID: input.binding.taskID,
      cwd: input.executionDirectory,
    })
    const runtimeTool = tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.inputSchema),
      async execute(args, options) {
        const scope = await resolvePackageTaskToolExecutionScope({ options, expected: input.binding })
        const abort = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal
        if (!abort) throw new Error(`Package tool ${input.ref} requires the current invocation abort signal.`)
        const result = await withTaskScopedPluginToolHost(scope, async (host) => {
          return executePackageToolInCapsule({
            prepared: input.prepared,
            taskID: scope.taskID,
            cwd: input.executionDirectory,
            args,
            abort,
            host,
            context: {
              sessionID: scope.sessionID,
              messageID: scope.messageID,
              agent: scope.owner.agentID,
              directory: input.executionDirectory,
              worktree: input.executionDirectory,
              configuration: await ExpertSquadConfigurationStore.values({
                identity: {
                  installationScope: input.installationScope,
                  projectID: input.installationScope === "project" ? scope.projectID : null,
                  namespace: input.namespace,
                  id: input.packageID,
                },
                configuration: input.configuration,
              }),
            },
          })
        })
        const truncated = await Truncate.output(
          result.output,
          {
            sessionID: scope.sessionID,
            executionAuthority: executionAuthorityFromTaskToolScope(scope),
          },
          scope.executionSurface,
        )
        const resultMetadata: Record<string, unknown> = {
          ...(Object.keys(result.metadata).length > 0 ? { package_metadata: result.metadata } : {}),
          package_tool_ref: input.ref,
          expert_squad_id: input.packageID,
          provider_tool_name: input.providerName,
          source_path: input.prepared.snapshot.entry,
          truncated: truncated.truncated,
        }
        if (truncated.truncated) resultMetadata.outputPath = truncated.outputPath
        return {
          title: result.title,
          output: truncated.content,
          metadata: resultMetadata,
        }
      },
    })
    return bindPackageToolRuntime(runtimeTool, input.binding)
  }

  async function schedulerPackageTools<T>(
    capability: ResolvedSchedulerCapability,
    input: { taskID: string; projectDirectory: string },
  ): Promise<Record<string, T>> {
    if (capability.builtIn || capability.packageTools.length === 0) return {}
    const result: Record<string, T> = {}
    for (const packageTool of capability.packageTools) {
      if (Object.hasOwn(result, packageTool.providerName)) {
        throw new Error(`Package tool provider name collision for ${packageTool.ref}: ${packageTool.providerName}`)
      }
      result[packageTool.providerName] = (await packageToolFromDefinition({
        packageID: capability.expertSquadID,
        ref: packageTool.ref,
        providerName: packageTool.providerName,
        prepared: packageTool.prepared,
        configuration: packageTool.configuration,
        installationScope: packageTool.installationScope,
        namespace: packageTool.namespace,
        binding: {
          ...projectedTaskToolBinding({
            capability,
            taskID: input.taskID,
            projectDirectory: input.projectDirectory,
            ownerKind: "projected-scheduler",
            providerKind: "package-tool",
            toolRef: packageTool.ref,
            providerName: packageTool.providerName,
          }),
          providerKind: "package-tool",
          compiledBundleSHA256: packageTool.prepared.snapshot.compiledBundleSHA256,
        },
        executionDirectory: input.projectDirectory,
      })) as T
    }
    return result
  }

  async function workerPackageTools<T>(
    capability: ResolvedWorkerCapability,
    input: {
      taskID: string
      projectDirectory: string
      toolDirectory: string
    },
  ): Promise<Record<string, T>> {
    if (capability.builtIn || capability.packageTools.length === 0) return {}
    const result: Record<string, T> = {}
    for (const packageTool of capability.packageTools) {
      if (Object.hasOwn(result, packageTool.providerName)) {
        throw new Error(`Package tool provider name collision for ${packageTool.ref}: ${packageTool.providerName}`)
      }
      result[packageTool.providerName] = (await packageToolFromDefinition({
        packageID: capability.expertSquadID,
        ref: packageTool.ref,
        providerName: packageTool.providerName,
        prepared: packageTool.prepared,
        configuration: packageTool.configuration,
        installationScope: packageTool.installationScope,
        namespace: packageTool.namespace,
        binding: {
          ...projectedTaskToolBinding({
            capability,
            taskID: input.taskID,
            projectDirectory: input.projectDirectory,
            ownerKind: "projected-worker",
            providerKind: "package-tool",
            toolRef: packageTool.ref,
            providerName: packageTool.providerName,
          }),
          providerKind: "package-tool",
          compiledBundleSHA256: packageTool.prepared.snapshot.compiledBundleSHA256,
        },
        executionDirectory: input.toolDirectory,
      })) as T
    }
    return result
  }

  function mcpConfigFromDefinition(
    definition: ExpertSquadRegistry.PreparedPackageMcpDeclaration["definition"],
  ): Config.Mcp {
    const { capabilities: _capabilities, ...config } = definition
    return Config.Mcp.parse(config)
  }

  export interface ProjectedMcpPrompt extends Pick<MCP.PromptInfo, "name" | "description" | "arguments"> {
    ref: string
    providerName: string
    source?: string
    get(args?: Record<string, string>): Promise<MCP.GetPromptResult>
    getProjectionPayload(args?: Record<string, string>): Promise<MCP.ProjectionPromptPayload>
  }

  export interface ProjectedMcpResource extends Pick<MCP.ResourceInfo, "name" | "description" | "mimeType"> {
    ref: string
    providerName: string
    source?: string
    read(): Promise<MCP.ReadResourceResult>
    readProjectionPayload(): Promise<MCP.ProjectionResourcePayload>
  }

  async function defaultMcpPromptFromConfig(input: {
    taskID: string
    ref: string
    providerName: string
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    globalMcpTimeout?: number
  }): Promise<ProjectedMcpPrompt> {
    const { serverName, promptName } = defaultMcpPromptPartsFromRef(input.ref)
    const mcp = input.mcpServers[serverName]
    if (!mcp) throw new Error(`Active expert squad projects missing default MCP server default/mcp/${serverName}.`)
    return {
      name: promptName,
      ref: input.ref,
      providerName: input.providerName,
      get: (args?: Record<string, string>) =>
        MCP.getScopedPrompt({
          key: serverName,
          mcp,
          promptName,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          args,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
      getProjectionPayload: (args?: Record<string, string>) =>
        MCP.getScopedPromptProjectionPayload({
          key: serverName,
          mcp,
          promptName,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          args,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
    }
  }

  async function defaultMcpResourceFromConfig(input: {
    taskID: string
    ref: string
    providerName: string
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    globalMcpTimeout?: number
  }): Promise<ProjectedMcpResource> {
    const { serverName, resourceName } = defaultMcpResourcePartsFromRef(input.ref)
    const mcp = input.mcpServers[serverName]
    if (!mcp) throw new Error(`Active expert squad projects missing default MCP server default/mcp/${serverName}.`)
    return {
      name: resourceName,
      ref: input.ref,
      providerName: input.providerName,
      read: () =>
        MCP.readScopedResource({
          key: serverName,
          mcp,
          resourceName,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
      readProjectionPayload: () =>
        MCP.readScopedResourceProjectionPayload({
          key: serverName,
          mcp,
          resourceName,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
    }
  }

  async function packageMcpPromptFromDefinition(input: {
    taskID: string
    cwd: string
    prepared: ExpertSquadRegistry.PreparedPackageMcpCapability
    providerName: string
    globalMcpTimeout?: number
  }): Promise<ProjectedMcpPrompt> {
    if (input.prepared.kind !== "prompt") {
      throw new Error(`Prepared package MCP item ${input.prepared.ref} is not a prompt.`)
    }
    const mcp = mcpConfigFromDefinition(input.prepared.declaration.definition)
    return {
      name: input.prepared.name,
      ref: input.prepared.ref,
      providerName: input.providerName,
      source: input.prepared.declaration.snapshot.source,
      get: (args?: Record<string, string>) =>
        MCP.getScopedPrompt({
          key: input.providerName,
          mcp,
          promptName: input.prepared.name,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          args,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
      getProjectionPayload: (args?: Record<string, string>) =>
        MCP.getScopedPromptProjectionPayload({
          key: input.providerName,
          mcp,
          promptName: input.prepared.name,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          args,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
    }
  }

  async function packageMcpResourceFromDefinition(input: {
    taskID: string
    cwd: string
    prepared: ExpertSquadRegistry.PreparedPackageMcpCapability
    providerName: string
    globalMcpTimeout?: number
  }): Promise<ProjectedMcpResource> {
    if (input.prepared.kind !== "resource") {
      throw new Error(`Prepared package MCP item ${input.prepared.ref} is not a resource.`)
    }
    const mcp = mcpConfigFromDefinition(input.prepared.declaration.definition)
    return {
      name: input.prepared.name,
      ref: input.prepared.ref,
      providerName: input.providerName,
      source: input.prepared.declaration.snapshot.source,
      read: () =>
        MCP.readScopedResource({
          key: input.providerName,
          mcp,
          resourceName: input.prepared.name,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
      readProjectionPayload: () =>
        MCP.readScopedResourceProjectionPayload({
          key: input.providerName,
          mcp,
          resourceName: input.prepared.name,
          cwd: input.cwd,
          globalTimeout: input.globalMcpTimeout,
          processAuthority: MCP.taskProcessAuthority(input.taskID, input.cwd),
        }),
    }
  }

  async function packageMcpToolFromDefinition(input: {
    packageID: string
    cwd: string
    prepared: ExpertSquadRegistry.PreparedPackageMcpCapability
    providerName: string
    binding: ProjectedTaskToolRuntimeBinding
    connectionOwner: MCP.ScopedConnectionOwner
    globalMcpTimeout?: number
  }) {
    if (input.prepared.kind !== "tool") {
      throw new Error(`Prepared package MCP item ${input.prepared.ref} is not a tool.`)
    }
    const rawTool = await MCP.scopedTool({
      key: input.providerName,
      mcp: mcpConfigFromDefinition(input.prepared.declaration.definition),
      toolName: input.prepared.name,
      cwd: input.cwd,
      globalTimeout: input.globalMcpTimeout,
      connectionOwner: input.connectionOwner,
      connectionIdentity: `package:${input.packageID}:${input.prepared.declaration.snapshot.ref}`,
      processAuthority: MCP.taskProcessAuthority(input.binding.taskID, input.cwd),
    })
    const execute = (rawTool as { execute?: (args: unknown, options?: unknown) => unknown }).execute
    if (typeof execute !== "function") throw new Error(`Package MCP tool ${input.prepared.ref} is not executable.`)
    const runtimeTool = {
      ...(rawTool as object),
      async execute(args: unknown, options: unknown) {
        const scope = await resolveProjectedTaskToolExecutionScope({ options, expected: input.binding })
        const result = (await execute(args, options)) as Awaited<ReturnType<typeof MCP.callScopedTool>>
        const materialized = await materializeMcpToolResult({
          projectID: scope.projectID,
          result,
        })
        const truncated = await Truncate.output(
          materialized.text,
          {
            sessionID: scope.sessionID,
            executionAuthority: executionAuthorityFromTaskToolScope(scope),
          },
          scope.executionSurface,
        )
        return MCP.bindAppToolResult(
          {
            title: "",
            output: truncated.content,
            metadata: {
              ...materialized.metadata,
              package_mcp_tool_ref: input.prepared.ref,
              expert_squad_id: input.packageID,
              provider_tool_name: input.providerName,
              source_path: input.prepared.declaration.snapshot.source,
              truncated: truncated.truncated,
              ...(truncated.truncated ? { outputPath: truncated.outputPath } : {}),
            },
            attachments: materializedMcpAttachmentsToFileParts({
              attachments: materialized.attachments,
              sessionID: scope.sessionID,
              messageID: scope.messageID,
            }),
            content: result.content,
          },
          result,
        )
      },
    }
    MCP.copyAppToolBinding(rawTool as object, runtimeTool)
    return bindProjectedTaskToolRuntime(runtimeTool, input.binding)
  }

  function defaultToolsFromRuntimeMap<T>(input: {
    tools: Record<string, T>
    entries: readonly ResolvedProviderRef[]
    context: string
  }): Record<string, T> {
    const result: Record<string, T> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(`${input.context} default tool provider name collision for ${entry.ref}: ${entry.providerName}`)
      }
      const runtimeToolName = defaultToolNameFromRef(entry.ref)
      if (!Object.hasOwn(input.tools, runtimeToolName)) {
        throw new Error(
          `${input.context} projects default tool ${entry.ref}, but runtime tool ${runtimeToolName} is not available.`,
        )
      }
      result[entry.providerName] = input.tools[runtimeToolName]!
    }
    return result
  }

  async function defaultMcpToolFromConfig(input: {
    ref: string
    providerName: string
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    binding: ProjectedTaskToolRuntimeBinding
    connectionOwner: MCP.ScopedConnectionOwner
    globalMcpTimeout?: number
  }) {
    const { serverName, toolName } = defaultMcpToolPartsFromRef(input.ref)
    const configuredMcp = input.mcpServers[serverName]
    const mcp =
      serverName === ComputerMCPBuiltin.ServerName && configuredMcp?.type === "local"
        ? ComputerMCPBuiltin.withRuntimeScope(
            configuredMcp,
            input.connectionOwner.id,
            ComputerHostRuntime.adapter({
              runtimeScope: input.connectionOwner.id,
            }),
          )
        : configuredMcp
    if (!mcp) throw new Error(`Active expert squad projects missing default MCP server default/mcp/${serverName}.`)
    const rawTool = await MCP.scopedTool({
      key: serverName,
      mcp,
      toolName,
      cwd: input.cwd,
      globalTimeout: input.globalMcpTimeout,
      connectionOwner: input.connectionOwner,
      connectionIdentity: `default/mcp/${serverName}`,
      processAuthority: MCP.taskProcessAuthority(input.binding.taskID, input.cwd),
    })
    const execute = (rawTool as { execute?: (args: unknown, options?: unknown) => unknown }).execute
    if (typeof execute !== "function") throw new Error(`Default MCP tool ${input.ref} is not executable.`)
    const runtimeTool = {
      ...(rawTool as object),
      async execute(args: unknown, options: unknown) {
        const scope = await resolveProjectedTaskToolExecutionScope({ options, expected: input.binding })
        const result = (await execute(args, options)) as Awaited<ReturnType<typeof MCP.callScopedTool>>
        const materialized = await materializeMcpToolResult({
          projectID: scope.projectID,
          result,
        })
        const truncated = await Truncate.output(
          materialized.text,
          {
            sessionID: scope.sessionID,
            executionAuthority: executionAuthorityFromTaskToolScope(scope),
          },
          scope.executionSurface,
        )
        return MCP.bindAppToolResult(
          {
            title: "",
            output: truncated.content,
            metadata: {
              ...materialized.metadata,
              default_mcp_tool_ref: input.ref,
              default_mcp_server: serverName,
              provider_tool_name: input.providerName,
              truncated: truncated.truncated,
              ...(truncated.truncated ? { outputPath: truncated.outputPath } : {}),
            },
            attachments: materializedMcpAttachmentsToFileParts({
              attachments: materialized.attachments,
              sessionID: scope.sessionID,
              messageID: scope.messageID,
            }),
            content: result.content,
          },
          result,
        )
      },
    }
    MCP.copyAppToolBinding(rawTool as object, runtimeTool)
    const permissionKey = browserMcpToolKey(serverName, toolName)
    if (permissionKey) bindBrowserMcpPermissionKey(runtimeTool, permissionKey)
    const computerPermissionKey = computerMcpToolKey(serverName, toolName)
    if (computerPermissionKey) bindComputerMcpPermissionKey(runtimeTool, computerPermissionKey)
    return bindProjectedTaskToolRuntime(runtimeTool, input.binding)
  }

  async function defaultMcpTools<T>(input: {
    entries: readonly ResolvedProviderRef[]
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    context: string
    bindingFor: (entry: ResolvedProviderRef) => ProjectedTaskToolRuntimeBinding
    connectionOwner: MCP.ScopedConnectionOwner
    globalMcpTimeout?: number
  }): Promise<Record<string, T>> {
    const result: Record<string, T> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(
          `${input.context} default MCP tool provider name collision for ${entry.ref}: ${entry.providerName}`,
        )
      }
      result[entry.providerName] = (await defaultMcpToolFromConfig({
        ref: entry.ref,
        providerName: entry.providerName,
        mcpServers: input.mcpServers,
        cwd: input.cwd,
        binding: input.bindingFor(entry),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: input.globalMcpTimeout,
      })) as T
    }
    return result
  }

  async function defaultMcpPrompts(input: {
    taskID: string
    entries: readonly ResolvedProviderRef[]
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    context: string
    globalMcpTimeout?: number
  }): Promise<Record<string, ProjectedMcpPrompt>> {
    const result: Record<string, ProjectedMcpPrompt> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(
          `${input.context} default MCP prompt provider name collision for ${entry.ref}: ${entry.providerName}`,
        )
      }
      result[entry.providerName] = await defaultMcpPromptFromConfig({
        ref: entry.ref,
        taskID: input.taskID,
        providerName: entry.providerName,
        mcpServers: input.mcpServers,
        cwd: input.cwd,
        globalMcpTimeout: input.globalMcpTimeout,
      })
    }
    return result
  }

  async function defaultMcpResources(input: {
    taskID: string
    entries: readonly ResolvedProviderRef[]
    mcpServers: Record<string, Config.Mcp>
    cwd: string
    context: string
    globalMcpTimeout?: number
  }): Promise<Record<string, ProjectedMcpResource>> {
    const result: Record<string, ProjectedMcpResource> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(
          `${input.context} default MCP resource provider name collision for ${entry.ref}: ${entry.providerName}`,
        )
      }
      result[entry.providerName] = await defaultMcpResourceFromConfig({
        ref: entry.ref,
        taskID: input.taskID,
        providerName: entry.providerName,
        mcpServers: input.mcpServers,
        cwd: input.cwd,
        globalMcpTimeout: input.globalMcpTimeout,
      })
    }
    return result
  }

  type PackageMcpProjectionCapability = {
    builtIn: boolean
    expertSquadID: string
    globalMcpTimeout?: number
  }

  async function packageMcpPrompts(input: {
    taskID: string
    capability: PackageMcpProjectionCapability
    entries: readonly ResolvedPackageMcpRef[]
    cwd: string
    context: string
  }): Promise<Record<string, ProjectedMcpPrompt>> {
    if (input.capability.builtIn || input.entries.length === 0) return {}
    const result: Record<string, ProjectedMcpPrompt> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(`Package MCP prompt provider name collision for ${entry.ref}: ${entry.providerName}`)
      }
      result[entry.providerName] = await packageMcpPromptFromDefinition({
        cwd: input.cwd,
        taskID: input.taskID,
        prepared: entry.prepared,
        providerName: entry.providerName,
        globalMcpTimeout: input.capability.globalMcpTimeout,
      })
    }
    return result
  }

  async function packageMcpResources(input: {
    taskID: string
    capability: PackageMcpProjectionCapability
    entries: readonly ResolvedPackageMcpRef[]
    cwd: string
    context: string
  }): Promise<Record<string, ProjectedMcpResource>> {
    if (input.capability.builtIn || input.entries.length === 0) return {}
    const result: Record<string, ProjectedMcpResource> = {}
    for (const entry of input.entries) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(`Package MCP resource provider name collision for ${entry.ref}: ${entry.providerName}`)
      }
      result[entry.providerName] = await packageMcpResourceFromDefinition({
        cwd: input.cwd,
        taskID: input.taskID,
        prepared: entry.prepared,
        providerName: entry.providerName,
        globalMcpTimeout: input.capability.globalMcpTimeout,
      })
    }
    return result
  }

  async function schedulerPackageMcpTools<T>(
    capability: ResolvedSchedulerCapability,
    input: { taskID: string; projectDirectory: string; connectionOwner: MCP.ScopedConnectionOwner },
  ): Promise<Record<string, T>> {
    if (capability.builtIn || capability.packageMcpTools.length === 0) return {}
    const result: Record<string, T> = {}
    for (const entry of capability.packageMcpTools) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(`Package MCP tool provider name collision for ${entry.ref}: ${entry.providerName}`)
      }
      result[entry.providerName] = (await packageMcpToolFromDefinition({
        packageID: capability.expertSquadID,
        cwd: input.projectDirectory,
        prepared: entry.prepared,
        providerName: entry.providerName,
        binding: projectedTaskToolBinding({
          capability,
          taskID: input.taskID,
          projectDirectory: input.projectDirectory,
          ownerKind: "projected-scheduler",
          providerKind: "package-mcp-tool",
          toolRef: entry.ref,
          providerName: entry.providerName,
          mcpServerConfigSHA256: entry.prepared.declaration.snapshot.sha256,
        }),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: capability.globalMcpTimeout,
      })) as T
    }
    return result
  }

  async function workerPackageMcpTools<T>(
    capability: ResolvedWorkerCapability,
    input: {
      taskID: string
      projectDirectory: string
      toolDirectory: string
      connectionOwner: MCP.ScopedConnectionOwner
    },
  ): Promise<Record<string, T>> {
    if (capability.builtIn || capability.packageMcpTools.length === 0) return {}
    const result: Record<string, T> = {}
    for (const entry of capability.packageMcpTools) {
      if (Object.hasOwn(result, entry.providerName)) {
        throw new Error(`Package MCP tool provider name collision for ${entry.ref}: ${entry.providerName}`)
      }
      result[entry.providerName] = (await packageMcpToolFromDefinition({
        packageID: capability.expertSquadID,
        cwd: input.toolDirectory,
        prepared: entry.prepared,
        providerName: entry.providerName,
        binding: projectedTaskToolBinding({
          capability,
          taskID: input.taskID,
          projectDirectory: input.projectDirectory,
          ownerKind: "projected-worker",
          providerKind: "package-mcp-tool",
          toolRef: entry.ref,
          providerName: entry.providerName,
          mcpServerConfigSHA256: entry.prepared.declaration.snapshot.sha256,
        }),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: capability.globalMcpTimeout,
      })) as T
    }
    return result
  }

  function mergeMcpProjectionMap<T>(
    defaults: Record<string, T>,
    packageItems: Record<string, T>,
    context: string,
    kind: string,
  ): Record<string, T> {
    const projected: Record<string, T> = { ...defaults }
    for (const [providerName, item] of Object.entries(packageItems)) {
      if (Object.hasOwn(projected, providerName)) {
        throw new Error(
          `${context} package MCP ${kind} provider name ${JSON.stringify(providerName)} collides with a default MCP ${kind}.`,
        )
      }
      projected[providerName] = item
    }
    return projected
  }

  export async function projectSchedulerMcpPrompts(
    capability: ResolvedSchedulerCapability,
    input: { taskID: string; projectDirectory: string },
  ): Promise<Record<string, ProjectedMcpPrompt>> {
    const context = `Active expert squad ${JSON.stringify(capability.expertSquadID)}`
    const defaults =
      capability.defaultMcpPrompts.length > 0
        ? await defaultMcpPrompts({
            entries: capability.defaultMcpPrompts,
            taskID: input.taskID,
            mcpServers: capability.defaultMcpServers,
            cwd: input.projectDirectory,
            context,
            globalMcpTimeout: capability.globalMcpTimeout,
          })
        : {}
    const packageItems = await packageMcpPrompts({
      capability,
      taskID: input.taskID,
      entries: capability.packageMcpPrompts,
      cwd: input.projectDirectory,
      context: "package MCP prompts",
    })
    return mergeMcpProjectionMap(defaults, packageItems, context, "prompt")
  }

  export async function projectWorkerMcpPrompts(
    capability: ResolvedWorkerCapability,
    input: { taskID: string; projectDirectory: string },
  ): Promise<Record<string, ProjectedMcpPrompt>> {
    const context = `Active expert squad ${JSON.stringify(capability.expertSquadID)} ${capability.identity.agentID}`
    const defaults =
      capability.defaultMcpPrompts.length > 0
        ? await defaultMcpPrompts({
            entries: capability.defaultMcpPrompts,
            taskID: input.taskID,
            mcpServers: capability.defaultMcpServers,
            cwd: input.projectDirectory,
            context,
            globalMcpTimeout: capability.globalMcpTimeout,
          })
        : {}
    const packageItems = await packageMcpPrompts({
      capability,
      taskID: input.taskID,
      entries: capability.packageMcpPrompts,
      cwd: input.projectDirectory,
      context: "worker package MCP prompts",
    })
    return mergeMcpProjectionMap(defaults, packageItems, context, "prompt")
  }

  export async function projectSchedulerMcpResources(
    capability: ResolvedSchedulerCapability,
    input: { taskID: string; projectDirectory: string },
  ): Promise<Record<string, ProjectedMcpResource>> {
    const context = `Active expert squad ${JSON.stringify(capability.expertSquadID)}`
    const defaults =
      capability.defaultMcpResources.length > 0
        ? await defaultMcpResources({
            entries: capability.defaultMcpResources,
            taskID: input.taskID,
            mcpServers: capability.defaultMcpServers,
            cwd: input.projectDirectory,
            context,
            globalMcpTimeout: capability.globalMcpTimeout,
          })
        : {}
    const packageItems = await packageMcpResources({
      capability,
      taskID: input.taskID,
      entries: capability.packageMcpResources,
      cwd: input.projectDirectory,
      context: "package MCP resources",
    })
    return mergeMcpProjectionMap(defaults, packageItems, context, "resource")
  }

  export async function projectWorkerMcpResources(
    capability: ResolvedWorkerCapability,
    input: { taskID: string; projectDirectory: string },
  ): Promise<Record<string, ProjectedMcpResource>> {
    const context = `Active expert squad ${JSON.stringify(capability.expertSquadID)} ${capability.identity.agentID}`
    const defaults =
      capability.defaultMcpResources.length > 0
        ? await defaultMcpResources({
            entries: capability.defaultMcpResources,
            taskID: input.taskID,
            mcpServers: capability.defaultMcpServers,
            cwd: input.projectDirectory,
            context,
            globalMcpTimeout: capability.globalMcpTimeout,
          })
        : {}
    const packageItems = await packageMcpResources({
      capability,
      taskID: input.taskID,
      entries: capability.packageMcpResources,
      cwd: input.projectDirectory,
      context: "worker package MCP resources",
    })
    return mergeMcpProjectionMap(defaults, packageItems, context, "resource")
  }

  type SanitizedMcpPromptProjection = {
    description?: string
    messages: Array<{
      role: string
      content:
        | { type: "text"; text: string; annotations?: SanitizedMcpAnnotations }
        | { type: "resource_text"; uri?: string; mimeType?: string; text: string }
        | {
            type: "resource_link"
            uri: string
            name?: string
            title?: string
            description?: string
            mimeType?: string
            annotations?: SanitizedMcpAnnotations
            icons?: SanitizedMcpIcon[]
          }
    }>
  }

  type SanitizedMcpResourceProjection = {
    contents: Array<{ uri: string; mimeType?: string; text: string }>
  }

  type SanitizedMcpAnnotations = {
    audience?: Array<"user" | "assistant">
    priority?: number
    lastModified?: string
  }

  type SanitizedMcpIcon = {
    src: string
    mimeType?: string
    sizes?: string[]
    theme?: "light" | "dark"
  }

  function stringifySanitizedMcpProjectionPayload(payload: unknown, context: string): string {
    const text = JSON.stringify(payload, null, 2)
    if (typeof text !== "string") throw new Error(`${context} returned no JSON-serializable payload.`)
    return text
  }

  function requireMcpProjectionRecord(value: unknown, context: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${context} returned an invalid MCP projection payload.`)
    }
    const record = value as Record<string, unknown>
    if (Object.hasOwn(record, "_meta")) {
      throw new Error(`${context} returned MCP _meta; projected context accepts text and link metadata only.`)
    }
    return record
  }

  function requireMcpProjectionString(value: unknown, context: string): string {
    if (typeof value !== "string") throw new Error(`${context} must be a string.`)
    assertNoInlineBase64Payload(value, context)
    return value
  }

  function optionalMcpProjectionString(value: unknown, context: string): string | undefined {
    if (value === undefined) return undefined
    if (typeof value !== "string") throw new Error(`${context} must be a string.`)
    assertNoInlineBase64Payload(value, context)
    return value
  }

  function requireMcpProjectionArray(value: unknown, context: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${context} must be an array.`)
    return value
  }

  function assertMcpProjectionFields(
    record: Record<string, unknown>,
    allowedFields: readonly string[],
    context: string,
  ): void {
    const allowed = new Set(allowedFields)
    for (const field of Object.keys(record)) {
      if (!allowed.has(field)) throw new Error(`${context} contains unsupported field ${JSON.stringify(field)}.`)
    }
  }

  function optionalMcpProjectionAnnotations(value: unknown, context: string): SanitizedMcpAnnotations | undefined {
    if (value === undefined) return undefined
    const record = requireMcpProjectionRecord(value, context)
    assertMcpProjectionFields(record, ["audience", "priority", "lastModified"], context)
    const annotations: SanitizedMcpAnnotations = {}
    if (record.audience !== undefined) {
      const audience = requireMcpProjectionArray(record.audience, `${context}.audience`).map((item, index) => {
        const role = requireMcpProjectionString(item, `${context}.audience[${index}]`)
        if (role !== "user" && role !== "assistant") {
          throw new Error(`${context}.audience[${index}] must be user or assistant.`)
        }
        return role
      })
      annotations.audience = audience
    }
    if (record.priority !== undefined) {
      if (
        typeof record.priority !== "number" ||
        !Number.isFinite(record.priority) ||
        record.priority < 0 ||
        record.priority > 1
      ) {
        throw new Error(`${context}.priority must be a finite number from 0 to 1.`)
      }
      annotations.priority = record.priority
    }
    const lastModified = optionalMcpProjectionString(record.lastModified, `${context}.lastModified`)
    if (lastModified !== undefined) annotations.lastModified = lastModified
    return annotations
  }

  function optionalMcpProjectionIcons(value: unknown, context: string): SanitizedMcpIcon[] | undefined {
    if (value === undefined) return undefined
    return requireMcpProjectionArray(value, context).map((item, index) => {
      const iconContext = `${context}[${index}]`
      const record = requireMcpProjectionRecord(item, iconContext)
      assertMcpProjectionFields(record, ["src", "mimeType", "sizes", "theme"], iconContext)
      const icon: SanitizedMcpIcon = {
        src: requireMcpProjectionString(record.src, `${iconContext}.src`),
      }
      const mimeType = optionalMcpProjectionString(record.mimeType, `${iconContext}.mimeType`)
      if (mimeType !== undefined) icon.mimeType = mimeType
      if (record.sizes !== undefined) {
        icon.sizes = requireMcpProjectionArray(record.sizes, `${iconContext}.sizes`).map((size, sizeIndex) =>
          requireMcpProjectionString(size, `${iconContext}.sizes[${sizeIndex}]`),
        )
      }
      const theme = optionalMcpProjectionString(record.theme, `${iconContext}.theme`)
      if (theme !== undefined) {
        if (theme !== "light" && theme !== "dark") throw new Error(`${iconContext}.theme must be light or dark.`)
        icon.theme = theme
      }
      return icon
    })
  }

  function sanitizeMcpPromptContent(
    content: unknown,
    context: string,
  ): SanitizedMcpPromptProjection["messages"][number]["content"] {
    const record = requireMcpProjectionRecord(content, context)
    const type = requireMcpProjectionString(record.type, `${context}.type`)
    if (type === "text") {
      assertMcpProjectionFields(record, ["type", "text", "annotations"], context)
      const annotations = optionalMcpProjectionAnnotations(record.annotations, `${context}.annotations`)
      return {
        type,
        text: requireMcpProjectionString(record.text, `${context}.text`),
        ...(annotations !== undefined ? { annotations } : {}),
      }
    }
    if (type === "resource") {
      assertMcpProjectionFields(record, ["type", "resource"], context)
      const resource = requireMcpProjectionRecord(record.resource, `${context}.resource`)
      if (Object.hasOwn(resource, "blob")) {
        throw new Error(`${context}.resource contains binary blob content; projected context accepts text only.`)
      }
      assertMcpProjectionFields(resource, ["uri", "mimeType", "text"], `${context}.resource`)
      return {
        type: "resource_text",
        uri: optionalMcpProjectionString(resource.uri, `${context}.resource.uri`),
        mimeType: optionalMcpProjectionString(resource.mimeType, `${context}.resource.mimeType`),
        text: requireMcpProjectionString(resource.text, `${context}.resource.text`),
      }
    }
    if (type === "resource_link") {
      assertMcpProjectionFields(
        record,
        ["type", "uri", "name", "title", "description", "mimeType", "annotations", "icons"],
        context,
      )
      const annotations = optionalMcpProjectionAnnotations(record.annotations, `${context}.annotations`)
      const icons = optionalMcpProjectionIcons(record.icons, `${context}.icons`)
      return {
        type,
        uri: requireMcpProjectionString(record.uri, `${context}.uri`),
        name: optionalMcpProjectionString(record.name, `${context}.name`),
        title: optionalMcpProjectionString(record.title, `${context}.title`),
        description: optionalMcpProjectionString(record.description, `${context}.description`),
        mimeType: optionalMcpProjectionString(record.mimeType, `${context}.mimeType`),
        ...(annotations !== undefined ? { annotations } : {}),
        ...(icons !== undefined ? { icons } : {}),
      }
    }
    if (type === "image" || type === "audio") {
      throw new Error(`${context} contains ${type} content; projected context accepts text and link metadata only.`)
    }
    throw new Error(`${context} contains unsupported MCP content type ${JSON.stringify(type)}.`)
  }

  function sanitizeMcpPromptProjectionPayload(payload: unknown, context: string): SanitizedMcpPromptProjection {
    const record = requireMcpProjectionRecord(payload, context)
    assertMcpProjectionFields(record, ["description", "messages"], context)
    return {
      description: optionalMcpProjectionString(record.description, `${context}.description`),
      messages: requireMcpProjectionArray(record.messages, `${context}.messages`).map((message, index) => {
        const messageContext = `${context}.messages[${index}]`
        const messageRecord = requireMcpProjectionRecord(message, messageContext)
        assertMcpProjectionFields(messageRecord, ["role", "content"], messageContext)
        return {
          role: requireMcpProjectionString(messageRecord.role, `${messageContext}.role`),
          content: sanitizeMcpPromptContent(messageRecord.content, `${messageContext}.content`),
        }
      }),
    }
  }

  function sanitizeMcpResourceProjectionPayload(payload: unknown, context: string): SanitizedMcpResourceProjection {
    const record = requireMcpProjectionRecord(payload, context)
    assertMcpProjectionFields(record, ["contents"], context)
    return {
      contents: requireMcpProjectionArray(record.contents, `${context}.contents`).map((content, index) => {
        const contentContext = `${context}.contents[${index}]`
        const contentRecord = requireMcpProjectionRecord(content, contentContext)
        if (Object.hasOwn(contentRecord, "blob")) {
          throw new Error(`${contentContext} contains binary blob content; projected context accepts text only.`)
        }
        assertMcpProjectionFields(contentRecord, ["uri", "mimeType", "text"], contentContext)
        return {
          uri: requireMcpProjectionString(contentRecord.uri, `${contentContext}.uri`),
          mimeType: optionalMcpProjectionString(contentRecord.mimeType, `${contentContext}.mimeType`),
          text: requireMcpProjectionString(contentRecord.text, `${contentContext}.text`),
        }
      }),
    }
  }

  function renderMcpProjectionBlock(input: {
    kind: "prompt" | "resource"
    providerName: string
    ref: string
    source?: string
    payload: unknown
  }): string {
    const context = `MCP ${input.kind} ${input.ref}`
    const payload =
      input.kind === "prompt"
        ? sanitizeMcpPromptProjectionPayload(input.payload, context)
        : sanitizeMcpResourceProjectionPayload(input.payload, context)
    return [
      `### MCP ${input.kind}: ${input.providerName}`,
      "",
      `ref: ${input.ref}`,
      ...(input.source ? [`source: ${input.source}`] : []),
      "",
      "```json",
      stringifySanitizedMcpProjectionPayload(payload, context),
      "```",
    ].join("\n")
  }

  async function renderProjectedMcpContext(input: {
    prompts: Record<string, ProjectedMcpPrompt>
    resources: Record<string, ProjectedMcpResource>
  }): Promise<string | undefined> {
    return MCP.withScopedConnectionPool(async () => {
      const promptEntries = Object.entries(input.prompts)
      const resourceEntries = Object.entries(input.resources)
      if (promptEntries.length === 0 && resourceEntries.length === 0) return undefined
      const promptBlocks: string[] = []
      for (const [providerName, prompt] of promptEntries) {
        promptBlocks.push(
          renderMcpProjectionBlock({
            kind: "prompt",
            providerName,
            ref: prompt.ref,
            source: prompt.source,
            payload: await prompt.getProjectionPayload({}),
          }),
        )
      }
      const resourceBlocks: string[] = []
      for (const [providerName, resource] of resourceEntries) {
        resourceBlocks.push(
          renderMcpProjectionBlock({
            kind: "resource",
            providerName,
            ref: resource.ref,
            source: resource.source,
            payload: await resource.readProjectionPayload(),
          }),
        )
      }
      return [
        "## Projected MCP Context",
        "",
        "These MCP prompts and resources are explicitly projected by the active expert-squad capability for this agent. They are loaded from the active/default scoped MCP definitions only.",
        "",
        ...promptBlocks,
        ...resourceBlocks,
      ].join("\n\n")
    })
  }

  async function resolvedMcpPromptContext(input: {
    taskID: string
    capability: ResolvedSchedulerCapability | ResolvedWorkerCapability
    projectDirectory: string
  }): Promise<string | undefined> {
    if ("scheduler" in input.capability) {
      return renderProjectedMcpContext({
        prompts: await projectSchedulerMcpPrompts(input.capability, {
          taskID: input.taskID,
          projectDirectory: input.projectDirectory,
        }),
        resources: await projectSchedulerMcpResources(input.capability, {
          taskID: input.taskID,
          projectDirectory: input.projectDirectory,
        }),
      })
    }
    return renderProjectedMcpContext({
      prompts: await projectWorkerMcpPrompts(input.capability, {
        taskID: input.taskID,
        projectDirectory: input.projectDirectory,
      }),
      resources: await projectWorkerMcpResources(input.capability, {
        taskID: input.taskID,
        projectDirectory: input.projectDirectory,
      }),
    })
  }

  export async function projectOrchestratorTools<T>(
    tools: Record<string, T>,
    capability: ResolvedSchedulerCapability,
    input: {
      taskID: string
      projectDirectory: string
      connectionOwner: MCP.ScopedConnectionOwner
    },
  ): Promise<Record<string, T>> {
    if (!input.taskID.trim()) throw new Error("Orchestrator runtime tool projection requires a nonempty taskID")
    const projected: Record<string, T> = {}
    for (const toolID of capability.builtInToolIDs) {
      if (!Object.hasOwn(tools, toolID)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(capability.expertSquadID)} projects Orchestrator tool ${JSON.stringify(
            toolID,
          )}, but createOrchestratorTools did not build that tool.`,
        )
      }
      projected[toolID] = tools[toolID]
    }
    const defaultTools = defaultToolsFromRuntimeMap<T>({
      tools,
      entries: capability.defaultTools,
      context: `Active expert squad ${JSON.stringify(capability.expertSquadID)}`,
    })
    for (const [providerName, defaultTool] of Object.entries(defaultTools)) {
      if (Object.hasOwn(projected, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} default tool provider name ${JSON.stringify(providerName)} collides with an existing Orchestrator tool.`,
        )
      }
      projected[providerName] = defaultTool
    }
    const packageTools = await schedulerPackageTools<T>(capability, input)
    for (const [providerName, packageTool] of Object.entries(packageTools)) {
      if (Object.hasOwn(projected, providerName) || Object.hasOwn(tools, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} package tool provider name ${JSON.stringify(providerName)} collides with an existing Orchestrator tool.`,
        )
      }
      projected[providerName] = packageTool
    }
    if (capability.defaultMcpTools.length + capability.packageMcpTools.length > 0 && !input.connectionOwner) {
      throw new Error("Orchestrator MCP tool projection requires a session-scoped connection owner")
    }
    if (capability.defaultMcpTools.length > 0) {
      const defaultMcpRuntimeTools = await defaultMcpTools<T>({
        entries: capability.defaultMcpTools,
        mcpServers: capability.defaultMcpServers,
        cwd: input.projectDirectory,
        context: `Active expert squad ${JSON.stringify(capability.expertSquadID)}`,
        bindingFor: (entry) =>
          projectedTaskToolBinding({
            capability,
            taskID: input.taskID,
            projectDirectory: input.projectDirectory,
            ownerKind: "projected-scheduler",
            providerKind: "default-mcp-tool",
            toolRef: entry.ref,
            providerName: entry.providerName,
            mcpServerConfigSHA256: mcpServerConfigSHA256(
              capability.defaultMcpServers[defaultMcpToolPartsFromRef(entry.ref).serverName],
            ),
          }),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: capability.globalMcpTimeout,
      })
      for (const [providerName, defaultMcpTool] of Object.entries(defaultMcpRuntimeTools)) {
        if (Object.hasOwn(projected, providerName) || Object.hasOwn(tools, providerName)) {
          throw new Error(
            `Active expert squad ${JSON.stringify(
              capability.expertSquadID,
            )} default MCP tool provider name ${JSON.stringify(providerName)} collides with an existing Orchestrator tool.`,
          )
        }
        projected[providerName] = defaultMcpTool
      }
    }
    const packageMcpTools = await schedulerPackageMcpTools<T>(capability, input)
    for (const [providerName, packageMcpTool] of Object.entries(packageMcpTools)) {
      if (Object.hasOwn(projected, providerName) || Object.hasOwn(tools, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} package MCP tool provider name ${JSON.stringify(providerName)} collides with an existing Orchestrator tool.`,
        )
      }
      projected[providerName] = packageMcpTool
    }
    return projected
  }

  export async function projectWorkerTools<T>(
    tools: Record<string, T>,
    capability: ResolvedWorkerCapability,
    input: {
      taskID: string
      projectDirectory: string
      toolDirectory: string
      stageOwnedToolIDs: readonly string[]
      connectionOwner: MCP.ScopedConnectionOwner
    },
  ): Promise<ResolvedWorkerRuntimeTools<T>> {
    if (!input.taskID.trim()) {
      throw new Error(`Agent ${capability.identity.agentID} runtime tool projection requires a nonempty taskID`)
    }
    for (const toolID of TASK_ARTIFACT_TOOL_IDS) {
      if (Object.hasOwn(tools, toolID)) {
        throw new Error(
          `Agent ${capability.identity.agentID} cannot supply reserved Task Artifact transport ${JSON.stringify(
            toolID,
          )}; SessionLoop materializes its canonical registry provider.`,
        )
      }
    }
    const projectedTools: Record<string, T> = {}
    const stageTools: Record<string, T> = {}
    const builtInToolIDs = new Set(capability.builtInToolIDs)
    const defaultToolProviderNames = new Set(capability.defaultTools.map((entry) => entry.providerName))
    for (const [toolID, item] of Object.entries(tools)) {
      if (defaultToolProviderNames.has(toolID)) continue
      if (!builtInToolIDs.has(toolID)) continue
      projectedTools[toolID] = item
    }

    const defaultTools = defaultToolsFromRuntimeMap<T>({
      tools,
      entries: capability.defaultTools,
      context: `Active expert squad ${JSON.stringify(capability.expertSquadID)} ${capability.identity.agentID}`,
    })
    for (const [providerName, defaultTool] of Object.entries(defaultTools)) {
      if (Object.hasOwn(projectedTools, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} default tool provider name ${JSON.stringify(providerName)} collides with an existing ${capability.identity.agentID} tool.`,
        )
      }
      projectedTools[providerName] = defaultTool
    }
    const packageTools = await workerPackageTools<T>(capability, input)
    for (const [providerName, packageTool] of Object.entries(packageTools)) {
      if (Object.hasOwn(projectedTools, providerName) || Object.hasOwn(tools, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} package tool provider name ${JSON.stringify(providerName)} collides with an existing ${capability.identity.agentID} tool.`,
        )
      }
      projectedTools[providerName] = packageTool
    }
    if (capability.defaultMcpTools.length + capability.packageMcpTools.length > 0 && !input.connectionOwner) {
      throw new Error(
        `Agent ${capability.identity.agentID} MCP tool projection requires a session-scoped connection owner`,
      )
    }
    if (capability.defaultMcpTools.length > 0) {
      const defaultMcpRuntimeTools = await defaultMcpTools<T>({
        entries: capability.defaultMcpTools,
        mcpServers: capability.defaultMcpServers,
        cwd: input.toolDirectory,
        context: `Active expert squad ${JSON.stringify(capability.expertSquadID)} ${capability.identity.agentID}`,
        bindingFor: (entry) =>
          projectedTaskToolBinding({
            capability,
            taskID: input.taskID,
            projectDirectory: input.projectDirectory,
            ownerKind: "projected-worker",
            providerKind: "default-mcp-tool",
            toolRef: entry.ref,
            providerName: entry.providerName,
            mcpServerConfigSHA256: mcpServerConfigSHA256(
              capability.defaultMcpServers[defaultMcpToolPartsFromRef(entry.ref).serverName],
            ),
          }),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: capability.globalMcpTimeout,
      })
      for (const [providerName, defaultMcpTool] of Object.entries(defaultMcpRuntimeTools)) {
        if (Object.hasOwn(projectedTools, providerName) || Object.hasOwn(tools, providerName)) {
          throw new Error(
            `Active expert squad ${JSON.stringify(
              capability.expertSquadID,
            )} default MCP tool provider name ${JSON.stringify(providerName)} collides with an existing ${capability.identity.agentID} tool.`,
          )
        }
        projectedTools[providerName] = defaultMcpTool
      }
    }
    const packageMcpTools = await workerPackageMcpTools<T>(capability, input)
    for (const [providerName, packageMcpTool] of Object.entries(packageMcpTools)) {
      if (Object.hasOwn(projectedTools, providerName) || Object.hasOwn(tools, providerName)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} package MCP tool provider name ${JSON.stringify(providerName)} collides with an existing ${capability.identity.agentID} tool.`,
        )
      }
      projectedTools[providerName] = packageMcpTool
    }
    if (!Array.isArray(input.stageOwnedToolIDs)) {
      throw new Error(`Agent ${capability.identity.agentID} runtime projection requires explicit stage-owned tool IDs`)
    }
    const allowedStageToolIDs = DispatchAdapterContractRegistry.privateStageToolIDSet(
      capability.identity.dispatchAdapterID,
    )
    const seenStageToolIDs = new Set<string>()
    for (const toolID of input.stageOwnedToolIDs) {
      if (seenStageToolIDs.has(toolID)) {
        throw new Error(
          `Agent ${capability.identity.agentID} repeats stage-owned worker tool ${JSON.stringify(toolID)}`,
        )
      }
      seenStageToolIDs.add(toolID)
      if (!allowedStageToolIDs.has(toolID)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(capability.expertSquadID)} ${capability.identity.agentID} stage-owned worker tool ${JSON.stringify(toolID)} is not part of the ${capability.identity.dispatchAdapterID} dispatch adapter ABI.`,
        )
      }
      if (!Object.hasOwn(tools, toolID)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} ${capability.identity.agentID} stage-owned worker tool ${JSON.stringify(toolID)} is not registered in the runtime map.`,
        )
      }
      const stageOwnedTool = tools[toolID]!
      if (Object.hasOwn(projectedTools, toolID)) {
        throw new Error(
          `Active expert squad ${JSON.stringify(
            capability.expertSquadID,
          )} ${capability.identity.agentID} declares worker tool ${JSON.stringify(toolID)} as both projected and stage-owned.`,
        )
      }
      stageTools[toolID] = stageOwnedTool
    }
    return { projectedTools, stageTools }
  }

  function unique(input: Iterable<string>): string[] {
    return [...new Set(input)]
  }

  function selectorSkillName(id: string): string {
    return `${id}-expert-squad`
  }

  function selectorSkillFromPackage(input: {
    pkg: Pick<ExpertSquadRegistry.PackageCatalogEntry, "id" | "label" | "description" | "selector"> & {
      selectorInstructions: string
    }
  }): ResolvedSelectorSkill {
    const instructions = input.pkg.selectorInstructions.trim()
    if (!instructions) {
      throw new Error(`Expert squad ${input.pkg.id} selector requires top-level selector.md instructions.`)
    }
    const name = selectorSkillName(input.pkg.id)
    const description = `Orchestrator skill for ${input.pkg.label} tasks. ${input.pkg.selector.summary}`
    const requiredTools = [] as const
    const digest = canonicalProjectionHash(ProjectionHashDomain.selector, {
      expert_squad_id: input.pkg.id,
      name,
      label: input.pkg.label,
      description,
      package_description: input.pkg.description ?? null,
      summary: input.pkg.selector.summary,
      selection_guidance: input.pkg.selector.selection_guidance,
      instructions,
      required_tools: requiredTools,
    })
    return {
      kind: "selector",
      expertSquadID: input.pkg.id,
      name,
      description,
      instructions,
      digest,
      location: `opencorvus-expert-squad-selector://${encodeURIComponent(input.pkg.id)}?sha256=${digest}`,
      requiredTools: [...requiredTools],
    }
  }

  function cloneProductionSkill(skill: Skill.Info): Skill.Info {
    const taskSignals = skill.auto_detect?.task_signals
    return {
      ...skill,
      platforms: [...skill.platforms],
      auto_detect: skill.auto_detect
        ? {
            files: skill.auto_detect.files ? [...skill.auto_detect.files] : undefined,
            deps: skill.auto_detect.deps ? [...skill.auto_detect.deps] : undefined,
            task_signals: taskSignals
              ? {
                  has_attachment_image: taskSignals.has_attachment_image,
                  request_contains_url: taskSignals.request_contains_url,
                  package_has_script: taskSignals.package_has_script ? [...taskSignals.package_has_script] : undefined,
                  request_text_any: taskSignals.request_text_any ? [...taskSignals.request_text_any] : undefined,
                }
              : undefined,
          }
        : undefined,
      required_tools: [...skill.required_tools],
      bundle: skill.bundle
        ? {
            key: skill.bundle.key,
            skill: skill.bundle.skill,
            files: Object.fromEntries(
              Object.entries(skill.bundle.files).map(([file, content]) => [
                file,
                typeof content === "string" ? content : { ...content },
              ]),
            ),
          }
        : undefined,
    }
  }

  function packageSkillFromRef(pkg: ExpertSquadRegistry.LoadedPackage, ref: string): Skill.Info {
    const prepared = pkg.packageSkills.get(ref)
    if (!prepared) throw new Error(`Active expert squad ${pkg.id} has no prepared package skill ${ref}.`)
    const locationPath = prepared.snapshot.ref
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")
    const location = `opencorvus-expert-squad-skill://${encodeURIComponent(pkg.namespace)}/${locationPath}?sha256=${prepared.snapshot.sha256}`
    const info = prepared.definition
    const taskSignals = info.auto_detect?.task_signals
    return {
      name: info.name,
      description: info.description,
      aliases: [...info.aliases],
      platforms: [...info.platforms],
      builtin: false,
      location,
      content: prepared.content,
      bundle: {
        key: prepared.snapshot.sha256,
        skill: prepared.bundle.skill,
        files: Object.fromEntries(
          Object.entries(prepared.bundle.files).map(([file, content]) => [
            file,
            typeof content === "string" ? content : { ...content },
          ]),
        ),
      },
      auto_detect: info.auto_detect
        ? {
            files: info.auto_detect.files ? [...info.auto_detect.files] : undefined,
            deps: info.auto_detect.deps ? [...info.auto_detect.deps] : undefined,
            task_signals: taskSignals
              ? {
                  has_attachment_image: taskSignals.has_attachment_image,
                  request_contains_url: taskSignals.request_contains_url,
                  package_has_script: taskSignals.package_has_script ? [...taskSignals.package_has_script] : undefined,
                  request_text_any: taskSignals.request_text_any ? [...taskSignals.request_text_any] : undefined,
                }
              : undefined,
          }
        : undefined,
      priority: info.priority,
      required_tools: [...info.required_tools],
      expires_at: info.expires_at,
    }
  }

  function manifestProductionSkillGrants(
    context: CapabilityResolutionContext,
    projection: ExpertSquadRegistry.Projection,
    agentID: string,
  ): ProductionSkillGrant[] {
    const grants: ProductionSkillGrant[] = []
    const names = new Map<string, string>()
    const add = (grant: ProductionSkillGrant) => {
      const prior = names.get(grant.skill.name)
      if (prior) {
        throw new Error(
          `Active expert squad ${context.active.profileID} agent ${agentID} projects skill name ${JSON.stringify(grant.skill.name)} from both ${prior} and ${grant.ref}.`,
        )
      }
      names.set(grant.skill.name, grant.ref)
      grants.push(grant)
    }
    for (const ref of [...projection.default_skill_refs].sort(compareCanonicalStrings)) {
      const name = defaultSkillNameFromRef(ref)
      const skill = context.defaultSkillsByName.get(name)
      if (!skill) {
        throw new Error(`Active expert squad ${context.active.profileID} projects missing default skill ${ref}.`)
      }
      add({
        kind: "production",
        authority: "manifest",
        source: "default",
        ref,
        agentIDs: [agentID],
        skill: cloneProductionSkill(skill),
      })
    }
    for (const ref of [...projection.package_skill_refs].sort(compareCanonicalStrings)) {
      const prepared = context.active.pkg.packageSkills.get(ref)
      if (!prepared) {
        throw new Error(`Active expert squad ${context.active.profileID} has no prepared package skill ${ref}.`)
      }
      add({
        kind: "production",
        authority: "manifest",
        source: "package",
        ref,
        agentIDs: [agentID],
        skill: packageSkillFromRef(context.active.pkg, ref),
        snapshot: prepared.snapshot,
      })
    }
    return grants
  }

  function effectiveProductionSkillGrants(
    context: CapabilityResolutionContext,
    projection: ExpertSquadRegistry.Projection,
    agentID: string,
    config: ConfigLike,
  ): ProductionSkillGrant[] {
    const manifest = manifestProductionSkillGrants(context, projection, agentID)
    const byDefaultRef = new Map(
      manifest.filter((grant) => grant.source === "default").map((grant) => [grant.ref, grant]),
    )
    const refByName = new Map(manifest.map((grant) => [grant.skill.name, grant.ref]))
    const overrides = config.skill_mounts?.[context.active.profileID]?.[agentID] ?? {}
    const operator: ProductionSkillGrant[] = []
    for (const [ref, enabled] of Object.entries(overrides).sort(([left], [right]) =>
      compareCanonicalStrings(left, right),
    )) {
      if (!enabled || byDefaultRef.has(ref)) continue
      const name = defaultSkillNameFromRef(ref)
      const skill = context.defaultSkillsByName.get(name)
      if (!skill) {
        throw new Error(
          `Active expert squad ${context.active.profileID} agent ${agentID} skill_mounts references missing default skill ${ref}.`,
        )
      }
      const priorRef = refByName.get(name)
      if (priorRef) {
        throw new Error(
          `Active expert squad ${context.active.profileID} agent ${agentID} projects skill name ${JSON.stringify(name)} from both ${priorRef} and ${ref}.`,
        )
      }
      refByName.set(name, ref)
      operator.push({
        kind: "production",
        authority: "operator",
        source: "default",
        ref,
        agentIDs: [agentID],
        skill: cloneProductionSkill(skill),
      })
    }
    return [...manifest, ...operator]
  }

  function mergeProductionSkillGrants(
    expertSquadID: string,
    capabilities: readonly (ResolvedSchedulerCapability | ResolvedWorkerCapability)[],
  ): ProductionSkillGrant[] {
    const byRef = new Map<string, ProductionSkillGrant>()
    const refByName = new Map<string, string>()
    for (const capability of capabilities) {
      for (const grant of capability.productionSkills) {
        const resourceKey = `${grant.source}:${grant.ref}`
        const key = `${grant.authority}:${resourceKey}`
        const priorRef = refByName.get(grant.skill.name)
        if (priorRef && priorRef !== resourceKey) {
          throw new Error(
            `Active expert squad ${expertSquadID} projects skill name ${JSON.stringify(grant.skill.name)} from both ${priorRef} and ${resourceKey}.`,
          )
        }
        refByName.set(grant.skill.name, resourceKey)
        const existing = byRef.get(key)
        if (!existing) {
          byRef.set(key, { ...grant, agentIDs: [...grant.agentIDs] })
          continue
        }
        existing.agentIDs = canonicalStringSet(
          [...existing.agentIDs, ...grant.agentIDs],
          `production skill ${grant.ref}.agentIDs`,
        )
      }
    }
    return [...byRef.values()].sort(
      (left, right) =>
        compareCanonicalStrings(left.source, right.source) || compareCanonicalStrings(left.ref, right.ref),
    )
  }

  type ProjectSelectorPackage = {
    pkg: Parameters<typeof selectorSkillFromPackage>[0]["pkg"]
  }

  async function loadProjectSelectorPackages(
    projectDirectory: string | undefined,
    activeProfileID: string,
  ): Promise<ProjectSelectorPackage[]> {
    if (!projectDirectory) return []
    const selectors: ProjectSelectorPackage[] = []
    for (const entry of await discoverExternalPackages(projectDirectory)) {
      assertNoBuiltInCollision(entry.id)
      if (entry.id === activeProfileID) continue
      const loaded = {
        ...(await ExpertSquadRegistry.loadCatalogPackage(entry.root)),
        installationScope: entry.installationScope,
      }
      if (loaded.id !== entry.id) {
        throw new Error(
          `Discovered selector expert squad ${JSON.stringify(entry.id)} loaded mismatched manifest id ${JSON.stringify(loaded.id)}.`,
        )
      }
      if (selectors.some((selector) => selector.pkg.id === loaded.id)) {
        throw new Error(`External expert squad selector catalog loaded duplicate id ${JSON.stringify(loaded.id)}.`)
      }
      selectors.push({ pkg: loaded })
    }
    return selectors
  }

  async function resolveSkillProjectionForContext(input: {
    context: CapabilityResolutionContext
    config: ConfigLike
    projectDirectory?: string
    projectSelectorPackages?: ProjectSelectorPackage[]
    capabilitySet?: ResolvedPackageCapabilitySet
  }): Promise<ResolvedSkillProjection> {
    const active = input.context.active
    const agentProjectionEntries = ExpertSquadRegistry.agentProjectionEntries(active.pkg.manifest).sort((left, right) =>
      compareCanonicalStrings(left.agentID, right.agentID),
    )
    const capabilitySet = input.capabilitySet ?? (await resolvePackageCapabilitySet(input.context, input.config))
    const schedulerCapability = capabilitySet.scheduler
    const workerCapabilities = capabilitySet.workers
    const schedulerOnlyWorkerCapabilities = capabilitySet.schedulerOnlyWorkers
    const productionSkills = mergeProductionSkillGrants(active.pkg.id, [
      schedulerCapability,
      ...schedulerOnlyWorkerCapabilities,
      ...workerCapabilities,
    ])
    const selectorPackages: Array<Parameters<typeof selectorSkillFromPackage>[0]> = [
      ...getLoadedBuiltInPackages()
        .filter((pkg) => pkg.id !== active.profileID)
        .map((pkg) => ({ pkg })),
      ...(
        input.projectSelectorPackages ?? (await loadProjectSelectorPackages(input.projectDirectory, active.profileID))
      )
        .filter((entry) => entry.pkg.id !== active.profileID)
        .map((entry) => ({ pkg: entry.pkg })),
    ]
    const selectorSkills = selectorPackages
      .map(selectorSkillFromPackage)
      .sort((left, right) => compareCanonicalStrings(left.expertSquadID, right.expertSquadID))
    const selectorSkillNames = selectorSkills.map((skill) => skill.name)
    const productionSkillNames = canonicalStringSet(
      [...new Set(productionSkills.map((grant) => grant.skill.name))],
      `active expert squad ${active.pkg.id}.productionSkillNames`,
    )
    const projectedAgentIDs = canonicalStringSet(
      agentProjectionEntries.map((entry) => entry.agentID),
      `active expert squad ${active.pkg.id}.agentIDs`,
    )
    const projectAgent = (workerCapability: ResolvedWorkerCapability): ResolvedProjectedAgent => {
      const projectedToolIDs = canonicalStringSet(
        [
          ...workerCapability.builtInToolIDs,
          ...workerCapability.defaultTools.map((entry) => entry.providerName),
          ...workerCapability.packageTools.map((entry) => entry.providerName),
          ...workerCapability.defaultMcpTools.map((entry) => entry.providerName),
          ...workerCapability.packageMcpTools.map((entry) => entry.providerName),
        ],
        `active expert squad ${active.pkg.id} agent ${workerCapability.identity.agentID}.projectedToolIDs`,
      )
      return {
        identity: workerCapability.identity,
        packageRevision: workerCapability.packageRevision,
        virtualWorkflows: schedulerCapability.virtualWorkflows,
        capabilityOwner: workerCapability.capabilityOwner,
        label: workerCapability.projection.label,
        ...(workerCapability.projection.description ? { description: workerCapability.projection.description } : {}),
        builtInToolIDs: [...workerCapability.builtInToolIDs],
        projectedToolIDs,
      }
    }
    const projectedAgents = workerCapabilities.map(projectAgent)
    const schedulerOnlyAgents = schedulerOnlyWorkerCapabilities.map(projectAgent)
    const projectedToolIDs = [
      ...new Set([
        ...activeProjectedSchedulerToolIDs(schedulerCapability),
        ...projectedAgents.flatMap((agent) => agent.projectedToolIDs),
      ]),
    ].sort(compareCanonicalStrings)
    const projectedScheduler: ResolvedProjectedScheduler = {
      identity: schedulerCapability.identity,
      label: active.pkg.promptProfile.label,
      ...(active.pkg.promptProfile.description ? { description: active.pkg.promptProfile.description } : {}),
      virtualWorkflows: schedulerCapability.virtualWorkflows,
      builtInToolIDs: [...schedulerCapability.builtInToolIDs],
      projectedToolIDs: activeProjectedSchedulerToolIDs(schedulerCapability),
    }
    return freezeResolvedProjection<ResolvedSkillProjection>({
      expertSquadID: schedulerCapability.expertSquadID,
      builtIn: schedulerCapability.builtIn,
      projectionHash: canonicalProjectionHash(ProjectionHashDomain.productionSkills, {
        expert_squad_id: schedulerCapability.expertSquadID,
        grants: productionSkills.map(canonicalProductionSkillGrant),
      }),
      projectedToolIDs,
      projectedAgentIDs,
      projectedScheduler,
      projectedAgents,
      schedulerOnlyAgents,
      selectorSkillNames,
      productionSkillNames,
      projectedSkillNames: [...productionSkillNames],
      selectorSkills,
      productionSkills,
      skillInventory: input.context.defaultSkills.map(cloneProductionSkill),
    })
  }

  export async function resolveSkillProjection(input: SkillProjectionInput): Promise<ResolvedSkillProjection> {
    const context = await capabilityResolutionContext(input)
    return resolveSkillProjectionForContext({
      context,
      config: input.config,
      projectDirectory: input.projectDirectory,
    })
  }

  export async function composeResolvedAgentPrompt(input: ResolvedComposeInput): Promise<string> {
    const projectedIdentity =
      "scheduler" in input.capability
        ? undefined
        : [
            "<projected_agent_identity>",
            input.capability.capabilityOwner === "platform"
              ? `active_expert_squad_scope: ${JSON.stringify(input.capability.expertSquadID)}`
              : `expert_squad_id: ${JSON.stringify(input.capability.expertSquadID)}`,
            `capability_owner: ${JSON.stringify(input.capability.capabilityOwner)}`,
            `agent_id: ${JSON.stringify(input.capability.identity.agentID)}`,
            `runtime_template_seed: ${JSON.stringify(input.capability.identity.baseRole)}`,
            `dispatch_adapter: ${JSON.stringify(input.capability.identity.dispatchAdapterID)}`,
            "The agent_id above is your exact runtime and message identity. The runtime_template_seed selects the default core, tool, and runtime template plus typed adapter ABI only. A platform capability uses the active expert squad only as a projection epoch and task scope; it is not owned or configured by that package. The resolved projection determines the final capability, tool, and skill surfaces; the seed is not an agent identity or dispatch target.",
            "</projected_agent_identity>",
          ].join("\n")
    const readme = "scheduler" in input.capability ? input.capability.readmeContent : undefined
    const virtualWorkflows =
      "scheduler" in input.capability && Object.keys(input.capability.virtualWorkflows).length > 0
        ? [
            "<expert_squad_virtual_workflows>",
            "These package-declared graphs are binding scheduler contracts, enforced by your visible decisions rather than a host hard gate. Before the first dispatch, identify the exact workflow selected by the request and current evidence. Every node declared by that selected workflow must obtain terminal-success evidence; do not omit a node, skip it, substitute an undeclared agent, or reorder it. A node may dispatch only after every depends_on predecessor has terminal-success evidence. Existing terminal-success evidence may satisfy a node on resume, but names, summaries, or partial artifacts cannot. If any required node or predecessor evidence cannot be satisfied, refuse subsequent dispatch and expose the blocker. These graphs do not automatically execute, persist workflow selection or step state, or create a host workflow engine.",
            "Every declared node executes once for the Task. Exact Delivery Slice revision identifiers may be passed through the selected adapter as contract and evidence subjects, but they never multiply node instances, own Sessions, or create another lifecycle.",
            "For every scheduler decision epoch, identify all dependency-ready Task nodes before the first dispatch. Dispatch independent frontier nodes in the same assistant response up to the remaining Task capacity. Terminal evidence belongs to the exact declared node occurrence and its cited Delivery Slice revision subjects.",
            JSON.stringify(input.capability.virtualWorkflows, null, 2),
            "</expert_squad_virtual_workflows>",
          ].join("\n")
        : undefined
    const mcpContext = await resolvedMcpPromptContext({
      taskID: input.taskID,
      capability: input.capability,
      projectDirectory: input.projectDirectory,
    })
    const artifactCatalogProtocol =
      input.capability.builtInToolIDs.includes("artifact_search") &&
      input.capability.builtInToolIDs.includes("artifact_read") &&
      input.capability.builtInToolIDs.includes("artifact_select")
        ? [
            "<task_artifact_catalog>",
            "Durable inter-Agent evidence is discovered through the current Task's artifact catalog by each consumer itself; dispatches never transport Artifact locators or bodies. Use artifact_search without a text query to enumerate the complete catalog and follow every cursor while checking catalog_complete and provider_errors. Select current, historical, or all revisions explicitly with version_scope; select exact stable names with labels; use query mode substring for deterministic partial-name discovery or fuzzy for ranked typo-tolerant discovery; and choose relevance, newest, oldest, or name ordering explicitly. A fuzzy result is only a candidate list. Read each chosen immutable locator completely, then call artifact_select for every completely read Artifact that semantically supports the typed output. Use bounded inline byte windows for ordinary text. For a large task_artifact_resource, use artifact_read delivery=materialized_file once and inspect the returned immutable local cache path with mature command-line or library tooling instead of streaming the whole resource repeatedly through model context. Completely read but unselected Artifacts remain observed audit facts and do not become semantic sources; zero selections are valid. An immediate artifact_publish call declares its publication-specific source_artifact_locators explicitly, each drawn from complete reads earlier in the same physical Turn, so multiple publications cannot contaminate one another. Core-owned typed projections such as Intent, RequirementSet, ContractGraph, and Goal projection are selected by kind, artifact type, label, Goal, and time; projected-Agent producer filters do not match those Core publication facts. Missing selected locators, foreign-Task locators, corrupt manifests or bytes, wrong paths, digest mismatches, and invalid text are explicit evidence errors and must remain visible. Artifact tools expose facts only: they do not dispatch, retry, accept, or complete Goals.",
            "</task_artifact_catalog>",
          ].join("\n")
        : undefined
    return [
      projectedIdentity,
      input.base,
      artifactCatalogProtocol,
      readme,
      virtualWorkflows,
      input.capability.promptOverlay,
      mcpContext,
      input.userAppend,
    ]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n\n")
  }

  export async function assertKnownProfileID(input: ProfileIDInput): Promise<void> {
    PromptProfileIDSchema.parse(input.profileID)
    if (Object.hasOwn(builtInPackages(), input.profileID)) {
      const entries =
        input.scope === "global"
          ? await ExpertSquadRegistry.findInstalledPackageIdentitiesForProjects([], input.profileID)
          : input.projectDirectory
            ? await ExpertSquadRegistry.discover(input.projectDirectory)
            : []
      for (const entry of entries) {
        if (entry.id === input.profileID) {
          throw new Error(
            `External expert squad package id ${JSON.stringify(input.profileID)} collides with a built-in expert squad id.`,
          )
        }
      }
      return
    }
    const externalPackage =
      input.scope === "global"
        ? await loadGlobalExternalPackageByID(input.profileID)
        : input.projectDirectory
          ? await loadExternalPackageByID(input.projectDirectory, input.profileID)
          : undefined
    if (externalPackage) {
      return
    }
    throw new Error(`Unknown prompt profile ${JSON.stringify(input.profileID)}`)
  }

  export async function assertProfileSupportsProductPillar(
    input: ProfileIDInput & { productPillar: "code" | "work" },
  ): Promise<void> {
    await assertKnownProfileID(input)
    const pkg = Object.hasOwn(builtInPackages(), input.profileID)
      ? builtInPackages()[input.profileID]
      : input.scope === "global"
        ? await loadGlobalExternalPackageByID(input.profileID)
        : input.projectDirectory
          ? await loadExternalPackageByID(input.projectDirectory, input.profileID)
          : undefined
    if (!pkg?.manifest.product_pillars.includes(input.productPillar)) {
      throw new Error(
        `Expert squad ${JSON.stringify(input.profileID)} does not support product pillar ${JSON.stringify(input.productPillar)}.`,
      )
    }
  }

  async function activeAgentProjection(input: {
    capabilitySet: ResolvedPackageCapabilitySet
    promptProfileActive: string
  }): Promise<ExpertSquadCatalog["active_agent_projection"]> {
    const agents = input.capabilitySet.workers.map((capability) => {
      return {
        agent_id: capability.identity.agentID,
        base_role: capability.identity.baseRole,
        session_kind: capability.identity.sessionKind,
        dispatch_adapter_id: capability.identity.dispatchAdapterID,
        label: capability.projection.label,
        ...(capability.projection.description ? { description: capability.projection.description } : {}),
        projection_hash: capability.identity.projectionHash,
        built_in_tool_ids: capability.builtInToolIDs,
        default_skill_refs: capability.productionSkills
          .filter((grant) => grant.source === "default")
          .map((grant) => grant.ref),
        package_skill_refs: capability.productionSkills
          .filter((grant) => grant.source === "package")
          .map((grant) => grant.ref),
        default_tool_refs: capability.defaultTools.map((entry) => entry.ref),
        package_tool_refs: capability.packageTools.map((entry) => entry.ref),
        default_mcp_server_refs: capability.projection.default_mcp_server_refs,
        package_mcp_server_refs: capability.projection.package_mcp_server_refs,
        default_mcp_tool_refs: capability.defaultMcpTools.map((entry) => entry.ref),
        package_mcp_tool_refs: capability.packageMcpTools.map((entry) => entry.ref),
        default_mcp_prompt_refs: capability.defaultMcpPrompts.map((entry) => entry.ref),
        package_mcp_prompt_refs: capability.packageMcpPrompts.map((entry) => entry.ref),
        default_mcp_resource_refs: capability.defaultMcpResources.map((entry) => entry.ref),
        package_mcp_resource_refs: capability.packageMcpResources.map((entry) => entry.ref),
      }
    })
    return {
      source_expert_squad_id: input.capabilitySet.context.active.pkg.id,
      prompt_profile_active: input.promptProfileActive,
      scheduler_projection_hash: input.capabilitySet.scheduler.projectionHash,
      projection_hash: canonicalProjectionHash(ProjectionHashDomain.activeAgents, {
        expert_squad_id: input.capabilitySet.context.active.pkg.id,
        scheduler_projection_hash: input.capabilitySet.scheduler.projectionHash,
        agents: agents.map((agent) => ({ agent_id: agent.agent_id, projection_hash: agent.projection_hash })),
      }),
      virtual_workflows: input.capabilitySet.scheduler.virtualWorkflows,
      agents,
    }
  }

  async function catalogInventory(projectDirectory?: string) {
    const [external, builtInPackagesByID] = await Promise.all([
      externalCatalogPackages(projectDirectory),
      Promise.resolve(builtInPackages()),
    ])
    const projectPackagesByID = external.packages
    const squads: ExpertSquadCatalogSummary[] = [
      ...Object.values(builtInPackagesByID).map((pkg) =>
        catalogSummaryFromPackage({
          pkg,
          builtIn: true,
        }),
      ),
      ...Object.values(projectPackagesByID).map((pkg) =>
        catalogSummaryFromPackage({
          pkg,
          builtIn: false,
        }),
      ),
    ]
    const installations = [
      ...Object.values(builtInPackagesByID).map((pkg) => catalogSummaryFromPackage({ pkg, builtIn: true })),
      ...external.installations
        .sort((left, right) => {
          if (left.installationScope === right.installationScope) return left.id.localeCompare(right.id)
          return left.installationScope === "project" ? -1 : 1
        })
        .map((pkg) => catalogSummaryFromPackage({ pkg, builtIn: false })),
    ]
    return {
      projectPackagesByID,
      builtInPackagesByID,
      squads,
      installations,
      issues: external.issues,
      warnings: external.warnings,
    }
  }

  export async function recommendationCatalog(input: {
    projectDirectory: string
    productPillar: "code" | "work"
    visibleExpertSquadIDs?: readonly string[]
  }): Promise<ExpertSquadRecommendation[]> {
    const visibleIDs = [...new Set(input.visibleExpertSquadIDs ?? [])]
    const { squads, projectPackagesByID } = await catalogInventory(input.projectDirectory)
    const byID = new Map(squads.map((squad) => [squad.id, squad]))
    const unknown = visibleIDs.filter((id) => !byID.has(id))
    if (unknown.length > 0) {
      throw new Error(`Unknown Mission-visible expert squad ${unknown.map((id) => JSON.stringify(id)).join(", ")}.`)
    }
    const requested = visibleIDs.length === 0 ? squads : visibleIDs.map((id) => byID.get(id)!)
    const incompatible = requested.filter((squad) => !squad.product_pillars.includes(input.productPillar))
    if (visibleIDs.length > 0 && incompatible.length > 0) {
      throw new Error(
        `Mission-visible expert squad ${incompatible.map((squad) => JSON.stringify(squad.id)).join(", ")} does not support product pillar ${JSON.stringify(input.productPillar)}.`,
      )
    }
    const selected = requested.filter((squad) => squad.product_pillars.includes(input.productPillar))
    return selected.map((squad) =>
      ExpertSquadRecommendationSchema.parse({
        id: squad.id,
        name: squad.name,
        label: squad.label,
        display_label: squad.display_label,
        description: squad.description,
        version: squad.version,
        built_in: squad.built_in,
        product_pillars: squad.product_pillars,
        ...(projectPackagesByID[squad.id] ? { package_digest: projectPackagesByID[squad.id].packageDigest } : {}),
        selector: {
          summary: squad.selector.summary,
          selection_guidance: squad.selector.selection_guidance,
        },
        workflows: Object.entries(squad.capability_projection.virtual_workflows)
          .sort(([left], [right]) => compareCanonicalStrings(left, right))
          .map(([id, workflow]) => ({
            id,
            label: workflow.label,
            description: workflow.description,
            node_count: Object.keys(workflow.nodes).length,
          })),
      }),
    )
  }

  export async function globalCatalog(): Promise<{
    squads: ExpertSquadCatalogSummary[]
    issues: ExpertSquadRegistry.DiscoveryIssue[]
  }> {
    const { squads, issues } = await catalogInventory()
    return { squads, issues }
  }

  export async function settingsCatalog(projectDirectory: string): Promise<ExpertSquadCatalogSummary[]> {
    return (await catalogInventory(projectDirectory)).squads
  }

  export async function settingsInventory(projectDirectory: string) {
    const inventory = await catalogInventory(projectDirectory)
    return {
      squads: inventory.squads,
      installations: inventory.installations,
      warnings: inventory.warnings,
    }
  }

  export async function catalog(input: ExpertSquadCatalogInput): Promise<ExpertSquadCatalog> {
    const active = PromptProfile.activeID(input.config)
    const projectDirectory = input.scope.directory
    const [{ projectPackagesByID, builtInPackagesByID, squads, installations, issues, warnings }, defaultSkills] =
      await Promise.all([
        catalogInventory(projectDirectory),
        input.defaultSkills === undefined
          ? Instance.provide({ directory: projectDirectory, fn: () => Skill.all() })
          : Promise.resolve(input.defaultSkills),
      ])
    const builtInActivePackage = builtInPackagesByID[active]
    const projectActivePackage = projectPackagesByID[active]
    if (builtInActivePackage && projectActivePackage) {
      throw new Error(
        `External expert squad package id ${JSON.stringify(active)} collides with a built-in expert squad id.`,
      )
    }
    const loadedProjectActivePackage = projectActivePackage
      ? {
          ...(await ExpertSquadRegistry.loadPackage(projectActivePackage.root)),
          installationScope: projectActivePackage.installationScope,
        }
      : undefined
    if (loadedProjectActivePackage && loadedProjectActivePackage.id !== active) {
      throw new Error(
        `Discovered expert squad ${JSON.stringify(active)} loaded mismatched manifest id ${JSON.stringify(loadedProjectActivePackage.id)}.`,
      )
    }
    const activePackage: ActiveProfilePackage = builtInActivePackage
      ? { profileID: active, builtIn: true, pkg: await loadBuiltInRuntimePackage(active) }
      : loadedProjectActivePackage
        ? { profileID: active, builtIn: false, pkg: loadedProjectActivePackage }
        : (() => {
            throw new Error(`Unknown prompt profile ${JSON.stringify(active)}`)
          })()
    const context: CapabilityResolutionContext = {
      active: activePackage,
      projectID:
        !activePackage.builtIn && activePackage.pkg.installationScope === "project"
          ? await Instance.provide({ directory: projectDirectory, fn: () => Instance.project.id })
          : null,
      defaultSkills,
      defaultSkillsByName: skillInventoryByName(defaultSkills),
    }
    const activeCapabilitySet = await resolvePackageCapabilitySet(context, input.config)
    if (!squads.some((squad) => squad.id === active)) {
      throw new Error(`Unknown prompt profile ${JSON.stringify(active)}`)
    }
    const skillProjection = await resolveSkillProjectionForContext({
      context,
      config: input.config,
      projectDirectory,
      projectSelectorPackages: Object.values(projectPackagesByID).map((pkg) => ({ pkg })),
      capabilitySet: activeCapabilitySet,
    })
    return ExpertSquadCatalogSchema.parse({
      active: {
        effective: active,
        project: input.projectActive,
        session_override: input.sessionOverride,
      },
      default: DEFAULT_PROMPT_PROFILE_ID,
      scope: input.scope,
      squads,
      installations,
      issues,
      warnings,
      active_agent_projection: await activeAgentProjection({
        capabilitySet: activeCapabilitySet,
        promptProfileActive: active,
      }),
      active_skill_projection: {
        active_squad_id: skillProjection.expertSquadID,
        built_in: skillProjection.builtIn,
        projection_hash: skillProjection.projectionHash,
        projected_tool_ids: skillProjection.projectedToolIDs,
        projected_agent_ids: skillProjection.projectedAgentIDs,
        selector_skill_names: skillProjection.selectorSkillNames,
        production_skill_names: skillProjection.productionSkillNames,
        projected_skill_names: skillProjection.projectedSkillNames,
        selector_skills: skillProjection.selectorSkills.map((skill) => ({
          kind: skill.kind,
          expert_squad_id: skill.expertSquadID,
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          digest: skill.digest,
          location: skill.location,
          required_tools: skill.requiredTools,
        })),
        production_grants: skillProjection.productionSkills.map((grant) => ({
          kind: grant.kind,
          authority: grant.authority,
          source: grant.source,
          ref: grant.ref,
          agent_ids: grant.agentIDs,
          skill: {
            name: grant.skill.name,
            description: grant.skill.description,
            builtin: grant.skill.builtin,
            location: grant.skill.location,
            required_tools: grant.skill.required_tools,
          },
        })),
      },
    })
  }
}
