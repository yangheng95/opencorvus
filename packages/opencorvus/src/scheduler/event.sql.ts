import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

type Match = Record<string, string | number | boolean>

export const EventJobTable = sqliteTable(
  "event_job",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    name: text().notNull(),
    event_type: text().notNull(),
    match_json: text({ mode: "json" }).$type<Match>(),
    prompt: text().notNull(),
    agent: text().notNull().default("default"),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    one_shot: integer({ mode: "boolean" }).notNull().default(false),
    cooldown_ms: integer().notNull().default(0),
    last_run: integer(),
    last_event: text(),
    failure_count: integer().notNull().default(0),
    last_error: text(),
    ...Timestamps,
  },
  (table) => [
    index("event_job_project_idx").on(table.project_id),
    index("event_job_type_idx").on(table.event_type),
    index("event_job_enabled_idx").on(table.enabled),
  ],
)
