import { For, Show, batch, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import * as Accordion from "@kobalte/core/accordion"
import {
  acknowledgeMailboxItem,
  deleteMailboxItem,
  deleteMailboxItems,
  loadMailbox,
  markAllMailboxItemsRead,
  subscribeMailboxChangeNotifications,
  type MailboxAction,
  type MailboxCursor,
  type MailboxItem,
  type MailboxView,
} from "../services/mailbox"
import { projectMailboxNotifications } from "../services/desktop-notifications"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { showAppDialog } from "../services/app-dialog"
import { syncActiveDirectoryApiContext } from "../services/workspace"
import { loadTasks } from "../store/board"
import { appStore } from "../store/app"
import { detailStamp, relativeTime } from "../utils/time"
import { t } from "../utils/i18n"
import { projectDirectoryLabel } from "../utils/project-directory"
import { Avatar } from "./Avatar"
import { Icon, type IconName } from "./ui/Icon"
import { Badge, type BadgeTone } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Checkbox } from "./ui/Checkbox"
import { Disclosure } from "./ui/Disclosure"
import { SearchField } from "./ui/SearchField"
import { createMailboxRequestOwner } from "./mailbox-request-owner"

const MAILBOX_PAGE_SIZE = 40
const MAILBOX_VIEW: MailboxView = "active"
const MAILBOX_REFRESH_DEBOUNCE_MILLISECONDS = 120

function itemIcon(item: MailboxItem): IconName {
  if (item.category === "progress") return "status-active"
  if (item.category === "notification") return "notifications"
  return "info-circle"
}

function itemTone(item: MailboxItem): BadgeTone {
  if (item.attention) return "warn"
  if (item.category === "progress") return "accent"
  if (item.category === "notification") return "bad"
  return "muted"
}

function categoryLabel(item: MailboxItem): string {
  return t(`mailbox.category.${item.category}`)
}

function mergeItems(current: MailboxItem[], next: MailboxItem[]): MailboxItem[] {
  const byID = new Map(current.map((item) => [item.id, item]))
  for (const item of next) byID.set(item.id, item)
  return [...byID.values()].sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
}

export interface MailboxPanelProps {
  onSelectTask: (taskID: string, directory: string) => Promise<void>
}

interface MailboxProjectGroup {
  directory: string
  name: string
  parent: string
  items: MailboxItem[]
}

interface MailboxActionOperation {
  token: symbol
  promise: Promise<void>
}

