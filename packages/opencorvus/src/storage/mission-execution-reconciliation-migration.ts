import { Database as SQLite, type Database as BunDatabase } from "bun:sqlite"
import { TaskCancellationReason, TaskCancellationRequestSurface } from "@opencorvus-ai/transport-protocol"
import { Identifier } from "@/id/id"
import { canonicalDigestSource } from "@/util/canonical-digest"
import { MissionExecutionCloseSource, MissionExecutionOpenSource } from "@/mission/execution-closure-schema"
import {
  MissionProcessRecoveryWakeReason,
  missionProcessRecoveryFrontierDigest,
} from "@/session/mission-process-recovery-schema"
import { ProcessExecutionInterruptedError } from "@/session/process-execution-interrupted-error"
import { SchedulerMessageWakeReason } from "@/protocol/scheduler-message-wake-reason"
import { SCHEMA_DDL } from "./ddl"
import { canonicalSchemaObjectSQL } from "./schema-contract"
import z from "zod"

const CLOSURE_EVENT_TYPES = ["mission.execution.closing", "mission.execution.closed"] as const
const ALL_CLOSURE_EVENT_TYPES = ["mission.execution.opened", ...CLOSURE_EVENT_TYPES] as const
const LEGACY_RECOVERY_KIND = "mission_process_recovery"
const MISSION_DELETE_RETENTION_INDEX = "protocol_event_mission_delete_retention_idx"

function migrateMissionDeleteRetentionSchema(db: BunDatabase): number {
  const existing = rows<{ name: string }>(
    db,
    `SELECT name FROM sqlite_schema WHERE type='index' AND name=${quoteLiteral(MISSION_DELETE_RETENTION_INDEX)}`,
  )[0]
  if (existing) return 0
  db.exec(canonicalSchemaObjectSQL("index", MISSION_DELETE_RETENTION_INDEX))
  return 1
}

const LegacyMissionWakeClosedReceipt = z
  .object({
    kind: z.literal("mission_wake_closed"),
    message_id: Identifier.schema("message"),
    closure_event_id: Identifier.schema("protocol_event"),
  })
  .strict()

const CloseProvenance = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("request"),
      surface: TaskCancellationRequestSurface,
      reason: TaskCancellationReason,
    })
    .strict(),
  z
    .object({
      kind: z.literal("historical_reconciliation"),
      sourceEventID: Identifier.schema("protocol_event"),
    })
    .strict(),
])

const OpenedPayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  })
  .strict()

const TerminalPayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    provenance: CloseProvenance.optional(),
  })
  .strict()

const RecoveryMarker = z
  .object({
    version: z.literal(1),
    occurrenceID: Identifier.schema("session_control"),
    attempt: z.number().int().positive(),
    interruptedAssistantMessageIDs: z.array(Identifier.schema("message")).min(1),
    wakeMessageID: Identifier.schema("message"),
    wakeTextPartID: Identifier.schema("part"),
    wakeControlID: Identifier.schema("session_control"),
    interruptedAt: z.number().int().positive(),
  })
  .strict()

const CurrentOperatorWakeReason = z
  .object({
    source: z.literal("mission.operator"),
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    openedEventID: Identifier.schema("protocol_event"),
  })
  .strict()

type ClosureEventRow = {
  id: string
  type: string
  aggregate_type: string
  aggregate_id: string
  session_id: string | null
  source: string
  correlation_id: string | null
  seq: number
  emitted_at: number
  payload: string | Record<string, unknown> | null
}

type RecoveryControlRow = {
  id: string
  session_id: string
  source: string | null
  payload: string | Record<string, unknown>
  time_created: number
}

type ControlEventRow = {
  id: string
  kind: string
  payload: string | Record<string, unknown> | null
  time_created: number
}

type MessageRow = {
  id: string
  session_id: string
  time_created: number
  data: string | Record<string, unknown>
}

type PartRow = {
  id: string
  message_id: string
  time_created: number
  data: string | Record<string, unknown>
}

