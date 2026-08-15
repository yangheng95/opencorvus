import { Identifier } from "@/id/id"

/** One real continuation edge is identified only by its business ingress and
 * exact predecessor. Ordinals and attempts are derived from the chain. */
export function orchestratorControlOccurrenceIdentity(ingressID: string, predecessorID: string) {
  const ingress = ingressID.trim()
  const predecessor = predecessorID.trim()
  if (!ingress || !predecessor) {
    throw new Error("Orchestrator control occurrence requires exact ingress and predecessor identities")
  }
  const material = `orchestrator-control-v2\0${ingress}\0${predecessor}`
  return {
    messageID: Identifier.deterministic("message", material),
    partID: Identifier.deterministic("part", material),
  }
}
