// ── Chat Service ──
// Responsibilities:
// - Manage pending chat metadata
// - Manage the active chat AbortController and its exact remote abort target
// - Provide conversationTarget / conversationTargetKey helpers
// This module owns no render-side effects. Callers drive UI updates through
// reactive Solid stores.

import { apiJson } from "./api"
import {
  messageStore,
  setChatRequest,
  abortChatRequest,
  setChatAttachments,
  type ChatAbortTarget,
  type ChatRequestState,
} from "../store/messages"
import { boardStore, loadBoard, loadTasks, activeTaskID, activeSessionID } from "../store/board"
import { appStore, setConnectionStatus } from "../store/app"
import { workspaceMode } from "./workspace"
import { currentOpenCorvusModel, currentOpenCorvusPromptModel, selectTask } from "./task"
import { setSessionExpertSquadActive } from "./expert-squad"
import { ingestPersistedConversationMessage } from "./tree-writer"
import { conversationSourceDirectory } from "./conversation"
import { taskOwningDirectory } from "./task-directory"
import { directoryScopedPath, taskScopedPath } from "./task-path"
import { requestTaskCancellation } from "./task-cancellation"
import { abortMission, wakeMission } from "./mission"
import { workLedgerSessionExecution, type WorkLedgerMissionRow } from "./work-ledger"
import { randomUUID } from "../utils/random-id"

// ── Types ──

export interface ConversationTarget {
  kind: "task" | "empty"
  taskID?: string
}

// ── Helpers ──

export function classifyPanelMessageTarget(input: {
  selectedTaskID?: string
  boardTaskID?: string
  tasks?: any[]
}): "create" | "task" | "reload" | "orphan" {
  const selectedTaskID = String(input.selectedTaskID || "").trim()
  if (!selectedTaskID) return "create"
  if (selectedTaskID === String(input.boardTaskID || "").trim()) return "task"
  const tasks = Array.isArray(input.tasks) ? input.tasks : []
  return tasks.some((item: any) => item?.task?.id === selectedTaskID) ? "reload" : "orphan"
}

async function resolvePanelMessageTaskID(): Promise<string> {
  const selectedTaskID = String(activeTaskID() || "").trim()
  if (!selectedTaskID) return ""

  let target = classifyPanelMessageTarget({
    selectedTaskID,
    boardTaskID: boardStore.board?.task?.id,
    tasks: boardStore.tasks,
  })

  if (target === "orphan") {
    await loadTasks()
    target = classifyPanelMessageTarget({
      selectedTaskID,
      boardTaskID: boardStore.board?.task?.id,
      tasks: boardStore.tasks,
    })
  }

  if (target === "task") return selectedTaskID

  if (target === "reload") {
    await selectTask(selectedTaskID)
    return String(activeTaskID() || "").trim()
  }

  await selectTask("")
  return ""
}

// ── Public: conversationTarget ──

/**
 * Returns the current conversation target (task or empty).
 */
export function conversationTarget(): ConversationTarget {
  if (activeTaskID()) {
    return {
      kind: "task",
      taskID: activeTaskID(),
    }
  }
  return { kind: "empty" }
}

// ── Public: conversationTargetKey ──

/**
 * Stable string key for the current conversation target.
 */
export function conversationTargetKey(target: ConversationTarget = conversationTarget()): string {
  if (target.taskID) return `task:${target.taskID}`
  return "empty"
}

// ── Public: canComposeChat ──

/**
 * Returns true when the chat composer should be enabled.
 */
export function canComposeChat(): boolean {
  if (!appStore.connected) return false
  if (activeSessionID()) return true
  // Derive workspace mode from store state.
  // "task" mode: a task is selected.
  // "empty" mode: no task selected, no session-only workspace.
  // Both allow composing. All other modes (e.g. a pure session workspace
  // with no associated task) are not represented in the Solid stores yet.
  const mode = workspaceMode()
  return mode === "empty" || mode === "task"
}

