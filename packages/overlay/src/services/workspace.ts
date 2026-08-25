// ── Workspace Service ──
// Responsibilities:
// - Manage the active workspace directory (custom vs. temp vs. task-scoped)
// - Compute the current workspace mode ("offline" | "task" | "empty")
// - Enter / clear workspace contexts (empty workspace, task workspace)
// - Clear board/agent runtime state when switching workspaces
// - Clear project-scope data (tasks, path, vcs, memory files)
// - Directory pick / browse (Tauri-backed)
// - Recent directories persistence (localStorage)
// This module operates on Solid stores (settingsStore, boardStore) and
// delegates timers / loading to callers via callbacks.

import { batch } from "solid-js"
import { bumpWorkspaceEpoch, saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { boardStore, setBoardStore, activeTaskID, clearTasksForMissingDirectory } from "../store/board"
import { abortChatRequest } from "../store/messages"
import { clearConversationUiState } from "../store/conversation-ui"
import { appStore, setAppStore } from "../store/app"
import { fileReferenceRange, type FileReferenceLocation } from "../utils/file-reference"
import { projectDirectoryKey } from "../utils/project-directory"
import { AppLog } from "../utils/log"
import { t } from "../utils/i18n"
import { apiJson, ApiError, configure as configureApi, serverSettledRequest } from "./api"
import { getHostTransport } from "./host-transport-runtime"
import type { ProjectEditorID } from "./host-transport"
import { nativeMessage, showAppDialog } from "./app-dialog"
import { nativeOpen } from "../utils/native"
import { checkConnection } from "./connection"
import { reloadProjectScope } from "./config"
import { stopSSE } from "./sse"
import { refreshProjectMemory } from "./project-memory"
import { activeProjectDirectory, restoreWorkspaceDirectory, setProjectDirectoryContext } from "./project-directory"
import { directoryScopedPath } from "./task-path"
import { cancelConversationReplay, resetConversationProjection } from "./conversation"
import { clearBrowserPreviewRevisionCursors } from "./browser-preview"
import { clearComposerModelProjection } from "./composer-model"
import { initializeProjectDirectoryGit } from "./project-git"
import {
  TaskCancellationRequestBody,
  type TaskCancellationRequestBody as TaskCancellationRequestBodyValue,
} from "@opencorvus-ai/transport-protocol"

// ── Types ──

export type WorkspaceMode = "offline" | "task" | "empty"

export interface ProjectEditor {
  id: ProjectEditorID
  label: string
}

export interface DiscoveredProject {
  id?: string
  directory: string
  name: string
  marker: string
}

export interface ProjectDiscovery {
  root: string
  defaultDirectory: string
  projects: DiscoveredProject[]
}

// IDE means Integrated Development Environment; these IDs are the public
// choices surfaced by the workspace UI and handled by the native host.
export const PROJECT_EDITORS: ProjectEditor[] = [
  { id: "vscode", label: "VS Code" },
  { id: "pycharm", label: "PyCharm" },
  { id: "webstorm", label: "WebStorm" },
  { id: "intellij", label: "IntelliJ IDEA" },
  { id: "cursor", label: "Cursor" },
]

export interface EnterEmptyWorkspaceOptions {
  /** When false, the saved/temp directory is NOT restored. Defaults to true. */
  restoreDirectory?: boolean
}

// ── Module-level task sequence ──

let tasksSeq = 0
let globalComposerProjectAllocation: Promise<string> | null = null

// ── Internal: schedule-board timer (
// These timers are held here so clearWorkspaceRuntime can cancel them.

let boardKickTimer: ReturnType<typeof setTimeout> | null = null
let tasksKickTimer: ReturnType<typeof setTimeout> | null = null

export function setBoardKickTimer(timer: ReturnType<typeof setTimeout> | null): void {
  boardKickTimer = timer
}

export function setTasksKickTimer(timer: ReturnType<typeof setTimeout> | null): void {
  tasksKickTimer = timer
}

export function getBoardKickTimer(): ReturnType<typeof setTimeout> | null {
  return boardKickTimer
}

export function getTasksKickTimer(): ReturnType<typeof setTimeout> | null {
  return tasksKickTimer
}

// ── workspaceMode ──

/**
 * Compute the current workspace mode based on reactive store state.
 * - "offline" — not connected to the server
 * - "task" — a task is selected
 * - "empty" — connected but no task selected
 * Mirrors workspace.js workspaceMode.
 */
export function workspaceMode(): WorkspaceMode {
  if (!activeTaskID() && !boardStore.board) {
    // Check app connection state — treat no-board as offline proxy
    // Real connected flag lives in appStore, but workspace.js keyed off
    // state.connected. We approximate using boardStore + presence of data.
    // Callers that need a precise offline check should read appStore.connected
    // directly.
  }
  // Use the selected task source as the primary signal
  if (activeTaskID()) return "task"
  return "empty"
}

/**
 * Compute the workspace mode with an explicit connected flag.
 * Mirrors workspace.js workspaceMode more precisely when the caller can
 * supply the connection status.
 */
export function workspaceModeWithConnection(connected: boolean): WorkspaceMode {
  if (!connected) return "offline"
  if (activeTaskID()) return "task"
  return "empty"
}

// ── hasWorkspaceSelection ──

/**
 * Returns true when a task is currently selected.
 * Mirrors workspace.js hasWorkspaceSelection.
 */
export function hasWorkspaceSelection(): boolean {
  return !!activeTaskID()
}

// ── enterSessionWorkspace ──

/**
 * Session workspaces are no longer supported by the overlay.
 * Throws unconditionally, mirroring workspace.js.
 */
export function enterSessionWorkspace(): never {
  throw new Error("Overlay no longer supports session workspaces")
}

// ── clearWorkspaceRuntime ──

/**
 * Clear all volatile runtime state associated with the current workspace
 * (board, messages, runtime events, pending timers).
 * Increments workspaceEpoch so any in-flight requests can detect staleness.
 */
function clearConversationRuntime(cause: string): void {
  abortChatRequest()
  cancelConversationReplay()
  clearConversationUiState()
  resetConversationProjection({ scrollIntent: "bottom", cause })
}

export function clearWorkspaceRuntime(): void {
  bumpWorkspaceEpoch()
  clearBrowserPreviewRevisionCursors()

  batch(() => {
    clearConversationRuntime("empty-workspace")

    // Cancel pending board/task schedule timers
    if (boardKickTimer !== null) {
      clearTimeout(boardKickTimer)
      boardKickTimer = null
    }
    if (tasksKickTimer !== null) {
      clearTimeout(tasksKickTimer)
      tasksKickTimer = null
    }

    tasksSeq += 1

    // Clear Solid board store
    setBoardStore({
      board: null,
      loading: false,
    })
  })
}

// ── clearProjectScopeData ──

/**
 * Clear project-scoped state that is tied to a directory/connection rather
 * than a single task.
 * Mirrors workspace.js clearProjectScopeData.
 * NOTE: tasks, globalTasks, path, vcs, memoryFiles, memorySearchMode
 * live. Only the boardStore tasks field is managed here; the remaining
 * fields are owned by for now.
 */
export function clearProjectScopeData(): void {
  clearTasksForMissingDirectory()
  setBoardStore({
    path: null,
    vcs: null,
    changes: [],
    planPreview: "",
    specPreview: "",
    taskSequence: 0,
    boardEtag: "",
    boardSyncPending: false,
    boardQueued: false,
    snapshotVersion: "",
    tasksError: "",
    tasksLoaded: true,
  })
  setAppStore({
    config: null,
    configLoadIssues: [],
    projectLoadIssues: [],
    providerCatalog: null,
    providerAuth: null,
    providerLoadIssues: [],
    providerTest: null,
    channels: [],
    skills: [],
    skillMounts: null,
    mcp: {},
    memoryFiles: [],
    memorySearchMode: false,
    projectMemory: null,
    criteriaSpecs: [],
  })
}

// ── closeProject ──

function enterDirectoryFreeWorkspace(savedDirectory: string): number {
  const selectionEpoch = beginWorkspaceSelection()
  clearComposerModelProjection()
  stopSSE()
  setSettingsStore("directoryEpoch", (n: number) => n + 1)
  setSettingsStore({
    directory: "",
    savedDirectory,
    workspaceTaskID: "",
    workspaceDirectory: "",
  })
  configureApi({ directory: "" })
  enterEmptyWorkspace({ restoreDirectory: false })
  clearProjectScopeData()
  return selectionEpoch
}

/**
 * Close the current project selection without deleting project data.
 * This is the single lifecycle path for Project -> Close Project.
 */
export async function closeProject(): Promise<void> {
  enterDirectoryFreeWorkspace("")
  await saveSettings()
}

/**
 * Enter the directory-free global launcher. Durable Project ownership begins
 * only when the operator submits actual content.
 */
export async function openGlobalChatLauncher(): Promise<void> {
  enterDirectoryFreeWorkspace(settingsStore.savedDirectory)
  setTimeout(() => document.querySelector<HTMLTextAreaElement>("#solidChatComposer textarea")?.focus(), 0)
}

/**
 * Leave a Project whose backend deletion already committed. Unlike the
 * explicit Close Project command, this does not allocate a replacement.
 */
export async function leaveDeletedProject(directory: string): Promise<void> {
  const deletedDirectory = directory.trim()
  if (!deletedDirectory || activeDirectory().trim() !== deletedDirectory) return
  const savedDirectory = settingsStore.savedDirectory.trim() === deletedDirectory ? "" : settingsStore.savedDirectory
  enterDirectoryFreeWorkspace(savedDirectory)
  await saveSettings()
}

/**
 * Resolve the canonical Project for durable global Composer input. Empty New
 * Chat remains write-free; a real attachment or Mission submission is the
 * first durable boundary. Concurrent attachment ingresses share one Project.
 */
export async function resolveGlobalComposerProject(): Promise<string> {
  const current = activeDirectory().trim()
  if (current) return current
  if (globalComposerProjectAllocation) return globalComposerProjectAllocation

  const selectionEpoch = beginWorkspaceSelection()
  const allocation = (async () => {
    const directory = await createAnonymousProject()
    if (!ownsWorkspaceSelection(selectionEpoch)) {
      throw new DOMException("Global Composer Project creation superseded", "AbortError")
    }
    const activated = await applyDirectory(directory, {
      save: false,
      persist: false,
      restoreWorkspace: false,
      selectionEpoch,
    })
    if (!activated || !ownsWorkspaceSelection(selectionEpoch)) {
      throw new DOMException("Global Composer Project activation superseded", "AbortError")
    }
    return directory
  })()
  globalComposerProjectAllocation = allocation
  try {
    return await allocation
  } finally {
    if (globalComposerProjectAllocation === allocation) globalComposerProjectAllocation = null
  }
}

export interface GlobalComposerSubmissionContext {
  directory: string
  model: string | undefined
}

/**
 * Snapshot the directory-free Composer model before Project activation can
 * replace the active frontend projection, then resolve its durable owner.
 */
export async function resolveGlobalComposerSubmissionContext(): Promise<GlobalComposerSubmissionContext> {
  const model = appStore.composerModel.trim() || undefined
  const directory = await resolveGlobalComposerProject()
  return { directory, model }
}

export interface ProjectDeleteResult {
  ok: true
  status: "committed" | "committed_with_residue"
  projectID: string
  directory: string
  deletedTaskCount: number
  residue: Array<{ path: string; message: string }>
}

export type ProjectDeleteOutcome =
  | { status: "deleted"; result: ProjectDeleteResult }
  | { status: "already_absent"; directory: string }

const projectDeletionOperations = new Map<string, Promise<ProjectDeleteOutcome>>()

export interface ProjectRenameResult {
  id: string
  worktree: string
  name: string
}

export interface AnonymousProjectPromotionResult {
  project: ProjectRenameResult
  sourceDirectory: string
  directory: string
  cleanupPending: boolean
}

export async function promoteAnonymousProject(
  directory: string,
  destinationParent: string,
  name: string,
): Promise<AnonymousProjectPromotionResult> {
  const source = directory.trim()
  const parent = destinationParent.trim()
  const projectName = name.trim()
  if (!source || !parent || !projectName)
    throw new Error("Anonymous project conversion requires source, parent, and name")
  const query = new URLSearchParams({ directory: source })
  const result: unknown = await apiJson(`project/current/promote-anonymous?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationParent: parent, name: projectName }),
  })
  if (
    !result ||
    typeof result !== "object" ||
    typeof (result as Record<string, unknown>).directory !== "string" ||
    typeof (result as Record<string, unknown>).sourceDirectory !== "string" ||
    typeof (result as Record<string, unknown>).cleanupPending !== "boolean"
  ) {
    throw new Error("POST project/current/promote-anonymous returned an invalid result")
  }
  return result as AnonymousProjectPromotionResult
}

/** Rename one project record without renaming its workspace directory. */
export async function renameProjectRecord(directory: string, name: string): Promise<ProjectRenameResult> {
  const projectDirectory = directory.trim()
  const projectName = name.trim()
  if (!projectDirectory) throw new Error("renameProjectRecord requires a project directory")
  if (!projectName) throw new Error("renameProjectRecord requires a project name")
  const query = new URLSearchParams({ directory: projectDirectory })
  const result: unknown = await apiJson(`project/current?${query.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName }),
  })
  if (
    !result ||
    typeof result !== "object" ||
    typeof (result as Record<string, unknown>).id !== "string" ||
    typeof (result as Record<string, unknown>).worktree !== "string" ||
    typeof (result as Record<string, unknown>).name !== "string" ||
    !(result as Record<string, unknown>).name
  ) {
    throw new Error("PATCH project/current returned an invalid ProjectRenameResult")
  }
  return result as ProjectRenameResult
}

