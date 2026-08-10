import { createHash } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import z from "zod"
import { RUNTIME_TEMPLATE_IDS } from "../agent/runtime-template-id"
import { ExpertSquadPackageManager } from "./manager"
import {
  expertSquadGenerationAuthority,
  type ExpertSquadGenerationTrace,
} from "./installation-metadata"
import { ExpertSquadRegistry } from "./registry"
import { ExpertSquadIDSchema } from "./id"
import { ExpertSquadVersionSchema, expertSquadVersionForTimestamp } from "./version"
import { MCP } from "../mcp"
import { BrowserMCPBuiltin } from "../mcp/browser/builtin"
import { Global } from "../global"

// UUID means Universally Unique Identifier; Multica uses UUIDs as stable source identities.
const UUID = z.string().uuid()
const Timestamp = z.string().min(1)
const NullableUUID = UUID.nullable()
const NullableTimestamp = Timestamp.nullable()

const MulticaBackendOverrides = z
  .object({
    openclaw: z
      .object({
        binary_path: z.string().optional(),
        state_dir: z.string().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()

const MulticaWatchedWorkspaceSchema = z
  .object({
    id: UUID,
    name: z.string(),
  })
  .strict()

export const MulticaConfigSchema = z
  .object({
    server_url: z.string().url(),
    app_url: z.string().url().optional(),
    workspace_id: UUID,
    token: z.string().startsWith("mul_").min(8),
    watched_workspaces: z.array(MulticaWatchedWorkspaceSchema).optional(),
    backends: MulticaBackendOverrides.nullable().optional(),
    profile_command_overrides: z.record(z.string(), z.string()).nullable().optional(),
  })
  .strict()

const MulticaSquadMemberReferenceSchema = z
  .object({
    member_type: z.enum(["agent", "member"]),
    member_id: UUID,
    role: z.string(),
  })
  .strict()

export const MulticaSquadSchema = z
  .object({
    id: UUID,
    workspace_id: UUID,
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    avatar_url: z.string().nullable(),
    leader_id: UUID,
    creator_id: UUID,
    created_at: Timestamp,
    updated_at: Timestamp,
    archived_at: NullableTimestamp,
    archived_by: NullableUUID,
    member_count: z.number().int().nonnegative(),
    member_preview: z.array(MulticaSquadMemberReferenceSchema),
  })
  .strict()

export const MulticaSquadMemberSchema = z
  .object({
    id: UUID,
    squad_id: UUID,
    member_type: z.enum(["agent", "member"]),
    member_id: UUID,
    role: z.string(),
    created_at: Timestamp,
  })
  .strict()

const MulticaAgentSkillSummarySchema = z
  .object({
    id: UUID,
    name: z.string(),
    description: z.string(),
    enabled: z.boolean(),
  })
  .strict()

export const MulticaAgentSchema = z
  .object({
    id: UUID,
    workspace_id: UUID,
    runtime_id: UUID,
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    avatar_url: z.string().nullable(),
    runtime_mode: z.enum(["local", "cloud"]),
    runtime_config: z.unknown(),
    custom_args: z.array(z.string()),
    mcp_config: z.unknown(),
    has_custom_env: z.boolean(),
    custom_env_key_count: z.number().int().nonnegative(),
    mcp_config_redacted: z.boolean(),
    visibility: z.string(),
    permission_mode: z.enum(["private", "public_to"]),
    invocation_targets: z.array(z.unknown()),
    status: z.string(),
    max_concurrent_tasks: z.number().int().nonnegative(),
    model: z.string(),
    thinking_level: z.string(),
    composio_toolkit_allowlist: z.array(z.string()).nullable().optional(),
    composio_toolkit_allowlist_redacted: z.boolean().optional(),
    owner_id: NullableUUID,
    skills: z.array(MulticaAgentSkillSummarySchema),
    created_at: Timestamp,
    updated_at: Timestamp,
    archived_at: NullableTimestamp,
    archived_by: NullableUUID,
  })
  .strict()

const MulticaSkillFileSchema = z
  .object({
    id: UUID,
    skill_id: UUID,
    path: z.string(),
    content: z.string(),
    created_at: Timestamp,
    updated_at: Timestamp,
  })
  .strict()

export const MulticaSkillSchema = z
  .object({
    id: UUID,
    workspace_id: UUID,
    name: z.string(),
    description: z.string(),
    content: z.string(),
    config: z.unknown(),
    created_by: NullableUUID,
    created_at: Timestamp,
    updated_at: Timestamp,
    files: z.array(MulticaSkillFileSchema),
  })
  .strict()

const MulticaSourceSquadCatalogSchema = z.array(MulticaSquadSchema)

const MulticaSquadCatalogEntrySchema = MulticaSquadSchema.omit({ member_preview: true })
  .extend({
    installed: z.boolean().describe("Whether the exact canonical target manifest ID already exists in the catalog"),
    members: z.array(MulticaSquadMemberReferenceSchema),
  })
  .strict()

export const MulticaSquadCatalogSchema = z.array(MulticaSquadCatalogEntrySchema)

const MulticaPreviewMemberSchema = z
  .object({
    id: UUID,
    type: z.enum(["agent", "member"]),
    role: z.string(),
    name: z.string().nullable(),
    leader: z.boolean(),
    targetAgentID: z.string().nullable(),
  })
  .strict()

const MulticaPreviewSkillSchema = z
  .object({
    id: UUID,
    name: z.string(),
    enabledAgentIDs: z.array(UUID),
    supportingFiles: z.array(z.string()),
    targetSkillID: z.string(),
  })
  .strict()

const MulticaPreviewMcpCapabilitiesSchema = z
  .object({
    tools: z.array(z.string()),
    prompts: z.array(z.string()),
    resources: z.array(z.string()),
  })
  .strict()

const MulticaPreviewMcpServerSchema = z
  .object({
    agentID: UUID,
    sourceName: z.string().min(1),
    targetServerID: ExpertSquadIDSchema,
    url: z.string().url(),
    transport: z.enum(["streamable-http", "sse"]),
    capabilities: MulticaPreviewMcpCapabilitiesSchema,
  })
  .strict()

const MulticaMcpReplacementTargetSchema = z.literal("opencorvus-browser")
const MulticaRuntimeTemplateSchema = z.enum(RUNTIME_TEMPLATE_IDS)

function compareMcpReplacementIdentity(
  leftAgentID: string,
  leftSourceName: string,
  rightAgentID: string,
  rightSourceName: string,
): number {
  if (leftAgentID !== rightAgentID) return leftAgentID < rightAgentID ? -1 : 1
  if (leftSourceName !== rightSourceName) return leftSourceName < rightSourceName ? -1 : 1
  return 0
}

const MulticaOpenCorvusMcpReplacementSchema = z
  .object({
    source_agent_id: UUID,
    source_server_name: z.string().min(1),
    target: MulticaMcpReplacementTargetSchema,
  })
  .strict()

const MulticaOpenCorvusMcpReplacementListSchema = z
  .array(MulticaOpenCorvusMcpReplacementSchema)
  .superRefine((values, ctx) => {
    for (const [index, value] of values.entries()) {
      const previous = values[index - 1]
      if (
        previous &&
        compareMcpReplacementIdentity(
          previous.source_agent_id,
          previous.source_server_name,
          value.source_agent_id,
          value.source_server_name,
        ) >= 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: "mcp_replacements must be canonically sorted and unique by source agent and server",
        })
      }
    }
  })

const MulticaOpenCorvusMcpOmissionSchema = z
  .object({
    source_agent_id: UUID,
    source_server_name: z.string().refine((value) => value.trim().length > 0, "source_server_name must not be blank"),
    reason: z.string().trim().min(1),
  })
  .strict()

const MulticaOpenCorvusMcpOmissionListSchema = z
  .array(MulticaOpenCorvusMcpOmissionSchema)
  .superRefine((values, ctx) => {
    for (const [index, value] of values.entries()) {
      const previous = values[index - 1]
      if (
        previous &&
        compareMcpReplacementIdentity(
          previous.source_agent_id,
          previous.source_server_name,
          value.source_agent_id,
          value.source_server_name,
        ) >= 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: "mcp_omissions must be canonically sorted and unique by source agent and server",
        })
      }
    }
  })

