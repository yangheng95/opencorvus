import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"

export const ChannelIngressAcceptedTable = sqliteTable(
  "channel_ingress_accepted",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    platform: text().notNull(),
    request_id: text().notNull(),
    input: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("channel_ingress_accepted_source_idx").on(table.project_id, table.platform, table.request_id),
    index("channel_ingress_accepted_project_time_idx").on(table.project_id, table.time_created),
    check("channel_ingress_payload_owner_shape", sql`
      json_type(${table.input}, '$.platform') IS NULL
      AND json_type(${table.input}, '$.request_id') IS NULL
    `),
  ],
)

export const ChannelIngressOutcomeTable = sqliteTable(
  "channel_ingress_outcome",
  {
    request_id: text().primaryKey().references(() => ChannelIngressAcceptedTable.id, { onDelete: "cascade" }),
    result: text({ mode: "json" }).$type<unknown>().notNull(),
    time_created: integer().notNull(),
  },
)
