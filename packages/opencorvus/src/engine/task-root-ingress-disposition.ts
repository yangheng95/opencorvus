import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { Identifier } from "@/id/id"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { Database, and, asc, eq, gt, inArray, lt, or, sql } from "@/storage/db"
import { insertEngineArtifact } from "./artifact"
import { dispatchRecoveryCandidatesInTransaction } from "./dispatch-delivery-disposition"
import {
  EngineArtifactTable,
  EngineTaskRootIngressTable,
  EngineTaskWaitRegistrationTable,
  type EngineMetadata,
} from "./engine.sql"

const MAX_SCHEDULING_FRONTIER_PAGE_SIZE = 64

const TaskRootDecisionOccurrenceSchema = z
  .object({
    assistant_message_id: z.string().min(1),
    control_message_id: z.string().min(1),
    predecessor_id: z.string().min(1),
    activation_id: z.string().min(1),
  })
  .strict()

const TaskRootIngressDispositionBaseSchema = z
  .object({
    task_id: z.string().min(1),
    ingress_id: z.string().min(1),
    execution_epoch: z.number().int().positive(),
    evidence_ids: z.array(z.string().min(1)).min(1),
    time_created: z.number().int().positive(),
  })
  .strict()

const TaskRootIngressDispositionPayloadSchema = z.discriminatedUnion("disposition", [
  TaskRootIngressDispositionBaseSchema.extend({
    disposition: z.literal("resolved"),
    decision_occurrence: TaskRootDecisionOccurrenceSchema,
  }).strict(),
  TaskRootIngressDispositionBaseSchema.extend({
    disposition: z.literal("terminal_inapplicable"),
  }).strict(),
  TaskRootIngressDispositionBaseSchema.extend({
    disposition: z.literal("exhausted"),
  }).strict(),
  TaskRootIngressDispositionBaseSchema.extend({
    disposition: z.literal("operator_abandoned"),
  }).strict(),
])

export type TaskRootDecisionOccurrence = z.infer<typeof TaskRootDecisionOccurrenceSchema>

export type TaskRootIngressDispositionPayload = z.infer<typeof TaskRootIngressDispositionPayloadSchema> & EngineMetadata

function parsePayload(value: unknown, artifactID: string): TaskRootIngressDispositionPayload {
  const parsed = TaskRootIngressDispositionPayloadSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid task_root_ingress_disposition artifact ${artifactID}: ${parsed.error.message}`)
  }
  return parsed.data as TaskRootIngressDispositionPayload
}

export function taskRootIngressDispositionInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; ingressID: string },
): TaskRootIngressDispositionPayload | undefined {
  const row = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress_disposition"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.ingress_id') = ${input.ingressID}`,
      ),
    )
    .get()
  return row ? parsePayload(row.payload, row.id) : undefined
}

/**
 * Append the immutable proof that an ingress released the Task FIFO.
 *
 * The disposition is not a mutable status projection. Its evidence IDs name
 * the exact completed decision, terminal lifecycle occurrence, or surfaced
 * exhausted gate that made the canonical reducer's verdict irreversible.
 */
export function recordTaskRootIngressDispositionInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    ingressID: string
    executionEpoch: number
    evidenceIDs: readonly string[]
    now: number
  } & (
    | { disposition: "resolved"; decisionOccurrence: TaskRootDecisionOccurrence }
    | { disposition: "terminal_inapplicable" | "exhausted" | "operator_abandoned" }
  ),
): string {
  const evidenceIDs = [...new Set(input.evidenceIDs)].toSorted()
  if (evidenceIDs.length === 0) throw new Error("Task-root ingress disposition requires exact evidence")
  const stable = {
    task_id: input.taskID,
    ingress_id: input.ingressID,
    execution_epoch: input.executionEpoch,
    disposition: input.disposition,
    evidence_ids: evidenceIDs,
    ...(input.disposition === "resolved" ? { decision_occurrence: input.decisionOccurrence } : {}),
  }
  const existing = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_root_ingress_disposition"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.ingress_id') = ${input.ingressID}`,
      ),
    )
    .get()
  if (existing) {
    const parsed = parsePayload(existing.payload, existing.id)
    const { time_created: _timeCreated, ...priorStable } = parsed
    if (!isDeepStrictEqual(priorStable, stable)) {
      throw new Error(`Task-root ingress ${input.ingressID} disposition drift`)
    }
    return existing.id
  }
  const artifactID = Identifier.deterministic(
    "artifact",
    `task-root-ingress-disposition-v1\0${input.taskID}\0${input.ingressID}`,
  )
  insertEngineArtifact(db, {
    id: artifactID,
    taskID: input.taskID,
    kind: "task_root_ingress_disposition",
    label: "task-root-ingress-disposition",
    payload: { ...stable, time_created: input.now },
    timeCreated: input.now,
  })
  return artifactID
}

