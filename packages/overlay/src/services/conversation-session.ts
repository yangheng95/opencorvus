import { batch } from "solid-js"
import { clearBoard, setBoardStore, boardStore, type BoardSource } from "../store/board"
import { abortChatRequest, setChatAttachments } from "../store/messages"
import {
  conversationSessionStore,
  setConversationStore,
  type ConversationSessionCursor,
  type ConversationExperience,
  type ConversationSessionInfo,
} from "../store/conversation-session"
import { cancelConversationReplay, hydrateConversation, resetConversationProjection } from "./conversation"
import { startSSE, stopSSE } from "./sse"
import { resetSelectedLiveCursor } from "./selected-stream-cursor"
import { clearConversationUiState } from "../store/conversation-ui"
import { apiJson, ApiError, serverSettledRequest } from "./api"
import { ApiAuthorityChangedError, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { applyDirectory, ownsWorkspaceSelection } from "./workspace"
import { AppLog } from "../utils/log"
import { formatErrorDetails } from "./diagnostics"
import type { WorkLedgerStreamEvent } from "./sse"
import { clearComposerModelProjection, projectComposerModelFromSession } from "./composer-model"

type ConversationSessionResponse = {
  session: ConversationSessionInfo
}

type ConversationSessionsResponse = {
  sessions: ConversationSessionInfo[]
  nextCursor?: ConversationSessionCursor
}

let sessionListLoadOwner: symbol | null = null
let sessionListLoadMoreOwner: symbol | null = null
let sessionActionOwner: symbol | null = null

export function retireConversationSessionProjection(clear = true): void {
  sessionListLoadOwner = null
  sessionListLoadMoreOwner = null
  sessionActionOwner = null
  setConversationStore({ loading: false, loadingMore: false, actionBusyID: "", error: "", nextCursor: null, ...(clear ? { sessions: [], searchQuery: "" } : {}) })
}

export type SelectConversationSessionOptions = {
  authority?: ApiAuthority
  sessionID: string
  directory: string
  experience: ConversationExperience
  signal?: AbortSignal
  selectionEpoch: number
}

export type ConversationSessionActionTarget = {
  authority?: ApiAuthority
  sessionID: string
  directory: string
  experience: ConversationExperience
}

export type ActiveConversationHandoff = {
  sessionID: string
  directory: string
  experience: "work"
  callerSessionID: string
  callerExperience: ConversationExperience
}

export function activeConversationHandoff(
  event: WorkLedgerStreamEvent,
  selectedSource: BoardSource | null,
): ActiveConversationHandoff | null {
  if (event.type !== "work-ledger.conversation-handoff") return null
  if (
    selectedSource?.kind !== "session" ||
    selectedSource.sessionKind !== "conversation" ||
    selectedSource.id !== event.callerSessionID ||
    selectedSource.experience !== event.callerExperience
  ) {
    return null
  }
  return {
    sessionID: event.sessionID,
    directory: event.directory,
    experience: event.experience,
    callerSessionID: event.callerSessionID,
    callerExperience: event.callerExperience,
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw signal.reason ?? new DOMException("Coding assistant activation aborted", "AbortError")
}

function sessionIDFromResponse(value: ConversationSessionResponse): string {
  const id = String(value?.session?.id || "").trim()
  if (!id) throw new Error("Coding assistant session response missing session.id")
  return id
}

function normalizeSession(input: ConversationSessionInfo): ConversationSessionInfo {
  return {
    id: String(input.id || ""),
    kind: String(input.kind || ""),
    title: input.title ?? null,
    directory: input.directory ?? null,
    metadata: input.metadata ?? null,
    time: input.time,
  }
}

function sessionUpdated(session: ConversationSessionInfo): number {
  return Number(session.time?.updated || session.time?.created || 0)
}

function mergeSessions(
  current: ConversationSessionInfo[],
  incoming: ConversationSessionInfo[],
): ConversationSessionInfo[] {
  const map = new Map<string, ConversationSessionInfo>()
  for (const session of current) {
    if (session.id) map.set(session.id, session)
  }
  for (const raw of incoming) {
    const session = normalizeSession(raw)
    if (session.id) map.set(session.id, session)
  }
  return [...map.values()].sort((a, b) => sessionUpdated(b) - sessionUpdated(a))
}

function setSessionRow(session: ConversationSessionInfo): void {
  setConversationStore("sessions", (current) => mergeSessions(current, [session]))
}

function removeSessionRow(sessionID: string): void {
  setConversationStore("sessions", (current) => current.filter((session) => session.id !== sessionID))
}

function reconcileSessionAfterCommit(sessionID: string, operation: "archive" | "delete" | "restore", run: () => void) {
  try {
    run()
  } catch (error) {
    AppLog.error("conversation-session", "failed to reconcile Chat after committed mutation", {
      sessionID,
      operation,
      error: formatErrorDetails(error),
      diagnosticID: `conversation-session:${operation}-projection-reconcile-failed:${sessionID}`,
      diagnosticTitle: error instanceof Error ? error.message : String(error),
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticDetails: formatErrorDetails(error),
    })
  }
}

function sameCursor(a: ConversationSessionCursor | null | undefined, b: ConversationSessionCursor | null | undefined) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.updated === b.updated && a.sessionID === b.sessionID
}

function conversationSessionsPath(input: {
  experience: ConversationExperience
  directory: string
  limit: number
  searchQuery: string
  cursor?: ConversationSessionCursor | null
}): string {
  const directory = input.directory.trim()
  if (!directory) throw new Error("conversationSessionSessionsPath: directory is required")
  const params = new URLSearchParams()
  params.set("directory", directory)
  params.set("limit", String(input.limit))
  const search = input.searchQuery.trim()
  if (search) params.set("search", search)
  if (input.cursor) {
    params.set("cursorUpdated", String(input.cursor.updated))
    params.set("cursorSessionID", input.cursor.sessionID)
  }
  return `coding/${input.experience}/sessions?${params.toString()}`
}

function conversationSessionPath(target: ConversationSessionActionTarget, suffix = ""): string {
  const sessionID = target.sessionID.trim()
  const directory = target.directory.trim()
  if (!sessionID || !directory) throw new Error("conversationSessionSessionPath: sessionID and directory are required")
  const params = new URLSearchParams({ directory })
  return `coding/${target.experience}/session/${encodeURIComponent(sessionID)}${suffix}?${params.toString()}`
}

export async function loadConversationSessions(options: {
  authority?: ApiAuthority
  experience: ConversationExperience
  directory: string
  signal?: AbortSignal
  append?: boolean
  searchQuery?: string
  cursor?: ConversationSessionCursor | null
  isCurrentSource?: () => boolean
}): Promise<void> {
  const authority = options.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  assertNotAborted(options.signal)
  const directory = String(options.directory || "").trim()
  if (!directory) throw new Error("loadConversationSessions: directory is required")
  const append = options.append === true
  const searchQuery = String(options.searchQuery ?? conversationSessionStore.searchQuery).trim()
  const cursor = append ? (options.cursor ?? conversationSessionStore.nextCursor) : null
  const token = Symbol("conversation-session-session-list")
  if (append) sessionListLoadMoreOwner = token
  else {
    sessionListLoadOwner = token
    sessionListLoadMoreOwner = null
    setConversationStore("loadingMore", false)
  }
  const ownsOwner = () => isApiAuthorityCurrent(authority) && (append ? sessionListLoadMoreOwner === token : sessionListLoadOwner === token)
  const ownsRequest = () => {
    if (!ownsOwner()) return false
    if (conversationSessionStore.searchQuery.trim() !== searchQuery) return false
    if (append && !sameCursor(conversationSessionStore.nextCursor, cursor)) return false
    return options.isCurrentSource?.() ?? true
  }
  setConversationStore(append ? "loadingMore" : "loading", true)
  setConversationStore("error", "")
  try {
    const listed = (await apiJson(
      conversationSessionsPath({ experience: options.experience, directory, limit: 30, searchQuery, cursor }),
      {
        authority,
        signal: options.signal,
      },
    )) as ConversationSessionsResponse
    assertNotAborted(options.signal)
    if (!ownsRequest()) return
    setConversationStore("sessions", (current) =>
      append ? mergeSessions(current, listed.sessions || []) : (listed.sessions || []).map(normalizeSession),
    )
    setConversationStore("nextCursor", listed.nextCursor ?? null)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    if (!ownsRequest()) return
    setConversationStore("error", error instanceof Error ? error.message : String(error))
    throw error
  } finally {
    if (ownsOwner()) {
      setConversationStore(append ? "loadingMore" : "loading", false)
      if (append) sessionListLoadMoreOwner = null
      else sessionListLoadOwner = null
    }
  }
}

export function isConversationSource(source: BoardSource | null = boardStore.selectedSource): boolean {
  return source?.kind === "session" && source.sessionKind === "conversation"
}

export function conversationSourceExperience(
  source: BoardSource | null = boardStore.selectedSource,
): ConversationExperience | undefined {
  if (source?.kind !== "session" || source.sessionKind !== "conversation") return undefined
  return source.experience
}

export function setConversationSearchQuery(query: string): void {
  setConversationStore("searchQuery", query)
}

async function createConversationSessionFromPath(options: {
  authority?: ApiAuthority
  selectionEpoch: number
  path: string
  experience: ConversationExperience
  signal?: AbortSignal
  body?: Record<string, unknown>
}): Promise<string> {
  const authority = options.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const selectionEpoch = options.selectionEpoch
  if (!ownsWorkspaceSelection(selectionEpoch)) throw new DOMException("Conversation creation superseded", "AbortError")
  assertNotAborted(options.signal)
  const response = (await apiJson(options.path, {
    authority,
    method: "POST",
    ...(options.body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }
      : {}),
    signal: options.signal,
  })) as ConversationSessionResponse
  if (!isApiAuthorityCurrent(authority)) return sessionIDFromResponse(response)
  if (!ownsWorkspaceSelection(selectionEpoch)) {
    throw new DOMException("Conversation creation superseded", "AbortError")
  }
  assertNotAborted(options.signal)
  setSessionRow(response.session)
  try {
    return await selectConversationSession({
      authority,
      sessionID: sessionIDFromResponse(response),
      directory: String(response.session.directory || ""),
      experience: options.experience,
      signal: options.signal,
      selectionEpoch,
    })
  } catch (error) {
    // Creation already has its canonical receipt; retired view hydration does not undo it.
    if (!isApiAuthorityCurrent(authority) && error instanceof ApiAuthorityChangedError) return sessionIDFromResponse(response)
    throw error
  }
}

