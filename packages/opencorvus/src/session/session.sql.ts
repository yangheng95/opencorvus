import { sql } from "drizzle-orm"
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex, check } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import type { Message } from "./message"
import type { CapabilityRules } from "@/capability/rules"
import { Timestamps } from "@/storage/schema.sql"
import type { InteractiveArtifactPayload } from "@/interactive-artifact/schema"
import type { ToolFailureCause } from "./tool-failure-cause"

/**
 * SessionKind — the session's role/purpose, fixed at creation time.
 *
 * Authoritative source for "what is this session for" — sessionRole(sid)
 * reads this column. Do NOT re-derive role from message.agent, title
 * prefixes, or in-memory registries: that's how we got the transcript-reseed
 * bug that silently turned assistant sessions into build worker sessions.
 *
 *   root           root session of an engine_task; holds the user's request
 *   orchestrator   task-level orchestrator's own reasoning session (dispatches
 *                  build/requirements/architect/etc.; never writes code itself).
 *                  Distinct from "assistant" so overlay can label it as the
 *                  scheduler rather than a generic assistant.
 *   assistant      generic assistant dialog — projected sub-agent AND externally-driven
 *                  sessions (MCP, Debug, Coding, Panel, scheduled wakes). Standalone
 *                  callers are filtered out at the bridge by `taskIDForSession`
 *                  failing naturally; no separate "standalone" kind is needed.
 *   mission        Mission agent session — the user's long-running objective owner.
 *                  Stores mission metadata (the channelKey `mission:<id>` plus
 *                  the missionID / current cwd) pinning the `mission` agent to a
 *                  single mission. Mission dispatches squad/team engine_tasks via
 *                  panel.create_task (actor=mission, source=mission) and
 *                  coordinates them, but does not execute work itself — every
 *                  concrete artifact is produced by a dispatched task led by the
 *                  orchestrator. Distinct from the `gateway` infrastructure
 *                  surface (remote/mobile transport), which does not create
 *                  sessions of this kind. See mission split contract.
 *   requirements   requirements sub-agent (Delivery Slice decomposition)
 *   frontend-design sub-agent (vision -> template/modules/components/materials)
 *   architect      architect sub-agent
 *   integrity      review adapter session recording incremental IntegrityReview
 *                  facts. Exact projected identity remains in the worker descriptor.
 *   build          implementation runtime-template session. Exact projected
 *                  agent identity remains in the worker descriptor.
 *   explore        read-only repository-investigation subagent dispatched by
 *                  the orchestrator `explore` tool. Distinct from "assistant"
 *                  so the overlay splits each explore call into its own agent
 *                  card instead of collapsing them into the generic lane.
 *   deep-research  read-only durable evidence-gathering subagent for external
 *                  facts, current source material, and PRD/SPEC input bundles. It emits durable
 *                  research_brief artifacts.
 *   frontend-research webpage investigation specialist.
 *                  It pairs with frontend-design and emits durable
 *                  frontend_research_brief artifacts for requirements and
 *                  architect.
 *   visual-qa      dedicated frontend visual GUI fidelity and function QA
 *                  worker. GUI means Graphical User Interface. It consumes
 *                  frontend-design/build evidence, may repair in-scope visual
 *                  or functional defects, and may record a VisualReview artifact.
 *   system         internal maintenance (compaction, summary, title generation)
 */
// Single source for SessionKind. The Zod enum in session/index.ts (Info.kind)
// and any other validator MUST derive from this tuple — do not re-list the
// values (rule 8: that duplicate is exactly what silently dropped "explore").
export const SESSION_KINDS = [
  "root",
  "orchestrator",
  "assistant",
  "mission",
  "delegated-worker",
  "intent-analysis",
  "requirements",
  "frontend-design",
  "architect",
  "goal-workload-analyst",
  "integrity",
  "fact-check",
  "build",
  "explore",
  "deep-research",
  "frontend-research",
  "visual-qa",
  "system",
] as const

