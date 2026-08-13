// ── SSE Event Router & Board/Task Lifecycle ──
// Central dispatch for all incoming SSE events.
// Executor protocol events are routed as protocol events only. Visible
// conversation cards are sourced from backend message.* events.

import {
  boardStore,
  setBoardStore,
  scheduleBoard,
  loadTasks,
  setTaskSequence,
  activeTaskID,
  activeSessionID,
  activeBrowserPreviewTaskID,
} from "../store/board"
import { pruneCardsAfterCursor } from "../store/card-tree"
import {
  advanceLiveConversationAgentTranscriptSequence,
  applyLiveConversationAgentMessageUpdated,
  applyLiveConversationAgentPartUpdated,
  applyLiveConversationAgentSessionStatus,
  applyLiveConversationAgentTodoUpdated,
} from "../store/conversation-agents"
import { markSessionConfigStale } from "./config"
import { refreshActiveComposerModelFromSession } from "./composer-model"
import { markExpertSquadCatalogStale } from "./expert-squad"
import { applyEvent as applyTreeWriterEvent, isProjectionPrerequisiteError } from "./tree-writer"
import { refreshConversationTurnArtifacts, scheduleLatestConversationTailMerge } from "./conversation"
import {
  isBrowserPreviewUpdateEvent,
  observeBrowserPreviewUpdateEvent,
} from "./browser-preview"
import { bumpFileWorkbenchRevision } from "./file-workbench"
import { conversationEventOwner, isBoardInvalidatingEventType, isRouterConsumedNoopEventType } from "./event-policy"
import { markSelectedLiveEventConsumed } from "./selected-stream-cursor"
import type { SelectedTaskRecoveryOptions, SelectedTaskRecoveryScheduler } from "./selected-task-recovery"

// Forward SSE events to the tree-writer. The conversation view reads
// `cardTreeStore`; message events stay out of the transcript mirror on the
// visible hot path.
function writeToTree(event: any): void {
  applyTreeWriterEvent(event)
}

function writeSelectedMessageToTree(event: any, sourceEvent: any = event): void {
  writeToTree(event)
  const sourceKey = selectedConversationAgentSourceKey(sourceEvent)
  if (!sourceKey) return
  if (event?.type === "message.updated") {
    applyLiveConversationAgentMessageUpdated(sourceKey, event)
  } else if (event?.type === "message.part.updated") {
    applyLiveConversationAgentPartUpdated(sourceKey, event)
  }
  if (event?.type !== "message.part.delta") {
    advanceLiveConversationAgentTranscriptSequence(sourceKey, event)
  }
}

function isMessageStreamEvent(type: string): boolean {
  return (
    type === "message.moved" ||
    type === "message.updated" ||
    type === "message.part.updated" ||
    type === "message.part.delta" ||
    type === "message.removed" ||
    type === "message.part.removed"
  )
}

// ── Helpers ──

function record(value: any): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function rightSidebarConversationSelectedTaskID(info: any): string | null | undefined {
  const conversation = record(info?.metadata?.conversation) ? info.metadata.conversation : undefined
  if (
    !conversation ||
    conversation.surface !== "right-sidebar" ||
    (conversation.experience !== "chat" && conversation.experience !== "work")
  ) {
    return undefined
  }
  const selectedTaskID = conversation.selectedTaskID
  if (selectedTaskID === undefined || selectedTaskID === null) return null
  if (typeof selectedTaskID === "string" && selectedTaskID.trim()) return selectedTaskID.trim()
  throw new Error("session.updated right-sidebar conversation selectedTaskID must be a non-empty string or null")
}

function currentTaskSessionID(): string {
  const boardSession = boardStore.board?.task?.sessionID
  if (typeof boardSession === "string" && boardSession) return boardSession
  const taskID = activeTaskID()
  if (!taskID) return ""
  const entry = boardStore.tasks.find((item: any) => item?.task?.id === taskID)
  return typeof entry?.task?.sessionID === "string" ? entry.task.sessionID : ""
}

function messageEventSessionID(event: any): string {
  const properties = record(event?.properties) ? event.properties : record(event?.payload) ? event.payload : {}
  if (typeof properties?.info?.sessionID === "string") return properties.info.sessionID
  if (typeof properties?.part?.sessionID === "string") return properties.part.sessionID
  return typeof properties?.sessionID === "string" ? properties.sessionID : ""
}