const MulticaOpenCorvusAgentMappingSchema = z
  .object({
    base_role: MulticaRuntimeTemplateSchema,
  })
  .strict()

const MulticaPreviewMcpReplacementSchema = z
  .object({
    agentID: UUID,
    sourceName: z.string().min(1),
    target: MulticaMcpReplacementTargetSchema,
    targetToolRefs: z.array(z.string().regex(/^default\/mcp\/browser\/tool\/[a-z0-9_-]+$/)),
  })
  .strict()

const MulticaPreviewMcpOmissionSchema = z
  .object({
    agentID: UUID,
    sourceName: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict()

const MulticaWorkflowDependencyListSchema = z.array(ExpertSquadIDSchema).superRefine((values, ctx) => {
  for (const [index, value] of values.entries()) {
    if (index > 0 && values[index - 1]! >= value) {
      ctx.addIssue({ code: "custom", path: [index], message: "depends_on must be canonically sorted and unique" })
    }
  }
})

const MulticaOpenCorvusWorkflowNodeSchema = z
  .object({
    source_agent_id: UUID,
    description: z.string().trim().min(1),
    depends_on: MulticaWorkflowDependencyListSchema,
  })
  .strict()

const MulticaOpenCorvusWorkflowSchema = z
  .object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    nodes: z
      .record(ExpertSquadIDSchema, MulticaOpenCorvusWorkflowNodeSchema)
      .refine((nodes) => Object.keys(nodes).length > 0, "virtual workflow requires at least one node"),
  })
  .strict()

export const MulticaOpenCorvusMappingSchema = z
  .object({
    mcp_replacements: MulticaOpenCorvusMcpReplacementListSchema,
    mcp_omissions: MulticaOpenCorvusMcpOmissionListSchema,
    agents: z.record(UUID, MulticaOpenCorvusAgentMappingSchema),
    virtual_workflows: z.record(ExpertSquadIDSchema, MulticaOpenCorvusWorkflowSchema),
  })
  .strict()

export const MulticaImportPreviewSchema = z
  .object({
    sourceContract: z.literal("multica-api/v0.4"),
    sourceServer: z.string().url(),
    workspaceID: UUID,
    squadID: UUID,
    squadName: z.string(),
    squadDescription: z.string(),
    targetNamespace: z.literal("multica"),
    targetID: z.string(),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    mappingDigest: z.string().regex(/^[a-f0-9]{64}$/),
    members: z.array(MulticaPreviewMemberSchema),
    skills: z.array(MulticaPreviewSkillSchema),
    mcpServers: z.array(MulticaPreviewMcpServerSchema),
    mcpRepairCandidates: z.array(MulticaPreviewMcpReplacementSchema),
    mcpReplacements: z.array(MulticaPreviewMcpReplacementSchema),
    mcpOmissions: z.array(MulticaPreviewMcpOmissionSchema),
    blockers: z.array(z.string()),
    nonPortable: z.array(z.string()),
  })
  .strict()

