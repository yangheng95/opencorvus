import { Database as SQLite } from "bun:sqlite"
import { Identifier } from "@/id/id"
import { SCHEMA_DDL } from "./ddl"
import { OrchestratorEventSchema } from "@/orchestrator/event"

type RawDatabase = SQLite

const REBUILT_TABLES = [
  "session",
  "engine_task",
  "engine_build_observation_cleanup",
  "engine_interaction_request",
  "engine_workflow_node_occurrence",
  "engine_progress_snapshot",
  "protocol_event",
  "protocol_inbox",
  "protocol_delivery_receipt",
  "automation",
  "automation_project_target",
  "automation_run",
  "event_job",
  "event_job_fire",
  "part",
  "tool_part_request",
  "provider_activity_request",
  "permission_ledger",
  "permission_execution_result",
  "session_control_record",
  "bus_publication_outbox",
  "bus_publication_delivery",
] as const

const NEW_TABLES = [
  "channel_ingress_accepted",
  "channel_ingress_outcome",
  "engine_git_checkpoint_request",
  "engine_git_checkpoint_outcome",
  "engine_task_root_ingress_policy",
  "engine_task_root_ingress",
  "engine_control_activation_lease",
  "engine_build_observation_cleanup_receipt",
  "engine_interaction_outcome",
  "automation_run_receipt",
  "automation_definition_tombstone",
  "event_job_fire_receipt",
  "event_job_definition_tombstone",
  "event_occurrence",
  "tool_part_outcome",
  "provider_activity_outcome",
  "session_control_event",
  "bus_publication_delivery_receipt",
  "bus_publication_phase_receipt",
  "bus_publication_attempt_receipt",
] as const

function migrateChannelIngressFacts(db: RawDatabase): void {
  if (!exists(db, "channel_ingress_receipt")) return
  for (const row of rows<{
    project_id: string
    platform: string
    request_id: string
    fingerprint: string
    result: string
    time_created: number
  }>(db, `SELECT project_id,platform,request_id,fingerprint,result,time_created FROM channel_ingress_receipt`)) {
    let input: unknown
    try {
      input = JSON.parse(row.fingerprint)
    } catch {
      throw new Error(`Channel ingress ${row.platform}/${row.request_id} has no exact legacy input payload`)
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`Channel ingress ${row.platform}/${row.request_id} has an invalid legacy input payload`)
    }
    const id = Identifier.deterministic(
      "call",
      `channel-ingress\0${row.project_id}\0${row.platform}\0${row.request_id}`,
    )
    const payload = { ...(input as Record<string, unknown>) }
    if (payload.platform !== undefined && payload.platform !== row.platform) {
      throw new Error(`Channel ingress ${row.platform}/${row.request_id} has conflicting platform identity`)
    }
    if (payload.request_id !== undefined && payload.request_id !== row.request_id) {
      throw new Error(`Channel ingress ${row.platform}/${row.request_id} has conflicting request identity`)
    }
    delete payload.platform
    delete payload.request_id
    run(db, `INSERT INTO channel_ingress_accepted(id,project_id,platform,request_id,input,time_created) VALUES(?,?,?,?,?,?)`,
      id, row.project_id, row.platform, row.request_id, JSON.stringify(payload), row.time_created)
    run(db, `INSERT INTO channel_ingress_outcome(request_id,result,time_created) VALUES(?,?,?)`,
      id, row.result, row.time_created)
  }
  db.exec("DROP TABLE channel_ingress_receipt")
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function rows<T>(db: RawDatabase, statement: string): T[] {
  const query = db.query<T, []>(statement)
  try {
    return query.all()
  } finally {
    query.finalize()
  }
}

function run(db: RawDatabase, statement: string, ...parameters: unknown[]): void {
  const query = db.query(statement)
  try {
    query.run(...parameters as [])
  } finally {
    query.finalize()
  }
}

function migrateGitCheckpointFacts(db: RawDatabase): void {
  if (!exists(db, "__fact_kernel_old_engine_task")) return
  const insertCheckpoint = (
    taskID: string,
    stage: "baseline" | "result" | "acceptance_round",
    operationKey: string,
    result: Record<string, unknown>,
    timeCreated: number,
  ) => {
    const id = Identifier.deterministic("artifact", `git-checkpoint\0${taskID}\0${operationKey}`)
    run(db, `INSERT OR IGNORE INTO engine_git_checkpoint_request(id,task_id,stage,operation_key,input,time_created) VALUES(?,?,?,?,?,?)`,
      id, taskID, stage, operationKey, "{}", timeCreated)
    run(db, `INSERT OR IGNORE INTO engine_git_checkpoint_outcome(request_id,result,time_created) VALUES(?,?,?)`,
      id, JSON.stringify(result), timeCreated)
  }
  for (const row of rows<{ id: string; metadata: string | null; time_created: number }>(db, `
    SELECT id,metadata,time_created FROM __fact_kernel_old_engine_task
  `)) {
    if (!row.metadata) continue
    let metadata: any
    try { metadata = JSON.parse(row.metadata) } catch { continue }
    const git = metadata?.git
    if (!git || typeof git !== "object" || Array.isArray(git)) continue
    const epoch = rows<{ epoch: number }>(db, `
      SELECT COALESCE(MAX(CAST(json_extract(payload,'$.execution_epoch') AS INTEGER)),1) AS epoch
      FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(row.id)}
        AND type IN ('task.execution.opened','task.execution.reopened')
    `)[0]?.epoch ?? 1
    if (git.baseline && typeof git.baseline === "object" && !Array.isArray(git.baseline)) {
      insertCheckpoint(row.id, "baseline", `baseline:${epoch}`, git.baseline, Number(git.baseline.time ?? row.time_created))
    }
    const results = [
      ...(Array.isArray(git.result_history) ? git.result_history : []),
      ...(git.result && typeof git.result === "object" && !Array.isArray(git.result) ? [git.result] : []),
    ].filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    const firstEpoch = Math.max(1, epoch - results.length + 1)
    results.forEach((result, offset) => {
      insertCheckpoint(row.id, "result", `result:${firstEpoch + offset}`, result, Number(result.time ?? row.time_created))
    })
  }
  for (const row of rows<{ id: string; task_id: string; payload: string | null; time_created: number }>(db, `
    SELECT id,task_id,payload,time_created FROM engine_progress_snapshot
    WHERE json_extract(payload,'$.kind')='git'
  `)) {
    let payload: any
    try { payload = row.payload ? JSON.parse(row.payload) : undefined } catch { payload = undefined }
    if (payload?.stage === "acceptance_round" && Number.isSafeInteger(payload.iteration)) {
      const epoch = rows<{ epoch: number }>(db, `
        SELECT COALESCE(MAX(CAST(json_extract(payload,'$.execution_epoch') AS INTEGER)),1) AS epoch
        FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(row.task_id)}
          AND type IN ('task.execution.opened','task.execution.reopened') AND emitted_at<=${row.time_created}
      `)[0]?.epoch ?? 1
      insertCheckpoint(row.task_id, "acceptance_round", `acceptance_round:${epoch}:${payload.iteration}`, payload, row.time_created)
    }
    run(db, `DELETE FROM engine_progress_snapshot WHERE id=?`, row.id)
  }
}

