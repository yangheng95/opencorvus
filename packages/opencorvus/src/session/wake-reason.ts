import { Identifier } from "@/id/id"
import { MissionOperatorWakeReason } from "@/mission/operator-wake-reason"
import { SchedulerEventWakeReason } from "@/protocol/scheduler-event-wake-reason"
import { SchedulerMessageWakeReason } from "@/protocol/scheduler-message-wake-reason"
import { MissionProcessRecoveryWakeReason } from "./mission-process-recovery-schema"
import z from "zod"

/** Durable codec for authored scheduler/control wake provenance. This module
 * deliberately has no Session runtime imports so transaction-local readers do
 * not create a Session -> scheduler -> Session initialization cycle. */
export const SessionWakeReason = z.discriminatedUnion("source", [
  MissionOperatorWakeReason,
  MissionProcessRecoveryWakeReason,
  z.object({
    source: z.literal("conversation.handoff"),
    callerSessionID: Identifier.schema("session"),
    callerMessageID: Identifier.schema("message"),
    targetExperience: z.literal("work"),
  }),
  z
    .object({
      source: z.literal("api.chat"),
      requestID: z.string().trim().min(1).max(200),
      requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict(),
  SchedulerMessageWakeReason,
  z.object({
    source: z.literal("scheduler.automation"),
    jobID: z.string(),
    jobName: z.string(),
    fireID: z.string(),
    scope: z.enum(["session", "project", "global"]),
    recurrence: z.string().nullable(),
  }),
  SchedulerEventWakeReason,
])

export type SessionWakeReason = z.infer<typeof SessionWakeReason>
