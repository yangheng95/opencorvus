import { check, sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"

export const AutomationTable = sqliteTable(
  "automation",
  {
    /** Physical immutable definition revision identity. The first revision may
     * equal definition_id; later revisions receive fresh identities. */
    id: text().primaryKey(),
    definition_id: text().notNull(),
    revision: integer().notNull(),
    project_id: text(),
    session_id: text(),
    name: text().notNull(),
    kind: text({ enum: ["recurring", "delay"] }).notNull(),
    scope: text({ enum: ["session", "project", "global"] }),
    recurrence: text(),
    execution_mode: text({ enum: ["local", "worktree"] })
      .notNull()
      .default("local"),
    model_provider_id: text(),
    model_id: text(),
    reasoning_effort: text(),
    surface: text(),
    prompt: text().notNull(),
    agent: text().notNull().default("default"),
    status: text({ enum: ["active", "paused"] })
      .notNull()
      .default("active"),
    /** Immutable absolute deadline for one-shot delay definitions. Recurring
     * due time is reduced from recurrence, definition time, and run receipts. */
    due_at: integer(),
    tool_part_id: text(),
    tool_input_digest: text(),
    time_created: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("automation_definition_revision_idx").on(table.definition_id, table.revision),
    index("automation_definition_latest_idx").on(table.definition_id, table.revision),
    index("automation_session_delay_frontier_idx").on(
      table.session_id,
      table.kind,
      table.status,
      table.definition_id,
      table.revision,
      table.id,
    ),
    index("automation_project_idx").on(table.project_id),
    index("automation_due_at_idx").on(table.due_at),
    uniqueIndex("automation_definition_tool_occurrence_idx")
      .on(table.tool_part_id)
      .where(sql`${table.tool_part_id} IS NOT NULL`),
    check("automation_definition_tool_causation_shape", sql`
      (${table.tool_part_id} IS NULL AND ${table.tool_input_digest} IS NULL)
      OR (${table.tool_part_id} IS NOT NULL AND ${table.tool_input_digest} IS NOT NULL)
    `),
  ],
)

/** Minimal immutable deletion boundary for one Automation definition. All
 * configuration remains owned only by the preceding definition revision. */
export const AutomationDefinitionTombstoneTable = sqliteTable(
  "automation_definition_tombstone",
  {
    id: text().primaryKey(),
    definition_id: text().notNull(),
    revision: integer().notNull(),
    tool_part_id: text(),
    tool_input_digest: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("automation_definition_tombstone_revision_idx").on(table.definition_id, table.revision),
    index("automation_definition_tombstone_latest_idx").on(table.definition_id, table.revision),
    uniqueIndex("automation_definition_tombstone_tool_occurrence_idx")
      .on(table.tool_part_id)
      .where(sql`${table.tool_part_id} IS NOT NULL`),
    check("automation_tombstone_tool_causation_shape", sql`
      (${table.tool_part_id} IS NULL AND ${table.tool_input_digest} IS NULL)
      OR (${table.tool_part_id} IS NOT NULL AND ${table.tool_input_digest} IS NOT NULL)
    `),
  ],
)

export const AutomationProjectTargetTable = sqliteTable(
  "automation_project_target",
  {
    automation_revision_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "cascade" }),
    project_id: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.automation_revision_id, table.project_id] }),
    index("automation_project_target_project_idx").on(table.project_id),
  ],
)

export const AutomationRunOutcomes = ["running", "retry_wait", "succeeded", "failed", "disposition"] as const

/** One immutable logical Automation fire. Retries and fan-out target runs
 * remain children of this fact; only manual Tool fires carry Tool causation. */
export const AutomationFireTable = sqliteTable(
  "automation_fire",
  {
    id: text().primaryKey(),
    automation_revision_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "restrict" }),
    scheduled_due_at: integer().notNull(),
    origin: text({ enum: ["scheduled", "manual_api", "manual_tool"] }).notNull(),
    tool_part_id: text(),
    input_digest: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("automation_fire_scheduled_occurrence_idx")
      .on(table.automation_revision_id, table.scheduled_due_at)
      .where(sql`${table.origin}='scheduled'`),
    uniqueIndex("automation_fire_tool_occurrence_idx")
      .on(table.tool_part_id)
      .where(sql`${table.tool_part_id} IS NOT NULL`),
    index("automation_fire_revision_frontier_idx").on(
      table.automation_revision_id,
      table.scheduled_due_at,
      table.time_created,
      table.id,
    ),
    index("automation_fire_due_idx").on(table.scheduled_due_at),
    check("automation_fire_origin_shape", sql`
      (${table.origin}='scheduled' AND ${table.tool_part_id} IS NULL AND ${table.input_digest} IS NULL)
      OR (${table.origin}='manual_api' AND ${table.tool_part_id} IS NULL AND ${table.input_digest} IS NULL)
      OR (${table.origin}='manual_tool' AND ${table.tool_part_id} IS NOT NULL AND ${table.input_digest} IS NOT NULL)
    `),
  ],
)

/** One physical claim of a logical fire. Capacity waiting and owner takeover
 * create new attempts without changing fire identity. */
