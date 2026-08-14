// ── Task Service ──
// Responsibilities:
// - Select a task (stop SSE, clear the board, load board + transcript, start SSE)
// - Delete a task
// - Create a task (direct API)
// - Submit a message to the current task (direct API)
// - Retry / replan / cancel / interrupt a task (direct API)
// This module owns no render-side effects. Callers are responsible for
// driving UI updates through reactive Solid stores.

import { batch } from "solid-js"
import {
  TaskArchiveRequestBody,
  TaskCancellationRequestBody,
  UnknownPanelMessageStreamEvent,
  type TaskCancellationRequestBody as TaskCancellationRequestBodyValue,
  type UnknownPanelMessageStreamEvent as PanelMessageStreamEvent,
} from "@opencorvus-ai/transport-protocol"

import { apiJson, ApiError, serverSettledRequest } from "./api"
import type { StreamHandle } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"
import { isSelectedTaskSSEConnected, startSSE, stopSSE } from "./sse"
import { showAppDialog } from "./app-dialog"
import { initGitCurrent } from "../utils/git"
import { t } from "../utils/i18n"
import { abortChatRequest, setChatAttachments, messageStore } from "../store/messages"
import { clearConversationUiState, loadConversationUiStateForTask } from "../store/conversation-ui"
import {
  loadTasks,
  applyTasks,
  loadBoard,
  clearBoard,
  boardStore,
  setBoardStore,
  setOrphanedSelectionHandler,
  taskByID,
  activeTaskID,
  rootTaskSessionID,
} from "../store/board"
import { settingsStore, setSettingsStore, saveSettings, workspaceRestoreDirectory } from "../store/settings"
import { appStore, setAppStore } from "../store/app"
import { directoryScopedPath, taskScopedPath } from "./task-path"
import { taskOwningDirectory } from "./task-directory"
import { downloadProjectArchive } from "./project-archive"
import { activeProjectDirectory } from "./project-directory"
import { applyDirectory, beginWorkspaceSelection, ownsWorkspaceSelection } from "./workspace"
import { ingestPersistedConversationMessage } from "./tree-writer"
import {
  cancelConversationReplay,
  conversationSourceDirectory,
  hydrateTaskConversation,
  resetConversationProjection,
} from "./conversation"
import { resetSelectedLiveCursor } from "./selected-stream-cursor"
import { formatErrorDetails } from "./diagnostics"
import { cardTreeStore } from "../store/card-tree"
import { AppLog } from "../utils/log"
import { isImplicitProjectDirectory } from "../utils/project-directory"
import { requestTaskCancellation, type TaskCancellationSurface } from "./task-cancellation"
import { clearComposerModelProjection, projectComposerModelFromSession } from "./composer-model"

// ── Types ──

export interface Attachment {
  mime: string
  url: string
  filename?: string
}

export interface SubmitMessageOptions {
  /** Pre-allocated requestID (UUID). Generated internally if omitted. */
  requestID?: string
  /** Metadata forwarded to the panel message endpoint. */
  metadata?: Record<string, unknown>
  /** AbortSignal for cancellation. */
  signal?: AbortSignal
  /** Workspace epoch guard — if supplied, response is ignored on mismatch. */
  workspaceEpoch?: number
  /** Called once the panel stream response is accepted and ready to read. */
  onOpen?: () => void | Promise<void>
  /** Called for each parsed panel stream event before the final result resolves. */
  onEvent?: (event: PanelMessageStreamEvent) => void | Promise<void>
}

export interface CreateTaskOptions {
  text: string
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  /** Optional priority override; the server defaults to "normal". */
  priority?: "critical" | "high" | "normal" | "low"
  /** Optional OpenCorvus model override for this new task. */
  model?: string
  /** Optional expert squad id forwarded through the existing task overlay field. */
  promptProfile?: string
  /** Title override. Server falls back to the request body when omitted. */
  title?: string
  signal?: AbortSignal
  budget?: {
    maxExecutorGroups?: number
  }
}

