import { asc, Database, eq, inArray } from "@/storage/db"
import { EngineArtifactTable, EngineInteractionRequestTable, EngineTaskTable } from "./engine.sql"
import { listAllMissionTasks, projectInteractionRowInTransaction, projectTaskRowInTransaction, type TaskRow } from "./store"
import {
  MessageTable,
  PartTable,
  SessionTable,
  ToolPartOutcomeTable,
  ToolPartProgressTable,
  ToolPartRequestTable,
} from "@/session/session.sql"
import { DurableActivityCursorSchema, type DurableActivityCursor } from "@opencorvus-ai/plugin"
import z from "zod"
import { createHash } from "node:crypto"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"

type ActivityRow = DurableActivityCursor & { revision: string }

function revisionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
}

function taskExecutionActivityTime(task: TaskRow) {
  return Math.max(task.time_created, task.time_started, task.time_completed ?? 0)
}

function latestActivity(rows: readonly ActivityRow[]): DurableActivityCursor {
  const latest = [...rows].sort(
    (left, right) =>
      right.time_updated - left.time_updated ||
      left.source.localeCompare(right.source) ||
      left.id.localeCompare(right.id),
  )[0]
  if (!latest) throw new Error("Durable activity scope is empty")
  return DurableActivityCursorSchema.parse({
    source: latest.source,
    id: latest.id,
    time_updated: latest.time_updated,
  })
}

function activityDigest(rows: readonly ActivityRow[]) {
  const canonical = [...rows]
    .sort(
      (left, right) =>
        left.time_updated - right.time_updated ||
        left.source.localeCompare(right.source) ||
        left.id.localeCompare(right.id),
    )
    .map((row) => `${row.time_updated}:${row.source.length}:${row.source}:${row.id.length}:${row.id}:${row.revision}`)
    .join("\n")
  return createHash("sha256").update(canonical, "utf8").digest("hex")
}

function readSessionTree(db: Database.TxOrDb, input: { projectID: string; rootSessionID: string }) {
  const projectSessions = db
    .select()
    .from(SessionTable)
    .where(eq(SessionTable.project_id, input.projectID))
    .orderBy(asc(SessionTable.time_created), asc(SessionTable.id))
    .all()
  const root = projectSessions.find((session) => session.id === input.rootSessionID)
  if (!root) throw new Error(`Session ${input.rootSessionID} is not owned by Project ${input.projectID}`)
  const includedSessionIDs = new Set([input.rootSessionID])
  let discovered = true
  while (discovered) {
    discovered = false
    for (const session of projectSessions) {
      if (session.parent_id && includedSessionIDs.has(session.parent_id) && !includedSessionIDs.has(session.id)) {
        includedSessionIDs.add(session.id)
        discovered = true
      }
    }
  }
  const sessions = projectSessions.filter((session) => includedSessionIDs.has(session.id))
  const sessionIDs = sessions.map((session) => session.id)
  const messages = db
    .select()
    .from(MessageTable)
    .where(inArray(MessageTable.session_id, sessionIDs))
    .orderBy(asc(MessageTable.time_created), asc(MessageTable.id))
    .all()
  const messageIDs = messages.map((message) => message.id)
  const parts = messageIDs.length
    ? db
        .select()
        .from(PartTable)
        .where(inArray(PartTable.message_id, messageIDs))
        .orderBy(asc(PartTable.time_created), asc(PartTable.id))
        .all()
    : []
  const toolRequests = messageIDs.length
    ? db.select().from(ToolPartRequestTable).where(inArray(ToolPartRequestTable.message_id, messageIDs))
        .orderBy(asc(ToolPartRequestTable.time_created), asc(ToolPartRequestTable.id)).all()
    : []
  const toolOutcomes = toolRequests.length
    ? db.select().from(ToolPartOutcomeTable)
        .where(inArray(ToolPartOutcomeTable.request_part_id, toolRequests.map((part) => part.id)))
        .orderBy(asc(ToolPartOutcomeTable.time_created), asc(ToolPartOutcomeTable.id)).all()
    : []
  const toolProgress = toolRequests.length
    ? db
        .select()
        .from(ToolPartProgressTable)
        .where(inArray(ToolPartProgressTable.request_part_id, toolRequests.map((part) => part.id)))
        .orderBy(asc(ToolPartProgressTable.time_created), asc(ToolPartProgressTable.id))
        .all()
    : []
  const projectedToolParts = toolRequests.map((request) => {
    const projected = projectToolPartInTransaction(db, request)
    if (!projected) throw new Error(`Tool request ${request.id} could not be projected`)
    const { id, messageID, sessionID: _sessionID, orderKey: _orderKey, ...data } = projected
    const outcome = toolOutcomes.find((candidate) => candidate.request_part_id === request.id)
    return {
      id,
      message_id: messageID,
      time_created: request.time_created,
      time_updated: outcome?.time_created ?? request.time_created,
      data,
    }
  })
  return {
    sessions,
    messages,
    parts,
    visibleParts: [...parts, ...projectedToolParts],
    toolRequests,
    toolProgress,
    toolOutcomes,
  }
}