function rows<T>(db: BunDatabase, statement: string, ...parameters: unknown[]): T[] {
  const query = db.query<T, []>(statement)
  try {
    return query.all(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function run(db: BunDatabase, statement: string, ...parameters: unknown[]): void {
  const query = db.query(statement)
  try {
    query.run(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function tableColumns(db: BunDatabase, table: string): string[] {
  return rows<{ name: string }>(db, `PRAGMA table_info(${quoteIdentifier(table)})`).map((row) => row.name)
}

function tableExists(db: BunDatabase, table: string): boolean {
  return Boolean(
    rows<{ name: string }>(
      db,
      `SELECT name FROM sqlite_schema WHERE type='table' AND name=${quoteLiteral(table)}`,
    )[0],
  )
}

function createReferenceSchema(): BunDatabase {
  const reference = new SQLite(":memory:")
  reference.exec(SCHEMA_DDL)
  return reference
}

function rebuildTableFromCurrentSchema(db: BunDatabase, reference: BunDatabase, table: string): void {
  const legacy = `__mission_reconciliation_old_${table}`
  if (tableExists(db, legacy)) throw new Error(`Mission reconciliation migration found stale table ${legacy}`)
  for (const schemaObject of rows<{ type: string; name: string }>(
    db,
    `SELECT type,name FROM sqlite_schema
     WHERE tbl_name=${quoteLiteral(table)} AND type IN ('index','trigger') AND sql IS NOT NULL`,
  )) {
    db.exec(`DROP ${schemaObject.type.toUpperCase()} ${quoteIdentifier(schemaObject.name)}`)
  }
  db.exec(`ALTER TABLE ${quoteIdentifier(table)} RENAME TO ${quoteIdentifier(legacy)}`)
  const definition = rows<{ sql: string }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='table' AND name=${quoteLiteral(table)}`,
  )[0]?.sql
  if (!definition) throw new Error(`Current schema has no table ${table}`)
  db.exec(definition)
  for (const index of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='index' AND tbl_name=${quoteLiteral(table)} ORDER BY name`,
  )) {
    if (index.sql) db.exec(index.sql)
  }
  const legacyColumns = new Set(tableColumns(db, legacy))
  const copied = tableColumns(db, table).filter((column) => legacyColumns.has(column))
  const projection = copied.map(quoteIdentifier).join(",")
  db.exec(
    `INSERT INTO ${quoteIdentifier(table)} (rowid,${projection}) ` +
      `SELECT rowid,${projection} FROM ${quoteIdentifier(legacy)} ORDER BY rowid`,
  )
  db.exec(`DROP TABLE ${quoteIdentifier(legacy)}`)
}

function restoreCurrentTableTriggers(db: BunDatabase, reference: BunDatabase, table: string): void {
  for (const trigger of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=${quoteLiteral(table)} ORDER BY name`,
  )) {
    if (trigger.sql) db.exec(trigger.sql)
  }
}

function migrateSchedulerMissionDispositionSchema(db: BunDatabase): number {
  const required: Record<string, string[]> = {
    automation_run: ["mission_opened_event_id", "mission_disposition", "mission_closure_event_id"],
    automation_run_receipt: ["disposition", "closure_event_id"],
    event_job_fire: ["mission_opened_event_id", "mission_disposition", "mission_closure_event_id"],
    event_job_fire_receipt: ["closure_event_id"],
  }
  const stale = Object.entries(required)
    .filter(([table]) => tableExists(db, table))
    .filter(([table, columns]) => columns.some((column) => !tableColumns(db, table).includes(column)))
    .map(([table]) => table)
  if (stale.length === 0) return 0
  if (stale.includes("automation_run") && !tableColumns(db, "automation_run").includes("mission_opened_event_id")) {
    const unresolved = rows<{ id: string }>(
      db,
      `SELECT run.id
       FROM automation_run AS run
       JOIN automation AS definition ON definition.id=run.automation_revision_id
       JOIN session AS target ON target.id=definition.session_id
       WHERE target.kind='mission'
       ORDER BY run.id LIMIT 1`,
    )[0]
    if (unresolved) {
      throw new Error(
        `Legacy automation Mission run ${unresolved.id} has no durable opened occurrence pointer; migration cannot infer causality from timestamps`,
      )
    }
  }
  if (stale.includes("event_job_fire") && !tableColumns(db, "event_job_fire").includes("mission_opened_event_id")) {
    const unresolved = rows<{ id: string }>(
      db,
      `SELECT fire.id
       FROM event_job_fire AS fire
       JOIN event_job AS definition ON definition.id=fire.event_job_revision_id
       JOIN session AS target ON target.id=definition.session_id
       WHERE target.kind='mission'
       ORDER BY fire.id LIMIT 1`,
    )[0]
    if (unresolved) {
      throw new Error(
        `Legacy Event Mission fire ${unresolved.id} has no durable opened occurrence pointer; migration cannot infer causality from timestamps`,
      )
    }
  }
  const reference = createReferenceSchema()
  try {
    const order = ["automation_run_receipt", "event_job_fire_receipt", "automation_run", "event_job_fire"]
    for (const table of order) if (stale.includes(table)) rebuildTableFromCurrentSchema(db, reference, table)

    for (const table of order) if (stale.includes(table)) restoreCurrentTableTriggers(db, reference, table)
    return stale.length
  } finally {
    reference.close(true)
  }
}

function migrateHistoricalMissionWakeClosureReceipts(db: BunDatabase): number {
  if (!tableExists(db, "protocol_delivery_receipt")) return 0
  const legacyReceipts = rows<{
    id: string
    inbox_id: string
    receipt: string | Record<string, unknown>
    time_created: number
  }>(
    db,
    `SELECT id,inbox_id,receipt,time_created
     FROM protocol_delivery_receipt
     WHERE json_extract(receipt,'$.kind')='mission_wake_closed'
     ORDER BY time_created,id`,
  )
  if (legacyReceipts.length === 0) return 0
  const updateTrigger = rows<{ sql: string | null }>(
    db,
    `SELECT sql FROM sqlite_schema
     WHERE type='trigger' AND name='protocol_delivery_receipt_no_update'`,
  )[0]
  if (!updateTrigger?.sql) {
    throw new Error("Mission wake closure migration requires the immutable receipt update trigger")
  }
  db.exec("DROP TRIGGER protocol_delivery_receipt_no_update")
  for (const row of legacyReceipts) {
    const legacy = LegacyMissionWakeClosedReceipt.parse(
      parseObject(row.receipt, `Legacy Mission wake closure receipt ${row.id}`),
    )
    const inbox = rows<{
      id: string
      actor: string
      actor_id: string
      envelope_id: string
      event_type: string
      event_aggregate_type: string
      event_aggregate_id: string
      event_seq: number
    }>(
      db,
      `SELECT inbox.id,inbox.actor,inbox.actor_id,inbox.envelope_id,
              event.type AS event_type,event.aggregate_type AS event_aggregate_type,
              event.aggregate_id AS event_aggregate_id,event.seq AS event_seq
       FROM protocol_inbox AS inbox
       JOIN protocol_event AS event ON event.id=inbox.envelope_id
       WHERE inbox.id=?`,
      row.inbox_id,
    )[0]
    if (
      !inbox ||
      inbox.actor !== "session" ||
      inbox.event_type !== "scheduler.message" ||
      inbox.event_aggregate_type !== "session" ||
      inbox.event_aggregate_id !== inbox.actor_id
    ) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} has no exact scheduler Session inbox`)
    }
    const opened = rows<{ id: string; type: string; seq: number }>(
      db,
      `SELECT id,type,seq
       FROM protocol_event
       WHERE aggregate_type='session' AND aggregate_id=?
         AND type IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed')
         AND seq < ?
       ORDER BY seq DESC,id DESC LIMIT 1`,
      inbox.actor_id,
      inbox.event_seq,
    )[0]
    if (!opened || opened.type !== "mission.execution.opened") {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} has no exact enqueue-time opened occurrence`)
    }
    const closure = rows<ClosureEventRow>(
      db,
      `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
       FROM protocol_event WHERE id=?`,
      legacy.closure_event_id,
    )[0]
    if (
      !closure ||
      !CLOSURE_EVENT_TYPES.includes(closure.type as (typeof CLOSURE_EVENT_TYPES)[number]) ||
      closure.aggregate_type !== "session" ||
      closure.aggregate_id !== inbox.actor_id ||
      closure.seq <= inbox.event_seq
    ) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} has no exact closure event`)
    }
    const closing = closure.type === "mission.execution.closing"
      ? closure
      : rows<ClosureEventRow>(
          db,
          `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
           FROM protocol_event
           WHERE aggregate_type='session' AND aggregate_id=? AND type='mission.execution.closing'
             AND correlation_id=? AND seq < ?
           ORDER BY seq DESC,id DESC LIMIT 1`,
          inbox.actor_id,
          closure.correlation_id,
          closure.seq,
        )[0]
    if (!closing) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} has no exact closing authority`)
    }
    const firstBoundary = rows<{ id: string; type: string }>(
      db,
      `SELECT id,type
       FROM protocol_event
       WHERE aggregate_type='session' AND aggregate_id=?
         AND type IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed')
         AND seq > ?
       ORDER BY seq,id LIMIT 1`,
      inbox.actor_id,
      opened.seq,
    )[0]
    if (firstBoundary?.id !== closing.id || firstBoundary.type !== "mission.execution.closing") {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} crosses its opened occurrence boundary`)
    }
    const terminalReceiptCount = rows<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count
       FROM protocol_delivery_receipt
       WHERE inbox_id=? AND json_extract(receipt,'$.kind') <> 'retry_wait'`,
      row.inbox_id,
    )[0]?.count
    if (terminalReceiptCount !== 1) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} is not the unique terminal delivery fact`)
    }
    const message = rows<{ id: string; session_id: string; data: string | Record<string, unknown> }>(
      db,
      "SELECT id,session_id,data FROM message WHERE id=? AND session_id=?",
      legacy.message_id,
      inbox.actor_id,
    )[0]
    const messageData = message
      ? parseObject(message.data, `Legacy Mission wake Message ${legacy.message_id}`)
      : undefined
    const reason = messageData
      ? SchedulerMessageWakeReason.safeParse(
          (parseObject(messageData.extra as string | Record<string, unknown> | null, `Legacy Mission wake Message ${legacy.message_id} extra`)).wake_reason,
        )
      : undefined
    if (
      !message ||
      messageData?.role !== "user" ||
      !reason?.success ||
      reason.data.eventID !== inbox.envelope_id ||
      reason.data.inboxID !== inbox.id
    ) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} has no exact wake Message lineage`)
    }
    const terminalReply = rows<{ id: string }>(
      db,
      `SELECT id FROM message
       WHERE session_id=?
         AND json_extract(data,'$.role')='assistant'
         AND json_extract(data,'$.parentID')=?
         AND json_extract(data,'$.time.completed') IS NOT NULL
       ORDER BY time_created,id LIMIT 1`,
      inbox.actor_id,
      legacy.message_id,
    )[0]
    if (!terminalReply) {
      throw new Error(
        `Legacy Mission wake closure receipt ${row.id} has no terminal assistant reply`,
      )
    }
    const canonical = { kind: "session_wake", message_id: legacy.message_id }
    run(
      db,
      "UPDATE protocol_delivery_receipt SET receipt=? WHERE id=? AND inbox_id=?",
      JSON.stringify(canonical),
      row.id,
      row.inbox_id,
    )
    const migrated = rows<{ receipt: string | Record<string, unknown> }>(
      db,
      "SELECT receipt FROM protocol_delivery_receipt WHERE id=? AND inbox_id=?",
      row.id,
      row.inbox_id,
    )[0]
    const parsed = parseObject(migrated?.receipt ?? null, `Migrated Mission wake receipt ${row.id}`)
    if (parsed.kind !== "session_wake" || parsed.message_id !== legacy.message_id || Object.keys(parsed).length !== 2) {
      throw new Error(`Legacy Mission wake closure receipt ${row.id} did not normalize exactly`)
    }
  }
  db.exec(updateTrigger.sql)
  return legacyReceipts.length
}

function parseObject(value: string | Record<string, unknown> | null, subject: string): Record<string, unknown> {
  let parsed: unknown = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch (error) {
      throw new Error(`${subject} is not valid JSON`, { cause: error })
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${subject} is not a JSON object`)
  }
  return parsed as Record<string, unknown>
}

