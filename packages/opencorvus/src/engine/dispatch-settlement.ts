import { isDeepStrictEqual } from "node:util"
import { DispatchOutcomeSchema, type DispatchOutcome } from "@/agent/dispatch-outcome"
import { insertEngineArtifact } from "@/engine/artifact"
import { MAX_DISPATCH_COLLECTION_SIZE } from "@/engine/dispatch-collection-contract"
import { EngineArtifactTable, type EngineMetadata } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { ToolPartRequestTable } from "@/session/session.sql"
import { and, asc, desc, eq, inArray, or, sql, Database } from "@/storage/db"
import z from "zod"
import { findDispatchLineageByDispatchID } from "./dispatch-lineage"
import { dispatchLineageRow } from "./dispatch-lineage-facts"

const FinalDispatchOutcomeSchema = DispatchOutcomeSchema.superRefine((outcome, context) => {
  if (outcome.kind === "accepted") {
    context.addIssue({ code: "custom", message: "A dispatch settlement must be final" })
    return
  }
  if (!("session_id" in outcome)) {
    context.addIssue({ code: "custom", message: "A dispatch settlement must name its durable Session" })
  }
  if (
    outcome.kind === "infrastructure_failure" &&
    outcome.recovery_authority.occurrence_status !== "occurrence_committed"
  ) {
    context.addIssue({ code: "custom", message: "A dispatch settlement requires committed occurrence authority" })
  }
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
    time_created: z.number().int().positive(),
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

export function parseDispatchSettlementPayload(value: unknown, _artifactID: string): DispatchSettlementPayload {
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
      .map((row) => parseDispatchSettlementPayload(row.payload, taskID).dispatch_id),
  )
  const unsettled = lineages.filter((lineage) => !settledDispatchIDs.has(lineage.dispatchID))
  if (unsettled.length > 0) throw new TaskDispatchSettlementPendingError(taskID, unsettled)
}

export function findDispatchSettlementByDispatchID(input: {
  taskID: string
  dispatchID: string
}): DispatchSettlementRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
        ),
      )
      .get()
    return row ? { artifactID: row.id, payload: parseDispatchSettlementPayload(row.payload, row.id) } : undefined
  })
}

/**
 * Return the immutable terminal worker Message authorities from the Task's
 * latest dispatch group. A dispatch_agents group is identified by its exact
 * outer Tool occurrence and cannot exceed the canonical collection size; a
 * direct dispatch_agent group is the ordered sibling decision set owned by the
 * latest assistant Message. Historical groups are neither scanned nor
 * projected into the Provider schema.
 */
function collectionGroupLineagePredicate(latest: ReturnType<typeof dispatchLineageRow>) {
  return and(
    eq(EngineArtifactTable.task_id, latest.taskID),
    eq(EngineArtifactTable.kind, "dispatch_lineage"),
    sql`json_extract(${EngineArtifactTable.payload}, '$.tool_name') = 'dispatch_agents'`,
    sql`json_extract(${EngineArtifactTable.payload}, '$.execution_epoch') = ${latest.payload.execution_epoch}`,
    sql`json_extract(${EngineArtifactTable.payload}, '$.orchestrator_session_id') = ${latest.payload.orchestrator_session_id}`,
    sql`json_extract(${EngineArtifactTable.payload}, '$.orchestrator_message_id') = ${latest.payload.orchestrator_message_id}`,
    sql`json_extract(${EngineArtifactTable.payload}, '$.tool_part_id') = ${latest.payload.tool_part_id}`,
    sql`json_extract(${EngineArtifactTable.payload}, '$.tool_call_id') = ${latest.payload.tool_call_id}`,
  )
}

function collectionGroupLineageQuery(db: Database.TxOrDb, latest: ReturnType<typeof dispatchLineageRow>) {
  return db
    .select()
    .from(EngineArtifactTable)
    .where(collectionGroupLineagePredicate(latest))
    .limit(MAX_DISPATCH_COLLECTION_SIZE + 1)
}

type DirectGroupRequest = { partID: string; callID: string }

