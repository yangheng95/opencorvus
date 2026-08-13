// ── Init Service ──
// Application startup sequence:
// - Load overlay settings from the active host persistence source
// - Load i18n locale data
// - Configure the API client
// - Check server connection
// - Load initial board / tasks / meta / config
// - Restore last workspace
// - Set up a periodic reconnect loop

import { configure as configureApi, apiJsonWithTimeout } from "./api"
import { checkConnection as checkServerConnection, startConnectionMonitor, stopConnectionMonitor } from "./connection"
import { startWorkLedgerSSE, stopSSE, stopWorkLedgerSSE } from "./sse"
import { loadAllLocales, setLocale } from "../utils/i18n"
import {
  loadSettings,
  settingsStore,
  setSettingsStore,
  saveSettings,
  bumpDirectoryEpoch,
  bumpWorkspaceEpoch,
} from "../store/settings"
import { boardStore, setBoardStore, loadTasks, clearTasksForMissingDirectory, activeTaskID } from "../store/board"
import { loadMeta } from "./meta"
import { loadExtensions } from "./extensions"
import { ensureWorkspaceDirectory } from "./workspace"
import { ensureDefaultDirectory } from "./workspace"
import { workspaceRestoreDirectory } from "../store/settings"
import { selectTask } from "./task"
import { currentTaskDeepLink, taskDeepLinkFromSearch } from "./task-deep-link"
import { CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS, loadConfigInfo } from "./config-load"
import { initializeActiveDirectoryGit } from "../utils/git"
import { setAppStore, type ProjectLoadIssue } from "../store/app"
import { AppLog } from "../utils/log"
import { refreshProjectMemory } from "./project-memory"

// ── Types ──

export interface InitOptions {
  /**
   * Called once the initial connection check succeeds so the caller can
   * trigger any render-side updates that depend on live data.
   */
  onConnected?: () => void | Promise<void>
  /**
   * Called after settings are loaded into settingsStore, before API, locale,
   * connection, and data initialization continue.
   */
  onSettingsLoaded?: () => void | Promise<void>
  /**
   * Called on every successful reconnect (after an offline period).
   */
  onReconnect?: () => void | Promise<void>
  /**
   * Reconnect poll interval in ms. Defaults to 10 000 (10 s).
   */
  reconnectInterval?: number
}

let initLifecycleGeneration = 0

function isCurrentInitLifecycle(generation: number): boolean {
  return generation === initLifecycleGeneration
}

/**
 * Push current settings into the API client so subsequent fetch calls use
 * the correct server URL and credentials.
 * Push current settings into the API client.
 */
function syncApiConfig(): void {
  configureApi({
    serverUrl: settingsStore.serverUrl,
    username: settingsStore.username,
    password: settingsStore.password,
    directory: settingsStore.directory,
  })
}

/**
 * Load all initial data that requires a live server connection.
 * Load all initial data in parallel after connection is established.
 */
interface InitialDataResult {
  loaded: boolean
  reconcileCapabilities?: () => Promise<void>
}

