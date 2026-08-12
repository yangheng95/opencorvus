import { Tooltip } from "./ui/Tooltip"
import { DropdownMenu } from "./ui/DropdownMenu"
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  type ComponentProps,
  type JSX,
} from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import type { WorkLedgerOrganization, WorkLedgerSort } from "@opencorvus-ai/transport-protocol"
import {
  loadWorkLedger,
  setWorkLedgerItemPinned,
  setWorkLedgerRuntimeRows,
  setWorkLedgerProjectPinned,
  workLedgerPresentationLabel,
  workLedgerPresentationStatus,
  type WorkLedgerChatRow,
  type WorkLedgerCursor,
  type WorkLedgerItemRow,
  type WorkLedgerMissionRow,
  type WorkLedgerMissionTaskRow,
  type WorkLedgerProjectRow,
  type WorkLedgerRow,
  type WorkLedgerTaskRow,
} from "../services/work-ledger"
import { openConfigDialog } from "../services/config-dialog-control"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { appStore } from "../store/app"
import { activeProjectDirectory } from "../services/project-directory"
import { cancelMissionBoardLoad, missionBoardStore, reloadMissionBoard } from "../services/mission-board"
import { MISSION_BOARD_LANES, missionBoardCounts } from "../services/mission"
import { getHostTransport } from "../services/host-transport-runtime"
import { browseDirectory } from "../services/workspace"
import { createPersistedSelectionOwner } from "../services/persisted-selection-owner"
import type { PersistedOverlaySettings } from "../services/persisted-overlay-settings"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { detailStamp, relativeTime } from "../utils/time"
import { t } from "../utils/i18n"
import {
  conversationExperienceDescription,
  conversationExperienceIcon,
  conversationExperienceLabel,
} from "../services/conversation-experience"
import {
  implicitProjectSuffix,
  isImplicitProjectDirectory,
  projectDirectoryLabel,
  projectDisplayName as resolveProjectDisplayName,
} from "../utils/project-directory"
import { Icon, type IconName } from "./ui/Icon"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { LedgerList } from "./LedgerList"
import { LedgerRowMainButton } from "./LedgerRowMainButton"
import { createProjectLedgerGroupCollapseState, ProjectLedgerGroup } from "./ProjectLedgerGroup"
import { useTaskRowActionsKeyboard } from "./useTaskRowActionsKeyboard"

const WORK_LEDGER_PAGE_SIZE = 80

type WorkLedgerGroup = {
  renderKey: string
  directory: string
  latest: number
  project?: RenderWorkLedgerProjectRow
  items: RenderWorkLedgerTopLevelItemRow[]
}

type RenderKey = { renderKey: string }
type RenderWorkLedgerProjectRow = WorkLedgerProjectRow & RenderKey
type RenderWorkLedgerTaskRow = WorkLedgerMissionTaskRow & RenderKey
type RenderWorkLedgerMissionRow = Omit<WorkLedgerMissionRow, "tasks"> &
  RenderKey & {
    tasks: RenderWorkLedgerTaskRow[]
  }
type RenderWorkLedgerChatRow = WorkLedgerChatRow & RenderKey
type RenderWorkLedgerTopLevelItemRow = RenderWorkLedgerMissionRow | RenderWorkLedgerChatRow
type RenderWorkLedgerRow = RenderWorkLedgerProjectRow | RenderWorkLedgerTopLevelItemRow

export interface WorkLedgerProps {
  primarySurface: "conversation" | "mission-board"
  selectedTaskID?: string
  selectedSessionID?: string
  refreshToken?: number
  onOpenMissionBoard: () => void | Promise<void>
  onSelectMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onSelectTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onSelectChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onAbortMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onDownloadMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onRenameMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onArchiveMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onStartTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onCancelTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onDownloadTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onRenameTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onArchiveTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onCreateGlobalChat: () => void | Promise<void>
  onCreateChat: (directory: string) => void | Promise<void>
  onOpenProjectDirectory?: (directory: string) => void | Promise<void>
  onRenameProject: (directory: string, currentName: string) => void | Promise<void>
  onPromoteProject: (directory: string) => void | Promise<void>
  onStartMulticaImport: (directory: string) => void | Promise<void>
  onDeleteProject: (directory: string) => void | Promise<void>
  onSelectProject: (directory: string) => void | Promise<void>
  onStopChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onRenameChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onArchiveChat: (row: WorkLedgerChatRow) => void | Promise<void>
}

function ledgerRowKey(row: WorkLedgerRow): string {
  return `${row.kind}:${row.id}`
}

function renderWorkLedgerRow(row: WorkLedgerRow): RenderWorkLedgerRow {
  const renderKey = ledgerRowKey(row)
  if (row.kind !== "mission") return { ...row, renderKey } as RenderWorkLedgerRow
  return {
    ...row,
    renderKey,
    tasks: row.tasks.map((task) => ({ ...task, renderKey: rowKey(task) })),
  }
}

function rowKey(row: Pick<WorkLedgerItemRow, "kind" | "id">): string {
  return `${row.kind}:${row.id}`
}

function rowTitle(row: WorkLedgerItemRow): string {
  return row.title || row.id
}

function rowDirectory(row: WorkLedgerRow): string {
  return row.directory || ""
}

function projectDisplayName(group: WorkLedgerGroup): string {
  if (isImplicitProjectDirectory(group.directory)) {
    return `${t("work_ledger.implicit_project_row")} ${implicitProjectSuffix(group.directory)}`
  }
  return resolveProjectDisplayName({
    directory: group.directory,
    customName: group.project?.title,
    unknownName: t("task.project.unknown"),
  })
}

function workLedgerGroupItemCount(group: WorkLedgerGroup): number {
  return group.items.reduce((count, row) => count + 1 + (row.kind === "mission" ? row.tasks.length : 0), 0)
}

const WORK_LEDGER_PRIORITY_ORDER: Record<WorkLedgerTaskRow["priority"], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

function ledgerItemPriority(row: RenderWorkLedgerTopLevelItemRow): number {
  if (row.kind === "chat") return WORK_LEDGER_PRIORITY_ORDER.normal
  if (row.tasks.length === 0) return WORK_LEDGER_PRIORITY_ORDER.normal
  return row.tasks.reduce(
    (priority, task) => Math.min(priority, WORK_LEDGER_PRIORITY_ORDER[task.priority]),
    WORK_LEDGER_PRIORITY_ORDER.low,
  )
}

