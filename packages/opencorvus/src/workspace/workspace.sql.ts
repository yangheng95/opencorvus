import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "@/project/project.sql"
import type { Config } from "./config"

export const WorkspaceTable = sqliteTable("workspace", {
  id: text().primaryKey(),
  branch: text(),
  project_id: text()
    .notNull()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  config: text({ mode: "json" }).notNull().$type<Config>(),
})

/**
 * Database-side current frontier published before a Workspace lifecycle
 * journal. Project deletion and identity convergence check it in their own
 * writer transaction, so neither can cross unmaterialized or live Git work.
 */
export const WorkspaceLifecycleAdmissionTable = sqliteTable(
  "workspace_lifecycle_admission",
  {
    occurrence_id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    project_generation: text().notNull(),
    workspace_id: text().notNull(),
    lifecycle: text({ enum: ["creating", "deleting"] }).notNull(),
    authority: text({ enum: ["public", "project_delete"] }).notNull(),
    owner_occurrence_id: text().notNull(),
    owner_pid: integer().notNull(),
    owner_process_instance_id: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    check(
      "workspace_lifecycle_admission_kind_shape",
      sql`${table.lifecycle} IN ('creating', 'deleting') AND ${table.authority} IN ('public', 'project_delete') AND (${table.lifecycle} <> 'creating' OR ${table.authority} = 'public')`,
    ),
    uniqueIndex("workspace_lifecycle_admission_project_workspace_idx").on(table.project_id, table.workspace_id),
    index("workspace_lifecycle_admission_project_kind_idx").on(table.project_id, table.lifecycle, table.authority),
    index("workspace_lifecycle_admission_owner_idx").on(table.owner_occurrence_id),
  ],
)
