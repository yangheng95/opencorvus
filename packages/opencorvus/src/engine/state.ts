import { Database, and, eq, sql } from "@/storage/db"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import { EngineTaskTable } from "./engine.sql"
import { projectTaskRowInTransaction, requireTask, type TaskRow } from "./store"
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
import { Project } from "@/project/project"
import { runWithIndependentProjectIdentity } from "@/project/independent-project-owner"
import { waitForRuntimeSettlementIdle } from "@/runtime/execution-settlement"
import { TaskCreatorMetadata } from "@/task-api/task-creator"
import { enqueueSchedulerMessageInTransaction } from "@/protocol/delivery"
import { signalSchedulerMessageDrain } from "@/protocol/scheduler-drain-signal"
import { appendTaskReopenedInTransaction, taskLifecycleProjectionInTransaction } from "./task-lifecycle"
import { Bus } from "@/bus"

const log = Log.create({ service: "engine-state" })

/**
 * Caller-facing non-terminal task-update shape. `status` is the logical
 * `active` verb that the writer maps to concrete fact fields; there is no
 * `status` column anymore (6-f-2).
 *
 * Mapping:
 *   active → reopening a terminal occurrence refreshes time_started to now
 * Terminal task lifecycle is owned by `terminalTask` so completed / failed /
 * cancelled cannot be written through ordinary field updates.
 */
export type TaskUpdateValues = Omit<Partial<typeof EngineTaskTable.$inferInsert>, "status"> & {
  status?: "active"
}
export type TaskUpdateOptions = {
  projectDir?: string
  cancellationRequest?: TaskCancellationEventLinkValue
}

export type TerminalTaskOptions = TaskUpdateOptions & {
  /** Timestamp of the sole terminal lifecycle fact when the decision receipt
   * has already allocated it. This is not a second persisted Task field. */
  terminalAt?: number
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
  /** Optional exact owner for terminal Git checkpoint admission. The existing
   * checkpoint request remains the only write-ahead physical-effect fact. */
  checkpointAdmission?: Readonly<{
    executionEpoch: number
    effect: (db: Database.TxOrDb) => void
  }>
}

export type TerminalTaskStatus = "completed" | "failed" | "cancelled"
export type TerminalTaskValues = Partial<typeof EngineTaskTable.$inferInsert> & {
  status: TerminalTaskStatus
  error?: string | null
}