function compareLedgerItems(
  a: RenderWorkLedgerTopLevelItemRow,
  b: RenderWorkLedgerTopLevelItemRow,
  sort: WorkLedgerSort,
): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (sort === "priority") {
    const priority = ledgerItemPriority(a) - ledgerItemPriority(b)
    if (priority !== 0) return priority
  }
  return b.updated - a.updated || rowKey(b).localeCompare(rowKey(a))
}

function groupPriority(group: WorkLedgerGroup): number {
  return group.items.reduce(
    (priority, row) => Math.min(priority, ledgerItemPriority(row)),
    WORK_LEDGER_PRIORITY_ORDER.low,
  )
}

function compareLedgerGroups(a: WorkLedgerGroup, b: WorkLedgerGroup, sort: WorkLedgerSort): number {
  const aPinned = a.project?.pinned === true
  const bPinned = b.project?.pinned === true
  if (aPinned !== bPinned) return aPinned ? -1 : 1
  if (sort === "priority") {
    const priority = groupPriority(a) - groupPriority(b)
    if (priority !== 0) return priority
  }
  if (sort === "manual") {
    const aCreated = a.project?.created ?? Math.min(...a.items.map((row) => row.created), Number.MAX_SAFE_INTEGER)
    const bCreated = b.project?.created ?? Math.min(...b.items.map((row) => row.created), Number.MAX_SAFE_INTEGER)
    return aCreated - bCreated || a.directory.localeCompare(b.directory)
  }
  return b.latest - a.latest || a.directory.localeCompare(b.directory)
}

function kindIcon(row: WorkLedgerItemRow): IconName {
  if (row.kind === "mission") return "mission"
  if (row.kind === "chat") return conversationExperienceIcon(row.experience)
  return "tasks"
}

function kindLabel(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("work_ledger.kind.mission")
  if (row.kind === "chat") return conversationExperienceLabel(row.experience)
  return t("work_ledger.kind.task")
}

function kindDescription(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("work_ledger.kind_description.mission")
  if (row.kind === "chat") return conversationExperienceDescription(row.experience)
  return t("work_ledger.kind_description.task")
}

function pendingInteractionCount(row: WorkLedgerItemRow): number {
  return row.kind === "chat" ? 0 : row.pendingInteractions
}

function taskCanStop(row: WorkLedgerTaskRow): boolean {
  return row.lifecycleStatus === "queued" || row.lifecycleStatus === "active"
}

function taskCancellationPending(row: WorkLedgerTaskRow): boolean {
  return row.cancellationStatus === "cancelling"
}

function missionHasVisibleStoppableTask(row: WorkLedgerMissionRow): boolean {
  return row.tasks.some(taskCanStop)
}

