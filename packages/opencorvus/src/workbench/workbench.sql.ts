import { sqliteTable, text, index } from "drizzle-orm/sqlite-core"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Timestamps } from "@/storage/schema.sql"

export const WorkbenchBriefSnapshotTable = sqliteTable(
  "workbench_brief_snapshot",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    inputs: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [index("workbench_brief_task_idx").on(table.task_id)],
)
