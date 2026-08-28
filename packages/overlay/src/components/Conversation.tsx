import { ErrorBoundary, For, Show, createMemo, onMount, onCleanup, createSignal, createEffect, on } from "solid-js"
import { Portal } from "solid-js/web"
import { Virtualizer, type CustomContainerComponentProps, type VirtualizerHandle } from "virtua/solid"
import { cardTreeStore, publishedCardTreeVersion } from "../store/card-tree"
import { boardStore, activeTaskID } from "../store/board"
import { settingsStore } from "../store/settings"
import { conversationSessionStore } from "../store/conversation-session"
import { t } from "../utils/i18n"
import { topLevelCardIDForCard } from "../utils/card-tree"
import { setupAutoScroll, type AutoScrollController } from "../utils/dom-utils"
import { taskLifecycleStatusOrIdleLabel } from "../utils/status-labels"
import { StoreCardNode } from "./StoreCardNode"
import {
  canLoadOlderConversationHistory,
  loadOlderConversationHistory,
  selectedConversationHasVisibleItems,
} from "../services/conversation"
import { conversationAgentRecordsForSource, conversationAgentStore } from "../store/conversation-agents"
import { listenConversationCardScroll, type ConversationCardScrollRequest } from "../services/conversation-scroll"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { StatusIndicator } from "./ui/StatusIndicator"
import { projectDirectoryLabel } from "../utils/project-directory"
import { retrySelectedTaskSelection } from "../services/task"
import {
  buildSubagentConversationItems,
  isSubagentActivityRecord,
  subagentGridItemForSession,
  subagentProgressCardID,
  subagentSessionIDFromProgressCardID,
  type SubagentConversationItem,
} from "../utils/subagent-presentation"
import { SubagentProgressGrid } from "./SubagentProgressGrid"
import { ConversationCard } from "./ConversationCard"
import { ConversationArtifactSummary } from "./ConversationArtifactSummary"
import type { ComposerIntent } from "@opencorvus-ai/transport-protocol"

const ESTIMATED_CARD_HEIGHT = 320
const VIRTUAL_BUFFER_PIXELS = ESTIMATED_CARD_HEIGHT * 4
const CARD_SCROLL_TARGET_MAX_FRAMES = 12

