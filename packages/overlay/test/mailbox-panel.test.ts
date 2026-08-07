import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createMailboxRequestOwner,
  mailboxStreamOwnsCurrent,
  type MailboxRequestScope,
} from "../src/components/mailbox-request-owner"

const PANEL = readFileSync(join(import.meta.dir, "../src/components/MailboxPanel.tsx"), "utf8")
const SERVICE = readFileSync(join(import.meta.dir, "../src/services/mailbox.ts"), "utf8")
const STYLES = readFileSync(join(import.meta.dir, "../src/styles/surfaces/mailbox.css"), "utf8")
const MAIN = readFileSync(join(import.meta.dir, "../src/main.tsx"), "utf8")
const RIGHT_DOCK = readFileSync(join(import.meta.dir, "../src/components/RightDock.tsx"), "utf8")
const INDEX = readFileSync(join(import.meta.dir, "../src/index.html"), "utf8")
const EN_LOCALE = JSON.parse(readFileSync(join(import.meta.dir, "../src/i18n/en-US.json"), "utf8")) as Record<
  string,
  string
>
const ZH_LOCALE = JSON.parse(readFileSync(join(import.meta.dir, "../src/i18n/zh-CN.json"), "utf8")) as Record<
  string,
  string
>

test("left sidebar mounts the only durable mailbox surface", () => {
  expect(RIGHT_DOCK).not.toContain('| "mailbox"')
  expect(RIGHT_DOCK).not.toContain('id: "mailbox"')
  expect(RIGHT_DOCK).not.toContain('labelKey: "mailbox.title"')
  expect(RIGHT_DOCK).not.toContain('| "notifications"')
  expect(MAIN).not.toContain('id="centerWorkbenchMailbox"')
  expect(MAIN).toContain("<MailboxPanel")
  expect(MAIN).toContain("onNotification={presentMailboxNotification}")
  expect(MAIN).toContain("onUnreadCountChange={setMailboxUnreadCount}")
  expect(MAIN).not.toContain('<MailboxPanel onNotification={() => openRightActivity("mailbox")} />')
  expect(MAIN).not.toContain('<MailboxPanel onNotification={() => openRightDockPanel("mailbox")} />')
  expect(MAIN).not.toContain('id="centerWorkbenchNotifications"')
  expect(INDEX).toContain('href="styles/surfaces/mailbox.css"')
})

test("mailbox reads and acknowledges the server projection through the transport chokepoint", () => {
  expect(SERVICE).toContain("type MailboxPage = MailboxListResponse")
  expect(SERVICE).toContain('type MailboxItem = MailboxPage["items"][number]')
  expect(PANEL).toContain("item().evidenceLocators.length")
  expect(PANEL).not.toContain("item().evidenceRefs")
  expect(SERVICE).toContain("apiJson<MailboxPage>(`mailbox?${params.toString()}`")
  expect(SERVICE).toContain("apiJson(`mailbox/${encodeURIComponent(messageID)}?${params.toString()}`")
  expect(SERVICE).toContain("apiJson<MailboxReadAllResult>(`mailbox/read-all?${params.toString()}`")
  expect(SERVICE).toContain("deleteMailboxItem(messageID: string, directory: string)")
  expect(SERVICE).toContain('method: "DELETE"')
  expect(SERVICE).toContain("deleteMailboxItems(messageIDs: string[], directory: string)")
  expect(SERVICE).toContain("JSON.stringify({ messageIDs })")
  expect(SERVICE).toContain('{ path: "mailbox/events", query: { directory: input.directory } }')
  expect(PANEL).toContain("openMailboxChangeStream({")
  expect(PANEL).toContain("syncActiveDirectoryApiContext")
  expect(PANEL).toContain("const currentDirectory = createMemo(() => syncActiveDirectoryApiContext().trim())")
  expect(PANEL).toContain("data-loaded-directory={loadedDirectory()}")
  expect(PANEL).toContain("requestOwner.beginBase(requestedScope")
  expect(PANEL).toContain("requestOwner.join(requestedScope)")
  expect(PANEL).toContain("projectMailboxNotificationScopeReplacement")
  expect(PANEL).toContain("onNotification?: (item: MailboxItem) => void")
  expect(PANEL).toContain("onUnreadCountChange?: (count: number) => void")
  expect(PANEL).toContain("onNotification: props.onNotification")
  expect(PANEL).toContain("<Show when={!loadError()}>")
  expect(PANEL).toContain("streamDirectory === directory")
  expect(PANEL).toContain("await acknowledgeMailboxItem(item.id, action, item.taskDirectory)")
  expect(PANEL).toContain("await markAllMailboxItemsRead(directory)")
  expect(PANEL).toContain("await deleteMailboxItem(item.id, item.taskDirectory)")
  expect(PANEL).toContain("await deleteMailboxItems(")
  expect(PANEL).toContain("deleteItems[0]!.taskDirectory")
  expect(PANEL).toContain('data-ui="mailbox-mark-all-read"')
  expect(PANEL).toContain('t("mailbox.mark_all_read")')
  expect(PANEL).toContain("await props.onSelectTask(item.taskID, item.taskDirectory)")
  expect(PANEL).not.toContain('from "../services/task"')
  expect(PANEL).not.toContain("localStorage")
  expect(PANEL).not.toContain("sessionStorage")
})

