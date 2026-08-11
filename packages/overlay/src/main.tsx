// ── Entry Point ──
// Self-sufficient Solid.js entry point.
// Mounts all Solid components and initialises the application.
// Self-sufficient — no external script dependencies.

import "@fontsource-variable/geist/index.css"
import "@fontsource-variable/noto-sans-sc/index.css"
import "@fontsource-variable/jetbrains-mono/index.css"
import { insert, render } from "solid-js/web"
import { batch, createEffect, createMemo, createSignal, For, onCleanup, onMount, untrack } from "solid-js"
import { App } from "./components/App"
import { Icon, LUCIDE_ICON_NAMES, REGISTERED_ICONS, type IconName } from "./components/ui/Icon"
import { Conversation } from "./components/Conversation"
import { GoalsBoardPanel, RequirementsBoardPanel } from "./components/Board"
import { ChatComposer } from "./components/ChatComposer"
import {
  DEFAULT_COMPOSER_INTENT,
  conversationExperienceFromProductPillar,
  productPillarFromConversationExperience,
  resolveComposerIntentRoute,
  type ComposerIntent,
} from "@opencorvus-ai/transport-protocol"
import { WorkLedger } from "./components/WorkLedger"
import { MissionBoard } from "./components/MissionBoard"
import type { MissionCreateRequest, MissionManualCreateRequest } from "./components/MissionCreateDialog"
import {
  setWorkLedgerItemPinned,
  workLedgerActiveItem,
  workLedgerProjectDirectories,
  workLedgerSessionExecution,
  workLedgerSessionInterruptible,
} from "./services/work-ledger"
import { LogViewer } from "./components/LogViewer"
import { FileExplorerPanel } from "./components/FileExplorerPanel"
import { FileChangesPanel, type FileChangesActiveView } from "./components/FileChangesPanel"
import { BrowserPreviewPanel, type BrowserPreviewPanelController } from "./components/BrowserPreviewPanel"
import { browserPreviewRevision } from "./services/browser-preview"
import { ScreenshotBrowserPanel } from "./components/ScreenshotBrowserPanel"
import { SubagentConversationPanel } from "./components/SubagentConversationPanel"
import { RightDock, type RightDockPanel, type RightDockTab } from "./components/RightDock"
import { FileEditorPane } from "./components/FileEditorPane"
import { MailboxPanel } from "./components/MailboxPanel"
import { Button } from "./components/ui/Button"
import { TabPanel } from "./components/ui/Tabs"
import { closeFileEditor, fileWorkbenchOpen } from "./services/file-workbench"
import type { DiffTarget } from "./services/diff"
import { initApp } from "./services/init"
import {
  loadTasks,
  boardStore,
  loadBoard,
  activeBrowserPreviewTaskID,
  activeTaskID,
  activeSessionID,
  clearBoard,
  rootTaskSessionID,
  setBoardStore,
  type BoardSource,
} from "./store/board"
import { abortChatRequest, messageStore, setChatAttachments } from "./store/messages"
import { clearConversationUiState } from "./store/conversation-ui"
import { appStore } from "./store/app"
import { clearComposerModelProjection, projectComposerModelFromSession } from "./services/composer-model"
import { rightDockOpen, setRightDockVisible } from "./store/right-dock"
import {
  selectTask,
  cancelTask,
  retryTask,
  replanTask,
  setTaskArchived,
  renameTask,
  downloadTaskProjectArchive,
} from "./services/task"
import { startQueuedTaskNow } from "./services/task-queue"
import { canComposeChat, stopChatRequest } from "./services/chat"
import { isTaskInterruptable } from "./store/board"
import { loadAllLocales, localeTag, setLocale } from "./utils/i18n"
import { apiJson, configure as configureApi } from "./services/api"
import type { AutomationRunSession } from "./services/automations"
import { t } from "./utils/i18n"
import { renderMarkdown } from "./utils/markdown"
import {
  applyTheme,
  applyZoom,
  handleZoomHotkey,
  installSystemThemeListener,
  stepZoom,
  toggleDevtools,
} from "./services/theme"
import { bumpWorkspaceEpoch, settingsStore, setSettingsStore, saveSettings } from "./store/settings"
import {
  initPaneResizers,
  cancelPaneResize,
  renderPaneLayout,
  PANEL_PANE_CONFIG,
  type PaneState,
} from "./services/pane"
import { panelMessage } from "./services/chat"
import { loadConversationCapability } from "./services/conversation-capability"
import {
  inspectExpertSquad,
  loadExpertSquadCatalog,
  searchExpertSquads,
  type ExpertSquadCatalogScope,
} from "./services/expert-squad"
import { loadMissionSkillCatalog } from "./services/mission-skill"
import {
  loadGlobalComposerReferences,
  searchGlobalComposerExpertSquads,
} from "./services/global-composer-references"
import { resolveComposerSubmitRoute } from "./services/composer-submit-route"
import {
  VisibleComposerReferences as VisibleComposerReferencesSchema,
  visibleComposerReferences,
  type VisibleComposerReferences,
} from "@opencorvus-ai/transport-protocol"
import { waitForLogDrain, AppLog } from "./utils/log"
import { teardownApp } from "./services/init"
import { stopTimers } from "./services/sync"
import { nativeOpen } from "./utils/native"
import { getHostTransport } from "./services/host-transport-runtime"
import { checkDesktopUpdate } from "./services/desktop-update"
import { installNativeWindowCloseLifecycle } from "./services/native-window-lifecycle"
import { showOverlayWindow } from "./services/window"
import { installExpertSquadInstallHandoffBridge } from "./services/expert-squad-install-handoff"
import { hydrateIconPlaceholders, installIconHtmlRenderer } from "./utils/icon-html"
import { installNativeContextMenuSuppression } from "./utils/context-menu"
import {
  reportError,
  reportSuccess,
  reportWarning,
  formatErrorDetails,
  runPostCommitUiEffect,
} from "./services/diagnostics"
import { showAppDialog } from "./services/app-dialog"
import {
  applyDirectory,
  activeDirectory,
  beginWorkspaceSelection,
  browseDirectory,
  resolveGlobalComposerProject,
  resolveGlobalComposerSubmissionContext,
  deleteProjectState,
  leaveDeletedProject,
  openGlobalChatLauncher,
  openDirectory,
  openPathInSelectedEditor,
  openProjectFile,
  ownsWorkspaceSelection,
  pickDirectory,
  promoteAnonymousProject,
  renameProjectRecord,
} from "./services/workspace"
import { openGoalDialog } from "./services/dialog"
import { openConfigDialog } from "./services/config-dialog-control"
import { cardTreeStore } from "./store/card-tree"
import { composerDraftKey, composerDraftText, setComposerDraft } from "./services/composer-draft"
import { normalizeDebugDirectory } from "./utils/debug-text"
import {
  cancelConversationReplay,
  conversationSourceDirectory,
  loadConversation,
  resetConversationProjection,
} from "./services/conversation"
import {
  conversationSourceExperience,
  createConversationSession,
  createGlobalConversationSession,
  activeConversationHandoff,
  isConversationSource,
  renameConversationSession,
  selectConversationSession,
  setConversationSessionArchived,
  stopConversationSession,
} from "./services/conversation-session"
import {
  abortMission,
  activeMissionHandoff,
  createMissionDraft,
  deleteMission,
  dispatchMission,
  downloadMissionProjectArchive,
  renameMission,
  setMissionArchived,
  wakeMission,
  type MissionRecord,
  type MissionWakeResult,
} from "./services/mission"
import type { WorkLedgerChatRow, WorkLedgerMissionRow, WorkLedgerTaskRow } from "./services/work-ledger"
import { setWorkLedgerChangeHandler, startSSE, stopSSE, type WorkLedgerStreamEvent } from "./services/sse"
import { openImagePreview } from "./services/image-preview"
import {
  buildChatDebugBlob,
  buildTaskDebugBlob,
  buildTaskSelectionErrorDebugBlob,
  writeDebugClipboard,
} from "./utils/debug-info"
import { taskOwningDirectory } from "./services/task-directory"
import { taskScopedPath } from "./services/task-path"
import { loadPersistedChatDebugProjection } from "./services/session-debug"
import { registerReviewPanelPresenter, requestReviewPanel } from "./services/review-focus"
import { createAnimationFrameScheduler } from "./utils/animation-frame"
import {
  composerReferenceCatalogRequestKey,
  composerReferenceCatalogScope,
  type ComposerReferenceCatalogScopeState,
} from "./services/expert-squad-scope"
import {
  composerExpertSquadCatalogForRequest,
  createGlobalComposerReferenceCatalogSnapshot,
  createComposerReferenceCatalogSnapshotFromSettled,
  emptyComposerExpertSquadCatalog,
  mergeComposerExpertSquadOptions,
} from "./services/composer-expert-squad-catalog"
import { currentUIScale, layoutTokenPx } from "./utils/layout-tokens"

// ── Module teardown ──
// Centralised cleanup for top-level document/window listeners and the Solid root.
// Triggered on beforeunload and on Vite HMR dispose so subsequent module
// re-executions don't stack duplicate handlers and effects.
const moduleTeardown = new AbortController()
const disposers: Array<() => void> = []
function runModuleTeardown() {
  if (!moduleTeardown.signal.aborted) moduleTeardown.abort()
  for (const dispose of disposers.splice(0)) dispose()
}
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.dispose(runModuleTeardown)
}
const listenerOpts = { signal: moduleTeardown.signal } as const
const REGISTERED_ICON_NAMES = new Set<string>(REGISTERED_ICONS)
const LUCIDE_ICON_NAME_SET = new Set<string>(LUCIDE_ICON_NAMES)

let pendingPaneLayoutState: PaneState | null = null

function flushPaneLayout(): void {
  const state = pendingPaneLayoutState
  pendingPaneLayoutState = null
  if (!state) return
  renderPaneLayout(state, PANEL_PANE_CONFIG)
}

const renderPaneLayoutOnFrame = createAnimationFrameScheduler(flushPaneLayout)
disposers.push(() => renderPaneLayoutOnFrame.cancel())

function schedulePaneLayout(state: PaneState): void {
  pendingPaneLayoutState = { ...state }
  renderPaneLayoutOnFrame.schedule()
}

function iconHtmlName(name: string): IconName {
  if (!REGISTERED_ICON_NAMES.has(name)) throw new Error(`Unknown icon "${name}"`)
  return name as IconName
}

function iconHtmlClassName(name: string, className?: string): string {
  if (LUCIDE_ICON_NAME_SET.has(name)) return className ?? ""
  return ["lucide", `lucide-${name}`, className].filter(Boolean).join(" ")
}

function measureScrollbarGutter(elementIdentifier: string): number {
  const scroll = document.getElementById(elementIdentifier)
  if (!scroll) throw new Error(`Scrollbar gutter measurement requires #${elementIdentifier}.`)
  const gutter = scroll.offsetWidth - scroll.clientWidth
  if (!Number.isFinite(gutter) || gutter < 0) {
    throw new Error(`Scrollbar gutter for #${elementIdentifier} resolved to invalid width: ${gutter}`)
  }
  return gutter
}

function syncScrollbarGutters(): void {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty("--ui-chat-scrollbar-gutter-x", `${measureScrollbarGutter("chatScroll")}px`)
  rootStyle.setProperty("--ui-left-rail-scrollbar-gutter-x", `${measureScrollbarGutter("workLedgerProjectsScroll")}px`)
}

const syncScrollbarGuttersOnFrame = createAnimationFrameScheduler(syncScrollbarGutters)
disposers.push(() => syncScrollbarGuttersOnFrame.cancel())

disposers.push(
  installIconHtmlRenderer(({ name, size, className }) => {
    const resolvedName = iconHtmlName(name)
    const host = document.createElement("span")
    insert(host, Icon({ name: resolvedName, size, class: iconHtmlClassName(resolvedName, className) }))
    return host.innerHTML
  }),
)
installNativeContextMenuSuppression(document, moduleTeardown.signal)
hydrateIconPlaceholders(document)

const BROWSER_RESIZE_OBSERVER_DELIVERY_MESSAGES = new Set([
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
])

function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isBrowserResizeObserverDeliveryError(error: unknown): boolean {
  return BROWSER_RESIZE_OBSERVER_DELIVERY_MESSAGES.has(runtimeErrorMessage(error))
}

function reportOverlayRuntimeError(scope: string, error: unknown): void {
  const details = formatErrorDetails(error)
  const message = runtimeErrorMessage(error)
  const diagnosticDetails = details ? `source: ${scope}\n\n${details}` : `source: ${scope}`
  if (isBrowserResizeObserverDeliveryError(error)) {
    AppLog.debug("runtime", scope, {
      message,
      details,
    })
    return
  }
  AppLog.error("runtime", scope, {
    message,
    details,
    diagnosticID: `runtime:${scope}`,
    title: t("common.error"),
    diagnosticMessage: message,
    diagnosticDetails,
  })
}