export interface CreateTaskResult {
  taskID: string
  projectID: string
  directory: string
}

export interface SelectTaskOptions {
  directory?: string
  /** Keep staged new-request files when only the composer intent changes. */
  preserveComposerAttachments?: boolean
}

// ── Helpers ──

function taskPath(taskID: string, suffix = ""): string {
  return taskScopedPath(taskID, taskOwningDirectory(taskID), suffix)
}

function taskRecordPath(taskID: string): string {
  const id = String(taskID || "").trim()
  if (!id) throw new Error("taskRecordPath requires a taskID")
  return `task/${encodeURIComponent(id)}`
}

/**
 * Default chat request timeout: 10 minutes.
 */
function chatRequestTimeoutMs(): number {
  const overlayTiming = (window as any).__ocOverlayTiming
  const testTiming = (window as any).__overlayTest
  const override =
    typeof overlayTiming?.chatTimeoutMs === "number"
      ? overlayTiming.chatTimeoutMs
      : typeof testTiming?.chatTimeoutMs === "number"
        ? testTiming.chatTimeoutMs
        : undefined
  const value = typeof override === "number" ? override : 10 * 60 * 1000
  return Math.max(value, 1000)
}

function activeDirectory(): string {
  return activeProjectDirectory()
}

function inactivityTimeoutError(timeoutMs: number): DOMException {
  return new DOMException(`Panel stream inactive for ${timeoutMs}ms`, "TimeoutError")
}

export function currentOpenCorvusModel(): string | undefined {
  const model = appStore.composerModel
  return typeof model === "string" && model.includes("/") && model.trim() === model ? model : undefined
}

export function currentOpenCorvusPromptModel():
  | {
      providerID: string
      modelID: string
    }
  | undefined {
  const model = currentOpenCorvusModel()
  if (!model) return undefined
  const slash = model.indexOf("/")
  return {
    providerID: model.slice(0, slash),
    modelID: model.slice(slash + 1),
  }
}

function relayAbort(source: AbortSignal | undefined, controller: AbortController): () => void {
  if (!source) return () => undefined
  const abort = () => {
    controller.abort(source.reason instanceof Error ? source.reason : (source.reason ?? undefined))
  }
  if (source.aborted) {
    abort()
    return () => undefined
  }
  source.addEventListener("abort", abort, { once: true })
  return () => source.removeEventListener("abort", abort)
}

// ── Panel message request body builder ──

export function panelRequestBody(
  text: string,
  metadata: Record<string, unknown> = {},
  requestID: string = "",
  attachments: Attachment[] = [],
): Record<string, unknown> {
  const taskID = activeTaskID() || undefined
  const body: Record<string, unknown> = {
    surface: "panel",
    text,
    time_created: Date.now(),
    taskID,
    model: currentOpenCorvusModel(),
    request_id: requestID || undefined,
    allow_create: true,
    allow_session_mutation: false,
    directory: activeDirectory() || undefined,
    metadata: {
      selectedTaskID: taskID,
      ...metadata,
    },
  }
  if (attachments.length > 0) {
    body.attachments = attachments.map((att) => ({
      mime: att.mime,
      url: att.url,
      ...(att.filename ? { filename: att.filename } : {}),
    }))
  }
  return body
}

// ── Public: selectTask ──

/**
 * Switch to a task: stop SSE, reset message state, load board + transcript,
 * start SSE for the new task.
 * Pass an empty string to deselect all tasks.
 */
// Task IDs are opencorvus identifiers: a lowercase prefix, an underscore, and
// a ULID/base32 body, optionally with hyphens (requestIDs). Anything outside
// [A-Za-z0-9_-] (path separators, whitespace, colons, etc.) indicates the
// caller passed a corrupted value — for example a mission message metadata
// field polluted with a filesystem path. Fail loudly so the call stack points
// directly at the source instead of triggering silent 400-request floods.
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const TASK_SELECTION_INITIAL_TAIL_LIMIT = 8

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function hasConversationPanelState(): boolean {
  return (
    !!messageStore.chatRequest ||
    messageStore.chatAttachments.length > 0 ||
    cardTreeStore.order.length > 0 ||
    Object.keys(cardTreeStore.cards).length > 0 ||
    cardTreeStore.screenshotItems.length > 0 ||
    cardTreeStore.rewindCursor !== null
  )
}