function shouldRecoverForMessageEvent(event: any): boolean {
  const type = String(event?.type || "").trim()
  if (!isMessageStreamEvent(type)) return false
  if (!activeTaskID()) return false
  if (currentTaskSessionID()) return false
  return !!messageEventSessionID(event)
}

function shouldRecoverSelectedTaskSequenceGap(event: any): boolean {
  const taskID = eventTaskID(event)
  if (!taskID || taskID !== activeTaskID()) return false
  const sequence = eventSequence(event)
  if (sequence <= 0) return false
  const current = boardStore.taskSequence
  return current > 0 && sequence > current + 1
}

function advanceHandledSelectedTaskSequence(event: any): void {
  const taskID = eventTaskID(event)
  if (!taskID || taskID !== activeTaskID()) return
  const sequence = eventSequence(event)
  if (sequence <= 0) return
  const current = boardStore.taskSequence
  // Gap detection runs before a handled event reaches this helper. If we
  // still see a jump here, do not paper over it by moving the cursor.
  if (current > 0 && sequence > current + 1) return
  if (sequence <= current) return
  setTaskSequence(sequence)
}

function markHandledSelectedLiveEvent(event: any): void {
  const taskID = eventTaskID(event)
  if (taskID && taskID !== activeTaskID()) return
  markSelectedLiveEventConsumed(event)
}

function selectedConversationAgentSourceKey(event: any): string {
  const selectedTaskID = activeTaskID()
  if (selectedTaskID) {
    const taskID = eventTaskID(event)
    if (taskID && taskID !== selectedTaskID) return ""
    return `task:${selectedTaskID}`
  }
  const selectedSessionID = activeSessionID()
  return selectedSessionID ? `session:${selectedSessionID}` : ""
}

function messageWriterRecoveryOptions(error: unknown): SelectedTaskRecoveryOptions | null {
  if (isProjectionPrerequisiteError(error)) return {}
  return null
}

function scheduleSelectedTaskRecovery(
  recovery: SelectedTaskRecoveryScheduler,
  reason: string,
  taskID = activeTaskID(),
  options: SelectedTaskRecoveryOptions = {},
): void {
  const selectedTaskID = String(taskID || "")
  if (!selectedTaskID) return
  void recovery.recoverConversation(reason, selectedTaskID, options).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") return
    console.error("[sse] selected-task recovery failed", reason, selectedTaskID, error)
  })
}

function scheduleRewindClearRecovery(
  recovery: SelectedTaskRecoveryScheduler,
  reason: string,
  taskID = activeTaskID(),
): void {
  const selectedTaskID = String(taskID || "")
  if (!selectedTaskID) return
  void recovery.recoverAfterRewindClear(reason, selectedTaskID).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") return
    console.error("[sse] rewind clear recovery failed", reason, selectedTaskID, error)
  })
}

// ── Main router ──

const BOARD_EVENT_DEBOUNCE = 500

let tasksKickTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Route a parsed SSE event to the appropriate Solid store or action.
 * @returns true if the event was consumed; false if it should be forwarded to
 * handleEventStreamEvent for board/task lifecycle processing.
 */
