// ── Board Store ──
// Solid reactive store for board + task list data.
// Replaces direct reads of state.board / state.tasks.

import { createStore } from "solid-js/store"
import { batch } from "solid-js"
import { ApiError, apiJson, apiRequest } from "../services/api"
import { directoryScopedPath } from "../services/task-path"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { AppLog } from "../utils/log"
import { requireTimelineOrderKeyDomain } from "../utils/timeline-order"

// ── Store ──

export type BoardSource =
  | { kind: "task"; id: string; directory?: string }
  | {
      kind: "session"
      id: string
      directory?: string
      sessionKind?: "conversation" | "mission"
      experience?: "chat" | "work"
    }

export interface TaskSelectionError {
  taskID: string
  directory: string
  title: string
  details: string
}

export const [boardStore, setBoardStore] = createStore({
  board: null as any,
  tasks: [] as any[],
  selectedSource: null as BoardSource | null,
  taskSequence: 0 as number,
  loading: false,
  /** Monotonic counter incremented on each selectTask() call. Used to detect
   *  superseded loads when the user rapidly switches tasks: async phases
   *  capture the epoch at entry and bail out when boardStore.selectEpoch has
   *  advanced past it. */
  selectEpoch: 0 as number,
  /** True between selectTask() entry and its async load chain completing
   *  (applyDirectory + hydrateTaskConversation + startSSE). Drives the top-of-
   *  pane progress bar so cross-project task switches feel non-blocking. */
  taskSwitching: false,
  /** Last failed task hydrate. The selected task remains visible so the
   *  conversation surface can explain the failure and retry the same load. */
  taskSelectionError: null as TaskSelectionError | null,
  // ── Task list internals (mirrors state.pendingTasks / state.tasksSeq) ──
  /** Tasks that have been created locally but not yet confirmed by the server */
  pendingTasks: [] as any[],
  /** Monotonic counter incremented on each tasks-list refresh */
  tasksSeq: 0,
  // ── Board sync internals (mirrors state.boardEtag / state.boardQueued / etc.) ──
  /** ETag of the last board response, used for conditional fetches */
  boardEtag: "" as string,
  /** Whether a board reload is currently queued (debounce guard) */
  boardQueued: false,
  /** Retry attempt counter for board fetch failures */
  boardRetryCount: 0,
  /** Whether an in-flight board sync is pending */
  boardSyncPending: false,
  /** Snapshot version string returned by the server with the board payload */
  snapshotVersion: "" as string,
  // ── VCS state (mirrors state.path / state.vcs) ──
  /** Git path info object for the active working directory */
  path: null as any,
  /** Git / VCS status object for the active task */
  vcs: null as any,
  // ── File changes (mirrors state.changes) ──
  /** File change entries for the current task's working tree */
  changes: [] as any[],
  // ── Streaming previews ──
  /** Streaming preview text for the plan section */
  planPreview: "" as string,
  /** Streaming preview text for the spec section */
  specPreview: "" as string,
  /** Last error from loadTasks(); non-empty means the list is stale and UI
   *  must surface the error instead of rendering an empty list. Cleared on
   *  the next successful reload. */
  tasksError: "" as string,
  /** Flips true after the first successful loadTasks() round-trip
   *  completes, regardless of whether the list ended up empty. The
   *  TaskList component reads this to distinguish "still fetching"
   *  (skeleton rows) from "fetched but project really has zero tasks"
   *  (empty-hint copy). Stays true for the lifetime of the overlay
   *  unless tasksError is set. */
  tasksLoaded: false as boolean,
  tasksHasMore: false as boolean,
  tasksLoadedLimit: 0 as number,
  tasksCursorUpdated: null as number | null,
  tasksCursorTaskID: "" as string,
  tasksLoadingMore: false as boolean,
})

// ── Loaders ──

export interface LoadBoardOptions {
  sync?: boolean
  /** Require the current board reload to finish successfully and reject on failure. */
  requireFresh?: boolean
}

// Module-level runtime state (replaces .state proxy fields).
let _boardRetryTimer: ReturnType<typeof setTimeout> | null = null
let _boardLoading: Promise<void> | null = null
let _boardQueued = false
let _tasksLoading: Promise<void> | null = null
let _taskListGeneration = 0
let _taskListPaginationRequest = 0

export const TASK_LIST_PAGE_SIZE = 10

function invalidateTaskListPagination(): void {
  _taskListGeneration += 1
  _taskListPaginationRequest += 1
  setBoardStore("tasksLoadingMore", false)
}