/**
 * Delete one project's OpenCorvus-owned state through the canonical backend
 * lifecycle. The workspace source directory is intentionally outside that
 * endpoint's deletion boundary.
 */
export async function deleteProjectState(
  directory: string,
  provenance: TaskCancellationRequestBodyValue,
): Promise<ProjectDeleteOutcome> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error("deleteProjectState requires a project directory")
  const body = TaskCancellationRequestBody.parse(provenance)
  const operationKey = projectDirectoryKey(projectDirectory)
  const existing = projectDeletionOperations.get(operationKey)
  if (existing) return existing

  const operation = (async (): Promise<ProjectDeleteOutcome> => {
    const query = new URLSearchParams({ directory: projectDirectory })
    let result: unknown
    try {
      result = await apiJson(
        `project/current?${query.toString()}`,
        serverSettledRequest({
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return { status: "already_absent", directory: projectDirectory }
      }
      throw error
    }
    if (
      !result ||
      typeof result !== "object" ||
      (result as Record<string, unknown>).ok !== true ||
      typeof (result as Record<string, unknown>).projectID !== "string" ||
      typeof (result as Record<string, unknown>).directory !== "string" ||
      !["committed", "committed_with_residue"].includes(String((result as Record<string, unknown>).status)) ||
      (() => {
        const residue = (result as Record<string, unknown>).residue
        return (
          !Array.isArray(residue) ||
          residue.some(
            (item) =>
              !item ||
              typeof item !== "object" ||
              typeof (item as Record<string, unknown>).path !== "string" ||
              typeof (item as Record<string, unknown>).message !== "string",
          )
        )
      })() ||
      !Number.isInteger((result as Record<string, unknown>).deletedTaskCount) ||
      Number((result as Record<string, unknown>).deletedTaskCount) < 0
    ) {
      throw new Error("DELETE project/current returned an invalid ProjectDeleteResult")
    }
    return { status: "deleted", result: result as ProjectDeleteResult }
  })()
  projectDeletionOperations.set(operationKey, operation)
  try {
    return await operation
  } finally {
    if (projectDeletionOperations.get(operationKey) === operation) projectDeletionOperations.delete(operationKey)
  }
}

// ── enterEmptyWorkspace ──

/**
 * Switch to the "empty" workspace (no task selected).
 * - Clears the selected source.
 * - Optionally restores the saved/temp directory.
 * - Clears all runtime state.
 * Mirrors workspace.js enterEmptyWorkspace.
 */
export function enterEmptyWorkspace(options: EnterEmptyWorkspaceOptions = {}): void {
  batch(() => {
    setBoardStore("selectedSource", null)
    if (options.restoreDirectory !== false) {
      restoreWorkspaceDirectory()
    }
    clearWorkspaceRuntime()
  })
}

// ── Epoch / sequence accessors ──

/** Returns the current workspace epoch (incremented on every runtime clear). */
export function getWorkspaceEpoch(): number {
  return settingsStore.workspaceEpoch
}

/** Returns the current tasks sequence number (incremented on every runtime clear). */
export function getTasksSeq(): number {
  return tasksSeq
}

/** Produce a user-facing error message: translated key + error detail. */
function errorText(key: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? "")
  return `${t(key)}: ${detail}`
}

