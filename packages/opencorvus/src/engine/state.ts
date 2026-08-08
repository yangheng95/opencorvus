import { Database, eq } from "@/storage/db"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import { progressStatus } from "./helpers"
import { EngineTaskTable } from "./engine.sql"
import { insertEngineProgressSnapshot } from "./progress"
import { updateEngineTaskState } from "./task"
import { type TaskRow } from "./store"
import { deriveTaskStatus } from "./task-status"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { DecisionLogBundle } from "@/decision-log/bundle"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import {
  TaskCancellationEventLink,
  type TaskCancellationEventLink as TaskCancellationEventLinkValue,
} from "./cancellation-origin"
import { requireTaskCancellationRequestEvent } from "./cancellation-projection"
import { ProtocolStore } from "@/protocol/store"

const log = Log.create({ service: "engine-state" })

/**
 * Caller-facing non-terminal task-update shape. `status` is a logical verb
 * (queued / active) that the writer maps to concrete fact fields; there is no
 * `status` column anymore (6-f-2).
 *
 * Mapping:
 *   active → time_started defaults to now if unset
 *   queued → clears time_started / time_completed
 *
 * Terminal task lifecycle is owned by `terminalTask` so completed / failed /
 * cancelled cannot be written through ordinary field updates.
 */
export type TaskUpdateValues = Omit<Partial<typeof EngineTaskTable.$inferInsert>, "status"> & {
  status?: "queued" | "active"
}
export type TaskUpdateOptions = {
  projectDir?: string
  cancellationRequest?: TaskCancellationEventLinkValue
}

export type TerminalTaskOptions = TaskUpdateOptions & {
  /** Physical execution ended without a domain completion decision. This is
   * persisted as the canonical interrupted terminal reason, while `failed`
   * remains the Task event/status family. */
  terminalReason?: "interrupted"
  /** Exact pre-execution infrastructure fact that makes a result checkpoint
   * physically impossible. The creation binding and infrastructure Artifact
   * remain the terminal evidence for this failed Task. */
  preExecutionInfrastructureFailure?: Readonly<{
    code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH"
    initialTreeSHA256: string
    executionTreeSHA256: string
  }>
  /** Runs inside the single winning terminal-transition transaction after the
   * Task row update and before its progress snapshot and protocol events. */
  transactionEffect?: (db: Database.TxOrDb, task: TaskRow) => void
}

export type TerminalTaskStatus = "completed" | "failed" | "cancelled"
export type TerminalTaskValues = Omit<Partial<typeof EngineTaskTable.$inferInsert>, "status"> & {
  status: TerminalTaskStatus
}

type InternalTaskUpdateValues = Omit<Partial<typeof EngineTaskTable.$inferInsert>, "status"> & {
  status?: TaskUpdateValues["status"] | TerminalTaskStatus
}