function directGroupRequests(db: Database.TxOrDb, latest: ReturnType<typeof dispatchLineageRow>) {
  return db
    .select({
      partID: ToolPartRequestTable.id,
      callID: sql<string>`json_extract(${ToolPartRequestTable.data}, '$.callID')`,
    })
    .from(ToolPartRequestTable)
    .where(
      and(
        eq(ToolPartRequestTable.message_id, latest.payload.orchestrator_message_id),
        sql`json_extract(${ToolPartRequestTable.data}, '$.tool') = 'dispatch_agent'`,
      ),
    )
    .orderBy(asc(ToolPartRequestTable.time_created), asc(ToolPartRequestTable.id))
    .all()
}

function directGroupLineageIDQuery(
  latest: ReturnType<typeof dispatchLineageRow>,
  requests: readonly DirectGroupRequest[],
) {
  const requested = sql.join(
    requests.map((request, ordinal) => sql`(${ordinal}, ${request.partID}, ${request.callID})`),
    sql`, `,
  )
  return sql`
    WITH requested(ordinal, tool_part_id, tool_call_id) AS (VALUES ${requested})
    SELECT requested.ordinal AS ordinal, lineage.id AS id
    FROM requested
    INNER JOIN engine_artifact AS lineage INDEXED BY engine_dispatch_lineage_direct_tool_occurrence_idx
      ON lineage.task_id = ${latest.taskID}
      AND lineage.kind = 'dispatch_lineage'
      AND json_extract(lineage.payload, '$.tool_name') = 'dispatch_agent'
      AND json_extract(lineage.payload, '$.execution_epoch') = ${latest.payload.execution_epoch}
      AND json_extract(lineage.payload, '$.orchestrator_session_id') = ${latest.payload.orchestrator_session_id}
      AND json_extract(lineage.payload, '$.orchestrator_message_id') = ${latest.payload.orchestrator_message_id}
      AND json_extract(lineage.payload, '$.tool_part_id') = requested.tool_part_id
      AND json_extract(lineage.payload, '$.tool_call_id') = requested.tool_call_id
    ORDER BY requested.ordinal
    LIMIT ${requests.length + 1}
  `
}

function directGroupLineages(db: Database.TxOrDb, latest: ReturnType<typeof dispatchLineageRow>) {
  const requests = directGroupRequests(db, latest)
  if (requests.length === 0) {
    throw new Error(`Latest direct dispatch ${latest.dispatchID} has no assistant decision-set Tool request`)
  }
  const identities = db.all<{ ordinal: number; id: string }>(directGroupLineageIDQuery(latest, requests))
  const ids = identities.map((identity) => identity.id)
  if (ids.length !== new Set(ids).size || identities.length > requests.length) {
    throw new Error(`Latest direct dispatch decision set for Message ${latest.payload.orchestrator_message_id} is ambiguous`)
  }
  const rows = ids.length === 0
    ? []
    : db
        .select()
        .from(EngineArtifactTable)
        .where(inArray(EngineArtifactTable.id, ids))
        .all()
        .map(dispatchLineageRow)
  const byID = new Map(rows.map((lineage) => [lineage.artifactID, lineage]))
  return identities.flatMap((identity) => {
    const lineage = byID.get(identity.id)
    return lineage ? [lineage] : []
  })
}

