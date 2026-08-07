import { batch } from "solid-js"
import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"
import {
  applyEvent as replayTaskEventToTree,
  applyConversationTurnArtifacts,
  commitPreparedConversationView,
  commitStandaloneQuestionInteractions,
  deferConversationTreeProjection,
  prepareConversationView,
  prepareStandaloneQuestionInteractions,
  resetWriter,
  validateConversationBoardInteractions,
} from "./tree-writer"
import { cancelMarkdownRenderPrewarm, prewarmMarkdownRenderCache } from "../utils/markdown"
import {
  boardStore,
  setBoardStore,
  setBoardData,
  setTaskSequence,
  activeTaskID,
  activeSessionID,
  type BoardSource,
  validateBoardData,
} from "../store/board"
import { cardTreeStore, publishedCardTreeVersion, setHydratedRewindCursor } from "../store/card-tree"
import {
  attachConversationAgentViewTargets,
  clearConversationAgentRenderedTargets,
  conversationAgentRecordsForSource,
  hydrateConversationAgentView,
  resetConversationAgentView,
  type ConversationAgentView,
  validateConversationAgentView,
} from "../store/conversation-agents"
import { markSelectedMessageWatermark } from "./selected-stream-cursor"
import {
  recordSelectedTaskSseEventActivity,
  recordSelectedTaskSseSnapshot,
  selectedTaskSseActivityAt,
} from "./task-runtime-activity"
import { formatErrorDetails } from "./diagnostics"
import { AppLog } from "../utils/log"
import { isSubagentActivityRecord } from "../utils/subagent-presentation"
import { conversationEventOwner } from "./event-policy"

type EventReplay = {
  cursor: number
  latestSequence: number
  complete: boolean
  limit: number
  sinceTimestamp: number | null
}

type HistoryState = {
  oldestTimestamp: number | null
  oldestOrderKey: string | null
  oldestMessageID: string | null
  hasMore: boolean
  limit: number
}

const INITIAL_CONVERSATION_TAIL_LIMIT = 80
const LIVE_MESSAGE_CHANGE_TAIL_LIMIT = 32
const CONVERSATION_HISTORY_PAGE_LIMIT = 160
const MARKDOWN_PREWARM_MESSAGE_LIMIT = 24

let replayEpoch = 0
let replayAbort: AbortController | null = null
let historyEpoch = 0
let historyAbort: AbortController | null = null
let tailMergeEpoch = 0
let tailMergeAbort: AbortController | null = null
let historySource: BoardSource | null = null
let scheduledTailMergeTaskID = ""
let scheduledTailMergeRunning = false
let scheduledTailMergeAgain = false
let historyState: HistoryState = {
  oldestTimestamp: null,
  oldestOrderKey: null,
  oldestMessageID: null,
  hasMore: false,
  limit: CONVERSATION_HISTORY_PAGE_LIMIT,
}
let historyLoading = false
const sourceDirectoryByKey = new Map<string, string>()

export function selectedConversationHasVisibleItems(): boolean {
  publishedCardTreeVersion()
  return (
    cardTreeStore.order.length > 0 ||
    conversationAgentRecordsForSource(boardStore.selectedSource).some(isSubagentActivityRecord)
  )
}

function logConversationAsyncError(
  context: string,
  error: unknown,
  extra: { taskID?: string; sessionID?: string; source?: string } = {},
): void {
  AppLog.error("conversation", context, {
    ...extra,
    error: formatErrorDetails(error),
    diagnosticID: `conversation:${context}:${extra.taskID || extra.sessionID || "global"}`,
    diagnosticTitle: "Conversation update failed",
    diagnosticMessage: context,
    diagnosticDetails: formatErrorDetails(error),
  })
}

export function cancelConversationReplay(): void {
  replayEpoch += 1
  historyEpoch += 1
  tailMergeEpoch += 1
  cancelMarkdownRenderPrewarm()
  replayAbort?.abort(new DOMException("Conversation replay superseded", "AbortError"))
  historyAbort?.abort(new DOMException("Conversation history superseded", "AbortError"))
  tailMergeAbort?.abort(new DOMException("Conversation tail merge superseded", "AbortError"))
  replayAbort = null
  historyAbort = null
  tailMergeAbort = null
  scheduledTailMergeTaskID = ""
  scheduledTailMergeRunning = false
  scheduledTailMergeAgain = false
  historyLoading = false
  historySource = null
  historyState = {
    oldestTimestamp: null,
    oldestOrderKey: null,
    oldestMessageID: null,
    hasMore: false,
    limit: CONVERSATION_HISTORY_PAGE_LIMIT,
  }
}

