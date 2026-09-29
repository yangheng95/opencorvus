import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Database, and, asc, desc, eq, inArray } from "@/storage/db"
import type { TaskLifecycleProjection, TaskTerminalOccurrence } from "./task-lifecycle-schema"

export type { TaskLifecycleProjection } from "./task-lifecycle-schema"

export const TASK_OPEN_EVENT_TYPES = ["task.execution.opened", "task.execution.reopened"] as const
export const TASK_TERMINAL_EVENT_TYPES = ["task.completed", "task.failed", "task.cancelled"] as const
export const TASK_BOUNDARY_REQUEST_EVENT_TYPES = ["task.cancellation.requested"] as const

type Row = typeof ProtocolEventTable.$inferSelect

function epochOf(row: Pick<Row, "id" | "payload">): number {
  const epoch = row.payload?.execution_epoch
  if (!Number.isSafeInteger(epoch) || Number(epoch) <= 0) {
    throw new Error(`Task lifecycle event ${row.id} is missing a positive execution_epoch`)
  }
  return Number(epoch)
}

function lifecycleRows(db: Database.TxOrDb, taskID: string, through?: number): Row[] {
  return db
    .select()
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "task"),
        eq(ProtocolEventTable.aggregate_id, taskID),
        inArray(ProtocolEventTable.type, [
          ...TASK_OPEN_EVENT_TYPES,
          ...TASK_TERMINAL_EVENT_TYPES,
          ...TASK_BOUNDARY_REQUEST_EVENT_TYPES,
        ]),
      ),
    )
    .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
    .all()
    .filter((row) => through === undefined || row.emitted_at <= through)
}

function terminalOccurrences(rows: Row[]): TaskTerminalOccurrence[] {
  return rows
    .filter((row) => TASK_TERMINAL_EVENT_TYPES.includes(row.type as (typeof TASK_TERMINAL_EVENT_TYPES)[number]))
    .map((row): TaskTerminalOccurrence => ({
      epoch: epochOf(row),
      status: row.type === "task.cancelled" ? "cancelled" : row.type === "task.failed" ? "failed" : "completed",
      terminalEventID: row.id,
      terminalAt: row.emitted_at,
      ...(typeof row.payload?.error === "string" ? { terminalError: row.payload.error } : {}),
      ...(row.payload?.terminalReason === "interrupted" ? { terminalReason: "interrupted" as const } : {}),
    }))
    .toSorted((left, right) => left.epoch - right.epoch)
}

export function taskTerminalOccurrences(taskID: string): TaskTerminalOccurrence[] {
  return Database.use((db) => terminalOccurrences(lifecycleRows(db, taskID)))
}

export function taskLifecycleProjectionInTransaction(
  db: Database.TxOrDb,
  taskID: string,
): TaskLifecycleProjection {
  return reduceTaskLifecycleRows(taskID, lifecycleRows(db, taskID))
}

function reduceTaskLifecycleRows(taskID: string, rows: Row[]): TaskLifecycleProjection {
  const opened = rows.filter((row) => TASK_OPEN_EVENT_TYPES.includes(row.type as (typeof TASK_OPEN_EVENT_TYPES)[number]))
  if (opened.length === 0) throw new Error(`Task ${taskID} has no execution-open lifecycle fact`)
  const latestOpen = opened.toSorted((left, right) => epochOf(right) - epochOf(left))[0]!
  const epoch = epochOf(latestOpen)
  const terminals = terminalOccurrences(rows)
  const previousTerminal = terminals.filter((terminal) => terminal.epoch < epoch).at(-1)
  const openedProjection = {
    taskID,
    epoch,
    openedEventID: latestOpen.id,
    openedAt: latestOpen.emitted_at,
    ...(previousTerminal ? { previousTerminal } : {}),
  }
  const sameEpoch = rows.filter((row) => epochOf(row) === epoch)
  // `protocol_event_task_epoch_terminal_idx` is unique on (Task, epoch) across
  // every terminal type, so a second terminal fact for this epoch cannot be
  // appended. Re-deriving that predicate here only added a throw on a read path
  // the whole product projects through — the board, the store, the Task API —
  // which is how one impossible row used to take out every view of the Task.
  const terminal = terminals.find((terminal) => terminal.epoch === epoch)
  if (terminal) return { ...openedProjection, ...terminal }
  // Likewise `protocol_event_task_epoch_boundary_request_idx`: one boundary
  // request per (Task, epoch) is a durable constraint, not something this
  // projection has to police.
  const requests = sameEpoch.filter((row) =>
    TASK_BOUNDARY_REQUEST_EVENT_TYPES.includes(row.type as (typeof TASK_BOUNDARY_REQUEST_EVENT_TYPES)[number]),
  )
  if (requests[0]) {
    return {
      ...openedProjection,
      status: "cancelling",
      requestEventID: requests[0].id,
    }
  }
  return { ...openedProjection, status: "active" }
}

export function taskLifecycleProjectionAtInTransaction(
  db: Database.TxOrDb,
  taskID: string,
  through: number,
): TaskLifecycleProjection {
  return reduceTaskLifecycleRows(taskID, lifecycleRows(db, taskID, through))
}

export function taskLifecycleProjection(taskID: string): TaskLifecycleProjection {
  return Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID))
}

export function appendTaskOpenedInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  sessionID: string
  now: number
  source: string
}): string {
  const event = ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: "task.execution.opened",
    aggregate: "task",
    aggregate_id: input.taskID,
    task_id: null,
    session_id: input.sessionID,
    source: input.source,
    emitted_at: input.now,
    payload: { execution_epoch: 1 },
  })
  return event.id
}

export function appendTaskReopenedInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  sessionID: string
  now: number
  source: string
}): TaskLifecycleProjection {
  const current = taskLifecycleProjectionInTransaction(input.db, input.taskID)
  if (current.status === "active" || current.status === "cancelling") {
    throw new Error(`Task ${input.taskID} epoch ${current.epoch} is not terminal`)
  }
  ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: "task.execution.reopened",
    aggregate: "task",
    aggregate_id: input.taskID,
    task_id: null,
    session_id: input.sessionID,
    source: input.source,
    emitted_at: input.now,
    causation_id: current.terminalEventID,
    payload: { execution_epoch: current.epoch + 1 },
  })
  return taskLifecycleProjectionInTransaction(input.db, input.taskID)
}

export function latestTaskLifecycleRequestInTransaction(db: Database.TxOrDb, taskID: string) {
  const projection = taskLifecycleProjectionInTransaction(db, taskID)
  if (!projection.requestEventID) return undefined
  return db
    .select()
    .from(ProtocolEventTable)
    .where(eq(ProtocolEventTable.id, projection.requestEventID))
    .orderBy(desc(ProtocolEventTable.seq))
    .get()
}