export async function selectTask(taskID: string, options: SelectTaskOptions = {}): Promise<void> {
  const nextTaskID = taskID || ""
  const explicitDirectory = options.directory?.trim() ?? ""

  if (nextTaskID && !TASK_ID_PATTERN.test(nextTaskID)) {
    throw new Error(`selectTask: invalid taskID ${JSON.stringify(nextTaskID)} — expected [A-Za-z0-9_-]{1,128}`)
  }

  // Guard: skip if already on this task. Board-loaded OR switch-in-flight
  // both count as "nothing to do" — without the taskSwitching check a user
  // clicking the same task before the first load finishes would interrupt
  // and restart their own load.
  if (
    nextTaskID &&
    boardStore.selectedSource?.kind === "task" &&
    boardStore.selectedSource.id === nextTaskID &&
    !boardStore.taskSelectionError &&
    (boardStore.board || boardStore.taskSwitching)
  ) {
    if (nextTaskID && boardStore.board && !boardStore.taskSwitching && !isSelectedTaskSSEConnected(nextTaskID)) {
      const directory = String(boardStore.board?.task?.directory || settingsStore.directory || "").trim()
      if (!directory) throw new Error("selectTask: selected task has no project directory")
      startSSE({ kind: "task", id: nextTaskID }, boardStore.taskSequence, { directory })
    }
    return
  }
  if (
    !nextTaskID &&
    !boardStore.selectedSource &&
    !boardStore.board &&
    !boardStore.taskSwitching &&
    !hasConversationPanelState()
  ) {
    return
  }

  const taskItem = nextTaskID ? taskByID(nextTaskID) : null
  const taskDirectory =
    explicitDirectory || (typeof taskItem?.task?.directory === "string" ? taskItem.task.directory.trim() : "")
  const taskTitle = String(taskItem?.task?.title || taskItem?.overview?.headline || nextTaskID).trim()
  const epoch = beginWorkspaceSelection()

  // ── Synchronous phase ────────────────────────────────────────────────
  // Everything the UI needs to feel "switched instantly" happens here:
  // cancel in-flight work, wipe task-scoped stores, flip the selected ID,
  // flip taskSwitching=true so the top progress bar appears. Any async work
  // is deferred to the next phase under epoch guard so rapid-fire clicks
  // don't trample each other.
  abortChatRequest()
  clearComposerModelProjection()
  cancelConversationReplay()
  if (!options.preserveComposerAttachments) setChatAttachments([])
  stopSSE()
  resetSelectedLiveCursor()
  if (nextTaskID) loadConversationUiStateForTask(nextTaskID)
  else clearConversationUiState()
  batch(() => {
    setBoardStore(
      "selectedSource",
      nextTaskID ? { kind: "task", id: nextTaskID, ...(taskDirectory ? { directory: taskDirectory } : {}) } : null,
    )
    setBoardStore("selectEpoch", epoch)
    setBoardStore("taskSwitching", !!nextTaskID)
    setBoardStore("taskSelectionError", null)
    clearBoard()
    resetConversationProjection({ scrollIntent: "bottom", cause: "task-switch" })
  })

  if (!nextTaskID) {
    // Deselection has no async work; make sure any lingering progress UI
    // from a superseded switch is cleared.
    // Clear persisted workspace identity so next launch does not resume a
    // task the user just deselected.
    setSettingsStore("workspaceTaskID", "")
    setSettingsStore("workspaceDirectory", "")
    await saveSettings()
    return
  }

  // ── Async phase ──────────────────────────────────────────────────────
  const stale = () => boardStore.selectEpoch !== epoch

  try {
    let selectedDirectory = ""
    try {
      // Cross-project switch: apply the new directory so every project-scoped
      // Project-scoped API traffic targets the correct
      // backend Instance before we load the new task's board.
      const needsProjectSwitch = taskDirectory && taskDirectory !== settingsStore.directory
      if (needsProjectSwitch) {
        const applied = await applyDirectory(taskDirectory, {
          save: true,
          preserveSelection: true,
          selectionEpoch: epoch,
        })
        if (!applied) return
        if (stale()) return
      }
      if (explicitDirectory && !needsProjectSwitch) {
        await loadTasks({ requireFresh: true })
        if (stale()) return
      }

      const conversationDirectory = (taskDirectory || settingsStore.directory || "").trim()
      const lastSequence = await hydrateTaskConversation(nextTaskID, {
        scrollIntent: "bottom",
        resetCause: "task-switch-hydrate",
        tailLimit: TASK_SELECTION_INITIAL_TAIL_LIMIT,
        directory: conversationDirectory || undefined,
      })
      if (stale()) return

      selectedDirectory = taskOwningDirectory(nextTaskID)
      const rootSessionID = rootTaskSessionID()
      if (!rootSessionID) throw new Error(`selectTask: task ${nextTaskID} has no root session`)
      await projectComposerModelFromSession(
        { sessionID: rootSessionID, directory: selectedDirectory },
        () => ownsWorkspaceSelection(epoch) && activeTaskID() === nextTaskID,
      )
      if (stale()) return
      startSSE({ kind: "task", id: nextTaskID }, lastSequence, { directory: selectedDirectory })
    } catch (error) {
      if (stale() && isAbortError(error)) return
      if (!stale()) {
        batch(() => {
          clearBoard()
          resetConversationProjection({ scrollIntent: "bottom", cause: "task-switch-failed" })
          setBoardStore("taskSelectionError", {
            taskID: nextTaskID,
            directory: taskDirectory,
            title: taskTitle,
            details: formatErrorDetails(error),
          })
        })
      }
      throw error
    }

    // Persist the active task so initApp -> restoreInitialWorkspace() can
    // resume it on the next launch. Without this write the localStorage key
    // stays empty and the overlay always boots into an empty workspace.
    const restoreDir = workspaceRestoreDirectory(selectedDirectory)
    setSettingsStore("workspaceTaskID", nextTaskID)
    setSettingsStore("workspaceDirectory", restoreDir)
    await saveSettings()
  } finally {
    // Only clear the progress flag if we are still the active selection.
    // A newer selectTask() call has taken over and will manage its own flag.
    if (boardStore.selectEpoch === epoch) {
      setBoardStore("taskSwitching", false)
    }
  }
}