// Invariant handler: fires when the current task source no longer refers
// to any task in the merged (tasks + pendingTasks) list. Registered by
// services/task.ts so that board.ts doesn't need to import selectTask (which
// would create a cycle). If not registered, the invariant silently degrades —
// that's a setup bug the app owner is expected to catch in init.
let _orphanedSelectionHandler: (() => void) | null = null
// Board-derived goal evidence, interaction cards, and attachment controls are
// projected by services/tree-writer.ts. Register a callback here so the
// projection runs exactly once after each applied board delta instead of
// relying on a shallow reactive read of `boardStore.board`.
let _boardProjectionHandler: (() => void) | null = null
let _taskListProjectionHandler: ((tasks: any[]) => void) | null = null

export function setOrphanedSelectionHandler(handler: (() => void) | null): void {
  _orphanedSelectionHandler = handler
}

export function setBoardProjectionHandler(handler: (() => void) | null): void {
  _boardProjectionHandler = handler
}

function notifyBoardProjection(): void {
  _boardProjectionHandler?.()
}

export function setTaskListProjectionHandler(handler: ((tasks: any[]) => void) | null): void {
  _taskListProjectionHandler = handler
}

function notifyTaskListProjection(tasks: any[]): void {
  _taskListProjectionHandler?.(tasks)
}

function selectionIsOrphaned(tasks: any[], pending: any[]): boolean {
  const id = activeTaskID()
  if (!id) return false
  // Stable-state guard: during selectTask()'s async phase a concurrent
  // loadTasks() response may not yet include the freshly-created task, and
  // firing the handler then would incorrectly reset a selection that is in
  // the process of being loaded. Once taskSwitching has settled, the
  // tasks/pending lists are the source of truth for whether the selection
  // still exists; requiring a loaded board snapshot lets an invalid task ID
  // survive forever after a failed task switch or cross-project mismatch.
  if (boardStore.taskSwitching) return false
  const inTasks = Array.isArray(tasks) && tasks.some((item: any) => item?.task?.id === id)
  if (inTasks) return false
  const inPending = Array.isArray(pending) && pending.some((item: any) => item?.task?.id === id || item?.id === id)
  return !inPending
}

function requireBoardSnapshotVersion(board: any): string {
  if (board == null || typeof board !== "object") {
    throw new Error("board payload must include snapshotVersion")
  }
  const version = board?.snapshotVersion
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("board.snapshotVersion must be a non-empty string")
  }
  return version
}

function selectedTaskOwningDirectory(taskID: string): string {
  const boardTask = boardStore.board?.task
  const boardDirectory =
    boardTask?.id === taskID && typeof boardTask.directory === "string" ? boardTask.directory.trim() : ""
  const row = boardStore.tasks.find((item: any) => item?.task?.id === taskID)
  const rowDirectory = typeof row?.task?.directory === "string" ? row.task.directory.trim() : ""
  const selectedSource = boardStore.selectedSource
  const sourceDirectory =
    selectedSource?.kind === "task" && selectedSource.id === taskID && typeof selectedSource.directory === "string"
      ? selectedSource.directory.trim()
      : ""
  const directories = [boardDirectory, rowDirectory, sourceDirectory].filter(Boolean)
  if (new Set(directories).size > 1) {
    throw new Error(`selected task ${taskID} has inconsistent project directories`)
  }
  const directory = boardDirectory || rowDirectory || sourceDirectory
  if (!directory) throw new Error(`selected task ${taskID} has no owning project directory`)
  return directory
}

// ── Fine-grained board update ──
//
// The server returns the entire board object on every refresh; replacing
// `boardStore.board` wholesale (`setBoardStore("board", data)`) bypasses
// SolidJS's fine-grained reactivity contract — every memo that reads any
// `boardStore.board.*` field gets invalidated, even when only one field
// (e.g. a Goal activity, review association, or acceptance facet) actually changed.
//
// `applyBoardDelta` performs a per-field shallow JSON diff and only writes
// back the keys whose serialised value differs. Downstream memos that read
// only unchanged fields (interactions, task, etc.) stop firing on dense
// server-sent event bursts that mutate just one corner of the tree.
//
// JSON.stringify is acceptable because typical board fields are small (KB
// scale) and the diff cost is amortised against the recompute work it avoids
// — downstream memos cost tens of ms vs sub-ms per-field stringify.

function fieldChanged(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return false
  if (a === undefined || b === undefined) return true
  return JSON.stringify(a) !== JSON.stringify(b)
}

