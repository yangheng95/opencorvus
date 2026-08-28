import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import {
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  ControlLeaseFenceLostError,
  currentControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
} from "./control-lease"
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
  const lease = currentControlLeaseInTransaction(db, "lifecycle", target)
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
  const acquired = acquireControlLeaseInTransaction(db, {
    target: "lifecycle",
    targetID: targetID(db, input.taskID),
    ownerOccurrenceID: input.ownerID,
    now: input.timeAcquired,
    leaseMilliseconds: COMPLETION_LEASE_MS,
    leaseID: activationID,
  })
  if (!acquired.acquired) {
    throw new TaskCompletionClosureConflictError(input.taskID, acquired.lease.owner_occurrence_id)
  }
  return {
    owner_id: acquired.lease.owner_occurrence_id,
    activation_id: acquired.lease.id,
    expires_at: acquired.lease.expires_at,
  }
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
  return releaseControlLeaseInTransaction(db, {
    target: "lifecycle",
    targetID: targetID(db, input.taskID),
    leaseID: closure.activation_id,
    ownerOccurrenceID: input.ownerID,
    now,
  })
}

export function assertTaskCompletionClosureOwnerInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ownerID: string },
): TaskCompletionClosure {
  const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
  const target = `task-completion:${input.taskID}:${lifecycle.epoch}`
  const current = currentControlLeaseInTransaction(db, "lifecycle", target)
  if (!current) throw new TaskCompletionClosureConflictError(input.taskID, "none")
  const now = Date.now()
  try {
    const lease = assertControlLeaseInTransaction(db, {
      target: "lifecycle",
      targetID: target,
      leaseID: current.id,
      ownerOccurrenceID: input.ownerID,
      now,
    })
    return { owner_id: lease.owner_occurrence_id, activation_id: lease.id, expires_at: lease.expires_at }
  } catch (error) {
    if (!(error instanceof ControlLeaseFenceLostError)) throw error
    throw new TaskCompletionClosureConflictError(
      input.taskID,
      current.expires_at <= now ? "none" : current.owner_occurrence_id,
    )
  }
}
