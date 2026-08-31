import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { jsonSchema, tool, type Tool as AITool } from "ai"
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
  type PackageToolRuntimeBinding,
  type ProjectedTaskToolRuntimeBinding,
} from "@/tool/task-tool-execution-scope"
import { builtInToolProviderState } from "@/tool/global-tools"
import { builtInPackageSources, getLoadedBuiltInPackages } from "./builtin"
import { executePackageToolInCapsule, introspectPackageToolInCapsule } from "./package-tool-capsule"
import {
  ExpertSquadCatalogSchema,
  ExpertSquadCatalogIndexEntrySchema,
  ExpertSquadCatalogInspectionSchema,
  ExpertSquadCatalogPageSchema,
  ExpertSquadDiagnosticPageSchema,
  ExpertSquadInventoryStatusSchema,
  type ExpertSquadCatalogIndexEntry,
  type ExpertSquadCatalogInspection,
  type ExpertSquadCatalogPage,
  type ExpertSquadDiagnosticPage,
  type ExpertSquadCatalog,
  type ExpertSquadCatalogSummary,
} from "./catalog"
import {
  catalogIndexFromPackage as catalogIndexFromCapabilityPackage,
  catalogInspectionFromPackage as catalogInspectionFromCapabilityPackage,
  catalogSummaryFromPackage as catalogSummaryFromCapabilityPackage,
} from "./catalog-profile"
import { scoreDiscoveryFields, type DiscoverySearchField } from "@/capability/fuzzy"
import { BUILTIN_EXPERT_SQUAD_NAMESPACE } from "./id"
import { expertSquadSearchLocalizations } from "../../generated/expert-squad-search-localization"
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
import { CAPABILITY_SEARCH_TOOL_ID } from "@/tool/capability-search"
import { ExpertSquadRegistry } from "./registry"
import {
  materializeExpertSquadCapabilities,
  type MaterializedExpertSquadCapabilities,
} from "./capability-grants"
import { PlatformCapabilitySetRegistry } from "@/agent/platform-capability-sets"
import { runtimeOverrideLayers } from "@/agent/runtime-override"
import { sessionRuntimeFromProjectedTemplate, type SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { configuredProjectedWorkerModelRef } from "@/agent/model"
import { ExpertSquadConfigurationStore } from "./configuration"
import { createHarnessGrantSet, harnessLeafAccess } from "@/capability/harness-projection"
import {
  capabilityRef,
  CapabilityRefCodec,
  type CapabilityKind,
  type CapabilityRef,
} from "@opencorvus-ai/util/capability-ref"
import { NamedError } from "@opencorvus-ai/util/error"

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
  export const PromptProfileNotFoundError = NamedError.create(
    "PromptProfileNotFoundError",
    z.object({ message: z.string(), profileID: z.string(), scope: z.enum(["project", "global"]) }),
  )

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
    packageRevision?: ExpertSquadPackageRevision
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
    scope?: "project" | "global"
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
    grants: MaterializedExpertSquadCapabilities
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
    grants: MaterializedExpertSquadCapabilities
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

  function capabilityHarnessRefs(
    capability: ResolvedSchedulerCapability | ResolvedWorkerCapability,
    projectedToolIDs: readonly string[],
  ) {
    const projectedToolIDSet = new Set(projectedToolIDs)
    return {
      tool_refs: [
        ...capability.builtInToolIDs.map((toolID) =>
          capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: projectedToolIDSet.has(toolID)
              ? `runtime-projection:${capability.identity.agentID}`
              : "tool-registry",
            local_ref: toolID,
          }),
        ),
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
          owner_ref: grant.source === "package" ? capability.expertSquadID : "skill-manager",
          local_ref: grant.ref,
        }),
      ),
      mcp_server_refs: [
        ...harnessRefs("mcp_server", "project", "mcp-config", capability.grants.defaultMcpServerRefs),
        ...harnessRefs("mcp_server", "package", capability.expertSquadID, capability.grants.packageMcpServerRefs),
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

  export function schedulerHarnessGrants(input: {
    taskID: string
    capability: ResolvedSchedulerCapability
    projectedToolIDs: readonly string[]
  }) {
    const refs = capabilityHarnessRefs(input.capability, input.projectedToolIDs)
    return createHarnessGrantSet({
      context: {
        kind: "task_scheduler",
        task_id: input.taskID,
        profile_id: input.capability.expertSquadID,
      },
      owner_revision: input.capability.projectionHash,
      grants: Object.values(refs)
        .flat()
        .map((ref) => ({ ref, access: harnessLeafAccess(ref) })),
    })
  }

  export function workerHarnessGrants(input: {
    taskID: string
    capability: ResolvedWorkerCapability
    projectedToolIDs: readonly string[]
    stageToolIDs: readonly string[]
  }) {
    const refs = capabilityHarnessRefs(input.capability, input.projectedToolIDs)
    return createHarnessGrantSet({
      context: {
        kind: "task_agent",
        task_id: input.taskID,
        profile_id: input.capability.expertSquadID,
        agent_id: input.capability.identity.agentID,
      },
      owner_revision: input.capability.identity.projectionHash,
      grants: [
        ...Object.values(refs)
          .flat()
          .map((ref) => ({ ref, access: harnessLeafAccess(ref) })),
        ...input.stageToolIDs.map((toolID) => {
          const ref = capabilityRef({
            kind: "tool" as const,
            source: "platform" as const,
            owner_ref: `dispatch-stage:${input.capability.identity.dispatchAdapterID}`,
            local_ref: toolID,
          })
          return { ref, access: harnessLeafAccess(ref) }
        }),
      ],
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
    capability_refs: [
      CapabilityRefCodec.encode(
        PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: "build" }),
      ),
    ],
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

  async function discoverAvailableExternalPackages(projectDirectory?: string, reconcileEvolutionMutations = true) {
    const result = projectDirectory
      ? await ExpertSquadRegistry.discoverAvailable(projectDirectory, { reconcileEvolutionMutations })
      : await ExpertSquadRegistry.discoverGlobalAvailable()
    const items: ExpertSquadRegistry.CatalogDeclaration[] = []
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
      const effective = result as ExpertSquadRegistry.EffectiveDiscoveryResult<ExpertSquadRegistry.CatalogDeclaration>
      return { items, issues, installations: effective.installations, warnings: effective.warnings }
    }
    return { items, issues, installations: result.items, warnings: [] as ExpertSquadRegistry.DiscoveryWarning[] }
  }

  async function externalCatalogPackages(projectDirectory?: string): Promise<{
    packages: Record<string, ExpertSquadRegistry.CatalogDeclaration>
    installations: ExpertSquadRegistry.CatalogDeclaration[]
    issues: ExpertSquadRegistry.DiscoveryIssue[]
    warnings: ExpertSquadRegistry.DiscoveryWarning[]
  }> {
    const result: Record<string, ExpertSquadRegistry.CatalogDeclaration> = {}
    const discovered = await discoverAvailableExternalPackages(projectDirectory)
    const issues = [...discovered.issues]
    for (const entry of discovered.items) {
      try {
        const loaded = entry
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
    const installations: ExpertSquadRegistry.CatalogDeclaration[] = []
    for (const entry of discovered.installations) {
      try {
        const loaded = entry
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
    const externalPackage =
      input.scope === "global"
        ? await loadGlobalExternalPackageByID(profileID)
        : input.projectDirectory
          ? await loadExternalPackageByID(input.projectDirectory, profileID, input.reconcileEvolutionMutations)
          : undefined
    if (externalPackage) return { profileID, builtIn: false, pkg: externalPackage }
    throw new PromptProfileNotFoundError({
      message: `Unknown prompt profile ${JSON.stringify(profileID)}`,
      profileID,
      scope: input.scope ?? "project",
    })
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
      // `universal-build` is dispatchable by every scheduler without being declared by a package, so
      // an operator mount naming it is valid even though no manifest projects it.
      const baseRole =
        agentID === "orchestrator"
          ? "orchestrator"
          : agentID === UNIVERSAL_BUILD_AGENT_ID
            ? universalBuildProjection.base_role
            : projections.get(agentID)?.baseRole
      if (!baseRole) {
        throw new Error(
          `Expert squad ${input.active.profileID} skill_mounts references undeclared dynamic agent ${JSON.stringify(agentID)}.`,
        )
      }
      const skillMountable = baseRole === "orchestrator" ? true : RuntimeTemplateRegistry.get(baseRole).skillMountable
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
    packageRevision?: ExpertSquadPackageRevision
  }): Promise<void> {
    const defaultSkills =
      input.defaultSkills ?? (await Instance.provide({ directory: input.projectDirectory, fn: () => Skill.all() }))
    const defaultSkillsByName = skillInventoryByName(defaultSkills)
    const projectEntries = (await discoverAvailableExternalPackages(input.projectDirectory)).items
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
      const pinned =
        input.packageRevision?.id === expertSquadID
          ? await ExpertSquadRegistry.loadPackageRevisionSnapshot(input.packageRevision.packageDigest)
          : undefined
      const active: SkillMountProfilePackage = pinned
        ? {
            profileID: expertSquadID,
            builtIn: input.packageRevision!.scope === "built_in",
            pkg: {
              ...pinned,
              ...(input.packageRevision!.scope === "built_in"
                ? {}
                : { installationScope: input.packageRevision!.scope }),
            },
          }
        : builtIn
          ? { profileID: expertSquadID, builtIn: true, pkg: builtIn }
          : projectEntry
            ? {
                profileID: expertSquadID,
                builtIn: false,
                pkg: projectEntry,
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
  export const defaultToolRuntimeName = defaultToolNameFromCapabilityRef
  const defaultToolNameFromRef = defaultToolRuntimeName

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
      projected_tool_ids: canonicalStringSet(input.builtInToolIDs, `${input.agentID}.builtInToolIDs`),
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

  function catalogIndexFromPackage(input: {
    pkg:
      | BuiltInPackage
      | ExpertSquadRegistry.CatalogDeclaration
      | ExpertSquadRegistry.CatalogPackage
      | ExpertSquadRegistry.LoadedPackage
    builtIn: boolean
  }): ExpertSquadCatalogIndexEntry {
    return catalogIndexFromCapabilityPackage({
      pkg: input.pkg,
      builtIn: input.builtIn,
    })
  }

  function catalogInspectionFromPackage(input: {
    pkg:
      | BuiltInPackage
      | ExpertSquadRegistry.CatalogDeclaration
      | ExpertSquadRegistry.CatalogPackage
      | ExpertSquadRegistry.LoadedPackage
    builtIn: boolean
    workflows: ExpertSquadCatalogInspection["workflows"]
    workflowCount: number
    nextWorkflowCursor?: string | null
  }): ExpertSquadCatalogInspection {
    return catalogInspectionFromCapabilityPackage(input)
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
      if (serverName === ComputerMCPBuiltin.ServerName) {
        result[serverName] = ComputerMCPBuiltin.requireEnabledConfiguredDeclaration(server)
        continue
      }
      // Projection reports the configured provider; it does not substitute one.
      // A squad that names a server configuration has turned off is a real
      // disagreement, and saying so is the only answer that keeps
      // configuration, assignment, status and execution describing the same
      // capability.
      if (!("type" in server)) {
        throw new Error(
          `Active expert squad projects default MCP server default/mcp/${serverName}, which configuration has disabled.`,
        )
      }
      result[serverName] = Config.Mcp.parse(server)
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
    grants: MaterializedExpertSquadCapabilities,
    kind: McpCapabilityKind,
  ): readonly string[] {
    if (kind === "tool") return grants.packageMcpToolRefs
    if (kind === "prompt") return grants.packageMcpPromptRefs
    return grants.packageMcpResourceRefs
  }

  function effectivePackageMcpRefs(input: {
    active:
      | { builtIn: true }
      | {
          builtIn: false
          pkg: PackageMcpRefInventory
        }
    grants: MaterializedExpertSquadCapabilities
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

    for (const serverRef of input.grants.packageMcpServerRefs) {
      if (!input.active.pkg.packageMcpDeclarations.has(serverRef)) {
        throw new Error(`${input.context}: package MCP server ref ${serverRef} is not declared in the active package`)
      }
      const prefix = `${serverRef}/${input.kind}/`
      const expanded = [...available.keys()].filter((item) => item.startsWith(prefix)).sort(compareCanonicalStrings)
      for (const ref of expanded) add(ref, `package MCP server capability ${serverRef}`)
    }
    for (const ref of projectionPackageMcpKindRefs(input.grants, input.kind)) {
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

  export function schedulerRuntimeToolIDs(capability: ResolvedSchedulerCapability): string[] {
    return activeProjectedSchedulerToolIDs(capability).filter((toolID) => toolID !== CAPABILITY_SEARCH_TOOL_ID)
  }

  export function workerRuntimeToolIDs(capability: ResolvedWorkerCapability): string[] {
    return capability.defaultTools.map((entry) => entry.providerName)
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
    return {}
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
    return [...toolIDs]
  }

  function expandedSchedulerBuiltInToolIDs(
    grants: MaterializedExpertSquadCapabilities,
    config: ConfigLike,
  ): string[] {
    return expandedProjectedBuiltInToolIDs({
      inheritedToolIDs: grants.builtInToolIDs.filter((toolID) => !grants.explicitBuiltInToolIDs.includes(toolID)),
      explicitToolIDs: grants.explicitBuiltInToolIDs,
      projectableToolIDs: AgentToolPool.orchestratorSchedulerProjectableToolIDs(),
      config,
      context: "Orchestrator scheduler template",
    })
  }

  function expandedWorkerBuiltInToolIDs(
    baseRole: RuntimeTemplateID,
    grants: MaterializedExpertSquadCapabilities,
    config: ConfigLike,
  ): string[] {
    return expandedProjectedBuiltInToolIDs({
      inheritedToolIDs: grants.builtInToolIDs.filter((toolID) => !grants.explicitBuiltInToolIDs.includes(toolID)),
      explicitToolIDs: grants.explicitBuiltInToolIDs,
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
    const grants = materializeExpertSquadCapabilities({
      manifest: active.pkg.manifest,
      projection: scheduler,
      runtime: { kind: "scheduler" },
      context: "capability_projection.scheduler",
    })
    const builtInToolIDs = expandedSchedulerBuiltInToolIDs(grants, config)
    const defaultTools = resolvedProviderRefs(
      grants.defaultToolRefs,
      defaultToolProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    assertProjectableSchedulerDefaultHostTools(defaultTools, "capability_projection.scheduler")
    assertDefaultToolsDoNotRepeatBuiltIns(builtInToolIDs, defaultTools, "capability_projection.scheduler")
    const packageTools = resolvedPackageTools(active, active.builtIn ? [] : grants.packageToolRefs)
    const defaultMcpTools = resolvedProviderRefs(
      grants.defaultMcpToolRefs,
      defaultMcpToolProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    const defaultMcpPrompts = resolvedProviderRefs(
      grants.defaultMcpPromptRefs,
      defaultMcpPromptProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    const defaultMcpResources = resolvedProviderRefs(
      grants.defaultMcpResourceRefs,
      defaultMcpResourceProviderName,
      "capability_projection.scheduler.capability_refs",
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
        grants,
        kind: "tool",
        context: "capability_projection.scheduler",
      }),
      "tool",
      packageMcpToolProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    const packageMcpPrompts = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({
        active,
        grants,
        kind: "prompt",
        context: "capability_projection.scheduler",
      }),
      "prompt",
      packageMcpPromptProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    const packageMcpResources = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({
        active,
        grants,
        kind: "resource",
        context: "capability_projection.scheduler",
      }),
      "resource",
      packageMcpResourceProviderName,
      "capability_projection.scheduler.capability_refs",
    )
    const productionSkills = effectiveProductionSkillGrants(context, grants, "orchestrator", config)
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
      grants,
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
    const context =
      capabilityOwner === "platform"
        ? `platform.scheduler_capabilities.${agentID}`
        : `capability_projection.agents.${agentID}`
    const grants = materializeExpertSquadCapabilities({
      manifest: active.pkg.manifest,
      projection,
      runtime: { kind: "worker", baseRole },
      context,
    })
    const builtInToolIDs = expandedWorkerBuiltInToolIDs(baseRole, grants, input.config)
    const defaultTools = resolvedProviderRefs(
      grants.defaultToolRefs,
      defaultToolProviderName,
      `${context}.capability_refs`,
    )
    assertProjectableDefaultHostTools(defaultTools, baseRole, context)
    assertDefaultToolsDoNotRepeatBuiltIns(builtInToolIDs, defaultTools, context)
    const packageTools = resolvedPackageTools(active, active.builtIn ? [] : grants.packageToolRefs)
    const defaultMcpTools = resolvedProviderRefs(
      grants.defaultMcpToolRefs,
      defaultMcpToolProviderName,
      `${context}.capability_refs`,
    )
    const defaultMcpPrompts = resolvedProviderRefs(
      grants.defaultMcpPromptRefs,
      defaultMcpPromptProviderName,
      `${context}.capability_refs`,
    )
    const defaultMcpResources = resolvedProviderRefs(
      grants.defaultMcpResourceRefs,
      defaultMcpResourceProviderName,
      `${context}.capability_refs`,
    )
    const defaultMcpServers = defaultMcpServersForRefs(input.config, [
      ...defaultMcpTools.map((entry) => entry.ref),
      ...defaultMcpPrompts.map((entry) => entry.ref),
      ...defaultMcpResources.map((entry) => entry.ref),
    ])
    const globalMcpTimeout = input.config.experimental?.mcp_timeout
    const packageMcpTools = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, grants, kind: "tool", context }),
      "tool",
      packageMcpToolProviderName,
      `${context}.capability_refs`,
    )
    const packageMcpPrompts = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, grants, kind: "prompt", context }),
      "prompt",
      packageMcpPromptProviderName,
      `${context}.capability_refs`,
    )
    const packageMcpResources = resolvedPackageMcpRefs(
      active,
      effectivePackageMcpRefs({ active, grants, kind: "resource", context }),
      "resource",
      packageMcpResourceProviderName,
      `${context}.capability_refs`,
    )
    const productionSkills = effectiveProductionSkillGrants(input.context, grants, agentID, input.config)
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
      grants,
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
        const truncated = await Truncate.output(result.output, { sessionID: scope.sessionID }, scope.executionSurface)
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
    entries: readonly ResolvedPackageTool[] = capability.packageTools,
  ): Promise<Record<string, T>> {
    if (capability.builtIn || entries.length === 0) return {}
    const result: Record<string, T> = {}
    for (const packageTool of entries) {
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
    entries: readonly ResolvedPackageTool[] = capability.packageTools,
  ): Promise<Record<string, T>> {
    if (capability.builtIn || entries.length === 0) return {}
    const result: Record<string, T> = {}
    for (const packageTool of entries) {
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
    const rawTool = await MCP.exactScopedTool({
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
          serverName: input.providerName,
        })
        const truncated = await Truncate.output(
          materialized.text,
          { sessionID: scope.sessionID },
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
    const rawTool = await MCP.exactScopedTool({
      key: input.providerName,
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
          serverName: input.providerName,
        })
        const truncated = await Truncate.output(
          materialized.text,
          { sessionID: scope.sessionID },
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


  async function schedulerPackageMcpTools<T>(
    capability: ResolvedSchedulerCapability,
    input: { taskID: string; projectDirectory: string; connectionOwner: MCP.ScopedConnectionOwner },
    entries: readonly ResolvedPackageMcpRef[] = capability.packageMcpTools,
  ): Promise<Record<string, T>> {
    if (capability.builtIn || entries.length === 0) return {}
    const result: Record<string, T> = {}
    for (const entry of entries) {
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
    entries: readonly ResolvedPackageMcpRef[] = capability.packageMcpTools,
  ): Promise<Record<string, T>> {
    if (capability.builtIn || entries.length === 0) return {}
    const result: Record<string, T> = {}
    for (const entry of entries) {
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


  /** Materialize one exact non-Registry Task projection leaf. */
  export async function exactProjectedExtensionTool(input: {
    capability: ResolvedSchedulerCapability | ResolvedWorkerCapability
    providerName: string
    runtimeTools?: Readonly<Record<string, AITool>>
    runtimeTool?: (runtimeToolID: string) => AITool | undefined | Promise<AITool | undefined>
    taskID: string
    projectDirectory: string
    toolDirectory: string
    connectionOwner: MCP.ScopedConnectionOwner
  }): Promise<AITool | undefined> {
    const defaultTool = input.capability.defaultTools.find((entry) => entry.providerName === input.providerName)
    if (defaultTool) {
      const runtimeName = defaultToolNameFromRef(defaultTool.ref)
      const exact = input.runtimeTools?.[runtimeName] ?? (await input.runtimeTool?.(runtimeName))
      if (!exact) {
        throw new Error(
          `Active expert squad ${JSON.stringify(input.capability.expertSquadID)} projects default Tool ${defaultTool.ref}, but runtime Tool ${runtimeName} is unavailable.`,
        )
      }
      return exact
    }

    const packageTool = input.capability.packageTools.find((entry) => entry.providerName === input.providerName)
    if (packageTool) {
      const record =
        "scheduler" in input.capability
          ? await schedulerPackageTools<AITool>(input.capability, input, [packageTool])
          : await workerPackageTools<AITool>(input.capability, input, [packageTool])
      return record[input.providerName]
    }

    const defaultMcp = input.capability.defaultMcpTools.find((entry) => entry.providerName === input.providerName)
    if (defaultMcp) {
      return (await defaultMcpToolFromConfig({
        ref: defaultMcp.ref,
        providerName: defaultMcp.providerName,
        mcpServers: input.capability.defaultMcpServers,
        cwd: "scheduler" in input.capability ? input.projectDirectory : input.toolDirectory,
        binding: projectedTaskToolBinding({
          capability: input.capability,
          taskID: input.taskID,
          projectDirectory: input.projectDirectory,
          ownerKind: "scheduler" in input.capability ? "projected-scheduler" : "projected-worker",
          providerKind: "default-mcp-tool",
          toolRef: defaultMcp.ref,
          providerName: defaultMcp.providerName,
          mcpServerConfigSHA256: mcpServerConfigSHA256(
            input.capability.defaultMcpServers[defaultMcpToolPartsFromRef(defaultMcp.ref).serverName],
          ),
        }),
        connectionOwner: input.connectionOwner,
        globalMcpTimeout: input.capability.globalMcpTimeout,
      })) as AITool
    }

    const packageMcp = input.capability.packageMcpTools.find((entry) => entry.providerName === input.providerName)
    if (packageMcp) {
      const record =
        "scheduler" in input.capability
          ? await schedulerPackageMcpTools<AITool>(input.capability, input, [packageMcp])
          : await workerPackageMcpTools<AITool>(input.capability, input, [packageMcp])
      return record[input.providerName]
    }
    return undefined
  }

  function unique(input: Iterable<string>): string[] {
    return [...new Set(input)]
  }

  function selectorSkillName(id: string): string {
    return `${id}-expert-squad`
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
    capabilities: MaterializedExpertSquadCapabilities,
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
    for (const ref of capabilities.defaultSkillRefs) {
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
    for (const ref of capabilities.packageSkillRefs) {
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
    capabilities: MaterializedExpertSquadCapabilities,
    agentID: string,
    config: ConfigLike,
  ): ProductionSkillGrant[] {
    const manifest = manifestProductionSkillGrants(context, capabilities, agentID)
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
    pkg: ExpertSquadRegistry.CatalogDeclaration
  }

  async function loadProjectSelectorPackages(
    projectDirectory: string | undefined,
    activeProfileID: string,
  ): Promise<ProjectSelectorPackage[]> {
    if (!projectDirectory) return []
    const selectors: ProjectSelectorPackage[] = []
    for (const entry of (await discoverAvailableExternalPackages(projectDirectory)).items) {
      assertNoBuiltInCollision(entry.id)
      if (entry.id === activeProfileID) continue
      const loaded = entry
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
    const selectorPackages = [
      ...getLoadedBuiltInPackages()
        .filter((pkg) => pkg.id !== active.profileID)
        .map((pkg) => ({ pkg })),
      ...(
        input.projectSelectorPackages ?? (await loadProjectSelectorPackages(input.projectDirectory, active.profileID))
      )
        .filter((entry) => entry.pkg.id !== active.profileID)
        .map((entry) => ({ pkg: entry.pkg })),
    ]
    const selectorSkillNames = selectorPackages
      .map((entry) => ({ id: entry.pkg.id, name: selectorSkillName(entry.pkg.id) }))
      .sort((left, right) => compareCanonicalStrings(left.id, right.id))
      .map((entry) => entry.name)
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
    const artifactCatalogProtocol =
      input.capability.builtInToolIDs.includes("artifact_search") &&
      input.capability.builtInToolIDs.includes("artifact_read") &&
      input.capability.builtInToolIDs.includes("artifact_select")
        ? [
            "<task_artifact_catalog>",
            "Durable inter-Agent evidence is discovered through the current Task's artifact catalog by each consumer itself; dispatches never transport Artifact locators or bodies. Use artifact_search without a text query to enumerate the complete catalog and follow every cursor while checking catalog_complete and provider_errors. Select current, historical, or all revisions explicitly with version_scope; select exact stable names with labels; use query mode substring for deterministic partial-name discovery or fuzzy for ranked typo-tolerant discovery; and choose relevance, newest, oldest, or name ordering explicitly. A fuzzy result is only a candidate list. Pass the returned artifact_locator_ref to artifact_read and continue with its next_offset until complete; then pass artifact_read_ref to artifact_select for every Artifact that semantically supports the typed output. Use bounded inline byte windows for ordinary text. For a large task_artifact_resource, use artifact_read delivery=materialized_file once and inspect the returned immutable local cache path with mature command-line or library tooling instead of streaming the whole resource repeatedly through model context. Completely read but unselected Artifacts remain observed audit facts and do not become semantic sources; zero selections are valid. An immediate artifact_publish call declares its publication-specific source_selection_refs explicitly from prior artifact_select results in the same physical Turn, so multiple publications cannot contaminate one another. The Host resolves these short references to the persisted complete canonical locators; never reconstruct snapshot IDs, paths, byte counts, or digests. Core-owned typed projections such as Intent, RequirementSet, ContractGraph, and Goal projection are selected by kind, artifact type, label, Goal, and time; projected-Agent producer filters do not match those Core publication facts. Missing selected references, foreign-Task locators, corrupt manifests or bytes, wrong paths, digest mismatches, and invalid text are explicit evidence errors and must remain visible. Artifact tools expose facts only: they do not dispatch, retry, accept, or complete Goals.",
            "</task_artifact_catalog>",
          ].join("\n")
        : undefined
    const installedPackageBoundary = [
      "<installed_expert_squad_package_boundary>",
      "Project-installed Expert Squad directories under .opencorvus/expert-squads are immutable runtime dependencies, not Task deliverable directories. Read their prompts, Skills, references, examples, assets, and tools as package inputs. Write generated domain deliverables to ordinary project output paths outside the installed package tree. A request to populate or complete a package-provided template authorizes a copied deliverable, not an in-place package edit. Only a Task that explicitly authorizes Expert Squad package authoring or evolution may modify a package, and it must use the exact authoring workspace and publication contract supplied by that Task.",
      "</installed_expert_squad_package_boundary>",
    ].join("\n")
    const schedulerSnapshotProtocol =
      "scheduler" in input.capability && input.capability.builtInToolIDs.includes("artifact_snapshot")
        ? [
            "<task_input_snapshot_authority>",
            "You own the read-only Task input evidence boundary. Before dispatching workflow workers that require current-project files, call artifact_snapshot with the complete exact input file set, then use each returned resource artifact_locator_ref to read the exact resource completely and pass its artifact_read_ref to artifact_select. Never reconstruct snapshot IDs, paths, byte counts, or digests. artifact_snapshot does not edit project files or publish a domain conclusion. Workers remain the only owners of generic artifact_publish and typed domain outputs.",
            "</task_input_snapshot_authority>",
          ].join("\n")
        : undefined
    return [
      projectedIdentity,
      input.base,
      installedPackageBoundary,
      artifactCatalogProtocol,
      schedulerSnapshotProtocol,
      readme,
      virtualWorkflows,
      input.capability.promptOverlay,
      input.userAppend,
    ]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n\n")
  }

  export async function assertKnownProfileID(input: ProfileIDInput): Promise<void> {
    PromptProfileIDSchema.parse(input.profileID)
    if (Object.hasOwn(builtInPackages(), input.profileID)) {
      let collision = false
      if (input.scope === "global") {
        const discovered = await ExpertSquadRegistry.discoverGlobalAvailable()
        collision =
          discovered.items.some((entry) => entry.id === input.profileID) ||
          discovered.issues.some((entry) => entry.id === input.profileID)
      } else if (input.projectDirectory) {
        const discovered = await ExpertSquadRegistry.discoverAvailable(input.projectDirectory)
        collision =
          discovered.installations.some((entry) => entry.id === input.profileID) ||
          discovered.issues.some((entry) => entry.id === input.profileID)
      }
      if (collision) {
        throw new Error(
          `External expert squad package id ${JSON.stringify(input.profileID)} collides with a built-in expert squad id.`,
        )
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
    throw new PromptProfileNotFoundError({
      message: `Unknown prompt profile ${JSON.stringify(input.profileID)}`,
      profileID: input.profileID,
      scope: input.scope ?? "project",
    })
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
    const activeCapabilityRefs = (capability: ResolvedWorkerCapability) =>
      canonicalStringSet(
        [
          ...harnessRefs("tool", "platform", "tool-registry", capability.builtInToolIDs),
          ...harnessRefs(
            "tool",
            "platform",
            "default-tool-registry",
            capability.defaultTools.map((entry) => entry.ref),
          ),
          ...harnessRefs(
            "tool",
            "package",
            capability.expertSquadID,
            capability.packageTools.map((entry) => entry.ref),
          ),
          ...capability.productionSkills.map((grant) =>
            capabilityRef({
              kind: "skill",
              source: grant.source === "package" ? "package" : "platform",
              owner_ref: grant.source === "package" ? capability.expertSquadID : "skill-manager",
              local_ref: grant.ref,
            }),
          ),
          ...harnessRefs("mcp_server", "project", "default-mcp-registry", capability.grants.defaultMcpServerRefs),
          ...harnessRefs("mcp_server", "package", capability.expertSquadID, capability.grants.packageMcpServerRefs),
          ...harnessRefs(
            "mcp_tool",
            "project",
            "default-mcp-registry",
            capability.defaultMcpTools.map((entry) => entry.ref),
          ),
          ...harnessRefs(
            "mcp_tool",
            "package",
            capability.expertSquadID,
            capability.packageMcpTools.map((entry) => entry.ref),
          ),
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
        ].map(CapabilityRefCodec.encode),
        `${capability.identity.agentID}.capabilityRefs`,
      )
    const agents = input.capabilitySet.workers.map((capability) => {
      return {
        agent_id: capability.identity.agentID,
        base_role: capability.identity.baseRole,
        session_kind: capability.identity.sessionKind,
        dispatch_adapter_id: capability.identity.dispatchAdapterID,
        label: capability.projection.label,
        ...(capability.projection.description ? { description: capability.projection.description } : {}),
        projection_hash: capability.identity.projectionHash,
        capability_refs: activeCapabilityRefs(capability),
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

  async function buildCatalogInventory(projectDirectory?: string) {
    const [external, builtInPackagesByID] = await Promise.all([
      externalCatalogPackages(projectDirectory),
      Promise.resolve(builtInPackages()),
    ])
    const projectPackagesByID = external.packages
    const effectiveRows = [
      ...Object.values(builtInPackagesByID).map((pkg) => ({ pkg, builtIn: true as const })),
      ...Object.values(projectPackagesByID).map((pkg) => ({ pkg, builtIn: false as const })),
    ].map((row) => ({
      ...row,
      index: catalogIndexFromPackage(row),
    }))
    const installationRows = [
      ...Object.values(builtInPackagesByID).map((pkg) => ({ pkg, builtIn: true as const })),
      ...[...external.installations]
        .sort((left, right) => {
          if (left.installationScope === right.installationScope) return left.id.localeCompare(right.id)
          return left.installationScope === "project" ? -1 : 1
        })
        .map((pkg) => ({ pkg, builtIn: false as const })),
    ].map((row) => ({
      ...row,
      index: catalogIndexFromPackage(row),
    }))
    const declarationRevision = (row: (typeof installationRows)[number]) =>
      createHash("sha256")
        .update(JSON.stringify({ version: row.pkg.version, manifest: row.pkg.manifest }))
        .digest("hex")
    const revision = createHash("sha256")
      .update(
        JSON.stringify({
          effective: effectiveRows.map((row) => ({ index: row.index, declaration: declarationRevision(row) })),
          installations: installationRows.map((row) => ({ index: row.index, declaration: declarationRevision(row) })),
          issues: external.issues,
          warnings: external.warnings,
        }),
      )
      .digest("hex")
    return {
      projectPackagesByID,
      builtInPackagesByID,
      externalInstallations: external.installations,
      effectiveRows,
      installationRows,
      squads: effectiveRows.map((row) => row.index),
      installations: installationRows.map((row) => row.index),
      revision,
      issues: external.issues,
      warnings: external.warnings,
    }
  }

  type CatalogInventory = Awaited<ReturnType<typeof buildCatalogInventory>>
  const catalogInventoryCache = new Map<string, { generation: number; inventory: Promise<CatalogInventory> }>()

  async function catalogInventory(projectDirectory?: string): Promise<CatalogInventory> {
    const generation = ExpertSquadRegistry.catalogInventoryGeneration()
    const key = projectDirectory ? path.resolve(projectDirectory) : "<global>"
    const active = catalogInventoryCache.get(key)
    if (active?.generation === generation) return active.inventory
    const inventory = buildCatalogInventory(projectDirectory)
    catalogInventoryCache.delete(key)
    catalogInventoryCache.set(key, { generation, inventory })
    if (catalogInventoryCache.size > 64) catalogInventoryCache.delete(catalogInventoryCache.keys().next().value!)
    try {
      return await inventory
    } catch (error) {
      if (catalogInventoryCache.get(key)?.inventory === inventory) catalogInventoryCache.delete(key)
      throw error
    }
  }

  const CatalogCursorSchema = z
    .object({ revision: z.string(), query_fingerprint: z.string(), offset: z.number().int().nonnegative() })
    .strict()

  function encodeCatalogCursor(revision: string, queryFingerprint: string, offset: number): string {
    return Buffer.from(JSON.stringify({ revision, query_fingerprint: queryFingerprint, offset }), "utf8").toString(
      "base64url",
    )
  }

  function decodeCatalogCursor(cursor: string, revision: string, queryFingerprint: string): number {
    let parsed: z.output<typeof CatalogCursorSchema>
    try {
      parsed = CatalogCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")))
    } catch {
      throw new Error("Expert Squad catalog cursor is invalid.")
    }
    if (parsed.revision !== revision) {
      throw new Error(`Expert Squad catalog cursor is stale: expected ${revision}, received ${parsed.revision}.`)
    }
    if (parsed.query_fingerprint !== queryFingerprint) {
      throw new Error("Expert Squad catalog cursor belongs to a different bounded query.")
    }
    return parsed.offset
  }

  function catalogQueryFingerprint(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex")
  }

  function catalogRowKey(entry: ExpertSquadCatalogIndexEntry): string {
    return entry.source.kind === "built_in"
      ? `built_in:${entry.id}`
      : `${entry.source.installation_scope}:${entry.source.namespace}:${entry.id}`
  }

  // Installed packages keep their English source bytes, so discovery has to reach the same reviewed
  // localized projection the market search uses. Otherwise a request that finds a Squad in the market
  // stops finding it the moment that Squad is installed.
  function catalogLocalizedSearchFields(entry: ExpertSquadCatalogIndexEntry): DiscoverySearchField[] {
    const namespace = entry.source.kind === "built_in" ? BUILTIN_EXPERT_SQUAD_NAMESPACE : entry.source.namespace
    const localization = expertSquadSearchLocalizations[`${namespace}/${entry.id}`]
    if (!localization) return []
    return [
      ...localization.primary.map((text) => ({ text, weight: 0.94 })),
      ...localization.detail.map((text) => ({ text, weight: 0.8 })),
    ]
  }

  export async function searchCatalog(input: {
    projectDirectory?: string
    view?: "effective" | "installations"
    query?: string
    productPillar?: "code" | "work"
    restrictToExpertSquadIDs?: readonly string[]
    cursor?: string
    limit?: number
  }): Promise<ExpertSquadCatalogPage> {
    const inventory = await catalogInventory(input.projectDirectory)
    const sourceRows = input.view === "installations" ? inventory.installationRows : inventory.effectiveRows
    const restrictedIDs = input.restrictToExpertSquadIDs
      ? new Set([...new Set(input.restrictToExpertSquadIDs)])
      : undefined
    const query = input.query?.trim() ?? ""
    const queryFingerprint = catalogQueryFingerprint({
      kind: "catalog_search",
      view: input.view ?? "effective",
      query: query.toLowerCase(),
      product_pillar: input.productPillar ?? null,
      restricted_ids: restrictedIDs ? [...restrictedIDs].sort(compareCanonicalStrings) : null,
    })
    const rankedCacheKey = `${inventory.revision}:${queryFingerprint}`
    let ranked = rankedCatalogSearches.get(rankedCacheKey)
    if (!ranked) {
      ranked = sourceRows
        .filter((row) => !restrictedIDs || restrictedIDs.has(row.index.id))
        .filter((row) => !input.productPillar || row.index.product_pillars.includes(input.productPillar))
        .flatMap((row) => {
          if (!query) return [{ index: row.index, score: null as number | null }]
          const score = scoreDiscoveryFields(query, [
            { text: row.index.id, weight: 1 },
            { text: row.index.name, weight: 1 },
            { text: row.index.display_label, weight: 0.96 },
            { text: row.index.description ?? "", weight: 0.9 },
            ...catalogLocalizedSearchFields(row.index),
          ])
          return score === undefined ? [] : [{ index: row.index, score }]
        })
        .sort((left, right) => {
          if (left.score !== right.score) {
            if (left.score === null) return -1
            if (right.score === null) return 1
            return right.score - left.score
          }
          return catalogRowKey(left.index).localeCompare(catalogRowKey(right.index))
        })
        .map(({ index }) => index)
      rankedCatalogSearches.set(rankedCacheKey, ranked)
      if (rankedCatalogSearches.size > 128) rankedCatalogSearches.delete(rankedCatalogSearches.keys().next().value!)
    }
    const limit = z
      .number()
      .int()
      .min(1)
      .max(20)
      .parse(input.limit ?? 20)
    const offset = input.cursor ? decodeCatalogCursor(input.cursor, inventory.revision, queryFingerprint) : 0
    const pageRows = ranked.slice(offset, offset + limit)
    const nextOffset = offset + pageRows.length
    return ExpertSquadCatalogPageSchema.parse({
      catalog_revision: inventory.revision,
      entries: pageRows,
      next_cursor:
        nextOffset < ranked.length ? encodeCatalogCursor(inventory.revision, queryFingerprint, nextOffset) : null,
      total_count: ranked.length,
    })
  }

  const rankedCatalogSearches = new Map<string, ExpertSquadCatalogIndexEntry[]>()
  const catalogWorkflowSummaries = new Map<string, ExpertSquadCatalogInspection["workflows"]>()
  const catalogDiagnosticEntries = new Map<string, ExpertSquadDiagnosticPage["entries"]>()

  export const MissionVisibleExpertSquadCatalogError = NamedError.create(
    "MissionVisibleExpertSquadCatalogError",
    z.object({
      message: z.string(),
      code: z.literal("MISSION_VISIBLE_EXPERT_SQUAD_CATALOG_UNAVAILABLE"),
      heldCount: z.number().int().positive(),
      unknownCount: z.number().int().nonnegative(),
      incompatibleCount: z.number().int().nonnegative(),
      heldSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
      catalogRevision: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )

  /** Complete owner-published index. Caller product-pillar and held-set
   * filtering belongs to the runtime catalog projection, not this revision. */
  export async function catalogIndexSnapshot(projectDirectory: string): Promise<{
    revision: string
    entries: readonly ExpertSquadCatalogIndexEntry[]
  }> {
    const { effectiveRows, revision } = await catalogInventory(projectDirectory)
    return Object.freeze({
      revision,
      entries: Object.freeze(effectiveRows.map((row) => ExpertSquadCatalogIndexEntrySchema.parse(row.index))),
    })
  }

  export async function recommendationCatalogSnapshot(input: {
    projectDirectory: string
    productPillar: "code" | "work"
    restrictToExpertSquadIDs?: readonly string[]
  }): Promise<{ revision: string; entries: readonly ExpertSquadCatalogIndexEntry[] }> {
    const restrictedIDs = input.restrictToExpertSquadIDs ? [...new Set(input.restrictToExpertSquadIDs)] : undefined
    const { entries, revision } = await catalogIndexSnapshot(input.projectDirectory)
    const byID = new Map(entries.map((entry) => [entry.id, entry]))
    const unknown = (restrictedIDs ?? []).filter((id) => !byID.has(id))
    const requested =
      restrictedIDs === undefined
        ? [...byID.values()]
        : restrictedIDs.flatMap((id) => {
            const squad = byID.get(id)
            return squad ? [squad] : []
          })
    const incompatible = requested.filter((squad) => !squad.product_pillars.includes(input.productPillar))
    if (restrictedIDs !== undefined && (unknown.length > 0 || incompatible.length > 0)) {
      const heldSnapshotHash = createHash("sha256")
        .update(JSON.stringify([...restrictedIDs].sort(compareCanonicalStrings)))
        .digest("hex")
      throw new MissionVisibleExpertSquadCatalogError({
        message: "The immutable Mission-visible Expert Squad catalog is unavailable.",
        code: "MISSION_VISIBLE_EXPERT_SQUAD_CATALOG_UNAVAILABLE",
        heldCount: restrictedIDs.length,
        unknownCount: unknown.length,
        incompatibleCount: incompatible.length,
        heldSnapshotHash,
        catalogRevision: revision,
      })
    }
    const selected = requested.filter((squad) => squad.product_pillars.includes(input.productPillar))
    return Object.freeze({
      revision,
      entries: Object.freeze(selected.map((squad) => ExpertSquadCatalogIndexEntrySchema.parse(squad))),
    })
  }

  export async function recommendationCatalog(input: {
    projectDirectory: string
    productPillar: "code" | "work"
    restrictToExpertSquadIDs?: readonly string[]
  }): Promise<ExpertSquadCatalogIndexEntry[]> {
    return [...(await recommendationCatalogSnapshot(input)).entries]
  }

  export async function catalogInspection(input: {
    projectDirectory?: string
    id: string
    installationScope?: "built_in" | "project" | "global"
    namespace?: string
    workflowCursor?: string
  }): Promise<ExpertSquadCatalogInspection | undefined> {
    if (input.installationScope && input.installationScope !== "built_in" && !input.namespace) {
      throw new Error("Installed expert squad inspection requires namespace.")
    }
    const inventory = await catalogInventory(input.projectDirectory)
    const rows = input.installationScope ? inventory.installationRows : inventory.effectiveRows
    const row = rows.find((row) => {
      if (row.index.id !== input.id) return false
      if (!input.installationScope) return true
      if (input.installationScope === "built_in") return row.index.source.kind === "built_in"
      return (
        row.index.source.kind === "installed_package" &&
        row.index.source.installation_scope === input.installationScope &&
        (!input.namespace || row.index.source.namespace === input.namespace)
      )
    })
    if (!row) return undefined
    const workflowCount = Object.keys(row.pkg.manifest.capability_projection.virtual_workflows).length
    const queryFingerprint = catalogQueryFingerprint({
      kind: "workflow_inspection",
      identity: catalogRowKey(row.index),
    })
    const offset = input.workflowCursor
      ? decodeCatalogCursor(input.workflowCursor, inventory.revision, queryFingerprint)
      : 0
    const workflowCacheKey = `${inventory.revision}:${catalogRowKey(row.index)}`
    let workflows = catalogWorkflowSummaries.get(workflowCacheKey)
    if (!workflows) {
      workflows = Object.entries(row.pkg.manifest.capability_projection.virtual_workflows)
        .sort(([left], [right]) => compareCanonicalStrings(left, right))
        .map(([id, workflow]) => ({
          id,
          label: workflow.label.slice(0, 240),
          description: workflow.description.slice(0, 500),
          node_count: Object.keys(workflow.nodes).length,
        }))
      catalogWorkflowSummaries.set(workflowCacheKey, workflows)
      if (catalogWorkflowSummaries.size > 64)
        catalogWorkflowSummaries.delete(catalogWorkflowSummaries.keys().next().value!)
    }
    const nextOffset = Math.min(offset + 20, workflowCount)
    return catalogInspectionFromPackage({
      pkg: row.pkg,
      builtIn: row.builtIn,
      workflows: workflows.slice(offset, offset + 20),
      workflowCount,
      nextWorkflowCursor:
        nextOffset < workflowCount ? encodeCatalogCursor(inventory.revision, queryFingerprint, nextOffset) : null,
    })
  }

  export async function settingsInventory(projectDirectory?: string) {
    const inventory = await catalogInventory(projectDirectory)
    return ExpertSquadInventoryStatusSchema.parse({
      catalog_revision: inventory.revision,
      effective_count: inventory.squads.length,
      installation_count: inventory.installations.length,
      issue_count: inventory.issues.length,
      warning_count: inventory.warnings.length,
    })
  }

  export async function catalogDiagnostics(input: {
    projectDirectory?: string
    cursor?: string
    limit?: number
  }): Promise<ExpertSquadDiagnosticPage> {
    const inventory = await catalogInventory(input.projectDirectory)
    let entries = catalogDiagnosticEntries.get(inventory.revision)
    if (!entries) {
      entries = [
        ...inventory.issues.map((issue) => ({ kind: "issue" as const, issue })),
        ...inventory.warnings.map((warning) => ({ kind: "warning" as const, warning })),
      ]
      catalogDiagnosticEntries.set(inventory.revision, entries)
      if (catalogDiagnosticEntries.size > 64) {
        catalogDiagnosticEntries.delete(catalogDiagnosticEntries.keys().next().value!)
      }
    }
    const queryFingerprint = catalogQueryFingerprint({ kind: "catalog_diagnostics" })
    const offset = input.cursor ? decodeCatalogCursor(input.cursor, inventory.revision, queryFingerprint) : 0
    const limit = z
      .number()
      .int()
      .min(1)
      .max(20)
      .parse(input.limit ?? 20)
    const page = entries.slice(offset, offset + limit)
    const nextOffset = offset + page.length
    return ExpertSquadDiagnosticPageSchema.parse({
      catalog_revision: inventory.revision,
      entries: page,
      next_cursor:
        nextOffset < entries.length ? encodeCatalogCursor(inventory.revision, queryFingerprint, nextOffset) : null,
      total_count: entries.length,
    })
  }

  export async function settingsDetail(input: {
    projectDirectory: string
    id: string
    installationScope: "built_in" | "project" | "global"
    namespace?: string
  }): Promise<ExpertSquadCatalogSummary | undefined> {
    if (input.installationScope === "built_in") {
      const pkg = builtInPackages()[input.id]
      return pkg ? catalogSummaryFromPackage({ pkg, builtIn: true }) : undefined
    }
    if (!input.namespace) throw new Error("Installed expert squad settings detail requires namespace.")
    const loaded = await ExpertSquadRegistry.loadInstalledCatalogPackage({
      projectDirectory: input.projectDirectory,
      installationScope: input.installationScope,
      namespace: input.namespace,
      id: input.id,
    })
    if (!loaded) return undefined
    const pkg = {
      ...loaded,
      installationScope: input.installationScope,
    }
    return catalogSummaryFromPackage({ pkg, builtIn: false })
  }

  export async function catalog(input: ExpertSquadCatalogInput): Promise<ExpertSquadCatalog> {
    const projectDirectory = input.scope.directory
    const [inventory, defaultSkills] = await Promise.all([
      catalogInventory(projectDirectory),
      input.defaultSkills === undefined
        ? Instance.provide({ directory: projectDirectory, fn: () => Skill.all() })
        : Promise.resolve(input.defaultSkills),
    ])
    const activePackage = await packageForActiveProfile({
      projectDirectory,
      config: input.config,
      defaultSkills,
      packageRevision: input.packageRevision,
    })
    const active = activePackage.profileID
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
    const skillProjection = await resolveSkillProjectionForContext({
      context,
      config: input.config,
      projectDirectory,
      projectSelectorPackages: Object.values(inventory.projectPackagesByID).map((pkg) => ({ pkg })),
      capabilitySet: activeCapabilitySet,
    })
    const packageRevision = resolvedPackageRevision(context)
    return ExpertSquadCatalogSchema.parse({
      active: {
        effective: active,
        project: input.projectActive,
        session_override: input.sessionOverride,
        package_revision: {
          scope: packageRevision.scope,
          project_id: packageRevision.projectID,
          namespace: packageRevision.namespace,
          id: packageRevision.id,
          version: packageRevision.version,
          package_digest: packageRevision.packageDigest,
        },
      },
      default: DEFAULT_PROMPT_PROFILE_ID,
      scope: input.scope,
      launch_catalog_revision: inventory.revision,
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