test("mailbox action pending ownership is exact and same-message actions are deduplicated", () => {
  expect(PANEL).toContain("const mailboxActionOperations = new Map<string, MailboxActionOperation>()")
  expect(PANEL).toContain("const existing = mailboxActionOperations.get(key)")
  expect(PANEL).toContain("if (existing) return existing.promise")
  expect(PANEL).toContain("if (mailboxActionOperations.get(key)?.token !== token) return")
  expect(PANEL).toContain("mailboxActionOperations.delete(key)")
  expect(PANEL).toContain('aria-busy={mailboxActionPending(item().id, "read")}')
  expect(PANEL.match(/aria-busy=\{mailboxActionPending\(item\(\)\.id, "read"\)\}/g)).toHaveLength(3)
  expect(PANEL).toContain('disabled={mailboxActionPending(item().id, "read") || deletePending()}')
  expect(PANEL).not.toContain("setActionPending(null)")
})

test("a delayed append from the previous directory cannot pollute the replacement mailbox scope", async () => {
  type FixturePage = {
    items: string[]
    nextCursor: string | null
    unreadCount: number
    activeCount: number
    archivedCount: number
  }
  const owner = createMailboxRequestOwner()
  let scope: MailboxRequestScope = { directory: "D:/workspace/old", view: "active" }
  let state = {
    items: ["old-base"],
    cursor: "old-next" as string | null,
    counts: { unread: 1, active: 1, archived: 0 },
    loading: false,
    loadingMore: false,
  }
  let releaseOldAppend!: (page: FixturePage) => void
  const oldAppendPage: FixturePage = {
    items: ["old-late"],
    nextCursor: null,
    unreadCount: 2,
    activeCount: 2,
    archivedCount: 0,
  }
  const delayedOldAppend = new Promise<FixturePage>((resolve) => {
    releaseOldAppend = resolve
  })

  owner.beginBase(scope, () => undefined).request.complete()
  const oldAppend = owner.join(scope)
  expect(oldAppend.signal.aborted).toBe(false)
  scope = { directory: "D:/workspace/new", view: "active" }
  const newPage = {
    items: ["new-base"],
    nextCursor: "new-next",
    unreadCount: 4,
    activeCount: 3,
    archivedCount: 1,
  }
  const newBase = owner.beginBase(scope, () => {
    state = {
      items: [],
      cursor: null,
      counts: { unread: 0, active: 0, archived: 0 },
      loading: true,
      loadingMore: false,
    }
  }).request
  expect(oldAppend.signal.aborted).toBe(true)
  expect(
    newBase.commit(scope, () => {
      state = {
        items: newPage.items,
        cursor: newPage.nextCursor,
        counts: { unread: newPage.unreadCount, active: newPage.activeCount, archived: newPage.archivedCount },
        loading: false,
        loadingMore: false,
      }
    }),
  ).toBe(true)
  newBase.complete()
  releaseOldAppend(oldAppendPage)
  const latePage = await delayedOldAppend

  expect(
    oldAppend.commit({ directory: "D:/workspace/old", view: "active" }, () => {
      state.items.push(...latePage.items)
      state.cursor = latePage.nextCursor
      state.counts = {
        unread: latePage.unreadCount,
        active: latePage.activeCount,
        archived: latePage.archivedCount,
      }
      state.loadingMore = false
    }),
  ).toBe(false)
  expect(state).toEqual({
    items: ["new-base"],
    cursor: "new-next",
    counts: { unread: 4, active: 3, archived: 1 },
    loading: false,
    loadingMore: false,
  })

  const activeView = owner.beginBase({ directory: scope.directory, view: "active" }, () => undefined).request
  const archivedView = owner.beginBase({ directory: scope.directory, view: "archived" }, () => undefined).request
  expect(activeView.signal.aborted).toBe(true)
  expect(archivedView.owns({ directory: scope.directory, view: "archived" })).toBe(true)
  archivedView.complete()
})