function clipText(value: string, limit = 96): string {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`
}

function compactPath(value: string): string {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
  if (!normalized) return ""
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length <= 4) return normalized
  return `.../${parts.slice(-3).join("/")}`
}

function firstVisibleConversationAnchor(container: HTMLElement): { id: string; top: number } | null {
  const containerTop = container.getBoundingClientRect().top
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(".conversation-virtual-item > [data-card-id]"))
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom <= containerTop) continue
    const id = node.dataset.cardId || ""
    if (!id) continue
    return { id, top: rect.top }
  }
  return null
}

function restoreConversationAnchor(container: HTMLElement, anchor: { id: string; top: number } | null): void {
  if (!anchor) return
  const node = container.querySelector<HTMLElement>(
    `.conversation-virtual-item > [data-card-id="${CSS.escape(anchor.id)}"]`,
  )
  if (!node) return
  container.scrollTop += node.getBoundingClientRect().top - anchor.top
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function renderErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  return String(error || t("chat.render_error_unknown"))
}

function ConversationCardRenderFailure(props: { id: string; error: unknown }) {
  const title = () => t("chat.render_error_title")
  const message = () => clipText(renderErrorMessage(props.error), 180)
  return (
    <article
      class="card conversation-card-render-failure"
      data-card-id={props.id}
      data-kind="render-error"
      role="group"
      aria-label={title()}
    >
      <div class="card__head">
        <div class="card__title">{title()}</div>
        <div class="card__meta">{clipText(props.id, 64)}</div>
      </div>
      <div class="card__body">
        <div class="msg-tool-error">{message()}</div>
      </div>
    </article>
  )
}

function equalConversationItems(
  previous: readonly SubagentConversationItem[],
  next: readonly SubagentConversationItem[],
): boolean {
  if (previous.length !== next.length) return false
  return previous.every((previousItem, index) => {
    const nextItem = next[index]
    if (!nextItem || previousItem.id !== nextItem.id || previousItem.kind !== nextItem.kind) return false
    if (previousItem.kind === "card") {
      return nextItem.kind === "card" && previousItem.cardID === nextItem.cardID
    }
    return (
      nextItem.kind === "subagent-grid" &&
      previousItem.sessionIDs.length === nextItem.sessionIDs.length &&
      previousItem.sessionIDs.every((sessionID, sessionIndex) => sessionID === nextItem.sessionIDs[sessionIndex])
    )
  })
}

function VirtualizedConversationItem(props: {
  item: () => SubagentConversationItem
  onOpenSubagentConversation: (sessionID: string) => void
}) {
  const item = createMemo(props.item)
  const gridItem = createMemo(() => {
    const current = item()
    return current.kind === "subagent-grid" ? current : null
  })
  return (
    <div class="conversation-virtual-item" data-virtual-card-id={item().id}>
      <ErrorBoundary fallback={(error) => <ConversationCardRenderFailure id={item().id} error={error} />}>
        <Show
          when={gridItem()}
          fallback={
            <StoreCardNode id={(item() as Extract<SubagentConversationItem, { kind: "card" }>).cardID}>
              {(node) => <ConversationCard node={node} depth={0} collapsible={false} />}
            </StoreCardNode>
          }
        >
          {(grid) => (
            <div class="subagent-progress-grid-anchor" data-card-id={grid().id}>
              <SubagentProgressGrid sessionIDs={grid().sessionIDs} onOpen={props.onOpenSubagentConversation} />
            </div>
          )}
        </Show>
      </ErrorBoundary>
    </div>
  )
}

function VirtualizedConversationCards(props: {
  container: HTMLElement
  pinnedCardID: () => string | null
  tracking: () => boolean
  onMeasuredContentChanged: () => void
  onCardScrollRequest: () => void
  onOpenSubagentConversation: (sessionID: string) => void
}) {
  let virtualizer: VirtualizerHandle | undefined
  let rootEl: HTMLDivElement | undefined
  let virtualRootResizeObserver: ResizeObserver | undefined

  const records = createMemo(() => conversationAgentRecordsForSource(boardStore.selectedSource))
  const items = createMemo(
    on([publishedCardTreeVersion, records], () =>
      buildSubagentConversationItems({
        order: cardTreeStore.order,
        cards: cardTreeStore.cards,
        records: records(),
      }),
    ),
    [],
    { equals: equalConversationItems },
  )
  const order = createMemo(() => items().map((item) => item.id))
  const itemByID = createMemo(() => new Map(items().map((item) => [item.id, item])))
  function subagentSessionForCard(cardID: string): string | undefined {
    const direct = subagentSessionIDFromProgressCardID(cardID)
    if (direct) return direct
    const sessionID = String(cardTreeStore.cards[cardID]?.sessionID || "")
    if (!sessionID) return undefined
    return records().some((record) => record.sessionID === sessionID && isSubagentActivityRecord(record))
      ? sessionID
      : undefined
  }

  function scrollTarget(cardID: string): {
    itemID: string
    cardID: string
    sessionID?: string
    transcriptTarget: boolean
  } | null {
    const sessionID = subagentSessionForCard(cardID)
    if (sessionID) {
      const item = subagentGridItemForSession(items(), sessionID)
      if (!item) return null
      return {
        itemID: item.id,
        cardID: subagentProgressCardID(sessionID),
        sessionID,
        transcriptTarget: cardID !== subagentProgressCardID(sessionID),
      }
    }
    const topLevelID = topLevelCardIDForCard(cardID, cardTreeStore.order)
    if (!topLevelID || !itemByID().has(topLevelID)) return null
    return { itemID: topLevelID, cardID, transcriptTarget: false }
  }

  const pinnedIndexes = createMemo(() => {
    const pinID = props.pinnedCardID()
    if (!pinID) return []
    const ids = order()
    const target = scrollTarget(pinID)
    const pinnedIndex = target ? ids.indexOf(target.itemID) : -1
    return pinnedIndex >= 0 ? [pinnedIndex] : []
  })

  const scrollTargetElement = (cardID: string): HTMLElement | null => {
    const escaped = CSS.escape(cardID)
    return props.container.querySelector<HTMLElement>(`[data-card-id="${escaped}"]`)
  }

  const waitForScrollTargetElement = async (cardID: string): Promise<HTMLElement | null> => {
    for (let frame = 0; frame < CARD_SCROLL_TARGET_MAX_FRAMES; frame += 1) {
      const target = scrollTargetElement(cardID)
      if (target) return target
      await waitForAnimationFrame()
    }
    return scrollTargetElement(cardID)
  }

  function convergeMeasuredContent(): void {
    if (props.tracking()) {
      const lastIndex = order().length - 1
      if (lastIndex >= 0) {
        virtualizer?.scrollToIndex(lastIndex, { align: "end", smooth: false })
      }
    }
    props.onMeasuredContentChanged()
  }

  const measuredContentChangedOnFrame = createAnimationFrameScheduler(convergeMeasuredContent)

  const highlightCard = (cardID: string) => {
    const target = props.container.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardID)}"]`)
    if (!target) return
    target.classList.add("conversation-agent-target--pulse")
    window.setTimeout(() => target.classList.remove("conversation-agent-target--pulse"), 1400)
  }

  const scrollCardIntoView = async (request: ConversationCardScrollRequest): Promise<boolean> => {
    if (!virtualizer) return false
    const target = scrollTarget(request.cardID)
    if (!target) return false
    const index = order().indexOf(target.itemID)
    if (index < 0) return false
    if (target.transcriptTarget && target.sessionID) {
      props.onOpenSubagentConversation(target.sessionID)
    }
    props.onCardScrollRequest()
    virtualizer.scrollToIndex(index, {
      align: request.block ?? "start",
      smooth: false,
    })
    const element = await waitForScrollTargetElement(target.cardID)
    if (!element) return false
    element.scrollIntoView({
      block: request.block ?? "start",
      inline: "nearest",
      behavior: "auto",
    })
    if (request.highlight) highlightCard(target.cardID)
    return true
  }

  const VirtualWindowShell = (shellProps: CustomContainerComponentProps) => {
    let shellEl: HTMLDivElement | undefined
    const setRef = (node: HTMLDivElement) => {
      if (rootEl && rootEl !== node) virtualRootResizeObserver?.unobserve(rootEl)
      rootEl = shellEl = node
      virtualRootResizeObserver?.observe(node)
      if (typeof shellProps.ref === "function") shellProps.ref(node)
    }
    onCleanup(() => {
      if (!shellEl) return
      virtualRootResizeObserver?.unobserve(shellEl)
      if (rootEl === shellEl) rootEl = undefined
    })
    return (
      <div ref={setRef} class="conversation-virtual-window" data-count={order().length} style={shellProps.style}>
        {shellProps.children}
      </div>
    )
  }

  onMount(() => {
    const ro = new ResizeObserver(measuredContentChangedOnFrame.schedule)
    virtualRootResizeObserver = ro
    ro.observe(props.container)
    if (rootEl) ro.observe(rootEl)
    const stopCardScrollListener = listenConversationCardScroll(scrollCardIntoView)
    const onLayoutShiftSignal = () => {
      measuredContentChangedOnFrame.schedule()
    }
    props.container.addEventListener("click", onLayoutShiftSignal, { passive: true })
    props.container.addEventListener("transitionend", onLayoutShiftSignal, true)
    onCleanup(() => {
      props.container.removeEventListener("click", onLayoutShiftSignal)
      props.container.removeEventListener("transitionend", onLayoutShiftSignal, true)
      ro.disconnect()
      virtualRootResizeObserver = undefined
      measuredContentChangedOnFrame.cancel()
      stopCardScrollListener()
    })
  })

  const visibleTreeGeneration = () => (order().length > 0 ? cardTreeStore.treeEpoch : 0)
  const visibleTreeGenerations = () => {
    const generation = visibleTreeGeneration()
    return generation ? [generation] : []
  }

  return (
    <For each={visibleTreeGenerations()}>
      {() => {
        let ownedHandle: VirtualizerHandle | undefined
        onCleanup(() => {
          if (virtualizer === ownedHandle) virtualizer = undefined
        })
        return (
          <Virtualizer
            ref={(handle) => {
              if (handle) {
                ownedHandle = handle
                virtualizer = handle
                measuredContentChangedOnFrame.schedule()
                return
              }
              if (virtualizer === ownedHandle) virtualizer = undefined
            }}
            data={order()}
            scrollRef={props.container}
            bufferSize={VIRTUAL_BUFFER_PIXELS}
            itemSize={ESTIMATED_CARD_HEIGHT}
            keepMounted={pinnedIndexes()}
            as={VirtualWindowShell}
          >
            {(id) => {
              const currentItem = (): SubagentConversationItem => {
                const item = itemByID().get(id)
                if (!item) throw new Error(`conversation virtualizer missing projected item ${id}`)
                return item
              }
              return (
                <VirtualizedConversationItem
                  item={currentItem}
                  onOpenSubagentConversation={props.onOpenSubagentConversation}
                />
              )
            }}
          </Virtualizer>
        )
      }}
    </For>
  )
}