type InternalTaskUpdateValues = Partial<typeof EngineTaskTable.$inferInsert> & {
  status?: TaskUpdateValues["status"] | TerminalTaskStatus
  error?: string | null
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
  if (
    values.status !== "cancelled" &&
    terminalRow.time_completed == null &&
    !options?.preExecutionInfrastructureFailure
  ) {
    const { EngineGit } = await import("./git")
    const baseline = await EngineGit.prepare(terminalRow, options?.checkpointAdmission)
    if (baseline.error) throw new Error(`Task ${row.id} terminal checkpoint baseline failed: ${baseline.error}`)
    const checkpoint = await EngineGit.complete(baseline.task, options?.checkpointAdmission)
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
): {
  intent: InternalTaskUpdateValues["status"]
  resolved: Partial<typeof EngineTaskTable.$inferInsert>
  nextError: string | null
  noOp: boolean
} {
  const { status: intent, error, ...persisted } = values
  const resolved = { ...persisted }
  if (resolved.metadata && typeof resolved.metadata === "object") {
    const metadata = { ...(resolved.metadata as Record<string, unknown>) }
    delete metadata.cancelled
    delete metadata.interrupted
    resolved.metadata = metadata
  }
  return {
    intent,
    resolved,
    nextError: error === undefined ? current.error : error,
    noOp: Object.keys(resolved).length === 0 && !intent,
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
  const currentRow = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
  if (!currentRow) throw new Error(`task ${taskID} not found during updateTask`)
  const current = projectTaskRowInTransaction(db, currentRow)
  const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
  if (values.status === "active" && ["completed", "failed", "cancelled"].includes(lifecycle.status)) {
    if (!current.session_id) throw new Error(`Task ${taskID} cannot reopen without its root Session identity`)
    appendTaskReopenedInTransaction({
      db,
      taskID,
      sessionID: current.session_id,
      now,
      source: "state.task",
    })
  }
  if (terminalIntent && ["completed", "failed", "cancelled"].includes(lifecycle.status)) {
    return { kind: "existing_terminal", task: current }
  }
  if ((values.status === "completed" || values.status === "failed") && lifecycle.status === "cancelling") {
    throw new Error(`Task ${taskID} has an accepted cancellation; ${values.status} cannot supersede it.`)
  }
  if (values.status === "cancelled" && lifecycle.requestEventID !== cancellationRequest?.id) {
    throw new Error(`Task ${taskID} cancellation terminal fact must cause from its exact request event`)
  }
  const resolution = resolveTaskUpdateValues(current, values)
  const persisted = { ...resolution.resolved } as Record<string, unknown>
  delete persisted.status
  delete persisted.error
  delete persisted.time_started
  delete persisted.time_completed
  if (persisted.metadata && typeof persisted.metadata === "object") {
    const metadata = { ...(persisted.metadata as Record<string, unknown>) }
    delete metadata.cancelled
    delete metadata.interrupted
    persisted.metadata = metadata
  }
  if (Object.keys(persisted).length > 0) {
    db.update(EngineTaskTable)
      .set(persisted as Partial<typeof EngineTaskTable.$inferInsert>)
      .where(eq(EngineTaskTable.id, taskID))
      .run()
  }
  if (!terminalIntent) {
    const updatedRow = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!
    const updated = projectTaskRowInTransaction(db, updatedRow)
    return resolution.noOp && Object.keys(persisted).length === 0
      ? { kind: "unchanged", task: updated }
      : { kind: "updated", task: updated }
  }
  const nextStatus = values.status
  const completionTime = now
  const cancellationMeta =
    nextStatus === "cancelled" && cancellationRequest
      ? {
          source: "state.task",
          sessionID: cancellationRequest.sessionID,
          correlationID: cancellationRequest.correlationID,
          causationID: cancellationRequest.id,
        }
      : { source: "state.task" }
  let terminalEvent: ReturnType<typeof EngineProtocol.emitInTransaction> | undefined
  if (nextStatus === "completed") {
    terminalEvent = EngineProtocol.emitInTransaction(
      Event.TaskCompleted,
      {
        taskID,
        execution_epoch: lifecycle.epoch,
        summary,
      },
      { source: "state.task", taskID, emittedAt: completionTime },
    )
    Bus.publishOwnedInTransaction(Event.TaskCompleted, {
      taskID,
      execution_epoch: lifecycle.epoch,
      summary,
    })
  } else if (nextStatus === "failed") {
    terminalEvent = EngineProtocol.emitInTransaction(
      Event.TaskFailed,
      {
        taskID,
        execution_epoch: lifecycle.epoch,
        summary,
        error: resolution.nextError!,
        ...(options?.terminalReason === "interrupted" ? { terminalReason: "interrupted" as const } : {}),
      },
      { source: "state.task", taskID, emittedAt: completionTime },
    )
    Bus.publishOwnedInTransaction(Event.TaskFailed, {
      taskID,
      execution_epoch: lifecycle.epoch,
      summary,
      error: resolution.nextError!,
      ...(options?.terminalReason === "interrupted" ? { terminalReason: "interrupted" as const } : {}),
    })
  } else if (nextStatus === "cancelled") {
    terminalEvent = EngineProtocol.emitInTransaction(
      Event.TaskCancelled,
      {
        taskID,
        execution_epoch: lifecycle.epoch,
        summary,
        error: resolution.nextError!,
      },
      { ...cancellationMeta, taskID, emittedAt: completionTime },
    )
    Bus.publishOwnedInTransaction(Event.TaskCancelled, {
      taskID,
      execution_epoch: lifecycle.epoch,
      summary,
      error: resolution.nextError!,
    })
  }
  if (!terminalEvent) throw new Error(`Task ${taskID} terminal lifecycle event was not appended`)
  const updatedRow = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!
  const updated = projectTaskRowInTransaction(db, updatedRow)
  options?.transactionEffect?.(db, updated)
  if (terminalEvent) {
    const creator = TaskCreatorMetadata.parse(updated.metadata)
    const cancellationOrigin =
      cancellationRequest && nextStatus === "cancelled"
        ? requireTaskCancellationRequestEvent(taskID, cancellationRequest.id).origin
        : undefined
    if (creator.actor === "mission" && cancellationOrigin?.source !== "mission.delete") {
      if (!updated.session_id) throw new Error(`Mission-owned terminal Task ${taskID} has no root Session.`)
      enqueueSchedulerMessageInTransaction(db, {
        invocationID: `task-terminal:${terminalEvent.id}`,
        kind: "notification",
        source: {
          kind: "task_scheduler",
          project_id: updated.project_id,
          task_id: updated.id,
          root_session_id: updated.session_id,
        },
        target: {
          kind: "mission_scheduler",
          project_id: updated.project_id,
          mission_id: creator.mission.id,
          session_id: creator.mission.session_id,
        },
        subject: `Task ${updated.id} ${nextStatus}`,
        sourceTerminalEventID: terminalEvent.id,
        correlationID: terminalEvent.id,
        threadID: `task:${updated.id}:lifecycle`,
        now,
      })
      Database.effect(() => signalSchedulerMessageDrain())
    }
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
      now: options?.terminalAt ?? Date.now(),
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
