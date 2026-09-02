import { Identifier } from "@/id/id"
import { Database, and, asc, eq, gt, isNull, lte } from "@/storage/db"
import { MessageTable } from "@/session/session.sql"
import {
  assertScheduledToolOccurrenceInTransaction,
  scheduledToolInputDigest,
  scheduledToolOccurrenceConflict,
  type ScheduledToolOccurrence,
} from "@/scheduler/tool-occurrence"
import {
  EngineTaskRootIngressTable,
  EngineTaskTable,
  EngineTaskWaitRegistrationTable,
  EngineTaskWaitSettlementTable,
  EngineControlActivationLeaseTable,
} from "./engine.sql"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"

export type TaskWaitToolOccurrence = Omit<ScheduledToolOccurrence, "toolName">

export class TaskWaitIngressLineageError extends Error {
  override readonly name = "TaskWaitIngressLineageError"

  constructor(
    message: string,
    readonly code: "malformed_due_identity" | "unknown_due_wait" | "not_due" | "already_settled",
    readonly waitID?: string,
  ) {
    super(message)
  }
}

export type TaskWaitProjection = {
  id: string
  taskID: string
  executionEpoch: number
  dueAt: number
  reason: string
  status: "scheduled" | "due" | "due_ingress_accepted" | "superseded" | "terminal_inapplicable"
  ingressID?: string
  timeCreated: number
}

