import type { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { ConversationCapability } from "@/conversation/capability"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { missionVisibleExpertSquadIDs, requireMissionSession } from "@/mission/session"
import { MissionSkillCatalog } from "@/mission-skill/catalog"
import { MCP } from "@/mcp"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { isProjectedWorkerRuntimeContract, SessionRuntimeContractStore } from "@/session/runtime-contract"
import { SkillManager } from "@/skill/manager"
import { ToolCapabilityInventory } from "@/tool/capability-inventory"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { CapabilityCatalogCache, type CapabilityCatalogSnapshot } from "@/capability/catalog"
import {
  createCapabilityCatalogProjection,
  createCapabilityCatalogSource,
  createCapabilityCatalogViewEntry,
  createCapabilityDescriptor,
  type CapabilityAvailability,
  type CapabilityBehavior,
  type CapabilityCaller,
  type CapabilityCatalogProjection,
  type CapabilityCatalogSource,
  type CapabilityCatalogViewEntry,
  type CapabilityDescriptor,
  type CapabilityNextOwner,
  type CapabilitySetDescriptor,
} from "@/capability/descriptor"
import { capabilityRef, CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"
import type { HarnessProjection } from "@/capability/harness-projection"
import { resolveCapabilityCaller } from "@/capability/caller-authority"
import { Session } from "@/session"

export class CapabilityOwnerUnavailableError extends Error {
  override readonly name = "CapabilityOwnerUnavailableError"

  constructor(
    public readonly ownerRef: string,
    public readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(`Capability owner ${ownerRef} is unavailable: ${reason}`, options)
  }
}

function titleFromID(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

async function readOwner<T>(ownerRef: string, read: () => T | Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (error instanceof CapabilityOwnerUnavailableError) throw error
    throw new CapabilityOwnerUnavailableError(ownerRef, error instanceof Error ? error.message : String(error), {
      cause: error,
    })
  }
}

function descriptor(input: Parameters<typeof createCapabilityDescriptor>[0]): CapabilityDescriptor {
  return createCapabilityDescriptor(input)
}

function view(input: {
  descriptor: CapabilityDescriptor
  caller: CapabilityCaller
  availability: CapabilityAvailability
  nextOwner?: CapabilityNextOwner
}): CapabilityCatalogViewEntry {
  return createCapabilityCatalogViewEntry({
    descriptor_ref: input.descriptor.ref,
    descriptor_digest: input.descriptor.metadata_digest,
    discoverable_by: [input.caller],
    availability: input.availability,
    next_owner: input.nextOwner ?? modelNextOwner(input.descriptor.behavior),
  })
}

function platformToolRef(toolID: string): CapabilityRef {
  return capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: toolID })
}

function modelNextOwner(behavior: CapabilityBehavior): CapabilityNextOwner {
  switch (behavior.kind) {
    case "call_tool":
      return { kind: "call_tool", tool_id: behavior.tool_ref.local_ref }
    case "open_skill":
    case "open_mission_skill":
      return { kind: "load_skill", name: behavior.name }
    case "create_task":
      return { kind: "create_task_with_expert_squad", profile_id: behavior.profile_id }
    case "inspect_mcp":
      return { kind: "open_settings", target: `mcp.${behavior.server_ref.local_ref}` }
    case "manage":
      return { kind: "open_settings", target: behavior.action_tool_ref.local_ref }
    case "open_mcp_prompt":
    case "open_mcp_resource":
      return { kind: "unavailable", reason: `Use exact ${behavior.kind} action owner.` }
    case "unavailable":
      return { kind: "unavailable", reason: behavior.reason_code }
  }
}

type PublicationDraft = {
  ownerRevision: string
  descriptors: CapabilityDescriptor[]
  views: CapabilityCatalogViewEntry[]
  sets: CapabilitySetDescriptor[]
}

