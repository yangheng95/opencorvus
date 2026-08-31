import { sqliteTable, text, integer, uniqueIndex, index, check } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { Timestamps } from "@/storage/schema.sql"
import { randomUUID } from "node:crypto"

export const ProjectTable = sqliteTable(
  "project",
  {
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
  },
  (table) => [uniqueIndex("project_generation_idx").on(table.generation)],
)

export const ProjectMaintenanceFenceTable = sqliteTable(
  "project_maintenance_fence",
  {
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
  },
  (table) => [
    index("project_maintenance_fence_operation_idx").on(table.operation_id),
    index("project_maintenance_fence_owner_idx").on(table.owner_occurrence_id),
  ],
)

/**
 * Durable authority for a directory while an external filesystem transition
 * is in flight. Project registry writers refuse a matching key until the exact
 * generation is settled; the file lock is only a work queue.
 */
export const ProjectDirectoryAdmissionTable = sqliteTable(
  "project_directory_admission",
  {
    directory_key: text().primaryKey(),
    directory: text().notNull(),
    generation: text().notNull(),
    operation_id: text().notNull(),
    kind: text({
      enum: ["registration", "reclamation", "promotion_restore", "promotion_publish", "promotion_workspace"],
    }).notNull(),
    owner_occurrence_id: text().notNull(),
    owner_pid: integer().notNull(),
    owner_process_instance_id: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("project_directory_admission_generation_idx").on(table.generation),
    index("project_directory_admission_operation_idx").on(table.operation_id),
    index("project_directory_admission_owner_idx").on(table.owner_occurrence_id),
  ],
)

/** Global one-call request identity reserved before anonymous Project
 * filesystem allocation. The directory is frozen once; the Project row and
 * target aggregate are deterministic continuations of this occurrence. */
export const GlobalCreationAllocationTable = sqliteTable(
  "global_creation_allocation",
  {
    id: text().primaryKey(),
    kind: text({ enum: ["global_task", "global_chat_start"] }).notNull(),
    request_id: text().notNull(),
    request_fingerprint: text().notNull(),
    request_contract: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    resolution_seed: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    /** Global Task freezes this in the allocation insert itself. Global Chat
     * has no Task resolution and stores NULL. */
    task_resolution: text({ mode: "json" }).$type<Record<string, unknown>>(),
    /** Exact carrying Project occurrence, appended atomically with the
     * Project row before any Task/Session target may be created. */
    materialized_project_id: text(),
    materialized_project_generation: text(),
    time_materialized: integer(),
    rejected_error: text({ mode: "json" }).$type<{ name: string; data: Record<string, unknown> }>(),
    time_rejected: integer(),
    accepted_project_id: text(),
    accepted_target_id: text(),
    /** Immutable initial Session overlay observed in the same transaction as
     * aggregate acceptance. Current Session overlays may evolve later. */
    accepted_initial_config_overlay: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_accepted: integer(),
    /** Written by the Project deletion trigger before terminal retention
     * removes the carrying aggregate. NULL while the Project still exists. */
    time_project_retained: integer(),
    directory: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("global_creation_allocation_request_idx").on(table.kind, table.request_id),
    uniqueIndex("global_creation_allocation_directory_idx").on(table.directory),
    check(
      "global_creation_allocation_fact_shape",
      sql`length(trim(${table.request_id})) > 0
          AND length(${table.request_fingerprint}) = 64
          AND json_type(${table.request_contract}) = 'object'
          AND (
            (${table.kind} = 'global_task' AND json_extract(${table.request_contract}, '$.protocol') = 'global-task-project-allocation-v2')
            OR (${table.kind} = 'global_chat_start' AND json_extract(${table.request_contract}, '$.protocol') = 'global-chat-start-request-v2')
          )
          AND json_type(${table.resolution_seed}) = 'object'
          AND (
            (${table.kind} = 'global_task' AND json_type(${table.task_resolution}) = 'object')
            OR (${table.kind} = 'global_chat_start' AND ${table.task_resolution} IS NULL)
          )
          AND (
            (${table.materialized_project_id} IS NULL AND ${table.materialized_project_generation} IS NULL AND ${table.time_materialized} IS NULL)
            OR
            (length(trim(${table.materialized_project_id})) > 0
              AND length(trim(${table.materialized_project_generation})) > 0
              AND ${table.time_materialized} IS NOT NULL)
          )
          AND (
            (${table.rejected_error} IS NULL AND ${table.time_rejected} IS NULL)
            OR (json_type(${table.rejected_error}) = 'object'
              AND json_extract(${table.rejected_error}, '$.name') IN ('TaskChannelBindingProjectConflictError','TaskChannelBindingGlobalCreationConflictError','GlobalCreationAcceptedTargetConflictError')
              AND json_type(${table.rejected_error}, '$.data') = 'object'
              AND ${table.time_rejected} IS NOT NULL)
          )
          AND (
            (${table.accepted_project_id} IS NULL AND ${table.accepted_target_id} IS NULL
              AND ${table.accepted_initial_config_overlay} IS NULL AND ${table.time_accepted} IS NULL)
            OR
            (length(trim(${table.accepted_project_id})) > 0
              AND length(trim(${table.accepted_target_id})) > 0
              AND json_type(${table.accepted_initial_config_overlay}) = 'object'
              AND ${table.time_accepted} IS NOT NULL)
          )
          AND NOT (${table.rejected_error} IS NOT NULL AND ${table.accepted_target_id} IS NOT NULL)
          AND (${table.accepted_project_id} IS NULL OR ${table.accepted_project_id} = ${table.materialized_project_id})
          AND (${table.time_project_retained} IS NULL OR (
            ${table.materialized_project_id} IS NOT NULL
            AND (${table.accepted_target_id} IS NOT NULL OR ${table.rejected_error} IS NOT NULL)
            AND ${table.time_project_retained} >= ${table.time_materialized}
          ))
          AND length(trim(${table.directory})) > 0`,
    ),
  ],
)