// ── Internal: abortChatTarget ──

/**
 * Send a remote abort/cancel request for a single target.
 */
async function abortChatTargetRemote(target: ChatAbortTarget): Promise<void> {
  if (target.kind === "task") {
    await requestTaskCancellation({
      taskID: target.taskID,
      directory: target.directory,
      surface: "overlay.chat_request_stop",
      reason: "Operator stopped the active task chat request",
    })
    return
  }
  if (target.kind === "mission") {
    const aborted = await abortMission(
      { missionID: target.missionID, directory: target.directory },
      {
        surface: "overlay.chat_request_stop",
        reason: "Operator stopped the active Mission chat request",
      },
    )
    if (!aborted) throw new Error(`Mission abort was not accepted: ${target.missionID}`)
    return
  }
  await apiJson(
    directoryScopedPath(`session/${encodeURIComponent(target.sessionID)}/abort`, target.directory, "abort session"),
    {
      method: "POST",
    },
  )
}

// ── Public: stopChatRequest ──

/**
 * Abort the active chat request and cancel its exact remote session or task.
 * Returns true if the abort was dispatched, false if no active request.
 */
export async function stopChatRequest(): Promise<boolean> {
  const request = messageStore.chatRequest
  if (!request) return false

  abortChatRequest()
  await abortChatTargetRemote(request.target)
  return true
}

function sessionPromptParts(text: string, attachments: any[], metadata: any): any[] {
  const parts: any[] = [
    {
      type: "text",
      text,
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
  ]
  for (const attachment of attachments) {
    if (!attachment?.url || !attachment?.mime) continue
    parts.push({
      type: "file",
      mime: String(attachment.mime),
      url: String(attachment.url),
      presentation: "attachment-index",
      ...(attachment.filename ? { filename: String(attachment.filename) } : {}),
    })
  }
  return parts
}

function missionExecutionForPrompt(sessionID: string): WorkLedgerMissionRow | null {
  const execution = workLedgerSessionExecution(sessionID)
  if (execution?.kind === "mission") return execution
  const source = boardStore.selectedSource
  if (source?.kind === "session" && source.id === sessionID && source.sessionKind === "mission") {
    throw new Error(`Mission Work Ledger identity is unavailable for Session ${sessionID}`)
  }
  return null
}

export async function promptSessionMessage(input: {
  sessionID: string
  directory: string
  text: string
  attachments?: any[]
  metadata?: Record<string, unknown>
  promptProfile?: string
  model?: { providerID: string; modelID: string }
  onDispatch?: () => void
}): Promise<any> {
  const requestID = randomUUID()
  const controller = new AbortController()
  const mission = missionExecutionForPrompt(input.sessionID)
  const request: ChatRequestState = {
    requestID,
    controller,
    target: mission
      ? { kind: "mission", missionID: mission.missionID, directory: mission.directory }
      : { kind: "session", sessionID: input.sessionID, directory: input.directory },
  }
  try {
    setConnectionStatus("online")
    setChatRequest(request)
    if (mission) {
      return await wakeMission({
        missionID: mission.missionID,
        directory: mission.directory,
        productPillar: mission.productPillar,
        text: input.text,
        attachments: input.attachments,
        model: input.model ? `${input.model.providerID}/${input.model.modelID}` : currentOpenCorvusModel(),
        signal: controller.signal,
      })
    }
    if (input.promptProfile) {
      await setSessionExpertSquadActive(input.sessionID, input.promptProfile, input.directory)
    }
    input.onDispatch?.()
    const result = await apiJson(
      directoryScopedPath(
        `session/${encodeURIComponent(input.sessionID)}/message`,
        input.directory,
        "session prompt",
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageID: `msg_${requestID}`,
          parts: sessionPromptParts(input.text, input.attachments ?? [], input.metadata ?? {}),
          model: input.model ?? currentOpenCorvusPromptModel(),
        }),
        signal: controller.signal,
      },
    )
    ingestPersistedConversationMessage(result)
    return result
  } catch (error) {
    // A locally aborted request is the successful completion of the operator's
    // explicit Stop action. The durable Mission/Task/Session cancellation is
    // dispatched by stopChatRequest; do not surface that local transport abort
    // as a second, contradictory send failure.
    if (controller.signal.aborted) return undefined
    throw error
  } finally {
    if (messageStore.chatRequest?.requestID === request.requestID) {
      setChatRequest(null)
    }
  }
}

