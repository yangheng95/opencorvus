// ── Config Service ──
// Check config accessors, config update helpers, and project scaffold.

import { ApiError, apiJson, configure as configureApi } from "./api"
import { appStore, setAppStore, type ProjectLoadIssue } from "../store/app"
import { settingsStore } from "../store/settings"
import { t } from "../utils/i18n"
import { loadConfigInfo } from "./config-load"
import { loadExtensions } from "./extensions"
import { loadMeta } from "./meta"
import { activeProjectDirectory, restoreWorkspaceDirectory } from "./project-directory"
import { loadTasks, clearTasksForMissingDirectory } from "../store/board"
import { getHostTransport } from "./host-transport-runtime"
import { sanitizeLocale } from "../utils/i18n"
import { createSignal } from "solid-js"
import { AppLog } from "../utils/log"

// ── Check Config Accessors ──

/**
 * Extract the `checks` config object from a task's metadata.
 * Returns a clone so callers can mutate the result safely.
 */
export function checkConfig(task: any): Record<string, any> {
  const checks = task?.metadata?.checks
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return {}
  return structuredClone(checks)
}

/**
 * Returns true when the config object has at least one key (i.e. the user has
 * explicitly configured one or more checks).
 */
export function hasExplicitChecks(config: Record<string, any>): boolean {
  return Object.keys(config).length > 0
}

/**
 * Returns true when `key` names a check that can be freely toggled on/off by
 * the user (as opposed to command-type checks whose enabled state is implicit).
 */
export function checkCanToggle(key: string): boolean {
  return ["artifact", "ui_review", "code_quality", "code_review", "dead_code_review", "spec_check"].includes(key)
}

/**
 * Build the config value to store when `key` is toggled on.
 * Returns `undefined` for keys that have no structured representation (i.e.
 * they are handled elsewhere or do not need an object value).
 */
export function checkSelectionConfig(key: string, current: any): Record<string, any> | undefined {
  const base = current && typeof current === "object" && !Array.isArray(current) ? structuredClone(current) : undefined
  if (key === "artifact") return base || {}
  if (key === "ui_review") return { ...(base || {}), target: "web" }
  if (["code_quality", "code_review", "dead_code_review", "spec_check"].includes(key)) {
    return { ...(base || {}), enabled: true }
  }
  if (["startup", "visual", "playwright"].includes(key)) return base
  return { ...(base || {}), enabled: true }
}

/**
 * Build an updated checks config from the current criteriaSpecs in appStore
 * and a map of `{ [specKey]: enabled }` selection values.
 * This is the Solid-store equivalent of the DOM-reading buildCheckConfig
 * ( line 6874). Pass `selection` as a plain object keyed by spec key.
 */
export function buildCheckConfigFromSpecs(task: any, selection: Record<string, boolean>): Record<string, any> {
  const current = checkConfig(task)
  const next = structuredClone(current)
  const named: Record<string, any> =
    next.named && typeof next.named === "object" && !Array.isArray(next.named) ? structuredClone(next.named) : {}

  for (const spec of appStore.criteriaSpecs as any[]) {
    if (spec.readOnly) continue
    const enabled = selection[spec.key]
    if (enabled === undefined) continue
    if (spec.kind === "named") {
      const currentNamed = named[spec.name]
      if (!currentNamed || typeof currentNamed !== "object" || Array.isArray(currentNamed)) continue
      named[spec.name] = { ...currentNamed, enabled }
      continue
    }
    if (spec.kind === "command") {
      if (enabled) {
        if (next[spec.name] === false) delete next[spec.name]
        continue
      }
      next[spec.name] = false
      continue
    }
    if (enabled) {
      const currentValue = next[spec.name]
      const value = checkSelectionConfig(spec.name, currentValue)
      if (value) next[spec.name] = value
      continue
    }
    delete next[spec.name]
  }

  if (Object.keys(named).length > 0) next.named = named
  else delete next.named

  return next
}

// ── Config Update ──

export interface ConfigRequestOptions {
  directory?: string
  isCurrentDirectory?: (directory: string) => boolean
  ownsResponse?: () => boolean
}

export function currentProjectConfigRequestOptions(): ConfigRequestOptions {
  const directory = activeProjectDirectory().trim()
  if (!directory) throw new Error("Project config update requires an active directory")
  return {
    directory,
    isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
  }
}

function configRequestPath(options: ConfigRequestOptions = {}): string {
  const directory = options.directory?.trim()
  return directory ? `config?directory=${encodeURIComponent(directory)}` : "config"
}