export const MulticaImportResultSchema = z
  .object({
    namespace: z.literal("multica"),
    id: z.string(),
    version: ExpertSquadVersionSchema,
    packageDigest: z.string().regex(/^[a-f0-9]{64}$/),
    targetRoot: z.string(),
    mutationOperation: z.enum(["installed", "unchanged"]),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    mappingDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

type MulticaConfig = z.infer<typeof MulticaConfigSchema>
type MulticaSquad = z.infer<typeof MulticaSquadSchema>
type MulticaSquadMember = z.infer<typeof MulticaSquadMemberSchema>
type MulticaAgent = z.infer<typeof MulticaAgentSchema>
type MulticaSkill = z.infer<typeof MulticaSkillSchema>
export type MulticaOpenCorvusMapping = z.infer<typeof MulticaOpenCorvusMappingSchema>
export type MulticaImportPreview = z.infer<typeof MulticaImportPreviewSchema>
export type MulticaImportResult = z.infer<typeof MulticaImportResultSchema>

type MulticaSnapshot = {
  config: MulticaConfig
  squad: MulticaSquad
  members: MulticaSquadMember[]
  agents: MulticaAgent[]
  skills: MulticaSkill[]
}

const SOURCE_CONTRACT = "multica-api/v0.4" as const
const TARGET_NAMESPACE = "multica" as const
const REQUEST_INACTIVITY_MS = 30_000
const RESPONSE_BYTE_LIMIT = 8 * 1024 * 1024
const SOURCE_AGENT_LIMIT = 128
const SOURCE_SKILL_LIMIT = 256
const SOURCE_MCP_SERVER_LIMIT = 64

function sourceID(prefix: string, value: string): string {
  return `${prefix}${value.replaceAll("-", "").toLowerCase()}`
}

function targetSquadID(sourceSquadID: string): string {
  return sourceID("multica-", sourceSquadID)
}

function targetAgentID(sourceAgentID: string): string {
  return sourceID("multica-agent-", sourceAgentID)
}

function targetSkillID(sourceSkillID: string): string {
  return sourceID("multica-skill-", sourceSkillID)
}

function targetMcpServerID(sourceName: string): string {
  return `multica-mcp-${createHash("sha256").update(sourceName).digest("hex").slice(0, 32)}`
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJSON(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function sourceDigest(
  snapshot: MulticaSnapshot,
  mcpServers: z.infer<typeof MulticaPreviewMcpServerSchema>[],
  mcpReplacements: z.infer<typeof MulticaPreviewMcpReplacementSchema>[],
  mcpOmissions: z.infer<typeof MulticaPreviewMcpOmissionSchema>[],
): string {
  const portableSnapshot = {
    contract: SOURCE_CONTRACT,
    server: configServerURL(snapshot.config.server_url).origin,
    workspaceID: snapshot.config.workspace_id,
    squad: snapshot.squad,
    members: snapshot.members,
    agents: snapshot.agents,
    skills: snapshot.skills,
    mcpServers,
    mcpReplacements,
    mcpOmissions,
  }
  return createHash("sha256").update(stableJSON(portableSnapshot)).digest("hex")
}

function mappingDigest(mapping: MulticaOpenCorvusMapping): string {
  return createHash("sha256").update(stableJSON(mapping)).digest("hex")
}

function validateMapping(snapshot: MulticaSnapshot, mapping: MulticaOpenCorvusMapping): void {
  const sourceAgentIDs = new Set(snapshot.agents.map((agent) => agent.id))
  const mappedAgentIDs = new Set(Object.keys(mapping.agents))
  for (const sourceAgentID of sourceAgentIDs) {
    if (!mappedAgentIDs.has(sourceAgentID)) {
      throw new Error(`OpenCorvus mapping is missing an Agent runtime mapping for Multica agent ${sourceAgentID}.`)
    }
  }
  for (const mappedAgentID of mappedAgentIDs) {
    if (!sourceAgentIDs.has(mappedAgentID)) {
      throw new Error(`OpenCorvus mapping references unknown Multica agent ${mappedAgentID}.`)
    }
  }

  for (const replacement of mapping.mcp_replacements) {
    if (!sourceAgentIDs.has(replacement.source_agent_id)) {
      throw new Error(
        `OpenCorvus mapping mcp_replacements references unknown Multica agent ${replacement.source_agent_id}.`,
      )
    }
  }

  const replacementKeys = new Set(
    mapping.mcp_replacements.map((replacement) =>
      mcpReplacementKey(replacement.source_agent_id, replacement.source_server_name),
    ),
  )
  for (const omission of mapping.mcp_omissions) {
    if (!sourceAgentIDs.has(omission.source_agent_id)) {
      throw new Error(`OpenCorvus mapping mcp_omissions references unknown Multica agent ${omission.source_agent_id}.`)
    }
    const key = mcpReplacementKey(omission.source_agent_id, omission.source_server_name)
    if (replacementKeys.has(key)) {
      throw new Error(
        `OpenCorvus mapping cannot both replace and omit Multica MCP server ${omission.source_agent_id}/${JSON.stringify(omission.source_server_name)}.`,
      )
    }
  }

  for (const [workflowID, workflow] of Object.entries(mapping.virtual_workflows)) {
    const nodeIDs = new Set(Object.keys(workflow.nodes))
    for (const [nodeID, node] of Object.entries(workflow.nodes)) {
      const context = `OpenCorvus mapping virtual_workflows.${workflowID}.nodes.${nodeID}`
      if (!sourceAgentIDs.has(node.source_agent_id)) {
        throw new Error(`${context} references unknown Multica agent ${node.source_agent_id}.`)
      }
      for (const dependencyID of node.depends_on) {
        if (dependencyID === nodeID) throw new Error(`${context}.depends_on cannot reference itself.`)
        if (!nodeIDs.has(dependencyID)) {
          throw new Error(`${context}.depends_on references unknown node ${dependencyID}.`)
        }
      }
    }
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (nodeID: string): void => {
      if (visiting.has(nodeID)) throw new Error(`OpenCorvus mapping virtual_workflows.${workflowID} contains a cycle.`)
      if (visited.has(nodeID)) return
      visiting.add(nodeID)
      for (const dependencyID of workflow.nodes[nodeID]!.depends_on) visit(dependencyID)
      visiting.delete(nodeID)
      visited.add(nodeID)
    }
    for (const nodeID of nodeIDs) visit(nodeID)
  }
}

function configServerURL(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Multica server_url must use HTTP or HTTPS: ${url.protocol}`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Multica server_url cannot contain credentials, query parameters, or a fragment")
  }
  return url
}

async function readResponseWithInactivityLimit(
  response: Response,
  requestURL: string,
  controller: AbortController,
): Promise<string> {
  if (!response.body) return ""
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let output = ""
  while (true) {
    const next = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        controller.abort(`Multica response inactive for ${REQUEST_INACTIVITY_MS}ms`)
        reject(new Error(`Multica response inactive for ${REQUEST_INACTIVITY_MS}ms: ${requestURL}`))
      }, REQUEST_INACTIVITY_MS)
      void reader.read().then(
        (result) => {
          clearTimeout(timeout)
          resolve(result)
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        },
      )
    })
    if (next.done) break
    total += next.value.byteLength
    if (total > RESPONSE_BYTE_LIMIT) {
      controller.abort(`Multica response exceeds ${RESPONSE_BYTE_LIMIT} bytes`)
      throw new Error(`Multica response exceeds ${RESPONSE_BYTE_LIMIT} bytes: ${requestURL}`)
    }
    output += decoder.decode(next.value, { stream: true })
  }
  output += decoder.decode()
  return output
}

async function requestJSON<T>(input: { config: MulticaConfig; pathname: string; schema: z.ZodType<T> }): Promise<T> {
  const server = configServerURL(input.config.server_url)
  const url = new URL(input.pathname, server)
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined = setTimeout(
    () => controller.abort(`Multica request inactive for ${REQUEST_INACTIVITY_MS}ms`),
    REQUEST_INACTIVITY_MS,
  )
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "X-Workspace-ID": input.config.workspace_id,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    timeout = undefined
  } catch (error) {
    throw new Error(
      `Multica request failed for ${url.origin}${url.pathname}: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    if (timeout) clearTimeout(timeout)
  }
  const text = await readResponseWithInactivityLimit(response, `${url.origin}${url.pathname}`, controller)
  if (!response.ok) {
    const detail = text.replaceAll(input.config.token, "[redacted]").trim().slice(0, 2_000)
    throw new Error(`Multica request ${url.pathname} failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Multica request ${url.pathname} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const parsed = input.schema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Multica ${SOURCE_CONTRACT} response mismatch for ${url.pathname}: ${parsed.error.message}`)
  }
  return parsed.data
}

function assertSourceLimit(label: string, count: number, limit: number) {
  if (count > limit) throw new Error(`Multica ${label} count ${count} exceeds import limit ${limit}`)
}

function uniqueByID<T extends { id: string }>(values: T[], label: string): T[] {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`Multica ${label} repeats id ${value.id}`)
    seen.add(value.id)
  }
  return values
}

function safeSupportingFilePath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/")
  if (
    value !== normalized ||
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.includes(":")
  ) {
    return false
  }
  return normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
}

async function loadSquadMembers(config: MulticaConfig, squadID: string): Promise<MulticaSquadMember[]> {
  const parsedSquadID = UUID.parse(squadID)
  const members = uniqueByID(
    await requestJSON({
      config,
      pathname: `/api/squads/${encodeURIComponent(parsedSquadID)}/members`,
      schema: z.array(MulticaSquadMemberSchema),
    }),
    "squad member",
  )
  for (const member of members) {
    if (member.squad_id !== parsedSquadID) {
      throw new Error(`Multica squad member ${member.id} belongs to squad ${member.squad_id}, not ${parsedSquadID}`)
    }
  }
  return members.sort((left, right) => left.id.localeCompare(right.id))
}

