import { createHash } from "node:crypto"
import z from "zod"
import type { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { requireMissionSession } from "@/mission/session"
import { MissionSkillCatalog } from "@/mission-skill/catalog"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { SkillManager } from "@/skill/manager"
import { Instance } from "@/project/instance"
import { CapabilityKind, CapabilityRef, CapabilityRefCodec, capabilityRef } from "./ref"
import type { HarnessProjection } from "./harness-projection"
import { scoreDiscoveryFields, type DiscoverySearchField } from "./fuzzy"

export const CapabilityCaller = z.enum(["conversation", "mission", "task_scheduler", "task_agent"])
export type CapabilityCaller = z.infer<typeof CapabilityCaller>

export const CapabilityAvailability = z.enum(["visible", "installed_unbound", "requires_auth", "denied"])
export type CapabilityAvailability = z.infer<typeof CapabilityAvailability>

export const CapabilityNextOwnerKind = z.enum([
  "load_skill",
  "call_tool",
  "create_task_with_expert_squad",
  "open_settings",
  "unavailable",
])
export type CapabilityNextOwnerKind = z.infer<typeof CapabilityNextOwnerKind>

export const CapabilityNextOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("load_skill"), name: z.string() }).strict(),
  z.object({ kind: z.literal("call_tool"), tool_id: z.string() }).strict(),
  z.object({ kind: z.literal("create_task_with_expert_squad"), profile_id: z.string() }).strict(),
  z.object({ kind: z.literal("open_settings"), target: z.string() }).strict(),
  z.object({ kind: z.literal("unavailable"), reason: z.string() }).strict(),
])
export type CapabilityNextOwner = z.infer<typeof CapabilityNextOwner>

export const CapabilityCatalogEntry = z
  .object({
    ref: CapabilityRef,
    name: z.string().trim().min(1),
    description: z.string(),
    aliases: z.array(z.string()).default([]),
    discoverable_by: z.array(CapabilityCaller).min(1),
    product_pillars: z.array(z.enum(["code", "work"])).optional(),
    availability: CapabilityAvailability,
    next_owner: CapabilityNextOwner,
  })
  .strict()
export type CapabilityCatalogEntry = z.infer<typeof CapabilityCatalogEntry>

export const CapabilityCatalogSource = z
  .object({
    owner_ref: z.string().trim().min(1),
    revision: z.string().trim().min(1),
    entries: z.array(CapabilityCatalogEntry),
  })
  .strict()
export type CapabilityCatalogSource = z.infer<typeof CapabilityCatalogSource>

export const CapabilityCatalogSnapshot = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    owner_revisions: z.record(z.string(), z.string()),
    entries: z.array(CapabilityCatalogEntry),
  })
  .strict()
export type CapabilityCatalogSnapshot = z.infer<typeof CapabilityCatalogSnapshot>

export const CapabilitySearchInput = z
  .object({
    query: z.string().default(""),
    kinds: z
      .array(CapabilityKind)
      .optional()
      .describe(
        'Exact stored capability kinds. "tool" selects platform tools and "mcp_tool" selects Model Context Protocol tools; omit this field to search across stored kinds.',
      ),
    next_owner_kinds: z
      .array(CapabilityNextOwnerKind)
      .optional()
      .describe('Exact next-step kinds. Use ["call_tool"] to search every executable platform or MCP tool.'),
    owner_refs: z.array(z.string().trim().min(1)).optional(),
    product_pillar: z.enum(["code", "work"]).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    expected_catalog_revision: z.string().optional(),
  })
  .strict()
export type CapabilitySearchInput = z.infer<typeof CapabilitySearchInput>

export const CapabilitySearchResult = CapabilityCatalogEntry.extend({
  catalog_revision: z.string(),
  score: z.number().nullable(),
}).strict()
export type CapabilitySearchResult = z.infer<typeof CapabilitySearchResult>

export class StaleCapabilityCatalogError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`Capability catalog revision is stale: expected ${expected}, current revision is ${actual}.`)
  }
}

