import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { persistedSessionAgentID } from "@/agent/persisted-session-identity"
import { Database, eq } from "@/storage/db"
import { SessionTable } from "@/session/session.sql"

/** The sole read-time projection for one persisted execution occurrence.
 * Durable protocol payloads retain only occurrence facts; Session routing is
 * derived from the envelope and the descriptor for this exact input Message. */
export function projectLifecycleProperties(
  properties: Record<string, unknown>,
  sessionID: string,
  input: { orderKey: string },
): Record<string, unknown> {
  const session = Database.use((db) => db
    .select({ kind: SessionTable.kind, parentID: SessionTable.parent_id, metadata: SessionTable.metadata })
    .from(SessionTable)
    .where(eq(SessionTable.id, sessionID))
    .get())
  if (!session) throw new Error(`lifecycle projection: session ${sessionID} does not exist`)
  const inputMessageID = typeof properties.inputMessageID === "string" ? properties.inputMessageID.trim() : ""
  if (!inputMessageID) throw new Error(`lifecycle projection: session ${sessionID} has no input message identity`)
  const agentID = persistedSessionAgentID({
    sessionID,
    sessionKind: session.kind,
    metadata: session.metadata,
    projectedIdentity: WorkerTurnDescriptor.findForMessageAuthority({ sessionID, inputMessageID })?.payload.identity,
  })
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