// ── Path utilities (internal) ──

function absolutePath(value: string): boolean {
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(value)
}

function joinPath(base: string, value: string): string {
  if (!base) return value
  if (absolutePath(value)) return value
  if (/[\\/]$/.test(base)) return `${base}${value}`
  const sep = base.includes("\\") ? "\\" : "/"
  return `${base}${sep}${value}`
}

function clearSelectedWorkItem(): void {
  clearConversationRuntime("project-selection")
  setBoardStore({
    selectedSource: null,
    board: null,
    loading: false,
    taskSwitching: false,
    taskSequence: 0,
    boardEtag: "",
    boardSyncPending: false,
    boardQueued: false,
    snapshotVersion: "",
  })
}

// ── Tauri file / directory pickers ──

/** Open a native directory picker. Returns the selected path, or an empty string when cancelled. */
export async function pickDirectory(start?: string): Promise<string> {
  const selected = await getHostTransport().native({ kind: "workspace.pickDir", start })
  if (selected === null || selected === undefined) return ""
  if (typeof selected !== "string") throw new Error("workspace.pickDir returned a non-string payload")
  return selected
}

/** Open a native multi-file picker. Returns the array of selected paths. */
export async function pickFiles(start?: string): Promise<string[]> {
  const result = await getHostTransport().native({
    kind: "workspace.pickFiles",
    start,
    multiple: true,
  })
  if (result === null || result === undefined) return []
  if (!Array.isArray(result) || result.some((item) => typeof item !== "string")) {
    throw new Error("workspace.pickFiles returned a non-string-array payload")
  }
  return result
}

