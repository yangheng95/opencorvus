import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"
import { randomUUID } from "node:crypto"

export const ProjectTable = sqliteTable("project", {
  id: text().primaryKey(),
  worktree: text().notNull(),
  // No cached `vcs` column — the single source of truth for "is this a git
  // repo" is `Project.isGitRepo(directory)` which probes `.git` on disk. The
  // old cache went out of sync the moment `.git` was deleted (cleanup,
  // user `rm -rf`, etc.) and silently made Worktree.create throw
  // WorktreeCreateFailedError without any code path being able to self-heal —
  // auto-init in task-api/prepareProject was gated on the stale cache. Rule 22.
  name: text(),
  icon_url: text(),
  icon_color: text(),
  ...Timestamps,
  time_pinned: integer(),
  time_initialized: integer(),
  sandboxes: text({ mode: "json" }).notNull().$type<string[]>(),
  commands: text({ mode: "json" }).$type<{ start?: string }>(),
  // Project IDs are derived from repository identity and may be reused after
  // deletion. This UUID identifies one exact durable row occurrence.
  generation: text()
    .notNull()
    .$defaultFn(() => randomUUID()),
}, (table) => [uniqueIndex("project_generation_idx").on(table.generation)])

export const ProjectMaintenanceFenceTable = sqliteTable("project_maintenance_fence", {
  project_id: text()
    .primaryKey()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  project_generation: text().notNull(),
  operation_id: text().notNull(),
  kind: text({ enum: ["delete", "identity_convergence", "promotion", "promotion_commit"] }).notNull(),
  owner_occurrence_id: text().notNull(),
  owner_pid: integer().notNull(),
  owner_process_instance_id: text().notNull(),
  time_created: integer().notNull(),
}, (table) => [
  index("project_maintenance_fence_operation_idx").on(table.operation_id),
  index("project_maintenance_fence_owner_idx").on(table.owner_occurrence_id),
])