export function resetConversationProjection(options: { scrollIntent?: "preserve" | "bottom"; cause?: string }): void {
  batch(() => {
    resetConversationAgentView()
    resetWriter(options)
  })
}

function parseEventReplay(raw: any): EventReplay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("conversation hydrate missing eventReplay")
  }
  const replay = {
    cursor: Number(raw.cursor),
    latestSequence: Number(raw.latestSequence),
    complete: raw.complete === true,
    limit: Number(raw.limit),
    sinceTimestamp: raw.sinceTimestamp === null || raw.sinceTimestamp === undefined ? null : Number(raw.sinceTimestamp),
  }
  if (!Number.isInteger(replay.cursor) || replay.cursor < 0) {
    throw new Error(`conversation eventReplay.cursor invalid: ${JSON.stringify(raw)}`)
  }
  if (!Number.isInteger(replay.latestSequence) || replay.latestSequence < 0) {
    throw new Error(`conversation eventReplay.latestSequence invalid: ${JSON.stringify(raw)}`)
  }
  if (!Number.isInteger(replay.limit) || replay.limit <= 0) {
    throw new Error(`conversation eventReplay.limit invalid: ${JSON.stringify(raw)}`)
  }
  if (replay.sinceTimestamp !== null && !Number.isFinite(replay.sinceTimestamp)) {
    throw new Error(`conversation eventReplay.sinceTimestamp invalid: ${JSON.stringify(raw)}`)
  }
  return replay
}

function parseHistoryState(raw: any): HistoryState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("conversation hydrate missing history")
  }
  const oldestRaw = raw.oldestTimestamp
  const oldestTimestamp = oldestRaw === null || oldestRaw === undefined ? null : Number(oldestRaw)
  if (oldestTimestamp !== null && !Number.isFinite(oldestTimestamp)) {
    throw new Error(`conversation history oldestTimestamp invalid: ${JSON.stringify(raw)}`)
  }
  const oldestOrderKey =
    typeof raw.oldestOrderKey === "string" && raw.oldestOrderKey.trim() ? raw.oldestOrderKey.trim() : null
  if (raw.hasMore === true && !oldestOrderKey) {
    throw new Error(`conversation history oldestOrderKey required when hasMore=true: ${JSON.stringify(raw)}`)
  }
  const limit = Number(raw.limit)
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`conversation history limit invalid: ${JSON.stringify(raw)}`)
  }
  return {
    oldestTimestamp,
    oldestOrderKey,
    oldestMessageID: typeof raw.oldestMessageID === "string" && raw.oldestMessageID ? raw.oldestMessageID : null,
    hasMore: raw.hasMore === true,
    limit,
  }
}

function requireArray(raw: any, name: string): any[] {
  if (!Array.isArray(raw)) throw new Error(`conversation payload ${name} must be an array`)
  return raw
}

function requireObject(raw: any, name: string): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`conversation payload ${name} must be an object`)
  }
  return raw
}

function parseConversationTurnArtifacts(
  raw: any,
): Array<NonNullable<import("../store/card-tree").CardNode["turnArtifacts"]>[number]> {
  return requireArray(raw, "turn artifacts").map((value, index) => {
    const summary = requireObject(value, `turn artifacts[${index}]`)
    const task = requireObject(summary.task, `turn artifacts[${index}].task`)
    const messageID = String(summary.messageID || "").trim()
    const userMessageID = String(summary.userMessageID || "").trim()
    const taskID = String(task.id || "").trim()
    const status = String(task.status || "")
    if (!messageID || !userMessageID || !taskID) {
      throw new Error(`turn artifacts[${index}] is missing message or Task identity`)
    }
    if (status !== "completed" && status !== "failed" && status !== "cancelled") {
      throw new Error(`turn artifacts[${index}].task.status invalid: ${JSON.stringify(task.status)}`)
    }
    return {
      messageID,
      userMessageID,
      task: {
        id: taskID,
        title: String(task.title || ""),
        status,
        ...(typeof task.reason === "string" && task.reason ? { reason: task.reason } : {}),
      },
      entries: requireArray(summary.entries, `turn artifacts[${index}].entries`),
      catalogComplete: summary.catalogComplete === true,
      providerErrors: requireArray(summary.providerErrors, `turn artifacts[${index}].providerErrors`),
    }
  })
}

export async function refreshConversationTurnArtifacts(): Promise<void> {
  const source = boardStore.selectedSource
  const directory = String(source?.directory || (boardStore.board as any)?.directory || "").trim()
  if (!source || !directory) return
  if (source.kind === "session" && source.sessionKind !== "mission") return
  const path =
    source.kind === "task"
      ? `task/${encodeURIComponent(source.id)}/turn-artifacts`
      : `session/${encodeURIComponent(source.id)}/turn-artifacts`
  const summaries = parseConversationTurnArtifacts(
    await apiJson(directoryScopedPath(path, directory, "refresh conversation turn artifacts")),
  )
  batch(() => applyConversationTurnArtifacts(summaries))
}

