import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { insertEngineArtifact } from "./artifact"
import { dispatchLineageRow, type DispatchLineageRow } from "./dispatch-lineage-facts"
import { EngineArtifactTable, type EngineMetadata } from "./engine.sql"
import { Identifier } from "@/id/id"
import { Database, and, asc, eq, gt, or, sql } from "@/storage/db"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"

const MAX_DISPATCH_RECOVERY_PAGE_SIZE = 64

export type DispatchRecoveryQueryStage =
  | "lineages"
  | "dispositions"
  | "settlement-deliveries"
  | "lifecycle-deliveries"
  | "execution-occurrences"

type DispatchRecoveryQueryObserver = (stage: DispatchRecoveryQueryStage, rowCount: number) => void

type DispatchRecoveryExecutionOccurrenceFact = {
  taskID: string
  executionEpoch: number
  currentEpoch: number | null
  terminal: number
  deleted: number
}

const DispatchDeliveryDispositionPayloadSchema = z
  .object({
    task_id: z.string().min(1),
    dispatch_lineage_id: z.string().min(1),
    dispatch_id: z.string().min(1),
    infrastructure_source_artifact_id: z.string().min(1),
    execution_epoch: z.number().int().positive(),
    budget_artifact_id: z.string().min(1),
    disposition: z.literal("budget_suppressed"),
    time_created: z.number().int().positive(),
  })
  .strict()

export interface DispatchDeliveryDispositionPayload extends EngineMetadata {
  task_id: string
  dispatch_lineage_id: string
  dispatch_id: string
  infrastructure_source_artifact_id: string
  execution_epoch: number
  budget_artifact_id: string
  disposition: "budget_suppressed"
  time_created: number
}