function runMainAsync(scope: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportOverlayRuntimeError(scope, error)
    })
  } catch (error) {
    reportOverlayRuntimeError(scope, error)
  }
}

document.documentElement.dataset.platform = __OPENCORVUS_BUILD_PLATFORM__

if (__OPENCORVUS_BUILD_PLATFORM__ === "darwin" && getHostTransport().kind === "tauri") {
  document.documentElement.dataset.nativeTitlebar = "macos"
}

runMainAsync("native-window.close-lifecycle", async () => {
  const dispose = await installNativeWindowCloseLifecycle()
  if (!dispose) return
  if (moduleTeardown.signal.aborted) {
    dispose()
    return
  }
  disposers.push(dispose)
})

function persistMainSettings(scope: string): void {
  runMainAsync(scope, () => saveSettings())
}

window.addEventListener(
  "error",
  (event) => {
    reportOverlayRuntimeError("window.error", event.error ?? event.message)
  },
  listenerOpts,
)

window.addEventListener(
  "unhandledrejection",
  (event) => {
    reportOverlayRuntimeError("window.unhandledrejection", event.reason)
  },
  listenerOpts,
)

// ── Application-level signals (shared across mount points) ──

const [logOpen, setLogOpen] = createSignal(false)

window.addEventListener("oc:open-logs", () => setLogOpen(true), listenerOpts)

// ── Workspace (secondary panel, stacked above composer) state ──
// workspaceOpen drives layout visibility; workspaceTarget is remembered across
// open/close cycles so reopening restores the last active diff target.
const [workspaceOpen, setWorkspaceOpen] = createSignal(false)
const [workspaceTarget, setWorkspaceTarget] = createSignal<DiffTarget>({ filePath: "" })
const [fileChangesActiveView, setFileChangesActiveView] = createSignal<FileChangesActiveView>("changes")

type CenterWorkbenchPanel =
  | "conversation"
  | "requirements"
  | "goals"
  | "explorer"
  | "diff"
  | "browser"
  | "screenshots"
  | "subagent"
  | "file"
type PrimaryCenterPanel = "task" | "mission" | "chat"
type PrimaryWorkspaceSurface = "conversation" | "mission-board"
type CenterWorkbenchTab = {
  id: string
  panel: CenterWorkbenchPanel
  taskPreview?: true
}

const CENTER_WORKBENCH_PANEL_ORDER: readonly CenterWorkbenchPanel[] = [
  "conversation",
  "requirements",
  "goals",
  "explorer",
  "diff",
  "browser",
  "screenshots",
  "subagent",
  "file",
]

const [centerWorkbenchPanels, setCenterWorkbenchPanels] = createSignal<CenterWorkbenchTab[]>([
  { id: "conversation", panel: "conversation" },
])
const [selectedCenterWorkbenchTabID, setSelectedCenterWorkbenchTabID] = createSignal("conversation")
const [rightDockAddMenuOpen, setRightDockAddMenuOpen] = createSignal(false)
const [rightDockOverflowMenuOpen, setRightDockOverflowMenuOpen] = createSignal(false)
const [mailboxAttention, setMailboxAttention] = createSignal(false)
const [mailboxUnreadCount, setMailboxUnreadCount] = createSignal(0)
const [browserPreviewPageTitles, setBrowserPreviewPageTitles] = createSignal<Record<string, string>>({})
let primaryBrowserPreviewController: BrowserPreviewPanelController | undefined
const [selectedSubagentSessionID, setSelectedSubagentSessionID] = createSignal("")
const [primaryCenterPanel, setPrimaryCenterPanel] = createSignal<PrimaryCenterPanel>("chat")
const [primaryWorkspaceSurface, setPrimaryWorkspaceSurface] = createSignal<PrimaryWorkspaceSurface>("conversation")
const [missionSharedRefreshToken, setMissionSharedRefreshToken] = createSignal(0)
const [missionLauncherSubmitting, setMissionLauncherSubmitting] = createSignal(false)
const [expertSquadLauncherSubmitting, setExpertSquadLauncherSubmitting] = createSignal(false)
const [assistantLauncherSubmitting, setAssistantLauncherSubmitting] = createSignal(false)
setWorkLedgerChangeHandler(handleWorkLedgerStreamEvent)
disposers.push(() => setWorkLedgerChangeHandler(null))
const [composerIntent, setComposerIntent] = createSignal<ComposerIntent>(DEFAULT_COMPOSER_INTENT)

function isCenterWorkbenchPanelOpen(panel: CenterWorkbenchPanel): boolean {
  return centerWorkbenchPanels().some((tab) => tab.panel === panel)
}

let pendingCenterWorkbenchRevealPanel: CenterWorkbenchPanel | null = null

function revealPendingCenterWorkbenchPanel(): void {
  const panel = pendingCenterWorkbenchRevealPanel
  pendingCenterWorkbenchRevealPanel = null
  if (!panel) return
  getCenterWorkbenchViews()[panel]?.scrollIntoView({ block: "nearest", inline: "nearest" })
}

function resetCenterWorkbenchToPrimaryPanel(panel: PrimaryCenterPanel): void {
  setPrimaryWorkspaceSurface("conversation")
  setWorkspaceOpen(false)
  closeFileEditor()
  setRightDockVisible(false)
  setSelectedSubagentSessionID("")
  setPrimaryCenterPanel(panel)
  setCenterWorkbenchPanels([{ id: "conversation", panel: "conversation" }])
  setSelectedCenterWorkbenchTabID("conversation")
  scheduleCenterWorkbenchPanelReveal("conversation")
}

async function selectTaskWithUILifecycle(taskID: string, directory: string): Promise<void> {
  const row = workLedgerActiveItem({ taskID, sessionID: undefined })
  if (row?.kind === "task") {
    setComposerIntent({ productPillar: row.productPillar, conversationTarget: "mission" })
  }
  resetCenterWorkbenchToPrimaryPanel("task")
  await selectTask(taskID, { directory })
}

async function selectConversationWithUILifecycle(
  sessionID: string,
  directory: string,
  experience: "chat" | "work",
): Promise<void> {
  setComposerIntent({ productPillar: productPillarFromConversationExperience(experience), conversationTarget: "chat" })
  bumpWorkspaceEpoch()
  resetCenterWorkbenchToPrimaryPanel("chat")
  await selectConversationSession({ sessionID, directory, experience })
}

async function openAutomationSession(session: AutomationRunSession): Promise<void> {
  if (session.kind === "mission") {
    if (!session.productPillar) throw new Error("Mission automation session is missing its persisted product pillar")
    resetCenterWorkbenchToPrimaryPanel("mission")
    await openMissionSession({ sessionID: session.id, productPillar: session.productPillar }, session.directory)
    return
  }
  await selectConversationWithUILifecycle(session.id, session.directory, session.experience ?? "chat")
}

function openDiffActivity(): void {
  setFileChangesActiveView("changes")
  openCenterWorkbenchPanel("diff")
}

function openRightDockPanel(panel: RightDockPanel): void {
  setRightDockVisible(true)
  if (panel === "diff") {
    openDiffActivity()
    return
  }
  openCenterWorkbenchPanel(panel)
}

function openSubagentConversation(sessionID: string): void {
  const value = sessionID.trim()
  if (!value) throw new Error("Sub-agent conversation session ID is required")
  setSelectedSubagentSessionID(value)
  openCenterWorkbenchPanel("subagent")
}

function openRightDockAddMenu(): void {
  setRightDockVisible(true)
  setRightDockOverflowMenuOpen(false)
  setRightDockAddMenuOpen(true)
}

function presentMailboxNotification(): void {
  setMailboxAttention(true)
}

function registerPrimaryBrowserPreviewController(controller: BrowserPreviewPanelController): () => void {
  primaryBrowserPreviewController = controller
  return () => {
    if (primaryBrowserPreviewController === controller) primaryBrowserPreviewController = undefined
  }
}

function openBrowserPreviewFromMessage(url: string): void {
  const controller = primaryBrowserPreviewController
  if (!controller) throw new Error("Right Dock Browser controller is not mounted")
  controller.navigate(url)
  openRightDockPanel("browser")
}

function isMissionSessionSource(): boolean {
  return boardStore.selectedSource?.kind === "session" && !isConversationSource()
}

function handleWorkLedgerStreamEvent(event: WorkLedgerStreamEvent): void {
  setMissionSharedRefreshToken((value) => value + 1)
  const selectedSource = boardStore.selectedSource
  const missionHandoff = activeMissionHandoff(event, selectedSource)
  if (missionHandoff) {
    runMainAsync("work-ledger.mission-handoff", async () => {
      try {
        await openMissionSession(missionHandoff, missionHandoff.directory)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        throw error
      }
      await archiveConversationHandoffCaller({
        sessionID: missionHandoff.callerSessionID,
        directory: missionHandoff.directory,
        experience: missionHandoff.callerExperience,
      })
      focusComposerInput()
    })
    return
  }
  const conversationHandoff = activeConversationHandoff(event, selectedSource)
  if (!conversationHandoff) return
  runMainAsync("work-ledger.conversation-handoff", async () => {
    try {
      await selectConversationWithUILifecycle(
        conversationHandoff.sessionID,
        conversationHandoff.directory,
        conversationHandoff.experience,
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      throw error
    }
    await archiveConversationHandoffCaller({
      sessionID: conversationHandoff.callerSessionID,
      directory: conversationHandoff.directory,
      experience: conversationHandoff.callerExperience,
    })
    focusComposerInput()
  })
}

async function archiveConversationHandoffCaller(target: {
  sessionID: string
  directory: string
  experience: "chat" | "work"
}): Promise<void> {
  const archived = await setConversationSessionArchived(target, true)
  if (!archived) throw new Error(t("coding_assistant.archive_failed"))
  setMissionSharedRefreshToken((value) => value + 1)
}

function focusComposerInput(): void {
  queueMicrotask(() => {
    document.querySelector<HTMLTextAreaElement>("#solidChatComposer textarea")?.focus()
  })
}

function handleComposerIntentChange(intent: ComposerIntent): void {
  const currentDraftKey = panelComposerDraftKey()
  const launcherDraftKey = newRequestComposerDraftKey()
  const currentDraft = composerDraftText(currentDraftKey)
  if (currentDraftKey !== launcherDraftKey && currentDraft) setComposerDraft(launcherDraftKey, currentDraft)
  setComposerIntent(intent)
  resetCenterWorkbenchToPrimaryPanel(intent.conversationTarget === "mission" ? "mission" : "chat")
  runMainAsync("composer.mode-clear-source", () => selectTask("", { preserveComposerAttachments: true }))
  focusComposerInput()
}

async function selectWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  setComposerIntent({
    productPillar: row.productPillar,
    conversationTarget: "mission",
  })
  await selectTaskWithUILifecycle(row.id, row.directory)
}

async function openWorkLedgerChat(row: WorkLedgerChatRow): Promise<void> {
  await selectConversationWithUILifecycle(row.sessionID, row.directory, row.experience)
}

async function openGlobalComposer(intent: ComposerIntent): Promise<void> {
  await openGlobalChatLauncher()
  handleComposerIntentChange(intent)
}

async function startWorkLedgerMulticaImport(directory: string): Promise<void> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error(t("project.new_chat_missing_directory"))
  const model = appStore.composerModel.trim()
  if (!model) {
    await showAppDialog({
      title: t("multica_import.model_required_title"),
      message: t("multica_import.model_required_message"),
      kind: "warning",
    })
    return
  }
  const confirmation = await showAppDialog({
    title: t("multica_import.confirm_title"),
    message: t("multica_import.confirm_message", { directory: projectDirectory }),
    cancel: true,
    okLabel: t("multica_import.confirm_action"),
  })
  if (!confirmation.confirmed) return
  setMissionLauncherSubmitting(true)
  const selectionEpoch = beginWorkspaceSelection()
  try {
    const result = await wakeMission({
      directory: projectDirectory,
      text: t("multica_import.mission_request"),
      model,
      productPillar: "code",
      expertSquadIDs: [],
    })
    setComposerIntent({ productPillar: "code", conversationTarget: "mission" })
    resetCenterWorkbenchToPrimaryPanel("mission")
    await openMissionSession(result, projectDirectory, selectionEpoch)
    setMissionSharedRefreshToken((value) => value + 1)
  } finally {
    setMissionLauncherSubmitting(false)
  }
}