// ── Boundary invariants ──
//
// The board snapshot from the server must satisfy a small set of structural
// invariants so that downstream view code can trust its inputs without
// defensive `?? Date.now()` / `?? 0` fallbacks. Any violation is a real bug
// (server payload corruption or schema drift) that must surface, not be
// papered over here. We throw — `loadBoard`'s catch will retry with backoff
// and console.error makes the corruption visible.
function assertBoardInvariants(data: any): void {
  if (data == null || typeof data !== "object") {
    throw new Error(`board payload must be object, got ${data === null ? "null" : typeof data}`)
  }
  requireBoardSnapshotVersion(data)
  const task = (data as any).task
  if (task) {
    requireTimelineOrderKeyDomain(task?.orderKey, `task ${String(task?.id || "<unknown>")}`, "task")
    const created = task?.time?.created
    if (!Number.isFinite(created) || created <= 0) {
      throw new Error(`board.task.time.created invalid: ${JSON.stringify(task?.time)}`)
    }
  }
  const interactions = (data as any).interactions
  if (Array.isArray(interactions)) {
    for (const it of interactions) {
      const created = it?.time?.created
      if (!Number.isFinite(created) || created <= 0) {
        throw new Error(`board.interactions[id=${it?.id}].time.created invalid: ${JSON.stringify(it?.time)}`)
      }
      if (it?.status === "answered" || it?.status === "rejected") {
        const resolved = it?.time?.resolved
        if (!Number.isFinite(resolved) || resolved <= 0) {
          throw new Error(
            `board.interactions[id=${it?.id}] resolved/rejected without valid time.resolved: ${JSON.stringify(it?.time)}`,
          )
        }
        requireTimelineOrderKeyDomain(
          it?.responseOrderKey,
          `board.interactions[id=${it?.id}] responseOrderKey`,
          "interaction",
        )
      }
    }
  }
}

function applyBoardDelta(data: any): boolean {
  if (data == null || typeof data !== "object") {
    if (boardStore.board !== null) {
      setBoardStore("board", null)
      return true
    }
    return false
  }
  const old = boardStore.board
  if (!old || typeof old !== "object") {
    setBoardStore("board", data)
    return true
  }
  // Update keys present in the new payload, only when their content changed.
  const seenKeys = new Set<string>()
  let changed = false
  for (const key of Object.keys(data)) {
    seenKeys.add(key)
    if (fieldChanged((old as any)[key], data[key])) {
      setBoardStore("board", key as any, data[key])
      changed = true
    }
  }
  // Drop keys the server no longer reports — set to undefined so reactive
  // readers see the field disappear instead of holding a stale value.
  for (const key of Object.keys(old)) {
    if (seenKeys.has(key)) continue
    setBoardStore("board", key as any, undefined)
    changed = true
  }
  return changed
}

function clearBoardRetry(): void {
  if (_boardRetryTimer) {
    clearTimeout(_boardRetryTimer)
    _boardRetryTimer = null
  }
  setBoardRetryCount(0)
}

function retryBoard(sync: boolean): void {
  if (!activeTaskID() || _boardRetryTimer) return
  if (sync) setBoardSyncPending(true)
  const delay = Math.min(1000 * Math.pow(2, Math.min(boardStore.boardRetryCount, 4)), 15000)
  setBoardRetryCount(boardStore.boardRetryCount + 1)
  _boardRetryTimer = setTimeout(() => {
    _boardRetryTimer = null
    observeScheduledBoardLoad("retry", loadBoard({ sync: boardStore.boardSyncPending }))
  }, delay)
}

function observeScheduledBoardLoad(owner: string, promise: Promise<void>): void {
  void promise.catch((error) => {
    console.error(`[board] scheduled ${owner} refresh failed`, error)
  })
}