// ── Directory helper functions ──

/**
 * Returns the currently active working directory for project-scoped UI.
 */
export function activeDirectory(): string {
  return activeProjectDirectory()
}

export function syncActiveDirectoryApiContext(): string {
  const directory = activeDirectory()
  configureApi({ directory })
  return directory
}

// ── Recent directories ──

const RECENT_DIRS_KEY = "oc_recent_directories"
const MAX_RECENT_DIRS = 10

/**
 * Load the recent-directories list from localStorage.
 * Returns a plain array of trimmed path strings.
 */
export function loadRecentDirectories(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === "string" && (d as string).trim()) : []
  } catch {
    return []
  }
}

/**
 * Persist the given array of directory paths to localStorage.
 */
export function saveRecentDirectories(dirs: string[]): void {
  try {
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs))
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Prepend `dir` to the recent-directories list (deduplicating by case-
 * insensitive comparison) and persist.
 */
export function addRecentDirectory(dir: string): void {
  if (!dir || typeof dir !== "string") return
  const normalized = dir.trim()
  if (!normalized) return
  const dirs = loadRecentDirectories().filter((d) => d.toLowerCase() !== normalized.toLowerCase())
  dirs.unshift(normalized)
  saveRecentDirectories(dirs.slice(0, MAX_RECENT_DIRS))
}

