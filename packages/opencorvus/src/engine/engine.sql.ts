import { check, foreignKey, integer, sqliteTable, text, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { ProjectTable } from "@/project/project.sql"
import { SessionTable } from "@/session/session.sql"
import { Timestamps } from "@/storage/schema.sql"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v2"
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
  "task_acceptance_ledger",
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
    /** Execution status is reduced from Task lifecycle Protocol Events. */
    priority: text().notNull().$type<EngineTaskPriority>().default("normal"),
    budget: text({ mode: "json" }).$type<EngineBudget>(),
    metadata: text({ mode: "json" }).$type<EngineMetadata>(),
    /** User-facing archive timestamp. Archived Tasks remain durable and may be
     *  restored or permanently deleted from Settings. */
    time_archived: integer(),
    /** User-facing pin timestamp. Pinning changes Work Ledger rank without
     *  changing the Task's activity timestamp. */
    time_pinned: integer(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("engine_task_project_idx").on(table.project_id),
    index("engine_task_time_created_idx").on(table.time_created, table.id),
    index("engine_task_project_time_created_idx").on(table.project_id, table.time_created, table.id),
    index("engine_task_time_archived_idx").on(table.time_archived),
    index("engine_task_time_pinned_idx").on(table.time_pinned),
    uniqueIndex("engine_task_project_request_idx").on(table.project_id, table.request_id),
    check("engine_task_excludes_git_projection", sql`json_type(${table.metadata}, '$.git') IS NULL`),
  ],
)

/** Immutable policy selected when a Task-root input is accepted. The digest
 * identity makes historical retry/deadline semantics independent of mutable
 * configuration. */
export const EngineTaskRootIngressPolicyTable = sqliteTable("engine_task_root_ingress_policy", {
  id: text().primaryKey(),
  semantic_turn_limit: integer().notNull(),
  activation_limit: integer().notNull(),
  absolute_deadline: integer(),
  time_created: integer().notNull(),
})

export type EngineTaskRootIngressSource = "message" | "protocol_event" | "automation_run" | "engine_artifact" | "task" | "inline"

/** One accepted business input. Readiness and outcome are reduced from its
 * causal facts; this row never carries a delivery/status/attempt projection. */
export const EngineTaskRootIngressTable = sqliteTable(
  "engine_task_root_ingress",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    execution_epoch: integer().notNull(),
    sequence: integer().notNull(),
    source: text({ enum: ["message", "protocol_event", "automation_run", "engine_artifact", "task", "inline"] })
      .notNull()
      .$type<EngineTaskRootIngressSource>(),
    source_id: text().notNull(),
    inline_payload: text({ mode: "json" }).$type<Record<string, unknown>>(),
    policy_id: text()
      .notNull()
      .references(() => EngineTaskRootIngressPolicyTable.id, { onDelete: "restrict" }),
    time_accepted: integer().notNull(),
  },
  (table) => [
    uniqueIndex("engine_task_root_ingress_sequence_idx").on(table.task_id, table.execution_epoch, table.sequence),
    uniqueIndex("engine_task_root_ingress_source_idx").on(table.task_id, table.source, table.source_id),
    index("engine_task_root_ingress_epoch_idx").on(table.task_id, table.execution_epoch, table.sequence),
  ],
)

export type EngineControlActivationTarget =
  | "task_root_ingress"
  | "lifecycle"
  | "interaction"
  | "effect"
  | "automation"
  | "event_fire"
  | "build_cleanup"
  | "protocol_delivery"
  | "bus_delivery"
  | "session_control"
  | "session_shell"
  /** Fenced physical owner preparing the deterministic Session and first Turn
   * for one immutable dispatch lineage. The lineage is the logical request;
   * this lease is only its transferable pre-effect executor. */
  | "dispatch_admission"
  /** One row per live runtime process, renewed while it runs. It owns no work;
   * it is the durable coordinate that lets one process decide another is gone
   * without consulting its own memory, which says nothing about a peer sharing
   * the same database. */
  | "runtime_process"

/** Append-only physical ownership history. Expiry may be renewed by the same
 * owner; no business completion or retry state is stored here. */