function assertClosureIdentity(row: ClosureEventRow): void {
  if (
    !ALL_CLOSURE_EVENT_TYPES.includes(row.type as (typeof ALL_CLOSURE_EVENT_TYPES)[number]) ||
    row.aggregate_type !== "session" ||
    !row.aggregate_id ||
    row.session_id !== null ||
    !row.correlation_id
  ) {
    throw new Error(`Mission execution closure event ${row.id} has conflicting persisted identity`)
  }
  z.string().uuid().parse(row.correlation_id)
  if (row.type === "mission.execution.opened") MissionExecutionOpenSource.parse(row.source)
  else MissionExecutionCloseSource.parse(row.source)
}

function assertClosureSequenceGrammar(closureEvents: ClosureEventRow[]): void {
  let priorSessionID: string | undefined
  let prior:
    | { state: "opened"; missionID: string }
    | {
        state: "closing"
        missionID: string
      requestID: string
      source: string
      operationID: string
      provenance: z.infer<typeof CloseProvenance>
      }
    | { state: "closed"; missionID: string }
    | undefined
  let priorSequence = -1
  for (const row of closureEvents) {
    if (row.aggregate_id !== priorSessionID) {
      priorSessionID = row.aggregate_id
      prior = undefined
      priorSequence = -1
    }
    if (row.seq <= priorSequence) {
      throw new Error(`Mission execution closure event ${row.id} does not advance the aggregate sequence`)
    }
    priorSequence = row.seq
    const payload = parseObject(row.payload, `Mission execution closure event ${row.id} payload`)
    if (row.type === "mission.execution.opened") {
      const opened = OpenedPayload.parse(payload)
      if (prior && prior.state !== "closed") {
        throw new Error(`Mission execution opened event ${row.id} follows ${prior.state} without a closed boundary`)
      }
      if (prior?.state === "closed" && prior.missionID !== opened.missionID) {
        throw new Error(`Mission execution opened event ${row.id} changes Mission identity for one Session`)
      }
      prior = { state: "opened", missionID: opened.missionID }
      continue
    }
    const terminal = TerminalPayload.parse(payload)
    if (row.type === "mission.execution.closing") {
      if (prior && prior.state !== "opened") {
        throw new Error(`Mission execution closing event ${row.id} follows ${prior.state} without an opened occurrence`)
      }
      if (prior?.state === "opened" && prior.missionID !== terminal.missionID) {
        throw new Error(`Mission execution closing event ${row.id} changes Mission identity within one occurrence`)
      }
      prior = {
        state: "closing",
        missionID: terminal.missionID,
        requestID: terminal.requestID,
        source: row.source,
        operationID: row.correlation_id!,
        provenance:
          terminal.provenance ??
          (() => {
            throw new Error(`Mission execution closing event ${row.id} has no close provenance`)
          })(),
      }
      continue
    }
    if (
      prior?.state !== "closing" ||
      prior.missionID !== terminal.missionID ||
      prior.requestID !== terminal.requestID ||
      prior.source !== row.source ||
      prior.operationID !== row.correlation_id ||
      !terminal.provenance ||
      JSON.stringify(prior.provenance) !== JSON.stringify(terminal.provenance)
    ) {
      throw new Error(`Mission execution closed event ${row.id} has no exact preceding closing operation`)
    }
    prior = { state: "closed", missionID: terminal.missionID }
  }
}

function migrateClosurePayloads(db: BunDatabase): number {
  const closureEvents = rows<ClosureEventRow>(
    db,
    `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
     FROM protocol_event
     WHERE type IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed')
     ORDER BY aggregate_id,seq,id`,
  )
  const rewrites: Array<{ id: string; payload: Record<string, unknown> }> = []
  const historicalCloseSources = new Map<string, string>()
  for (const row of closureEvents) {
    assertClosureIdentity(row)
    const parsed = parseObject(row.payload, `Mission execution closure event ${row.id} payload`)
    if (row.type === "mission.execution.opened") {
      const payload = OpenedPayload.parse(parsed)
      if (payload.requestFingerprint) continue
      rewrites.push({
        id: row.id,
        payload: {
          missionID: payload.missionID,
          requestID: payload.requestID,
          requestFingerprint: canonicalDigestSource("mission-operator-accepted-input-legacy-event-v1", {
            eventID: row.id,
            sessionID: row.aggregate_id,
            source: row.source,
            missionID: payload.missionID,
            requestID: payload.requestID,
            operationID: row.correlation_id,
          }).sha256,
        },
      })
      continue
    }
    const payload = TerminalPayload.parse(parsed)
    const operationKey = `${row.aggregate_id}\0${row.correlation_id}`
    if (row.type === "mission.execution.closing") {
      if (
        payload.provenance?.kind === "historical_reconciliation" &&
        payload.provenance.sourceEventID !== row.id
      ) {
        throw new Error(`Mission execution closing event ${row.id} has conflicting historical provenance identity`)
      }
      if (payload.provenance?.kind === "historical_reconciliation" || !payload.provenance) {
        historicalCloseSources.set(operationKey, row.id)
      }
    }
    const historicalSourceEventID = historicalCloseSources.get(operationKey)
    if (payload.provenance?.kind === "historical_reconciliation") {
      if (payload.provenance.sourceEventID !== (historicalSourceEventID ?? row.id)) {
        throw new Error(`Mission execution closure event ${row.id} has conflicting historical provenance identity`)
      }
      continue
    }
    if (payload.provenance) continue
    rewrites.push({
      id: row.id,
      payload: {
        missionID: payload.missionID,
        requestID: payload.requestID,
        provenance: { kind: "historical_reconciliation", sourceEventID: historicalSourceEventID ?? row.id },
      },
    })
  }
  if (rewrites.length > 0) {
    const immutableTrigger = rows<{ sql: string | null }>(
      db,
      "SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='protocol_event_no_update'",
    )[0]?.sql
    if (!immutableTrigger) {
      throw new Error("Mission execution closure migration requires the exact protocol_event_no_update trigger")
    }
    db.exec("DROP TRIGGER protocol_event_no_update")
    for (const rewrite of rewrites) {
      run(db, "UPDATE protocol_event SET payload=? WHERE id=?", JSON.stringify(rewrite.payload), rewrite.id)
    }
    db.exec(immutableTrigger)
  }
  assertClosureSequenceGrammar(
    rows<ClosureEventRow>(
      db,
      `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
       FROM protocol_event
       WHERE type IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed')
       ORDER BY aggregate_id,seq,id`,
    ),
  )
  return rewrites.length
}