export async function loadDiscoveredProjects(): Promise<ProjectDiscovery> {
  const result = await apiJson("global/projects/discover")
  const root = typeof result?.root === "string" ? result.root : ""
  const defaultDirectory = typeof result?.defaultDirectory === "string" ? result.defaultDirectory.trim() : ""
  const projects = Array.isArray(result?.projects)
    ? result.projects
        .filter((item: any) => item && typeof item.directory === "string" && typeof item.name === "string")
        .map((item: any) => ({
          id: typeof item.id === "string" ? item.id : undefined,
          directory: String(item.directory),
          name: String(item.name),
          marker: typeof item.marker === "string" ? item.marker : "",
        }))
    : []
  return { root, defaultDirectory, projects }
}

// ── applyDirectory ──

export interface ApplyDirectoryOptions {
  /** Explicit caller cancellation; ordinary wall-clock time does not cancel project mutations. */
  signal?: AbortSignal
  /** Shared selection intent that must still own boardStore.selectEpoch. */
  selectionEpoch?: number
  /**
   * When true, `next` is written as the saved directory.
   * When false, the saved directory is cleared.
   * When omitted (null/undefined), the saved directory is unchanged.
   */
  save?: boolean
  /**
   * When false, skip persisting overlay settings after the switch.
   * Defaults to true.
   */
  persist?: boolean
  /**
   * When false, skip restoring the initial workspace after the reload.
   * Defaults to true.
   */
  restoreWorkspace?: boolean
  /**
   * Internal task-selection handoff: selectTask owns the target task hydrate
   * after a cross-directory switch, so it keeps selection lifecycle control.
   * Manual directory switches must leave this unset so stale task ids cannot
   * survive after project projections are cleared.
   */
  preserveSelection?: boolean
}

