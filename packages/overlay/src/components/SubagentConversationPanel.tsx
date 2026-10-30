import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js"
import { boardStore } from "../store/board"
import { conversationAgentRecordsForSource } from "../store/conversation-agents"
import {
  createSubagentConversationLiveProjection,
  createSubagentTranscriptRefreshController,
  listenSubagentConversationUpdates,
  loadSubagentConversation,
  mergeSubagentConversation,
  observeSubagentConversationLiveEvent,
  projectSubagentConversationLive,
  reconcileSubagentConversationLive,
  projectSubagentConversationCard,
  subagentConversationTargetKey,
  subagentConversationTranscriptRevision,
  type SubagentConversationTranscript,
  type SubagentConversationTarget,
} from "../services/subagent-conversation"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { formatErrorDetails } from "../services/diagnostics"
import { setupAutoScroll, type AutoScrollController } from "../utils/dom-utils"
import { listenConversationCardScroll, type ConversationCardScrollRequest } from "../services/conversation-scroll"
import { captureConversationReadingAnchor, resolveConversationReadingTop } from "../utils/conversation-reading-anchor"
import type { ConversationReadingPosition } from "../store/conversation-ui"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { t } from "../utils/i18n"
import {
  isSubagentActivityRecord,
  subagentSessionRecords,
  subagentSessionIdentity,
  type SubagentSessionIdentity as AgentOption,
} from "../utils/subagent-presentation"
import { isAgentActivityTerminalStatus, type AgentActivityRecord } from "../utils/agent-activity"
import { ConversationCard } from "./ConversationCard"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { StatusIndicator } from "./ui/StatusIndicator"
import { SelectControl } from "./ui/SelectControl"
import { Feedback } from "./ui/Feedback"
import { SubagentSessionIdentity } from "./SubagentSessionIdentity"

function selectedConversationDirectory(): string {
  const source = boardStore.selectedSource
  if (!source) return ""
  if (source.kind === "task") {
    const task = boardStore.board?.task
    if (task?.id !== source.id) return ""
    return String(task.directory || "").trim()
  }
  const board = boardStore.board
  if (board?.kind !== "session" || board.sessionID !== source.id) return ""
  return String(board.directory || "").trim()
}

const MAX_REMEMBERED_READING_POSITIONS = 32

