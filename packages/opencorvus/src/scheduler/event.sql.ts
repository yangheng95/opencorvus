import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

type Match = Record<string, string | number | boolean>

export type EventJobFireCausationEntry = {
  fireID: string
  jobID: string
}

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

export const EventJobFireTable = sqliteTable(
  "event_job_fire",
  {
    id: text().primaryKey(),
    event_job_id: text().notNull(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    event_occurrence_id: text().notNull(),
    event_type: text().notNull(),
    causation_fire_id: text(),
    causation_ancestry: text({ mode: "json" }).notNull().$type<EventJobFireCausationEntry[]>(),
    status: text({ enum: ["pending", "running", "retry_wait", "succeeded", "disposition"] }).notNull(),
    disposition: text({ enum: ["causal_cycle", "cooldown", "job_disabled"] }),
    target_session_id: text().notNull(),
    creates_session: integer({ mode: "boolean" }).notNull(),
    message_id: text(),
    owner_id: text(),
    owner_process_id: integer(),
    lease_until: integer().notNull().default(0),
    attempt: integer().notNull().default(0),
    error: text(),
    time_started: integer(),
    time_completed: integer(),
    ...Timestamps,
  },
  (table) => [
    uniqueIndex("event_job_fire_occurrence_idx").on(table.event_job_id, table.event_occurrence_id),
    index("event_job_fire_project_status_idx").on(table.project_id, table.status),
    index("event_job_fire_causation_idx").on(table.causation_fire_id),
    index("event_job_fire_target_session_idx").on(table.target_session_id),
  ],
)