async function loadSnapshot(config: MulticaConfig, squadID: string): Promise<MulticaSnapshot> {
  const parsedSquadID = UUID.parse(squadID)
  const squad = await requestJSON({
    config,
    pathname: `/api/squads/${encodeURIComponent(parsedSquadID)}`,
    schema: MulticaSquadSchema,
  })
  if (squad.id !== parsedSquadID) {
    throw new Error(`Multica squad endpoint ${parsedSquadID} returned squad ${squad.id}`)
  }
  const members = await loadSquadMembers(config, parsedSquadID)
  const agentIDs = [
    ...new Set(members.filter((member) => member.member_type === "agent").map((member) => member.member_id)),
  ]
  assertSourceLimit("agent", agentIDs.length, SOURCE_AGENT_LIMIT)
  const agents = uniqueByID(
    await Promise.all(
      agentIDs.map(async (agentID) => {
        const agent = await requestJSON({
          config,
          pathname: `/api/agents/${encodeURIComponent(agentID)}`,
          schema: MulticaAgentSchema,
        })
        if (agent.id !== agentID) throw new Error(`Multica agent endpoint ${agentID} returned agent ${agent.id}`)
        return agent
      }),
    ),
    "agent",
  ).sort((left, right) => left.id.localeCompare(right.id))
  const skillIDs = [
    ...new Set(agents.flatMap((agent) => agent.skills.filter((skill) => skill.enabled).map((skill) => skill.id))),
  ]
  assertSourceLimit("skill", skillIDs.length, SOURCE_SKILL_LIMIT)
  const skills = uniqueByID(
    await Promise.all(
      skillIDs.map(async (skillID) => {
        const skill = await requestJSON({
          config,
          pathname: `/api/skills/${encodeURIComponent(skillID)}`,
          schema: MulticaSkillSchema,
        })
        if (skill.id !== skillID) throw new Error(`Multica skill endpoint ${skillID} returned skill ${skill.id}`)
        return skill
      }),
    ),
    "skill",
  ).sort((left, right) => left.id.localeCompare(right.id))
  return {
    config,
    squad,
    members,
    agents,
    skills,
  }
}

type MulticaMcpAnalysis = {
  blockers: string[]
  servers: z.infer<typeof MulticaPreviewMcpServerSchema>[]
  repairCandidates: z.infer<typeof MulticaPreviewMcpReplacementSchema>[]
  replacements: z.infer<typeof MulticaPreviewMcpReplacementSchema>[]
  omissions: z.infer<typeof MulticaPreviewMcpOmissionSchema>[]
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function portableRemoteMcpURL(value: unknown): { url: string; reason?: never } | { reason: string; url?: never } {
  if (typeof value !== "string") return { reason: "url must be a string" }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { reason: "url is invalid" }
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { reason: "url must not contain user info, query credentials, or a fragment" }
  }
  const loopback = ["127.0.0.1", "[::1]", "::1", "localhost"].includes(parsed.hostname.toLowerCase())
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    return { reason: "url must use HTTPS, or HTTP only for an explicit loopback endpoint" }
  }
  return { url: value }
}

function mcpReplacementKey(agentID: string, sourceName: string): string {
  return JSON.stringify([agentID, sourceName])
}

function browserMcpReplacement(agentID: string, sourceName: string) {
  return MulticaPreviewMcpReplacementSchema.parse({
    agentID,
    sourceName,
    target: "opencorvus-browser",
    targetToolRefs: [...BrowserMCPBuiltin.ImportableToolRefs],
  })
}

