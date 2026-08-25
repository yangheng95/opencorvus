// ── Settings Store ──
// Solid reactive store for overlay settings.

import { createStore } from "solid-js/store"
import { DEFAULT_SERVER } from "../services/default-server"
import { PROJECT_EDITOR_IDS, type ProjectEditorID } from "../services/host-transport"
import { getHostTransport } from "../services/host-transport-runtime"
import { DEFAULT_THEME_ID, sanitizeThemeForHost, type OverlayThemeID } from "../services/theme-registry"
import type { PersistedOverlaySettings } from "../services/persisted-overlay-settings"
import { parsePersistedOverlaySettings } from "../services/persisted-overlay-settings"
import type { WorkLedgerOrganization, WorkLedgerSort } from "@opencorvus-ai/transport-protocol"
import { runtimeLocale, sanitizeLocale } from "../utils/i18n"

// ── Types ──

export interface OverlaySettings {
  serverUrl: string
  autoServer: boolean
  password: string
  username: string
  projectEditor: ProjectEditorID
  initGit: boolean
  sidebarCollapsed: boolean
  sidebarWidth: number | null
  rightDockWidth: number | null
  workLedgerOrganization: WorkLedgerOrganization
  workLedgerSort: WorkLedgerSort
  zoom: number
  theme: string
  locale: string
  /** Active working directory. Empty string means the user has not yet
   *  selected one; the UI must surface an explicit "select directory" CTA. */
  directory: string
  workspaceTaskID: string
  workspaceDirectory: string
  /** Last persisted directory value; used to detect uncommitted changes and
   *  restored on next cold start by loadSettings(). */
  savedDirectory: string
  /** Preferred IDE used by the workspace launcher and file-link open actions. */
  preferredProjectEditor: ProjectEditorID
  /** Incremented each time the workspace is invalidated/reset */
  workspaceEpoch: number
  /** Incremented each time the working directory changes */
  directoryEpoch: number
  /** Whether task lifecycle events may be delivered through the host OS notification surface. */
  desktopNotifications: boolean
}

// ── Sanitisers ──

function sanitizeTheme(value: unknown): OverlayThemeID {
  return sanitizeThemeForHost(value)
}

function settingsTheme(input: Partial<OverlaySettings>): string {
  if (typeof input?.theme === "string" && input.theme.trim()) {
    return sanitizeTheme(input.theme)
  }
  return DEFAULT_SETTINGS.theme
}

function sanitizeZoom(value: any): number {
  const n = parseFloat(String(value ?? ""))
  if (!Number.isFinite(n)) return 1
  return Math.min(1.6, Math.max(0.8, n))
}

function sanitizePaneWidth(value: any): number | null {
  const width = Math.round(Number(value))
  if (!Number.isFinite(width) || width <= 0) return null
  return width
}

function sanitizeWorkLedgerOrganization(value: unknown): WorkLedgerOrganization {
  if (value === "by-project" || value === "one-list") return value
  return DEFAULT_SETTINGS.workLedgerOrganization
}

function sanitizeWorkLedgerSort(value: unknown): WorkLedgerSort {
  if (value === "priority" || value === "updated" || value === "manual") return value
  return DEFAULT_SETTINGS.workLedgerSort
}

function defaultAutoServer(url: string): boolean {
  return !url || url === DEFAULT_SERVER
}

function sanitizeAutoServer(value: any, serverUrl: string): boolean {
  if (value === true || value === false) return value
  return defaultAutoServer(serverUrl)
}

export function sanitizeProjectEditor(value: any): ProjectEditorID {
  const text = String(value || "").trim()
  if (!text) return DEFAULT_SETTINGS.preferredProjectEditor
  if (PROJECT_EDITOR_IDS.includes(text as ProjectEditorID)) return text as ProjectEditorID
  throw new Error(`invalid project editor id: ${text}`)
}

// ── Default locale ──

const DEFAULT_LOCALE = runtimeLocale()

// ── Defaults ──

export const DEFAULT_THEME = DEFAULT_THEME_ID

