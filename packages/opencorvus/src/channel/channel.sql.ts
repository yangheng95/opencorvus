import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"
import { Timestamps } from "@/storage/schema.sql"

export const ChannelIngressReceiptTable = sqliteTable(
  "channel_ingress_receipt",
  {
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    platform: text().notNull(),
    request_id: text().notNull(),
    fingerprint: text().notNull(),
    result: text({ mode: "json" }).$type<unknown>().notNull(),
    ...Timestamps,
  },
  (table) => [primaryKey({ columns: [table.project_id, table.platform, table.request_id] })],
)
