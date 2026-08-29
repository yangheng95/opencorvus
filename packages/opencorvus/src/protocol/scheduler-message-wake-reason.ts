import { Identifier } from "@/id/id"
import z from "zod"
import { SchedulerEndpoint, SchedulerMessageKind } from "./schema"

export const SchedulerMessageWakeReason = z
  .object({
    source: z.literal("scheduler.message"),
    eventID: Identifier.schema("protocol_event"),
    inboxID: Identifier.schema("protocol_inbox"),
    threadID: z.string().min(1),
    messageKind: SchedulerMessageKind,
    sourceEndpoint: SchedulerEndpoint,
    targetEndpoint: SchedulerEndpoint,
    /** Exact Mission execution occurrence admitted by the Message commit
     * fence. Historical scheduler wakes may omit this and are reduced through
     * their append-only historical authority; only an unprovable topology
     * becomes an explicit integrity boundary. */
    missionOccurrence: z
      .object({
        openedEventID: Identifier.schema("protocol_event"),
        openedOperationID: z.string().uuid(),
      })
      .strict()
      .optional(),
    replyTo: Identifier.schema("protocol_event").optional(),
  })
  .strict()

export type SchedulerMessageWakeReason = z.infer<typeof SchedulerMessageWakeReason>
