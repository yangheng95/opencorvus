import z from "zod"
import { EngineTaskTable } from "./engine.sql"
import { assertTaskDispatchesSettledInTransaction } from "./dispatch-settlement"
import { taskCancellationAuthorityExecutionErrorInTransaction } from "./cancellation-projection"
import { Database, eq, isNull } from "@/storage/db"
import { setEngineTaskMetadata } from "./task"

const COMPLETION_CLOSURE_METADATA_KEY = "task_completion_closure"

export const TaskCompletionClosureSchema = z
  .object({
    protocol: z.literal("task-completion-closure-v1"),
    owner_id: z.string().min(1),
    orchestrator_session_id: z.string().min(1),
    orchestrator_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    time_acquired: z.number().int().nonnegative(),
  })
  .strict()

export type TaskCompletionClosure = z.infer<typeof TaskCompletionClosureSchema>

export class TaskCompletionClosureConflictError extends Error {
  override readonly name = "TaskCompletionClosureConflictError"
  readonly code = "TASK_COMPLETION_CLOSURE_CONFLICT"

  constructor(
    readonly taskID: string,
    readonly ownerID: string,
  ) {
    super(`Task ${taskID} is closing under completion authority ${ownerID}`)
  }
}

function taskMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return { ...(value as Record<string, unknown>) }
}

export function taskCompletionClosureFromMetadata(value: unknown): TaskCompletionClosure | undefined {
  const metadata = taskMetadata(value)
  const closure = metadata[COMPLETION_CLOSURE_METADATA_KEY]
  return closure === undefined ? undefined : TaskCompletionClosureSchema.parse(closure)
}

export function metadataWithoutTaskCompletionClosure(value: unknown): Record<string, unknown> {
  const metadata = taskMetadata(value)
  delete metadata[COMPLETION_CLOSURE_METADATA_KEY]
  return metadata
}

export function taskCompletionClosureInTransaction(
  db: Database.TxOrDb,
  taskID: string,
): TaskCompletionClosure | undefined {
  const row = db
    .select({ metadata: EngineTaskTable.metadata })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, taskID))
    .get()
  if (!row) throw new Error(`Task ${taskID} does not exist`)
  return taskCompletionClosureFromMetadata(row.metadata)
}

export function acquireTaskCompletionClosureInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    ownerID: string
    orchestratorSessionID: string
    orchestratorMessageID: string
    toolCallID: string
    toolPartID: string
    timeAcquired: number
  },
): TaskCompletionClosure {
  const cancellation = taskCancellationAuthorityExecutionErrorInTransaction(
    db,
    input.taskID,
    `complete_task ${input.toolCallID} closure acquisition`,
  )
  if (cancellation) throw cancellation
  const task = db
    .select({ metadata: EngineTaskTable.metadata, timeCompleted: EngineTaskTable.time_completed })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task) throw new Error(`Task ${input.taskID} does not exist`)
  if (task.timeCompleted !== null) {
    throw new Error(`Task ${input.taskID} is already terminal at ${task.timeCompleted}`)
  }
  const existing = taskCompletionClosureFromMetadata(task.metadata)
  if (existing) {
    if (existing.owner_id === input.ownerID) return existing
    throw new TaskCompletionClosureConflictError(input.taskID, existing.owner_id)
  }
  assertTaskDispatchesSettledInTransaction(db, input.taskID)
  const closure = TaskCompletionClosureSchema.parse({
    protocol: "task-completion-closure-v1",
    owner_id: input.ownerID,
    orchestrator_session_id: input.orchestratorSessionID,
    orchestrator_message_id: input.orchestratorMessageID,
    tool_call_id: input.toolCallID,
    tool_part_id: input.toolPartID,
    time_acquired: input.timeAcquired,
  })
  setEngineTaskMetadata(db, {
    taskID: input.taskID,
    metadata: { ...taskMetadata(task.metadata), [COMPLETION_CLOSURE_METADATA_KEY]: closure },
    timeUpdated: input.timeAcquired,
  })
  return closure
}

export function assertTaskCompletionClosureOwnerInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ownerID: string },
): TaskCompletionClosure {
  const closure = taskCompletionClosureInTransaction(db, input.taskID)
  if (!closure || closure.owner_id !== input.ownerID) {
    throw new TaskCompletionClosureConflictError(input.taskID, closure?.owner_id ?? "none")
  }
  return closure
}

export function releaseTaskCompletionClosureInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ownerID: string },
): boolean {
  const task = db
    .select({ metadata: EngineTaskTable.metadata })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task) return false
  const closure = taskCompletionClosureFromMetadata(task.metadata)
  if (!closure || closure.owner_id !== input.ownerID) return false
  const metadata = metadataWithoutTaskCompletionClosure(task.metadata)
  setEngineTaskMetadata(db, {
    taskID: input.taskID,
    metadata: Object.keys(metadata).length > 0 ? metadata : {},
  })
  return true
}

/**
 * A newly exclusive database runtime has no predecessor prompt that can still
 * own an active completion checkpoint. Clear only nonterminal closures before
 * Task execution recovery; completed rows retain their closure receipt.
 */
export function recoverAbandonedTaskCompletionClosures(projectID: string): number {
  return Database.transaction((db) => {
    const rows = db
      .select({ id: EngineTaskTable.id, metadata: EngineTaskTable.metadata })
      .from(EngineTaskTable)
      .where(isNull(EngineTaskTable.time_completed))
      .all()
      .filter((row) => taskCompletionClosureFromMetadata(row.metadata) !== undefined)
    let recovered = 0
    for (const row of rows) {
      const task = db
        .select({ projectID: EngineTaskTable.project_id, metadata: EngineTaskTable.metadata })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, row.id))
        .get()
      if (!task || task.projectID !== projectID) continue
      const metadata = metadataWithoutTaskCompletionClosure(task.metadata)
      setEngineTaskMetadata(db, {
        taskID: row.id,
        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      })
      recovered += 1
    }
    return recovered
  })
}