export async function retrySelectedTaskSelection(): Promise<void> {
  const failure = boardStore.taskSelectionError
  if (!failure) return
  if (boardStore.selectedSource?.kind !== "task" || boardStore.selectedSource.id !== failure.taskID) return
  await selectTask(failure.taskID)
}

// ── Public: deleteTask ──

export function setTaskArchived(
  target: { taskID: string; directory: string },
  archived: true,
  provenance: TaskCancellationRequestBodyValue,
): Promise<boolean>
export function setTaskArchived(target: { taskID: string; directory: string }, archived: false): Promise<boolean>
export async function setTaskArchived(
  target: { taskID: string; directory: string },
  archived: boolean,
  provenance?: TaskCancellationRequestBodyValue,
): Promise<boolean> {
  const taskID = target.taskID.trim()
  const directory = target.directory.trim()
  if (!taskID || !directory) {
    throw new Error("setTaskArchived: taskID and directory are required")
  }
  const body = TaskArchiveRequestBody.parse(
    archived
      ? {
          archived,
          ...TaskCancellationRequestBody.parse(provenance),
        }
      : { archived },
  )
  const params = new URLSearchParams({ directory })
  const request = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } satisfies Parameters<typeof apiJson>[1]
  await apiJson(
    `${taskRecordPath(taskID)}/archive?${params.toString()}`,
    archived ? serverSettledRequest(request) : request,
  )
  if (archived) {
    reconcileRemovedTaskAfterCommit(taskID, "archive")
  } else {
    void loadTasks({ requireFresh: true }).catch((error) => {
      AppLog.error("task", "failed to refresh tasks after confirmed restore", {
        taskID,
        error: formatErrorDetails(error),
        diagnosticID: `task:restore-refresh-failed:${taskID}`,
        diagnosticTitle: error instanceof Error ? error.message : String(error),
        diagnosticMessage: error instanceof Error ? error.message : String(error),
        diagnosticDetails: formatErrorDetails(error),
      })
    })
  }
  return true
}