function exists(db: RawDatabase, table: string): boolean {
  return Boolean(rows<{ name: string }>(db, `SELECT name FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`)[0])
}

function columns(db: RawDatabase, table: string): string[] {
  return rows<{ name: string }>(db, `PRAGMA table_info(${quote(table)})`).map((row) => row.name)
}

function tableDefinition(db: RawDatabase, table: string): string {
  return rows<{ sql: string }>(db, `SELECT sql FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`)[0]?.sql ?? ""
}

function hasIndex(db: RawDatabase, name: string): boolean {
  return Boolean(rows<{ name: string }>(db, `SELECT name FROM sqlite_schema WHERE type='index' AND name=${literal(name)}`)[0])
}

function currentSchema(): RawDatabase {
  const db = new SQLite(":memory:")
  db.exec(SCHEMA_DDL)
  return db
}

function createCurrentTable(target: RawDatabase, reference: RawDatabase, table: string, includeTriggers = true): void {
  const definition = rows<{ sql: string }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='table' AND name=${literal(table)}`,
  )[0]?.sql
  if (!definition) throw new Error(`Current schema is missing table ${table}`)
  target.exec(definition)
  for (const index of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='index' AND tbl_name=${literal(table)} ORDER BY name`,
  )) {
    if (index.sql) target.exec(index.sql)
  }
  if (includeTriggers) for (const trigger of rows<{ sql: string | null }>(
    reference,
    `SELECT sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=${literal(table)} ORDER BY name`,
  )) {
    if (trigger.sql) target.exec(trigger.sql)
  }
}

function rebuildTable(target: RawDatabase, reference: RawDatabase, table: string): void {
  if (!exists(target, table)) {
    createCurrentTable(target, reference, table, false)
    return
  }
  const legacy = `__fact_kernel_old_${table}`
  for (const index of rows<{ name: string }>(
    target,
    `SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name=${literal(table)} AND sql IS NOT NULL`,
  )) target.exec(`DROP INDEX ${quote(index.name)}`)
  for (const trigger of rows<{ name: string }>(
    target,
    `SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name=${literal(table)}`,
  )) target.exec(`DROP TRIGGER ${quote(trigger.name)}`)
  target.exec(`ALTER TABLE ${quote(table)} RENAME TO ${quote(legacy)}`)
  createCurrentTable(target, reference, table, false)
  const oldColumns = new Set(columns(target, legacy))
  const newColumns = columns(target, table)
  const selected = newColumns.filter((column) => oldColumns.has(column))
  const expressions = selected.map((column) => {
    if (table === "permission_ledger" && [
      "project_id", "session_id", "task_id", "message_id", "tool_call_id", "mode", "policy_revision",
      "provider_kind", "provider_id", "provider_digest", "tool_name", "effect_class", "scope_version",
      "scope", "fingerprint", "summary",
    ].includes(column)) {
      return `CASE WHEN event_type='requested' THEN ${quote(column)} ELSE NULL END`
    }
    if (table === "permission_ledger" && column === "event_type") {
      return `CASE WHEN event_type='full_access' THEN 'allowed_once' ELSE event_type END`
    }
    if (table === "engine_task" && column === "metadata") {
      return `CASE WHEN metadata IS NULL OR json_valid(metadata)=0 THEN metadata ELSE json_remove(metadata, '$.cancelled', '$.interrupted', '$.git') END`
    }
    if (table === "protocol_event" && column === "task_id") {
      return `CASE WHEN aggregate_type='task' THEN NULL ELSE task_id END`
    }
    if (table === "protocol_event" && column === "session_id") {
      return `CASE WHEN aggregate_type='session' THEN NULL ELSE session_id END`
    }
    if (table === "protocol_event" && column === "payload") {
      return `CASE WHEN payload IS NULL OR json_valid(payload)=0 THEN payload ELSE
        CASE
          WHEN type='task.updated' THEN json_remove(payload,'$.taskID','$.sessionID','$.interactionID','$.orderKey','$.status')
          WHEN type IN ('task.completed','task.failed','task.cancelled') THEN json_remove(payload,'$.taskID','$.sessionID','$.interactionID','$.orderKey','$.timeCompleted')
          ELSE json_remove(payload,'$.taskID','$.sessionID','$.interactionID','$.orderKey')
        END
      END`
    }
    if (table === "session_control_record" && column === "payload" && oldColumns.has("status")) {
      return `CASE WHEN status='failed' AND payload IS NOT NULL AND json_valid(payload)=1 THEN json_remove(payload,'$.error') ELSE payload END`
    }
    return quote(column)
  })
  if (table === "automation") {
    if (!selected.includes("definition_id")) {
      selected.push("definition_id")
      expressions.push("id")
    }
    if (!selected.includes("revision")) {
      selected.push("revision")
      expressions.push("1")
    }
  }
  if (table === "event_job") {
    if (!selected.includes("definition_id")) {
      selected.push("definition_id")
      expressions.push("id")
    }
    if (!selected.includes("revision")) {
      selected.push("revision")
      expressions.push("1")
    }
  }
  if (table === "automation_project_target" && oldColumns.has("automation_id") && !selected.includes("automation_revision_id")) {
    selected.push("automation_revision_id")
    expressions.push("automation_id")
  }
  if (table === "automation_run" && oldColumns.has("automation_id") && !selected.includes("automation_revision_id")) {
    selected.push("automation_revision_id")
    expressions.push("automation_id")
  }
  if (table === "automation_run" && oldColumns.has("project_id") && !selected.includes("target_project_id")) {
    selected.push("target_project_id")
    expressions.push(`CASE
      WHEN target_scope='project'
       AND COALESCE((SELECT kind FROM __fact_kernel_old_automation WHERE id=automation_revision_id),'recurring')='recurring'
      THEN project_id ELSE NULL END`)
  }
  if (table === "event_job_fire" && oldColumns.has("event_job_id") && !selected.includes("event_job_revision_id")) {
    selected.push("event_job_revision_id")
    expressions.push("event_job_id")
  }
  if (table === "event_job_fire" && oldColumns.has("target_session_id") && !selected.includes("created_session_id")) {
    selected.push("created_session_id")
    expressions.push(`CASE WHEN creates_session=1 THEN target_session_id ELSE NULL END`)
  }
  if (table === "bus_publication_delivery" && !selected.includes("effect_contract")) {
    selected.push("effect_contract")
    expressions.push(`CASE WHEN durable=1 THEN 'idempotent_by_occurrence' ELSE NULL END`)
  }
  if (table === "automation" && !selected.includes("due_at") && oldColumns.has("next_run")) {
    selected.push("due_at")
    expressions.push(`CASE WHEN kind='delay' THEN next_run ELSE NULL END`)
  }
  if (table === "session_control_record" && !selected.includes("source")) {
    selected.push("source")
    expressions.push(oldColumns.has("owner") ? "owner" : "NULL")
  }
  const filter = table === "part"
    ? ` WHERE json_extract(data, '$.type') NOT IN ('tool', 'tool-request', 'tool-outcome')`
    : (table === "automation" || table === "event_job") && oldColumns.has("tombstone")
      ? ` WHERE tombstone<>1`
      : table === "permission_ledger"
        ? ` WHERE event_type<>'policy_migrated'`
        : ""
  if (table !== "protocol_delivery_receipt") {
    target.exec(
      `INSERT INTO ${quote(table)} (${selected.map(quote).join(",")}) SELECT ${expressions.join(",")} FROM ${quote(legacy)}${filter}`,
    )
  }
}

