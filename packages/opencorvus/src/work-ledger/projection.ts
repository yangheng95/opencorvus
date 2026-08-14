import z from "zod"
import {
  WorkLedgerArchiveList,
  WorkLedgerArchiveRow,
  WorkLedgerChatRow,
  WorkLedgerChatStatus,
  WorkLedgerList,
  WorkLedgerMissionRow,
  WorkLedgerProjectRow,
  WorkLedgerRow,
  WorkLedgerTaskRow,
} from "@opencorvus-ai/transport-protocol"
import { EngineTaskTable } from "@/engine/engine.sql"
import { deriveTaskStatus } from "@/engine/task-status"
import { findTask, listTaskRows, pendingInteractionCounts } from "@/engine/store"
import { missionRecord, missionTaskBinding, type MissionTaskProjectionValue } from "@/mission/projection"
import { getMissionSessionByDirectory } from "@/mission/session"
import { ProjectTable } from "@/project/project.sql"
import { Session } from "@/session"
import { resolveSessionActivityStatus } from "@/session/lifecycle"
import { SessionTable } from "@/session/session.sql"
import { Database, eq, sql } from "@/storage/db"
import { activityFromTaskLifecycle } from "@/status/task-status-snapshot"
import { rightSidebarConversationExperience } from "@/chat/session"
import { pendingTaskCancellationProjection } from "@/engine/cancellation-projection"

export {
  WorkLedgerArchiveList,
  WorkLedgerArchiveRow,
  WorkLedgerChatRow,
  WorkLedgerChatStatus,
  WorkLedgerCursor,
  WorkLedgerList,
  WorkLedgerMissionRow,
  WorkLedgerProjectRow,
  WorkLedgerRow,
  WorkLedgerTaskRow,
} from "@opencorvus-ai/transport-protocol"

export type WorkLedgerRowValue = z.infer<typeof WorkLedgerRow>
export type WorkLedgerListValue = z.infer<typeof WorkLedgerList>
export type WorkLedgerArchiveRowValue = z.infer<typeof WorkLedgerArchiveRow>
export type WorkLedgerArchiveListValue = z.infer<typeof WorkLedgerArchiveList>

type WorkLedgerTopRowCandidate = {
  kind: "project" | "mission" | "task" | "chat"
  id: string
  sessionID: string | null
  directory: string
  title: string
  created: number
  updated: number
  pinned: number
  rowKey: string
}

export type WorkLedgerListInput = {
  directory?: string
  search?: string
  limit?: number
  cursorUpdated?: number
  cursorPinned?: boolean
  cursorRowKey?: string
  archivedOnly?: boolean
}

function rowKey(row: { kind: string; id: string }): string {
  return `${row.kind}:${row.id}`
}

function searchPattern(search: string | undefined): string | undefined {
  const term = search?.trim()
  return term ? `%${term}%` : undefined
}

function chatStatus(sessionID: string): z.infer<typeof WorkLedgerChatStatus> {
  return resolveSessionActivityStatus(sessionID)
}

function workLedgerProjectFromCandidate(candidate: WorkLedgerTopRowCandidate) {
  return WorkLedgerProjectRow.parse({
    kind: "project",
    id: candidate.id,
    title: candidate.title,
    directory: candidate.directory,
    created: candidate.created,
    updated: candidate.updated,
    pinned: candidate.pinned === 1,
  })
}

function workLedgerTaskFromMissionTask(
  task: MissionTaskProjectionValue,
  mission: { missionID: string; sessionID: string },
  pendingInteractions: ReadonlyMap<string, number>,
) {
  return WorkLedgerTaskRow.parse({
    kind: "task",
    id: task.id,
    title: task.title,
    description: task.description,
    directory: task.directory,
    created: task.created,
    started: task.started,
    completed: task.completed,
    updated: task.updated,
    pinned: task.pinned,
    lifecycleStatus: task.lifecycleStatus,
    cancellationStatus: task.cancellationStatus,
    activityStatus: task.activityStatus,
    priority: task.priority,
    source: task.source,
    productPillar: task.productPillar,
    pendingInteractions: pendingInteractions.get(task.id) ?? 0,
    missionID: mission.missionID,
    missionSessionID: mission.sessionID,
  })
}