export const EngineControlActivationLeaseTable = sqliteTable(
  "engine_control_activation_lease",
  {
    id: text().primaryKey(),
    target: text({ enum: ["task_root_ingress", "lifecycle", "interaction", "effect", "automation", "event_fire", "build_cleanup", "protocol_delivery", "bus_delivery", "session_control", "session_shell", "dispatch_admission", "runtime_process"] })
      .notNull()
      .$type<EngineControlActivationTarget>(),
    target_id: text().notNull(),
    owner_occurrence_id: text().notNull(),
    time_activated: integer().notNull(),
    expires_at: integer().notNull(),
  },
  (table) => [
    index("engine_control_activation_owner_idx").on(table.target, table.target_id, table.owner_occurrence_id),
    index("engine_control_activation_target_idx").on(table.target, table.target_id, table.time_activated),
    index("engine_control_activation_expiry_idx").on(table.expires_at),
  ],
)

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
    time_created: integer().notNull(),
  },
  (table) => [index("engine_build_observation_cleanup_task_idx").on(table.task_id)],
)

export const EngineBuildObservationCleanupReceiptTable = sqliteTable(
  "engine_build_observation_cleanup_receipt",
  {
    id: text().primaryKey(),
    observation_id: text().notNull().references(() => EngineBuildObservationCleanupTable.observation_id, { onDelete: "cascade" }),
    outcome: text({ enum: ["retained", "failed", "complete"] }).notNull(),
    error: text(),
    time_created: integer().notNull(),
  },
  (table) => [index("engine_build_observation_cleanup_receipt_idx").on(table.observation_id, table.time_created)],
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
      .references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    /** Exact owner locator for externally accepted interaction input. */
    source_kind: text({ enum: ["bus_question", "permission_request"] }),
    source_id: text(),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    external_id: text(),
    request_type: text().$type<EngineInteractionType>(),
    title: text(),
    body: text(),
    payload: text({ mode: "json" }).$type<EngineMetadata>(),
    time_created: integer(),
  },
  (table) => [
    uniqueIndex("engine_interaction_external_idx").on(table.external_id).where(sql`${table.external_id} IS NOT NULL`),
    uniqueIndex("engine_interaction_source_idx").on(table.source_kind, table.source_id).where(sql`${table.source_id} IS NOT NULL`),
    check("engine_interaction_request_owner_shape", sql`
      (${table.source_kind} IS NOT NULL AND ${table.source_id} IS NOT NULL AND ${table.task_id} IS NULL AND ${table.session_id} IS NULL AND ${table.external_id} IS NULL
        AND ${table.request_type} IS NULL AND ${table.title} IS NULL AND ${table.body} IS NULL
        AND ${table.payload} IS NULL AND ${table.time_created} IS NULL)
      OR
      (${table.source_kind} IS NULL AND ${table.source_id} IS NULL AND ${table.task_id} IS NOT NULL AND ${table.session_id} IS NOT NULL AND ${table.external_id} IS NOT NULL
        AND ${table.request_type} IS NOT NULL AND ${table.title} IS NOT NULL AND ${table.body} IS NOT NULL
        AND ${table.payload} IS NOT NULL AND ${table.time_created} IS NOT NULL)
    `),
  ],
)

/** Exactly one immutable participant/system outcome for an Interaction
 * request. Pending/answered/rejected/expired are reducer projections. */
