import {
  WorkLedgerArchiveList as WorkLedgerArchiveListSchema,
  WorkLedgerArchiveRow as WorkLedgerArchiveRowSchema,
  WorkLedgerList as WorkLedgerListSchema,
  type WorkLedgerArchiveList,
  type WorkLedgerArchiveRow,
  type WorkLedgerChatRow,
  type WorkLedgerCursor,
  type WorkLedgerList,
  type WorkLedgerMissionRow,
  type WorkLedgerMissionTaskRow,
  type WorkLedgerProjectRow,
  type WorkLedgerRow,
  type WorkLedgerTaskRow,
} from "@opencorvus-ai/transport-protocol"
import { apiJson, ApiError, captureApiAuthority, isApiAuthorityCurrent, mergeAbortSignals, type ApiAuthority } from "./api"
import { ArchiveStateUnconfirmedError } from "./archive-state"
import { createSignal } from "solid-js"
import { t } from "../utils/i18n"
import { directoryScopedPath } from "./task-path"
import { projectDirectoryKey } from "../utils/project-directory"
import { DEFAULT_REQUEST_TIMEOUT_MILLISECONDS } from "./host-transport"
import type { BoardSource } from "../store/board"

export const WORK_LEDGER_SEARCH_DELAY_MS = 150

export function normalizeWorkLedgerSearch(value: string): string {
  return value.trim()
}

export type WorkLedgerItemRow = WorkLedgerMissionRow | WorkLedgerTaskRow | WorkLedgerChatRow
export type WorkLedgerTopLevelItemRow = WorkLedgerMissionRow | WorkLedgerTaskRow | WorkLedgerChatRow
export type WorkLedgerKind = WorkLedgerItemRow["kind"]
export type WorkLedgerChatStatus = WorkLedgerChatRow["status"]
export type WorkLedgerPresentationStatus = "active" | "inactive"
export type WorkLedgerChangeIdentity = { sessionID?: string; taskID?: string | null }

export function workLedgerActionFailureText(action: string, error: unknown, title: string) {
  if (action === "archive" && error instanceof ArchiveStateUnconfirmedError) {
    return { title: t("archive.change_unconfirmed_title"), message: t("archive.check_after_unconfirmed", { title }) }
  }
  return {
    title: t("work_ledger.action_failed_title"),
    message: t("work_ledger.action_failed_message", { title }),
  }
}

export function workLedgerRefreshScope(
  change: WorkLedgerChangeIdentity | undefined,
  selected: Pick<BoardSource, "kind" | "id"> | null,
): "list" | "list-and-selection" {
  if (!selected) return "list"
  if (change?.sessionID && !change.taskID) {
    return selected.kind === "session" && selected.id === change.sessionID ? "list-and-selection" : "list"
  }
  // Task events may change a selected Mission through a child Task.
  return "list-and-selection"
}

export type {
  WorkLedgerArchiveList,
  WorkLedgerArchiveRow,
  WorkLedgerChatRow,
  WorkLedgerCursor,
  WorkLedgerList,
  WorkLedgerMissionRow,
  WorkLedgerMissionTaskRow,
  WorkLedgerProjectRow,
  WorkLedgerRow,
  WorkLedgerTaskRow,
}

const [runtimeRowsRevision, setRuntimeRowsRevision] = createSignal(0)
const runtimeRows = new Map<string, WorkLedgerRow>()

export function setWorkLedgerRuntimeRows(rows: readonly WorkLedgerRow[], authority = captureApiAuthority()): void {
  if (!isApiAuthorityCurrent(authority)) return
  runtimeRows.clear()
  for (const row of rows) {
    runtimeRows.set(`${row.kind}:${row.id}`, row)
    if (row.kind === "mission") {
      for (const task of row.tasks) runtimeRows.set(`task:${task.id}`, task)
    }
  }
  setRuntimeRowsRevision((revision) => revision + 1)
}

export function workLedgerProjectDirectories(): string[] {
  runtimeRowsRevision()
  return [
    ...new Set(
      [...runtimeRows.values()]
        .filter((row): row is WorkLedgerProjectRow => row.kind === "project")
        .map((row) => row.directory),
    ),
  ].sort((left, right) => left.localeCompare(right))
}

