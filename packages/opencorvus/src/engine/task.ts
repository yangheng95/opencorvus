import { Database, and, eq, inArray, isNull } from "@/storage/db"
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
    timeCreated: number
  },
): void {
  Project.assertDurableAdmissionOpen(db, input.projectID)
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
      time_created: input.timeCreated,
    })
    .run()
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
  db.update(EngineTaskTable).set({ time_archived: input.timeArchived }).where(eq(EngineTaskTable.id, input.taskID)).run()
}

export function setEngineTaskPinned(db: Database.TxOrDb, input: { taskID: string; timePinned: number | null }): void {
  db.update(EngineTaskTable)
    .set({ time_pinned: input.timePinned })
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
    })
    .where(eq(EngineTaskTable.id, input.taskID))
    .run()
  return metadata
}
