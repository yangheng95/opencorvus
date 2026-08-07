import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export const TaskPlanTable = sqliteTable(
  "task_plan",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    parent_id: text(),
    goal: text().notNull(),
    status: text()
      .notNull()
      .$type<"pending" | "in_progress" | "completed" | "blocked" | "cancelled">()
      .default("pending"),
    priority: integer().notNull().default(0),
    notes: text(),
    progress_pct: integer().notNull().default(0),
    ...Timestamps,
  },
  (table) => [
    index("task_plan_session_idx").on(table.session_id),
    index("task_plan_parent_idx").on(table.parent_id),
    index("task_plan_status_idx").on(table.status),
  ],
)