function effectiveRecoveryMarker(db: BunDatabase, row: RecoveryControlRow) {
  if (row.source !== "mission.process-recovery") {
    throw new Error(`Mission process-recovery control ${row.id} has conflicting source identity`)
  }
  const events = rows<ControlEventRow>(
    db,
    `SELECT id,kind,payload,time_created FROM session_control_event
     WHERE control_id=? ORDER BY time_created,id`,
    row.id,
  )
  let payload = parseObject(row.payload, `Mission process-recovery control ${row.id} payload`)
  let terminal: "consumed" | "failed" | undefined
  for (const event of events) {
    if (terminal) {
      throw new Error(`Mission process-recovery control ${row.id} has an event after its terminal receipt`)
    }
    if (event.kind === "amended") {
      payload = parseObject(event.payload, `Mission process-recovery amendment ${event.id} payload`)
      continue
    }
    if (event.kind === "consumed" || event.kind === "failed") {
      if (terminal) throw new Error(`Mission process-recovery control ${row.id} has multiple terminal receipts`)
      terminal = event.kind
      continue
    }
    throw new Error(`Mission process-recovery control ${row.id} has unknown event kind ${event.kind}`)
  }
  const marker = RecoveryMarker.parse(payload)
  if (marker.occurrenceID !== row.id) {
    throw new Error(`Mission process-recovery control ${row.id} has conflicting occurrence identity`)
  }
  for (const interruptedMessageID of marker.interruptedAssistantMessageIDs) {
    const interrupted = rows<MessageRow>(
      db,
      "SELECT id,session_id,time_created,data FROM message WHERE id=?",
      interruptedMessageID,
    )[0]
    if (!interrupted || interrupted.session_id !== row.session_id) {
      throw new Error(
        `Mission process-recovery control ${row.id} has conflicting interrupted assistant ${interruptedMessageID}`,
      )
    }
    const data = parseObject(interrupted.data, `Mission recovery interrupted assistant ${interruptedMessageID} data`)
    if (data.role !== "assistant") {
      throw new Error(
        `Mission process-recovery control ${row.id} interrupted Message ${interruptedMessageID} is not an assistant`,
      )
    }
  }
  return { marker, terminal }
}

function exactProcessInterruptedError(input: {
  error: unknown
  sessionID: string
  messageID: string
}): z.infer<typeof ProcessExecutionInterruptedError.Schema> | undefined {
  const current = ProcessExecutionInterruptedError.Schema.safeParse(input.error)
  if (current.success) return current.data
  const expectedMessage =
    `ProcessExecutionInterruptedError: Previous process ended before Session ${input.sessionID} ` +
    `completed assistant message ${input.messageID}`
  const legacy = z
    .object({
      name: z.literal("UnknownError"),
      data: z.object({ message: z.literal(expectedMessage) }).strict(),
    })
    .strict()
    .safeParse(input.error)
  if (!legacy.success) return undefined
  return ProcessExecutionInterruptedError.Schema.parse({
    name: "ProcessExecutionInterruptedError",
    data: {
      message: `Previous process ended before Session ${input.sessionID} completed assistant message ${input.messageID}`,
    },
  })
}

function migrateExactHistoricalInterruptedAssistant(
  db: BunDatabase,
  sessionID: string,
  messageID: string,
): boolean {
  const row = rows<MessageRow>(db, "SELECT id,session_id,time_created,data FROM message WHERE id=?", messageID)[0]
  if (!row || row.session_id !== sessionID) {
    throw new Error(`Mission recovery interrupted assistant ${messageID} has conflicting Session identity`)
  }
  const data = parseObject(row.data, `Mission recovery interrupted assistant ${messageID} data`)
  const time = parseObject(
    data.time as string | Record<string, unknown> | null,
    `Mission recovery interrupted assistant ${messageID} time`,
  )
  if (data.role !== "assistant" || data.finish !== "error" || typeof time.completed !== "number") return false
  const typed = exactProcessInterruptedError({ error: data.error, sessionID, messageID })
  if (!typed) return false
  if (JSON.stringify(data.error) !== JSON.stringify(typed)) {
    run(db, "UPDATE message SET data=? WHERE id=?", JSON.stringify({ ...data, error: typed }), messageID)
  }
  return true
}

function exactMessage(db: BunDatabase, sessionID: string, messageID: string): MessageRow | undefined {
  const found = rows<MessageRow>(db, "SELECT id,session_id,time_created,data FROM message WHERE id=?", messageID)[0]
  if (!found) return undefined
  if (found.session_id !== sessionID) {
    throw new Error(`Mission recovery Message ${messageID} belongs to Session ${found.session_id}, not ${sessionID}`)
  }
  const data = parseObject(found.data, `Mission recovery Message ${messageID} data`)
  if (data.id !== undefined && data.id !== messageID) {
    throw new Error(`Mission recovery Message ${messageID} has conflicting embedded identity`)
  }
  if (data.sessionID !== undefined && data.sessionID !== sessionID) {
    throw new Error(`Mission recovery Message ${messageID} has conflicting embedded Session identity`)
  }
  if (data.role !== "user") {
    throw new Error(`Mission recovery Message ${messageID} is not a user wake Message`)
  }
  const time = data.time
  if (
    !time ||
    typeof time !== "object" ||
    Array.isArray(time) ||
    (time as Record<string, unknown>).created !== found.time_created ||
    data.author !== "OpenCorvus runtime recovery" ||
    data.agent !== "mission" ||
    !data.model ||
    typeof data.model !== "object" ||
    Array.isArray(data.model) ||
    typeof (data.model as Record<string, unknown>).providerID !== "string" ||
    typeof (data.model as Record<string, unknown>).modelID !== "string"
  ) {
    throw new Error(`Mission recovery Message ${messageID} has an invalid persisted user Message shape`)
  }
  return found
}

function exactTextPart(db: BunDatabase, sessionID: string, marker: z.infer<typeof RecoveryMarker>): PartRow | undefined {
  const found = rows<PartRow>(
    db,
    "SELECT id,message_id,time_created,data FROM part WHERE id=?",
    marker.wakeTextPartID,
  )[0]
  if (!found) return undefined
  if (found.message_id !== marker.wakeMessageID) {
    throw new Error(`Mission recovery text Part ${found.id} does not belong to Message ${marker.wakeMessageID}`)
  }
  const data = parseObject(found.data, `Mission recovery text Part ${found.id} data`)
  if (
    (data.id !== undefined && data.id !== found.id) ||
    (data.messageID !== undefined && data.messageID !== marker.wakeMessageID) ||
    (data.sessionID !== undefined && data.sessionID !== sessionID) ||
    data.type !== "text" ||
    data.text !== historicalRecoveryPrompt(marker)
  ) {
    throw new Error(`Mission recovery text Part ${found.id} has conflicting persisted identity`)
  }
  return found
}

