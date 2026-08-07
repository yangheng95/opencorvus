import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core"
import { EngineTaskTable } from "@/engine/engine.sql"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export const AutomationTable = sqliteTable(
  "automation",
  {
    id: text().primaryKey(),
    project_id: text().references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    task_id: text().references(() => EngineTaskTable.id, { onDelete: "cascade" }),
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
    last_run: integer(),
    failure_count: integer().notNull().default(0),
    last_error: text(),
    lease_until: integer().notNull().default(0),
    lease_owner: text(),
    next_run: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("automation_project_idx").on(table.project_id),
    index("automation_task_idx").on(table.task_id),
    index("automation_next_run_idx").on(table.next_run),
    index("automation_lease_until_idx").on(table.lease_until),
  ],
)

export const AutomationProjectTargetTable = sqliteTable(
  "automation_project_target",
  {
    automation_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "cascade" }),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.automation_id, table.project_id] }),
    index("automation_project_target_project_idx").on(table.project_id),
  ],
)

export const AutomationRunTable = sqliteTable(
  "automation_run",
  {
    id: text().primaryKey(),
    automation_id: text()
      .notNull()
      .references(() => AutomationTable.id, { onDelete: "cascade" }),
    fire_id: text().notNull(),
    target_scope: text({ enum: ["session", "project", "global"] }).notNull(),
    project_id: text().references(() => ProjectTable.id, { onDelete: "set null" }),
    owner: text().notNull(),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    outcome: text({ enum: ["running", "succeeded", "failed"] }).notNull(),
    started_at: integer().notNull(),
    completed_at: integer(),
    error: text(),
  },
  (table) => [
    index("automation_run_automation_idx").on(table.automation_id),
    index("automation_run_fire_idx").on(table.fire_id),
    index("automation_run_project_idx").on(table.project_id),
    index("automation_run_started_at_idx").on(table.started_at),
  ],
)