async function loadInitialData(
  lifecycleGeneration: number,
  resolveInitialDirectory: () => Promise<boolean>,
): Promise<InitialDataResult> {
  await resolveInitialDirectory()
  const directory = await ensureWorkspaceDirectory()
  syncApiConfig()
  if (!directory) {
    clearTasksForMissingDirectory()
    setBoardStore({
      board: null,
      path: null,
      vcs: null,
      changes: [],
    })
    return { loaded: false }
  }
  // Git must exist before the first project-scoped load can establish an
  // Instance/project_id. Initializing later can force an identity refresh
  // behind a live Chat or Mission lease and block conversation hydration.
  if (settingsStore.initGit) await initializeActiveDirectoryGit()
  const localeResult = await Promise.allSettled([
    apiJsonWithTimeout("config", CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: settingsStore.locale }),
    }),
  ])
  const [tasksResult, metaResult] = await Promise.allSettled([loadTasks(), loadMeta()])
  void refreshProjectMemory().catch((error) =>
    AppLog.warn("project-memory", "Project MEMORY.MD status refresh failed", { error: String(error) }),
  )
  if (settingsStore.directory.trim() !== directory) return { loaded: false }
  const issues: ProjectLoadIssue[] = []
  const appendFailure = (resource: ProjectLoadIssue["resource"], result: PromiseSettledResult<unknown>) => {
    if (result.status === "rejected") {
      issues.push({
        resource,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
    }
  }
  appendFailure("locale", localeResult[0]!)
  appendFailure("tasks", tasksResult)
  appendFailure("meta", metaResult)
  setAppStore("projectLoadIssues", issues)
  for (const issue of issues) {
    AppLog.error("project-load", `${issue.resource} load failed`, { directory, error: issue.message })
  }

  // Conversation readiness is owned by the Task list and metadata above.
  // Extension/config projections start only after restoration, then reconcile
  // their own stores independently; a slow package scan must not delay the
  // selected conversation.
  const reconcileCapabilities = async () => {
    const [extensionsResult, configResult] = await Promise.allSettled([
      loadExtensions({
        directory,
        isCurrentDirectory: (candidate) => settingsStore.directory.trim() === candidate,
      }),
      loadConfigInfo(CONFIG_INFO_LOAD_TIMEOUT_MILLISECONDS),
    ])
    if (!isCurrentInitLifecycle(lifecycleGeneration) || settingsStore.directory.trim() !== directory) return
    const capabilityIssues: ProjectLoadIssue[] = []
    const appendCapabilityFailure = (resource: ProjectLoadIssue["resource"], result: PromiseSettledResult<unknown>) => {
      if (result.status !== "rejected") return
      capabilityIssues.push({
        resource,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
    }
    appendCapabilityFailure("extensions", extensionsResult)
    appendCapabilityFailure("config", configResult)
    if (extensionsResult.status === "fulfilled") {
      capabilityIssues.push(
        ...extensionsResult.value.issues.map((issue) => ({
          resource: "extensions" as const,
          message: `${issue.resource}: ${issue.message}`,
        })),
      )
    }
    if (configResult.status === "fulfilled") {
      capabilityIssues.push(
        ...configResult.value.map((issue) => ({
          resource: "config" as const,
          message: `${issue.resource}: ${issue.message}`,
        })),
      )
    }
    const reconciled = [...issues, ...capabilityIssues]
    setAppStore("projectLoadIssues", reconciled)
    for (const issue of capabilityIssues) {
      AppLog.error("project-load", `${issue.resource} load failed`, { directory, error: issue.message })
    }
  }
  return { loaded: true, reconcileCapabilities }
}

// ── Public API ──

/**
 * Initialise the Solid overlay layer.
 * Call order:
 * 1. Load settings from the active host persistence source
 * 2. Apply settings to API client
 * 3. Load i18n (all supported locales)
 * 4. Apply locale from settings
 * 5. Check server connection
 * 6. If connected: load board + tasks, call onConnected
 * 7. Start periodic reconnect loop
 */
export async function initApp(options: InitOptions = {}): Promise<void> {
  const { onConnected, onSettingsLoaded, onReconnect, reconnectInterval = 10_000 } = options
  const lifecycleGeneration = ++initLifecycleGeneration
  const resolveInitialDirectory = createInitialDirectoryResolver()

  // 1. Load settings into the Solid store
  await loadSettings()
  if (!isCurrentInitLifecycle(lifecycleGeneration)) return
  await onSettingsLoaded?.()
  if (!isCurrentInitLifecycle(lifecycleGeneration)) return

  // 2. Push settings into the API client (server URL + auth)
  syncApiConfig()

  // 3. Load i18n locale bundles
  await loadAllLocales()
  if (!isCurrentInitLifecycle(lifecycleGeneration)) return

  // 4. Apply locale from settings
  await setLocale(settingsStore.locale)
  if (!isCurrentInitLifecycle(lifecycleGeneration)) return

  // 5. Check connection
  const connected = await checkServerConnection()
  if (!isCurrentInitLifecycle(lifecycleGeneration)) return

  if (connected) {
    startWorkLedgerSSE()
    // 6. Load initial data
    const initialData = await loadInitialData(lifecycleGeneration, resolveInitialDirectory)
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
    if (initialData.loaded) await restoreInitialTaskSelection()
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
    void initialData.reconcileCapabilities?.()
    await onConnected?.()
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
  }

  if (!isCurrentInitLifecycle(lifecycleGeneration)) return

  // 7. Start reconnect loop
  stopConnectionMonitor()
  startConnectionMonitor(async () => {
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
    syncApiConfig()
    startWorkLedgerSSE()
    const initialData = await loadInitialData(lifecycleGeneration, resolveInitialDirectory)
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
    if (initialData.loaded) await restoreInitialWorkspace()
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
    void initialData.reconcileCapabilities?.()
    await onReconnect?.()
    if (!isCurrentInitLifecycle(lifecycleGeneration)) return
  }, reconnectInterval)
}

export function createInitialDirectoryResolver(
  resolve: () => Promise<boolean> = ensureDefaultDirectory,
): () => Promise<boolean> {
  let resolution: Promise<boolean> | undefined
  return () => {
    if (resolution) return resolution
    const current = resolve().catch((error) => {
      if (resolution === current) resolution = undefined
      throw error
    })
    resolution = current
    return current
  }
}

/**
 * Tear down the reconnect loop.
 * Call on `beforeunload` or component cleanup.
 */
export function teardownApp(): void {
  initLifecycleGeneration += 1
  stopConnectionMonitor()
  stopSSE()
  stopWorkLedgerSSE()
}

/**
 * Persist current settings through the active host and re-apply the API client.
 * Thin wrapper so callers don't need to import from multiple modules.
 */
export function persistAndSyncSettings(): void {
  void saveSettings().catch((error) => {
    console.error("[init] persist settings failed", error)
  })
  syncApiConfig()
}

// ── Workspace restoration ──

const RESTORABLE_RUNNING_TASK_STATUSES = new Set(["active", "queued"])

function taskIDFromItem(item: any): string {
  const id = item?.task?.id ?? item?.id
  return typeof id === "string" ? id.trim() : ""
}

function taskStatusFromItem(item: any): string {
  const status = item?.task?.status ?? item?.status
  return typeof status === "string" ? status.trim() : ""
}

export function initialRestoreTaskID(
  tasks: any[],
  savedTaskID: string,
  options: { selectRunningWhenUnmatched?: boolean } = {},
): string {
  const list = Array.isArray(tasks) ? tasks : []
  const saved = typeof savedTaskID === "string" ? savedTaskID.trim() : ""
  if (saved && list.some((item: any) => taskIDFromItem(item) === saved)) {
    return saved
  }
  if (options.selectRunningWhenUnmatched === false) return ""
  const running = list.find((item: any) => RESTORABLE_RUNNING_TASK_STATUSES.has(taskStatusFromItem(item)))
  return taskIDFromItem(running)
}

export async function restoreInitialTaskSelection(options: { search?: string } = {}): Promise<boolean> {
  const deepLink = options.search === undefined ? currentTaskDeepLink() : taskDeepLinkFromSearch(options.search)
  if (deepLink) {
    await selectTask(deepLink.taskID)
    bumpWorkspaceEpoch()
    return true
  }
  return restoreInitialWorkspace()
}

/**
 * Restore the last workspace state (task selection + directory) that was
 * persisted to settings before the overlay was last closed.
 * Returns true when a task was successfully re-selected, false otherwise.
 */
export async function restoreInitialWorkspace(): Promise<boolean> {
  const { workspaceTaskID, workspaceDirectory, directory: activeDir } = settingsStore
  const tasks = boardStore.tasks

  // Skip if a workspace selection is already in progress (epoch > 0).
  if (settingsStore.workspaceEpoch > 0) return false
  if (boardStore.selectedSource?.kind === "session") return false

  const base = activeDir || ""
  const directory = workspaceRestoreDirectory(workspaceDirectory || "")
  const moved = !!directory && !!base && directory !== base

  if (moved) {
    // Reflect directory change so reactive components see the updated value.
    setSettingsStore("directory", directory)
    syncApiConfig()
    bumpDirectoryEpoch()
  }

  const taskID = initialRestoreTaskID(tasks, workspaceTaskID || "", { selectRunningWhenUnmatched: !moved })

  if (taskID) {
    if (activeTaskID() !== taskID || !boardStore.board) {
      await selectTask(taskID)
    }
    // body.dataset.workspace/connection is updated reactively by main.tsx createEffect.
    bumpWorkspaceEpoch()
    return true
  }

  if (moved) {
    // Could not find the task — roll back the directory change.
    setSettingsStore("directory", base)
    syncApiConfig()
    bumpDirectoryEpoch()
  }

  if ((workspaceTaskID || "").trim() || boardStore.selectedSource?.kind === "task" || boardStore.board?.task) {
    await selectTask("")
  }
  return false
}
