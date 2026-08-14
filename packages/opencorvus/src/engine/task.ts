import { Database, and, eq, inArray, isNull, sql } from "@/storage/db"
import { EngineTaskTable, type EngineMetadata } from "./engine.sql"
import { Project } from "@/project/project"

type EngineTaskInsert = typeof EngineTaskTable.$inferInsert
type EngineTaskSelect = typeof EngineTaskTable.$inferSelect

export function insertEngineTask(
  db: Database.TxOrDb,
  input: {
    taskID: string
    projectID: string
    sessionID: string
    requestID?: string
    source: EngineTaskInsert["source"]
    productPillar: EngineTaskInsert["product_pillar"]
    title: string
    request: string
    attachments?: EngineTaskInsert["attachments"]
    priority: EngineTaskInsert["priority"]
    budget?: EngineTaskInsert["budget"]
    metadata: EngineMetadata
    timeStarted: number
    timeCreated: number
    timeUpdated: number
  },
): void {
  Project.assertDurableAdmissionOpen(input.projectID)
  db.insert(EngineTaskTable)
    .values({
      id: input.taskID,
      project_id: input.projectID,
      session_id: input.sessionID,
      request_id: input.requestID,
      source: input.source,
      product_pillar: input.productPillar,
      title: input.title,
      request: input.request,
      attachments: input.attachments,
      priority: input.priority,
      budget: input.budget,
      metadata: input.metadata,
      time_started: input.timeStarted,
      time_created: input.timeCreated,
      time_updated: input.timeUpdated,
    })
    .run()
}

export function touchEngineTask(db: Database.TxOrDb, input: { taskID: string; timeUpdated?: number }): void {
  db.update(EngineTaskTable)
    .set({ time_updated: input.timeUpdated ?? Date.now() })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function updateEngineTaskState(
  db: Database.TxOrDb,
  input: {
    taskID: string
    values: Partial<EngineTaskInsert>
    timeUpdated: number
    onlyWhenIncomplete?: boolean
  },
): EngineTaskSelect | undefined {
  return db
    .update(EngineTaskTable)
    .set({
      ...input.values,
      time_updated: input.timeUpdated,
    })
    .where(
      input.onlyWhenIncomplete
        ? and(eq(EngineTaskTable.id, input.taskID), isNull(EngineTaskTable.time_completed))
        : eq(EngineTaskTable.id, input.taskID),
    )
    .returning()
    .get()
}

export function setEngineTaskBudget(
  db: Database.TxOrDb,
  input: { taskID: string; budget: EngineTaskInsert["budget"] | null },
): void {
  db.update(EngineTaskTable).set({ budget: input.budget }).where(eq(EngineTaskTable.id, input.taskID)).run()
}

export function setEngineTaskTitle(db: Database.TxOrDb, input: { taskID: string; title: string }): void {
  db.update(EngineTaskTable).set({ title: input.title }).where(eq(EngineTaskTable.id, input.taskID)).run()
}

export function setEngineTaskArchived(
  db: Database.TxOrDb,
  input: { taskID: string; timeArchived: number | null; timeUpdated: number },
): void {
  db.update(EngineTaskTable)
    .set({ time_archived: input.timeArchived, time_updated: input.timeUpdated })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function setEngineTaskPinned(db: Database.TxOrDb, input: { taskID: string; timePinned: number | null }): void {
  db.update(EngineTaskTable)
    .set({
      time_pinned: input.timePinned,
      time_updated: sql`${EngineTaskTable.time_updated}`,
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function setEngineTaskRewindCursor(
  db: Database.TxOrDb,
  input: {
    taskID: string
    cursorTime: number
    anchorEventID?: string | null
    rewindCount: number
    timeUpdated: number
  },
): void {
  db.update(EngineTaskTable)
    .set({
      rewind_cursor_time: input.cursorTime,
      rewind_cursor_event_id: input.anchorEventID ?? null,
      rewind_count: input.rewindCount,
      time_updated: input.timeUpdated,
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function clearEngineTaskRewindCursor(db: Database.TxOrDb, input: { taskID: string; timeUpdated: number }): void {
  db.update(EngineTaskTable)
    .set({
      rewind_cursor_time: null,
      rewind_cursor_event_id: null,
      time_updated: input.timeUpdated,
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function deleteEngineTask(db: Database.TxOrDb, input: { taskID: string }): void {
  db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).run()
}

export function deleteEngineTasksForProjectSessions(
  db: Database.TxOrDb,
  input: { projectID: string; sessionIDs: string[] },
): void {
  db.delete(EngineTaskTable)
    .where(and(eq(EngineTaskTable.project_id, input.projectID), inArray(EngineTaskTable.session_id, input.sessionIDs)))
    .run()
}

export function setEngineTaskMetadata(
  db: Database.TxOrDb,
  input: { taskID: string; metadata: EngineMetadata; timeUpdated?: number },
): void {
  db.update(EngineTaskTable)
    .set({
      metadata: input.metadata,
      time_updated: input.timeUpdated ?? Date.now(),
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
}

export function mergeEngineTaskMetadata(
  db: Database.TxOrDb,
  input: { taskID: string; metadata: EngineMetadata; timeUpdated?: number },
): EngineMetadata {
  const row = db
    .select({ metadata: EngineTaskTable.metadata })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!row) throw new Error(`mergeEngineTaskMetadata: task ${input.taskID} not found`)
  const current =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as EngineMetadata)
      : {}
  const metadata = {
    ...current,
    ...input.metadata,
  }
  db.update(EngineTaskTable)
    .set({
      metadata,
      time_updated: input.timeUpdated ?? Date.now(),
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
  return metadata
}