function digest(value: unknown): string {
  // SHA-256 means Secure Hash Algorithm with a 256-bit digest.
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function freezeEntry(entry: CapabilityCatalogEntry): CapabilityCatalogEntry {
  return Object.freeze({
    ...entry,
    ref: Object.freeze({ ...entry.ref }),
    aliases: Object.freeze([...entry.aliases]) as string[],
    discoverable_by: Object.freeze([...entry.discoverable_by]) as CapabilityCaller[],
    ...(entry.product_pillars
      ? { product_pillars: Object.freeze([...entry.product_pillars]) as Array<"code" | "work"> }
      : {}),
    next_owner: Object.freeze({ ...entry.next_owner }),
  })
}

export function createCapabilityCatalogSnapshot(
  rawSources: readonly CapabilityCatalogSource[],
): CapabilityCatalogSnapshot {
  const sources = rawSources
    .map((source) => CapabilityCatalogSource.parse(source))
    .sort((left, right) => left.owner_ref.localeCompare(right.owner_ref))
  const ownerRevisions: Record<string, string> = {}
  const entries = new Map<string, CapabilityCatalogEntry>()
  for (const source of sources) {
    if (Object.hasOwn(ownerRevisions, source.owner_ref)) {
      throw new Error(`Capability catalog contains duplicate owner ${JSON.stringify(source.owner_ref)}.`)
    }
    ownerRevisions[source.owner_ref] = source.revision
    for (const entry of source.entries) {
      if (entry.ref.owner_ref !== source.owner_ref) {
        throw new Error(
          `Capability ${CapabilityRefCodec.encode(entry.ref)} belongs to ${entry.ref.owner_ref}, not source ${source.owner_ref}.`,
        )
      }
      const id = CapabilityRefCodec.encode(entry.ref)
      if (entries.has(id)) throw new Error(`Capability catalog contains duplicate reference ${id}.`)
      entries.set(id, freezeEntry(entry))
    }
  }
  const sortedEntries = [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, entry]) => entry)
  const canonical = { owner_revisions: ownerRevisions, entries: sortedEntries }
  return Object.freeze({
    catalog_revision: digest(canonical),
    owner_revisions: Object.freeze({ ...ownerRevisions }),
    entries: Object.freeze(sortedEntries) as CapabilityCatalogEntry[],
  })
}

function searchFields(entry: CapabilityCatalogEntry): DiscoverySearchField[] {
  return [
    { text: entry.name, weight: 1 },
    { text: entry.ref.local_ref, weight: 1 },
    ...entry.aliases.map((alias) => ({ text: alias, weight: 0.94 })),
    ...(entry.aliases.length > 1 ? [{ text: entry.aliases.join(" "), weight: 0.92 }] : []),
    { text: entry.description, weight: 0.78 },
    { text: entry.ref.kind, weight: 0.45 },
    { text: entry.ref.owner_ref, weight: 0.35 },
  ]
}

export function searchCapabilityCatalog(
  snapshot: CapabilityCatalogSnapshot,
  caller: CapabilityCaller,
  rawInput: z.input<typeof CapabilitySearchInput>,
): CapabilitySearchResult[] {
  const input = CapabilitySearchInput.parse(rawInput)
  if (input.expected_catalog_revision && input.expected_catalog_revision !== snapshot.catalog_revision) {
    throw new StaleCapabilityCatalogError(input.expected_catalog_revision, snapshot.catalog_revision)
  }
  const kinds = input.kinds ? new Set(input.kinds) : undefined
  const nextOwnerKinds = input.next_owner_kinds ? new Set(input.next_owner_kinds) : undefined
  const owners = input.owner_refs ? new Set(input.owner_refs) : undefined
  const candidates = snapshot.entries.filter((entry) => {
    if (!entry.discoverable_by.includes(caller)) return false
    if (kinds && !kinds.has(entry.ref.kind)) return false
    if (nextOwnerKinds && !nextOwnerKinds.has(entry.next_owner.kind)) return false
    if (owners && !owners.has(entry.ref.owner_ref)) return false
    if (
      input.product_pillar &&
      entry.ref.kind === "expert_squad" &&
      !entry.product_pillars?.includes(input.product_pillar)
    ) {
      return false
    }
    return true
  })
  const needle = input.query.trim()
  const ranked: Array<{ entry: CapabilityCatalogEntry; score: number | null }> = []
  for (const entry of candidates) {
    if (!needle) {
      ranked.push({ entry, score: null })
      continue
    }
    const score = scoreDiscoveryFields(needle, searchFields(entry))
    if (score !== undefined) ranked.push({ entry, score })
  }
  ranked.sort((left, right) => {
    if (left.score !== right.score) {
      if (left.score === null) return -1
      if (right.score === null) return 1
      return right.score - left.score
    }
    return CapabilityRefCodec.encode(left.entry.ref).localeCompare(CapabilityRefCodec.encode(right.entry.ref))
  })
  return ranked.slice(0, input.limit).map(({ entry, score }) => ({
    ...entry,
    catalog_revision: snapshot.catalog_revision,
    score,
  }))
}