function requireNonnegativeInteger(raw: any, name: string): number {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`conversation payload ${name} must be a nonnegative integer`)
  }
  return value
}

function parseMessageWatermark(raw: any): number {
  const value = Number(raw ?? 0)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`conversation messageWatermark invalid: ${JSON.stringify(raw)}`)
  }
  return Math.floor(value)
}

function parseRewindCursor(raw: any): number | null {
  if (raw === null || raw === undefined) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`conversation board rewindCursor invalid: ${JSON.stringify(raw)}`)
  }
  return value
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

function selectedTaskActivityTimestamp(input: { events: any[]; messageWatermark: number; taskID: string }): number {
  let activityAt = input.messageWatermark
  for (const event of input.events) {
    const taskID = eventTaskID(event)
    if (taskID && taskID !== input.taskID) continue
    activityAt = Math.max(activityAt, selectedTaskSseActivityAt(event))
  }
  return activityAt
}

function recordHydratedSelectedTaskActivity(input: {
  board: Record<string, unknown>
  events: any[]
  messageWatermark: number
  taskID: string
}): void {
  const task = (input.board as any).task
  recordSelectedTaskSseSnapshot({
    task,
    taskID: input.taskID,
    active: task?.status === "active",
    activityAt: selectedTaskActivityTimestamp(input),
  })
}

function recordReplayedSelectedTaskEventActivity(taskID: string, event: any): void {
  const task = boardStore.board?.task
  recordSelectedTaskSseEventActivity({
    event,
    task,
    taskID,
    active: task?.status === "active",
  })
}

function rollbackConversationProjection(cause: string, scrollIntent: "preserve" | "bottom" = "preserve"): void {
  setBoardStore("board", null)
  setTaskSequence(0)
  resetConversationProjection({ scrollIntent, cause })
}