async function selectWorkLedgerProject(directory: string): Promise<void> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error(t("project.new_chat_missing_directory"))
  setComposerIntent(DEFAULT_COMPOSER_INTENT)
  resetCenterWorkbenchToPrimaryPanel("chat")
  await applyDirectory(projectDirectory, { save: true, restoreWorkspace: false })
  bumpWorkspaceEpoch()
  focusComposerInput()
}

async function deleteWorkLedgerProject(directory: string): Promise<void> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error(t("project.delete_missing_directory"))
  const dialog = await showAppDialog({
    title: t("project.delete_title"),
    message: t("project.delete_confirm", { directory: projectDirectory }),
    cancel: true,
    okLabel: t("common.delete"),
  })
  if (!dialog.confirmed) return

  const outcome = await deleteProjectState(projectDirectory, {
    surface: "overlay.work_ledger",
    reason: "Operator deleted the project from Work Ledger",
  })
  const diagnosticID =
    outcome.status === "deleted"
      ? `project:delete:${outcome.result.projectID}`
      : `project:delete:already-absent:${projectDirectory}`
  runPostCommitUiEffect({ id: `${diagnosticID}:close`, title: "Project deletion committed" }, () => {
    if (activeDirectory().trim() === projectDirectory) {
      void leaveDeletedProject(projectDirectory).catch((error) => {
        reportError({
          id: `${diagnosticID}:directory-free-workspace`,
          title: "Project deletion committed but workspace transition failed",
          message: error instanceof Error ? error.message : String(error),
          details: formatErrorDetails(error),
        })
      })
    }
  })
  runPostCommitUiEffect({ id: `${diagnosticID}:refresh`, title: "Project deletion committed" }, () => {
    setMissionSharedRefreshToken((value) => value + 1)
  })
  runPostCommitUiEffect({ id: `${diagnosticID}:notification`, title: "Project deletion committed" }, () => {
    reportSuccess({
      id: diagnosticID,
      title: t("project.delete_success_title"),
      message: t("project.delete_success", {
        directory: outcome.status === "deleted" ? outcome.result.directory : outcome.directory,
      }),
    })
  })
}

async function openWorkLedgerProjectDirectory(directory: string): Promise<void> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error(t("project.open_missing_directory"))
  await openDirectory(projectDirectory)
}

async function renameWorkLedgerProject(directory: string, currentName: string): Promise<void> {
  const projectDirectory = directory.trim()
  if (!projectDirectory) throw new Error(t("project.rename_missing_directory"))
  const dialog = await showAppDialog({
    title: t("project.rename_title"),
    message: t("project.rename_message", { directory: projectDirectory }),
    input: true,
    inputLabel: t("project.rename_input_label"),
    inputValue: currentName.trim(),
    inputPlaceholder: t("project.rename_input_placeholder"),
    cancel: true,
    okLabel: t("project.rename_menu_label"),
  })
  if (!dialog.confirmed) return
  const name = String(dialog.value || "").trim()
  if (!name) throw new Error(t("project.rename_name_required"))
  if (name === currentName.trim()) return
  await renameProjectRecord(projectDirectory, name)
  setMissionSharedRefreshToken((value) => value + 1)
}

async function promoteWorkLedgerAnonymousProject(directory: string): Promise<void> {
  const source = directory.trim()
  if (!source) throw new Error(t("project.promote_anonymous_missing_directory"))
  const nameDialog = await showAppDialog({
    title: t("project.promote_anonymous_title"),
    message: t("project.promote_anonymous_message"),
    input: true,
    inputLabel: t("project.rename_input_label"),
    inputPlaceholder: t("project.rename_input_placeholder"),
    cancel: true,
    okLabel: t("common.continue"),
  })
  if (!nameDialog.confirmed) return
  const name = String(nameDialog.value || "").trim()
  if (!name) throw new Error(t("project.rename_name_required"))
  const destinationParent = await pickDirectory()
  if (!destinationParent) return
  const result = await promoteAnonymousProject(source, destinationParent, name)
  await applyDirectory(result.directory, { save: true, restoreWorkspace: false })
  setMissionSharedRefreshToken((value) => value + 1)
  if (result.cleanupPending) {
    reportWarning({
      id: `project:promote:${result.project.id}:cleanup`,
      title: t("project.promote_anonymous_success_title"),
      message: t("project.promote_anonymous_cleanup_pending"),
    })
  } else {
    reportSuccess({
      id: `project:promote:${result.project.id}`,
      title: t("project.promote_anonymous_success_title"),
      message: t("project.promote_anonymous_success", { directory: result.directory }),
    })
  }
}

async function openWorkLedgerMission(row: WorkLedgerMissionRow): Promise<void> {
  setComposerIntent({ productPillar: row.productPillar, conversationTarget: "mission" })
  resetCenterWorkbenchToPrimaryPanel("mission")
  await openMissionSession(
    {
      missionID: row.missionID,
      sessionID: row.sessionID,
      created: false,
      productPillar: row.productPillar,
    },
    row.directory,
  )
}

function openMissionBoard(): void {
  beginWorkspaceSelection()
  setPrimaryWorkspaceSurface("mission-board")
}

async function openMissionBoardMission(row: MissionRecord): Promise<void> {
  setComposerIntent({ productPillar: row.productPillar, conversationTarget: "mission" })
  resetCenterWorkbenchToPrimaryPanel("mission")
  await openMissionSession(
    {
      missionID: row.missionID,
      sessionID: row.sessionID,
      created: false,
      productPillar: row.productPillar,
    },
    row.directory,
  )
}

function missionBoardProjectDirectories(): string[] {
  const currentDirectory = activeDirectory().trim()
  return [...new Set([...(currentDirectory ? [currentDirectory] : []), ...workLedgerProjectDirectories()])]
}

async function createMissionBoardDraft(input: MissionManualCreateRequest): Promise<void> {
  await createMissionDraft(input)
  setMissionSharedRefreshToken((value) => value + 1)
}

async function createMissionBoardWithAI(input: MissionCreateRequest): Promise<void> {
  const selectionEpoch = beginWorkspaceSelection()
  const result = await wakeMission({
    directory: input.directory,
    text: input.request,
    model: appStore.composerModel.trim() || undefined,
    productPillar: input.productPillar,
    expertSquadIDs: input.expertSquadIDs,
  })
  resetCenterWorkbenchToPrimaryPanel("mission")
  await openMissionSession(result, input.directory, selectionEpoch)
  setMissionSharedRefreshToken((value) => value + 1)
}

async function dispatchMissionBoardDraft(mission: MissionRecord): Promise<void> {
  const selectionEpoch = beginWorkspaceSelection()
  const result = await dispatchMission(
    { missionID: mission.missionID, directory: mission.directory },
    appStore.composerModel.trim() || undefined,
  )
  resetCenterWorkbenchToPrimaryPanel("mission")
  await openMissionSession(result, mission.directory, selectionEpoch)
  setMissionSharedRefreshToken((value) => value + 1)
}

async function deleteMissionBoardMission(mission: MissionRecord): Promise<boolean> {
  const confirmation = await showAppDialog({
    title: t("mission_board.delete.title"),
    message: t("mission_board.delete.confirm", { title: mission.title || mission.missionID }),
    cancel: true,
    okLabel: t("common.delete"),
  })
  if (!confirmation.confirmed) return false

  const deleted = await deleteMission(
    { missionID: mission.missionID, directory: mission.directory },
    {
      surface: "overlay.work_ledger",
      reason: "Operator permanently deleted the Mission from Mission Board",
    },
  )
  if (!deleted) throw new Error(t("mission_board.delete.failed"))

  if (boardStore.selectedSource?.kind === "session" && boardStore.selectedSource.id === mission.sessionID) {
    runPostCommitUiEffect({ id: `mission:delete-selection:${mission.missionID}`, title: "Mission deletion committed" }, () => {
      void selectTask("").catch((error) => reportOverlayRuntimeError("mission-board.delete-selection", error))
    })
  }
  setMissionSharedRefreshToken((value) => value + 1)
  reportSuccess({
    id: `mission:delete:${mission.missionID}`,
    title: t("mission_board.delete.succeeded"),
    message: mission.title || mission.missionID,
  })
  return true
}

async function abortWorkLedgerMission(row: WorkLedgerMissionRow): Promise<void> {
  const ok = await abortMission(
    { missionID: row.missionID, directory: row.directory },
    {
      surface: "overlay.work_ledger",
      reason: "Operator aborted the Mission from Work Ledger",
    },
  )
  if (!ok) throw new Error(t("mission.error.action.abort"))
  setMissionSharedRefreshToken((value) => value + 1)
}

async function downloadWorkLedgerMission(row: WorkLedgerMissionRow): Promise<void> {
  const ok = await downloadMissionProjectArchive({ missionID: row.missionID, directory: row.directory })
  if (!ok) throw new Error(t("work_ledger.action.mission_download_failed"))
  reportSuccess({
    id: `mission:download-project:${row.missionID}`,
    title: t("work_ledger.action.mission_download_started"),
    message: row.title || row.missionID,
  })
}

async function renameWorkLedgerMission(row: WorkLedgerMissionRow): Promise<void> {
  const dialog = await showAppDialog({
    title: t("work_ledger.action.rename_mission"),
    input: true,
    inputLabel: t("work_ledger.action.rename_placeholder"),
    inputPlaceholder: t("work_ledger.action.rename_placeholder"),
    inputValue: row.title || row.missionID,
    cancel: true,
    okLabel: t("common.ok"),
  })
  if (!dialog.confirmed) return
  const title = String(dialog.value || "").trim()
  if (!title || title === (row.title || "").trim()) return
  await renameMission({ missionID: row.missionID, directory: row.directory }, title)
  setMissionSharedRefreshToken((value) => value + 1)
}

async function archiveWorkLedgerMission(row: WorkLedgerMissionRow): Promise<void> {
  await setMissionArchived({ missionID: row.missionID, directory: row.directory }, true, {
    surface: "overlay.work_ledger",
    reason: "Operator archived the Mission from Work Ledger",
  })
  if (boardStore.selectedSource?.kind === "session" && boardStore.selectedSource.id === row.sessionID) {
    void selectTask("").catch((error) => {
      runPostCommitUiEffect(
        { id: `mission:archive-selection-cleanup:${row.missionID}`, title: "Mission archive committed" },
        () =>
          reportWarning({
            id: `mission:archive-selection-cleanup:${row.missionID}`,
            title: t("common.error"),
            message: error instanceof Error ? error.message : String(error),
            details: formatErrorDetails(error),
          }),
      )
    })
  }
  runPostCommitUiEffect({ id: `mission:archive-refresh:${row.missionID}`, title: "Mission archive committed" }, () =>
    setMissionSharedRefreshToken((value) => value + 1),
  )
}

async function cancelWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  await cancelTask(row.id, {
    surface: "overlay.work_ledger",
    reason: "Operator cancelled the task from Work Ledger",
  })
  setMissionSharedRefreshToken((value) => value + 1)
}

async function confirmCancelledTaskRestart(row: WorkLedgerTaskRow, action: "retry" | "replan"): Promise<boolean> {
  if (row.lifecycleStatus !== "cancelled") return true
  const dialog = await showAppDialog({
    title: t("task.cancelled_restart_confirm_title"),
    message: t("task.cancelled_restart_confirm_message", {
      action: t(action === "retry" ? "task.retry_button_title" : "task.replan_button_title"),
    }),
    cancel: true,
    okLabel: t("task.cancelled_restart_confirm_ok"),
  })
  return dialog.confirmed
}

const terminalTaskMutationByID = new Map<string, Promise<void>>()

async function reconcileRestartedTask(row: WorkLedgerTaskRow, action: "retry" | "replan"): Promise<void> {
  setMissionSharedRefreshToken((value) => value + 1)
  try {
    await loadBoard({ requireFresh: true })
  } catch (error) {
    reportWarning({
      id: `task:${action}:refresh:${row.id}`,
      title: t("task.restart_refresh_failed_title"),
      message: t("task.restart_refresh_failed_message", { error: runtimeErrorMessage(error) }),
      details: formatErrorDetails(error),
      taskID: row.id,
      taskDirectory: row.directory,
      taskTitle: row.title,
    })
  }
}

async function runTerminalTaskMutation(row: WorkLedgerTaskRow, action: "retry" | "replan"): Promise<void> {
  const active = terminalTaskMutationByID.get(row.id)
  if (active) return active
  const mutation = (async () => {
    if (!(await confirmCancelledTaskRestart(row, action))) return
    if (action === "retry") await retryTask(row.id)
    else await replanTask(row.id)
    reportSuccess({
      id: `task:${action}:committed:${row.id}`,
      title: t(action === "retry" ? "task.retry_committed_title" : "task.replan_committed_title"),
      message: row.title || row.id,
      taskID: row.id,
      taskDirectory: row.directory,
      taskTitle: row.title,
    })
    await reconcileRestartedTask(row, action)
  })().finally(() => {
    if (terminalTaskMutationByID.get(row.id) === mutation) terminalTaskMutationByID.delete(row.id)
  })
  terminalTaskMutationByID.set(row.id, mutation)
  return mutation
}