function source(ownerRef: string, entries: CapabilityCatalogEntry[]): CapabilityCatalogSource {
  const canonicalEntries = entries
    .map((entry) => CapabilityCatalogEntry.parse(entry))
    .sort((left, right) => CapabilityRefCodec.encode(left.ref).localeCompare(CapabilityRefCodec.encode(right.ref)))
  return {
    owner_ref: ownerRef,
    revision: digest(canonicalEntries),
    entries: canonicalEntries,
  }
}

function sourcesFromEntries(entries: CapabilityCatalogEntry[]): CapabilityCatalogSource[] {
  const byOwner = new Map<string, CapabilityCatalogEntry[]>()
  for (const entry of entries) {
    const ownerEntries = byOwner.get(entry.ref.owner_ref) ?? []
    ownerEntries.push(entry)
    byOwner.set(entry.ref.owner_ref, ownerEntries)
  }
  return [...byOwner.entries()].map(([ownerRef, ownerEntries]) => source(ownerRef, ownerEntries))
}

function titleFromID(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function toolEntry(toolID: string, ownerRef: string, callers: CapabilityCaller[]): CapabilityCatalogEntry {
  return {
    ref: capabilityRef({ kind: "tool", source: "platform", owner_ref: ownerRef, local_ref: toolID }),
    name: toolID,
    description: `${titleFromID(toolID)} is projected in the current execution surface.`,
    aliases: [titleFromID(toolID)],
    discoverable_by: callers,
    availability: "visible",
    next_owner: { kind: "call_tool", tool_id: toolID },
  }
}

function runtimeCaller(input: { agentID: string; sessionID: string }): CapabilityCaller {
  const contract = SessionRuntimeContractStore.get(input.sessionID)
  if (contract?.identity.identityKind === "projected-scheduler") return "task_scheduler"
  if (contract?.identity.identityKind === "projected-worker") return "task_agent"
  if (input.agentID === "mission") return "mission"
  return "conversation"
}

export namespace CapabilityCatalog {
  export async function runtimeSnapshot(input: {
    config: Config.Info
    sessionID: string
    agentID: string
    executionToolIDs: readonly string[]
    harnessProjection?: HarnessProjection
  }): Promise<{ caller: CapabilityCaller; snapshot: CapabilityCatalogSnapshot }> {
    const caller = runtimeCaller(input)
    const contract = SessionRuntimeContractStore.get(input.sessionID)
    const harnessProjection = input.harnessProjection ?? contract?.harnessProjection
    const platformToolIDs = harnessProjection
      ? new Set(
          harnessProjection.tool_refs.filter((ref) => ref.owner_ref === "tool-registry").map((ref) => ref.local_ref),
        )
      : new Set(input.executionToolIDs)
    const sources: CapabilityCatalogSource[] = [
      source(
        "tool-registry",
        [...new Set(input.executionToolIDs)]
          .filter((toolID) => platformToolIDs.has(toolID))
          .map((toolID) => toolEntry(toolID, "tool-registry", [caller])),
      ),
    ]
    const directlyProjectedMcpToolEntries =
      !contract && harnessProjection
        ? harnessProjection.mcp_tool_refs
            .filter((ref) => input.executionToolIDs.includes(ref.local_ref))
            .map(
              (ref): CapabilityCatalogEntry => ({
                ref,
                name: ref.local_ref,
                description: `${titleFromID(ref.local_ref)} is an exact projected Model Context Protocol Tool.`,
                aliases: [titleFromID(ref.local_ref)],
                discoverable_by: [caller],
                availability: "visible",
                next_owner: { kind: "call_tool", tool_id: ref.local_ref },
              }),
            )
        : []
    if (contract) {
      const identity = contract.identity
      const owner =
        identity.identityKind === "projected-scheduler"
          ? contract.skillProjection.projectedScheduler
          : [...contract.skillProjection.schedulerOnlyAgents, ...contract.skillProjection.projectedAgents].find(
              (candidate) => candidate.identity.agentID === identity.agentID,
            )
      if (!owner) throw new Error(`Runtime capability owner ${identity.agentID} is absent from its Skill projection.`)
      const skillByRef = new Map(
        contract.skillProjection.productionSkills
          .filter((grant) => grant.agentIDs.includes(identity.agentID))
          .map((grant) => [grant.ref, grant.skill]),
      )
      const projected = contract.harnessProjection
      const visibleToolIDs = new Set(input.executionToolIDs)
      const entries: CapabilityCatalogEntry[] = [
        ...projected.tool_refs
          .filter((ref) => ref.owner_ref !== "tool-registry" && visibleToolIDs.has(ref.local_ref))
          .map(
            (ref): CapabilityCatalogEntry => ({
              ref,
              name: ref.local_ref,
              description: `${titleFromID(ref.local_ref)} is projected by ${identity.expertSquadID}.`,
              aliases: [titleFromID(ref.local_ref)],
              discoverable_by: [caller],
              availability: "visible",
              next_owner: { kind: "call_tool", tool_id: ref.local_ref },
            }),
          ),
        ...projected.skill_refs.map((ref): CapabilityCatalogEntry => {
          const skill = skillByRef.get(ref.local_ref)
          return {
            ref,
            name: skill?.name ?? ref.local_ref,
            description: skill?.description ?? `Projected Skill ${ref.local_ref}.`,
            aliases: skill?.aliases ?? [],
            discoverable_by: [caller],
            availability: "visible",
            next_owner: { kind: "load_skill", name: skill?.name ?? ref.local_ref },
          }
        }),
        ...projected.mcp_server_refs.map(
          (ref): CapabilityCatalogEntry => ({
            ref,
            name: ref.local_ref,
            description: `Projected Model Context Protocol server ${ref.local_ref}.`,
            aliases: [],
            discoverable_by: [caller],
            availability: "visible",
            next_owner: { kind: "open_settings", target: `mcp.${ref.local_ref}` },
          }),
        ),
        ...projected.mcp_tool_refs
          .filter((ref) => visibleToolIDs.has(ref.local_ref))
          .map(
            (ref): CapabilityCatalogEntry => ({
              ref,
              name: ref.local_ref,
              description: `${titleFromID(ref.local_ref)} is an exact projected Model Context Protocol Tool.`,
              aliases: [titleFromID(ref.local_ref)],
              discoverable_by: [caller],
              availability: "visible",
              next_owner: { kind: "call_tool", tool_id: ref.local_ref },
            }),
          ),
        ...projected.mcp_prompt_refs.map(
          (ref): CapabilityCatalogEntry => ({
            ref,
            name: ref.local_ref,
            description: `Projected Model Context Protocol prompt ${ref.local_ref}.`,
            aliases: [],
            discoverable_by: [caller],
            availability: "visible",
            next_owner: { kind: "unavailable", reason: "Use the exact projected prompt owner." },
          }),
        ),
        ...projected.mcp_resource_refs.map(
          (ref): CapabilityCatalogEntry => ({
            ref,
            name: ref.local_ref,
            description: `Projected Model Context Protocol resource ${ref.local_ref}.`,
            aliases: [],
            discoverable_by: [caller],
            availability: "visible",
            next_owner: { kind: "unavailable", reason: "Use the exact projected resource owner." },
          }),
        ),
      ]
      sources.push(...sourcesFromEntries(entries))
    } else if (caller === "mission") {
      const [missionSkills, squads] = await Promise.all([
        MissionSkillCatalog.all(),
        PromptProfileResolver.recommendationCatalog({
          projectDirectory: Instance.project.worktree,
          productPillar: (await requireMissionSession(input.sessionID)).productPillar,
        }),
      ])
      sources.push(
        source(
          "mission-skill-registry",
          missionSkills.map(
            (skill): CapabilityCatalogEntry => ({
              ref: capabilityRef({
                kind: "mission_skill",
                source: skill.builtin ? "platform" : "project",
                owner_ref: "mission-skill-registry",
                local_ref: skill.name,
              }),
              name: skill.name,
              description: skill.description,
              aliases: skill.aliases,
              discoverable_by: ["mission"],
              availability: "visible",
              next_owner: { kind: "load_skill", name: skill.name },
            }),
          ),
        ),
      )
      sources.push(
        source(
          "expert-squad-registry",
          squads.map(
            (squad): CapabilityCatalogEntry => ({
              ref: capabilityRef({
                kind: "expert_squad",
                source: squad.built_in ? "platform" : "project",
                owner_ref: "expert-squad-registry",
                local_ref: squad.id,
              }),
              name: squad.display_label,
              description: squad.description ?? squad.selector.summary,
              aliases: [squad.label, squad.id],
              discoverable_by: ["mission"],
              product_pillars: squad.product_pillars,
              availability: "installed_unbound",
              next_owner: { kind: "create_task_with_expert_squad", profile_id: squad.id },
            }),
          ),
        ),
      )
    } else if (caller === "conversation" && ConversationCapability.isAgentID(input.agentID)) {
      const assignment = ConversationCapability.assignment(input.config, input.agentID)
      const projectedSkills = new Map((harnessProjection?.skill_refs ?? []).map((ref) => [ref.local_ref, ref]))
      const installed = await SkillManager.installed()
      sources.push(
        ...sourcesFromEntries(
          installed.map(
            (skill): CapabilityCatalogEntry => ({
              ref:
                projectedSkills.get(skill.name) ??
                capabilityRef({
                  kind: "skill",
                  source: skill.builtin ? "platform" : "project",
                  owner_ref: "skill-manager",
                  local_ref: skill.name,
                }),
              name: skill.name,
              description: skill.description,
              aliases: skill.aliases,
              discoverable_by: ["conversation"],
              availability: projectedSkills.has(skill.name) ? "visible" : "installed_unbound",
              next_owner: projectedSkills.has(skill.name)
                ? { kind: "load_skill", name: skill.name }
                : { kind: "open_settings", target: `${input.agentID}.capability.skills` },
            }),
          ),
        ),
      )
      const assignedServers = new Set(assignment.mcp_server_refs)
      const mcpEntries: CapabilityCatalogEntry[] = [
        ...directlyProjectedMcpToolEntries,
        ...Object.entries(input.config.mcp ?? {}).map(
          ([serverID]): CapabilityCatalogEntry => ({
            ref: capabilityRef({
              kind: "mcp_server",
              source: "project",
              owner_ref: "mcp-config",
              local_ref: serverID,
            }),
            name: serverID,
            description: `Configured Model Context Protocol server ${serverID}.`,
            aliases: [],
            discoverable_by: ["conversation"],
            availability: assignedServers.has(serverID) ? "visible" : "installed_unbound",
            next_owner: assignedServers.has(serverID)
              ? { kind: "open_settings", target: `mcp.${serverID}` }
              : { kind: "open_settings", target: `${input.agentID}.capability.mcp` },
          }),
        ),
      ]
      sources.push(source("mcp-config", mcpEntries))
    } else if (directlyProjectedMcpToolEntries.length > 0) {
      sources.push(...sourcesFromEntries(directlyProjectedMcpToolEntries))
    }
    return { caller, snapshot: createCapabilityCatalogSnapshot(sources) }
  }
}