export type TaskRootIngressFrontierCursor = { sequence: number; ingressID: string }

/** Bounded FIFO page of ingresses without an immutable release proof. */
export function taskRootIngressReconciliationPageInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    executionEpoch: number
    after?: TaskRootIngressFrontierCursor
    beforeSequence?: number
    limit: number
  },
) {
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > MAX_SCHEDULING_FRONTIER_PAGE_SIZE) {
    throw new Error(`Task-root ingress frontier limit must be between 1 and ${MAX_SCHEDULING_FRONTIER_PAGE_SIZE}`)
  }
  // The immutable disposition anti-join belongs before LIMIT. A long-running
  // Task may retain millions of released ingresses; paging the raw history and
  // filtering afterwards turns every scan and lease transaction into
  // O(history/page) application round-trips. The exact disposition index makes
  // this one bounded FIFO statement without introducing a mutable checkpoint.
  const ingresses = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(
      and(
        eq(EngineTaskRootIngressTable.task_id, input.taskID),
        eq(EngineTaskRootIngressTable.execution_epoch, input.executionEpoch),
        ...(input.after
          ? [
              or(
                gt(EngineTaskRootIngressTable.sequence, input.after.sequence),
                and(
                  eq(EngineTaskRootIngressTable.sequence, input.after.sequence),
                  gt(EngineTaskRootIngressTable.id, input.after.ingressID),
                ),
              )!,
            ]
          : []),
        ...(input.beforeSequence === undefined ? [] : [lt(EngineTaskRootIngressTable.sequence, input.beforeSequence)]),
        sql`NOT EXISTS (
          SELECT 1 FROM engine_artifact disposition
          WHERE disposition.task_id = ${EngineTaskRootIngressTable.task_id}
            AND disposition.kind = 'task_root_ingress_disposition'
            AND json_extract(disposition.payload, '$.ingress_id') = ${EngineTaskRootIngressTable.id}
        )`,
      ),
    )
    .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
    .limit(input.limit)
    .all()
  const last = ingresses.at(-1)
  return {
    ingresses,
    scannedCount: ingresses.length,
    next: ingresses.length === input.limit && last ? { sequence: last.sequence, ingressID: last.id } : undefined,
  }
}

type TaskControlSourceCursor = { rowid: number; id: string }
type TaskControlSourcePosition =
  | { state: "after"; cursor: TaskControlSourceCursor }
  | { state: "exhausted"; cursor?: TaskControlSourceCursor }

export type TaskControlProjectFrontierCursor = {
  connectionEpoch: number
  ingress?: TaskControlSourcePosition
  wait?: TaskControlSourcePosition
  cancellation?: TaskControlSourcePosition
  dispatch?: TaskControlSourcePosition
}

export type TaskControlProjectFrontierSlice = {
  taskIDs: string[]
  scannedCount: number
  checkpoint: TaskControlProjectFrontierCursor
  next?: TaskControlProjectFrontierCursor
}

type RawSourceRow = { id: string; taskID: string; rowid: number }

function sourceAfter(position: TaskControlSourcePosition | undefined) {
  if (!position || position.state === "exhausted") return undefined
  return gt(sql<number>`rowid`, position.cursor.rowid)
}

function nextSourcePosition(
  rows: RawSourceRow[],
  limit: number,
  prior: TaskControlSourcePosition | undefined,
): TaskControlSourcePosition {
  const last = rows.at(-1)
  const checkpoint = last ? { rowid: last.rowid, id: last.id } : prior?.cursor
  return rows.length === limit && checkpoint
    ? { state: "after", cursor: checkpoint }
    : { state: "exhausted", ...(checkpoint ? { cursor: checkpoint } : {}) }
}