export function latestTaskDispatchGroupFinalMessageIDs(taskID: string): string[] {
  return Database.use((db) => {
    const latestRow = db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "dispatch_lineage")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .limit(1)
      .get()
    if (!latestRow) return []

    const latest = dispatchLineageRow(latestRow)
    const lineages =
      latest.payload.tool_name === "dispatch_agents"
        ? collectionGroupLineageQuery(db, latest)
            .all()
            .map(dispatchLineageRow)
            .toSorted(
              (left, right) =>
                (left.payload.collection_member_index ?? -1) - (right.payload.collection_member_index ?? -1),
            )
        : directGroupLineages(db, latest)
    if (latest.payload.tool_name === "dispatch_agents" && lineages.length > MAX_DISPATCH_COLLECTION_SIZE) {
      throw new Error(
        `Latest Task dispatch group ${latest.payload.tool_part_id}/${latest.payload.tool_call_id} exceeds ${MAX_DISPATCH_COLLECTION_SIZE} members`,
      )
    }
    const settlementRows = db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          or(
            ...lineages.map(
              (lineage) => sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${lineage.dispatchID}`,
            ),
          ),
        ),
      )
      .limit(lineages.length + 1)
      .all()
    const settlementByDispatchID = new Map(
      settlementRows.map((row) => {
        const payload = parseDispatchSettlementPayload(row.payload, row.id)
        return [payload.dispatch_id, payload] as const
      }),
    )
    if (settlementRows.length !== settlementByDispatchID.size || settlementRows.length > lineages.length) {
      throw new Error(`Latest Task dispatch group ${latest.payload.tool_part_id}/${latest.payload.tool_call_id} has ambiguous settlements`)
    }
    const seen = new Set<string>()
    return lineages.flatMap((lineage) => {
      const outcome = settlementByDispatchID.get(lineage.dispatchID)?.outcome
      const messageID = outcome && "final_message_id" in outcome ? outcome.final_message_id : undefined
      if (typeof messageID !== "string" || seen.has(messageID)) return []
      seen.add(messageID)
      return [messageID]
    })
  })
}

export const DispatchSettlementTestHooks = Object.freeze({
  collectionGroupQueryPlan(db: Database.TxOrDb, latestArtifactID: string): string[] {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, latestArtifactID),
          eq(EngineArtifactTable.kind, "dispatch_lineage"),
        ),
      )
      .get()
    if (!row) throw new Error(`Dispatch lineage ${latestArtifactID} does not exist`)
    const latest = dispatchLineageRow(row)
    if (latest.payload.tool_name !== "dispatch_agents") {
      throw new Error(`Dispatch lineage ${latestArtifactID} is not a collection member`)
    }
    return db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      SELECT ${EngineArtifactTable.id}
      FROM ${EngineArtifactTable}
      WHERE ${collectionGroupLineagePredicate(latest)}
      LIMIT ${MAX_DISPATCH_COLLECTION_SIZE + 1}
    `).map((entry) => entry.detail)
  },
  directGroupQueryPlans(
    db: Database.TxOrDb,
    latestArtifactID: string,
  ): { requests: string[]; lineages: string[] } {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, latestArtifactID), eq(EngineArtifactTable.kind, "dispatch_lineage")))
      .get()
    if (!row) throw new Error(`Dispatch lineage ${latestArtifactID} does not exist`)
    const latest = dispatchLineageRow(row)
    if (latest.payload.tool_name !== "dispatch_agent") {
      throw new Error(`Dispatch lineage ${latestArtifactID} is not a direct dispatch`)
    }
    const requests = directGroupRequests(db, latest)
    if (requests.length === 0) throw new Error(`Direct dispatch ${latestArtifactID} has no Tool requests`)
    const requestPlan = db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      SELECT ${ToolPartRequestTable.id}
      FROM ${ToolPartRequestTable}
      WHERE ${ToolPartRequestTable.message_id} = ${latest.payload.orchestrator_message_id}
        AND json_extract(${ToolPartRequestTable.data}, '$.tool') = 'dispatch_agent'
      ORDER BY ${ToolPartRequestTable.time_created}, ${ToolPartRequestTable.id}
    `)
    return {
      requests: requestPlan.map((entry) => entry.detail),
      lineages: db
        .all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${directGroupLineageIDQuery(latest, requests)}`)
        .map((entry) => entry.detail),
    }
  },
})

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
  const payload = parseDispatchSettlementPayload(
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
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "dispatch_settlement"),
          sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
        ),
      )
      .get()
    if (row) {
      const existing = parseDispatchSettlementPayload(row.payload, row.id)
      if (!isDeepStrictEqual(existing.outcome, payload.outcome)) {
        throw new Error(`Dispatch ${input.dispatchID} durable settlement outcome drift`)
      }
      return { artifactID: row.id, payload: existing }
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
