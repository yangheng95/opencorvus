import { isDeepStrictEqual } from "node:util"
import { EngineInteractionRequestTable, EngineTaskTable } from "@/engine/engine.sql"
import { insertEngineInteractionRequest } from "@/engine/interaction-request"
import { projectInteractionRowInTransaction } from "@/engine/store"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { SessionTable } from "@/session/session.sql"
import { Database, and, eq } from "@/storage/db"
import { permissionInteractionRequest } from "./interaction-projection"
import { PermissionLedgerIntegrityError, readPermissionRequestFacts } from "./ledger-facts"
import type { PermissionRequest } from "./types"

/** Bind the one interaction to its original requested ledger fact. */
export function ensurePermissionInteractionInTransaction(
  db: Database.TxOrDb,
  input: { request: PermissionRequest; projectID: string },
): { interactionID: string; taskID: string } | undefined {
  const { request } = input
  const facts = readPermissionRequestFacts(db, request.id)
  if (!facts || !isDeepStrictEqual(facts.request, request)) {
    throw new Error(`Permission ${request.id} has inconsistent immutable requested ledger facts`)
  }
  const session = db.select({ projectID: SessionTable.project_id }).from(SessionTable)
    .where(eq(SessionTable.id, request.sessionID)).get()
  if (request.projectID !== input.projectID || session?.projectID !== request.projectID) {
    throw new PermissionLedgerIntegrityError("request_owner_conflict", request.id, [facts.requested.id], "project_id")
  }
  const taskID = taskIDForSession(request.sessionID)
  if (taskID !== request.taskID) {
    throw new PermissionLedgerIntegrityError("request_owner_conflict", request.id, [facts.requested.id], "task_id")
  }
  if (!taskID) return undefined
  const task = db.select({ projectID: EngineTaskTable.project_id }).from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, taskID)).get()
  if (task?.projectID !== request.projectID) {
    throw new PermissionLedgerIntegrityError("request_owner_conflict", request.id, [facts.requested.id], "task_id")
  }
  const existing = db.select().from(EngineInteractionRequestTable)
    .where(and(
      eq(EngineInteractionRequestTable.source_kind, "permission_request"),
      eq(EngineInteractionRequestTable.source_id, facts.requested.id),
    )).get()
  if (existing) {
    const projected = projectInteractionRowInTransaction(db, existing)
    if (projected.task_id !== taskID || projected.session_id !== request.sessionID ||
        projected.external_id !== request.id || projected.request_type !== "permission") {
      throw new PermissionLedgerIntegrityError("request_owner_conflict", request.id, [facts.requested.id], "interaction_source")
    }
    return { interactionID: existing.id, taskID }
  }
  const conflicting = db.select({ id: EngineInteractionRequestTable.id }).from(EngineInteractionRequestTable)
    .where(eq(EngineInteractionRequestTable.external_id, request.id)).get()
  if (conflicting) {
    throw new PermissionLedgerIntegrityError("request_owner_conflict", request.id, [facts.requested.id], "interaction_source")
  }
  const interactionID = insertEngineInteractionRequest(db, {
    taskID,
    ...permissionInteractionRequest(request),
    eventSource: "interaction.permission",
    eventSummary: `Permission requested: ${request.toolName}`,
    source: { kind: "permission_request", id: facts.requested.id },
  })
  return { interactionID, taskID }
}