async function analyzePortableMcp(
  snapshot: MulticaSnapshot,
  projectDirectory: string,
  mapping: MulticaOpenCorvusMapping,
): Promise<MulticaMcpAnalysis> {
  const blockers: string[] = []
  const servers: z.infer<typeof MulticaPreviewMcpServerSchema>[] = []
  const repairCandidates: z.infer<typeof MulticaPreviewMcpReplacementSchema>[] = []
  const replacements: z.infer<typeof MulticaPreviewMcpReplacementSchema>[] = []
  const omissions: z.infer<typeof MulticaPreviewMcpOmissionSchema>[] = []
  const requestedReplacements = new Map(
    mapping.mcp_replacements.map((replacement) => [
      mcpReplacementKey(replacement.source_agent_id, replacement.source_server_name),
      replacement,
    ]),
  )
  const appliedReplacementKeys = new Set<string>()
  const requestedOmissions = new Map(
    mapping.mcp_omissions.map((omission) => [
      mcpReplacementKey(omission.source_agent_id, omission.source_server_name),
      omission,
    ]),
  )
  const appliedOmissionKeys = new Set<string>()
  let sourceServerCount = 0
  for (const agent of snapshot.agents) {
    if (agent.mcp_config_redacted) {
      blockers.push(
        `Agent ${agent.name} MCP configuration is redacted and cannot be imported without its exact source.`,
      )
      continue
    }
    if (agent.mcp_config == null) continue
    const config = recordValue(agent.mcp_config)
    if (!config) {
      blockers.push(`Agent ${agent.name} MCP configuration is not a structured mcpServers object.`)
      continue
    }
    const topLevelFields = Object.keys(config).sort()
    const unknownTopLevelFields = topLevelFields.filter((field) => field !== "mcpServers")
    if (unknownTopLevelFields.length) {
      blockers.push(
        `Agent ${agent.name} MCP configuration has unsupported top-level fields: ${unknownTopLevelFields.join(", ")}.`,
      )
      continue
    }
    const sourceServers = recordValue(config.mcpServers)
    if (!sourceServers) {
      blockers.push(`Agent ${agent.name} MCP configuration requires an object-valued mcpServers field.`)
      continue
    }
    const entries = Object.entries(sourceServers).sort(([left], [right]) => left.localeCompare(right))
    const targetServerIDs = new Set<string>()
    sourceServerCount += entries.length
    if (sourceServerCount > SOURCE_MCP_SERVER_LIMIT) {
      blockers.push(`Squad MCP configuration exceeds the ${SOURCE_MCP_SERVER_LIMIT} server limit.`)
      break
    }
    for (const [sourceName, sourceValue] of entries) {
      const context = `Agent ${agent.name} MCP server ${JSON.stringify(sourceName)}`
      if (!sourceName.trim()) {
        blockers.push(`Agent ${agent.name} has an MCP server with an empty name.`)
        continue
      }
      const sourceKey = mcpReplacementKey(agent.id, sourceName)
      const requestedOmission = requestedOmissions.get(sourceKey)
      if (requestedOmission) {
        omissions.push({ agentID: agent.id, sourceName, reason: requestedOmission.reason })
        appliedOmissionKeys.add(sourceKey)
        continue
      }
      const server = recordValue(sourceValue)
      if (!server) {
        blockers.push(`${context} must be an object.`)
        continue
      }
      const supportedFields = new Set([
        "type",
        "url",
        "command",
        "args",
        "env",
        "headers",
        "oauth",
        "headersHelper",
        "alwaysLoad",
      ])
      const unknownFields = Object.keys(server)
        .filter((field) => !supportedFields.has(field))
        .sort()
      if (unknownFields.length) {
        blockers.push(`${context} has unsupported fields: ${unknownFields.join(", ")}.`)
        continue
      }
      const localDeclaration =
        server.command !== undefined || server.type === "stdio" || server.type === "local"
      if (localDeclaration) {
        const commandIsValid = typeof server.command === "string" && server.command.trim().length > 0
        const argsAreValid =
          server.args === undefined ||
          (Array.isArray(server.args) && server.args.every((argument) => typeof argument === "string"))
        const localTypeIsValid =
          server.type === undefined || server.type === "stdio" || server.type === "local"
        const hasRemoteOrSecretMaterial =
          server.url !== undefined ||
          server.env !== undefined ||
          server.headers !== undefined ||
          server.oauth !== undefined ||
          server.headersHelper !== undefined ||
          (server.alwaysLoad !== undefined && server.alwaysLoad !== false)
        if (!commandIsValid || !argsAreValid || !localTypeIsValid || hasRemoteOrSecretMaterial) {
          blockers.push(
            `${context} is a local process that cannot be replaced safely because its command shape or configuration is not portable and secret-free.`,
          )
          continue
        }
        const replacement = browserMcpReplacement(agent.id, sourceName)
        const replacementKey = mcpReplacementKey(agent.id, sourceName)
        if (requestedReplacements.has(replacementKey)) {
          replacements.push(replacement)
          appliedReplacementKeys.add(replacementKey)
        } else {
          repairCandidates.push(replacement)
          blockers.push(
            `${context} is a local stdio process; import requires an explicit evidence-backed OpenCorvus Browser MCP replacement mapping.`,
          )
        }
        continue
      }
      if (server.type !== "http" && server.type !== "streamable-http" && server.type !== "sse") {
        blockers.push(`${context} requires an explicit type of http, streamable-http, or sse.`)
        continue
      }
      if (server.args !== undefined || server.env !== undefined) {
        blockers.push(`${context} contains local-process args or environment and is not a portable remote MCP.`)
        continue
      }
      const headers = recordValue(server.headers)
      if (server.headers !== undefined && !headers) {
        blockers.push(`${context} headers must be an object.`)
        continue
      }
      if (headers && Object.keys(headers).length > 0) {
        blockers.push(
          `${context} contains static headers that may carry credentials and cannot be written to a package.`,
        )
        continue
      }
      if (server.oauth !== undefined && server.oauth !== false) {
        blockers.push(`${context} contains OAuth material; credentials are never copied into an expert-squad package.`)
        continue
      }
      if (server.headersHelper !== undefined) {
        blockers.push(`${context} contains an executable headers helper and cannot be imported as package data.`)
        continue
      }
      if (server.alwaysLoad !== undefined && server.alwaysLoad !== false) {
        blockers.push(`${context} requires alwaysLoad behavior that the package MCP contract does not declare.`)
        continue
      }
      const portableURL = portableRemoteMcpURL(server.url)
      if ("reason" in portableURL) {
        blockers.push(`${context} ${portableURL.reason}.`)
        continue
      }
      const transport = server.type === "sse" ? "sse" : "streamable-http"
      const targetServerID = targetMcpServerID(sourceName)
      if (targetServerIDs.has(targetServerID)) {
        blockers.push(`${context} collides with another stable target MCP server identity.`)
        continue
      }
      targetServerIDs.add(targetServerID)
      try {
        const capabilities = await MCP.inspectScopedCapabilities({
          key: `${targetAgentID(agent.id)}-${targetServerID}`,
          mcp: {
            type: "remote",
            url: portableURL.url,
            transport,
            oauth: false,
          },
          cwd: projectDirectory,
          processAuthority: { kind: "host", cwd: projectDirectory },
        })
        if (capabilities.tools.length + capabilities.prompts.length + capabilities.resources.length === 0) {
          blockers.push(`${context} connected but exposed no tools, prompts, or resources.`)
          continue
        }
        servers.push(
          MulticaPreviewMcpServerSchema.parse({
            agentID: agent.id,
            sourceName,
            targetServerID,
            url: portableURL.url,
            transport,
            capabilities,
          }),
        )
      } catch {
        blockers.push(
          `${context} capability discovery failed; verify endpoint reachability, protocol, and public access.`,
        )
      }
    }
  }
  for (const replacement of mapping.mcp_replacements) {
    const key = mcpReplacementKey(replacement.source_agent_id, replacement.source_server_name)
    if (!appliedReplacementKeys.has(key)) {
      throw new Error(
        `OpenCorvus mapping mcp_replacements entry ${replacement.source_agent_id}/${JSON.stringify(replacement.source_server_name)} does not identify a replaceable local Multica MCP server.`,
      )
    }
  }
  for (const omission of mapping.mcp_omissions) {
    const key = mcpReplacementKey(omission.source_agent_id, omission.source_server_name)
    if (!appliedOmissionKeys.has(key)) {
      throw new Error(
        `OpenCorvus mapping mcp_omissions entry ${omission.source_agent_id}/${JSON.stringify(omission.source_server_name)} does not identify an exact Multica MCP server declaration.`,
      )
    }
  }
  return {
    blockers: [...new Set(blockers)].sort(),
    repairCandidates: repairCandidates.sort(
      (left, right) =>
        compareMcpReplacementIdentity(left.agentID, left.sourceName, right.agentID, right.sourceName),
    ),
    replacements: replacements.sort(
      (left, right) =>
        compareMcpReplacementIdentity(left.agentID, left.sourceName, right.agentID, right.sourceName),
    ),
    omissions: omissions.sort(
      (left, right) =>
        compareMcpReplacementIdentity(left.agentID, left.sourceName, right.agentID, right.sourceName),
    ),
    servers: servers.sort(
      (left, right) => left.agentID.localeCompare(right.agentID) || left.sourceName.localeCompare(right.sourceName),
    ),
  }
}