/**
 * Switch the active working directory, update related store fields, and
 * trigger a project-scope reload via the .
 */
export function beginWorkspaceSelection(): number {
  const epoch = boardStore.selectEpoch + 1
  setBoardStore("selectEpoch", epoch)
  return epoch
}

/**
 * Transfer selection ownership to a non-work-item surface. A stable selected
 * work item remains available when the operator returns, while a partially
 * hydrated selection is cleared so its former owner cannot leave a stuck busy
 * projection behind.
 */
export function supersedePendingWorkspaceSelection(): number {
  const pending = boardStore.taskSwitching
  const epoch = beginWorkspaceSelection()
  if (!pending) return epoch
  stopSSE()
  clearComposerModelProjection()
  clearSelectedWorkItem()
  return epoch
}

export function ownsWorkspaceSelection(epoch: number): boolean {
  return boardStore.selectEpoch === epoch
}

export async function applyDirectory(next: string, options: ApplyDirectoryOptions = {}): Promise<boolean> {
  const selectionEpoch = options.selectionEpoch ?? beginWorkspaceSelection()
  if (!ownsWorkspaceSelection(selectionEpoch)) return false
  const save = options.save === true ? next : options.save === false ? "" : null

  const curDir = settingsStore.directory
  const curSaved = settingsStore.savedDirectory

  if (next === curDir && (save === null || save === curSaved)) {
    if (options.preserveSelection !== true) {
      stopSSE()
      clearSelectedWorkItem()
    }
    console.log("[applyDir] skipped (same)", { next, save, dir: curDir, saved: curSaved })
    return true
  }

  console.log("[applyDir] checking connection")
  const ok = await checkConnection({ background: true })
  if (!ownsWorkspaceSelection(selectionEpoch)) return false
  if (!ok) {
    console.warn("[applyDir] connection failed, rejecting switch")
    throw new Error("Failed to set directory")
  }

  console.log("[applyDir] switching", { from: curDir, to: next, save })

  stopSSE()
  if (options.preserveSelection !== true) {
    clearSelectedWorkItem()
  }
  setSettingsStore("directoryEpoch", (n: number) => n + 1)
  setSettingsStore("directory", next)
  if (save !== null) setSettingsStore("savedDirectory", save)

  // Sync the API client's directory context immediately so all subsequent
  // API calls (checkConnection, reloadProjectScope, etc.) target the new
  // directory on the backend.
  configureApi({ directory: next })
  setBoardStore("pendingTasks", [])

  // Directory switching is the other project-identity ingress beside startup.
  // Initialize before any project-scoped load can cache a non-Git Instance;
  // changing Git identity after Mission/Chat execution begins would require an
  // exclusive refresh behind their long-lived project lease.
  if (settingsStore.initGit) {
    await initializeProjectDirectoryGit(next, { signal: options.signal })
    if (!ownsWorkspaceSelection(selectionEpoch)) return false
  }

  // Clear transient provider-test state so a result from the previous project
  // does not linger in the Settings › Providers panel after the switch. The
  // Provider owners load providerCatalog / providerAuth when their UI opens;
  // providerTest is user-triggered-only and otherwise never refreshed.
  setAppStore("providerTest", null)

  // Clear stale workspace memory so restoreInitialWorkspace() won't revert the switch.
  setSettingsStore("workspaceTaskID", "")
  setSettingsStore("workspaceDirectory", "")

  // Clear project-scope data (tasks list, messages, runtime events).
  clearProjectScopeData()

  if (options.persist !== false) {
    // Persist the cleared workspace memory through the settings owner before
    // the switch continues, so a reload cannot restore the previous directory.
    await saveSettings()
  }

  if (!ownsWorkspaceSelection(selectionEpoch)) return false

  if (options.save === true && next) addRecentDirectory(next)

  // Capture epoch before entering async phase — if another applyDirectory
  // call supersedes us while we await, our epoch will be stale.
  const epoch = settingsStore.directoryEpoch

  if (epoch !== settingsStore.directoryEpoch) {
    console.log("[applyDir] superseded after connection check, aborting")
    return false
  }

  console.log("[applyDir] reloading project scope")
  await reloadProjectScope(options)

  if (epoch !== settingsStore.directoryEpoch || !ownsWorkspaceSelection(selectionEpoch)) {
    console.log("[applyDir] superseded after reload, discarding")
    return false
  }
  void refreshProjectMemory().catch((error) =>
    AppLog.warn("project-memory", "Project MEMORY.MD status refresh failed", { error: String(error) }),
  )
  console.log("[applyDir] done, tasks=", boardStore.tasks.length)
  return true
}

