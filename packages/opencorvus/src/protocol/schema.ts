import z from "zod"
import { Identifier } from "@/id/id"

export const ProtocolKind = z.enum(["command", "event", "reply"])
export type ProtocolKind = z.infer<typeof ProtocolKind>

export const ProtocolAggregate = z.enum(["task", "interaction", "session", "stream"])
export type ProtocolAggregate = z.infer<typeof ProtocolAggregate>

export const ProtocolInboxStatus = z.enum(["pending", "leased", "delivered", "dead_letter"])
export type ProtocolInboxStatus = z.infer<typeof ProtocolInboxStatus>

export const SchedulerEndpoint = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("mission_scheduler"),
      project_id: z.string().min(1),
      mission_id: z.string().min(1),
      session_id: Identifier.schema("session"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("task_scheduler"),
      project_id: z.string().min(1),
      task_id: Identifier.schema("task"),
      root_session_id: Identifier.schema("session"),
    })
    .strict(),
])
export type SchedulerEndpoint = z.infer<typeof SchedulerEndpoint>

export const SchedulerMessageKind = z.enum(["request", "reply", "notification"])
export type SchedulerMessageKind = z.infer<typeof SchedulerMessageKind>

export const SchedulerMessagePayload = z
  .object({
    protocol: z.literal("scheduler-message-v2"),
    /** Exact caller-owned invocation atom used to derive the compact
     * scheduler delivery identity. Persisting it makes truncated-identity
     * collisions distinguishable from same-material replay. */
    invocation_id: z.string().min(1),
    message_kind: SchedulerMessageKind,
    thread_id: z.string().min(1),
    source_message_id: Identifier.schema("message").optional(),
    source_part_id: Identifier.schema("part").optional(),
    source_terminal_event_id: Identifier.schema("protocol_event").optional(),
    /** Immutable execution occurrence of a Task sender. Mission senders use
     * null. Replies must reverse both source and target occurrence identities. */
    source_task_occurrence_started_at: z.number().int().positive().nullable(),
    /** Immutable execution occurrence of a Task recipient. Mission recipients
     * use null. The Host compares this with the current Task row before
     * materializing any Message or root ingress. */
    target_task_occurrence_started_at: z.number().int().positive().nullable(),
    source_body_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    subject: z.string().min(1).max(500),
  })
  .strict()
  .superRefine((payload, context) => {
    const hasMessage = Boolean(payload.source_message_id || payload.source_part_id)
    const hasTerminal = Boolean(payload.source_terminal_event_id)
    if (hasMessage === hasTerminal) {
      context.addIssue({
        code: "custom",
        message: "scheduler message requires exactly one source occurrence",
      })
    }
    if (hasMessage && (!payload.source_message_id || !payload.source_part_id)) {
      context.addIssue({
        code: "custom",
        message: "scheduler Message source requires an exact Message/Part pair",
      })
    }
  })
export type SchedulerMessagePayload = z.infer<typeof SchedulerMessagePayload>

export const ProtocolInboxDeliveryResult = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("task_ingress"),
      message_id: Identifier.schema("message"),
      ingress_id: Identifier.schema("artifact"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("session_wake"),
      message_id: Identifier.schema("message"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("mission_wake_closed"),
      message_id: Identifier.schema("message"),
      closure_event_id: Identifier.schema("protocol_event"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("mission_closed"),
      closure_event_id: Identifier.schema("protocol_event"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dead_letter"),
      error_name: z.string().min(1),
      message: z.string().min(1),
    })
    .strict(),
])
export type ProtocolInboxDeliveryResult = z.infer<typeof ProtocolInboxDeliveryResult>

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
  delivery_result: ProtocolInboxDeliveryResult.optional(),
  time_completed: z.number().int().positive().optional(),
})