async function previewForSnapshot(
  snapshot: MulticaSnapshot,
  mapping: MulticaOpenCorvusMapping,
  projectDirectory: string,
): Promise<MulticaImportPreview> {
  validateMapping(snapshot, mapping)
  const mcp = await analyzePortableMcp(snapshot, projectDirectory, mapping)
  const blockers: string[] = [...mcp.blockers]
  const nonPortable = [
    "Multica squad leader issue-routing is source-runtime behavior; OpenCorvus keeps Orchestrator as the scheduler.",
  ]
  const agents = new Map(snapshot.agents.map((agent) => [agent.id, agent]))
  const skills = new Map(snapshot.skills.map((skill) => [skill.id, skill]))

  for (const replacement of mcp.replacements) {
    const agent = agents.get(replacement.agentID)
    nonPortable.push(
      `Agent ${agent?.name ?? replacement.agentID} local MCP server ${JSON.stringify(replacement.sourceName)} is replaced by the evidence-backed OpenCorvus Browser MCP projection; its source command and arguments are not imported.`,
    )
  }
  for (const omission of mcp.omissions) {
    const agent = agents.get(omission.agentID)
    nonPortable.push(
      `Agent ${agent?.name ?? omission.agentID} MCP server ${JSON.stringify(omission.sourceName)} is explicitly not projected: ${omission.reason}`,
    )
  }

  if (snapshot.squad.workspace_id !== snapshot.config.workspace_id) {
    blockers.push(
      `Squad workspace ${snapshot.squad.workspace_id} does not match configured workspace ${snapshot.config.workspace_id}.`,
    )
  }
  if (!snapshot.squad.name.trim()) blockers.push("Squad name is empty.")
  if (!snapshot.squad.description.trim())
    blockers.push("Squad description is empty and cannot define selector guidance.")
  if (!snapshot.squad.instructions.trim())
    blockers.push("Squad instructions are empty and cannot define scheduler guidance.")
  if (snapshot.squad.archived_at) {
    nonPortable.push(`Squad source is archived at ${snapshot.squad.archived_at}; the imported package is a snapshot.`)
  }
  if (snapshot.squad.member_count !== snapshot.members.length) {
    blockers.push(
      `Squad reports ${snapshot.squad.member_count} members but the member endpoint returned ${snapshot.members.length}.`,
    )
  }

  const memberAgentIDs = new Set(
    snapshot.members.filter((member) => member.member_type === "agent").map((member) => member.member_id),
  )
  if (!memberAgentIDs.has(snapshot.squad.leader_id)) {
    blockers.push(`Squad leader ${snapshot.squad.leader_id} is not an agent member of the squad.`)
  }
  const uniqueMemberIDs = new Set<string>()
  for (const member of snapshot.members) {
    if (uniqueMemberIDs.has(member.member_id)) {
      blockers.push(`Squad repeats member identity ${member.member_id}; multiple roles cannot be preserved losslessly.`)
    }
    uniqueMemberIDs.add(member.member_id)
    if (member.squad_id !== snapshot.squad.id) {
      blockers.push(`Member ${member.id} belongs to squad ${member.squad_id}, not ${snapshot.squad.id}.`)
    }
    if (member.member_type === "member") {
      nonPortable.push(
        `Human member ${member.member_id}${member.role ? ` (${member.role})` : ""} is preserved as roster provenance and is not projected as an OpenCorvus agent.`,
      )
      continue
    }
    if (!agents.has(member.member_id))
      blockers.push(`Agent member ${member.member_id} is missing from the source graph.`)
  }

  for (const agent of snapshot.agents) {
    if (agent.workspace_id !== snapshot.config.workspace_id) {
      blockers.push(`Agent ${agent.id} belongs to workspace ${agent.workspace_id}.`)
    }
    if (!agent.name.trim()) blockers.push(`Agent ${agent.id} has an empty name.`)
    if (!agent.instructions.trim()) blockers.push(`Agent ${agent.id} has empty instructions.`)
    if (agent.archived_at) {
      nonPortable.push(`Agent ${agent.id} source is archived at ${agent.archived_at}; its imported instructions remain a snapshot.`)
    }
    const disabledSkills = agent.skills.filter((skill) => !skill.enabled)
    if (disabledSkills.length) {
      nonPortable.push(
        `Agent ${agent.name} has disabled skills that are not projected: ${disabledSkills.map((skill) => skill.name).join(", ")}.`,
      )
    }
    const runtimeFacts = [
      `runtime_mode=${agent.runtime_mode}`,
      agent.model ? `model=${agent.model}` : "",
      agent.thinking_level ? `thinking_level=${agent.thinking_level}` : "",
      agent.custom_args.length ? `custom_args=${agent.custom_args.length}` : "",
      agent.custom_env_key_count ? `custom_env_keys=${agent.custom_env_key_count}` : "",
      agent.composio_toolkit_allowlist_redacted || (agent.composio_toolkit_allowlist?.length ?? 0) > 0
        ? "composio=present"
        : "",
    ].filter(Boolean)
    if (runtimeFacts.length)
      nonPortable.push(`Agent ${agent.name} source runtime is not imported: ${runtimeFacts.join(", ")}.`)
    for (const summary of agent.skills.filter((skill) => skill.enabled)) {
      if (!skills.has(summary.id))
        blockers.push(`Enabled skill ${summary.id} for agent ${agent.id} is missing from the source graph.`)
    }
  }

  for (const skill of snapshot.skills) {
    if (skill.workspace_id !== snapshot.config.workspace_id) {
      blockers.push(`Skill ${skill.id} belongs to workspace ${skill.workspace_id}.`)
    }
    if (!skill.content.trim()) blockers.push(`Skill ${skill.id} has empty SKILL.md content.`)
    for (const file of skill.files) {
      if (file.skill_id !== skill.id)
        blockers.push(`Skill file ${file.id} points to skill ${file.skill_id}, not ${skill.id}.`)
      if (!safeSupportingFilePath(file.path))
        blockers.push(`Skill ${skill.id} has unsafe supporting file path ${JSON.stringify(file.path)}.`)
    }
  }

  const preview = {
    sourceContract: SOURCE_CONTRACT,
    sourceServer: configServerURL(snapshot.config.server_url).origin,
    workspaceID: snapshot.config.workspace_id,
    squadID: snapshot.squad.id,
    squadName: snapshot.squad.name,
    squadDescription: snapshot.squad.description,
    targetNamespace: TARGET_NAMESPACE,
    targetID: targetSquadID(snapshot.squad.id),
    sourceDigest: sourceDigest(snapshot, mcp.servers, mcp.replacements, mcp.omissions),
    mappingDigest: mappingDigest(mapping),
    members: snapshot.members.map((member) => {
      const agent = member.member_type === "agent" ? agents.get(member.member_id) : undefined
      return {
        id: member.member_id,
        type: member.member_type,
        role: member.role,
        name: agent?.name ?? null,
        leader: member.member_id === snapshot.squad.leader_id,
        targetAgentID: member.member_type === "agent" ? targetAgentID(member.member_id) : null,
      }
    }),
    skills: snapshot.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      enabledAgentIDs: snapshot.agents
        .filter((agent) => agent.skills.some((summary) => summary.enabled && summary.id === skill.id))
        .map((agent) => agent.id),
      supportingFiles: skill.files.map((file) => file.path),
      targetSkillID: targetSkillID(skill.id),
    })),
    mcpServers: mcp.servers,
    mcpRepairCandidates: mcp.repairCandidates,
    mcpReplacements: mcp.replacements,
    mcpOmissions: mcp.omissions,
    blockers: [...new Set(blockers)].sort(),
    nonPortable: [...new Set(nonPortable)].sort(),
  }
  return MulticaImportPreviewSchema.parse(preview)
}

function markdownSection(title: string, content: string): string {
  return `## ${title}\n\n${content.trim()}\n`
}

function emptyProjectionResources() {
  return {
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
  }
}

