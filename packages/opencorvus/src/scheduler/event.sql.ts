import { check, sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"

type Match = Record<string, string | number | boolean>

export type EventJobFireCausationEntry = {
  fireID: string
  jobID: string
}

export const EventJobTable = sqliteTable(
  "event_job",
  {
    id: text().primaryKey(),
    definition_id: text().notNull(),
    revision: integer().notNull(),
    project_id: text().notNull(),
    session_id: text(),
    name: text().notNull(),
    event_type: text().notNull(),
    match_json: text({ mode: "json" }).$type<Match>(),
    prompt: text().notNull(),
    agent: text().notNull().default("default"),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    one_shot: integer({ mode: "boolean" }).notNull().default(false),
    cooldown_ms: integer().notNull().default(0),
    tool_part_id: text(),
    tool_input_digest: text(),
    time_created: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("event_job_definition_revision_idx").on(table.definition_id, table.revision),
    index("event_job_project_idx").on(table.project_id),
    index("event_job_type_idx").on(table.event_type),
    index("event_job_enabled_idx").on(table.enabled),
    uniqueIndex("event_job_tool_occurrence_idx")
      .on(table.tool_part_id)
      .where(sql`${table.tool_part_id} IS NOT NULL`),
    check("event_job_tool_causation_shape", sql`
      (${table.tool_part_id} IS NULL AND ${table.tool_input_digest} IS NULL)
      OR (${table.tool_part_id} IS NOT NULL AND ${table.tool_input_digest} IS NOT NULL)
    `),
  ],
)

/** Minimal immutable deletion boundary; no definition fields are copied. */
export const EventJobDefinitionTombstoneTable = sqliteTable(
  "event_job_definition_tombstone",
  {
    id: text().primaryKey(),
    definition_id: text().notNull(),
    revision: integer().notNull(),
    tool_part_id: text(),
    tool_input_digest: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("event_job_definition_tombstone_revision_idx").on(table.definition_id, table.revision),
    index("event_job_definition_tombstone_latest_idx").on(table.definition_id, table.revision),
    uniqueIndex("event_job_definition_tombstone_tool_occurrence_idx")
      .on(table.tool_part_id)
      .where(sql`${table.tool_part_id} IS NOT NULL`),
    check("event_job_tombstone_tool_causation_shape", sql`
      (${table.tool_part_id} IS NULL AND ${table.tool_input_digest} IS NULL)
      OR (${table.tool_part_id} IS NOT NULL AND ${table.tool_input_digest} IS NOT NULL)
    `),
  ],
)

export const EventOccurrenceTable = sqliteTable(
  "event_occurrence",
  {
    id: text().primaryKey(),
    bus_outbox_id: text().references(() => BusPublicationOutboxTable.occurrence_id, { onDelete: "restrict" }),
    project_id: text(),
    event_type: text(),
    properties: text({ mode: "json" }).$type<unknown>(),
    time_created: integer().notNull(),
  },
  (table) => [
    check("event_occurrence_owner_shape", sql`
      (${table.bus_outbox_id} IS NOT NULL AND ${table.project_id} IS NULL AND ${table.event_type} IS NULL AND ${table.properties} IS NULL)
      OR (${table.bus_outbox_id} IS NULL AND ${table.project_id} IS NOT NULL AND ${table.event_type} IS NOT NULL AND ${table.properties} IS NOT NULL)
    `),
  ],
)

export const EventJobFireTable = sqliteTable(
  "event_job_fire",
  {
    id: text().primaryKey(),
    event_job_revision_id: text().notNull().references(() => EventJobTable.id, { onDelete: "restrict" }),
    event_occurrence_id: text().notNull().references(() => EventOccurrenceTable.id, { onDelete: "restrict" }),
    causation_fire_id: text(),
    /** Present only when this fire pre-allocates a new Session. Existing
     * Session targets are owned by the exact definition revision. */
    created_session_id: text(),
    /** Exact Mission occurrence captured when this fire is created. Null for
     * non-Mission targets. Recovery must never bind the fire to a reopen. */
    mission_opened_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    mission_disposition: text({ enum: ["mission_closed"] }),
    mission_closure_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("event_job_fire_occurrence_idx").on(table.event_job_revision_id, table.event_occurrence_id),
    index("event_job_fire_causation_idx").on(table.causation_fire_id),
    index("event_job_fire_target_session_idx").on(table.created_session_id),
    check("event_job_fire_mission_reservation_shape", sql`
      (${table.mission_opened_event_id} IS NULL AND ${table.mission_disposition} IS NULL AND ${table.mission_closure_event_id} IS NULL)
      OR (${table.mission_opened_event_id} IS NOT NULL AND ${table.mission_disposition} IS NULL AND ${table.mission_closure_event_id} IS NULL)
      OR (${table.mission_opened_event_id} IS NULL AND ${table.mission_disposition}='mission_closed' AND ${table.mission_closure_event_id} IS NOT NULL)
    `),
  ],
)

export const EventJobFireReceiptTable = sqliteTable(
  "event_job_fire_receipt",
  {
    id: text().primaryKey(),
    fire_id: text().notNull().references(() => EventJobFireTable.id, { onDelete: "cascade" }),
    outcome: text({ enum: ["retry_wait", "succeeded", "disposition"] }).notNull(),
    disposition: text({ enum: ["causal_cycle", "cooldown", "job_disabled", "mission_closed"] }),
    closure_event_id: text().references(() => ProtocolEventTable.id, { onDelete: "restrict" }),
    message_id: text(),
    retry_at: integer(),
    error: text(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("event_job_fire_receipt_fire_idx").on(table.fire_id, table.time_created),
    uniqueIndex("event_job_fire_terminal_receipt_idx").on(table.fire_id)
      .where(sql`${table.outcome} <> 'retry_wait'`),
    check("event_job_fire_receipt_shape", sql`
      (${table.outcome}='retry_wait' AND ${table.disposition} IS NULL AND ${table.closure_event_id} IS NULL AND ${table.message_id} IS NULL AND ${table.retry_at} IS NOT NULL AND ${table.error} IS NOT NULL)
      OR (${table.outcome}='succeeded' AND ${table.disposition} IS NULL AND ${table.closure_event_id} IS NULL AND ${table.message_id} IS NOT NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
      OR (${table.outcome}='disposition' AND ${table.disposition} IN ('causal_cycle','cooldown','job_disabled') AND ${table.closure_event_id} IS NULL AND ${table.message_id} IS NULL AND ${table.retry_at} IS NULL)
      OR (${table.outcome}='disposition' AND ${table.disposition}='mission_closed' AND ${table.closure_event_id} IS NOT NULL AND ${table.message_id} IS NULL AND ${table.retry_at} IS NULL AND ${table.error} IS NULL)
    `),
  ],
)