export function workLedgerProject(directory: string): WorkLedgerProjectRow | undefined {
  runtimeRowsRevision()
  const key = projectDirectoryKey(directory)
  return [...runtimeRows.values()].find(
    (row): row is WorkLedgerProjectRow => row.kind === "project" && projectDirectoryKey(row.directory) === key,
  )
}

export function workLedgerSessionExecution(sessionID: string): WorkLedgerMissionRow | WorkLedgerChatRow | null {
  runtimeRowsRevision()
  const id = sessionID.trim()
  if (!id) return null
  return (
    [...runtimeRows.values()].find(
      (row): row is WorkLedgerMissionRow | WorkLedgerChatRow =>
        (row.kind === "mission" || row.kind === "chat") && row.sessionID === id,
    ) ?? null
  )
}

export function workLedgerTaskExecution(taskID: string): WorkLedgerTaskRow | null {
  runtimeRowsRevision()
  const id = taskID.trim()
  if (!id) return null
  return (runtimeRows.get(`task:${id}`) as WorkLedgerTaskRow | undefined) ?? null
}

export function workLedgerActiveItem(input: { taskID?: string; sessionID?: string }): WorkLedgerItemRow | null {
  if (input.taskID) return workLedgerTaskExecution(input.taskID)
  if (input.sessionID) return workLedgerSessionExecution(input.sessionID)
  return null
}

export function workLedgerPresentationStatus(row: WorkLedgerItemRow): WorkLedgerPresentationStatus {
  if (row.kind === "mission") {
    return row.interruptible || row.taskStats.running > 0 ? "active" : "inactive"
  }
  if (row.kind === "task") return row.activityStatus === "running" ? "active" : "inactive"
  if (row.status === "active") return "active"
  return "inactive"
}

export function workLedgerTaskCanStop(row: WorkLedgerTaskRow): boolean {
  return row.lifecycleStatus === "active"
}

export function workLedgerArchiveLabel(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("mission.ledger.archive_title")
  if (row.kind === "chat") return t("coding_assistant.ledger.archive_title")
  return t(workLedgerTaskCanStop(row) ? "task.cancel_and_archive" : "task.archive_button_title")
}

export type WorkLedgerOutcomeStatus = Exclude<WorkLedgerTaskRow["lifecycleStatus"], "active"> | "blocked"

export function workLedgerOutcomeStatus(row: WorkLedgerItemRow): WorkLedgerOutcomeStatus | null {
  if (row.kind === "task") return row.lifecycleStatus === "active" ? null : row.lifecycleStatus
  if (row.kind === "mission") return row.outcome === "accepted" ? "completed" : row.outcome
  return null
}

export function workLedgerStatusVisible(status: WorkLedgerPresentationStatus | ""): boolean {
  return status !== ""
}

export function workLedgerPresentationLabel(row: WorkLedgerItemRow): string {
  const status = workLedgerPresentationStatus(row)
  return status === "active" ? t("task.status.running") : t("task.status.inactive")
}

export function retireWorkLedgerProjection(): void {
  runtimeRows.clear()
  setRuntimeRowsRevision((revision) => revision + 1)
}

export function __resetWorkLedgerRuntimeRowsForTest(): void {
  retireWorkLedgerProjection()
}

export function workLedgerSessionInterruptible(sessionID: string): boolean {
  const row = workLedgerSessionExecution(sessionID)
  return row?.kind === "mission" ? row.interruptible : row?.status === "active"
}

type WorkLedgerPageInput = {
  search?: string
  limit?: number
  cursor?: WorkLedgerCursor | null
  signal?: AbortSignal
  authority?: ApiAuthority
}

function readWorkLedgerPage(path: "work-ledger" | "work-ledger/archive", input: WorkLedgerPageInput): Promise<unknown> {
  const params = new URLSearchParams()
  const search = normalizeWorkLedgerSearch(input.search ?? "")
  if (search) params.set("search", search)
  if (typeof input.limit === "number") params.set("limit", String(input.limit))
  if (input.cursor) {
    params.set("cursorPinned", String(input.cursor.pinned))
    params.set("cursorUpdated", String(input.cursor.updated))
    params.set("cursorRowKey", input.cursor.rowKey)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  const signal = input.signal && mergeAbortSignals(input.signal, AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MILLISECONDS))
  return apiJson<unknown>(`${path}${suffix}`, { signal, authority: input.authority })
}

