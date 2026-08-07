import { Show, createMemo, createSignal, onCleanup, type JSX } from "solid-js"
import { AppDialogHost } from "./AppDialogHost"
import { CommandPalette } from "./CommandPalette"
import { ConnectionBadge } from "./ConnectionBadge"
import { ConfigDialogHost } from "./ConfigDialogHost"
import { ConnectionBanner } from "./ConnectionBanner"
import { ChatHeaderRightDockToggle } from "./ChatHeaderRightDockToggle"
import { ConversationAgentRail } from "./ConversationAgentRail"
import { GoalDialogHost } from "./GoalDialogHost"
import { Icon } from "./ui/Icon"
import { ImagePreviewHost } from "./ImagePreview"
import { InteractionDialogHost } from "./InteractionDialogHost"
import { SidebarVersionLabel } from "./SidebarVersionLabel"
import { SessionDialogHost } from "./SessionDialogHost"
import { TaskStatusHeader } from "./TaskStatusHeader"
import { TitlebarBrand } from "./titlebar/TitlebarBrand"
import { TitlebarMenubar } from "./titlebar/TitlebarMenubar"
import { TitlebarNavigation } from "./titlebar/TitlebarNavigation"
import { WindowControls } from "./WindowControls"
import { WorkspaceEditorLaunchers } from "./WorkspaceEditorLaunchers"
import { ProjectRuntimeToolbarActions } from "./TaskDirBar"
import { Button } from "./ui/Button"
import { Badge } from "./ui/Badge"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Tooltip } from "./ui/Tooltip"
import { StatusIndicator } from "./ui/StatusIndicator"
import { t } from "../utils/i18n"
import { conversationExperienceIcon } from "../services/conversation-experience"
import { formatUsageStrip } from "../utils/format-usage"
import type { RightDockPanel } from "./RightDock"
import { boardStore } from "../store/board"
import { appStore } from "../store/app"
import { cardTreeStore } from "../store/card-tree"
import { dialogStore } from "../store/dialog"
import type { AutomationRunSession } from "../services/automations"
import type { WorkLedgerItemRow, WorkLedgerTaskRow } from "../services/work-ledger"

const MAILBOX_HOVER_OPEN_DELAY_MILLISECONDS = 180
const MAX_VISIBLE_MAILBOX_UNREAD_COUNT = 99

function formatMailboxUnreadCount(count: number): string {
  return count > MAX_VISIBLE_MAILBOX_UNREAD_COUNT ? `${MAX_VISIBLE_MAILBOX_UNREAD_COUNT}+` : String(count)
}

function workLedgerRenameLabel(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("work_ledger.action.rename_mission")
  if (row.kind === "chat") return t("work_ledger.action.rename_chat")
  return t("task.rename_button_title")
}

function workLedgerArchiveLabel(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("mission.ledger.archive_title")
  if (row.kind === "chat") return t("coding_assistant.ledger.archive_title")
  return t("task.archive_button_title")
}

function isTerminalTaskRow(row: WorkLedgerItemRow): row is WorkLedgerTaskRow {
  return row.kind === "task" && ["completed", "failed", "cancelled"].includes(row.lifecycleStatus)
}