function commitConversationEvents(input: {
  events: any[]
  cause: string
  taskID?: string
  assertActive?: () => void
}): void {
  batch(() => {
    try {
      deferConversationTreeProjection(() => {
        for (const event of input.events) {
          input.assertActive?.()
          if (input.taskID) recordReplayedSelectedTaskEventActivity(input.taskID, event)
          if (conversationEventOwner(event?.type) === "tree-writer") {
            replayTaskEventToTree(event)
          }
        }
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        rollbackConversationProjection(`${input.cause}-rollback`)
      }
      throw error
    }
  })
}

function prewarmTranscriptMarkdown(transcript: readonly unknown[]): void {
  const sources: string[] = []
  const firstCandidate = Math.max(0, transcript.length - MARKDOWN_PREWARM_MESSAGE_LIMIT)
  for (let messageIndex = firstCandidate; messageIndex < transcript.length; messageIndex += 1) {
    const message = transcript[messageIndex]
    const parts = Array.isArray((message as any)?.parts) ? (message as any).parts : []
    for (const part of parts) {
      const type = String(part?.type || "")
      if (type !== "text" && type !== "reasoning") continue
      const text = String(part?.text || "")
      if (text) sources.push(text)
    }
  }
  prewarmMarkdownRenderCache(sources)
}

function sourceKey(source: BoardSource): string {
  return `${source.kind}:${source.id}`
}

function requireDirectory(directory: string | undefined, label: string): string {
  const trimmed = String(directory || "").trim()
  if (!trimmed) throw new Error(`${label} requires a project directory`)
  return trimmed
}

export function registerConversationSourceDirectory(source: BoardSource, directory: string): string {
  const trimmed = requireDirectory(directory, "conversation source")
  sourceDirectoryByKey.set(sourceKey(source), trimmed)
  return trimmed
}

export function conversationSourceDirectory(source: BoardSource): string {
  const directory = sourceDirectoryByKey.get(sourceKey(source))
  if (!directory) throw new Error(`conversation source ${sourceKey(source)} has no project directory`)
  return directory
}

function activeSourceMatches(source: BoardSource): boolean {
  return source.kind === "task" ? activeTaskID() === source.id : activeSessionID() === source.id
}

function sourceMatches(left: BoardSource | null, right: BoardSource | null): boolean {
  return !!left && !!right && left.kind === right.kind && left.id === right.id
}

function conversationHydratePath(source: BoardSource, tailLimit: number, directory: string): string {
  const prefix = source.kind === "task" ? "task" : "session"
  const params = new URLSearchParams({ tail_limit: String(tailLimit) })
  const trimmed = String(directory || "").trim()
  if (trimmed) params.set("directory", trimmed)
  return `${prefix}/${encodeURIComponent(source.id)}/conversation?${params.toString()}`
}

function conversationRequestDirectory(source: BoardSource, directory: string | undefined): string {
  const trimmed = String(directory || "").trim()
  if (source.kind === "session") return requireDirectory(trimmed, "hydrateConversation")
  return trimmed
}

function hydratedTaskDirectory(board: Record<string, unknown>, taskID: string): string {
  const task = board.task
  if (!task || typeof task !== "object") throw new Error(`task ${taskID} conversation board missing task`)
  const directory = (task as Record<string, unknown>).directory
  return requireDirectory(typeof directory === "string" ? directory : "", `task ${taskID} conversation board`)
}

function hydratedConversationRootSessionID(source: BoardSource, board: Record<string, unknown>): string {
  if (source.kind === "session") {
    const kind = String(board.kind || "").trim()
    const sessionID = String(board.sessionID || "").trim()
    if (kind !== "session" || sessionID !== source.id) {
      throw new Error(
        `session ${source.id} conversation board identity mismatch: ${JSON.stringify({ kind, sessionID })}`,
      )
    }
    return sessionID
  }
  const task = board.task
  if (!task || typeof task !== "object") throw new Error(`task ${source.id} conversation board missing task`)
  const taskID = String((task as Record<string, unknown>).id || "").trim()
  if (taskID !== source.id) {
    throw new Error(`task ${source.id} conversation board identity mismatch: ${JSON.stringify({ taskID })}`)
  }
  const sessionID = String((task as Record<string, unknown>).sessionID || "").trim()
  if (!sessionID) throw new Error(`task ${source.id} conversation board missing root sessionID`)
  return sessionID
}

function assertActiveReplay(source: BoardSource, epoch: number, signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Conversation replay aborted", "AbortError")
  if (epoch !== replayEpoch) throw new DOMException("Conversation replay superseded", "AbortError")
  if (!activeSourceMatches(source)) throw new DOMException("Conversation replay source changed", "AbortError")
}

function assertActiveHistory(source: BoardSource, epoch: number, signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Conversation history aborted", "AbortError")
  if (epoch !== historyEpoch) throw new DOMException("Conversation history superseded", "AbortError")
  if (!activeSourceMatches(source) || !sourceMatches(historySource, source)) {
    throw new DOMException("Conversation history source changed", "AbortError")
  }
}

function assertActiveSessionHistory(taskID: string, epoch: number, signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Conversation history aborted", "AbortError")
  if (epoch !== historyEpoch) throw new DOMException("Conversation history superseded", "AbortError")
  if (activeTaskID() !== taskID) throw new DOMException("Conversation history source changed", "AbortError")
  if (historySource && !sourceMatches(historySource, { kind: "task", id: taskID })) {
    throw new DOMException("Conversation history source changed", "AbortError")
  }
}

function assertActiveTailMerge(taskID: string, epoch: number, signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Conversation tail merge aborted", "AbortError")
  if (epoch !== tailMergeEpoch) throw new DOMException("Conversation tail merge superseded", "AbortError")
  if (activeTaskID() !== taskID) throw new DOMException("Conversation tail merge task changed", "AbortError")
}

function linkedReplayController(signal?: AbortSignal): AbortController {
  const controller = new AbortController()
  if (!signal) return controller
  if (signal.aborted) {
    controller.abort(signal.reason ?? new DOMException("Conversation replay aborted", "AbortError"))
    return controller
  }
  signal.addEventListener(
    "abort",
    () => {
      controller.abort(signal.reason ?? new DOMException("Conversation replay aborted", "AbortError"))
    },
    { once: true },
  )
  return controller
}

function waitForReplayTurn(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw signal.reason ?? new DOMException("Conversation replay aborted", "AbortError")
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, 0)
    function done() {
      signal.removeEventListener("abort", abort)
      resolve()
    }
    function abort() {
      clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      reject(signal.reason ?? new DOMException("Conversation replay aborted", "AbortError"))
    }
    signal.addEventListener("abort", abort, { once: true })
  })
}

