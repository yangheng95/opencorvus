import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { Database, and, asc, desc, eq, gt, inArray, sql } from "@/storage/db"
import {
  AutomationDefinitionTombstoneTable,
  AutomationFireAttemptReceiptTable,
  AutomationFireAttemptTable,
  AutomationFireTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
  AutomationTable,
} from "./automation.sql"
import { Recurrence } from "./recurrence"
import { createHash } from "node:crypto"
import { assertSchedulerMissionReservationInTransaction } from "./mission-reservation"

export function latestAutomationDefinitionInTransaction(db: Database.TxOrDb, definitionID: string) {
  const row = db
    .select()
    .from(AutomationTable)
    .where(eq(AutomationTable.definition_id, definitionID))
    .orderBy(desc(AutomationTable.revision), desc(AutomationTable.id))
    .get()
  const tombstone = db
    .select()
    .from(AutomationDefinitionTombstoneTable)
    .where(eq(AutomationDefinitionTombstoneTable.definition_id, definitionID))
    .orderBy(desc(AutomationDefinitionTombstoneTable.revision), desc(AutomationDefinitionTombstoneTable.id))
    .get()
  return row && (!tombstone || row.revision > tombstone.revision) ? row : undefined
}

export function currentAutomationDefinitionsInTransaction(db: Database.TxOrDb) {
  return db
    .select()
    .from(AutomationTable)
    .where(
      and(
        sql`NOT EXISTS (
          SELECT 1 FROM automation AS candidate
          WHERE candidate.definition_id=${AutomationTable.definition_id}
            AND (
              candidate.revision>${AutomationTable.revision}
              OR (candidate.revision=${AutomationTable.revision} AND candidate.id>${AutomationTable.id})
            )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM automation_definition_tombstone AS tombstone
          WHERE tombstone.definition_id=${AutomationTable.definition_id}
            AND tombstone.revision>=${AutomationTable.revision}
        )`,
      ),
    )
    .orderBy(AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id))
    .all()
}

/** The exact current one-shot delay frontier for one Session. This query is
 * safe inside assistant admission: its work is bounded by that Session's live
 * delay definitions rather than every Automation revision in the database. */
export function currentSessionDelayDefinitionsInTransaction(db: Database.TxOrDb, sessionID: string) {
  return db
    .select()
    .from(AutomationTable)
    .where(
      and(
        eq(AutomationTable.session_id, sessionID),
        eq(AutomationTable.kind, "delay"),
        eq(AutomationTable.status, "active"),
        sql`NOT EXISTS (
          SELECT 1 FROM automation AS candidate
          WHERE candidate.definition_id=${AutomationTable.definition_id}
            AND (
              candidate.revision>${AutomationTable.revision}
              OR (candidate.revision=${AutomationTable.revision} AND candidate.id>${AutomationTable.id})
            )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM automation_definition_tombstone AS tombstone
          WHERE tombstone.definition_id=${AutomationTable.definition_id}
            AND tombstone.revision>=${AutomationTable.revision}
        )`,
      ),
    )
    .orderBy(AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id))
    .all()
}

export function currentSessionDelayDefinitionsForSessionsInTransaction(
  db: Database.TxOrDb,
  sessionIDs: readonly string[],
) {
  const ids = [...new Set(sessionIDs)]
  if (ids.length === 0) return []
  return db
    .select()
    .from(AutomationTable)
    .where(
      and(
        inArray(AutomationTable.session_id, ids),
        eq(AutomationTable.kind, "delay"),
        eq(AutomationTable.status, "active"),
        sql`NOT EXISTS (
          SELECT 1 FROM automation AS candidate
          WHERE candidate.definition_id=${AutomationTable.definition_id}
            AND (
              candidate.revision>${AutomationTable.revision}
              OR (candidate.revision=${AutomationTable.revision} AND candidate.id>${AutomationTable.id})
            )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM automation_definition_tombstone AS tombstone
          WHERE tombstone.definition_id=${AutomationTable.definition_id}
            AND tombstone.revision>=${AutomationTable.revision}
        )`,
      ),
    )
    .orderBy(AutomationTable.session_id, AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id))
    .all()
}

export type AutomationRunRow = typeof AutomationRunTable.$inferSelect & {
  scheduled_due_at: number
  automation_id: string
  target_scope: "session" | "project" | "global"
  project_id: string | null
  session_id: string | null
  owner: string | null
  outcome: "running" | "retry_wait" | "succeeded" | "failed" | "disposition"
  disposition: "mission_closed" | "target_deleted" | "superseded" | null
  closure_event_id: string | null
  completed_at: number | null
  error: string | null
  retry_at: number | null
}

function deterministicRunSessionID(runID: string): string {
  return `ses_automation_${createHash("sha256").update(runID).digest("hex").slice(0, 32)}`
}

export function projectAutomationRunInTransaction(db: Database.TxOrDb, row: typeof AutomationRunTable.$inferSelect): AutomationRunRow {
  const fire = db.select().from(AutomationFireTable).where(eq(AutomationFireTable.id, row.fire_id)).get()
  if (!fire) throw new Error(`Automation run ${row.id} references missing logical fire ${row.fire_id}`)
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
  return { ...row, scheduled_due_at: fire.scheduled_due_at, automation_id: definition.definitionID, target_scope: targetScope, project_id: projectID, session_id: sessionID, owner: lease?.owner_occurrence_id ?? null, outcome: receipt?.outcome ?? "running", disposition: receipt?.disposition ?? null, closure_event_id: receipt?.closure_event_id ?? null, completed_at: receipt?.time_created ?? null, error: receipt?.error ?? null, retry_at: receipt?.retry_at ?? null }
}