function addPublication(
  publications: Map<string, PublicationDraft>,
  input: {
    ownerRef: string
    ownerRevision: string
    descriptors: readonly CapabilityDescriptor[]
    views: readonly CapabilityCatalogViewEntry[]
    sets?: readonly CapabilitySetDescriptor[]
  },
): void {
  const current = publications.get(input.ownerRef)
  if (current) {
    if (current.ownerRevision !== input.ownerRevision) {
      throw new CapabilityOwnerUnavailableError(
        input.ownerRef,
        `Owner published conflicting revisions ${current.ownerRevision} and ${input.ownerRevision}.`,
      )
    }
    current.descriptors.push(...input.descriptors)
    current.views.push(...input.views)
    current.sets.push(...(input.sets ?? []))
    return
  }
  publications.set(input.ownerRef, {
    ownerRevision: input.ownerRevision,
    descriptors: [...input.descriptors],
    views: [...input.views],
    sets: [...(input.sets ?? [])],
  })
}

function addPublicationsByOwner(
  publications: Map<string, PublicationDraft>,
  input: {
    ownerRevision: string
    descriptors: readonly CapabilityDescriptor[]
    views: readonly CapabilityCatalogViewEntry[]
  },
): void {
  const descriptorsByOwner = new Map<string, CapabilityDescriptor[]>()
  const viewsByOwner = new Map<string, CapabilityCatalogViewEntry[]>()
  for (const item of input.descriptors) {
    const owned = descriptorsByOwner.get(item.ref.owner_ref) ?? []
    owned.push(item)
    descriptorsByOwner.set(item.ref.owner_ref, owned)
  }
  for (const item of input.views) {
    const owned = viewsByOwner.get(item.descriptor_ref.owner_ref) ?? []
    owned.push(item)
    viewsByOwner.set(item.descriptor_ref.owner_ref, owned)
  }
  for (const [ownerRef, descriptors] of descriptorsByOwner) {
    addPublication(publications, {
      ownerRef,
      ownerRevision: input.ownerRevision,
      descriptors,
      views: viewsByOwner.get(ownerRef) ?? [],
    })
  }
}

function projectionRevision(ownerRef: string, entries: readonly CapabilityCatalogViewEntry[]): string {
  return canonicalDigestSource("capability-owner-context-projection-v2", {
    owner_ref: ownerRef,
    entries: [...entries].sort((left, right) =>
      compareCanonicalStrings(
        CapabilityRefCodec.encode(left.descriptor_ref),
        CapabilityRefCodec.encode(right.descriptor_ref),
      ),
    ),
  }).sha256
}

function materializePublications(publications: ReadonlyMap<string, PublicationDraft>): {
  sources: CapabilityCatalogSource[]
  projections: CapabilityCatalogProjection[]
} {
  const sources: CapabilityCatalogSource[] = []
  const projections: CapabilityCatalogProjection[] = []
  for (const [ownerRef, publication] of [...publications.entries()].sort(([left], [right]) =>
    compareCanonicalStrings(left, right),
  )) {
    sources.push(
      createCapabilityCatalogSource({
        owner_ref: ownerRef,
        owner_revision: publication.ownerRevision,
        descriptors: publication.descriptors,
        sets: publication.sets,
      }),
    )
    projections.push(
      createCapabilityCatalogProjection({
        owner_ref: ownerRef,
        projection_revision: projectionRevision(ownerRef, publication.views),
        entries: publication.views,
      }),
    )
  }
  return { sources, projections }
}

function toolDescriptor(input: {
  toolID: string
  ownerRef: string
  source?: "platform" | "project" | "package"
  description?: string
}): CapabilityDescriptor {
  const title = titleFromID(input.toolID)
  const ref = capabilityRef({
    kind: "tool",
    source: input.source ?? "platform",
    owner_ref: input.ownerRef,
    local_ref: input.toolID,
  })
  return descriptor({
    ref,
    name: input.toolID,
    description: input.description ?? `${title} is available from ${input.ownerRef}.`,
    aliases: [title],
    search_terms: [input.toolID, title],
    behavior: { kind: "call_tool", tool_ref: ref },
  })
}