export async function createConversationSession(options: {
  authority?: ApiAuthority
  selectionEpoch: number
  directory: string
  experience: ConversationExperience
  model?: string
  signal?: AbortSignal
}): Promise<string> {
  const directory = options.directory.trim()
  if (!directory) throw new Error("createConversationSession: directory is required")
  const params = new URLSearchParams({ directory })
  return createConversationSessionFromPath({
    authority: options.authority,
    selectionEpoch: options.selectionEpoch,
    path: `coding/${options.experience}/session?${params.toString()}`,
    experience: options.experience,
    signal: options.signal,
    body: options.model?.trim() ? { model: options.model.trim() } : {},
  })
}

export async function createGlobalConversationSession(options: {
  authority?: ApiAuthority
  selectionEpoch: number
  experience: ConversationExperience
  model?: string
  signal?: AbortSignal
}): Promise<string> {
  const model = options.model?.trim()
  return createConversationSessionFromPath({
    authority: options.authority,
    selectionEpoch: options.selectionEpoch,
    path: `global/${options.experience}`,
    experience: options.experience,
    signal: options.signal,
    body: model ? { model } : {},
  })
}

export async function selectConversationSession(options: SelectConversationSessionOptions): Promise<string> {
  const authority = options.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const requestedSessionID = String(options.sessionID || "").trim()
  if (!requestedSessionID) throw new Error("selectConversationSession: sessionID is required")
  const inputDirectory = String(options.directory || "").trim()
  if (!inputDirectory) throw new Error("selectConversationSession: session directory is required")
  const selectionEpoch = options.selectionEpoch
  if (!ownsWorkspaceSelection(selectionEpoch)) {
    throw new DOMException("Coding assistant selection superseded", "AbortError")
  }
  const initialSource: BoardSource = {
    kind: "session",
    id: requestedSessionID,
    directory: inputDirectory,
    sessionKind: "conversation",
    experience: options.experience,
  }
  abortChatRequest()
  clearComposerModelProjection()
  cancelConversationReplay()
  setChatAttachments([])
  stopSSE()
  resetSelectedLiveCursor()
  clearConversationUiState()
  batch(() => {
    clearBoard()
    resetConversationProjection({ scrollIntent: "bottom", cause: "conversation-session-switch" })
    setBoardStore("selectedSource", initialSource)
    setBoardStore("taskSwitching", true)
  })
  const currentActivation = (async () => {
    const sessionID = requestedSessionID
    const stale = () => !isApiAuthorityCurrent(authority) || !ownsWorkspaceSelection(selectionEpoch)
    assertNotAborted(options.signal)
    const claimed = (await apiJson(
      conversationSessionPath({ sessionID, directory: inputDirectory, experience: options.experience }),
      {
        authority,
        signal: options.signal,
      },
    )) as ConversationSessionResponse | undefined
    if (stale()) throw new DOMException("Coding assistant selection superseded", "AbortError")
    if (claimed?.session) setSessionRow(claimed.session)
    const directory = String(claimed?.session?.directory || "").trim()
    if (!directory) throw new Error("selectConversationSession: session directory is required")
    assertNotAborted(options.signal)
    const applied = await applyDirectory(directory, {
      authority,
      save: true,
      restoreWorkspace: false,
      preserveSelection: true,
      selectionEpoch,
      signal: options.signal,
    })
    if (!applied || stale()) throw new DOMException("Coding assistant selection superseded", "AbortError")
    assertNotAborted(options.signal)
    const source: BoardSource = {
      kind: "session",
      id: sessionID,
      directory,
      sessionKind: "conversation",
      experience: options.experience,
    }
    setBoardStore("selectedSource", source)
    try {
      await hydrateConversation(source, {
        authority,
        signal: options.signal,
        scrollIntent: "bottom",
        resetCause: "conversation-session-hydrate",
        directory,
      })
      assertNotAborted(options.signal)
      if (!stale() && isConversationSource(source)) {
        startSSE(source, 0, { directory, authority })
        void projectComposerModelFromSession(
          { sessionID, directory, authority },
          () => !stale() && boardStore.selectedSource?.kind === "session" && boardStore.selectedSource.id === sessionID,
        )
      }
      return sessionID
    } finally {
      if (!stale()) setBoardStore("taskSwitching", false)
    }
  })()
  try {
    return await currentActivation
  } catch (error) {
    if (
      isApiAuthorityCurrent(authority) && ownsWorkspaceSelection(selectionEpoch) &&
      boardStore.selectedSource?.kind === "session" &&
      boardStore.selectedSource.id === requestedSessionID
    ) {
      batch(() => {
        clearBoard()
        resetConversationProjection({ scrollIntent: "bottom", cause: "conversation-session-switch-failed" })
        setBoardStore("selectedSource", null)
      })
    }
    throw error
  } finally {
    if (isApiAuthorityCurrent(authority) && ownsWorkspaceSelection(selectionEpoch)) setBoardStore("taskSwitching", false)
  }
}

