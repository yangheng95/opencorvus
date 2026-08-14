import { foreignKey, integer, sqliteTable, text, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { ProjectTable } from "@/project/project.sql"
import { SessionTable } from "@/session/session.sql"
import { Timestamps } from "@/storage/schema.sql"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"
import type { SelectedWorkflowBinding } from "./workflow-binding"

export type EngineBudget = {
  max_executor_groups?: number
}

export type EngineMetadata = Record<string, unknown>

export type EngineTaskStatus = "active" | "completed" | "failed" | "cancelled"

export type EngineTaskPriority = "critical" | "high" | "normal" | "low"
export type EngineGoalPriority = "blocking" | "advisory"
// Goal is a versioned Delivery Slice contract. It owns no execution or
// lifecycle status; progress is projected from Task/Session/Artifact facts.
export type EngineInteractionType = "permission" | "question"
export type EngineInteractionStatus = "pending" | "answered" | "rejected" | "expired"
export const ENGINE_ARTIFACT_KINDS = [
  "patch",
  "log",
  "image",
  "link",
  "git_ref",
  "pr",
  "host_verification_observation",
  "visual_feedback_verification",
  "build_host_observation",
  "integrity_review",
  "fact_check_review",
  "fact_check_incomplete",
  "visual_review",
  "intent_analysis",
  "requirement_set",
  "research_brief",
  "frontend_research_brief",
  "frontend_design",
  "design_resource_manifest",
  "architect_contract_graph",
  "goal_graph_projection",
  "goal_workload",
  "dispatch_lineage",
  "dispatch_settlement",
  "mission_acceptance_resume_receipt",
  "task_root_ingress",
  "task_checkpoint_settlement",
  "task_auxiliary_settlement",
  "exploration",
  "browser_preview_target",
  "browser_preview_evidence",
  "orchestrator-stream-error",
  "task-infrastructure-error",
  "tool-execute-error",
  "agent_coordination_request",
  "agent_coordination_response",
  "agent_coordination_action",
  "task_completion_decision",
  "task_package_revision_binding",
  "task_execution_capsule_binding",
  /** Generic immutable package-defined fact. Domain identity lives in the
   *  namespaced Artifact envelope so future Expert Squads do not change Core. */
  "expert_output",
] as const
export type EngineArtifactKind = (typeof ENGINE_ARTIFACT_KINDS)[number]
export type EngineProgressStatus = "created" | "active" | "completed" | "failed" | "cancelled"

export const EngineTaskTable = sqliteTable(
  "engine_task",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    request_id: text(),
    source: text().notNull().default("api"),
    product_pillar: text({ enum: ["code", "work"] })
      .notNull()
      .$type<ProductPillar>(),
    title: text().notNull(),
    request: text().notNull(),
    /** Neutral user-upload inputs. JSON array of AttachmentStore references.
     *  Every row has `intent: "task_input"` and `source: "user-upload"`.
     *  Domain meaning is assigned by an explicit consumer contract rather than
     *  inferred from MIME, filename, or storage location. Shown in the overlay
     *  as user-attached files.
     *  System-generated visual evidence (rendered.png, local material reads)
     *  lives in `system_artifacts` instead — see that column
     *  for the rationale. Mixing the two previously caused requirements to
     *  hard-fail when a system-generated screenshot went missing.
     *  Base64 bytes are never stored here; the file lives on disk under the
     *  project's runtime attachment blob store. */
    attachments: text({ mode: "json" }).$type<
      Array<{
        sha: string
        url: string
        mime: string
        size: number
        filename?: string
        intent: "task_input"
        source: "user-upload"
      }>
    >(),
    /** SYSTEM-GENERATED artifacts. Same shape as `attachments` but covers
     *  things the orchestrator/agents created (or read off disk) on the
     *  user's behalf — never part of the user's contract:
     *    `source: "material"`        — frontend_design local file reads
     *    `source: "playwright"`      — acceptance rendered.png captures
     *  Read by acceptance for visual comparison. Frontend-design may consume
     *  explicitly declared local or provider materials only after the
     *  orchestrator indexes them through a task-scoped design_resource_manifest;
     *  requirements still reads only user-contract attachments. Losing one of
     *  these on disk is a soft failure for downstream consumers; explicit
     *  frontend_design materialization failures are reported before analysis. */
    system_artifacts: text({ mode: "json" })
      .$type<
        Array<{
          sha: string
          url: string
          mime: string
          size: number
          filename?: string
          intent?: string
          source?: string
        }>
      >()
      .notNull()
      .default([]),
    /** Phase-6-f-2: `status` cache column removed. Derive via
     *  `engine/task-status.ts::deriveTaskStatus` from
     *  (time_started, time_completed, error, metadata.cancelled). */
    priority: text().notNull().$type<EngineTaskPriority>().default("normal"),
    /** The former task-wide blocker cache is removed. Current blockers are
     *  explicit interaction or evidence facts, never an execution status. */
    error: text(),
    budget: text({ mode: "json" }).$type<EngineBudget>(),
    metadata: text({ mode: "json" }).$type<EngineMetadata>(),
    time_started: integer().notNull(),
    time_completed: integer(),
    /** User-facing archive timestamp. Archived Tasks remain durable and may be
     *  restored or permanently deleted from Settings. */
    time_archived: integer(),
    /** User-facing pin timestamp. Pinning changes Work Ledger rank without
     *  changing the Task's activity timestamp. */
    time_pinned: integer(),
    /** Rewind cursor: when non-null, all UI-facing event queries filter events
     *  with `time_created > rewind_cursor_time` OUT. This is how "rewind to a
     *  specific message card" works without deleting history — the filter is
     *  a projection, the underlying append-only log stays intact. Written by
     *  `rewindTask(taskID, eventID)` which also aborts any in-flight loop.
     *  When a new user message arrives AFTER a rewind, its session-message
     *  event is appended normally; the next loop sees "history up to cursor
     *  + new message beyond cursor" as a merged view per describe layer. */
    rewind_cursor_time: integer(),
    /** The event id the user clicked to anchor the rewind. Audit only;
     *  the cursor time is what actually filters queries. Kept for overlay
     *  highlighting (which card the user rewound from). */
    rewind_cursor_event_id: text(),
    /** Monotonic counter of rewind operations on this task. Useful for
     *  rate-limiting (overlay can warn on rapid re-rewind) and for
     *  distinguishing "new events since rewind" in UI diffs. */
    rewind_count: integer().notNull().default(0),
    ...Timestamps,
  },
  (table) => [
    index("engine_task_project_idx").on(table.project_id),
    index("engine_task_time_updated_idx").on(table.time_updated, table.id),
    index("engine_task_project_time_updated_idx").on(table.project_id, table.time_updated, table.id),
    index("engine_task_time_completed_idx").on(table.time_completed),
    index("engine_task_time_archived_idx").on(table.time_archived),
    index("engine_task_time_pinned_idx").on(table.time_pinned),
    uniqueIndex("engine_task_project_request_idx").on(table.project_id, table.request_id),
  ],
)

