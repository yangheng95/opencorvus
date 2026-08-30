import { Identifier } from "@/id/id"
import { createHash } from "node:crypto"
import z from "zod"

export function missionProcessRecoveryFrontierDigest(messageIDs: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify([...messageIDs].toSorted())).digest("hex")
}

export const MissionProcessRecoveryWakeReason = z
  .object({
    source: z.literal("mission.process_recovery"),
    version: z.literal(3),
    missionID: z.string().min(1),
    occurrenceID: Identifier.schema("session_control"),
    openedEventID: Identifier.schema("protocol_event"),
    deadOwnerGeneration: Identifier.schema("call"),
    interruptedFrontierDigest: z.string().regex(/^[0-9a-f]{64}$/),
    interruptedAssistantMessageIDs: z.array(Identifier.schema("message")).min(1),
  })
  .strict()
  .superRefine((reason, context) => {
    const canonical = [...new Set(reason.interruptedAssistantMessageIDs)].toSorted()
    if (
      canonical.length !== reason.interruptedAssistantMessageIDs.length ||
      canonical.some((messageID, index) => messageID !== reason.interruptedAssistantMessageIDs[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "Mission recovery interrupted frontier IDs must be unique and canonically sorted",
        path: ["interruptedAssistantMessageIDs"],
      })
    }
    if (reason.interruptedFrontierDigest !== missionProcessRecoveryFrontierDigest(canonical)) {
      context.addIssue({
        code: "custom",
        message: "Mission recovery interrupted frontier digest does not match its exact Message IDs",
        path: ["interruptedFrontierDigest"],
      })
    }
  })

export type MissionProcessRecoveryWakeReason = z.infer<typeof MissionProcessRecoveryWakeReason>
