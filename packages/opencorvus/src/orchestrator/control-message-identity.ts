/** One real continuation edge is identified only by its business ingress and
 * exact predecessor. The reversible current-epoch identity lets SQLite enforce
 * the same occurrence without a second binding table or a hash extension. */
export function orchestratorControlOccurrenceIdentity(ingressID: string, predecessorID: string) {
  if (!/^art_h[A-Za-z0-9]{19}$/.test(ingressID)) {
    throw new Error("Orchestrator control occurrence requires one canonical Task-root ingress identity")
  }
  if (!/^(?:art|msg)_[gh-][A-Za-z0-9]{19}$/.test(predecessorID)) {
    throw new Error("Orchestrator control occurrence requires one canonical predecessor identity")
  }
  const suffix = `task-root-control_${ingressID}_${predecessorID}`
  return {
    messageID: `msg_${suffix}`,
    partID: `prt_${suffix}`,
  }
}
