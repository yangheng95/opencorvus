import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * QuickNote 数据表. DDL means Data Definition Language; storage/ddl.ts
 * generates its table and index SQL from this Drizzle definition.
 */
export const QuickNoteTable = sqliteTable(
  "quick_note",
  {
    id: text().primaryKey(),
    project_id: text(),
    content: text().notNull(),
    summary: text().notNull(),
    tags: text().notNull().default("[]"),
    status: text().notNull().default("draft"),
    user_id: text(),
    time_created: integer().notNull(),
    time_updated: integer().notNull(),
  },
  (table) => [
    index("quick_note_project_idx").on(table.project_id),
    index("quick_note_user_idx").on(table.user_id),
    index("quick_note_status_idx").on(table.status),
  ],
)