function parsePayload(value: unknown, artifactID: string): DispatchDeliveryDispositionPayload {
  const parsed = DispatchDeliveryDispositionPayloadSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid dispatch_delivery_disposition artifact ${artifactID}: ${parsed.error.message}`)
  }
  return parsed.data as DispatchDeliveryDispositionPayload
}

export function recordDispatchBudgetSuppressionInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    dispatchLineageID: string
    dispatchID: string
    infrastructureSourceArtifactID: string
    executionEpoch: number
    budgetArtifactID: string
    now: number
  },
): string {
  const stable = {
    task_id: input.taskID,
    dispatch_lineage_id: input.dispatchLineageID,
    dispatch_id: input.dispatchID,
    infrastructure_source_artifact_id: input.infrastructureSourceArtifactID,
    execution_epoch: input.executionEpoch,
    budget_artifact_id: input.budgetArtifactID,
    disposition: "budget_suppressed" as const,
  }
  const existing = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "dispatch_delivery_disposition"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
      ),
    )
    .get()
  if (existing) {
    const parsed = parsePayload(existing.payload, existing.id)
    const { time_created: _timeCreated, ...priorStable } = parsed
    if (!isDeepStrictEqual(priorStable, stable)) {
      throw new Error(`Dispatch ${input.dispatchID} delivery disposition drift`)
    }
    return existing.id
  }
  const artifactID = Identifier.deterministic(
    "artifact",
    `dispatch-delivery-disposition-v1\0${input.taskID}\0${input.dispatchID}`,
  )
  insertEngineArtifact(db, {
    id: artifactID,
    taskID: input.taskID,
    kind: "dispatch_delivery_disposition",
    label: "dispatch-delivery-disposition",
    payload: { ...stable, time_created: input.now },
    timeCreated: input.now,
  })
  return artifactID
}

export type DispatchRecoveryFrontierCursor = {
  rowid: number
  descriptorID: string
  connectionEpoch: number
}

export type DispatchRecoveryDescriptor = { taskID: string; sessionID: string; dispatchID: string }

const dispatchPairKey = (taskID: string, dispatchID: string) => `${taskID}\0${dispatchID}`
const dispatchDescriptorKey = (input: DispatchRecoveryDescriptor) =>
  `${input.taskID}\0${input.sessionID}\0${input.dispatchID}`

function dispatchRecoveryRequestedValues(descriptors: readonly DispatchRecoveryDescriptor[]) {
  return sql.join(
    descriptors.map((descriptor) => sql`(${descriptor.taskID}, ${descriptor.sessionID}, ${descriptor.dispatchID})`),
    sql`, `,
  )
}

function dispatchRecoveryDispositionQuery(descriptors: readonly DispatchRecoveryDescriptor[]) {
  const requested = dispatchRecoveryRequestedValues(descriptors)
  return sql`
    WITH requested(task_id, session_id, dispatch_id) AS (VALUES ${requested})
    SELECT requested.task_id AS taskID, requested.dispatch_id AS dispatchID
    FROM requested
    WHERE EXISTS (
      SELECT 1
      FROM engine_artifact AS disposition
      WHERE disposition.task_id=requested.task_id
        AND disposition.kind='dispatch_delivery_disposition'
        AND json_extract(disposition.payload, '$.dispatch_id')=requested.dispatch_id
    )
  `
}

function dispatchRecoverySettlementDeliveryQuery(descriptors: readonly DispatchRecoveryDescriptor[]) {
  const requested = dispatchRecoveryRequestedValues(descriptors)
  return sql`
    WITH requested(task_id, session_id, dispatch_id) AS (VALUES ${requested})
    SELECT requested.task_id AS taskID, requested.dispatch_id AS dispatchID
    FROM requested
    WHERE EXISTS (
      SELECT 1
      FROM engine_artifact AS settlement
      WHERE settlement.task_id=requested.task_id
        AND settlement.kind='dispatch_settlement'
        AND json_extract(settlement.payload, '$.dispatch_id')=requested.dispatch_id
        AND (
          EXISTS (
            SELECT 1
            FROM engine_task_root_ingress AS ingress
            WHERE ingress.task_id=settlement.task_id
              AND ingress.source='engine_artifact'
              AND ingress.source_id=settlement.id
          )
          OR EXISTS (
            SELECT 1
            FROM engine_task_root_ingress AS ingress
            WHERE ingress.task_id=settlement.task_id
              AND ingress.source='engine_artifact'
              AND ingress.source_id=json_extract(
                settlement.payload,
                '$.outcome.infrastructure_error.artifact_id'
              )
          )
        )
    )
  `
}

function dispatchRecoveryLifecycleDeliveryQuery(descriptors: readonly DispatchRecoveryDescriptor[]) {
  const requested = dispatchRecoveryRequestedValues(descriptors)
  return sql`
    WITH requested(task_id, session_id, dispatch_id) AS (VALUES ${requested})
    SELECT requested.task_id AS taskID, requested.dispatch_id AS dispatchID
    FROM requested
    WHERE EXISTS (
      SELECT 1
      FROM worker_turn_descriptor AS descriptor
      WHERE descriptor.task_id=requested.task_id
        AND descriptor.session_id=requested.session_id
        AND json_extract(descriptor.payload, '$.dispatchTurn.current_dispatch_id')=requested.dispatch_id
        AND EXISTS (
          SELECT 1
          FROM protocol_event AS lifecycle
          WHERE lifecycle.type='agent.execution.lifecycle'
            AND lifecycle.aggregate_type='task'
            AND lifecycle.aggregate_id=descriptor.task_id
            AND lifecycle.session_id=descriptor.session_id
            AND json_extract(lifecycle.payload, '$.inputMessageID')
              = json_extract(descriptor.payload, '$.messageAuthority.user_message_id')
            AND json_extract(lifecycle.payload, '$.status.type')='terminal'
            AND EXISTS (
              SELECT 1
              FROM engine_task_root_ingress AS ingress
              WHERE ingress.task_id=descriptor.task_id
                AND ingress.source='protocol_event'
                AND ingress.source_id=lifecycle.id
            )
        )
    )
  `
}

function dispatchRecoveryExecutionOccurrenceQuery(
  lineages: readonly DispatchLineageRow[],
) {
  const occurrences = [
    ...new Map(
      lineages.map((lineage) => [
        `${lineage.taskID}\0${lineage.payload.execution_epoch}`,
        { taskID: lineage.taskID, executionEpoch: lineage.payload.execution_epoch },
      ]),
    ).values(),
  ]
  if (occurrences.length === 0) return undefined
  const requested = sql.join(
    occurrences.map((occurrence) => sql`(${occurrence.taskID}, ${occurrence.executionEpoch})`),
    sql`, `,
  )
  return sql`
    WITH requested(task_id, execution_epoch) AS (VALUES ${requested})
    SELECT
      requested.task_id AS taskID,
      requested.execution_epoch AS executionEpoch,
      (
        SELECT MAX(json_extract(opened.payload, '$.execution_epoch'))
        FROM protocol_event AS opened
        WHERE opened.aggregate_type='task'
          AND opened.aggregate_id=requested.task_id
          AND opened.type IN ('task.execution.opened','task.execution.reopened')
      ) AS currentEpoch,
      EXISTS (
        SELECT 1
        FROM protocol_event AS terminal
        WHERE terminal.aggregate_type='task'
          AND terminal.aggregate_id=requested.task_id
          AND terminal.type IN ('task.cancelled','task.completed','task.failed')
          AND json_extract(terminal.payload, '$.execution_epoch')=requested.execution_epoch
      ) AS terminal,
      EXISTS (
        SELECT 1
        FROM protocol_event AS deleted
        WHERE deleted.aggregate_type='task'
          AND deleted.aggregate_id=requested.task_id
          AND deleted.type='task.deleted'
      ) AS deleted
    FROM requested
  `
}

function dispatchRecoveryExecutionOccurrencesInTransaction(
  db: Database.TxOrDb,
  lineages: readonly DispatchLineageRow[],
): DispatchRecoveryExecutionOccurrenceFact[] {
  const query = dispatchRecoveryExecutionOccurrenceQuery(lineages)
  return query ? db.all<DispatchRecoveryExecutionOccurrenceFact>(query) : []
}

/**
 * The sole bounded classifier for descriptor-backed recovery.
 *
 * A candidate must have one exact lineage in its creator Task execution epoch,
 * that epoch must still be the current active occurrence, and no terminal
 * delivery or budget disposition may already exist. The result is reduced
 * only from immutable facts; no delivery-status table or cursor is created.
 */
export function dispatchRecoveryCandidatesInTransaction(
  db: Database.TxOrDb,
  input: {
    descriptors: readonly DispatchRecoveryDescriptor[]
    observe?: DispatchRecoveryQueryObserver
  },
): DispatchLineageRow[] {
  const descriptors = [...new Map(input.descriptors.map((item) => [dispatchDescriptorKey(item), item])).values()]
  if (descriptors.length === 0) return []
  if (descriptors.length > MAX_DISPATCH_RECOVERY_PAGE_SIZE) {
    throw new Error(`Dispatch recovery classifier accepts at most ${MAX_DISPATCH_RECOVERY_PAGE_SIZE} descriptors`)
  }
  const descriptorKeys = new Set(descriptors.map(dispatchDescriptorKey))
  const lineageRows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.kind, "dispatch_lineage"),
        or(
          ...descriptors.map((descriptor) =>
            and(
              eq(EngineArtifactTable.task_id, descriptor.taskID),
              sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${descriptor.dispatchID}`,
              sql`json_extract(${EngineArtifactTable.payload}, '$.child_session_id') = ${descriptor.sessionID}`,
            ),
          ),
        ),
      ),
    )
    .all()
  input.observe?.("lineages", lineageRows.length)
  const lineages = lineageRows
    .map(dispatchLineageRow)
    .filter((lineage) =>
      descriptorKeys.has(
        dispatchDescriptorKey({
          taskID: lineage.taskID,
          sessionID: lineage.payload.child_session_id,
          dispatchID: lineage.dispatchID,
        }),
      ),
    )
  const matchedDescriptors = lineages.map((lineage) => ({
    taskID: lineage.taskID,
    sessionID: lineage.payload.child_session_id,
    dispatchID: lineage.dispatchID,
  }))
  const lineagePairs = new Set(lineages.map((lineage) => dispatchPairKey(lineage.taskID, lineage.dispatchID)))
  const excluded = new Set<string>()

  const dispositionRows =
    matchedDescriptors.length === 0
      ? []
      : db.all<{ taskID: string; dispatchID: string }>(dispatchRecoveryDispositionQuery(matchedDescriptors))
  input.observe?.("dispositions", dispositionRows.length)
  for (const row of dispositionRows) {
    const key = dispatchPairKey(row.taskID, row.dispatchID)
    if (lineagePairs.has(key)) excluded.add(key)
  }

  const settlementDeliveryRows =
    matchedDescriptors.length === 0
      ? []
      : db.all<{ taskID: string; dispatchID: string }>(
          dispatchRecoverySettlementDeliveryQuery(matchedDescriptors),
        )
  input.observe?.("settlement-deliveries", settlementDeliveryRows.length)
  for (const row of settlementDeliveryRows) {
    const key = dispatchPairKey(row.taskID, row.dispatchID)
    if (lineagePairs.has(key)) excluded.add(key)
  }

  const lifecycleDeliveryRows =
    matchedDescriptors.length === 0
      ? []
      : db.all<{ taskID: string; dispatchID: string }>(
          dispatchRecoveryLifecycleDeliveryQuery(matchedDescriptors),
        )
  input.observe?.("lifecycle-deliveries", lifecycleDeliveryRows.length)
  for (const row of lifecycleDeliveryRows) {
    const key = dispatchPairKey(row.taskID, row.dispatchID)
    if (lineagePairs.has(key)) excluded.add(key)
  }

  const executionOccurrences = dispatchRecoveryExecutionOccurrencesInTransaction(db, lineages)
  input.observe?.("execution-occurrences", executionOccurrences.length)
  const executionOccurrenceByKey = new Map(
    executionOccurrences.map((occurrence) => [
      `${occurrence.taskID}\0${occurrence.executionEpoch}`,
      occurrence,
    ]),
  )
  for (const lineage of lineages) {
    const key = dispatchPairKey(lineage.taskID, lineage.dispatchID)
    const occurrence = executionOccurrenceByKey.get(`${lineage.taskID}\0${lineage.payload.execution_epoch}`)
    if (
      !occurrence ||
      occurrence.deleted === 1 ||
      occurrence.currentEpoch !== lineage.payload.execution_epoch ||
      occurrence.terminal === 1
    ) {
      excluded.add(key)
    }
  }
  return lineages.filter((lineage) => !excluded.has(dispatchPairKey(lineage.taskID, lineage.dispatchID)))
}