export type SessionKind = (typeof SESSION_KINDS)[number]

type StripPartIdentity<T> = T extends unknown ? Omit<T, "id" | "sessionID" | "messageID" | "orderKey"> : never

/** Immutable write-ahead Tool effect request. Runtime status is projected from
 * its optional outcome fact and must never be stored on this row. */
export type ToolRequestPartData = {
  type: "tool-request"
  callID: string
  tool: string
  input: Message.ToolInput
  title?: string
  metadata?: Record<string, unknown>
  time: { start: number }
}

export type ToolOutcomePartData =
  | {
      outcome: "completed"
      output: string
      resultAttemptID?: never
      title: string
      metadata: Record<string, unknown>
      time: { end: number }
      attachments?: Message.FilePart[]
    }

  | {
      outcome: "completed"
      resultAttemptID: string
      output?: never
      title: string
      metadata: Record<string, unknown>
      time: { end: number }
      attachments?: Message.FilePart[]
    }
  | {
      outcome: "failed"
      failure: ToolFailureCause
      metadata?: Record<string, unknown>
      time: { end: number }
    }

export type ToolProgressPartData = {
  title?: string
  metadata?: Record<string, unknown>
}

export type ProviderActivityOutcomeData = {
  outcome: "done" | "failed" | "aborted"
  attempt_count?: number
  error_class?: string
  error?: { name: string; message: string }
}

export type PartData = StripPartIdentity<Exclude<Message.Part, Message.ToolPart>>
type InfoData = Omit<Message.Info, "id" | "sessionID">

export const SessionTable = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    parent_id: text(),
    slug: text().notNull(),
    directory: text().notNull(),
    title: text().notNull(),
    version: text().notNull(),
    /** Session's role/purpose, fixed at creation time. See SessionKind above. */
    kind: text().notNull().$type<SessionKind>(),
    share_url: text(),
    summary_additions: integer(),
    summary_deletions: integer(),
    summary_files: integer(),
    permission: text({ mode: "json" }).$type<CapabilityRules.Ruleset>(),
    /** Free-form per-session metadata. */
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
    time_archived: integer(),
    /** User-facing pin timestamp. Pinning changes Work Ledger rank without
     *  rewriting conversational activity time. */
    time_pinned: integer(),
  },
  (table) => [
    index("session_project_idx").on(table.project_id),
    index("session_parent_idx").on(table.parent_id),
    index("session_kind_idx").on(table.kind),
    index("session_time_pinned_idx").on(table.time_pinned),
    uniqueIndex("session_mission_identity_idx")
      .on(table.project_id, table.directory, sql<string>`json_extract(${table.metadata}, '$.mission.id')`)
      .where(sql`${table.kind} = 'mission'`),
  ],
)

export const MessageTable = sqliteTable(
  "message",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<InfoData>(),
  },
  (table) => [
    index("message_session_idx").on(table.session_id),
    index("message_session_time_idx").on(table.session_id, table.time_created),
  ],
)

export const PartTable = sqliteTable(
  "part",
  {
    id: text().primaryKey(),
    message_id: text()
      .notNull()
      .references(() => MessageTable.id, { onDelete: "cascade" }),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<PartData>(),
  },
  (table) => [
    index("part_message_idx").on(table.message_id),
    index("part_message_time_idx").on(table.message_id, table.time_created),
    index("part_type_time_idx").on(
      sql`json_extract(${table.data}, '$.type')`,
      table.time_created,
      table.id,
    ),
    check("part_excludes_tool_effect_state", sql`json_extract(${table.data}, '$.type') NOT IN ('tool', 'tool-request', 'tool-outcome')`),
  ],
)