// ── setActiveDirectory ──

/**
 * Set the active directory without persisting.
 * No-ops when `value` is empty or already equals the current directory.
 */
export async function setActiveDirectory(value: string, options: ApplyDirectoryOptions = {}): Promise<void> {
  const next = typeof value === "string" ? value.trim() : ""
  if (!next || next === settingsStore.directory) return
  await applyDirectory(next, { ...options, persist: false })
}

// ── browseDirectory ──

/**
 * Open a native directory picker and apply the selected directory.
 */
export async function browseDirectory(): Promise<void> {
  try {
    const host = getHostTransport()
    const selected = host.capabilities.ui.manualWorkspacePathEntry
      ? await showAppDialog({
          title: t("cwd.title"),
          message: t("work_ledger.tooltip.create.existing_folder"),
          input: true,
          inputLabel: t("cwd.path_label"),
          inputPlaceholder: t("cwd.path_placeholder"),
          inputValue: activeDirectory(),
          inputRequired: true,
          inputRequiredMessage: t("cwd.path_required"),
          cancel: true,
          okLabel: t("cwd.choose_level"),
        }).then((result) => (result.confirmed ? String(result.value || "").trim() : ""))
      : await pickDirectory(activeDirectory())
    if (!selected) return
    await setDirectory(selected)
  } catch (e) {
    AppLog.error("ui", "Failed to set working directory", { error: String(e) })
    await nativeMessage(errorText("cwd.set_failed", e), {
      title: t("cwd.title"),
      kind: "error",
    })
  }
}

// ── openDirectory ──

/**
 * Open the given directory (or the current active directory) with the
 * native OS file explorer.
 */
export async function openDirectory(target?: string): Promise<void> {
  const dir = target ?? activeDirectory()
  if (!dir) return
  try {
    await nativeOpen(dir)
  } catch (e) {
    AppLog.error("ui", "Failed to open working directory", { error: String(e) })
    await nativeMessage(errorText("cwd.open_failed", e), {
      title: t("cwd.title"),
      kind: "error",
    })
  }
}

// ── openDirectoryInEditor ──

/**
 * Open the given directory or file path (or the current active directory) with
 * the requested project editor.
 */
export async function openDirectoryInEditor(editor: ProjectEditorID, target?: string): Promise<void> {
  await openProjectPathInEditor(editor, target ?? activeDirectory())
}

/**
 * Open a project path (directory or file) in the selected IDE.
 * Relative paths are resolved against the active project directory.
 */
export async function openProjectPathInEditor(
  editor: ProjectEditorID,
  target?: string,
  location?: Partial<FileReferenceLocation>,
): Promise<void> {
  const rawTarget = typeof target === "string" ? target.trim() : ""
  if (!rawTarget) return
  const baseDirectory = activeDirectory()
  const resolvedTarget = absolutePath(rawTarget) ? rawTarget : baseDirectory ? joinPath(baseDirectory, rawTarget) : ""
  if (!resolvedTarget) return
  try {
    await getHostTransport().native({
      kind: "workspace.openProjectEditor",
      editor,
      path: resolvedTarget,
      ...(location?.line === undefined ? {} : { line: location.line }),
      ...(location?.line === undefined || location.column === undefined ? {} : { column: location.column }),
    })
  } catch (e) {
    const label = PROJECT_EDITORS.find((item) => item.id === editor)?.label ?? editor
    AppLog.error("ui", "Failed to open workspace path in editor", {
      editor,
      path: resolvedTarget,
      error: String(e),
    })
    await nativeMessage(errorText("cwd.open_editor_failed", e), {
      title: t("cwd.open_in_editor", { name: label }),
      kind: "error",
    })
  }
}