function exactWakeControl(
  db: BunDatabase,
  sessionID: string,
  input: {
    record: RecoveryControlRow
    marker: z.infer<typeof RecoveryMarker>
    opened: ReturnType<typeof exactOpenedOccurrence>
  },
): boolean {
  const { record, marker, opened } = input
  const found = rows<{
    id: string
    session_id: string
    kind: string
    source: string | null
    payload: string | Record<string, unknown>
  }>(
    db,
    "SELECT id,session_id,kind,source,payload FROM session_control_record WHERE id=?",
    marker.wakeControlID,
  )[0]
  if (!found) return false
  if (
    found.session_id !== sessionID ||
    found.kind !== "wake_reason" ||
    found.source !== "mission.process_recovery"
  ) {
    throw new Error(`Mission recovery wake control ${marker.wakeControlID} has conflicting persisted identity`)
  }
  const payload = parseObject(found.payload, `Mission recovery wake control ${marker.wakeControlID} payload`)
  if (
    Object.keys(payload).toSorted().join(",") !== "messageID,wake_reason" ||
    payload.messageID !== marker.wakeMessageID
  ) {
    throw new Error(
      `Mission recovery wake control ${marker.wakeControlID} does not own Message ${marker.wakeMessageID}`,
    )
  }
  const reason = parseObject(
    (payload as { wake_reason?: string | Record<string, unknown> }).wake_reason ?? null,
    `Mission recovery wake control ${marker.wakeControlID} reason`,
  )
  const sharedIdentity =
    reason.source === "mission.process_recovery" &&
    reason.missionID === opened.missionID &&
    reason.occurrenceID === marker.occurrenceID &&
    JSON.stringify(reason.interruptedAssistantMessageIDs) === JSON.stringify(marker.interruptedAssistantMessageIDs)
  const legacyIdentity =
    Object.keys(reason).toSorted().join(",") ===
    "interruptedAssistantMessageIDs,missionID,occurrenceID,source"
  const migratedV2Identity =
    Object.keys(reason).toSorted().join(",") ===
      "interruptedAssistantMessageIDs,missionID,occurrenceID,openedEventID,ownerGeneration,source,version" &&
    reason.version === 2 &&
    reason.openedEventID === opened.eventID &&
    Identifier.schema("call").safeParse(reason.ownerGeneration).success
  const migratedV3 = MissionProcessRecoveryWakeReason.safeParse(reason)
  const migratedV3Identity =
    migratedV3.success &&
    migratedV3.data.openedEventID === opened.eventID &&
    migratedV3.data.occurrenceID === marker.occurrenceID &&
    JSON.stringify(migratedV3.data.interruptedAssistantMessageIDs) ===
      JSON.stringify([...new Set(marker.interruptedAssistantMessageIDs)].toSorted())
  if (!sharedIdentity || (!legacyIdentity && !migratedV2Identity && !migratedV3Identity)) {
    throw new Error(`Mission recovery wake control ${marker.wakeControlID} has conflicting wake identity`)
  }
  const events = rows<ControlEventRow>(
    db,
    "SELECT id,kind,payload,time_created FROM session_control_event WHERE control_id=? ORDER BY time_created,id",
    marker.wakeControlID,
  )
  if (events.length !== 1 || events[0]?.kind !== "consumed" || events[0].payload !== null) {
    throw new Error(`Mission recovery wake control ${marker.wakeControlID} has no exact consumed receipt`)
  }
  return true
}

function replyDisposition(db: BunDatabase, sessionID: string, wakeMessageID: string) {
  const messages = rows<MessageRow>(
    db,
    "SELECT id,session_id,time_created,data FROM message WHERE session_id=? ORDER BY id",
    sessionID,
  )
  let successfulReplyID: string | undefined
  let failedReplyID: string | undefined
  for (const message of messages) {
    const data = parseObject(message.data, `Mission recovery reply candidate ${message.id} data`)
    if (data.role !== "assistant" || data.parentID !== wakeMessageID) continue
    const time = data.time
    const persistedTime =
      time && typeof time === "object" && !Array.isArray(time) ? (time as Record<string, unknown>) : undefined
    if (
      (data.id !== undefined && data.id !== message.id) ||
      (data.sessionID !== undefined && data.sessionID !== sessionID) ||
      data.author !== "mission" ||
      data.agent !== "mission" ||
      typeof data.providerID !== "string" ||
      !data.providerID ||
      typeof data.modelID !== "string" ||
      !data.modelID ||
      persistedTime?.created !== message.time_created
    ) {
      throw new Error(`Mission recovery reply ${message.id} has conflicting persisted identity`)
    }
    const completed = persistedTime.completed
    if (typeof completed !== "number") continue
    const finish = data.finish
    if (
      typeof finish === "string" &&
      finish.length > 0 &&
      finish !== "error" &&
      finish !== "tool-calls" &&
      data.error === undefined &&
      data.summary !== true
    ) {
      if (successfulReplyID) {
        throw new Error(`Mission recovery wake ${wakeMessageID} has multiple successful replies`)
      }
      successfulReplyID = message.id
    } else if (finish === "error") {
      const error = z
        .object({ name: z.string().min(1), data: z.record(z.string(), z.unknown()) })
        .strict()
        .safeParse(data.error)
      if (!error.success) {
        const converted = exactProcessInterruptedError({ error: data.error, sessionID, messageID: message.id })
        if (!converted) throw new Error(`Mission recovery reply ${message.id} has no typed terminal error`)
        run(db, "UPDATE message SET data=? WHERE id=?", JSON.stringify({ ...data, error: converted }), message.id)
      }
      if (failedReplyID) throw new Error(`Mission recovery wake ${wakeMessageID} has multiple failed replies`)
      failedReplyID = message.id
    }
  }
  if (successfulReplyID && failedReplyID) {
    throw new Error(`Mission recovery wake ${wakeMessageID} has conflicting terminal replies`)
  }
  if (successfulReplyID) return { kind: "successful_reply" as const, replyMessageID: successfulReplyID }
  if (failedReplyID) return { kind: "failed_reply" as const, replyMessageID: failedReplyID }
  return undefined
}

function exactOpenedOccurrence(db: BunDatabase, sessionID: string, openedEventID?: string) {
  const events = rows<ClosureEventRow>(
    db,
    `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
     FROM protocol_event
     WHERE aggregate_type='session' AND aggregate_id=?
       AND type IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed')
     ORDER BY seq,id`,
    sessionID,
  )
  for (const event of events) assertClosureIdentity(event)
  const openedEvents = events.filter((event) => event.type === "mission.execution.opened")
  const opened = openedEventID
    ? openedEvents.find((event) => event.id === openedEventID)
    : openedEvents.length === 1
      ? openedEvents[0]
      : undefined
  if (!opened) {
    throw new Error(
      openedEventID
        ? `Mission occurrence references missing opened event ${openedEventID} for ${sessionID}`
        : `Mission occurrence has ${openedEvents.length} opened events and no exact causal pointer for ${sessionID}`,
    )
  }
  const payload = OpenedPayload.parse(
    parseObject(opened.payload, `Mission execution event ${opened.id} payload`),
  )
  return {
    eventID: opened.id,
    missionID: payload.missionID,
  }
}