export async function loadWorkLedger(input: WorkLedgerPageInput = {}): Promise<WorkLedgerList> {
  return WorkLedgerListSchema.parse(await readWorkLedgerPage("work-ledger", input))
}

export async function loadArchivedWorkLedger(input: WorkLedgerPageInput = {}): Promise<WorkLedgerArchiveList> {
  return WorkLedgerArchiveListSchema.parse(await readWorkLedgerPage("work-ledger/archive", input))
}

type WorkLedgerSelectionTarget = {
  kind: "task" | "session"
  id: string
  directory: string
  authority: ApiAuthority
  signal?: AbortSignal
}

export async function loadWorkLedgerSelection(input: WorkLedgerSelectionTarget): Promise<WorkLedgerItemRow> {
  return WorkLedgerArchiveRowSchema.parse(await apiJson<unknown>(
    directoryScopedPath(`work-ledger/selection/${input.kind}/${encodeURIComponent(input.id)}`, input.directory),
    { authority: input.authority, signal: input.signal },
  ))
}

export type WorkLedgerSelectionRead =
  | { kind: "current"; key: string; row: WorkLedgerItemRow }
  | { kind: "unavailable"; key: string; row: WorkLedgerItemRow | null; cause: unknown }

function isTemporarySelectionReadFailure(cause: unknown): boolean {
  if (cause instanceof ApiError) return cause.status >= 500 || cause.status === 408 || cause.status === 429
  return cause instanceof TypeError || (cause instanceof DOMException && cause.name === "TimeoutError")
}

export async function readWorkLedgerSelection(
  input: WorkLedgerSelectionTarget & { key: string },
  previous: WorkLedgerSelectionRead | undefined,
): Promise<WorkLedgerSelectionRead> {
  const { key } = input
  try {
    return { kind: "current", key, row: await loadWorkLedgerSelection(input) }
  } catch (cause) {
    const row = previous?.key === key && isTemporarySelectionReadFailure(cause) ? previous.row : null
    return { kind: "unavailable", key, row, cause }
  }
}

type WorkLedgerArchiveIdentity =
  | { kind: "task"; taskID: string }
  | { kind: "mission"; missionID: string; sessionID: string }

export async function verifyWorkLedgerArchiveState(
  input: WorkLedgerArchiveIdentity & { directory: string; authority: ApiAuthority; archived: boolean },
): Promise<void> {
  const row = await loadWorkLedgerSelection({
    kind: input.kind === "task" ? "task" : "session",
    id: input.kind === "task" ? input.taskID : input.sessionID,
    directory: input.directory,
    authority: input.authority,
  })
  const sameOwner = input.kind === "task"
    ? row.kind === "task" && row.id === input.taskID
    : row.kind === "mission" && row.missionID === input.missionID && row.sessionID === input.sessionID
  if (!sameOwner || projectDirectoryKey(row.directory) !== projectDirectoryKey(input.directory)) {
    throw new Error("The archive check returned a different Work Ledger identity.")
  }
  if ((row.archived !== undefined) !== input.archived) {
    throw new Error("The selected Work Ledger item has not reached the requested archive state.")
  }
}

export async function setWorkLedgerProjectPinned(input: { projectID: string; pinned: boolean; authority?: ApiAuthority }): Promise<void> {
  await apiJson(`work-ledger/project/${encodeURIComponent(input.projectID)}/pin`, {
    authority: input.authority,
    method: "PATCH",
    body: JSON.stringify({ pinned: input.pinned }),
    headers: { "Content-Type": "application/json" },
  })
}

export async function setWorkLedgerItemPinned(input: { row: WorkLedgerItemRow; pinned: boolean; authority?: ApiAuthority }): Promise<void> {
  const itemID = input.row.kind === "task" ? input.row.id : input.row.sessionID
  const path = directoryScopedPath(
    `work-ledger/item/${input.row.kind}/${encodeURIComponent(itemID)}/pin`,
    input.row.directory,
    "setWorkLedgerItemPinned",
  )
  await apiJson(path, {
    authority: input.authority,
    method: "PATCH",
    body: JSON.stringify({ pinned: input.pinned }),
    headers: { "Content-Type": "application/json" },
  })
}
