import { GLOBAL_TOOL_IDS } from "@/tool/tool-id-catalog"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import path from "node:path"
import z from "zod"
import { Shell } from "@/shell/shell"
import { canonicalShellScope } from "./shell-scope"

export const PermissionProviderKind = z.enum([
  "builtin",
  "plugin",
  "skill",
  "mcp",
  "mcp_app",
  "browser",
  "computer",
  "projected",
  "schedule",
  "external",
])
export type PermissionProviderKind = z.infer<typeof PermissionProviderKind>
export const ToolInvocationProviderKind = z.union([z.literal("internal"), PermissionProviderKind])
export type ToolInvocationProviderKind = z.infer<typeof ToolInvocationProviderKind>

export const PermissionEffectClass = z.enum([
  "read_local",
  "write_local",
  "process",
  "network_read",
  "external_effect",
  "credential_release",
  "destructive",
])
export type PermissionEffectClass = z.infer<typeof PermissionEffectClass>

const OBSERVATION_ONLY_BUILTINS = new Set<string>([
  "question",
  "capability_search",
  "artifact_search",
  "artifact_read",
  "artifact_select",
  "read",
  "glob",
  "search_code",
  "list",
  "todoread",
  "todowrite",
  "planner",
  "panel",
  "mission_state",
  "wait",
  "analytics",
  "work_artifact_inspect",
  "request_orchestrator_decision",
  "batch",
])

const BUILTIN_EFFECTS = new Map<string, PermissionEffectClass>([
  ["delegate_agent", "external_effect"],
  ["bash", "process"],
  ["browser_preview", "process"],
  ["browser_preview_capture", "network_read"],
  ["browser_preview_capture_interaction_state", "network_read"],
  ["artifact_snapshot", "write_local"],
  ["artifact_publish", "external_effect"],
  ["publish_interactive_artifact", "external_effect"],
  ["work_artifact_author", "write_local"],
  ["work_artifact_validate", "write_local"],
  ["work_artifact_deliver", "external_effect"],
  ["edit", "write_local"],
  ["write", "write_local"],
  ["apply_patch", "write_local"],
  ["webfetch", "network_read"],
  ["websearch", "network_read"],
  ["external_code_search", "network_read"],
  ["skill_market", "network_read"],
  ["skill", "external_effect"],
  ["mission_skill", "external_effect"],
  ["memory", "write_local"],
  ["schedule", "external_effect"],
  ["scheduler_message", "external_effect"],
  ["expert_squad_author", "write_local"],
  ["evolve_expert_squad_from_feedback", "write_local"],
  ["send_mailbox_message", "external_effect"],
])

const classifiedBuiltinIDs = new Set([...OBSERVATION_ONLY_BUILTINS, ...BUILTIN_EFFECTS.keys()])
const missingBuiltinIDs = GLOBAL_TOOL_IDS.filter((id) => !classifiedBuiltinIDs.has(id))
const extraBuiltinIDs = [...classifiedBuiltinIDs].filter((id) => !(GLOBAL_TOOL_IDS as readonly string[]).includes(id))
if (missingBuiltinIDs.length > 0 || extraBuiltinIDs.length > 0) {
  throw new Error(
    `Permission invocation inventory drift: missing=${missingBuiltinIDs.join(",") || "none"}; extra=${extraBuiltinIDs.join(",") || "none"}`,
  )
}

export type InvocationPermissionDescriptor = Readonly<{
  providerKind: PermissionProviderKind
  providerID: string
  providerDigest: string
  toolName: string
  effectClass: PermissionEffectClass
  scopeVersion: "2"
  scope: Record<string, unknown>
  fingerprint: string
  summary: string
  projectGrantEligible: boolean
}>

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  )
}

const SECRET_FIELD =
  /(authorization|cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|oauth|code|state)/i

function redactString(value: string): string {
  try {
    const url = new URL(value)
    if (url.search || url.hash) {
      const hadSearch = Boolean(url.search)
      const hadHash = Boolean(url.hash)
      url.search = ""
      url.hash = ""
      return `${url.toString()}${hadSearch ? "?<redacted>" : ""}${hadHash ? "#<redacted>" : ""}`
    }
  } catch {}
  return value
}

function inputRecord(args: unknown): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {}
}

function canonicalPath(candidate: unknown): string | undefined {
  if (typeof candidate !== "string" || candidate.trim().length === 0) return undefined
  let current = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(Instance.directory, candidate)
  const missingSegments: string[] = []
  while (true) {
    try {
      return path.resolve(realpathSync.native(current), ...missingSegments)
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      missingSegments.unshift(path.basename(current))
      current = parent
    }
  }
}