async function retryTerminalTask(row: WorkLedgerTaskRow): Promise<void> {
  return runTerminalTaskMutation(row, "retry")
}

async function replanTerminalTask(row: WorkLedgerTaskRow): Promise<void> {
  return runTerminalTaskMutation(row, "replan")
}

async function startWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  const result = await startQueuedTaskNow({ taskID: row.id, directory: row.directory })
  await loadTasks({ requireFresh: true })
  if (result.started) {
    reportSuccess({
      id: `task:start-now:${row.id}`,
      title: t("task.start_now_started_title"),
      message: result.task?.title || row.title || row.id,
    })
  } else {
    reportWarning({
      id: `task:start-now:${row.id}`,
      title: t("task.start_now_not_started_title"),
      message: t("task.start_now_not_started"),
    })
  }
  setMissionSharedRefreshToken((value) => value + 1)
}

async function downloadWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  const ok = await downloadTaskProjectArchive({ taskID: row.id, directory: row.directory })
  if (!ok) throw new Error(t("task.download_project_failed", { error: row.id }))
  reportSuccess({
    id: `task:download-project:${row.id}`,
    title: t("task.download_project_started_title"),
    message: row.title || row.id,
  })
}

async function renameWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  const dialog = await showAppDialog({
    title: t("task.rename_button_title"),
    input: true,
    inputLabel: t("task.rename_placeholder"),
    inputPlaceholder: t("task.rename_placeholder"),
    inputValue: row.title || row.id,
    cancel: true,
    okLabel: t("common.ok"),
  })
  if (!dialog.confirmed) return
  const title = String(dialog.value || "").trim()
  if (!title || title === (row.title || "").trim()) return
  const ok = await renameTask(row.id, title)
  if (!ok) throw new Error(t("task.rename_placeholder"))
  setMissionSharedRefreshToken((value) => value + 1)
}

async function archiveWorkLedgerTask(row: WorkLedgerTaskRow): Promise<void> {
  const ok = await setTaskArchived({ taskID: row.id, directory: row.directory }, true, {
    surface: "overlay.work_ledger",
    reason: "Operator archived the task from Work Ledger",
  })
  if (!ok) throw new Error(t("task.archive_failed"))
  runPostCommitUiEffect({ id: `task:archive-refresh:${row.id}`, title: "Task archive committed" }, () =>
    setMissionSharedRefreshToken((value) => value + 1),
  )
}

async function stopWorkLedgerChat(row: WorkLedgerChatRow): Promise<void> {
  const ok = await stopConversationSession({
    sessionID: row.sessionID,
    directory: row.directory,
    experience: row.experience,
  })
  if (!ok) throw new Error("Coding assistant stop failed")
  setMissionSharedRefreshToken((value) => value + 1)
}

async function renameWorkLedgerChat(row: WorkLedgerChatRow): Promise<void> {
  const dialog = await showAppDialog({
    title: t("work_ledger.action.rename_chat"),
    input: true,
    inputLabel: t("work_ledger.action.rename_placeholder"),
    inputPlaceholder: t("work_ledger.action.rename_placeholder"),
    inputValue: row.title || row.sessionID,
    cancel: true,
    okLabel: t("common.ok"),
  })
  if (!dialog.confirmed) return
  const title = String(dialog.value || "").trim()
  if (!title || title === (row.title || "").trim()) return
  await renameConversationSession(
    { sessionID: row.sessionID, directory: row.directory, experience: row.experience },
    title,
  )
  setMissionSharedRefreshToken((value) => value + 1)
}

async function archiveWorkLedgerChat(row: WorkLedgerChatRow): Promise<void> {
  const ok = await setConversationSessionArchived(
    { sessionID: row.sessionID, directory: row.directory, experience: row.experience },
    true,
  )
  if (!ok) throw new Error(t("coding_assistant.archive_failed"))
  if (boardStore.selectedSource?.kind === "session" && boardStore.selectedSource.id === row.sessionID) {
    void selectTask("").catch((error) => {
      runPostCommitUiEffect(
        { id: `chat:archive-selection-cleanup:${row.sessionID}`, title: "Chat archive committed" },
        () =>
          reportWarning({
            id: `chat:archive-selection-cleanup:${row.sessionID}`,
            title: t("common.error"),
            message: error instanceof Error ? error.message : String(error),
            details: formatErrorDetails(error),
          }),
      )
    })
  }
  runPostCommitUiEffect({ id: `chat:archive-refresh:${row.sessionID}`, title: "Chat archive committed" }, () =>
    setMissionSharedRefreshToken((value) => value + 1),
  )
}

async function setActiveWorkLedgerItemPinned(
  row: WorkLedgerTaskRow | WorkLedgerMissionRow | WorkLedgerChatRow,
  pinned: boolean,
): Promise<void> {
  await setWorkLedgerItemPinned({ row, pinned })
  setMissionSharedRefreshToken((value) => value + 1)
}

function assertDebugSelectionCurrent(source: BoardSource): void {
  const current = boardStore.selectedSource
  if (!current || current.kind !== source.kind || current.id !== source.id) {
    throw new Error(`Conversation selection changed while collecting debug information; retry the copy action`)
  }
  const expectedDirectory = normalizeDebugDirectory(source.directory)
  const currentDirectory = normalizeDebugDirectory(current.directory)
  if (expectedDirectory && currentDirectory && expectedDirectory !== currentDirectory) {
    throw new Error(`Conversation directory changed while collecting debug information; retry the copy action`)
  }
}

async function openExpertSquadMarketForProject(projectDirectory?: string): Promise<void> {
  const requestedDirectory = projectDirectory?.trim() ?? ""
  if (requestedDirectory && requestedDirectory !== activeDirectory().trim()) {
    const applied = await applyDirectory(requestedDirectory, {
      save: false,
      persist: false,
      restoreWorkspace: false,
    })
    if (!applied) return
  } else if (!requestedDirectory) {
    await resolveGlobalComposerProject()
  }
  await openConfigDialog("expert-squad-install")
}

async function copyActiveConversationDebug(): Promise<void> {
  const initialSource = boardStore.selectedSource
  const selectedSource = initialSource ? ({ ...initialSource } as BoardSource) : null
  const taskSelectionError = boardStore.taskSelectionError
  const selectedTaskFailure =
    selectedSource?.kind === "task" && taskSelectionError?.taskID === selectedSource.id ? taskSelectionError : null
  if (!selectedSource) throw new Error("No active Task or Chat")
  if (selectedSource.kind !== "session" && !selectedTaskFailure) {
    await loadBoard({ sync: true, requireFresh: true })
  }
  assertDebugSelectionCurrent(selectedSource)
  if (selectedSource.kind === "session" && !String(selectedSource.directory ?? "").trim()) {
    selectedSource.directory = conversationSourceDirectory(selectedSource)
  }
  const persistedChat =
    selectedSource.kind === "session"
      ? await loadPersistedChatDebugProjection({
          sessionID: selectedSource.id,
          directory: String(selectedSource.directory),
        })
      : undefined
  assertDebugSelectionCurrent(selectedSource)
  const debugBoard = selectedSource.kind === "session" ? { ...boardStore.board } : boardStore.board
  const debugCardTree =
    selectedSource.kind === "session"
      ? ({ cards: { ...cardTreeStore.cards }, order: [...cardTreeStore.order] } as typeof cardTreeStore)
      : cardTreeStore
  const blob =
    selectedSource.kind === "session"
      ? buildChatDebugBlob(debugBoard, selectedSource, debugCardTree, persistedChat!)
      : selectedTaskFailure
        ? buildTaskSelectionErrorDebugBlob(selectedTaskFailure, appStore.enginePaths)
        : buildTaskDebugBlob(debugBoard, selectedSource, appStore.enginePaths)
  if (!blob) {
    throw new Error(selectedSource.kind === "session" ? "No active chat session" : "No active task")
  }
  await writeDebugClipboard(blob)
}

async function renameActiveWorkLedgerItem(
  row: WorkLedgerTaskRow | WorkLedgerMissionRow | WorkLedgerChatRow,
): Promise<void> {
  if (row.kind === "mission") return renameWorkLedgerMission(row)
  if (row.kind === "chat") return renameWorkLedgerChat(row)
  return renameWorkLedgerTask(row)
}

async function archiveActiveWorkLedgerItem(
  row: WorkLedgerTaskRow | WorkLedgerMissionRow | WorkLedgerChatRow,
): Promise<void> {
  if (row.kind === "mission") return archiveWorkLedgerMission(row)
  if (row.kind === "chat") return archiveWorkLedgerChat(row)
  return archiveWorkLedgerTask(row)
}

async function openMissionSession(
  result: { sessionID: string; missionID?: string; created?: boolean; productPillar: "code" | "work" },
  directory: string,
  expectedSelectionEpoch?: number,
): Promise<void> {
  const missionDirectory = directory.trim()
  if (!missionDirectory) throw new Error("openMissionSession: directory is required")
  const selectionEpoch = expectedSelectionEpoch ?? beginWorkspaceSelection()
  if (!ownsWorkspaceSelection(selectionEpoch)) {
    throw new DOMException("Mission selection superseded", "AbortError")
  }
  const source = {
    kind: "session" as const,
    id: result.sessionID,
    directory: missionDirectory,
    sessionKind: "mission" as const,
  }
  stopSSE()
  abortChatRequest()
  clearComposerModelProjection()
  cancelConversationReplay()
  setChatAttachments([])
  clearConversationUiState()
  batch(() => {
    resetConversationProjection({ scrollIntent: "bottom", cause: "mission-session-switch" })
    setBoardStore("selectedSource", source)
    clearBoard()
    setBoardStore("taskSwitching", true)
  })
  try {
    const applied = await applyDirectory(missionDirectory, {
      save: true,
      restoreWorkspace: false,
      preserveSelection: true,
      selectionEpoch,
    })
    if (!applied || !ownsWorkspaceSelection(selectionEpoch)) {
      throw new DOMException("Mission selection superseded", "AbortError")
    }
    await projectComposerModelFromSession(
      { sessionID: result.sessionID, directory: missionDirectory },
      () =>
        ownsWorkspaceSelection(selectionEpoch) &&
        boardStore.selectedSource?.kind === "session" &&
        boardStore.selectedSource.id === result.sessionID,
    )
    if (!ownsWorkspaceSelection(selectionEpoch)) return
    setComposerIntent({ productPillar: result.productPillar, conversationTarget: "mission" })
    resetCenterWorkbenchToPrimaryPanel("mission")
    await loadConversation(source, {
      scrollIntent: "bottom",
      resetCause: "mission-session-hydrate",
      directory: missionDirectory,
    })
    if (!ownsWorkspaceSelection(selectionEpoch)) return
    startSSE(source, 0, { directory: missionDirectory })
  } catch (error) {
    if (
      ownsWorkspaceSelection(selectionEpoch) &&
      boardStore.selectedSource?.kind === "session" &&
      boardStore.selectedSource.id === result.sessionID
    ) {
      batch(() => {
        setBoardStore("selectedSource", null)
        resetConversationProjection({ scrollIntent: "bottom", cause: "mission-session-switch-failed" })
        clearBoard()
      })
    }
    throw error
  } finally {
    if (ownsWorkspaceSelection(selectionEpoch)) setBoardStore("taskSwitching", false)
  }
}

function focusInitialRestoredTaskWorkspace(): void {
  if (!activeTaskID() || boardStore.selectedSource?.kind !== "task") return
  setPrimaryCenterPanel("task")
}

function openCenterWorkbenchPanel(panel: CenterWorkbenchPanel): void {
  if (panel !== "conversation") setRightDockVisible(true)
  const tab: CenterWorkbenchTab = {
    id: panel,
    panel,
    ...(panel === "browser" ? { taskPreview: true as const } : {}),
  }
  setCenterWorkbenchPanels((current) => {
    if (current.some((item) => item.id === tab.id)) return current
    return [...current, tab]
  })
  setSelectedCenterWorkbenchTabID(tab.id)
  scheduleCenterWorkbenchPanelReveal(panel)
}

disposers.push(
  registerReviewPanelPresenter(() => {
    setFileChangesActiveView("changes")
    openCenterWorkbenchPanel("diff")
  }),
)

function openBlankBrowserTab(tabID: string): void {
  const tab: CenterWorkbenchTab = {
    id: tabID,
    panel: "browser",
  }
  setRightDockVisible(true)
  setCenterWorkbenchPanels((current) => [...current, tab])
  setSelectedCenterWorkbenchTabID(tab.id)
}