export type AutomationFireProjection = {
  id: string
  automationRevisionID: string
  automationID: string
  origin: "scheduled" | "manual_api" | "manual_tool"
  scheduledDueAt: number
  startedAt: number
  completedAt: number | null
  state: "scheduled" | "running" | "retry_wait" | "succeeded" | "failed" | "partial" | "disposition"
  attemptCount: number
  attemptFailureCount: number
  retryAt: number | null
  error: string | null
  runs: AutomationRunRow[]
}

type AutomationFireRunState = {
  id: string
  startedAt: number
  outcome: AutomationRunRow["outcome"]
  completedAt: number | null
  error: string | null
  retryAt: number | null
}

type AutomationFireAttemptSummary = {
  count: number
  failureCount: number
  latest: {
  outcome: "reserved" | "retry_wait" | "failed" | null
  retryAt: number | null
  error: string | null
  completedAt: number | null
  } | null
}

type AutomationFireReducedState = Pick<
  AutomationFireProjection,
  "startedAt" | "completedAt" | "state" | "attemptCount" | "attemptFailureCount" | "retryAt" | "error"
>

/** One reducer for public history and the batched scheduler frontier. The
 * callers differ only in how they load facts; neither owns a second state
 * interpretation. */
function reduceAutomationFireState(input: {
  fire: typeof AutomationFireTable.$inferSelect
  runs: readonly AutomationFireRunState[]
  attempts: AutomationFireAttemptSummary
}): AutomationFireReducedState {
  const latestAttempt = input.attempts.latest
  const memberRetryAt = input.runs
    .flatMap((run) => (run.outcome === "retry_wait" && run.retryAt !== null ? [run.retryAt] : []))
    .sort((left, right) => left - right)[0]
  const retryAt = latestAttempt?.outcome === "retry_wait" ? latestAttempt.retryAt! : (memberRetryAt ?? null)
  const hasRunning = input.runs.some((run) => run.outcome === "running")
  const hasRetry = input.runs.some((run) => run.outcome === "retry_wait")
  const succeeded = input.runs.filter((run) => run.outcome === "succeeded").length
  const disposed = input.runs.filter((run) => run.outcome === "disposition").length
  const failed = input.runs.filter((run) => run.outcome === "failed").length
  const state: AutomationFireProjection["state"] =
    input.runs.length === 0
      ? input.attempts.count === 0
        ? "scheduled"
        : latestAttempt?.outcome === "failed"
        ? "failed"
        : latestAttempt?.outcome === "retry_wait"
          ? "retry_wait"
          : "running"
      : hasRunning
        ? "running"
        : hasRetry
          ? "retry_wait"
          : failed === input.runs.length
            ? "failed"
            : failed > 0
              ? "partial"
              : disposed === input.runs.length
                ? "disposition"
                : succeeded + disposed === input.runs.length
                  ? "succeeded"
                  : "running"
  const terminal = ["succeeded", "failed", "partial", "disposition"].includes(state)
  const completedAt = terminal
    ? input.runs.length > 0
      ? Math.max(...input.runs.map((run) => run.completedAt ?? 0))
      : (latestAttempt?.completedAt ?? null)
    : null
  const runErrors = input.runs.flatMap((run) => (run.error ? [run.error] : []))
  return {
    startedAt:
      input.runs.length > 0 ? Math.min(...input.runs.map((run) => run.startedAt)) : input.fire.time_created,
    completedAt,
    state,
    attemptCount: input.attempts.count,
    attemptFailureCount: input.attempts.failureCount,
    retryAt,
    error: latestAttempt?.error ?? (runErrors.length > 0 ? runErrors.join("; ") : null),
  }
}

function reduceAutomationFireFailureCount(input: {
  state: AutomationFireProjection["state"]
  attemptFailureCount: number
  memberFailureCounts: readonly number[]
}): number {
  if (input.state === "scheduled" || input.state === "succeeded" || input.state === "disposition") return 0
  return input.attemptFailureCount + Math.max(0, ...input.memberFailureCounts)
}

/** Canonical projection for one logical Fire occurrence. Public history,
 * current Automation projection and exact Tool replay all reduce from this
 * function so a Fire with zero target runs remains visible and terminal. */
