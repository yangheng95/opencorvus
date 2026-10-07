import {
  findWorkerTurnDescriptorForDispatchInTransaction,
  workerTurnDescriptorInfoFromRow,
} from "@/agent/worker-turn-descriptor-facts"
import { ProtocolStore } from "@/protocol/store"
import { MessageTable, SessionTable, WorkerTurnDescriptorTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { Database, and, eq, sql } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"
import { findDispatchLineageByDispatchIDInTransaction } from "./dispatch-lineage-facts"
import { sessionLineageIdentity } from "./task-session-lineage"

/** Read the existing ingress validator's exact accepted input occurrence. */
export function readTaskWorkerTerminalOccurrence(input: { taskID: string; sessionID: string; dispatchID: string }) {
  return Database.use((db) => {
    const lineage = findDispatchLineageByDispatchIDInTransaction({
      db,
      taskID: input.taskID,
      dispatchID: input.dispatchID,
    })
    if (!lineage || lineage.payload.child_session_id !== input.sessionID) return { kind: "missing_lineage" as const }
    const descriptor = findWorkerTurnDescriptorForDispatchInTransaction(db, {
      sessionID: input.sessionID,
      dispatchID: input.dispatchID,
    })
    if (!descriptor) return { kind: "missing_descriptor" as const }
    const inputMessageID = descriptor.payload.messageAuthority.user_message_id
    const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
      input.sessionID,
      "agent.execution.lifecycle",
      inputMessageID,
    )
    if (!lifecycle) return { kind: "nonterminal" as const }
    if (
      lifecycle.type !== "agent.execution.lifecycle" ||
      lifecycle.taskID !== input.taskID ||
      lifecycle.sessionID !== input.sessionID ||
      lifecycle.payload?.inputMessageID !== inputMessageID
    ) {
      throw new Error(`Lifecycle ${lifecycle.id} identity drift for dispatch ${input.dispatchID}`)
    }
    const status = SessionStatus.Info.parse(lifecycle.payload?.status)
    if (status.type !== "terminal") return { kind: "nonterminal" as const }
    return { kind: "terminal" as const, lineage, descriptor, lifecycle, status, inputMessageID }
  })
}

/** One reader/quotation authority, scoped before inspecting an occurrence's facts. */
export function findTaskWorkerFinalMessageAuthority(input: { taskID: string; messageID: string }) {
  return Database.use((db) => {
    const message = db
      .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.messageID))
      .get()
    if (!message || message.data.role !== "assistant") return undefined
    const parentID =
      "parentID" in message.data && typeof message.data.parentID === "string" ? message.data.parentID : undefined
    if (!parentID) return undefined
    const rows = db
      .select()
      .from(WorkerTurnDescriptorTable)
      .where(
        and(
          eq(WorkerTurnDescriptorTable.task_id, input.taskID),
          eq(WorkerTurnDescriptorTable.session_id, message.sessionID),
          sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.messageAuthority.user_message_id') = ${parentID}`,
        ),
      )
      .all()
    if (rows.length > 1)
      throw new Error(`Worker final Message ${input.messageID} has multiple accepted input descriptors`)
    if (rows.length !== 1) return undefined
    const descriptor = workerTurnDescriptorInfoFromRow(rows[0]!)
    const dispatchID = descriptor.payload.dispatchTurn?.current_dispatch_id
    if (!dispatchID) return undefined
    const occurrence = readTaskWorkerTerminalOccurrence({
      taskID: input.taskID,
      sessionID: message.sessionID,
      dispatchID,
    })
    if (
      occurrence.kind !== "terminal" ||
      occurrence.descriptor.id !== descriptor.id ||
      occurrence.inputMessageID !== parentID ||
      occurrence.status.final_message_id !== input.messageID
    )
      return undefined
    const task = db
      .select({ projectID: EngineTaskTable.project_id, rootSessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, input.taskID))
      .get()
    const session = db
      .select({ projectID: SessionTable.project_id })
      .from(SessionTable)
      .where(eq(SessionTable.id, message.sessionID))
      .get()
    const ancestry = sessionLineageIdentity(message.sessionID)
    const accepted = db
      .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.id, occurrence.inputMessageID))
      .get()
    if (
      !task ||
      !session ||
      task.projectID !== session.projectID ||
      rows[0]!.project_id !== task.projectID ||
      !ancestry ||
      ancestry.projectID !== task.projectID ||
      !task.rootSessionID ||
      !ancestry.sessionIDs.includes(task.rootSessionID) ||
      descriptor.payload.lifecycle.taskID !== input.taskID ||
      descriptor.payload.identity.agentID !== occurrence.lineage.payload.target_agent_id ||
      message.data.agent !== descriptor.payload.identity.agentID ||
      !accepted ||
      accepted.sessionID !== message.sessionID ||
      accepted.data.role !== "user"
    )
      return undefined
    return occurrence
  })
}