function configResponseStillOwned(options: ConfigRequestOptions): boolean {
  const directory = options.directory?.trim()
  const ownsDirectory = !directory || !options.isCurrentDirectory || options.isCurrentDirectory(directory)
  return ownsDirectory && (!options.ownsResponse || options.ownsResponse())
}

function committedConfigFromError(error: unknown): Record<string, any> | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return undefined
  const data = (error.body as { data?: unknown }).data
  if (!data || typeof data !== "object") return undefined
  const receipt = data as { committed?: unknown; config?: unknown }
  if (receipt.committed !== true || !receipt.config || typeof receipt.config !== "object") return undefined
  return receipt.config as Record<string, any>
}

/**
 * Send a partial config diff to the server (JSON Merge Patch).
 * Updates appStore.config with the server response.
 */
export async function patchConfig(diff: Record<string, any>, options: ConfigRequestOptions = {}): Promise<any> {
  if (!appStore.connected) throw new Error("Cannot patch config while disconnected")
  let saved: Record<string, any>
  try {
    saved = await apiJson(configRequestPath(options), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diff),
    })
  } catch (error) {
    const committed = committedConfigFromError(error)
    if (committed && configResponseStillOwned(options)) setAppStore("config", committed)
    throw error
  }
  if (configResponseStillOwned(options)) setAppStore("config", saved)
  return saved
}

export async function patchGlobalConfig(
  diff: Record<string, any>,
  options: Pick<ConfigRequestOptions, "ownsResponse"> = {},
): Promise<any> {
  if (!appStore.connected) throw new Error("Cannot patch global config while disconnected")
  try {
    return await apiJson("global/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diff),
    })
  } catch (error) {
    const committed = committedConfigFromError(error)
    if (committed && configResponseStillOwned(options)) setAppStore("config", committed)
    throw error
  }
}

export interface SessionConfigResponse {
  config: Record<string, any>
  origin: Record<string, any>
}

export interface TaskOperatorModelContext {
  taskID: string
  sessionID: string
  agent: string
  model: {
    providerID: string
    modelID: string
  }
}

export type ProviderAccountUsageCapability = "monetary_balance" | "rate_limits"

export interface ProviderMonetaryBalanceUsage {
  kind: "monetary_balance"
  currency: "USD"
  limit: number
  used: number
  remaining: number
  exceeded: boolean
}

export interface ProviderRateLimitWindow {
  usedPercent: number
  remainingPercent: number
  windowMinutes: number
  resetsAt: number
}

export interface ProviderRateLimitsUsage {
  kind: "rate_limits"
  planType: string
  primary?: ProviderRateLimitWindow
  secondary?: ProviderRateLimitWindow
  credits?: {
    hasCredits: boolean
    unlimited: boolean
    balance?: string
  }
}

export type ProviderAccountUsage = ProviderMonetaryBalanceUsage | ProviderRateLimitsUsage

export type ProviderAccountUsageResponse =
  | { ok: true; usage: ProviderAccountUsage }
  | {
      ok: false
      error: {
        code:
          | "PROVIDER_USAGE_UNSUPPORTED"
          | "PROVIDER_CREDENTIAL_REQUIRED"
          | "PROVIDER_USAGE_REQUEST_FAILED"
          | "PROVIDER_USAGE_RESPONSE_INVALID"
        message: string
      }
    }

export interface SessionConfigRequest {
  sessionID: string
  directory: string
}

export interface SessionConfigPatchRequest extends SessionConfigRequest {
  diff: Record<string, any>
}

export interface TaskOperatorModelContextRequest {
  taskID: string
  directory: string
}

export interface DirectoryScopedRequest {
  directory: string
}

export interface NetworkProxyDraft {
  url: string
  llmProvider: boolean
  webResearch: boolean
  username?: string
  password?: string
}

export interface NetworkProxyTestResult {
  ok: boolean
  status: "connected" | "error"
  targetUrl: string
  statusCode?: number
  durationMs: number
  message: string
}

export function modelContextID(context: TaskOperatorModelContext | null | undefined): string {
  const providerID = context?.model?.providerID
  const modelID = context?.model?.modelID
  return providerID && modelID ? `${providerID}/${modelID}` : ""
}

const [sessionConfigRefreshTokenValue, setSessionConfigRefreshTokenValue] = createSignal(0)

export function sessionConfigRefreshToken(): number {
  return sessionConfigRefreshTokenValue()
}

