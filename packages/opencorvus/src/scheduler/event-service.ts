import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, and, eq, inArray, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Session } from "@/session"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Wildcard } from "@/util/wildcard"
import { Identifier } from "@/id/id"
import { createHash, randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { EventJobDefinitionTombstoneTable, EventJobFireReceiptTable, EventJobFireTable, EventJobTable, EventOccurrenceTable, type EventJobFireCausationEntry } from "./event.sql"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { projectEventFireInTransaction, projectEventJobInTransaction, type EventJobFireRow, type EventJobRow } from "./event-projection"
import { acquireControlLeaseInTransaction, currentControlLeaseInTransaction, releaseControlLeaseInTransaction, renewControlLease } from "@/engine/control-lease"
import { RuntimeExecutionAdmissionClosedError, RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Project } from "@/project/project"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { createSchedulerExecutionInactivityFence } from "./execution-inactivity"
import { requireMissionSession } from "@/mission/session"
import {
  admitMissionExecutionWake,
  MissionExecutionWakeClosedError,
  MissionExecutionWakeNotOpenedError,
} from "@/mission/execution-closure"

type Match = Record<string, string | number | boolean>
type EventEnvelope = Bus.Envelope
type EventJob = EventJobRow
type EventJobFire = EventJobFireRow

export type EventJobView = {
  id: string
  name: string
  eventType: string
  match: Match
  prompt: string
  enabled: boolean
  oneShot: boolean
  cooldownMs: number
  lastRun: number | null
  lastEvent: string | null
  failureCount: number
  lastError: string | null
}

export type CreateEventJobInput = {
  name: string
  eventType: string
  match?: Match
  prompt: string
  projectId: string
  sessionId?: string
  oneShot?: boolean
  cooldownMs?: number
}

type FireCausation = {
  parentFireID?: string
  ancestry: EventJobFireCausationEntry[]
}

type EventWakeExecutor = (input: {
  fire: EventJobFire
  job: EventJob
  ownerID: string
  signal: AbortSignal
}) => Promise<{ sessionID: string; messageID: string }>
type EventFireAcceptedHook = (fire: EventJobFire) => void | Promise<void>
type BeforeSessionWakeHook = (input: {
  fire: EventJobFire
  ownerID: string
  signal: AbortSignal
}) => void | Promise<void>
type AfterEventFireClaimHook = (input: {
  fire: EventJobFire
  ownerID: string
  signal: AbortSignal
}) => void | Promise<void>

export namespace EventService {
  const log = Log.create({ service: "event-service" })
  const FIRE_LEASE_MS = 30_000
  /**
   * A recovery timer floor. A row whose retry time has already passed while a
   * lease is still live would otherwise re-enter claim every millisecond until
   * that lease expires, which is a hot loop rather than a wait.
   */
  const FIRE_RECOVERY_MIN_DELAY_MS = 250
  /**
   * How often a queued fire re-checks a head that is live in another runtime.
   * The head's own settlement wakes only its runtime, so this poll is what
   * hands the queue over here; the head's full lease is the crash bound.
   */
  const FIRE_RUNNING_HEAD_POLL_MS = 2_500
  const FIRE_LEASE_RENEW_MS = 5_000
  const FIRE_RETRY_BASE_MS = 1_000
  const FIRE_RETRY_MAX_MS = 60_000

  let wakeExecutorForTest: EventWakeExecutor | undefined
  let fireAcceptedHookForTest: EventFireAcceptedHook | undefined
  let beforeSessionWakeForTest: BeforeSessionWakeHook | undefined
  let afterEventFireClaimForTest: AfterEventFireClaimHook | undefined
  let createFireFailuresForTest = 0
  let beforeProcessRollbackRecoveryForTest: (() => void | Promise<void>) | undefined
  let processSettlementGate: { token: symbol; projectIDs: Set<string> } | undefined

  function latestEventDefinitionInTransaction(db: Database.TxOrDb, definitionID: string) {
    const row = db.select().from(EventJobTable).where(eq(EventJobTable.definition_id, definitionID))
      .orderBy(sql`${EventJobTable.revision} DESC`, sql`${EventJobTable.id} DESC`).get()
    const tombstone = db.select().from(EventJobDefinitionTombstoneTable)
      .where(eq(EventJobDefinitionTombstoneTable.definition_id, definitionID))
      .orderBy(sql`${EventJobDefinitionTombstoneTable.revision} DESC`, sql`${EventJobDefinitionTombstoneTable.id} DESC`).get()
    return row && (!tombstone || row.revision > tombstone.revision) ? row : undefined
  }

  function currentEventDefinitions(db: Database.TxOrDb) {
    const latest = new Map<string, typeof EventJobTable.$inferSelect>()
    for (const row of db.select().from(EventJobTable)
      .orderBy(EventJobTable.definition_id, sql`${EventJobTable.revision} DESC`, sql`${EventJobTable.id} DESC`).all()) {
      if (!latest.has(row.definition_id)) latest.set(row.definition_id, row)
    }
    return [...latest.values()].filter((row) => {
      const tombstone = db.select({ revision: EventJobDefinitionTombstoneTable.revision })
        .from(EventJobDefinitionTombstoneTable)
        .where(eq(EventJobDefinitionTombstoneTable.definition_id, row.definition_id))
        .orderBy(sql`${EventJobDefinitionTombstoneTable.revision} DESC`).get()
      return !tombstone || row.revision > tombstone.revision
    })
  }

  function appendEventDefinitionTombstoneInTransaction(db: Database.TxOrDb, row: typeof EventJobTable.$inferSelect, now: number) {
    db.insert(EventJobDefinitionTombstoneTable).values({
      id: Identifier.ascending("event_job"),
      definition_id: row.definition_id,
      revision: row.revision + 1,
      time_created: now,
    }).run()
  }

  const state = createInstanceState(
    () => ({
      unsub: undefined as undefined | (() => void),
      lifecycle: new AbortController(),
      ownerID: `event-fire-owner:${randomUUID()}`,
      running: new Map<string, Promise<void>>(),
      jobTails: new Map<string, Promise<void>>(),
      recoveryTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      recoveryOperations: new Set<Promise<void>>(),
      runtimeReopen: undefined as Disposable | undefined,
    }),
    async (s) => {
      s.unsub?.()
      s.unsub = undefined
      s.runtimeReopen?.[Symbol.dispose]()
      s.runtimeReopen = undefined
      s.lifecycle.abort(new Error("EventService Instance is disposing"))
      for (const timer of s.recoveryTimers.values()) clearTimeout(timer)
      s.recoveryTimers.clear()
      while (s.recoveryOperations.size > 0) await Promise.allSettled([...s.recoveryOperations])
      while (s.running.size > 0) await Promise.allSettled([...s.running.values()])
      s.jobTails.clear()
    },
    "event-service",
  )

  export function init() {
    const s = state()
    if (s.unsub) return
    if (s.lifecycle.signal.aborted) throw new Error("EventService cannot initialize while its Instance is disposing")
    s.unsub = Bus.subscribeAll(
      async (event: EventEnvelope) => {
        await accept(event)
      },
      { durableID: "scheduler.event-service", effect: "idempotent_by_occurrence" },
    )
    const directory = Instance.directory
    s.runtimeReopen = RuntimeExecutionSettlement.onAdmissionReopened("scheduler_event_fire", () => {
      let recovery!: Promise<void>
      recovery = Instance.provide({
        directory,
        fn: () => {
          if (state() !== s || s.lifecycle.signal.aborted) return
          recoverProjectFires()
        },
      })
        .catch((error) => {
          log.error("event fire durable recovery after runtime admission reopen failed", { directory, error })
        })
        .finally(() => s.recoveryOperations.delete(recovery))
      s.recoveryOperations.add(recovery)
    })
    recoverProjectFires()
    log.info("event service initialized")
  }

  export type ProcessSettlementGate = Disposable & {
    commit(): void
    rollback(): () => Promise<void>
  }

  async function resumeProcessSettlementProjects(projectIDs: ReadonlySet<string>): Promise<void> {
    await beforeProcessRollbackRecoveryForTest?.()
    const failures: unknown[] = []
    for (const projectID of projectIDs) {
      const project = Project.get(projectID)
      if (!project) {
        failures.push(new Error(`Event fire recovery references missing project ${projectID}`))
        continue
      }
      try {
        await runWithInitializedIndependentProject({
          directory: project.worktree,
          fn: async () => {
            if (Instance.project.id !== projectID) {
              throw new Error(`Event fire rollback resolved project ${Instance.project.id}, expected ${projectID}`)
            }
            recoverProjectFires()
            await TestHooks.waitForIdle()
          },
        })
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Failed to resume Event fire projects after runtime rollback")
    }
  }

  export function acquireProcessSettlementGate(): ProcessSettlementGate {
    if (processSettlementGate) throw new Error("Event fire process settlement is already in progress")
    const token = Symbol("event-fire-process-settlement")
    const projectIDs = new Set(
      Database.use((db) => db.select().from(EventJobFireTable).all().map((row) => projectEventFireInTransaction(db, row, Date.now())).filter((row) => ["pending", "running", "retry_wait"].includes(row.status)).map((row) => row.project_id)),
    )
    processSettlementGate = { token, projectIDs }
    let decision: "pending" | "commit" | "rollback" = "pending"
    let disposed = false
    let rollbackCompleted = false
    let rollbackOperation: Promise<void> | undefined
    return {
      commit() {
        if (decision === "rollback") throw new Error("Event fire process settlement rollback is already authoritative")
        decision = "commit"
      },
      rollback() {
        if (decision === "commit") throw new Error("Event fire process settlement commit is already authoritative")
        decision = "rollback"
        return async () => {
          if (!disposed) throw new Error("Event fire rollback can resume only after all runtime admission gates reopen")
          if (rollbackCompleted) return
          if (rollbackOperation) return await rollbackOperation
          rollbackOperation = resumeProcessSettlementProjects(projectIDs).then(() => {
            rollbackCompleted = true
          })
          try {
            await rollbackOperation
          } finally {
            rollbackOperation = undefined
          }
        }
      },
      [Symbol.dispose]() {
        if (processSettlementGate?.token !== token) return
        if (decision === "pending") {
          throw new Error("Event fire process settlement gate requires an explicit commit or rollback decision")
        }
        processSettlementGate = undefined
        disposed = true
      },
    }
  }

  export function list(projectID: string): EventJobView[] {
    const rows = Database.use((db) =>
      currentEventDefinitions(db).filter((row) => row.project_id === projectID),
    )
    return rows.map((row) => Database.use((db) => projectEventJobInTransaction(db, row, Date.now()))).map((j) => ({
      id: j.id,
      name: j.name,
      eventType: j.event_type,
      match: j.match_json ?? {},
      prompt: j.prompt,
      enabled: j.enabled,
      oneShot: j.one_shot,
      cooldownMs: j.cooldown_ms,
      lastRun: j.last_run,
      lastEvent: j.last_event ?? null,
      failureCount: j.failure_count,
      lastError: j.last_error ?? null,
    }))
  }

  async function assertSessionInProject(input: { sessionId?: string; projectId: string }) {
    const sessionId = input.sessionId
    if (!sessionId) return
    await Session.assertLineageInProject({ sessionID: sessionId, projectID: input.projectId })
  }

  export async function create(input: CreateEventJobInput): Promise<{ id: string; name: string; eventType: string }> {
    await assertSessionInProject({ sessionId: input.sessionId, projectId: input.projectId })
    const id = Identifier.ascending("event_job")
    Database.use((db) =>
      db
        .insert(EventJobTable)
        .values({
          id,
          definition_id: id,
          revision: 1,
          project_id: input.projectId,
          session_id: input.sessionId,
          name: input.name,
          event_type: input.eventType,
          match_json: input.match,
          prompt: input.prompt,
          enabled: true,
          one_shot: input.oneShot ?? false,
          cooldown_ms: input.cooldownMs ?? 0,
        })
        .run(),
    )
    return { id, name: input.name, eventType: input.eventType }
  }

  export function remove(id: string, projectID: string): boolean {
    return Database.immediateTransaction((db) => {
      const row = latestEventDefinitionInTransaction(db, id)
      if (!row || row.project_id !== projectID) return false
      appendEventDefinitionTombstoneInTransaction(db, row, Date.now())
      return true
    })
  }

  async function accept(event: EventEnvelope): Promise<void> {
    if (event.type === Bus.InstanceDisposed.type) return
    const s = state()
    if (s.lifecycle.signal.aborted) return
    const now = Date.now()
    const jobs = Database.use((db) =>
      currentEventDefinitions(db)
        .filter((row) => row.project_id === Instance.project.id && row.enabled)
        .map((row) => projectEventJobInTransaction(db, row, Date.now())),
    )
    const matches = jobs.filter((job) => Wildcard.match(event.type, job.event_type) && ok(event, job.match_json ?? {}))
    if (matches.length === 0) return
    processSettlementGate?.projectIDs.add(Instance.project.id)

    const causation = resolveCausation(event)
    const fires = createFires({
      jobs: matches,
      eventType: event.type,
      properties: event.properties,
      occurrenceID: event.occurrenceID,
      causation,
      now,
    })
    for (const fire of fires) {
      await fireAcceptedHookForTest?.(fire)
      if (fire.status === "pending") enqueueFire(fire.id, fire.event_job_id)
    }
  }

  function createFires(input: {
    jobs: EventJob[]
    eventType: string
    properties: unknown
    occurrenceID: string
    causation: FireCausation
    now: number
  }): EventJobFire[] {
    if (createFireFailuresForTest > 0) {
      createFireFailuresForTest -= 1
      throw new Error("injected Event fire durable insert failure")
    }
    return Database.immediateTransaction((db) =>
      {
        const outbox = db.select({ id: BusPublicationOutboxTable.occurrence_id }).from(BusPublicationOutboxTable)
          .where(eq(BusPublicationOutboxTable.occurrence_id, input.occurrenceID)).get()
        const occurrence = {
          id: input.occurrenceID,
          bus_outbox_id: outbox?.id ?? null,
          project_id: outbox ? null : Instance.project.id,
          event_type: outbox ? null : input.eventType,
          properties: outbox ? null : input.properties,
          time_created: input.now,
        }
        const insertedOccurrence = db.insert(EventOccurrenceTable).values(occurrence).onConflictDoNothing().returning().get()
        if (!insertedOccurrence) {
          const existing = db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, input.occurrenceID)).get()
          if (
            !existing ||
            existing.bus_outbox_id !== occurrence.bus_outbox_id ||
            existing.project_id !== occurrence.project_id ||
            existing.event_type !== occurrence.event_type ||
            !isDeepStrictEqual(existing.properties, occurrence.properties)
          ) throw new Error(`Event occurrence ${input.occurrenceID} conflicts with its immutable input fact`)
        }
        return input.jobs.map((job) => {
        const fireID = Identifier.ascending("call")
        const cycle = input.causation.ancestry.some((entry) => entry.jobID === job.id)
        const inserted = db
          .insert(EventJobFireTable)
          .values({
            id: fireID,
            event_job_revision_id: job.revision_id,
            event_occurrence_id: input.occurrenceID,
            causation_fire_id: input.causation.parentFireID,
            created_session_id: job.session_id === null ? Identifier.ascending("session") : null,
            time_created: input.now,
          })
          .onConflictDoNothing({
            target: [EventJobFireTable.event_job_revision_id, EventJobFireTable.event_occurrence_id],
          })
          .returning()
          .get()
        if (inserted) {
          if (cycle) {
            db.insert(EventJobFireReceiptTable).values({
              id: Identifier.ascending("call"),
              fire_id: inserted.id,
              outcome: "disposition",
              disposition: "causal_cycle",
              message_id: null,
              retry_at: null,
              error: null,
              time_created: input.now,
            }).run()
          }
          return projectEventFireInTransaction(db, inserted, input.now)
        }
        const existing = db
          .select()
          .from(EventJobFireTable)
          .where(
            and(
              eq(EventJobFireTable.event_job_revision_id, job.revision_id),
              eq(EventJobFireTable.event_occurrence_id, input.occurrenceID),
            ),
          )
          .get()
        if (!existing) {
          throw new Error(`Event occurrence ${input.occurrenceID} conflict has no durable fire for job ${job.id}`)
        }
        return projectEventFireInTransaction(db, existing, input.now)
        })
      },
    )
  }

  function resolveCausation(event: EventEnvelope): FireCausation {
    if (event.causation?.source === "scheduler.event") {
      const parent = requireParentFire(event.causation.occurrenceID)
      return causationFromParent(parent)
    }
    const wakeReason = eventWakeReason(event)
    if (wakeReason?.source === "scheduler.event") {
      const parent = requireParentFire(wakeReason.fireID)
      if (parent.event_job_id !== wakeReason.jobID) {
        throw new Error(
          `Event wake ${wakeReason.fireID} names job ${wakeReason.jobID}, expected ${parent.event_job_id}`,
        )
      }
      return causationFromParent(parent)
    }
    if (event.type !== Session.Event.Created.type) return { ancestry: [] }
    const sessionID = eventInfoID(event)
    if (!sessionID) return { ancestry: [] }
    const parent = Database.use((db) => db.select().from(EventJobFireTable)
      .where(eq(EventJobFireTable.created_session_id, sessionID))
      .orderBy(sql`${EventJobFireTable.time_created} DESC`, sql`${EventJobFireTable.id} DESC`).all()
      .map((row) => projectEventFireInTransaction(db, row, Date.now())).find((row) => row.project_id === Instance.project.id))
    return parent ? causationFromParent(parent) : { ancestry: [] }
  }

  function eventWakeReason(event: EventEnvelope): SessionWake.WakeReason | undefined {
    const properties = objectRecord(event.properties)
    const info = objectRecord(properties?.info)
    const extra = objectRecord(info?.extra)
    const parsed = SessionWake.WakeReason.safeParse(extra?.wake_reason)
    return parsed.success ? parsed.data : undefined
  }

  function eventInfoID(event: EventEnvelope): string | undefined {
    const properties = objectRecord(event.properties)
    const info = objectRecord(properties?.info)
    return typeof info?.id === "string" ? info.id : undefined
  }

  function requireParentFire(fireID: string): EventJobFire {
    const parent = Database.use((db) => {
      const row = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()
      return row ? projectEventFireInTransaction(db, row, Date.now()) : undefined
    })
    if (!parent || parent.project_id !== Instance.project.id) throw new Error(`Event wake ${fireID} has no durable Event Job fire authority`)
    return parent
  }

  function causationFromParent(parent: EventJobFire): FireCausation {
    return {
      parentFireID: parent.id,
      ancestry: [...parent.causation_ancestry, { fireID: parent.id, jobID: parent.event_job_id }],
    }
  }

  function recoverProjectFires(): void {
    const rows = Database.use((db) => db.select().from(EventJobFireTable).all()
      .map((row) => projectEventFireInTransaction(db, row, Date.now())).filter((row) => row.project_id === Instance.project.id && ["pending", "running", "retry_wait"].includes(row.status)).map((row) => ({ id: row.id, jobID: row.event_job_id })))
    for (const row of rows) {
      try {
        enqueueFire(row.id, row.jobID)
      } catch (error) {
        if (error instanceof RuntimeExecutionAdmissionClosedError && error.kind === "scheduler_event_fire") continue
        throw error
      }
    }
  }

  function enqueueFire(fireID: string, jobID: string): void {
    const s = state()
    if (s.lifecycle.signal.aborted || s.running.has(fireID)) return
    const runtimeReservation = RuntimeExecutionSettlement.reserve("scheduler_event_fire", `event-fire:${fireID}`)
    const previous = s.jobTails.get(jobID) ?? Promise.resolve()
    let current!: Promise<void>
    current = previous
      .catch(() => undefined)
      .then(async () => {
        if (s.lifecycle.signal.aborted) return
        runtimeReservation.signal.throwIfAborted()
        await processFire(fireID, runtimeReservation.signal)
      })
      .catch((error) => {
        log.error("event fire execution failed", {
          fireID,
          jobID,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        if (s.running.get(fireID) === current) s.running.delete(fireID)
        if (s.jobTails.get(jobID) === current) s.jobTails.delete(jobID)
      })
    s.running.set(fireID, current)
    s.jobTails.set(jobID, current)
    runtimeReservation.settleWith(current)
  }

  async function admitEventSessionWake<Receipt extends { activation: Promise<unknown> }>(
    session: Session.Info,
    wake: () => Receipt | Promise<Receipt>,
  ): Promise<Receipt> {
    if (session.kind !== "mission") return wake()
    const mission = await requireMissionSession(session.id)
    return admitMissionExecutionWake({ missionID: mission.missionID, sessionID: mission.id, wake })
  }

  async function resumeEventWake(input: { session: Session.Info; messageID: string }): Promise<void> {
    await admitEventSessionWake(input.session, () =>
      SessionWake.resumePersistedWakeWithReceipt({
        sessionID: input.session.id,
        messageID: input.messageID,
        directory: input.session.directory,
      }),
    )
  }

  async function processFire(fireID: string, runtimeSignal: AbortSignal): Promise<void> {
    const s = state()
    const claimed = claimFire(fireID, s.ownerID)
    if (!claimed) {
      scheduleLeaseRecovery(fireID)
      return
    }
    const leaseFence = createEventFireLeaseFence(claimed.id, s.ownerID)
    using inactivityFence = await createSchedulerExecutionInactivityFence({
      occurrence: `Event fire ${claimed.id}`,
      signals: [s.lifecycle.signal, runtimeSignal, leaseFence.signal],
      initialPhase: "claimed",
      configurationOwner: "project",
    })
    const signal = inactivityFence.signal
    const renewTimer = setInterval(() => leaseFence.renewOrAbort(), FIRE_LEASE_RENEW_MS)
    renewTimer.unref()
    let job: EventJob | undefined
    try {
      await afterEventFireClaimForTest?.({ fire: claimed, ownerID: s.ownerID, signal })
      throwIfAborted(signal)
      inactivityFence.touch("wake reconciliation")
      const existingMessageID = findWakeMessageID(claimed)
      job = Database.use((db) => {
        const persisted = db
          .select()
          .from(EventJobTable)
          .where(and(eq(EventJobTable.id, claimed.event_job_revision_id), eq(EventJobTable.project_id, claimed.project_id)))
          .get()
        return persisted ? projectEventJobInTransaction(db, persisted, Date.now()) : undefined
      })
      inactivityFence.touch("job resolved")
      if (existingMessageID) {
        const session = await Session.get(claimed.target_session_id)
        throwIfAborted(signal)
        await resumeEventWake({ session, messageID: existingMessageID })
        settleSuccess(claimed, job, s.ownerID, claimed.target_session_id, existingMessageID)
        return
      }
      if (!job || !job.enabled) {
        settleDisposition(claimed, s.ownerID, "job_disabled", "Event Job is no longer enabled")
        return
      }
      if (!ready(job, Date.now())) {
        settleDisposition(claimed, s.ownerID, "cooldown", "Event Job cooldown has not elapsed")
        return
      }

      const activeJob = job
      inactivityFence.touch("wake dispatch")
      const result = await Bus.withCausation(
        {
          source: "scheduler.event",
          occurrenceID: claimed.id,
        },
        () => (wakeExecutorForTest ?? executeWake)({ fire: claimed, job: activeJob, ownerID: s.ownerID, signal }),
      )
      throwIfAborted(signal)
      inactivityFence.touch("durable success settlement")
      settleSuccess(claimed, activeJob, s.ownerID, result.sessionID, result.messageID)
    } catch (error) {
      try {
        const reconciledMessageID = findWakeMessageID(claimed)
        const missionAdmissionRejected =
          MissionExecutionWakeClosedError.isInstance(error) || MissionExecutionWakeNotOpenedError.isInstance(error)
        if (missionAdmissionRejected && !leaseFence.lost) {
          scheduleRetry(claimed, job, s.ownerID, error)
        } else if (reconciledMessageID && !leaseFence.lost) {
          const session = await Session.get(claimed.target_session_id)
          throwIfAborted(leaseFence.signal)
          await resumeEventWake({ session, messageID: reconciledMessageID })
          settleSuccess(claimed, job, s.ownerID, claimed.target_session_id, reconciledMessageID)
        } else if (leaseFence.lost) {
          scheduleLeaseRecovery(claimed.id)
        } else if (s.lifecycle.signal.aborted || runtimeSignal.aborted) {
          deferFire(claimed, s.ownerID, error)
        } else {
          scheduleRetry(claimed, job, s.ownerID, error)
        }
      } catch (settlementError) {
        log.error("event fire failure settlement failed", {
          fireID: claimed.id,
          jobID: claimed.event_job_id,
          error: errorMessage(error),
          settlementError: errorMessage(settlementError),
        })
      }
    } finally {
      clearInterval(renewTimer)
      // Every nonterminal claim exit retains a same-identity recovery owner.
      // Terminal rows make this a no-op. A retry_wait receipt now ends its own
      // lease, so its recovery schedule is the receipt's `retry_at`; a
      // deferred or lost claim still rides the current owner's lease.
      scheduleLeaseRecovery(claimed.id)
    }
  }

  /**
   * Take the fire owner for the exact fire that is still at the head of its
   * job's queue.
   *
   * Head-of-queue validation and lease acquisition share one write
   * transaction. Split apart, another process can settle or supersede the fire
   * between the two, and this claim then holds a lease over a fire it never
   * validated.
   */
  function claimFire(fireID: string, ownerID: string): EventJobFire | undefined {
    const now = Date.now()
    return Database.immediateTransaction((db) => {
      const candidate = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()
      if (!candidate) return undefined
      const projected = projectEventFireInTransaction(db, candidate, now)
      if (projected.status !== "pending") return undefined
      const head = db.select().from(EventJobFireTable).orderBy(EventJobFireTable.time_created, EventJobFireTable.id).all()
        .map((row) => projectEventFireInTransaction(db, row, now)).find((row) => row.event_job_id === projected.event_job_id && ["pending", "running", "retry_wait"].includes(row.status))
      if (head?.id !== fireID) return undefined
      const acquired = acquireControlLeaseInTransaction(db, {
        target: "event_fire",
        targetID: fireID,
        ownerOccurrenceID: ownerID,
        now,
        leaseMilliseconds: FIRE_LEASE_MS,
      })
      if (!acquired.acquired) return undefined
      // Re-project inside the same transaction. `attempt` and `time_started`
      // are derived from the lease rows, so a projection taken before the
      // acquire under-counts this very attempt — and `attempt` is the retry
      // backoff exponent.
      return projectEventFireInTransaction(db, candidate, now)
    })
  }

  function enqueueNextFireForJob(jobID: string): void {
    const next = Database.use((db) => db.select().from(EventJobFireTable).orderBy(EventJobFireTable.time_created, EventJobFireTable.id).all().map((row) => projectEventFireInTransaction(db, row, Date.now())).find((row) => row.event_job_id === jobID && ["pending", "running", "retry_wait"].includes(row.status)))
    if (next) enqueueFire(next.id, jobID)
  }

  function scheduleLeaseRecovery(fireID: string): void {
    const s = state()
    if (s.lifecycle.signal.aborted || s.recoveryTimers.has(fireID)) return
    let row: { jobID: string; status: EventJobFire["status"]; lease: number } | undefined
    try {
      row = Database.use((db) => {
        const persisted = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()
        if (!persisted) return undefined
        const now = Date.now()
        const fire = projectEventFireInTransaction(db, persisted, now)
        // The deadline belongs to whatever is actually deferring this fire.
        // `retry_at` survives as a past value on every attempt after the
        // first, so a running fire waits on its lease, a retry waits on its
        // retry time — and a pending fire that is not the head of its job's
        // queue waits on the HEAD's deadline, because nothing about the
        // pending row itself will change until the head settles.
        let deadline = fire.status === "running" ? fire.lease_until : (fire.retry_at ?? fire.lease_until)
        if (fire.status === "pending" && deadline <= now) {
          // Bounded to this fire's own job: projecting every fire of every
          // job to find one head is a full-table scan on every scheduling.
          const revisions = db.select({ id: EventJobTable.id }).from(EventJobTable)
            .where(eq(EventJobTable.definition_id, fire.event_job_id)).all().map((row) => row.id)
          const head = (revisions.length === 0 ? [] : db.select().from(EventJobFireTable)
            .where(inArray(EventJobFireTable.event_job_revision_id, revisions))
            .orderBy(EventJobFireTable.time_created, EventJobFireTable.id).all())
            .map((row) => projectEventFireInTransaction(db, row, now))
            .find((row) => ["pending", "running", "retry_wait"].includes(row.status))
          if (head && head.id !== fire.id) {
            // A retry head's deadline is exact. A running head normally
            // settles well before its lease expires and nothing else wakes
            // this runtime when it does, so waiting the whole lease is only
            // right when its owner crashed — poll it instead.
            deadline =
              head.status === "running"
                ? Math.min(head.lease_until, now + FIRE_RUNNING_HEAD_POLL_MS)
                : (head.retry_at ?? head.lease_until)
          }
        }
        return { jobID: fire.event_job_id, status: fire.status, lease: deadline }
      })
    } catch (error) {
      log.warn("event fire recovery metadata read failed", { fireID, error: errorMessage(error) })
      scheduleRecoveryControlRetry(s, fireID)
      return
    }
    if (!row || (row.status !== "pending" && row.status !== "running" && row.status !== "retry_wait")) return
    const timer = setTimeout(
      () => {
        s.recoveryTimers.delete(fireID)
        try {
          enqueueFire(fireID, row.jobID)
        } catch (error) {
          if (error instanceof RuntimeExecutionAdmissionClosedError && error.kind === "scheduler_event_fire") {
            log.info("event fire recovery deferred while runtime admission is closed", { fireID })
            return
          }
          log.error("event fire recovery enqueue failed", { fireID, error: errorMessage(error) })
          scheduleRecoveryControlRetry(s, fireID)
        }
      },
      // A row with no deadline of its own was refused by something else —
      // usually a head-of-queue fire running in another runtime — and this
      // timer is the only thing that will ask again. Re-asking immediately is
      // a poll for the whole of that other attempt, so every refused claim
      // backs off. The head-of-queue handoff inside this runtime does not come
      // through here; `enqueueNextFireForJob` drives it directly.
      Math.max(FIRE_RECOVERY_MIN_DELAY_MS, row.lease - Date.now() + 1),
    )
    s.recoveryTimers.set(fireID, timer)
  }

  function scheduleRecoveryControlRetry(s: ReturnType<typeof state>, fireID: string): void {
    if (s.lifecycle.signal.aborted || s.recoveryTimers.has(fireID)) return
    const timer = setTimeout(() => {
      s.recoveryTimers.delete(fireID)
      scheduleLeaseRecovery(fireID)
    }, 250)
    s.recoveryTimers.set(fireID, timer)
  }

  function renewFireLease(fireID: string, ownerID: string): boolean {
    const now = Date.now()
    const lease = Database.use((db) => currentControlLeaseInTransaction(db, "event_fire", fireID))
    if (!lease || lease.owner_occurrence_id !== ownerID || lease.expires_at <= now) return false
    renewControlLease({ target: "event_fire", targetID: fireID, leaseID: lease.id, ownerOccurrenceID: ownerID, now, expiresAt: now + FIRE_LEASE_MS })
    return true
  }

  function createEventFireLeaseFence(
    fireID: string,
    ownerID: string,
    renewLease: (fireID: string, ownerID: string) => boolean = renewFireLease,
  ) {
    const controller = new AbortController()
    let lost = false
    const lose = (cause: unknown) => {
      if (lost) return
      lost = true
      const reason = cause instanceof Error ? cause : new Error(String(cause))
      controller.abort(reason)
      log.warn("event fire lease fence lost", { fireID, ownerID, error: reason.message })
    }
    return {
      signal: controller.signal,
      get lost() {
        return lost
      },
      renewOrAbort(): boolean {
        try {
          if (renewLease(fireID, ownerID)) return true
          lose(new Error(`Event fire ${fireID} lease owner changed`))
        } catch (error) {
          lose(error)
        }
        return false
      },
    }
  }

  async function executeWake(input: {
    fire: EventJobFire
    job: EventJob
    ownerID: string
    signal: AbortSignal
  }): Promise<{ sessionID: string; messageID: string }> {
    throwIfAborted(input.signal)
    if (input.fire.creates_session) {
      const existing = Database.use((db) =>
        db
          .select({ id: SessionTable.id })
          .from(SessionTable)
          .where(eq(SessionTable.id, input.fire.target_session_id))
          .get(),
      )
      if (!existing) {
        await Session.createNext({
          id: input.fire.target_session_id,
          kind: "assistant",
          directory: Instance.directory,
          title: `Scheduled: ${input.job.prompt.slice(0, 60)}`,
        })
      }
    }
    throwIfAborted(input.signal)
    const messageID = deterministicEventWakeID("msg", input.fire.id)
    const textPartID = deterministicEventWakeID("prt", input.fire.id)
    await beforeSessionWakeForTest?.({ fire: input.fire, ownerID: input.ownerID, signal: input.signal })
    throwIfAborted(input.signal)
    const session = await Session.get(input.fire.target_session_id)
    const receipt = await admitEventSessionWake(session, () =>
      SessionWake.wakeWithReceipt({
        sessionID: input.fire.target_session_id,
        messageID,
        textPartID,
        signal: input.signal,
        prompt: input.job.prompt,
        author: "orchestrator",
        agent: input.job.agent === "default" ? undefined : input.job.agent,
        reason: {
          source: "scheduler.event",
          jobID: input.job.id,
          jobName: input.job.name,
          fireID: input.fire.id,
          eventType: input.fire.event_type,
          oneShot: input.job.one_shot,
        },
        commitBundle: (message, parts) => {
          if (message.id !== messageID || !parts.some((part) => part.id === textPartID)) {
            throw new Error(`Event fire ${input.fire.id} wake materialized identities outside its durable authority`)
          }
          fenceEventWakeCommit({
            fireID: input.fire.id,
            ownerID: input.ownerID,
            sessionID: message.sessionID,
          })
        },
      }),
    )
    const sessionID = receipt.sessionID
    const persistedMessageID = findWakeMessageID(input.fire)
    if (persistedMessageID !== messageID) {
      throw new Error(`Event fire ${input.fire.id} wake returned outside its deterministic Message identity`)
    }
    return { sessionID, messageID: persistedMessageID }
  }

  function fenceEventWakeCommit(input: { fireID: string; ownerID: string; sessionID: string }): void {
    const committedAt = Date.now()
    const authority = Database.use((db) => {
      const row = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, input.fireID)).get()
      return row ? projectEventFireInTransaction(db, row, committedAt) : undefined
    })
    if (
      authority?.status !== "running" ||
      authority.owner_id !== input.ownerID ||
      authority.lease_until <= committedAt ||
      authority.target_session_id !== input.sessionID
    ) {
      throw new Error(`Event fire ${input.fireID} lost its lease before wake Message commit`)
    }
  }

  function deterministicEventWakeID(prefix: "msg" | "prt", fireID: string): string {
    const digest = createHash("sha256").update(fireID).digest("hex")
    return `${prefix}_event_${digest.slice(0, 32)}`
  }

  function findWakeMessageID(fire: Pick<EventJobFire, "id" | "target_session_id">): string | undefined {
    const rows = Database.use((db) =>
      db
        .select({ id: MessageTable.id })
        .from(MessageTable)
        .where(
          and(
            eq(MessageTable.session_id, fire.target_session_id),
            sql`json_extract(${MessageTable.data}, ${SessionWake.reasonJSONPath("source")}) = 'scheduler.event'`,
            sql`json_extract(${MessageTable.data}, ${SessionWake.reasonJSONPath("fireID")}) = ${fire.id}`,
          ),
        )
        .orderBy(MessageTable.time_created, MessageTable.id)
        .limit(2)
        .all(),
    )
    if (rows.length > 1) throw new Error(`Event fire ${fire.id} has ${rows.length} persisted wake Messages`)
    return rows[0]?.id
  }

  function settleSuccess(
    fire: EventJobFire,
    job: EventJob | undefined,
    ownerID: string,
    sessionID: string,
    messageID: string,
  ): void {
    const now = Date.now()
    Database.immediateTransaction((db) => {
      const terminal = db.select().from(EventJobFireReceiptTable)
        .where(and(eq(EventJobFireReceiptTable.fire_id, fire.id), sql`${EventJobFireReceiptTable.outcome} <> 'retry_wait'`)).get()
      if (terminal) {
        if (terminal.outcome !== "succeeded" || terminal.message_id !== messageID) throw new Error(`Event fire ${fire.id} conflicts with its immutable terminal receipt`)
        return
      }
      const lease = currentControlLeaseInTransaction(db, "event_fire", fire.id)
      if (!lease || lease.owner_occurrence_id !== ownerID || lease.expires_at <= now || fire.target_session_id !== sessionID) throw new Error(`Event fire ${fire.id} owner is no longer authoritative at success`)
      db.insert(EventJobFireReceiptTable).values({ id: Identifier.ascending("call"), fire_id: fire.id, outcome: "succeeded", disposition: null, message_id: messageID, retry_at: null, error: null, time_created: now }).run()
      releaseControlLeaseInTransaction(db, { target: "event_fire", targetID: fire.id, leaseID: lease.id, ownerOccurrenceID: ownerID, now })
    })
    enqueueNextFireForJob(fire.event_job_id)
    log.info("event job fire settled", {
      jobId: fire.event_job_id,
      fireID: fire.id,
      event: fire.event_type,
      sessionID,
      messageID,
      oneShot: job?.one_shot ?? false,
    })
  }

  function settleDisposition(
    fire: EventJobFire,
    ownerID: string,
    disposition: "cooldown" | "job_disabled",
    error: string,
  ): void {
    const now = Date.now()
    const settled = Database.immediateTransaction((db) => {
      const terminal = db.select().from(EventJobFireReceiptTable)
        .where(and(eq(EventJobFireReceiptTable.fire_id, fire.id), sql`${EventJobFireReceiptTable.outcome} <> 'retry_wait'`)).get()
      if (terminal) {
        if (terminal.outcome !== "disposition" || terminal.disposition !== disposition || terminal.error !== error) throw new Error(`Event fire ${fire.id} conflicts with its immutable terminal receipt`)
        return true
      }
      const lease = currentControlLeaseInTransaction(db, "event_fire", fire.id)
      if (!lease || lease.owner_occurrence_id !== ownerID || lease.expires_at <= now) return false
      db.insert(EventJobFireReceiptTable).values({ id: Identifier.ascending("call"), fire_id: fire.id, outcome: "disposition", disposition, message_id: null, retry_at: null, error, time_created: now }).run()
      releaseControlLeaseInTransaction(db, { target: "event_fire", targetID: fire.id, leaseID: lease.id, ownerOccurrenceID: ownerID, now })
      return true
    })
    if (settled) enqueueNextFireForJob(fire.event_job_id)
  }

  function deferFire(fire: EventJobFire, ownerID: string, error: unknown): void {
    log.info("event fire deferred to its current owner", { fireID: fire.id, ownerID, error: errorMessage(error) })
  }

  function scheduleRetry(fire: EventJobFire, job: EventJob | undefined, ownerID: string, error: unknown): void {
    const now = Date.now()
    const message = errorMessage(error)
    const retryAt = now + Math.min(FIRE_RETRY_MAX_MS, FIRE_RETRY_BASE_MS * 2 ** Math.min(16, fire.attempt - 1))
    const settled = Database.immediateTransaction((db) => {
      const lease = currentControlLeaseInTransaction(db, "event_fire", fire.id)
      if (!lease || lease.owner_occurrence_id !== ownerID || lease.expires_at <= now) return false
      db.insert(EventJobFireReceiptTable).values({ id: Identifier.ascending("call"), fire_id: fire.id, outcome: "retry_wait", disposition: null, message_id: null, retry_at: retryAt, error: message, time_created: now }).run()
      // The receipt owns the retry time. Holding the lease past it would make
      // the lease duration the retry period instead.
      releaseControlLeaseInTransaction(db, { target: "event_fire", targetID: fire.id, leaseID: lease.id, ownerOccurrenceID: ownerID, now })
      return true
    })
    if (settled) scheduleLeaseRecovery(fire.id)
  }

  function ready(job: EventJob, now: number) {
    if (!job.last_run) return true
    return now - job.last_run >= job.cooldown_ms
  }

  function ok(event: EventEnvelope, match: Match) {
    for (const [key, value] of Object.entries(match)) {
      const got = pick({ type: event.type, properties: event.properties }, key)
      if (got !== value) return false
    }
    return true
  }

  function pick(input: unknown, key: string): unknown {
    const parts = key.split(".").filter(Boolean)
    let current: unknown = input
    for (const part of parts) {
      if (!current || typeof current !== "object") return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  function objectRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
  }

  function throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return
    throw signal.reason instanceof Error ? signal.reason : new Error("Event fire execution aborted")
  }

  function errorMessage(error: unknown): string {
    if (!(error instanceof Error)) return String(error)
    const prefix = `${error.name}: `
    return error.message.startsWith(prefix) ? error.message : `${prefix}${error.message}`
  }

  export const TestHooks = {
    installBeforeProcessRollbackRecovery(hook: () => void | Promise<void>): Disposable {
      if (beforeProcessRollbackRecoveryForTest) {
        throw new Error("Event fire rollback recovery test hook is already installed")
      }
      beforeProcessRollbackRecoveryForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeProcessRollbackRecoveryForTest === hook) beforeProcessRollbackRecoveryForTest = undefined
        },
      }
    },
    acceptEnvelope(event: EventEnvelope): Promise<void> {
      return accept(event)
    },
    installWakeExecutor(executor: EventWakeExecutor): Disposable {
      if (wakeExecutorForTest) throw new Error("EventService test wake executor is already installed")
      wakeExecutorForTest = executor
      return {
        [Symbol.dispose]() {
          if (wakeExecutorForTest === executor) wakeExecutorForTest = undefined
        },
      }
    },
    installFireAcceptedHook(hook: EventFireAcceptedHook): Disposable {
      if (fireAcceptedHookForTest) throw new Error("EventService fire-accepted test hook is already installed")
      fireAcceptedHookForTest = hook
      return {
        [Symbol.dispose]() {
          if (fireAcceptedHookForTest === hook) fireAcceptedHookForTest = undefined
        },
      }
    },
    installBeforeSessionWake(hook: BeforeSessionWakeHook): Disposable {
      if (beforeSessionWakeForTest) throw new Error("EventService before-session-wake test hook is already installed")
      beforeSessionWakeForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeSessionWakeForTest === hook) beforeSessionWakeForTest = undefined
        },
      }
    },
    installAfterEventFireClaim(hook: AfterEventFireClaimHook): Disposable {
      if (afterEventFireClaimForTest) throw new Error("EventService after-fire-claim test hook is already installed")
      afterEventFireClaimForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterEventFireClaimForTest === hook) afterEventFireClaimForTest = undefined
        },
      }
    },
    failNextCreateFires(count = 1): Disposable {
      const previous = createFireFailuresForTest
      createFireFailuresForTest = count
      return {
        [Symbol.dispose]() {
          createFireFailuresForTest = previous
        },
      }
    },
    createLeaseFence: createEventFireLeaseFence,
    claimFire,
    recoverProjectFires,
    scheduleLeaseRecovery,
    recoveryTimerActive(fireID: string): boolean {
      return state().recoveryTimers.has(fireID)
    },
    messageID: (fireID: string) => deterministicEventWakeID("msg", fireID),
    async waitForIdle(): Promise<void> {
      while (state().recoveryOperations.size > 0) {
        await Promise.allSettled([...state().recoveryOperations])
      }
      while (state().running.size > 0) await Promise.allSettled([...state().running.values()])
    },
    fires(projectID: string): EventJobFire[] {
      return Database.use((db) =>
        db
          .select()
          .from(EventJobFireTable)
          .orderBy(EventJobFireTable.time_created, EventJobFireTable.id)
          .all().map((row) => projectEventFireInTransaction(db, row, Date.now())).filter((row) => row.project_id === projectID),
      )
    },
  }
}
