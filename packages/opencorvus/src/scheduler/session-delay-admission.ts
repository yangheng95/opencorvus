import { Identifier } from "@/id/id"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { Database, and, eq, inArray, sql } from "@/storage/db"
import { currentControlLeasesInTransaction } from "@/engine/control-lease"
import {
  AutomationDefinitionTombstoneTable,
  AutomationDelaySettlementTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
  AutomationTable,
} from "./automation.sql"
import { SessionWakeReason } from "@/session/wake-reason"
import { currentSessionDelayDefinitionsInTransaction } from "./automation-projection"
import { clearAutomationFireFrontierInTransaction } from "./automation-fire-frontier"

function acceptedInputsInTransaction(db: Database.TxOrDb, sessionID: string, messageIDs: readonly string[]) {
  if (messageIDs.length === 0) return []
  const rows = db
    .select({ id: MessageTable.id, data: MessageTable.data, sessionID: MessageTable.session_id })
    .from(MessageTable)
    .where(inArray(MessageTable.id, [...messageIDs]))
    .all()
  const byID = new Map(rows.map((row) => [row.id, row]))
  return messageIDs.map((messageID) => {
    const row = byID.get(messageID)
    if (!row || row.sessionID !== sessionID) {
      throw new Error(`Session delay acceptance references missing input Message ${messageID}`)
    }
    const info = Message.Info.parse({ ...row.data, id: messageID, sessionID: row.sessionID })
    if (info.role !== "user") throw new Error(`Session delay acceptance input ${messageID} is not a user Message`)
    const wake = SessionWakeReason.safeParse(info.extra?.wake_reason)
    return { info, wake: wake.success ? wake.data : undefined }
  })
}

/** Resolve ordinary Session input versus one-shot delay ownership in the same
 * transaction that accepts those input Messages for an assistant Turn. */