function SubagentConversationScroll(props: {
  conversation: Accessor<SubagentConversationTranscript>
  active: Accessor<boolean>
  readingPosition: Accessor<ConversationReadingPosition | undefined>
  saveReadingPosition: (position: ConversationReadingPosition) => void
  activity: Accessor<AgentActivityRecord | undefined>
  registerNavigation: (navigate: ((request: ConversationCardScrollRequest) => Promise<boolean>) | undefined) => void
}) {
  let scrollElement: HTMLDivElement | undefined
  let scrollController: AutoScrollController | undefined
  let restoringPosition = false
  const [tracking, setTracking] = createSignal(props.readingPosition()?.following ?? true)
  const card = createMemo(() => {
    const activity = props.activity()
    const conversation = props.conversation()
    if (!activity || activity.sessionID !== conversation.sessionID) return null
    const projected = projectSubagentConversationCard(conversation, activity.status)
    if (!projected) return null
    return {
      ...projected,
      time: activity.startedAt,
      timeCompleted: isAgentActivityTerminalStatus(activity.status) ? activity.completedAt : undefined,
    }
  })
  const saveReadingPosition = () => {
    if (!scrollController?.canCaptureReading()) return
    // Hiding the pane can clamp its geometry before Solid retires this owner.
    // The last visible observation remains the reader's intended position.
    if (scrollController?.hasViewportResize() && !scrollController.hasScrollInput()) return
    if (props.active() && !restoringPosition && scrollController && scrollElement && scrollElement.clientHeight > 0)
      props.saveReadingPosition({
        ...scrollController.readingPosition(),
        anchor: captureConversationReadingAnchor(scrollElement, props.readingPosition()?.anchor),
      })
  }
  const changeTracking = (value: boolean) => {
    setTracking(value)
    saveReadingPosition()
  }

  const [navigationRevision, setNavigationRevision] = createSignal(0)
  let requestedNavigation: { request: ConversationCardScrollRequest; resolve: (found: boolean) => void } | undefined

  props.registerNavigation((request) => {
    if (!props.active() || !scrollElement || !request.messageID || props.conversation().sessionID !== request.sessionID) return Promise.resolve(false)
    const element = scrollElement.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(request.messageID)}"]`)
    if (!element || element.getBoundingClientRect().height <= 0) return Promise.resolve(false)
    requestedNavigation?.resolve(false)
    return new Promise<boolean>((resolve) => {
      requestedNavigation = { request, resolve }
      setNavigationRevision(value => value + 1)
    })
  })
  onCleanup(() => props.registerNavigation(undefined))

  createEffect(
    on(() => [props.active(), navigationRevision()] as const, ([active]) => {
      if (!active) return
      if (!scrollElement) throw new Error("Sub-agent conversation scroll container is missing")
      const layoutRoot = scrollElement.closest<HTMLElement>(".right-dock")
      if (!layoutRoot) throw new Error("Sub-agent conversation requires its right dock layout owner")
      const navigation = requestedNavigation
      requestedNavigation = undefined
      const messageElement = () => navigation && scrollElement?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(navigation.request.messageID!)}"]`)
      const messageTop = () => {
        const element = messageElement()
        return element && scrollElement && element.getBoundingClientRect().height > 0
          ? Math.max(0, scrollElement.scrollTop + element.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top - 16)
          : null
      }
      const position = navigation ? { top: messageTop() ?? 0, following: false } : props.readingPosition()
      restoringPosition = Boolean(position && !position.following)
      setTracking(position?.following ?? true)
      const restorePosition = (position: ConversationReadingPosition) => {
        restoringPosition = true
        return {
          kind: "position" as const,
          top: position.top,
          layoutRoot,
          resolveTop: navigation ? messageTop : position.anchor ? () => resolveConversationReadingTop(scrollElement!, position.anchor!) : undefined,
          onRestoreSettled: (restored: boolean) => {
            restoringPosition = false
            saveReadingPosition()
            if (navigation) {
              const element = messageElement()
              if (restored && element && navigation.request.highlight) {
                element.classList.add("conversation-agent-target--pulse")
                window.setTimeout(() => element.classList.remove("conversation-agent-target--pulse"), 1400)
              }
              navigation.resolve(restored && !!element && props.active())
            }
          },
        }
      }
      scrollController = setupAutoScroll(scrollElement, {
        initialPosition: position && !position.following ? restorePosition(position) : { kind: "bottom" },
        onViewportResize: () => {
          const position = props.readingPosition()
          return position && !position.following ? restorePosition(position) : undefined
        },
        isTracking: tracking,
        onUserScrollUp: () => changeTracking(false),
        onFollowRequested: () => changeTracking(true),
        onPositionRestored: saveReadingPosition,
      })
      onCleanup(() => {
        scrollController?.cleanup()
        scrollController = undefined
      })
    }),
  )

  createEffect(
    on(
      props.conversation,
      () => {
        scrollController?.contentChanged()
      },
      { defer: true },
    ),
  )

  onCleanup(saveReadingPosition)

  return (
    <div
      ref={scrollElement}
      class="subagent-conversation-panel__scroll"
      data-ui="subagent-conversation-scroll"
      onScroll={saveReadingPosition}
    >
      <Show
        when={card()}
        fallback={<div class="subagent-conversation-panel__empty">{t("subagent.conversation.empty")}</div>}
      >
        {(node) => <ConversationCard node={node()} depth={0} collapsible={false} />}
      </Show>
    </div>
  )
}