function isTerminalTaskIntent(status: InternalTaskUpdateValues["status"]): status is TerminalTaskStatus {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export async function updateTask(row: TaskRow, values: TaskUpdateValues, summary: string, options?: TaskUpdateOptions) {
  if (
    (values as InternalTaskUpdateValues).status === "completed" ||
    (values as InternalTaskUpdateValues).status === "failed" ||
    (values as InternalTaskUpdateValues).status === "cancelled"
  ) {
    throw new Error("updateTask cannot write terminal task lifecycle; use terminalTask.")
  }
  return applyTaskUpdate(row, values, summary, options)
}

export async function terminalTask(
  row: TaskRow,
  values: TerminalTaskValues,
  summary: string,
  options?: TerminalTaskOptions,
) {
  if (values.status === "completed" && values.error != null) {
    throw new Error("terminalTask completed status must not carry an error.")
  }
  if ((values.status === "failed" || values.status === "cancelled") && !nonEmptyString(values.error)) {
    throw new Error(`terminalTask ${values.status} status requires a non-empty error.`)
  }
  if (values.status === "cancelled" && !options?.cancellationRequest) {
    throw new Error("terminalTask cancelled status requires a task.cancellation.requested event link.")
  }
  if (values.status !== "cancelled" && options?.cancellationRequest) {
    throw new Error(`terminalTask ${values.status} status must not carry a cancellation request event link.`)
  }
  if (options?.terminalReason === "interrupted" && values.status !== "failed") {
    throw new Error("terminalTask interrupted terminal reason requires failed status.")
  }
  if (options?.preExecutionInfrastructureFailure && values.status !== "failed") {
    throw new Error("terminalTask pre-execution infrastructure failure requires failed status.")
  }
  let terminalRow = row
  if (terminalRow.time_completed == null && !options?.preExecutionInfrastructureFailure) {
    const { EngineGit } = await import("./git")
    const baseline = await EngineGit.prepare(terminalRow)
    if (baseline.error) throw new Error(`Task ${row.id} terminal checkpoint baseline failed: ${baseline.error}`)
    const checkpoint = await EngineGit.complete(baseline.task)
    if (checkpoint.error) throw new Error(`Task ${row.id} terminal result checkpoint failed: ${checkpoint.error}`)
    terminalRow = checkpoint.task
  }
  let cancellationRequest: ReturnType<typeof ProtocolStore.requireEvent> | undefined
  if (options?.cancellationRequest) {
    const link = TaskCancellationEventLink.parse(options.cancellationRequest)
    cancellationRequest = requireTaskCancellationRequestEvent(terminalRow.id, link.eventID).event
  }
  const result = await applyTaskUpdate(terminalRow, values, summary, options, cancellationRequest)
  const { Worktree } = await import("@/worktree")
  await Worktree.releaseManagedWorktreeTaskOwners(row.id)
  return result
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function resolveTaskUpdateValues(
  current: TaskRow,
  values: InternalTaskUpdateValues,
  now: number,
  options?: TerminalTaskOptions,
): {
  intent: InternalTaskUpdateValues["status"]
  resolved: Partial<typeof EngineTaskTable.$inferInsert>
  nextError: string | null
  noOp: boolean
} {
  const { status: intent, ...rest } = values

  // Resolve every logical verb from the row read inside the writer
  // transaction. A caller may hold an older Task snapshot while retry/replan
  // reopens the durable row, so caller-owned facts cannot decide no-op or
  // lifecycle predecessor semantics.
  const resolved: Partial<typeof EngineTaskTable.$inferInsert> = { ...rest }
  const existingMetadata: Record<string, unknown> =
    current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
      ? { ...(current.metadata as Record<string, unknown>) }
      : {}
  const metaBase: Record<string, unknown> =
    typeof rest.metadata === "object" && rest.metadata !== null && !Array.isArray(rest.metadata)
      ? { ...(rest.metadata as Record<string, unknown>) }
      : rest.metadata === undefined
        ? existingMetadata
        : {}
  let metaMutated = rest.metadata !== undefined
  const clearTerminalReasonFlags = () => {
    const hadFlag = "cancelled" in metaBase || "interrupted" in metaBase
    delete metaBase.cancelled
    delete metaBase.interrupted
    if (hadFlag) metaMutated = true
  }
  switch (intent) {
    case "active":
      clearTerminalReasonFlags()
      if (resolved.time_started === undefined && (current.time_started == null || current.time_completed != null)) {
        resolved.time_started = now
      }
      if (resolved.time_completed === undefined && current.time_completed != null) {
        resolved.time_completed = null
      }
      break
    case "completed":
      clearTerminalReasonFlags()
      if (resolved.time_completed === undefined) resolved.time_completed = now
      if (resolved.error === undefined) resolved.error = null
      break
    case "failed":
      clearTerminalReasonFlags()
      if (options?.terminalReason === "interrupted") {
        metaBase.interrupted = true
        metaMutated = true
      }
      if (resolved.time_completed === undefined) resolved.time_completed = now
      break
    case "cancelled":
      delete metaBase.interrupted
      if (resolved.time_completed === undefined) resolved.time_completed = now
      metaBase.cancelled = true
      metaMutated = true
      break
    case "queued":
      clearTerminalReasonFlags()
      resolved.time_started = null
      resolved.time_completed = null
      break
    case undefined:
      break
  }
  if (metaMutated) resolved.metadata = metaBase

  const nextError = resolved.error === undefined ? current.error : resolved.error
  const nextStarted = resolved.time_started === undefined ? current.time_started : resolved.time_started
  const nextCompleted = resolved.time_completed === undefined ? current.time_completed : resolved.time_completed
  const guardedKeys = new Set(["error", "time_started", "time_completed"])
  const hasOtherWrite = Object.keys(resolved).some((key) => !guardedKeys.has(key))
  return {
    intent,
    resolved,
    nextError,
    noOp:
      !hasOtherWrite &&
      nextError === current.error &&
      nextStarted === current.time_started &&
      nextCompleted === current.time_completed,
  }
}

export type TaskUpdateTransactionResult =
  | { kind: "updated"; task: TaskRow }
  | { kind: "unchanged"; task: TaskRow }
  | { kind: "existing_terminal"; task: TaskRow }

export function writeTaskUpdateInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  values: InternalTaskUpdateValues
  summary: string
  now: number
  options?: TerminalTaskOptions
  cancellationRequest?: ReturnType<typeof ProtocolStore.requireEvent>
}): TaskUpdateTransactionResult {
  const { db, taskID, values, summary, now, options, cancellationRequest } = input
  const terminalIntent = isTerminalTaskIntent(values.status)
  const current = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
  if (!current) throw new Error(`task ${taskID} not found during updateTask`)
  const resolution = resolveTaskUpdateValues(current, values, now, options)
  if (resolution.noOp) return { kind: "unchanged", task: current }
  const updated = updateEngineTaskState(db, {
    taskID,
    values: resolution.resolved,
    timeUpdated: now,
    onlyWhenIncomplete: terminalIntent,
  })
  if (!updated) {
    const concurrent = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
    if (terminalIntent && concurrent?.time_completed != null) {
      return { kind: "existing_terminal", task: concurrent }
    }
    throw new Error(`task ${taskID} not found during updateTask`)
  }
  if (terminalIntent) options?.transactionEffect?.(db, updated)
  const nextStatus = deriveTaskStatus(updated)
  insertEngineProgressSnapshot(db, {
    taskID,
    status: progressStatus(nextStatus),
    summary,
    payload: { status: nextStatus, error: resolution.nextError },
    timeCreated: now,
  })
  const prevStatus = deriveTaskStatus(current)
  const cancellationMeta =
    nextStatus === "cancelled" && cancellationRequest
      ? {
          source: "state.task",
          sessionID: cancellationRequest.sessionID,
          correlationID: cancellationRequest.correlationID,
          causationID: cancellationRequest.id,
        }
      : { source: "state.task" }
  EngineProtocol.emitInTransaction(Event.TaskUpdated, { taskID, status: nextStatus, summary }, cancellationMeta)
  if (prevStatus !== nextStatus && nextStatus === "completed") {
    EngineProtocol.emitInTransaction(
      Event.TaskCompleted,
      {
        taskID,
        status: nextStatus,
        summary,
        timeCompleted: updated.time_completed!,
      },
      { source: "state.task" },
    )
  } else if (prevStatus !== nextStatus && nextStatus === "failed") {
    EngineProtocol.emitInTransaction(
      Event.TaskFailed,
      {
        taskID,
        status: nextStatus,
        summary,
        error: resolution.nextError!,
        timeCompleted: updated.time_completed!,
        ...(options?.terminalReason === "interrupted" ? { terminalReason: "interrupted" as const } : {}),
      },
      { source: "state.task" },
    )
  } else if (prevStatus !== nextStatus && nextStatus === "cancelled") {
    EngineProtocol.emitInTransaction(
      Event.TaskCancelled,
      {
        taskID,
        status: nextStatus,
        summary,
        error: resolution.nextError!,
        timeCompleted: updated.time_completed!,
      },
      cancellationMeta,
    )
  }
  return { kind: "updated", task: updated }
}

