import { findTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { PanelSurface } from "@/panel/capability"
import { Session } from "@/session"
import { Database, NotFoundError } from "@/storage/db"
import { AutomationTable } from "./automation.sql"

export type CreateDelayedSessionWakeInput = {
  name: string
  prompt: string
  projectId: string
  sessionId: string
  durationMs: number
  surface?: string
}

export type CreateTaskWakeInput = {
  name: string
  reason: string
  projectId: string
  taskId: string
  durationMs: number
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
  await assertSessionInProject({ sessionId: input.sessionId, projectId: input.projectId })
  assertDuration(input.durationMs)
  const nextRun = Date.now() + input.durationMs
  const id = Identifier.ascending("automation")
  Database.use((db) =>
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
      })
      .run(),
  )
  return { id, name: input.name, nextRun }
}

export async function createTaskWake(input: CreateTaskWakeInput): Promise<{
  id: string
  name: string
  nextRun: number
}> {
  await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
  assertDuration(input.durationMs)
  const nextRun = Date.now() + input.durationMs
  const id = Identifier.ascending("automation")
  Database.use((db) =>
    db
      .insert(AutomationTable)
      .values({
        id,
        definition_id: id,
        revision: 1,
        project_id: input.projectId,
        task_id: input.taskId,
        name: input.name,
        kind: "delay",
        prompt: input.reason,
        status: "active",
        due_at: nextRun,
      })
      .run(),
  )
  return { id, name: input.name, nextRun }
}
