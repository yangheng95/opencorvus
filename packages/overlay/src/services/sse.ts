// ── SSE Connection Manager ──
// Manages the Server-Sent Events connection for real-time task updates.
// Events are dispatched through routeSSEEvent() first (message/agent/runtime).
// Unhandled events are forwarded to handleEventStreamEvent for board/task
// lifecycle processing.
//
// Streams flow through `HostTransport.openStream` (services/host-transport.ts)
// so the same business logic runs identically under the Tauri overlay and
// standalone browser/Vite hosts. The host transport owns transient reconnect
// behaviour; this module owns the business reconnect policy: reopen from the
// last consumed persisted sequence without full-hydrating the already mounted
// conversation.

import {
  WorkLedgerActionEvent,
  WorkLedgerEvent,
  type WorkLedgerActionEvent as WorkLedgerStreamEvent,
} from "@opencorvus-ai/transport-protocol"
import { messageStore, setSseConnected, setSseExpected } from "../store/messages"
import { boardStore, activeTaskID, type BoardSource } from "../store/board"
import { routeSSEEvent, handleEventStreamEvent, handleTaskListNotification } from "./events"
import { createSelectedTaskRecoveryScheduler } from "./selected-task-recovery"
import { formatErrorDetails } from "./diagnostics"
import type { StreamHandle } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"
import {
  recordConversationRecoveryAborted,
  recordConversationRecoveryFailed,
  recordConversationRecoveryStarted,
  recordConversationRecoverySucceeded,
} from "./refresh-diagnostics"
import { settingsStore } from "../store/settings"
import {
  conversationSourceDirectory,
  mergeLatestConversationTail,
  registerConversationSourceDirectory,
} from "./conversation"
import { resetSelectedLiveCursor, selectedLiveReplayQuery } from "./selected-stream-cursor"
import { AppLog } from "../utils/log"
import {
  pauseSelectedTaskSseActivity,
  recordSelectedTaskSseEventActivity,
  selectedTaskSseLifecycleStatus,
  taskRuntimeActivityKey,
} from "./task-runtime-activity"
import { refreshActiveComposerModelFromSession } from "./composer-model"

let sseHandle: StreamHandle | null = null
let sseRetryTimer: any = null
let sseWatchdogTimer: ReturnType<typeof setTimeout> | null = null
let sseTaskID = ""
let sseSource: BoardSource | null = null
let selectedTaskStreamGeneration = 0

// audit-2026-04-29 W2-V10 — reconnect tick extracted so the regression
// test can exercise restart failures and task-switch races directly, without
// standing up the real HostTransport + 3 s timers. Production path: onClose
// sets a 3 s timer that calls this with the live deps below.
export interface SseReconnectDeps {
  taskID: string
  directory: string
  after: number
  currentTaskID: () => string
  isCurrent?: () => boolean
  resumeAfter: () => number
  restart: (source: BoardSource, after: number, options?: SseStartOptions) => void
  scheduleRetry: (fn: () => void, ms: number) => void
  retryDelayMs: number
  replayLive?: boolean
  beforeRestart?: (taskID: string, sequence: number) => void | Promise<void>
  afterRestart?: (taskID: string, sequence: number) => void | Promise<void>
}

export interface SseStartOptions {
  replayLive?: boolean
  directory?: string
}

function ssePayloadSample(data: string): string {
  return String(data || "").slice(0, 500)
}

const SSE_DISPATCH_EVENT_SAMPLE_LIMIT = 12_000
const SSE_DISPATCH_ERROR_DETAIL_LIMIT = 4_000
const SSE_DISPATCH_PAYLOAD_KEY_LIMIT = 80