export function projectAutomationFireInTransaction(
  db: Database.TxOrDb,
  fire: typeof AutomationFireTable.$inferSelect,
): AutomationFireProjection {
  const definition = db
    .select({ definitionID: AutomationTable.definition_id })
    .from(AutomationTable)
    .where(eq(AutomationTable.id, fire.automation_revision_id))
    .get()
  if (!definition) throw new Error(`Automation fire ${fire.id} references missing revision ${fire.automation_revision_id}`)
  const runs = db
    .select()
    .from(AutomationRunTable)
    .where(eq(AutomationRunTable.fire_id, fire.id))
    .orderBy(asc(AutomationRunTable.started_at), asc(AutomationRunTable.id))
    .all()
    .map((run) => projectAutomationRunInTransaction(db, run))
  const attempts = db
    .select()
    .from(AutomationFireAttemptTable)
    .where(eq(AutomationFireAttemptTable.fire_id, fire.id))
    .orderBy(asc(AutomationFireAttemptTable.ordinal), asc(AutomationFireAttemptTable.id))
    .all()
  const attemptReceipts = attempts.length === 0
    ? []
    : db
        .select()
        .from(AutomationFireAttemptReceiptTable)
        .where(inArray(AutomationFireAttemptReceiptTable.attempt_id, attempts.map((attempt) => attempt.id)))
        .all()
  const receiptByAttempt = new Map(attemptReceipts.map((receipt) => [receipt.attempt_id, receipt]))
  const reduced = reduceAutomationFireState({
    fire,
    runs: runs.map((run) => ({
      id: run.id,
      startedAt: run.started_at,
      outcome: run.outcome,
      completedAt: run.completed_at,
      error: run.error,
      retryAt: run.retry_at,
    })),
    attempts: {
      count: attempts.length,
      failureCount: attempts.filter((attempt) => {
        const receipt = receiptByAttempt.get(attempt.id)
        return receipt?.outcome === "retry_wait" || receipt?.outcome === "failed"
      }).length,
      latest: (() => {
        const latest = attempts.at(-1)
        if (!latest) return null
        const receipt = receiptByAttempt.get(latest.id)
        return {
          outcome: receipt?.outcome ?? null,
          retryAt: receipt?.retry_at ?? null,
          error: receipt?.error ?? null,
          completedAt: receipt?.time_created ?? null,
        }
      })(),
    },
  })
  return {
    id: fire.id,
    automationRevisionID: fire.automation_revision_id,
    automationID: definition.definitionID,
    origin: fire.origin,
    scheduledDueAt: fire.scheduled_due_at,
    ...reduced,
    runs,
  }
}

export type AutomationRow = typeof AutomationTable.$inferSelect & {
  revision_id: string
  last_run: number | null
  failure_count: number
  last_error: string | null
  lease_until: number
  lease_owner: string | null
  next_run: number | null
  pending_fire_id: string | null
  scheduled_due_at: number | null
  attempt_id: string | null
  attempt_ordinal: number
}

export function projectAutomationInTransaction(
  db: Database.TxOrDb,
  row: typeof AutomationTable.$inferSelect,
): AutomationRow {
  const revisionIDs = db
    .select({ id: AutomationTable.id })
    .from(AutomationTable)
    .where(eq(AutomationTable.definition_id, row.definition_id))
    .all()
    .map((entry) => entry.id)
  const fireRows =
    revisionIDs.length === 0
      ? []
      : db
          .select()
          .from(AutomationFireTable)
          .where(inArray(AutomationFireTable.automation_revision_id, revisionIDs))
          .orderBy(
            asc(AutomationFireTable.scheduled_due_at),
            asc(AutomationFireTable.time_created),
            asc(AutomationFireTable.id),
          )
          .all()
  const fires = fireRows
    .map((fire) => projectAutomationFireInTransaction(db, fire))
    .sort(
      (left, right) =>
        left.scheduledDueAt - right.scheduledDueAt ||
        left.startedAt - right.startedAt ||
        left.id.localeCompare(right.id),
    )
  const latestFire = fires.filter((fire) => fire.state !== "scheduled").at(-1)
  const currentScheduledFire = fires
    .filter((fire) => fire.origin === "scheduled" && fire.automationRevisionID === row.id && fire.state === "scheduled")
    .at(-1)
  const pendingFires = fires.filter((fire) => fire.state === "running" || fire.state === "retry_wait")
  if (pendingFires.length > 1) {
    throw new Error(`Automation ${row.definition_id} has multiple unsettled logical fires`)
  }
  const pendingFire = pendingFires[0]
  if (pendingFire && pendingFire.runs.some((member) => member.automation_revision_id !== row.id)) {
    throw new Error(
      `Automation ${row.definition_id} pending fire ${pendingFire.id} belongs to another definition revision`,
    )
  }
  const memberFailureCounts = latestFire
    ? latestFire.runs.map(
          (member) =>
            db
              .select({ id: AutomationRunReceiptTable.id })
              .from(AutomationRunReceiptTable)
              .where(
                and(
                  eq(AutomationRunReceiptTable.run_id, member.id),
                  eq(AutomationRunReceiptTable.outcome, "retry_wait"),
                ),
              )
              .all().length + (member.outcome === "failed" ? 1 : 0),
        )
    : []
  const failureCount = latestFire
    ? reduceAutomationFireFailureCount({
        state: latestFire.state,
        attemptFailureCount: latestFire.attemptFailureCount,
        memberFailureCounts,
      })
    : 0
  const lease = currentControlLeaseInTransaction(db, "automation", row.definition_id)
  const nextRun = pendingFire
    ? (pendingFire.retryAt ?? pendingFire.scheduledDueAt)
    : row.kind === "delay"
      ? (row.due_at ?? row.time_created)
      : (currentScheduledFire?.scheduledDueAt ??
        Recurrence.nextRun(row.recurrence!, Math.max(row.time_created, latestFire?.completedAt ?? 0)))
  return {
    ...row,
    id: row.definition_id,
    revision_id: row.id,
    last_run: latestFire?.startedAt ?? null,
    failure_count: failureCount,
    last_error: latestFire?.error ?? null,
    lease_until: lease?.expires_at ?? 0,
    lease_owner: lease?.owner_occurrence_id ?? null,
    next_run: nextRun,
    pending_fire_id: pendingFire?.id ?? null,
    scheduled_due_at: pendingFire?.scheduledDueAt ?? currentScheduledFire?.scheduledDueAt ?? null,
    attempt_id: pendingFire
      ? (db
          .select({ id: AutomationFireAttemptTable.id })
          .from(AutomationFireAttemptTable)
          .where(eq(AutomationFireAttemptTable.fire_id, pendingFire.id))
          .orderBy(desc(AutomationFireAttemptTable.ordinal))
          .get()?.id ?? null)
      : null,
    attempt_ordinal: pendingFire?.attemptCount ?? 0,
  }
}

