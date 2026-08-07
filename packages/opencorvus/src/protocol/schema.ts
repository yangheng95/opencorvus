import z from "zod"
import { Identifier } from "@/id/id"

export const ProtocolKind = z.enum(["command", "event", "reply"])
export type ProtocolKind = z.infer<typeof ProtocolKind>

export const ProtocolAggregate = z.enum(["task", "interaction", "session", "stream"])
export type ProtocolAggregate = z.infer<typeof ProtocolAggregate>

export const ProtocolInboxStatus = z.enum(["pending", "leased", "delivered", "dead_letter"])
export type ProtocolInboxStatus = z.infer<typeof ProtocolInboxStatus>

export const ProtocolEnvelope = z.object({
  id: Identifier.schema("protocol_event"),
  kind: ProtocolKind,
  type: z.string().min(1),
  aggregate: ProtocolAggregate,
  aggregate_id: z.string().min(1),
  task_id: Identifier.schema("task").optional(),
  session_id: Identifier.schema("session").optional(),
  interaction_id: Identifier.schema("interaction").optional(),
  stream_id: z.string().min(1).optional(),
  source: z.string().min(1),
  target: z.string().min(1).optional(),
  causation_id: Identifier.schema("protocol_event").optional(),
  correlation_id: z.string().min(1).optional(),
  reply_to: Identifier.schema("protocol_event").optional(),
  seq: z.number().int().positive(),
  deadline_ms: z.number().int().positive().optional(),
  emitted_at: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const ProtocolInboxMessage = z.object({
  id: Identifier.schema("protocol_inbox"),
  envelope_id: Identifier.schema("protocol_event"),
  actor: ProtocolAggregate,
  actor_id: z.string().min(1),
  status: ProtocolInboxStatus,
  lease_owner: z.string().min(1).optional(),
  lease_until: z.number().int().positive().optional(),
  attempt: z.number().int().nonnegative(),
  visible_at: z.number().int().positive(),
  last_error: z.string().min(1).optional(),
})