// ── Conversation Component ──
//
// Reads directly from `cardTreeStore`, the single reactive source of truth
// maintained by `services/tree-writer.ts`. Each top-level card id in
// `cardTreeStore.order` resolves to a CardNode via `cardTreeStore.cards[id]`;
// `<Card>` then walks the card's `childIDs` via the same proxy dereference,
// so targeted writes to any descendant update only that branch of the DOM.
// See specs/current/architecture/07-panel-reactivity.md for the design rationale.

export function Conversation(props: {
  container: HTMLElement
  homeActive: boolean
  launcherIntent: ComposerIntent
  onOpenSubagentConversation: (sessionID: string) => void
}) {
  const el = props.container
  let scrollController: AutoScrollController | undefined
  let historyLoadInFlight = false
  let historyIntentUntil = 0
  let touchStartY: number | null = null

  const hasItems = selectedConversationHasVisibleItems

  const [tracking, setTracking] = createSignal(true)
  const [historyAnchorPinID, setHistoryAnchorPinID] = createSignal<string | null>(null)
  const [scrollButtonMount, setScrollButtonMount] = createSignal<HTMLElement | null>(null)
  const [homePromptMount, setHomePromptMount] = createSignal<HTMLElement | null>(null)
  const [homeAfterMount, setHomeAfterMount] = createSignal<HTMLElement | null>(null)
  const isSessionSource = () => boardStore.selectedSource?.kind === "session"
  const sessionBoard = () => (isSessionSource() ? (boardStore.board as any) : null)
  const currentTaskID = () => (isSessionSource() ? "" : String(activeTaskID() || boardStore.board?.task?.id || ""))
  const taskContextItem = () => {
    if (isSessionSource()) return null
    const taskID = currentTaskID()
    const tasks = [...boardStore.tasks, ...boardStore.pendingTasks]
    if (taskID) {
      return tasks.find((item: any) => item?.task?.id === taskID || item?.id === taskID) || null
    }
    return null
  }
  const taskContextID = () => {
    const item = taskContextItem()
    return currentTaskID() || String(item?.task?.id || item?.id || "")
  }
  const selectedTaskItem = () => {
    const taskID = currentTaskID()
    if (!taskID) return null
    return (
      boardStore.tasks.find((item: any) => item?.task?.id === taskID) ||
      boardStore.pendingTasks.find((item: any) => item?.task?.id === taskID || item?.id === taskID) ||
      null
    )
  }
  const selectedBoardTask = () => boardStore.board?.task ?? null
  const selectedTaskTitle = () => {
    if (isSessionSource()) {
      return clipText(sessionBoard()?.title || boardStore.selectedSource?.id || "")
    }
    const item = selectedTaskItem() || taskContextItem()
    return clipText(item?.task?.title || item?.overview?.headline || selectedBoardTask()?.title || currentTaskID())
  }
  const selectedTaskStatus = () => {
    if (isSessionSource()) return String(sessionBoard()?.status || "")
    const item = selectedTaskItem() || taskContextItem()
    if (item?._pending) return "active"
    return String(item?.task?.status || selectedBoardTask()?.status || "")
  }
  const selectedTaskPresentationStatus = () => selectedTaskStatus().trim() || "idle"
  const selectedTaskDirectoryText = () => {
    if (isSessionSource()) return compactPath(sessionBoard()?.directory || "")
    const item = selectedTaskItem() || taskContextItem()
    return compactPath(item?.task?.directory || selectedBoardTask()?.directory || "")
  }
  const selectedTaskLoadError = () => {
    const failure = boardStore.taskSelectionError
    return failure?.taskID === currentTaskID() ? failure : null
  }
  const homeContentActive = () =>
    props.homeActive && !taskContextID() && !selectedTaskLoadError() && !hasItems()
  const retryTaskLoad = () => {
    void retrySelectedTaskSelection().catch(() => undefined)
  }
  const selectedSessionDirectory = () => {
    if (!isSessionSource()) return ""
    const sessionID = String(boardStore.selectedSource?.id || "")
    const session = conversationSessionStore.sessions.find((item) => item.id === sessionID)
    return String(sessionBoard()?.directory || session?.directory || "").trim()
  }
  const homeProjectDirectory = () => selectedSessionDirectory() || settingsStore.directory.trim()
  const homeProjectName = () => {
    const directory = homeProjectDirectory()
    return projectDirectoryLabel(directory, directory, t("work_ledger.implicit_project")).name
  }
  const homeSuggestions = createMemo(() => [
    {
      id: "webpage",
      icon: "web-search" as const,
      tone: "info" as const,
      label: t("chat.home_suggestion.webpage"),
      prompt: t("chat.home_suggestion.webpage_prompt"),
    },
    {
      id: "expert-squad",
      icon: "avatar-assistant" as const,
      tone: "accent" as const,
      label: t("chat.home_suggestion.expert_squad"),
      prompt: t("chat.home_suggestion.expert_squad_prompt"),
    },
    {
      id: "bug",
      icon: "bug" as const,
      tone: "good" as const,
      label: t("chat.home_suggestion.bug"),
      prompt: t("chat.home_suggestion.bug_prompt"),
    },
    {
      id: "long-range-orchestration",
      icon: "mission" as const,
      tone: "info" as const,
      label: t("chat.home_suggestion.long_range_orchestration"),
      prompt: t("chat.home_suggestion.long_range_orchestration_prompt"),
    },
    {
      id: "research",
      icon: "avatar-deep-research" as const,
      tone: "accent" as const,
      label: t("chat.home_suggestion.research"),
      prompt: t("chat.home_suggestion.research_prompt"),
    },
    {
      id: "presentation",
      icon: "presentation" as const,
      tone: "good" as const,
      label: t("chat.home_suggestion.presentation"),
      prompt: t("chat.home_suggestion.presentation_prompt"),
    },
  ])
  const fillHomeSuggestionPrompt = (value: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>("#solidChatComposer textarea")
    if (!textarea) return
    textarea.value = value
    textarea.dispatchEvent(new Event("input", { bubbles: true }))
    textarea.focus()
  }

  onMount(() => {
    const mount = el.parentElement
    if (!mount) throw new Error("Conversation requires chatScroll to be mounted inside conversation-scroll-shell")
    const promptMount = document.getElementById("solidChatHomePromptMount")
    const afterMount = document.getElementById("solidChatHomeAfterMount")
    const composerMount = document.getElementById("solidChatComposer")
    if (!promptMount || !afterMount || !composerMount) throw new Error("Conversation composition mounts are missing")
    const syncComposerClearance = () => {
      el.style.setProperty("--conversation-composer-block-size", `${composerMount.getBoundingClientRect().height}px`)
      scrollController?.contentChanged()
    }
    const composerClearanceOnFrame = createAnimationFrameScheduler(syncComposerClearance)
    setScrollButtonMount(composerMount)
    setHomePromptMount(promptMount)
    setHomeAfterMount(afterMount)
    const c = setupAutoScroll(el, {
      isTracking: tracking,
      onUserScrollUp: () => setTracking(false),
      onAtBottom: () => setTracking(true),
    })
    scrollController = c
    syncComposerClearance()
    const composerObserver = new ResizeObserver(composerClearanceOnFrame.schedule)
    composerObserver.observe(composerMount)
    // Conversation is rendered directly into an existing `.chat-scroll`
    // host owned by main.tsx. The host remains the
    // single scroll container while `virtua` owns only the virtualized
    // content window inside it.
    const markHistoryIntent = () => {
      historyIntentUntil = Date.now() + 700
    }
    const hasHistoryIntent = () => Date.now() <= historyIntentUntil
    const onHistoryWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) markHistoryIntent()
    }
    const keyboardLineStep = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight)
      return Number.isFinite(lineHeight) ? lineHeight * 3 : el.clientHeight * 0.1
    }
    const keyboardScrollActions: Record<string, () => void> = {
      ArrowUp: () => el.scrollBy({ top: -keyboardLineStep(), behavior: "smooth" }),
      ArrowDown: () => el.scrollBy({ top: keyboardLineStep(), behavior: "smooth" }),
      PageUp: () => el.scrollBy({ top: -el.clientHeight * 0.9, behavior: "smooth" }),
      PageDown: () => el.scrollBy({ top: el.clientHeight * 0.9, behavior: "smooth" }),
      Home: () => el.scrollTo({ top: 0, behavior: "smooth" }),
      End: () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }),
    }
    const onHistoryKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const scroll = keyboardScrollActions[event.key]
      if (!scroll) return
      event.preventDefault()
      if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") markHistoryIntent()
      scroll()
    }
    const onHistoryTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null
    }
    const onHistoryTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? null
      if (touchStartY !== null && y !== null && y > touchStartY + 8) {
        markHistoryIntent()
      }
    }
    const onHistoryScroll = () => {
      if (historyLoadInFlight || el.scrollTop > 96 || !hasHistoryIntent()) return
      const source = boardStore.selectedSource
      if (!canLoadOlderConversationHistory(source)) return
      historyIntentUntil = 0
      historyLoadInFlight = true
      const anchor = firstVisibleConversationAnchor(el)
      void loadOlderConversationHistory(source)
        .then((loaded) => {
          return new Promise<void>((resolve) => {
            if (loaded && anchor) setHistoryAnchorPinID(anchor.id)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (loaded) restoreConversationAnchor(el, anchor)
                setHistoryAnchorPinID(null)
                resolve()
              })
            })
          })
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          // loadOlderConversationHistory owns visible AppLog diagnostics.
        })
        .finally(() => {
          historyLoadInFlight = false
        })
    }
    el.addEventListener("wheel", onHistoryWheel, { passive: true })
    el.addEventListener("keydown", onHistoryKeyDown)
    el.addEventListener("touchstart", onHistoryTouchStart, { passive: true })
    el.addEventListener("touchmove", onHistoryTouchMove, { passive: true })
    el.addEventListener("scroll", onHistoryScroll, { passive: true })
    onCleanup(() => {
      el.removeEventListener("wheel", onHistoryWheel)
      el.removeEventListener("keydown", onHistoryKeyDown)
      el.removeEventListener("touchstart", onHistoryTouchStart)
      el.removeEventListener("touchmove", onHistoryTouchMove)
      el.removeEventListener("scroll", onHistoryScroll)
      composerObserver.disconnect()
      composerClearanceOnFrame.cancel()
      el.style.removeProperty("--conversation-composer-block-size")
      c.cleanup()
      scrollController = undefined
    })
  })

  createEffect(
    on(
      () => cardTreeStore.treeEpoch,
      () => {
        if (cardTreeStore.treeReplacementScrollIntent === "preserve") {
          scrollController?.contentChanged()
          return
        }
        setTracking(true)
        scrollController?.scrollToBottom()
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      publishedCardTreeVersion,
      () => {
        scrollController?.contentChanged()
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => conversationAgentStore.records.length,
      () => {
        scrollController?.contentChanged()
      },
      { defer: true },
    ),
  )

  const emptyText = () => t("chat.empty")
  const scrollBottomLabel = () => t("chat.scroll_bottom")
  const scrollToBottom = () => {
    setTracking(true)
    scrollController?.scrollToBottom()
  }

  return (
    <>
      <Show when={taskContextID() && selectedTaskLoadError()} keyed>
        {(failure) => (
          <div class="chat-empty chat-empty--task chat-empty--task-error" role="alert">
            <div class="chat-empty-marker" aria-hidden="true">
              <Icon name="status-failed" class="chat-empty-icon" size="display" />
            </div>
            <div class="chat-empty-copy">
              <span class="chat-empty-kicker">{t("chat.task_load_failed")}</span>
              <strong class="chat-empty-title">{clipText(failure.title || failure.taskID)}</strong>
              <p class="chat-empty-error-details">{clipText(failure.details, 240)}</p>
              <div class="chat-empty-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tone="danger"
                  onClick={retryTaskLoad}
                  disabled={boardStore.taskSwitching}
                >
                  {boardStore.taskSwitching ? t("common.retrying") : t("common.retry")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={!hasItems() && taskContextID() && !selectedTaskLoadError()}>
        <div class="chat-empty chat-empty--task" data-status={selectedTaskPresentationStatus()}>
          <div class="chat-empty-marker" aria-hidden="true">
            <Icon name="file-document" class="chat-empty-icon" size="display" />
          </div>
          <div class="chat-empty-copy">
            <span class="chat-empty-kicker">{emptyText()}</span>
            <strong class="chat-empty-title">{selectedTaskTitle()}</strong>
            <div class="chat-empty-meta">
              <span class="chat-empty-status">
                <StatusIndicator
                  status={selectedTaskPresentationStatus()}
                  label={taskLifecycleStatusOrIdleLabel(selectedTaskStatus())}
                  aria-hidden="true"
                />
                <span>{taskLifecycleStatusOrIdleLabel(selectedTaskStatus())}</span>
              </span>
              <Show when={selectedTaskDirectoryText()}>
                <span class="chat-empty-path">{selectedTaskDirectoryText()}</span>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      <Show when={homeContentActive() ? homePromptMount() : null} keyed>
        {(mount) => (
          <Portal mount={mount}>
            <div class="chat-home-prompt">
              <h1 class="chat-home-prompt__title">
                {homeProjectDirectory()
                  ? t("chat.home_prompt", { project: homeProjectName() })
                  : t("chat.home_prompt_global")}
              </h1>
            </div>
          </Portal>
        )}
      </Show>
      <Show when={homeContentActive() ? homeAfterMount() : null} keyed>
        {(mount) => (
          <Portal mount={mount}>
            <div class="chat-home-after" aria-label={t("chat.home_suggestions_label")}>
              <Show when={props.launcherIntent.conversationTarget === "mission"}>
                <div class="chat-home-notice">
                  <Icon name="info-circle" size="large" />
                  <div class="chat-home-notice-copy">
                    <strong>{t("expert_squad.launcher.home_notice_title")}</strong>
                    <span>
                      {homeProjectDirectory()
                        ? t("expert_squad.launcher.home_notice_body", { project: homeProjectName() })
                        : t("expert_squad.launcher.home_notice_body_global")}
                    </span>
                  </div>
                </div>
              </Show>
              <div class="chat-home-suggestions">
                <For each={homeSuggestions()}>
                  {(item) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="chat-home-suggestion oc-action-tile"
                      data-suggestion-example={item.id}
                      data-suggestion-tone={item.tone}
                      onClick={() => fillHomeSuggestionPrompt(item.prompt)}
                    >
                      <Icon name={item.icon} size="medium" />
                      <span>{item.label}</span>
                    </Button>
                  )}
                </For>
              </div>
            </div>
          </Portal>
        )}
      </Show>
      <VirtualizedConversationCards
        container={el}
        pinnedCardID={historyAnchorPinID}
        tracking={tracking}
        onMeasuredContentChanged={() => {
          if (tracking()) {
            scrollController?.scrollToBottom()
            return
          }
          scrollController?.contentChanged()
        }}
        onCardScrollRequest={() => setTracking(false)}
        onOpenSubagentConversation={props.onOpenSubagentConversation}
      />
      <ConversationArtifactSummary onContentChanged={() => scrollController?.contentChanged()} />
      <Show when={scrollButtonMount()} keyed>
        {(mount) => (
          <Portal mount={mount}>
            <Show when={hasItems() && !tracking()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                class="conversation-scroll-bottom"
                data-ui="conversation-scroll-bottom"
                title={scrollBottomLabel()}
                aria-label={scrollBottomLabel()}
                onClick={scrollToBottom}
              >
                <Icon name="chevron-down" size="medium" />
              </Button>
            </Show>
          </Portal>
        )}
      </Show>
    </>
  )
}