export async function loadBoard(options: LoadBoardOptions = {}): Promise<void> {
  let taskID = activeTaskID()
  if (!taskID) {
    setBoardStore("board", null)
    setSnapshotVersion("")
    return
  }
  if (options.sync) setBoardSyncPending(true)
  while (_boardLoading) {
    const inFlightBeforeCall = _boardLoading
    if (!options.requireFresh) {
      _boardQueued = true
      if (options.sync) setBoardSyncPending(true)
      return inFlightBeforeCall
    }
    try {
      await inFlightBeforeCall
    } catch {
      // The in-flight request started before the required-fresh boundary.
      // The caller needs its own post-mutation board request below.
    }
  }
  taskID = activeTaskID()
  if (!taskID) {
    setBoardStore("board", null)
    setSnapshotVersion("")
    return
  }
  const sync = options.sync === true || boardStore.boardSyncPending
  if (sync) setBoardSyncPending(true)
  const loading = (async () => {
    let failed = false
    try {
      const headers: Record<string, string> = {}
      if (boardStore.boardEtag) headers["If-None-Match"] = boardStore.boardEtag
      const directory = selectedTaskOwningDirectory(taskID)
      const boardPath = directoryScopedPath(
        `task/${encodeURIComponent(taskID)}/board?sync=${sync ? "1" : "0"}`,
        directory,
        "loadBoard",
      )
      const res = await apiRequest<any>(boardPath, {
        headers,
        signal: AbortSignal.timeout(10000),
      })
      if (taskID !== activeTaskID()) return
      setBoardSyncPending(false)
      if (res.status === 304) {
        clearBoardRetry()
        return
      }
      if (!res.ok) throw new ApiError(res.status, boardPath, res.body)
      const etag = res.headers["etag"] || res.headers["ETag"]
      if (etag) setBoardEtag(etag)
      const data = res.body
      const lastSequence = Number(data?.lastSequence || 0)
      // Monotonic guard: discard stale responses whose sequence is lower
      // than what we already have. This prevents flickering when a slower
      // response arrives after a newer one.
      if (
        Number.isFinite(lastSequence) &&
        lastSequence > 0 &&
        boardStore.taskSequence > 0 &&
        lastSequence < boardStore.taskSequence
      ) {
        clearBoardRetry()
        return
      }
      assertBoardInvariants(data)
      const snapshotVersion = requireBoardSnapshotVersion(data)
      let boardChanged = false
      batch(() => {
        boardChanged = applyBoardDelta(data)
        setSnapshotVersion(snapshotVersion)
      })
      if (boardChanged) notifyBoardProjection()
      clearBoardRetry()
      // Agent cards are derived reactively from boardStore — no manual rebuild needed.
    } catch (e) {
      failed = true
      if (!options.requireFresh) {
        const message = e instanceof Error ? e.message : String(e)
        AppLog.error("board", "Selected task board refresh failed", {
          taskID,
          error: formatErrorDetails(e),
          diagnosticID: `board:refresh-failed:${taskID}`,
          diagnosticTitle: t("board.refresh_failed_title"),
          diagnosticMessage: t("board.refresh_failed_message", { error: message }),
          diagnosticDetails: formatErrorDetails(e),
        })
      }
      if (taskID === activeTaskID() && !options.requireFresh) retryBoard(sync)
      if (options.requireFresh) throw e
    } finally {
      _boardLoading = null
      setBoardStore("loading", false)
      if (_boardQueued || boardStore.boardQueued) {
        _boardQueued = false
        setBoardQueued(false)
        if (!failed && !_boardRetryTimer) {
          queueMicrotask(() => {
            observeScheduledBoardLoad("queued", loadBoard({ sync: boardStore.boardSyncPending }))
          })
        }
      }
    }
  })()
  _boardLoading = loading
  setBoardStore("loading", true)
  return loading
}

/**
 * Canonical writer for `boardStore.tasks`. All paths that replace the task
 * list MUST go through here so that the selected task source always refers to an
 * existing task" invariant is enforced. After the list is applied, if the
 * current selection no longer exists (in tasks or pendingTasks), the
 * registered orphan handler is invoked to reset the selection — this is the
 * single choke point that keeps the conversation panel consistent with the
 * task list (e.g. after a task is deleted by another client or the last task
 * is removed locally).
 *
 * `nextPending` lets callers that already know the new pending list pass it
 * in atomically — the orphan check then considers the post-update state.
 * Omit to keep the current `pendingTasks`.
 */
export function applyTasks(tasks: any[], nextPending?: any[]): void {
  const list = reconcileTaskItems(Array.isArray(tasks) ? tasks : [], boardStore.tasks)
  const pending = Array.isArray(nextPending)
    ? reconcileTaskItems(nextPending, boardStore.pendingTasks)
    : boardStore.pendingTasks
  // batch coalesces both setBoardStore writes when both fire — without it,
  // every consumer of either `tasks` or `pendingTasks` reruns twice on
  // applyTasks(list, pending) (the common path in loadTasks).
  batch(() => {
    if (list !== boardStore.tasks) setBoardStore("tasks", list)
    if (Array.isArray(nextPending) && pending !== boardStore.pendingTasks) {
      setBoardStore("pendingTasks", pending)
    }
  })
  visibleTaskProjectionCache = null
  if (selectionIsOrphaned(list, pending) && _orphanedSelectionHandler) {
    _orphanedSelectionHandler()
  }
  notifyTaskListProjection(list)
}

function taskStableKey(item: any): string {
  const task = item?.task ?? item
  const key = task?.id || task?.requestID || item?.requestID
  if (typeof key === "string" && key.trim()) return key
  throw new Error("task list item is missing stable id/requestID")
}