export function markSessionConfigStale(_sessionID?: string): void {
  setSessionConfigRefreshTokenValue((value) => value + 1)
}

function directoryScopedPath(path: string, directory: string, label: string): string {
  const trimmed = directory.trim()
  if (!trimmed) throw new Error(`${label}: directory is required`)
  const params = new URLSearchParams({ directory: trimmed })
  return `${path}?${params.toString()}`
}

export async function getSessionConfig(input: SessionConfigRequest): Promise<SessionConfigResponse> {
  if (!appStore.connected) {
    throw new Error("Cannot load session config while disconnected")
  }
  const sessionID = input.sessionID.trim()
  if (!sessionID) throw new Error("getSessionConfig: sessionID is required")
  return await apiJson(
    directoryScopedPath(`session/${encodeURIComponent(sessionID)}/config`, input.directory, "getSessionConfig"),
  )
}

export async function patchSessionConfig(input: SessionConfigPatchRequest): Promise<SessionConfigResponse> {
  if (!appStore.connected) {
    throw new Error("Cannot patch session config while disconnected")
  }
  const sessionID = input.sessionID.trim()
  if (!sessionID) throw new Error("patchSessionConfig: sessionID is required")
  const saved = await apiJson(
    directoryScopedPath(`session/${encodeURIComponent(sessionID)}/config`, input.directory, "patchSessionConfig"),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.diff),
    },
  )
  markSessionConfigStale(sessionID)
  return saved
}

export async function getTaskOperatorModelContext(
  input: TaskOperatorModelContextRequest,
): Promise<TaskOperatorModelContext> {
  if (!appStore.connected) {
    throw new Error("Cannot load task operator model context while disconnected")
  }
  const taskID = input.taskID.trim()
  if (!taskID) throw new Error("getTaskOperatorModelContext: taskID is required")
  return await apiJson(
    directoryScopedPath(
      `task/${encodeURIComponent(taskID)}/operator-model-context`,
      input.directory,
      "getTaskOperatorModelContext",
    ),
  )
}

export async function getProviderAccountUsage(input: {
  providerID: string
  directory?: string
}): Promise<ProviderAccountUsageResponse> {
  if (!appStore.connected) {
    throw new Error("Cannot load Provider account usage while disconnected")
  }
  const providerID = input.providerID.trim()
  if (!providerID) throw new Error("getProviderAccountUsage: providerID is required")
  const path = input.directory?.trim()
    ? directoryScopedPath(
        `provider/${encodeURIComponent(providerID)}/account-usage`,
        input.directory,
        "getProviderAccountUsage",
      )
    : `global/providers/${encodeURIComponent(providerID)}/account-usage`
  return await apiJson(path)
}

export async function testNetworkProxy(proxy: NetworkProxyDraft): Promise<NetworkProxyTestResult> {
  if (!appStore.connected) {
    throw new Error("Cannot test network proxy while disconnected")
  }
  return await apiJson("config/proxy/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proxy }),
  })
}

export async function syncAgentPromptLocale(
  locale: string,
  options: ConfigRequestOptions = currentProjectConfigRequestOptions(),
): Promise<void> {
  await patchConfig({ locale: sanitizeLocale(locale) }, options)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function mergePatchDiff(before: unknown, after: unknown): unknown {
  if (!isRecord(before) || !isRecord(after)) {
    return sameJsonValue(before, after) ? undefined : after
  }

  const patch: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (!Object.hasOwn(after, key)) {
      patch[key] = null
      continue
    }
    const nextValue = after[key]
    if (nextValue === undefined) {
      patch[key] = null
      continue
    }
    if (!Object.hasOwn(before, key)) {
      patch[key] = nextValue
      continue
    }
    const child = mergePatchDiff(before[key], nextValue)
    if (child !== undefined) patch[key] = child
  }
  return Object.keys(patch).length > 0 ? patch : undefined
}

/**
 * Fetch the current server config, apply `mutator` to a clone, then PATCH the
 * resulting JSON Merge Patch back. Returns the saved config.
 * Use patchConfig() for simple field updates; use this for complex mutations
 * that need the current state (e.g., conditional delete of nested keys).
 */
export async function updateConfig(
  mutator: (config: Record<string, any>) => void,
  options: ConfigRequestOptions = {},
): Promise<any> {
  const configPath = configRequestPath(options)
  return await updateConfigPath(configPath, mutator, () => configResponseStillOwned(options))
}

