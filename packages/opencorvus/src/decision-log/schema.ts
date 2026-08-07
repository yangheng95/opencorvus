/**
 * Decision Log DB schema.
 *
 * Append-only table shared by all agents.
 * Carries WHY (decision reasons), not just WHAT (code).
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const DecisionLogTable = sqliteTable(
  "decision_log",
  {
    id: text().primaryKey(),
    /** Which task this decision belongs to. Scoped per-task, isolated between tasks. */
    task_id: text().notNull(),
    /** Which goal produced this entry (null = requirements phase / global). */
    goal_id: text(),
    /** Lifecycle phase: requirements | plan | execute | eval | acceptance */
    phase: text().notNull(),
    /** Decision category key. Examples: "runtime", "backend_framework", "test_runner", "api_contract" */
    key: text().notNull(),
    /** Decision value. Examples: "Bun", "Hono", "bun:test", "GET /api/stocks → Stock[]" */
    value: text().notNull(),
    /** WHY this decision was made. The most important field — carries reasoning, not just fact. */
    reason: text().notNull(),
    /** ISO timestamp */
    time_created: integer().notNull(),
  },
  (table) => [
    index("decision_log_task_idx").on(table.task_id),
    index("decision_log_task_key_idx").on(table.task_id, table.key),
  ],
)