function packageFiles(
  snapshot: MulticaSnapshot,
  preview: MulticaImportPreview,
  mapping: MulticaOpenCorvusMapping,
): { manifest: ExpertSquadRegistry.Manifest; files: Record<string, string> } {
  if (preview.blockers.length) {
    throw new Error(`Multica squad ${snapshot.squad.id} is not importable:\n- ${preview.blockers.join("\n- ")}`)
  }
  const agentByID = new Map(snapshot.agents.map((agent) => [agent.id, agent]))
  const memberByAgentID = new Map(
    snapshot.members.filter((member) => member.member_type === "agent").map((member) => [member.member_id, member]),
  )
  const files = new Map<string, string>()
  const roster = snapshot.members
    .map((member) => {
      const agent = member.member_type === "agent" ? agentByID.get(member.member_id) : undefined
      return `- \`${member.member_id}\` — ${agent?.name ?? "Human member"}; role: ${member.role || "(empty)"}${member.member_id === snapshot.squad.leader_id ? "; Multica leader" : ""}`
    })
    .join("\n")
  const approvedMcpReplacements = preview.mcpReplacements
    .map((replacement) => {
      const agent = agentByID.get(replacement.agentID)
      return `- Agent \`${replacement.agentID}\` (${agent?.name ?? "unknown"}), source server \`${replacement.sourceName}\` \u2192 OpenCorvus Browser MCP (${replacement.targetToolRefs.length} projected tools)`
    })
    .join("\n")
  const approvedMcpOmissions = preview.mcpOmissions
    .map((omission) => {
      const agent = agentByID.get(omission.agentID)
      return `- Agent \`${omission.agentID}\` (${agent?.name ?? "unknown"}), source server \`${omission.sourceName}\` is not projected: ${omission.reason}`
    })
    .join("\n")
  const readme = [
    `# ${snapshot.squad.name}`,
    "",
    snapshot.squad.description.trim(),
    "",
    markdownSection(
      "Multica source",
      `Contract: \`${SOURCE_CONTRACT}\`\n\nServer: \`${configServerURL(snapshot.config.server_url).origin}\`\n\nWorkspace: \`${snapshot.config.workspace_id}\`\n\nSquad: \`${snapshot.squad.id}\`\n\nSnapshot: \`${preview.sourceDigest}\`\n\nMapping: \`${preview.mappingDigest}\``,
    ),
    markdownSection("Squad instructions", snapshot.squad.instructions),
    markdownSection("Roster", roster),
    ...(approvedMcpReplacements
      ? [markdownSection("Approved MCP replacements", approvedMcpReplacements)]
      : []),
    ...(approvedMcpOmissions ? [markdownSection("Explicit MCP omissions", approvedMcpOmissions)] : []),
    markdownSection(
      "Portability boundary",
      "This package preserves the import-time team declaration, exact source Agent instructions, complete Skill directories, every validated public remote MCP capability, and every explicit evidence-backed OpenCorvus Browser MCP replacement listed in the source snapshot. These source bytes are an immutable snapshot, not a synchronization loop. OpenCorvus Orchestrator remains the scheduler. Task Artifact discovery and exact reads are platform-owned scheduler/worker capabilities, while Artifact publishing is platform-owned and worker-only; none of those tool IDs or Artifact bodies are declared, shadowed, or copied by this package. Multica issue routing, runtime, model, environment, credentials, original local-process commands, Composio, task, and autopilot state are not imported.",
    ),
  ].join("\n")
  files.set("README.md", `${readme.trim()}\n`)
  files.set(
    "selector.md",
    `# ${snapshot.squad.name} selector\n\nSelect \`${preview.targetID}\` when the request matches this imported Multica squad description:\n\n${snapshot.squad.description.trim()}\n\nSelection exposes only the declared OpenCorvus agent, complete Skill directory, and validated public remote MCP projections. It does not recreate Multica runtime or issue-routing semantics.\n`,
  )
  files.set(
    "agents/orchestrator/system.md",
    `# Imported Multica squad guidance\n\nSource squad: \`${snapshot.squad.id}\`\nSource leader: \`${snapshot.squad.leader_id}\`\n\n${snapshot.squad.instructions.trim()}\n\nUse current evidence to choose an exact projected agent ID. The source leader is provenance, not a second scheduler; do not emulate a fixed workflow or claim Multica runtime parity.\n`,
  )

  const projections: Record<string, ExpertSquadRegistry.AgentProjection> = {}
  for (const agent of snapshot.agents) {
    const agentID = targetAgentID(agent.id)
    const member = memberByAgentID.get(agent.id)
    const skillRefs = agent.skills
      .filter((summary) => summary.enabled)
      .map((summary) => `${preview.targetID}/shared/${targetSkillID(summary.id)}`)
      .sort()
    const mcpServerRefs = preview.mcpServers
      .filter((server) => server.agentID === agent.id)
      .map((server) => `${preview.targetID}/${agentID}/${server.targetServerID}`)
      .sort()
    const defaultMcpToolRefs = [
      ...new Set(
        preview.mcpReplacements
          .filter((replacement) => replacement.agentID === agent.id)
          .flatMap((replacement) => replacement.targetToolRefs),
      ),
    ]
    projections[agentID] = {
      ...emptyProjectionResources(),
      label: agent.name,
      ...(agent.description.trim() ? { description: agent.description } : {}),
      base_role: mapping.agents[agent.id]!.base_role,
      prompt: `agents/${agentID}/system.md`,
      inherit_base_tools: true,
      package_skill_refs: skillRefs,
      package_mcp_server_refs: mcpServerRefs,
      default_mcp_tool_refs: defaultMcpToolRefs,
    }
    files.set(
      `agents/${agentID}/system.md`,
      `# ${agent.name}\n\nMultica source agent: \`${agent.id}\`\nSquad role: ${member?.role || "(empty)"}\nMultica leader: ${agent.id === snapshot.squad.leader_id ? "yes" : "no"}\n\n${agent.instructions.trim()}\n`,
    )
    for (const server of preview.mcpServers.filter((entry) => entry.agentID === agent.id)) {
      files.set(
        `agents/${agentID}/mcp/${server.targetServerID}.jsonc`,
        `${JSON.stringify(
          {
            type: "remote",
            url: server.url,
            transport: server.transport,
            oauth: false,
            capabilities: server.capabilities,
          },
          null,
          2,
        )}\n`,
      )
    }
  }
  for (const skill of snapshot.skills) {
    const skillRoot = `skills/${targetSkillID(skill.id)}`
    files.set(`${skillRoot}/SKILL.md`, skill.content)
    for (const file of skill.files) files.set(`${skillRoot}/${file.path}`, file.content)
  }
  const manifest: ExpertSquadRegistry.Manifest = {
    schema_version: 1,
    namespace: TARGET_NAMESPACE,
    id: preview.targetID,
    name: snapshot.squad.name,
    label: snapshot.squad.name,
    description: snapshot.squad.description,
    version: expertSquadVersionForTimestamp(snapshot.squad.updated_at, 1),
    product_pillars: ["code"],
    readme: "README.md",
    selector: {
      summary: snapshot.squad.description,
      selection_guidance: `Select ${preview.targetID} only when the request matches the imported Multica squad ${snapshot.squad.name}.`,
      instructions: "selector.md",
    },
    capability_projection: {
      scheduler: {
        ...emptyProjectionResources(),
        base_role: "orchestrator",
        prompt: "agents/orchestrator/system.md",
        inherit_base_tools: true,
      },
      agents: projections,
      virtual_workflows: Object.fromEntries(
        Object.entries(mapping.virtual_workflows).map(([workflowID, workflow]) => [
          workflowID,
          {
            label: workflow.label,
            description: workflow.description,
            nodes: Object.fromEntries(
              Object.entries(workflow.nodes).map(([nodeID, node]) => [
                nodeID,
                {
                  agent_id: targetAgentID(node.source_agent_id),
                  description: node.description,
                  depends_on: [...node.depends_on],
                },
              ]),
            ),
          },
        ]),
      ),
    },
  }
  return { manifest, files: Object.fromEntries(files) }
}