/**
 * Scheduling-only current frontier. Unlike the history projector above, this
 * reducer never walks terminal Fire history: it selects at most one unsettled
 * Fire, one scheduled recurrence boundary, and one latest run.
 */
export function projectAutomationFrontierInTransaction(
  db: Database.TxOrDb,
  row: typeof AutomationTable.$inferSelect,
): AutomationRow {
  const latestFire = db
    .select({ fire: AutomationFireTable })
    .from(AutomationFireTable)
    .innerJoin(AutomationTable, eq(AutomationTable.id, AutomationFireTable.automation_revision_id))
    .where(and(
      eq(AutomationTable.definition_id, row.definition_id),
      sql`(
        EXISTS (SELECT 1 FROM automation_fire_attempt AS attempt WHERE attempt.fire_id=${AutomationFireTable.id})
        OR EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=${AutomationFireTable.id})
      )`,
    ))
    .orderBy(
      desc(AutomationFireTable.scheduled_due_at),
      desc(AutomationFireTable.time_created),
      desc(AutomationFireTable.id),
    )
    .limit(1)
    .get()?.fire
  const latest = latestFire ? projectAutomationFireInTransaction(db, latestFire) : undefined
  const pendingFire = db.select({ fire: AutomationFireTable }).from(AutomationFireTable)
    .where(and(
      eq(AutomationFireTable.automation_revision_id, row.id),
      sql`(
        (
          NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=${AutomationFireTable.id})
          AND EXISTS (
            SELECT 1
            FROM automation_fire_attempt AS attempt
            LEFT JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=attempt.id
            WHERE attempt.fire_id=${AutomationFireTable.id}
              AND NOT EXISTS (
                SELECT 1 FROM automation_fire_attempt AS later
                WHERE later.fire_id=${AutomationFireTable.id}
                  AND (later.ordinal>attempt.ordinal OR (later.ordinal=attempt.ordinal AND later.id>attempt.id))
              )
              AND (receipt.attempt_id IS NULL OR receipt.outcome IN ('reserved','retry_wait'))
          )
        )
        OR EXISTS (
          SELECT 1
          FROM automation_run AS run
          LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
            SELECT candidate.id FROM automation_run_receipt AS candidate
            WHERE candidate.run_id=run.id
            ORDER BY candidate.time_created DESC,candidate.id DESC
            LIMIT 1
          )
          WHERE run.fire_id=${AutomationFireTable.id}
            AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
        )
      )`,
    ))
    .orderBy(desc(AutomationFireTable.scheduled_due_at), desc(AutomationFireTable.time_created), desc(AutomationFireTable.id))
    .limit(1).get()?.fire
  const pending = pendingFire ? projectAutomationFireInTransaction(db, pendingFire) : undefined
  if (pendingFire && pendingFire.automation_revision_id !== row.id) {
    throw new Error(
      `Automation ${row.definition_id} pending fire ${pendingFire.id} belongs to another definition revision`,
    )
  }
  const scheduledFire = db
    .select({ fire: AutomationFireTable })
    .from(AutomationFireTable)
    .where(
      and(
        eq(AutomationFireTable.automation_revision_id, row.id),
        eq(AutomationFireTable.origin, "scheduled"),
        sql`NOT EXISTS (SELECT 1 FROM automation_fire_attempt AS attempt WHERE attempt.fire_id=${AutomationFireTable.id})`,
        sql`NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=${AutomationFireTable.id})`,
      ),
    )
    .orderBy(
      desc(AutomationFireTable.scheduled_due_at),
      desc(AutomationFireTable.time_created),
      desc(AutomationFireTable.id),
    )
    .limit(1)
    .get()?.fire
  const scheduled = scheduledFire
    ? latest?.id === scheduledFire.id
      ? latest
      : projectAutomationFireInTransaction(db, scheduledFire)
    : undefined
  const lease = currentControlLeaseInTransaction(db, "automation", row.definition_id)
  const nextRun = pending
    ? (pending.retryAt ?? pending.scheduledDueAt)
    : row.kind === "delay"
      ? (row.due_at ?? row.time_created)
      : (scheduled?.scheduledDueAt ??
        Recurrence.nextRun(row.recurrence!, Math.max(row.time_created, latest?.completedAt ?? 0)))
  const attempt = pendingFire
    ? db
        .select({ id: AutomationFireAttemptTable.id, ordinal: AutomationFireAttemptTable.ordinal })
        .from(AutomationFireAttemptTable)
        .where(eq(AutomationFireAttemptTable.fire_id, pendingFire.id))
        .orderBy(desc(AutomationFireAttemptTable.ordinal), desc(AutomationFireAttemptTable.id))
        .limit(1)
        .get()
    : undefined
  const memberFailureCounts = latest
    ? latest.runs.map((member) =>
          db
            .select({ id: AutomationRunReceiptTable.id })
            .from(AutomationRunReceiptTable)
            .where(
              and(
                eq(AutomationRunReceiptTable.run_id, member.id),
                eq(AutomationRunReceiptTable.outcome, "retry_wait"),
              ),
            )
            .all().length + (member.outcome === "failed" ? 1 : 0),
        )
    : []
  return {
    ...row,
    id: row.definition_id,
    revision_id: row.id,
    last_run: latest?.startedAt ?? null,
    failure_count: latest
      ? reduceAutomationFireFailureCount({
          state: latest.state,
          attemptFailureCount: latest.attemptFailureCount,
          memberFailureCounts,
        })
      : 0,
    last_error: latest?.error ?? null,
    lease_until: lease?.expires_at ?? 0,
    lease_owner: lease?.owner_occurrence_id ?? null,
    next_run: nextRun,
    pending_fire_id: pending?.id ?? null,
    scheduled_due_at: pending?.scheduledDueAt ?? scheduled?.scheduledDueAt ?? null,
    attempt_id: attempt?.id ?? null,
    attempt_ordinal: attempt?.ordinal ?? 0,
  }
}

