// TaskDirBar owns the project runtime controls hosted by the chat header.
// Solid components for project runtime controls hosted by the chat header.

import { HoverCard } from "./ui/HoverCard"
import { createEffect, createMemo, createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js"
import { activeSessionID, activeTaskID, boardStore, loadBoard } from "../store/board"
import { appStore } from "../store/app"
import { activeDirectory, browseDirectory, openDirectory } from "../services/workspace"
import {
  commitVcsChanges,
  loadVcsBranches,
  pushVcsBranch,
  streamVcsCommitMessage,
  switchVcsBranch,
  type VcsBranch,
} from "../services/meta"
import { t } from "../utils/i18n"
import { AppLog } from "../utils/log"
import { canInitGit, initGitCurrent } from "../utils/git"
import {
  deleteProjectWorktree,
  deleteProjectWorktrees,
  loadProjectWorktrees,
  type ProjectWorktreeInfo,
} from "../services/worktree"
import { showAppDialog } from "../services/app-dialog"
import {
  changeGroupsRevisionKey,
  currentChangeGroups,
  resolveCurrentChangeGroups,
  summarizeChangeGroups,
} from "../services/diff"
import { browserPreviewRevision, loadTaskBrowserPreviewTarget } from "../services/browser-preview"
import { fileWorkbenchRevision, loadFileDirectory, selectedFileTarget } from "../services/file-workbench"
import { focusGoalSummary } from "../services/goal-summary-focus"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { cardTreeStore } from "../store/card-tree"
import { Icon } from "./ui/Icon"
import { FilePart } from "./FilePart"
import { Button } from "./ui/Button"
import { RIGHT_DOCK_ENVIRONMENT_TOOL_CATALOG, rightDockPanelMeta, type RightDockPanel } from "./RightDock"
import { TaskProgressBar } from "./TaskProgressBar"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Section } from "./ui/Section"
import { Dialog } from "./ui/Dialog"
import { TextField } from "./ui/TextField"
import { currentProjectConfigRequestOptions, patchConfig } from "../services/config"
import { conversationAgentRecordsForSource } from "../store/conversation-agents"
import { isSubagentActivityRecord } from "../utils/subagent-presentation"
import { isAgentActivityTerminalStatus } from "../utils/agent-activity"
import { closeNativeMenuSurface, openNativeMenuSurface } from "../services/native-menu-surface"
import { settingsStore } from "../store/settings"
import { rightDockOpen } from "../store/right-dock"
import { layoutTokenPx } from "../utils/layout-tokens"

const directoryMemo = () => activeDirectory()
const WORKTREE_PROJECTION_RETRY_MS = 3_000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// VCS (Version Control System) metadata projected by GET /vcs into boardStore.
interface ProjectVcsInfo {
  initialized?: boolean
  branch?: string
  commit?: string
  clean?: boolean
  dirty?: boolean
  staged?: number
  modified?: number
  untracked?: number
  conflicts?: number
  ahead?: number
  behind?: number
  hasRemote: boolean
}

type ProjectVcsTone = "neutral" | "good" | "warn" | "bad"

interface ProjectRuntimeToolShortcut {
  id: RightDockPanel
  label: string
  summary: string
  resource: boolean
}

type ProjectRuntimeBrowserInformation =
  | { status: "loaded"; taskID: string; directory: string; url: string }
  | { status: "failed"; taskID: string; directory: string; error: string }

type ProjectRuntimeFileInformation =
  | { status: "loaded"; directory: string; count: number }
  | { status: "failed"; directory: string; error: string }

interface ProjectRuntimeStatusPanelProps {
  anchorVisible: boolean
  onOpenRightDockPanel: (panel: RightDockPanel) => void
  onOpenSubagentConversation: (sessionID: string) => void
  onOpenRightDockAddMenu: () => void
  trailingAction: JSX.Element
}

interface LocalEnvironmentVariableDraft {
  id: number
  key: string
  value: string
}

interface LocalEnvironmentConfig {
  name?: string
  variables?: Record<string, string>
  setup_script?: string
}

function projectVcsInfo(): ProjectVcsInfo | null {
  return boardStore.vcs as ProjectVcsInfo | null
}

function vcsToneFor(value: ProjectVcsInfo | null): ProjectVcsTone {
  if (!value) return "neutral"
  if (!value.initialized) return "neutral"
  if ((value.conflicts ?? 0) > 0) return "bad"
  if (value.dirty) return "warn"
  return "good"
}

function vcsArrowsFor(value: ProjectVcsInfo | null): string {
  if (!value?.initialized) return ""
  const ahead = value.ahead ?? 0
  const behind = value.behind ?? 0
  if (ahead === 0 && behind === 0) return ""
  return `${ahead > 0 ? `↑${ahead}` : ""}${behind > 0 ? `↓${behind}` : ""}`
}