export const DispatchDeliveryDispositionTestHooks = {
  executionOccurrencesInTransaction(
    db: Database.TxOrDb,
    lineages: readonly DispatchLineageRow[],
  ): DispatchRecoveryExecutionOccurrenceFact[] {
    return dispatchRecoveryExecutionOccurrencesInTransaction(db, lineages)
  },
  executionOccurrenceQueryPlan(db: Database.TxOrDb, lineages: readonly DispatchLineageRow[]): string[] {
    const query = dispatchRecoveryExecutionOccurrenceQuery(lineages)
    if (!query) return []
    return db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${query}`).map((row) => row.detail)
  },
  deliveryQueryPlans(
    db: Database.TxOrDb,
    descriptors: readonly DispatchRecoveryDescriptor[],
  ): Record<"dispositions" | "settlementDeliveries" | "lifecycleDeliveries", string[]> {
    if (descriptors.length === 0 || descriptors.length > MAX_DISPATCH_RECOVERY_PAGE_SIZE) {
      throw new Error(`Dispatch recovery query plan requires 1-${MAX_DISPATCH_RECOVERY_PAGE_SIZE} descriptors`)
    }
    const explain = (query: ReturnType<typeof dispatchRecoveryDispositionQuery>) =>
      db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${query}`).map((row) => row.detail)
    return {
      dispositions: explain(dispatchRecoveryDispositionQuery(descriptors)),
      settlementDeliveries: explain(dispatchRecoverySettlementDeliveryQuery(descriptors)),
      lifecycleDeliveries: explain(dispatchRecoveryLifecycleDeliveryQuery(descriptors)),
    }
  },
}

