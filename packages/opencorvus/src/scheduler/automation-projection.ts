import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { Database, asc, eq, inArray } from "@/storage/db"
import { AutomationRunReceiptTable, AutomationRunTable, AutomationTable } from "./automation.sql"
import { Recurrence } from "./recurrence"
import { createHash } from "node:crypto"
import { assertSchedulerMissionReservationInTransaction } from "./mission-reservation"

export type AutomationRunRow = typeof AutomationRunTable.$inferSelect & {
  automation_id: string
  target_scope: "session" | "project" | "global"
  project_id: string | null
  session_id: string | null
  owner: string | null
  outcome: "running" | "retry_wait" | "succeeded" | "failed" | "disposition"
  disposition: "mission_closed" | null
  closure_event_id: string | null
  completed_at: number | null
  error: string | null
  retry_at: number | null
}

function deterministicRunSessionID(runID: string): string {
  return `ses_automation_${createHash("sha256").update(runID).digest("hex").slice(0, 32)}`
}

export function projectAutomationRunInTransaction(db: Database.TxOrDb, row: typeof AutomationRunTable.$inferSelect): AutomationRunRow {
  const definition = db.select({
    definitionID: AutomationTable.definition_id,
    kind: AutomationTable.kind,
    scope: AutomationTable.scope,
    projectID: AutomationTable.project_id,
    sessionID: AutomationTable.session_id,
  }).from(AutomationTable)
    .where(eq(AutomationTable.id, row.automation_revision_id)).get()
  if (!definition) throw new Error(`Automation run ${row.id} references missing definition revision ${row.automation_revision_id}`)
  const receipt = db.select().from(AutomationRunReceiptTable)
    .where(eq(AutomationRunReceiptTable.run_id, row.id))
    .orderBy(asc(AutomationRunReceiptTable.time_created), asc(AutomationRunReceiptTable.id)).all().at(-1)
  const lease = currentControlLeaseInTransaction(db, "automation", definition.definitionID)
  const targetScope = definition.scope ?? (definition.sessionID ? "session" : "project")
  const projectID = row.target_project_id ?? definition.projectID
  const sessionID = definition.sessionID ?? (definition.kind === "recurring" && targetScope !== "session" ? deterministicRunSessionID(row.id) : null)
  if (definition.sessionID) {
    const reservation = assertSchedulerMissionReservationInTransaction(db, definition.sessionID, row)
    if (
      reservation.kind === "mission_closed" &&
      (receipt?.outcome !== "disposition" ||
        receipt.disposition !== "mission_closed" ||
        receipt.closure_event_id !== reservation.closureEventID)
    ) {
      throw new Error(`Automation run ${row.id} terminal Mission reservation has no exact atomic receipt`)
    }
  }
  return { ...row, automation_id: definition.definitionID, target_scope: targetScope, project_id: projectID, session_id: sessionID, owner: lease?.owner_occurrence_id ?? null, outcome: receipt?.outcome ?? "running", disposition: receipt?.disposition ?? null, closure_event_id: receipt?.closure_event_id ?? null, completed_at: receipt?.time_created ?? null, error: receipt?.error ?? null, retry_at: receipt?.retry_at ?? null }
}

export type AutomationRow = typeof AutomationTable.$inferSelect & {
  revision_id: string
  last_run: number | null
  failure_count: number
  last_error: string | null
  lease_until: number
  lease_owner: string | null
  next_run: number
}

export function projectAutomationInTransaction(db: Database.TxOrDb, row: typeof AutomationTable.$inferSelect): AutomationRow {
  const revisionIDs = db.select({ id: AutomationTable.id }).from(AutomationTable)
    .where(eq(AutomationTable.definition_id, row.definition_id)).all().map((entry) => entry.id)
  const runs = revisionIDs.length === 0 ? [] : db.select().from(AutomationRunTable).where(inArray(AutomationRunTable.automation_revision_id, revisionIDs))
    .orderBy(asc(AutomationRunTable.started_at), asc(AutomationRunTable.id)).all()
    .map((run) => projectAutomationRunInTransaction(db, run))
  const latest = runs.at(-1)
  let failureCount = 0
  for (const run of runs.toReversed()) {
    if (run.outcome === "succeeded" || run.outcome === "disposition") break
    if (run.outcome === "failed" || run.outcome === "retry_wait") failureCount += 1
  }
  const lease = currentControlLeaseInTransaction(db, "automation", row.definition_id)
  const nextRun = row.kind === "delay"
    ? (latest?.retry_at ?? row.due_at ?? row.time_created)
    : latest?.retry_at ?? Recurrence.nextRun(row.recurrence!, latest?.completed_at ?? row.time_created)
  return {
    ...row,
    id: row.definition_id,
    revision_id: row.id,
    last_run: latest?.started_at ?? null,
    failure_count: failureCount,
    last_error: latest?.error ?? null,
    lease_until: lease?.expires_at ?? 0,
    lease_owner: lease?.owner_occurrence_id ?? null,
    next_run: nextRun,
  }
}

export function projectAutomations(rows: Array<typeof AutomationTable.$inferSelect>): AutomationRow[] {
  return Database.use((db) => rows.map((row) => projectAutomationInTransaction(db, row)))
}