export function ProjectRuntimeStatusPanel(props: ProjectRuntimeStatusPanelProps) {
  const dir = createMemo(directoryMemo)
  const environmentAnchorShift = createMemo(() => {
    settingsStore.zoom
    return layoutTokenPx("--ui-runtime-environment-anchor-shift")
  })
  const [panelOpen, setPanelOpen] = createSignal(false)
  const [panelPinned, setPanelPinned] = createSignal(false)
  const [panelExpanded, setPanelExpanded] = createSignal(true)
  const [localMenuOpen, setLocalMenuOpen] = createSignal(false)
  const localMenuOwner = "project-runtime-local"
  let localMenuAnchor!: HTMLButtonElement
  const [branchMenuOpen, setBranchMenuOpen] = createSignal(false)
  const [branches, setBranches] = createSignal<VcsBranch[]>([])
  const [branchLoadDirectory, setBranchLoadDirectory] = createSignal("")
  const [branchSwitchBusy, setBranchSwitchBusy] = createSignal("")
  const [branchError, setBranchError] = createSignal("")
  const branchMenuOwner = "project-runtime-branch"
  let branchMenuAnchor!: HTMLButtonElement
  const [gitBusy, setGitBusy] = createSignal(false)
  const [gitActionOpen, setGitActionOpen] = createSignal(false)
  const [commitMessage, setCommitMessage] = createSignal("")
  const [commitMessageGenerating, setCommitMessageGenerating] = createSignal(false)
  const [gitActionError, setGitActionError] = createSignal("")
  const [gitActionNotice, setGitActionNotice] = createSignal("")
  const [localEnvironmentOpen, setLocalEnvironmentOpen] = createSignal(false)
  const runtimePanelOpen = createMemo(
    () => props.anchorVisible && panelOpen() && !gitActionOpen() && !localEnvironmentOpen(),
  )
  const [localEnvironmentName, setLocalEnvironmentName] = createSignal("")
  const [localEnvironmentVariables, setLocalEnvironmentVariables] = createSignal<LocalEnvironmentVariableDraft[]>([])
  const [localEnvironmentSetupScript, setLocalEnvironmentSetupScript] = createSignal("")
  const [localEnvironmentBusy, setLocalEnvironmentBusy] = createSignal(false)
  const [localEnvironmentError, setLocalEnvironmentError] = createSignal("")
  let localEnvironmentVariableID = 0
  let gitOperationID = 0
  let commitMessageStream: ReturnType<typeof streamVcsCommitMessage> | undefined
  let commitMessageGenerationKey = ""
  let selectedConversationSourceIdentity = ""
  let presentedConversationSourceIdentity = ""
  const [worktrees, setWorktrees] = createSignal<ProjectWorktreeInfo[]>([])
  const [worktreeDirectory, setWorktreeDirectory] = createSignal("")
  const [error, setError] = createSignal("")
  const [operationError, setOperationError] = createSignal("")
  const [deletingWorktrees, setDeletingWorktrees] = createSignal(new Set<string>())
  const [bulkDeleteOperationDirectory, setBulkDeleteOperationDirectory] = createSignal("")
  const [refreshingWorktreeDirectory, setRefreshingWorktreeDirectory] = createSignal("")
  let worktreeProjectionRetryTimer: ReturnType<typeof setTimeout> | undefined
  let worktreeProjectionGeneration = 0
  const visibleWorktrees = createMemo(() => worktrees().filter((item) => item.status !== "primary"))
  const removableWorktrees = createMemo(() => visibleWorktrees().filter((item) => item.removable))
  const bulkDeleteBusy = createMemo(() => bulkDeleteBusyFor(worktreeDirectory()))
  const refreshBusy = createMemo(() => {
    const refreshingDirectory = refreshingWorktreeDirectory()
    return refreshingDirectory.length > 0 && refreshingDirectory === dir().trim()
  })
  const canDeleteAll = createMemo(() => removableWorktrees().length > 0 && !bulkDeleteBusy())
  const vcs = createMemo(projectVcsInfo)
  const gitTone = createMemo(() => vcsToneFor(vcs()))
  const gitArrows = createMemo(() => vcsArrowsFor(vcs()))
  const gitStatusLabel = createMemo(() => {
    const value = vcs()
    if (!value) return t("project_runtime.git_unavailable")
    if (!value.initialized) return t("project_runtime.git_uninitialized")
    return value.dirty ? t("vcs.dirty") : t("vcs.clean")
  })
  const triggerTitle = createMemo(() => t("project_runtime.environment_title"))
  const changeGroups = createMemo(currentChangeGroups)
  const changeGroupsRequestKey = createMemo(() => {
    const taskID = activeTaskID()
    const groups = changeGroups()
    return taskID && groups.length > 0 ? `${taskID}:${changeGroupsRevisionKey(groups)}` : false
  })
  const [resolvedChangeGroups] = createResource(changeGroupsRequestKey, async (key) => ({
    key,
    groups: await resolveCurrentChangeGroups(),
  }))
  const visibleChangeGroups = createMemo(() => {
    const resolved = resolvedChangeGroups()
    return resolved?.key === changeGroupsRequestKey() ? resolved.groups : changeGroups()
  })
  const changeTotals = createMemo(() => summarizeChangeGroups(visibleChangeGroups()))
  const requestSources = createMemo(() => {
    const attachments = (boardStore.board as any)?.task?.attachments
    return Array.isArray(attachments) ? attachments : []
  })
  const subagentRecords = createMemo(() =>
    conversationAgentRecordsForSource(boardStore.selectedSource).filter(isSubagentActivityRecord),
  )
  const workingSubagentCount = createMemo(
    () => subagentRecords().filter((record) => !isAgentActivityTerminalStatus(record.status)).length,
  )
  const doneSubagentCount = createMemo(
    () => subagentRecords().filter((record) => isAgentActivityTerminalStatus(record.status)).length,
  )
  const subagentConversationTarget = createMemo(
    () => subagentRecords().find((record) => !isAgentActivityTerminalStatus(record.status)) ?? subagentRecords().at(-1),
  )
  const hasGoalInformation = createMemo(() => {
    const goals = (boardStore.board as any)?.goals
    return Array.isArray(goals) && goals.length > 0
  })
  const taskScopeShortcuts = createMemo(() => {
    const board = boardStore.board as any
    const requirements = Array.isArray(board?.requirements) ? board.requirements : []
    const goals = Array.isArray(board?.goals) ? board.goals : []
    const passedRequirements = requirements.filter((item: any) => item?.acceptance?.accepted === true).length
    const passedGoals = goals.filter((item: any) => item?.acceptance?.accepted === true).length

    const shortcuts: ProjectRuntimeToolShortcut[] = []
    if (requirements.length > 0) {
      shortcuts.push({
        id: "requirements",
        label: t("right_dock.tool.requirements"),
        summary: `${passedRequirements}/${requirements.length}`,
        resource: false,
      })
    }
    if (goals.length > 0) {
      shortcuts.push({
        id: "goals",
        label: t("task_scope.goals"),
        summary: `${passedGoals}/${goals.length}`,
        resource: false,
      })
    }
    return shortcuts
  })
  const browserInformationScope = createMemo(() => {
    const taskID = activeTaskID().trim()
    const directory = dir().trim()
    if (!appStore.connected || !runtimePanelOpen() || !taskID || !directory) return undefined
    return { taskID, directory, refreshKey: browserPreviewRevision() }
  })
  const [browserInformation] = createResource(
    browserInformationScope,
    async (scope): Promise<ProjectRuntimeBrowserInformation> => {
      try {
        const target = await loadTaskBrowserPreviewTarget({ taskID: scope.taskID, directory: scope.directory })
        return {
          status: "loaded",
          taskID: scope.taskID,
          directory: scope.directory,
          url: target.url?.trim() ?? "",
        }
      } catch (error) {
        const message = errorMessage(error)
        AppLog.warn("ui", "Failed to load project Browser information", {
          taskID: scope.taskID,
          directory: scope.directory,
          error: message,
        })
        return { status: "failed", taskID: scope.taskID, directory: scope.directory, error: message }
      }
    },
  )
  const browserHasInformation = createMemo(() => {
    const scope = browserInformationScope()
    const information = browserInformation()
    return Boolean(
      scope &&
        !browserInformation.loading &&
        information?.status === "loaded" &&
        information?.taskID === scope.taskID &&
        information.directory === scope.directory &&
        information.url,
    )
  })
  const fileInformationScope = createMemo(() => {
    const directory = dir().trim()
    if (!appStore.connected || !runtimePanelOpen() || !directory) return undefined
    return { directory, refreshKey: fileWorkbenchRevision() }
  })
  const [fileInformation] = createResource(
    fileInformationScope,
    async (scope): Promise<ProjectRuntimeFileInformation> => {
      try {
        const items = await loadFileDirectory("", { directory: scope.directory })
        return { status: "loaded", directory: scope.directory, count: items.length }
      } catch (error) {
        const message = errorMessage(error)
        AppLog.warn("ui", "Failed to load project Files information", {
          directory: scope.directory,
          error: message,
        })
        return { status: "failed", directory: scope.directory, error: message }
      }
    },
  )
  const filesHaveInformation = createMemo(() => {
    const scope = fileInformationScope()
    const information = fileInformation()
    return Boolean(
      scope &&
        !fileInformation.loading &&
        information?.status === "loaded" &&
        information.directory === scope.directory &&
        information.count > 0,
    )
  })
  const resourceToolInformation = createMemo(
    () =>
      new Set<RightDockPanel>([
        ...taskScopeShortcuts().map((shortcut) => shortcut.id),
        ...(browserHasInformation() ? (["browser"] as const) : []),
        ...(changeGroups().length > 0 ? (["diff"] as const) : []),
        ...(filesHaveInformation() ? (["explorer"] as const) : []),
        ...(cardTreeStore.screenshotItems.length > 0 ? (["screenshots"] as const) : []),
        ...(selectedFileTarget() ? (["file"] as const) : []),
      ]),
  )
  const runtimeToolShortcuts = createMemo<ProjectRuntimeToolShortcut[]>(() => {
    const taskScopeByID = new Map(taskScopeShortcuts().map((shortcut) => [shortcut.id, shortcut]))
    return RIGHT_DOCK_ENVIRONMENT_TOOL_CATALOG.filter(
      (meta) => meta.id !== "goals" && resourceToolInformation().has(meta.id),
    ).map((meta) => {
      const taskScope = taskScopeByID.get(meta.id)
      return taskScope ?? { id: meta.id, label: t(meta.labelKey), summary: "", resource: true }
    })
  })
  const taskInformationShortcuts = createMemo(() => runtimeToolShortcuts().filter((shortcut) => !shortcut.resource))
  const resourceToolShortcuts = createMemo(() => runtimeToolShortcuts().filter((shortcut) => shortcut.resource))
  const hasRuntimeResourceSections = createMemo(
    () =>
      hasGoalInformation() ||
      taskInformationShortcuts().length > 0 ||
      visibleWorktrees().length > 0 ||
      resourceToolShortcuts().length > 0,
  )

  function closeRuntimePanel(): void {
    setPanelPinned(false)
    setPanelOpen(false)
  }

  function openRuntimePanel(): void {
    if (props.anchorVisible) setPanelOpen(true)
  }

  function setRuntimePanelOpen(nextOpen: boolean): void {
    if (nextOpen) {
      openRuntimePanel()
      return
    }
    if (!panelPinned()) setPanelOpen(false)
  }

  function toggleRuntimePanel(): void {
    if (panelPinned()) {
      closeRuntimePanel()
      return
    }
    setPanelPinned(true)
    openRuntimePanel()
  }

  function openChanges(): void {
    window.dispatchEvent(new CustomEvent("acceptance:focus-changes"))
    closeRuntimePanel()
  }

  function configuredLocalEnvironment(): LocalEnvironmentConfig | undefined {
    const value = (appStore.config as any)?.local_environment
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined
  }

  function openLocalEnvironmentEditor(): void {
    const environment = configuredLocalEnvironment()
    setLocalEnvironmentName(environment?.name?.trim() || t("project_runtime.local_environment_default_name"))
    setLocalEnvironmentSetupScript(environment?.setup_script ?? "")
    setLocalEnvironmentVariables(
      Object.entries(environment?.variables ?? {}).map(([key, value]) => ({
        id: ++localEnvironmentVariableID,
        key,
        value,
      })),
    )
    setLocalEnvironmentError("")
    closeRuntimePanel()
    setLocalEnvironmentOpen(true)
  }

  function closeLocalEnvironmentEditor(): void {
    if (localEnvironmentBusy()) return
    setLocalEnvironmentOpen(false)
    setLocalEnvironmentError("")
    closeRuntimePanel()
  }

  function addLocalEnvironmentVariable(): void {
    setLocalEnvironmentVariables((items) => [...items, { id: ++localEnvironmentVariableID, key: "", value: "" }])
  }

  function updateLocalEnvironmentVariable(id: number, field: "key" | "value", value: string): void {
    setLocalEnvironmentVariables((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
    setLocalEnvironmentError("")
  }

  function removeLocalEnvironmentVariable(id: number): void {
    setLocalEnvironmentVariables((items) => items.filter((item) => item.id !== id))
    setLocalEnvironmentError("")
  }

  async function saveLocalEnvironment(): Promise<void> {
    if (localEnvironmentBusy()) return
    const name = localEnvironmentName().trim()
    if (!name) {
      setLocalEnvironmentError(t("project_runtime.local_environment_name_required"))
      return
    }
    const variables: Record<string, string> = {}
    for (const item of localEnvironmentVariables()) {
      const key = item.key.trim()
      if (!key) {
        setLocalEnvironmentError(t("project_runtime.local_environment_key_required"))
        return
      }
      if (Object.hasOwn(variables, key)) {
        setLocalEnvironmentError(t("project_runtime.local_environment_duplicate_key", { key }))
        return
      }
      variables[key] = item.value
    }

    setLocalEnvironmentBusy(true)
    setLocalEnvironmentError("")
    try {
      await patchConfig(
        {
          local_environment: {
            name,
            variables,
            setup_script: localEnvironmentSetupScript().trim() || null,
          },
        },
        currentProjectConfigRequestOptions(),
      )
      setLocalEnvironmentOpen(false)
    } catch (error) {
      setLocalEnvironmentError(t("project_runtime.local_environment_save_failed", { error: errorMessage(error) }))
    } finally {
      setLocalEnvironmentBusy(false)
    }
  }

  function disposeCommitMessageStream(): void {
    commitMessageStream?.close("consumer-dispose")
    commitMessageStream = undefined
    setCommitMessageGenerating(false)
  }

  function commitMessageKey(): string {
    const value = vcs()
    return [
      dir().trim(),
      activeTaskID().trim(),
      activeSessionID().trim(),
      value?.commit ?? "",
      value?.staged ?? 0,
      value?.modified ?? 0,
      value?.untracked ?? 0,
    ].join(":")
  }

  function generateCommitMessage(force = false): void {
    if (!vcs()?.dirty) return
    const key = commitMessageKey()
    if (!force && commitMessageGenerationKey === key && commitMessage().trim()) return
    disposeCommitMessageStream()
    commitMessageGenerationKey = key
    setCommitMessage("")
    setCommitMessageGenerating(true)
    setGitActionError("")
    setGitActionNotice("")
    commitMessageStream = streamVcsCommitMessage({
      taskID: activeTaskID().trim() || undefined,
      sessionID: activeSessionID().trim() || undefined,
      onDelta: (delta) => setCommitMessage((current) => current + delta),
      onDone: (message) => {
        commitMessageStream = undefined
        setCommitMessage(message)
        setCommitMessageGenerating(false)
      },
      onError: (error) => {
        commitMessageStream = undefined
        setCommitMessageGenerating(false)
        setGitActionError(t("project_runtime.commit_message_failed", { error: error.message }))
      },
    })
  }

  function toggleGitAction(): void {
    const nextOpen = !gitActionOpen()
    setGitActionOpen(nextOpen)
    setGitActionError("")
    setGitActionNotice("")
    if (nextOpen) {
      closeRuntimePanel()
      if (vcs()?.dirty) generateCommitMessage()
    }
    if (!nextOpen) disposeCommitMessageStream()
  }

  function closeGitAction(): void {
    setGitActionOpen(false)
    disposeCommitMessageStream()
    closeRuntimePanel()
  }

  async function commitChanges(pushAfterCommit: boolean): Promise<void> {
    const message = commitMessage().trim()
    const directory = dir().trim()
    if (!message || !directory || commitMessageGenerating() || gitBusy()) return
    const operationID = ++gitOperationID
    const ownsPresentation = () => gitOperationID === operationID && dir().trim() === directory
    setGitBusy(true)
    setGitActionError("")
    setGitActionNotice("")
    try {
      const result = await commitVcsChanges(message, directory)
      if (ownsPresentation()) {
        setGitActionNotice(t("project_runtime.commit_success", { commit: result.commit }))
        setCommitMessage("")
        commitMessageGenerationKey = ""
      }
      if (pushAfterCommit) {
        await pushVcsBranch(directory)
        if (ownsPresentation()) {
          setGitActionNotice(t("project_runtime.commit_push_success", { commit: result.commit }))
        }
      }
    } catch (error) {
      if (ownsPresentation()) {
        setGitActionError(t("project_runtime.git_action_failed", { error: errorMessage(error) }))
      }
    } finally {
      setGitBusy(false)
    }
  }

  async function pushChanges(): Promise<void> {
    const directory = dir().trim()
    if (!directory || gitBusy()) return
    const operationID = ++gitOperationID
    const ownsPresentation = () => gitOperationID === operationID && dir().trim() === directory
    setGitBusy(true)
    setGitActionError("")
    setGitActionNotice("")
    try {
      await pushVcsBranch(directory)
      if (ownsPresentation()) setGitActionNotice(t("project_runtime.push_success"))
    } catch (error) {
      if (ownsPresentation()) {
        setGitActionError(t("project_runtime.git_action_failed", { error: errorMessage(error) }))
      }
    } finally {
      setGitBusy(false)
    }
  }

  function openRuntimeShortcut(shortcut: ProjectRuntimeToolShortcut): void {
    props.onOpenRightDockPanel(shortcut.id)
    closeRuntimePanel()
  }

  function openGoalSummary(deliverySliceID: string): void {
    props.onOpenRightDockPanel("goals")
    closeRuntimePanel()
    void focusGoalSummary(deliverySliceID).catch((error) => {
      reportError({
        id: `delivery-slice-summary:focus:${deliverySliceID}`,
        title: t("common.error"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    })
  }

  function openSubagentSummary(): void {
    const target = subagentConversationTarget()
    if (!target) return
    props.onOpenSubagentConversation(target.sessionID)
    closeRuntimePanel()
  }

  function openRightDockAddMenu(event: MouseEvent): void {
    event.stopPropagation()
    closeRuntimePanel()
    props.onOpenRightDockAddMenu()
  }

  createEffect(() => {
    if (!localMenuOpen()) void closeNativeMenuSurface(localMenuOwner)
  })

  createEffect(() => {
    if (!branchMenuOpen()) void closeNativeMenuSurface(branchMenuOwner)
  })

  onCleanup(() => {
    disposeCommitMessageStream()
    void closeNativeMenuSurface(localMenuOwner)
    void closeNativeMenuSurface(branchMenuOwner)
  })

  async function syncBranches(): Promise<void> {
    const projectDirectory = dir().trim()
    if (!appStore.connected || !projectDirectory || branchLoadDirectory() === projectDirectory) return
    setBranchLoadDirectory(projectDirectory)
    setBranchError("")
    try {
      const items = await loadVcsBranches()
      if (dir().trim() !== projectDirectory) return
      setBranches(items)
    } catch (err) {
      if (dir().trim() !== projectDirectory) return
      const message = errorMessage(err)
      setBranches([])
      setBranchError(message)
      AppLog.warn("ui", "Failed to load project branches", { directory: projectDirectory, error: message })
    } finally {
      if (branchLoadDirectory() === projectDirectory) setBranchLoadDirectory("")
    }
  }

  async function openLocalMenu(anchor: HTMLElement): Promise<void> {
    if (localMenuOpen()) {
      await closeNativeMenuSurface(localMenuOwner)
      return
    }

    setBranchMenuOpen(false)
    setLocalMenuOpen(true)
    try {
      await openNativeMenuSurface({
        owner: localMenuOwner,
        anchor,
        placement: "right-start",
        variant: "compact-list",
        maxHeight: document.documentElement.clientHeight * 0.5,
        groups: [
          {
            items: [
              {
                id: "local-context",
                label: t("cwd.title"),
                description: dir(),
                ariaLabel: `${t("cwd.title")}: ${dir()}`,
                icon: "terminal-powershell",
                enabled: false,
              },
            ],
          },
          {
            items: [
              { id: "local-open", label: t("cwd.open"), icon: "folder-open" },
              { id: "local-browse", label: t("cwd.browse"), icon: "folder" },
            ],
          },
        ],
        onDismiss: () => setLocalMenuOpen(false),
        onError: (error) => reportError({
          id: "project-runtime-local-menu:close",
          title: t("common.error"),
          message: errorMessage(error),
          details: formatErrorDetails(error),
        }),
        onAction: (itemID) => {
          if (itemID === "local-open") {
            void openDirectory(dir())
            return
          }
          if (itemID === "local-browse") void browseDirectory()
        },
      })
    } catch (error) {
      setLocalMenuOpen(false)
      reportError({
        id: "project-runtime-local-menu:open",
        title: t("common.error"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    }
  }

  async function openBranchMenu(anchor: HTMLElement): Promise<void> {
    if (branchMenuOpen()) {
      await closeNativeMenuSurface(branchMenuOwner)
      return
    }

    setLocalMenuOpen(false)
    setBranchMenuOpen(true)
    await syncBranches()
    if (!branchMenuOpen()) return

    const branchActions = new Map<string, VcsBranch>()
    const items = branchError()
      ? [
          {
            id: "branch-error",
            label: branchError(),
            icon: "status-failed" as const,
            enabled: false,
          },
          {
            id: "branch-retry",
            label: t("common.retry"),
            icon: "refresh" as const,
          },
        ]
      : branches().length === 0
        ? [
            {
              id: "branch-empty",
              label: t("project_runtime.git_unavailable"),
              icon: "git-branch" as const,
              enabled: false,
            },
          ]
        : branches().map((branch, index) => {
            const id = `branch-${index}`
            branchActions.set(id, branch)
            return {
              id,
              label: branch.name,
              icon: "git-branch" as const,
              checked: branch.current,
              enabled: !branchSwitchBusy(),
            }
          })

    try {
      await openNativeMenuSurface({
        owner: branchMenuOwner,
        anchor,
        placement: "right-start",
        variant: "compact-list",
        maxHeight: document.documentElement.clientHeight * 0.5,
        groups: [{ items }],
        onDismiss: () => setBranchMenuOpen(false),
        onError: (error) => {
          setBranchError(errorMessage(error))
          reportError({
            id: "project-runtime-branch-menu:close",
            title: t("common.error"),
            message: errorMessage(error),
            details: formatErrorDetails(error),
          })
        },
        onAction: (itemID) => {
          if (itemID === "branch-retry") {
            setBranchError("")
            void openBranchMenu(anchor)
            return
          }
          const branch = branchActions.get(itemID)
          if (branch) void selectBranch(branch)
        },
      })
    } catch (error) {
      setBranchMenuOpen(false)
      setBranchError(errorMessage(error))
    }
  }

  async function selectBranch(branch: VcsBranch): Promise<void> {
    const projectDirectory = dir().trim()
    if (!projectDirectory || branch.current || branchSwitchBusy()) return
    setBranchSwitchBusy(branch.name)
    setBranchError("")
    try {
      await switchVcsBranch(branch.name)
      if (dir().trim() !== projectDirectory) return
      await syncBranches()
    } catch (err) {
      if (dir().trim() !== projectDirectory) return
      const message = errorMessage(err)
      setBranchError(message)
      openRuntimePanel()
      AppLog.error("ui", "Failed to switch project branch", {
        branch: branch.name,
        directory: projectDirectory,
        error: message,
      })
    } finally {
      setBranchSwitchBusy("")
    }
  }

  function setDeleting(directories: string[], deleting: boolean): void {
    setDeletingWorktrees((current) => {
      const next = new Set(current)
      for (const directory of directories) {
        if (deleting) next.add(directory)
        else next.delete(directory)
      }
      return next
    })
  }

  async function syncWorktrees(options: { requireFresh?: boolean } = {}): Promise<void> {
    const projectDirectory = dir().trim()
    if (!appStore.connected || !projectDirectory) {
      invalidateWorktreeProjection()
      setWorktrees([])
      setWorktreeDirectory("")
      setError("")
      return
    }
    clearWorktreeProjectionRetry()
    const requestGeneration = ++worktreeProjectionGeneration
    try {
      const items = await loadProjectWorktrees(projectDirectory)
      if (!ownsWorktreeProjection(requestGeneration, projectDirectory)) return
      setWorktrees(items)
      setWorktreeDirectory(projectDirectory)
      if (error()) {
        AppLog.info("ui", "Project worktree projection recovered", { directory: projectDirectory })
      }
      setError("")
    } catch (err) {
      if (!ownsWorktreeProjection(requestGeneration, projectDirectory)) return
      const message = err instanceof Error ? err.message : String(err)
      if (worktreeDirectory() !== projectDirectory) {
        setWorktrees([])
        setWorktreeDirectory("")
      }
      if (error() !== message) {
        setError(message)
        AppLog.warn("ui", "Failed to load project worktrees", { directory: projectDirectory, error: message })
      }
      scheduleWorktreeProjectionRetry(requestGeneration, projectDirectory)
      if (options.requireFresh) throw err
    }
  }

  function clearWorktreeProjectionRetry(): void {
    if (worktreeProjectionRetryTimer === undefined) return
    clearTimeout(worktreeProjectionRetryTimer)
    worktreeProjectionRetryTimer = undefined
  }

  function invalidateWorktreeProjection(): void {
    worktreeProjectionGeneration += 1
    clearWorktreeProjectionRetry()
  }

  function ownsWorktreeProjection(generation: number, projectDirectory: string): boolean {
    return (
      generation === worktreeProjectionGeneration &&
      appStore.connected &&
      dir().trim() === projectDirectory
    )
  }

  function scheduleWorktreeProjectionRetry(generation: number, projectDirectory: string): void {
    if (!ownsWorktreeProjection(generation, projectDirectory)) return
    if (worktreeProjectionRetryTimer !== undefined) return
    worktreeProjectionRetryTimer = setTimeout(() => {
      worktreeProjectionRetryTimer = undefined
      if (!ownsWorktreeProjection(generation, projectDirectory)) return
      void syncWorktrees()
    }, WORKTREE_PROJECTION_RETRY_MS)
  }

  function ownsWorktreeOperation(projectDirectory: string): boolean {
    return dir().trim() === projectDirectory && worktreeDirectory() === projectDirectory
  }

  function bulkDeleteBusyFor(projectDirectory: string): boolean {
    const directory = projectDirectory.trim()
    return directory.length > 0 && bulkDeleteOperationDirectory() === directory
  }

  async function refreshWorktrees(event: MouseEvent): Promise<void> {
    event.stopPropagation()
    const projectDirectory = dir().trim()
    if (!projectDirectory || refreshingWorktreeDirectory() === projectDirectory) return
    setRefreshingWorktreeDirectory(projectDirectory)
    setOperationError("")
    try {
      await syncWorktrees({ requireFresh: true })
    } catch (err) {
      if (dir().trim() === projectDirectory)
        setOperationError(t("worktree.refresh_failed", { error: errorMessage(err) }))
    } finally {
      if (refreshingWorktreeDirectory() === projectDirectory) setRefreshingWorktreeDirectory("")
    }
  }

  async function handleInitGit(event: MouseEvent): Promise<void> {
    event.stopPropagation()
    if (!canInitGit() || gitBusy()) return
    setGitBusy(true)
    try {
      await initGitCurrent()
    } catch (err) {
      AppLog.error("ui", "Failed to initialize git repository", { error: errorMessage(err) })
    } finally {
      setGitBusy(false)
    }
  }

  async function removeWorktree(item: ProjectWorktreeInfo, event: MouseEvent): Promise<void> {
    event.stopPropagation()
    const projectDirectory = worktreeDirectory() || dir().trim()
    if (!item.removable || deletingWorktrees().has(item.directory) || bulkDeleteBusyFor(projectDirectory)) return
    if (!projectDirectory) return
    const confirmed = await showAppDialog({
      title: t("worktree.delete"),
      message: t("worktree.delete_confirm", { path: item.directory }),
      cancel: true,
      okLabel: t("common.delete"),
      okTone: "danger",
    })
    if (!confirmed.confirmed) return
    if (dir().trim() !== projectDirectory || worktreeDirectory() !== projectDirectory) return
    setDeleting([item.directory], true)
    setOperationError("")
    try {
      try {
        await deleteProjectWorktree(projectDirectory, item.directory)
        if (!ownsWorktreeOperation(projectDirectory)) return
        setWorktrees((current) => current.filter((candidate) => candidate.directory !== item.directory))
      } catch (err) {
        if (!ownsWorktreeOperation(projectDirectory)) return
        const message = errorMessage(err)
        setOperationError(t("worktree.delete_failed", { error: message }))
        openRuntimePanel()
        AppLog.error("ui", "Failed to delete project worktree", { directory: item.directory, error: message })
        return
      }
      try {
        await syncWorktrees({ requireFresh: true })
        if (!ownsWorktreeOperation(projectDirectory)) return
        await loadBoard({ requireFresh: true })
        if (!ownsWorktreeOperation(projectDirectory)) return
      } catch (err) {
        if (!ownsWorktreeOperation(projectDirectory)) return
        const message = errorMessage(err)
        setOperationError(t("worktree.delete_reload_failed", { error: message }))
        openRuntimePanel()
        AppLog.error("ui", "Failed to reload project worktree state after delete", {
          directory: item.directory,
          error: message,
        })
      }
    } finally {
      setDeleting([item.directory], false)
    }
  }

  async function deleteAllWorktrees(event: MouseEvent): Promise<void> {
    event.stopPropagation()
    const targets = removableWorktrees()
    const projectDirectory = worktreeDirectory() || dir().trim()
    if (!targets.length || !projectDirectory || bulkDeleteBusyFor(projectDirectory)) return
    const confirmed = await showAppDialog({
      title: t("worktree.delete_all"),
      message: t("worktree.delete_all_confirm", { count: targets.length }),
      cancel: true,
      okLabel: t("common.delete"),
      okTone: "danger",
    })
    if (!confirmed.confirmed) return
    if (dir().trim() !== projectDirectory || worktreeDirectory() !== projectDirectory) return
    const directories = targets.map((item) => item.directory)
    setBulkDeleteOperationDirectory(projectDirectory)
    setDeleting(directories, true)
    setOperationError("")
    try {
      try {
        await deleteProjectWorktrees(projectDirectory, directories)
      } catch (err) {
        if (!ownsWorktreeOperation(projectDirectory)) return
        let message = errorMessage(err)
        try {
          await syncWorktrees({ requireFresh: true })
        } catch (syncErr) {
          const syncMessage = errorMessage(syncErr)
          message = `${message}; ${syncMessage}`
          AppLog.error("ui", "Failed to reload project worktrees after cleanup failure", {
            directories,
            error: syncMessage,
          })
        }
        setOperationError(t("worktree.delete_all_failed", { error: message }))
        openRuntimePanel()
        AppLog.error("ui", "Failed to delete all removable project worktrees", { directories, error: message })
        return
      }
      try {
        if (!ownsWorktreeOperation(projectDirectory)) return
        setWorktrees((current) => current.filter((candidate) => !directories.includes(candidate.directory)))
        await syncWorktrees({ requireFresh: true })
        if (!ownsWorktreeOperation(projectDirectory)) return
        await loadBoard({ requireFresh: true })
      } catch (err) {
        if (!ownsWorktreeOperation(projectDirectory)) return
        const message = errorMessage(err)
        setOperationError(t("worktree.delete_all_reload_failed", { error: message }))
        openRuntimePanel()
        AppLog.error("ui", "Failed to reload project worktree state after cleanup", {
          directories,
          error: message,
        })
      }
    } finally {
      setDeleting(directories, false)
      if (bulkDeleteOperationDirectory() === projectDirectory) setBulkDeleteOperationDirectory("")
    }
  }

  createEffect(() => {
    const connected = appStore.connected
    dir()
    invalidateWorktreeProjection()
    setLocalMenuOpen(false)
    setBranchMenuOpen(false)
    setBranches([])
    setBranchLoadDirectory("")
    setBranchError("")
    disposeCommitMessageStream()
    setGitActionOpen(false)
    setCommitMessage("")
    setGitActionError("")
    setGitActionNotice("")
    commitMessageGenerationKey = ""
    if (connected) void syncWorktrees()
    else {
      setWorktrees([])
      setWorktreeDirectory("")
      setError("")
    }
  })

  onCleanup(invalidateWorktreeProjection)

  createEffect(() => {
    if (!props.anchorVisible) closeRuntimePanel()
  })

  createEffect((wasOpen: boolean) => {
    const open = rightDockOpen()
    if (open && !wasOpen) closeRuntimePanel()
    return open
  }, rightDockOpen())

  createEffect(() => {
    const source = boardStore.selectedSource
    const sourceIdentity = source ? `${source.kind}:${source.id}` : ""
    if (sourceIdentity !== selectedConversationSourceIdentity) {
      selectedConversationSourceIdentity = sourceIdentity
      presentedConversationSourceIdentity = ""
    }
    if (
      !props.anchorVisible ||
      !sourceIdentity ||
      cardTreeStore.order.length === 0 ||
      presentedConversationSourceIdentity === sourceIdentity
    ) {
      return
    }
    presentedConversationSourceIdentity = sourceIdentity
    setPanelExpanded(true)
    setPanelPinned(true)
    openRuntimePanel()
  })

  createEffect((wasOpen: boolean) => {
    const nextOpen = runtimePanelOpen()
    if (nextOpen && !wasOpen && appStore.connected) void syncWorktrees()
    return nextOpen
  }, false)

  const PanelShell = () => (
    <div class="project-runtime-panel-shell">
      <div class="project-runtime-panel-head">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          class="project-runtime-panel-disclosure"
          data-chrome="text-disclosure"
          data-ui="project-runtime-panel-disclosure"
          aria-expanded={panelExpanded()}
          aria-controls="projectRuntimeExpandedBody"
          onClick={() => setPanelExpanded((value) => !value)}
        >
          <span class="project-runtime-panel-title-group">
            <span class="project-runtime-panel-title oc-section-heading">{t("project_runtime.environment_title")}</span>
            <Icon name={panelExpanded() ? "chevron-up" : "chevron"} size="compact" aria-hidden="true" />
          </span>
        </Button>
        <Show when={!panelExpanded()}>
          <span class="project-runtime-change-totals project-runtime-collapsed-totals">
            <span data-tone="good">+{changeTotals().additions.toLocaleString()}</span>
            <span data-tone="bad">-{changeTotals().deletions.toLocaleString()}</span>
          </span>
        </Show>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          class="project-runtime-panel-trailing-control"
          data-ui="project-runtime-local-environment-open"
          title={t("project_runtime.local_environment_create")}
          aria-label={t("project_runtime.local_environment_create")}
          onClick={openLocalEnvironmentEditor}
        >
          <Icon name="plus" size="medium" />
        </Button>
      </div>
      <Show when={panelExpanded()}>
        <div class="project-runtime-expanded-body" id="projectRuntimeExpandedBody">
          <div
            class="project-runtime-environment-body project-runtime-menu-region"
            data-ui="project-runtime-environment-details"
          >
            <Button
              type="button"
              variant="ghost"
              size="md"
              tone="neutral"
              class="project-runtime-info-row project-runtime-info-action"
              data-ui="project-runtime-changes"
              onClick={openChanges}
            >
              <Icon name="files" size="medium" />
              <span>{t("project_runtime.git_changes")}</span>
              <span class="project-runtime-change-totals">
                <span data-tone="good">+{changeTotals().additions.toLocaleString()}</span>
                <span data-tone="bad">-{changeTotals().deletions.toLocaleString()}</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              tone="neutral"
              class="project-runtime-info-row project-runtime-info-action"
              data-ui="project-runtime-add-tool"
              title={t("right_dock.add")}
              aria-label={t("right_dock.add")}
              onClick={openRightDockAddMenu}
            >
              <Icon name="plus" size="medium" />
              <span>{t("right_dock.add")}</span>
            </Button>
            <Button
              ref={localMenuAnchor}
              type="button"
              variant="ghost"
              size="md"
              tone="neutral"
              class="project-runtime-info-row project-runtime-info-action project-runtime-control-trigger"
              data-ui="project-runtime-local"
              data-expanded={localMenuOpen() ? "" : undefined}
              title={dir()}
              aria-label={`${t("project_runtime.local")}: ${dir()}`}
              aria-haspopup="menu"
              aria-expanded={localMenuOpen()}
              onClick={() => void openLocalMenu(localMenuAnchor)}
            >
              <Icon name="terminal-powershell" size="medium" />
              <span>{t("project_runtime.local")}</span>
              <Icon class="project-runtime-info-caret" name="chevron-down" />
            </Button>
            <Show
              when={vcs()?.initialized}
              fallback={
                <div class="project-runtime-info-row" data-ui="project-runtime-git-uninitialized">
                  <Icon name="git-branch" size="medium" />
                  <span>{gitStatusLabel()}</span>
                  <Show when={canInitGit()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="mini"
                      tone="accent"
                      data-ui="project-init-git"
                      data-busy={gitBusy() ? "true" : "false"}
                      disabled={gitBusy()}
                      onClick={(event) => void handleInitGit(event)}
                    >
                      <span>{gitBusy() ? t("common.loading") : t("git.init")}</span>
                    </Button>
                  </Show>
                </div>
              }
            >
              <Button
                ref={branchMenuAnchor}
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                class="project-runtime-info-row project-runtime-info-action project-runtime-control-trigger"
                data-ui="project-runtime-branch"
                data-expanded={branchMenuOpen() ? "" : undefined}
                title={vcs()?.branch ?? ""}
                aria-label={`${t("chat.git.branch")}: ${vcs()?.branch ?? ""}`}
                aria-haspopup="menu"
                aria-expanded={branchMenuOpen()}
                onClick={() => void openBranchMenu(branchMenuAnchor)}
              >
                <Icon name="git-branch" size="medium" />
                <span class="project-runtime-info-value project-runtime-branch-value">{vcs()?.branch ?? ""}</span>
                <Icon class="project-runtime-info-caret" name="chevron-down" />
              </Button>
            </Show>
            <Show when={vcs()?.initialized}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                class="project-runtime-info-row project-runtime-info-action project-runtime-control-trigger"
                data-ui="project-runtime-commit-push"
                data-expanded={gitActionOpen() ? "" : undefined}
                aria-expanded={gitActionOpen()}
                aria-haspopup="dialog"
                aria-controls="projectRuntimeGitDialog"
                onClick={toggleGitAction}
              >
                <Icon name="git-compare" size="medium" />
                <span>{t(vcs()?.hasRemote ? "project_runtime.commit_or_push" : "project_runtime.commit")}</span>
                <Show when={gitArrows()}>
                  <span class="project-runtime-info-value">{gitArrows()}</span>
                </Show>
              </Button>
            </Show>
            <div class="project-runtime-info-row project-runtime-github-row" data-ui="project-runtime-github-cli">
              <Icon name="web-search" size="medium" />
              <span>{t("project_runtime.github_unavailable")}</span>
            </div>
            <Show when={branchError() && !branchMenuOpen()}>
              <div
                class="project-runtime-operation-error"
                data-ui="project-runtime-branch-operation-error"
                role="alert"
              >
                <Icon name="status-failed" />
                <span>{branchError()}</span>
              </div>
            </Show>
            <Show when={operationError()}>
              <div class="project-runtime-operation-error" data-ui="project-worktree-operation-error" role="status">
                <Icon name="status-failed" />
                <span>{operationError()}</span>
              </div>
            </Show>
            <Show when={error()}>
              <div class="project-runtime-operation-error" data-ui="project-worktree-load-error" role="alert">
                <Icon name="status-failed" />
                <span>{error()}</span>
              </div>
            </Show>
          </div>
          <Show when={subagentRecords().length > 0}>
            <section
              class="project-runtime-subagent-section project-runtime-menu-region"
              aria-labelledby="projectRuntimeSubagentsTitle"
              data-ui="project-runtime-subagents"
            >
              <div
                id="projectRuntimeSubagentsTitle"
                class="project-runtime-menu-region-head project-runtime-subagent-head oc-section-heading"
              >
                {t("project_runtime.subagents")}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                class="project-runtime-subagent-summary project-runtime-section-title-row"
                data-ui="project-runtime-subagent-summary"
                aria-label={`${t("project_runtime.subagents")}: ${t("project_runtime.subagents_working", {
                  count: workingSubagentCount(),
                })}, ${t("project_runtime.subagents_done", { count: doneSubagentCount() })}`}
                onClick={openSubagentSummary}
              >
                <Icon name="config-agent-models" size="compact" />
                <span class="project-runtime-subagent-working">
                  {t("project_runtime.subagents_working", { count: workingSubagentCount() })}
                </span>
                <span class="project-runtime-subagent-done">
                  {t("project_runtime.subagents_done", { count: doneSubagentCount() })}
                </span>
              </Button>
            </section>
          </Show>
          <Show when={hasRuntimeResourceSections()}>
            <div class="project-runtime-resource-sections project-runtime-menu-region">
              <Show when={hasGoalInformation()}>
                <TaskProgressBar
                  onOpenGoals={() => {
                    props.onOpenRightDockPanel("goals")
                    closeRuntimePanel()
                  }}
                  onOpenGoal={openGoalSummary}
                />
              </Show>
              <For each={taskInformationShortcuts()}>
                {(shortcut) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    tone="neutral"
                    class="project-runtime-category-link"
                    data-ui={`project-runtime-category-${shortcut.id}`}
                    onClick={() => openRuntimeShortcut(shortcut)}
                  >
                    <span class="project-runtime-panel-title oc-section-heading">{shortcut.label}</span>
                    <span class="project-runtime-category-summary">{shortcut.summary}</span>
                    <Icon name="chevron" size="compact" aria-hidden="true" />
                  </Button>
                )}
              </For>
              <Show when={visibleWorktrees().length > 0}>
                <Section
                  title={t("project_runtime.category_workspace")}
                  indicatorPosition="end"
                  class="project-runtime-category"
                  data-ui="project-runtime-category-workspace"
                  defaultOpen
                >
                  <section class="project-worktree-section" aria-labelledby="projectWorktreeSectionTitle">
                    <div class="project-worktree-head project-runtime-section-title-row">
                      <Icon name="git-branch" size="compact" aria-hidden="true" />
                      <span id="projectWorktreeSectionTitle" class="project-runtime-section-title oc-section-heading">
                        {t("worktree.title")}
                      </span>
                      <div class="project-worktree-head-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          tone="neutral"
                          data-chrome="icon-action"
                          data-ui="project-worktree-refresh"
                          data-busy={refreshBusy() ? "true" : "false"}
                          disabled={refreshBusy() || bulkDeleteBusy()}
                          title={refreshBusy() ? t("common.loading") : t("common.refresh")}
                          aria-label={refreshBusy() ? t("common.loading") : t("common.refresh")}
                          onClick={(event) => void refreshWorktrees(event)}
                        >
                          <Icon name="refresh" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          tone="danger"
                          data-chrome="icon-action"
                          data-ui="project-worktree-delete-all"
                          data-busy={bulkDeleteBusy() ? "true" : "false"}
                          disabled={!canDeleteAll()}
                          title={bulkDeleteBusy() ? t("common.loading") : t("worktree.delete_all")}
                          aria-label={bulkDeleteBusy() ? t("common.loading") : t("worktree.delete_all")}
                          onClick={(event) => void deleteAllWorktrees(event)}
                        >
                          <Icon name={bulkDeleteBusy() ? "refresh" : "delete"} />
                        </Button>
                      </div>
                    </div>
                    <div class="project-worktree-list project-runtime-bounded-list" data-runtime-list="worktrees">
                      <For each={visibleWorktrees()}>
                        {(item) => (
                          <div class="project-worktree-row" data-status={item.status}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="mini"
                              tone="neutral"
                              class="project-worktree-item"
                              aria-busy={deletingWorktrees().has(item.directory) ? "true" : "false"}
                              title={item.directory}
                              onClick={() => void openDirectory(item.directory)}
                            >
                              <Icon name="git-branch" aria-hidden="true" />
                              <span class="project-worktree-name" title={item.directory}>
                                {item.branch}
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              tone="danger"
                              data-chrome="icon-action"
                              data-ui="project-worktree-remove"
                              data-busy={deletingWorktrees().has(item.directory) ? "true" : "false"}
                              title={
                                deletingWorktrees().has(item.directory) ? t("common.loading") : t("worktree.delete")
                              }
                              aria-label={
                                deletingWorktrees().has(item.directory) ? t("common.loading") : t("worktree.delete")
                              }
                              disabled={!item.removable || deletingWorktrees().has(item.directory) || bulkDeleteBusy()}
                              onClick={(event) => void removeWorktree(item, event)}
                            >
                              <Icon
                                name={deletingWorktrees().has(item.directory) ? "refresh" : "close"}
                                size="compact"
                              />
                            </Button>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                </Section>
              </Show>
              <Show when={resourceToolShortcuts().length > 0}>
                <Section
                  title={t("project_runtime.category_tools")}
                  indicatorPosition="end"
                  class="project-runtime-category"
                  data-ui="project-runtime-category-tools"
                  defaultOpen
                >
                  <nav
                    class="project-runtime-tool-shortcuts project-runtime-bounded-list"
                    data-runtime-list="tools"
                    aria-label={t("project_runtime.category_tools")}
                  >
                    <For each={resourceToolShortcuts()}>
                      {(shortcut) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          tone="neutral"
                          class="project-runtime-tool-shortcut project-runtime-section-title-row oc-navigation-row"
                          data-ui={`project-runtime-tool-${shortcut.id}`}
                          data-resource=""
                          onClick={() => openRuntimeShortcut(shortcut)}
                        >
                          <Icon name={rightDockPanelMeta(shortcut.id).icon} size="compact" />
                          <span class="project-runtime-tool-shortcut-label project-runtime-section-title oc-section-heading">
                            {shortcut.label}
                          </span>
                          <span class="project-runtime-tool-shortcut-summary">{shortcut.summary}</span>
                        </Button>
                      )}
                    </For>
                  </nav>
                </Section>
              </Show>
            </div>
          </Show>
          <Show when={requestSources().length > 0}>
            <div class="project-runtime-source-section project-runtime-menu-region">
              <div class="project-runtime-menu-region-head project-runtime-source-head oc-section-heading">
                <span>{t("project_runtime.sources")}</span>
                <Icon name="plus" size="medium" aria-hidden="true" />
              </div>
              <div class="project-runtime-source-list project-runtime-bounded-list" data-runtime-list="sources">
                <For each={requestSources()}>
                  {(part) => (
                    <div class="project-runtime-source-row" title={part.filename || part.url || ""}>
                      <div class="project-runtime-source-thumb">
                        <FilePart part={part} />
                      </div>
                      <span>{part.filename || part.url || ""}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )

  return (
    <>
      <span class="project-runtime-trigger-anchor">
        <HoverCard.Root
          open={runtimePanelOpen()}
          onOpenChange={setRuntimePanelOpen}
          placement="bottom-end"
          gutter={8}
          shift={-environmentAnchorShift()}
          fitViewport
          autoUpdateAnimationFrame
        >
          <HoverCard.Trigger
            as={Button}
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="chat-header-toolbar-toggle"
            data-ui="project-runtime-status-dropdown"
            data-vcs-tone={gitTone()}
            data-expanded={runtimePanelOpen() ? "" : undefined}
            data-pinned={panelPinned() ? "" : undefined}
            title={triggerTitle()}
            aria-label={triggerTitle()}
            aria-haspopup="dialog"
            aria-controls="projectRuntimeStatusPanel"
            aria-expanded={runtimePanelOpen()}
            aria-pressed={panelPinned()}
            onClick={(event) => {
              event.preventDefault()
              toggleRuntimePanel()
            }}
          >
            <Icon name="runtime-environment" size="medium" />
          </HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content
              class="project-runtime-status-panel"
              id="projectRuntimeStatusPanel"
              data-expanded={String(panelExpanded())}
              data-pinned={panelPinned() ? "" : undefined}
              aria-label={triggerTitle()}
              onEscapeKeyDown={(event) => event.preventDefault()}
            >
              <PanelShell />
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
        {props.trailingAction}
      </span>
      <Dialog
        id="projectRuntimeLocalEnvironmentDialog"
        open={localEnvironmentOpen()}
        title={t("project_runtime.local_environment_title")}
        overlayClass="project-runtime-local-environment-dialog-overlay"
        formClass="project-runtime-local-environment-dialog-form"
        draggable={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.querySelector<HTMLInputElement>('[data-ui="project-runtime-local-environment-name"]')?.focus()
        }}
        onClose={() => closeLocalEnvironmentEditor()}
      >
        <form
          class="project-runtime-local-environment-dialog"
          data-ui="project-runtime-local-environment-dialog"
          onSubmit={(event) => {
            event.preventDefault()
            void saveLocalEnvironment()
          }}
        >
          <p class="project-runtime-local-environment-description">
            {t("project_runtime.local_environment_description")}
          </p>
          <TextField.Root as="label">
            <TextField.Label>{t("project_runtime.local_environment_name")}</TextField.Label>
            <TextField.Input
              data-ui="project-runtime-local-environment-name"
              value={localEnvironmentName()}
              placeholder={t("project_runtime.local_environment_default_name")}
              disabled={localEnvironmentBusy()}
              onInput={(event) => {
                setLocalEnvironmentName(event.currentTarget.value)
                setLocalEnvironmentError("")
              }}
            />
          </TextField.Root>
          <div class="project-runtime-local-environment-variable-section">
            <div class="project-runtime-local-environment-variable-head">
              <span class="oc-section-heading">{t("project_runtime.local_environment_variables")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                data-ui="project-runtime-local-environment-add-variable"
                disabled={localEnvironmentBusy()}
                onClick={addLocalEnvironmentVariable}
              >
                <Icon name="plus" size="compact" />
                <span>{t("project_runtime.local_environment_add_variable")}</span>
              </Button>
            </div>
            <Show
              when={localEnvironmentVariables().length > 0}
              fallback={
                <div class="project-runtime-local-environment-empty">
                  {t("project_runtime.local_environment_variables_empty")}
                </div>
              }
            >
              <div class="project-runtime-local-environment-variable-list">
                <For each={localEnvironmentVariables()}>
                  {(variable) => (
                    <div class="project-runtime-local-environment-variable-row">
                      <TextField.Root as="label">
                        <TextField.Label>{t("project_runtime.local_environment_key")}</TextField.Label>
                        <TextField.Input
                          data-ui="project-runtime-local-environment-key"
                          value={variable.key}
                          disabled={localEnvironmentBusy()}
                          onInput={(event) =>
                            updateLocalEnvironmentVariable(variable.id, "key", event.currentTarget.value)
                          }
                        />
                      </TextField.Root>
                      <TextField.Root as="label">
                        <TextField.Label>{t("project_runtime.local_environment_value")}</TextField.Label>
                        <TextField.Input
                          data-ui="project-runtime-local-environment-value"
                          value={variable.value}
                          disabled={localEnvironmentBusy()}
                          onInput={(event) =>
                            updateLocalEnvironmentVariable(variable.id, "value", event.currentTarget.value)
                          }
                        />
                      </TextField.Root>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        tone="danger"
                        data-ui="project-runtime-local-environment-remove-variable"
                        title={t("project_runtime.local_environment_remove_variable")}
                        aria-label={t("project_runtime.local_environment_remove_variable")}
                        disabled={localEnvironmentBusy()}
                        onClick={() => removeLocalEnvironmentVariable(variable.id)}
                      >
                        <Icon name="delete" size="compact" />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <TextField.Root as="label" variant="multiline">
            <TextField.Label>{t("project_runtime.local_environment_setup_script")}</TextField.Label>
            <TextField.TextArea
              data-ui="project-runtime-local-environment-setup-script"
              rows={5}
              value={localEnvironmentSetupScript()}
              placeholder={t("project_runtime.local_environment_setup_script_placeholder")}
              disabled={localEnvironmentBusy()}
              onInput={(event) => {
                setLocalEnvironmentSetupScript(event.currentTarget.value)
                setLocalEnvironmentError("")
              }}
            />
            <TextField.Description>{t("project_runtime.local_environment_setup_script_hint")}</TextField.Description>
          </TextField.Root>
          <Show when={localEnvironmentError()}>
            <div class="project-runtime-operation-error" data-ui="project-runtime-local-environment-error" role="alert">
              <Icon name="status-failed" />
              <span>{localEnvironmentError()}</span>
            </div>
          </Show>
          <div class="dialog-actions compact project-runtime-local-environment-actions">
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="neutral"
              disabled={localEnvironmentBusy()}
              onClick={closeLocalEnvironmentEditor}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              tone="accent"
              data-ui="project-runtime-local-environment-save"
              disabled={localEnvironmentBusy()}
            >
              {localEnvironmentBusy() ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        id="projectRuntimeGitDialog"
        open={gitActionOpen()}
        title={
          <span class="project-runtime-git-dialog-title">
            <Icon name="git-branch" size="medium" />
            <span>{vcs()?.branch || t("project_runtime.local")}</span>
          </span>
        }
        headerActions={
          <>
            <Show when={vcs()?.dirty}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-ui="project-runtime-regenerate-commit-message"
                data-busy={commitMessageGenerating() ? "true" : "false"}
                disabled={commitMessageGenerating() || gitBusy()}
                title={t("project_runtime.commit_message_regenerate")}
                aria-label={t("project_runtime.commit_message_regenerate")}
                onClick={() => generateCommitMessage(true)}
              >
                <Icon name={commitMessageGenerating() ? "loading" : "refresh"} />
              </Button>
            </Show>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="project-runtime-git-dialog-close"
              title={t("common.close")}
              aria-label={t("common.close")}
              onClick={() => closeGitAction()}
            >
              <Icon name="close" />
            </Button>
          </>
        }
        overlayClass="project-runtime-git-dialog-overlay"
        formClass="project-runtime-git-dialog-form"
        draggable={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const dialog = document.querySelector<HTMLElement>("#projectRuntimeGitDialog")
          const target =
            dialog?.querySelector<HTMLElement>('[data-ui="project-runtime-commit-message"]') ??
            dialog?.querySelector<HTMLElement>('[data-ui="project-runtime-push"]') ??
            dialog?.querySelector<HTMLElement>('[data-ui="project-runtime-git-dialog-close"]')
          target?.focus()
        }}
        onClose={() => closeGitAction()}
      >
        <div class="project-runtime-git-dialog-body" data-ui="project-runtime-git-dialog">
          <Show when={vcs()?.dirty}>
            <AutoGrowTextarea
              class="project-runtime-commit-message"
              data-ui="project-runtime-commit-message"
              value={commitMessage()}
              placeholder={
                commitMessageGenerating()
                  ? t("project_runtime.commit_message_generating")
                  : t("project_runtime.commit_message_placeholder")
              }
              aria-label={t("project_runtime.commit_message")}
              readOnly={commitMessageGenerating()}
              onInput={(event) => setCommitMessage(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return
                event.preventDefault()
                void commitChanges(false)
              }}
            />
          </Show>
          <div class="project-runtime-git-dialog-actions">
            <Show when={vcs()?.dirty}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                class="project-runtime-git-dialog-action"
                data-ui="project-runtime-commit"
                disabled={commitMessageGenerating() || gitBusy() || !commitMessage().trim()}
                onClick={() => void commitChanges(false)}
              >
                <Icon name="git-compare" size="medium" />
                <span>{gitBusy() ? t("common.loading") : t("project_runtime.commit")}</span>
                <kbd>Ctrl+Enter</kbd>
              </Button>
              <Show when={vcs()?.hasRemote}>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  tone="neutral"
                  class="project-runtime-git-dialog-action"
                  data-ui="project-runtime-commit-and-push"
                  disabled={commitMessageGenerating() || gitBusy() || !commitMessage().trim()}
                  onClick={() => void commitChanges(true)}
                >
                  <Icon name="upload" size="medium" />
                  <span>{gitBusy() ? t("common.loading") : t("project_runtime.commit_and_push")}</span>
                </Button>
              </Show>
            </Show>
            <Show when={vcs()?.hasRemote && Boolean(vcs()?.commit)}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                class="project-runtime-git-dialog-action"
                data-ui="project-runtime-push"
                disabled={gitBusy()}
                onClick={() => void pushChanges()}
              >
                <Icon name="upload" size="medium" />
                <span>{gitBusy() ? t("common.loading") : t("project_runtime.push")}</span>
              </Button>
            </Show>
          </div>
          <Show when={!vcs()?.dirty && (vcs()?.ahead ?? 0) === 0 && !gitActionNotice()}>
            <div class="project-runtime-git-empty">
              {t(vcs()?.hasRemote ? "project_runtime.nothing_to_commit_or_push" : "project_runtime.nothing_to_commit")}
            </div>
          </Show>
          <Show when={gitActionNotice()}>
            <div class="project-runtime-git-notice" role="status">
              <Icon name="check" size="compact" />
              <span>{gitActionNotice()}</span>
            </div>
          </Show>
          <Show when={gitActionError()}>
            <div class="project-runtime-operation-error" role="alert">
              <Icon name="status-failed" />
              <span>{gitActionError()}</span>
            </div>
          </Show>
        </div>
      </Dialog>
    </>
  )
}

export function ProjectRuntimeToolbarActions(props: ProjectRuntimeStatusPanelProps) {
  return (
    <div class="project-runtime-toolbar-actions" data-ui="project-runtime-toolbar-actions">
      <ProjectRuntimeStatusPanel {...props} />
    </div>
  )
}