export const EngineTaskCancellationAuthorityTable = sqliteTable("engine_task_cancellation_authority", {
  task_id: text()
    .primaryKey()
    .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
  request_event_id: text().notNull(),
  convergence_owner_id: text(),
  convergence_owner_process_id: integer(),
  convergence_lease_expires_at: integer(),
})

/** Durable owner for private Git refs created while materializing one Build
 * terminal observation. A row exists before the first ref write, so a crash,
 * publication failure, or vanished linked worktree cannot orphan the refs. */
export const EngineBuildObservationCleanupTable = sqliteTable(
  "engine_build_observation_cleanup",
  {
    observation_id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    git_dir: text().notNull(),
    status: text({ enum: ["active", "pending", "retained", "complete"] }).notNull(),
    owner_runtime_id: text().notNull(),
    attempts: integer().notNull().default(0),
    last_error: text(),
    ...Timestamps,
  },
  (table) => [index("engine_build_observation_cleanup_task_status_idx").on(table.task_id, table.status)],
)

export const EngineGoalTable = sqliteTable(
  "engine_goal",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    /** Exact immutable RequirementSet artifact used when this Goal was produced. */
    requirement_set_artifact_id: text(),
    /** Exact catalog revision frozen with requirement_set_artifact_id. */
    requirement_set_artifact_revision: integer(),
    /** SHA-256 digest frozen with requirement_set_artifact_id. */
    requirement_set_artifact_sha256: text(),
    /** Exact immutable ContractGraph artifact used when this Goal was produced. */
    contract_graph_artifact_id: text(),
    /** Exact catalog revision frozen with contract_graph_artifact_id. */
    contract_graph_artifact_revision: integer(),
    /** SHA-256 digest frozen with contract_graph_artifact_id. */
    contract_graph_artifact_sha256: text(),
    /** Earlier immutable Goal fact replaced by this revised Goal, if any. */
    supersede_of: text(),
    // --- GoalContractFields: each field is an independent column (no compression) ---
    /** Short goal title. */
    title: text().notNull(),
    /**
     * Content-derived human-readable identifier (e.g. "add-login-form"). Derived
     * from title at insert, immutable thereafter. Display-only — never an FK,
     * never referenced as identity. Used alongside goal_id in logs/UI so humans
     * can tell goals apart without memorising `gol_<hex>` ids.
     */
    slug: text().notNull(),
    /** Full objective statement — what this goal accomplishes. */
    objective: text().notNull(),
    /** Typed acceptance specs (AcceptanceSpec[] JSON). Eval source of truth. */
    acceptance_specs: text({ mode: "json" })
      .$type<import("@/acceptance/types").AcceptanceSpec[]>()
      .notNull()
      .default([]),
    /** Files this goal owns exclusively. Executor hard write boundary. */
    owned_paths: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    /** Goal category (e.g. bootstrap, feature, verification). */
    kind: text().notNull().default("feature"),
    // --- Orchestrator-managed fields ---
    priority: text().notNull().$type<EngineGoalPriority>().default("blocking"),
    source: text().notNull().default("orchestrator"),
    // Delivery Slice revision rows contain contract facts only. Runtime,
    // retry, workspace, and presentation state belong to other Task facts.
    order_index: integer().notNull().default(0),
    /** Remaining metadata (check_selector, visual hints, etc.) */
    metadata: text({ mode: "json" }).$type<EngineMetadata>(),
    ...Timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.supersede_of],
      foreignColumns: [table.id],
      name: "engine_goal_supersede_fk",
    }).onDelete("restrict"),
    index("engine_goal_task_idx").on(table.task_id),
    index("engine_goal_requirement_set_idx").on(table.requirement_set_artifact_id),
    index("engine_goal_contract_graph_idx").on(table.contract_graph_artifact_id),
    index("engine_goal_supersede_idx").on(table.supersede_of),
  ],
)