function removeCenterWorkbenchTabs(matches: (tab: CenterWorkbenchTab) => boolean): void {
  const current = untrack(centerWorkbenchPanels)
  const remaining = current.filter((tab) => !matches(tab))
  if (remaining.length === current.length) return

  const selectedID = untrack(selectedCenterWorkbenchTabID)
  if (!remaining.some((tab) => tab.id === selectedID)) {
    const selectedIndex = current.findIndex((tab) => tab.id === selectedID)
    const nextSelectedIndex = Math.max(0, Math.min(selectedIndex - 1, remaining.length - 1))
    setSelectedCenterWorkbenchTabID(remaining[nextSelectedIndex].id)
  }

  setCenterWorkbenchPanels(remaining)
}

function closeCenterWorkbenchPanel(panel: CenterWorkbenchPanel): void {
  if (panel === "conversation") return
  if (panel === "diff") setWorkspaceOpen(false)
  if (panel === "file") {
    void closeFileEditor()
    return
  }
  removeCenterWorkbenchTabs((tab) => tab.panel === panel)
}

function closeRightDockTab(tabID: string): void {
  const tab = untrack(centerWorkbenchPanels).find((item) => item.id === tabID)
  if (!tab || tab.panel === "conversation") return
  if (tab.panel === "diff") setWorkspaceOpen(false)
  if (tab.panel === "file") {
    void closeFileEditor()
    return
  }
  removeCenterWorkbenchTabs((item) => item.id === tabID)
  if (tab.panel === "browser") {
    setBrowserPreviewPageTitles((current) => {
      const next = { ...current }
      delete next[tabID]
      return next
    })
  }
}

function getCenterWorkbenchViews(): Record<CenterWorkbenchPanel, HTMLElement | null> {
  return {
    conversation: document.getElementById("centerWorkbenchConversation"),
    requirements: document.getElementById("centerWorkbenchRequirements"),
    goals: document.getElementById("centerWorkbenchGoals"),
    explorer: document.getElementById("centerWorkbenchExplorer"),
    diff: document.getElementById("centerWorkbenchDiff"),
    browser: document.getElementById("centerWorkbenchBrowser"),
    screenshots: document.getElementById("centerWorkbenchScreenshots"),
    subagent: document.getElementById("centerWorkbenchSubagent"),
    file: document.getElementById("centerWorkbenchFile"),
  }
}

function orderedCenterWorkbenchPanels(panels = centerWorkbenchPanels()): CenterWorkbenchPanel[] {
  const open = new Set(panels.map((tab) => tab.panel))
  return CENTER_WORKBENCH_PANEL_ORDER.filter((panel) => open.has(panel))
}

function selectedCenterWorkbenchTab(panels = centerWorkbenchPanels()): CenterWorkbenchTab | null {
  const selectedID = selectedCenterWorkbenchTabID()
  return panels.find((tab) => tab.id === selectedID) ?? null
}

// ── Right dock tab model ──
// The right dock hosts the tool panels as tabs. Tabs are the open panels in
// `centerWorkbenchPanels` excluding "conversation" (which stays in the center).
// `selectedCenterWorkbenchTabID` owns activation without changing insertion order.

function rightDockTabPanels(panels = centerWorkbenchPanels()): RightDockTab[] {
  return panels.filter((tab): tab is CenterWorkbenchTab & { panel: RightDockPanel } => tab.panel !== "conversation")
}

function activateCenterWorkbenchTab(tabID: string): void {
  const tab = untrack(centerWorkbenchPanels).find((item) => item.id === tabID)
  if (!tab) return
  setSelectedCenterWorkbenchTabID(tabID)
  scheduleCenterWorkbenchPanelReveal(tab.panel)
}

function selectRightDockTab(tabID: string): void {
  const panel = untrack(centerWorkbenchPanels).find((tab) => tab.id === tabID)?.panel
  if (panel === "diff") setFileChangesActiveView("changes")
  activateCenterWorkbenchTab(tabID)
}

function renderRightDockWidth(): void {
  const dock = document.getElementById("rightDock")
  if (!dock) return
  const raw = Number(settingsStore.rightDockWidth)
  if (Number.isFinite(raw) && raw > 0) dock.style.setProperty("--right-dock-width", `${clampRightDockWidth(raw)}px`)
  else dock.style.removeProperty("--right-dock-width")
}

const revealPendingCenterWorkbenchPanelOnFrame = createAnimationFrameScheduler(revealPendingCenterWorkbenchPanel)
disposers.push(() => {
  revealPendingCenterWorkbenchPanelOnFrame.cancel()
  pendingCenterWorkbenchRevealPanel = null
})

function scheduleCenterWorkbenchPanelReveal(panel: CenterWorkbenchPanel): void {
  pendingCenterWorkbenchRevealPanel = panel
  revealPendingCenterWorkbenchPanelOnFrame.schedule()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** Open the workspace panel. */
function openWorkspace(): void {
  setWorkspaceOpen(true)
  setFileChangesActiveView("diff")
  openCenterWorkbenchPanel("diff")
}

/** Close the workspace panel. */
function closeWorkspace(): void {
  setWorkspaceOpen(false)
  closeCenterWorkbenchPanel("diff")
}

/** Open (or switch to) a diff file in the workspace. */
async function openWorkspaceDiff(target: DiffTarget): Promise<void> {
  if (!(await closeFileEditor())) return
  setWorkspaceTarget(target)
  openWorkspace()
}

// Exposed for services and window-level bridges that need to trigger the
// workspace from outside this module (e.g. ChangesPanel clicks).
;(window as any).openWorkspaceDiff = openWorkspaceDiff

// Delegate clicks on rendered-markdown file links (see utils/markdown.ts —
// codespans that look like file paths are emitted with data-file-path).
// A single document-level listener keeps this decoupled from the message
// rendering path, which re-runs on every stream tick.
document.addEventListener(
  "click",
  (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target) return
    const imageTrigger = target.closest<HTMLElement>("[data-image-preview-trigger]")
    if (imageTrigger) {
      const src =
        imageTrigger.getAttribute("data-image-preview-src") ||
        imageTrigger.querySelector("img")?.getAttribute("src") ||
        ""
      const alt =
        imageTrigger.getAttribute("data-image-preview-alt") ||
        imageTrigger.querySelector("img")?.getAttribute("alt") ||
        ""
      ev.preventDefault()
      openImagePreview(src, alt)
      return
    }
    const link = target.closest<HTMLElement>("[data-file-path]")
    if (link) {
      const path = link.getAttribute("data-file-path")
      if (!path) return
      ev.preventDefault()
      runMainAsync("workspace.open-file-link", () => openPathInSelectedEditor(path))
      return
    }
    const projectFileLink = target.closest<HTMLElement>("[data-project-file-path]")
    if (!projectFileLink) return
    const projectFilePath = projectFileLink.getAttribute("data-project-file-path")
    if (!projectFilePath) return
    ev.preventDefault()
    runMainAsync("workspace.open-project-file", () => openProjectFile(projectFilePath))
  },
  listenerOpts,
)

document.addEventListener(
  "click",
  (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target) return
    const anchor = target.closest<HTMLAnchorElement>("a[href]")
    if (!anchor || anchor.hasAttribute("data-file-path")) return
    const previewUrl = anchor.getAttribute("data-browser-preview-url") || ""
    const href = previewUrl || anchor.getAttribute("href") || ""
    if (!/^https?:\/\//i.test(href)) return
    const canOpenExternalUrl = getHostTransport().capabilities.nativeCommands["open-url"]
    if (!previewUrl && !canOpenExternalUrl) return
    ev.preventDefault()
    runMainAsync("browser-preview.open-url", async () => {
      try {
        if (previewUrl) {
          openBrowserPreviewFromMessage(previewUrl)
          return
        }
        if (!canOpenExternalUrl) return
        await nativeOpen(href)
      } catch (error) {
        console.error("[ui] Failed to open external link", error)
        reportError({
          id: "browser-preview:open-url",
          title: t("browser_preview.title"),
          message: error instanceof Error ? error.message : String(error),
          details: formatErrorDetails(error),
        })
      }
    })
  },
  listenerOpts,
)

// Code-block copy buttons rendered by utils/markdown.ts wrapCodeBlock.
// markdown HTML lives inside innerHTML on streamed text — wiring per-button
// click handlers in Solid would require re-binding on every stream tick,
// so a single document-level listener keeps the renderer pure.
document.addEventListener(
  "click",
  (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target) return
    const btn = target.closest<HTMLButtonElement>("button[data-md-copy]")
    if (!btn) return
    ev.preventDefault()
    ev.stopPropagation()
    const source = btn.getAttribute("data-md-copy") || ""
    if (!source) return
    const flash = (text: string) => {
      btn.dataset.copied = "true"
      const prev = btn.getAttribute("aria-label") || ""
      btn.setAttribute("aria-label", text)
      btn.title = text
      setTimeout(() => {
        delete btn.dataset.copied
        btn.setAttribute("aria-label", prev || t("markdown.copy_code"))
        btn.title = prev || t("markdown.copy_code")
      }, 1400)
    }
    const decoded = source
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    runMainAsync("markdown.copy-code", async () => {
      try {
        await navigator.clipboard.writeText(decoded)
        flash(t("markdown.copied"))
      } catch (err) {
        console.error("[md-copy] clipboard write failed", err)
        flash(t("markdown.copy_failed"))
      }
    })
  },
  listenerOpts,
)

window.addEventListener(
  "acceptance:focus-changes",
  requestReviewPanel,
  listenerOpts,
)

function installGlobalBridges(): void {
  ;(window as any).renderMarkdown = renderMarkdown
  ;(window as any).persistOverlaySettings = async () => {
    await saveSettings()
  }
  ;(window as any).stepZoom = (delta: number) => {
    const next = stepZoom(delta)
    setSettingsStore("zoom", next)
    persistMainSettings("settings.persist-step-zoom")
  }
  // Test hook: snapshot the current card tree as a flat JSON shape. Used by
  // Playwright / integration tests to read the live store-backed tree.
  ;(window as any).renderConversation = () => cardTreeStore.order.map((id) => cardTreeStore.cards[id]).filter(Boolean)
  ;(window as any).cardTree = cardTreeStore
  // Benchmark hook: expose named stores so external probes do not depend on
  // the legacy aggregate `state` bridge.
  ;(window as any).appStore = appStore
  ;(window as any).boardStore = boardStore
  ;(window as any).settingsStore = settingsStore
  ;(window as any).applyDirectory = applyDirectory
  ;(window as any).loadTasks = loadTasks
  ;(window as any).selectTask = (taskID: string, options?: { directory?: string }) =>
    selectTaskWithUILifecycle(taskID, options?.directory?.trim() || activeDirectory())
  ;(window as any).loadBoard = loadBoard
}

installGlobalBridges()

// Components call strict `t()` at render time. Load the locale bundles before
// mounting any Solid surface so early hosts do not render against an empty
// translation dictionary.
await loadAllLocales()
await setLocale(localeTag())

// ── Mount: Conversation ──

// ── Mount: WorkLedger ──

// ── Mount: ChatComposer ──

const [composerStopping, setComposerStopping] = createSignal(false)
const [composerExpertSquadCatalogSnapshot, setComposerExpertSquadCatalogSnapshot] = createSignal(
  emptyComposerExpertSquadCatalog(),
)
let expertSquadLoadSequence = 0
let expertSquadInFlight: { requestKey: string; promise: Promise<void> } | null = null
let expertSquadLoadedRequestKey = ""
let expertSquadSearchSequence = 0
async function refreshExpertSquads(
  scope: ExpertSquadCatalogScope | Extract<ComposerReferenceCatalogScopeState, { kind: "global" }>,
  requestKey: string,
): Promise<void> {
  if (requestKey === expertSquadLoadedRequestKey) return
  if (expertSquadInFlight?.requestKey === requestKey) return await expertSquadInFlight.promise
  const sequence = ++expertSquadLoadSequence
  const promise = (async () => {
    try {
      if (scope.kind === "global") {
        const catalog = await loadGlobalComposerReferences()
        if (sequence !== expertSquadLoadSequence) return
        setComposerExpertSquadCatalogSnapshot(createGlobalComposerReferenceCatalogSnapshot(requestKey, catalog))
        expertSquadLoadedRequestKey = requestKey
        return
      }
      const catalogPromise = loadExpertSquadCatalog(scope)
      const activeInspectionPromise = catalogPromise.then((catalog) =>
        inspectExpertSquad({ directory: scope.directory, id: catalog.active.effective }),
      )
      const [catalog, squads, missionSkillCatalog, chatCapability, activeInspection] = await Promise.allSettled([
        catalogPromise,
        searchExpertSquads({ directory: scope.directory, productPillar: composerIntent().productPillar }),
        loadMissionSkillCatalog(scope),
        loadConversationCapability(scope.directory, "chat"),
        activeInspectionPromise,
      ])
      if (sequence !== expertSquadLoadSequence) return
      setComposerExpertSquadCatalogSnapshot(
        createComposerReferenceCatalogSnapshotFromSettled(requestKey, composerExpertSquadCatalogSnapshot(), {
          catalog,
          squads,
          missionSkills: missionSkillCatalog,
          chatCapability,
          activeInspection,
        }),
      )
      expertSquadLoadedRequestKey = requestKey
      const snapshot = composerExpertSquadCatalogSnapshot()
      if (!snapshot.error) return
      AppLog.warn("composer-reference", "Reference catalog unavailable for composer", {
        error: snapshot.error,
        requestKey,
      })
    } catch (error) {
      if (sequence !== expertSquadLoadSequence) return
      expertSquadLoadedRequestKey = ""
      AppLog.warn("composer-reference", "Reference catalog reconciliation failed", {
        error: runtimeErrorMessage(error),
        requestKey,
      })
    } finally {
      if (expertSquadInFlight?.promise === promise) expertSquadInFlight = null
    }
  })()
  expertSquadInFlight = { requestKey, promise }
  await promise
}