export const AUTOMATION_FRONTIER_PAGE_SIZE = 64

type AutomationFrontierFireFact = typeof AutomationFireTable.$inferSelect & {
  definition_id: string
  role: "latest" | "pending" | "boundary"
}

type BatchedAutomationFireState = {
  fire: typeof AutomationFireTable.$inferSelect
  reduced: AutomationFireReducedState
  latestAttempt: { id: string; ordinal: number } | undefined
  reservedTargetFailures: number
}

type AutomationFrontierRunFact = typeof AutomationRunTable.$inferSelect & {
  outcome: AutomationRunRow["outcome"] | null
  retry_at: number | null
  error: string | null
  receipt_time_created: number | null
  retry_count: number
}

type AutomationFrontierAttemptFact = {
  fire_id: string
  attempt_id: string | null
  ordinal: number | null
  outcome: "reserved" | "retry_wait" | "failed" | null
  retry_at: number | null
  error: string | null
  time_created: number | null
  attempt_count: number
  failure_count: number
}

export type AutomationLeaseFrontier = {
  id: string
  target: "automation"
  target_id: string
  owner_occurrence_id: string
  time_activated: number
  expires_at: number
}

export type AutomationFrontierQueryStage = "due" | "definitions" | "fires" | "runs" | "attempts" | "leases"

type AutomationFrontierQueryObserver = (stage: AutomationFrontierQueryStage) => void

/** Load the two scheduler-relevant Fire rows for a page of definition IDs.
 * Each correlated selector is an indexed LIMIT 1 lookup; terminal Fire
 * history never enters the result set. */
function automationFrontierFireFactsInTransaction(
  db: Database.TxOrDb,
  definitions: readonly (typeof AutomationTable.$inferSelect)[],
  observe?: AutomationFrontierQueryObserver,
): AutomationFrontierFireFact[] {
  if (definitions.length === 0) return []
  observe?.("fires")
  const requested = sql.join(definitions.map((definition) => sql`(${definition.definition_id},${definition.id})`), sql`, `)
  return db.all<AutomationFrontierFireFact>(sql`
    WITH requested(definition_id,revision_id) AS (VALUES ${requested})
    SELECT
      requested.definition_id,
      'latest' AS role,
      fire.id,
      fire.automation_revision_id,
      fire.scheduled_due_at,
      fire.origin,
      fire.tool_part_id,
      fire.input_digest,
      fire.time_created
    FROM requested
    JOIN automation_fire AS fire ON fire.id=(
      SELECT candidate.id
      FROM automation_fire AS candidate
      JOIN automation AS revision ON revision.id=candidate.automation_revision_id
      WHERE revision.definition_id=requested.definition_id
        AND (
          EXISTS (SELECT 1 FROM automation_fire_attempt AS attempt WHERE attempt.fire_id=candidate.id)
          OR EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=candidate.id)
        )
      ORDER BY candidate.scheduled_due_at DESC, candidate.time_created DESC, candidate.id DESC
      LIMIT 1
    )
    UNION ALL
    SELECT
      requested.definition_id,
      'pending' AS role,
      fire.id,
      fire.automation_revision_id,
      fire.scheduled_due_at,
      fire.origin,
      fire.tool_part_id,
      fire.input_digest,
      fire.time_created
    FROM requested
    JOIN automation_fire AS fire ON fire.id=(
      SELECT candidate.id
      FROM automation_fire AS candidate
      WHERE candidate.automation_revision_id=requested.revision_id
        AND (
          (
            NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=candidate.id)
            AND EXISTS (
              SELECT 1
              FROM automation_fire_attempt AS attempt
              LEFT JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=attempt.id
              WHERE attempt.fire_id=candidate.id
                AND NOT EXISTS (
                  SELECT 1 FROM automation_fire_attempt AS later
                  WHERE later.fire_id=candidate.id
                    AND (later.ordinal>attempt.ordinal OR (later.ordinal=attempt.ordinal AND later.id>attempt.id))
                )
                AND (receipt.attempt_id IS NULL OR receipt.outcome IN ('reserved','retry_wait'))
            )
          )
          OR EXISTS (
            SELECT 1
            FROM automation_run AS run
            LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
              SELECT latest_receipt.id FROM automation_run_receipt AS latest_receipt
              WHERE latest_receipt.run_id=run.id
              ORDER BY latest_receipt.time_created DESC,latest_receipt.id DESC
              LIMIT 1
            )
            WHERE run.fire_id=candidate.id
              AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
          )
        )
      ORDER BY candidate.scheduled_due_at DESC,candidate.time_created DESC,candidate.id DESC
      LIMIT 1
    )
    UNION ALL
    SELECT
      requested.definition_id,
      'boundary' AS role,
      fire.id,
      fire.automation_revision_id,
      fire.scheduled_due_at,
      fire.origin,
      fire.tool_part_id,
      fire.input_digest,
      fire.time_created
    FROM requested
    JOIN automation_fire AS fire ON fire.id=(
      SELECT candidate.id
      FROM automation_fire AS candidate
      WHERE candidate.automation_revision_id=requested.revision_id
        AND candidate.origin='scheduled'
        AND NOT EXISTS (SELECT 1 FROM automation_fire_attempt AS attempt WHERE attempt.fire_id=candidate.id)
        AND NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=candidate.id)
      ORDER BY candidate.scheduled_due_at DESC, candidate.time_created DESC, candidate.id DESC
      LIMIT 1
    )
  `)
}

