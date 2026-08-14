import { Identifier } from "@/id/id"

/** One terminal Mission owns one domain-separated caller receipt occurrence. */
export function missionCallerReceiptOccurrenceIdentity(missionSessionID: string) {
  const exactMissionSessionID = missionSessionID.trim()
  if (!exactMissionSessionID) throw new Error("Mission caller receipt requires an exact Mission Session identity")
  return {
    messageID: Identifier.deterministic("message", `mission-caller-receipt\0${exactMissionSessionID}`),
    partID: Identifier.deterministic("part", `mission-caller-receipt\0${exactMissionSessionID}`),
  }
}