async function searchComposerExpertSquads(query: string, selectedExpertSquadIDs: readonly string[] = []): Promise<void> {
  const sequence = ++expertSquadSearchSequence
  const requestKey = composerReferenceCatalogRequestKey()
  const scope = composerReferenceCatalogScope()
  if (scope.kind === "pending" || scope.kind === "unavailable") return
  try {
    const page =
      scope.kind === "global"
        ? await searchGlobalComposerExpertSquads({
            query,
            productPillar: composerIntent().productPillar,
            limit: 20,
          })
        : await searchExpertSquads({
            directory: scope.directory,
            query,
            productPillar: composerIntent().productPillar,
            limit: 20,
          })
    if (sequence !== expertSquadSearchSequence || requestKey !== composerReferenceCatalogRequestKey()) return
    setComposerExpertSquadCatalogSnapshot((current) =>
      current.requestKey === requestKey
        ? {
            ...current,
            squads: mergeComposerExpertSquadOptions(page.entries, current.squads, [
              current.activeID,
              ...selectedExpertSquadIDs,
            ]),
            error: "",
          }
        : current,
    )
  } catch (error) {
    if (sequence !== expertSquadSearchSequence || requestKey !== composerReferenceCatalogRequestKey()) return
    const message = `expert squad search: ${runtimeErrorMessage(error)}`
    setComposerExpertSquadCatalogSnapshot((current) =>
      current.requestKey === requestKey ? { ...current, error: message } : current,
    )
    AppLog.warn("composer-reference", "Expert Squad search failed", { error: message, requestKey })
  }
}

function newRequestComposerDraftKey(): string {
  const directory = activeDirectory()
  return directory ? composerDraftKey("launcher", "new", directory) : composerDraftKey("launcher", "new")
}

const panelComposerDraftKey = () => {
  const taskID = activeTaskID()
  if (taskID) return composerDraftKey("task", taskID)
  const sessionID = activeSessionID()
  if (sessionID) return composerDraftKey("session", sessionID)
  return newRequestComposerDraftKey()
}

function missionSubmitActive(): boolean {
  return composerIntent().conversationTarget === "mission" && !activeTaskID() && !activeSessionID()
}

function conversationSubmitActive(): boolean {
  return composerIntent().conversationTarget === "chat" && !isConversationSource()
}

function resolvedActiveComposerIntent(): ComposerIntent | undefined {
  const item = workLedgerActiveItem({ taskID: activeTaskID(), sessionID: activeSessionID() })
  if (!item) return undefined
  if (item.kind === "chat") {
    return {
      productPillar: productPillarFromConversationExperience(item.experience),
      conversationTarget: "chat",
    }
  }
  return {
    productPillar: item.productPillar,
    conversationTarget: "mission",
  }
}

function launcherHomeActive(): boolean {
  const panel = primaryCenterPanel()
  return (
    (panel === "chat" || panel === "mission") &&
    !activeTaskID() &&
    !activeSessionID() &&
    cardTreeStore.order.length === 0
  )
}

// ── Initialise application ──

const [settingsHydrated, setSettingsHydrated] = createSignal(false)

const paneCallbacks = {
  getState: () => ({
    sidebarCollapsed: settingsStore.sidebarCollapsed,
    sidebarWidth: settingsStore.sidebarWidth,
  }),
  onWidthsChanged: (sidebarWidth: number | null) => {
    setSettingsStore({
      ...(sidebarWidth != null ? { sidebarWidth } : {}),
    })
    persistMainSettings("settings.persist-pane-width")
  },
}