export async function panelMessage(
  text: string,
  attachmentsOrMeta: any[] | Record<string, any> = [],
  metadata: any = {},
  onDispatch?: () => void,
): Promise<any> {
  const attachments = Array.isArray(attachmentsOrMeta) ? attachmentsOrMeta : []
  const meta = Array.isArray(attachmentsOrMeta) ? metadata : attachmentsOrMeta
  const promptProfile = typeof meta?.promptProfile === "string" ? meta.promptProfile : undefined
  const explicitTarget =
    meta?.target && typeof meta.target.taskID === "string" && typeof meta.target.directory === "string"
      ? {
          taskID: meta.target.taskID.trim(),
          directory: meta.target.directory.trim(),
        }
      : undefined
  const requestMetadata = { ...(meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {}) }
  delete requestMetadata.promptProfile
  delete requestMetadata.target
  const sessionID = activeSessionID()
  if (sessionID && !explicitTarget) {
    return promptSessionMessage({
      sessionID,
      directory: conversationSourceDirectory({ kind: "session", id: sessionID }),
      text,
      attachments,
      metadata: requestMetadata,
      promptProfile,
      model: currentOpenCorvusPromptModel(),
      onDispatch,
    })
  }

  const requestID = randomUUID()
  const controller = new AbortController()
  const requestBase = {
    requestID,
    controller,
  }
  let request: ChatRequestState | undefined
  try {
    const taskID = explicitTarget?.taskID || (await resolvePanelMessageTaskID())
    if (!taskID) throw new Error("panelMessage: an Assistant session or task must be selected")
    setConnectionStatus("online")
    const directory = explicitTarget?.directory || taskOwningDirectory(taskID)
    request = { ...requestBase, target: { kind: "task", taskID, directory } }
    setChatRequest(request)
    // Every status (active, blocked, cancelled, completed, failed) →
    // send message directly to the task. Status is display/audit context, not
    // a routing gate; users sending a follow-up to any task expect the same
    // conversation to continue, not a brand-new task.
    onDispatch?.()
    const result = await apiJson(taskScopedPath(taskID, directory, "/message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source: typeof requestMetadata.source === "string" ? requestMetadata.source : "panel",
        model: currentOpenCorvusModel(),
        ...(Object.keys(requestMetadata).length > 0 ? { metadata: requestMetadata } : {}),
        ...(promptProfile ? { promptProfile } : {}),
        ...(attachments.length > 0
          ? {
              attachments: attachments.map((att) => ({
                mime: att.mime,
                url: att.url,
                ...(att.filename ? { filename: att.filename } : {}),
              })),
            }
          : {}),
      }),
      signal: controller.signal,
    })
    // Server returned the persisted user Message + parts. Project them
    // through tree-writer immediately so the user sees their bubble before
    // the SSE round-trip lands; messageStore live ingestion is retired.
    ingestPersistedConversationMessage(result.user_message)
    await loadBoard()
    // The real conversation comes from board/transcript rehydration. Mirroring
    // the route response locally would create a second, fake assistant turn.
    return result
  } finally {
    if (request && messageStore.chatRequest?.requestID === request.requestID) {
      setChatRequest(null)
    }
  }
}

// ── Re-export store accessors used by consumers ──

export { setChatRequest, abortChatRequest, setChatAttachments }