async function applyTaskUpdate(
  row: TaskRow,
  values: InternalTaskUpdateValues,
  summary: string,
  options?: TerminalTaskOptions,
  cancellationRequest?: ReturnType<typeof ProtocolStore.requireEvent>,
) {
  const terminalIntent = isTerminalTaskIntent(values.status)
  const result = Database.transaction((db) =>
    writeTaskUpdateInTransaction({
      db,
      taskID: row.id,
      values,
      summary,
      now: Date.now(),
      options,
      cancellationRequest,
    }),
  )
  if (result.kind === "unchanged") {
    if (terminalIntent) await refreshTerminalTaskDecisionLog(result.task)
    return result.task
  }
  if (result.kind === "existing_terminal") {
    await refreshTerminalTaskDecisionLog(result.task)
    return result.task
  }
  if (terminalIntent) await refreshTerminalTaskDecisionLog(result.task)
  return result.task
}

export async function refreshTerminalTaskDecisionLog(task: TaskRow) {
  // Terminal final-write of the complete decision-log projection. This seam
  // is reached on BOTH updateTask exit paths (the no-op / already-terminal
  // guard AND the main write path) for every terminal intent, so the on-disk
  // `.opencorvus/decision-log.md` reflects the last acceptance / abort /
  // agent_error decisions even when a retry re-enters a row that was already
  // terminal (codex Q-TERM). Best-effort + loud: a failed audit-projection
  // write must NOT cascade-break Task termination (rule 1 — a
  // non-load-bearing audit refresh failing
  // is not worth aborting the core terminal state write). This deliberately
  // refines codex D5 "always hard fail": hard-fail belongs at
  // write-BEFORE-consume (the consuming agent needs the file); at this
  // post-consume terminal seam the file is an audit refresh, so failing
  // loud (log.error, never swallowed) is correct and throwing is not.
  // Flagged during the decision-log disk materialization review.
  try {
    await DecisionLogBundle.write(taskPrimaryProjectRoot(task.id), task.id)
  } catch (err) {
    log.error("terminal decision-log bundle write failed (task termination unaffected)", {
      taskID: task.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function hooks() {
  return {
    updateTask,
  }
}
