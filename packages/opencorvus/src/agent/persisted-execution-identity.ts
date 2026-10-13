import { Database, eq } from "@/storage/db"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { persistedSessionAgentID } from "./persisted-session-identity"
import { WorkerTurnDescriptor } from "./worker-turn-descriptor"

/** Resolve an occurrence from its own persisted input, never the latest turn. */
export function persistedExecutionIdentity(input: { sessionID: string; inputMessageID: string }) {
  const session = Database.use((db) =>
    db
      .select({ kind: SessionTable.kind, parentID: SessionTable.parent_id, metadata: SessionTable.metadata })
      .from(SessionTable)
      .where(eq(SessionTable.id, input.sessionID))
      .get(),
  )
  if (!session) throw new Error(`Execution identity ${input.sessionID} requires a persisted Session`)
  const message = Database.use((db) =>
    db
      .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.inputMessageID))
      .get(),
  )
  if (!message || message.sessionID !== input.sessionID || message.data.role !== "user") {
    throw new Error(`Execution identity ${input.sessionID}/${input.inputMessageID} requires its durable user Message`)
  }
  const descriptor = WorkerTurnDescriptor.findForMessageAuthority(input)
  const agentID = persistedSessionAgentID({
    sessionID: input.sessionID,
    sessionKind: session.kind,
    metadata: session.metadata,
    projectedIdentity: descriptor?.payload.identity,
    inputAgentID: message.data.agent,
  })
  // A root Session is the control inbox; its user messages address another Agent.
  if (session.kind !== "root" && message.data.agent !== agentID) {
    throw new Error(
      `Execution identity ${input.sessionID}/${input.inputMessageID} target ${message.data.agent} differs from owner ${agentID}`,
    )
  }
  return { agentID, kind: session.kind, parentID: session.parentID, preparedAt: descriptor?.time.created }
}
