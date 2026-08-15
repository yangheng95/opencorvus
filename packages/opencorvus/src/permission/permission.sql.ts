import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"

export type PermissionMode = "full_access" | "ask"
export type PermissionEventType =
  | "requested"
  | "allowed_once"
  | "grant_created"
  | "grant_used"
  | "denied"
  | "expired"
  | "revoked"
  | "cancelled"
  | "stale"
  | "execution_started"
  | "mcp_task_created"
  | "mcp_task_status"
  | "execution_succeeded"
  | "execution_failed"
  | "outcome_unknown"
  | "execution_reconciled"

export const PermissionPolicyTable = sqliteTable(
  "permission_policy",
  {
    // Immutable policy evidence outlives physical Session retention.
    session_id: text().primaryKey(),
    project_id: text().notNull().references(() => ProjectTable.id, { onDelete: "cascade" }),
    mode: text().notNull().$type<PermissionMode>(),
    revision: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [index("permission_policy_project_idx").on(table.project_id, table.time_created)],
)

/** Append-only operator authorization and execution evidence. */
export const PermissionLedgerTable = sqliteTable(
  "permission_ledger",
  {
    id: text().primaryKey(),
    request_id: text().notNull(),
    project_id: text().references(() => ProjectTable.id, { onDelete: "cascade" }),
    // Intentionally not a foreign key: authorization evidence outlives the
    // Session row it describes.
    session_id: text(),
    task_id: text(),
    message_id: text(),
    tool_call_id: text(),
    attempt_id: text(),
    event_type: text().notNull().$type<PermissionEventType>(),
    mode: text().$type<PermissionMode>(),
    policy_revision: text(),
    provider_kind: text(),
    provider_id: text(),
    provider_digest: text(),
    tool_name: text(),
    effect_class: text(),
    scope_version: text(),
    scope: text({ mode: "json" }).$type<Record<string, unknown>>(),
    fingerprint: text(),
    summary: text(),
    decision_scope: text(),
    source_event_id: text(),
    decision_slot: text(),
    outcome_slot: text(),
    actor_id: text(),
    reason: text(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("permission_ledger_project_time_idx").on(table.project_id, table.time_created),
    index("permission_ledger_request_idx").on(table.request_id, table.time_created),
    index("permission_ledger_fingerprint_idx").on(table.project_id, table.fingerprint, table.time_created),
    index("permission_ledger_session_idx").on(table.session_id, table.time_created),
    uniqueIndex("permission_ledger_decision_slot_idx").on(table.decision_slot),
    uniqueIndex("permission_ledger_attempt_start_idx")
      .on(table.attempt_id)
      .where(sql`${table.event_type} = 'execution_started'`),
    uniqueIndex("permission_ledger_outcome_slot_idx").on(table.outcome_slot),
    check("permission_ledger_request_owner_shape", sql`
      (${table.event_type}='requested'
        AND ${table.project_id} IS NOT NULL AND ${table.session_id} IS NOT NULL
        AND ${table.message_id} IS NOT NULL AND ${table.tool_call_id} IS NOT NULL
        AND ${table.mode} IS NOT NULL AND ${table.policy_revision} IS NOT NULL
        AND ${table.provider_kind} IS NOT NULL AND ${table.provider_id} IS NOT NULL
        AND ${table.provider_digest} IS NOT NULL AND ${table.tool_name} IS NOT NULL
        AND ${table.effect_class} IS NOT NULL AND ${table.scope_version} IS NOT NULL
        AND ${table.scope} IS NOT NULL AND ${table.fingerprint} IS NOT NULL AND ${table.summary} IS NOT NULL)
      OR
      (${table.event_type}<>'requested'
        AND ${table.project_id} IS NULL AND ${table.session_id} IS NULL AND ${table.task_id} IS NULL
        AND ${table.message_id} IS NULL AND ${table.tool_call_id} IS NULL
        AND ${table.mode} IS NULL AND ${table.policy_revision} IS NULL
        AND ${table.provider_kind} IS NULL AND ${table.provider_id} IS NULL
        AND ${table.provider_digest} IS NULL AND ${table.tool_name} IS NULL
        AND ${table.effect_class} IS NULL AND ${table.scope_version} IS NULL
        AND ${table.scope} IS NULL AND ${table.fingerprint} IS NULL AND ${table.summary} IS NULL)
    `),
  ],
)

/** Canonical Tool result payload, owned by the Session/ToolPart lifecycle rather than the permission audit log. */
export const PermissionExecutionResultTable = sqliteTable(
  "permission_execution_result",
  {
    attempt_id: text().primaryKey(),
    // The attempt deterministically locates the request and Tool outcome. This
    // row owns only the otherwise unrecoverable external result payload.
    result: text({ mode: "json" }).notNull().$type<unknown>(),
    time_created: integer().notNull(),
  },
)