export const AutomationFireAttemptTable = sqliteTable(
  "automation_fire_attempt",
  {
    id: text().primaryKey(),
    fire_id: text().notNull().references(() => AutomationFireTable.id, { onDelete: "restrict" }),
    ordinal: integer().notNull(),
    owner_occurrence_id: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("automation_fire_attempt_ordinal_idx").on(table.fire_id, table.ordinal),
    index("automation_fire_attempt_owner_idx").on(table.owner_occurrence_id),
    check("automation_fire_attempt_positive_ordinal", sql`${table.ordinal}>0`),
  ],
)

export const AutomationFireAttemptReceiptTable = sqliteTable(
  "automation_fire_attempt_receipt",
  {
    attempt_id: text()
      .primaryKey()
      .references(() => AutomationFireAttemptTable.id, { onDelete: "restrict" }),
    outcome: text({ enum: ["reserved", "retry_wait", "failed"] }).notNull(),
    retry_at: integer(),
    error: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    check("automation_fire_attempt_receipt_shape", sql`
      (${table.outcome}='reserved' AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
      OR (${table.outcome}='retry_wait' AND ${table.retry_at} IS NOT NULL AND ${table.error} IS NOT NULL)
      OR (${table.outcome}='failed' AND ${table.retry_at} IS NULL AND ${table.error} IS NOT NULL)
    `),
  ],
)

export const AutomationRunTable = sqliteTable(
  "automation_run",
  {
    id: text().primaryKey(),
    automation_revision_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "restrict" }),
    fire_id: text()
      .notNull()
      .references(() => AutomationFireTable.id, { onDelete: "restrict" }),
    /** Only the branch-specific choice that is not owned by the exact
     * definition revision. Null for Session/global/delay definitions. */
    target_project_id: text(),
    /** Exact Mission occurrence captured when this target run is reserved.
     * Null for non-Mission targets. Retries must never resolve this again. */
    mission_opened_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    /** Terminal-at-reservation Mission targets carry no opened binding. The
     * exact closure disposition is frozen here and receives its terminal
     * receipt in the same writer transaction. */
    mission_disposition: text({ enum: ["mission_closed"] }),
    mission_closure_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    started_at: integer().notNull(),
  },
  (table) => [
    index("automation_run_automation_idx").on(table.automation_revision_id),
    index("automation_run_fire_idx").on(table.fire_id),
    index("automation_run_project_idx").on(table.target_project_id),
    index("automation_run_started_at_idx").on(table.started_at),
    check("automation_run_mission_reservation_shape", sql`
      (${table.mission_opened_event_id} IS NULL AND ${table.mission_disposition} IS NULL AND ${table.mission_closure_event_id} IS NULL)
      OR (${table.mission_opened_event_id} IS NOT NULL AND ${table.mission_disposition} IS NULL AND ${table.mission_closure_event_id} IS NULL)
      OR (${table.mission_opened_event_id} IS NULL AND ${table.mission_disposition}='mission_closed' AND ${table.mission_closure_event_id} IS NOT NULL)
    `),
  ],
)

export const AutomationRunReceiptTable = sqliteTable(
  "automation_run_receipt",
  {
    id: text().primaryKey(),
    run_id: text().notNull().references(() => AutomationRunTable.id, { onDelete: "cascade" }),
    outcome: text({ enum: ["retry_wait", "succeeded", "failed", "disposition"] }).notNull(),
    disposition: text({ enum: ["mission_closed", "target_deleted", "superseded"] }),
    closure_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    retry_at: integer(),
    error: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("automation_run_receipt_run_idx").on(table.run_id, table.time_created),
    uniqueIndex("automation_run_terminal_receipt_idx").on(table.run_id)
      .where(sql`${table.outcome} <> 'retry_wait'`),
    check("automation_run_receipt_shape", sql`
      (${table.outcome}='retry_wait' AND ${table.disposition} IS NULL AND ${table.closure_event_id} IS NULL AND ${table.retry_at} IS NOT NULL AND ${table.error} IS NOT NULL)
      OR (${table.outcome}='succeeded' AND ${table.disposition} IS NULL AND ${table.closure_event_id} IS NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
      OR (${table.outcome}='failed' AND ${table.disposition} IS NULL AND ${table.closure_event_id} IS NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NOT NULL)
      OR (${table.outcome}='disposition' AND ${table.disposition}='mission_closed' AND ${table.closure_event_id} IS NOT NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
      OR (${table.outcome}='disposition' AND ${table.disposition} IN ('target_deleted','superseded') AND ${table.closure_event_id} IS NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
    `),
  ],
)

/** Exact Session assistant admission that settled one one-shot delay. This is
 * the durable relation between the accepted Message batch and the delay
 * occurrence; the definition tombstone remains only its current-state fold. */
export const AutomationDelaySettlementTable = sqliteTable(
  "automation_delay_settlement",
  {
    definition_id: text().primaryKey(),
    disposition: text({ enum: ["input_accepted", "due_accepted"] }).notNull(),
    assistant_message_id: text().notNull(),
    accepted_input_message_ids: text({ mode: "json" }).$type<string[]>().notNull(),
    fire_id: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("automation_delay_settlement_assistant_idx").on(table.assistant_message_id),
    check("automation_delay_settlement_shape", sql`
      (${table.disposition}='input_accepted')
      OR (${table.disposition}='due_accepted' AND ${table.fire_id} IS NOT NULL)
    `),
  ],
)