export function routeSSEEvent(event: any, recovery: SelectedTaskRecoveryScheduler): boolean {
  const type: string = event.type || ""
  if (
    type === "agent.execution.lifecycle" &&
    event?.properties?.status?.type === "terminal" &&
    boardStore.selectedSource?.kind === "session" &&
    boardStore.selectedSource.sessionKind === "mission"
  ) {
    void refreshConversationTurnArtifacts().catch((error) => {
      console.error("[sse] Mission turn Artifact refresh failed", error)
    })
  }
  if (type === "file.watcher.updated") {
    bumpFileWorkbenchRevision()
  }
  if (shouldRecoverSelectedTaskSequenceGap(event)) {
    const taskID = eventTaskID(event)
    scheduleSelectedTaskRecovery(recovery, "selected task sequence gap", taskID)
    scheduleTasksCompat(BOARD_EVENT_DEBOUNCE)
    return true
  }

  // ── Message stream events → batched queue ──
  if (isMessageStreamEvent(type)) {
    if (shouldRecoverForMessageEvent(event)) {
      scheduleSelectedTaskRecovery(recovery, `message writer prerequisites missing: ${type}`)
      return true
    }
    // Write only after the prerequisite check. If the message graph cannot
    // attach this event, selected-task recovery reopens the live stream with
    // the current persisted/live cursors; it must not clear cardTreeStore.
    try {
      writeSelectedMessageToTree(event)
    } catch (error) {
      const recoveryOptions = messageWriterRecoveryOptions(error)
      if (!recoveryOptions) throw error
      scheduleSelectedTaskRecovery(
        recovery,
        `message writer prerequisites missing: ${type}`,
        activeTaskID(),
        recoveryOptions,
      )
      return true
    }
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  if (type === "session.updated") {
    const properties = record(event?.properties) ? event.properties : record(event?.payload) ? event.payload : {}
    const sessionID = String(properties?.info?.id || properties?.sessionID || properties?.session_id || "")
    if (sessionID) markSessionConfigStale(sessionID)
    if (sessionID && sessionID === activeSessionID()) {
      const selectedTaskID = rightSidebarConversationSelectedTaskID(properties?.info)
      const board = boardStore.board
      if (selectedTaskID !== undefined && board?.kind === "session" && board.sessionID === sessionID) {
        setBoardStore("board", { ...board, selectedTaskID })
      }
    }
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  if (type === "task.live_replay_expired") {
    markHandledSelectedLiveEvent(event)
    return true
  }

  if (type === "task.messages.changed") {
    const taskID = eventTaskID(event) || activeTaskID() || ""
    if (taskID && taskID === activeTaskID()) {
      scheduleLatestConversationTailMerge(taskID)
    }
    markHandledSelectedLiveEvent(event)
    return true
  }

  if (isBrowserPreviewUpdateEvent(event)) {
    const taskID = eventTaskID(event)
    let advanced = false
    if (taskID && taskID === activeBrowserPreviewTaskID()) {
      advanced = observeBrowserPreviewUpdateEvent({
        type: event.type,
        source: event.source,
        taskID,
        sequence: eventSequence(event),
      })
    }
    if (advanced && taskID === activeTaskID()) {
      scheduleBoard(BOARD_EVENT_DEBOUNCE)
    }
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  // Project only tree-owned events before router-specific side effects.
  // Board-only control-plane events continue to the Board refresh path without
  // entering the strict message-card writer.
  if (conversationEventOwner(type) === "tree-writer") writeToTree(event)

  if (type === "todo.updated") {
    const sourceKey = selectedConversationAgentSourceKey(event)
    if (sourceKey) applyLiveConversationAgentTodoUpdated(sourceKey, event)
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  if (type === "agent.execution.lifecycle") {
    const sourceKey = selectedConversationAgentSourceKey(event)
    if (sourceKey) applyLiveConversationAgentSessionStatus(sourceKey, event)
    const taskID = eventTaskID(event)
    if (taskID && taskID === activeTaskID()) scheduleBoard(BOARD_EVENT_DEBOUNCE)
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  // Replay buffer expiry is loud. Do not full-refresh the loaded transcript:
  // that clears cardTreeStore and causes the observed scroll jump.
  if (type === "task.replay_expired") {
    const taskID: string = activeTaskID() || ""
    if (taskID) scheduleSelectedTaskRecovery(recovery, "task.replay_expired", taskID)
    markHandledSelectedLiveEvent(event)
    return true
  }

  // ── Task rewound → incremental prune of the card tree ──
  // Backend emitted Event.TaskRewound after a rewindTask call. We prune
  // the tail of the timeline locally (card-tree store) without a full
  // refresh — the full-refresh path was the "user message → overlay
  // 卡顿" symptom, and the server has already filtered its describe
  // outputs to `time_created <= cursorTime`.
  if (type === "task.rewound") {
    const properties = record(event?.properties) ? event.properties : {}
    const evtTaskID: string | undefined = typeof properties.taskID === "string" ? properties.taskID : undefined
    const cursorTime: number | undefined = typeof properties.cursorTime === "number" ? properties.cursorTime : undefined
    const resetWorktree = properties.resetWorktree === true
    if (!evtTaskID || cursorTime === undefined) return true
    // Only prune when the event concerns the currently-selected task —
    // other tasks' card trees are not loaded in this overlay instance.
    if (evtTaskID === activeTaskID() && cursorTime > 0) {
      // Idempotent — duplicate task.rewound events keep the same cursor.
      void Promise.resolve()
        .then(() => {
          pruneCardsAfterCursor(cursorTime)
          if (resetWorktree) scheduleBoard(0)
        })
        .catch((error) => {
          console.error("[sse] rewind card pruning failed", error)
        })
      advanceHandledSelectedTaskSequence(event)
    } else if (evtTaskID === activeTaskID() && cursorTime === 0) {
      scheduleRewindClearRecovery(recovery, "task rewind cleared", evtTaskID)
    }
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  const properties = record(event?.properties) ? event.properties : record(event?.payload) ? event.payload : {}

  // Session overlays and project config are separate authorities. A Session
  // config event must re-project the selected root Session; loading /config
  // here would overwrite the freshly persisted Session model with the
  // project default and disable the Composer.
  if (type === "config.changed") {
    const changedSessionID = typeof properties.sessionID === "string" ? properties.sessionID.trim() : ""
    if (!changedSessionID) throw new Error("config.changed is missing canonical properties.sessionID")
    markSessionConfigStale(changedSessionID)
    void refreshActiveComposerModelFromSession(changedSessionID)?.catch((err: unknown) => {
      console.error("[sse] Session config projection refresh failed", err)
    })
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  // Explicitly consumed protocol events that do not project into either
  // messageStore or cardTreeStore. tree-writer whitelists them as no-ops so
  // they remain auditable and don't surface as unknown-event crashes.
  if (isRouterConsumedNoopEventType(type)) {
    advanceHandledSelectedTaskSequence(event)
    markHandledSelectedLiveEvent(event)
    return true
  }

  // ── Board-invalidating events → forwarded to handleEventStreamEvent
  if (isBoardInvalidatingEventType(type)) return false

  return false
}

// ── Board / Task Lifecycle Event Handling ──

function normalizedEventType(event: any): string {
  const raw = String(event?.type || "").trim()
  return raw
}

function eventTaskID(event: any): string {
  return String(
    event?.taskID ||
      event?.task_id ||
      event?.properties?.taskID ||
      event?.properties?.task_id ||
      event?.payload?.taskID ||
      event?.payload?.task_id ||
      "",
  )
}

function eventSequence(event: any): number {
  const value = Number(event?.sequence)
  return Number.isFinite(value) ? value : 0
}

function boardInvalidatingEvent(type: string): boolean {
  return isBoardInvalidatingEventType(type)
}

function shouldRefreshSelectedBoard(type: string): boolean {
  if (type.startsWith("message.")) return false
  // agent.execution.lifecycle is handled before this generic path so the same event both
  // updates the live Session card and schedules exactly one Board refresh.
  if (type === "agent.execution.lifecycle") return false
  return boardInvalidatingEvent(type) || type === "task.message"
}

function scheduleTasksCompat(delay = 0): void {
  if (tasksKickTimer) clearTimeout(tasksKickTimer)
  tasksKickTimer = setTimeout(() => {
    tasksKickTimer = null
    void loadTasks().catch((err) => {
      console.error("[task-list-sse] task refresh failed", err)
    })
  }, delay)
}

export function handleEventStreamEvent(event: any, recovery: SelectedTaskRecoveryScheduler): void {
  const type = normalizedEventType(event)
  if (
    (type === "task.completed" || type === "task.failed" || type === "task.cancelled") &&
    eventTaskID(event) === activeTaskID()
  ) {
    void refreshConversationTurnArtifacts().catch((error) => {
      console.error("[sse] Task turn Artifact refresh failed", error)
    })
  }
  // tree-writer projection has already happened upstream in
  // `routeSSEEvent` (unconditional `writeToTree(event)` before its
  // early returns). This function now only owns the board / task-sequence
  // refresh path; tree projection is single-sourced through routeSSEEvent.
  if (type.startsWith("message.")) {
    if (shouldRecoverForMessageEvent({ ...event, type })) {
      scheduleSelectedTaskRecovery(recovery, `message writer prerequisites missing: ${type}`)
      return
    }
    return
  }
  if (type === "task.replay_expired") {
    if (activeTaskID()) {
      scheduleSelectedTaskRecovery(recovery, "task.replay_expired", activeTaskID())
    }
    return
  }
  const taskID = eventTaskID(event)
  if (isBrowserPreviewUpdateEvent(event)) {
    let advanced = false
    if (taskID && taskID === activeBrowserPreviewTaskID()) {
      advanced = observeBrowserPreviewUpdateEvent({
        type: event.type,
        source: event.source,
        taskID,
        sequence: eventSequence(event),
      })
    }
    if (advanced && taskID === activeTaskID()) {
      scheduleBoard(BOARD_EVENT_DEBOUNCE)
    }
    return
  }
  const sequence = eventSequence(event)
  if (taskID && taskID === activeTaskID() && sequence > 0) {
    const current = boardStore.taskSequence
    if (current > 0 && sequence <= current) return
    if (current > 0 && sequence > current + 1) {
      scheduleSelectedTaskRecovery(recovery, "selected task sequence gap", taskID)
      scheduleTasksCompat(BOARD_EVENT_DEBOUNCE)
      // Do not advance taskSequence across a gap. The selected conversation
      // stream missed persisted events; only full selected-task recovery can
      // rebuild cardTreeStore and compute the next safe resume cursor.
      return
    }
    setTaskSequence(sequence)
  }
  if (boardInvalidatingEvent(type)) {
    scheduleTasksCompat(BOARD_EVENT_DEBOUNCE)
  }
  if (taskID && taskID === activeTaskID() && shouldRefreshSelectedBoard(type)) {
    scheduleBoard(BOARD_EVENT_DEBOUNCE)
  }
  markHandledSelectedLiveEvent(event)
}

/**
 * Handler for the GLOBAL task-list SSE stream (`GET /task/events`).
 *
 * Server contract (see server/routes/orchestrator.ts): this stream emits a
 * pure change-notification shape — `{type, taskID, sequence, notify?}` —
 * with NO payload / properties. It is meant to tell the sidebar "some task
 * changed, refetch the list"; it is NOT the per-task message stream.
 *
 * The previous implementation routed these notifications through
 * `handleEventStreamEvent`, which feeds events into `writeToTree` →
 * tree-writer. tree-writer correctly throws for missing partID/info/part,
 * producing one throw per stream notification. Under active benchmarks
 * the task-list stream emits `message.part.delta` at full SSE cadence,
 * which flooded the console and made the browser miss render deadlines
 * (observed as `Overlay did not render streamed task output within 120s`
 * in browser-driven Overlay tests).
 *
 * Route them correctly here instead:
 *   - `message.*` notifications → only mean "that task changed"; update
 *     sidebar task freshness without reloading the selected board.
 *   - task lifecycle events → same refresh path.
 *   - sequence tracking mirrors handleEventStreamEvent's rules.
 *
 * tree-writer is reserved for task-scope events that carry full payload
 * (delivered via `routeSSEEvent` on the per-task stream).
 */
export function handleTaskListNotification(
  event: any,
  options: { directory?: string },
  recovery: SelectedTaskRecoveryScheduler,
): void {
  const type = normalizedEventType(event)
  if (type === "task.completed" || type === "task.failed" || type === "task.cancelled") {
    // Task-owned extension writes (including Multica import) do not pass
    // through Overlay mutation services. The global task-list terminal event
    // is the authoritative completion edge for invalidating their catalog.
    markExpertSquadCatalogStale()
  }
  if (type === "task.replay_expired") {
    if (activeTaskID()) {
      scheduleSelectedTaskRecovery(recovery, "task.replay_expired", activeTaskID())
    }
    return
  }
  const taskID = eventTaskID(event)
  const sequence = eventSequence(event)
  if (isBrowserPreviewUpdateEvent(event)) {
    let advanced = false
    if (taskID && taskID === activeBrowserPreviewTaskID()) {
      advanced = observeBrowserPreviewUpdateEvent({
        type: event.type,
        source: event.source,
        taskID,
        sequence,
      })
    }
    if (advanced && taskID === activeTaskID()) {
      scheduleBoard(BOARD_EVENT_DEBOUNCE)
    }
    return
  }
  if (taskID && taskID === activeTaskID() && sequence > 0) {
    const current = boardStore.taskSequence
    if (current > 0 && sequence > current + 1) {
      scheduleSelectedTaskRecovery(recovery, "task-list selected task sequence gap", taskID)
      scheduleTasksCompat(BOARD_EVENT_DEBOUNCE)
      return
    }
  }
  if (taskID) {
    scheduleTasksCompat(BOARD_EVENT_DEBOUNCE)
  }
  if (taskID && taskID === activeTaskID() && shouldRefreshSelectedBoard(type)) {
    scheduleBoard(BOARD_EVENT_DEBOUNCE)
  }
}