function ChatViewTitle(props: {
  title: () => string
  item: () => WorkLedgerItemRow | null
  onCopyDebug: () => Promise<void>
  onPinnedChange: (row: WorkLedgerItemRow, pinned: boolean) => void | Promise<void>
  onRename: (row: WorkLedgerItemRow) => void | Promise<void>
  onArchive: (row: WorkLedgerItemRow) => void | Promise<void>
  onRetryTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onReplanTask: (row: WorkLedgerTaskRow) => void | Promise<void>
}) {
  const usageText = createMemo(() => formatUsageStrip(cardTreeStore.usageAggregate))
  const terminalTask = createMemo(() => {
    const item = props.item()
    return item && isTerminalTaskRow(item) ? item : null
  })
  const [copyFeedback, setCopyFeedback] = createSignal<"copied" | "failed" | null>(null)
  let copyFeedbackTimer: number | undefined

  onCleanup(() => {
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
  })

  async function copyDebugInfo(): Promise<void> {
    if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer)
    try {
      await props.onCopyDebug()
      setCopyFeedback("copied")
    } catch (error) {
      console.error("[chat-view-title dblclick] clipboard write failed", error)
      setCopyFeedback("failed")
    }
    copyFeedbackTimer = window.setTimeout(() => {
      setCopyFeedback(null)
      copyFeedbackTimer = undefined
    }, 1400)
  }

  return (
    <div class="chat-title-group">
      <Tooltip.Root
        disabled={!usageText()}
        openDelay={160}
        closeDelay={80}
        placement="bottom-start"
        gutter={8}
        fitViewport
      >
        <Tooltip.Trigger
          as="span"
          class="chat-title chat-title-usage-trigger oc-surface-header__title"
          id="chatViewTitle"
          tabIndex={usageText() ? 0 : undefined}
          aria-live="polite"
          data-copy-feedback={copyFeedback() ?? undefined}
          onDblClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void copyDebugInfo()
          }}
        >
          {copyFeedback() === "copied"
            ? t("common.copied")
            : copyFeedback() === "failed"
              ? t("markdown.copy_failed")
              : props.title()}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content class="chat-title-usage-tooltip" data-ui="chat-title-usage-tooltip">
            <span class="chat-title-usage-tooltip__label">{t("chat.usage_aria")}</span>
            <strong class="chat-title-usage-tooltip__value" id="chatTitleUsage">
              {usageText()}
            </strong>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Show when={props.item()}>
        {(item) => (
          <DropdownMenu.Root placement="bottom-start" gutter={6} fitViewport>
            <DropdownMenu.Trigger
              as={Button}
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui="chat-title-more"
              title={t("project.more_actions")}
              aria-label={t("project.more_actions")}
            >
              <Icon name="more-horizontal" size="medium" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class="chat-title-menu" data-ui="chat-title-menu">
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  data-ui="chat-title-pin"
                  data-pinned={item().pinned ? "true" : "false"}
                  onSelect={() => props.onPinnedChange(item(), !item().pinned)}
                >
                  <Icon name="pin" size="medium" />
                  <span>{item().pinned ? t("work_ledger.action.unpin") : t("work_ledger.action.pin")}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  data-ui="chat-title-rename"
                  onSelect={() => props.onRename(item())}
                >
                  <Icon name="edit" size="medium" />
                  <span>{workLedgerRenameLabel(item())}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  data-ui="chat-title-archive"
                  onSelect={() => props.onArchive(item())}
                >
                  <Icon name="archive" size="medium" />
                  <span>{workLedgerArchiveLabel(item())}</span>
                </DropdownMenu.Item>
                <Show when={terminalTask()} keyed>
                  {(task) => (
                    <>
                      <DropdownMenu.Item
                        as="button"
                        type="button"
                        data-ui="chat-title-task-retry"
                        onSelect={() => props.onRetryTask(task)}
                      >
                        <Icon name="refresh" size="medium" />
                        <span>{t("task.retry_button_title")}</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        as="button"
                        type="button"
                        data-ui="chat-title-task-replan"
                        onSelect={() => props.onReplanTask(task)}
                      >
                        <Icon name="git-branch" size="medium" />
                        <span>{t("task.replan_button_title")}</span>
                      </DropdownMenu.Item>
                    </>
                  )}
                </Show>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </Show>
    </div>
  )
}

export interface AppProps {
  sidebarToggle: JSX.Element
  leftPanelActions: JSX.Element
  workLedger: JSX.Element
  mailbox: JSX.Element
  primarySurface: () => "conversation" | "mission-board"
  missionBoard: JSX.Element
  conversation: (container: HTMLDivElement) => JSX.Element
  composer: JSX.Element
  homeActive: boolean
  rightDock: JSX.Element
  logViewer: JSX.Element
  mailboxAttention: boolean
  mailboxUnreadCount: number
  onMailboxViewed: () => void
  onOpenRightDockPanel: (panel: RightDockPanel) => void
  onOpenSubagentConversation: (sessionID: string) => void
  onOpenRightDockAddMenu: () => void
  onSelectTask: (taskID: string, directory: string) => Promise<void>
  onSelectChat: (sessionID: string, directory: string, experience: "chat" | "work") => Promise<void>
  conversationExperience: () => "chat" | "work" | undefined
  conversationTitle: () => string
  conversationItem: () => WorkLedgerItemRow | null
  onCopyConversationDebug: () => Promise<void>
  onConversationPinnedChange: (row: WorkLedgerItemRow, pinned: boolean) => void | Promise<void>
  onRenameConversationItem: (row: WorkLedgerItemRow) => void | Promise<void>
  onArchiveConversationItem: (row: WorkLedgerItemRow) => void | Promise<void>
  onRetryTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onReplanTask: (row: WorkLedgerTaskRow) => void | Promise<void>
  onOpenAutomationSession: (session: AutomationRunSession) => Promise<void>
}