function removeTaskProjection(taskID: string): void {
  const keep = (item: any) => item?.task?.id !== taskID && item?.id !== taskID && item?.requestID !== taskID
  applyTasks(boardStore.tasks.filter(keep), boardStore.pendingTasks.filter(keep))
}

function reconcileRemovedTaskAfterCommit(taskID: string, operation: "archive" | "delete"): void {
  try {
    removeTaskProjection(taskID)
  } catch (error) {
    AppLog.error("task", "failed to reconcile task projection after committed mutation", {
      taskID,
      operation,
      error: formatErrorDetails(error),
      diagnosticID: `task:${operation}-projection-reconcile-failed:${taskID}`,
      diagnosticTitle: error instanceof Error ? error.message : String(error),
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticDetails: formatErrorDetails(error),
    })
  }
}

function isCommittedTaskDeletion(error: unknown, taskID: string): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 500) return false
  if (!error.body || typeof error.body !== "object") return false
  const body = error.body as { name?: unknown; data?: unknown }
  if (body.name !== "TaskArtifactDeletionCommittedError" || !body.data || typeof body.data !== "object") return false
  const data = body.data as { committed?: unknown; taskIDs?: unknown }
  return data.committed === true && Array.isArray(data.taskIDs) && data.taskIDs.includes(taskID)
}

/**
 * Delete a task by ID.
 * Does NOT show a confirmation dialog — callers must confirm before calling.
 * Returns true on durable success. Invalid client-side input returns false;
 * backend failures before commit reject so callers can surface the original error.
 */
export async function deleteTask(taskID: string, provenance: TaskCancellationRequestBodyValue): Promise<boolean> {
  if (!taskID) return false
  const body = TaskCancellationRequestBody.parse(provenance)
  try {
    await apiJson(
      taskRecordPath(taskID),
      serverSettledRequest({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // Desired state is already durable.
    } else if (isCommittedTaskDeletion(error, taskID)) {
      AppLog.warn("task", "task row deleted with artifact cleanup residue", {
        taskID,
        error: formatErrorDetails(error),
        diagnosticID: `task:delete-artifact-cleanup-residue:${taskID}`,
        diagnosticTitle: error.message,
        diagnosticMessage: error.message,
        diagnosticDetails: formatErrorDetails(error),
      })
    } else {
      throw error
    }
  }
  reconcileRemovedTaskAfterCommit(taskID, "delete")
  return true
}

// ── Public: renameTask ──

/**
 * Rename a task in place. Trimming and length enforcement match the server-side
 * Zod schema (1–200 chars after trim). Invalid client-side input returns false;
 * backend and refresh failures reject so the row can surface the original error.
 */
export async function renameTask(taskID: string, title: string): Promise<boolean> {
  if (!taskID) return false
  const trimmed = title.trim()
  if (!trimmed || trimmed.length > 200) return false
  await apiJson(taskPath(taskID, "/title"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: trimmed }),
  })
  await loadTasks({ requireFresh: true })
  if (activeTaskID() === taskID) {
    await loadBoard()
  }
  return true
}

// ── Public: downloadTaskProjectArchive ──

/**
 * Download a ZIP containing the task's project files plus its persisted
 * execution-flow projections.
 */
