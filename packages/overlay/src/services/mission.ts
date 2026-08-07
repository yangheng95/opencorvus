// ── Mission Service ──
//
// Thin client over the server APIs the Mission activity calls: the Mission
// agent wake, Mission ledger, and task bindings. Every helper returns
// the parsed JSON body and lets failures propagate as ApiError; the page
// renders explicit error states (template §14 — no silent fallbacks).
//
// The Mission activity reads the same task sources as the panel — boardStore
// for tasks, settingsStore for the active directory — so this service does
// not duplicate task storage.

import type {
  MissionCreateDraftData,
  MissionCreateDraftResponse,
  MissionDispatchData,
  MissionDispatchResponse,
  MissionListResponse,
  MissionRenameResponse,
  MissionSetArchivedResponse,
  MissionStatusResponse,
  MissionWakeData,
  MissionWakeResponse,
  TaskStatusResponse,
} from "@opencorvus-ai/sdk"
import {
  TaskArchiveRequestBody,
  TaskCancellationRequestBody,
  type TaskCancellationRequestBody as TaskCancellationRequestBodyValue,
} from "@opencorvus-ai/transport-protocol"
import { apiJson, ApiError, serverSettledRequest } from "./api"
import { downloadProjectArchive } from "./project-archive"
import type { BoardSource } from "../store/board"
import type { WorkLedgerStreamEvent } from "./sse"

// ── Gateway statistics ──

export interface MissionStatsRecentTask {
  id: string
  title: string
  status: string
  priority?: string
  directory?: string
  updated?: number
}

export interface MissionStats {
  generatedAt: number
  project: {
    id: string
    name?: string
    worktree: string
    directory: string
  }
  tasks: {
    total: number
    status: Record<string, number>
    summary: unknown
    recent: MissionStatsRecentTask[]
  }
  capabilities: {
    total: number
    queries: number
    mutations: number
  }
  channelRuntime?: {
    running: boolean
    status: string
    channels: string[]
    detail?: string
  }
}

// Mission wake — single endpoint that starts or resumes the Mission agent
// session for one mission. The generated SDK body is the request contract;
// the Overlay adds only transport ownership fields.
export type MissionWakeBody = MissionWakeData["body"]
export type MissionWakeInput = MissionWakeBody & {
  /** Project directory that owns the Mission session and wake request. */
  directory: string
  signal?: AbortSignal
}

export type MissionWakeResult = MissionWakeResponse
export type MissionDraftBody = MissionCreateDraftData["body"]
export type MissionDraftInput = MissionDraftBody & {
  directory: string
  signal?: AbortSignal
}

export interface ActiveMissionHandoff extends MissionWakeResult {
  callerSessionID: string
  callerExperience: "chat" | "work"
  directory: string
}

export function activeMissionHandoff(
  event: WorkLedgerStreamEvent,
  selectedSource: BoardSource | null,
): ActiveMissionHandoff | null {
  if (event.type !== "work-ledger.mission-handoff") return null
  if (
    selectedSource?.kind !== "session" ||
    selectedSource.sessionKind !== "conversation" ||
    selectedSource.id !== event.callerSessionID ||
    selectedSource.experience !== event.callerExperience
  ) {
    return null
  }
  return {
    missionID: event.missionID,
    sessionID: event.sessionID,
    callerSessionID: event.callerSessionID,
    callerExperience: event.callerExperience,
    directory: event.directory,
    created: true,
    productPillar: event.callerExperience === "work" ? "work" : "code",
  }
}

export type MissionRecord = MissionListResponse[number]
export type MissionBoardLane = MissionRecord["boardLane"]
export type MissionBoardCounts = Record<MissionBoardLane, number>

export const MISSION_BOARD_LANES: readonly MissionBoardLane[] = [
  "backlog",
  "running",
  "attention",
  "review",
  "completed",
]