async function continueConversationReplay(
  taskID: string,
  directory: string,
  initialReplay: EventReplay,
  epoch: number,
  signal: AbortSignal,
): Promise<EventReplay> {
  let replay = initialReplay
  while (!replay.complete) {
    assertActiveReplay({ kind: "task", id: taskID }, epoch, signal)
    await waitForReplayTurn(signal)
    const sinceQuery =
      replay.sinceTimestamp === null ? "" : `&since=${encodeURIComponent(String(replay.sinceTimestamp))}`
    const page = await apiJson(
      `task/${encodeURIComponent(taskID)}/conversation/events?directory=${encodeURIComponent(directory)}&after=${encodeURIComponent(String(replay.cursor))}&until=${encodeURIComponent(String(replay.latestSequence))}&limit=${encodeURIComponent(String(replay.limit))}${sinceQuery}`,
      { signal },
    )
    assertActiveReplay({ kind: "task", id: taskID }, epoch, signal)
    const events = requireArray(page?.events, "events")
    const nextReplay = parseEventReplay(page?.eventReplay)
    if (!nextReplay.complete && nextReplay.cursor <= replay.cursor) {
      throw new Error(`conversation replay cursor did not advance: cursor=${replay.cursor}, next=${nextReplay.cursor}`)
    }
    commitConversationEvents({
      events,
      taskID,
      cause: "conversation-protocol-replay",
      assertActive: () => assertActiveReplay({ kind: "task", id: taskID }, epoch, signal),
    })
    replay = nextReplay
  }
  return replay
}

export async function hydrateTaskConversation(
  taskID: string,
  options: {
    signal?: AbortSignal
    scrollIntent?: "preserve" | "bottom"
    resetCause?: string
    tailLimit?: number
    directory?: string
  } = {},
): Promise<number> {
  return hydrateConversation({ kind: "task", id: taskID }, options)
}

export async function loadConversation(
  source: BoardSource,
  options: {
    signal?: AbortSignal
    scrollIntent?: "preserve" | "bottom"
    resetCause?: string
    tailLimit?: number
    directory?: string
  } = {},
): Promise<number> {
  return hydrateConversation(source, options)
}

export async function hydrateConversation(
  source: BoardSource,
  options: {
    signal?: AbortSignal
    scrollIntent?: "preserve" | "bottom"
    resetCause?: string
    tailLimit?: number
    directory?: string
  } = {},
): Promise<number> {
  cancelConversationReplay()
  const controller = linkedReplayController(options.signal)
  replayAbort = controller
  const epoch = replayEpoch
  const signal = controller.signal
  let backgroundReplay = false
  try {
    const tailLimit = Math.max(
      1,
      Math.floor(Number(options.tailLimit ?? INITIAL_CONVERSATION_TAIL_LIMIT) || INITIAL_CONVERSATION_TAIL_LIMIT),
    )
    const requestDirectory = conversationRequestDirectory(source, options.directory)
    if (requestDirectory) registerConversationSourceDirectory(source, requestDirectory)
    const data = await apiJson(conversationHydratePath(source, tailLimit, requestDirectory), { signal })
    assertActiveReplay(source, epoch, signal)
    const board = requireObject(data?.board, "board")
    const rootSessionID = hydratedConversationRootSessionID(source, board)
    const responseDirectory = source.kind === "task" ? hydratedTaskDirectory(board, source.id) : requestDirectory
    const transcript = requireArray(data?.transcript, "transcript")
    const pendingQuestions = source.kind === "session" ? requireArray(data?.pendingQuestions, "pendingQuestions") : []
    const events = requireArray(data?.events, "events")
    const view = requireObject(data?.view, "view")
    const agentView = requireObject(data?.agentView, "agentView") as unknown as ConversationAgentView
    const turnArtifacts = parseConversationTurnArtifacts(data?.turnArtifacts)
    const replay =
      source.kind === "task"
        ? parseEventReplay(data?.eventReplay)
        : { cursor: 0, latestSequence: 0, complete: true, limit: CONVERSATION_HISTORY_PAGE_LIMIT, sinceTimestamp: null }
    const history = parseHistoryState(data?.history)
    const messageWatermark = parseMessageWatermark(data?.messageWatermark)
    const rewindCursor = parseRewindCursor((board as any).rewindCursor)
    const lastSequence = source.kind === "task" ? requireNonnegativeInteger(data?.lastSequence, "lastSequence") : 0
    const preparedQuestions = prepareStandaloneQuestionInteractions(pendingQuestions)
    const preparedConversation = prepareConversationView(view, transcript)
    validateConversationBoardInteractions(board, preparedQuestions)
    if (source.kind === "task") validateBoardData(board)
    validateConversationAgentView(agentView, {
      rootSessionID,
    })
    const directory = registerConversationSourceDirectory(source, responseDirectory)

    const hydrateCause = options.resetCause ?? "conversation-hydrate"
    batch(() => {
      try {
        deferConversationTreeProjection(() => {
          clearConversationAgentRenderedTargets(sourceKey(source))
          resetWriter({
            scrollIntent: options.scrollIntent ?? "preserve",
            cause: hydrateCause,
          })
          commitStandaloneQuestionInteractions(preparedQuestions)
          if (source.kind === "task") {
            setBoardData(board, { notifyProjection: false })
            setTaskSequence(Number.isFinite(lastSequence) && lastSequence > 0 ? lastSequence : 0)
          } else {
            setBoardStore("board", board)
            setTaskSequence(0)
          }
          commitPreparedConversationView(preparedConversation)
          hydrateConversationAgentView(sourceKey(source), agentView, { validated: true })
          setHydratedRewindCursor(rewindCursor)
          markSelectedMessageWatermark(messageWatermark)
          commitConversationEvents({
            events,
            ...(source.kind === "task" ? { taskID: source.id } : {}),
            cause: "conversation-hydrate-events",
            assertActive: () => assertActiveReplay(source, epoch, signal),
          })
        })
        applyConversationTurnArtifacts(turnArtifacts)
      } catch (error) {
        rollbackConversationProjection(`${hydrateCause}-rollback`, options.scrollIntent ?? "preserve")
        throw error
      }
    })
    prewarmTranscriptMarkdown(transcript)
    historySource = source
    historyState = history
    if (source.kind === "task") {
      recordHydratedSelectedTaskActivity({
        board,
        events,
        messageWatermark,
        taskID: source.id,
      })
    }

    if (source.kind === "task" && history.hasMore && !replay.complete) {
      backgroundReplay = true
      void continueConversationReplay(source.id, directory, replay, epoch, signal)
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          logConversationAsyncError("background protocol replay failed", error, {
            taskID: source.id,
            source: "background-replay",
          })
        })
        .finally(() => {
          if (replayAbort === controller) replayAbort = null
        })
      return Math.max(lastSequence, replay.latestSequence)
    }
    const finalReplay =
      source.kind === "task" ? await continueConversationReplay(source.id, directory, replay, epoch, signal) : replay
    return Math.max(lastSequence, finalReplay.latestSequence)
  } finally {
    if (replayAbort === controller && !backgroundReplay) replayAbort = null
  }
}