function workLedgerArchivedTaskFromTaskID(taskID: string, pendingInteractions: ReadonlyMap<string, number>) {
  const task = findTask(taskID)
  if (!task) throw new Error(`Archived Work Ledger task candidate missing task row: ${taskID}`)
  const item = listTaskRows([task])[0]
  if (!item) throw new Error(`Archived Work Ledger task candidate missing task projection: ${taskID}`)
  const lifecycleStatus = deriveTaskStatus(task)
  const binding = missionTaskBinding(task)
  return WorkLedgerTaskRow.parse({
    kind: "task",
    id: task.id,
    title: task.title,
    description: task.request,
    directory: item.directory,
    created: task.time_created,
    started: task.time_started,
    completed: task.time_completed ?? undefined,
    updated: task.time_updated,
    pinned: task.time_pinned !== null,
    lifecycleStatus,
    cancellationStatus:
      lifecycleStatus === "cancelled"
        ? "cancelled"
        : pendingTaskCancellationProjection(task.id)
          ? "cancelling"
          : "none",
    activityStatus: activityFromTaskLifecycle(lifecycleStatus),
    priority: task.priority,
    source: task.source,
    productPillar: task.product_pillar,
    pendingInteractions: pendingInteractions.get(task.id) ?? 0,
    archived: task.time_archived ?? undefined,
    ...(binding
      ? {
          missionID: binding.missionID,
          missionSessionID: binding.missionSessionID,
        }
      : {}),
  })
}

async function workLedgerMissionFromCandidate(
  candidate: WorkLedgerTopRowCandidate,
  pendingInteractions: ReadonlyMap<string, number>,
) {
  const session = await getMissionSessionByDirectory({ missionID: candidate.id, directory: candidate.directory })
  const record = missionRecord(session)
  const tasks = record.tasks.map((task) =>
    workLedgerTaskFromMissionTask(
      task,
      { missionID: record.missionID, sessionID: record.sessionID },
      pendingInteractions,
    ),
  )
  return WorkLedgerMissionRow.parse({
    kind: "mission",
    id: record.missionID,
    missionID: record.missionID,
    sessionID: record.sessionID,
    title: record.title,
    directory: record.directory,
    created: record.created,
    started: record.created,
    updated: record.updated,
    pinned: candidate.pinned === 1,
    archived: record.archived,
    interruptible: record.interruptible,
    productPillar: record.productPillar,
    taskStats: record.taskStats,
    pendingInteractions: tasks.reduce((count, task) => count + task.pendingInteractions, 0),
    tasks,
  })
}

async function workLedgerChatFromCandidate(candidate: WorkLedgerTopRowCandidate) {
  const sessionID = candidate.sessionID ?? candidate.id
  const session = await Session.get(sessionID)
  const experience = rightSidebarConversationExperience(session)
  if (!experience) throw new Error(`Work Ledger conversation candidate ${sessionID} is missing its experience`)
  return WorkLedgerChatRow.parse({
    kind: "chat",
    experience,
    id: session.id,
    sessionID: session.id,
    title: session.title,
    directory: session.directory,
    created: session.time.created,
    started: session.time.created,
    updated: session.time.updated,
    pinned: candidate.pinned === 1,
    archived: session.time.archived,
    status: chatStatus(session.id),
  })
}