export function App(props: AppProps) {
  let chatScroll!: HTMLDivElement
  let mailboxHoverOpenTimer: number | undefined
  let mailboxHoverCloseTimer: number | undefined
  const [mailboxHoverPreview, setMailboxHoverPreview] = createSignal(false)
  const mailboxVisible = mailboxHoverPreview
  const conversationExecutionStatus = createMemo(() => {
    const source = boardStore.selectedSource
    const board = boardStore.board
    if (source?.kind === "task") {
      return board?.task?.id === source.id ? String(board.task.status || "") : ""
    }
    if (source?.kind === "session") {
      return board?.kind === "session" && board.sessionID === source.id ? String(board.status || "") : ""
    }
    return ""
  })
  const selectedTaskQueued = createMemo(
    () =>
      appStore.i18nReady && boardStore.selectedSource?.kind === "task" && conversationExecutionStatus() === "queued",
  )

  function cancelMailboxHoverOpen(): void {
    if (mailboxHoverOpenTimer !== undefined) window.clearTimeout(mailboxHoverOpenTimer)
    mailboxHoverOpenTimer = undefined
  }

  function cancelMailboxHoverClose(): void {
    if (mailboxHoverCloseTimer !== undefined) window.clearTimeout(mailboxHoverCloseTimer)
    mailboxHoverCloseTimer = undefined
  }

  function scheduleMailboxHoverPreview(): void {
    cancelMailboxHoverClose()
    cancelMailboxHoverOpen()
    mailboxHoverOpenTimer = window.setTimeout(() => {
      openMailboxHoverPreview()
    }, MAILBOX_HOVER_OPEN_DELAY_MILLISECONDS)
  }

  function scheduleMailboxHoverPreviewClose(): void {
    cancelMailboxHoverOpen()
    cancelMailboxHoverClose()
    mailboxHoverCloseTimer = window.setTimeout(() => {
      mailboxHoverCloseTimer = undefined
      setMailboxHoverPreview(false)
    }, MAILBOX_HOVER_OPEN_DELAY_MILLISECONDS)
  }

  function openMailboxHoverPreview(): void {
    cancelMailboxHoverOpen()
    setMailboxHoverPreview(true)
    props.onMailboxViewed()
  }

  onCleanup(() => {
    cancelMailboxHoverOpen()
    cancelMailboxHoverClose()
  })

  return (
    <>
      <header class="titlebar" id="titlebar">
        <div class="titlebar-top-row" data-tauri-drag-region>
          <div class="titlebar-left" data-tauri-drag-region>
            <div id="solidSidebarToggle">{props.sidebarToggle}</div>
            <div id="solidTitlebarNavigation">
              <TitlebarNavigation />
            </div>
            <div id="solidTitlebarMenu">
              <TitlebarMenubar />
            </div>
          </div>
          <div class="titlebar-spacer" data-tauri-drag-region />
          <WindowControls />
        </div>
      </header>

      <main class="panel" data-conversation-execution-status={conversationExecutionStatus() || undefined}>
        <div class="panel-body" id="panelBody">
          <div
            class="left-activity-shell"
            id="leftActivityShell"
            onMouseEnter={cancelMailboxHoverClose}
            onMouseLeave={scheduleMailboxHoverPreviewClose}
          >
            <div class="workspace-contextbar" id="workspaceContextbar" data-tauri-drag-region>
              <div class="titlebar-brand">
                <div id="solidTitlebarBrand">
                  <TitlebarBrand />
                </div>
              </div>
              <div class="titlebar-context-spacer" data-tauri-drag-region />
              <div class="workspace-context-actions" data-no-drag="true">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tone="neutral"
                  class="workspace-command-action workspace-command-search"
                  data-chrome="icon-action"
                  data-ui="work-ledger-search-toggle"
                  hidden={mailboxVisible()}
                  title={t("cmdk.placeholder")}
                  aria-label={t("cmdk.placeholder")}
                  onClick={() => window.dispatchEvent(new CustomEvent("oc:open-command-palette"))}
                >
                  <Icon name="search" size="medium" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tone="neutral"
                  class="workspace-command-action workspace-command-mailbox"
                  data-chrome="icon-action"
                  data-ui="mailbox-toggle"
                  data-attention={String(props.mailboxAttention)}
                  data-active={String(mailboxVisible())}
                  title={
                    props.mailboxUnreadCount > 0
                      ? t("mailbox.unread_count", { count: props.mailboxUnreadCount })
                      : props.mailboxAttention
                        ? `${t("mailbox.title")}: ${t("mailbox.unread")}`
                        : t("mailbox.title")
                  }
                  aria-label={
                    props.mailboxUnreadCount > 0
                      ? `${t("mailbox.title")}: ${t("mailbox.unread_count", { count: props.mailboxUnreadCount })}`
                      : props.mailboxAttention
                        ? `${t("mailbox.title")}: ${t("mailbox.unread")}`
                        : t("mailbox.title")
                  }
                  aria-controls="leftPanelMailbox"
                  aria-expanded={mailboxVisible()}
                  onMouseEnter={scheduleMailboxHoverPreview}
                >
                  <Icon name="mailbox" size="medium" />
                  <Show when={props.mailboxUnreadCount > 0}>
                    <Badge
                      class="workspace-command-mailbox__count"
                      tone="accent"
                      size="sm"
                      data-ui="mailbox-unread-count"
                      data-count={String(props.mailboxUnreadCount)}
                      aria-hidden="true"
                    >
                      {formatMailboxUnreadCount(props.mailboxUnreadCount)}
                    </Badge>
                  </Show>
                </Button>
              </div>
            </div>
            <aside class="sidebar" id="sidebar" data-collapsed="false">
              <div class="side-panel-content sidebar-content">
                <div class="sidebar-header oc-surface-header">
                  <div class="sidebar-title oc-surface-header__title" id="leftPanelTitle">
                    {mailboxVisible() ? t("mailbox.title") : t("work_ledger.title")}
                  </div>
                  <div
                    class="sidebar-header-actions oc-surface-header__actions"
                    id="solidLeftPanelActions"
                    data-active={String(!mailboxVisible())}
                    hidden={mailboxVisible()}
                  >
                    {props.leftPanelActions}
                  </div>
                </div>
                <div
                  class="side-activity-body sidebar-activity-body"
                  id="leftPanelWork"
                  data-side-activity="work"
                  data-active={String(!mailboxVisible())}
                >
                  <div class="sidebar-body">
                    <div class="sidebar-list session-list-panel work-ledger-panel" id="workLedgerPanel">
                      {props.workLedger}
                    </div>
                  </div>
                </div>
                <div
                  class="side-activity-body sidebar-activity-body"
                  id="leftPanelMailbox"
                  data-side-activity="mailbox"
                  data-active={String(mailboxVisible())}
                >
                  <div id="solidMailboxMount" class="mailbox-panel-mount">
                    {props.mailbox}
                  </div>
                </div>
                <footer class="sidebar-footer" aria-label="Author">
                  <span class="chat-version">
                    <span id="solidChatVersion">
                      <SidebarVersionLabel />
                    </span>
                  </span>
                  <span class="sidebar-connection" id="solidConnBadge">
                    <ConnectionBadge />
                  </span>
                </footer>
              </div>
            </aside>
          </div>
          <div
            class="pane-resizer pane-resizer-left"
            id="leftPaneResizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left panel"
            aria-controls="sidebar workspaceMain"
            aria-valuemin="0"
            aria-valuemax="0"
            aria-valuenow="0"
            tabIndex={0}
          />
          <div class="workspace-main" id="workspaceMain">
            <div class="conversation-workspace" id="conversationWorkspace">
              <section class="center-workbench" id="centerWorkbench" data-open="false">
                <div class="center-workbench-body">
                  <div
                    class="center-workbench-view"
                    id="centerWorkbenchConversation"
                    data-workbench-view="conversation"
                    data-open={String(props.primarySurface() === "conversation")}
                    data-active={String(props.primarySurface() === "conversation")}
                  >
                    <div id="solidConversationAgentRailMount" class="conversation-agent-rail-host">
                      <ConversationAgentRail />
                    </div>
                    <div class="center-workbench-activity chat-conversation-activity">
                      <section class="chat" id="chatSection" data-empty-chat-home={String(props.homeActive)}>
                        <div
                          class="task-switch-progress"
                          id="taskSwitchProgress"
                          aria-label="Loading task"
                          aria-busy="false"
                          data-active="false"
                        />
                        <header class="chat-header oc-surface-header">
                          <div class="chat-header-main oc-surface-header__main">
                            <span class="chat-title-icon" id="solidChatTitleIcon" aria-hidden="true">
                              <Icon
                                name={
                                  props.conversationExperience()
                                    ? conversationExperienceIcon(props.conversationExperience()!)
                                    : "file-document"
                                }
                                size="medium"
                              />
                            </span>
                            <ChatViewTitle
                              title={props.conversationTitle}
                              item={props.conversationItem}
                              onCopyDebug={props.onCopyConversationDebug}
                              onPinnedChange={props.onConversationPinnedChange}
                              onRename={props.onRenameConversationItem}
                              onArchive={props.onArchiveConversationItem}
                              onRetryTask={props.onRetryTask}
                              onReplanTask={props.onReplanTask}
                            />
                            <div class="chat-header-status" id="solidTaskStatusMount">
                              <TaskStatusHeader />
                            </div>
                          </div>
                          <div class="chat-header-meta oc-surface-header__actions">
                            <div class="chat-header-actions" data-no-drag="true">
                              <div id="solidChatHeaderEditorLaunchers">
                                <WorkspaceEditorLaunchers />
                              </div>
                              <div id="solidChatHeaderRuntimeActions">
                                <ProjectRuntimeToolbarActions
                                  anchorVisible={
                                    props.primarySurface() === "conversation" &&
                                    !props.homeActive &&
                                    !dialogStore.config.open
                                  }
                                  onOpenRightDockPanel={props.onOpenRightDockPanel}
                                  onOpenSubagentConversation={props.onOpenSubagentConversation}
                                  onOpenRightDockAddMenu={props.onOpenRightDockAddMenu}
                                  trailingAction={
                                    <div id="solidChatHeaderRightDockToggle">
                                      <ChatHeaderRightDockToggle />
                                    </div>
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </header>
                        <div class="chat-content-frame" id="chatContentFrame">
                          <div class="chat-message-pane" id="chatMessagePane">
                            <div class="conversation-body" id="conversationBody">
                              <div class="conversation-scroll-shell">
                                <div
                                  class="chat-scroll session-content"
                                  id="chatScroll"
                                  aria-label={t("chat.title")}
                                  tabIndex={0}
                                  ref={chatScroll}
                                >
                                  {props.conversation(chatScroll)}
                                </div>
                                <div class="chat-home-composition" id="chatHomeComposition">
                                  <div id="solidChatHomePromptMount" />
                                  <div id="solidChatComposer">
                                    <Show when={selectedTaskQueued()}>
                                      <div
                                        class="task-queue-notice"
                                        data-ui="task-queue-notice"
                                        role="status"
                                        aria-live="polite"
                                      >
                                        <StatusIndicator
                                          status="queued"
                                          label={t("chat.task_queue_notice")}
                                          size="medium"
                                          aria-hidden="true"
                                        />
                                        <span>{t("chat.task_queue_notice")}</span>
                                      </div>
                                    </Show>
                                    {props.composer}
                                  </div>
                                  <div id="solidChatHomeAfterMount" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                  <div
                    class="center-workbench-view"
                    id="centerWorkbenchMissionBoard"
                    data-workbench-view="mission-board"
                    data-open={String(props.primarySurface() === "mission-board")}
                    data-active={String(props.primarySurface() === "mission-board")}
                  >
                    <div class="center-workbench-activity mission-board-activity">{props.missionBoard}</div>
                  </div>
                </div>
              </section>
            </div>
            <div
              class="right-dock-resizer"
              id="rightDockResizer"
              data-open="false"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right panel"
              aria-controls="rightDock"
              aria-hidden="true"
              tabIndex={-1}
            />
            <aside class="right-dock" id="rightDock" data-open="false" aria-label="Tools panel" aria-hidden="true">
              {props.rightDock}
            </aside>
          </div>
        </div>
      </main>

      <div id="connectionBannerHost">
        <ConnectionBanner />
      </div>
      <div id="commandPaletteHost">
        <CommandPalette onSelectTask={props.onSelectTask} onSelectChat={props.onSelectChat} />
      </div>
      <div id="appDialogHost">
        <AppDialogHost />
      </div>
      <div id="configDialogHost">
        <ConfigDialogHost onOpenAutomationSession={props.onOpenAutomationSession} />
      </div>
      <div id="sessionDialogHost">
        <SessionDialogHost />
      </div>
      <div id="interactionDialogHost">
        <InteractionDialogHost />
      </div>
      <div id="goalDialogHost">
        <GoalDialogHost />
      </div>
      <div id="imagePreviewHost">
        <ImagePreviewHost />
      </div>
      <div id="solidLogViewer">{props.logViewer}</div>
    </>
  )
}