test("a failed replacement scope remains empty and exposes only its own error", async () => {
  const owner = createMailboxRequestOwner()
  const oldScope = { directory: "D:/workspace/old", view: "active" }
  const newScope = { directory: "D:/workspace/new", view: "active" }
  let state = {
    items: ["old-item"],
    cursor: "old-next" as string | null,
    counts: { unread: 1, active: 1, archived: 0 },
    loadedDirectory: oldScope.directory,
    loading: false,
    loadingMore: true,
    error: "old error",
  }
  owner.beginBase(oldScope, () => undefined).request.complete()
  const replacement = owner.beginBase(newScope, () => {
    state = {
      items: [],
      cursor: null,
      counts: { unread: 0, active: 0, archived: 0 },
      loadedDirectory: "",
      loading: true,
      loadingMore: false,
      error: "",
    }
  }).request

  const failure = new Error("new directory mailbox failed")
  await Promise.reject(failure).catch((error) => {
    replacement.commit(newScope, () => {
      state.error = error.message
    })
  })
  const ownsScope = replacement.owns(newScope)
  replacement.complete()
  if (ownsScope) state.loading = false

  expect(state).toEqual({
    items: [],
    cursor: null,
    counts: { unread: 0, active: 0, archived: 0 },
    loadedDirectory: "",
    loading: false,
    loadingMore: false,
    error: "new directory mailbox failed",
  })
})

test("a replacement scope queues a zero badge before loading can fail or return empty", () => {
  const begin = PANEL.indexOf("requestOwner.beginBase(requestedScope")
  const scopeChanged = PANEL.indexOf("if (base.scopeChanged)", begin)
  const zeroBadge = PANEL.indexOf("projectMailboxNotificationScopeReplacement", scopeChanged)
  const load = PANEL.indexOf("const page = await loadMailbox", begin)

  expect(begin).toBeGreaterThan(-1)
  expect(scopeChanged).toBeGreaterThan(begin)
  expect(zeroBadge).toBeGreaterThan(scopeChanged)
  expect(zeroBadge).toBeLessThan(load)
})

test("same-scope refresh aborts in-flight work without clearing the current projection", () => {
  const owner = createMailboxRequestOwner()
  const scope = { directory: "D:/workspace/current", view: "active" }
  let resets = 0
  const first = owner.beginBase(scope, () => {
    resets += 1
  })
  const second = owner.beginBase(scope, () => {
    resets += 1
  })

  expect(first.request.signal.aborted).toBe(true)
  expect(first.scopeChanged).toBe(true)
  expect(second.scopeChanged).toBe(false)
  expect(resets).toBe(1)
  second.request.complete()
})

test("a stale stream close cannot clear or reconnect over the current handle", () => {
  const oldHandle = { id: "old" }
  const currentHandle = { id: "current" }
  let stream: typeof currentHandle | typeof oldHandle | undefined = currentHandle
  let streamDirectory = "D:/workspace/new"
  let reconnects = 0
  const currentGeneration = 2

  if (mailboxStreamOwnsCurrent(oldHandle, 1, stream, currentGeneration)) {
    stream = undefined
    streamDirectory = ""
    reconnects += 1
  }
  expect(stream).toBe(currentHandle)
  expect(streamDirectory).toBe("D:/workspace/new")
  expect(reconnects).toBe(0)

  expect(mailboxStreamOwnsCurrent(currentHandle, 2, stream, currentGeneration)).toBe(true)
  const guard = PANEL.indexOf("mailboxStreamOwnsCurrent(handle, generation, stream, streamGeneration)")
  expect(guard).toBeGreaterThan(-1)
  expect(PANEL.indexOf("stream = undefined", guard)).toBeGreaterThan(guard)
})

