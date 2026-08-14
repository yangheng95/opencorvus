import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"
import { SessionTable } from "@/session/session.sql"

export type PermissionMode = "full_access" | "ask"
export type PermissionEventType =
  | "policy_migrated"
  | "requested"
  | "allowed_once"
  | "grant_created"
  | "grant_used"
  | "denied"
  | "expired"
  | "revoked"
  | "cancelled"
  | "stale"
  | "full_access"
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
    session_id: text()
      .primaryKey()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
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
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    // Intentionally not a foreign key: authorization evidence outlives the
    // Session row it describes.
    session_id: text().notNull(),
    task_id: text(),
    message_id: text().notNull(),
    tool_call_id: text().notNull(),
    attempt_id: text(),
    event_type: text().notNull().$type<PermissionEventType>(),
    mode: text().notNull().$type<PermissionMode>(),
    policy_revision: text().notNull(),
    provider_kind: text().notNull(),
    provider_id: text().notNull(),
    provider_digest: text().notNull(),
    tool_name: text().notNull(),
    effect_class: text().notNull(),
    scope_version: text().notNull(),
    scope: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    fingerprint: text().notNull(),
    summary: text().notNull(),
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
  ],
)

/** Canonical Tool result payload, owned by the Session/ToolPart lifecycle rather than the permission audit log. */
export const PermissionExecutionResultTable = sqliteTable(
  "permission_execution_result",
  {
    attempt_id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    tool_part_id: text().notNull(),
    result: text({ mode: "json" }).notNull().$type<unknown>(),
    result_sha256: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [index("permission_execution_result_session_idx").on(table.session_id, table.time_created)],
)