function automationFrontierRunFactsInTransaction(
  db: Database.TxOrDb,
  fireIDs: readonly string[],
  observe?: AutomationFrontierQueryObserver,
): AutomationFrontierRunFact[] {
  if (fireIDs.length === 0) return []
  observe?.("runs")
  const requested = sql.join(fireIDs.map((fireID) => sql`(${fireID})`), sql`, `)
  return db.all<AutomationFrontierRunFact>(sql`
    WITH requested(fire_id) AS (VALUES ${requested})
    SELECT
      run.id,
      run.automation_revision_id,
      run.fire_id,
      run.target_project_id,
      run.mission_opened_event_id,
      run.mission_disposition,
      run.mission_closure_event_id,
      run.started_at,
      receipt.outcome,
      receipt.retry_at,
      receipt.error,
      receipt.time_created AS receipt_time_created,
      (
        SELECT count(*) FROM automation_run_receipt AS retry
        WHERE retry.run_id=run.id AND retry.outcome='retry_wait'
      ) AS retry_count
    FROM requested
    JOIN automation_run AS run ON run.fire_id=requested.fire_id
    LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
      SELECT candidate.id FROM automation_run_receipt AS candidate
      WHERE candidate.run_id=run.id
      ORDER BY candidate.time_created DESC,candidate.id DESC
      LIMIT 1
    )
    ORDER BY run.fire_id,run.started_at,run.id
  `)
}

function automationFrontierAttemptFactsInTransaction(
  db: Database.TxOrDb,
  fireIDs: readonly string[],
  observe?: AutomationFrontierQueryObserver,
): AutomationFrontierAttemptFact[] {
  if (fireIDs.length === 0) return []
  observe?.("attempts")
  const requested = sql.join(fireIDs.map((fireID) => sql`(${fireID})`), sql`, `)
  return db.all<AutomationFrontierAttemptFact>(sql`
    WITH requested(fire_id) AS (VALUES ${requested})
    SELECT
      requested.fire_id,
      latest.id AS attempt_id,
      latest.ordinal,
      receipt.outcome,
      receipt.retry_at,
      receipt.error,
      receipt.time_created,
      (
        SELECT count(*) FROM automation_fire_attempt AS candidate
        WHERE candidate.fire_id=requested.fire_id
      ) AS attempt_count,
      (
        SELECT count(*)
        FROM automation_fire_attempt AS candidate
        JOIN automation_fire_attempt_receipt AS candidate_receipt
          ON candidate_receipt.attempt_id=candidate.id
        WHERE candidate.fire_id=requested.fire_id
          AND candidate_receipt.outcome IN ('retry_wait','failed')
      ) AS failure_count
    FROM requested
    LEFT JOIN automation_fire_attempt AS latest ON latest.id=(
      SELECT candidate.id FROM automation_fire_attempt AS candidate
      WHERE candidate.fire_id=requested.fire_id
      ORDER BY candidate.ordinal DESC,candidate.id DESC
      LIMIT 1
    )
    LEFT JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=latest.id
  `)
}

/** One indexed latest-lease lookup per requested definition, returned by one
 * set statement. Historical renewals never enter the scheduler frontier. */
export function currentAutomationLeaseFrontiersInTransaction(
  db: Database.TxOrDb,
  definitionIDs: readonly string[],
  observe?: AutomationFrontierQueryObserver,
): Map<string, AutomationLeaseFrontier> {
  if (definitionIDs.length === 0) return new Map()
  observe?.("leases")
  const requested = sql.join(definitionIDs.map((definitionID) => sql`(${definitionID})`), sql`, `)
  const rows = db.all<AutomationLeaseFrontier>(sql`
    WITH requested(definition_id) AS (VALUES ${requested})
    SELECT lease.*
    FROM requested
    JOIN engine_control_activation_lease AS lease ON lease.id=(
      SELECT candidate.id
      FROM engine_control_activation_lease AS candidate
      WHERE candidate.target='automation'
        AND candidate.target_id=requested.definition_id
      ORDER BY candidate.time_activated DESC,candidate.id DESC
      LIMIT 1
    )
  `)
  return new Map(rows.map((row) => [row.target_id, row]))
}

