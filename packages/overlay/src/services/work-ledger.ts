import {
  WorkLedgerArchiveList as WorkLedgerArchiveListSchema,
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
import { apiJson } from "./api"
import { createSignal } from "solid-js"
import { t } from "../utils/i18n"
import { directoryScopedPath } from "./task-path"

export type WorkLedgerItemRow = WorkLedgerMissionRow | WorkLedgerTaskRow | WorkLedgerChatRow
export type WorkLedgerTopLevelItemRow = WorkLedgerMissionRow | WorkLedgerTaskRow | WorkLedgerChatRow
export type WorkLedgerKind = WorkLedgerItemRow["kind"]
export type WorkLedgerChatStatus = WorkLedgerChatRow["status"]
export type WorkLedgerPresentationStatus = "active" | "inactive"
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
const runtimeRows = new Map<string, WorkLedgerItemRow>()
let runtimeProjectDirectoryList: string[] = []

export function setWorkLedgerRuntimeRows(rows: readonly WorkLedgerRow[]): void {
  runtimeProjectDirectoryList = [
    ...new Set(rows.filter((row): row is WorkLedgerProjectRow => row.kind === "project").map((row) => row.directory)),
  ].sort((left, right) => left.localeCompare(right))
  for (const row of rows) {
    if (row.kind === "project") continue
    runtimeRows.set(`${row.kind}:${row.id}`, row)
    if (row.kind === "mission") {
      for (const task of row.tasks) runtimeRows.set(`task:${task.id}`, task)
    }
  }
  setRuntimeRowsRevision((revision) => revision + 1)
}

export function workLedgerProjectDirectories(): string[] {
  runtimeRowsRevision()
  return [...runtimeProjectDirectoryList]
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

export function workLedgerStatusVisible(status: WorkLedgerPresentationStatus | ""): boolean {
  return status !== ""
}

export function workLedgerPresentationLabel(row: WorkLedgerItemRow): string {
  const status = workLedgerPresentationStatus(row)
  return status === "active" ? t("task.status.running") : t("task.status.inactive")
}

export function __resetWorkLedgerRuntimeRowsForTest(): void {
  runtimeRows.clear()
  runtimeProjectDirectoryList = []
  setRuntimeRowsRevision((revision) => revision + 1)
}

export function workLedgerSessionInterruptible(sessionID: string): boolean {
  const row = workLedgerSessionExecution(sessionID)
  return row?.kind === "mission" ? row.interruptible : row?.status === "active"
}

export async function loadWorkLedger(
  input: {
    search?: string
    limit?: number
    cursor?: WorkLedgerCursor | null
    signal?: AbortSignal
  } = {},
): Promise<WorkLedgerList> {
  const params = new URLSearchParams()
  const search = input.search?.trim()
  if (search) params.set("search", search)
  if (typeof input.limit === "number") params.set("limit", String(input.limit))
  if (input.cursor) {
    params.set("cursorPinned", String(input.cursor.pinned))
    params.set("cursorUpdated", String(input.cursor.updated))
    params.set("cursorRowKey", input.cursor.rowKey)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return WorkLedgerListSchema.parse(await apiJson<unknown>(`work-ledger${suffix}`, { signal: input.signal }))
}

export async function loadArchivedWorkLedger(
  input: { search?: string; limit?: number; cursor?: WorkLedgerCursor | null; signal?: AbortSignal } = {},
): Promise<WorkLedgerArchiveList> {
  const params = new URLSearchParams()
  const search = input.search?.trim()
  if (search) params.set("search", search)
  if (typeof input.limit === "number") params.set("limit", String(input.limit))
  if (input.cursor) {
    params.set("cursorPinned", String(input.cursor.pinned))
    params.set("cursorUpdated", String(input.cursor.updated))
    params.set("cursorRowKey", input.cursor.rowKey)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return WorkLedgerArchiveListSchema.parse(
    await apiJson<unknown>(`work-ledger/archive${suffix}`, { signal: input.signal }),
  )
}

export async function setWorkLedgerProjectPinned(input: { projectID: string; pinned: boolean }): Promise<void> {
  await apiJson(`work-ledger/project/${encodeURIComponent(input.projectID)}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned: input.pinned }),
    headers: { "Content-Type": "application/json" },
  })
}

export async function setWorkLedgerItemPinned(input: { row: WorkLedgerItemRow; pinned: boolean }): Promise<void> {
  const itemID = input.row.kind === "task" ? input.row.id : input.row.sessionID
  const path = directoryScopedPath(
    `work-ledger/item/${input.row.kind}/${encodeURIComponent(itemID)}/pin`,
    input.row.directory,
    "setWorkLedgerItemPinned",
  )
  await apiJson(path, {
    method: "PATCH",
    body: JSON.stringify({ pinned: input.pinned }),
    headers: { "Content-Type": "application/json" },
  })
}