function descriptorForProjectedRef(
  ref: CapabilityRef,
  details?: { name?: string; description?: string },
): CapabilityDescriptor {
  const name = details?.name ?? ref.local_ref
  const description = details?.description ?? `Projected ${ref.kind.replaceAll("_", " ")} ${ref.local_ref}.`
  if (ref.kind === "skill" || ref.kind === "mission_skill") {
    return descriptor({
      ref,
      name,
      description,
      aliases: [],
      search_terms: [],
      behavior:
        ref.kind === "mission_skill"
          ? { kind: "open_mission_skill", loader_tool_ref: platformToolRef("mission_skill"), name }
          : { kind: "open_skill", loader_tool_ref: platformToolRef("skill"), name },
    })
  }
  if (ref.kind === "tool" || ref.kind === "mcp_tool") {
    return descriptor({
      ref,
      name,
      description,
      aliases: [titleFromID(ref.local_ref)],
      search_terms: [ref.local_ref, ...(ref.kind === "mcp_tool" ? ["MCP"] : [])],
      behavior: { kind: "call_tool", tool_ref: ref },
    })
  }
  if (ref.kind === "mcp_server") {
    return descriptor({
      ref,
      name,
      description,
      aliases: [],
      search_terms: ["MCP", "Model Context Protocol"],
      behavior: { kind: "unavailable", reason_code: "mcp_server_requires_context_owner" },
    })
  }
  return descriptor({
    ref,
    name,
    description,
    aliases: [],
    search_terms: [`MCP ${ref.kind === "mcp_prompt" ? "prompt" : "resource"}`],
    behavior: { kind: "unavailable", reason_code: `${ref.kind}_requires_exact_owner` },
  })
}

function mcpAvailability(status: MCP.Status | undefined, assigned: boolean): CapabilityAvailability {
  if (status?.status === "needs_auth" || status?.status === "needs_client_registration") return "requires_auth"
  if (status?.status === "disabled" || status?.status === "failed") return "unavailable"
  return assigned ? "visible" : "installed_unbound"
}

function scopedMcpAvailability(status: MCP.Status | undefined): CapabilityAvailability {
  if (status?.status === "needs_auth" || status?.status === "needs_client_registration") return "requires_auth"
  if (status?.status === "connected" || status?.status === "connecting") return "visible"
  return "unavailable"
}

type RuntimeInput = {
  config: Config.Info
  sessionID: string
  agentID: string
  executionToolIDs: readonly string[]
  harnessProjection?: HarnessProjection
}