function topRowCandidates(input: Required<Pick<WorkLedgerListInput, "limit">> & WorkLedgerListInput) {
  const directory = input.directory?.trim()
  const search = searchPattern(input.search)
  const limit = input.limit + 1
  const archivedOnly = input.archivedOnly === true
  const sessionArchiveCondition = archivedOnly
    ? sql`${SessionTable.time_archived} IS NOT NULL`
    : sql`${SessionTable.time_archived} IS NULL`
  return Database.use((db) =>
    db.all<WorkLedgerTopRowCandidate>(sql`
      WITH top_rows AS (
        SELECT
          'project' AS kind,
          ${ProjectTable.id} AS id,
          NULL AS sessionID,
          ${ProjectTable.worktree} AS directory,
          COALESCE(${ProjectTable.name}, '') AS title,
          ${ProjectTable.time_created} AS created,
          ${ProjectTable.time_updated} AS updated
          ,CASE WHEN ${ProjectTable.time_pinned} IS NULL THEN 0 ELSE 1 END AS pinned
        FROM ${ProjectTable}
        WHERE ${archivedOnly ? 0 : 1} = 1
          AND (${directory ?? null} IS NULL OR ${ProjectTable.worktree} = ${directory ?? null})
          AND (
            ${search ?? null} IS NULL
            OR ${ProjectTable.name} LIKE ${search ?? null}
            OR ${ProjectTable.id} LIKE ${search ?? null}
            OR ${ProjectTable.worktree} LIKE ${search ?? null}
          )
        UNION ALL
        SELECT
          'mission' AS kind,
          json_extract(${SessionTable.metadata}, '$.mission.id') AS id,
          ${SessionTable.id} AS sessionID,
          ${SessionTable.directory} AS directory,
          ${SessionTable.title} AS title,
          ${SessionTable.time_created} AS created,
          ${SessionTable.time_updated} AS updated
          ,CASE WHEN ${SessionTable.time_pinned} IS NULL THEN 0 ELSE 1 END AS pinned
        FROM ${SessionTable}
        WHERE ${SessionTable.kind} = 'mission'
          AND ${sessionArchiveCondition}
          AND json_extract(${SessionTable.metadata}, '$.mission.id') IS NOT NULL
          AND (${directory ?? null} IS NULL OR ${SessionTable.directory} = ${directory ?? null})
          AND (
            ${search ?? null} IS NULL
            OR ${SessionTable.title} LIKE ${search ?? null}
            OR ${SessionTable.directory} LIKE ${search ?? null}
            OR json_extract(${SessionTable.metadata}, '$.mission.id') LIKE ${search ?? null}
            OR EXISTS (
              SELECT 1
              FROM ${EngineTaskTable} AS mission_task
              WHERE mission_task.project_id = ${SessionTable.project_id}
                AND mission_task.time_archived IS NULL
                AND mission_task.source = 'mission'
                AND json_extract(mission_task.metadata, '$.actor') = 'mission'
                AND json_extract(mission_task.metadata, '$.mission.id') = json_extract(${SessionTable.metadata}, '$.mission.id')
                AND json_extract(mission_task.metadata, '$.mission.session_id') = ${SessionTable.id}
                AND (
                  mission_task.title LIKE ${search ?? null}
                  OR mission_task.id LIKE ${search ?? null}
                )
            )
          )
        UNION ALL
        SELECT
          'chat' AS kind,
          ${SessionTable.id} AS id,
          ${SessionTable.id} AS sessionID,
          ${SessionTable.directory} AS directory,
          ${SessionTable.title} AS title,
          ${SessionTable.time_created} AS created,
          ${SessionTable.time_updated} AS updated
          ,CASE WHEN ${SessionTable.time_pinned} IS NULL THEN 0 ELSE 1 END AS pinned
        FROM ${SessionTable}
        WHERE ${SessionTable.kind} = 'assistant'
          AND ${sessionArchiveCondition}
          AND json_extract(${SessionTable.metadata}, '$.conversation.surface') = 'right-sidebar'
          AND json_extract(${SessionTable.metadata}, '$.conversation.experience') IN ('chat', 'work')
          AND (${directory ?? null} IS NULL OR ${SessionTable.directory} = ${directory ?? null})
          AND (
            ${search ?? null} IS NULL
            OR ${SessionTable.title} LIKE ${search ?? null}
            OR ${SessionTable.id} LIKE ${search ?? null}
            OR ${SessionTable.directory} LIKE ${search ?? null}
          )
        UNION ALL
        SELECT
          'task' AS kind,
          ${EngineTaskTable.id} AS id,
          ${EngineTaskTable.session_id} AS sessionID,
          COALESCE(task_session.directory, ${ProjectTable.worktree}, '') AS directory,
          ${EngineTaskTable.title} AS title,
          ${EngineTaskTable.time_created} AS created,
          ${EngineTaskTable.time_updated} AS updated
          ,CASE WHEN ${EngineTaskTable.time_pinned} IS NULL THEN 0 ELSE 1 END AS pinned
        FROM ${EngineTaskTable}
        LEFT JOIN ${SessionTable} AS task_session ON ${EngineTaskTable.session_id} = task_session.id
        LEFT JOIN ${ProjectTable} ON ${EngineTaskTable.project_id} = ${ProjectTable.id}
        WHERE ${archivedOnly ? 1 : 0} = 1
          AND ${EngineTaskTable.time_archived} IS NOT NULL
          AND (${directory ?? null} IS NULL OR COALESCE(task_session.directory, ${ProjectTable.worktree}, '') = ${directory ?? null})
          AND (
            ${search ?? null} IS NULL
            OR ${EngineTaskTable.title} LIKE ${search ?? null}
            OR ${EngineTaskTable.id} LIKE ${search ?? null}
            OR COALESCE(task_session.directory, ${ProjectTable.worktree}, '') LIKE ${search ?? null}
          )
      )
      SELECT
        kind,
        id,
        sessionID,
        directory,
        title,
        created,
        updated,
        pinned,
        kind || ':' || id AS rowKey
      FROM top_rows
      WHERE (
        ${input.cursorUpdated ?? null} IS NULL
        OR pinned < ${input.cursorPinned ? 1 : 0}
        OR (pinned = ${input.cursorPinned ? 1 : 0} AND updated < ${input.cursorUpdated ?? null})
        OR (pinned = ${input.cursorPinned ? 1 : 0} AND updated = ${input.cursorUpdated ?? null} AND (kind || ':' || id) < ${input.cursorRowKey ?? null})
      )
      ORDER BY pinned DESC, updated DESC, rowKey DESC
      LIMIT ${limit}
    `),
  )
}

