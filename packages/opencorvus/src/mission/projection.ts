import z from "zod"
import { deriveTaskStatus } from "@/engine/task-status"
import { listMissionTasks, listTaskRows, pendingInteractionCounts, type TaskRow } from "@/engine/store"
import {
  MissionStatusSnapshot,
  TaskActivityState,
  activityFromTaskLifecycle,
  missionStatusSnapshot,
  taskStatusDetailFromBoard,
} from "@/status/task-status-snapshot"
import { compileBoard } from "@/workbench/board"
import { SessionStatus } from "@/session"
import { MissionID, MissionPendingPrompt, ProductPillarSchema } from "./schema"
import { missionPendingPrompt, type MissionSession } from "./session"
import { MissionBoardLane, missionBoardProjection } from "./board"
import { MissionCompletionFact } from "./completion"

export const MissionTaskStatus = z.enum(["queued", "active", "completed", "failed", "cancelled"])

export const MissionTaskProjection = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  lifecycleStatus: MissionTaskStatus,
  activityStatus: TaskActivityState,
  priority: z.enum(["critical", "high", "normal", "low"]),
  source: z.string(),
  productPillar: ProductPillarSchema,
  directory: z.string(),
  created: z.number(),
  updated: z.number(),
  pinned: z.boolean(),
  queueOrder: z.number(),
  started: z.number().optional(),
  completed: z.number().optional(),
})

export const MissionTaskStats = z.object({
  total: z.number(),
  running: z.number(),
  inactive: z.number(),
})

export const MissionRecord = z.object({
  missionID: MissionID,
  sessionID: z.string(),
  title: z.string(),
  directory: z.string(),
  created: z.number(),
  updated: z.number(),
  archived: z.number().optional(),
  interruptible: z.boolean(),
  productPillar: ProductPillarSchema,
  boardLane: MissionBoardLane,
  pendingInteractions: z.number().int().nonnegative(),
  pendingPrompt: MissionPendingPrompt.optional(),
  completion: MissionCompletionFact.optional(),
  tasks: MissionTaskProjection.array(),
  taskStats: MissionTaskStats,
})

export type MissionTaskProjectionValue = z.infer<typeof MissionTaskProjection>
export type MissionTaskStatsValue = z.infer<typeof MissionTaskStats>
export type MissionRecordValue = z.infer<typeof MissionRecord>

export function missionTaskBinding(
  task: Pick<TaskRow, "source" | "metadata">,
): { missionID: string; missionSessionID: string } | undefined {
  if (task.source !== "mission") return undefined
  const metadata = task.metadata
  if (!metadata || typeof metadata !== "object") return undefined
  if ((metadata as Record<string, unknown>).actor !== "mission") return undefined
  const mission = (metadata as Record<string, unknown>).mission
  if (!mission || typeof mission !== "object") return undefined
  const missionID = (mission as Record<string, unknown>).id
  const missionSessionID = (mission as Record<string, unknown>).session_id
  if (typeof missionID !== "string" || typeof missionSessionID !== "string") return undefined
  return { missionID, missionSessionID }
}

export function missionTaskStats(tasks: MissionTaskProjectionValue[]): MissionTaskStatsValue {
  return tasks.reduce(
    (stats, task) => {
      stats.total += 1
      stats[task.activityStatus] += 1
      return stats
    },
    { total: 0, running: 0, inactive: 0 },
  )
}

export function projectMissionTasks(session: MissionSession): MissionTaskProjectionValue[] {
  return listTaskRows(
    listMissionTasks({ projectID: session.projectID, missionID: session.missionID, sessionID: session.id }),
  ).map(({ task, directory }) => {
    const lifecycleStatus = deriveTaskStatus(task)
    return MissionTaskProjection.parse({
      id: task.id,
      title: task.title,
      description: task.request,
      lifecycleStatus,
      activityStatus: activityFromTaskLifecycle(lifecycleStatus),
      priority: task.priority,
      source: task.source,
      productPillar: task.product_pillar,
      directory,
      created: task.time_created,
      updated: task.time_updated,
      pinned: task.time_pinned !== null,
      queueOrder: task.queue_order,
      started: task.time_started ?? undefined,
      completed: task.time_completed ?? undefined,
    })
  })
}

export function missionRecord(session: MissionSession): MissionRecordValue {
  const tasks = projectMissionTasks(session)
  const status = SessionStatus.get(session.id)
  const interruptible = SessionStatus.isExecuting(status)
  const pendingByTask = pendingInteractionCounts(tasks.map((task) => task.id))
  const pendingInteractions = tasks.reduce((total, task) => total + (pendingByTask.get(task.id) ?? 0), 0)
  const board = missionBoardProjection(session, {
    interruptible,
    pendingInteractions,
    taskLifecycleStatuses: tasks.map((task) => task.lifecycleStatus),
  })
  return MissionRecord.parse({
    missionID: session.missionID,
    sessionID: session.id,
    title: session.title,
    directory: session.directory,
    created: session.time.created,
    updated: session.time.updated,
    archived: session.time.archived,
    interruptible,
    productPillar: session.productPillar,
    boardLane: board.lane,
    pendingInteractions: board.pendingInteractions,
    pendingPrompt: missionPendingPrompt(session),
    completion: board.completion,
    tasks,
    taskStats: missionTaskStats(tasks),
  })
}

export function missionStatusRecord(session: MissionSession): z.infer<typeof MissionStatusSnapshot> {
  const tasks = listTaskRows(
    listMissionTasks({ projectID: session.projectID, missionID: session.missionID, sessionID: session.id }),
  ).map(({ task }) => taskStatusDetailFromBoard(compileBoard({ taskID: task.id })))
  const sessionStatus = SessionStatus.get(session.id)
  return missionStatusSnapshot({
    missionID: session.missionID,
    sessionID: session.id,
    title: session.title,
    directory: session.directory,
    productPillar: session.productPillar,
    missionActivity: SessionStatus.isExecuting(sessionStatus) ? "running" : "inactive",
    tasks,
  })
}