/** Batch one page with a constant statement budget: frontier Fires, their
 * current runs and receipts, their physical attempts and receipts, and the
 * current Automation leases. No statement is issued per definition, target,
 * run, or attempt. */
function batchedAutomationFireStatesInTransaction(
  db: Database.TxOrDb,
  definitions: readonly (typeof AutomationTable.$inferSelect)[],
  observe?: AutomationFrontierQueryObserver,
): {
  states: Map<string, BatchedAutomationFireState>
  roles: Map<string, { latest?: string; pending?: string; boundary?: string }>
} {
  const facts = automationFrontierFireFactsInTransaction(db, definitions, observe)
  const fires = new Map<string, typeof AutomationFireTable.$inferSelect>()
  const roles = new Map<string, { latest?: string; pending?: string; boundary?: string }>()
  for (const fact of facts) {
    const { definition_id: definitionID, role, ...fire } = fact
    fires.set(fire.id, fire)
    const current = roles.get(definitionID) ?? {}
    current[role] = fire.id
    roles.set(definitionID, current)
  }
  const fireIDs = [...fires.keys()]
  const runs = automationFrontierRunFactsInTransaction(db, fireIDs, observe)
  const attemptFacts = automationFrontierAttemptFactsInTransaction(db, fireIDs, observe)
  const attemptByFire = new Map(attemptFacts.map((attempt) => [attempt.fire_id, attempt]))
  const runsByFire = new Map<string, typeof runs>()
  for (const run of runs) {
    const current = runsByFire.get(run.fire_id) ?? []
    current.push(run)
    runsByFire.set(run.fire_id, current)
  }
  const states = new Map<string, BatchedAutomationFireState>()
  for (const fire of fires.values()) {
    const fireRuns = runsByFire.get(fire.id) ?? []
    const attempt = attemptByFire.get(fire.id)
    const reduced = reduceAutomationFireState({
      fire,
      runs: fireRuns.map((run) => {
        return {
          id: run.id,
          startedAt: run.started_at,
          outcome: run.outcome ?? "running",
          completedAt: run.receipt_time_created,
          error: run.error,
          retryAt: run.retry_at,
        }
      }),
      attempts: {
        count: attempt?.attempt_count ?? 0,
        failureCount: attempt?.failure_count ?? 0,
        latest: attempt?.attempt_id
          ? {
              outcome: attempt.outcome,
              retryAt: attempt.retry_at,
              error: attempt.error,
              completedAt: attempt.time_created,
            }
          : null,
      },
    })
    states.set(fire.id, {
      fire,
      reduced,
      latestAttempt: attempt?.attempt_id && attempt.ordinal !== null
        ? { id: attempt.attempt_id, ordinal: attempt.ordinal }
        : undefined,
      reservedTargetFailures: Math.max(
        0,
        ...fireRuns.map((run) => run.retry_count + (run.outcome === "failed" ? 1 : 0)),
      ),
    })
  }
  return { states, roles }
}

type AutomationFrontierFilter = {
  status?: "active" | "paused"
  kind?: "recurring" | "delay"
}

function currentAutomationDefinitionPageInTransaction(
  db: Database.TxOrDb,
  input: AutomationFrontierFilter & { afterDefinitionID?: string; observe?: AutomationFrontierQueryObserver },
): { rows: Array<typeof AutomationTable.$inferSelect>; hasMore: boolean } {
  input.observe?.("definitions")
  const page = db
    .select()
    .from(AutomationTable)
    .where(
      and(
        input.afterDefinitionID
          ? gt(AutomationTable.definition_id, input.afterDefinitionID)
          : undefined,
        input.status ? eq(AutomationTable.status, input.status) : undefined,
        input.kind ? eq(AutomationTable.kind, input.kind) : undefined,
        sql`NOT EXISTS (
          SELECT 1 FROM automation AS candidate
          WHERE candidate.definition_id=${AutomationTable.definition_id}
            AND (
              candidate.revision>${AutomationTable.revision}
              OR (candidate.revision=${AutomationTable.revision} AND candidate.id>${AutomationTable.id})
            )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM automation_definition_tombstone AS tombstone
          WHERE tombstone.definition_id=${AutomationTable.definition_id}
            AND tombstone.revision>=${AutomationTable.revision}
        )`,
      ),
    )
    .orderBy(AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id))
    .limit(AUTOMATION_FRONTIER_PAGE_SIZE + 1)
    .all()
  return { rows: page.slice(0, AUTOMATION_FRONTIER_PAGE_SIZE), hasMore: page.length > AUTOMATION_FRONTIER_PAGE_SIZE }
}