function taskContentSignature(item: any): string {
  const signature = JSON.stringify(item)
  if (typeof signature === "string") return signature
  throw new Error(`task list item ${taskStableKey(item)} is not JSON serializable`)
}

function reconcileTaskItems(next: any[], previous: any[]): any[] {
  const previousByKey = new Map<string, { item: any; signature: string }>()
  for (const item of previous) {
    const key = taskStableKey(item)
    if (previousByKey.has(key)) throw new Error(`duplicate task list item id/requestID: ${key}`)
    previousByKey.set(key, { item, signature: taskContentSignature(item) })
  }

  const seen = new Set<string>()
  const reconciled = next.map((item) => {
    const key = taskStableKey(item)
    if (seen.has(key)) throw new Error(`duplicate task list item id/requestID: ${key}`)
    seen.add(key)
    const previousItem = previousByKey.get(key)
    if (previousItem?.signature === taskContentSignature(item)) return previousItem.item
    return item
  })

  if (reconciled.length === previous.length && reconciled.every((item, index) => item === previous[index])) {
    return previous
  }
  return reconciled
}

export function clearTasksForMissingDirectory(): void {
  _tasksLoading = null
  invalidateTaskListPagination()
  applyTasks([], [])
  setBoardStore("tasksError", "")
  setBoardStore("tasksLoaded", true)
  setBoardStore("tasksHasMore", false)
  setBoardStore("tasksLoadedLimit", 0)
  setBoardStore("tasksCursorUpdated", null)
  setBoardStore("tasksCursorTaskID", "")
  setBoardStore("tasksLoadingMore", false)
}

export interface LoadTasksOptions {
  /** Require a request that starts after the caller's mutation boundary. */
  requireFresh?: boolean
}

export async function loadTasks(options: LoadTasksOptions = {}): Promise<void> {
  if (_tasksLoading) {
    const inFlightBeforeCall = _tasksLoading
    if (!options.requireFresh) return inFlightBeforeCall
    try {
      await inFlightBeforeCall
    } catch {
      // This request started before the required-fresh boundary. loadTasksOnce()
      // already recorded its failure in boardStore.tasksError; the caller still
      // needs a new post-mutation request below.
    }
    if (_tasksLoading && _tasksLoading !== inFlightBeforeCall) return _tasksLoading
  }
  const loading = loadTasksOnce()
  _tasksLoading = loading
  try {
    await loading
  } finally {
    if (_tasksLoading === loading) _tasksLoading = null
  }
}

async function loadTasksOnce(): Promise<void> {
  // Let-it-crash: any fetch/parse error lands in boardStore.tasksError so the
  // UI surfaces the failure explicitly. The previous silent catch left the UI
  // stuck on an empty list with no indication that the backend was unreachable.
  invalidateTaskListPagination()
  const generation = _taskListGeneration
  try {
    const data = await apiJson(taskListPagePath({ limit: TASK_LIST_PAGE_SIZE + 1 }))
    if (generation !== _taskListGeneration) return
    const page = taskPageFromResponse(data, TASK_LIST_PAGE_SIZE)
    const tasks = sortedTasks({ tasks: page.tasks })
    const seen = new Set(tasks.map((item: any) => item?.task?.requestID).filter(Boolean))
    const nextPending = boardStore.pendingTasks.filter((item: any) => !seen.has(item?.requestID))
    applyTasks(tasks, nextPending)
    setBoardStore("tasksError", "")
    setBoardStore("tasksLoaded", true)
    setBoardStore("tasksHasMore", page.hasMore)
    setBoardStore("tasksLoadedLimit", tasks.length)
    setBoardStore("tasksCursorUpdated", page.cursor?.updated ?? null)
    setBoardStore("tasksCursorTaskID", page.cursor?.taskID ?? "")
  } catch (e) {
    if (generation !== _taskListGeneration) return
    setBoardStore("tasksError", e instanceof Error ? e.message : String(e))
    throw e
  }
}