async function buildRuntimeSnapshot(input: RuntimeInput): Promise<{
  caller: CapabilityCaller
  snapshot: CapabilityCatalogSnapshot
}> {
  const contract = SessionRuntimeContractStore.get(input.sessionID)
  const session = await Session.get(input.sessionID)
  const caller = resolveCapabilityCaller({
    sessionKind: session.kind,
    agentID: input.agentID,
    runtimeIdentityKind: contract?.identity.identityKind,
  })
  const harnessProjection = input.harnessProjection ?? contract?.harnessProjection
  const publications = new Map<string, PublicationDraft>()
  const toolInventory = await readOwner("tool-registry", () => ToolCapabilityInventory.snapshot())
  const platformDescriptors = toolInventory.toolIDs.map((toolID) =>
    toolDescriptor({ toolID, ownerRef: "tool-registry" }),
  )
  const platformByID = new Map(platformDescriptors.map((entry) => [entry.ref.local_ref, entry]))
  const platformToolIDs = harnessProjection
    ? new Set(
        harnessProjection.tool_refs.filter((ref) => ref.owner_ref === "tool-registry").map((ref) => ref.local_ref),
      )
    : new Set(input.executionToolIDs)
  const visiblePlatformDescriptors = [...new Set(input.executionToolIDs)]
    .filter((toolID) => platformToolIDs.has(toolID) && platformByID.has(toolID))
    .sort(compareCanonicalStrings)
    .map((toolID) => platformByID.get(toolID)!)
  addPublication(publications, {
    ownerRef: "tool-registry",
    ownerRevision: toolInventory.revision,
    descriptors: platformDescriptors,
    views: visiblePlatformDescriptors.map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
    sets: toolInventory.sets,
  })

  const directlyProjectedMcpToolDescriptors =
    !contract && harnessProjection ? harnessProjection.mcp_tool_refs.map((ref) => descriptorForProjectedRef(ref)) : []

  if (contract) {
    const identity = contract.identity
    const owner =
      identity.identityKind === "projected-scheduler"
        ? contract.skillProjection.projectedScheduler
        : [...contract.skillProjection.schedulerOnlyAgents, ...contract.skillProjection.projectedAgents].find(
            (candidate) => candidate.identity.agentID === identity.agentID,
          )
    if (!owner) {
      throw new CapabilityOwnerUnavailableError(
        `runtime-projection:${identity.agentID}`,
        `Agent ${identity.agentID} is absent from its Skill projection.`,
      )
    }
    const skillByRef = new Map(
      contract.skillProjection.productionSkills
        .filter((grant) => grant.agentIDs.includes(identity.agentID))
        .map((grant) => [grant.ref, grant.skill]),
    )
    const projected = contract.harnessProjection
    const visibleToolIDs = new Set(input.executionToolIDs)
    const scopedRefs = [
      ...projected.mcp_server_refs,
      ...projected.mcp_tool_refs,
      ...projected.mcp_prompt_refs,
      ...projected.mcp_resource_refs,
    ]
    const scopedCatalog =
      scopedRefs.length > 0
        ? await readOwner(`scoped-mcp:${identity.agentID}`, () => {
            if (!contract.resources?.mcp) {
              throw new Error(`Projected runtime ${identity.agentID} has MCP refs without a scoped connection owner.`)
            }
            return contract.resources.mcp.catalogSnapshot()
          })
        : undefined
    if (scopedCatalog) {
      addPublication(publications, {
        ownerRef: `scoped-mcp:${scopedCatalog.owner_id}`,
        ownerRevision: scopedCatalog.owner_revision,
        descriptors: [],
        views: [],
      })
    }
    const scopedStatusByServer = new Map(scopedCatalog?.entries.map((entry) => [entry.server_id, entry.status]) ?? [])

    const taskDescriptors: CapabilityDescriptor[] = [
      ...projected.tool_refs
        .filter((ref) => ref.owner_ref !== "tool-registry")
        .map((ref) =>
          descriptorForProjectedRef(ref, {
            description: `${titleFromID(ref.local_ref)} is published by ${identity.expertSquadID}.`,
          }),
        ),
      ...projected.skill_refs.map((ref) => {
        const skill = skillByRef.get(ref.local_ref)
        return descriptor({
          ref,
          name: skill?.name ?? ref.local_ref,
          description: skill?.description ?? `Projected Skill ${ref.local_ref}.`,
          aliases: skill?.aliases ?? [],
          search_terms: skill?.required_tools ?? [],
          behavior: {
            kind: "open_skill",
            loader_tool_ref: platformToolRef("skill"),
            name: skill?.name ?? ref.local_ref,
          },
        })
      }),
      ...projected.mcp_server_refs.map((ref) => descriptorForProjectedRef(ref)),
      ...projected.mcp_tool_refs.map((ref) => descriptorForProjectedRef(ref)),
      ...projected.mcp_prompt_refs.map((ref) => descriptorForProjectedRef(ref)),
      ...projected.mcp_resource_refs.map((ref) => descriptorForProjectedRef(ref)),
    ]
    const taskViews = taskDescriptors
      .map((entry) => {
        if ((entry.ref.kind === "tool" || entry.ref.kind === "mcp_tool") && !visibleToolIDs.has(entry.ref.local_ref)) {
          return undefined
        }
        if (!entry.ref.kind.startsWith("mcp_")) {
          return view({ descriptor: entry, caller, availability: "visible" })
        }
        const availability = scopedMcpAvailability(scopedStatusByServer.get(entry.ref.local_ref))
        return view({
          descriptor: entry,
          caller,
          availability,
          nextOwner:
            availability === "visible"
              ? undefined
              : {
                  kind: "unavailable",
                  reason:
                    availability === "requires_auth"
                      ? `Scoped MCP capability ${entry.ref.local_ref} requires authentication.`
                      : `Scoped MCP capability ${entry.ref.local_ref} is unavailable.`,
                },
        })
      })
      .filter((entry): entry is CapabilityCatalogViewEntry => entry !== undefined)
    addPublicationsByOwner(publications, {
      ownerRevision: projected.owner_revision,
      descriptors: taskDescriptors,
      views: taskViews,
    })

    if (isProjectedWorkerRuntimeContract(contract)) {
      const stageToolIDs = Object.keys(contract.stageTools).sort(compareCanonicalStrings)
      if (stageToolIDs.length > 0) {
        const ownerRef = `dispatch-stage:${contract.identity.dispatchAdapterID}`
        const stageDescriptors = stageToolIDs.map((toolID) =>
          toolDescriptor({
            toolID,
            ownerRef,
            description: `${titleFromID(toolID)} is owned by dispatch adapter ${contract.identity.dispatchAdapterID}.`,
          }),
        )
        addPublication(publications, {
          ownerRef,
          ownerRevision: canonicalDigestSource("dispatch-stage-capability-source-v1", {
            worker_turn_descriptor_hash: contract.identity.workerTurnDescriptorHash,
            projection_hash: contract.identity.projectionHash,
            dispatch_adapter_id: contract.identity.dispatchAdapterID,
            dispatch_adapter_abi_version: contract.identity.dispatchAdapterABIVersion,
            stage_tool_ids: stageToolIDs,
          }).sha256,
          descriptors: stageDescriptors,
          views: stageDescriptors
            .filter((entry) => input.executionToolIDs.includes(entry.ref.local_ref))
            .map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
        })
      }
    }
  } else if (caller === "mission") {
    const mission = await readOwner("mission-session", () => requireMissionSession(input.sessionID))
    const projectDirectory = await readOwner("project-config", () =>
      EffectiveConfig.capabilityProjectDirectory({ sessionID: input.sessionID }),
    )
    const [missionSkills, squads, visibleSquads] = await Promise.all([
      readOwner("mission-skill-registry", () => MissionSkillCatalog.catalogSnapshot()),
      readOwner("expert-squad-registry", () => PromptProfileResolver.catalogIndexSnapshot(projectDirectory)),
      readOwner("expert-squad-registry", () =>
        PromptProfileResolver.recommendationCatalogSnapshot({
          projectDirectory,
          productPillar: mission.productPillar,
          restrictToExpertSquadIDs: missionVisibleExpertSquadIDs(mission),
        }),
      ),
    ])
    const missionSkillDescriptors = missionSkills.skills.map((skill) =>
      descriptor({
        ref: capabilityRef({
          kind: "mission_skill",
          source: skill.builtin ? "platform" : "project",
          owner_ref: "mission-skill-registry",
          local_ref: skill.name,
        }),
        name: skill.name,
        description: skill.description,
        aliases: skill.aliases,
        search_terms: skill.required_tools,
        behavior: {
          kind: "open_mission_skill",
          loader_tool_ref: platformToolRef("mission_skill"),
          name: skill.name,
        },
      }),
    )
    addPublication(publications, {
      ownerRef: "mission-skill-registry",
      ownerRevision: missionSkills.revision,
      descriptors: missionSkillDescriptors,
      views: missionSkillDescriptors.map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
    })
    const squadDescriptors = squads.entries.map((squad) =>
      descriptor({
        ref: capabilityRef({
          kind: "expert_squad",
          source: squad.built_in ? "platform" : "project",
          owner_ref: "expert-squad-registry",
          local_ref: squad.id,
        }),
        name: squad.display_label,
        description: squad.description ?? squad.name,
        aliases: [squad.name, squad.id],
        search_terms: squad.product_pillars,
        product_pillars: squad.product_pillars,
        behavior: { kind: "create_task", action_tool_ref: platformToolRef("panel"), profile_id: squad.id },
      }),
    )
    const visibleSquadIDs = new Set(visibleSquads.entries.map((entry) => entry.id))
    addPublication(publications, {
      ownerRef: "expert-squad-registry",
      ownerRevision: squads.revision,
      descriptors: squadDescriptors,
      views: squadDescriptors
        .filter((entry) => visibleSquadIDs.has(entry.ref.local_ref))
        .map((entry) => view({ descriptor: entry, caller, availability: "installed_unbound" })),
    })
  } else if (caller === "conversation" && ConversationCapability.isAgentID(input.agentID)) {
    const assignment = ConversationCapability.assignment(input.config, input.agentID)
    const projectedSkillNames = new Set((harnessProjection?.skill_refs ?? []).map((ref) => ref.local_ref))
    const installed = await readOwner("skill-manager", () => SkillManager.installedCatalogSnapshot())
    const skillDescriptors = installed.skills.map((skill) =>
      descriptor({
        ref: capabilityRef({
          kind: "skill",
          source: skill.builtin ? "platform" : "project",
          owner_ref: "skill-manager",
          local_ref: skill.name,
        }),
        name: skill.name,
        description: skill.description,
        aliases: skill.aliases,
        search_terms: skill.required_tools,
        behavior: { kind: "open_skill", loader_tool_ref: platformToolRef("skill"), name: skill.name },
      }),
    )
    const installedByName = new Map(installed.skills.map((skill) => [skill.name, skill]))
    addPublication(publications, {
      ownerRef: "skill-manager",
      ownerRevision: installed.revision,
      descriptors: skillDescriptors,
      views: skillDescriptors.map((entry) => {
        const policy = installedByName.get(entry.ref.local_ref)!.policy
        const projected = projectedSkillNames.has(entry.ref.local_ref)
        return view({
          descriptor: entry,
          caller,
          availability: policy === "deny" ? "denied" : projected ? "visible" : "installed_unbound",
          nextOwner:
            policy === "deny"
              ? { kind: "unavailable", reason: `Skill policy denies ${entry.ref.local_ref}.` }
              : projected
                ? undefined
                : { kind: "open_settings", target: `${input.agentID}.capability.skills` },
        })
      }),
    })

    const mcpCatalog = await readOwner("mcp-config", () => MCP.observedCatalogSnapshot(input.config))
    const hostSessionCatalogs = await readOwner("host-session-mcp", () =>
      HostSessionMcpRuntime.catalogSnapshots(input.sessionID),
    )
    const assignedServers = new Set(assignment.mcp_server_refs)
    const mcpServerDescriptors = Object.keys(input.config.mcp ?? {})
      .sort(compareCanonicalStrings)
      .map((serverID) =>
        descriptor({
          ref: capabilityRef({
            kind: "mcp_server",
            source: "project",
            owner_ref: "mcp-config",
            local_ref: serverID,
          }),
          name: serverID,
          description: `Configured Model Context Protocol server ${serverID}.`,
          aliases: [],
          search_terms: ["MCP", "Model Context Protocol"],
          behavior: { kind: "unavailable", reason_code: "mcp_server_managed_in_settings" },
        }),
      )
    const mcpConfigToolDescriptors = mcpCatalog.tool_ids.map((toolID) =>
      descriptorForProjectedRef(
        capabilityRef({
          kind: "mcp_tool",
          source: "project",
          owner_ref: "mcp-config",
          local_ref: toolID,
        }),
      ),
    )
    const mcpConfigDescriptors = [...mcpServerDescriptors, ...mcpConfigToolDescriptors]
    const projectedMcpRefIDs = new Set(
      directlyProjectedMcpToolDescriptors
        .filter((entry) => input.executionToolIDs.includes(entry.ref.local_ref))
        .map((entry) => CapabilityRefCodec.encode(entry.ref)),
    )
    const hostCatalogByOwner = new Map(
      hostSessionCatalogs.map((entry) => [HostSessionMcpRuntime.catalogOwnerRef(entry.owner.owner_id), entry]),
    )
    for (const projected of directlyProjectedMcpToolDescriptors) {
      if (!input.executionToolIDs.includes(projected.ref.local_ref)) continue
      const inventory =
        projected.ref.owner_ref === "mcp-config"
          ? mcpCatalog.tool_ids
          : hostCatalogByOwner.get(projected.ref.owner_ref)?.tool_ids
      if (projected.ref.owner_ref.startsWith("host-session-mcp:") && !inventory) {
        throw new CapabilityOwnerUnavailableError(
          projected.ref.owner_ref,
          `Harness projects ${CapabilityRefCodec.encode(projected.ref)}, but its exact Host Session owner is absent.`,
        )
      }
      if (inventory && !inventory.includes(projected.ref.local_ref)) {
        throw new CapabilityOwnerUnavailableError(
          projected.ref.owner_ref,
          `Harness projects MCP Tool ${CapabilityRefCodec.encode(projected.ref)}, but its exact owner inventory does not publish it.`,
        )
      }
    }
    addPublication(publications, {
      ownerRef: "mcp-config",
      ownerRevision: mcpCatalog.owner_revision,
      descriptors: mcpConfigDescriptors,
      views: mcpConfigDescriptors.flatMap((entry) => {
        if (entry.ref.kind !== "mcp_server") {
          return projectedMcpRefIDs.has(CapabilityRefCodec.encode(entry.ref))
            ? [view({ descriptor: entry, caller, availability: "visible" })]
            : []
        }
        const assigned = assignedServers.has(entry.ref.local_ref)
        const availability = mcpAvailability(mcpCatalog.statuses[entry.ref.local_ref], assigned)
        return [
          view({
            descriptor: entry,
            caller,
            availability,
            nextOwner:
              availability === "unavailable"
                ? { kind: "unavailable", reason: `MCP server ${entry.ref.local_ref} is unavailable.` }
                : assigned
                  ? { kind: "open_settings", target: `mcp.${entry.ref.local_ref}` }
                  : { kind: "open_settings", target: `${input.agentID}.capability.mcp` },
          }),
        ]
      }),
    })
    for (const hostCatalog of hostSessionCatalogs) {
      const ownerRef = HostSessionMcpRuntime.catalogOwnerRef(hostCatalog.owner.owner_id)
      const descriptors = hostCatalog.tool_ids.map((toolID) =>
        descriptorForProjectedRef(
          capabilityRef({ kind: "mcp_tool", source: "project", owner_ref: ownerRef, local_ref: toolID }),
        ),
      )
      addPublication(publications, {
        ownerRef,
        ownerRevision: hostCatalog.owner_revision,
        descriptors,
        views: descriptors
          .filter((entry) => projectedMcpRefIDs.has(CapabilityRefCodec.encode(entry.ref)))
          .map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
      })
    }
    const foreignMcpToolDescriptors = directlyProjectedMcpToolDescriptors.filter(
      (entry) => entry.ref.owner_ref !== "mcp-config" && !hostCatalogByOwner.has(entry.ref.owner_ref),
    )
    addPublicationsByOwner(publications, {
      ownerRevision: harnessProjection?.owner_revision ?? "direct-mcp-projection",
      descriptors: foreignMcpToolDescriptors,
      views: foreignMcpToolDescriptors
        .filter((entry) => input.executionToolIDs.includes(entry.ref.local_ref))
        .map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
    })
  } else if (directlyProjectedMcpToolDescriptors.length > 0) {
    addPublicationsByOwner(publications, {
      ownerRevision: harnessProjection?.owner_revision ?? "direct-mcp-projection",
      descriptors: directlyProjectedMcpToolDescriptors,
      views: directlyProjectedMcpToolDescriptors
        .filter((entry) => input.executionToolIDs.includes(entry.ref.local_ref))
        .map((entry) => view({ descriptor: entry, caller, availability: "visible" })),
    })
  }

  const contextRef = harnessProjection
    ? CapabilityRefCodec.encode(
        capabilityRef({
          kind: "capability_set",
          source: contract ? "package" : "project",
          owner_ref: "runtime-harness",
          local_ref: harnessProjection.projection_hash,
        }),
      )
    : `${caller}:${input.agentID}`
  const contextRevision = canonicalDigestSource("runtime-capability-catalog-context-v2", {
    caller,
    agent_id: input.agentID,
    harness_projection_hash: harnessProjection?.projection_hash ?? null,
    execution_tool_ids: [...new Set(input.executionToolIDs)].sort(compareCanonicalStrings),
    runtime_identity: contract
      ? {
          identity_kind: contract.identity.identityKind,
          agent_id: contract.identity.agentID,
          package_digest: contract.identity.packageRevision.packageDigest,
          projection_hash: contract.identity.projectionHash,
          worker_turn_descriptor_hash: contract.identity.workerTurnDescriptorHash ?? null,
        }
      : null,
  }).sha256
  const { sources, projections } = materializePublications(publications)
  const publishedSources = await Promise.all(sources.map((item) => CapabilityCatalogCache.publishSource(item)))
  const snapshot = await CapabilityCatalogCache.publishSnapshot({
    context: { caller, context_ref: contextRef, context_revision: contextRevision },
    sources: publishedSources,
    projections,
  })
  return { caller, snapshot }
}

export namespace RuntimeCapabilityCatalog {
  export async function snapshot(input: RuntimeInput): Promise<{
    caller: CapabilityCaller
    snapshot: CapabilityCatalogSnapshot
  }> {
    return buildRuntimeSnapshot(input)
  }
}
