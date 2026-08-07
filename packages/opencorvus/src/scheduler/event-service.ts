import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, and, eq, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { Wildcard } from "@/util/wildcard"
import { Identifier } from "@/id/id"
import { EventJobTable } from "./event.sql"

type Match = Record<string, string | number | boolean>

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

export namespace EventService {
  const log = Log.create({ service: "event-service" })

  const state = createInstanceState(
    () => ({
      unsub: undefined as undefined | (() => void),
      running: new Map<string, Promise<void>>(),
    }),
    async (s) => {
      s.unsub?.()
      s.running.clear()
      s.unsub = undefined
    },
    "event-service",
  )

  export function init() {
    const s = state()
    if (s.unsub) return
    s.unsub = Bus.subscribeAll(async (event) => {
      await on(event)
    })
    log.info("event service initialized")
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

  async function on(event: { type: string; properties: unknown }) {
    if (event.type === "server.instance.disposed") return

    const now = Date.now()
    const jobs = Database.use((db) =>
      db
        .select()
        .from(EventJobTable)
        .where(and(eq(EventJobTable.project_id, Instance.project.id), eq(EventJobTable.enabled, true)))
        .all(),
    )

    const pending: Promise<void>[] = []
    for (const job of jobs) {
      if (!Wildcard.match(event.type, job.event_type)) continue
      if (!ok(event, job.match_json ?? {})) continue
      if (!ready(job, now)) continue
      pending.push(enqueue(job, event.type))
    }

    await Promise.allSettled(pending)
  }

  function enqueue(job: typeof EventJobTable.$inferSelect, eventType: string): Promise<void> {
    const s = state()
    const previous = s.running.get(job.id) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const latest = Database.use((db) =>
          db
            .select()
            .from(EventJobTable)
            .where(and(eq(EventJobTable.id, job.id), eq(EventJobTable.project_id, job.project_id)))
            .get(),
        )
        const now = Date.now()
        if (!latest?.enabled || !ready(latest, now)) return
        await run(latest, eventType, now).catch((error) => {
          fail(latest, eventType, error)
        })
      })
      .finally(() => {
        if (s.running.get(job.id) === current) s.running.delete(job.id)
      })
    s.running.set(job.id, current)
    return current
  }

  function ready(job: typeof EventJobTable.$inferSelect, now: number) {
    if (!job.last_run) return true
    return now - job.last_run >= job.cooldown_ms
  }

  function ok(event: { type: string; properties: unknown }, match: Match) {
    for (const [k, v] of Object.entries(match)) {
      const got = pick({ type: event.type, properties: event.properties }, k)
      if (got !== v) return false
    }
    return true
  }

  function pick(input: unknown, key: string): unknown {
    const parts = key.split(".").filter(Boolean)
    let cur: unknown = input
    for (const part of parts) {
      if (!cur || typeof cur !== "object") return undefined
      cur = (cur as Record<string, unknown>)[part]
    }
    return cur
  }

  async function run(job: typeof EventJobTable.$inferSelect, type: string, now: number) {
    const fireID = Identifier.ascending("call")
    const sessionID = await SessionWake.wake({
      sessionID: job.session_id ?? undefined,
      prompt: job.prompt,
      author: "orchestrator",
      agent: job.agent === "default" ? undefined : job.agent,
      reason: {
        source: "scheduler.event",
        jobID: job.id,
        jobName: job.name,
        fireID,
        eventType: type,
        oneShot: job.one_shot,
      },
    })

    Database.use((db) =>
      db
        .update(EventJobTable)
        .set({
          last_run: now,
          last_event: type,
          enabled: job.one_shot ? false : true,
          failure_count: 0,
          last_error: null,
        })
        .where(and(eq(EventJobTable.id, job.id), eq(EventJobTable.project_id, job.project_id)))
        .run(),
    )

    log.info("event job triggered session wake", {
      jobId: job.id,
      fireID,
      name: job.name,
      event: type,
      sessionID,
      oneShot: job.one_shot,
    })
  }

  function fail(job: typeof EventJobTable.$inferSelect, type: string, error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    Database.use((db) =>
      db
        .update(EventJobTable)
        .set({
          failure_count: sql`${EventJobTable.failure_count} + 1`,
          last_error: msg,
        })
        .where(and(eq(EventJobTable.id, job.id), eq(EventJobTable.project_id, job.project_id)))
        .run(),
    )
    log.error("event job execution failed", {
      jobId: job.id,
      name: job.name,
      event: type,
      error: msg,
    })
  }
}