function projectContainsCanonicalPath(candidate: string): boolean {
  const directory = canonicalPath(Instance.directory)
  const worktree = canonicalPath(Instance.worktree)
  if (!directory || !worktree) throw new Error("Project filesystem authority could not be canonicalized")
  return Filesystem.contains(directory, candidate) || Filesystem.contains(worktree, candidate)
}

function patchPaths(patchText: unknown): string[] {
  if (typeof patchText !== "string") return []
  const result = new Set<string>()
  for (const match of patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
    const resolved = canonicalPath(match[1]?.trim())
    if (resolved) result.add(resolved)
  }
  for (const match of patchText.matchAll(/^\*\*\* Move to: (.+)$/gm)) {
    const resolved = canonicalPath(match[1]?.trim())
    if (resolved) result.add(resolved)
  }
  return [...result].sort()
}

function canonicalURL(candidate: unknown): Record<string, unknown> | undefined {
  if (typeof candidate !== "string") return undefined
  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return {
      scheme: url.protocol.slice(0, -1),
      hostname: url.hostname.toLowerCase(),
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
      pathname: url.pathname,
      query_sha256: url.search ? sha256(url.search) : undefined,
      fragment_present: Boolean(url.hash),
    }
  } catch {
    return undefined
  }
}

function filesystemScope(toolName: string, args: unknown): Record<string, unknown> | undefined {
  const input = inputRecord(args)
  const single = canonicalPath(input.filePath ?? input.path)
  const paths = toolName === "apply_patch" ? patchPaths(input.patchText) : single ? [single] : []
  if (
    paths.length === 0 &&
    !["memory", "expert_squad_author", "work_artifact_author", "artifact_snapshot"].includes(toolName)
  ) {
    return undefined
  }
  return {
    scope_type: "filesystem",
    operation: toolName,
    paths,
    working_directory: canonicalPath(Instance.directory),
    payload_sha256: sha256(args),
  }
}

async function shellScope(args: unknown): Promise<Record<string, unknown>> {
  const input = inputRecord(args)
  const workingDirectory = canonicalPath(input.workdir ?? Instance.directory)
  if (!workingDirectory) throw new Error("Permission shell working directory is required")
  return {
    ...(await canonicalShellScope({
      command: typeof input.command === "string" ? input.command : "",
      shell: Shell.acceptable(),
      workingDirectory,
    })),
    background: input.background === true,
    timeout: typeof input.timeout === "number" ? input.timeout : undefined,
  }
}

function networkScope(toolName: string, args: unknown): Record<string, unknown> {
  const input = inputRecord(args)
  return {
    scope_type: "network",
    operation: toolName,
    endpoint: canonicalURL(input.url),
    request_sha256: sha256(args),
  }
}

function skillMarketScope(args: unknown): Record<string, unknown> {
  const input = inputRecord(args)
  return {
    scope_type: "skill_market",
    operation: typeof input.action === "string" ? input.action : "unknown",
    endpoint: canonicalURL("https://skills.sh"),
    query_sha256: typeof input.query === "string" ? sha256(input.query) : undefined,
    candidate_id: typeof input.id === "string" ? input.id : undefined,
    expected_hash: typeof input.expected_hash === "string" ? input.expected_hash : undefined,
    policy: input.policy === "allow" || input.policy === "deny" ? input.policy : undefined,
    request_sha256: sha256(args),
  }
}

function scheduleScope(args: unknown): Record<string, unknown> {
  const input = inputRecord(args)
  return {
    scope_type: "schedule",
    action: typeof input.action === "string" ? input.action : "unknown",
    target_scope: typeof input.scope === "string" ? input.scope : undefined,
    project_ids: Array.isArray(input.projectIds)
      ? input.projectIds.filter((value): value is string => typeof value === "string").sort()
      : undefined,
    automation_id_sha256: typeof input.automationId === "string" ? sha256(input.automationId) : undefined,
    event_job_id_sha256: typeof input.jobId === "string" ? sha256(input.jobId) : undefined,
    recurrence_sha256: typeof input.recurrence === "string" ? sha256(input.recurrence) : undefined,
    payload_sha256: sha256(args),
  }
}

async function canonicalResourceScope(
  providerKind: PermissionProviderKind,
  toolName: string,
  effectClass: PermissionEffectClass,
  args: unknown,
): Promise<Record<string, unknown>> {
  if (providerKind === "builtin" && toolName === "bash") return shellScope(args)
  if (providerKind === "builtin" && toolName === "schedule") return scheduleScope(args)
  if (providerKind === "builtin" && toolName === "skill_market") return skillMarketScope(args)
  if (providerKind === "builtin" && (effectClass === "read_local" || effectClass === "write_local")) {
    return (
      filesystemScope(toolName, args) ?? {
        scope_type: "filesystem",
        operation: toolName,
        working_directory: canonicalPath(Instance.directory),
        payload_sha256: sha256(args),
      }
    )
  }
  if (providerKind === "builtin" && effectClass === "network_read") return networkScope(toolName, args)
  return {
    scope_type: "provider",
    operation: toolName,
    arguments: stable(redact(args)),
    arguments_sha256: sha256(args),
  }
}

