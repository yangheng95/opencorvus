import { queryAllFinalized } from "../../../src/storage/sqlite-statement"
import crypto from "node:crypto"
import { Database as SQLite } from "bun:sqlite"

/**
 * The isolated runtime — database included — is removed at the end of every trial, so the sealed
 * evidence directory is the only place a later analysis can look. `result.json`, the transcript,
 * and the board answer per-message questions but cannot be joined: reconstructing "which Agent
 * occurrence produced this Artifact, and what did that occurrence cost" needs the relational rows.
 * This exports exactly the identity/relationship tables for that join, and never message or part
 * payloads, which already exist as transcript evidence and would re-import Provider text.
 */
const SNAPSHOT_TABLES = [
  "engine_task",
  "engine_artifact",
  "engine_artifact_catalog_revision",
  "session",
  "provider_activity_request",
  "provider_activity_outcome",
  "provider_usage_event",
  "protocol_inbox",
  "protocol_delivery_receipt",
] as const

/**
 * Tables sealed by an explicit column list rather than `SELECT *`.
 *
 * `engine_task_root_ingress` carries `inline_payload`, a free-form JSON body
 * that can hold operator message text. The whole-table snapshot above is safe
 * only because those tables hold identities and counters; adding an ingress
 * table wholesale would quietly falsify that premise, so its body column is
 * named out here instead of being redacted after the fact.
 */
const SNAPSHOT_TABLE_COLUMNS: Record<string, string[]> = {
  worker_turn_descriptor: [
    "id",
    "task_id",
    "project_id",
    "session_id",
    "agent",
    "hash",
    "time_created",
    "time_updated",
  ],
  automation: [
    "id",
    "definition_id",
    "revision",
    "project_id",
    "session_id",
    "kind",
    "status",
    "due_at",
    "time_created",
  ],
  automation_definition_tombstone: ["id", "definition_id", "revision", "time_created"],
  automation_run: ["id", "automation_revision_id", "fire_id", "target_project_id", "started_at"],
  automation_run_receipt: ["id", "run_id", "outcome", "retry_at", "time_created"],
  engine_task_root_ingress: [
    "id",
    "task_id",
    "execution_epoch",
    "sequence",
    "source",
    "source_id",
    "policy_id",
    "time_accepted",
  ],
  engine_task_root_ingress_policy: ["id", "semantic_turn_limit", "activation_limit", "absolute_deadline"],
  engine_control_activation_lease: ["id", "target", "target_id", "owner_occurrence_id", "time_activated", "expires_at"],
}

/**
 * Message and Part evidence, projected rather than copied.
 *
 * Turn counts, decision facts and per-Artifact read counts all need these two
 * tables, and neither can be answered from the transcript alone. Copying them
 * would put a second full copy of every prompt, tool input and tool output into
 * sealed evidence, inflate the snapshot, widen the credential surface, and give
 * the run two sources of truth for the same text. Identity, shape, timing,
 * relationships, length and digest answer every counting question; the bodies
 * stay in the transcript, which is already sealed and already audited.
 */
function messageEvidenceProjection(db: SQLite) {
  const sha = (value: unknown) =>
    typeof value === "string" ? crypto.createHash("sha256").update(value).digest("hex").slice(0, 16) : null
  const messages = queryAllFinalized<Record<string, any>>(
    db,
    `SELECT id, session_id, time_created, time_updated,
              json_extract(data, '$.role')         AS role,
              json_extract(data, '$.agent')        AS agent,
              json_extract(data, '$.author')       AS author,
              json_extract(data, '$.parentID')     AS parent_id,
              json_extract(data, '$.activationID') AS activation_id,
              json_extract(data, '$.modelID')      AS model_id,
              json_extract(data, '$.providerID')   AS provider_id,
              json_extract(data, '$.finish')       AS finish,
              json_extract(data, '$.error.name')   AS error_name,
              json_extract(data, '$.time.completed') AS time_completed,
              length(data) AS data_length,
              data AS _body
         FROM message`,
  ).map(({ _body, ...row }) => ({ ...row, data_sha256: sha(_body) }))
  const parts = queryAllFinalized<Record<string, any>>(
    db,
    `SELECT id, message_id, time_created,
              json_extract(data, '$.type')         AS type,
              json_extract(data, '$.tool')         AS tool,
              json_extract(data, '$.callID')       AS call_id,
              json_extract(data, '$.state.status') AS state_status,
              json_extract(data, '$.reason')       AS reason,
              length(data) AS data_length,
              data AS _body
         FROM part`,
  ).map(({ _body, ...row }) => ({ ...row, data_sha256: sha(_body) }))
  const toolParts = queryAllFinalized<Record<string, any>>(
    db,
    `SELECT r.id, r.message_id, r.time_created, 'tool' AS type,
            json_extract(r.data, '$.tool') AS tool,
            json_extract(r.data, '$.callID') AS call_id,
            COALESCE(json_extract(o.data, '$.outcome'), 'running') AS state_status,
            length(r.data) AS data_length, r.data AS _body
       FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id = r.id`,
  ).map(({ _body, ...row }) => ({ ...row, data_sha256: sha(_body) }))
  return { message: messages, part: [...parts, ...toolParts] }
}

export function databaseSnapshot(databasePath: string, independentTranscriptSurface?: unknown[]) {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    const present = new Set(
      queryAllFinalized<{ name: string }>(db, `SELECT name FROM sqlite_master WHERE type = 'table'`).map(
        (row) => row.name,
      ),
    )
    const tables: Record<string, unknown[]> = {}
    const missing: string[] = []
    for (const table of SNAPSHOT_TABLES) {
      if (!present.has(table)) {
        missing.push(table)
        continue
      }
      tables[table] = queryAllFinalized<Record<string, unknown>>(db, `SELECT * FROM "${table}"`)
    }
    for (const [table, columns] of Object.entries(SNAPSHOT_TABLE_COLUMNS)) {
      if (!present.has(table)) {
        missing.push(table)
        continue
      }
      const available = new Set(
        queryAllFinalized<{ name: string }>(db, `PRAGMA table_info("${table}")`).map((column) => column.name),
      )
      for (const column of columns) {
        if (!available.has(column)) throw new Error(`Runtime evidence column is unavailable: ${table}.${column}`)
      }
      const projection = columns.map((column) => `"${column}"`).join(", ")
      tables[table] = queryAllFinalized<Record<string, unknown>>(db, `SELECT ${projection} FROM "${table}"`)
    }
    if (present.has("message") && present.has("part")) {
      const projected = messageEvidenceProjection(db)
      tables["message"] = projected.message
      tables["part"] = projected.part
    } else {
      if (!present.has("message")) missing.push("message")
      if (!present.has("part")) missing.push("part")
    }
    if (independentTranscriptSurface) tables["benchmark_transcript_surface"] = independentTranscriptSurface
    return {
      tables,
      missing: missing.sort(),
      requested: [...SNAPSHOT_TABLES, ...Object.keys(SNAPSHOT_TABLE_COLUMNS).sort()],
    }
  } finally {
    db.close()
  }
}
