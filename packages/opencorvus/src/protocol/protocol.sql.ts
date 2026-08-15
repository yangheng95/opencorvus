import { check, integer, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { and, eq, or, sql } from "drizzle-orm"
import { Identifier } from "@/id/id"
import type {
  ProtocolAggregate,
  ProtocolDeliveryReceipt,
  ProtocolInboxStatus,
  ProtocolKind,
} from "./schema"

type ProtocolPayload = Record<string, unknown>

export const ProtocolEventTable = sqliteTable(
  "protocol_event",
  {
    id: text()
      .primaryKey()
      .$default(() => Identifier.ascending("protocol_event")),
    kind: text().notNull().$type<ProtocolKind>(),
    type: text().notNull(),
    aggregate_type: text().notNull().$type<ProtocolAggregate>(),
    aggregate_id: text().notNull(),
    /** Immutable causal correlation. This is deliberately not an ownership
     * foreign key: deleting a mutable Task projection must not rewrite facts. */
    task_id: text(),
    /** Optional immutable Session correlation identity. Protocol audit facts
     * outlive the Session row they describe, so this is deliberately not an
     * ownership foreign key and must never be nulled by Session deletion. */
    session_id: text(),
    /** Immutable causal correlation, not ownership. */
    interaction_id: text(),
    stream_id: text(),
    source: text().notNull(),
    target: text(),
    causation_id: text(),
    correlation_id: text(),
    reply_to: text(),
    seq: integer().notNull(),
    deadline_ms: integer(),
    emitted_at: integer().notNull(),
    payload: text({ mode: "json" }).$type<ProtocolPayload>(),
  },
  (table) => [
    uniqueIndex("protocol_event_aggregate_seq_idx").on(table.aggregate_type, table.aggregate_id, table.seq),
    uniqueIndex("protocol_event_mailbox_invocation_idx")
      .on(table.type, table.aggregate_id, table.session_id, table.correlation_id)
      .where(sql`${table.type} = 'mailbox.message'`),
    uniqueIndex("protocol_event_scheduler_reply_idx")
      .on(table.reply_to)
      .where(sql`${table.type} = 'scheduler.message' AND ${table.kind} = 'reply' AND ${table.reply_to} IS NOT NULL`),
    uniqueIndex("protocol_event_task_epoch_open_idx")
      .on(table.aggregate_id, sql<number>`json_extract(${table.payload}, '$.execution_epoch')`)
      .where(
        sql`${table.aggregate_type} = 'task' AND ${table.type} IN ('task.execution.opened', 'task.execution.reopened')`,
      ),
    uniqueIndex("protocol_event_task_epoch_terminal_idx")
      .on(table.aggregate_id, sql<number>`json_extract(${table.payload}, '$.execution_epoch')`)
      .where(
        sql`${table.aggregate_type} = 'task' AND ${table.type} IN ('task.cancelled', 'task.closed', 'task.completed', 'task.failed')`,
      ),
    uniqueIndex("protocol_event_task_epoch_boundary_request_idx")
      .on(table.aggregate_id, sql<number>`json_extract(${table.payload}, '$.execution_epoch')`)
      .where(
        sql`${table.aggregate_type} = 'task' AND ${table.type} IN ('task.cancellation.requested', 'task.close.requested')`,
      ),
    uniqueIndex("protocol_event_task_deleted_idx")
      .on(table.aggregate_id)
      .where(sql`${table.aggregate_type} = 'task' AND ${table.type} = 'task.deleted'`),
    uniqueIndex("protocol_event_session_deleted_idx")
      .on(table.aggregate_id)
      .where(sql`${table.aggregate_type} = 'session' AND ${table.type} = 'session.deleted'`),
    uniqueIndex("protocol_event_mission_operation_boundary_idx")
      .on(table.aggregate_id, table.correlation_id, table.type)
      .where(
        sql`${table.aggregate_type} = 'session' AND ${table.type} IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed') AND ${table.correlation_id} IS NOT NULL`,
      ),
    index("protocol_event_task_idx").on(table.task_id, table.seq),
    check("protocol_event_task_identity_shape", sql`${table.aggregate_type} <> 'task' OR ${table.task_id} IS NULL`),
    check("protocol_event_session_identity_shape", sql`${table.aggregate_type} <> 'session' OR ${table.session_id} IS NULL`),
    check("protocol_event_payload_envelope_shape", sql`
      json_type(${table.payload}, '$.taskID') IS NULL
      AND json_type(${table.payload}, '$.sessionID') IS NULL
      AND json_type(${table.payload}, '$.interactionID') IS NULL
      AND json_type(${table.payload}, '$.orderKey') IS NULL
      AND (${table.type} <> 'task.updated' OR json_type(${table.payload}, '$.status') IS NULL)
      AND (${table.type} NOT IN ('task.completed','task.failed','task.cancelled') OR json_type(${table.payload}, '$.timeCompleted') IS NULL)
    `),
    index("protocol_event_session_idx").on(table.session_id, table.seq),
    index("protocol_event_interaction_idx").on(table.interaction_id, table.seq),
    index("protocol_event_stream_idx").on(table.stream_id, table.seq),
    index("protocol_event_type_idx").on(table.type),
    index("protocol_event_task_type_session_status_idx").on(
      table.task_id,
      table.type,
      table.session_id,
      table.emitted_at,
      table.seq,
    ),
    index("protocol_event_session_type_status_order_idx").on(table.session_id, table.type, table.emitted_at, table.seq),
  ],
)

export function protocolEventBelongsToTask(taskID: string) {
  return or(
    and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, taskID)),
    eq(ProtocolEventTable.task_id, taskID),
  )!
}

export const ProtocolInboxTable = sqliteTable(
  "protocol_inbox",
  {
    id: text()
      .primaryKey()
      .$default(() => Identifier.ascending("protocol_inbox")),
    envelope_id: text()
      .notNull()
      .references(() => ProtocolEventTable.id, { onDelete: "cascade" }),
    actor: text().notNull().$type<ProtocolAggregate>(),
    actor_id: text().notNull(),
    visible_at: integer().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    uniqueIndex("protocol_inbox_envelope_actor_idx").on(table.envelope_id, table.actor, table.actor_id),
    index("protocol_inbox_visible_idx").on(table.actor, table.actor_id, table.visible_at, table.envelope_id),
  ],
)

export const ProtocolDeliveryReceiptTable = sqliteTable(
  "protocol_delivery_receipt",
  {
    id: text().primaryKey(),
    inbox_id: text().notNull().references(() => ProtocolInboxTable.id, { onDelete: "cascade" }),
    receipt: text({ mode: "json" }).notNull().$type<ProtocolDeliveryReceipt>(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("protocol_delivery_receipt_inbox_idx").on(table.inbox_id, table.time_created),
    uniqueIndex("protocol_delivery_receipt_terminal_idx")
      .on(table.inbox_id)
      .where(sql`json_extract(${table.receipt}, '$.kind') <> 'retry_wait'`),
  ],
)
