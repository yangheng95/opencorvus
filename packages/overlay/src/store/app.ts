// ── App Store ──
// Application-level state: connection status, theme, locale, zoom, and log
// entries. Complements the settings store with runtime/volatile state.

import { createStore, reconcile } from "solid-js/store"
import type { SkillMountsResponse } from "@opencorvus-ai/sdk"

// ── Types ──

export type LogLevel = "debug" | "info" | "warn" | "error"
export type LogSource = "overlay" | "server" | "pipeline"

export interface LogEntry {
  /** ISO timestamp string, e.g. "2026-03-25T10:00:00" */
  ts: string
  level: LogLevel
  /** Sub-system / service tag, e.g. "conn", "ui", "pipeline" */
  service: string
  /** Elapsed time string shown in the log line, e.g. "+123ms" */
  delta: string
  message: string
  fields: Record<string, unknown>
  /** Raw unparsed line (for server log lines) */
  raw: string
  source: LogSource
}

export type ConnectionStatus = "online" | "offline" | "connecting"

export interface ProviderLoadIssue {
  resource: "catalog" | "auth" | "config" | "provider"
  message: string
  phase?: string
  providerID?: string
}

export interface ConfigLoadIssue {
  resource: "config" | "channel"
  message: string
}

export interface ProjectLoadIssue {
  resource: "locale" | "tasks" | "meta" | "extensions" | "config"
  message: string
}

export interface NdjsonEvent {
  [key: string]: any
}

export interface AppState {
  connectionStatus: ConnectionStatus
  connected: boolean
  /** PID of the managed sidecar `bun` server process when overlay launched
   *  it (Tauri overlay_server_info `pid` field). Surfaced in the title-bar
   *  connection badge alongside the port so the operator can `kill <pid>` /
   *  `lsof -p <pid>` without scanning netstat. Undefined when the overlay
   *  is talking to an external server it didn't spawn. */
  serverPid?: number
  /** Resolved effective theme: "dark" | "light" | "vscode-dark" */
  theme: "dark" | "light" | "vscode-dark"
  locale: string
  /** User-configured zoom multiplier (0.8–1.6) */
  zoom: number
  /** All log entries accumulated for the current session */
  logEntries: LogEntry[]
  /** Current filter level for log display */
  logFilterLevel: LogLevel
  // ── i18n (mirrors state.i18n / state.i18nReady / state.localeSeq) ──
  /** Loaded translation dictionary for the active locale */
  i18n: Record<string, string>
  /** Whether i18n translations have been loaded and are ready for use */
  i18nReady: boolean
  /** Monotonic counter incremented on each locale reload; used to sequence async loads */
  localeSeq: number
  // ── App info ──
  /** Version string reported by the opencorvus core server */
  coreVersion: string
  /** Runtime-resolved on-disk paths the engine is using. Populated by
   *  /global/health response so debug tooling (task debug blob, support
   *  bundles) reads the actual single-source DB location instead of
   *  rebuilding a path template in the client. */
  enginePaths: { database: string; data: string; home: string } | null
  // ── Server-side config (mirrors state.config) ──
  /** Full server-side config object as returned by the /config API */
  config: any
  /** Independently settled config and channel catalogue load failures. */
  configLoadIssues: ConfigLoadIssue[]
  /** Non-fatal project bootstrap/reload failures, owned by their resource. */
  projectLoadIssues: ProjectLoadIssue[]
  /** Current draft or selected root Session model projected into the Composer. */
  composerModel: string
  // ── Providers ──
  /** LLM provider catalog from models.dev / server */
  providerCatalog: any
  /** Current provider authentication status */
  providerAuth: any
  /** Independently settled Provider resource and Provider-projection failures. */
  providerLoadIssues: ProviderLoadIssue[]
  /** Provider authentication refresh revision; increments after provider catalog/auth reloads. */
  providerAuthRefreshRevision: number
  /** Map of provider IDs whose auth prompt has been dismissed this session */
  providerAuthDismissed: Record<string, boolean>
  /** In-progress provider connectivity test state */
  providerTest: any
  // ── Extensions (mirrors state.channels / state.skills / state.skillMarket / state.mcp) ──
  /** Configured channel list */
  channels: any[]
  /** Installed skills list */
  skills: any[]
  /** Agent skill mount matrix returned by /skill/mounts */
  skillMounts: SkillMountsResponse | null
  /** Skill marketplace catalogue */
  skillMarket: any[]
  /** MCP (Model Control Protocol) config/status map keyed by name */
  mcp: Record<string, any>
  // ── NdjsonLog (mirrors state.ndjsonEvents / state.ndjsonStartMs) ──
  /** Raw ndjson log events accumulated for the current session */
  ndjsonEvents: NdjsonEvent[]
  /** Unix-ms timestamp at which the current ndjson log stream started */
  ndjsonStartMs: number
  // ── Memory / Knowledge (mirrors state.memoryFiles / state.memorySearchMode) ──
  /** Memory file entries loaded from the server */
  memoryFiles: any[]
  /** Whether the memory panel is in search mode */
  memorySearchMode: boolean
  // ── Criteria ──
  criteriaSpecs: any[]
}

