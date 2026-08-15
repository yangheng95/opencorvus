import { check, sqliteTable, text, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { EngineTaskTable } from "@/engine/engine.sql"
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
    task_id: text(),
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
    time_created: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("automation_definition_revision_idx").on(table.definition_id, table.revision),
    index("automation_definition_latest_idx").on(table.definition_id, table.revision),
    index("automation_project_idx").on(table.project_id),
    index("automation_task_idx").on(table.task_id),
    index("automation_due_at_idx").on(table.due_at),
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
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("automation_definition_tombstone_revision_idx").on(table.definition_id, table.revision),
    index("automation_definition_tombstone_latest_idx").on(table.definition_id, table.revision),
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

export const AutomationRunOutcomes = ["running", "retry_wait", "succeeded", "failed"] as const

export const AutomationRunTable = sqliteTable(
  "automation_run",
  {
    id: text().primaryKey(),
    automation_revision_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "restrict" }),
    fire_id: text().notNull(),
    /** Only the branch-specific choice that is not owned by the exact
     * definition revision. Null for Session/global/delay definitions. */
    target_project_id: text(),
    started_at: integer().notNull(),
  },
  (table) => [
    index("automation_run_automation_idx").on(table.automation_revision_id),
    index("automation_run_fire_idx").on(table.fire_id),
    index("automation_run_project_idx").on(table.target_project_id),
    index("automation_run_started_at_idx").on(table.started_at),
  ],
)

export const AutomationRunReceiptTable = sqliteTable(
  "automation_run_receipt",
  {
    id: text().primaryKey(),
    run_id: text().notNull().references(() => AutomationRunTable.id, { onDelete: "cascade" }),
    outcome: text({ enum: ["retry_wait", "succeeded", "failed"] }).notNull(),
    retry_at: integer(),
    error: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("automation_run_receipt_run_idx").on(table.run_id, table.time_created),
    uniqueIndex("automation_run_terminal_receipt_idx").on(table.run_id)
      .where(sql`${table.outcome} <> 'retry_wait'`),
    check("automation_run_receipt_shape", sql`
      (${table.outcome}='retry_wait' AND ${table.retry_at} IS NOT NULL AND ${table.error} IS NOT NULL)
      OR (${table.outcome}='succeeded' AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
      OR (${table.outcome}='failed' AND ${table.retry_at} IS NULL AND ${table.error} IS NOT NULL)
    `),
  ],
)