export function MailboxPanel(props: MailboxPanelProps) {
  const [query, setQuery] = createSignal("")
  const [searchOpen, setSearchOpen] = createSignal(false)
  const [items, setItems] = createSignal<MailboxItem[]>([])
  const [cursor, setCursor] = createSignal<MailboxCursor | null>(null)
  const [counts, setCounts] = createSignal({ unread: 0, active: 0, archived: 0 })
  const [loading, setLoading] = createSignal(true)
  const [loadingMore, setLoadingMore] = createSignal(false)
  const [loadedDirectory, setLoadedDirectory] = createSignal("")
  const [pendingActionTokens, setPendingActionTokens] = createSignal<ReadonlyMap<string, symbol>>(new Map())
  const [markAllReadPending, setMarkAllReadPending] = createSignal(false)
  const [deletePending, setDeletePending] = createSignal(false)
  const [selectedMessageIDs, setSelectedMessageIDs] = createSignal<ReadonlySet<string>>(new Set<string>())
  const [expandedMessageIDs, setExpandedMessageIDs] = createSignal<ReadonlySet<string>>(new Set<string>())
  const [loadError, setLoadError] = createSignal("")
  const requestOwner = createMailboxRequestOwner()
  let unsubscribeMailboxChanges: (() => void) | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let searchInput: HTMLInputElement | undefined
  let searchToggle: HTMLButtonElement | undefined
  let disposed = false
  const mailboxActionOperations = new Map<string, MailboxActionOperation>()

  const currentDirectory = createMemo(() => syncActiveDirectoryApiContext().trim())

  const visibleItems = createMemo(() => {
    const needle = query().trim().toLocaleLowerCase()
    if (!needle) return items()
    return items().filter((item) => {
      const directory = projectDirectoryLabel(item.taskDirectory, item.taskDirectory)
      return [
        item.subject,
        item.body,
        item.sourceAgentID,
        item.expertSquadID,
        item.taskTitle,
        item.taskDirectory,
        directory.name,
        directory.parent,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle))
    })
  })

  const visibleProjectGroups = createMemo<MailboxProjectGroup[]>(() => {
    const grouped = new Map<string, MailboxProjectGroup>()
    for (const item of visibleItems()) {
      const current = grouped.get(item.taskDirectory)
      if (current) current.items.push(item)
      else {
        const label = projectDirectoryLabel(item.taskDirectory, t("task.project.unknown"))
        grouped.set(item.taskDirectory, {
          directory: item.taskDirectory,
          name: label.name,
          parent: label.parent,
          items: [item],
        })
      }
    }
    return [...grouped.values()]
  })
  const visibleProjectDirectories = createMemo(() => visibleProjectGroups().map((group) => group.directory))
  const visibleProjectGroup = (directory: string) =>
    visibleProjectGroups().find((group) => group.directory === directory)!

  const selectedCount = createMemo(() => selectedMessageIDs().size)
  const visibleMessageIDs = createMemo(() => visibleItems().map((item) => item.id))
  const allVisibleSelected = createMemo(
    () =>
      visibleMessageIDs().length > 0 && visibleMessageIDs().every((messageID) => selectedMessageIDs().has(messageID)),
  )
  const someVisibleSelected = createMemo(() =>
    visibleMessageIDs().some((messageID) => selectedMessageIDs().has(messageID)),
  )

  function setMessageSelected(messageID: string, selected: boolean): void {
    setSelectedMessageIDs((current) => {
      const next = new Set(current)
      selected ? next.add(messageID) : next.delete(messageID)
      return next
    })
  }

  function setVisibleMessagesSelected(selected: boolean): void {
    const visible = new Set(visibleMessageIDs())
    setSelectedMessageIDs((current) => {
      const next = new Set(current)
      for (const messageID of visible) selected ? next.add(messageID) : next.delete(messageID)
      return next
    })
  }

  function setProjectGroupExpandedMessages(group: MailboxProjectGroup, messageIDs: string[]): void {
    const groupIDs = new Set(group.items.map((item) => item.id))
    const previous = expandedMessageIDs()
    const newlyExpandedUnreadItems = group.items.filter(
      (item) => !item.readAt && messageIDs.includes(item.id) && !previous.has(item.id),
    )
    setExpandedMessageIDs((current) => {
      const next = new Set([...current].filter((messageID) => !groupIDs.has(messageID)))
      for (const messageID of messageIDs) next.add(messageID)
      return next
    })
    for (const item of newlyExpandedUnreadItems) void applyAction(item, "read")
  }

  function openSearch(): void {
    setSearchOpen(true)
    queueMicrotask(() => searchInput?.focus())
  }

  function closeSearch(): void {
    setQuery("")
    setSearchOpen(false)
    queueMicrotask(() => searchToggle?.focus())
  }

  function mailboxActionKey(messageID: string, action: MailboxAction): string {
    return `${messageID}\u0000${action}`
  }

  function mailboxActionPending(messageID: string, action: MailboxAction): boolean {
    return pendingActionTokens().has(mailboxActionKey(messageID, action))
  }

  async function refresh(append = false): Promise<void> {
    const directory = currentDirectory()
    if (!directory) return
    const requestView = MAILBOX_VIEW
    const requestedScope = { directory, view: requestView }
    const request = (() => {
      if (append) return requestOwner.join(requestedScope)
      const base = requestOwner.beginBase(requestedScope, () => {
        batch(() => {
          setItems([])
          setCursor(null)
          setCounts({ unread: 0, active: 0, archived: 0 })
          setLoadedDirectory("")
          setLoadError("")
          setLoading(true)
          setLoadingMore(false)
          setExpandedMessageIDs(new Set<string>())
        })
      })
      if (!base.scopeChanged) {
        batch(() => {
          setLoadError("")
          setLoading(true)
          setLoadingMore(false)
        })
      }
      return base.request
    })()
    if (append) {
      setLoadingMore(true)
      setLoadError("")
    }
    try {
      const page = await loadMailbox({
        view: requestView,
        limit: MAILBOX_PAGE_SIZE,
        cursor: append ? cursor() : null,
        signal: request.signal,
      })
      if (disposed) return
      const committed = request.commit({ directory: currentDirectory(), view: MAILBOX_VIEW }, () => {
        setItems((current) => (append ? mergeItems(current, page.items) : page.items))
        setCursor(page.nextCursor)
        setCounts({ unread: page.unreadCount, active: page.activeCount, archived: page.archivedCount })
        if (!append) setLoadedDirectory(directory)
      })
      if (!committed) return
      if (!append) {
        const notificationRequest = requestOwner.join(requestedScope)
        void projectMailboxNotifications({
          directory,
          view: requestView,
          page,
          signal: notificationRequest.signal,
        }).finally(() => notificationRequest.complete())
      }
    } catch (error) {
      if (disposed) return
      request.commit({ directory: currentDirectory(), view: MAILBOX_VIEW }, () => {
        setLoadError(error instanceof Error ? error.message : String(error))
      })
    } finally {
      const ownsCurrentScope = !disposed && request.owns({ directory: currentDirectory(), view: MAILBOX_VIEW })
      request.complete()
      if (ownsCurrentScope) append ? setLoadingMore(false) : setLoading(false)
    }
  }

  function scheduleRefresh(directory: string): void {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined
      if (disposed || currentDirectory() !== directory) return
      void refresh()
    }, MAILBOX_REFRESH_DEBOUNCE_MILLISECONDS)
  }

  function connect(directory: string): void {
    if (disposed) return
    unsubscribeMailboxChanges?.()
    unsubscribeMailboxChanges = subscribeMailboxChangeNotifications({
      onRefresh: () => scheduleRefresh(directory),
      onError(error) {
        console.error("[mailbox] change stream failed", error)
      },
    })
  }

  function applyAction(item: MailboxItem, action: MailboxAction): Promise<void> {
    const key = mailboxActionKey(item.id, action)
    const existing = mailboxActionOperations.get(key)
    if (existing) return existing.promise

    const token = Symbol(key)
    const owner: MailboxActionOperation = { token, promise: Promise.resolve() }
    mailboxActionOperations.set(key, owner)
    setPendingActionTokens((current) => new Map(current).set(key, token))
    owner.promise = (async () => {
      try {
        await acknowledgeMailboxItem(item.id, action)
        await refresh()
      } catch (error) {
        reportError({
          id: `mailbox:${action}:${item.id}`,
          title: t("mailbox.action_failed"),
          message: error instanceof Error ? error.message : String(error),
          details: formatErrorDetails(error),
          taskID: item.taskID,
          taskDirectory: item.taskDirectory,
          taskTitle: item.taskTitle,
        })
      } finally {
        if (mailboxActionOperations.get(key)?.token !== token) return
        mailboxActionOperations.delete(key)
        setPendingActionTokens((current) => {
          if (current.get(key) !== token) return current
          const next = new Map(current)
          next.delete(key)
          return next
        })
      }
    })()
    return owner.promise
  }

  async function markAllAsRead(): Promise<void> {
    const directory = currentDirectory()
    if (!directory || counts().unread === 0 || markAllReadPending()) return
    setMarkAllReadPending(true)
    try {
      await markAllMailboxItemsRead()
      await refresh()
    } catch (error) {
      reportError({
        id: `mailbox:read-all:${directory}`,
        title: t("mailbox.action_failed"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    } finally {
      setMarkAllReadPending(false)
    }
  }

  async function confirmDeleteMessages(deleteItems: MailboxItem[]): Promise<void> {
    if (deleteItems.length === 0 || deletePending()) return
    const result = await showAppDialog({
      title: t("mailbox.delete_title"),
      message:
        deleteItems.length === 1
          ? t("mailbox.delete_confirm", { subject: deleteItems[0]?.subject ?? "" })
          : t("mailbox.delete_many_confirm", { count: deleteItems.length }),
      kind: "mailbox-delete",
      okLabel: t("common.delete"),
      okTone: "danger",
      cancel: true,
    })
    if (!result.confirmed) return
    setDeletePending(true)
    try {
      if (deleteItems.length === 1) {
        const item = deleteItems[0]!
        await deleteMailboxItem(item.id)
      } else {
        await deleteMailboxItems(deleteItems.map((item) => item.id))
      }
      setSelectedMessageIDs(new Set<string>())
      await refresh()
    } catch (error) {
      const item = deleteItems.length === 1 ? deleteItems[0] : undefined
      reportError({
        id: `mailbox:delete:${deleteItems.map((candidate) => candidate.id).join(",")}`,
        title: t("mailbox.delete_failed"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
        taskID: item?.taskID,
        taskDirectory: item?.taskDirectory,
        taskTitle: item?.taskTitle,
      })
    } finally {
      setDeletePending(false)
    }
  }

  function deleteSelectedMessages(): void {
    const selected = selectedMessageIDs()
    void confirmDeleteMessages(items().filter((item) => selected.has(item.id)))
  }

  async function openTask(item: MailboxItem): Promise<void> {
    if (!item.readAt) await applyAction(item, "read")
    await props.onSelectTask(item.taskID, item.taskDirectory)
    await loadTasks()
  }

  function runOpenTask(item: MailboxItem): void {
    void openTask(item).catch((error) => {
      reportError({
        id: `mailbox:open-task:${item.id}`,
        title: t("mailbox.open_failed"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
        taskID: item.taskID,
        taskDirectory: item.taskDirectory,
        taskTitle: item.taskTitle,
      })
    })
  }

  createEffect(
    on([() => appStore.connected, currentDirectory], ([connected, directory]) => {
      if (!connected || !directory) {
        const emptyScope = { directory: "", view: MAILBOX_VIEW }
        const emptyRequest = requestOwner.beginBase(emptyScope, () => undefined).request
        emptyRequest.complete()
        setItems([])
        setCursor(null)
        setCounts({ unread: 0, active: 0, archived: 0 })
        setLoadError("")
        setLoadedDirectory("")
        setLoading(false)
        setLoadingMore(false)
        return
      }
      void refresh()
    }),
  )

  createEffect(
    on(
      query,
      () => {
        setSelectedMessageIDs(new Set<string>())
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    const available = new Set(items().map((item) => item.id))
    setSelectedMessageIDs((current) => {
      const next = new Set([...current].filter((messageID) => available.has(messageID)))
      return next.size === current.size ? current : next
    })
  })

  createEffect(() => {
    const directory = currentDirectory()
    const connected = appStore.connected
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = undefined
    unsubscribeMailboxChanges?.()
    unsubscribeMailboxChanges = undefined
    if (connected && directory) connect(directory)
  })

  onCleanup(() => {
    disposed = true
    requestOwner.abortAll()
    unsubscribeMailboxChanges?.()
    if (refreshTimer) clearTimeout(refreshTimer)
  })

  return (
    <section
      class="mailbox-panel"
      aria-label={t("mailbox.title")}
      data-testid="mailbox-panel"
      data-selection-active={String(selectedCount() > 0)}
    >
      <header class="mailbox-panel__header">
        <div class="mailbox-panel__toolbar">
          <Show
            when={searchOpen()}
            fallback={
              <>
                <div class="mailbox-panel__selection-summary">
                  <Checkbox
                    class="mailbox-panel__select-visible"
                    data-ui="mailbox-select-visible"
                    checked={allVisibleSelected()}
                    indeterminate={someVisibleSelected() && !allVisibleSelected()}
                    disabled={visibleItems().length === 0 || loading() || deletePending()}
                    aria-label={allVisibleSelected() ? t("mailbox.clear_selection") : t("mailbox.select_visible")}
                    onChange={setVisibleMessagesSelected}
                  />
                  <Badge
                    class="mailbox-panel__subtitle"
                    data-ui="mailbox-summary"
                    tone={selectedCount() > 0 || counts().unread > 0 ? "accent" : "neutral"}
                    size="md"
                  >
                    {selectedCount() > 0
                      ? t("mailbox.selected_count", { count: selectedCount() })
                      : counts().unread > 0
                        ? t("mailbox.unread_count", { count: counts().unread })
                        : t("mailbox.caught_up")}
                  </Badge>
                </div>
                <div class="mailbox-panel__actions">
                  <Show when={selectedCount() > 0}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tone="danger"
                      data-ui="mailbox-delete-selected"
                      aria-label={t("mailbox.delete_selected", { count: selectedCount() })}
                      title={t("mailbox.delete_selected", { count: selectedCount() })}
                      disabled={deletePending() || loading() || !appStore.connected}
                      onClick={deleteSelectedMessages}
                    >
                      <Icon name="delete" size="compact" />
                    </Button>
                  </Show>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tone={counts().unread > 0 ? "accent" : "neutral"}
                    data-ui="mailbox-mark-all-read"
                    aria-label={t("mailbox.mark_all_read")}
                    title={t("mailbox.mark_all_read")}
                    disabled={counts().unread === 0 || markAllReadPending() || loading() || !appStore.connected}
                    onClick={() => void markAllAsRead()}
                  >
                    <Icon name="mail-check" />
                  </Button>
                </div>
                <span
                  class="mailbox-panel__inbox"
                  title={`${t("mailbox.active")} (${counts().active})`}
                  aria-label={`${t("mailbox.active")} (${counts().active})`}
                >
                  <Icon name="inbox" />
                  <Badge class="mailbox-panel__inbox-count" tone="neutral" size="md">
                    {counts().active}
                  </Badge>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tone="neutral"
                  class="mailbox-panel__search-toggle"
                  data-ui="mailbox-search-toggle"
                  title={t("mailbox.search")}
                  aria-label={t("mailbox.search")}
                  ref={(element) => {
                    searchToggle = element
                  }}
                  onClick={openSearch}
                >
                  <Icon name="search" />
                </Button>
              </>
            }
          >
            <div class="mailbox-panel__search-shell">
              <SearchField
                class="mailbox-panel__search"
                value={query()}
                size="sm"
                placeholder={t("mailbox.search")}
                inputRef={(element) => (searchInput = element)}
                onValueChange={setQuery}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return
                  event.preventDefault()
                  closeSearch()
                }}
                dataUI="mailbox-search"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                class="mailbox-panel__search-close"
                data-ui="mailbox-search-close"
                title={t("common.close")}
                aria-label={t("common.close")}
                onClick={closeSearch}
              >
                <Icon name="close" />
              </Button>
            </div>
          </Show>
        </div>
      </header>

      <div class="mailbox-panel__body" aria-busy={loading()} data-loaded-directory={loadedDirectory()}>
        <Show when={loadError()}>
          <div class="mailbox-panel__error" role="alert">
            <span>{loadError()}</span>
            <Button variant="outline" size="sm" tone="neutral" onClick={() => void refresh()}>
              {t("common.retry")}
            </Button>
          </div>
        </Show>
        <Show when={!loadError()}>
          <Show
            when={visibleItems().length > 0}
            fallback={
              <Show
                when={!loading() || items().length > 0}
                fallback={<div class="mailbox-panel__loading">{t("mailbox.loading")}</div>}
              >
                <div class="mailbox-panel__empty">
                  <Icon name="notifications" size="large" />
                  <Show
                    when={query()}
                    fallback={
                      <>
                        <div class="mailbox-panel__empty-title">{t("mailbox.empty.active")}</div>
                        <div class="mailbox-panel__empty-body">{t("mailbox.empty.active.body")}</div>
                      </>
                    }
                  >
                    <div class="mailbox-panel__empty-title">{t("mailbox.no_search_results")}</div>
                    <div class="mailbox-panel__empty-body">
                      {t("mailbox.no_search_results_body", { query: query().trim() })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      onClick={() => {
                        setQuery("")
                        queueMicrotask(() => searchInput?.focus())
                      }}
                    >
                      {t("mailbox.clear_search")}
                    </Button>
                  </Show>
                </div>
              </Show>
            }
          >
            <div class="mailbox-project-groups">
              <For each={visibleProjectDirectories()}>
                {(directory) => {
                  const group = createMemo(() => visibleProjectGroup(directory))
                  const messageIDs = createMemo(() => group().items.map((item) => item.id))
                  return (
                    <Disclosure.Root class="mailbox-project-group" data-project-directory={directory} defaultOpen>
                      <Disclosure.Trigger
                        class="mailbox-project-group__header oc-section-heading"
                        title={directory}
                        indicatorPosition="end"
                      >
                        <Icon name="folder" size="compact" />
                        <span class="mailbox-project-group__name">{group().name}</span>
                        <Show when={group().parent}>
                          <span class="mailbox-project-group__parent">{group().parent}</span>
                        </Show>
                        <span class="mailbox-project-group__count">{messageIDs().length}</span>
                      </Disclosure.Trigger>
                      <Disclosure.Content class="mailbox-project-group__content">
                        <Accordion.Root
                          class="mailbox-list"
                          role="list"
                          value={[...expandedMessageIDs()].filter((messageID) => messageIDs().includes(messageID))}
                          multiple
                          collapsible
                          onChange={(expandedIDs) => setProjectGroupExpandedMessages(group(), expandedIDs)}
                        >
                          <For each={messageIDs()}>
                            {(messageID) => {
                              const item = createMemo(
                                () => group().items.find((candidate) => candidate.id === messageID)!,
                              )
                              return (
                                <Accordion.Item
                                  as="article"
                                  class="mailbox-item"
                                  value={item().id}
                                  data-unread={String(!item().readAt)}
                                  data-attention={String(item().attention)}
                                  data-category={item().category}
                                  data-message-id={item().id}
                                  data-selected={String(selectedMessageIDs().has(item().id))}
                                  aria-busy={mailboxActionPending(item().id, "read")}
                                  role="listitem"
                                >
                                  <Checkbox
                                    class="mailbox-item__select"
                                    data-ui="mailbox-select-item"
                                    checked={selectedMessageIDs().has(item().id)}
                                    disabled={deletePending()}
                                    aria-label={t("mailbox.select_message", { subject: item().subject })}
                                    onChange={(selected) => setMessageSelected(item().id, selected)}
                                  />
                                  <div class="mailbox-item__identity">
                                    <Avatar role={item().sourceAgentID} class="mailbox-item__avatar" />
                                    <Show when={!item().readAt}>
                                      <span class="mailbox-item__unread" aria-label={t("mailbox.unread")} />
                                    </Show>
                                  </div>
                                  <Accordion.Header class="mailbox-item__heading">
                                    <Accordion.Trigger
                                      as={Button}
                                      type="button"
                                      variant="ghost"
                                      size="md"
                                      tone="neutral"
                                      class="mailbox-item__main"
                                      aria-label={
                                        expandedMessageIDs().has(item().id)
                                          ? t("mailbox.collapse_message", { subject: item().subject })
                                          : t("mailbox.expand_message", { subject: item().subject })
                                      }
                                    >
                                      <div class="mailbox-item__topline">
                                        <span class="mailbox-item__subject">{item().subject}</span>
                                        <time
                                          class="mailbox-item__time"
                                          datetime={new Date(item().createdAt).toISOString()}
                                          title={detailStamp(item().createdAt)}
                                        >
                                          {relativeTime(item().createdAt)}
                                        </time>
                                        <Icon
                                          class="mailbox-item__chevron"
                                          name={expandedMessageIDs().has(item().id) ? "chevron-down" : "chevron"}
                                          size="compact"
                                        />
                                      </div>
                                      <div class="mailbox-item__body">{item().body}</div>
                                      <Show when={item().progress !== undefined}>
                                        <div class="mailbox-item__progress" aria-label={t("mailbox.progress_label")}>
                                          <span
                                            style={{
                                              "--mailbox-progress": `${Math.round((item().progress ?? 0) * 100)}%`,
                                            }}
                                          />
                                        </div>
                                      </Show>
                                      <div class="mailbox-item__meta">
                                        <Badge tone={itemTone(item())} size="sm">
                                          <Icon name={itemIcon(item())} size="compact" />
                                          {categoryLabel(item())}
                                        </Badge>
                                        <span class="mailbox-item__agent">{item().sourceAgentID}</span>
                                        <span class="mailbox-item__task">{item().taskTitle}</span>
                                        <Show when={item().evidenceLocators.length > 0}>
                                          <span class="mailbox-item__evidence">
                                            {t("mailbox.evidence_count", { count: item().evidenceLocators.length })}
                                          </span>
                                        </Show>
                                      </div>
                                    </Accordion.Trigger>
                                  </Accordion.Header>
                                  <div class="mailbox-item__actions">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      tone="neutral"
                                      class="mailbox-item__open-task"
                                      data-ui="mailbox-open-task"
                                      disabled={mailboxActionPending(item().id, "read") || deletePending()}
                                      aria-busy={mailboxActionPending(item().id, "read")}
                                      title={t("mailbox.open_task")}
                                      aria-label={t("mailbox.open_task")}
                                      onClick={() => runOpenTask(item())}
                                    >
                                      <Icon name="nav-forward" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      tone="danger"
                                      class="mailbox-item__delete"
                                      data-ui="mailbox-delete"
                                      disabled={deletePending() || mailboxActionPending(item().id, "read")}
                                      aria-busy={mailboxActionPending(item().id, "read")}
                                      title={t("mailbox.delete")}
                                      aria-label={t("mailbox.delete")}
                                      onClick={() => void confirmDeleteMessages([item()])}
                                    >
                                      <Icon name="delete" />
                                    </Button>
                                  </div>
                                  <Accordion.Content class="mailbox-item__content">
                                    <div class="mailbox-item__body mailbox-item__body--expanded">{item().body}</div>
                                  </Accordion.Content>
                                </Accordion.Item>
                              )
                            }}
                          </For>
                        </Accordion.Root>
                      </Disclosure.Content>
                    </Disclosure.Root>
                  )
                }}
              </For>
            </div>
            <Show when={cursor() && !query()}>
              <div class="mailbox-panel__load-more">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tone="neutral"
                  disabled={loadingMore()}
                  onClick={() => void refresh(true)}
                >
                  {loadingMore() ? t("mailbox.loading") : t("mailbox.load_more")}
                </Button>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </section>
  )
}