function assertCurrentOperatorWakeBundle(
  db: BunDatabase,
  message: MessageRow,
  reason: z.infer<typeof CurrentOperatorWakeReason>,
  identity: { textPartID: string; controlID: string },
): void {
  const data = parseObject(message.data, `Current Mission operator Message ${message.id} data`)
  const time = data.time
  if (
    data.role !== "user" ||
    typeof data.author !== "string" ||
    data.author.length === 0 ||
    data.agent !== "mission" ||
    (data.id !== undefined && data.id !== message.id) ||
    (data.sessionID !== undefined && data.sessionID !== message.session_id) ||
    !time ||
    typeof time !== "object" ||
    Array.isArray(time) ||
    (time as Record<string, unknown>).created !== message.time_created ||
    !data.model ||
    typeof data.model !== "object" ||
    Array.isArray(data.model) ||
    typeof (data.model as Record<string, unknown>).providerID !== "string" ||
    typeof (data.model as Record<string, unknown>).modelID !== "string"
  ) {
    throw new Error(`Current Mission operator Message ${message.id} has conflicting persisted identity`)
  }
  const part = rows<PartRow>(
    db,
    "SELECT id,message_id,time_created,data FROM part WHERE id=?",
    identity.textPartID,
  )[0]
  const partData = part
    ? parseObject(part.data, `Current Mission operator text Part ${identity.textPartID} data`)
    : undefined
  if (
    !part ||
    part.message_id !== message.id ||
    partData?.type !== "text" ||
    typeof partData.text !== "string"
  ) {
    throw new Error(`Current Mission operator Message ${message.id} has no exact text Part ${identity.textPartID}`)
  }
  const controls = rows<{
    id: string
    session_id: string
    kind: string
    source: string | null
    payload: string | Record<string, unknown>
  }>(
    db,
    `SELECT id,session_id,kind,source,payload FROM session_control_record
     WHERE kind='wake_reason' AND json_extract(payload,'$.messageID')=? ORDER BY id`,
    message.id,
  )
  if (controls.length !== 1) {
    throw new Error(`Current Mission operator Message ${message.id} has ${controls.length} wake controls`)
  }
  const control = controls[0]!
  const payload = parseObject(control.payload, `Current Mission operator wake control ${control.id} payload`)
  const controlReason = CurrentOperatorWakeReason.parse(payload.wake_reason)
  if (
    control.id !== identity.controlID ||
    control.session_id !== message.session_id ||
    control.source !== "mission.operator" ||
    Object.keys(payload).toSorted().join(",") !== "messageID,wake_reason" ||
    payload.messageID !== message.id ||
    JSON.stringify(controlReason) !== JSON.stringify(reason)
  ) {
    throw new Error(`Current Mission operator wake control ${control.id} has conflicting persisted identity`)
  }
  const receipts = rows<ControlEventRow>(
    db,
    "SELECT id,kind,payload,time_created FROM session_control_event WHERE control_id=? ORDER BY time_created,id",
    control.id,
  )
  if (receipts.length !== 1 || receipts[0]?.kind !== "consumed" || receipts[0].payload !== null) {
    throw new Error(`Current Mission operator wake control ${control.id} has no exact consumed receipt`)
  }
}

function migrateHistoricalOperatorWakeReasons(db: BunDatabase): number {
  const messages = rows<MessageRow>(
    db,
    `SELECT id,session_id,time_created,data FROM message
     WHERE json_extract(data,'$.role')='user'
       AND json_extract(data,'$.extra.wake_reason.source')='mission.operator'
     ORDER BY session_id,time_created,id`,
  )
  let changed = 0
  for (const message of messages) {
    const data = parseObject(message.data, `Mission operator Message ${message.id} data`)
    const extra = parseObject(data.extra as string | Record<string, unknown> | null, `Mission operator Message ${message.id} extra`)
    const reason = parseObject(
      extra.wake_reason as string | Record<string, unknown> | null,
      `Mission operator Message ${message.id} wake reason`,
    )
    const currentIdentityFields = [reason.requestID, reason.requestFingerprint, reason.openedEventID]
    if (currentIdentityFields.some((value) => value !== undefined)) {
      const currentReason = CurrentOperatorWakeReason.parse(reason)
      const openedEvent = rows<ClosureEventRow>(
        db,
        `SELECT id,type,aggregate_type,aggregate_id,session_id,source,correlation_id,seq,emitted_at,payload
         FROM protocol_event WHERE id=?`,
        currentReason.openedEventID,
      )[0]
      if (!openedEvent) throw new Error(`Mission operator Message ${message.id} references a missing opened event`)
      assertClosureIdentity(openedEvent)
      const openedPayload = OpenedPayload.parse(
        parseObject(openedEvent.payload, `Mission operator opened event ${openedEvent.id} payload`),
      )
      const historicalMessageIdentity = currentReason.requestID === `legacy-message:${message.id}`
      const expectedHistoricalFingerprint = historicalMessageIdentity
        ? canonicalDigestSource("mission-operator-accepted-input-legacy-message-v1", {
            messageID: message.id,
            sessionID: message.session_id,
            openedEventID: openedEvent.id,
          }).sha256
        : undefined
      const exactCurrentIdentities = (["mission.dispatch", "mission.wake"] as const).map((source) => {
        const identity = `mission-operator-request\0${message.session_id}\0${source}\0${currentReason.requestID}`
        return {
          messageID: Identifier.deterministic("message", `${identity}\0message`),
          textPartID: Identifier.deterministic("part", `${identity}\0text`),
          controlID: Identifier.deterministic("session_control", `${identity}\0control`),
        }
      })
      const currentIdentity = exactCurrentIdentities.find((identity) => identity.messageID === message.id)
      if (
        openedEvent.type !== "mission.execution.opened" ||
        openedEvent.aggregate_id !== message.session_id ||
        currentReason.missionID !== openedPayload.missionID ||
        (historicalMessageIdentity
          ? currentReason.requestFingerprint !== expectedHistoricalFingerprint
          : !currentIdentity)
      ) {
        throw new Error(`Mission operator Message ${message.id} has a partial or conflicting current wake identity`)
      }
      if (currentIdentity) assertCurrentOperatorWakeBundle(db, message, currentReason, currentIdentity)
      continue
    }
    if (
      Object.keys(reason).toSorted().join(",") !== "missionID,source" ||
      reason.source !== "mission.operator" ||
      typeof reason.missionID !== "string" ||
      !reason.missionID
    ) {
      throw new Error(`Mission operator Message ${message.id} has an unknown historical wake identity`)
    }
    const opened = exactOpenedOccurrence(db, message.session_id)
    if (reason.missionID !== opened.missionID) {
      throw new Error(`Mission operator Message ${message.id} has conflicting Mission identity`)
    }
    const requestID = `legacy-message:${message.id}`
    const requestFingerprint = canonicalDigestSource("mission-operator-accepted-input-legacy-message-v1", {
      messageID: message.id,
      sessionID: message.session_id,
      openedEventID: opened.eventID,
    }).sha256
    const current = {
      source: "mission.operator",
      missionID: opened.missionID,
      requestID,
      requestFingerprint,
      openedEventID: opened.eventID,
    }
    run(
      db,
      "UPDATE message SET data=? WHERE id=?",
      JSON.stringify({ ...data, extra: { ...extra, wake_reason: current } }),
      message.id,
    )
    changed += 1
  }
  return changed
}