export async function downloadTaskProjectArchive(input: { taskID: string; directory: string }): Promise<boolean> {
  const taskID = String(input.taskID || "").trim()
  if (!taskID) return false
  return downloadProjectArchive({
    path: taskScopedPath(taskID, input.directory, "/project-archive"),
  })
}

// ── Public: submitMessage ──

/**
 * Send a message to the current task (or create a new task if none is
 * selected). Uses the panel/message/stream endpoint.
 * This is a lean version of panelMessage that omits
 * placeholder mutations. The caller is responsible for pre-inserting
 * optimistic messages into the Solid message store if desired.
 */
export async function submitMessage(
  text: string,
  attachments: Attachment[] = [],
  options: SubmitMessageOptions = {},
): Promise<unknown> {
  const requestID = options.requestID ?? crypto.randomUUID()
  const timeoutMs = chatRequestTimeoutMs()
  const controller = new AbortController()
  const cleanupRelay = relayAbort(options.signal, controller)
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null

  const markActivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(() => {
      controller.abort(inactivityTimeoutError(timeoutMs))
    }, timeoutMs)
  }

  const requestPayload = panelRequestBody(text, options.metadata ?? {}, requestID, attachments)

  markActivity()

  const selectedSource = boardStore.selectedSource
  if (selectedSource?.kind === "session") {
    const directory = conversationSourceDirectory(selectedSource)
    try {
      const result = await apiJson(
        directoryScopedPath(
          `session/${encodeURIComponent(selectedSource.id)}/prompt_async`,
          directory,
          "submitMessage",
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [
              {
                type: "text",
                text,
                ...(options.metadata ? { metadata: options.metadata } : {}),
              },
            ],
            model: currentOpenCorvusPromptModel(),
            ...(attachments.length > 0 ? { attachments } : {}),
          }),
          signal: controller.signal,
        },
      )
      ingestPersistedConversationMessage(result.user_message)
      return result
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      cleanupRelay()
    }
  }

  // Route through HostTransport.openStream so this POST-stream pattern works
  // identically under Tauri (fetch + ReadableStream + manual Server-Sent
  // Events block parsing in tauri-transport) and the standalone browser/Vite
  // host. Per-event activity tracking replaces the historical per-chunk
  // tracking; events arrive frequently enough that the granularity loss is
  // imperceptible while removing reader-level abort plumbing.
  return new Promise<unknown>((resolve, reject) => {
    let result: unknown = null
    let settled = false
    let handle: StreamHandle | null = null
    let abortListener: (() => void) | null = null

    const cleanup = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
      cleanupRelay()
      if (abortListener) {
        controller.signal.removeEventListener("abort", abortListener)
        abortListener = null
      }
    }

    const rejectStream = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      handle?.close("consumer-error")
      reject(error)
    }

    const observeStreamHook = (run: () => void | Promise<void>) => {
      try {
        const hookResult = run()
        if (hookResult && typeof (hookResult as Promise<void>).then === "function") {
          void Promise.resolve(hookResult).catch(rejectStream)
        }
      } catch (error) {
        rejectStream(error)
      }
    }

    handle = getHostTransport().openStream(
      {
        path: "panel/message/stream",
        method: "POST",
        body: { kind: "json", value: requestPayload },
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      },
      {
        onOpen: () => {
          markActivity()
          observeStreamHook(() => options.onOpen?.())
        },
        onEvent: (data) => {
          let decoded: unknown
          try {
            decoded = JSON.parse(data)
          } catch (error) {
            const parseError = new Error(`Malformed panel message stream event for request ${requestID}`)
            AppLog.error("task", "malformed panel message stream event", {
              requestID,
              taskID: activeTaskID(),
              error: formatErrorDetails(error),
              payloadSample: String(data || "").slice(0, 500),
              diagnosticID: `task:panel-message-stream-parse-error:${requestID}`,
              diagnosticTitle: "Malformed message stream event",
              diagnosticMessage: "OpenCorvus received a malformed message stream event.",
              diagnosticDetails: `${formatErrorDetails(error)}\n\npayload sample:\n${String(data || "").slice(0, 500)}`,
            })
            rejectStream(parseError)
            return
          }
          const parsed = UnknownPanelMessageStreamEvent.safeParse(decoded)
          if (!parsed.success) {
            rejectStream(
              new Error(`Panel message stream event violated the transport contract for request ${requestID}`, {
                cause: parsed.error,
              }),
            )
            return
          }
          const ev = parsed.data
          markActivity()
          observeStreamHook(() => options.onEvent?.(ev))
          if (ev?.type === "done") result = ev.result
        },
        onError: (err) => {
          if (settled) return
          settled = true
          cleanup()
          reject(err)
        },
        onClose: (_reason) => {
          if (settled) return
          settled = true
          cleanup()
          if (result !== null && result !== undefined) {
            resolve(result)
          } else {
            reject(new Error("Panel stream ended without a final result"))
          }
        },
      },
    )

    // Mirror prior abort behaviour: caller-side abort closes the stream.
    abortListener = () => handle?.close("abort-signal")
    if (controller.signal.aborted) {
      handle?.close("abort-signal")
    } else {
      controller.signal.addEventListener("abort", abortListener, { once: true })
    }
  })
}