function assertDuration(durationMs: number): void {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid Task wait duration: ${durationMs}`)
  }
}

export function createTaskWait(input: {
  taskID: string
  projectID: string
  durationMs: number
  reason: string
  occurrence: TaskWaitToolOccurrence
  now?: number
}): TaskWaitProjection {
  assertDuration(input.durationMs)
  const now = input.now ?? Date.now()
  return Database.immediateTransaction((db) => {
    assertScheduledToolOccurrenceInTransaction(db, { ...input.occurrence, toolName: "wait" })
    const existing = db
      .select()
      .from(EngineTaskWaitRegistrationTable)
      .where(eq(EngineTaskWaitRegistrationTable.tool_part_id, input.occurrence.toolPartID))
      .get()
    if (existing) {
      const digest = scheduledToolInputDigest("wait", {
        taskID: input.taskID,
        executionEpoch: existing.execution_epoch,
        durationMs: input.durationMs,
        reason: input.reason,
      })
      if (existing.task_id !== input.taskID || existing.input_digest !== digest || existing.reason !== input.reason) {
        throw scheduledToolOccurrenceConflict(
          { toolName: "wait", toolPartID: input.occurrence.toolPartID },
          "changed its immutable input",
        )
      }
      return projectTaskWaitInTransaction(db, existing, now)
    }
    const task = db
      .select()
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.id, input.taskID), eq(EngineTaskTable.project_id, input.projectID)))
      .get()
    if (!task) throw new Error(`Task wait target does not exist in Project: ${input.taskID}`)
    const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
    if (lifecycle.status !== "active") {
      throw new Error(`Task ${input.taskID} epoch ${lifecycle.epoch} cannot register a wait while ${lifecycle.status}`)
    }
    const digest = scheduledToolInputDigest("wait", {
      taskID: input.taskID,
      executionEpoch: lifecycle.epoch,
      durationMs: input.durationMs,
      reason: input.reason,
    })
    const creatorMessage = db.select().from(MessageTable).where(eq(MessageTable.id, input.occurrence.messageID)).get()
    const creatorActivationID =
      creatorMessage?.data.role === "assistant" && "activationID" in creatorMessage.data
        ? (creatorMessage.data as { activationID?: unknown }).activationID
        : undefined
    if (typeof creatorActivationID !== "string" || !creatorActivationID) {
      throw new Error(`Task wait Tool occurrence ${input.occurrence.toolPartID} has no Task-root activation owner`)
    }
    const creatorLease = db
      .select()
      .from(EngineControlActivationLeaseTable)
      .where(eq(EngineControlActivationLeaseTable.id, creatorActivationID))
      .get()
    const creatorIngress = creatorLease
      ? db
          .select()
          .from(EngineTaskRootIngressTable)
          .where(eq(EngineTaskRootIngressTable.id, creatorLease.target_id))
          .get()
      : undefined
    if (
      !creatorLease ||
      creatorLease.target !== "task_root_ingress" ||
      creatorLease.expires_at <= now ||
      !creatorIngress ||
      creatorIngress.task_id !== input.taskID ||
      creatorIngress.execution_epoch !== lifecycle.epoch
    ) {
      throw new Error(`Task wait Tool occurrence ${input.occurrence.toolPartID} lost its exact Task-root frontier`)
    }
    const id = Identifier.deterministic("automation", `task-wait-v1\0${input.occurrence.toolPartID}`)
    db.insert(EngineTaskWaitRegistrationTable)
      .values({
        id,
        task_id: input.taskID,
        project_id: creatorIngress.project_id,
        execution_epoch: lifecycle.epoch,
        due_at: now + input.durationMs,
        reason: input.reason,
        tool_part_id: input.occurrence.toolPartID,
        creator_ingress_id: creatorIngress.id,
        creator_activation_id: creatorActivationID,
        input_digest: digest,
        time_created: now,
      })
      .run()
    const row = db
      .select()
      .from(EngineTaskWaitRegistrationTable)
      .where(eq(EngineTaskWaitRegistrationTable.id, id))
      .get()!
    const newerIngress = db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(
        and(
          eq(EngineTaskRootIngressTable.task_id, input.taskID),
          eq(EngineTaskRootIngressTable.execution_epoch, lifecycle.epoch),
          gt(EngineTaskRootIngressTable.sequence, creatorIngress.sequence),
        ),
      )
      .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
      .get()
    if (newerIngress) {
      settleTaskWaitForIngressInTransaction(db, {
        waitID: row.id,
        ingressID: newerIngress.id,
        disposition: "superseded",
        now,
      })
    }
    return projectTaskWaitInTransaction(db, row, now)
  })
}

export function projectTaskWaitInTransaction(
  db: Database.TxOrDb,
  row: typeof EngineTaskWaitRegistrationTable.$inferSelect,
  now = Date.now(),
): TaskWaitProjection {
  const settlement = db
    .select()
    .from(EngineTaskWaitSettlementTable)
    .where(eq(EngineTaskWaitSettlementTable.wait_id, row.id))
    .get()
  if (settlement) {
    return {
      id: row.id,
      taskID: row.task_id,
      executionEpoch: row.execution_epoch,
      dueAt: row.due_at,
      reason: row.reason,
      status: settlement.disposition,
      ingressID: settlement.ingress_id,
      timeCreated: row.time_created,
    }
  }
  const lifecycle = taskLifecycleProjectionInTransaction(db, row.task_id)
  const status =
    lifecycle.epoch !== row.execution_epoch || lifecycle.status !== "active"
      ? "terminal_inapplicable"
      : row.due_at <= now
        ? "due"
        : "scheduled"
  return {
    id: row.id,
    taskID: row.task_id,
    executionEpoch: row.execution_epoch,
    dueAt: row.due_at,
    reason: row.reason,
    status,
    timeCreated: row.time_created,
  }
}

/** Complete Task wait history across every execution epoch and settlement. */
export function listTaskWaits(taskID: string, now = Date.now()): TaskWaitProjection[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskWaitRegistrationTable)
      .where(eq(EngineTaskWaitRegistrationTable.task_id, taskID))
      .orderBy(asc(EngineTaskWaitRegistrationTable.due_at), asc(EngineTaskWaitRegistrationTable.id))
      .all()
      .map((row) => projectTaskWaitInTransaction(db, row, now)),
  )
}

/**
 * Bounded prompt-facing projection for the active execution epoch. Unlike
 * `listTaskWaits`, this deliberately excludes immutable history and settled
 * registrations. The lifecycle is projected once, then the current rows are
 * selected, ordered and capped by one SQL query without per-wait reads.
 */
export function listCurrentTaskWaits(input: { taskID: string; limit: number; now?: number }): TaskWaitProjection[] {
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new Error("Current Task wait query limit must be a positive safe integer")
  }
  const now = input.now ?? Date.now()
  return Database.use((db) => {
    const lifecycle = taskLifecycleProjectionInTransaction(db, input.taskID)
    if (lifecycle.status !== "active") return []
    return db
      .select({ registration: EngineTaskWaitRegistrationTable })
      .from(EngineTaskWaitRegistrationTable)
      .leftJoin(
        EngineTaskWaitSettlementTable,
        eq(EngineTaskWaitSettlementTable.wait_id, EngineTaskWaitRegistrationTable.id),
      )
      .where(
        and(
          eq(EngineTaskWaitRegistrationTable.task_id, input.taskID),
          eq(EngineTaskWaitRegistrationTable.execution_epoch, lifecycle.epoch),
          isNull(EngineTaskWaitSettlementTable.wait_id),
        ),
      )
      .orderBy(asc(EngineTaskWaitRegistrationTable.due_at), asc(EngineTaskWaitRegistrationTable.id))
      .limit(input.limit)
      .all()
      .map(({ registration }) => ({
        id: registration.id,
        taskID: registration.task_id,
        executionEpoch: registration.execution_epoch,
        dueAt: registration.due_at,
        reason: registration.reason,
        status: registration.due_at <= now ? ("due" as const) : ("scheduled" as const),
        timeCreated: registration.time_created,
      }))
  })
}

export function dueTaskWaitsInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; executionEpoch: number; now: number },
): Array<typeof EngineTaskWaitRegistrationTable.$inferSelect> {
  return db
    .select({ registration: EngineTaskWaitRegistrationTable })
    .from(EngineTaskWaitRegistrationTable)
    .leftJoin(
      EngineTaskWaitSettlementTable,
      eq(EngineTaskWaitSettlementTable.wait_id, EngineTaskWaitRegistrationTable.id),
    )
    .where(
      and(
        eq(EngineTaskWaitRegistrationTable.task_id, input.taskID),
        eq(EngineTaskWaitRegistrationTable.execution_epoch, input.executionEpoch),
        lte(EngineTaskWaitRegistrationTable.due_at, input.now),
        isNull(EngineTaskWaitSettlementTable.wait_id),
      ),
    )
    .orderBy(asc(EngineTaskWaitRegistrationTable.due_at), asc(EngineTaskWaitRegistrationTable.id))
    .all()
    .map((row) => row.registration)
}

/**
 * Resolve the sole supersede exception from persisted wait authority.
 * A payload cannot name itself into the due path: source, job, Fire, deadline,
 * Task, epoch and unsettled registration must all be the same occurrence.
 */
export function exactDueTaskWaitForIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    executionEpoch: number
    source: string
    sourceID: string
    inlinePayload?: Record<string, unknown>
    now: number
  },
): string | undefined {
  if (!("taskWaitWake" in (input.inlinePayload ?? {}))) return undefined
  const wake = input.inlinePayload?.taskWaitWake
  const record = wake && typeof wake === "object" ? (wake as Record<string, unknown>) : undefined
  const jobID = typeof record?.jobID === "string" ? record.jobID : undefined
  const fireID = typeof record?.fireID === "string" ? record.fireID : undefined
  const dueAt = typeof record?.dueAt === "number" ? record.dueAt : undefined
  if (
    input.source !== "inline" ||
    !jobID ||
    fireID !== jobID ||
    input.sourceID !== jobID ||
    !Number.isSafeInteger(dueAt)
  ) {
    throw new TaskWaitIngressLineageError(
      `Task wait wake has no exact source/job/Fire identity: ${input.source}:${input.sourceID}`,
      "malformed_due_identity",
      jobID,
    )
  }
  const wait = db
    .select()
    .from(EngineTaskWaitRegistrationTable)
    .where(eq(EngineTaskWaitRegistrationTable.id, jobID))
    .get()
  if (
    !wait ||
    wait.task_id !== input.taskID ||
    wait.execution_epoch !== input.executionEpoch ||
    wait.due_at !== dueAt
  ) {
    throw new TaskWaitIngressLineageError(
      `Task wait wake ${jobID} has no exact registration for Task ${input.taskID} epoch ${input.executionEpoch}`,
      "unknown_due_wait",
      jobID,
    )
  }
  if (wait.due_at > input.now) {
    throw new TaskWaitIngressLineageError(`Task wait wake ${jobID} is not due until ${wait.due_at}`, "not_due", jobID)
  }
  const settlement = db
    .select({ waitID: EngineTaskWaitSettlementTable.wait_id })
    .from(EngineTaskWaitSettlementTable)
    .where(eq(EngineTaskWaitSettlementTable.wait_id, jobID))
    .get()
  if (settlement) {
    throw new TaskWaitIngressLineageError(`Task wait wake ${jobID} is already settled`, "already_settled", jobID)
  }
  return jobID
}

export function nextTaskWaitDueAtInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; executionEpoch: number },
): number | undefined {
  return db
    .select({ dueAt: EngineTaskWaitRegistrationTable.due_at })
    .from(EngineTaskWaitRegistrationTable)
    .leftJoin(
      EngineTaskWaitSettlementTable,
      eq(EngineTaskWaitSettlementTable.wait_id, EngineTaskWaitRegistrationTable.id),
    )
    .where(
      and(
        eq(EngineTaskWaitRegistrationTable.task_id, input.taskID),
        eq(EngineTaskWaitRegistrationTable.execution_epoch, input.executionEpoch),
        isNull(EngineTaskWaitSettlementTable.wait_id),
      ),
    )
    .orderBy(asc(EngineTaskWaitRegistrationTable.due_at), asc(EngineTaskWaitRegistrationTable.id))
    .get()?.dueAt
}

export function settleTaskWaitForIngressInTransaction(
  db: Database.TxOrDb,
  input: {
    waitID: string
    ingressID: string
    disposition: "due_ingress_accepted" | "superseded"
    now: number
  },
): void {
  const wait = db
    .select()
    .from(EngineTaskWaitRegistrationTable)
    .where(eq(EngineTaskWaitRegistrationTable.id, input.waitID))
    .get()
  const ingress = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(eq(EngineTaskRootIngressTable.id, input.ingressID))
    .get()
  if (!wait || !ingress || wait.task_id !== ingress.task_id || wait.execution_epoch !== ingress.execution_epoch) {
    throw new Error(`Task wait ${input.waitID} cannot settle against unrelated ingress ${input.ingressID}`)
  }
  const existing = db
    .select()
    .from(EngineTaskWaitSettlementTable)
    .where(eq(EngineTaskWaitSettlementTable.wait_id, input.waitID))
    .get()
  if (existing) {
    if (existing.ingress_id !== input.ingressID || existing.disposition !== input.disposition) {
      throw new Error(`Task wait ${input.waitID} already has a conflicting settlement`)
    }
    return
  }
  db.insert(EngineTaskWaitSettlementTable)
    .values({
      wait_id: input.waitID,
      ingress_id: input.ingressID,
      disposition: input.disposition,
      time_created: input.now,
    })
    .run()
}

export function supersedeCurrentTaskWaitsForIngressInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; executionEpoch: number; ingressID: string; exceptWaitID?: string; now: number },
): string[] {
  const rows = db
    .select({ registration: EngineTaskWaitRegistrationTable })
    .from(EngineTaskWaitRegistrationTable)
    .leftJoin(
      EngineTaskWaitSettlementTable,
      eq(EngineTaskWaitSettlementTable.wait_id, EngineTaskWaitRegistrationTable.id),
    )
    .where(
      and(
        eq(EngineTaskWaitRegistrationTable.task_id, input.taskID),
        eq(EngineTaskWaitRegistrationTable.execution_epoch, input.executionEpoch),
        isNull(EngineTaskWaitSettlementTable.wait_id),
      ),
    )
    .all()
    .map((row) => row.registration)
    .filter((row) => row.id !== input.exceptWaitID)
  for (const row of rows) {
    settleTaskWaitForIngressInTransaction(db, {
      waitID: row.id,
      ingressID: input.ingressID,
      disposition: "superseded",
      now: input.now,
    })
  }
  return rows.map((row) => row.id)
}
