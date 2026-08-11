import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, and, eq, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Session } from "@/session"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Wildcard } from "@/util/wildcard"
import { Identifier } from "@/id/id"
import { createHash, randomUUID } from "node:crypto"
import { EventJobFireTable, EventJobTable, type EventJobFireCausationEntry } from "./event.sql"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
} from "@/runtime/execution-settlement"
import { Project } from "@/project/project"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"

type Match = Record<string, string | number | boolean>
type EventEnvelope = Bus.Envelope
type EventJob = typeof EventJobTable.$inferSelect
type EventJobFire = typeof EventJobFireTable.$inferSelect

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
type BeforeSessionWakeHook = (input: { fire: EventJobFire; ownerID: string; signal: AbortSignal }) => void | Promise<void>
type AfterEventFireClaimHook = (input: { fire: EventJobFire; ownerID: string; signal: AbortSignal }) => void | Promise<void>

export namespace EventService {
  const log = Log.create({ service: "event-service" })
  const FIRE_LEASE_MS = 30_000
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
      { durableID: "scheduler.event-service" },
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
    const projectIDs = new Set(Database.use((db) =>
      db
        .selectDistinct({ projectID: EventJobFireTable.project_id })
        .from(EventJobFireTable)
        .where(sql`${EventJobFireTable.status} IN ('pending', 'running', 'retry_wait')`)
        .all()
        .map((row) => row.projectID),
    ))
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
      db.select().from(EventJobTable).where(eq(EventJobTable.project_id, projectID)).all(),
    )
    return rows.map((j) => ({
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
    const row = Database.use((db) =>
      db
        .delete(EventJobTable)
        .where(and(eq(EventJobTable.id, id), eq(EventJobTable.project_id, projectID)))
        .returning({ id: EventJobTable.id })
        .get(),
    )
    return !!row
  }

  async function accept(event: EventEnvelope): Promise<void> {
    if (event.type === Bus.InstanceDisposed.type) return
    const s = state()
    if (s.lifecycle.signal.aborted) return
    const now = Date.now()
    const jobs = Database.use((db) =>
      db
        .select()
        .from(EventJobTable)
        .where(and(eq(EventJobTable.project_id, Instance.project.id), eq(EventJobTable.enabled, true)))
        .all(),
    )
    const matches = jobs.filter((job) => Wildcard.match(event.type, job.event_type) && ok(event, job.match_json ?? {}))
    if (matches.length === 0) return
    processSettlementGate?.projectIDs.add(Instance.project.id)

    const causation = resolveCausation(event)
    const fires = createFires({ jobs: matches, eventType: event.type, occurrenceID: event.occurrenceID, causation, now })
    for (const fire of fires) {
      await fireAcceptedHookForTest?.(fire)
      if (fire.status === "pending") enqueueFire(fire.id, fire.event_job_id)
    }
  }

  function createFires(input: {
    jobs: EventJob[]
    eventType: string
    occurrenceID: string
    causation: FireCausation
    now: number
  }): EventJobFire[] {
    if (createFireFailuresForTest > 0) {
      createFireFailuresForTest -= 1
      throw new Error("injected Event fire durable insert failure")
    }
    return Database.immediateTransaction((db) =>
      input.jobs.map((job) => {
        const fireID = Identifier.ascending("call")
        const cycle = input.causation.ancestry.some((entry) => entry.jobID === job.id)
      const inserted = db
        .insert(EventJobFireTable)
        .values({
          id: fireID,
          event_job_id: job.id,
          project_id: job.project_id,
          event_occurrence_id: input.occurrenceID,
          event_type: input.eventType,
          causation_fire_id: input.causation.parentFireID,
          causation_ancestry: input.causation.ancestry,
          status: cycle ? "disposition" : "pending",
          disposition: cycle ? "causal_cycle" : null,
          target_session_id: job.session_id ?? Identifier.ascending("session"),
          creates_session: job.session_id === null,
          lease_until: 0,
          attempt: 0,
          error: cycle ? `Event Job ${job.id} already occurs in fire causation ancestry` : null,
          time_completed: cycle ? input.now : null,
          time_created: input.now,
          time_updated: input.now,
        })
        .onConflictDoNothing({
          target: [EventJobFireTable.event_job_id, EventJobFireTable.event_occurrence_id],
        })
        .returning()
        .get()
      if (inserted) return inserted
      const existing = db
        .select()
        .from(EventJobFireTable)
        .where(
          and(
            eq(EventJobFireTable.event_job_id, job.id),
            eq(EventJobFireTable.event_occurrence_id, input.occurrenceID),
          ),
        )
        .get()
      if (!existing) {
        throw new Error(`Event occurrence ${input.occurrenceID} conflict has no durable fire for job ${job.id}`)
      }
      return existing
      }),
    )
  }

  function resolveCausation(event: EventEnvelope): FireCausation {
    if (event.causation?.source === "scheduler.event") {
      const parent = requireParentFire(event.causation.occurrenceID)
      const current = event.causation.ancestry.at(-1)
      if (current?.occurrenceID !== parent.id || current.sourceID !== parent.event_job_id) {
        throw new Error(`Bus causation for Event fire ${parent.id} conflicts with its durable job authority`)
      }
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
    const parent = Database.use((db) =>
      db
        .select()
        .from(EventJobFireTable)
        .where(
          and(
            eq(EventJobFireTable.project_id, Instance.project.id),
            eq(EventJobFireTable.target_session_id, sessionID),
            eq(EventJobFireTable.creates_session, true),
          ),
        )
        .orderBy(sql`${EventJobFireTable.time_created} DESC`, sql`${EventJobFireTable.id} DESC`)
        .limit(1)
        .get(),
    )
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
    const parent = Database.use((db) =>
      db
        .select()
        .from(EventJobFireTable)
        .where(and(eq(EventJobFireTable.id, fireID), eq(EventJobFireTable.project_id, Instance.project.id)))
        .get(),
    )
    if (!parent) throw new Error(`Event wake ${fireID} has no durable Event Job fire authority`)
    return parent
  }

  function causationFromParent(parent: EventJobFire): FireCausation {
    return {
      parentFireID: parent.id,
      ancestry: [...parent.causation_ancestry, { fireID: parent.id, jobID: parent.event_job_id }],
    }
  }

  function recoverProjectFires(): void {
    const rows = Database.use((db) =>
      db
        .select({ id: EventJobFireTable.id, jobID: EventJobFireTable.event_job_id })
        .from(EventJobFireTable)
        .where(
          sql`${EventJobFireTable.project_id} = ${Instance.project.id}
            AND ${EventJobFireTable.status} IN ('pending', 'running', 'retry_wait')`,
        )
        .all(),
    )
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

  async function processFire(fireID: string, runtimeSignal: AbortSignal): Promise<void> {
    const s = state()
    const claimed = claimFire(fireID, s.ownerID)
    if (!claimed) {
      scheduleLeaseRecovery(fireID)
      return
    }
    const leaseFence = createEventFireLeaseFence(claimed.id, s.ownerID)
    const signal = AbortSignal.any([s.lifecycle.signal, runtimeSignal, leaseFence.signal])
    const renewTimer = setInterval(() => leaseFence.renewOrAbort(), FIRE_LEASE_RENEW_MS)
    renewTimer.unref()
    let job: EventJob | undefined
    try {
      await afterEventFireClaimForTest?.({ fire: claimed, ownerID: s.ownerID, signal })
      throwIfAborted(signal)
      const existingMessageID = findWakeMessageID(claimed)
      job = Database.use((db) =>
        db
          .select()
          .from(EventJobTable)
          .where(and(eq(EventJobTable.id, claimed.event_job_id), eq(EventJobTable.project_id, claimed.project_id)))
          .get(),
      )
      if (existingMessageID) {
        const session = await Session.get(claimed.target_session_id)
        throwIfAborted(signal)
        SessionWake.resumePersistedWake({
          sessionID: claimed.target_session_id,
          messageID: existingMessageID,
          directory: session.directory,
        })
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
      const causation = causationFromParent(claimed)
      const result = await Bus.withCausation(
        {
          source: "scheduler.event",
          occurrenceID: claimed.id,
          ancestry: causation.ancestry.map((entry) => ({
            occurrenceID: entry.fireID,
            sourceID: entry.jobID,
          })),
        },
        () => (wakeExecutorForTest ?? executeWake)({ fire: claimed, job: activeJob, ownerID: s.ownerID, signal }),
      )
      throwIfAborted(signal)
      settleSuccess(claimed, activeJob, s.ownerID, result.sessionID, result.messageID)
    } catch (error) {
      try {
        const reconciledMessageID = findWakeMessageID(claimed)
        if (reconciledMessageID && !leaseFence.lost) {
          const session = await Session.get(claimed.target_session_id)
          throwIfAborted(leaseFence.signal)
          SessionWake.resumePersistedWake({
            sessionID: claimed.target_session_id,
            messageID: reconciledMessageID,
            directory: session.directory,
          })
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
      // Terminal rows make this a no-op; retry_wait and deferred/lost claims
      // retain their existing lease as the next attempt's durable schedule.
      scheduleLeaseRecovery(claimed.id)
    }
  }

  function claimFire(fireID: string, ownerID: string): EventJobFire | undefined {
    const now = Date.now()
    return Database.immediateTransaction((db) => {
      const candidate = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get()
      if (!candidate) return undefined
      const head = db
        .select({ id: EventJobFireTable.id, leaseUntil: EventJobFireTable.lease_until })
        .from(EventJobFireTable)
        .where(
          sql`${EventJobFireTable.event_job_id} = ${candidate.event_job_id}
            AND ${EventJobFireTable.status} IN ('pending', 'running', 'retry_wait')`,
        )
        .orderBy(EventJobFireTable.time_created, EventJobFireTable.id)
        .limit(1)
        .get()
      if (!head || head.id !== fireID) {
        if (head && (candidate.status === "pending" || candidate.status === "retry_wait")) {
          const waitUntil = Math.max(head.leaseUntil, now + 50)
          db.update(EventJobFireTable)
            .set({ lease_until: sql`max(${EventJobFireTable.lease_until}, ${waitUntil})`, time_updated: now })
            .where(eq(EventJobFireTable.id, fireID))
            .run()
        }
        return undefined
      }
      return db
        .update(EventJobFireTable)
        .set({
          status: "running",
          owner_id: ownerID,
          owner_process_id: process.pid,
          lease_until: now + FIRE_LEASE_MS,
          attempt: sql`${EventJobFireTable.attempt} + 1`,
          time_started: now,
          time_updated: now,
        })
        .where(
          sql`${EventJobFireTable.id} = ${fireID}
            AND (
              (${EventJobFireTable.status} IN ('pending', 'retry_wait') AND ${EventJobFireTable.lease_until} <= ${now})
              OR (${EventJobFireTable.status} = 'running' AND ${EventJobFireTable.lease_until} <= ${now})
            )`,
        )
        .returning()
        .get()
    })
  }

  function enqueueNextFireForJob(jobID: string): void {
    const next = Database.immediateTransaction((db) => {
      const row = db
        .select({ id: EventJobFireTable.id, status: EventJobFireTable.status })
        .from(EventJobFireTable)
        .where(
          sql`${EventJobFireTable.event_job_id} = ${jobID}
            AND ${EventJobFireTable.status} IN ('pending', 'running', 'retry_wait')`,
        )
        .orderBy(EventJobFireTable.time_created, EventJobFireTable.id)
        .limit(1)
        .get()
      if (row?.status === "pending") {
        db.update(EventJobFireTable)
          .set({ lease_until: 0, time_updated: Date.now() })
          .where(eq(EventJobFireTable.id, row.id))
          .run()
      }
      return row
    })
    if (next) enqueueFire(next.id, jobID)
  }

  function scheduleLeaseRecovery(fireID: string): void {
    const s = state()
    if (s.lifecycle.signal.aborted || s.recoveryTimers.has(fireID)) return
    let row: { jobID: string; status: EventJobFire["status"]; lease: number } | undefined
    try {
      row = Database.use((db) =>
        db
          .select({
            jobID: EventJobFireTable.event_job_id,
            status: EventJobFireTable.status,
            lease: EventJobFireTable.lease_until,
          })
          .from(EventJobFireTable)
          .where(eq(EventJobFireTable.id, fireID))
          .get(),
      )
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
      Math.max(1, row.lease - Date.now() + 1),
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
    const renewed = Database.use((db) =>
      db
        .update(EventJobFireTable)
        .set({ lease_until: now + FIRE_LEASE_MS, time_updated: now })
        .where(
          and(
            eq(EventJobFireTable.id, fireID),
            eq(EventJobFireTable.status, "running"),
            eq(EventJobFireTable.owner_id, ownerID),
            sql`${EventJobFireTable.lease_until} > ${now}`,
          ),
        )
        .returning({ id: EventJobFireTable.id })
        .get(),
    )
    return !!renewed
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
    const sessionID = await SessionWake.wake({
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
    })
    const persistedMessageID = findWakeMessageID(input.fire)
    if (persistedMessageID !== messageID) {
      throw new Error(`Event fire ${input.fire.id} wake returned outside its deterministic Message identity`)
    }
    return { sessionID, messageID: persistedMessageID }
  }

  function fenceEventWakeCommit(input: { fireID: string; ownerID: string; sessionID: string }): void {
    const committedAt = Date.now()
    const authority = Database.use((db) =>
      db
        .select({
          status: EventJobFireTable.status,
          ownerID: EventJobFireTable.owner_id,
          leaseUntil: EventJobFireTable.lease_until,
          sessionID: EventJobFireTable.target_session_id,
        })
        .from(EventJobFireTable)
        .where(eq(EventJobFireTable.id, input.fireID))
        .get(),
    )
    if (
      authority?.status !== "running" ||
      authority.ownerID !== input.ownerID ||
      authority.leaseUntil <= committedAt ||
      authority.sessionID !== input.sessionID
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
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source') = 'scheduler.event'`,
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.fireID') = ${fire.id}`,
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
      const settled = db
        .update(EventJobFireTable)
        .set({
          status: "succeeded",
          target_session_id: sessionID,
          message_id: messageID,
          owner_id: null,
          owner_process_id: null,
          lease_until: 0,
          error: null,
          time_completed: now,
          time_updated: now,
        })
        .where(
          and(
            eq(EventJobFireTable.id, fire.id),
            eq(EventJobFireTable.status, "running"),
            eq(EventJobFireTable.owner_id, ownerID),
            sql`${EventJobFireTable.lease_until} > ${now}`,
          ),
        )
        .returning({ id: EventJobFireTable.id })
        .get()
      if (!settled) throw new Error(`Event fire ${fire.id} owner is no longer authoritative at success`)
      if (job) {
        const update = {
          last_run: now,
          last_event: fire.event_type,
          failure_count: 0,
          last_error: null,
          ...(job.one_shot ? { enabled: false } : {}),
        }
        db.update(EventJobTable)
          .set(update)
          .where(and(eq(EventJobTable.id, job.id), eq(EventJobTable.project_id, job.project_id)))
          .run()
      }
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
    const settled = Database.use((db) =>
      db
        .update(EventJobFireTable)
        .set({
          status: "disposition",
          disposition,
          owner_id: null,
          owner_process_id: null,
          lease_until: 0,
          error,
          time_completed: now,
          time_updated: now,
        })
        .where(
          and(
            eq(EventJobFireTable.id, fire.id),
            eq(EventJobFireTable.status, "running"),
            eq(EventJobFireTable.owner_id, ownerID),
            sql`${EventJobFireTable.lease_until} > ${now}`,
          ),
        )
        .returning({ id: EventJobFireTable.id })
        .get(),
    )
    if (settled) enqueueNextFireForJob(fire.event_job_id)
  }

  function deferFire(fire: EventJobFire, ownerID: string, error: unknown): void {
    const now = Date.now()
    Database.use((db) =>
      db
        .update(EventJobFireTable)
        .set({
          status: "pending",
          owner_id: null,
          owner_process_id: null,
          lease_until: 0,
          error: errorMessage(error),
          time_updated: now,
        })
        .where(
          and(
            eq(EventJobFireTable.id, fire.id),
            eq(EventJobFireTable.status, "running"),
            eq(EventJobFireTable.owner_id, ownerID),
            sql`${EventJobFireTable.lease_until} > ${now}`,
          ),
        )
        .run(),
    )
  }

  function scheduleRetry(fire: EventJobFire, job: EventJob | undefined, ownerID: string, error: unknown): void {
    const now = Date.now()
    const message = errorMessage(error)
    const retryAt = now + Math.min(FIRE_RETRY_MAX_MS, FIRE_RETRY_BASE_MS * 2 ** Math.min(16, fire.attempt - 1))
    const settled = Database.immediateTransaction((db) => {
      const result = db
        .update(EventJobFireTable)
        .set({
          status: "retry_wait",
          owner_id: null,
          owner_process_id: null,
          lease_until: retryAt,
          error: message,
          time_completed: null,
          time_updated: now,
        })
        .where(
          and(
            eq(EventJobFireTable.id, fire.id),
            eq(EventJobFireTable.status, "running"),
            eq(EventJobFireTable.owner_id, ownerID),
            sql`${EventJobFireTable.lease_until} > ${now}`,
          ),
        )
        .returning({ id: EventJobFireTable.id })
        .get()
      if (!result) return false
      if (job) {
        db.update(EventJobTable)
          .set({ failure_count: sql`${EventJobTable.failure_count} + 1`, last_error: message })
          .where(and(eq(EventJobTable.id, job.id), eq(EventJobTable.project_id, job.project_id)))
          .run()
      }
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
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
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
          .where(eq(EventJobFireTable.project_id, projectID))
          .orderBy(EventJobFireTable.time_created, EventJobFireTable.id)
          .all(),
      )
    },
  }
}