export const DEFAULT_SETTINGS: OverlaySettings = {
  serverUrl: DEFAULT_SERVER,
  autoServer: true,
  password: "",
  username: "opencorvus",
  projectEditor: "vscode",
  initGit: true,
  sidebarCollapsed: false,
  sidebarWidth: null,
  rightDockWidth: null,
  workLedgerOrganization: "by-project",
  workLedgerSort: "updated",
  zoom: 1,
  theme: DEFAULT_THEME,
  locale: DEFAULT_LOCALE,
  directory: "",
  workspaceTaskID: "",
  workspaceDirectory: "",
  savedDirectory: "",
  preferredProjectEditor: "vscode",
  workspaceEpoch: 0,
  directoryEpoch: 0,
  desktopNotifications: true,
}

// ── Store ──

export const [settingsStore, setSettingsStore] = createStore<OverlaySettings>({ ...DEFAULT_SETTINGS })

export interface SettingsSaveAction {
  overrides?: Partial<OverlaySettings>
  onFailure?: (input: { error: unknown; confirmed: Readonly<PersistedOverlaySettings> }) => void
}

type SettingsSaveOutcome = { kind: "saved"; payload: PersistedOverlaySettings } | { kind: "failed"; error: unknown }

let settingsSaveTail = Promise.resolve()
let confirmedPersistedSettings: PersistedOverlaySettings | undefined

export function confirmedPersistedSettingsSnapshot(): Readonly<PersistedOverlaySettings> {
  if (!confirmedPersistedSettings) {
    throw new Error("Confirmed persisted settings are unavailable before settings.load completes")
  }
  return confirmedPersistedSettings
}

// ── applySettings ──

export function applySettings(input: Partial<OverlaySettings>): void {
  const workspaceTaskID =
    typeof input?.workspaceTaskID === "string" ? input.workspaceTaskID.trim() : DEFAULT_SETTINGS.workspaceTaskID
  const serverUrl =
    typeof input?.serverUrl === "string" && input.serverUrl.trim() ? input.serverUrl.trim() : DEFAULT_SETTINGS.serverUrl

  setSettingsStore({
    serverUrl,
    autoServer: sanitizeAutoServer(input?.autoServer, serverUrl),
    password: typeof input?.password === "string" ? input.password : DEFAULT_SETTINGS.password,
    username:
      typeof input?.username === "string" && input.username.trim() ? input.username.trim() : DEFAULT_SETTINGS.username,
    projectEditor: sanitizeProjectEditor(input?.projectEditor),
    initGit: typeof input?.initGit === "boolean" ? input.initGit : DEFAULT_SETTINGS.initGit,
    sidebarCollapsed:
      typeof input?.sidebarCollapsed === "boolean" ? input.sidebarCollapsed : DEFAULT_SETTINGS.sidebarCollapsed,
    sidebarWidth: sanitizePaneWidth(input?.sidebarWidth),
    rightDockWidth: sanitizePaneWidth(input?.rightDockWidth),
    workLedgerOrganization: sanitizeWorkLedgerOrganization(input?.workLedgerOrganization),
    workLedgerSort: sanitizeWorkLedgerSort(input?.workLedgerSort),
    zoom: sanitizeZoom(input?.zoom),
    theme: settingsTheme(input ?? {}),
    locale: sanitizeLocale((typeof input?.locale === "string" ? input.locale : "") || DEFAULT_SETTINGS.locale),
    directory: typeof input?.directory === "string" ? input.directory.trim() : "",
    workspaceTaskID,
    workspaceDirectory:
      typeof input?.workspaceDirectory === "string"
        ? input.workspaceDirectory.trim()
        : DEFAULT_SETTINGS.workspaceDirectory,
    preferredProjectEditor: sanitizeProjectEditor((input as any)?.preferredProjectEditor),
    desktopNotifications: input?.desktopNotifications !== false,
  })
}

// ── saveSettings ──