export function automationFrontierEntriesForDefinitionsInTransaction(
  db: Database.TxOrDb,
  definitions: readonly (typeof AutomationTable.$inferSelect)[],
  observe?: AutomationFrontierQueryObserver,
): Array<{ row: AutomationRow; lease: AutomationLeaseFrontier | undefined }> {
  const result: Array<{ row: AutomationRow; lease: AutomationLeaseFrontier | undefined }> = []
  for (let offset = 0; offset < definitions.length; offset += AUTOMATION_FRONTIER_PAGE_SIZE) {
    const page = definitions.slice(offset, offset + AUTOMATION_FRONTIER_PAGE_SIZE)
    const { states, roles } = batchedAutomationFireStatesInTransaction(db, page, observe)
    const leases = currentAutomationLeaseFrontiersInTransaction(
      db,
      page.map((definition) => definition.definition_id),
      observe,
    )
    for (const row of page) {
      const role = roles.get(row.definition_id)
      const latest = role?.latest ? states.get(role.latest) : undefined
      const boundary = role?.boundary ? states.get(role.boundary) : undefined
      const pending = role?.pending ? states.get(role.pending) : undefined
      if (pending && pending.fire.automation_revision_id !== row.id) {
        throw new Error(
          `Automation ${row.definition_id} pending fire ${pending.fire.id} belongs to another definition revision`,
        )
      }
      const lease = leases.get(row.definition_id)
      const nextRun = pending
        ? (pending.reduced.retryAt ?? pending.fire.scheduled_due_at)
        : row.kind === "delay"
          ? (row.due_at ?? row.time_created)
          : (boundary?.fire.scheduled_due_at ??
            Recurrence.nextRun(row.recurrence!, Math.max(row.time_created, latest?.reduced.completedAt ?? 0)))
      const projected: AutomationRow = {
        ...row,
        id: row.definition_id,
        revision_id: row.id,
        last_run: latest?.reduced.startedAt ?? null,
        failure_count: latest
          ? reduceAutomationFireFailureCount({
              state: latest.reduced.state,
              attemptFailureCount: latest.reduced.attemptFailureCount,
              memberFailureCounts: [latest.reservedTargetFailures],
            })
          : 0,
        last_error: latest?.reduced.error ?? null,
        lease_until: lease?.expires_at ?? 0,
        lease_owner: lease?.owner_occurrence_id ?? null,
        next_run: nextRun,
        pending_fire_id: pending?.fire.id ?? null,
        scheduled_due_at: pending?.fire.scheduled_due_at ?? boundary?.fire.scheduled_due_at ?? null,
        attempt_id: pending?.latestAttempt?.id ?? null,
        attempt_ordinal: pending?.latestAttempt?.ordinal ?? 0,
      }
      result.push({ row: projected, lease: leases.get(row.definition_id) })
    }
  }
  return result
}

/** Current scheduling frontier for every matching live definition. The
 * definition cursor itself is an indexed SQL LIMIT page; Fire, run/receipt,
 * attempt and lease facts never receive IDs outside that same page. Exact
 * claim revalidates only selected due definitions under its writer lock. */
export function currentAutomationFrontiersInTransaction(
  db: Database.TxOrDb,
  input: AutomationFrontierFilter & { observe?: AutomationFrontierQueryObserver } = {},
): AutomationRow[] {
  const result: AutomationRow[] = []
  let afterDefinitionID: string | undefined
  while (true) {
    const page = currentAutomationDefinitionPageInTransaction(db, { ...input, afterDefinitionID })
    result.push(
      ...automationFrontierEntriesForDefinitionsInTransaction(db, page.rows, input.observe).map((entry) => entry.row),
    )
    if (!page.hasMore) return result
    afterDefinitionID = page.rows.at(-1)!.definition_id
  }
}

type DueAutomationFireFact = {
  fire_id: string
  automation_revision_id: string
  definition_id: string
  available_at: number
}

export type DueAutomationFrontier = {
  fireID: string
  effectiveDueAt: number
  row: AutomationRow
}

export function currentDueAutomationFrontiersInTransaction(
  db: Database.TxOrDb,
  now: number,
  observe?: AutomationFrontierQueryObserver,
  cursor?: { effectiveDueAt: number; definitionID: string; fireID: string },
): DueAutomationFrontier[] {
  observe?.("due")
  const due = db.all<DueAutomationFireFact>(sql`
    SELECT fire_id,automation_revision_id,definition_id,available_at
    FROM automation_fire_frontier INDEXED BY automation_fire_frontier_due_idx
    WHERE available_at<=${now}
      ${cursor ? sql`AND (available_at,definition_id,fire_id)>(${cursor.effectiveDueAt},${cursor.definitionID},${cursor.fireID})` : sql``}
    ORDER BY available_at,definition_id,fire_id
    LIMIT ${AUTOMATION_FRONTIER_PAGE_SIZE}
  `)
  if (due.length === 0) return []
  observe?.("definitions")
  const definitions = db
    .select()
    .from(AutomationTable)
    .where(
      inArray(
        AutomationTable.id,
        due.map((entry) => entry.automation_revision_id),
      ),
    )
    .all()
  const definitionByID = new Map(definitions.map((definition) => [definition.id, definition]))
  const entries = automationFrontierEntriesForDefinitionsInTransaction(
    db,
    due.map((entry) => {
      const definition = definitionByID.get(entry.automation_revision_id)
      if (!definition || definition.definition_id !== entry.definition_id) {
        throw new Error(`Automation due Fire ${entry.fire_id} lost its immutable definition revision`)
      }
      return definition
    }),
    observe,
  )
  const rowByRevision = new Map(entries.map((entry) => [entry.row.revision_id, entry.row]))
  return due.map((entry) => {
    const row = rowByRevision.get(entry.automation_revision_id)
    if (!row || row.scheduled_due_at === null) {
      throw new Error(`Automation due Fire ${entry.fire_id} has no current scheduled frontier`)
    }
    return { fireID: entry.fire_id, effectiveDueAt: entry.available_at, row }
  })
}

export function projectAutomations(rows: Array<typeof AutomationTable.$inferSelect>): AutomationRow[] {
  return Database.use((db) => rows.map((row) => projectAutomationInTransaction(db, row)))
}