export async function loadMoreTasks(): Promise<void> {
  if (_tasksLoading) {
    await _tasksLoading
  }
  if (!boardStore.tasksHasMore || boardStore.tasksLoadingMore) return
  const generation = _taskListGeneration
  const paginationRequest = _taskListPaginationRequest + 1
  _taskListPaginationRequest = paginationRequest
  const cursorUpdated = boardStore.tasksCursorUpdated
  const cursorTaskID = boardStore.tasksCursorTaskID
  if (!Number.isFinite(cursorUpdated) || !cursorTaskID) {
    throw new Error("loadMoreTasks: missing task pagination cursor")
  }
  setBoardStore("tasksLoadingMore", true)
  try {
    const data = await apiJson(
      taskListPagePath({
        limit: TASK_LIST_PAGE_SIZE + 1,
        cursorUpdated: cursorUpdated as number,
        cursorTaskID,
      }),
    )
    const page = taskPageFromResponse(data, TASK_LIST_PAGE_SIZE)
    if (generation !== _taskListGeneration) return
    const currentByID = new Map(boardStore.tasks.map((item: any) => [item?.task?.id, item]))
    for (const item of page.tasks) {
      const id = item?.task?.id
      if (typeof id === "string" && id) currentByID.set(id, item)
    }
    const tasks = sortedTasks({ tasks: [...currentByID.values()] })
    applyTasks(tasks)
    setBoardStore("tasksError", "")
    setBoardStore("tasksLoaded", true)
    setBoardStore("tasksHasMore", page.hasMore)
    setBoardStore("tasksLoadedLimit", tasks.length)
    setBoardStore("tasksCursorUpdated", page.cursor?.updated ?? null)
    setBoardStore("tasksCursorTaskID", page.cursor?.taskID ?? "")
  } catch (e) {
    if (generation !== _taskListGeneration) return
    setBoardStore("tasksError", e instanceof Error ? e.message : String(e))
    throw e
  } finally {
    if (paginationRequest === _taskListPaginationRequest) {
      setBoardStore("tasksLoadingMore", false)
    }
  }
}

function taskListPagePath(input: { limit: number; cursorUpdated?: number; cursorTaskID?: string }): string {
  const params = new URLSearchParams({ limit: String(input.limit) })
  if (input.cursorUpdated !== undefined && input.cursorTaskID) {
    params.set("cursor", String(input.cursorUpdated))
    params.set("cursorTaskID", input.cursorTaskID)
  }
  return `global/tasks?${params.toString()}`
}

function taskPageFromResponse(
  data: { tasks?: any[] } | null | undefined,
  visibleLimit: number,
): { tasks: any[]; hasMore: boolean; cursor: { updated: number; taskID: string } | null } {
  const raw = Array.isArray(data?.tasks) ? data!.tasks : []
  const tasks = raw.slice(0, visibleLimit)
  const last = tasks.at(-1)
  const updated = last ? taskUpdatedAt(last) : undefined
  const taskID = typeof last?.task?.id === "string" ? last.task.id : ""
  return {
    tasks,
    hasMore: raw.length > visibleLimit,
    cursor: Number.isFinite(updated) && taskID ? { updated: updated as number, taskID } : null,
  }
}

// ── Task lifecycle ──

/**
 * Clear all task-scoped board state on task switch.
 * Cancels pending retry timers and resets all per-task sync machinery so that
 * the next loadBoard() call starts from a clean slate.
 */
export function clearBoard(): void {
  clearBoardRetry()
  if (boardLoadTimer) {
    clearTimeout(boardLoadTimer)
    boardLoadTimer = null
  }
  boardLoadDeadline = 0
  _boardQueued = false
  setBoardStore({
    board: null,
    taskSequence: 0,
    boardEtag: "",
    boardSyncPending: false,
    boardQueued: false,
    snapshotVersion: "",
    changes: [],
  })
  notifyBoardProjection()
}

// ── Direct setters (used by / SSE handlers) ──

export function validateBoardData(data: any): string {
  assertBoardInvariants(data)
  return requireBoardSnapshotVersion(data)
}

export function setBoardData(data: any, options: { notifyProjection?: boolean } = {}): void {
  const snapshotVersion = validateBoardData(data)
  let boardChanged = false
  batch(() => {
    boardChanged = applyBoardDelta(data)
    setSnapshotVersion(snapshotVersion)
  })
  if (boardChanged && options.notifyProjection !== false) notifyBoardProjection()
}

export function setTasksData(tasks: any[]): void {
  applyTasks(tasks)
}

// ── Scheduled board reload ──

let boardLoadTimer: any = null
let boardLoadDeadline = 0
const BOARD_MAX_DELAY_MS = 2000

/**
 * Schedule a board reload after an optional delay.
 *
 * Debounce + max-delay: each call delays by `delay`, but the reload fires
 * at most BOARD_MAX_DELAY_MS after the FIRST call in a burst. This prevents
 * starvation when events arrive continuously at intervals < delay (e.g.
 * rapid progress SSE events resetting the 500ms timer forever).
 *
 * @param delay Delay in milliseconds before calling loadBoard. Defaults to 0.
 */