function historicalRecoveryReason(input: {
  record: RecoveryControlRow
  marker: z.infer<typeof RecoveryMarker>
  opened: ReturnType<typeof exactOpenedOccurrence>
}) {
  const interruptedAssistantMessageIDs = [...new Set(input.marker.interruptedAssistantMessageIDs)].toSorted()
  return MissionProcessRecoveryWakeReason.parse({
    source: "mission.process_recovery",
    version: 3,
    missionID: input.opened.missionID,
    occurrenceID: input.marker.occurrenceID,
    openedEventID: input.opened.eventID,
    deadOwnerGeneration: Identifier.deterministic(
      "call",
      `historical-mission-process-recovery\0${input.record.id}`,
    ),
    interruptedFrontierDigest: missionProcessRecoveryFrontierDigest(interruptedAssistantMessageIDs),
    interruptedAssistantMessageIDs,
  })
}

function historicalRecoveryPrompt(marker: z.infer<typeof RecoveryMarker>): string {
  const interruptedCount = marker.interruptedAssistantMessageIDs.length
  return (
    `The backend process restarted while ${interruptedCount} assistant turn${interruptedCount === 1 ? " was" : "s were"} ` +
    `still executing. This is recovery attempt ${marker.attempt} for the same process-recovery occurrence. ` +
    "Inspect the persisted process-interruption failures, reconcile durable Mission state, and continue the Mission from the last safe boundary without duplicating completed work."
  )
}

function materializeHistoricalRecoveryWake(input: {
  db: BunDatabase
  record: RecoveryControlRow
  marker: z.infer<typeof RecoveryMarker>
  opened: ReturnType<typeof exactOpenedOccurrence>
}): MessageRow {
  const interrupted = rows<MessageRow>(
    input.db,
    "SELECT id,session_id,time_created,data FROM message WHERE id=?",
    input.marker.interruptedAssistantMessageIDs[0],
  )[0]!
  const interruptedData = parseObject(
    interrupted.data,
    `Mission recovery interrupted assistant ${interrupted.id} data`,
  )
  if (
    typeof interruptedData.agent !== "string" ||
    !interruptedData.agent ||
    typeof interruptedData.providerID !== "string" ||
    !interruptedData.providerID ||
    typeof interruptedData.modelID !== "string" ||
    !interruptedData.modelID
  ) {
    throw new Error(`Mission recovery marker ${input.record.id} cannot derive an exact historical wake model`)
  }
  const reason = historicalRecoveryReason(input)
  const messageData = {
    role: "user",
    time: { created: input.record.time_created },
    author: "OpenCorvus runtime recovery",
    agent: interruptedData.agent,
    model: { providerID: interruptedData.providerID, modelID: interruptedData.modelID },
    extra: { wake_reason: reason },
  }
  run(
    input.db,
    "INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)",
    input.marker.wakeMessageID,
    input.record.session_id,
    input.record.time_created,
    input.record.time_created,
    JSON.stringify(messageData),
  )
  run(
    input.db,
    "INSERT INTO part(id,message_id,time_created,time_updated,data) VALUES(?,?,?,?,?)",
    input.marker.wakeTextPartID,
    input.marker.wakeMessageID,
    input.record.time_created,
    input.record.time_created,
    JSON.stringify({
      type: "text",
      text: historicalRecoveryPrompt(input.marker),
      time: { start: input.record.time_created, end: input.record.time_created },
    }),
  )
  run(
    input.db,
    `INSERT INTO session_control_record(id,session_id,kind,source,payload,time_created)
     VALUES(?,?,'wake_reason','mission.process_recovery',?,?)`,
    input.marker.wakeControlID,
    input.record.session_id,
    JSON.stringify({ messageID: input.marker.wakeMessageID, wake_reason: reason }),
    input.record.time_created,
  )
  run(
    input.db,
    `INSERT INTO session_control_event(id,control_id,kind,payload,time_created)
     VALUES(?,?,'consumed',NULL,?)`,
    Identifier.deterministic("session_control", `terminal\0${input.marker.wakeControlID}`),
    input.marker.wakeControlID,
    input.record.time_created,
  )
  return exactMessage(input.db, input.record.session_id, input.marker.wakeMessageID)!
}

function migrateHistoricalRecoveryWake(input: {
  db: BunDatabase
  record: RecoveryControlRow
  marker: z.infer<typeof RecoveryMarker>
  message: MessageRow
  opened: ReturnType<typeof exactOpenedOccurrence>
}): void {
  const reason = historicalRecoveryReason(input)
  const messageData = parseObject(input.message.data, `Mission recovery Message ${input.message.id} data`)
  const extra =
    messageData.extra && typeof messageData.extra === "object" && !Array.isArray(messageData.extra)
      ? (messageData.extra as Record<string, unknown>)
      : {}
  run(
    input.db,
    "UPDATE message SET data=? WHERE id=?",
    JSON.stringify({ ...messageData, extra: { ...extra, wake_reason: reason } }),
    input.message.id,
  )
  const control = rows<{ payload: string | Record<string, unknown> }>(
    input.db,
    "SELECT payload FROM session_control_record WHERE id=?",
    input.marker.wakeControlID,
  )[0]
  if (!control)
    throw new Error(`Mission recovery wake control ${input.marker.wakeControlID} disappeared during migration`)
  const controlPayload = parseObject(
    control.payload,
    `Mission recovery wake control ${input.marker.wakeControlID} payload`,
  )
  run(
    input.db,
    "UPDATE session_control_record SET payload=? WHERE id=?",
    JSON.stringify({ ...controlPayload, wake_reason: reason }),
    input.marker.wakeControlID,
  )
}

function recoveryOpenedEventPointer(
  db: BunDatabase,
  record: RecoveryControlRow,
  marker: z.infer<typeof RecoveryMarker>,
): string | undefined {
  const candidates = new Set<string>()
  const collect = (value: unknown, subject: string) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return
    const reason = value as Record<string, unknown>
    if (reason.openedEventID === undefined) return
    if (
      reason.source !== "mission.process_recovery" ||
      !Identifier.schema("protocol_event").safeParse(reason.openedEventID).success
    ) {
      throw new Error(`${subject} has an invalid explicit opened occurrence pointer`)
    }
    candidates.add(reason.openedEventID as string)
  }
  const control = rows<{ payload: string | Record<string, unknown> }>(
    db,
    "SELECT payload FROM session_control_record WHERE id=?",
    marker.wakeControlID,
  )[0]
  if (control) {
    const payload = parseObject(control.payload, `Mission recovery wake control ${marker.wakeControlID} payload`)
    collect(payload.wake_reason, `Mission recovery wake control ${marker.wakeControlID}`)
  }
  const message = rows<MessageRow>(
    db,
    "SELECT id,session_id,time_created,data FROM message WHERE id=?",
    marker.wakeMessageID,
  )[0]
  if (message) {
    const data = parseObject(message.data, `Mission recovery Message ${marker.wakeMessageID} data`)
    const extra = data.extra
    if (extra && typeof extra === "object" && !Array.isArray(extra)) {
      collect((extra as Record<string, unknown>).wake_reason, `Mission recovery Message ${marker.wakeMessageID}`)
    }
  }
  if (candidates.size > 1) {
    throw new Error(`Mission recovery occurrence ${record.id} has conflicting opened occurrence pointers`)
  }
  return [...candidates][0]
}

