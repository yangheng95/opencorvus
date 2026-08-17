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
import { boardStore, type BoardSource } from "../store/board"
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
} from "../services/subagent-conversation"
import { formatErrorDetails } from "../services/diagnostics"
import { setupAutoScroll, type AutoScrollController } from "../utils/dom-utils"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { t } from "../utils/i18n"
import { isSubagentActivityRecord } from "../utils/subagent-presentation"
import { Avatar } from "./Avatar"
import { ConversationCard } from "./ConversationCard"
import { Button } from "./ui/Button"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Icon } from "./ui/Icon"
import { StatusIndicator } from "./ui/StatusIndicator"
import { Tab, TabList, TabPanel, Tabs } from "./ui/Tabs"

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

function SubagentConversationScroll(props: {
  conversation: Accessor<SubagentConversationTranscript>
  sessionID: Accessor<string>
  status: Accessor<"pending" | "running" | "idle" | "completed" | "error" | "skipped">
}) {
  let scrollElement: HTMLDivElement | undefined
  let scrollController: AutoScrollController | undefined
  const [tracking, setTracking] = createSignal(true)
  const card = createMemo(() => projectSubagentConversationCard(props.conversation(), props.status()))

  onMount(() => {
    if (!scrollElement) throw new Error("Sub-agent conversation scroll container is missing")
    scrollController = setupAutoScroll(scrollElement, {
      isTracking: tracking,
      onUserScrollUp: () => setTracking(false),
      onAtBottom: () => setTracking(true),
    })
  })

  createEffect(
    on(
      props.sessionID,
      () => {
        setTracking(true)
        scrollController?.scrollToBottom()
      },
      { defer: true },
    ),
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

  onCleanup(() => {
    scrollController?.cleanup()
    scrollController = undefined
  })

  return (
    <div ref={scrollElement} class="subagent-conversation-panel__scroll" data-ui="subagent-conversation-scroll">
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
  const records = createMemo(() =>
    conversationAgentRecordsForSource(boardStore.selectedSource).filter(isSubagentActivityRecord),
  )
  const sessionIDs = createMemo(() => records().map((candidate) => candidate.sessionID), [], {
    equals: (previous, next) =>
      previous.length === next.length && previous.every((sessionID, index) => sessionID === next[index]),
  })
  const selectedRecord = createMemo(() => {
    const sessionID = props.sessionID().trim()
    if (!sessionID) return undefined
    return records().find((candidate) => candidate.sessionID === sessionID)
  })
  let agentTabListElement: HTMLDivElement | undefined
  let revealSelectedFrame: number | undefined
  createEffect(() => {
    const selectedSessionID = props.sessionID().trim()
    if (!selectedSessionID || !sessionIDs().includes(selectedSessionID)) return
    if (revealSelectedFrame !== undefined) window.cancelAnimationFrame(revealSelectedFrame)
    revealSelectedFrame = window.requestAnimationFrame(() => {
      revealSelectedFrame = undefined
      const tabList = agentTabListElement
      if (!tabList) return
      const selectedTab = Array.from(
        tabList.querySelectorAll<HTMLElement>(".subagent-conversation-panel__agent-tab"),
      ).find((candidate) => candidate.dataset.sessionId === selectedSessionID)
      if (!selectedTab) return
      const listBounds = tabList.getBoundingClientRect()
      const tabBounds = selectedTab.getBoundingClientRect()
      if (tabBounds.left < listBounds.left) {
        tabList.scrollLeft += tabBounds.left - listBounds.left
      } else if (tabBounds.right > listBounds.right) {
        tabList.scrollLeft += tabBounds.right - listBounds.right
      }
    })
  })
  onCleanup(() => {
    if (revealSelectedFrame !== undefined) window.cancelAnimationFrame(revealSelectedFrame)
  })
  const requestKey = createMemo(() => {
    if (!props.active()) return null
    const source = boardStore.selectedSource
    const sessionID = props.sessionID().trim()
    const directory = selectedConversationDirectory()
    if (!source || !sessionID || !directory) return null
    const record = selectedRecord()
    if (!record) return null
    return subagentConversationTargetKey({
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
      const target = JSON.parse(serialized) as {
        source: BoardSource
        sessionID: string
        directory: string
      }
      try {
        const previous = context.value?.targetKey === serialized ? context.value : undefined
        const delta = await loadSubagentConversation({
          ...target,
          afterSequence: target.source.kind === "task" ? previous?.lastLiveSequence : undefined,
          afterLiveEpoch: target.source.kind === "task" ? previous?.liveEpoch : undefined,
          signal: controller.signal,
        })
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
    const base = conversation()
    return base ? projectSubagentConversationLive(base, liveProjection()) : undefined
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
    stopLiveProjection()
    flushLiveProjection.cancel()
    transcriptRefresh.dispose()
    transcriptAbort?.abort()
  })
  const status = () => selectedRecord()?.status || "pending"

  return (
    <section class="subagent-conversation-panel" data-session-id={props.sessionID()}>
      <Show
        when={selectedRecord()}
        fallback={<div class="subagent-conversation-panel__empty">{t("subagent.conversation.no_selection")}</div>}
      >
        <Tabs
          class="subagent-conversation-panel__agents"
          value={props.sessionID()}
          onValueChange={props.onSessionSelect}
        >
          <div class="subagent-conversation-panel__agent-selector">
            <TabList
              ref={agentTabListElement}
              class="subagent-conversation-panel__agent-tabs"
              size="sm"
              tone="neutral"
              layout="strip"
              aria-label={t("right_dock.tool.subagent")}
            >
              <For each={sessionIDs()}>
                {(sessionID) => {
                  const candidate = createMemo(() => {
                    const record = records().find((item) => item.sessionID === sessionID)
                    if (!record) throw new Error(`Sub-agent selector missing activity record for ${sessionID}`)
                    return record
                  })
                  const candidateStatusLabel = () => t(`agent_rail.status.${candidate().status}`)
                  return (
                    <Tab
                      value={sessionID}
                      size="sm"
                      tone="neutral"
                      class="subagent-conversation-panel__agent-tab"
                      data-session-id={sessionID}
                      aria-label={t("subagent.progress.open", { agent: candidate().agentID })}
                      title={`${candidate().agentID} · ${candidateStatusLabel()}`}
                    >
                      <Avatar
                        role={candidate().stage}
                        status={candidate().status}
                        class="subagent-conversation-panel__agent-avatar"
                      />
                      <span class="subagent-conversation-panel__agent-label">{candidate().agentID}</span>
                      <StatusIndicator
                        status={candidate().status}
                        label={candidateStatusLabel()}
                        appearance="dot"
                        aria-hidden="true"
                      />
                    </Tab>
                  )
                }}
              </For>
            </TabList>
            <Show when={records().length > 1}>
              <DropdownMenu.Root placement="bottom-end" gutter={6} fitViewport>
                <DropdownMenu.Trigger
                  as={Button}
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  class="subagent-conversation-panel__agent-menu-trigger"
                  data-ui="subagent-agent-menu-trigger"
                  aria-label={t("subagent.conversation.all_agents", { count: records().length })}
                  title={t("subagent.conversation.all_agents", { count: records().length })}
                >
                  <Icon name="more-horizontal" size="compact" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="subagent-conversation-panel__agent-menu" data-ui="subagent-agent-menu">
                    <For each={sessionIDs()}>
                      {(sessionID) => {
                        const candidate = createMemo(() => {
                          const record = records().find((item) => item.sessionID === sessionID)
                          if (!record) throw new Error(`Sub-agent menu missing activity record for ${sessionID}`)
                          return record
                        })
                        const candidateStatusLabel = () => t(`agent_rail.status.${candidate().status}`)
                        return (
                          <DropdownMenu.Item
                            as="button"
                            type="button"
                            class="subagent-conversation-panel__agent-menu-item"
                            data-session-id={sessionID}
                            data-active={String(sessionID === props.sessionID())}
                            onSelect={() => props.onSessionSelect(sessionID)}
                          >
                            <Avatar
                              role={candidate().stage}
                              status={candidate().status}
                              class="subagent-conversation-panel__agent-menu-avatar"
                            />
                            <span class="subagent-conversation-panel__agent-menu-label">{candidate().agentID}</span>
                            <span class="subagent-conversation-panel__agent-menu-status">{candidateStatusLabel()}</span>
                          </DropdownMenu.Item>
                        )
                      }}
                    </For>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </Show>
          </div>
          <TabPanel
            value={props.sessionID()}
            forceMount
            class="subagent-conversation-panel__selected-agent"
            data-ui="subagent-selected-agent"
          >
            <Show
              when={requestKey()}
              fallback={<div class="subagent-conversation-panel__empty">{t("subagent.conversation.no_selection")}</div>}
            >
              <Show
                when={!conversation.error}
                fallback={
                  <div class="subagent-conversation-panel__empty" role="alert">
                    <strong>{t("subagent.conversation.load_failed")}</strong>
                    <p>{formatErrorDetails(conversation.error)}</p>
                    <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => void refetch()}>
                      {t("common.retry")}
                    </Button>
                  </div>
                }
              >
                <Show
                  when={displayedConversation()}
                  fallback={<div class="subagent-conversation-panel__empty">{t("subagent.conversation.loading")}</div>}
                >
                  {(data) => (
                    <SubagentConversationScroll conversation={data} sessionID={props.sessionID} status={status} />
                  )}
                </Show>
              </Show>
            </Show>
          </TabPanel>
        </Tabs>
      </Show>
    </section>
  )
}
