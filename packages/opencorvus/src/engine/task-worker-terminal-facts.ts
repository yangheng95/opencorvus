import {
  findWorkerTurnDescriptorForDispatchInTransaction,
  workerTurnDescriptorInfoFromRow,
} from "@/agent/worker-turn-descriptor-facts"
import { ProtocolStore } from "@/protocol/store"
import { MessageTable, SessionTable, WorkerTurnDescriptorTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { Database, and, eq, sql } from "@/storage/db"
import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import { findDispatchLineageByDispatchIDInTransaction } from "./dispatch-lineage-facts"
import { sessionLineageIdentity } from "./task-session-lineage"
import { parseDispatchSettlementPayload } from "./dispatch-settlement"

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

/** A committed failure ends its exact accepted Turn even after delivery/restart. */
export function readSettledTaskWorkerLifecycleInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; sessionID: string; dispatchID: string },
) {
  const row = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "dispatch_settlement"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
      ),
    )
    .get()
  if (!row) return undefined
  const settlement = parseDispatchSettlementPayload(row.payload, row.id)
  const outcome = settlement.outcome
  if (outcome.kind !== "infrastructure_failure" || !outcome.session_id || !outcome.worker_turn) return undefined
  if (ProtocolStore.latestTaskEvent(input.taskID, "task.deleted")) return undefined
  const descriptor = findWorkerTurnDescriptorForDispatchInTransaction(db, input)
  // A failed preparation can retain its predecessor's accepted Turn snapshot.
  // It has no descriptor for this dispatch and cannot settle that predecessor.
  if (!descriptor) return undefined
  const accepted = outcome.worker_turn
  const inputMessageID = descriptor.payload.messageAuthority.user_message_id
  const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
    input.sessionID,
    SessionStatus.Event.Status.type,
    inputMessageID,
  )
  if (lifecycle) {
    if (lifecycle.taskID !== input.taskID || lifecycle.sessionID !== input.sessionID) {
      throw new Error(`Lifecycle ${lifecycle.id} identity drift for settled dispatch ${input.dispatchID}`)
    }
    // An existing physical terminal owns its outcome. Post-turn failures can
    // retain a later accepted descriptor and do not replace that terminal.
    if (SessionStatus.Info.parse(lifecycle.payload?.status).type === "terminal") return undefined
  }
  const lineage = findDispatchLineageByDispatchIDInTransaction({ db, ...input })
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
  const descriptorProject = db
    .select({ projectID: WorkerTurnDescriptorTable.project_id })
    .from(WorkerTurnDescriptorTable)
    .where(eq(WorkerTurnDescriptorTable.id, descriptor.id))
    .get()
  const session = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
  const message = db.select().from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get()
  const ancestry = sessionLineageIdentity(input.sessionID)
  if (
    settlement.task_id !== input.taskID ||
    settlement.session_id !== input.sessionID ||
    outcome.session_id !== input.sessionID ||
    descriptor.payload.lifecycle.taskID !== input.taskID ||
    accepted.descriptor_id !== descriptor.id ||
    accepted.descriptor_hash !== descriptor.hash ||
    accepted.input_message_id !== inputMessageID ||
    accepted.current_dispatch_id !== input.dispatchID ||
    !lineage ||
    lineage.artifactID !== settlement.dispatch_lineage_id ||
    lineage.payload.child_session_id !== input.sessionID ||
    lineage.payload.target_agent_id !== descriptor.payload.identity.agentID ||
    outcome.recovery_authority.occurrence_status !== "occurrence_committed" ||
    outcome.recovery_authority.dispatch_id !== input.dispatchID ||
    outcome.recovery_authority.dispatch_lineage_id !== lineage.artifactID ||
    !task ||
    descriptorProject?.projectID !== task.project_id ||
    !session ||
    task.project_id !== session.project_id ||
    !ancestry ||
    ancestry.projectID !== task.project_id ||
    !task.session_id ||
    !ancestry.sessionIDs.includes(task.session_id) ||
    !message ||
    message.session_id !== input.sessionID ||
    message.data.role !== "user"
  )
    throw new Error(`Settled worker ${input.dispatchID} has inconsistent accepted lifecycle authority`)
  return {
    ...input,
    inputMessageID,
    settlementArtifactID: row.id,
    session: { id: session.id, directory: session.directory, projectID: session.project_id },
    status: { type: "terminal" as const, reason: "error" as const, error: outcome.message },
  }
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
