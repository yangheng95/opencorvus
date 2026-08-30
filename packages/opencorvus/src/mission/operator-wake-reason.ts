import { Identifier } from "@/id/id"
import z from "zod"

export const MissionOperatorWakeReason = z
  .object({
    source: z.literal("mission.operator"),
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    openedEventID: Identifier.schema("protocol_event"),
  })
  .strict()

export type MissionOperatorWakeReason = z.infer<typeof MissionOperatorWakeReason>