export const EngineInteractionRequestTable = sqliteTable(
  "engine_interaction_request",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    external_id: text().notNull(),
    request_type: text().notNull().$type<EngineInteractionType>(),
    status: text().notNull().$type<EngineInteractionStatus>().default("pending"),
    title: text().notNull(),
    body: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>().notNull(),
    response: text({ mode: "json" }).$type<EngineMetadata>(),
    time_resolved: integer(),
    ...Timestamps,
  },
  (table) => [
    index("engine_interaction_external_idx").on(table.external_id),
    index("engine_interaction_status_idx").on(table.status),
  ],
)

// Execution and Host observations are immutable Task/Session facts.

/**
 * Global, append-only MVCC (Multi-Version Concurrency Control) clock for the
 * Engine Artifact catalog. SQLite assigns each INTEGER PRIMARY KEY value
 * monotonically; writers allocate one row in the same transaction as the
 * current/history partition change.
 */
export const EngineArtifactCatalogRevisionTable = sqliteTable("engine_artifact_catalog_revision", {
  revision: integer().primaryKey({ autoIncrement: true }),
})

export const EngineArtifactTable = sqliteTable(
  "engine_artifact",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    kind: text().notNull().$type<EngineArtifactKind>(),
    label: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>(),
    /** Same-row Artifact catalog metadata. These columns are derived in the
     * single Engine Artifact writer transaction, so catalog enumeration never
     * scans or hashes every JSON payload. Transport pages verify their covered
     * fixed blocks; complete exact consumers still verify payload_sha256. */
    payload_sha256: text().notNull().default("74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b"),
    payload_bytes: integer().notNull().default(4),
    /** Ordered SHA-256 digests for fixed 64 KiB payload blocks. */
    payload_block_sha256s: text({ mode: "json" }).$type<string[]>().notNull(),
    /** SHA-256 identity of the ordered fixed-block digest index. */
    payload_block_index_sha256: text().notNull(),
    catalog_artifact_type: text(),
    catalog_schema_diagnostic: text(),
    catalog_producer: text({ mode: "json" }).$type<EngineMetadata>(),
    /** Immutable source Task lineage for a cross-Task imported envelope. */
    catalog_import_source_task_id: text(),
    catalog_resource_count: integer().notNull().default(0),
    catalog_resource_media_types: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    catalog_search_text: text().notNull().default(""),
    catalog_search_text_truncated: integer({ mode: "boolean" }).notNull().default(false),
    /** SHA-256 identity of every bounded directory-index column above. */
    catalog_metadata_sha256: text().notNull(),
    /** Revision at which this exact current version entered the catalog. */
    catalog_revision: integer()
      .notNull()
      .references(() => EngineArtifactCatalogRevisionTable.revision, { onDelete: "restrict" }),
    ...Timestamps,
  },
  (table) => [
    uniqueIndex("engine_artifact_partition_authority_idx").on(table.id, table.task_id, table.kind),
    uniqueIndex("engine_artifact_catalog_revision_idx").on(table.catalog_revision),
    index("engine_artifact_task_kind_latest_idx").on(table.task_id, table.kind, table.time_created, table.id),
    uniqueIndex("engine_artifact_task_completion_decision_time_idx")
      .on(table.task_id, table.time_created)
      .where(sql`${table.kind} = 'task_completion_decision'`),
    uniqueIndex("engine_artifact_pending_worker_handoff_lineage_idx")
      .on(table.task_id, sql<string>`json_extract(${table.payload}, '$.dispatch_lineage_id')`)
      .where(
        sql`${table.kind} = 'agent_coordination_request' AND json_extract(${table.payload}, '$.origin') = 'worker_handoff' AND json_extract(${table.payload}, '$.status') = 'pending'`,
      ),
  ],
)