function OverlayRoot() {
  const homeActive = createMemo(launcherHomeActive)
  const composerExpertSquadCatalog = createMemo(() => {
    const catalog = composerExpertSquadCatalogForRequest(
      composerExpertSquadCatalogSnapshot(),
      composerReferenceCatalogRequestKey(),
    )
    return {
      ...catalog,
      squads: catalog.squads.filter((squad) => squad.product_pillars.includes(composerIntent().productPillar)),
    }
  })
  const composerLaunchReferences = createMemo<VisibleComposerReferences>(() => {
    const source = boardStore.selectedSource
    const board = boardStore.board
    if (source?.kind === "task" && board?.task?.id === source.id) {
      return visibleComposerReferences(typeof board.task.request === "string" ? board.task.request : "")
    }
    if (source?.kind === "session" && board?.kind === "session" && board.sessionID === source.id) {
      return VisibleComposerReferencesSchema.parse(board.composerReferences)
    }
    return visibleComposerReferences("")
  })

  onMount(() => {
    const disposePaneResizers = initPaneResizers(paneCallbacks, PANEL_PANE_CONFIG)
    onCleanup(disposePaneResizers)
  })

  createEffect<string>((previousKey) => {
    const requestKey = composerReferenceCatalogRequestKey()
    if (requestKey === previousKey) return previousKey
    const scope = composerReferenceCatalogScope()
    if (scope.kind === "pending" || scope.kind === "unavailable") {
      expertSquadLoadSequence++
      expertSquadInFlight = null
      expertSquadLoadedRequestKey = ""
      setComposerExpertSquadCatalogSnapshot(emptyComposerExpertSquadCatalog())
      return requestKey
    }
    void refreshExpertSquads(scope, requestKey)
    return requestKey
  }, "")

  createEffect<string>((previousDirectory) => {
    const directory = activeDirectory()
    if (directory !== previousDirectory) setMailboxAttention(false)
    return directory
  }, "")

  createEffect(() => {
    const open = rightDockOpen()
    if (!open && rightDockAddMenuOpen()) setRightDockAddMenuOpen(false)
    if (!open && rightDockOverflowMenuOpen()) setRightDockOverflowMenuOpen(false)
    const dock = document.getElementById("rightDock")
    const resizer = document.getElementById("rightDockResizer")
    if (dock) {
      dock.dataset.open = open ? "true" : "false"
      dock.inert = !open
      dock.setAttribute("aria-hidden", String(!open))
    }
    if (resizer) {
      resizer.dataset.open = open ? "true" : "false"
      resizer.setAttribute("aria-hidden", String(!open))
      resizer.tabIndex = open ? 0 : -1
    }
    renderRightDockWidth()
  })

  // body.dataset.workspace / .connection writes were dead — no CSS or JS in
  // the codebase reads either attribute. Removed (rule 10). The static
  // initial `data-workspace="offline"` in index.html is also stripped.

  createEffect(() => {
    if (!settingsHydrated()) return
    applyTheme(settingsStore.theme)
    applyZoom(settingsStore.zoom)
  })

  createEffect(() => {
    if (!settingsHydrated()) return
    configureApi({
      serverUrl: settingsStore.serverUrl,
      username: settingsStore.username,
      password: settingsStore.password,
      directory: activeDirectory(),
    })
  })

  createEffect(() => {
    runMainAsync("locale.apply-settings", () => setLocale(settingsStore.locale))
  })

  onMount(() => syncScrollbarGuttersOnFrame.schedule())

  // ── Task-switch progress bar (non-blocking) ──
  // Reflects boardStore.taskSwitching (set synchronously at selectTask entry,
  // cleared when the async load chain completes). The bar lives in a fixed
  // slot above the chat header so user input is never gated on load.
  createEffect(() => {
    const active = boardStore.taskSwitching
    const bar = document.getElementById("taskSwitchProgress")
    if (!bar) return
    bar.setAttribute("data-active", active ? "true" : "false")
    bar.setAttribute("aria-busy", active ? "true" : "false")
  })

  createEffect(() => {
    const panels = centerWorkbenchPanels()
    const primarySurface = primaryWorkspaceSurface()
    const selectedTab = selectedCenterWorkbenchTab(panels)
    const workbench = document.getElementById("centerWorkbench")
    const views = getCenterWorkbenchViews()
    if (views.conversation) {
      views.conversation.dataset.workbenchView = primaryCenterPanel()
      views.conversation.dataset.open = String(primarySurface === "conversation")
      views.conversation.dataset.active = String(primarySurface === "conversation")
    }
    const missionBoard = document.getElementById("centerWorkbenchMissionBoard")
    if (missionBoard) {
      missionBoard.dataset.open = String(primarySurface === "mission-board")
      missionBoard.dataset.active = String(primarySurface === "mission-board")
    }
    if (workbench) {
      workbench.dataset.open = "true"
      workbench.hidden = false
    }
    for (const [panel, body] of Object.entries(views)) {
      if (!body) continue
      if (panel === "conversation") {
        continue
      }
      const open = panels.some((tab) => tab.panel === panel)
      const selected = open && panel === selectedTab?.panel
      body.dataset.open = String(open)
      body.dataset.active = String(selected)
    }
  })

  createEffect(() => {
    const open = fileWorkbenchOpen()
    if (open) {
      setWorkspaceOpen(false)
      openCenterWorkbenchPanel("file")
    } else {
      removeCenterWorkbenchTabs((tab) => tab.panel === "file")
    }
  })

  createEffect(() => {
    const open = workspaceOpen()
    if (open) {
      openCenterWorkbenchPanel("diff")
    } else {
      closeCenterWorkbenchPanel("diff")
    }
  })

  createEffect(() => {
    const sidebarCollapsed = settingsStore.sidebarCollapsed

    const sidebar = document.getElementById("sidebar")
    const leftActivityShell = document.getElementById("leftActivityShell")

    if (sidebar) {
      sidebar.dataset.collapsed = String(sidebarCollapsed)
      sidebar.hidden = false
    }
    if (leftActivityShell) {
      leftActivityShell.dataset.collapsed = String(sidebarCollapsed)
      leftActivityShell.inert = sidebarCollapsed
      leftActivityShell.setAttribute("aria-hidden", String(sidebarCollapsed))
    }

    schedulePaneLayout({
      sidebarCollapsed,
      sidebarWidth: settingsStore.sidebarWidth,
    })
  })

  return (
    <App
      primarySurface={primaryWorkspaceSurface}
      missionBoard={
        <MissionBoard
          projectDirectories={missionBoardProjectDirectories()}
          defaultProjectDirectory={activeDirectory()}
          productPillar={composerIntent().productPillar}
          expertSquads={composerExpertSquadCatalog().squads}
          onExpertSquadQuery={(query, selectedIDs) => void searchComposerExpertSquads(query, selectedIDs)}
          onInstallMoreExpertSquads={(directory) =>
            void runMainAsync("expert-squad.open-market", () => openExpertSquadMarketForProject(directory))
          }
          activeExpertSquadID={composerExpertSquadCatalog().activeID}
          onOpenMission={(mission) =>
            runMainAsync("mission-board.open-mission", () => openMissionBoardMission(mission))
          }
          onCreateManual={createMissionBoardDraft}
          onCreateWithAI={createMissionBoardWithAI}
          onDispatchMission={dispatchMissionBoardDraft}
          onDeleteMission={deleteMissionBoardMission}
        />
      }
      onSelectTask={selectTaskWithUILifecycle}
      onSelectChat={(sessionID, directory, experience) =>
        selectConversationWithUILifecycle(sessionID, directory, experience)
      }
      conversationExperience={() =>
        conversationSourceExperience() ??
        (conversationSubmitActive()
          ? conversationExperienceFromProductPillar(composerIntent().productPillar)
          : undefined)
      }
      conversationTitle={() => {
        settingsStore.locale
        const activeItem = workLedgerActiveItem({
          taskID: activeTaskID(),
          sessionID: activeSessionID(),
        })
        const selectedTaskTitle =
          boardStore.selectedSource?.kind === "task" && typeof boardStore.board?.task?.title === "string"
            ? boardStore.board.task.title.trim()
            : ""
        return missionSubmitActive()
          ? t("expert_squad.launcher.title")
          : conversationSubmitActive()
            ? composerIntent().productPillar === "work"
              ? t("work.launcher.title")
              : t("coding_assistant.launcher.title")
            : activeItem?.title ||
              (primaryCenterPanel() === "mission"
                ? t("mission.title")
                : primaryCenterPanel() === "chat" || isConversationSource()
                  ? conversationSourceExperience() === "work" || composerIntent().productPillar === "work"
                    ? t("work_ledger.kind.work")
                    : t("chat.panel_title")
                  : selectedTaskTitle || t("task.panel_title"))
      }}
      conversationItem={() =>
        workLedgerActiveItem({
          taskID: activeTaskID(),
          sessionID: activeSessionID(),
        })
      }
      onCopyConversationDebug={copyActiveConversationDebug}
      onConversationPinnedChange={(row, pinned) =>
        runMainAsync("work-ledger.header-pin", () => setActiveWorkLedgerItemPinned(row, pinned))
      }
      onRenameConversationItem={(row) =>
        runMainAsync("work-ledger.header-rename", () => renameActiveWorkLedgerItem(row))
      }
      onArchiveConversationItem={(row) =>
        runMainAsync("work-ledger.header-archive", () => archiveActiveWorkLedgerItem(row))
      }
      onRetryTask={(row) => runMainAsync("task.header-retry", () => retryTerminalTask(row))}
      onReplanTask={(row) => runMainAsync("task.header-replan", () => replanTerminalTask(row))}
      onOpenAutomationSession={openAutomationSession}
      mailboxAttention={mailboxAttention()}
      mailboxUnreadCount={mailboxUnreadCount()}
      onMailboxViewed={() => setMailboxAttention(false)}
      sidebarToggle={
        <Button
          variant="ghost"
          size="icon"
          tone="neutral"
          type="button"
          data-ui="titlebar-sidebar-toggle"
          data-chrome="icon-action"
          title={t(settingsStore.sidebarCollapsed ? "titlebar.sidebar_show" : "titlebar.sidebar_hide")}
          aria-label={t(settingsStore.sidebarCollapsed ? "titlebar.sidebar_show" : "titlebar.sidebar_hide")}
          aria-controls="sidebar workspaceMain"
          aria-expanded={!settingsStore.sidebarCollapsed}
          onClick={() => {
            setSettingsStore("sidebarCollapsed", !settingsStore.sidebarCollapsed)
            persistMainSettings("settings.persist-sidebar-collapse")
          }}
        >
          <Icon name="panel-left" />
        </Button>
      }
      leftPanelActions={
        <Button
          variant="ghost"
          size="icon"
          tone="neutral"
          type="button"
          data-ui="left-panel-open-project"
          data-chrome="icon-action"
          title={t("work_ledger.open_project")}
          aria-label={t("work_ledger.open_project")}
          onClick={() => runMainAsync("projects.open-folder", () => browseDirectory())}
        >
          <Icon name="project-add" size="medium" />
        </Button>
      }
      workLedger={
        <WorkLedger
          selectedTaskID={activeTaskID()}
          selectedSessionID={activeSessionID()}
          refreshToken={missionSharedRefreshToken()}
          onOpenMissionBoard={openMissionBoard}
          onSelectMission={(row) => runMainAsync("work-ledger.select-mission", () => openWorkLedgerMission(row))}
          onSelectTask={(row) => runMainAsync("work-ledger.select-task", () => selectWorkLedgerTask(row))}
          onSelectChat={(row) => runMainAsync("work-ledger.select-chat", () => openWorkLedgerChat(row))}
          onAbortMission={abortWorkLedgerMission}
          onDownloadMission={downloadWorkLedgerMission}
          onRenameMission={renameWorkLedgerMission}
          onArchiveMission={archiveWorkLedgerMission}
          onStartTask={startWorkLedgerTask}
          onCancelTask={cancelWorkLedgerTask}
          onDownloadTask={downloadWorkLedgerTask}
          onRenameTask={renameWorkLedgerTask}
          onArchiveTask={archiveWorkLedgerTask}
          onCreateGlobalChat={() => openGlobalComposer(DEFAULT_COMPOSER_INTENT)}
          onCreateChat={(directory) =>
            runMainAsync("work-ledger.project-new-chat", () => selectWorkLedgerProject(directory))
          }
          onOpenProjectDirectory={
            getHostTransport().capabilities.nativeCommands["open-path"]
              ? (directory) =>
                  runMainAsync("work-ledger.project-open-directory", () => openWorkLedgerProjectDirectory(directory))
              : undefined
          }
          onRenameProject={(directory, currentName) =>
            runMainAsync("work-ledger.project-rename", () => renameWorkLedgerProject(directory, currentName))
          }
          onPromoteProject={(directory) =>
            runMainAsync("work-ledger.project-promote-anonymous", () => promoteWorkLedgerAnonymousProject(directory))
          }
          onStartMulticaImport={(directory) =>
            runMainAsync("work-ledger.multica-import", () => startWorkLedgerMulticaImport(directory))
          }
          onDeleteProject={(directory) =>
            runMainAsync("work-ledger.project-delete", () => deleteWorkLedgerProject(directory))
          }
          onSelectProject={(directory) =>
            runMainAsync("work-ledger.project-select", () => selectWorkLedgerProject(directory))
          }
          onStopChat={stopWorkLedgerChat}
          onRenameChat={renameWorkLedgerChat}
          onArchiveChat={archiveWorkLedgerChat}
        />
      }
      mailbox={
        <MailboxPanel
          onNotification={presentMailboxNotification}
          onUnreadCountChange={setMailboxUnreadCount}
          onSelectTask={selectTaskWithUILifecycle}
        />
      }
      conversation={(container) => (
        <Conversation
          container={container}
          homeActive={homeActive()}
          launcherIntent={composerIntent()}
          onOpenSubagentConversation={openSubagentConversation}
        />
      )}
      homeActive={homeActive()}
      composer={
        <ChatComposer
          enabled={
            canComposeChat() &&
            !missionLauncherSubmitting() &&
            !expertSquadLauncherSubmitting() &&
            !assistantLauncherSubmitting()
          }
          busy={
            !!messageStore.chatRequest || isTaskInterruptable() || workLedgerSessionInterruptible(activeSessionID())
          }
          stopping={composerStopping()}
          draftKey={panelComposerDraftKey()}
          placeholder={
            missionSubmitActive()
              ? t("expert_squad.launcher.placeholder")
              : conversationSubmitActive()
                ? composerIntent().productPillar === "work"
                  ? t("work.launcher.placeholder")
                  : t("coding_assistant.launcher.placeholder")
                : undefined
          }
          textareaDataUI={
            missionSubmitActive()
              ? "mission-composer-input"
              : conversationSubmitActive()
                ? composerIntent().productPillar === "work"
                  ? "work-composer-input"
                  : "coding-assistant-composer-input"
                : undefined
          }
          sendDataUI={
            missionSubmitActive()
              ? "mission-composer-submit"
              : conversationSubmitActive()
                ? composerIntent().productPillar === "work"
                  ? "work-composer-submit"
                  : "coding-assistant-composer-submit"
                : undefined
          }
          skills={
            composerIntent().conversationTarget === "chat"
              ? composerExpertSquadCatalog().chatSkills
              : composerExpertSquadCatalog().skills
          }
          missionSkills={composerExpertSquadCatalog().missionSkills}
          referenceCatalogError={composerExpertSquadCatalog().error}
          expertSquads={composerExpertSquadCatalog().squads}
          onExpertSquadQuery={(query, selectedIDs) => void searchComposerExpertSquads(query, selectedIDs)}
          onInstallMoreExpertSquads={() =>
            void runMainAsync("expert-squad.open-market", () => openExpertSquadMarketForProject())
          }
          activeExpertSquadID={composerExpertSquadCatalog().activeID}
          conversationActive={Boolean(activeTaskID() || activeSessionID())}
          launchReferences={composerLaunchReferences()}
          conversationExperience={conversationSourceExperience()}
          composerIntent={composerIntent()}
          activeComposerIntent={resolvedActiveComposerIntent()}
          onComposerIntentChange={handleComposerIntentChange}
          resolveAttachmentDirectory={async () => {
            const sourceDraftKey = panelComposerDraftKey()
            const sourceDraft = composerDraftText(sourceDraftKey)
            const directory = await resolveGlobalComposerProject()
            const targetDraftKey = panelComposerDraftKey()
            if (sourceDraftKey !== targetDraftKey && sourceDraft && !composerDraftText(targetDraftKey)) {
              setComposerDraft(targetDraftKey, sourceDraft)
            }
            return directory
          }}
          onSubmit={async (text, attachments, webSearch, directives) => {
            const submitRoute = resolveComposerSubmitRoute(directives)
            const intentRoute = resolveComposerIntentRoute(composerIntent(), submitRoute.kind === "mission")
            const metadata = webSearch ? { web_search: true } : {}
            if (intentRoute.kind === "mission" && (submitRoute.kind === "mission" || missionSubmitActive())) {
              setExpertSquadLauncherSubmitting(true)
              try {
                const { directory, model } = await resolveGlobalComposerSubmissionContext()
                const selectionEpoch = beginWorkspaceSelection()
                const result = await wakeMission({
                  directory,
                  text,
                  attachments,
                  model,
                  productPillar: intentRoute.productPillar,
                  expertSquadIDs: submitRoute.kind === "mission" ? submitRoute.expertSquadIDs : undefined,
                })
                setComposerIntent((current) => ({ ...current, conversationTarget: "mission" }))
                resetCenterWorkbenchToPrimaryPanel("mission")
                await openMissionSession(result, directory, selectionEpoch)
                setMissionSharedRefreshToken((value) => value + 1)
                return result
              } finally {
                setExpertSquadLauncherSubmitting(false)
              }
            }
            if (conversationSubmitActive()) {
              setAssistantLauncherSubmitting(true)
              try {
                const directory = activeDirectory().trim()
                const experience = intentRoute.kind === "conversation" ? intentRoute.experience : undefined
                if (!experience) throw new Error("Conversation submit resolved without a conversation experience")
                if (directory) {
                  await createConversationSession({
                    directory,
                    experience,
                    model: appStore.composerModel || undefined,
                  })
                } else
                  await createGlobalConversationSession({
                    experience,
                    model: appStore.composerModel || undefined,
                  })
                const result = await panelMessage(text, attachments, metadata)
                const source = boardStore.selectedSource
                if (
                  source?.kind === "session" &&
                  boardStore.board?.kind === "session" &&
                  boardStore.board.sessionID === source.id
                ) {
                  setBoardStore("board", "composerReferences", visibleComposerReferences(text))
                }
                setMissionSharedRefreshToken((value) => value + 1)
                return result
              } finally {
                setAssistantLauncherSubmitting(false)
              }
            }
            const refreshMissionLedger = isMissionSessionSource()
            const result = await panelMessage(text, attachments, metadata)
            if (refreshMissionLedger) setMissionSharedRefreshToken((value) => value + 1)
            return result
          }}
          onStop={() => {
            runMainAsync("chat.stop", async () => {
              if (composerStopping()) return
              setComposerStopping(true)
              try {
                if (messageStore.chatRequest) {
                  await stopChatRequest()
                  return
                }
                const taskID = activeTaskID()
                if (taskID && isTaskInterruptable()) {
                  await cancelTask(taskID, {
                    surface: "overlay.composer_stop",
                    reason: "Operator stopped the active task from the composer",
                  })
                  return
                }
                const execution = workLedgerSessionExecution(activeSessionID())
                if (execution?.kind === "mission") {
                  const ok = await abortMission(
                    { missionID: execution.missionID, directory: execution.directory },
                    {
                      surface: "overlay.composer_stop",
                      reason: "Operator stopped the active Mission from the composer",
                    },
                  )
                  if (!ok) throw new Error(t("mission.error.action.abort"))
                  setMissionSharedRefreshToken((value) => value + 1)
                  return
                }
                if (execution?.kind === "chat") {
                  const ok = await stopConversationSession({
                    sessionID: execution.sessionID,
                    directory: execution.directory,
                    experience: execution.experience,
                  })
                  if (!ok) throw new Error("Coding assistant stop failed")
                  setMissionSharedRefreshToken((value) => value + 1)
                }
              } finally {
                setComposerStopping(false)
              }
            })
          }}
        />
      }
      rightDock={
        <RightDock
          addMenuOpen={rightDockAddMenuOpen}
          tabs={rightDockTabPanels}
          active={() => {
            const selected = selectedCenterWorkbenchTab()
            return selected?.panel === "conversation" ? null : (selected?.id ?? null)
          }}
          onSelect={selectRightDockTab}
          onOpen={(panel) => openCenterWorkbenchPanel(panel)}
          onNewBrowserTab={openBlankBrowserTab}
          onClose={closeRightDockTab}
          onCloseDock={() => setRightDockVisible(false)}
          onAddMenuOpenChange={setRightDockAddMenuOpen}
          overflowMenuOpen={rightDockOverflowMenuOpen}
          onOverflowMenuOpenChange={setRightDockOverflowMenuOpen}
          titleForTab={(tab) => {
            if (tab.panel === "browser") return browserPreviewPageTitles()[tab.id]
            return undefined
          }}
        >
          <TabPanel
            value="explorer"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchExplorer"
            data-workbench-view="explorer"
            data-open="false"
            data-active="false"
          >
            <div id="solidFileExplorerMount" class="center-workbench-activity sidebar-explorer-panel">
              <FileExplorerPanel active={() => isCenterWorkbenchPanelOpen("explorer")} directory={activeDirectory} />
            </div>
          </TabPanel>
          <TabPanel
            value="diff"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchDiff"
            data-workbench-view="diff"
            data-open="false"
            data-active="false"
          >
            <div id="solidFileChangesMount" class="center-workbench-activity sidebar-file-changes-panel">
              <FileChangesPanel
                scopeKey={activeTaskID()}
                diffOpen={workspaceOpen()}
                diffTarget={workspaceTarget()}
                active={() => isCenterWorkbenchPanelOpen("file") || isCenterWorkbenchPanelOpen("diff")}
                activeView={fileChangesActiveView()}
                onCloseDiff={closeWorkspace}
              />
            </div>
          </TabPanel>
          <TabPanel
            value="browser"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchBrowser"
            data-workbench-view="browser"
            data-open="false"
            data-active="false"
          >
            <div id="solidBrowserPreviewMount" class="center-workbench-activity chat-browser-preview-activity">
              <BrowserPreviewPanel
                tabID="browser"
                active={() =>
                  rightDockOpen() && !rightDockOverflowMenuOpen() && selectedCenterWorkbenchTab()?.id === "browser"
                }
                directory={activeDirectory}
                refreshKey={browserPreviewRevision}
                scrollElement={() => document.querySelector<HTMLElement>(".right-dock-body")}
                taskID={() => activeBrowserPreviewTaskID() || undefined}
                registerController={registerPrimaryBrowserPreviewController}
                onPageTitleChange={(title) =>
                  setBrowserPreviewPageTitles((current) => ({ ...current, browser: title }))
                }
                onReady={() => openRightDockPanel("browser")}
                onCommentDraft={(text) => {
                  const key = panelComposerDraftKey()
                  const existing = composerDraftText(key)
                  setComposerDraft(key, existing ? `${existing}\n\n${text}` : text)
                }}
              />
            </div>
          </TabPanel>
          <For each={centerWorkbenchPanels().filter((tab) => tab.panel === "browser" && !tab.taskPreview)}>
            {(tab) => (
              <TabPanel
                value={tab.id}
                forceMount
                class="center-workbench-view"
                id={`centerWorkbenchBrowser-${tab.id}`}
                data-workbench-view="browser"
                data-open="true"
                data-active={String(selectedCenterWorkbenchTab()?.id === tab.id)}
              >
                <div class="center-workbench-activity chat-browser-preview-activity">
                  <BrowserPreviewPanel
                    tabID={tab.id}
                    active={() =>
                      rightDockOpen() && !rightDockOverflowMenuOpen() && selectedCenterWorkbenchTab()?.id === tab.id
                    }
                    directory={activeDirectory}
                    refreshKey={browserPreviewRevision}
                    scrollElement={() => document.querySelector<HTMLElement>(".right-dock-body")}
                    taskID={() => undefined}
                    onPageTitleChange={(title) =>
                      setBrowserPreviewPageTitles((current) => ({ ...current, [tab.id]: title }))
                    }
                    onCommentDraft={(text) => {
                      const key = panelComposerDraftKey()
                      const existing = composerDraftText(key)
                      setComposerDraft(key, existing ? `${existing}\n\n${text}` : text)
                    }}
                  />
                </div>
              </TabPanel>
            )}
          </For>
          <TabPanel
            value="screenshots"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchScreenshots"
            data-workbench-view="screenshots"
            data-open="false"
            data-active="false"
          >
            <div id="solidScreenshotBrowserMount" class="center-workbench-activity screenshot-browser-activity">
              <ScreenshotBrowserPanel active={() => isCenterWorkbenchPanelOpen("screenshots")} />
            </div>
          </TabPanel>
          <TabPanel
            value="subagent"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchSubagent"
            data-workbench-view="subagent"
            data-open="false"
            data-active="false"
          >
            <div id="solidSubagentConversationMount" class="center-workbench-activity subagent-conversation-activity">
              <SubagentConversationPanel
                active={() =>
                  rightDockOpen() &&
                  !rightDockAddMenuOpen() &&
                  !rightDockOverflowMenuOpen() &&
                  selectedCenterWorkbenchTab()?.panel === "subagent"
                }
                sessionID={selectedSubagentSessionID}
                onSessionSelect={setSelectedSubagentSessionID}
              />
            </div>
          </TabPanel>
          <TabPanel
            value="requirements"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchRequirements"
            data-workbench-view="requirements"
            data-open="false"
            data-active="false"
          >
            <div id="solidRequirementsPanelMount" class="center-workbench-activity task-scope-activity">
              <RequirementsBoardPanel />
            </div>
          </TabPanel>
          <TabPanel
            value="goals"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchGoals"
            data-workbench-view="goals"
            data-open="false"
            data-active="false"
          >
            <div id="solidGoalsPanelMount" class="center-workbench-activity task-scope-activity">
              <GoalsBoardPanel />
            </div>
          </TabPanel>
          <TabPanel
            value="file"
            forceMount
            class="center-workbench-view"
            id="centerWorkbenchFile"
            data-workbench-view="file"
            data-open="false"
            data-active="false"
          >
            <div
              id="solidFileEditorMount"
              class="center-workbench-activity chat-file-editor-activity file-editor-mount"
            >
              <FileEditorPane />
            </div>
          </TabPanel>
        </RightDock>
      }
      onOpenRightDockPanel={openRightDockPanel}
      onOpenSubagentConversation={openSubagentConversation}
      onOpenRightDockAddMenu={openRightDockAddMenu}
      logViewer={<LogViewer open={logOpen()} onClose={() => setLogOpen(false)} />}
    />
  )
}