export async function updateGlobalConfig(mutator: (config: Record<string, any>) => void): Promise<any> {
  return await updateConfigPath("global/config", mutator, () => !settingsStore.directory.trim())
}

async function updateConfigPath(
  configPath: string,
  mutator: (config: Record<string, any>) => void,
  ownsResponse: () => boolean,
): Promise<any> {
  const current = await apiJson(configPath)
  const next = structuredClone(current || {})
  mutator(next)
  const diff = mergePatchDiff(current || {}, next)
  if (diff === undefined) {
    if (ownsResponse()) setAppStore("config", current)
    return current
  }
  let saved: Record<string, any>
  try {
    saved = await apiJson(configPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diff),
    })
  } catch (error) {
    const committed = committedConfigFromError(error)
    if (committed && ownsResponse()) setAppStore("config", committed)
    throw error
  }
  if (ownsResponse()) setAppStore("config", saved)
  return saved
}

// ── Project Config Scaffold ──

/**
 * Write a default `opencorvus.jsonc` file into `dir/.opencorvus/` via the
 * Tauri `overlay_write_file` command. Silently no-ops when `dir` is empty.
 */
export async function scaffoldProjectConfig(dir: string): Promise<void> {
  if (!dir) return
  const base = dir.replace(/[\\/]+$/, "")
  const configFile = base + "/.opencorvus/opencorvus.jsonc"
  const username = settingsStore.username || ""
  // Scaffold intentionally leaves `assistant` empty so the server's
  // EngineConfig.DEFAULTS is the single source of truth. Writing explicit
  // values here would shadow DEFAULTS via the `??` merge in
  // packages/opencorvus/src/orchestrator/config.ts and silently drift over time.
  // Project authors who want to customize agent behavior should add fields
  // explicitly — the empty `{}` is just a discoverability hint.
  const config = {
    $schema: "https://opencorvus.ai/config.json",
    lsp: {
      biome: { disabled: true },
      eslint: { disabled: true },
    },
    assistant: {},
    compaction: {
      auto: true,
      prune: true,
    },
    agent: {},
    plugin: [],
    command: {},
    username,
  }
  try {
    await getHostTransport().native({
      kind: "config.write-file",
      path: configFile,
      content: JSON.stringify(config, null, 2),
    })
  } catch (e) {
    console.warn("[scaffold] Failed to scaffold project config", e)
  }
}

// ── Project Scope Reload ──

/**
 * Reset and then reload project-scope data (tasks, meta, extensions, config,
 * provider/config state). Delegates to the during the Solid migration; direct
 * port available for post-migration use.
 */
export async function reloadProjectScope(options: { restoreWorkspace?: boolean } = {}): Promise<ProjectLoadIssue[]> {
  const directory = activeProjectDirectory().trim()
  if (!directory) {
    clearTasksForMissingDirectory()
    return []
  }
  configureApi({ directory })
  const [configResult, extensionsResult, metaResult, tasksResult] = await Promise.allSettled([
    loadConfigInfo(undefined, {
      directory,
      isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
    }),
    loadExtensions({
      directory,
      isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
    }),
    loadMeta(),
    loadTasks(),
  ])
  if (activeProjectDirectory().trim() !== directory) return []
  const issues: ProjectLoadIssue[] = []
  const appendFailure = (resource: ProjectLoadIssue["resource"], result: PromiseSettledResult<unknown>) => {
    if (result.status === "rejected") {
      issues.push({
        resource,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
    }
  }
  appendFailure("config", configResult)
  appendFailure("extensions", extensionsResult)
  appendFailure("meta", metaResult)
  appendFailure("tasks", tasksResult)
  if (configResult.status === "fulfilled") {
    issues.push(
      ...configResult.value.map((issue) => ({
        resource: "config" as const,
        message: `${issue.resource}: ${issue.message}`,
      })),
    )
  }
  if (extensionsResult.status === "fulfilled") {
    issues.push(
      ...extensionsResult.value.issues.map((issue) => ({
        resource: "extensions" as const,
        message: `${issue.resource}: ${issue.message}`,
      })),
    )
  }
  setAppStore("projectLoadIssues", issues)
  for (const issue of issues) {
    AppLog.error("project-load", `${issue.resource} reload failed`, { directory, error: issue.message })
  }
  if (options.restoreWorkspace) {
    try {
      restoreWorkspaceDirectory()
    } catch (e: unknown) {
      console.error("[reloadProjectScope] restoreWorkspaceDirectory", e)
    }
  }
  return issues
}