function boundedString(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}\n...[truncated ${value.length - limit} chars]`
}

function jsonSample(value: unknown, limit: number): string {
  try {
    return boundedString(JSON.stringify(value, null, 2), limit)
  } catch {
    return boundedString(String(value), limit)
  }
}

function boundedErrorDetails(error: unknown): string {
  return boundedString(formatErrorDetails(error), SSE_DISPATCH_ERROR_DETAIL_LIMIT)
}

function payloadKeyDiagnostic(properties: Record<string, any>): Record<string, unknown> {
  const keys = Object.keys(properties).sort()
  return {
    keys: keys.slice(0, SSE_DISPATCH_PAYLOAD_KEY_LIMIT),
    total: keys.length,
    truncated: Math.max(0, keys.length - SSE_DISPATCH_PAYLOAD_KEY_LIMIT),
  }
}

function eventProperties(event: any): Record<string, any> {
  const properties = event?.properties
  if (properties && typeof properties === "object" && !Array.isArray(properties)) return properties
  const payload = event?.payload
  if (payload && typeof payload === "object" && !Array.isArray(payload)) return payload
  return {}
}

function selectedTaskRuntimeKey(taskID: string): string {
  const boardTask = boardStore.board?.task
  if (!taskID || boardTask?.id !== taskID) return ""
  const startedAt = Number(boardTask?.time?.started)
  if (!Number.isFinite(startedAt) || startedAt <= 0) return ""
  return taskRuntimeActivityKey({ taskID, startedAt })
}

function recordSelectedTaskSseUpdate(event: any, taskID: string): void {
  const task = boardStore.board?.task
  const lifecycleStatus = selectedTaskSseLifecycleStatus(event)
  recordSelectedTaskSseEventActivity({
    event,
    task,
    taskID,
    active: task?.status === "active" || lifecycleStatus === "active",
  })
  const key = selectedTaskRuntimeKey(taskID)
  if (lifecycleStatus && lifecycleStatus !== "active") {
    pauseSelectedTaskSseActivity(key)
  }
}

function pauseSelectedTaskSseStreamActivity(taskID: string): void {
  const key = selectedTaskRuntimeKey(taskID)
  if (!key) return
  pauseSelectedTaskSseActivity(key)
}

function dispatchEventDiagnostic(event: any): Record<string, unknown> {
  const properties = eventProperties(event)
  const info = properties.info && typeof properties.info === "object" ? properties.info : undefined
  const part = properties.part && typeof properties.part === "object" ? properties.part : undefined
  return {
    eventID: event?.event_id || event?.eventID || "",
    taskID: event?.task_id || event?.taskID || properties.taskID || properties.task_id || "",
    type: event?.type || "",
    orderKey: event?.orderKey || properties.orderKey || "",
    messageID: info?.id || part?.messageID || properties.messageID || "",
    sessionID: info?.sessionID || part?.sessionID || properties.sessionID || "",
    partID: part?.id || properties.partID || "",
    sequence: event?.sequence ?? "",
    liveSequence: event?.live_sequence ?? "",
    liveEpoch: event?.live_epoch ?? "",
    emittedAt: event?.emittedAt || event?.emitted_at || "",
    timestamp: event?.timestamp || "",
    payloadKeys: payloadKeyDiagnostic(properties),
    eventSample: jsonSample(event, SSE_DISPATCH_EVENT_SAMPLE_LIMIT),
  }
}

function dispatchNotificationDetails(errorDetails: string, event: any): string {
  return boundedString(
    `${errorDetails}\n\nevent diagnostic:\n${jsonSample(dispatchEventDiagnostic(event), SSE_DISPATCH_EVENT_SAMPLE_LIMIT)}`,
    SSE_DISPATCH_EVENT_SAMPLE_LIMIT + SSE_DISPATCH_ERROR_DETAIL_LIMIT,
  )
}

function logMalformedSsePayload(input: {
  stream: "selected-task" | "task-list" | "work-ledger"
  data: string
  error: unknown
  taskID?: string
  directory?: string
}): void {
  const where =
    input.stream === "selected-task"
      ? `task ${input.taskID || "<unknown>"}`
      : input.stream === "work-ledger"
        ? "work ledger"
        : "task list"
  AppLog.error("sse", `malformed ${input.stream} SSE payload`, {
    stream: input.stream,
    taskID: input.taskID,
    directory: input.directory,
    error: boundedErrorDetails(input.error),
    payloadSample: ssePayloadSample(input.data),
    diagnosticID: `sse:parse-error:${input.stream}:${input.taskID || input.directory || "global"}`,
    diagnosticTitle: "Malformed live event",
    diagnosticMessage: `OpenCorvus received a malformed SSE payload for ${where}.`,
    diagnosticDetails: boundedString(
      `${boundedErrorDetails(input.error)}\n\npayload sample:\n${ssePayloadSample(input.data)}`,
      SSE_DISPATCH_ERROR_DETAIL_LIMIT + 600,
    ),
  })
}

export async function performSseReconnect(deps: SseReconnectDeps): Promise<void> {
  if (deps.isCurrent?.() === false || deps.currentTaskID() !== deps.taskID) return
  const startedAt = Date.now()
  recordConversationRecoveryStarted({
    channel: "sse-reconnect",
    reason: "sse stream reconnect",
    taskID: deps.taskID,
    source: "sse-reconnect",
  })
  const nextSequence = Math.max(0, Math.floor(Number(deps.resumeAfter()) || 0))
  if (deps.isCurrent?.() === false || deps.currentTaskID() !== deps.taskID) {
    recordConversationRecoveryAborted({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: deps.taskID,
      source: "sse-reconnect",
      durationMs: Date.now() - startedAt,
      error: "task changed before restart",
    })
    return
  }
  try {
    const directory = deps.directory.trim()
    if (!directory) throw new Error("SSE reconnect requires a project directory")
    await deps.beforeRestart?.(deps.taskID, nextSequence)
    if (deps.isCurrent?.() === false || deps.currentTaskID() !== deps.taskID) {
      throw new DOMException("task changed before restart", "AbortError")
    }
    deps.restart(
      { kind: "task", id: deps.taskID },
      nextSequence,
      deps.replayLive === false ? { replayLive: false, directory } : { directory },
    )
    await deps.afterRestart?.(deps.taskID, nextSequence)
  } catch (err) {
    recordConversationRecoveryFailed({
      channel: "sse-reconnect",
      reason: "sse stream reconnect",
      taskID: deps.taskID,
      source: "sse-reconnect",
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err || ""),
    })
    // Persistent toast (id'd per task) keeps the operator aware that the
    // live stream is currently broken even after we schedule a retry.
    // Re-firing with the same id collapses repeated retries into one row.
    AppLog.error("sse", `reconnect restart failed for task ${deps.taskID}`, {
      taskID: deps.taskID,
      retryDelayMs: deps.retryDelayMs,
      error: formatErrorDetails(err),
      diagnosticID: `sse:reconnect-failed:${deps.taskID}`,
      diagnosticTitle: "Live stream disconnected",
      diagnosticMessage: `Failed to reopen the SSE stream for task ${deps.taskID}. Retrying in ${Math.round(deps.retryDelayMs / 1000)}s.`,
      diagnosticDetails: formatErrorDetails(err),
    })
    if (deps.isCurrent?.() === false || deps.currentTaskID() !== deps.taskID) return
    deps.scheduleRetry(() => {
      if (deps.isCurrent?.() === false || deps.currentTaskID() !== deps.taskID) return
      observeSseReconnect("scheduled-retry", performSseReconnect(deps))
    }, deps.retryDelayMs)
    return
  }
  recordConversationRecoverySucceeded({
    channel: "sse-reconnect",
    reason: "sse stream reconnect",
    taskID: deps.taskID,
    source: "sse-reconnect",
    durationMs: Date.now() - startedAt,
    resumeSequence: nextSequence,
  })
}

function observeSseReconnect(owner: string, promise: Promise<void>): void {
  void promise.catch((error) => {
    AppLog.error("sse", `unhandled reconnect owner failure: ${owner}`, {
      error: formatErrorDetails(error),
      diagnosticID: `sse:reconnect-owner:${owner}`,
      diagnosticTitle: "Live stream reconnect failed",
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticDetails: formatErrorDetails(error),
    })
  })
}

function refreshComposerModelAfterSelectedStreamConnect(eventType: "task.connected" | "session.connected"): void {
  void refreshActiveComposerModelFromSession()?.catch((error) => {
    AppLog.error("sse", `failed to hydrate Composer model after ${eventType}`, {
      eventType,
      error: formatErrorDetails(error),
      diagnosticID: `sse:composer-model-hydration:${eventType}`,
      diagnosticTitle: "Composer model refresh failed",
      diagnosticMessage: `The selected root Session model could not be refreshed after ${eventType}.`,
      diagnosticDetails: formatErrorDetails(error),
    })
  })
}

/**
 * Failure backoff: how long to wait before reopening a stream that dropped for
 * a reason we do not understand — transport error, server restart, watchdog
 * stall. Exported because components/ConnectionBanner.tsx derives its grace
 * period from it: a banner that fires faster than one scheduled reconnect
 * would paint a disconnected state on every routine reopen.
 */
export const STREAM_RECONNECT_DELAY_MS = 3000
/**
 * A `task.live_replay_expired` close is not a failure: the server is up, it
 * answered us, and it asked us to reopen with a reset live cursor. Paying the
 * failure backoff for a handshake the server itself directed leaves the live
 * stream dark for three seconds with nothing wrong.
 */
export const LIVE_REPLAY_REOPEN_DELAY_MS = 0
export const SELECTED_TASK_STREAM_STALL_MS = 35_000

export function performSessionSseReconnect(input: {
  source: Extract<BoardSource, { kind: "session" }>
  directory?: string
  isCurrent: () => boolean
  restart: typeof startSSE
}): void {
  if (!input.isCurrent()) return
  input.restart(input.source, 0, { directory: input.directory })
}

function clearSelectedStreamWatchdog(): void {
  if (!sseWatchdogTimer) return
  clearTimeout(sseWatchdogTimer)
  sseWatchdogTimer = null
}

export function isSelectedTaskSSEConnected(taskID: string): boolean {
  return !!taskID && sseTaskID === taskID && sseHandle !== null && messageStore.sseConnected
}

const selectedTaskRecoveryScheduler = createSelectedTaskRecoveryScheduler(startSSE)

export function startSSE(source: BoardSource, after = 0, options: SseStartOptions = {}) {
  stopSSE()
  const streamGeneration = ++selectedTaskStreamGeneration
  setSseConnected(false)
  sseSource = source
  const taskID = source.kind === "task" ? source.id : ""
  sseTaskID = taskID
  const replayLive = options.replayLive !== false
  const directory = options.directory?.trim()
    ? registerConversationSourceDirectory(source, options.directory)
    : conversationSourceDirectory(source)

  // Initial task restore now hydrates board + messages + persisted task events
  // through /task/:id/conversation before opening SSE. That means this stream
  // can safely resume from the last persisted protocol_event sequence instead
  // of replaying from zero on every reconnect.
  const transport = getHostTransport()
  let liveReplayExpiredClose = false
  const armWatchdog = (handle: StreamHandle) => {
    clearSelectedStreamWatchdog()
    sseWatchdogTimer = setTimeout(() => {
      if (handle !== sseHandle) return
      console.warn("[sse] selected task stream stalled; reconnecting", { taskID })
      setSseConnected(false)
      handle.close("watchdog")
      if (handle === sseHandle) handleClosed("watchdog-stalled")
    }, SELECTED_TASK_STREAM_STALL_MS)
    if (typeof (sseWatchdogTimer as { unref?: () => void }).unref === "function") {
      ;(sseWatchdogTimer as { unref?: () => void }).unref!()
    }
  }
  const handleClosed = (_reason: string) => {
    // Permanent close: re-open from the current selected task sequence.
    // Same-task full hydrate is intentionally forbidden here because it
    // clears cardTreeStore and produces the visible scroll jump.
    if (streamGeneration !== selectedTaskStreamGeneration || handle !== sseHandle) return
    clearSelectedStreamWatchdog()
    pauseSelectedTaskSseStreamActivity(taskID)
    setSseConnected(false)
    sseHandle = null
    sseTaskID = ""
    sseSource = null
    if (source.kind === "session") {
      if (sseRetryTimer) clearTimeout(sseRetryTimer)
      sseRetryTimer = setTimeout(() => {
        sseRetryTimer = null
        performSessionSseReconnect({
          source,
          directory,
          isCurrent: () => streamGeneration === selectedTaskStreamGeneration,
          restart: startSSE,
        })
      }, STREAM_RECONNECT_DELAY_MS)
      return
    }
    if (sseRetryTimer) clearTimeout(sseRetryTimer)
    sseRetryTimer = setTimeout(() => {
      sseRetryTimer = null
      observeSseReconnect(
        "stream-close",
        performSseReconnect({
          taskID: source.id,
          directory,
          after,
          currentTaskID: () => activeTaskID(),
          isCurrent: () => streamGeneration === selectedTaskStreamGeneration,
          resumeAfter: () => boardStore.taskSequence,
          restart: startSSE,
          replayLive: liveReplayExpiredClose ? false : replayLive,
          beforeRestart: liveReplayExpiredClose
            ? (restartedTaskID) => mergeLatestConversationTail(restartedTaskID, { directory })
            : undefined,
          scheduleRetry: (fn, ms) => {
            sseRetryTimer = setTimeout(() => {
              sseRetryTimer = null
              fn()
            }, ms)
          },
          // A restart that *fails* still backs off: at that point we no longer
          // know the server is healthy.
          retryDelayMs: STREAM_RECONNECT_DELAY_MS,
        }),
      )
    }, liveReplayExpiredClose ? LIVE_REPLAY_REOPEN_DELAY_MS : STREAM_RECONNECT_DELAY_MS)
  }
  const handle = transport.openStream(
    {
      path: `${source.kind}/${encodeURIComponent(source.id)}/events`,
      query: {
        directory,
        ...(source.kind === "task" && after > 0 ? { after: String(after) } : {}),
        ...(source.kind === "task" ? selectedLiveReplayQuery({ include: replayLive }) : {}),
      },
    },
    {
      onOpen: () => {
        if (handle !== sseHandle) return
        setSseConnected(true)
        armWatchdog(handle)
      },
      onEvent: (data) => {
        if (handle !== sseHandle) return
        armWatchdog(handle)
        // Per 07-panel-reactivity.md constraint 1 and root CLAUDE.md rule 1:
        // tree-writer's `let it crash` is meaningless if onEvent silently
        // swallows malformed input or dispatch failures. Both paths surface
        // through AppLog so the operator can diagnose an empty panel.
        let event: any
        try {
          event = JSON.parse(data)
        } catch (error) {
          logMalformedSsePayload({ stream: "selected-task", taskID, directory, data, error })
          return
        }
        if (event.type === "task.heartbeat" || event.type === "session.heartbeat") return
        if (event.type === "task.connected" || event.type === "session.connected") {
          refreshComposerModelAfterSelectedStreamConnect(event.type)
          return
        }
        recordSelectedTaskSseUpdate(event, taskID)
        if (event.type === "task.live_replay_expired") {
          liveReplayExpiredClose = true
          resetSelectedLiveCursor()
        }
        try {
          const handled = routeSSEEvent(event, selectedTaskRecoveryScheduler)
          if (!handled) {
            handleEventStreamEvent(event, selectedTaskRecoveryScheduler)
          }
        } catch (err) {
          const diagnostic = dispatchEventDiagnostic(event)
          const errorDetails = boundedErrorDetails(err)
          AppLog.error("sse", `dispatch error for event ${event?.type || "<unknown>"}`, {
            taskID,
            eventType: event?.type || "<unknown>",
            error: errorDetails,
            event: diagnostic,
            diagnosticID: `sse:dispatch-error:${taskID}`,
            diagnosticTitle: "Conversation event failed to render",
            diagnosticMessage: `Event type ${event?.type || "<unknown>"} threw while updating the conversation panel.`,
            diagnosticDetails: dispatchNotificationDetails(errorDetails, event),
          })
        }
      },
      onError: () => {
        // SSE (Server-Sent Events) errors can happen after the browser
        // transport has already dropped live-only message deltas. Close the
        // handle so onClose runs the business reconnect policy: reopen from
        // the current persisted sequence without clearing the mounted
        // conversation.
        if (handle !== sseHandle) return
        setSseConnected(false)
        handle.close("transport-error")
      },
      onClose: (_reason) => {
        handleClosed(_reason)
      },
    },
  )
  sseHandle = handle
  setSseExpected(true)
  armWatchdog(handle)
}

export function stopSSE() {
  selectedTaskStreamGeneration += 1
  if (sseRetryTimer) {
    clearTimeout(sseRetryTimer)
    sseRetryTimer = null
  }
  clearSelectedStreamWatchdog()
  const handle = sseHandle
  const taskID = sseTaskID
  pauseSelectedTaskSseStreamActivity(taskID)
  sseHandle = null
  sseTaskID = ""
  sseSource = null
  if (handle) handle.close("consumer-dispose")
  setSseConnected(false)
  setSseExpected(false)
}

// ── Unified Work Ledger change stream ──
let workLedgerHandle: StreamHandle | null = null
let workLedgerRetryTimer: any = null
export type { WorkLedgerStreamEvent }

export function parseWorkLedgerStreamEvent(value: unknown): WorkLedgerStreamEvent {
  return WorkLedgerActionEvent.parse(value)
}

let workLedgerChangeHandler: ((event: WorkLedgerStreamEvent) => void) | null = null
const mailboxChangeHandlers = new Set<() => void>()

function dispatchMailboxRefresh(): void {
  for (const handler of mailboxChangeHandlers) {
    try {
      handler()
    } catch (error) {
      AppLog.error("sse", "mailbox notification handler failed", {
        error: boundedErrorDetails(error),
        diagnosticID: "work-ledger-sse:mailbox-dispatch-error",
      })
    }
  }
}

export function subscribeMailboxChanges(
  handler: () => void,
): () => void {
  mailboxChangeHandlers.add(handler)
  return () => mailboxChangeHandlers.delete(handler)
}

export function setWorkLedgerChangeHandler(handler: ((event: WorkLedgerStreamEvent) => void) | null): void {
  workLedgerChangeHandler = handler
  if (!handler) stopWorkLedgerSSE()
}

export function startWorkLedgerSSE() {
  stopWorkLedgerSSE()
  if (!workLedgerChangeHandler) return
  const transport = getHostTransport()
  const handle = transport.openStream(
    { path: "work-ledger/events" },
    {
      onEvent: (data) => {
        let event: unknown
        try {
          event = JSON.parse(data)
        } catch (error) {
          logMalformedSsePayload({ stream: "work-ledger", data, error })
          return
        }
        const parsed = WorkLedgerEvent.safeParse(event)
        if (!parsed.success) {
          const error = parsed.error
          logMalformedSsePayload({ stream: "work-ledger", data, error })
          return
        }
        if (parsed.data.type === "mailbox.changed") {
          dispatchMailboxRefresh()
          return
        }
        if (parsed.data.type === "work-ledger.connected") {
          dispatchMailboxRefresh()
          return
        }
        if (parsed.data.type === "work-ledger.heartbeat") return
        const workLedgerEvent: WorkLedgerStreamEvent = parsed.data
        try {
          if (workLedgerEvent.type === "work-ledger.changed" && workLedgerEvent.taskID) {
            handleTaskListNotification(
              {
                type: workLedgerEvent.sourceType,
                taskID: workLedgerEvent.taskID,
                sequence: workLedgerEvent.sequence,
              },
              { directory: workLedgerEvent.directory || settingsStore.directory },
              selectedTaskRecoveryScheduler,
            )
          }
          workLedgerChangeHandler?.(workLedgerEvent)
        } catch (err) {
          const errorDetails = boundedErrorDetails(err)
          AppLog.error("sse", "work ledger change handler failed", {
            eventType: workLedgerEvent.type,
            error: errorDetails,
            event: dispatchEventDiagnostic(workLedgerEvent),
            diagnosticID: "work-ledger-sse:dispatch-error",
            diagnosticTitle: "Work Ledger event failed to render",
            diagnosticMessage: "A Work Ledger change event threw while refreshing the sidebar.",
            diagnosticDetails: dispatchNotificationDetails(errorDetails, workLedgerEvent),
          })
        }
      },
      onClose: (_reason) => {
        if (handle !== workLedgerHandle) return
        workLedgerHandle = null
        if (workLedgerRetryTimer) clearTimeout(workLedgerRetryTimer)
        workLedgerRetryTimer = setTimeout(() => {
          workLedgerRetryTimer = null
          startWorkLedgerSSE()
        }, 3000)
      },
      onError: () => {
        if (handle !== workLedgerHandle) return
        handle.close("transport-error")
      },
    },
  )
  workLedgerHandle = handle
}

export function stopWorkLedgerSSE() {
  if (workLedgerRetryTimer) {
    clearTimeout(workLedgerRetryTimer)
    workLedgerRetryTimer = null
  }
  const handle = workLedgerHandle
  workLedgerHandle = null
  if (handle) handle.close("consumer-dispose")
}
