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
  listenSubagentConversationLiveEvents,
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
import { captureConversationReadingAnchor, resolveConversationReadingTop } from "../utils/conversation-reading-anchor"
import type { ConversationReadingPosition } from "../store/conversation-ui"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { t } from "../utils/i18n"
import { isSubagentActivityRecord, subagentSessionRecords } from "../utils/subagent-presentation"
import { isAgentActivityTerminalStatus, type AgentActivityRecord } from "../utils/agent-activity"
import { ConversationCard } from "./ConversationCard"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { StatusIndicator } from "./ui/StatusIndicator"
import { SelectControl } from "./ui/SelectControl"
import { Feedback } from "./ui/Feedback"

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
    // Hiding the pane can clamp its geometry before Solid retires this owner.
    // The last visible observation remains the reader's intended position.
    if (props.active() && !restoringPosition && scrollController && scrollElement && scrollElement.clientHeight > 0)
      props.saveReadingPosition({ ...scrollController.readingPosition(), anchor: captureConversationReadingAnchor(scrollElement) })
  }
  const changeTracking = (value: boolean) => {
    setTracking(value)
    saveReadingPosition()
  }

  createEffect(on(props.active, (active) => {
    if (!active) return
    if (!scrollElement) throw new Error("Sub-agent conversation scroll container is missing")
    const layoutRoot = scrollElement.closest<HTMLElement>(".right-dock")
    if (!layoutRoot) throw new Error("Sub-agent conversation requires its right dock layout owner")
    const position = props.readingPosition()
    restoringPosition = Boolean(position && !position.following)
    setTracking(position?.following ?? true)
    scrollController = setupAutoScroll(scrollElement, {
      initialPosition: position && !position.following
        ? {
            kind: "position", top: position.top, layoutRoot,
            resolveTop: position.anchor ? () => resolveConversationReadingTop(scrollElement!, position.anchor!) : undefined,
            onRestoreSettled: () => {
              restoringPosition = false
              saveReadingPosition()
            },
          }
        : { kind: "bottom" },
      isTracking: tracking,
      onUserScrollUp: () => changeTracking(false),
      onFollowRequested: () => changeTracking(true),
    })
    onCleanup(() => {
      scrollController?.cleanup()
      scrollController = undefined
    })
  }))

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
    <div ref={scrollElement} class="subagent-conversation-panel__scroll" data-ui="subagent-conversation-scroll" onScroll={saveReadingPosition}>
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
  type AgentOption = { sessionID: string; agentID: string }
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
    () => sessionRecords().map(({ sessionID, agentID }) => ({ sessionID, agentID })),
    undefined,
    {
      equals: (previous, next) =>
        previous.length === next.length &&
        previous.every(
          (option, index) => option.sessionID === next[index]?.sessionID && option.agentID === next[index]?.agentID,
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
  const requestKey = createMemo(() => readingActive() ? targetKey() : null)
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
        return { transcript: previous ? mergeSubagentConversation(previous, delta) : delta, received: delta, observedLive }
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
  const stopLiveProjection = listenSubagentConversationLiveEvents((event) => {
    if (!requestKey()) return
    pendingLiveProjection = observeSubagentConversationLiveEvent(
      pendingLiveProjection ?? liveProjection(),
      event,
    )
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
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())
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
    readingPositions.clear()
    stopLiveProjection()
    flushLiveProjection.cancel()
    transcriptRefresh.dispose()
    transcriptAbort?.abort()
  })

  return (
    <section class="subagent-conversation-panel" data-session-id={props.sessionID()}>
      <div class="subagent-conversation-panel__agent-selector" hidden={showingList()}>
        <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => setShowAgentList(true)}>
          <Icon name="nav-back" size="compact" />
          {t("subagent.conversation.all_agents", { count: sessionRecords().length })}
        </Button>
        <SelectControl
          options={agentOptions()}
          value={selectedOption()}
          optionValue="sessionID"
          optionTextValue="agentID"
          ariaLabel={t("right_dock.tool.subagent")}
          triggerTitle={selectedOption()?.agentID}
          class="subagent-conversation-panel__select"
          onChange={(record) => {
            if (record) selectAgent(record.sessionID)
          }}
          renderValue={(record) => record?.agentID ?? ""}
          renderOptionLabel={(record) => record.agentID}
          renderOptionDescription={(option) =>
            t(`agent_rail.status.${recordForSession(option.sessionID)?.status ?? "pending"}`)
          }
        />
      </div>
      <div class="subagent-conversation-panel__selected-agent" data-ui="subagent-selected-agent" hidden={showingList()}>
        <Show
          when={targetKey()}
          fallback={
            <div class="subagent-conversation-panel__empty">{t("subagent.conversation.no_selection")}</div>
          }
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
              {t(displayedConversation()
                ? "subagent.conversation.refresh_hint"
                : "subagent.conversation.retry_hint")}
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
              return (
                <Button
                  type="button"
                  variant="ghost"
                  size="control"
                  tone="neutral"
                  class="oc-navigation-row subagent-conversation-panel__agent-row"
                  data-active={String(sessionID === props.sessionID())}
                  onClick={() => selectAgent(sessionID)}
                >
                  <StatusIndicator
                    status={candidate().status}
                    label={t(`agent_rail.status.${candidate().status}`)}
                    aria-hidden="true"
                  />
                  <span class="subagent-conversation-panel__agent-name">{candidate().agentID}</span>
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
