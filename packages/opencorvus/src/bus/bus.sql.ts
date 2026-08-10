import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"
import { Timestamps } from "@/storage/schema.sql"

export type DurableBusCausation = {
  source: string
  occurrenceID: string
  ancestry: Array<{ occurrenceID: string; sourceID: string }>
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
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    directory: text().notNull(),
    event_type: text().notNull(),
    properties: text({ mode: "json" }).notNull().$type<unknown>(),
    causation: text({ mode: "json" }).$type<DurableBusCausation>(),
    exact_settled: integer({ mode: "boolean" }).notNull().default(false),
    wildcard_settled: integer({ mode: "boolean" }).notNull().default(false),
    global_settled: integer({ mode: "boolean" }).notNull().default(false),
    ...Timestamps,
    attempt_count: integer().notNull().default(0),
    next_attempt_at: integer().notNull().default(0),
    last_error: text(),
  },
  (table) => [
    index("bus_publication_outbox_project_idx").on(table.project_id, table.time_created),
    index("bus_publication_outbox_pending_idx").on(
      table.exact_settled,
      table.wildcard_settled,
      table.global_settled,
    ),
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
    durable: integer({ mode: "boolean" }).notNull(),
    settled: integer({ mode: "boolean" }).notNull().default(false),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.occurrence_id, table.phase, table.subscriber_id] }),
    index("bus_publication_delivery_pending_idx").on(table.occurrence_id, table.phase, table.settled),
  ],
)