// ── Defaults ──

const DEFAULT_APP_STATE: AppState = {
  connectionStatus: "offline",
  connected: false,
  serverPid: undefined,
  theme: "dark",
  locale: "en-US",
  zoom: 1,
  logEntries: [],
  logFilterLevel: "debug",
  i18n: {},
  i18nReady: false,
  localeSeq: 0,
  coreVersion: "",
  enginePaths: null,
  config: null,
  configLoadIssues: [],
  projectLoadIssues: [],
  composerModel: "",
  providerCatalog: null,
  providerAuth: null,
  providerLoadIssues: [],
  providerAuthRefreshRevision: 0,
  providerAuthDismissed: {},
  providerTest: null,
  channels: [],
  skills: [],
  skillMounts: null,
  skillMarket: [],
  mcp: {},
  ndjsonEvents: [],
  ndjsonStartMs: 0,
  memoryFiles: [],
  memorySearchMode: false,
  criteriaSpecs: [],
}

// ── Store ──

export const [appStore, setAppStore] = createStore<AppState>({ ...DEFAULT_APP_STATE })

// ── Log helpers ──

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MAX_LOG_ENTRIES = 2000

/** Append a single log entry, capping the buffer at MAX_LOG_ENTRIES. */
export function appendLog(entry: LogEntry): void {
  setAppStore("logEntries", (prev) => {
    const next = [...prev, entry]
    return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
  })
}

/** Clear all accumulated log entries. */
export function clearLog(): void {
  setAppStore("logEntries", [])
}

/** Return log entries filtered to at least the current filterLevel. */
export function filteredLogEntries(): LogEntry[] {
  const min = LOG_LEVEL_ORDER[appStore.logFilterLevel] ?? 0
  return appStore.logEntries.filter((e) => (LOG_LEVEL_ORDER[e.level] ?? 0) >= min)
}

// ── Connection helpers ──

export function setConnectionStatus(status: ConnectionStatus): void {
  setAppStore({
    connectionStatus: status,
    connected: status === "online",
  })
}

// ── i18n helpers ──

export function setI18n(dict: Record<string, string>, seq: number): void {
  setAppStore({ i18n: dict, i18nReady: true, localeSeq: seq })
}

export function setI18nReady(ready: boolean): void {
  setAppStore("i18nReady", ready)
}

export function setLocaleState(locale: string): void {
  setAppStore({
    locale,
    localeSeq: appStore.localeSeq + 1,
  })
}

// ── NdjsonLog helpers ──

const MAX_NDJSON_EVENTS = 5000

export function appendNdjsonEvent(event: NdjsonEvent): void {
  setAppStore("ndjsonEvents", (prev) => {
    const next = [...prev, event]
    return next.length > MAX_NDJSON_EVENTS ? next.slice(next.length - MAX_NDJSON_EVENTS) : next
  })
}

export function clearNdjsonEvents(): void {
  setAppStore({ ndjsonEvents: [], ndjsonStartMs: 0 })
}

export function setNdjsonStartMs(ms: number): void {
  setAppStore("ndjsonStartMs", ms)
}

export function dismissProviderAuth(providerID: string): void {
  setAppStore("providerAuthDismissed", (prev) => ({
    ...prev,
    [providerID]: true,
  }))
}

export function setProviderTest(test: any): void {
  setAppStore("providerTest", test ?? null)
}

// ── Extensions helpers ──

export function setChannels(list: any[]): void {
  setAppStore("channels", Array.isArray(list) ? list : [])
}

export function setSkills(list: any[]): void {
  setAppStore("skills", Array.isArray(list) ? list : [])
}

export function setSkillMounts(value: SkillMountsResponse | null): void {
  setAppStore("skillMounts", reconcile(value, { merge: false }))
}

export function setSkillMarket(list: any[]): void {
  setAppStore("skillMarket", Array.isArray(list) ? list : [])
}

export function setMcp(map: Record<string, any>): void {
  setAppStore("mcp", reconcile(map && typeof map === "object" && !Array.isArray(map) ? map : {}, { merge: false }))
}