async function writeSourcePackage(
  directory: string,
  definition: { manifest: ExpertSquadRegistry.Manifest; files: Record<string, string> },
): Promise<void> {
  const sdk = (await import("@opencorvus-ai/sdk/expert-squad-authoring")) as unknown as {
    writeExpertSquadPackage(input: { directory: string; definition: typeof definition }): Promise<unknown>
  }
  await sdk.writeExpertSquadPackage({ directory, definition })
}

async function validateCanonicalPreview(
  snapshot: MulticaSnapshot,
  preview: MulticaImportPreview,
  mapping: MulticaOpenCorvusMapping,
): Promise<MulticaImportPreview> {
  if (preview.blockers.length) return preview
  const temporaryRoot = await Global.createTemporaryDirectory("multica-preview-")
  const sourceRoot = path.join(temporaryRoot, "package")
  try {
    await writeSourcePackage(sourceRoot, packageFiles(snapshot, preview, mapping))
    await ExpertSquadRegistry.loadSourcePackage(sourceRoot)
    return preview
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return MulticaImportPreviewSchema.parse({
      ...preview,
      blockers: [`Generated OpenCorvus expert-squad package is invalid: ${message}`],
    })
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

export namespace MulticaExpertSquadImport {
  export function generationMetadata(input: {
    generationTrace: ExpertSquadGenerationTrace
    sourceDigest: string
    mappingDigest: string
  }) {
    return {
      ...expertSquadGenerationAuthority(input.generationTrace),
      method: "heterogeneous_import" as const,
      source_digest: input.sourceDigest,
      mapping_digest: input.mappingDigest,
    }
  }

  export function defaultConfigPath(): string {
    return path.join(os.homedir(), ".multica", "config.json")
  }

  export async function loadConfig(configPath = defaultConfigPath()): Promise<MulticaConfig> {
    let text: string
    try {
      text = await readFile(configPath, "utf8")
    } catch (error) {
      throw new Error(
        `Multica configuration is required at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch (error) {
      throw new Error(
        `Multica configuration is invalid JSON at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const parsed = MulticaConfigSchema.safeParse(json)
    if (!parsed.success)
      throw new Error(`Multica configuration does not match ${SOURCE_CONTRACT}: ${parsed.error.message}`)
    configServerURL(parsed.data.server_url)
    return parsed.data
  }

  export async function catalog(input: {
    projectDirectory: string
    configPath?: string
  }): Promise<z.infer<typeof MulticaSquadCatalogSchema>> {
    const config = await loadConfig(input.configPath)
    const [sourceSquads, installed] = await Promise.all([
      requestJSON({ config, pathname: "/api/squads", schema: MulticaSourceSquadCatalogSchema }),
      ExpertSquadRegistry.discoverAvailable(input.projectDirectory),
    ])
    const installedIDs = new Set(installed.items.map((entry) => entry.id))
    return MulticaSquadCatalogSchema.parse(
      await Promise.all(
        sourceSquads.map(async ({ member_preview: _memberPreview, ...squad }) => ({
          ...squad,
          installed: installedIDs.has(targetSquadID(squad.id)),
          members: (await loadSquadMembers(config, squad.id)).map(({ member_type, member_id, role }) => ({
            member_type,
            member_id,
            role,
          })),
        })),
      ),
    )
  }

  export async function preview(input: {
    projectDirectory: string
    squadID: string
    mapping: MulticaOpenCorvusMapping
    configPath?: string
  }): Promise<MulticaImportPreview> {
    const mapping = MulticaOpenCorvusMappingSchema.parse(input.mapping)
    const config = await loadConfig(input.configPath)
    const snapshot = await loadSnapshot(config, input.squadID)
    return validateCanonicalPreview(
      snapshot,
      await previewForSnapshot(snapshot, mapping, input.projectDirectory),
      mapping,
    )
  }

  export async function importSquad(input: {
    projectDirectory: string
    squadID: string
    sourceDigest: string
    mappingDigest: string
    mapping: MulticaOpenCorvusMapping
    generationTrace: ExpertSquadGenerationTrace
    configPath?: string
  }): Promise<MulticaImportResult> {
    const expectedDigest = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.sourceDigest)
    const expectedMappingDigest = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.mappingDigest)
    const mapping = MulticaOpenCorvusMappingSchema.parse(input.mapping)
    const actualMappingDigest = mappingDigest(mapping)
    if (actualMappingDigest !== expectedMappingDigest) {
      throw new Error(
        `OpenCorvus Multica mapping changed after preview: expected ${expectedMappingDigest}, received ${actualMappingDigest}.`,
      )
    }
    const config = await loadConfig(input.configPath)
    const snapshot = await loadSnapshot(config, input.squadID)
    const preview = await validateCanonicalPreview(
      snapshot,
      await previewForSnapshot(snapshot, mapping, input.projectDirectory),
      mapping,
    )
    if (preview.sourceDigest !== expectedDigest) {
      throw new Error(
        `Multica source changed after preview: expected ${expectedDigest}, received ${preview.sourceDigest}. Preview again before importing.`,
      )
    }
    const temporaryRoot = await Global.createTemporaryDirectory("multica-")
    const sourceRoot = path.join(temporaryRoot, "package")
    try {
      await writeSourcePackage(sourceRoot, packageFiles(snapshot, preview, mapping))
      await ExpertSquadRegistry.loadSourcePackage(sourceRoot)
      const installed = await ExpertSquadPackageManager.importDirectory({
        projectDirectory: input.projectDirectory,
        sourceDirectory: sourceRoot,
        installationScope: "project",
        generation: generationMetadata({
          generationTrace: input.generationTrace,
          sourceDigest: preview.sourceDigest,
          mappingDigest: preview.mappingDigest,
        }),
      })
      return MulticaImportResultSchema.parse({
        namespace: installed.after.namespace,
        id: installed.after.id,
        targetRoot: installed.after.targetRoot,
        mutationOperation: installed.operation,
        sourceDigest: preview.sourceDigest,
        mappingDigest: preview.mappingDigest,
      })
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }
}
