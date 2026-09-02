import { findTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { PanelSurface } from "@/panel/capability"
import { Session } from "@/session"
import { Database, NotFoundError, eq } from "@/storage/db"
import { AutomationTable } from "./automation.sql"
import { ensureScheduledAutomationFireFrontierInTransaction } from "./automation-fire-frontier"
import {
  assertScheduledToolOccurrenceInTransaction,
  scheduledToolOccurrenceConflict,
  scheduledToolInputDigest,
  type ScheduledToolOccurrence,
} from "./tool-occurrence"

export type CreateDelayedSessionWakeInput = {
  name: string
  prompt: string
  projectId: string
  sessionId: string
  durationMs: number
  surface?: string
  occurrence: Omit<ScheduledToolOccurrence, "toolName">
}

function assertDuration(durationMs: number) {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid delay duration: ${durationMs}`)
  }
}

async function assertSessionInProject(input: { sessionId?: string; projectId: string }) {
  const sessionId = input.sessionId
  if (!sessionId) return
  await Session.assertLineageInProject({ sessionID: sessionId, projectID: input.projectId })
}

export async function assertTaskRootSessionInProject(input: { taskId: string; projectId: string }) {
  const task = findTask(input.taskId)
  if (!task || task.project_id !== input.projectId) {
    throw new NotFoundError({ message: `Task not found: ${input.taskId}` })
  }
  if (!task.session_id) throw new Error(`Task ${input.taskId} has no root session; cannot schedule task wake.`)
  const rootSession = await Session.assertLineageInProject({ sessionID: task.session_id, projectID: input.projectId })
  return { ...task, sessionID: task.session_id, rootSession }
}

export async function createDelayedSessionWake(input: CreateDelayedSessionWakeInput): Promise<{
  id: string
  name: string
  nextRun: number
}> {
  assertDuration(input.durationMs)
  const id = Identifier.deterministic("automation", `session-wait-v1\0${input.occurrence.toolPartID}`)
  const digest = scheduledToolInputDigest("wait", {
    sessionID: input.sessionId,
    durationMs: input.durationMs,
    prompt: input.prompt,
    surface: input.surface ?? null,
  })
  const replay = Database.immediateTransaction((db) => {
    assertScheduledToolOccurrenceInTransaction(db, { ...input.occurrence, toolName: "wait" })
    const existing = db
      .select()
      .from(AutomationTable)
      .where(eq(AutomationTable.tool_part_id, input.occurrence.toolPartID))
      .get()
    if (!existing) return undefined
    if (
      existing.id !== id ||
      existing.session_id !== input.sessionId ||
      existing.tool_input_digest !== digest ||
      existing.kind !== "delay"
    ) {
      throw scheduledToolOccurrenceConflict({ ...input.occurrence, toolName: "wait" }, "changed its Session wait input")
    }
    return existing
  })
  if (replay) return { id, name: replay.name, nextRun: replay.due_at! }
  await assertSessionInProject({ sessionId: input.sessionId, projectId: input.projectId })
  const nextRun = Date.now() + input.durationMs
  const row = Database.immediateTransaction((db) => {
    assertScheduledToolOccurrenceInTransaction(db, { ...input.occurrence, toolName: "wait" })
    const existing = db.select().from(AutomationTable).where(eq(AutomationTable.tool_part_id, input.occurrence.toolPartID)).get()
    if (existing) {
      if (
        existing.id !== id ||
        existing.session_id !== input.sessionId ||
        existing.tool_input_digest !== digest ||
        existing.kind !== "delay"
      ) {
        throw scheduledToolOccurrenceConflict({ ...input.occurrence, toolName: "wait" }, "changed its Session wait input")
      }
      return existing
    }
    db
      .insert(AutomationTable)
      .values({
        id,
        definition_id: id,
        revision: 1,
        project_id: input.projectId,
        session_id: input.sessionId,
        name: input.name,
        kind: "delay",
        surface: input.surface ? PanelSurface.parse(input.surface) : undefined,
        prompt: input.prompt,
        status: "active",
        due_at: nextRun,
        tool_part_id: input.occurrence.toolPartID,
        tool_input_digest: digest,
      })
      .run()
    const inserted = db.select().from(AutomationTable).where(eq(AutomationTable.id, id)).get()!
    ensureScheduledAutomationFireFrontierInTransaction(db, inserted, inserted.due_at!, inserted.time_created)
    return inserted
  })
  return { id, name: row.name, nextRun: row.due_at! }
}
