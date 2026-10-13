import { Identifier } from "@/id/id"
import { HostProcessingFaultError } from "@/llm/host-fault"
import { resultFromDurable } from "@/permission/execution-result"
import { PermissionExecutionResultTable, PermissionLedgerTable } from "@/permission/permission.sql"
import type { Database } from "@/storage/db"
import { and, eq } from "drizzle-orm"
import { MessageTable, SessionTable, ToolPartRequestTable, type ToolOutcomePartData } from "./session.sql"
import type { Message } from "./message"
import { normalizeToolResult } from "./tool-result-normalization"

/**
 * The canonical string output of a completed tool outcome. A completed outcome
 * either carries its output inline or defers it to a durable Permission result
 * through `resultAttemptID`; every reader that reconstructs persisted tool facts
 * must resolve both, or a deferred output reads as an absent one.
 */
export function completedToolOutcomeOutput(
  db: Database.TxOrDb,
  outcome: ToolOutcomePartData,
  describe: () => string,
): string | undefined {
  if (outcome.outcome !== "completed") return undefined
  if (!("resultAttemptID" in outcome) || !outcome.resultAttemptID) {
    return "output" in outcome ? outcome.output : undefined
  }
  const stored = db
    .select({ result: PermissionExecutionResultTable.result })
    .from(PermissionExecutionResultTable)
    .where(eq(PermissionExecutionResultTable.attempt_id, outcome.resultAttemptID))
    .get()?.result as { kind?: string; value?: unknown } | undefined
  if (!stored) {
    throw new Error(`${describe()} references missing Permission result ${outcome.resultAttemptID}`)
  }
  return normalizeToolResult(resultFromDurable(stored)).output
}

/** A successful receipt belongs to this exact accepted invocation, even when
 * its authorization continuation has already been retired. */
export function completedToolExecutionResult(db: Database.TxOrDb, part: Message.ToolPart): {
  attemptID: string; projectID: string; completedAt: number; value: unknown
} | undefined {
  const owner = db.select({ projectID: SessionTable.project_id, request: ToolPartRequestTable.data }).from(ToolPartRequestTable)
    .innerJoin(MessageTable, eq(MessageTable.id, ToolPartRequestTable.message_id))
    .innerJoin(SessionTable, eq(SessionTable.id, MessageTable.session_id))
    .where(and(eq(ToolPartRequestTable.id, part.id), eq(MessageTable.id, part.messageID),
      eq(SessionTable.id, part.sessionID))).get()
  if (!owner || owner.request.callID !== part.callID || owner.request.tool !== part.tool) {
    throw new HostProcessingFaultError(`Tool ${part.id} has no accepted invocation owner`)
  }
  const requests = db.selectDistinct({ id: PermissionLedgerTable.request_id }).from(PermissionLedgerTable).where(and(
    eq(PermissionLedgerTable.event_type, "requested"), eq(PermissionLedgerTable.project_id, owner.projectID),
    eq(PermissionLedgerTable.session_id, part.sessionID), eq(PermissionLedgerTable.message_id, part.messageID),
    eq(PermissionLedgerTable.tool_call_id, part.callID), eq(PermissionLedgerTable.tool_name, part.tool),
  )).all()
  const completed = requests.flatMap((request) => {
    const attemptID = Identifier.deterministic("permission", `attempt\0${request.id}`)
    const outcome = db.select({ type: PermissionLedgerTable.event_type }).from(PermissionLedgerTable)
      .where(and(eq(PermissionLedgerTable.request_id, request.id), eq(PermissionLedgerTable.outcome_slot, attemptID))).get()
    const receipt = db.select().from(PermissionExecutionResultTable)
      .where(eq(PermissionExecutionResultTable.attempt_id, attemptID)).get()
    if (outcome?.type !== "execution_succeeded" && !receipt) return []
    if (outcome?.type !== "execution_succeeded" || !receipt) {
      throw new HostProcessingFaultError(`Tool ${part.id} Permission success/result pair is incomplete for ${attemptID}`)
    }
    return [{ attemptID, projectID: owner.projectID, completedAt: receipt.time_created, value: resultFromDurable(receipt.result) }]
  })
  if (completed.length > 1) throw new HostProcessingFaultError(`Tool ${part.id} has multiple successful Permission results`)
  return completed[0]
}
