import { persistedExecutionIdentity } from "@/agent/persisted-execution-identity"

/** The sole read-time projection for one persisted execution occurrence.
 * Durable protocol payloads retain only occurrence facts; Session routing is
 * derived from the envelope and the descriptor for this exact input Message. */
export function projectLifecycleProperties(
  properties: Record<string, unknown>,
  sessionID: string,
  input: { orderKey: string },
): Record<string, unknown> {
  const inputMessageID = typeof properties.inputMessageID === "string" ? properties.inputMessageID.trim() : ""
  if (!inputMessageID) throw new Error(`lifecycle projection: session ${sessionID} has no input message identity`)
  const session = persistedExecutionIdentity({ sessionID, inputMessageID })
  const agentID = session.agentID
  const providedOrderKey = typeof properties.orderKey === "string" ? properties.orderKey.trim() : ""
  if (providedOrderKey && providedOrderKey !== input.orderKey) {
    throw new Error(`lifecycle projection: session ${sessionID} orderKey drift between payload and envelope`)
  }
  return {
    ...properties,
    sessionID,
    channel: session.kind === "root" ? "main" : session.kind,
    agentID,
    orderKey: input.orderKey,
    ...(session.kind === "root" ? {} : { resolvedRole: agentID }),
    ...(session.parentID ? { parentSessionID: session.parentID } : {}),
  }
}