function migratePermissionRequestOwners(db: RawDatabase): void {
  const legacy = "__fact_kernel_old_permission_ledger"
  if (!exists(db, legacy)) return
  const requestFields = [
    "project_id", "session_id", "task_id", "message_id", "tool_call_id", "mode", "policy_revision",
    "provider_kind", "provider_id", "provider_digest", "tool_name", "effect_class", "scope_version",
    "scope", "fingerprint", "summary",
  ] as const
  const requestIDs = rows<{ request_id: string }>(db, `
    SELECT DISTINCT request_id FROM ${quote(legacy)}
    WHERE event_type<>'policy_migrated' AND request_id IS NOT NULL
  `)
  for (const { request_id: requestID } of requestIDs) {
    const current = rows<{ id: string }>(db, `
      SELECT id FROM permission_ledger WHERE request_id=${literal(requestID)} AND event_type='requested' LIMIT 1
    `)[0]
    if (current) continue
    const owner = rows<Record<string, unknown>>(db, `
      SELECT * FROM ${quote(legacy)} WHERE request_id=${literal(requestID)}
        AND project_id IS NOT NULL AND session_id IS NOT NULL
        AND message_id IS NOT NULL AND tool_call_id IS NOT NULL
        AND mode IS NOT NULL AND policy_revision IS NOT NULL
        AND provider_kind IS NOT NULL AND provider_id IS NOT NULL AND provider_digest IS NOT NULL
        AND tool_name IS NOT NULL AND effect_class IS NOT NULL AND scope_version IS NOT NULL
        AND scope IS NOT NULL AND fingerprint IS NOT NULL AND summary IS NOT NULL
      ORDER BY CASE WHEN event_type='requested' THEN 0 ELSE 1 END,time_created,id LIMIT 1
    `)[0]
    if (!owner) throw new Error(`Permission request ${requestID} has no exact legacy input owner`)
    const id = Identifier.deterministic("permission", `migrated-request\0${requestID}`)
    const columnsToInsert = ["id", "request_id", ...requestFields, "event_type", "metadata", "time_created"]
    const values = [
      id, requestID, ...requestFields.map((field) => owner[field]), "requested", owner.metadata ?? null,
      owner.time_created,
    ]
    const placeholders = values.map(() => "?").join(",")
    run(db, `INSERT INTO permission_ledger (${columnsToInsert.map(quote).join(",")}) VALUES (${placeholders})`, ...values)
  }
}

function migrateDefinitionTombstones(db: RawDatabase): void {
  for (const input of [
    { legacy: "__fact_kernel_old_automation", target: "automation_definition_tombstone" },
    { legacy: "__fact_kernel_old_event_job", target: "event_job_definition_tombstone" },
  ] as const) {
    if (!exists(db, input.legacy) || !columns(db, input.legacy).includes("tombstone")) continue
    for (const row of rows<{ id: string; definition_id: string; revision: number; time_created: number }>(
      db,
      `SELECT id,definition_id,revision,time_created FROM ${quote(input.legacy)} WHERE tombstone=1`,
    )) {
      insertReceipt(db, input.target, ["id", "definition_id", "revision", "time_created"], [
        row.id,
        row.definition_id,
        row.revision,
        row.time_created,
      ])
    }
  }
}

function assertLegacyDurableBusEffectsClassified(db: RawDatabase): void {
  if (!exists(db, "bus_publication_delivery") || columns(db, "bus_publication_delivery").includes("effect_contract")) return
  const hasLegacySettled = columns(db, "bus_publication_delivery").includes("settled")
  const unresolved = hasLegacySettled
    ? rows<{ count: number }>(db, `SELECT count(*) AS count FROM bus_publication_delivery WHERE durable=1 AND settled<>1`)[0]?.count ?? 0
    : exists(db, "bus_publication_delivery_receipt")
      ? rows<{ count: number }>(db, `SELECT count(*) AS count FROM bus_publication_delivery d WHERE d.durable=1 AND NOT EXISTS (SELECT 1 FROM bus_publication_delivery_receipt r WHERE r.occurrence_id=d.occurrence_id AND r.phase=d.phase AND r.subscriber_id=d.subscriber_id AND r.outcome IN ('succeeded','ignored'))`)[0]?.count ?? 0
      : rows<{ count: number }>(db, `SELECT count(*) AS count FROM bus_publication_delivery WHERE durable=1`)[0]?.count ?? 0
  if (unresolved > 0) throw new Error(`Fact-kernel migration cannot classify ${unresolved} unresolved legacy durable Bus effect(s); settle them with their exact old runtime before upgrading`)
}

function insertReceipt(
  db: RawDatabase,
  table: string,
  columns: readonly string[],
  values: readonly unknown[],
): void {
  const placeholders = values.map(() => "?").join(",")
  run(db, `INSERT OR IGNORE INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES (${placeholders})`, ...values)
}

function parsedJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function protocolDeliveryReceiptValue(row: any, outcome: string): Record<string, unknown> {
  if (outcome === "retry_wait") {
    if (!Number.isSafeInteger(row.visible_at) || row.visible_at <= 0 || typeof row.error !== "string" || !row.error) {
      throw new Error(`Protocol delivery ${row.inbox_id ?? row.id} has an invalid retry receipt`)
    }
    return { kind: "retry_wait", visible_at: row.visible_at, error: row.error }
  }
  const result = parsedJson(row.delivery_result)
  if (result && typeof result === "object" && !Array.isArray(result)) return result as Record<string, unknown>
  const error =
    typeof row.error === "string" && row.error
      ? row.error
      : typeof row.last_error === "string" && row.last_error
        ? row.last_error
        : undefined
  if (outcome === "dead_letter" && error) return { kind: "dead_letter", error_name: "Error", message: error }
  throw new Error(`Protocol delivery ${row.inbox_id ?? row.id} ${outcome} receipt has no exact result`)
}

function migrateToolFacts(db: RawDatabase): void {
  if (!exists(db, "__fact_kernel_old_part")) return
  const parts = rows<{ id: string; message_id: string; data: string; time_created: number }>(
    db,
    `SELECT id,message_id,data,time_created FROM __fact_kernel_old_part WHERE json_extract(data, '$.type')='tool'`,
  )
  for (const row of parts) {
    const part = JSON.parse(row.data) as any
    const state = part.state ?? {}
    if (state.status === "pending") continue
    if (!["running", "completed", "error"].includes(state.status)) {
      throw new Error(`Legacy Tool Part ${row.id} has an ambiguous state and cannot be migrated safely`)
    }
    const request = {
      type: "tool-request",
      callID: part.callID,
      tool: part.tool,
      input: state.input,
      ...(state.title ? { title: state.title } : {}),
      ...(part.metadata ? { metadata: part.metadata } : {}),
      time: { start: state.time?.start ?? row.time_created },
    }
    insertReceipt(db, "tool_part_request", ["id", "message_id", "data", "time_created"], [
      row.id, row.message_id, JSON.stringify(request), row.time_created,
    ])
    if (state.status !== "completed" && state.status !== "error") continue
    const outcome = state.status === "completed"
      ? {
          outcome: "completed",
          output: state.output ?? "",
          title: state.title ?? part.tool,
          metadata: state.metadata ?? {},
          time: { end: state.time?.end ?? row.time_created },
          ...(state.attachments ? { attachments: state.attachments } : {}),
        }
      : {
          outcome: "failed",
          failure: state.failure ?? { name: "Error", message: "Migrated Tool failure" },
          ...(state.metadata ? { metadata: state.metadata } : {}),
          time: { end: state.time?.end ?? row.time_created },
        }
    insertReceipt(db, "tool_part_outcome", ["id", "request_part_id", "data", "time_created"], [
      Identifier.deterministic("part", `tool-outcome\0${row.id}`), row.id, JSON.stringify(outcome), outcome.time.end,
    ])
  }
}