export const EngineInteractionOutcomeTable = sqliteTable(
  "engine_interaction_outcome",
  {
    id: text().primaryKey(),
    interaction_id: text().notNull().references(() => EngineInteractionRequestTable.id, { onDelete: "cascade" }),
    /** Exact terminal Question publication. Inline-only interactions instead
     * own the minimal outcome fields below. */
    source_occurrence_id: text(),
    outcome: text({ enum: ["answered", "rejected", "expired"] }).$type<Exclude<EngineInteractionStatus, "pending">>(),
    response: text({ mode: "json" }).$type<EngineMetadata>(),
    time_created: integer(),
  },
  (table) => [
    uniqueIndex("engine_interaction_outcome_request_idx").on(table.interaction_id),
    uniqueIndex("engine_interaction_outcome_source_idx").on(table.source_occurrence_id).where(sql`${table.source_occurrence_id} IS NOT NULL`),
    check("engine_interaction_outcome_owner_shape", sql`
      (${table.source_occurrence_id} IS NOT NULL AND ${table.outcome} IS NULL AND ${table.response} IS NULL AND ${table.time_created} IS NULL)
      OR
      (${table.source_occurrence_id} IS NULL AND ${table.outcome} IS NOT NULL AND ${table.response} IS NOT NULL AND ${table.time_created} IS NOT NULL)
    `),
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
    uniqueIndex("engine_dispatch_lineage_direct_tool_occurrence_idx")
      .on(
        table.task_id,
        sql<string>`json_extract(${table.payload}, '$.tool_part_id')`,
        sql<string>`json_extract(${table.payload}, '$.tool_call_id')`,
      )
      .where(
        sql`${table.kind} = 'dispatch_lineage' AND json_extract(${table.payload}, '$.tool_name') = 'dispatch_agent'`,
      ),
    uniqueIndex("engine_dispatch_lineage_collection_member_idx")
      .on(
        table.task_id,
        sql<string>`json_extract(${table.payload}, '$.tool_part_id')`,
        sql<string>`json_extract(${table.payload}, '$.tool_call_id')`,
        sql<number>`json_extract(${table.payload}, '$.collection_member_index')`,
      )
      .where(
        sql`${table.kind} = 'dispatch_lineage' AND json_extract(${table.payload}, '$.tool_name') = 'dispatch_agents'`,
      ),
    uniqueIndex("engine_dispatch_lineage_initial_workflow_node_idx")
      .on(
        table.task_id,
        sql<string>`json_extract(${table.payload}, '$.workflow_occurrence_id')`,
        sql<string>`json_extract(${table.payload}, '$.workflow_node_id')`,
      )
      .where(
        sql`${table.kind} = 'dispatch_lineage' AND json_extract(${table.payload}, '$.workflow_binding.kind') = 'virtual_workflow' AND json_type(${table.payload}, '$.continuation_of_dispatch_id') IS NULL AND json_type(${table.payload}, '$.coordination_action_id') IS NULL`,
      ),
    uniqueIndex("engine_dispatch_lineage_coordination_action_idx")
      .on(table.task_id, sql<string>`json_extract(${table.payload}, '$.coordination_action_id')`)
      .where(
        sql`${table.kind} = 'dispatch_lineage' AND json_type(${table.payload}, '$.coordination_action_id') = 'text'`,
      ),
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
    initial_dispatch_id: text(),
    child_session_id: text().references(() => SessionTable.id, { onDelete: "restrict" }),
    time_created: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.task_id, table.workflow_id, table.workflow_node_id] }),
    uniqueIndex("engine_workflow_node_occurrence_identity_idx")
      .on(table.task_id, table.initial_dispatch_id)
      .where(sql`${table.initial_dispatch_id} IS NOT NULL`),
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
    summary: text().notNull(),
    payload: text({ mode: "json" }).$type<EngineMetadata>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("engine_progress_task_idx").on(table.task_id),
    check("engine_progress_excludes_git_projection", sql`
      json_extract(${table.payload}, '$.kind') IS NULL OR json_extract(${table.payload}, '$.kind') <> 'git'
    `),
  ],
)

export type EngineGitCheckpointStage = "baseline" | "result" | "acceptance_round"

/** Exact write-ahead request for one repository-tree checkpoint effect. */
export const EngineGitCheckpointRequestTable = sqliteTable(
  "engine_git_checkpoint_request",
  {
    id: text().primaryKey(),
    task_id: text().notNull().references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    stage: text({ enum: ["baseline", "result", "acceptance_round"] }).notNull().$type<EngineGitCheckpointStage>(),
    operation_key: text().notNull(),
    input: text({ mode: "json" }).notNull().$type<EngineMetadata>(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("engine_git_checkpoint_request_operation_idx").on(table.task_id, table.operation_key),
    index("engine_git_checkpoint_request_task_time_idx").on(table.task_id, table.time_created),
  ],
)

/** Canonical immutable outcome for a repository-tree checkpoint request. */
export const EngineGitCheckpointOutcomeTable = sqliteTable(
  "engine_git_checkpoint_outcome",
  {
    request_id: text().primaryKey().references(() => EngineGitCheckpointRequestTable.id, { onDelete: "cascade" }),
    result: text({ mode: "json" }).notNull().$type<EngineMetadata>(),
    time_created: integer().notNull(),
  },
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