export function settleSessionDelaysAtAssistantAcceptanceInTransaction(
  db: Database.TxOrDb,
  input: {
    sessionID: string
    assistantMessageID: string
    acceptedInputMessageIDs: readonly string[]
    now: number
  },
): string[] {
  const accepted = acceptedInputsInTransaction(db, input.sessionID, input.acceptedInputMessageIDs)
  const ordinary = accepted.filter((entry) => !entry.wake?.source.startsWith("scheduler."))
  const consumed: string[] = []
  const delays = currentSessionDelayDefinitionsInTransaction(db, input.sessionID)
  const definitionIDs = delays.map((delay) => delay.definition_id)
  const revisionIDs = delays.map((delay) => delay.id)
  const leases = currentControlLeasesInTransaction(db, "automation", definitionIDs)
  const runs = revisionIDs.length
    ? db.select().from(AutomationRunTable).where(inArray(AutomationRunTable.automation_revision_id, revisionIDs)).all()
    : []
  const runIDs = runs.map((run) => run.id)
  const receipts = runIDs.length
    ? db.select().from(AutomationRunReceiptTable).where(inArray(AutomationRunReceiptTable.run_id, runIDs)).all()
    : []
  const terminalRunIDs = new Set(
    receipts.filter((receipt) => receipt.outcome !== "retry_wait").map((receipt) => receipt.run_id),
  )
  const runsByRevision = Map.groupBy(runs, (run) => run.automation_revision_id)
  const pendingWakeRows = definitionIDs.length
    ? db
        .select({ id: MessageTable.id, data: MessageTable.data, sessionID: MessageTable.session_id })
        .from(MessageTable)
        .where(
          and(
            eq(MessageTable.session_id, input.sessionID),
            sql`json_extract(${MessageTable.data}, '$.role')='user'`,
            sql`json_extract(${MessageTable.data}, '$.pendingDelivery')=1`,
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source')='scheduler.automation'`,
            inArray(
              sql<string>`json_extract(${MessageTable.data}, '$.extra.wake_reason.jobID')`,
              definitionIDs,
            ),
          ),
        )
        .all()
    : []
  const pendingWakes = pendingWakeRows.flatMap((row) => {
    const info = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.sessionID })
    if (info.role !== "user") return []
    const wake = SessionWakeReason.safeParse(info.extra?.wake_reason)
    return wake.success ? [wake.data] : []
  })
  for (const delay of delays) {
    const lease = leases.get(delay.definition_id)
    const delayRuns = runsByRevision.get(delay.id) ?? []
    const acceptedDue = accepted.find((entry) => {
      const wake = entry.wake
      return (
        wake?.source === "scheduler.automation" &&
        wake.jobID === delay.definition_id &&
        delayRuns.some((run) => run.fire_id === wake.fireID)
      )
    })
    if (acceptedDue) {
      if (!lease || lease.expires_at <= input.now) {
        throw new Error(
          `Session delay ${delay.definition_id} due wake lost its Automation owner before assistant ${input.assistantMessageID} acceptance`,
        )
      }
      const wake = acceptedDue.wake
      if (!wake || wake.source !== "scheduler.automation") {
        throw new Error(`Session delay ${delay.definition_id} accepted wake lost its exact provenance`)
      }
      db.insert(AutomationDelaySettlementTable)
        .values({
          definition_id: delay.definition_id,
          disposition: "due_accepted",
          assistant_message_id: input.assistantMessageID,
          accepted_input_message_ids: [...input.acceptedInputMessageIDs],
          fire_id: wake.fireID,
          time_created: input.now,
        })
        .onConflictDoNothing()
        .run()
      const settlement = db
        .select()
        .from(AutomationDelaySettlementTable)
        .where(eq(AutomationDelaySettlementTable.definition_id, delay.definition_id))
        .get()
      if (
        !settlement ||
        settlement.disposition !== "due_accepted" ||
        settlement.assistant_message_id !== input.assistantMessageID ||
        settlement.fire_id !== wake.fireID ||
        JSON.stringify(settlement.accepted_input_message_ids) !== JSON.stringify(input.acceptedInputMessageIDs)
      ) {
        throw new Error(`Session delay ${delay.definition_id} already has a conflicting assistant admission`)
      }
      continue
    }
    if (ordinary.length === 0) continue
    if (lease && lease.expires_at > input.now) {
      throw new Error(
        `Session delay ${delay.definition_id} owns a live due occurrence; assistant ${input.assistantMessageID} must retry`,
      )
    }
    const unsettled = delayRuns.filter((run) => !terminalRunIDs.has(run.id))
    const fireIDs = [...new Set(unsettled.map((run) => run.fire_id))]
    if (fireIDs.length > 1) {
      throw new Error(`Session delay ${delay.definition_id} owns multiple unsettled due occurrences`)
    }
    const unacceptedWake = pendingWakes.some(
      (wake) =>
        wake.source === "scheduler.automation" &&
        wake.jobID === delay.definition_id &&
        fireIDs.includes(wake.fireID),
    )
    if (unacceptedWake) {
      throw new Error(
        `Session delay ${delay.definition_id} has a persisted due wake outside assistant ${input.assistantMessageID} accepted input batch`,
      )
    }
    db.insert(AutomationDefinitionTombstoneTable)
      .values({
        id: Identifier.deterministic(
          "automation",
          `session-delay-input-consumption-v1\0${delay.definition_id}\0${input.assistantMessageID}`,
        ),
        definition_id: delay.definition_id,
        revision: delay.revision + 1,
        time_created: input.now,
      })
      .run()
    clearAutomationFireFrontierInTransaction(db, delay.definition_id)
    for (const run of unsettled) {
      db.insert(AutomationRunReceiptTable)
        .values({
          id: Identifier.ascending("automation"),
          run_id: run.id,
          outcome: "disposition",
          disposition: "superseded",
          time_created: input.now,
        })
        .run()
    }
    db.insert(AutomationDelaySettlementTable)
      .values({
        definition_id: delay.definition_id,
        disposition: "input_accepted",
        assistant_message_id: input.assistantMessageID,
        accepted_input_message_ids: [...input.acceptedInputMessageIDs],
        fire_id: fireIDs[0] ?? null,
        time_created: input.now,
      })
      .run()
    consumed.push(delay.definition_id)
  }
  return consumed
}