function migrateProjectionReceipts(db: RawDatabase): void {
  if (exists(db, "__fact_kernel_old_protocol_delivery_receipt")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_protocol_delivery_receipt ORDER BY time_created,id`)) {
      insertReceipt(db, "protocol_delivery_receipt", ["id", "inbox_id", "receipt", "time_created"], [
        row.id,
        row.inbox_id,
        JSON.stringify(protocolDeliveryReceiptValue(row, row.outcome)),
        row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_engine_interaction_request") && columns(db, "__fact_kernel_old_engine_interaction_request").includes("status")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_engine_interaction_request WHERE status<>'pending'`)) {
      insertReceipt(db, "engine_interaction_outcome", ["id", "interaction_id", "outcome", "response", "time_created"], [
        Identifier.deterministic("interaction", `interaction-outcome\0${row.id}`), row.id, row.status,
        row.response ?? "{}", row.time_resolved ?? row.time_updated ?? row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_engine_build_observation_cleanup") && columns(db, "__fact_kernel_old_engine_build_observation_cleanup").includes("status")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_engine_build_observation_cleanup WHERE status IN ('retained','complete') OR last_error IS NOT NULL`)) {
      const outcome = row.status === "retained" ? "retained" : row.status === "complete" ? "complete" : "failed"
      insertReceipt(db, "engine_build_observation_cleanup_receipt", ["id", "observation_id", "outcome", "error", "time_created"], [
        Identifier.deterministic("artifact", `build-cleanup-receipt\0${row.observation_id}`), row.observation_id, outcome,
        row.last_error, row.time_updated ?? row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_session_control_record") && columns(db, "__fact_kernel_old_session_control_record").includes("status")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_session_control_record WHERE status IN ('consumed','failed')`)) {
      const payload = parsedJson(row.payload)
      const exactError = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).error
        : undefined
      if (row.status === "failed" && (typeof exactError !== "string" || !exactError)) {
        throw new Error(`Legacy Session control ${row.id} failed without an exact error receipt`)
      }
      insertReceipt(db, "session_control_event", ["id", "control_id", "kind", "payload", "time_created"], [
        Identifier.deterministic("session_control", `session-control-terminal\0${row.id}`), row.id, row.status,
        row.status === "failed" ? JSON.stringify({ error: exactError }) : null,
        row.time_consumed ?? row.time_updated ?? row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_protocol_inbox") && columns(db, "__fact_kernel_old_protocol_inbox").includes("status")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_protocol_inbox WHERE status IN ('retry_wait','delivered','dead_letter')`)) {
      insertReceipt(db, "protocol_delivery_receipt", ["id", "inbox_id", "receipt", "time_created"], [
        Identifier.deterministic("protocol_inbox", `delivery-receipt\0${row.id}\0${row.status}`), row.id,
        JSON.stringify(protocolDeliveryReceiptValue({ ...row, inbox_id: row.id, error: row.last_error }, row.status)),
        row.time_completed ?? row.time_updated ?? row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_automation_run") && columns(db, "__fact_kernel_old_automation_run").includes("outcome")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_automation_run WHERE outcome<>'running'`)) {
      const retryAt = row.outcome === "retry_wait"
        ? rows<{ lease_until: number | null }>(db, `SELECT lease_until FROM __fact_kernel_old_automation WHERE id=${literal(row.automation_id)}`)[0]?.lease_until
        : null
      if (row.outcome === "retry_wait" && (!Number.isSafeInteger(retryAt) || Number(retryAt) <= 0 || typeof row.error !== "string" || !row.error)) {
        throw new Error(`Legacy Automation run ${row.id} retry_wait has no exact retry lease/error`)
      }
      insertReceipt(db, "automation_run_receipt", ["id", "run_id", "outcome", "retry_at", "error", "time_created"], [
        Identifier.deterministic("automation_run", `automation-run-receipt\0${row.id}`), row.id, row.outcome,
        retryAt, row.error, row.completed_at ?? row.started_at,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_event_job_fire") && columns(db, "__fact_kernel_old_event_job_fire").includes("status")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_event_job_fire WHERE status IN ('retry_wait','succeeded','disposition')`)) {
      insertReceipt(db, "event_job_fire_receipt", ["id", "fire_id", "outcome", "disposition", "message_id", "retry_at", "error", "time_created"], [
        Identifier.deterministic("event_job", `event-fire-receipt\0${row.id}`), row.id, row.status,
        row.disposition, row.message_id, row.status === "retry_wait" ? row.lease_until : null, row.error,
        row.time_completed ?? row.time_updated ?? row.time_created,
      ])
    }
  }
  if (exists(db, "__fact_kernel_old_bus_publication_outbox") && columns(db, "__fact_kernel_old_bus_publication_outbox").includes("exact_settled")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_bus_publication_outbox`)) {
      for (const phase of ["exact", "wildcard", "global"] as const) {
        if (!row[`${phase}_settled`]) continue
        insertReceipt(db, "bus_publication_phase_receipt", ["id", "occurrence_id", "phase", "time_created"], [
          Identifier.deterministic("call", `bus-phase\0${row.occurrence_id}\0${phase}`), row.occurrence_id, phase,
          row.time_updated ?? row.time_created,
        ])
      }
      if (row.attempt_count > 0 && row.last_error && row.next_attempt_at > 0) {
        insertReceipt(db, "bus_publication_attempt_receipt", ["id", "occurrence_id", "error", "retry_at", "time_created"], [
          Identifier.deterministic("call", `bus-attempt-migration\0${row.occurrence_id}`), row.occurrence_id,
          row.last_error, row.next_attempt_at, row.time_updated ?? row.time_created,
        ])
      }
    }
  }
  if (exists(db, "__fact_kernel_old_bus_publication_delivery") && columns(db, "__fact_kernel_old_bus_publication_delivery").includes("settled")) {
    for (const row of rows<any>(db, `SELECT * FROM __fact_kernel_old_bus_publication_delivery WHERE settled=1`)) {
      insertReceipt(db, "bus_publication_delivery_receipt", ["id", "occurrence_id", "phase", "subscriber_id", "outcome", "error", "retry_at", "time_created"], [
        Identifier.deterministic("call", `bus-delivery-migration\0${row.occurrence_id}\0${row.phase}\0${row.subscriber_id}`),
        row.occurrence_id, row.phase, row.subscriber_id, "succeeded", null, null, row.time_updated ?? row.time_created,
      ])
    }
  }
}

function migrateEventOccurrences(db: RawDatabase): void {
  if (!exists(db, "__fact_kernel_old_event_job_fire")) return
  const legacyColumns = columns(db, "__fact_kernel_old_event_job_fire")
  if (!legacyColumns.includes("event_occurrence_id")) return
  for (const row of rows<{ event_occurrence_id: string; project_id?: string; event_type?: string; time_created: number }>(db, `SELECT event_occurrence_id,${legacyColumns.includes("project_id") ? "project_id" : "NULL AS project_id"},${legacyColumns.includes("event_type") ? "event_type" : "NULL AS event_type"},time_created FROM __fact_kernel_old_event_job_fire`)) {
    const outbox = rows<{ occurrence_id: string }>(db, `SELECT occurrence_id FROM bus_publication_outbox WHERE occurrence_id=${literal(row.event_occurrence_id)}`)[0]
    if (!outbox && (!row.project_id || !row.event_type)) throw new Error(`Legacy Event occurrence ${row.event_occurrence_id} has no exact durable input authority`)
    if (!outbox) throw new Error(`Legacy Event occurrence ${row.event_occurrence_id} has no persisted properties and cannot be migrated without inventing input`)
    insertReceipt(db, "event_occurrence", ["id","bus_outbox_id","project_id","event_type","properties","time_created"], [row.event_occurrence_id,row.event_occurrence_id,null,null,null,row.time_created])
  }
}

function migrateLifecycleAndIngress(db: RawDatabase): void {
  if (!exists(db, "__fact_kernel_old_engine_task")) return
  const tasks = rows<any>(db, `SELECT * FROM __fact_kernel_old_engine_task ORDER BY time_created,id`)
  for (const task of tasks) {
    const occurrences = new Set<number>([task.time_started])
    if (exists(db, "engine_artifact")) {
      for (const row of rows<{ started: number }>(db,
        `SELECT json_extract(payload,'$.task_occurrence_started_at') AS started FROM engine_artifact WHERE kind='task_root_ingress' AND task_id=${literal(task.id)}`,
      )) if (Number.isSafeInteger(row.started) && row.started > 0) occurrences.add(row.started)
    }
    for (const row of rows<{ opened: number }>(db, `
      SELECT emitted_at AS opened FROM protocol_event
      WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}
        AND type IN ('task.execution.opened','task.execution.reopened')
    `)) if (Number.isSafeInteger(row.opened) && row.opened > 0) occurrences.add(row.opened)
    const ordered = [...occurrences].toSorted((a, b) => a - b)
    const epochByStarted = new Map(ordered.map((started, index) => [started, index + 1]))
    const existingOpenRows = rows<{ id: string; epoch: number }>(db, `
      SELECT id,CAST(json_extract(payload,'$.execution_epoch') AS INTEGER) AS epoch
      FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}
        AND type IN ('task.execution.opened','task.execution.reopened')
    `)
    const existingOpenEpochs = new Set(existingOpenRows.map((row) => row.epoch))
    if (existingOpenRows.some((row) => !Number.isSafeInteger(row.epoch) || row.epoch <= 0) || existingOpenEpochs.size !== existingOpenRows.length) {
      throw new Error(`Task ${task.id} has ambiguous existing lifecycle opens`)
    }
    if ([...existingOpenEpochs].some((epoch) => epoch > ordered.length)) {
      throw new Error(`Task ${task.id} has lifecycle epoch beyond its exact legacy occurrences`)
    }
    for (let index = 0; index < ordered.length; index++) {
      const epoch = index + 1
      if (!existingOpenEpochs.has(epoch)) {
        const type = epoch === 1 ? "task.execution.opened" : "task.execution.reopened"
        const id = Identifier.deterministic("protocol_event", `task-lifecycle-open\0${task.id}\0${epoch}`)
        const emittedAt = ordered[index]!
        const seq = (rows<{ seq: number }>(db, `SELECT coalesce(max(seq),0)+1 AS seq FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}`)[0]?.seq ?? 1)
        insertReceipt(db, "protocol_event", [
          "id","kind","type","aggregate_type","aggregate_id","task_id","session_id","source","seq","emitted_at","payload",
        ], [
          id,"event",type,"task",task.id,null,task.session_id,"storage.fact-kernel-migration",seq, emittedAt,
          JSON.stringify({ execution_epoch: epoch }),
        ])
      }
    }
    const currentEpoch = epochByStarted.get(task.time_started) ?? ordered.length
    const terminal = rows<{ id: string }>(db,
      `SELECT id FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}
        AND type IN ('task.completed','task.failed','task.cancelled','task.closed')
        AND CAST(json_extract(payload,'$.execution_epoch') AS INTEGER)=${currentEpoch}
        ORDER BY seq DESC LIMIT 1`,
    )[0]
    if (!terminal && task.time_completed) {
      const metadata = task.metadata ? JSON.parse(task.metadata) : {}
      const status = metadata?.cancelled === true ? "cancelled" : task.error ? "failed" : "completed"
      const type = `task.${status}`
      const seq = (rows<{ seq: number }>(db, `SELECT coalesce(max(seq),0)+1 AS seq FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}`)[0]?.seq ?? 1)
      const id = Identifier.deterministic("protocol_event", `task-lifecycle-terminal\0${task.id}\0${currentEpoch}`)
      insertReceipt(db, "protocol_event", [
        "id","kind","type","aggregate_type","aggregate_id","task_id","session_id","source","seq","emitted_at","payload",
      ], [
        id,"event",type,"task",task.id,null,task.session_id,"storage.fact-kernel-migration",seq,task.time_completed,
        JSON.stringify({ execution_epoch: currentEpoch, summary: task.title, ...(task.error ? { error: task.error } : {}), ...(metadata?.interrupted ? { terminalReason: "interrupted" } : {}) }),
      ])
    }
    const aggregateEvents = rows<{ id: string }>(db, `
      SELECT id FROM protocol_event
      WHERE aggregate_type='task' AND aggregate_id=${literal(task.id)}
      ORDER BY emitted_at,
        CASE WHEN type IN ('task.execution.opened','task.execution.reopened') THEN 0 ELSE 1 END,
        seq,id
    `)
    aggregateEvents.forEach((event, index) => run(db, `UPDATE protocol_event SET seq=? WHERE id=?`, -(index + 1), event.id))
    aggregateEvents.forEach((event, index) => run(db, `UPDATE protocol_event SET seq=? WHERE id=?`, index + 1, event.id))
  }

  if (exists(db, "engine_artifact")) {
    const ingressRows = rows<any>(db, `SELECT id,task_id,payload,time_created FROM engine_artifact WHERE kind='task_root_ingress' ORDER BY task_id,time_created,id`)
    const sequence = new Map<string, number>()
    for (const row of ingressRows) {
      const payload = JSON.parse(row.payload)
      const taskKey = `${row.task_id}\0${payload.task_occurrence_started_at}`
      const next = (sequence.get(taskKey) ?? 0) + 1
      sequence.set(taskKey, next)
      const sourceKind = typeof payload.source_kind === "string" ? payload.source_kind.trim() : ""
      if (!sourceKind) throw new Error(`Legacy Task-root ingress ${row.id} has no typed source_kind`)
      const parsedEvent = OrchestratorEventSchema.safeParse(payload.event)
      if (!parsedEvent.success) throw new Error(`Legacy Task-root ingress ${row.id} has no exact typed event payload: ${parsedEvent.error.message}`)
      let source: "message" | "protocol_event" | "engine_artifact" | "task" | "automation_run" | "inline"
      let sourceID: string
      if (["operator_message", "orchestrator_message", "mission_message", "mission_acceptance_resume"].includes(sourceKind)) {
        if (typeof payload.message_id !== "string" || !payload.message_id) throw new Error(`Legacy ${sourceKind} ingress ${row.id} has no Message identity`)
        source = "message"
        sourceID = payload.message_id
      } else if (sourceKind === "agent_lifecycle_delivery") {
        if (typeof payload.lifecycle_event_id !== "string" || !payload.lifecycle_event_id) throw new Error(`Legacy lifecycle ingress ${row.id} has no Protocol Event identity`)
        source = "protocol_event"
        sourceID = payload.lifecycle_event_id
      } else if (sourceKind === "task_creation") {
        if (payload.task_creation_id !== row.task_id) throw new Error(`Legacy Task creation ingress ${row.id} conflicts with Task identity`)
        source = "task"
        sourceID = row.task_id
      } else if (sourceKind === "coordination_request") {
        if (typeof payload.request_id !== "string" || !payload.request_id) throw new Error(`Legacy coordination ingress ${row.id} has no Artifact identity`)
        source = "engine_artifact"
        sourceID = payload.request_id
      } else if (sourceKind === "infrastructure_recovery") {
        if (typeof payload.recovery_fact_id !== "string" || !payload.recovery_fact_id) throw new Error(`Legacy recovery ingress ${row.id} has no Artifact identity`)
        source = "engine_artifact"
        sourceID = payload.recovery_fact_id
      } else if (sourceKind === "dispatch_infrastructure_failure") {
        if (typeof payload.infrastructure_fact_id !== "string" || !payload.infrastructure_fact_id) throw new Error(`Legacy dispatch failure ingress ${row.id} has no Artifact identity`)
        source = "engine_artifact"
        sourceID = payload.infrastructure_fact_id
      } else if (sourceKind === "task_wait_wake") {
        const fireID = payload.event?.taskWaitWake?.fireID
        if (typeof fireID !== "string" || !fireID) throw new Error(`Legacy Task wait ingress ${row.id} has no exact fire identity`)
        const run = rows<{ id: string }>(db, `SELECT id FROM automation_run WHERE fire_id=${literal(fireID)}`)
        if (run.length !== 1) throw new Error(`Legacy Task wait ingress ${row.id} cannot resolve one Automation run for fire ${fireID}`)
        source = "automation_run"
        sourceID = run[0]!.id
      } else if (["operator_intent", "task_wait_activity", "orchestrator_event"].includes(sourceKind)) {
        source = "inline"
        sourceID = row.id
      } else {
        throw new Error(`Legacy Task-root ingress ${row.id} has unsupported source_kind ${sourceKind}`)
      }
      const policyID = Identifier.deterministic("artifact", JSON.stringify(["task-root-policy-v1",3,4,null]))
      insertReceipt(db, "engine_task_root_ingress_policy", ["id","semantic_turn_limit","activation_limit","absolute_deadline","time_created"], [policyID,3,4,null,payload.time_accepted ?? row.time_created])
      const occurrenceEpoch = rows<{ epoch: number }>(db, `
        SELECT count(*) AS epoch FROM protocol_event
        WHERE aggregate_type='task' AND aggregate_id=${literal(row.task_id)}
          AND type IN ('task.execution.opened','task.execution.reopened')
          AND emitted_at <= ${Number(payload.task_occurrence_started_at)}
      `)[0]?.epoch ?? 0
      if (!Number.isSafeInteger(occurrenceEpoch) || occurrenceEpoch <= 0) {
        throw new Error(`Legacy Task-root ingress ${row.id} cannot resolve an exact lifecycle epoch`)
      }
      insertReceipt(db, "engine_task_root_ingress", ["id","task_id","execution_epoch","sequence","source","source_id","inline_payload","policy_id","time_accepted"], [
        row.id,row.task_id,occurrenceEpoch,next,source,sourceID,source === "inline" ? JSON.stringify(parsedEvent.data) : null,policyID,payload.time_accepted ?? row.time_created,
      ])
    }
    run(db, `DELETE FROM engine_artifact WHERE kind='task_root_ingress'`)
  }
}

function validateIngressSources(db: RawDatabase): void {
  for (const ingress of rows<{ id: string; task_id: string; source: string; source_id: string; inline_payload: string | null }>(
    db,
    `SELECT id,task_id,source,source_id,inline_payload FROM engine_task_root_ingress ORDER BY task_id,execution_epoch,sequence`,
  )) {
    if (ingress.source === "inline") {
      const payload = ingress.inline_payload ? JSON.parse(ingress.inline_payload) : undefined
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error(`Task-root ingress ${ingress.id} has no object inline fact`)
      }
      continue
    }
    if (ingress.inline_payload !== null) {
      throw new Error(`Task-root ingress ${ingress.id} copies inline payload for ${ingress.source} source`)
    }
    const sourceTable = ingress.source === "message" ? "message"
      : ingress.source === "protocol_event" ? "protocol_event"
        : ingress.source === "engine_artifact" ? "engine_artifact"
          : ingress.source === "task" ? "engine_task"
            : ingress.source === "automation_run" ? "automation_run"
              : undefined
    if (!sourceTable) throw new Error(`Task-root ingress ${ingress.id} has unknown source ${ingress.source}`)
    const anchor = rows<{ id: string }>(db, `SELECT id FROM ${quote(sourceTable)} WHERE id=${literal(ingress.source_id)}`)[0]
    if (!anchor) throw new Error(`Task-root ingress ${ingress.id} references missing ${ingress.source} ${ingress.source_id}`)
    if (ingress.source === "message") {
      const aligned = rows<{ id: string }>(db, `
        SELECT message.id AS id FROM message
        JOIN engine_task ON engine_task.id=${literal(ingress.task_id)}
        WHERE message.id=${literal(ingress.source_id)} AND message.session_id=engine_task.session_id
      `)[0]
      if (!aligned) throw new Error(`Task-root ingress ${ingress.id} source Message is outside its Task root Session`)
    }
    if (ingress.source === "protocol_event") {
      const aligned = rows<{ id: string }>(db, `SELECT id FROM protocol_event WHERE id=${literal(ingress.source_id)} AND aggregate_type='task' AND aggregate_id=${literal(ingress.task_id)}`)[0]
      if (!aligned) throw new Error(`Task-root ingress ${ingress.id} source Protocol Event belongs to another Task`)
    }
    if (ingress.source === "engine_artifact") {
      const aligned = rows<{ id: string }>(db, `SELECT id FROM engine_artifact WHERE id=${literal(ingress.source_id)} AND task_id=${literal(ingress.task_id)}`)[0]
      if (!aligned) throw new Error(`Task-root ingress ${ingress.id} source Engine Artifact belongs to another Task`)
    }
    if (ingress.source === "task" && ingress.source_id !== ingress.task_id) {
      throw new Error(`Task-root ingress ${ingress.id} Task source differs from its aggregate identity`)
    }
    if (ingress.source === "automation_run") {
      const aligned = rows<{ id: string }>(db, `
        SELECT automation_run.id AS id FROM automation_run
        JOIN automation ON automation.id=automation_run.automation_revision_id
        WHERE automation_run.id=${literal(ingress.source_id)} AND automation.task_id=${literal(ingress.task_id)}
      `)[0]
      if (!aligned) throw new Error(`Task-root ingress ${ingress.id} Automation run belongs to another Task`)
    }
  }
}

function normalizeSchedulerPayloads(db: RawDatabase): void {
  for (const row of rows<{ id: string; source: string; target: string | null; payload: string }>(db, `SELECT id,source,target,payload FROM protocol_event WHERE type='scheduler.message'`)) {
    const payload = JSON.parse(row.payload)
    if (payload.protocol === "scheduler-message-v3") continue
    payload.protocol = "scheduler-message-v3"
    const endpoint = (value: string | null): any => {
      if (!value?.startsWith("scheduler-endpoint:")) return undefined
      try { return JSON.parse(value.slice("scheduler-endpoint:".length)) } catch { return undefined }
    }
    const epoch = (taskID: string | undefined, started: unknown): number | null => {
      if (!taskID || !Number.isSafeInteger(started) || Number(started) <= 0) return null
      return rows<{ epoch: number }>(db, `
        SELECT count(*) AS epoch FROM (
          SELECT DISTINCT json_extract(payload,'$.task_occurrence_started_at') AS occurrence
          FROM engine_artifact
          WHERE kind='task_root_ingress' AND task_id=${literal(taskID)}
            AND json_extract(payload,'$.task_occurrence_started_at') <= ${Number(started)}
          UNION SELECT time_started FROM __fact_kernel_old_engine_task
          WHERE id=${literal(taskID)} AND time_started <= ${Number(started)}
        )
      `)[0]?.epoch ?? 1
    }
    payload.source_task_execution_epoch = epoch(endpoint(row.source)?.task_id, payload.source_task_occurrence_started_at)
    payload.target_task_execution_epoch = epoch(endpoint(row.target)?.task_id, payload.target_task_occurrence_started_at)
    delete payload.source_task_occurrence_started_at
    delete payload.target_task_occurrence_started_at
    run(db, `UPDATE protocol_event SET payload=? WHERE id=?`, JSON.stringify(payload), row.id)
  }
}

function normalizeLifecyclePayloads(db: RawDatabase): void {
  const lifecycleTypes = new Set([
    "task.cancellation.requested", "task.close.requested", "task.cancelled",
    "task.closed", "task.completed", "task.failed",
  ])
  for (const row of rows<{ id: string; aggregate_type: string; aggregate_id: string; type: string; emitted_at: number; payload: string | null }>(db, `
    SELECT id,aggregate_type,aggregate_id,type,emitted_at,payload FROM protocol_event
  `)) {
    const payload = row.payload ? JSON.parse(row.payload) : {}
    if (
      row.aggregate_type === "task" &&
      lifecycleTypes.has(row.type) &&
      (!Number.isSafeInteger(payload.execution_epoch) || payload.execution_epoch <= 0)
    ) {
      const open = rows<{ epoch: number }>(db, `
        SELECT json_extract(payload,'$.execution_epoch') AS epoch FROM protocol_event
        WHERE aggregate_type='task' AND aggregate_id=${literal(row.aggregate_id)}
          AND type IN ('task.execution.opened','task.execution.reopened')
          AND emitted_at<=${row.emitted_at}
        ORDER BY emitted_at DESC,seq DESC,id DESC LIMIT 1
      `)[0]
      if (!Number.isSafeInteger(open?.epoch) || Number(open?.epoch) <= 0) {
        throw new Error(`Task lifecycle event ${row.id} cannot be assigned to an exact execution epoch`)
      }
      payload.execution_epoch = open!.epoch
    }
    delete payload.taskID
    delete payload.sessionID
    delete payload.interactionID
    delete payload.orderKey
    if (row.type === "task.updated") delete payload.status
    if (["task.completed", "task.failed", "task.cancelled"].includes(row.type)) delete payload.timeCompleted
    run(db, `UPDATE protocol_event SET payload=? WHERE id=?`, JSON.stringify(payload), row.id)
  }
}

function normalizeMissionClosureEvents(db: RawDatabase): void {
  for (const row of rows<{ id: string; payload: string }>(db, `SELECT id,payload FROM protocol_event WHERE type='mission.execution.closure'`)) {
    const payload = JSON.parse(row.payload)
    if (!["opened", "closing", "closed"].includes(payload.state)) {
      throw new Error(`Mission closure event ${row.id} has invalid legacy state`)
    }
    run(db, `UPDATE protocol_event SET type=?, payload=? WHERE id=?`,
      `mission.execution.${payload.state}`,
      JSON.stringify({ missionID: payload.missionID, requestID: payload.requestID }),
      row.id,
    )
  }
}

/** Atomic one-way replacement of the immediately preceding mutable control
 * schema. No compatibility reader remains after this transaction commits. */
export function migrateFactKernelSchema(sqlite: RawDatabase): boolean {
  if (!exists(sqlite, "engine_task")) return false
  const alreadyCurrent = NEW_TABLES.every((table) => exists(sqlite, table)) &&
    !columns(sqlite, "engine_task").includes("time_started") &&
    !columns(sqlite, "engine_task").includes("rewind_cursor_time") &&
    !columns(sqlite, "engine_progress_snapshot").includes("status") &&
    !columns(sqlite, "protocol_inbox").includes("status") &&
    columns(sqlite, "protocol_delivery_receipt").includes("receipt") &&
    !columns(sqlite, "part").includes("session_id") &&
    !columns(sqlite, "tool_part_request").includes("session_id") &&
    !columns(sqlite, "provider_activity_request").includes("session_id") &&
    tableDefinition(sqlite, "permission_ledger").includes("permission_ledger_request_owner_shape") &&
    exists(sqlite, "permission_execution_result") &&
    !columns(sqlite, "permission_execution_result").includes("session_id") &&
    !columns(sqlite, "permission_execution_result").includes("tool_part_id") &&
    !columns(sqlite, "permission_execution_result").includes("result_sha256") &&
    !columns(sqlite, "bus_publication_outbox").includes("exact_settled") &&
    !columns(sqlite, "automation").includes("time_updated") &&
    !columns(sqlite, "automation").includes("tombstone") &&
    exists(sqlite, "automation_definition_tombstone") &&
    !columns(sqlite, "event_job").includes("time_updated") &&
    !columns(sqlite, "event_job").includes("tombstone") &&
    exists(sqlite, "event_job_definition_tombstone") &&
    !exists(sqlite, "protocol_aggregate_sequence")
  if (alreadyCurrent) return false

  const reference = currentSchema()
  sqlite.exec("PRAGMA legacy_alter_table=ON")
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    assertLegacyDurableBusEffectsClassified(sqlite)
    for (const table of REBUILT_TABLES) rebuildTable(sqlite, reference, table)
    migratePermissionRequestOwners(sqlite)
    for (const table of NEW_TABLES) if (!exists(sqlite, table)) createCurrentTable(sqlite, reference, table, false)
    migrateChannelIngressFacts(sqlite)
    migrateDefinitionTombstones(sqlite)
    migrateToolFacts(sqlite)
    migrateProjectionReceipts(sqlite)
    migrateEventOccurrences(sqlite)
    normalizeSchedulerPayloads(sqlite)
    migrateLifecycleAndIngress(sqlite)
    migrateGitCheckpointFacts(sqlite)
    sqlite.exec(`UPDATE protocol_event SET session_id=NULL WHERE aggregate_type='session'`)
    validateIngressSources(sqlite)
    normalizeLifecyclePayloads(sqlite)
    normalizeMissionClosureEvents(sqlite)
    if (exists(sqlite, "engine_task_cancellation_authority")) sqlite.exec("DROP TABLE engine_task_cancellation_authority")
    if (exists(sqlite, "protocol_aggregate_sequence")) sqlite.exec("DROP TABLE protocol_aggregate_sequence")
    for (const table of REBUILT_TABLES.toReversed()) {
      const legacy = `__fact_kernel_old_${table}`
      if (exists(sqlite, legacy)) sqlite.exec(`DROP TABLE ${quote(legacy)}`)
    }
    for (const trigger of rows<{ name: string; sql: string | null }>(reference, `SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND sql IS NOT NULL ORDER BY name`)) {
      if (trigger.sql && !rows<{ name: string }>(sqlite, `SELECT name FROM sqlite_schema WHERE type='trigger' AND name=${literal(trigger.name)}`)[0]) sqlite.exec(trigger.sql)
    }
    sqlite.exec("COMMIT")
    return true
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  } finally {
    reference.close(true)
    sqlite.exec("PRAGMA legacy_alter_table=OFF")
  }
}