function migrateRecoveryMarkers(db: BunDatabase): number {
  const records = rows<RecoveryControlRow>(
    db,
    `SELECT id,session_id,source,payload,time_created FROM session_control_record
     WHERE kind=? ORDER BY session_id,time_created,id`,
    LEGACY_RECOVERY_KIND,
  )
  const classified = records.map((record) => {
    const effective = effectiveRecoveryMarker(db, record)
    return {
      record,
      marker: effective.marker,
      terminal: effective.terminal,
      opened: exactOpenedOccurrence(
        db,
        record.session_id,
        recoveryOpenedEventPointer(db, record, effective.marker),
      ),
    }
  })

  const controlUpdateTrigger = rows<{ sql: string | null }>(
    db,
    "SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='session_control_record_no_update'",
  )[0]?.sql
  if (controlUpdateTrigger) db.exec("DROP TRIGGER session_control_record_no_update")

  const wakeMessages = new Map<string, string>()
  const wakeTextParts = new Map<string, string>()
  const wakeControls = new Map<string, string>()
  const occurrenceOwners = new Map<string, string>()
  for (const { record, marker, opened } of classified) {
    const occurrenceKey = `${record.session_id}\0${opened.eventID}`
    const occurrenceOwner = occurrenceOwners.get(occurrenceKey)
    if (occurrenceOwner) {
      throw new Error(
        `Mission process-recovery controls ${occurrenceOwner} and ${record.id} claim one opened occurrence ${opened.eventID}`,
      )
    }
    occurrenceOwners.set(occurrenceKey, record.id)
    const messageOwner = wakeMessages.get(marker.wakeMessageID)
    if (messageOwner) {
      throw new Error(
        `Mission process-recovery controls ${messageOwner} and ${record.id} share wake Message ${marker.wakeMessageID}`,
      )
    }
    wakeMessages.set(marker.wakeMessageID, record.id)
    const textOwner = wakeTextParts.get(marker.wakeTextPartID)
    if (textOwner) {
      throw new Error(
        `Mission process-recovery controls ${textOwner} and ${record.id} share wake text Part ${marker.wakeTextPartID}`,
      )
    }
    wakeTextParts.set(marker.wakeTextPartID, record.id)
    const controlOwner = wakeControls.get(marker.wakeControlID)
    if (controlOwner) {
      throw new Error(
        `Mission process-recovery controls ${controlOwner} and ${record.id} share wake control ${marker.wakeControlID}`,
      )
    }
    wakeControls.set(marker.wakeControlID, record.id)
  }

  for (const { record, marker, terminal, opened } of classified) {
    let message = exactMessage(db, record.session_id, marker.wakeMessageID)
    let textPart = exactTextPart(db, record.session_id, marker)
    const wakeControlExists = exactWakeControl(db, record.session_id, { record, marker, opened })
    if (new Set([Boolean(message), Boolean(textPart), wakeControlExists]).size !== 1) {
      throw new Error(`Mission recovery occurrence ${record.id} has a partial wake Message/text Part/control bundle`)
    }
    if (!message && terminal) {
      throw new Error(`Terminal Mission recovery occurrence ${record.id} has no exact wake bundle`)
    }
    if (!message) {
      message = materializeHistoricalRecoveryWake({ db, record, marker, opened })
      textPart = exactTextPart(db, record.session_id, marker)
      if (!textPart || !exactWakeControl(db, record.session_id, { record, marker, opened })) {
        throw new Error(`Mission recovery occurrence ${record.id} did not materialize its exact wake bundle`)
      }
    }
    const reply = message ? replyDisposition(db, record.session_id, marker.wakeMessageID) : undefined
    if (terminal) {
      const frontierSettled = marker.interruptedAssistantMessageIDs.every((messageID) =>
        migrateExactHistoricalInterruptedAssistant(db, record.session_id, messageID),
      )
      const terminalReplyMatches =
        (terminal === "consumed" && reply?.kind === "successful_reply") ||
        (terminal === "failed" && reply?.kind === "failed_reply")
      if (!frontierSettled || !terminalReplyMatches) {
        throw new Error(
          `Terminal Mission recovery occurrence ${record.id} has no exact settled frontier and matching reply`,
        )
      }
    }
    if (reply?.kind === "successful_reply") {
      // The durable assistant reply is already the terminal business fact.
    } else if (reply?.kind === "failed_reply") {
      // The durable assistant reply is already the terminal business fact.
    } else {
      migrateHistoricalRecoveryWake({ db, record, marker, message, opened })
    }
  }
  // The marker was a mutable shadow queue, not a business fact. After validating
  // it against the real Message/reply and closure facts, remove the whole legacy
  // record family. No replacement classification queue is created.
  const deleteTriggers = rows<{ name: string; sql: string | null }>(
    db,
    `SELECT name,sql FROM sqlite_schema
     WHERE type='trigger' AND name IN ('session_control_record_no_delete','session_control_event_no_delete')
     ORDER BY name`,
  )
  if (records.length > 0 && ![0, 2].includes(deleteTriggers.length)) {
    throw new Error("Mission process-recovery migration requires the exact Session control immutable delete triggers")
  }
  if (deleteTriggers.some((trigger) => !trigger.sql)) {
    throw new Error("Mission process-recovery migration found an incomplete Session control immutable delete trigger")
  }
  for (const trigger of deleteTriggers) db.exec(`DROP TRIGGER ${trigger.name}`)
  for (const record of records) {
    run(db, "DELETE FROM session_control_record WHERE id=? AND kind=?", record.id, LEGACY_RECOVERY_KIND)
  }
  for (const trigger of deleteTriggers) db.exec(trigger.sql!)
  if (controlUpdateTrigger) db.exec(controlUpdateTrigger)
  return records.length
}

let afterAdmissionForTest: (() => void) | undefined
let afterFirstPhaseForTest: (() => void) | undefined

/**
 * Upgrade historical Mission close and process-recovery facts before current
 * readers run. Both classifications share one writer reservation and one
 * rollback boundary, so current code never needs an optional-provenance or
 * legacy-control compatibility reader.
 */
export function migrateMissionExecutionReconciliationFacts(sqlite: BunDatabase): boolean {
  const legacyAlterTable = rows<{ legacy_alter_table: number }>(sqlite, "PRAGMA legacy_alter_table")[0]
    ?.legacy_alter_table
  sqlite.exec("PRAGMA legacy_alter_table=ON")
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    afterAdmissionForTest?.()
    const deleteRetentionSchemaCount = migrateMissionDeleteRetentionSchema(sqlite)
    const schedulerSchemaCount = migrateSchedulerMissionDispositionSchema(sqlite)
    const closureCount = migrateClosurePayloads(sqlite)
    const schedulerWakeReceiptCount = migrateHistoricalMissionWakeClosureReceipts(sqlite)
    const operatorWakeCount = migrateHistoricalOperatorWakeReasons(sqlite)
    afterFirstPhaseForTest?.()
    const markerCount = migrateRecoveryMarkers(sqlite)
    sqlite.exec("COMMIT")
    return (
      deleteRetentionSchemaCount +
        schedulerSchemaCount +
        closureCount +
        schedulerWakeReceiptCount +
        operatorWakeCount +
        markerCount >
      0
    )
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  } finally {
    sqlite.exec(`PRAGMA legacy_alter_table=${legacyAlterTable ? "ON" : "OFF"}`)
  }
}

export const MissionExecutionReconciliationMigrationTestHooks = {
  replaceAfterAdmission(callback: (() => void) | undefined): Disposable {
    const prior = afterAdmissionForTest
    afterAdmissionForTest = callback
    return {
      [Symbol.dispose]() {
        afterAdmissionForTest = prior
      },
    }
  },
  replaceAfterFirstPhase(callback: (() => void) | undefined): Disposable {
    const prior = afterFirstPhaseForTest
    afterFirstPhaseForTest = callback
    return {
      [Symbol.dispose]() {
        afterFirstPhaseForTest = prior
      },
    }
  },
}
