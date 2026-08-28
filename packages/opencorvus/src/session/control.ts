import z from "zod"
import { and, asc, eq, isNull } from "@/storage/db"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import {
  SessionControlEventTable,
  SessionControlRecordTable,
  type SessionControlKind,
  type SessionControlStatus,
} from "./session.sql"
import { isDeepStrictEqual } from "node:util"
import { assertControlLeaseInTransaction, releaseControlLeaseInTransaction } from "@/engine/control-lease"

export namespace SessionControl {
  const wakeWaiters = new Map<string, Set<() => void>>()
  const PersistedPayload = z.record(z.string(), z.json())

  export const Kind = z.enum(["manual_summarize", "compaction_request", "wake_reason", "mission_process_recovery"])
  export type Kind = z.infer<typeof Kind>

  export const Status = z.enum(["pending", "consumed", "failed"])
  export type Status = z.infer<typeof Status>

  export const Record = z.object({
    id: z.string(),
    sessionID: z.string(),
    kind: Kind,
    status: Status,
    owner: z.string().optional(),
    payload: PersistedPayload,
    time: z.object({ created: z.number(), updated: z.number(), consumed: z.number().optional() }),
  })
  export type Record = z.infer<typeof Record>

  export const CreateInput = z.object({
    id: Identifier.schema("session_control").optional(),
    sessionID: Identifier.schema("session"),
    kind: Kind,
    payload: Record.shape.payload,
    owner: z.string().optional(),
    status: Status.optional(),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  function project(db: Database.TxOrDb, row: typeof SessionControlRecordTable.$inferSelect): Record {
    const events = db.select().from(SessionControlEventTable)
      .where(eq(SessionControlEventTable.control_id, row.id))
      .orderBy(asc(SessionControlEventTable.time_created), asc(SessionControlEventTable.id)).all()
    let payload = PersistedPayload.parse(row.payload)
    let status: SessionControlStatus = "pending"
    let updated = row.time_created
    let consumed: number | undefined
    for (const event of events) {
      updated = event.time_created
      if (event.kind === "amended") payload = PersistedPayload.parse(event.payload ?? {})
      if (event.kind === "consumed") {
        status = "consumed"
        consumed = event.time_created
      }
      if (event.kind === "failed") {
        status = "failed"
        payload = { ...payload, ...PersistedPayload.parse(event.payload ?? {}) }
      }
    }
    return { id: row.id, sessionID: row.session_id, kind: row.kind as SessionControlKind, status, owner: row.source ?? undefined, payload, time: { created: row.time_created, updated, consumed } }
  }

  function terminalExists(db: Database.TxOrDb, controlID: string): boolean {
    return db.select({ id: SessionControlEventTable.id }).from(SessionControlEventTable)
      .where(and(eq(SessionControlEventTable.control_id, controlID), isNull(SessionControlEventTable.payload))).get() !== undefined
      || db.select({ id: SessionControlEventTable.id }).from(SessionControlEventTable)
        .where(and(eq(SessionControlEventTable.control_id, controlID), eq(SessionControlEventTable.kind, "failed"))).get() !== undefined
  }

  export function createInTransaction(db: Database.TxOrDb, rawInput: CreateInput): Record {
    const input = CreateInput.parse(rawInput)
    const failedError = input.status === "failed" ? input.payload.error : undefined
    if (input.status === "failed" && typeof failedError !== "string") {
      throw new Error("Failed Session control creation requires an exact error receipt")
    }
    const requestPayload = input.status === "failed"
      ? Object.fromEntries(Object.entries(input.payload).filter(([key]) => key !== "error"))
      : input.payload
    const now = Date.now()
    const id = input.id ?? Identifier.ascending("session_control")
    db.insert(SessionControlRecordTable).values({ id, session_id: input.sessionID, kind: input.kind, source: input.owner, payload: requestPayload, time_created: now }).onConflictDoNothing().run()
    const persisted = db.select().from(SessionControlRecordTable).where(eq(SessionControlRecordTable.id, id)).get()
    if (!persisted) throw new Error(`Session control ${id} was not persisted`)
    if (persisted.session_id !== input.sessionID || persisted.kind !== input.kind || (persisted.source ?? undefined) !== input.owner || !isDeepStrictEqual(persisted.payload, requestPayload)) {
      throw new Error(`Session control identity ${id} belongs to different persisted semantics`)
    }
    if (input.status && input.status !== "pending") {
      db.insert(SessionControlEventTable).values({ id: Identifier.deterministic("session_control", `terminal\0${id}`), control_id: id, kind: input.status, payload: input.status === "failed" ? { error: failedError } : null, time_created: now }).onConflictDoNothing().run()
    }
    return project(db, persisted)
  }

  export function create(input: CreateInput): Record {
    const record = Database.transaction((db) => createInTransaction(db, input))
    if (record.status === "pending" && record.kind !== "mission_process_recovery") for (const wake of [...(wakeWaiters.get(record.sessionID) ?? [])]) wake()
    return record
  }

  export function subscribeWake(sessionID: string, wake: () => void): () => void {
    let waiters = wakeWaiters.get(sessionID)
    if (!waiters) { waiters = new Set(); wakeWaiters.set(sessionID, waiters) }
    waiters.add(wake)
    return () => { const current = wakeWaiters.get(sessionID); current?.delete(wake); if (current?.size === 0) wakeWaiters.delete(sessionID) }
  }

  export function pending(sessionID: string): Record[] {
    return Database.use((db) => db.select().from(SessionControlRecordTable)
      .where(eq(SessionControlRecordTable.session_id, sessionID))
      .orderBy(asc(SessionControlRecordTable.time_created), asc(SessionControlRecordTable.id)).all()
      .map((row) => project(db, row)).filter((row) => row.status === "pending"))
  }

  export function get(id: string): Record | undefined {
    return Database.use((db) => {
      const row = db.select().from(SessionControlRecordTable).where(eq(SessionControlRecordTable.id, id)).get()
      return row ? project(db, row) : undefined
    })
  }

  export function list(sessionID: string): Record[] {
    return Database.use((db) => db.select().from(SessionControlRecordTable)
      .where(eq(SessionControlRecordTable.session_id, sessionID))
      .orderBy(asc(SessionControlRecordTable.time_created), asc(SessionControlRecordTable.id)).all()
      .map((row) => project(db, row)))
  }

  export function updatePendingPayload(input: { id: string; sessionID: string; payload: z.input<typeof PersistedPayload> }): Record | undefined {
    const payload = PersistedPayload.parse(input.payload)
    return Database.transaction((db) => {
      const current = db.select().from(SessionControlRecordTable).where(and(eq(SessionControlRecordTable.id, input.id), eq(SessionControlRecordTable.session_id, input.sessionID))).get()
      if (!current || terminalExists(db, input.id)) return undefined
      db.insert(SessionControlEventTable).values({ id: Identifier.ascending("session_control"), control_id: input.id, kind: "amended", payload, time_created: Date.now() }).run()
      return project(db, current)
    })
  }

  type SettlementLease = { leaseID: string; ownerOccurrenceID: string; now: number }

  export function consume(input: {
    id: string
    sessionID: string
    payload?: z.input<typeof PersistedPayload>
    lease?: SettlementLease
  }): Record | undefined {
    return settle({ ...input, kind: "consumed" })
  }

  export function fail(input: { id: string; sessionID: string; error: string; payload?: z.input<typeof PersistedPayload>; lease?: SettlementLease }): Record | undefined {
    return settle({ ...input, kind: "failed", payload: { ...(input.payload ? PersistedPayload.parse(input.payload) : {}), error: input.error } })
  }

  function settle(input: { id: string; sessionID: string; kind: "consumed" | "failed"; payload?: { [key: string]: unknown }; lease?: SettlementLease }): Record | undefined {
    return Database.immediateTransaction((db) => {
      const current = db.select().from(SessionControlRecordTable).where(and(eq(SessionControlRecordTable.id, input.id), eq(SessionControlRecordTable.session_id, input.sessionID))).get()
      if (!current || terminalExists(db, input.id)) {
        // Somebody else already settled this control. This caller is no longer
        // its executor and must not keep holding the lease while it reports the
        // conflict.
        if (input.lease) releaseControlLeaseInTransaction(db, {
          target: "session_control",
          targetID: input.id,
          leaseID: input.lease.leaseID,
          ownerOccurrenceID: input.lease.ownerOccurrenceID,
          now: input.lease.now,
        })
        return undefined
      }
      if (input.lease) assertControlLeaseInTransaction(db, {
        target: "session_control",
        targetID: input.id,
        leaseID: input.lease.leaseID,
        ownerOccurrenceID: input.lease.ownerOccurrenceID,
        now: input.lease.now,
      })
      const now = Date.now()
      if (input.kind === "consumed" && input.payload !== undefined) {
        db.insert(SessionControlEventTable).values({
          id: Identifier.ascending("session_control"),
          control_id: input.id,
          kind: "amended",
          payload: PersistedPayload.parse(input.payload),
          time_created: now,
        }).run()
      }
      const payload = input.kind === "failed" ? (input.payload ?? {}) : null
      db.insert(SessionControlEventTable).values({ id: Identifier.deterministic("session_control", `terminal\0${input.id}`), control_id: input.id, kind: input.kind, payload, time_created: now }).run()
      // Terminal is terminal: this control never runs again, so its execution
      // owner ends with the event that settled it.
      if (input.lease) releaseControlLeaseInTransaction(db, {
        target: "session_control",
        targetID: input.id,
        leaseID: input.lease.leaseID,
        ownerOccurrenceID: input.lease.ownerOccurrenceID,
        now: input.lease.now,
      })
      return project(db, current)
    })
  }
}