export function permissionProjectGrantEligible(input: {
  providerKind: PermissionProviderKind
  toolName: string
  effectClass: PermissionEffectClass
  resource: Record<string, unknown>
}): boolean {
  if (input.providerKind !== "builtin") return false
  if (input.effectClass === "read_local") {
    return (
      input.resource.scope_type === "filesystem" &&
      Array.isArray(input.resource.paths) &&
      input.resource.paths.length > 0
    )
  }
  if (input.effectClass === "network_read" && input.toolName === "webfetch") {
    return input.resource.scope_type === "network" && input.resource.endpoint !== undefined
  }
  return false
}

function redact(value: unknown): unknown {
  if (typeof value === "string") return redactString(value)
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_FIELD.test(key) ? "<redacted>" : redact(item),
    ]),
  )
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex")
}

function providerEffect(kind: PermissionProviderKind): PermissionEffectClass {
  if (kind === "browser") return "external_effect"
  if (kind === "computer") return "external_effect"
  if (kind === "mcp" || kind === "mcp_app" || kind === "plugin" || kind === "skill") return "external_effect"
  if (kind === "schedule" || kind === "external" || kind === "projected") return "external_effect"
  throw new Error(`Provider ${kind} requires an explicit built-in effect classification`)
}

function externalReadEffect(toolName: string, args: unknown): PermissionEffectClass | undefined {
  if (!["read", "glob", "search_code", "list"].includes(toolName)) return undefined
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined
  const input = args as Record<string, unknown>
  const candidate = toolName === "read" ? input.filePath : input.path
  if (typeof candidate !== "string" || candidate.trim().length === 0) return undefined
  const resolved = canonicalPath(candidate)
  if (!resolved) return undefined
  return projectContainsCanonicalPath(resolved) ? undefined : "read_local"
}

export async function permissionDescriptor(input: {
  providerKind: ToolInvocationProviderKind
  providerID: string
  providerDigest?: string
  toolName: string
  args: unknown
}): Promise<InvocationPermissionDescriptor | undefined> {
  if (input.providerKind === "internal") return undefined
  if (input.providerKind !== "builtin" && !input.providerDigest) {
    throw new Error(
      `Permission provider binding is required for ${input.providerKind}:${input.providerID}:${input.toolName}`,
    )
  }
  let effectClass =
    input.providerKind === "builtin"
      ? (externalReadEffect(input.toolName, input.args) ?? BUILTIN_EFFECTS.get(input.toolName))
      : providerEffect(input.providerKind)
  if (input.providerKind === "builtin" && input.args && typeof input.args === "object" && !Array.isArray(input.args)) {
    const action = (input.args as Record<string, unknown>).action
    if (
      (input.toolName === "memory" && action === "delete") ||
      (input.toolName === "schedule" && action === "cancel_event")
    ) {
      effectClass = "destructive"
    }
    if (input.toolName === "skill_market" && action === "install") {
      effectClass = "write_local"
    }
  }
  if (input.providerKind === "builtin" && !effectClass) {
    if (OBSERVATION_ONLY_BUILTINS.has(input.toolName)) return undefined
    throw new Error(`Unclassified built-in Tool provider: ${input.toolName}`)
  }
  const providerDigest = input.providerDigest ?? sha256({ kind: "builtin", id: input.providerID, tool: input.toolName })
  const resource = await canonicalResourceScope(input.providerKind, input.toolName, effectClass!, input.args)
  const scope = {
    provider_kind: input.providerKind,
    provider_id: input.providerID,
    provider_digest: providerDigest,
    tool_name: input.toolName,
    effect_class: effectClass,
    resource,
  }
  return {
    providerKind: input.providerKind,
    providerID: input.providerID,
    providerDigest,
    toolName: input.toolName,
    effectClass: effectClass!,
    scopeVersion: "2",
    scope,
    fingerprint: sha256(scope),
    summary: `${input.toolName} (${effectClass})`,
    projectGrantEligible: permissionProjectGrantEligible({
      providerKind: input.providerKind,
      toolName: input.toolName,
      effectClass: effectClass!,
      resource,
    }),
  }
}

export const PermissionInvocationInventory = Object.freeze({
  builtinToolIDs: Object.freeze([...GLOBAL_TOOL_IDS]),
  observationOnlyBuiltinToolIDs: Object.freeze([...OBSERVATION_ONLY_BUILTINS]),
  permissionBearingBuiltinToolIDs: Object.freeze([...BUILTIN_EFFECTS.keys()]),
})