export function readTaskDurableActivityScope(db: Database.TxOrDb, task: TaskRow) {
  if (!task.session_id) throw new Error(`Task ${task.id} has no root Session identity`)
  const sessionTree = readSessionTree(db, { projectID: task.project_id, rootSessionID: task.session_id })
  const artifacts = db
    .select()
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.task_id, task.id))
    .orderBy(asc(EngineArtifactTable.catalog_revision), asc(EngineArtifactTable.id))
    .all()
  const interactions = db
    .select()
    .from(EngineInteractionRequestTable)
    .orderBy(asc(EngineInteractionRequestTable.time_created), asc(EngineInteractionRequestTable.id))
    .all().map((row) => projectInteractionRowInTransaction(db, row)).filter((row) => row.task_id === task.id)
  const activity: ActivityRow[] = [
    {
      source: "task",
      id: task.id,
      time_updated: taskExecutionActivityTime(task),
      revision: revisionDigest({
        time_created: task.time_created,
        time_started: task.time_started,
        time_completed: task.time_completed,
        error: task.error,
        lifecycle_status: task.lifecycle_status,
      }),
    },
    ...sessionTree.sessions.map((session) => ({
      source: "session" as const,
      id: session.id,
      time_updated: session.time_created,
      revision: revisionDigest({ time_created: session.time_created }),
    })),
    ...sessionTree.messages.map((message) => ({
      source: "message" as const,
      id: message.id,
      time_updated: message.time_updated,
      revision: revisionDigest(message.data),
    })),
    ...sessionTree.parts.map((part) => ({
      source: "part" as const,
      id: part.id,
      time_updated: part.time_updated,
      revision: revisionDigest(part.data),
    })),
    ...sessionTree.toolRequests.map((request) => ({
      source: "part" as const,
      id: request.id,
      time_updated: request.time_created,
      revision: revisionDigest(request.data),
    })),
    ...sessionTree.toolProgress.map((progress) => ({
      source: "part" as const,
      id: progress.id,
      time_updated: progress.time_created,
      revision: revisionDigest({ title: progress.title, metadata: progress.metadata }),
    })),
    ...sessionTree.toolOutcomes.map((outcome) => ({
      source: "part" as const,
      id: outcome.id,
      time_updated: outcome.time_created,
      revision: revisionDigest(outcome.data),
    })),
    ...artifacts.map((artifact) => ({
      source: "engine_artifact" as const,
      id: artifact.id,
      time_updated: artifact.time_updated,
      revision: revisionDigest({
        catalog_revision: artifact.catalog_revision,
        payload_sha256: artifact.payload_sha256,
      }),
    })),
    ...interactions.map((interaction) => ({
      source: "interaction_request" as const,
      id: interaction.id,
      time_updated: interaction.time_updated,
      revision: revisionDigest(interaction),
    })),
  ]
  return { ...sessionTree, artifacts, interactions, activity, latest: latestActivity(activity) }
}

export function readTaskDurableActivity(input: { projectID: string; taskID: string }): DurableActivityCursor {
  return Database.transaction((db) => {
    const persistedTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
    if (!persistedTask || persistedTask.project_id !== input.projectID) {
      throw new Error(`Task ${input.taskID} is not owned by Project ${input.projectID}`)
    }
    const task = projectTaskRowInTransaction(db, persistedTask)
    return readTaskDurableActivityScope(db, task).latest
  })
}

export const MissionDurableActivityCursorSchema = z
  .object({
    mission_id: z.string().min(1),
    session_id: z.string().min(1),
    source: DurableActivityCursorSchema.shape.source,
    id: z.string().min(1),
    time_updated: z.number().int().nonnegative(),
    activity_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    tasks: DurableActivityCursorSchema.extend({ task_id: z.string().min(1) }).array(),
  })
  .strict()

export type MissionDurableActivityCursor = z.infer<typeof MissionDurableActivityCursorSchema>

export function readMissionDurableActivity(input: {
  projectID: string
  missionID: string
  sessionID: string
}): MissionDurableActivityCursor {
  return Database.transaction((db) => {
    const missionTree = readSessionTree(db, { projectID: input.projectID, rootSessionID: input.sessionID })
    const missionActivity: ActivityRow[] = [
      ...missionTree.sessions.map((session) => ({
        source: "session" as const,
        id: session.id,
        time_updated: session.time_created,
        revision: revisionDigest({ time_created: session.time_created }),
      })),
      ...missionTree.messages.map((message) => ({
        source: "message" as const,
        id: message.id,
        time_updated: message.time_updated,
        revision: revisionDigest(message.data),
      })),
      ...missionTree.parts.map((part) => ({
        source: "part" as const,
        id: part.id,
        time_updated: part.time_updated,
        revision: revisionDigest(part.data),
      })),
    ]
    const tasks = listAllMissionTasks({
      projectID: input.projectID,
      missionID: input.missionID,
      sessionID: input.sessionID,
    })
    const taskScopes = tasks
      .map((task) => ({ task, scope: readTaskDurableActivityScope(db, task) }))
      .sort((left, right) => left.task.id.localeCompare(right.task.id))
    const activity = [...missionActivity, ...taskScopes.flatMap((entry) => entry.scope.activity)]
    const latest = latestActivity(activity)
    return MissionDurableActivityCursorSchema.parse({
      mission_id: input.missionID,
      session_id: input.sessionID,
      ...latest,
      activity_sha256: activityDigest(activity),
      tasks: taskScopes.map(({ task, scope }) => ({ task_id: task.id, ...scope.latest })),
    })
  })
}