export function SubagentConversationPanel(props: {
  active: Accessor<boolean>
  sessionID: Accessor<string>
  onSessionSelect: (sessionID: string) => void
}) {
  const readingPositions = new Map<string, ConversationReadingPosition>()
  const saveReadingPosition = (targetKey: string, position: ConversationReadingPosition) => {
    readingPositions.delete(targetKey)
    readingPositions.set(targetKey, position)
    if (readingPositions.size > MAX_REMEMBERED_READING_POSITIONS)
      readingPositions.delete(readingPositions.keys().next().value!)
  }
  const records = createMemo(() =>
    conversationAgentRecordsForSource(boardStore.selectedSource).filter(isSubagentActivityRecord),
  )
  // One entry per Session, newest occurrence. Scanning the raw list instead would
  // repeat a Session that ran more than once and would answer a lookup with its
  // oldest occurrence, carrying that occurrence's stale status and target.
  const sessionRecords = createMemo(() => subagentSessionRecords(records()))
  const agentOptions = createMemo<AgentOption[]>(
    () => sessionRecords().map((record) => subagentSessionIdentity(record, sessionRecords())),
    undefined,
    {
      equals: (previous, next) =>
        previous.length === next.length &&
        previous.every(
          (option, index) => option.sessionID === next[index]?.sessionID && option.label === next[index]?.label,
        ),
    },
  )
  const selectedOption = createMemo(
    () => agentOptions().find((option) => option.sessionID === props.sessionID().trim()) ?? null,
  )
  const recordForSession = (sessionID: string) =>
    sessionRecords().find((candidate) => candidate.sessionID === sessionID)
  const selectedRecord = createMemo(() => {
    const sessionID = props.sessionID().trim()
    if (!sessionID) return undefined
    return recordForSession(sessionID)
  })
  const [showAgentList, setShowAgentList] = createSignal(false)
  const showingList = createMemo(() => showAgentList() || !selectedRecord())
  const readingActive = () => props.active() && !showingList()
  createEffect(on(props.sessionID, () => setShowAgentList(false), { defer: true }))
  const selectAgent = (sessionID: string) => {
    props.onSessionSelect(sessionID)
    setShowAgentList(false)
  }
  let panelElement: HTMLElement | undefined
  let backButton: HTMLButtonElement | undefined
  let navigationFocusOrigin: HTMLButtonElement | undefined
  const navigationFocus = createAnimationFrameScheduler(() => {
    const origin = navigationFocusOrigin
    navigationFocusOrigin = undefined
    if (!props.active() || !panelElement?.isConnected || !panelElement.getClientRects().length) return
    if (document.activeElement !== origin && document.activeElement !== document.body) return
    const target = showingList()
      ? panelElement.querySelector<HTMLButtonElement>(".subagent-conversation-panel__agent-row[data-active='true']")
      : backButton
    if (target && !target.disabled && !target.closest("[hidden], [inert]") && target.getClientRects().length)
      target.focus({ preventScroll: true })
  })
  const focusAfterNavigation = (origin: HTMLButtonElement) => {
    navigationFocusOrigin = origin
    navigationFocus.schedule()
  }
  const targetKey = createMemo(() => {
    const source = boardStore.selectedSource
    const sessionID = props.sessionID().trim()
    const directory = selectedConversationDirectory()
    if (!source || !sessionID || !directory) return null
    const record = selectedRecord()
    if (!record) return null
    return subagentConversationTargetKey({
      authority: captureApiAuthority(),
      source: { ...source },
      sessionID,
      directory,
    })
  })
  const requestKey = createMemo(() => (readingActive() ? targetKey() : null))
  let transcriptAbort: AbortController | undefined
  createEffect(() => {
    if (requestKey()) return
    transcriptAbort?.abort()
  })
  const [liveProjection, setLiveProjection] = createSignal(createSubagentConversationLiveProjection(props.sessionID()))
  let pendingLiveProjection: ReturnType<typeof createSubagentConversationLiveProjection> | undefined
  const flushLiveProjection = createAnimationFrameScheduler(() => {
    if (!pendingLiveProjection) return
    setLiveProjection(pendingLiveProjection)
    pendingLiveProjection = undefined
  })
  type ConversationRead = {
    transcript: SubagentConversationTranscript
    received: SubagentConversationTranscript
    observedLive: ReturnType<typeof createSubagentConversationLiveProjection>
  }
  // Share the resource's own storage with presentation. Its accessor throws on
  // failed refreshes, while the last accepted value is still valid for this target.
  const conversationStorage = createSignal<ConversationRead>()
  const [conversation, { refetch }] = createResource<ConversationRead, string>(
    requestKey,
    async (serialized, context) => {
      transcriptAbort?.abort()
      const controller = new AbortController()
      transcriptAbort = controller
      const target = JSON.parse(serialized) as SubagentConversationTarget
      const observedLive = untrack(() => pendingLiveProjection ?? liveProjection())
      try {
        const previous = context.value?.transcript.targetKey === serialized ? context.value.transcript : undefined
        const delta = await loadSubagentConversation({
          ...target,
          afterSequence: target.source.kind === "task" ? previous?.lastLiveSequence : undefined,
          afterLiveEpoch: target.source.kind === "task" ? previous?.liveEpoch : undefined,
          signal: controller.signal,
        })
        // Solid owns settlement of the original resource request. Retain its
        // actual value, but only the current source may merge prior cursors.
        if (!isApiAuthorityCurrent(target.authority) || transcriptAbort !== controller || requestKey() !== serialized)
          return { transcript: delta, received: delta, observedLive }
        return {
          transcript: previous ? mergeSubagentConversation(previous, delta) : delta,
          received: delta,
          observedLive,
        }
      } finally {
        if (transcriptAbort === controller) transcriptAbort = undefined
      }
    },
    { storage: () => conversationStorage },
  )
  createEffect(
    on(targetKey, (target) => {
      flushLiveProjection.cancel()
      pendingLiveProjection = undefined
      const sessionID = target ? (JSON.parse(target) as { sessionID: string }).sessionID : ""
      setLiveProjection(createSubagentConversationLiveProjection(sessionID))
    }),
  )
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())
  const stopConversationUpdates = listenSubagentConversationUpdates((update) => {
    const target = requestKey()
    if (!target) return
    if (update.kind === "snapshot") {
      const source = boardStore.selectedSource
      if (source?.kind === update.source.kind && source.id === update.source.id)
        transcriptRefresh.invalidate(target, !conversation.loading)
      return
    }
    pendingLiveProjection = observeSubagentConversationLiveEvent(pendingLiveProjection ?? liveProjection(), update.event)
    flushLiveProjection.schedule()
  })
  const displayedConversation = createMemo(() => {
    const target = targetKey()
    const read = conversationStorage[0]()
    if (!target || !read || read.transcript.targetKey !== target) return undefined
    const flushedLive = liveProjection()
    return projectSubagentConversationLive(
      read.transcript,
      reconcileSubagentConversationLive(read.received, read.observedLive, pendingLiveProjection ?? flushedLive),
    )
  })
  let navigateMessage: ((request: ConversationCardScrollRequest) => Promise<boolean>) | undefined
  const [navigation, setNavigation] = createSignal<{
    request: ConversationCardScrollRequest; target: string; resolve: (found: boolean) => void
    landing?: Promise<boolean>
  }>()
  const finishNavigation = (found: boolean) => {
    const pending = navigation()
    setNavigation(undefined)
    pending?.resolve(found)
  }
  const navigationOnFrame = createAnimationFrameScheduler(() => {
    const pending = navigation()
    if (!pending || pending.landing) return
    if (requestKey() !== pending.target || !navigateMessage) { finishNavigation(false); return }
    pending.landing = navigateMessage(pending.request)
    void pending.landing.then(found => {
      if (navigation() === pending) finishNavigation(found && requestKey() === pending.target)
    }, () => {
      if (navigation() === pending) finishNavigation(false)
    })
  })
  const stopMessageNavigation = listenConversationCardScroll((request) => {
    const target = requestKey()
    if (!target || !request.messageID || request.sessionID !== props.sessionID()) return false
    finishNavigation(false)
    return new Promise<boolean>((resolve) => setNavigation({ request, target, resolve }))
  }, "subagent")
  createEffect(() => {
    const pending = navigation()
    if (!pending) return
    if (requestKey() !== pending.target) { finishNavigation(false); return }
    if (conversation.loading) return
    const transcript = displayedConversation()
    if (conversation.error || !transcript?.messages.some(message => message.messageID === pending.request.messageID)) {
      finishNavigation(false)
      return
    }
    navigationOnFrame.schedule()
  })
  onCleanup(() => {
    stopMessageNavigation()
    navigationOnFrame.cancel()
    finishNavigation(false)
  })
  createEffect(() => {
    const read = conversationStorage[0]()
    if (!read || read.transcript.targetKey !== targetKey()) return
    const current = untrack(() => pendingLiveProjection ?? liveProjection())
    const next = reconcileSubagentConversationLive(read.received, read.observedLive, current)
    if (next === current) return
    // The display already uses this same completed read and reconciliation;
    // clearing the queue cannot briefly expose the previous HTTP base.
    flushLiveProjection.cancel()
    pendingLiveProjection = undefined
    setLiveProjection(next)
  })
  createEffect(() => {
    const target = requestKey() ?? ""
    const record = selectedRecord()
    transcriptRefresh.observe(
      target,
      record ? subagentConversationTranscriptRevision(record) : "",
      !conversation.loading,
    )
  })
  onCleanup(() => {
    navigationFocus.cancel()
    readingPositions.clear()
    stopConversationUpdates()
    flushLiveProjection.cancel()
    transcriptRefresh.dispose()
    transcriptAbort?.abort()
  })

  return (
    <section ref={panelElement} class="subagent-conversation-panel" data-session-id={props.sessionID()}>
      <div class="subagent-conversation-panel__agent-selector" hidden={showingList()}>
        <Button
          ref={backButton}
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          onClick={(event) => {
            const origin = event.currentTarget
            setShowAgentList(true)
            focusAfterNavigation(origin)
          }}
        >
          <Icon name="nav-back" size="compact" />
          {t("subagent.conversation.all_agents", { count: sessionRecords().length })}
        </Button>
        <SelectControl
          options={agentOptions()}
          value={selectedOption()}
          optionValue="sessionID"
          optionTextValue="label"
          ariaLabel={t("right_dock.tool.subagent")}
          triggerTitle={selectedOption()?.sessionID}
          class="subagent-conversation-panel__select"
          onChange={(record) => {
            if (record) selectAgent(record.sessionID)
          }}
          renderValue={(record) => (record ? <SubagentSessionIdentity identity={record} /> : "")}
          renderOptionLabel={(record) => <SubagentSessionIdentity identity={record} />}
          renderOptionDescription={(option) =>
            t(`agent_rail.status.${recordForSession(option.sessionID)?.status ?? "pending"}`)
          }
        />
      </div>
      <div class="subagent-conversation-panel__selected-agent" data-ui="subagent-selected-agent" hidden={showingList()}>
        <Show
          when={targetKey()}
          fallback={<div class="subagent-conversation-panel__empty">{t("subagent.conversation.no_selection")}</div>}
        >
          <Show when={conversation.state === "errored"}>
            <Feedback
              class="subagent-conversation-panel__feedback"
              tone="error"
              title={t("subagent.conversation.load_failed")}
              details={
                <div
                  class="subagent-conversation-panel__error-details"
                  role="region"
                  aria-label={t("subagent.conversation.error_details")}
                  tabIndex={0}
                >
                  {formatErrorDetails(conversation.error)}
                </div>
              }
              actions={
                <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => void refetch()}>
                  {t("common.retry")}
                </Button>
              }
            >
              {t(displayedConversation() ? "subagent.conversation.refresh_hint" : "subagent.conversation.retry_hint")}
            </Feedback>
          </Show>
          <Show
            when={displayedConversation()?.targetKey}
            keyed
            fallback={
              <Show when={conversation.loading}>
                <div class="subagent-conversation-panel__empty">{t("subagent.conversation.loading")}</div>
              </Show>
            }
          >
            {(target) => (
              <SubagentConversationScroll
                conversation={() => displayedConversation()!}
                active={() => readingActive() && requestKey() === target}
                readingPosition={() => readingPositions.get(target)}
                saveReadingPosition={(position) => saveReadingPosition(target, position)}
                activity={selectedRecord}
                registerNavigation={(navigate) => { navigateMessage = navigate }}
              />
            )}
          </Show>
        </Show>
      </div>
      <Show when={showingList()}>
        <div class="subagent-conversation-panel__list" aria-label={t("right_dock.tool.subagent")}>
          <div class="subagent-conversation-panel__list-heading">
            {t("subagent.conversation.all_agents", { count: sessionRecords().length })}
          </div>
          <For each={sessionRecords().map((record) => record.sessionID)}>
            {(sessionID) => {
              const candidate = () => recordForSession(sessionID)!
              const identity = () => agentOptions().find((option) => option.sessionID === sessionID)!
              return (
                <Button
                  type="button"
                  variant="ghost"
                  size="control"
                  tone="neutral"
                  class="oc-navigation-row subagent-conversation-panel__agent-row"
                  data-active={String(sessionID === props.sessionID())}
                  onClick={(event) => {
                    const origin = event.currentTarget
                    selectAgent(sessionID)
                    focusAfterNavigation(origin)
                  }}
                >
                  <StatusIndicator
                    status={candidate().status}
                    label={t(`agent_rail.status.${candidate().status}`)}
                    aria-hidden="true"
                  />
                  <span class="subagent-conversation-panel__agent-name">
                    <SubagentSessionIdentity identity={identity()} />
                  </span>
                  <span class="subagent-conversation-panel__agent-status">
                    {t(`agent_rail.status.${candidate().status}`)}
                  </span>
                </Button>
              )
            }}
          </For>
          <Show when={sessionRecords().length === 0}>
            <p>{t("subagent.conversation.no_selection")}</p>
          </Show>
        </div>
      </Show>
    </section>
  )
}
