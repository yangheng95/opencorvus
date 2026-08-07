import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { SessionTable } from "@/session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export type TaskQueuePriority = "high" | "normal" | "low"
export type TaskQueueStatus = "queued" | "running" | "completed" | "failed"
export type TaskQueueMetadata =
  | {
      kind: "session_prompt"
      input: Record<string, unknown>
    }
  | {
      kind: "session_wake"
      messageID: string
      input: Record<string, unknown>
    }
  | {
      kind: "session_compaction"
      input: {
        sourceUserMessageID: string
        model?: {
          providerID: string
          modelID: string
        }
        auto: boolean
        overflow: boolean
        focus?: string
      }
    }

export const TaskQueueTable = sqliteTable(
  "a2a_task_queue",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    prompt: text().notNull(),
    priority: text().notNull().$type<TaskQueuePriority>().default("normal"),
    status: text().notNull().$type<TaskQueueStatus>().default("queued"),
    source: text().notNull().default("api"),
    previous_summary: text(),
    error_message: text(),
    metadata: text({ mode: "json" }).notNull().$type<TaskQueueMetadata>(),
    time_started: integer(),
    time_completed: integer(),
    ...Timestamps,
  },
  (table) => [
    index("a2a_queue_session_idx").on(table.session_id),
    index("a2a_queue_status_idx").on(table.status),
    index("a2a_queue_priority_idx").on(table.priority, table.status),
  ],
)