function WorkLedgerKindMark(props: { row: WorkLedgerItemRow }) {
  const label = () => kindLabel(props.row)
  const description = () => kindDescription(props.row)
  return (
    <Tooltip.Root openDelay={0} closeDelay={0} placement="right" gutter={6}>
      <Tooltip.Trigger
        as="span"
        class="work-row-kind-mark"
        data-ui="work-row-kind-mark"
        data-kind={props.row.kind}
        data-experience={props.row.kind === "chat" ? props.row.experience : undefined}
        aria-label={description()}
      >
        <Icon name={kindIcon(props.row)} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.ExplainerContent
          class="card-meta-tooltip"
          data-ui="work-row-kind-tooltip"
          heading={label()}
          description={description()}
        />
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function WorkLedgerNavigationAction(props: {
  "data-ui": string
  icon: IconName
  label: string
  description: string
  trailing?: JSX.Element
  tooltipContent?: JSX.Element
  disabled?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip.Root openDelay={180} closeDelay={80} placement="right" gutter={8} fitViewport>
      <Tooltip.Trigger
        as={Button}
        type="button"
        variant="ghost"
        size="sm"
        tone="neutral"
        class="sidebar-codex-action oc-navigation-row"
        data-ui={props["data-ui"]}
        data-active={props.active ? "true" : undefined}
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        <Icon name={props.icon} size="medium" />
        <span class="sidebar-codex-action-label">{props.label}</span>
        <Show when={props.trailing}>
          <span class="sidebar-codex-action-trailing">{props.trailing}</span>
        </Show>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Show
          when={props.tooltipContent}
          fallback={
            <Tooltip.ExplainerContent
              data-ui={`${props["data-ui"]}-tooltip`}
              heading={props.label}
              description={props.description}
            />
          }
        >
          <Tooltip.Content data-ui={`${props["data-ui"]}-tooltip`} class="mission-board-nav-tooltip">
            {props.tooltipContent}
          </Tooltip.Content>
        </Show>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function WorkLedgerMenuButtonItem(props: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item {...props} as="button" />
}

function WorkLedgerRowView(props: {
  row: WorkLedgerItemRow
  selected: boolean
  isSelected?: (row: WorkLedgerItemRow) => boolean
  onSelect: (row: WorkLedgerItemRow) => void
  onAfterAction: () => void
  onAbortMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onDownloadMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onRenameMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onArchiveMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onStartTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onCancelTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onDownloadTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onRenameTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onArchiveTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onStopChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onRenameChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onArchiveChat: (row: WorkLedgerChatRow) => void | Promise<void>
  draggable?: boolean
  dragOver?: boolean
  onDragStart?: (row: WorkLedgerTaskRow) => void
  onDragEnd?: () => void
  onDragOver?: (row: WorkLedgerTaskRow, event: DragEvent) => void
  onDrop?: (row: WorkLedgerTaskRow, event: DragEvent) => void
}) {
  const [busy, setBusy] = createSignal(false)
  const row = () => props.row
  const tooltipTitle = () => row().title.trim()
  const tooltipFolderName = () => {
    const directory = row().directory.trim()
    return directory ? projectDirectoryLabel(directory, "").name.trim() : ""
  }
  const tooltipStartedAt = () => {
    const started = row().started
    return typeof started === "number" && Number.isFinite(started) && started > 0 ? started : 0
  }
  const tooltipStartDetail = () => (tooltipStartedAt() ? detailStamp(tooltipStartedAt()) : "")
  const tooltipStartRelative = () => {
    const started = tooltipStartedAt()
    if (!started) return ""
    const relative = relativeTime(started)
    return relative === tooltipStartDetail() ? "" : relative
  }
  const hasTooltipSummary = () => Boolean(tooltipTitle() || tooltipFolderName() || tooltipStartDetail())
  const missionTaskCount = () => (row().kind === "mission" ? (row() as WorkLedgerMissionRow).tasks.length : 0)
  const hasMissionTasks = () => missionTaskCount() > 0
  const [pointerWithinMission, setPointerWithinMission] = createSignal(false)
  const hasSelectedMissionTask = () =>
    row().kind === "mission" && (row() as WorkLedgerMissionRow).tasks.some((task) => props.isSelected?.(task) === true)
  const rowLoading = () => workLedgerPresentationStatus(row()) === "active"
  const cancellationPending = () => row().kind === "task" && taskCancellationPending(row() as WorkLedgerTaskRow)

  const canStop = () => {
    const current = row()
    if (current.kind === "mission") return current.interruptible && !missionHasVisibleStoppableTask(current)
    if (current.kind === "task") return taskCanStop(current)
    return current.status === "active"
  }
  const canStartNow = () => row().kind === "task" && (row() as WorkLedgerTaskRow).lifecycleStatus === "queued"
  const canDownload = () => row().kind !== "chat" && !!row().directory
  const showDownloadActions = getHostTransport().kind !== "tauri"
  const hasActions = () => true
  const rowActions = useTaskRowActionsKeyboard(hasActions)
  const actionCount = () => {
    let count = 2
    if (canStop()) count += 1
    if (canStartNow()) count += 1
    if (showDownloadActions && canDownload()) count += 1
    return count
  }

  async function runAction(actionName: string, action: () => void | Promise<void>) {
    if (busy()) return
    setBusy(true)
    try {
      await action()
      props.onAfterAction()
    } catch (error) {
      const current = row()
      reportError({
        id: `work-ledger:${current.kind}:${actionName}:${current.id}`,
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    } finally {
      setBusy(false)
    }
  }

  function stopLabel() {
    if (row().kind === "mission") return t("mission.ledger.abort_title")
    if (row().kind === "chat") return t("coding_assistant.ledger.stop_title")
    if (cancellationPending()) return t("task.cancelling_button_title")
    return t("task.cancel_button_title")
  }

  function stopDataUi() {
    return row().kind === "task" ? "task-row-cancel" : "work-row-stop"
  }

  function archiveDataUi() {
    if (row().kind === "mission") return "mission-row-archive"
    if (row().kind === "chat") return "chat-row-archive"
    return "task-row-archive"
  }

  return (
    <div
      class="work-row-shell"
      data-ui="work-ledger-row-shell"
      data-kind={row().kind}
      data-row-key={rowKey(row())}
      data-has-child-tasks={hasMissionTasks() ? "true" : undefined}
      data-pointer-within={hasMissionTasks() && pointerWithinMission() ? "true" : undefined}
      data-has-selected-child={hasSelectedMissionTask() ? "true" : undefined}
      data-queue-drag-over={props.dragOver ? "true" : undefined}
      draggable={props.draggable}
      aria-grabbed={props.draggable ? "false" : undefined}
      onDragStart={() => row().kind === "task" && props.onDragStart?.(row() as WorkLedgerTaskRow)}
      onDragEnd={() => props.onDragEnd?.()}
      onDragOver={(event) => row().kind === "task" && props.onDragOver?.(row() as WorkLedgerTaskRow, event)}
      onDrop={(event) => row().kind === "task" && props.onDrop?.(row() as WorkLedgerTaskRow, event)}
      onPointerEnter={() => setPointerWithinMission(hasMissionTasks())}
      onPointerLeave={() => setPointerWithinMission(false)}
    >
      <div
        class="task-row-mini global-task-row work-row oc-navigation-row"
        data-ui="work-ledger-row"
        data-density="compact"
        data-kind={row().kind}
        data-row-key={rowKey(row())}
        data-active={props.selected ? "true" : undefined}
        data-status={workLedgerPresentationStatus(row())}
        data-action-count={String(actionCount())}
        data-actions-keyboard-open={rowActions.actionsKeyboardOpenData()}
        ref={(el) => rowActions.setRowRef(el)}
        onFocusOut={(event) => rowActions.closeActionsOnFocusOut(event)}
      >
        <WorkLedgerKindMark row={row()} />
        <div class="task-row-body work-row-body">
          <Tooltip.Root
            openDelay={350}
            closeDelay={0}
            ignoreSafeArea
            placement="right-start"
            flip={false}
            gutter={8}
            getAnchorRect={rowActions.getSummaryAnchorRect}
          >
            <Tooltip.Trigger
              as={LedgerRowMainButton}
              class="work-row-main"
              ref={(el) => rowActions.setMainButtonRef(el)}
              aria-current={props.selected ? "page" : undefined}
              aria-keyshortcuts={hasActions() ? "ArrowRight" : undefined}
              onKeyDown={rowActions.openActionsFromKeyboard}
              onClick={() => props.onSelect(row())}
            >
              <div class="task-row-head work-row-head">
                <Show when={hasMissionTasks()}>
                  <span
                    class="work-row-task-disclosure"
                    data-ui="mission-task-disclosure"
                    title={t("mission.ledger.tasks_label")}
                    aria-hidden="true"
                  >
                    <span>{(row() as WorkLedgerMissionRow).taskStats.total}</span>
                    <Icon name="chevron" />
                  </span>
                </Show>
                <span class="work-row-title">{rowTitle(row())}</span>
                <Show when={pendingInteractionCount(row()) > 0}>
                  <Badge
                    class="work-row-attention"
                    tone="warn"
                    size="sm"
                    data-ui="work-row-attention"
                    data-count={String(pendingInteractionCount(row()))}
                    role="img"
                    aria-label={`${t("detail.pending_interactions")}: ${pendingInteractionCount(row())}`}
                    title={`${t("detail.pending_interactions")}: ${pendingInteractionCount(row())}`}
                  >
                    <Icon name="interaction-question" size="compact" />
                    <span>{pendingInteractionCount(row())}</span>
                  </Badge>
                </Show>
              </div>
            </Tooltip.Trigger>
            <Show when={hasTooltipSummary()}>
              <Tooltip.Portal>
                <Tooltip.Content class="card-meta-tooltip work-row-summary-tooltip" data-ui="work-row-summary-tooltip">
                  <Show when={tooltipTitle() || tooltipStartRelative()}>
                    <div class="work-row-summary-tooltip__headline">
                      <Show when={tooltipTitle()}>
                        <strong>{tooltipTitle()}</strong>
                      </Show>
                      <Show when={tooltipStartRelative()}>
                        <time
                          dateTime={new Date(tooltipStartedAt()).toISOString()}
                          data-ui="work-row-summary-start-relative"
                        >
                          {tooltipStartRelative()}
                        </time>
                      </Show>
                    </div>
                  </Show>
                  <Show when={tooltipStartDetail()}>
                    <div class="work-row-summary-tooltip__started" data-ui="work-row-summary-start-fact">
                      <span class="work-row-summary-tooltip__started-label" data-ui="work-row-summary-start-label">
                        {t("work_ledger.tooltip.started")}
                      </span>
                      <time
                        dateTime={new Date(tooltipStartedAt()).toISOString()}
                        data-ui="work-row-summary-start-detail"
                      >
                        {tooltipStartDetail()}
                      </time>
                    </div>
                  </Show>
                  <Show when={tooltipFolderName()}>
                    <div class="work-ledger-tooltip__fact" data-ui="work-row-summary-folder">
                      <Icon name="folder" size="medium" />
                      <span class="work-ledger-tooltip__fact-value">{tooltipFolderName()}</span>
                    </div>
                  </Show>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Show>
          </Tooltip.Root>
        </div>
        <div class="task-row-right work-row-right">
          <Show when={rowLoading()}>
            <span
              class="work-row-loading-icon"
              data-ui="work-row-loading"
              role="img"
              aria-label={workLedgerPresentationLabel(row())}
              title={workLedgerPresentationLabel(row())}
            >
              <Icon name="loading" />
            </span>
          </Show>
          <div class="task-row-actions work-row-actions" onKeyDown={rowActions.closeActionsFromKeyboardEvent}>
            <Show when={canStartNow()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="accent"
                data-chrome="icon-action"
                data-ui="task-row-start-now"
                disabled={busy()}
                tabIndex={rowActions.actionButtonTabIndex()}
                title={t("task.start_now_button_title")}
                aria-label={t("task.start_now_button_title")}
                onClick={(event) => {
                  event.stopPropagation()
                  void runAction("start", () => props.onStartTask(row() as WorkLedgerTaskRow))
                }}
              >
                <Icon name="send" />
              </Button>
            </Show>
            <Show when={canStop()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-chrome="icon-action"
                data-ui={stopDataUi()}
                data-state={cancellationPending() ? "pending" : "idle"}
                disabled={busy() || cancellationPending()}
                tabIndex={rowActions.actionButtonTabIndex()}
                title={stopLabel()}
                aria-label={stopLabel()}
                onClick={(event) => {
                  event.stopPropagation()
                  void runAction("stop", () => {
                    const current = row()
                    if (current.kind === "mission") return props.onAbortMission(current)
                    if (current.kind === "chat") return props.onStopChat(current)
                    return props.onCancelTask(current)
                  })
                }}
              >
                <Icon name={cancellationPending() ? "loading" : "stop"} />
              </Button>
            </Show>
            <Show when={showDownloadActions && canDownload()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-chrome="icon-action"
                data-ui={row().kind === "mission" ? "mission-row-download" : "task-row-download"}
                disabled={busy()}
                tabIndex={rowActions.actionButtonTabIndex()}
                title={
                  row().kind === "mission"
                    ? t("work_ledger.action.download_mission")
                    : t("task.download_project_button_title")
                }
                aria-label={
                  row().kind === "mission"
                    ? t("work_ledger.action.download_mission")
                    : t("task.download_project_button_title")
                }
                onClick={(event) => {
                  event.stopPropagation()
                  void runAction("download", () => {
                    const current = row()
                    if (current.kind === "mission") return props.onDownloadMission(current)
                    return props.onDownloadTask(current as WorkLedgerTaskRow)
                  })
                }}
              >
                <Icon name="download" />
              </Button>
            </Show>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui={`${row().kind}-row-pin`}
              data-pinned={row().pinned ? "true" : "false"}
              disabled={busy()}
              tabIndex={rowActions.actionButtonTabIndex()}
              title={row().pinned ? t("work_ledger.action.unpin") : t("work_ledger.action.pin")}
              aria-label={row().pinned ? t("work_ledger.action.unpin") : t("work_ledger.action.pin")}
              onClick={(event) => {
                event.stopPropagation()
                void runAction("pin", () => setWorkLedgerItemPinned({ row: row(), pinned: !row().pinned }))
              }}
            >
              <Icon name="pin" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui={archiveDataUi()}
              disabled={busy()}
              tabIndex={rowActions.actionButtonTabIndex()}
              title={
                row().kind === "mission"
                  ? t("mission.ledger.archive_title")
                  : row().kind === "chat"
                    ? t("coding_assistant.ledger.archive_title")
                    : t("task.archive_button_title")
              }
              aria-label={
                row().kind === "mission"
                  ? t("mission.ledger.archive_title")
                  : row().kind === "chat"
                    ? t("coding_assistant.ledger.archive_title")
                    : t("task.archive_button_title")
              }
              onClick={(event) => {
                event.stopPropagation()
                void runAction("archive", () => {
                  const current = row()
                  if (current.kind === "mission") return props.onArchiveMission(current)
                  if (current.kind === "chat") return props.onArchiveChat(current)
                  return props.onArchiveTask(current)
                })
              }}
            >
              <Icon name="archive" />
            </Button>
          </div>
        </div>
      </div>
      <Show when={row().kind === "mission" && (row() as WorkLedgerMissionRow).tasks.length > 0}>
        <div class="work-row-child-drawer">
          <ul class="work-row-child-list" aria-label={t("mission.ledger.tasks_label")}>
            <For each={(row() as WorkLedgerMissionRow).tasks}>
              {(task, insertionIndex) => (
                <WorkLedgerTaskChildRow
                  task={task}
                  insertionIndex={insertionIndex()}
                  selected={props.isSelected?.(task) ?? false}
                  isSelected={props.isSelected}
                  onSelect={props.onSelect}
                  onAfterAction={props.onAfterAction}
                  onStartTask={props.onStartTask}
                  onCancelTask={props.onCancelTask}
                  onDownloadTask={props.onDownloadTask}
                  onRenameTask={props.onRenameTask}
                  onArchiveTask={props.onArchiveTask}
                  onAbortMission={props.onAbortMission}
                  onDownloadMission={props.onDownloadMission}
                  onRenameMission={props.onRenameMission}
                  onArchiveMission={props.onArchiveMission}
                  onStopChat={props.onStopChat}
                  onRenameChat={props.onRenameChat}
                  onArchiveChat={props.onArchiveChat}
                />
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}

function WorkLedgerTaskChildRow(props: {
  task: WorkLedgerTaskRow
  insertionIndex: number
  selected: boolean
  isSelected?: (row: WorkLedgerItemRow) => boolean
  onSelect: (row: WorkLedgerItemRow) => void
  onAfterAction: () => void
  onAbortMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onDownloadMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onRenameMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onArchiveMission: (row: WorkLedgerMissionRow) => void | Promise<void>
  onStartTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onCancelTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onDownloadTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onRenameTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onArchiveTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onStopChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onRenameChat: (row: WorkLedgerChatRow) => void | Promise<void>
  onArchiveChat: (row: WorkLedgerChatRow) => void | Promise<void>
}) {
  return (
    <li
      class="work-row-child"
      data-ui="work-ledger-child-task"
      data-kind="task"
      data-task-id={props.task.id}
      data-status={props.task.lifecycleStatus}
      style={{ "--work-row-child-insertion-index": String(props.insertionIndex) }}
    >
      <WorkLedgerRowView
        row={props.task}
        selected={props.selected}
        isSelected={props.isSelected}
        onSelect={props.onSelect}
        onAfterAction={props.onAfterAction}
        onAbortMission={props.onAbortMission}
        onDownloadMission={props.onDownloadMission}
        onRenameMission={props.onRenameMission}
        onArchiveMission={props.onArchiveMission}
        onStartTask={props.onStartTask}
        onCancelTask={props.onCancelTask}
        onDownloadTask={props.onDownloadTask}
        onRenameTask={props.onRenameTask}
        onArchiveTask={props.onArchiveTask}
        onStopChat={props.onStopChat}
        onRenameChat={props.onRenameChat}
        onArchiveChat={props.onArchiveChat}
      />
    </li>
  )
}

function WorkLedgerProjectGroupView(props: {
  group: WorkLedgerGroup
  dataUi?: string
  directoryCollapse: ReturnType<typeof createProjectLedgerGroupCollapseState>
  selected: (row: WorkLedgerItemRow) => boolean
  onSelect: (row: WorkLedgerItemRow) => void
  onAfterAction: () => void
  onAbortMission: WorkLedgerProps["onAbortMission"]
  onDownloadMission: WorkLedgerProps["onDownloadMission"]
  onRenameMission: WorkLedgerProps["onRenameMission"]
  onArchiveMission: WorkLedgerProps["onArchiveMission"]
  onStartTask: WorkLedgerProps["onStartTask"]
  onCancelTask: WorkLedgerProps["onCancelTask"]
  onDownloadTask: WorkLedgerProps["onDownloadTask"]
  onRenameTask: WorkLedgerProps["onRenameTask"]
  onArchiveTask: WorkLedgerProps["onArchiveTask"]
  onCreateChat: WorkLedgerProps["onCreateChat"]
  onOpenProjectDirectory: WorkLedgerProps["onOpenProjectDirectory"]
  onRenameProject: WorkLedgerProps["onRenameProject"]
  onPromoteProject: WorkLedgerProps["onPromoteProject"]
  onSetProjectPinned: (project: WorkLedgerProjectRow, pinned: boolean) => void | Promise<void>
  onDeleteProject: WorkLedgerProps["onDeleteProject"]
  onSelectProject: WorkLedgerProps["onSelectProject"]
  onStopChat: WorkLedgerProps["onStopChat"]
  onRenameChat: WorkLedgerProps["onRenameChat"]
  onArchiveChat: WorkLedgerProps["onArchiveChat"]
  showProjectHeader?: boolean
  anonymousProjectHeader?: boolean
}) {
  const collapsed = () => props.directoryCollapse.isCollapsed(props.group.directory)
  const renderRows = () => (
    <For each={props.group.items}>
      {(row) => (
        <WorkLedgerRowView
          row={row}
          selected={props.selected(row)}
          isSelected={props.selected}
          onSelect={props.onSelect}
          onAfterAction={props.onAfterAction}
          onAbortMission={props.onAbortMission}
          onDownloadMission={props.onDownloadMission}
          onRenameMission={props.onRenameMission}
          onArchiveMission={props.onArchiveMission}
          onStartTask={props.onStartTask}
          onCancelTask={props.onCancelTask}
          onDownloadTask={props.onDownloadTask}
          onRenameTask={props.onRenameTask}
          onArchiveTask={props.onArchiveTask}
          onStopChat={props.onStopChat}
          onRenameChat={props.onRenameChat}
          onArchiveChat={props.onArchiveChat}
        />
      )}
    </For>
  )
  return (
    <Show when={props.showProjectHeader !== false} fallback={<div class="work-ledger-one-list">{renderRows()}</div>}>
      <Show
        when={!isImplicitProjectDirectory(props.group.directory) || props.anonymousProjectHeader}
        fallback={
          <div class="work-ledger-implicit-project" data-project-directory={props.group.directory}>
            {renderRows()}
          </div>
        }
      >
        <ProjectLedgerGroup
          directory={props.group.directory}
          count={workLedgerGroupItemCount(props.group)}
          collapsed={collapsed()}
          onToggle={() => props.directoryCollapse.toggle(props.group.directory)}
          onSelectProject={props.onSelectProject}
          projectName={projectDisplayName(props.group)}
          onCreateChat={props.onCreateChat}
          onOpenProjectDirectory={props.onOpenProjectDirectory}
          onRenameProject={props.onRenameProject}
          onPromoteProject={isImplicitProjectDirectory(props.group.directory) ? props.onPromoteProject : undefined}
          pinned={props.group.project?.pinned}
          onPinnedChange={
            props.group.project ? (pinned) => props.onSetProjectPinned(props.group.project!, pinned) : undefined
          }
          onDeleteProject={props.onDeleteProject}
          dataUi={props.dataUi ?? "work-ledger-project-group"}
        >
          {renderRows()}
        </ProjectLedgerGroup>
      </Show>
    </Show>
  )
}

export function WorkLedger(props: WorkLedgerProps) {
  const missionCounts = createMemo(() => missionBoardCounts(missionBoardStore.records))
  const [groups, setGroups] = createStore<WorkLedgerGroup[]>([])
  const [oneListGroups, setOneListGroups] = createStore<WorkLedgerGroup[]>([])
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")
  const directoryCollapse = createProjectLedgerGroupCollapseState()
  let controller: AbortController | null = null
  let loadSequence = 0
  let loadedRows: WorkLedgerRow[] = []
  let startGlobalChatAfterCreateMenuClose = false
  const organizationPreferenceOwner = createPersistedSelectionOwner<WorkLedgerOrganization, PersistedOverlaySettings>({
    read: () => settingsStore.workLedgerOrganization,
    write: (value) => setSettingsStore("workLedgerOrganization", value),
    confirmedValue: (settings) => settings.workLedgerOrganization,
    persist: (snapshot, onFailure) =>
      saveSettings({
        overrides: { workLedgerOrganization: snapshot },
        onFailure,
      }),
    onCurrentFailure: (error) =>
      reportError({
        id: "work-ledger:organization",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      }),
  })
  const sortPreferenceOwner = createPersistedSelectionOwner<WorkLedgerSort, PersistedOverlaySettings>({
    read: () => settingsStore.workLedgerSort,
    write: (value) => setSettingsStore("workLedgerSort", value),
    confirmedValue: (settings) => settings.workLedgerSort,
    persist: (snapshot, onFailure) =>
      saveSettings({
        overrides: { workLedgerSort: snapshot },
        onFailure,
      }),
    onCurrentFailure: (error) =>
      reportError({
        id: "work-ledger:sort",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      }),
  })

  const isPinnedProjectGroup = (group: WorkLedgerGroup) =>
    !!group.project?.pinned && !isImplicitProjectDirectory(group.directory)

  function renderGroups(): void {
    const sort = settingsStore.workLedgerSort
    const grouped = new Map<string, WorkLedgerGroup>()
    for (const sourceRow of loadedRows) {
      const row = renderWorkLedgerRow(sourceRow)
      const directory = rowDirectory(row)
      const group = grouped.get(directory) ?? {
        renderKey: `project:${directory}`,
        directory,
        latest: 0,
        items: [],
      }
      if (row.kind === "project") {
        group.project = row
      } else {
        group.items.push(row)
      }
      if (row.updated > group.latest) group.latest = row.updated
      grouped.set(directory, group)
    }
    const nextGroups = [...grouped.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => compareLedgerItems(a, b, sort)),
      }))
      .sort((a, b) => compareLedgerGroups(a, b, sort))
    const oneListItems = nextGroups
      .filter((group) => !isPinnedProjectGroup(group))
      .flatMap((group) => group.items)
      .sort((a, b) => compareLedgerItems(a, b, sort))
    batch(() => {
      setGroups(reconcile(nextGroups, { key: "renderKey", merge: true }))
      setOneListGroups(
        reconcile(
          [
            {
              renderKey: "one-list",
              directory: "",
              latest: oneListItems.reduce((latest, row) => Math.max(latest, row.updated), 0),
              items: oneListItems,
            },
          ],
          { key: "renderKey", merge: true },
        ),
      )
    })
  }

  async function reload(): Promise<void> {
    controller?.abort()
    const nextController = new AbortController()
    controller = nextController
    const sequence = ++loadSequence
    setLoading(true)
    setError("")
    try {
      const merged = new Map<string, WorkLedgerRow>()
      let cursor: WorkLedgerCursor | null = null
      do {
        const result = await loadWorkLedger({
          limit: WORK_LEDGER_PAGE_SIZE,
          cursor,
          signal: nextController.signal,
        })
        if (sequence !== loadSequence) return
        for (const row of result.rows) merged.set(ledgerRowKey(row), row)
        cursor = result.nextCursor
      } while (cursor)
      if (sequence !== loadSequence) return
      loadedRows = [...merged.values()]
      setWorkLedgerRuntimeRows(loadedRows)
      renderGroups()
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") return
      if (sequence !== loadSequence) return
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      if (sequence === loadSequence) {
        setLoading(false)
      }
    }
  }

  createEffect((previousKey: string | undefined) => {
    const connectionStatus = appStore.connectionStatus
    const key = `${connectionStatus}:${props.refreshToken ?? 0}`
    if (key === previousKey) return key
    if (connectionStatus !== "online") {
      cancelMissionBoardLoad(connectionStatus === "connecting")
      loadSequence += 1
      controller?.abort()
      controller = null
      setError("")
      setLoading(connectionStatus === "connecting")
      return key
    }
    const timer = setTimeout(() => {
      void reload()
      void reloadMissionBoard()
    }, 120)
    onCleanup(() => clearTimeout(timer))
    return key
  })

  onCleanup(() => {
    controller?.abort()
    organizationPreferenceOwner.invalidate()
    sortPreferenceOwner.invalidate()
  })

  createEffect(() => {
    settingsStore.workLedgerSort
    renderGroups()
  })

  const pinnedProjects = createMemo(() => groups.filter(isPinnedProjectGroup))

  const unpinnedGroups = createMemo(() => groups.filter((group) => !isPinnedProjectGroup(group)))

  function selected(row: WorkLedgerItemRow): boolean {
    if (props.primarySurface !== "conversation") return false
    if (row.kind === "task") return props.selectedTaskID === row.id
    return props.selectedSessionID === row.id || ("sessionID" in row && props.selectedSessionID === row.sessionID)
  }

  function selectRow(row: WorkLedgerItemRow): void {
    if (row.kind === "mission") void props.onSelectMission(row)
    else if (row.kind === "chat") void props.onSelectChat(row)
    else void props.onSelectTask(row)
  }

  function startMulticaImportInCurrentDirectory(): void {
    const directory = activeProjectDirectory()
    if (!directory) return
    void props.onStartMulticaImport(directory)
  }

  function startGlobalChat(): void {
    void Promise.resolve()
      .then(() => props.onCreateGlobalChat())
      .catch((nextError) => {
        reportError({
          id: "work-ledger:new-chat",
          title: t("common.error"),
          message: nextError instanceof Error ? nextError.message : String(nextError),
          details: formatErrorDetails(nextError),
        })
      })
  }

  function prepareStartFromScratch(): void {
    startGlobalChatAfterCreateMenuClose = true
  }

  async function updateProjectPinned(project: WorkLedgerProjectRow, pinned: boolean): Promise<void> {
    try {
      await setWorkLedgerProjectPinned({ projectID: project.id, pinned })
      await reload()
    } catch (nextError) {
      reportError({
        id: `project:pin:${project.id}`,
        title: t("common.error"),
        message: nextError instanceof Error ? nextError.message : String(nextError),
        details: formatErrorDetails(nextError),
      })
      await reload()
    }
  }

  async function updateWorkLedgerOrganization(next: WorkLedgerOrganization): Promise<void> {
    await organizationPreferenceOwner.select(next)
  }

  async function updateWorkLedgerSort(next: WorkLedgerSort): Promise<void> {
    await sortPreferenceOwner.select(next)
  }

  const checkedMenuIcon = (checked: boolean) => (
    <span class="work-ledger-toolbar-menu-check" aria-hidden="true">
      <Show when={checked}>
        <Icon name="check" size="medium" />
      </Show>
    </span>
  )

  const projectGroupView = (
    group: WorkLedgerGroup,
    dataUi: string,
    showProjectHeader: boolean,
    anonymousProjectHeader = false,
  ) => (
    <WorkLedgerProjectGroupView
      group={group}
      dataUi={dataUi}
      directoryCollapse={directoryCollapse}
      selected={selected}
      onSelect={selectRow}
      onAfterAction={() => void reload()}
      onAbortMission={props.onAbortMission}
      onDownloadMission={props.onDownloadMission}
      onRenameMission={props.onRenameMission}
      onArchiveMission={props.onArchiveMission}
      onStartTask={props.onStartTask}
      onCancelTask={props.onCancelTask}
      onDownloadTask={props.onDownloadTask}
      onRenameTask={props.onRenameTask}
      onArchiveTask={props.onArchiveTask}
      onCreateChat={props.onCreateChat}
      onOpenProjectDirectory={props.onOpenProjectDirectory}
      onRenameProject={props.onRenameProject}
      onPromoteProject={props.onPromoteProject}
      onSetProjectPinned={updateProjectPinned}
      onDeleteProject={props.onDeleteProject}
      onSelectProject={props.onSelectProject}
      onStopChat={props.onStopChat}
      onRenameChat={props.onRenameChat}
      onArchiveChat={props.onArchiveChat}
      showProjectHeader={showProjectHeader}
      anonymousProjectHeader={anonymousProjectHeader}
    />
  )

  return (
    <div class="work-ledger" data-ui="work-ledger">
      <div class="sidebar-codex-static-nav sidebar-codex-primary-nav" aria-label={t("work_ledger.navigation")}>
        <div class="sidebar-codex-primary-row">
          <WorkLedgerNavigationAction
            data-ui="work-ledger-new-chat"
            icon="edit"
            label={t("work_ledger.new_chat")}
            description={t("work_ledger.tooltip.new_chat")}
            onClick={startGlobalChat}
          />
        </div>
      </div>
      <div class="sidebar-codex-static-nav sidebar-codex-shortcuts" aria-label={t("work_ledger.shortcuts")}>
        <WorkLedgerNavigationAction
          data-ui="work-ledger-mission-board"
          icon="tasks"
          label={t("mission_board.navigation")}
          description={t("mission_board.navigation_description")}
          active={props.primarySurface === "mission-board"}
          trailing={
            <Badge class="mission-board-nav-count" size="sm" tone={missionCounts().running > 0 ? "accent" : "muted"}>
              {missionCounts().running}
            </Badge>
          }
          tooltipContent={
            <div class="mission-board-nav-summary">
              <strong>{t("mission_board.summary.title")}</strong>
              <span class="mission-board-nav-summary__description">{t("mission_board.navigation_description")}</span>
              <div class="mission-board-nav-summary__lanes">
                <For each={MISSION_BOARD_LANES}>
                  {(lane) => (
                    <span class="mission-board-nav-summary__lane" data-lane={lane}>
                      <i aria-hidden="true" />
                      <span>{t(`mission_board.lane.${lane}`)}</span>
                      <strong>{missionCounts()[lane]}</strong>
                    </span>
                  )}
                </For>
              </div>
            </div>
          }
          onClick={() => void props.onOpenMissionBoard()}
        />
        <WorkLedgerNavigationAction
          data-ui="work-ledger-automations"
          icon="scheduled"
          label={t("automations.menu")}
          description={t("work_ledger.tooltip.automations")}
          onClick={() => openConfigDialog("scheduled")}
        />
        <WorkLedgerNavigationAction
          data-ui="work-ledger-expert-squads"
          icon="expert-squad"
          label={t("expert_squad.title")}
          description={t("work_ledger.tooltip.expert_squads")}
          onClick={() => openConfigDialog("expert-squad-install")}
        />
        <WorkLedgerNavigationAction
          data-ui="work-ledger-multica-import"
          icon="download"
          label={t("multica_import.sidebar_action")}
          description={t("work_ledger.tooltip.multica_import")}
          disabled={!activeProjectDirectory()}
          onClick={startMulticaImportInCurrentDirectory}
        />
        <WorkLedgerNavigationAction
          data-ui="work-ledger-channel"
          icon="config-channel"
          label={t("channel.title")}
          description={t("work_ledger.tooltip.channel")}
          onClick={() => openConfigDialog("channel")}
        />
      </div>
      <div class="work-ledger-projects-scroll" id="workLedgerProjectsScroll" data-ui="work-ledger-projects-scroll">
        <Show when={pinnedProjects().length > 0}>
          <div class="work-ledger-section-title oc-section-heading">{t("work_ledger.pinned")}</div>
          <div class="work-ledger-pinned-groups" data-ui="work-ledger-pinned-groups">
            <For each={pinnedProjects()}>
              {(group) => projectGroupView(group, "work-ledger-pinned-project-group", true)}
            </For>
          </div>
        </Show>
        <div class="work-ledger-projects-toolbar" data-ui="work-ledger-projects-toolbar">
          <div class="work-ledger-section-title oc-section-heading">{t("work_ledger.title")}</div>
          <div class="work-ledger-projects-toolbar-actions">
            <DropdownMenu.Root placement="bottom-start" gutter={6} fitViewport>
              <DropdownMenu.Trigger
                as={Button}
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-chrome="icon-action"
                data-ui="work-ledger-organize-trigger"
                title={t("work_ledger.organize")}
                aria-label={t("work_ledger.organize")}
              >
                <Icon name="more-horizontal" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="work-ledger-toolbar-menu" data-ui="work-ledger-organize-menu">
                  <div class="work-ledger-toolbar-menu-heading oc-section-heading">{t("work_ledger.organize")}</div>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={DropdownMenu.CheckboxItem}
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-organization-by-project"
                      checked={settingsStore.workLedgerOrganization === "by-project"}
                      onChange={() => void updateWorkLedgerOrganization("by-project")}
                    >
                      {checkedMenuIcon(settingsStore.workLedgerOrganization === "by-project")}
                      <span>{t("work_ledger.organization.by_project")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-organization-by-project-tooltip"
                        heading={t("work_ledger.organization.by_project")}
                        description={t("work_ledger.tooltip.organization.by_project")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={DropdownMenu.CheckboxItem}
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-organization-one-list"
                      checked={settingsStore.workLedgerOrganization === "one-list"}
                      onChange={() => void updateWorkLedgerOrganization("one-list")}
                    >
                      {checkedMenuIcon(settingsStore.workLedgerOrganization === "one-list")}
                      <span>{t("work_ledger.organization.one_list")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-organization-one-list-tooltip"
                        heading={t("work_ledger.organization.one_list")}
                        description={t("work_ledger.tooltip.organization.one_list")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <div class="work-ledger-toolbar-menu-heading oc-section-heading">{t("work_ledger.sort_by")}</div>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={DropdownMenu.CheckboxItem}
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-sort-priority"
                      checked={settingsStore.workLedgerSort === "priority"}
                      onChange={() => void updateWorkLedgerSort("priority")}
                    >
                      {checkedMenuIcon(settingsStore.workLedgerSort === "priority")}
                      <span>{t("work_ledger.sort.priority")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-sort-priority-tooltip"
                        heading={t("work_ledger.sort.priority")}
                        description={t("work_ledger.tooltip.sort.priority")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={DropdownMenu.CheckboxItem}
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-sort-updated"
                      checked={settingsStore.workLedgerSort === "updated"}
                      onChange={() => void updateWorkLedgerSort("updated")}
                    >
                      {checkedMenuIcon(settingsStore.workLedgerSort === "updated")}
                      <span>{t("work_ledger.sort.updated")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-sort-updated-tooltip"
                        heading={t("work_ledger.sort.updated")}
                        description={t("work_ledger.tooltip.sort.updated")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={DropdownMenu.CheckboxItem}
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-sort-manual"
                      checked={settingsStore.workLedgerSort === "manual"}
                      onChange={() => void updateWorkLedgerSort("manual")}
                    >
                      {checkedMenuIcon(settingsStore.workLedgerSort === "manual")}
                      <span>{t("work_ledger.sort.manual")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-sort-manual-tooltip"
                        heading={t("work_ledger.sort.manual")}
                        description={t("work_ledger.tooltip.sort.manual")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DropdownMenu.Root placement="bottom-start" gutter={6} fitViewport>
              <DropdownMenu.Trigger
                as={Button}
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-chrome="icon-action"
                data-ui="work-ledger-create-trigger"
                title={t("work_ledger.create")}
                aria-label={t("work_ledger.create")}
              >
                <Icon name="plus" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  class="work-ledger-toolbar-menu work-ledger-create-menu"
                  data-ui="work-ledger-create-menu"
                  onCloseAutoFocus={() => {
                    if (!startGlobalChatAfterCreateMenuClose) return
                    startGlobalChatAfterCreateMenuClose = false
                    startGlobalChat()
                  }}
                >
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={WorkLedgerMenuButtonItem}
                      type="button"
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-start-from-scratch"
                      onSelect={prepareStartFromScratch}
                    >
                      <Icon name="plus" size="medium" />
                      <span>{t("work_ledger.create.from_scratch")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-start-from-scratch-tooltip"
                        heading={t("work_ledger.create.from_scratch")}
                        description={t("work_ledger.tooltip.create.from_scratch")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Tooltip.Root openDelay={240} closeDelay={80} placement="right-start" gutter={8} fitViewport>
                    <Tooltip.Trigger
                      as={WorkLedgerMenuButtonItem}
                      type="button"
                      class="work-ledger-toolbar-menu-item"
                      data-ui="work-ledger-use-existing-folder"
                      onSelect={() => void browseDirectory()}
                    >
                      <Icon name="folder" size="medium" />
                      <span>{t("work_ledger.create.existing_folder")}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.ExplainerContent
                        data-ui="work-ledger-use-existing-folder-tooltip"
                        heading={t("work_ledger.create.existing_folder")}
                        description={t("work_ledger.tooltip.create.existing_folder")}
                      />
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
        <LedgerList
          items={settingsStore.workLedgerOrganization === "by-project" ? unpinnedGroups() : oneListGroups}
          loading={loading()}
          loadingLabel={t("work_ledger.loading")}
          error={error()}
          emptyLabel={t("work_ledger.empty")}
          retryLabel={t("common.retry")}
          onRetry={() => void reload()}
        >
          {(group) =>
            projectGroupView(
              group,
              "work-ledger-project-group",
              settingsStore.workLedgerOrganization === "by-project",
              isImplicitProjectDirectory(group.directory),
            )
          }
        </LedgerList>
      </div>
    </div>
  )
}
