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
    replyTo: Identifier.schema("protocol_event").optional(),
  })
  .strict()

export type SchedulerMessageWakeReason = z.infer<typeof SchedulerMessageWakeReason>