/** Single durable admission authority for one virtual workflow node in one
 * Task. A bound row is committed atomically with its child Session, first
 * message, Turn descriptor, and dispatch lineage. Historical duplicates are
 * retained as an explicit conflicted row instead of selecting a replacement. */
export const EngineWorkflowNodeOccurrenceTable = sqliteTable(
  "engine_workflow_node_occurrence",
  {
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    workflow_id: text().notNull(),
    workflow_node_id: text().notNull(),
    workflow_binding: text({ mode: "json" }).$type<SelectedWorkflowBinding>().notNull(),
    state: text({ enum: ["bound", "conflicted"] }).notNull(),
    workflow_occurrence_id: text(),
    initial_dispatch_id: text(),
    child_session_id: text().references(() => SessionTable.id, { onDelete: "restrict" }),
    dispatch_lineage_artifact_id: text().references(() => EngineArtifactTable.id, { onDelete: "restrict" }),
    conflict_lineage_ids: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.task_id, table.workflow_id, table.workflow_node_id] }),
    uniqueIndex("engine_workflow_node_occurrence_identity_idx")
      .on(table.task_id, table.workflow_occurrence_id)
      .where(sql`${table.workflow_occurrence_id} IS NOT NULL`),
    uniqueIndex("engine_workflow_node_occurrence_lineage_idx")
      .on(table.dispatch_lineage_artifact_id)
      .where(sql`${table.dispatch_lineage_artifact_id} IS NOT NULL`),
  ],
)