const overlayAppHost = document.getElementById("overlayAppHost")
if (!overlayAppHost) throw new Error("Overlay application host is missing from index.html")
const startupReady = (window as Window & { __opencorvusStartupReady?: Promise<void> }).__opencorvusStartupReady
if (!startupReady) throw new Error("Overlay startup readiness contract is missing from index.html")
await startupReady
// The static loading surface is present before this module is evaluated so the
// native window never exposes an empty WebView. Solid appends to its host, so
// remove that one pre-mount child before the application takes ownership.
overlayAppHost.replaceChildren()
disposers.push(render(() => <OverlayRoot />, overlayAppHost))
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
await showOverlayWindow()
disposers.push(await installExpertSquadInstallHandoffBridge())

// ── Right dock width resize ──
// The right dock is resized by dragging `#rightDockResizer`. Width persists to
// `settingsStore.rightDockWidth` and renders through `renderRightDockWidth`.

let rightDockResizeActive = false
let pendingRightDockResizeClientX: number | null = null

function clampRightDockWidth(raw: number): number {
  const workspace = document.getElementById("workspaceMain")
  const min = layoutTokenPx("--ui-workbench-panel-min-width")
  const configuredMax = layoutTokenPx("--ui-right-dock-max-width")
  const conversationMin = layoutTokenPx("--ui-chat-min-width")
  const resizerWidth = layoutTokenPx("--oc-border-width")
  const max = workspace
    ? Math.min(configuredMax, workspace.clientWidth - conversationMin - resizerWidth)
    : configuredMax
  return Math.max(min, Math.min(Math.max(max, min), raw))
}

function applyPendingRightDockResize(): void {
  const clientX = pendingRightDockResizeClientX
  pendingRightDockResizeClientX = null
  if (!rightDockResizeActive || clientX == null) return
  const dock = document.getElementById("rightDock")
  if (!dock) return
  const width = clampRightDockWidth(dock.getBoundingClientRect().right - clientX)
  setSettingsStore("rightDockWidth", width)
  renderRightDockWidth()
}

const applyRightDockResizeOnFrame = createAnimationFrameScheduler(applyPendingRightDockResize)
disposers.push(() => {
  applyRightDockResizeOnFrame.cancel()
  pendingRightDockResizeClientX = null
})

function startRightDockResize(event: PointerEvent): void {
  rightDockResizeActive = true
  document.body.dataset.rightDockResizing = "true"
  event.preventDefault()
}

function updateRightDockResize(event: PointerEvent): void {
  if (!rightDockResizeActive) return
  pendingRightDockResizeClientX = event.clientX
  applyRightDockResizeOnFrame.schedule()
}

function stopRightDockResize(): void {
  if (!rightDockResizeActive) return
  applyRightDockResizeOnFrame.cancel()
  applyPendingRightDockResize()
  rightDockResizeActive = false
  delete document.body.dataset.rightDockResizing
  persistMainSettings("settings.persist-right-dock-resize")
}

function resizeRightDockByKeyboard(event: KeyboardEvent): void {
  const dock = document.getElementById("rightDock")
  if (!dock) return
  const step = 24 * currentUIScale()
  let width = dock.getBoundingClientRect().width
  if (event.key === "ArrowLeft") {
    width += step
  } else if (event.key === "ArrowRight") {
    width -= step
  } else if (event.key === "Home") {
    width = layoutTokenPx("--ui-right-dock-max-width")
  } else if (event.key === "End") {
    width = layoutTokenPx("--ui-workbench-panel-min-width")
  } else {
    return
  }
  event.preventDefault()
  setSettingsStore("rightDockWidth", clampRightDockWidth(width))
  renderRightDockWidth()
  persistMainSettings("settings.persist-right-dock-keyboard")
}

{
  const resizer = document.getElementById("rightDockResizer")
  if (resizer) {
    resizer.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button != null && event.button !== 0) return
        startRightDockResize(event)
      },
      listenerOpts,
    )
    resizer.addEventListener("keydown", resizeRightDockByKeyboard, listenerOpts)
  }
}
window.addEventListener(
  "pointermove",
  (event) => {
    updateRightDockResize(event)
  },
  listenerOpts,
)
window.addEventListener("pointerup", stopRightDockResize, listenerOpts)
window.addEventListener("pointercancel", stopRightDockResize, listenerOpts)

// ── Global event listeners (

window.addEventListener("keydown", handleZoomHotkey, listenerOpts)
window.addEventListener(
  "keydown",
  (e: KeyboardEvent) => {
    if (e.key === "F12") {
      e.preventDefault()
      runMainAsync("devtools.toggle", () => toggleDevtools())
    }
  },
  listenerOpts,
)
function applyWindowResize(): void {
  applyZoom(settingsStore.zoom)
  syncScrollbarGutters()
  schedulePaneLayout(paneCallbacks.getState())
  renderRightDockWidth()
}

const applyWindowResizeOnFrame = createAnimationFrameScheduler(applyWindowResize)
disposers.push(() => applyWindowResizeOnFrame.cancel())
window.addEventListener("resize", applyWindowResizeOnFrame.schedule, listenerOpts)
if (window.visualViewport)
  window.visualViewport.addEventListener("resize", applyWindowResizeOnFrame.schedule, listenerOpts)
window.addEventListener(
  "blur",
  () => {
    runMainAsync("pane.cancel-resize", () => cancelPaneResize(paneCallbacks))
    stopRightDockResize()
  },
  listenerOpts,
)
window.addEventListener("beforeunload", () => {
  runModuleTeardown()
  teardownApp()
  stopTimers()
})
installSystemThemeListener(() => applyTheme(settingsStore.theme))

// ── Init ──

;(window as any).__overlayInitSettled = false
runMainAsync("initApp", async () => {
  try {
    await initApp({
      onSettingsLoaded: () => {
        setSettingsHydrated(true)
      },
      onConnected: async () => {
        await focusInitialRestoredTaskWorkspace()
        void checkDesktopUpdate({ background: true })
      },
    })
  } catch (error) {
    reportOverlayRuntimeError("initApp", error)
  } finally {
    try {
      await waitForLogDrain()
    } catch (error) {
      console.error("[initApp] failed to drain overlay logs", error)
    }
    ;(window as any).__overlayInitSettled = true
  }
})