export function scheduleBoard(delay = 0): void {
  setBoardSyncPending(true)
  clearBoardRetry()
  const now = Date.now()
  // First scheduling in a burst: set deadline
  if (!boardLoadTimer || boardLoadDeadline === 0) {
    boardLoadDeadline = now + BOARD_MAX_DELAY_MS
  }
  if (boardLoadTimer) {
    clearTimeout(boardLoadTimer)
    boardLoadTimer = null
  }
  // Effective delay is min(requested, remaining-until-deadline).
  // When remaining is negative (deadline passed), fire immediately.
  const remaining = Math.max(0, boardLoadDeadline - now)
  const effectiveDelay = Math.min(delay, remaining)
  boardLoadTimer = setTimeout(() => {
    boardLoadTimer = null
    boardLoadDeadline = 0
    observeScheduledBoardLoad("debounced", loadBoard({ sync: true }))
  }, effectiveDelay)
}

// ── Derived accessors ──

/**
 * Returns the selected task's ROOT sessionID.
 *
 * R5.1 item 9: this resolver must not look only at `boardStore.board` — a
 * task can be selected before its board has
 * loaded, in which case the root session lives on the task-list entry. So we
 * prefer the loaded board's task sessionID and fall back to the
 * selected source's entry in `boardStore.tasks`. Returns "" when the selected
 * task's root session is not yet resolved — callers MUST treat "" as
 * "do not write /config" (never silently fall back to the project config).
 */
export function rootTaskSessionID(): string {
  const taskID = activeTaskID()
  if (!taskID) return ""
  const boardTask = boardStore.board?.task
  const boardSession = boardTask?.id === taskID ? boardTask?.sessionID : ""
  if (typeof boardSession === "string" && boardSession) return boardSession
  const entry = boardStore.tasks.find((item: any) => item?.task?.id === taskID)
  return typeof entry?.task?.sessionID === "string" ? entry.task.sessionID : ""
}

/**
 * True when a task is selected (a task scope is active). Under a selected
 * task the model picker must target the task-root session config and NEVER
 * the project /config — even when the root session is not yet resolved
 * (R5.1 item 9). When false, the picker is in project scope.
 */
export function hasSelectedTask(): boolean {
  return !!activeTaskID()
}

/** Returns the **selected task's** frozen working directory (the directory
 *  the task was created in, carried on `board.task.directory`).
 *
 *  NOTE: this is NOT the user's current cwd. That lives in
 *  `settingsStore.directory` and is exposed by `services/workspace.ts`'s
 *  own `activeDirectory()`. The two used to share a name, which silently
 *  routed UI that meant "current cwd" (e.g. the Init Git button) to the
 *  frozen task directory instead — leading to visible stale state after
 *  the user switched workspaces. Callers should pick the semantic they
 *  actually want. */
export function selectedTaskDirectory(): string {
  return boardStore.board?.task?.directory ?? ""
}

export function activeTaskID(): string {
  const source = boardStore.selectedSource
  return source?.kind === "task" ? source.id : ""
}

export function activeBrowserPreviewTaskID(): string {
  const taskID = activeTaskID()
  if (taskID) return taskID
  const source = boardStore.selectedSource
  if (source?.kind !== "session" || source.sessionKind !== "conversation") return ""
  const selectedTaskID = boardStore.board?.selectedTaskID
  return typeof selectedTaskID === "string" ? selectedTaskID : ""
}

export function activeSessionID(): string {
  const source = boardStore.selectedSource
  return source?.kind === "session" ? source.id : ""
}

// ── VCS setters ──

export function setPath(path: any): void {
  setBoardStore("path", path ?? null)
}

export function setVcs(vcs: any): void {
  setBoardStore("vcs", vcs ?? null)
}

// ── Changes setter ──

export function setChanges(changes: any[]): void {
  setBoardStore("changes", Array.isArray(changes) ? changes : [])
}

// ── Board sync state setters ──

export function setBoardEtag(etag: string): void {
  setBoardStore("boardEtag", typeof etag === "string" ? etag : "")
}

export function setBoardQueued(queued: boolean): void {
  setBoardStore("boardQueued", queued)
}

export function setBoardRetryCount(count: number): void {
  setBoardStore("boardRetryCount", typeof count === "number" ? count : 0)
}

export function setBoardSyncPending(pending: boolean): void {
  setBoardStore("boardSyncPending", pending)
}

export function setSnapshotVersion(version: string): void {
  const next = typeof version === "string" ? version : ""
  const board = boardStore.board
  if (board && typeof board === "object") {
    const boardVersion = (board as any).snapshotVersion
    if (typeof boardVersion !== "string" || boardVersion.length === 0) {
      throw new Error("loaded board must include snapshotVersion")
    }
    if (next !== boardVersion) {
      throw new Error("boardStore.snapshotVersion must match board.snapshotVersion")
    }
  }
  setBoardStore("snapshotVersion", next)
}