export function missionBoardCounts(records: readonly MissionRecord[]): MissionBoardCounts {
  return records.reduce<MissionBoardCounts>(
    (counts, record) => {
      counts[record.boardLane] += 1
      return counts
    },
    { backlog: 0, running: 0, attention: 0, review: 0, completed: 0 },
  )
}

export interface MissionPage {
  records: MissionRecord[]
  hasMore: boolean
  cursor: { updated: number; sessionID: string } | null
}

export type TaskStatusDetail = TaskStatusResponse
export type MissionStatusSnapshot = MissionStatusResponse

export function missionPage(records: MissionRecord[], visibleLimit: number): MissionPage {
  const visible = records.slice(0, visibleLimit)
  const last = visible.at(-1)
  return {
    records: visible,
    hasMore: records.length > visibleLimit,
    cursor: last ? { updated: last.updated, sessionID: last.sessionID } : null,
  }
}

export interface MissionActionTarget {
  missionID: string
  directory: string
}

export interface MissionStatusRequest {
  missionID: string
  directory: string
  signal?: AbortSignal
}

export interface TaskStatusRequest {
  taskID: string
  directory: string
  signal?: AbortSignal
}

// ── API helpers ──

export async function loadMissionStats(
  opts: { directory?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<MissionStats> {
  const params = new URLSearchParams()
  if (opts.directory) params.set("directory", opts.directory)
  if (typeof opts.limit === "number") params.set("limit", String(opts.limit))
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return (await apiJson(`gateway/stats${suffix}`, { signal: opts.signal })) as MissionStats
}

export async function loadMissions(
  opts: {
    directory?: string
    search?: string
    limit?: number
    cursorUpdated?: number
    cursorSessionID?: string
    archived?: boolean
    signal?: AbortSignal
  } = {},
): Promise<MissionRecord[]> {
  const params = new URLSearchParams()
  if (opts.directory) params.set("directory", opts.directory)
  if (opts.search) params.set("search", opts.search)
  if (typeof opts.limit === "number") params.set("limit", String(opts.limit))
  if (typeof opts.cursorUpdated === "number") params.set("cursorUpdated", String(opts.cursorUpdated))
  if (opts.cursorSessionID) params.set("cursorSessionID", opts.cursorSessionID)
  if (typeof opts.archived === "boolean") params.set("archived", String(opts.archived))
  const suffix = params.toString() ? `?${params.toString()}` : ""
  const data = await apiJson<MissionListResponse>(`mission${suffix}`, { signal: opts.signal })
  if (!Array.isArray(data)) {
    throw new Error(
      `loadMissions: server returned non-array body (got ${typeof data}). Server contract has drifted from MissionRecord[].`,
    )
  }
  return data
}

export async function loadMissionStatus(input: MissionStatusRequest): Promise<MissionStatusSnapshot> {
  const missionID = input.missionID.trim()
  const directory = input.directory.trim()
  if (!missionID || !directory) throw new Error("loadMissionStatus: missionID and directory are required")
  const params = new URLSearchParams({ directory })
  return await apiJson<MissionStatusResponse>(`mission/${encodeURIComponent(missionID)}/status?${params.toString()}`, {
    signal: input.signal,
  })
}

export async function loadTaskStatus(input: TaskStatusRequest): Promise<TaskStatusDetail> {
  const taskID = input.taskID.trim()
  const directory = input.directory.trim()
  if (!taskID || !directory) throw new Error("loadTaskStatus: taskID and directory are required")
  const params = new URLSearchParams({ directory })
  return await apiJson<TaskStatusResponse>(`task/${encodeURIComponent(taskID)}/status?${params.toString()}`, {
    signal: input.signal,
  })
}

export async function wakeMission(input: MissionWakeInput): Promise<MissionWakeResult> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("wakeMission: directory is required")
  const text = input.text.trim()
  if (!text) throw new Error("wakeMission: text is required")
  const body = {
    text,
    productPillar: input.productPillar,
    ...(input.missionID ? { missionID: input.missionID } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.expertSquadIDs !== undefined ? { expertSquadIDs: input.expertSquadIDs } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  } satisfies MissionWakeBody
  const params = new URLSearchParams({ directory })
  return await apiJson<MissionWakeResponse>(
    `mission/wake?${params.toString()}`,
    serverSettledRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: input.signal,
    }),
  )
}

