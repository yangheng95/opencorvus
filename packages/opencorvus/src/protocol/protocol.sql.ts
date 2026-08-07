import { integer, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { Identifier } from "@/id/id"
import { EngineInteractionRequestTable, EngineTaskTable } from "@/engine/engine.sql"
import { Timestamps } from "@/storage/schema.sql"
import type { ProtocolAggregate, ProtocolInboxStatus, ProtocolKind } from "./schema"

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
    task_id: text().references(() => EngineTaskTable.id, { onDelete: "cascade" }),
    /** Optional immutable Session correlation identity. Protocol audit facts
     * outlive the Session row they describe, so this is deliberately not an
     * ownership foreign key and must never be nulled by Session deletion. */
    session_id: text(),
    interaction_id: text().references(() => EngineInteractionRequestTable.id, { onDelete: "set null" }),
    stream_id: text(),
    source: text().notNull(),
    target: text(),
    causation_id: text(),
    correlation_id: text(),
    reply_to: text(),
    seq: integer().notNull(),
    order_key: text().notNull(),
    deadline_ms: integer(),
    emitted_at: integer().notNull(),
    payload: text({ mode: "json" }).$type<ProtocolPayload>(),
    ...Timestamps,
  },
  (table) => [
    uniqueIndex("protocol_event_aggregate_seq_idx").on(table.aggregate_type, table.aggregate_id, table.seq),
    uniqueIndex("protocol_event_mailbox_invocation_idx")
      .on(table.type, table.task_id, table.session_id, table.correlation_id)
      .where(sql`${table.type} = 'mailbox.message'`),
    index("protocol_event_task_idx").on(table.task_id, table.seq),
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
    status: text().notNull().$type<ProtocolInboxStatus>().default("pending"),
    lease_owner: text(),
    lease_until: integer(),
    attempt: integer().notNull().default(0),
    visible_at: integer().notNull(),
    last_error: text(),
    ...Timestamps,
  },
  (table) => [
    uniqueIndex("protocol_inbox_envelope_actor_idx").on(table.envelope_id, table.actor, table.actor_id),
    index("protocol_inbox_visible_idx").on(table.actor, table.status, table.visible_at),
    index("protocol_inbox_lease_idx").on(table.actor, table.lease_until),
  ],
)