// ── Public: createTask ──

/**
 * Server-side: W2-V32 (commit aa14f20e7) removed every auto git-init in the
 * project bootstrap, so task creation throws WorktreeNotGitError when the
 * active directory is not a git repo. Detect that single error and offer the
 * user the explicit init gesture, then retry once. Any other failure (or a
 * declined prompt) propagates to the caller so the existing handlers in
 * panelMessage / submitChat surface it normally.
 */
function isWorktreeNotGitError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) return false
  if (err.status !== 412) return false
  const body = err.body as { name?: unknown } | null
  return !!body && typeof body === "object" && body.name === "WorktreeNotGitError"
}

async function offerInitGitAndRetry(): Promise<boolean> {
  const result = await showAppDialog({
    title: t("git.init"),
    message: t("git.init_required"),
    cancel: true,
    okLabel: t("common.ok"),
  })
  if (!result.confirmed) return false
  return await initGitCurrent({ notify: false })
}

/**
 * Create a new task via direct API. Returns the task_id immediately.
 * No LLM round-trip — the backend persists the task in ~10ms.
 */
export async function createTask(options: CreateTaskOptions): Promise<CreateTaskResult> {
  const { text, attachments = [], metadata = {}, signal, budget } = options
  if (!text) throw new Error("createTask: text is required")
  const requestID = crypto.randomUUID()
  const body = JSON.stringify({
    request: text,
    requestID,
    metadata,
    source: "panel",
    ...(options.model ? { model: options.model } : {}),
    ...(options.promptProfile ? { promptProfile: options.promptProfile } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(budget ? { budget } : {}),
    ...(attachments.length > 0
      ? {
          attachments: attachments.map((att) => ({
            mime: att.mime,
            url: att.url,
            ...(att.filename ? { filename: att.filename } : {}),
          })),
        }
      : {}),
  })
  const creationDirectory = activeDirectory()
  const shouldCreateImplicitProject = !creationDirectory || isImplicitProjectDirectory(creationDirectory)
  const path = shouldCreateImplicitProject ? "global/tasks" : "task"
  const post = () =>
    apiJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    })
  let result: any
  try {
    result = await post()
  } catch (err) {
    if (shouldCreateImplicitProject || !isWorktreeNotGitError(err)) throw err
    const initialized = await offerInitGitAndRetry()
    if (!initialized) throw err
    result = await post()
  }
  const taskID = typeof result?.task_id === "string" ? result.task_id.trim() : ""
  const projectID = typeof result?.project_id === "string" ? result.project_id.trim() : ""
  const directory = typeof result?.directory === "string" ? result.directory.trim() : ""
  if (!taskID || !projectID || !directory) {
    throw new Error(`${path} returned an invalid task/project identity`)
  }
  return { taskID, projectID, directory }
}