export async function mergeLatestConversationTail(
  taskID: string,
  options: {
    signal?: AbortSignal
    tailLimit?: number
    directory?: string
  } = {},
): Promise<void> {
  const selectedTaskID = String(taskID || "")
  if (!selectedTaskID) throw new Error("conversation tail merge requires a taskID")
  const directory = options.directory?.trim() || conversationSourceDirectory({ kind: "task", id: selectedTaskID })
  tailMergeAbort?.abort(new DOMException("Conversation tail merge superseded", "AbortError"))
  const controller = linkedReplayController(options.signal)
  tailMergeAbort = controller
  const epoch = ++tailMergeEpoch
  const signal = controller.signal
  try {
    const tailLimit = Math.max(
      1,
      Math.floor(Number(options.tailLimit ?? INITIAL_CONVERSATION_TAIL_LIMIT) || INITIAL_CONVERSATION_TAIL_LIMIT),
    )
    const data = await apiJson(
      `task/${encodeURIComponent(selectedTaskID)}/conversation?directory=${encodeURIComponent(directory)}&tail_limit=${encodeURIComponent(String(tailLimit))}`,
      { signal },
    )
    assertActiveTailMerge(selectedTaskID, epoch, signal)
    const board = requireObject(data?.board, "board")
    const transcript = requireArray(data?.transcript, "transcript")
    const events = requireArray(data?.events, "events")
    const view = requireObject(data?.view, "view")
    const agentView = requireObject(data?.agentView, "agentView") as unknown as ConversationAgentView
    const turnArtifacts = parseConversationTurnArtifacts(data?.turnArtifacts)
    const history = parseHistoryState(data?.history)
    const messageWatermark = parseMessageWatermark(data?.messageWatermark)
    const rewindCursor = parseRewindCursor((board as any).rewindCursor)
    requireNonnegativeInteger(data?.lastSequence, "lastSequence")
    const preparedConversation = prepareConversationView(view, transcript)
    validateConversationBoardInteractions(board)
    validateBoardData(board)
    validateConversationAgentView(agentView, {
      rootSessionID: hydratedConversationRootSessionID({ kind: "task", id: selectedTaskID }, board),
    })

    batch(() => {
      try {
        deferConversationTreeProjection(() => {
          clearConversationAgentRenderedTargets(sourceKey({ kind: "task", id: selectedTaskID }))
          resetWriter({
            scrollIntent: "preserve",
            cause: "conversation-tail-merge",
          })
          setBoardData(board, { notifyProjection: false })
          commitPreparedConversationView(preparedConversation)
          hydrateConversationAgentView(sourceKey({ kind: "task", id: selectedTaskID }), agentView, { validated: true })
          setHydratedRewindCursor(rewindCursor)
          markSelectedMessageWatermark(messageWatermark)
          commitConversationEvents({
            events,
            taskID: selectedTaskID,
            cause: "conversation-tail-merge-events",
            assertActive: () => assertActiveTailMerge(selectedTaskID, epoch, signal),
          })
        })
        applyConversationTurnArtifacts(turnArtifacts)
      } catch (error) {
        rollbackConversationProjection("conversation-tail-merge-rollback")
        throw error
      }
    })
    historySource = { kind: "task", id: selectedTaskID }
    historyState = history
    prewarmTranscriptMarkdown(transcript)
    recordHydratedSelectedTaskActivity({
      board,
      events,
      messageWatermark,
      taskID: selectedTaskID,
    })
  } finally {
    if (tailMergeAbort === controller) tailMergeAbort = null
  }
}