export function restartTaskControlProjectFrontier(
  checkpoint: TaskControlProjectFrontierCursor,
): TaskControlProjectFrontierCursor {
  const restart = (position: TaskControlSourcePosition | undefined): TaskControlSourcePosition | undefined =>
    position?.cursor ? { state: "after", cursor: position.cursor } : undefined
  const ingress = restart(checkpoint.ingress)
  const wait = restart(checkpoint.wait)
  const cancellation = restart(checkpoint.cancellation)
  const dispatch = restart(checkpoint.dispatch)
  return {
    connectionEpoch: checkpoint.connectionEpoch,
    ...(ingress ? { ingress } : {}),
    ...(wait ? { wait } : {}),
    ...(cancellation ? { cancellation } : {}),
    ...(dispatch ? { dispatch } : {}),
  }
}

/**
 * Read one fixed work slice directly from immutable enabling-source facts.
 * Each source contributes at most `perSourceLimit` physical source rows. A
 * second primary-key-bounded query classifies only that fixed page as current
 * and unresolved. Settled history can consume continuation pages, but cannot
 * turn one heartbeat statement into an unbounded scan through Project history.
 */
export function taskControlProjectFrontierSliceInTransaction(
  db: Database.TxOrDb,
  input: {
    projectID: string
    cursor?: TaskControlProjectFrontierCursor
    perSourceLimit: number
  },
): TaskControlProjectFrontierSlice {
  if (
    !Number.isSafeInteger(input.perSourceLimit) ||
    input.perSourceLimit <= 0 ||
    input.perSourceLimit > MAX_SCHEDULING_FRONTIER_PAGE_SIZE / 4
  ) {
    throw new Error(`Task-control source frontier limit must be between 1 and ${MAX_SCHEDULING_FRONTIER_PAGE_SIZE / 4}`)
  }
  const connectionEpoch = Database.physicalConnectionEpoch()
  const cursor =
    input.cursor?.connectionEpoch === connectionEpoch
      ? input.cursor
      : { connectionEpoch }
  // Ordinary SQLite table rowids are commit-monotone while the current tail
  // row exists. Retention or an offline rebuild may reuse/reorder them, so a
  // saved physical locator is valid only while the same durable source ID
  // still occupies that rowid. A mismatch resets only that source.
  const ingressPosition =
    cursor.ingress?.state !== "after" ||
    db
      .select({ id: EngineTaskRootIngressTable.id })
      .from(EngineTaskRootIngressTable)
      .where(and(eq(EngineTaskRootIngressTable.id, cursor.ingress.cursor.id), sql`rowid=${cursor.ingress.cursor.rowid}`))
      .get()
      ? cursor.ingress
      : undefined
  const waitPosition =
    cursor.wait?.state !== "after" ||
    db
      .select({ id: EngineTaskWaitRegistrationTable.id })
      .from(EngineTaskWaitRegistrationTable)
      .where(and(eq(EngineTaskWaitRegistrationTable.id, cursor.wait.cursor.id), sql`rowid=${cursor.wait.cursor.rowid}`))
      .get()
      ? cursor.wait
      : undefined
  const cancellationPosition =
    cursor.cancellation?.state !== "after" ||
    db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(and(eq(ProtocolEventTable.id, cursor.cancellation.cursor.id), sql`rowid=${cursor.cancellation.cursor.rowid}`))
      .get()
      ? cursor.cancellation
      : undefined
  const dispatchPosition =
    cursor.dispatch?.state !== "after" ||
    db
      .select({ id: WorkerTurnDescriptorTable.id })
      .from(WorkerTurnDescriptorTable)
      .where(and(eq(WorkerTurnDescriptorTable.id, cursor.dispatch.cursor.id), sql`rowid=${cursor.dispatch.cursor.rowid}`))
      .get()
      ? cursor.dispatch
      : undefined
  const rawIngress =
    ingressPosition?.state === "exhausted"
      ? []
      : db
          .select({
            id: EngineTaskRootIngressTable.id,
            taskID: EngineTaskRootIngressTable.task_id,
            rowid: sql<number>`rowid`,
          })
          .from(EngineTaskRootIngressTable)
          .where(
            and(
              eq(EngineTaskRootIngressTable.project_id, input.projectID),
              sourceAfter(ingressPosition),
            ),
          )
          .orderBy(asc(sql`rowid`))
          .limit(input.perSourceLimit)
          .all()
  const currentIngressIDs = new Set(
    rawIngress.length === 0
      ? []
      : db
          .select({ id: EngineTaskRootIngressTable.id })
          .from(EngineTaskRootIngressTable)
          .where(
            and(
              inArray(
                EngineTaskRootIngressTable.id,
                rawIngress.map((row) => row.id),
              ),
              sql`${EngineTaskRootIngressTable.execution_epoch} = (
                SELECT MAX(json_extract(opened.payload, '$.execution_epoch'))
                FROM protocol_event opened
                WHERE opened.aggregate_type = 'task'
                  AND opened.aggregate_id = ${EngineTaskRootIngressTable.task_id}
                  AND opened.type IN ('task.execution.opened','task.execution.reopened')
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM protocol_event terminal INDEXED BY protocol_event_task_epoch_terminal_idx
                WHERE terminal.aggregate_type = 'task'
                  AND terminal.aggregate_id = ${EngineTaskRootIngressTable.task_id}
                  AND terminal.type IN ('task.cancelled','task.completed','task.failed')
                  AND json_extract(terminal.payload, '$.execution_epoch') = ${EngineTaskRootIngressTable.execution_epoch}
                  AND terminal.emitted_at > ${EngineTaskRootIngressTable.time_accepted}
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM engine_artifact disposition
                WHERE disposition.task_id = ${EngineTaskRootIngressTable.task_id}
                  AND disposition.kind = 'task_root_ingress_disposition'
                  AND json_extract(disposition.payload, '$.ingress_id') = ${EngineTaskRootIngressTable.id}
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM protocol_event deleted
                WHERE deleted.aggregate_type = 'task'
                  AND deleted.aggregate_id = ${EngineTaskRootIngressTable.task_id}
                  AND deleted.type = 'task.deleted'
              )`,
            ),
          )
          .all()
          .map((row) => row.id),
  )
  const ingress = rawIngress.filter((row) => currentIngressIDs.has(row.id))
  const rawWaits =
    waitPosition?.state === "exhausted"
      ? []
      : db
          .select({
            id: EngineTaskWaitRegistrationTable.id,
            taskID: EngineTaskWaitRegistrationTable.task_id,
            rowid: sql<number>`rowid`,
          })
          .from(EngineTaskWaitRegistrationTable)
          .where(
            and(
              eq(EngineTaskWaitRegistrationTable.project_id, input.projectID),
              sourceAfter(waitPosition),
            ),
          )
          .orderBy(asc(sql`rowid`))
          .limit(input.perSourceLimit)
          .all()
  const currentWaitIDs = new Set(
    rawWaits.length === 0
      ? []
      : db
          .select({ id: EngineTaskWaitRegistrationTable.id })
          .from(EngineTaskWaitRegistrationTable)
          .where(
            and(
              inArray(
                EngineTaskWaitRegistrationTable.id,
                rawWaits.map((row) => row.id),
              ),
              sql`${EngineTaskWaitRegistrationTable.execution_epoch} = (
                SELECT MAX(json_extract(opened.payload, '$.execution_epoch'))
                FROM protocol_event opened
                WHERE opened.aggregate_type = 'task'
                  AND opened.aggregate_id = ${EngineTaskWaitRegistrationTable.task_id}
                  AND opened.type IN ('task.execution.opened','task.execution.reopened')
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM protocol_event terminal INDEXED BY protocol_event_task_epoch_terminal_idx
                WHERE terminal.aggregate_type = 'task'
                  AND terminal.aggregate_id = ${EngineTaskWaitRegistrationTable.task_id}
                  AND terminal.type IN ('task.cancelled','task.completed','task.failed')
                  AND json_extract(terminal.payload, '$.execution_epoch') = ${EngineTaskWaitRegistrationTable.execution_epoch}
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM engine_task_wait_settlement settlement
                WHERE settlement.wait_id = ${EngineTaskWaitRegistrationTable.id}
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM protocol_event deleted
                WHERE deleted.aggregate_type = 'task'
                  AND deleted.aggregate_id = ${EngineTaskWaitRegistrationTable.task_id}
                  AND deleted.type = 'task.deleted'
              )`,
            ),
          )
          .all()
          .map((row) => row.id),
  )
  const waits = rawWaits.filter((row) => currentWaitIDs.has(row.id))
  const rawCancellations =
    cancellationPosition?.state === "exhausted"
      ? []
      : db
          .select({
            id: ProtocolEventTable.id,
            taskID: ProtocolEventTable.aggregate_id,
            rowid: sql<number>`rowid`,
          })
          .from(ProtocolEventTable)
          .where(
            and(
              eq(ProtocolEventTable.project_id, input.projectID),
              eq(ProtocolEventTable.aggregate_type, "task"),
              eq(ProtocolEventTable.type, "task.cancellation.requested"),
              sourceAfter(cancellationPosition),
            ),
          )
          .orderBy(asc(sql`rowid`))
          .limit(input.perSourceLimit)
          .all()
  const currentCancellationIDs = new Set(
    rawCancellations.length === 0
      ? []
      : db
          .select({ id: ProtocolEventTable.id })
          .from(ProtocolEventTable)
          .where(
            and(
              inArray(
                ProtocolEventTable.id,
                rawCancellations.map((row) => row.id),
              ),
              sql`NOT EXISTS (
                SELECT 1 FROM protocol_event later_boundary
                WHERE later_boundary.aggregate_type = 'task'
                  AND later_boundary.aggregate_id = ${ProtocolEventTable.aggregate_id}
                  AND later_boundary.seq > ${ProtocolEventTable.seq}
                  AND later_boundary.type IN (
                    'task.cancelled','task.completed','task.failed',
                    'task.execution.opened','task.execution.reopened','task.deleted'
                  )
              )`,
            ),
          )
          .all()
          .map((row) => row.id),
  )
  const cancellations = rawCancellations.filter((row) => currentCancellationIDs.has(row.id))
  const rawDispatches =
    dispatchPosition?.state === "exhausted"
      ? []
      : db
          .select({
            id: WorkerTurnDescriptorTable.id,
            taskID: WorkerTurnDescriptorTable.task_id,
            sessionID: WorkerTurnDescriptorTable.session_id,
            dispatchID: sql<string>`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id')`,
            rowid: sql<number>`rowid`,
          })
          .from(WorkerTurnDescriptorTable)
          .where(
            and(
              eq(WorkerTurnDescriptorTable.project_id, input.projectID),
              sourceAfter(dispatchPosition),
            ),
          )
          .orderBy(asc(sql`rowid`))
          .limit(input.perSourceLimit)
          .all()
  const currentDispatches = new Set(
    dispatchRecoveryCandidatesInTransaction(db, {
      descriptors: rawDispatches.map((row) => ({
        taskID: row.taskID,
        sessionID: row.sessionID,
        dispatchID: row.dispatchID,
      })),
    }).map(
      (lineage) =>
        `${lineage.taskID}\0${lineage.payload.child_session_id}\0${lineage.dispatchID}`,
    ),
  )
  const dispatches = rawDispatches.filter((row) =>
    currentDispatches.has(`${row.taskID}\0${row.sessionID}\0${row.dispatchID}`),
  )
  const rows = [...ingress, ...waits, ...cancellations, ...dispatches]
  const rawTaskIDs = [...new Set(rows.map((row) => row.taskID))]
  const next = {
    connectionEpoch,
    ingress:
      ingressPosition?.state === "exhausted"
        ? ingressPosition
        : nextSourcePosition(rawIngress, input.perSourceLimit, ingressPosition),
    wait:
      waitPosition?.state === "exhausted"
        ? waitPosition
        : nextSourcePosition(rawWaits, input.perSourceLimit, waitPosition),
    cancellation:
      cancellationPosition?.state === "exhausted"
        ? cancellationPosition
        : nextSourcePosition(rawCancellations, input.perSourceLimit, cancellationPosition),
    dispatch:
      dispatchPosition?.state === "exhausted"
        ? dispatchPosition
        : nextSourcePosition(rawDispatches, input.perSourceLimit, dispatchPosition),
  } satisfies TaskControlProjectFrontierCursor
  const exhausted = [next.ingress, next.wait, next.cancellation, next.dispatch].every(
    (position) => position?.state === "exhausted",
  )
  return {
    taskIDs: rawTaskIDs,
    scannedCount: rawIngress.length + rawWaits.length + rawCancellations.length + rawDispatches.length,
    checkpoint: next,
    ...(exhausted ? {} : { next }),
  }
}