export async function saveSettings(action: SettingsSaveAction = {}): Promise<void> {
  const previous = settingsSaveTail
  let release!: () => void
  settingsSaveTail = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    const snapshot = { ...settingsStore, ...action.overrides }
    const payload = bootstrapOverlaySettings(snapshot)
    const outcome: SettingsSaveOutcome = await (async () => {
      try {
        const saved = await getHostTransport().native({ kind: "settings.save", payload })
        if (saved !== true) throw new Error("settings.save did not confirm persistence")
        return { kind: "saved", payload }
      } catch (error) {
        return { kind: "failed", error }
      }
    })()
    if (outcome.kind === "saved") {
      confirmedPersistedSettings = outcome.payload
      return
    }
    if (action.onFailure) {
      if (!confirmedPersistedSettings) {
        throw new Error("settings save failure callback requires a confirmed persisted settings snapshot", {
          cause: outcome.error,
        })
      }
      try {
        action.onFailure({ error: outcome.error, confirmed: confirmedPersistedSettings })
      } catch (callbackError) {
        throw new AggregateError([outcome.error, callbackError], "settings save and failure callback both failed")
      }
    }
    throw outcome.error
  } finally {
    release()
  }
}

// ── loadSettings ──

export async function loadSettings(): Promise<void> {
  const persisted = await getHostTransport().native({ kind: "settings.load" })
  if (persisted && typeof persisted === "object" && !Array.isArray(persisted)) {
    const settings = parsePersistedOverlaySettings(persisted)
    applySettings(settings)
    setSavedDirectory(savedDirectoryValue(settings.directory))
    confirmedPersistedSettings = bootstrapOverlaySettings(settingsStore)
    return
  }
  if (persisted !== null && persisted !== undefined) {
    throw new Error("settings.load returned a non-object payload")
  }
  applySettings({ ...DEFAULT_SETTINGS, theme: settingsTheme({}) })
  setSavedDirectory(DEFAULT_SETTINGS.savedDirectory)
  confirmedPersistedSettings = bootstrapOverlaySettings(settingsStore)
}

// ── Runtime setters ──

export function setSavedDirectory(path: string): void {
  setSettingsStore("savedDirectory", typeof path === "string" ? path : "")
}

export function bumpWorkspaceEpoch(): void {
  setSettingsStore("workspaceEpoch", (n) => n + 1)
}

export function bumpDirectoryEpoch(): void {
  setSettingsStore("directoryEpoch", (n) => n + 1)
}

// ── Directory helpers ──

export function savedDirectoryValue(directory: any): string {
  const next = typeof directory === "string" ? directory.trim() : ""
  return next
}

export function settingsDirectory(settings: Partial<OverlaySettings> | null | undefined): string {
  return typeof settings?.directory === "string" ? settings.directory.trim() : ""
}

// ── bootstrapOverlaySettings ──

export function bootstrapOverlaySettings(input: Partial<OverlaySettings> = settingsStore): PersistedOverlaySettings {
  const workspaceTaskID = input.workspaceTaskID || undefined
  return parsePersistedOverlaySettings({
    serverUrl: input.serverUrl ?? DEFAULT_SETTINGS.serverUrl,
    autoServer: input.autoServer ?? DEFAULT_SETTINGS.autoServer,
    password: input.password ?? DEFAULT_SETTINGS.password,
    username: input.username ?? DEFAULT_SETTINGS.username,
    projectEditor: sanitizeProjectEditor(input.projectEditor),
    initGit: input.initGit ?? DEFAULT_SETTINGS.initGit,
    sidebarCollapsed: input.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed,
    sidebarWidth: sanitizePaneWidth(input.sidebarWidth) ?? undefined,
    rightDockWidth: sanitizePaneWidth(input.rightDockWidth) ?? undefined,
    workLedgerOrganization: sanitizeWorkLedgerOrganization(input.workLedgerOrganization),
    workLedgerSort: sanitizeWorkLedgerSort(input.workLedgerSort),
    zoom: input.zoom ?? DEFAULT_SETTINGS.zoom,
    theme: sanitizeTheme(input.theme ?? DEFAULT_SETTINGS.theme),
    locale: input.locale ?? DEFAULT_SETTINGS.locale,
    desktopNotifications: input.desktopNotifications ?? DEFAULT_SETTINGS.desktopNotifications,
    directory: input.savedDirectory || undefined,
    preferredProjectEditor: sanitizeProjectEditor(input.preferredProjectEditor),
    workspaceTaskID,
    workspaceDirectory: input.workspaceDirectory || undefined,
  })
}

// ── Workspace memory helpers ──

export function workspaceRestoreDirectory(value: any): string {
  const text = typeof value === "string" ? value.trim() : ""
  return text
}
