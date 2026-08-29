import { Identifier } from "@/id/id"
import z from "zod"

export const MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE =
  "scheduler.message.mission_occurrence_binding.historical"
export const MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE =
  "scheduler.message.mission_occurrence_binding.unavailable"

const AuthorityEnvelope = z
  .object({
    version: z.literal(1),
    inboxID: Identifier.schema("protocol_inbox"),
    messageID: Identifier.schema("message"),
    schedulerEventID: Identifier.schema("protocol_event"),
  })
  .strict()

export const MissionSchedulerWakeExactAuthority = AuthorityEnvelope.extend({
  openedEventID: Identifier.schema("protocol_event"),
  openedOperationID: z.string().uuid(),
  historicalClosureEventID: Identifier.schema("protocol_event").optional(),
}).strict()

export const MissionSchedulerWakeUnavailableAuthority = AuthorityEnvelope.extend({
  reason: z.enum([
    "no_opened_occurrence",
    "opened_occurrence_not_before_message",
    "multiple_opened_occurrences",
    "invalid_opened_occurrence_identity",
    "invalid_wake_persistence_order",
    "preceding_closure_without_opened_occurrence",
    "closure_not_after_wake",
  ]),
}).strict()

export const MissionSchedulerWakeHistoricalAuthority = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal(MISSION_SCHEDULER_WAKE_EXACT_AUTHORITY_TYPE),
      payload: MissionSchedulerWakeExactAuthority,
    })
    .strict(),
  z
    .object({
      type: z.literal(MISSION_SCHEDULER_WAKE_UNAVAILABLE_AUTHORITY_TYPE),
      payload: MissionSchedulerWakeUnavailableAuthority,
    })
    .strict(),
])