export const ToolPartRequestTable = sqliteTable(
  "tool_part_request",
  {
    id: text().primaryKey(),
    message_id: text().notNull().references(() => MessageTable.id, { onDelete: "cascade" }),
    data: text({ mode: "json" }).notNull().$type<ToolRequestPartData>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("tool_part_request_message_idx").on(table.message_id, table.time_created),
    uniqueIndex("tool_part_request_call_idx").on(
      table.message_id,
      sql<string>`json_extract(${table.data}, '$.callID')`,
    ),
    check("tool_part_request_fact_shape", sql`
      json_extract(${table.data}, '$.type') = 'tool-request'
      AND json_type(${table.data}, '$.callID') = 'text'
      AND json_type(${table.data}, '$.tool') = 'text'
      AND json_type(${table.data}, '$.time.start') IN ('integer', 'real')
      AND json_type(${table.data}, '$.state') IS NULL
    `),
  ],
)

/** Append-only live progress emitted by one running Tool request. The latest
 * row is projected into the visible running ToolPart; terminal outcome facts
 * remain the sole authority after settlement. */
export const ToolPartProgressTable = sqliteTable(
  "tool_part_progress",
  {
    id: text().primaryKey(),
    request_part_id: text()
      .notNull()
      .references(() => ToolPartRequestTable.id, { onDelete: "cascade" }),
    title: text(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("tool_part_progress_request_idx").on(table.request_part_id, table.time_created, table.id),
    check("tool_part_progress_fact_shape", sql`
      (${table.title} IS NOT NULL OR ${table.metadata} IS NOT NULL)
      AND (${table.metadata} IS NULL OR json_type(${table.metadata}) = 'object')
    `),
  ],
)

/** Exactly one immutable outcome Part may settle a Tool request Part. */
export const ToolPartOutcomeTable = sqliteTable(
  "tool_part_outcome",
  {
    id: text().primaryKey(),
    request_part_id: text()
      .notNull()
      .references(() => ToolPartRequestTable.id, { onDelete: "cascade" }),
    data: text({ mode: "json" }).notNull().$type<ToolOutcomePartData>(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("tool_part_outcome_request_idx").on(table.request_part_id),
    check("tool_part_outcome_fact_shape", sql`
      json_type(${table.data}, '$.time.end') IN ('integer', 'real')
      AND json_type(${table.data}, '$.input') IS NULL AND json_type(${table.data}, '$.status') IS NULL
      AND (
        COALESCE((json_extract(${table.data}, '$.outcome')='completed'
          AND json_type(${table.data}, '$.title')='text'
          AND json_type(${table.data}, '$.metadata')='object'
          AND json_type(${table.data}, '$.failure') IS NULL
          AND ((json_type(${table.data}, '$.output')='text' AND json_type(${table.data}, '$.resultAttemptID') IS NULL)
            OR (json_type(${table.data}, '$.output') IS NULL AND json_type(${table.data}, '$.resultAttemptID')='text'))),0)
        OR
        COALESCE((json_extract(${table.data}, '$.outcome')='failed'
          AND json_type(${table.data}, '$.failure')='object'
          AND json_type(${table.data}, '$.output') IS NULL
          AND json_type(${table.data}, '$.resultAttemptID') IS NULL
          AND json_type(${table.data}, '$.title') IS NULL),0)
      )
    `),
  ],
)

/** One immutable write-ahead request per provider activity. The linked
 * assistant Message supplies the exact model, parent and activation identity. */
export const ProviderActivityRequestTable = sqliteTable(
  "provider_activity_request",
  {
    id: text().primaryKey(),
    assistant_message_id: text().notNull().references(() => MessageTable.id, { onDelete: "cascade" }),
    time_created: integer().notNull(),
  },
  (table) => [
    index("provider_activity_request_message_idx").on(table.assistant_message_id, table.time_created, table.id),
  ],
)

/** Exactly one immutable provider result settles a provider activity. */
export const ProviderActivityOutcomeTable = sqliteTable(
  "provider_activity_outcome",
  {
    id: text().primaryKey(),
    request_id: text().notNull().references(() => ProviderActivityRequestTable.id, { onDelete: "cascade" }),
    data: text({ mode: "json" }).notNull().$type<ProviderActivityOutcomeData>(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("provider_activity_outcome_request_idx").on(table.request_id),
    check("provider_activity_outcome_fact_shape", sql`
      json_extract(${table.data}, '$.outcome') IN ('done', 'failed', 'aborted')
      AND json_type(${table.data}, '$.status') IS NULL
      AND json_type(${table.data}, '$.attempt') IS NULL
      AND (
        json_type(${table.data}, '$.attempt_count') IS NULL
        OR (
          json_type(${table.data}, '$.attempt_count')='integer'
          AND json_extract(${table.data}, '$.attempt_count') >= 1
        )
      )
    `),
  ],
)

export const InteractiveArtifactTable = sqliteTable(
  "interactive_artifact",
  {
    id: text().primaryKey(),
    message_id: text()
      .notNull()
      .references(() => MessageTable.id, { onDelete: "cascade" }),
    payload: text({ mode: "json" }).notNull().$type<InteractiveArtifactPayload>(),
    ...Timestamps,
  },
  (table) => [index("interactive_artifact_message_idx").on(table.message_id)],
)

export type SessionControlKind =
  | "manual_summarize"
  | "compaction_request"
  | "wake_reason"
  | "mission_process_recovery"

export type SessionControlStatus = "pending" | "consumed" | "failed"

export const SessionControlRecordTable = sqliteTable(
  "session_control_record",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    kind: text().notNull().$type<SessionControlKind>(),
    source: text(),
    payload: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("session_control_session_idx").on(table.session_id),
    index("session_control_kind_idx").on(table.kind),
  ],
)

/** Immutable amendment or terminal receipt for one Session control input. */
export const SessionControlEventTable = sqliteTable(
  "session_control_event",
  {
    id: text().primaryKey(),
    control_id: text().notNull().references(() => SessionControlRecordTable.id, { onDelete: "cascade" }),
    kind: text({ enum: ["amended", "consumed", "failed"] }).notNull(),
    payload: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("session_control_event_control_idx").on(table.control_id, table.time_created),
    uniqueIndex("session_control_event_terminal_idx")
      .on(table.control_id)
      .where(sql`${table.kind} IN ('consumed', 'failed')`),
    check("session_control_event_shape", sql`
      (${table.kind}='amended' AND ${table.payload} IS NOT NULL)
      OR (${table.kind}='consumed' AND ${table.payload} IS NULL)
      OR (${table.kind}='failed' AND json_type(${table.payload}, '$.error')='text')
    `),
  ],
)

/** One physical prompt-loop owner for a durable Session. A process occurrence,
 * not a timeout, is the takeover boundary because Provider/Tool effects cannot
 * be made safe by a clock-only lease without fencing every external byte. */
export const SessionPromptOwnerTable = sqliteTable(
  "session_prompt_owner",
  {
    session_id: text()
      .primaryKey()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    directory: text().notNull(),
    generation: text().notNull(),
    owner_pid: integer().notNull(),
    owner_process_instance_id: text().notNull(),
    owner_occurrence_id: text().notNull(),
    time_acquired: integer().notNull(),
  },
  (table) => [index("session_prompt_owner_project_idx").on(table.project_id)],
)

export const WorkerTurnDescriptorTable = sqliteTable(
  "worker_turn_descriptor",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    hash: text().notNull(),
    agent: text().notNull(),
    payload: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [
    index("worker_turn_descriptor_session_idx").on(table.session_id),
    index("worker_turn_descriptor_hash_idx").on(table.hash),
  ],
)

export const TodoTable = sqliteTable(
  "todo",
  {
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    status: text().notNull(),
    priority: text().notNull(),
    position: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.position] }),
    index("todo_session_idx").on(table.session_id),
  ],
)

export const TodoSnapshotTable = sqliteTable("todo_snapshot", {
  session_id: text()
    .primaryKey()
    .references(() => SessionTable.id, { onDelete: "cascade" }),
  revision: integer().notNull(),
})
