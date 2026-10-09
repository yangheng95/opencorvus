import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
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
  projectSubagentConversationCard,
  subagentConversationTargetKey,
  subagentConversationTranscriptRevision,
  type SubagentConversationTranscript,
  type SubagentConversationTarget,
} from "../services/subagent-conversation"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { formatErrorDetails } from "../services/diagnostics"
import { setupAutoScroll, type AutoScrollController } from "../utils/dom-utils"
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

type SubagentReadingPosition = { top: number; following: boolean }
const MAX_REMEMBERED_READING_POSITIONS = 32

function SubagentConversationScroll(props: {
  conversation: Accessor<SubagentConversationTranscript>
  active: Accessor<boolean>
  initialReadingPosition: SubagentReadingPosition | undefined
  saveReadingPosition: (position: SubagentReadingPosition) => void
  activity: Accessor<AgentActivityRecord | undefined>
}) {
  let scrollElement: HTMLDivElement | undefined
  let scrollController: AutoScrollController | undefined
  const [tracking, setTracking] = createSignal(props.initialReadingPosition?.following ?? true)
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
    if (props.active() && scrollElement && scrollElement.clientHeight > 0)
      props.saveReadingPosition({ top: scrollElement.scrollTop, following: tracking() })
  }
  const changeTracking = (value: boolean) => {
    setTracking(value)
    saveReadingPosition()
  }

  onMount(() => {
    if (!scrollElement) throw new Error("Sub-agent conversation scroll container is missing")
    const layoutRoot = scrollElement.closest<HTMLElement>(".right-dock")
    if (!layoutRoot) throw new Error("Sub-agent conversation requires its right dock layout owner")
    scrollController = setupAutoScroll(scrollElement, {
      initialPosition: props.initialReadingPosition && !props.initialReadingPosition.following
        ? { kind: "position", top: props.initialReadingPosition.top, layoutRoot }
        : { kind: "bottom" },
      isTracking: tracking,
      onUserScrollUp: () => changeTracking(false),
      onFollowRequested: () => changeTracking(true),
    })
  })

  createEffect(
    on(
      props.conversation,
      () => {
        scrollController?.contentChanged()
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    saveReadingPosition()
    scrollController?.cleanup()
    scrollController = undefined
  })

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
  const readingPositions = new Map<string, SubagentReadingPosition>()
  const saveReadingPosition = (targetKey: string, position: SubagentReadingPosition) => {
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
  createEffect(on(props.sessionID, () => setShowAgentList(false), { defer: true }))
  const selectAgent = (sessionID: string) => {
    props.onSessionSelect(sessionID)
    setShowAgentList(false)
  }
  const requestKey = createMemo(() => {
    if (!props.active()) return null
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
  let transcriptAbort: AbortController | undefined
  createEffect(() => {
    if (props.active()) return
    transcriptAbort?.abort()
  })
  const [conversation, { refetch }] = createResource<SubagentConversationTranscript, string>(
    requestKey,
    async (serialized, context) => {
      transcriptAbort?.abort()
      const controller = new AbortController()
      transcriptAbort = controller
      const target = JSON.parse(serialized) as SubagentConversationTarget
      try {
        const previous = context.value?.targetKey === serialized ? context.value : undefined
        const delta = await loadSubagentConversation({
          ...target,
          afterSequence: target.source.kind === "task" ? previous?.lastLiveSequence : undefined,
          afterLiveEpoch: target.source.kind === "task" ? previous?.liveEpoch : undefined,
          signal: controller.signal,
        })
        // Solid owns settlement of the original resource request. Retain its
        // actual value, but only the current source may merge prior cursors.
        if (!isApiAuthorityCurrent(target.authority) || transcriptAbort !== controller || requestKey() !== serialized)
          return delta
        return previous ? mergeSubagentConversation(previous, delta) : delta
      } finally {
        if (transcriptAbort === controller) transcriptAbort = undefined
      }
    },
  )
  const [liveProjection, setLiveProjection] = createSignal(createSubagentConversationLiveProjection(props.sessionID()))
  let pendingLiveProjection: ReturnType<typeof createSubagentConversationLiveProjection> | undefined
  const flushLiveProjection = createAnimationFrameScheduler(() => {
    if (!pendingLiveProjection) return
    setLiveProjection(pendingLiveProjection)
    pendingLiveProjection = undefined
  })
  createEffect(
    on(requestKey, (target) => {
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
      conversation(),
    )
    flushLiveProjection.schedule()
  })
  const displayedConversation = createMemo(() => {
    const target = requestKey()
    const base = conversation()
    if (!target || !base || base.targetKey !== target) return undefined
    return projectSubagentConversationLive(base, liveProjection())
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
      <Show
        when={showAgentList() || !selectedRecord()}
        fallback={
          <>
            <div class="subagent-conversation-panel__agent-selector">
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
            <div class="subagent-conversation-panel__selected-agent" data-ui="subagent-selected-agent">
              <Show
                when={requestKey()}
                fallback={
                  <div class="subagent-conversation-panel__empty">{t("subagent.conversation.no_selection")}</div>
                }
              >
                <Show
                  when={!conversation.error}
                  fallback={
                    <Feedback
                      tone="error"
                      title={t("subagent.conversation.load_failed")}
                      details={formatErrorDetails(conversation.error)}
                      actions={
                        <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => void refetch()}>
                          {t("common.retry")}
                        </Button>
                      }
                    >
                      {t("subagent.conversation.no_selection")}
                    </Feedback>
                  }
                >
                  <Show
                    when={displayedConversation()?.targetKey}
                    keyed
                    fallback={
                      <div class="subagent-conversation-panel__empty">{t("subagent.conversation.loading")}</div>
                    }
                  >
                    {(targetKey) => (
                      <SubagentConversationScroll
                        conversation={() => displayedConversation()!}
                        active={() => props.active() && !showAgentList() && requestKey() === targetKey}
                        initialReadingPosition={readingPositions.get(targetKey)}
                        saveReadingPosition={(position) => saveReadingPosition(targetKey, position)}
                        activity={selectedRecord}
                      />
                    )}
                  </Show>
                </Show>
              </Show>
            </div>
          </>
        }
      >
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