export async function renameConversationSession(
  target: ConversationSessionActionTarget,
  title: string,
): Promise<boolean> {
  const authority = target.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const owner = Symbol("rename")
  const owns = () => sessionActionOwner === owner && isApiAuthorityCurrent(authority)
  const id = target.sessionID.trim()
  const trimmed = title.trim()
  if (!id || !target.directory.trim() || !trimmed || trimmed.length > 200) {
    throw new Error("renameConversationSession: sessionID, directory, and 1-200 character title are required")
  }
  sessionActionOwner = owner
  setConversationStore("actionBusyID", id)
  try {
    const response = (await apiJson(conversationSessionPath(target), {
      authority,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    })) as ConversationSessionResponse
    if (!owns()) return true
    setSessionRow(response.session)
    if (isConversationSource() && boardStore.selectedSource?.id === id && boardStore.board) {
      setBoardStore("board", "title", response.session.title || trimmed)
    }
    return true
  } catch (error) {
    if (owns()) console.error("[conversation-session] rename failed", { sessionID: id, error })
    throw error
  } finally {
    if (owns()) setConversationStore("actionBusyID", "")
  }
}

export async function stopConversationSession(target: ConversationSessionActionTarget): Promise<boolean> {
  const authority = target.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const owner = Symbol("stop")
  const owns = () => sessionActionOwner === owner && isApiAuthorityCurrent(authority)
  const id = target.sessionID.trim()
  if (!id || !target.directory.trim()) throw new Error("stopConversationSession: sessionID and directory are required")
  sessionActionOwner = owner
  setConversationStore("actionBusyID", id)
  try {
    if (isConversationSource() && boardStore.selectedSource?.id === id) abortChatRequest()
    await apiJson(conversationSessionPath(target, "/abort"), { method: "POST", authority })
    return true
  } catch (error) {
    if (owns()) console.error("[conversation-session] stop failed", { sessionID: id, error })
    throw error
  } finally {
    if (owns()) setConversationStore("actionBusyID", "")
  }
}