// ── Public: retryTask ──

/**
 * Retry a terminal task. Direct operator API call, no LLM involvement.
 */
export async function retryTask(taskID: string): Promise<void> {
  if (!taskID) return
  await apiJson(taskPath(taskID, "/retry"), {
    method: "POST",
  })
}

// ── Public: replanTask ──

/**
 * Trigger a replan for a terminal task. Direct operator API call, no LLM involvement.
 */
export async function replanTask(taskID: string): Promise<void> {
  if (!taskID) return
  await apiJson(taskPath(taskID, "/replan"), {
    method: "POST",
  })
}

// ── Public: sendOperatorSteer ──

export interface OperatorSteerResult {
  task_id: string
  session_id: string
  request_id: string
  wake_status: "accepted" | "queued"
}

export class OperatorSteerInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OperatorSteerInputError"
  }
}

/**
 * Record targeted operator steer as a durable coordination request. This is
 * the only route the inline agent steer box may call.
 */
export async function sendOperatorSteer(
  taskID: string,
  sessionID: string,
  message: string,
): Promise<OperatorSteerResult> {
  const text = message.trim()
  if (!taskID) throw new OperatorSteerInputError("No active task is selected for operator steer.")
  if (!sessionID) throw new OperatorSteerInputError("No target agent session is available for operator steer.")
  if (!text) throw new OperatorSteerInputError("Operator steer message is empty.")
  return (await apiJson(taskPath(taskID, `/session/${encodeURIComponent(sessionID)}/operator-steer`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  })) as OperatorSteerResult
}

// ── Public: cancelAgentSession ──

/**
 * Cancel a task child-agent session without changing global orchestration.
 * Running tool chips call this too because tools execute inside the session.
 */
export async function cancelAgentSession(taskID: string, sessionID: string): Promise<void> {
  if (!taskID || !sessionID) return
  await apiJson(taskPath(taskID, `/session/${encodeURIComponent(sessionID)}/cancel`), {
    method: "POST",
  })
}

// ── Public: cancelTask ──

/**
 * Cancel the given task. Direct API call, no LLM involvement.
 */
export async function cancelTask(
  taskID: string,
  input: { surface: TaskCancellationSurface; reason: string },
): Promise<void> {
  if (!taskID) return
  await requestTaskCancellation({
    taskID,
    directory: taskOwningDirectory(taskID),
    surface: input.surface,
    reason: input.reason,
  })
  await loadBoard()
}

// ── Public: interruptTask ──

/**
 * Interrupt an active task: abort any in-flight chat request, then cancel
 * the task via direct API. This is the unified "stop" operation.
 */
export async function interruptTask(taskID: string): Promise<boolean> {
  if (!taskID) return false
  try {
    await requestTaskCancellation({
      taskID,
      directory: taskOwningDirectory(taskID),
      surface: "overlay.interrupt_task",
      reason: "Operator interrupted the active task",
    })
    await loadBoard()
    return true
  } catch (e) {
    console.error("[interruptTask] failed", { error: String(e), taskID })
    return false
  }
}

// ── Orphan-selection reconciliation ──
// board.ts's applyTasks() is the single choke point for tasks-list writes.
// When it detects that `selectedTaskID` points to a task no longer present in
// the list (and not in pendingTasks), it calls this handler to fully reset
// the selection — driving the same cleanup path (clearBoard / resetWriter /
// stopSSE) that every intentional deselect uses. Registered at module load so
// it's in place before any tasks fetch completes.
setOrphanedSelectionHandler(() => {
  void selectTask("").catch((error) => {
    AppLog.error("task", "failed to clear orphaned task selection", {
      error: formatErrorDetails(error),
      diagnosticID: "task:orphan-selection-clear-failed",
      diagnosticTitle: error instanceof Error ? error.message : String(error),
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticDetails: formatErrorDetails(error),
    })
  })
})
