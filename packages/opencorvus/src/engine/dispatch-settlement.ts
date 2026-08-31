import { isDeepStrictEqual } from "node:util"
import { DispatchOutcomeSchema, type DispatchOutcome } from "@/agent/dispatch-outcome"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable, type EngineMetadata } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { and, asc, eq, sql, Database } from "@/storage/db"
import z from "zod"
import { findDispatchLineageByDispatchID } from "./dispatch-lineage"

const FinalDispatchOutcomeSchema = DispatchOutcomeSchema.refine((outcome) => outcome.kind !== "accepted", {
  message: "A dispatch settlement must be final",
})

export interface DispatchSettlementPayload extends EngineMetadata {
  task_id: string
  dispatch_lineage_id: string
  dispatch_id: string
  session_id: string
  outcome: Exclude<DispatchOutcome, { kind: "accepted" }>
  time_created: number
}

const DispatchSettlementPayloadSchema = z
  .object({
    task_id: z.string().min(1),
    dispatch_lineage_id: z.string().min(1),
    dispatch_id: z.string().min(1),
    session_id: z.string().min(1),
    outcome: FinalDispatchOutcomeSchema,
    time_created: z.number().positive(),
  })
  .strict()

export interface DispatchSettlementRow {
  artifactID: string
  payload: DispatchSettlementPayload
}

export type UnsettledDispatchLineage = Readonly<{
  artifactID: string
  dispatchID: string
  sessionID: string
}>

export class TaskDispatchSettlementPendingError extends Error {
  override readonly name = "TaskDispatchSettlementPendingError"
  readonly code = "TASK_DISPATCH_SETTLEMENT_PENDING"

  constructor(
    readonly taskID: string,
    readonly unsettled: readonly UnsettledDispatchLineage[],
  ) {
    super(
      `Task ${taskID} has ${unsettled.length} committed dispatch(es) without a terminal settlement: ` +
        unsettled.map((item) => `${item.artifactID}/${item.dispatchID}/${item.sessionID}`).join(", "),
    )
  }
}

function parsePayload(value: unknown, _artifactID: string): DispatchSettlementPayload {
  const parsed = DispatchSettlementPayloadSchema.parse(value)
  return parsed as DispatchSettlementPayload
}

/**
 * Assert that every committed dispatch lineage in a Task has one durable final
 * settlement. Task completion calls this inside its winning terminal
 * transaction, so a continuation lineage and the terminal Task row cannot win
 * on opposite sides of a time-of-check/time-of-use race.
 */
export function assertTaskDispatchesSettledInTransaction(db: Database.TxOrDb, taskID: string): void {
  const lineages = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_lineage")))
    .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
    .all()
    .map((row): UnsettledDispatchLineage => {
      const payload = row.payload as Record<string, unknown>
      const dispatchID = payload.dispatch_id
      const sessionID = payload.child_session_id
      if (typeof dispatchID !== "string" || typeof sessionID !== "string") {
        throw new Error(`Dispatch lineage ${row.id} has invalid settlement identity`)
      }
      return { artifactID: row.id, dispatchID, sessionID }
    })
  if (lineages.length === 0) return
  const settledDispatchIDs = new Set(
    db
      .select({ payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_settlement")))
      .all()
      .map((row) => parsePayload(row.payload, taskID).dispatch_id),
  )
  const unsettled = lineages.filter((lineage) => !settledDispatchIDs.has(lineage.dispatchID))
  if (unsettled.length > 0) throw new TaskDispatchSettlementPendingError(taskID, unsettled)
}

export function findDispatchSettlementByDispatchID(input: {
  taskID: string
  dispatchID: string
}): DispatchSettlementRow | undefined {
  return Database.use((db) => {
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
        ),
      )
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .all()
    if (rows.length > 1) {
      throw new Error(`Dispatch ${input.dispatchID} has ${rows.length} durable settlements`)
    }
    const row = rows[0]
    return row ? { artifactID: row.id, payload: parsePayload(row.payload, row.id) } : undefined
  })
}

export function recordDispatchSettlement(input: {
  taskID: string
  dispatchID: string
  outcome: DispatchOutcome
  now?: number
}): DispatchSettlementRow {
  if (input.outcome.kind === "accepted") throw new Error(`Dispatch ${input.dispatchID} accepted outcome is not final`)
  const lineage = findDispatchLineageByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!lineage) throw new Error(`Dispatch ${input.dispatchID} has no durable lineage`)
  const sessionID = input.outcome.session_id
  if (!sessionID || sessionID !== lineage.payload.child_session_id) {
    throw new Error(`Dispatch ${input.dispatchID} outcome Session does not match its durable lineage`)
  }
  if (input.outcome.kind === "coordination" && input.outcome.dispatch_lineage_id !== lineage.artifactID) {
    throw new Error(`Dispatch ${input.dispatchID} coordination outcome lineage identity drift`)
  }
  const now = input.now ?? Date.now()
  const payload = parsePayload(
    {
      task_id: input.taskID,
      dispatch_lineage_id: lineage.artifactID,
      dispatch_id: input.dispatchID,
      session_id: sessionID,
      outcome: input.outcome,
      time_created: now,
    },
    input.dispatchID,
  )
  return Database.transaction((db) => {
    const rows = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
        ),
      )
      .all()
    if (rows.length > 1) throw new Error(`Dispatch ${input.dispatchID} has ${rows.length} durable settlements`)
    if (rows[0]) {
      const existing = parsePayload(rows[0].payload, rows[0].id)
      if (!isDeepStrictEqual(existing.outcome, payload.outcome)) {
        throw new Error(`Dispatch ${input.dispatchID} durable settlement outcome drift`)
      }
      return { artifactID: rows[0].id, payload: existing }
    }
    const artifactID = Identifier.ascending("artifact")
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.taskID,
      kind: "dispatch_settlement",
      label: "dispatch-settlement",
      payload,
      timeCreated: now,
    })
    return { artifactID, payload }
  })
}

/** Pipeline settlement is first-committer-wins. Unlike the strict direct
 * writer, callers use this authority when startup recovery and normal adapter
 * completion may race for the same immutable occurrence. */
export function settleDispatchOrReturnExisting(input: {
  taskID: string
  dispatchID: string
  outcome: DispatchOutcome
  now?: number
}): DispatchSettlementRow {
  if (input.outcome.kind === "accepted") throw new Error(`Dispatch ${input.dispatchID} accepted outcome is not final`)
  return Database.immediateTransaction(() => {
    const existing = findDispatchSettlementByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
    if (existing) return existing
    return recordDispatchSettlement(input)
  })
}
