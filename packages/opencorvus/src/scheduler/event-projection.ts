import { currentControlLeaseInTransaction, currentControlLeasesInTransaction } from "@/engine/control-lease"
import { EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import { Database, and, asc, desc, eq, gt, inArray, sql } from "@/storage/db"
import {
  EventJobDefinitionTombstoneTable,
  EventJobFireReceiptTable,
  EventJobFireTable,
  EventJobTable,
  EventOccurrenceTable,
} from "./event.sql"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { assertSchedulerMissionReservationInTransaction } from "./mission-reservation"

export type EventJobFireRow = typeof EventJobFireTable.$inferSelect & {
  event_job_id: string
  project_id: string
  event_type: string
  causation_ancestry: Array<{ fireID: string; jobID: string }>
  target_session_id: string
  creates_session: boolean
  status: "pending" | "running" | "retry_wait" | "succeeded" | "disposition"
  disposition: "causal_cycle" | "cooldown" | "job_disabled" | "mission_closed" | "target_deleted" | null
  closure_event_id: string | null
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

export const EVENT_FRONTIER_PAGE_SIZE = 64

export type EventFrontierQueryStage = "definitions" | "one_shot" | "head_definitions" | "heads" | "retries" | "leases"
export type EventFrontierQueryObserver = (stage: EventFrontierQueryStage) => void

export type EventFireHead = {
  fire: typeof EventJobFireTable.$inferSelect
  definitionID: string
  projectID: string
  status: "pending" | "running" | "retry_wait"
  retryAt: number | null
  leaseUntil: number
  ownerID: string | null
}

export function currentEventDefinitionPageInTransaction(
  db: Database.TxOrDb,
  input: {
    projectID: string
    afterDefinitionID?: string
    observe?: EventFrontierQueryObserver
  },
): { rows: Array<typeof EventJobTable.$inferSelect>; hasMore: boolean } {
  input.observe?.("definitions")
  const rows = db
    .select()
    .from(EventJobTable)
    .where(
      and(
        eq(EventJobTable.project_id, input.projectID),
        input.afterDefinitionID ? gt(EventJobTable.definition_id, input.afterDefinitionID) : undefined,
        sql`NOT EXISTS (
          SELECT 1 FROM event_job AS candidate
          WHERE candidate.definition_id=${EventJobTable.definition_id}
            AND (
              candidate.revision>${EventJobTable.revision}
              OR (candidate.revision=${EventJobTable.revision} AND candidate.id>${EventJobTable.id})
            )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM event_job_definition_tombstone AS tombstone
          WHERE tombstone.definition_id=${EventJobTable.definition_id}
            AND tombstone.revision>=${EventJobTable.revision}
        )`,
      ),
    )
    .orderBy(EventJobTable.definition_id)
    .limit(EVENT_FRONTIER_PAGE_SIZE + 1)
    .all()
  return { rows: rows.slice(0, EVENT_FRONTIER_PAGE_SIZE), hasMore: rows.length > EVENT_FRONTIER_PAGE_SIZE }
}

export function completedOneShotEventDefinitionIDsInTransaction(
  db: Database.TxOrDb,
  definitions: readonly (typeof EventJobTable.$inferSelect)[],
  observe?: EventFrontierQueryObserver,
): Set<string> {
  if (definitions.length > EVENT_FRONTIER_PAGE_SIZE) {
    throw new Error(`Event definition child set exceeds ${EVENT_FRONTIER_PAGE_SIZE}`)
  }
  const definitionIDs = definitions.filter((row) => row.one_shot).map((row) => row.definition_id)
  if (definitionIDs.length === 0) return new Set()
  observe?.("one_shot")
  return new Set(
    db
      .selectDistinct({ definitionID: EventJobFireReceiptTable.definition_id })
      .from(EventJobFireReceiptTable)
      .where(
        and(
          inArray(EventJobFireReceiptTable.definition_id, definitionIDs),
          eq(EventJobFireReceiptTable.outcome, "succeeded"),
        ),
      )
      .all()
      .map((row) => row.definitionID),
  )
}

function requestedValues(values: readonly string[], label: string) {
  if (values.length === 0 || values.length > EVENT_FRONTIER_PAGE_SIZE) {
    throw new Error(`${label} set must contain between 1 and ${EVENT_FRONTIER_PAGE_SIZE} IDs`)
  }
  return sql.join(values.map((value) => sql`(${value})`), sql`, `)
}

type EventQueuePosition = { definition_id: string; queue_position: number }

/** Allocate one definition-local position per selected definition with a fixed
 * statement count. Every correlated selector is an indexed descending
 * `LIMIT 1` seek; retained Fire history is never materialized. */
export function nextEventFireQueuePositionsInTransaction(
  db: Database.TxOrDb,
  definitionIDs: readonly string[],
): Map<string, number> {
  const requested = requestedValues(definitionIDs, "Event definition position")
  const rows = db.all<EventQueuePosition>(sql`
    WITH requested(definition_id) AS (VALUES ${requested})
    SELECT
      requested.definition_id,
      COALESCE((
        SELECT fire.queue_position
        FROM event_job_fire AS fire
        WHERE fire.definition_id=requested.definition_id
        ORDER BY fire.queue_position DESC
        LIMIT 1
      ), 0) + 1 AS queue_position
    FROM requested
  `)
  return new Map(rows.map((row) => [row.definition_id, row.queue_position]))
}

/** This exact statement is shared by production and query-plan acceptance.
 * The terminal frontier and its successor are both indexed point seeks. */
export function currentEventFireHeadRowsSQL(definitionIDs: readonly string[]) {
  const requested = requestedValues(definitionIDs, "Event Fire head")
  return sql`
    WITH requested(definition_id) AS (VALUES ${requested})
    SELECT fire.*
    FROM requested
    JOIN event_job_fire AS fire
      ON fire.definition_id=requested.definition_id
      AND fire.queue_position=(
        COALESCE((
          SELECT terminal.queue_position
          FROM event_job_fire_receipt AS terminal
          WHERE terminal.definition_id=requested.definition_id
            AND terminal.outcome<>'retry_wait'
          ORDER BY terminal.queue_position DESC
          LIMIT 1
        ), 0) + 1
      )
  `
}

function currentEventRetryRowsInTransaction(
  db: Database.TxOrDb,
  fireIDs: readonly string[],
  observe?: EventFrontierQueryObserver,
) {
  if (fireIDs.length === 0) return []
  observe?.("retries")
  const requested = requestedValues(fireIDs, "Event Fire retry")
  return db.all<typeof EventJobFireReceiptTable.$inferSelect>(sql`
    WITH requested(fire_id) AS (VALUES ${requested})
    SELECT receipt.*
    FROM requested
    JOIN event_job_fire_receipt AS receipt ON receipt.id=(
      SELECT latest.id
      FROM event_job_fire_receipt AS latest
      WHERE latest.fire_id=requested.fire_id
        AND latest.outcome='retry_wait'
      ORDER BY latest.time_created DESC, latest.id DESC
      LIMIT 1
    )
  `)
}

function projectEventFireHeadsInTransaction(
  db: Database.TxOrDb,
  input: {
    definitions: readonly string[]
    projectID: string
    now: number
    observe?: EventFrontierQueryObserver
  },
): EventFireHead[] {
  if (input.definitions.length === 0) return []
  input.observe?.("heads")
  const order = new Map(input.definitions.map((definitionID, index) => [definitionID, index]))
  const page = db
    .all<typeof EventJobFireTable.$inferSelect>(currentEventFireHeadRowsSQL(input.definitions))
    .sort((left, right) => order.get(left.definition_id)! - order.get(right.definition_id)!)
  const fireIDs = page.map((fire) => fire.id)
  if (fireIDs.length === 0) return []

  const retryByFire = new Map(
    currentEventRetryRowsInTransaction(db, fireIDs, input.observe).map((row) => [row.fire_id, row] as const),
  )
  input.observe?.("leases")
  const leases = currentControlLeasesInTransaction(db, "event_fire", fireIDs)
  return page.map((fire) => {
      const retry = retryByFire.get(fire.id)
      const lease = leases.get(fire.id)
      const status =
        (retry?.retry_at ?? 0) > input.now
          ? "retry_wait"
          : lease && lease.expires_at > input.now
            ? "running"
            : "pending"
      return {
        fire,
        definitionID: fire.definition_id,
        projectID: input.projectID,
        status,
        retryAt: retry?.retry_at ?? null,
        leaseUntil: lease?.expires_at ?? 0,
        ownerID: lease?.owner_occurrence_id ?? null,
      }
    })
}

export function currentEventFireHeadPageInTransaction(
  db: Database.TxOrDb,
  input: { projectID: string; now: number; afterDefinitionID?: string; observe?: EventFrontierQueryObserver },
): { rows: EventFireHead[]; hasMore: boolean; nextDefinitionID?: string } {
  input.observe?.("head_definitions")
  const identities = db
    .select({ definitionID: EventJobTable.definition_id })
    .from(EventJobTable)
    .where(
      and(
        eq(EventJobTable.project_id, input.projectID),
        eq(EventJobTable.revision, 1),
        input.afterDefinitionID ? gt(EventJobTable.definition_id, input.afterDefinitionID) : undefined,
      ),
    )
    .orderBy(EventJobTable.definition_id)
    .limit(EVENT_FRONTIER_PAGE_SIZE + 1)
    .all()
  const selected = identities.slice(0, EVENT_FRONTIER_PAGE_SIZE).map((row) => row.definitionID)
  return {
    rows: projectEventFireHeadsInTransaction(db, {
      definitions: selected,
      projectID: input.projectID,
      now: input.now,
      observe: input.observe,
    }),
    hasMore: identities.length > EVENT_FRONTIER_PAGE_SIZE,
    nextDefinitionID: selected.at(-1),
  }
}

export function currentEventFireHeadForDefinitionInTransaction(
  db: Database.TxOrDb,
  input: { projectID: string; now: number; definitionID: string; observe?: EventFrontierQueryObserver },
): EventFireHead | undefined {
  input.observe?.("head_definitions")
  const identity = db
    .select({ definitionID: EventJobTable.definition_id })
    .from(EventJobTable)
    .where(
      and(
        eq(EventJobTable.project_id, input.projectID),
        eq(EventJobTable.definition_id, input.definitionID),
        eq(EventJobTable.revision, 1),
      ),
    )
    .get()
  if (!identity) return undefined
  return projectEventFireHeadsInTransaction(db, {
    definitions: [identity.definitionID],
    projectID: input.projectID,
    now: input.now,
    observe: input.observe,
  })[0]
}

export function currentEventFireHeadForOccurrenceInTransaction(
  db: Database.TxOrDb,
  input: { projectID: string; now: number; fireID: string; observe?: EventFrontierQueryObserver },
): EventFireHead | undefined {
  input.observe?.("head_definitions")
  const occurrence = db
    .select({ fire: EventJobFireTable, projectID: EventJobTable.project_id })
    .from(EventJobFireTable)
    .innerJoin(
      EventJobTable,
      and(
        eq(EventJobTable.definition_id, EventJobFireTable.definition_id),
        eq(EventJobTable.revision, 1),
      ),
    )
    .where(eq(EventJobFireTable.id, input.fireID))
    .get()
  if (!occurrence || occurrence.projectID !== input.projectID) return undefined
  const head = projectEventFireHeadsInTransaction(db, {
    definitions: [occurrence.fire.definition_id],
    projectID: input.projectID,
    now: input.now,
    observe: input.observe,
  })[0]
  return head?.fire.id === input.fireID ? head : undefined
}

export function unresolvedEventProjectPageInTransaction(
  db: Database.TxOrDb,
  input: { afterProjectID?: string },
): { projectIDs: string[]; hasMore: boolean } {
  const rows = db
    .selectDistinct({ projectID: EventJobTable.project_id })
    .from(EventJobTable)
    .where(
      and(
        input.afterProjectID ? gt(EventJobTable.project_id, input.afterProjectID) : undefined,
        eq(EventJobTable.revision, 1),
        sql`EXISTS (
          SELECT 1
          FROM event_job_fire AS fire
          WHERE fire.definition_id=${EventJobTable.definition_id}
            AND fire.queue_position=(
              COALESCE((
                SELECT terminal.queue_position
                FROM event_job_fire_receipt AS terminal
                WHERE terminal.definition_id=${EventJobTable.definition_id}
                  AND terminal.outcome<>'retry_wait'
                ORDER BY terminal.queue_position DESC
                LIMIT 1
              ), 0) + 1
            )
        )`,
      ),
    )
    .orderBy(EventJobTable.project_id)
    .limit(EVENT_FRONTIER_PAGE_SIZE + 1)
    .all()
  return {
    projectIDs: rows.slice(0, EVENT_FRONTIER_PAGE_SIZE).map((row) => row.projectID),
    hasMore: rows.length > EVENT_FRONTIER_PAGE_SIZE,
  }
}

function currentEventFireReceiptInTransaction(db: Database.TxOrDb, fireID: string) {
  const terminal = db
    .select()
    .from(EventJobFireReceiptTable)
    .where(
      and(
        eq(EventJobFireReceiptTable.fire_id, fireID),
        sql`${EventJobFireReceiptTable.outcome}<>'retry_wait'`,
      ),
    )
    .get()
  if (terminal) return terminal
  return db
    .select()
    .from(EventJobFireReceiptTable)
    .where(
      and(
        eq(EventJobFireReceiptTable.fire_id, fireID),
        eq(EventJobFireReceiptTable.outcome, "retry_wait"),
      ),
    )
    .orderBy(desc(EventJobFireReceiptTable.time_created), desc(EventJobFireReceiptTable.id))
    .get()
}

/**
 * `now` is required. It decides `retry_wait` versus `running` versus
 * `pending`, and it used to default to `Date.now()` per call — so projecting a
 * job's fires re-read the clock once per fire and two fires in one projection
 * could land on opposite sides of a lease expiry.
 */
export function projectEventFireInTransaction(db: Database.TxOrDb, row: typeof EventJobFireTable.$inferSelect, now: number): EventJobFireRow {
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
  const latest = currentEventFireReceiptInTransaction(db, row.id)
  const reservation = assertSchedulerMissionReservationInTransaction(db, targetSessionID, row)
  if (
    reservation.kind === "mission_closed" &&
    latest &&
    (latest?.outcome !== "disposition" ||
      latest.disposition !== "mission_closed" ||
      latest.closure_event_id !== reservation.closureEventID)
  ) {
    throw new Error(`Event fire ${row.id} terminal Mission reservation has no exact atomic receipt`)
  }
  const leaseAggregate = db
    .select({
      attempt: sql<number>`count(*)`,
      timeStarted: sql<number | null>`min(${EngineControlActivationLeaseTable.time_activated})`,
    })
    .from(EngineControlActivationLeaseTable)
    .where(
      and(
        eq(EngineControlActivationLeaseTable.target, "event_fire"),
        eq(EngineControlActivationLeaseTable.target_id, row.id),
      ),
    )
    .get()
  const lease = currentControlLeaseInTransaction(db, "event_fire", row.id)
  const disposition = latest?.disposition ?? null
  const status = disposition ? "disposition" : latest?.outcome === "succeeded" ? "succeeded" : latest?.outcome === "retry_wait" && (latest.retry_at ?? 0) > now ? "retry_wait" : lease && lease.expires_at > now ? "running" : "pending"
  return {
    ...row,
    event_job_id: definition.definitionID,
    project_id: projectID,
    event_type: eventType,
    causation_ancestry: ancestry,
    target_session_id: targetSessionID,
    creates_session: definition.sessionID === null,
    disposition,
    closure_event_id: latest?.closure_event_id ?? null,
    status,
    message_id: latest?.message_id ?? null,
    owner_id: lease?.owner_occurrence_id ?? null,
    owner_process_id: null,
    lease_until: lease?.expires_at ?? 0,
    attempt: leaseAggregate?.attempt ?? 0,
    error: latest?.error ?? null,
    time_started: leaseAggregate?.timeStarted ?? null,
    time_completed:
      latest?.outcome === "succeeded" || latest?.outcome === "disposition" ? latest.time_created : null,
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

export function projectEventJobInTransaction(db: Database.TxOrDb, row: typeof EventJobTable.$inferSelect, now: number): EventJobRow {
  const revisions = db.select({ id: EventJobTable.id }).from(EventJobTable).where(eq(EventJobTable.definition_id, row.definition_id)).all().map((entry) => entry.id)
  const fires = revisions.length === 0 ? [] : db.select().from(EventJobFireTable).where(inArray(EventJobFireTable.event_job_revision_id, revisions))
    .orderBy(asc(EventJobFireTable.queue_position)).all()
    .map((fire) => projectEventFireInTransaction(db, fire, now))
  const latest = fires.at(-1)
  let failures = 0
  for (const fire of fires.toReversed()) {
    if (fire.status === "succeeded" || fire.status === "disposition") break
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

/**
 * Scheduling projection for one already-selected FIFO head. Unlike the public
 * history view above, this reads only the exact definition revision and the
 * immediately preceding Fire. The current claim must not count as its own
 * cooldown predecessor.
 */
export function projectEventJobForFireInTransaction(
  db: Database.TxOrDb,
  row: typeof EventJobTable.$inferSelect,
  fire: typeof EventJobFireTable.$inferSelect,
): EventJobRow {
  if (fire.event_job_revision_id !== row.id) {
    throw new Error(`Event fire ${fire.id} does not belong to definition revision ${row.id}`)
  }
  const previous = db
    .select({ fire: EventJobFireTable })
    .from(EventJobFireTable)
    .where(
      and(
        eq(EventJobFireTable.definition_id, fire.definition_id),
        eq(EventJobFireTable.queue_position, fire.queue_position - 1),
      ),
    )
    .get()?.fire
  const previousLease = previous
    ? db
        .select({ timeStarted: sql<number | null>`min(${EngineControlActivationLeaseTable.time_activated})` })
        .from(EngineControlActivationLeaseTable)
        .where(
          and(
            eq(EngineControlActivationLeaseTable.target, "event_fire"),
            eq(EngineControlActivationLeaseTable.target_id, previous.id),
          ),
        )
        .get()
    : undefined
  const previousReceipt = previous ? currentEventFireReceiptInTransaction(db, previous.id) : undefined
  const olderSuccess = row.one_shot
    ? db
        .select({ id: EventJobFireReceiptTable.id })
        .from(EventJobFireReceiptTable)
        .where(
          and(
            eq(EventJobFireReceiptTable.definition_id, row.definition_id),
            eq(EventJobFireReceiptTable.outcome, "succeeded"),
            sql`${EventJobFireReceiptTable.queue_position}<${fire.queue_position}`,
          ),
        )
        .orderBy(desc(EventJobFireReceiptTable.queue_position))
        .get()
    : undefined
  return {
    ...row,
    id: row.definition_id,
    revision_id: row.id,
    enabled: row.enabled && !olderSuccess,
    last_run: previousLease?.timeStarted ?? null,
    last_event: previous?.event_occurrence_id ?? null,
    failure_count: previousReceipt?.outcome === "retry_wait" ? 1 : 0,
    last_error: previousReceipt?.error ?? null,
  }
}
