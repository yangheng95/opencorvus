import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { Timestamps } from "@/storage/schema.sql"

export type DurableBusCausation = {
  source: string
  occurrenceID: string
}

/**
 * One durable publication authority. The source mutation and this row are
 * committed by the same SQLite transaction; phase receipts are advanced only
 * after the corresponding physical subscribers settle successfully.
 */
export const BusPublicationOutboxTable = sqliteTable(
  "bus_publication_outbox",
  {
    occurrence_id: text().primaryKey(),
    project_id: text().notNull(),
    directory: text().notNull(),
    event_type: text().notNull(),
    properties: text({ mode: "json" }).notNull().$type<unknown>(),
    causation: text({ mode: "json" }).$type<DurableBusCausation>(),
    time_created: integer().notNull(),
  },
  (table) => [
    check("bus_publication_outbox_task_status_is_projection", sql`${table.event_type} <> 'task.updated' OR json_type(${table.properties}, '$.status') IS NULL`),
    index("bus_publication_outbox_project_idx").on(table.project_id, table.time_created),
  ],
)

export const BusPublicationDeliveryTable = sqliteTable(
  "bus_publication_delivery",
  {
    occurrence_id: text()
      .notNull()
      .references(() => BusPublicationOutboxTable.occurrence_id, { onDelete: "cascade" }),
    phase: text({ enum: ["exact", "wildcard", "global"] }).notNull(),
    subscriber_id: text().notNull(),
    effect_contract: text({ enum: ["idempotent_by_occurrence"] }),
    time_created: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.occurrence_id, table.phase, table.subscriber_id] }),
    index("bus_publication_delivery_phase_idx").on(table.occurrence_id, table.phase),
  ],
)

export const BusPublicationDeliveryReceiptTable = sqliteTable(
  "bus_publication_delivery_receipt",
  {
    id: text().primaryKey(),
    occurrence_id: text().notNull(),
    phase: text({ enum: ["exact", "wildcard", "global"] }).notNull(),
    subscriber_id: text().notNull(),
    outcome: text({ enum: ["succeeded", "ignored", "failed"] }).notNull(),
    error: text(),
    retry_at: integer(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("bus_publication_delivery_receipt_idx").on(table.occurrence_id, table.phase, table.subscriber_id, table.time_created),
    check("bus_publication_delivery_receipt_shape", sql`
      (${table.outcome}='succeeded' AND ${table.error} IS NULL AND ${table.retry_at} IS NULL)
      OR (${table.outcome}='ignored' AND ${table.retry_at} IS NULL)
      OR (${table.outcome}='failed' AND ${table.error} IS NOT NULL AND ${table.retry_at} IS NULL)
    `),
    uniqueIndex("bus_publication_delivery_terminal_idx").on(table.occurrence_id, table.phase, table.subscriber_id)
      .where(sql`${table.outcome} IN ('succeeded','ignored')`),
  ],
)

export const BusPublicationPhaseReceiptTable = sqliteTable(
  "bus_publication_phase_receipt",
  {
    id: text().primaryKey(),
    occurrence_id: text().notNull().references(() => BusPublicationOutboxTable.occurrence_id, { onDelete: "cascade" }),
    phase: text({ enum: ["exact", "wildcard", "global"] }).notNull(),
    time_created: integer().notNull(),
  },
  (table) => [uniqueIndex("bus_publication_phase_receipt_idx").on(table.occurrence_id, table.phase)],
)

export const BusPublicationAttemptReceiptTable = sqliteTable(
  "bus_publication_attempt_receipt",
  {
    id: text().primaryKey(),
    occurrence_id: text().notNull().references(() => BusPublicationOutboxTable.occurrence_id, { onDelete: "cascade" }),
    error: text().notNull(),
    retry_at: integer().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [index("bus_publication_attempt_receipt_idx").on(table.occurrence_id, table.time_created)],
)
