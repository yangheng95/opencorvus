import { Identifier } from "@/id/id"

/** One durable wake owns one domain-separated visible control occurrence. */
export function orchestratorControlOccurrenceIdentity(wakeID: string) {
  const exactWakeID = wakeID.trim()
  if (!exactWakeID) throw new Error("Orchestrator control occurrence requires an exact wake identity")
  return {
    messageID: Identifier.deterministic("message", `orchestrator-control\0${exactWakeID}`),
    partID: Identifier.deterministic("part", `orchestrator-control\0${exactWakeID}`),
  }
}