export async function createMissionDraft(input: MissionDraftInput): Promise<MissionCreateDraftResponse> {
  const directory = input.directory.trim()
  const title = input.title.trim()
  const request = input.request.trim()
  if (!directory || !title || !request) {
    throw new Error("createMissionDraft: directory, title, and request are required")
  }
  const body = {
    title,
    request,
    productPillar: input.productPillar,
    ...(input.expertSquadIDs !== undefined ? { expertSquadIDs: input.expertSquadIDs } : {}),
  } satisfies MissionDraftBody
  const params = new URLSearchParams({ directory })
  return await apiJson<MissionCreateDraftResponse>(
    `mission/draft?${params.toString()}`,
    serverSettledRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: input.signal,
    }),
  )
}

export async function dispatchMission(
  target: MissionActionTarget,
  model?: string,
): Promise<MissionDispatchResponse> {
  const body = {
    ...(model?.trim() ? { model: model.trim() } : {}),
  } satisfies NonNullable<MissionDispatchData["body"]>
  return await apiJson<MissionDispatchResponse>(
    missionActionPath(target, "/dispatch"),
    serverSettledRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

function missionActionPath(target: MissionActionTarget, suffix = ""): string {
  const missionID = target.missionID.trim()
  const directory = target.directory.trim()
  if (!missionID || !directory) {
    throw new Error("missionActionPath: missionID and directory are required")
  }
  const params = new URLSearchParams({ directory })
  return `mission/${encodeURIComponent(missionID)}${suffix}?${params.toString()}`
}

export async function renameMission(target: MissionActionTarget, title: string): Promise<MissionRenameResponse> {
  const trimmed = title.trim()
  if (!trimmed || trimmed.length > 200) {
    throw new Error("renameMission: missionID, directory, and 1-200 character title are required")
  }
  return await apiJson<MissionRenameResponse>(missionActionPath(target, "/title"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: trimmed }),
  })
}

export async function abortMission(
  target: MissionActionTarget,
  provenance: TaskCancellationRequestBodyValue,
): Promise<boolean> {
  const body = TaskCancellationRequestBody.parse(provenance)
  return (await apiJson(missionActionPath(target, "/abort"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })) as boolean
}

export async function deleteMission(
  target: MissionActionTarget,
  provenance: TaskCancellationRequestBodyValue,
): Promise<boolean> {
  const body = TaskCancellationRequestBody.parse(provenance)
  try {
    return (await apiJson(
      missionActionPath(target),
      serverSettledRequest({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    )) as boolean
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return true
    throw error
  }
}

export function setMissionArchived(
  target: MissionActionTarget,
  archived: true,
  provenance: TaskCancellationRequestBodyValue,
): Promise<MissionSetArchivedResponse>
export function setMissionArchived(target: MissionActionTarget, archived: false): Promise<MissionSetArchivedResponse>
export async function setMissionArchived(
  target: MissionActionTarget,
  archived: boolean,
  provenance?: TaskCancellationRequestBodyValue,
): Promise<MissionSetArchivedResponse> {
  const body = TaskArchiveRequestBody.parse(
    archived
      ? {
          archived,
          ...TaskCancellationRequestBody.parse(provenance),
        }
      : { archived },
  )
  const request = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } satisfies Parameters<typeof apiJson>[1]
  return await apiJson<MissionSetArchivedResponse>(
    missionActionPath(target, "/archive"),
    archived ? serverSettledRequest(request) : request,
  )
}

export async function downloadMissionProjectArchive(target: MissionActionTarget): Promise<boolean> {
  return downloadProjectArchive({
    path: missionActionPath(target, "/project-archive"),
  })
}
