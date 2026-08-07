/**
 * Task timeline rewind — the single entry point for "回到这一步".
 *
 * Rewind is a Task projection cursor that filters UI-facing history. Task
 * worktrees are Task-owned execution resources and are not mutated by a
 * conversation projection operation.
 */
import z from "zod"
import { Identifier } from "@/id/id"
import { MessageTable } from "@/session/session.sql"
import { Database, NotFoundError, and, eq } from "@/storage/db"
import { Log } from "@/util/log"
import { taskIDForSession } from "./task-session-lineage"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import { clearEngineTaskRewindCursor, setEngineTaskRewindCursor } from "./task"
import { findTask } from "./store"

const log = Log.create({ service: "engine-rewind" })
export const RewindTaskInput = z.object({
  taskID: Identifier.schema("task"),
  anchor: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("cursorTime"),
      cursorTime: z.number().int().nonnegative(),
      anchorEventID: z.string().optional(),
    }),
    z.object({
      kind: z.literal("message"),
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      partID: Identifier.schema("part").optional(),
    }),
  ]),
  reason: z.string().optional(),
})
export type RewindTaskInput = z.infer<typeof RewindTaskInput>

export interface RewindTaskResult {
  taskID: string
  cursorTime: number
  rewindCount: number
  anchorKind: RewindTaskInput["anchor"]["kind"]
}

function requireMessageAnchor(input: Extract<RewindTaskInput["anchor"], { kind: "message" }>) {
  const row = Database.use((db) =>
    db
      .select()
      .from(MessageTable)
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
      .get(),
  )
  if (!row) {
    throw new NotFoundError({ message: `Message not found: ${input.messageID} in session ${input.sessionID}` })
  }
  return row
}

function ensureAnchorBelongsToTask(taskID: string, sessionID: string) {
  const owner = taskIDForSession(sessionID)
  if (owner !== taskID) {
    throw new NotFoundError({ message: `Session ${sessionID} does not belong to task ${taskID}` })
  }
}

export async function rewindTask(raw: RewindTaskInput): Promise<RewindTaskResult> {
  const input = RewindTaskInput.parse(raw)
  const task = findTask(input.taskID)
  if (!task) {
    throw new NotFoundError({ message: `Task not found: ${input.taskID}` })
  }

  const cursorTime = (() => {
    if (input.anchor.kind === "cursorTime") return input.anchor.cursorTime
    ensureAnchorBelongsToTask(input.taskID, input.anchor.sessionID)
    return requireMessageAnchor(input.anchor).time_created
  })()

  const now = Date.now()
  const nextCount = (task.rewind_count ?? 0) + 1
  const anchorEventID = input.anchor.kind === "cursorTime" ? input.anchor.anchorEventID : input.anchor.messageID

  Database.use((db) =>
    setEngineTaskRewindCursor(db, {
      taskID: input.taskID,
      cursorTime,
      anchorEventID,
      rewindCount: nextCount,
      timeUpdated: now,
    }),
  )

  log.info("task rewound", {
    taskID: input.taskID,
    cursorTime,
    anchorEventID,
    anchorKind: input.anchor.kind,
    reason: input.reason,
    rewindCount: nextCount,
  })

  await EngineProtocol.emit(
    Event.TaskRewound,
    {
      taskID: input.taskID,
      cursorTime,
      anchorEventID,
      reason: input.reason,
      rewindCount: nextCount,
      anchorKind: input.anchor.kind,
    },
    { source: "engine.rewindTask" },
  )

  return {
    taskID: input.taskID,
    cursorTime,
    rewindCount: nextCount,
    anchorKind: input.anchor.kind,
  }
}

/**
 * Clear a task's rewind cursor. This restores visibility only.
 */
export async function clearRewindCursor(taskID: string): Promise<void> {
  const task = findTask(taskID)
  if (!task) throw new NotFoundError({ message: `Task not found: ${taskID}` })
  if (task.rewind_cursor_time == null) return

  const now = Date.now()
  Database.use((db) => clearEngineTaskRewindCursor(db, { taskID, timeUpdated: now }))
  log.info("task rewind cursor cleared", { taskID })
  await EngineProtocol.emit(
    Event.TaskRewound,
    {
      taskID,
      cursorTime: 0,
      reason: "cursor cleared",
      rewindCount: task.rewind_count ?? 0,
      anchorKind: "cursorTime",
    },
    { source: "engine.clearRewindCursor" },
  )
}

export async function clearRewindCursorForSession(sessionID: string): Promise<void> {
  const taskID = taskIDForSession(sessionID)
  if (!taskID) return
  await clearRewindCursor(taskID)
}

/**
 * Pure helper for UI / describe layer: filter typed events by the current
 * task rewind cursor. Events without a timestamp pass through because there
 * is no task-time fact to compare.
 */
export function applyRewindCursor<T extends { time_created?: number | null }>(taskID: string, events: T[]): T[] {
  const task = findTask(taskID)
  const cursor = task?.rewind_cursor_time
  if (cursor == null) return events
  return events.filter((e) => {
    const t = e.time_created
    if (t == null) return true
    return t <= cursor
  })
}

export function taskRewindCursor(taskID: string): number | null {
  return findTask(taskID)?.rewind_cursor_time ?? null
}