test("mailbox item, cursor, and count commits share one owner guard", () => {
  const guard = PANEL.indexOf("const committed = request.commit(")
  const guardEnd = PANEL.indexOf("if (!committed) return", guard)
  expect(guard).toBeGreaterThan(-1)
  for (const mutation of ["setItems(", "setCursor(", "setCounts("]) {
    expect(PANEL.indexOf(mutation, guard)).toBeGreaterThan(guard)
    expect(PANEL.indexOf(mutation, guard)).toBeLessThan(guardEnd)
  }
})

test("replacement scope resets every projected field before loading the new page", () => {
  const begin = PANEL.indexOf("requestOwner.beginBase(requestedScope")
  const load = PANEL.indexOf("const page = await loadMailbox", begin)
  expect(begin).toBeGreaterThan(-1)
  for (const reset of [
    "setItems([])",
    "setCursor(null)",
    "setCounts({ unread: 0, active: 0, archived: 0 })",
    'setLoadedDirectory("")',
    'setLoadError("")',
    "setLoading(true)",
    "setLoadingMore(false)",
  ]) {
    expect(PANEL.indexOf(reset, begin)).toBeGreaterThan(begin)
    expect(PANEL.indexOf(reset, begin)).toBeLessThan(load)
  }
})

test("mailbox preserves Multica-inspired compact list semantics with current primitives", () => {
  expect(PANEL).toContain("<Avatar")
  expect(PANEL).toContain("<Badge")
  expect(PANEL).toContain("<Checkbox")
  expect(PANEL).toContain("<SearchField")
  expect(PANEL).not.toContain("<SegmentedControl")
  expect(PANEL).toContain('class="mailbox-panel__toolbar"')
  expect(PANEL).not.toContain("onMouseLeave")
  expect(PANEL).toContain("queueMicrotask(() => searchToggle?.focus())")
  expect(PANEL).toContain('class="mailbox-panel__subtitle"')
  expect(PANEL).toContain('data-ui="mailbox-summary"')
  expect(PANEL).toContain('tone={selectedCount() > 0 || counts().unread > 0 ? "accent" : "neutral"}')
  expect(PANEL).toContain('tone={counts().unread > 0 ? "accent" : "neutral"}')
  expect(PANEL).toContain('class="mailbox-panel__inbox"')
  expect(PANEL).toContain('<Icon name="inbox" />')
  expect(PANEL).toContain('class="mailbox-panel__inbox-count"')
  expect(PANEL).toMatch(/class="mailbox-panel__inbox-count" tone="neutral" size="md"/)
  expect(PANEL).toContain("{counts().active}")
  expect(PANEL).toMatch(/<SearchField[\s\S]*?size="sm"/)
  expect(PANEL).not.toContain('itemAttributes={() => ({ "data-size": "sm" })}')
  expect(PANEL).toContain("<Accordion.Root")
  expect(PANEL).toContain("<Accordion.Item")
  expect(PANEL).toContain("<Accordion.Trigger")
  expect(PANEL).toContain("<Accordion.Content")
  expect(PANEL).toContain('import { Disclosure } from "./ui/Disclosure"')
  expect(PANEL).toContain("<Disclosure.Root")
  expect(PANEL).toContain("<Disclosure.Trigger")
  expect(PANEL).toContain("<Disclosure.Content")
  expect(PANEL).toContain('data-ui="mailbox-open-task"')
  expect(PANEL).toContain("const visibleProjectGroups = createMemo<MailboxProjectGroup[]>")
  expect(PANEL).toContain("const visibleProjectDirectories = createMemo")
  expect(PANEL).toContain("<For each={visibleProjectDirectories()}>")
  expect(PANEL).toContain("<For each={messageIDs()}>")
  expect(PANEL).toContain("data-project-directory={directory}")
  expect(PANEL).toContain('class="mailbox-project-group__name"')
  expect(PANEL).toContain('class="mailbox-project-group__parent"')
  expect(PANEL).toContain("onChange={(expandedIDs) => setProjectGroupExpandedMessages(group(), expandedIDs)}")
  expect(PANEL).toContain('for (const item of newlyExpandedUnreadItems) void applyAction(item, "read")')
  expect(PANEL).toContain('class="mailbox-item__unread"')
  expect(PANEL).not.toContain('data-ui="mailbox-archive"')
  expect(PANEL).not.toContain('data-ui="mailbox-restore"')
  expect(EN_LOCALE).not.toHaveProperty("mailbox.archive")
  expect(EN_LOCALE).not.toHaveProperty("mailbox.restore")
  expect(ZH_LOCALE).not.toHaveProperty("mailbox.archive")
  expect(ZH_LOCALE).not.toHaveProperty("mailbox.restore")
  expect(PANEL).toContain('data-ui="mailbox-select-visible"')
  expect(PANEL).toContain('data-ui="mailbox-select-item"')
  expect(PANEL).toContain('data-ui="mailbox-delete-selected"')
  expect(PANEL).toContain('data-ui="mailbox-delete"')
  expect(PANEL).toContain('<Icon name="mail-check" />')
  expect(PANEL).not.toContain('data-ui="mailbox-refresh"')
  expect(EN_LOCALE).not.toHaveProperty("mailbox.refresh")
  expect(ZH_LOCALE).not.toHaveProperty("mailbox.refresh")
  expect(PANEL).toContain('data-ui="mailbox-search-toggle"')
  expect(PANEL).toContain('data-ui="mailbox-search-close"')
  expect(PANEL).not.toMatch(/class="mailbox-panel__search"[\s\S]*?onClear=/)
  expect(PANEL).not.toContain('data-ui": `mailbox-view-${option.value}`')
  expect(PANEL).toContain("data-selection-active={String(selectedCount() > 0)}")
  expect(PANEL).toContain("indeterminate={someVisibleSelected() && !allVisibleSelected()}")
  expect(PANEL).toContain("showAppDialog({")
  expect(PANEL).toContain('kind: "mailbox-delete"')
  expect(PANEL).toContain('class="mailbox-item__progress"')
  expect(PANEL).toContain('"--mailbox-progress": `${Math.round((item().progress ?? 0) * 100)}%`')
  expect(STYLES).toMatch(/\.mailbox-item__progress > span\s*\{[^}]*width:\s*var\(--mailbox-progress\)/s)
  expect(STYLES).toMatch(
    /\.mailbox-item\s*\{[\s\S]*grid-template-columns:\s*calc\(28px \* var\(--ui-scale\)\) minmax\(0, 1fr\)/,
  )
  expect(STYLES).toMatch(/\.mailbox-panel__toolbar\s*\{[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*nowrap/)
  expect(STYLES).toMatch(
    /\.mailbox-panel__subtitle\s*\{[\s\S]*font-size:\s*var\(--ui-font-control\)[\s\S]*font-weight:\s*var\(--ui-font-weight-strong\)/,
  )
  expect(STYLES).toMatch(/\.mailbox-panel__inbox\s*\{[\s\S]*display:\s*inline-flex/)
  expect(STYLES).toMatch(
    /\.mailbox-panel__inbox-count\s*\{[\s\S]*font-size:\s*var\(--ui-font-control\)[\s\S]*font-variant-numeric:\s*tabular-nums/,
  )
  expect(STYLES).not.toMatch(/\.mailbox-panel__inbox-count\s*\{[^}]*padding:\s*0/)
  expect(STYLES).toMatch(/\.mailbox-panel__search-shell\s*\{[\s\S]*width:\s*100%/)
  expect(STYLES).not.toContain(".mailbox-panel__title-row")
  expect(STYLES).not.toContain(".mailbox-panel__controls")
  expect(STYLES).not.toContain(".mailbox-panel__views")
  expect(STYLES).toContain(".mailbox-panel__search-close")
  expect(STYLES).toMatch(/\.mailbox-panel__body\s*\{[\s\S]*padding:/)
  expect(STYLES).toMatch(/\.mailbox-item\s*\{[\s\S]*border-radius:\s*var\(--oc-radius-large\)/)
  expect(STYLES).toMatch(/\.mailbox-item__actions\s*\{[\s\S]*opacity:\s*var\(--ui-opacity-hidden\)/)
  expect(STYLES).toContain('.mailbox-item[data-unread="true"]')
  expect(STYLES).toContain('.mailbox-item[data-attention="true"]')
  expect(STYLES).toContain('.mailbox-item[data-selected="true"]')
  expect(STYLES).toMatch(
    /\.mailbox-item__select\s*\{[\s\S]*position:\s*absolute[\s\S]*opacity:\s*var\(--ui-opacity-hidden\)/,
  )
  expect(STYLES).toMatch(
    /mailbox-panel\[data-selection-active="true"\] \.mailbox-item__select,[\s\S]*pointer-events:\s*auto/,
  )
  expect(STYLES).toMatch(
    /mailbox-panel\[data-selection-active="true"\] \.mailbox-item__identity,[\s\S]*opacity:\s*var\(--ui-opacity-hidden\);[\s\S]*pointer-events:\s*none/,
  )
  expect(STYLES).toMatch(/\.mailbox-item__subject\s*\{[\s\S]*color:\s*var\(--text-muted\)/)
  expect(STYLES).toMatch(
    /mailbox-item\[data-unread="true"\] \.mailbox-item__subject\s*\{[\s\S]*color:\s*var\(--text-strong\)/,
  )
  expect(STYLES).toMatch(/\.mailbox-item__content\s*\{[\s\S]*grid-column:\s*2 \/ 3/)
  expect(STYLES).toMatch(/\.mailbox-item__body--expanded\s*\{[\s\S]*white-space:\s*pre-wrap/)
  expect(STYLES).toMatch(/\.mailbox-item__actions\s*\{[\s\S]*position:\s*absolute/)
  expect(STYLES).toMatch(/\.mailbox-item__actions\s*\{[\s\S]*pointer-events:\s*none/)
  expect(STYLES).toMatch(/mailbox-item:hover \.mailbox-item__actions,[\s\S]*pointer-events:\s*auto/)
  expect(STYLES).toContain(".mailbox-item:has(:focus-visible) .mailbox-item__actions")
  expect(STYLES).toContain(".mailbox-item:has(:focus-visible) .mailbox-item__select")
  expect(STYLES).toContain(".mailbox-item:has(:focus-visible) .mailbox-item__identity")
  expect(STYLES).not.toContain(".mailbox-item:focus-within .mailbox-item__actions")
  expect(STYLES).not.toContain(".mailbox-item:focus-within .mailbox-item__select")
  expect(STYLES).not.toContain(".mailbox-item:focus-within .mailbox-item__identity")
  expect(STYLES).toMatch(/\.mailbox-panel__body\s*\{[\s\S]*overflow-y:\s*scroll/)
  expect(STYLES).toMatch(/\.mailbox-panel__body\s*\{[\s\S]*scrollbar-gutter:\s*stable/)
  expect(STYLES).toMatch(/\.mailbox-panel__body\s*\{[\s\S]*scrollbar-color:\s*var\(--scrollbar-thumb\) transparent/)
  expect(STYLES).toMatch(/\.mailbox-project-group__header\s*\{[\s\S]*cursor:\s*pointer/)
  expect(STYLES).toMatch(/\.mailbox-project-group__content\s*\{[\s\S]*min-width:\s*0/)
  expect(STYLES).toMatch(/\.mailbox-panel__body::-webkit-scrollbar-track\s*\{\s*background:\s*transparent/)
  expect(STYLES).toContain(".mailbox-panel__body::-webkit-scrollbar-thumb")
  expect(PANEL).toContain("when={visibleItems().length > 0}")
  expect(PANEL).toContain("when={!loading() || items().length > 0}")
})

test("mailbox remains a desktop left-sidebar feature without unsolicited responsive variants", () => {
  expect(STYLES).not.toContain("@media")
  expect(STYLES).not.toContain("position: fixed")
  expect(STYLES).not.toContain("100vw")
})
