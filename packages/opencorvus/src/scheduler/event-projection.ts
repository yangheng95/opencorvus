import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import { Database, and, asc, eq, inArray } from "@/storage/db"
import { EventJobFireReceiptTable, EventJobFireTable, EventJobTable, EventOccurrenceTable } from "./event.sql"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"

export type EventJobFireRow = typeof EventJobFireTable.$inferSelect & {
  event_job_id: string
  project_id: string
  event_type: string
  causation_ancestry: Array<{ fireID: string; jobID: string }>
  target_session_id: string
  creates_session: boolean
  status: "pending" | "running" | "retry_wait" | "succeeded" | "disposition"
  disposition: "causal_cycle" | "cooldown" | "job_disabled" | null
  message_id: string | null
  owner_id: string | null
  owner_process_id: number | null
  lease_until: number
  attempt: number
  error: string | null
  time_started: number | null
  time_completed: number | null
  time_updated: number
  retry_at: number | null
}

export function projectEventFireInTransaction(db: Database.TxOrDb, row: typeof EventJobFireTable.$inferSelect, now = Date.now()): EventJobFireRow {
  const definition = db.select({ definitionID: EventJobTable.definition_id, sessionID: EventJobTable.session_id }).from(EventJobTable)
    .where(eq(EventJobTable.id, row.event_job_revision_id)).get()
  const occurrence = db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, row.event_occurrence_id)).get()
  const bus = occurrence?.bus_outbox_id ? db.select({ projectID: BusPublicationOutboxTable.project_id, eventType: BusPublicationOutboxTable.event_type })
    .from(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.occurrence_id, occurrence.bus_outbox_id)).get() : undefined
  const projectID = bus?.projectID ?? occurrence?.project_id
  const eventType = bus?.eventType ?? occurrence?.event_type
  if (!definition || !occurrence || !projectID || !eventType) throw new Error(`Event fire ${row.id} has incomplete immutable definition/occurrence authority`)
  const targetSessionID = definition.sessionID ?? row.created_session_id
  if (!targetSessionID) throw new Error(`Event fire ${row.id} has no exact target Session authority`)
  const ancestry: Array<{ fireID: string; jobID: string }> = []
  const seen = new Set<string>([row.id])
  let parentID = row.causation_fire_id
  while (parentID) {
    if (seen.has(parentID)) throw new Error(`Event fire ${row.id} contains a causation cycle`)
    seen.add(parentID)
    const parent = db.select({ id: EventJobFireTable.id, revisionID: EventJobFireTable.event_job_revision_id, parentID: EventJobFireTable.causation_fire_id })
      .from(EventJobFireTable).where(eq(EventJobFireTable.id, parentID)).get()
    if (!parent) throw new Error(`Event fire ${row.id} references missing parent fire ${parentID}`)
    const parentDefinition = db.select({ definitionID: EventJobTable.definition_id }).from(EventJobTable)
      .where(eq(EventJobTable.id, parent.revisionID)).get()
    if (!parentDefinition) throw new Error(`Event fire ${parent.id} references missing definition ${parent.revisionID}`)
    ancestry.unshift({ fireID: parent.id, jobID: parentDefinition.definitionID })
    parentID = parent.parentID
  }
  const receipts = db.select().from(EventJobFireReceiptTable).where(eq(EventJobFireReceiptTable.fire_id, row.id))
    .orderBy(asc(EventJobFireReceiptTable.time_created), asc(EventJobFireReceiptTable.id)).all()
  const latest = receipts.at(-1)
  const leases = db.select().from(EngineControlActivationLeaseTable)
    .where(and(eq(EngineControlActivationLeaseTable.target, "event_fire"), eq(EngineControlActivationLeaseTable.target_id, row.id)))
    .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id)).all()
  const lease = currentControlLeaseInTransaction(db, "event_fire", row.id)
  const disposition = latest?.disposition ?? null
  const leaseConsumed = Boolean(
    lease && latest?.outcome === "retry_wait" && latest.time_created >= lease.time_activated,
  )
  const effectiveLease = leaseConsumed ? undefined : lease
  const status = disposition ? "disposition" : latest?.outcome === "succeeded" ? "succeeded" : latest?.outcome === "retry_wait" && (latest.retry_at ?? 0) > now ? "retry_wait" : effectiveLease && effectiveLease.expires_at > now ? "running" : "pending"
  return {
    ...row,
    event_job_id: definition.definitionID,
    project_id: projectID,
    event_type: eventType,
    causation_ancestry: ancestry,
    target_session_id: targetSessionID,
    creates_session: definition.sessionID === null,
    disposition,
    status,
    message_id: [...receipts].reverse().find((receipt) => receipt.message_id)?.message_id ?? null,
    owner_id: effectiveLease?.owner_occurrence_id ?? null,
    owner_process_id: null,
    lease_until: effectiveLease?.expires_at ?? 0,
    attempt: leases.length,
    error: latest?.error ?? null,
    time_started: leases[0]?.time_activated ?? null,
    time_completed: latest?.outcome === "succeeded" ? latest.time_created : null,
    time_updated: latest?.time_created ?? lease?.time_activated ?? row.time_created,
    retry_at: latest?.retry_at ?? null,
  }
}

export type EventJobRow = typeof EventJobTable.$inferSelect & {
  revision_id: string
  last_run: number | null
  last_event: string | null
  failure_count: number
  last_error: string | null
}

export function projectEventJobInTransaction(db: Database.TxOrDb, row: typeof EventJobTable.$inferSelect): EventJobRow {
  const revisions = db.select({ id: EventJobTable.id }).from(EventJobTable).where(eq(EventJobTable.definition_id, row.definition_id)).all().map((entry) => entry.id)
  const fires = revisions.length === 0 ? [] : db.select().from(EventJobFireTable).where(inArray(EventJobFireTable.event_job_revision_id, revisions))
    .orderBy(asc(EventJobFireTable.time_created), asc(EventJobFireTable.id)).all()
    .map((fire) => projectEventFireInTransaction(db, fire))
  const latest = fires.at(-1)
  let failures = 0
  for (const fire of fires.toReversed()) {
    if (fire.status === "succeeded") break
    if (fire.status === "retry_wait") failures += 1
  }
  const oneShotCompleted = row.one_shot && fires.some((fire) => fire.status === "succeeded")
  return {
    ...row,
    id: row.definition_id,
    revision_id: row.id,
    enabled: row.enabled && !oneShotCompleted,
    last_run: latest?.time_started ?? null,
    last_event: latest?.event_occurrence_id ?? null,
    failure_count: failures,
    last_error: latest?.error ?? null,
  }
}