export function scheduleLatestConversationTailMerge(taskID: string): void {
  const selectedTaskID = String(taskID || "")
  if (!selectedTaskID) return
  scheduledTailMergeTaskID = selectedTaskID
  if (scheduledTailMergeRunning) {
    scheduledTailMergeAgain = true
    return
  }
  scheduledTailMergeRunning = true
  const run = async (): Promise<void> => {
    while (scheduledTailMergeTaskID) {
      const nextTaskID = scheduledTailMergeTaskID
      scheduledTailMergeTaskID = ""
      scheduledTailMergeAgain = false
      try {
        await mergeLatestConversationTail(nextTaskID, {
          tailLimit: LIVE_MESSAGE_CHANGE_TAIL_LIMIT,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") continue
        logConversationAsyncError("scheduled tail merge failed", error, {
          taskID: nextTaskID,
          source: "scheduled-tail-merge",
        })
      }
      if (!scheduledTailMergeAgain) break
    }
    scheduledTailMergeRunning = false
    if (scheduledTailMergeTaskID) scheduleLatestConversationTailMerge(scheduledTailMergeTaskID)
  }
  void run().catch((error) => {
    scheduledTailMergeRunning = false
    logConversationAsyncError("scheduled tail merge owner failed", error, {
      taskID: scheduledTailMergeTaskID,
      source: "scheduled-tail-merge",
    })
  })
}

export function canLoadOlderConversationHistory(source: BoardSource | null = boardStore.selectedSource): boolean {
  return (
    !!source &&
    sourceMatches(source, historySource) &&
    source.kind === "task" &&
    historyState.hasMore &&
    historyState.oldestTimestamp !== null &&
    historyState.oldestOrderKey !== null &&
    !historyLoading
  )
}

export function conversationCardContainsMessage(cardID: string, messageID: string): boolean {
  const targetCardID = String(cardID || "")
  const targetMessageID = String(messageID || "")
  if (!targetCardID || !targetMessageID) return false
  const seen = new Set<string>()
  const visit = (id: string): boolean => {
    if (!id || seen.has(id)) return false
    seen.add(id)
    const card = cardTreeStore.cards[id]
    if (!card) return false
    if (String((card as any).messageID || "") === targetMessageID) return true
    for (const part of card.parts || []) {
      if (String(part?.messageID || "") === targetMessageID) return true
    }
    for (const childID of card.childIDs || []) {
      if (visit(childID)) return true
    }
    return false
  }
  return visit(targetCardID)
}

export async function loadOlderConversationHistory(
  source: BoardSource | null = boardStore.selectedSource,
): Promise<boolean> {
  if (!source || source.kind !== "task") return false
  const selectedTaskID = String(source.id || "")
  if (!canLoadOlderConversationHistory(source)) return false
  const directory = conversationSourceDirectory(source)
  const before = historyState.oldestTimestamp
  const beforeOrderKey = historyState.oldestOrderKey
  const beforeID = historyState.oldestMessageID
  if (before === null || beforeOrderKey === null) return false
  historyLoading = true
  historyAbort?.abort(new DOMException("Conversation history superseded", "AbortError"))
  const controller = new AbortController()
  historyAbort = controller
  const epoch = ++historyEpoch
  try {
    assertActiveHistory(source, epoch, controller.signal)
    const page = await apiJson(
      `task/${encodeURIComponent(selectedTaskID)}/conversation/history?directory=${encodeURIComponent(directory)}&before=${encodeURIComponent(String(before))}&before_order_key=${encodeURIComponent(beforeOrderKey)}${beforeID ? `&before_id=${encodeURIComponent(beforeID)}` : ""}&limit=${encodeURIComponent(String(CONVERSATION_HISTORY_PAGE_LIMIT))}`,
      { signal: controller.signal },
    )
    assertActiveHistory(source, epoch, controller.signal)
    const transcript = requireArray(page?.transcript, "transcript")
    const events = requireArray(page?.events, "events")
    const view = requireObject(page?.view, "view")
    const nextHistory = parseHistoryState(page?.history)
    if (transcript.length === 0 && events.length === 0) {
      historyState = nextHistory
      return false
    }
    const preparedConversation = prepareConversationView(view, transcript)
    batch(() => {
      try {
        deferConversationTreeProjection(() => {
          commitPreparedConversationView(preparedConversation)
          attachConversationAgentViewTargets(sourceKey(source), view)
          commitConversationEvents({
            events,
            cause: "older-conversation-history-events",
            assertActive: () => assertActiveHistory(source, epoch, controller.signal),
          })
        })
      } catch (error) {
        rollbackConversationProjection("older-conversation-history-rollback")
        throw error
      }
    })
    prewarmTranscriptMarkdown(transcript)
    assertActiveHistory(source, epoch, controller.signal)
    historyState = nextHistory
    return true
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      logConversationAsyncError("older history load failed", error, {
        taskID: selectedTaskID,
        source: "older-history",
      })
    }
    throw error
  } finally {
    if (historyAbort === controller) {
      historyAbort = null
      historyLoading = false
    }
  }
}

export async function loadConversationSessionHistory(
  sessionID: string,
  taskID = activeTaskID(),
  options: { directory?: string } = {},
): Promise<boolean> {
  const selectedTaskID = String(taskID || "")
  const targetSessionID = String(sessionID || "")
  if (!selectedTaskID || !targetSessionID) return false
  const directory = options.directory?.trim() || conversationSourceDirectory({ kind: "task", id: selectedTaskID })
  historyLoading = true
  historyAbort?.abort(new DOMException("Conversation history superseded", "AbortError"))
  const controller = new AbortController()
  historyAbort = controller
  const epoch = ++historyEpoch
  const signal = controller.signal
  try {
    assertActiveSessionHistory(selectedTaskID, epoch, signal)
    const page = await apiJson(
      `task/${encodeURIComponent(selectedTaskID)}/conversation/session/${encodeURIComponent(targetSessionID)}?directory=${encodeURIComponent(directory)}`,
      { signal },
    )
    assertActiveSessionHistory(selectedTaskID, epoch, signal)
    const transcript = requireArray(page?.transcript, "transcript")
    const events = requireArray(page?.events, "events")
    const view = requireObject(page?.view, "view")
    if (transcript.length === 0 && events.length === 0) return false
    const preparedConversation = prepareConversationView(view, transcript)
    batch(() => {
      try {
        deferConversationTreeProjection(() => {
          commitPreparedConversationView(preparedConversation)
          attachConversationAgentViewTargets(sourceKey({ kind: "task", id: selectedTaskID }), view)
          commitConversationEvents({
            events,
            cause: "conversation-session-history-events",
            assertActive: () => assertActiveSessionHistory(selectedTaskID, epoch, signal),
          })
        })
      } catch (error) {
        rollbackConversationProjection("conversation-session-history-rollback")
        throw error
      }
    })
    prewarmTranscriptMarkdown(transcript)
    assertActiveSessionHistory(selectedTaskID, epoch, signal)
    return true
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      logConversationAsyncError("session history hydrate failed", error, {
        taskID: selectedTaskID,
        sessionID: targetSessionID,
        source: "session-history",
      })
    }
    throw error
  } finally {
    if (historyAbort === controller) {
      historyAbort = null
      historyLoading = false
    }
  }
}

export async function loadConversationHistoryUntilCard(
  cardID: string,
  taskID = activeTaskID(),
  options: {
    messageID?: string
    sessionID?: string
    directory?: string
  } = {},
): Promise<boolean> {
  const targetCardID = String(cardID || "")
  if (!targetCardID) return false
  const targetMessageID = String(options.messageID || "")
  const loaded = () =>
    !!cardTreeStore.cards[targetCardID] &&
    (!targetMessageID || conversationCardContainsMessage(targetCardID, targetMessageID))
  const targetSessionID = String(options.sessionID || "")
  const selectedSource = boardStore.selectedSource
  if (!loaded() && targetSessionID && selectedSource?.kind !== "session") {
    await loadConversationSessionHistory(targetSessionID, taskID, { directory: options.directory })
  }
  if (!loaded() && targetSessionID && selectedSource?.kind === "session") {
    await loadOlderConversationHistory(selectedSource)
  }
  const taskSource: BoardSource = { kind: "task", id: taskID }
  while (!loaded() && canLoadOlderConversationHistory(taskSource)) {
    const loaded = await loadOlderConversationHistory(taskSource)
    if (!loaded) break
  }
  return loaded()
}