export async function deleteConversationSession(target: ConversationSessionActionTarget): Promise<boolean> {
  const authority = target.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const owner = Symbol("delete")
  const owns = () => sessionActionOwner === owner && isApiAuthorityCurrent(authority)
  const id = target.sessionID.trim()
  if (!id || !target.directory.trim()) {
    throw new Error("deleteConversationSession: sessionID and directory are required")
  }
  sessionActionOwner = owner
  setConversationStore("actionBusyID", id)
  const selectionEpoch = boardStore.selectEpoch
  const wasSelected = isConversationSource() && boardStore.selectedSource?.id === id
  try {
    try {
      await apiJson(conversationSessionPath(target), serverSettledRequest({ method: "DELETE", authority }))
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
    if (!owns()) return true
    reconcileSessionAfterCommit(id, "delete", () => {
      if (wasSelected && selectionEpoch === boardStore.selectEpoch) {
        abortChatRequest()
        cancelConversationReplay()
        stopSSE()
        resetSelectedLiveCursor()
        batch(() => {
          clearBoard()
          resetConversationProjection({ scrollIntent: "bottom", cause: "conversation-session-delete" })
          setBoardStore("selectedSource", null)
          setBoardStore("selectEpoch", (value: number) => value + 1)
          setBoardStore("taskSwitching", false)
        })
      }
      removeSessionRow(id)
    })
    return true
  } catch (error) {
    if (owns()) console.error("[conversation-session] delete failed", { sessionID: id, error })
    throw error
  } finally {
    if (owns()) setConversationStore("actionBusyID", "")
  }
}

export async function setConversationSessionArchived(
  target: ConversationSessionActionTarget,
  archived: boolean,
): Promise<boolean> {
  const authority = target.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const owner = Symbol("archive")
  const owns = () => sessionActionOwner === owner && isApiAuthorityCurrent(authority)
  const id = target.sessionID.trim()
  if (!id || !target.directory.trim()) {
    throw new Error("setConversationSessionArchived: sessionID and directory are required")
  }
  sessionActionOwner = owner
  setConversationStore("actionBusyID", id)
  const selectionEpoch = boardStore.selectEpoch
  const wasSelected = isConversationSource() && boardStore.selectedSource?.id === id
  try {
    const request = {
      authority,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    } satisfies Parameters<typeof apiJson>[1]
    const response = (await apiJson(
      conversationSessionPath(target, "/archive"),
      archived ? serverSettledRequest(request) : request,
    )) as ConversationSessionResponse
    if (!owns()) return true
    reconcileSessionAfterCommit(id, archived ? "archive" : "restore", () => {
      if (!archived) {
        setSessionRow(response.session)
        return
      }
      if (wasSelected && selectionEpoch === boardStore.selectEpoch) {
        abortChatRequest()
        cancelConversationReplay()
        stopSSE()
        resetSelectedLiveCursor()
        batch(() => {
          clearBoard()
          resetConversationProjection({ scrollIntent: "bottom", cause: "conversation-session-archive" })
          setBoardStore("selectedSource", null)
          setBoardStore("selectEpoch", (value: number) => value + 1)
          setBoardStore("taskSwitching", false)
        })
      }
      removeSessionRow(id)
    })
    return true
  } catch (error) {
    if (owns()) console.error("[conversation-session] archive update failed", { sessionID: id, archived, error })
    throw error
  } finally {
    if (owns()) setConversationStore("actionBusyID", "")
  }
}