export function dispatchRecoveryCandidateExistsInTransaction(
  db: Database.TxOrDb,
  input: DispatchRecoveryDescriptor,
): boolean {
  return dispatchRecoveryCandidatesInTransaction(db, { descriptors: [input] }).length === 1
}

/**
 * Descriptor-backed dispatches whose exact terminal delivery is still absent.
 *
 * Accepted delivery remains the existing Task-root ingress fact. The only new
 * fact considered here is the missing budget-suppression relationship; this
 * query does not materialize a second mutable delivery status.
 */
export function unresolvedDispatchRecoveryPageInTransaction(
  db: Database.TxOrDb,
  input: {
    taskID: string
    after?: DispatchRecoveryFrontierCursor
    limit: number
  },
) {
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > MAX_DISPATCH_RECOVERY_PAGE_SIZE) {
    throw new Error(`Dispatch recovery frontier limit must be between 1 and ${MAX_DISPATCH_RECOVERY_PAGE_SIZE}`)
  }
  const connectionEpoch = Database.physicalConnectionEpoch()
  const after =
    input.after?.connectionEpoch === connectionEpoch &&
    db
      .select({ id: WorkerTurnDescriptorTable.id })
      .from(WorkerTurnDescriptorTable)
      .where(
        and(
          eq(WorkerTurnDescriptorTable.task_id, input.taskID),
          eq(WorkerTurnDescriptorTable.id, input.after.descriptorID),
          sql`rowid=${input.after.rowid}`,
        ),
      )
      .get()
      ? input.after
      : undefined
  // Accepted dispatch recovery begins at the descriptor commit, never at the
  // earlier write-ahead lineage. Descriptor rowid is the process-local append
  // order; durable-ID validation and the physical connection epoch discard it
  // after retention, VACUUM, transfer or rebuild.
  const descriptors = db
    .select({
      id: WorkerTurnDescriptorTable.id,
      rowid: sql<number>`rowid`,
      sessionID: WorkerTurnDescriptorTable.session_id,
      dispatchID: sql<string>`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id')`,
    })
    .from(WorkerTurnDescriptorTable)
    .where(
      and(
        eq(WorkerTurnDescriptorTable.task_id, input.taskID),
        ...(after ? [gt(sql<number>`rowid`, after.rowid)] : []),
      ),
    )
    .orderBy(asc(sql`rowid`))
    .limit(input.limit)
    .all()
  const lineages = dispatchRecoveryCandidatesInTransaction(db, {
    descriptors: descriptors.map((descriptor) => ({
      taskID: input.taskID,
      sessionID: descriptor.sessionID,
      dispatchID: descriptor.dispatchID,
    })),
  })
  const last = descriptors.at(-1)
  return {
    lineages,
    scannedCount: descriptors.length,
    next:
      descriptors.length === input.limit && last
        ? { rowid: last.rowid, descriptorID: last.id, connectionEpoch }
        : undefined,
  }
}
