import { Identifier } from "@/id/id"
import { Database, and, desc, eq } from "@/storage/db"
import { EngineControlActivationLeaseTable } from "./engine.sql"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"

const COMPLETION_LEASE_MS = 120_000

export type TaskCompletionClosure = { owner_id: string; activation_id: string; expires_at: number }

export class TaskCompletionClosureConflictError extends Error {
  override readonly name = "TaskCompletionClosureConflictError"
  readonly code = "TASK_COMPLETION_CLOSURE_CONFLICT"
  constructor(readonly taskID: string, readonly ownerID: string) {
    super(`Task ${taskID} completion is physically owned by ${ownerID}`)
  }
}

function targetID(db: Database.TxOrDb, taskID: string): string {
  const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
  return `task-completion:${taskID}:${lifecycle.epoch}`
}

export function taskCompletionClosureInTransaction(
  db: Database.TxOrDb,
  taskID: string,
  now = Date.now(),
): TaskCompletionClosure | undefined {
  const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
  const target = `task-completion:${taskID}:${lifecycle.epoch}`
  const lease = db.select().from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, "lifecycle"), eq(EngineControlActivationLeaseTable.target_id, target)))
    .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id)).get()
  if (!lease || lease.expires_at <= now || lifecycle.status !== "active") return undefined
  return { owner_id: lease.owner_occurrence_id, activation_id: lease.id, expires_at: lease.expires_at }
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
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  if (lifecycle.status !== "active") throw new Error(`Task ${input.taskID} is already ${lifecycle.status}`)
  const existing = taskCompletionClosureInTransaction(db, input.taskID, input.timeAcquired)
  if (existing) {
    if (existing.owner_id === input.ownerID) return existing
    throw new TaskCompletionClosureConflictError(input.taskID, existing.owner_id)
  }
  const activationID = Identifier.ascending("activity")
  const expiresAt = input.timeAcquired + COMPLETION_LEASE_MS
  db.insert(EngineControlActivationLeaseTable).values({
    id: activationID,
    target: "lifecycle",
    target_id: targetID(db, input.taskID),
    owner_occurrence_id: input.ownerID,
    time_activated: input.timeAcquired,
    expires_at: expiresAt,
  }).run()
  return { owner_id: input.ownerID, activation_id: activationID, expires_at: expiresAt }
}

/**
 * Give up a completion closure this owner can no longer use.
 *
 * The closure is committed before the terminal transaction runs, and that
 * transaction can refuse — an unsettled dispatch is the common case. Without a
 * release the Task then rejects every `complete_task` until the lease expires,
 * while the model retries into that window: the closure conflict and the retry
 * feed each other. Expiring early is the same mutation class as renewal.
 *
 * Returns whether a lease was actually released.
 */
export function releaseTaskCompletionClosureInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ownerID: string; now?: number },
): boolean {
  const now = input.now ?? Date.now()
  const closure = taskCompletionClosureInTransaction(db, input.taskID, now)
  if (!closure || closure.owner_id !== input.ownerID) return false
  db.update(EngineControlActivationLeaseTable)
    .set({ expires_at: now })
    .where(
      and(
        eq(EngineControlActivationLeaseTable.id, closure.activation_id),
        eq(EngineControlActivationLeaseTable.owner_occurrence_id, input.ownerID),
      ),
    )
    .run()
  return true
}

export function assertTaskCompletionClosureOwnerInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ownerID: string },
): TaskCompletionClosure {
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  const target = `task-completion:${input.taskID}:${lifecycle.epoch}`
  const lease = db.select().from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, "lifecycle"), eq(EngineControlActivationLeaseTable.target_id, target)))
    .orderBy(desc(EngineControlActivationLeaseTable.time_activated), desc(EngineControlActivationLeaseTable.id)).get()
  const closure = !lease || lease.expires_at <= Date.now()
    ? undefined
    : { owner_id: lease.owner_occurrence_id, activation_id: lease.id, expires_at: lease.expires_at }
  if (!closure || closure.owner_id !== input.ownerID) {
    throw new TaskCompletionClosureConflictError(input.taskID, closure?.owner_id ?? "none")
  }
  return closure
}