export async function openPathInSelectedEditor(target: string, location?: Partial<FileReferenceLocation>): Promise<void> {
  const path = editorTargetPath(target)
  if (!path) {
    if (typeof target === "string" && target.trim()) {
      await nativeMessage(t("cwd.path_required"), {
        title: t("cwd.title"),
        kind: "error",
      })
    }
    return
  }
  if (!getHostTransport().capabilities.nativeCommands["workspace.openProjectEditor"]) {
    await openProjectPathInWorkbench(target, location)
    return
  }
  await openProjectPathInEditor(settingsStore.projectEditor, path, location)
}

export async function openProjectFile(target: string, location?: Partial<FileReferenceLocation>): Promise<void> {
  const path = editorTargetPath(target)
  if (!path) {
    if (typeof target === "string" && target.trim()) {
      await nativeMessage(t("cwd.path_required"), {
        title: t("cwd.title"),
        kind: "error",
      })
    }
    return
  }
  // A cited line has no meaning to the OS file association, so a located
  // reference goes to the workbench, which can actually honour it.
  if (location?.line !== undefined || !getHostTransport().capabilities.nativeCommands["open-path"]) {
    await openProjectPathInWorkbench(target, location)
    return
  }
  await nativeOpen(path)
}

async function openProjectPathInWorkbench(target: string, location?: Partial<FileReferenceLocation>): Promise<void> {
  const directory = activeDirectory().trim()
  const rawTarget = typeof target === "string" ? target.trim() : ""
  if (!directory || !rawTarget) return
  const { openFileEditor, openSourceFileEditor } = await import("./file-workbench")
  const range = fileReferenceRange(location)
  if (isAbsoluteEditorPath(rawTarget)) {
    await openSourceFileEditor(rawTarget, { directory }, range)
    return
  }
  await openFileEditor(rawTarget, { directory }, range)
}

function isAbsoluteEditorPath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(path)
}

export function editorTargetPath(target: string): string {
  const path = typeof target === "string" ? target.trim() : ""
  if (!path || isAbsoluteEditorPath(path)) return path
  const base = activeDirectory().trim()
  if (!base) return ""
  const separator = base.includes("\\") ? "\\" : "/"
  return `${base.replace(/[\\/]+$/, "")}${separator}${path.replace(/^[\\/]+/, "")}`
}

// ── setDirectory ──

/**
 * Set the working directory to `value`. `value` must be a non-empty path the
 * user explicitly chose; passing an empty string throws rather than silently
 * creating a temp workspace (that fallback was removed — see CHANGELOG for
 * the temp-workspace deletion rationale).
 */
export async function setDirectory(value: string, options: ApplyDirectoryOptions = {}): Promise<void> {
  const next = typeof value === "string" ? value.trim() : ""
  if (!next) throw new Error(t("cwd.path_required"))
  await applyDirectory(next, { ...options, save: true })
}

// ── ensureDefaultDirectory ──

/**
 * Preserve the current runtime directory, restore the user's last explicit
 * directory, or select the server's explicit launch directory. A directory-free
 * startup remains write-free until the operator submits real work.
 */
export async function ensureDefaultDirectory(): Promise<boolean> {
  if (settingsStore.directory) return true
  if (settingsStore.savedDirectory) {
    setProjectDirectoryContext(settingsStore.savedDirectory, false)
    return true
  }
  const discovery = await loadDiscoveredProjects()
  setProjectDirectoryContext(discovery.defaultDirectory, false)
  return Boolean(discovery.defaultDirectory)
}

async function createAnonymousProject(): Promise<string> {
  const result: unknown = await apiJson("global/projects/anonymous", { method: "POST" })
  if (
    !result ||
    typeof result !== "object" ||
    typeof (result as Record<string, unknown>).directory !== "string" ||
    !(result as Record<string, string>).directory.trim()
  ) {
    throw new Error("global/projects/anonymous returned an invalid directory")
  }
  return (result as Record<string, string>).directory.trim()
}

/**
 * Ensure the workspace directory is resolved. Returns the active directory
 * resolved by `ensureDefaultDirectory()` from the current runtime, an explicit
 * saved choice, or the server's explicit launch directory. An unscoped startup
 * remains directory-free.
 */
export async function ensureWorkspaceDirectory(): Promise<string> {
  return activeDirectory()
}