export function setTaskSequence(sequence: number): void {
  setBoardStore("taskSequence", typeof sequence === "number" ? sequence : 0)
}

// ── Pending tasks setters ──

export function setPendingTasks(tasks: any[]): void {
  setBoardStore("pendingTasks", Array.isArray(tasks) ? tasks : [])
  visibleTaskProjectionCache = null
}

export function bumpTasksSeq(): void {
  setBoardStore("tasksSeq", (n) => n + 1)
}

// ── Task list derived utilities ──

/**
 * Returns the authoritative global-task ordering timestamp.
 */
export function taskUpdatedAt(item: any): number {
  const task = item?.task ?? item
  const updated = task?.time?.updated
  if (typeof updated === "number" && Number.isFinite(updated)) return updated
  throw new Error(`task list item ${task?.id || "<unknown>"} is missing task.time.updated`)
}

function taskIDForGlobalOrder(item: any): string {
  const taskID = item?.task?.id
  if (typeof taskID === "string" && taskID) return taskID
  throw new Error("global task list item is missing task.id")
}

/**
 * Match the backend's global-task order: updated time descending, then task
 * ID descending so equal timestamps retain the compound-cursor order.
 */
export function sortedTasks(data: { tasks?: any[] } | null | undefined): any[] {
  return [...(Array.isArray(data?.tasks) ? data!.tasks : [])].sort((a, b) => {
    const updatedDelta = taskUpdatedAt(b) - taskUpdatedAt(a)
    if (updatedDelta !== 0) return updatedDelta
    const aID = taskIDForGlobalOrder(a)
    const bID = taskIDForGlobalOrder(b)
    return aID === bID ? 0 : aID < bID ? 1 : -1
  })
}

/**
 * Find a task item in boardStore.tasks by task ID.
 */
export function taskByID(taskID: string | null | undefined): any | null {
  if (!taskID) return null
  return visibleTaskIndex().get(taskID) ?? null
}

/**
 * Find a task item by its requestID within a given list (defaults to boardStore.tasks).
 */
export function taskByRequestID(requestID: string | null | undefined, list: any[] = boardStore.tasks): any | null {
  if (!requestID || !Array.isArray(list)) return null
  return list.find((item: any) => item?.task?.requestID === requestID) ?? null
}

/**
 * Returns the merged visible task list: pending (not yet confirmed) tasks
 * plus the confirmed task list, sorted by creation time descending.
 */
export function visibleTasks(): any[] {
  return visibleTaskProjection().items
}

let visibleTaskProjectionCache: {
  tasks: any[]
  pendingTasks: any[]
  items: any[]
  byID: Map<string, any>
} | null = null

function visibleTaskProjection(): { items: any[]; byID: Map<string, any> } {
  const tasks = boardStore.tasks
  const pendingTasks = boardStore.pendingTasks
  if (
    visibleTaskProjectionCache &&
    visibleTaskProjectionCache.tasks === tasks &&
    visibleTaskProjectionCache.pendingTasks === pendingTasks
  ) {
    return visibleTaskProjectionCache
  }
  const seen = new Set(tasks.map((item: any) => item?.task?.requestID || item?.task?.id).filter(Boolean))
  const items = sortedTasks({
    tasks: [...pendingTasks.filter((item: any) => !seen.has(item?.requestID || item?.task?.id)), ...tasks],
  })
  const byID = new Map<string, any>()
  for (const item of items) {
    const id = item?.task?.id
    if (typeof id === "string" && id) byID.set(id, item)
  }
  visibleTaskProjectionCache = { tasks, pendingTasks, items, byID }
  return visibleTaskProjectionCache
}

function visibleTaskIndex(): Map<string, any> {
  return visibleTaskProjection().byID
}

// ── Task state classifiers ──

const INTERRUPTABLE_STATUSES = new Set(["active"])

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

/**
 * Returns true when the currently selected task can be interrupted (stopped).
 * Derived from the task status in the board — single source of truth for
 * the stop button's availability.
 */
export function isTaskInterruptable(): boolean {
  const status = boardStore.board?.task?.status
  return !!status && INTERRUPTABLE_STATUSES.has(status)
}

/**
 * Returns true when the currently selected task is in a terminal state.
 */
export function isTaskTerminal(): boolean {
  const status = boardStore.board?.task?.status
  return !!status && TERMINAL_STATUSES.has(status)
}