/** Durable one-row authority for each Task + canonical Browser Preview URL.
 * The primary key is the concurrency boundary for update-or-insert writers. */
export const EngineBrowserPreviewTargetIdentityTable = sqliteTable(
  "engine_browser_preview_target_identity",
  {
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    canonical_url: text().notNull(),
    artifact_id: text()
      .notNull()
      .references(() => EngineArtifactTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.task_id, table.canonical_url] }),
    uniqueIndex("engine_browser_preview_target_identity_artifact_idx").on(table.artifact_id),
  ],
)

/**
 * Prior Engine Artifact versions. The current table and this history table
 * form one partition: a version is present in exactly one of them. Retaining
 * the complete old row keeps exact locators and frozen catalog pages
 * reconstructible without treating the current row as immutable.
 */
export const EngineArtifactVersionTable = sqliteTable(
  "engine_artifact_version",
  {
    artifact_id: text().notNull(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    kind: text().notNull().$type<EngineArtifactKind>(),
    label: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>().notNull(),
    payload_sha256: text().notNull(),
    payload_bytes: integer().notNull(),
    payload_block_sha256s: text({ mode: "json" }).$type<string[]>().notNull(),
    payload_block_index_sha256: text().notNull(),
    catalog_artifact_type: text(),
    catalog_schema_diagnostic: text(),
    catalog_producer: text({ mode: "json" }).$type<EngineMetadata>(),
    catalog_import_source_task_id: text(),
    catalog_resource_count: integer().notNull(),
    catalog_resource_media_types: text({ mode: "json" }).$type<string[]>().notNull(),
    catalog_search_text: text().notNull(),
    catalog_search_text_truncated: integer({ mode: "boolean" }).notNull(),
    catalog_metadata_sha256: text().notNull(),
    catalog_revision: integer()
      .notNull()
      .references(() => EngineArtifactCatalogRevisionTable.revision, { onDelete: "restrict" }),
    time_created: integer().notNull(),
    time_updated: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.artifact_id, table.catalog_revision] }),
    foreignKey({
      columns: [table.artifact_id, table.task_id, table.kind],
      foreignColumns: [EngineArtifactTable.id, EngineArtifactTable.task_id, EngineArtifactTable.kind],
      name: "engine_artifact_version_partition_authority_fk",
    }).onDelete("cascade"),
    uniqueIndex("engine_artifact_version_catalog_revision_idx").on(table.catalog_revision),
    index("engine_artifact_version_task_revision_idx").on(table.task_id, table.catalog_revision, table.artifact_id),
    index("engine_artifact_version_artifact_sha_idx").on(
      table.artifact_id,
      table.payload_sha256,
      sql`${table.catalog_revision} DESC`,
    ),
  ],
)

export const EngineProgressSnapshotTable = sqliteTable(
  "engine_progress_snapshot",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    status: text().notNull().$type<EngineProgressStatus>(),
    summary: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>(),
    ...Timestamps,
  },
  (table) => [index("engine_progress_task_idx").on(table.task_id)],
)

export const EngineChannelBindingTable = sqliteTable(
  "engine_channel_binding",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    platform: text().notNull(),
    channel: text().notNull(),
    thread: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>(),
    ...Timestamps,
  },
  (table) => [
    index("engine_channel_task_idx").on(table.task_id),
    uniqueIndex("engine_channel_binding_thread_idx").on(table.platform, table.channel, table.thread),
  ],
)