async function workLedgerRowFromCandidate(
  candidate: WorkLedgerTopRowCandidate,
  pendingInteractions: ReadonlyMap<string, number>,
) {
  if (candidate.kind === "project") return workLedgerProjectFromCandidate(candidate)
  if (candidate.kind === "mission") return workLedgerMissionFromCandidate(candidate, pendingInteractions)
  if (candidate.kind === "chat") return workLedgerChatFromCandidate(candidate)
  return workLedgerArchivedTaskFromTaskID(candidate.id, pendingInteractions)
}

async function listWorkLedgerProjection(input: WorkLedgerListInput) {
  const limit = input.limit ?? 50
  const candidates = topRowCandidates({ ...input, limit })
  const visibleCandidates = candidates.slice(0, limit)
  const interactionCounts = pendingInteractionCounts()
  const rows: Array<WorkLedgerRowValue | WorkLedgerArchiveRowValue> = []
  for (const candidate of visibleCandidates) {
    rows.push(await workLedgerRowFromCandidate(candidate, interactionCounts))
  }
  const last = rows.at(-1)
  return {
    rows,
    nextCursor:
      candidates.length > limit && last
        ? {
            updated: last.updated,
            pinned: last.pinned,
            rowKey: rowKey(last),
          }
        : null,
  }
}

export async function listWorkLedger(input: WorkLedgerListInput = {}): Promise<WorkLedgerListValue> {
  return WorkLedgerList.parse(await listWorkLedgerProjection({ ...input, archivedOnly: false }))
}

export async function listArchivedWorkLedger(
  input: Omit<WorkLedgerListInput, "archivedOnly"> = {},
): Promise<WorkLedgerArchiveListValue> {
  return WorkLedgerArchiveList.parse(await listWorkLedgerProjection({ ...input, archivedOnly: true }))
}
