import z from "zod"
import { and, asc, eq } from "@/storage/db"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { SessionControlRecordTable, type SessionControlKind, type SessionControlStatus } from "./session.sql"
import { isDeepStrictEqual } from "node:util"

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
    time: z.object({
      created: z.number(),
      updated: z.number(),
      consumed: z.number().optional(),
    }),
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

  function fromRow(row: typeof SessionControlRecordTable.$inferSelect): Record {
    return {
      id: row.id,
      sessionID: row.session_id,
      kind: row.kind as SessionControlKind,
      status: row.status as SessionControlStatus,
      owner: row.owner ?? undefined,
      payload: PersistedPayload.parse(row.payload),
      time: {
        created: row.time_created,
        updated: row.time_updated,
        consumed: row.time_consumed ?? undefined,
      },
    }
  }

  export function createInTransaction(db: Database.TxOrDb, rawInput: CreateInput): Record {
    const input = CreateInput.parse(rawInput)
    const now = Date.now()
    const status = input.status ?? "pending"
    const row = {
      id: input.id ?? Identifier.ascending("session_control"),
      session_id: input.sessionID,
      kind: input.kind,
      status,
      owner: input.owner,
      payload: input.payload,
      time_created: now,
      time_updated: now,
      time_consumed: status === "consumed" ? now : undefined,
    } satisfies typeof SessionControlRecordTable.$inferInsert
    db.insert(SessionControlRecordTable).values(row).onConflictDoNothing().run()
    const persisted = db.select().from(SessionControlRecordTable).where(eq(SessionControlRecordTable.id, row.id)).get()
    if (!persisted) throw new Error(`Session control ${row.id} was not persisted`)
    if (
      persisted.session_id !== input.sessionID ||
      persisted.kind !== input.kind ||
      persisted.status !== status ||
      (persisted.owner ?? undefined) !== input.owner ||
      !isDeepStrictEqual(persisted.payload, input.payload)
    ) {
      throw new Error(`Session control identity ${row.id} belongs to different persisted semantics`)
    }
    return fromRow(persisted)
  }

  export function create(input: CreateInput): Record {
    const record = Database.use((db) => createInTransaction(db, input))
    if (record.status === "pending" && record.kind !== "mission_process_recovery") {
      for (const wake of [...(wakeWaiters.get(record.sessionID) ?? [])]) wake()
    }
    return record
  }

  export function subscribeWake(sessionID: string, wake: () => void): () => void {
    let waiters = wakeWaiters.get(sessionID)
    if (!waiters) {
      waiters = new Set()
      wakeWaiters.set(sessionID, waiters)
    }
    waiters.add(wake)
    return () => {
      const current = wakeWaiters.get(sessionID)
      current?.delete(wake)
      if (current?.size === 0) wakeWaiters.delete(sessionID)
    }
  }

  export function pending(sessionID: string): Record[] {
    return Database.use((db) =>
      db
        .select()
        .from(SessionControlRecordTable)
        .where(
          and(eq(SessionControlRecordTable.session_id, sessionID), eq(SessionControlRecordTable.status, "pending")),
        )
        .orderBy(asc(SessionControlRecordTable.time_created), asc(SessionControlRecordTable.id))
        .all()
        .map(fromRow),
    )
  }

  export function updatePendingPayload(input: {
    id: string
    sessionID: string
    payload: z.input<typeof PersistedPayload>
  }): Record | undefined {
    const now = Date.now()
    const payload = PersistedPayload.parse(input.payload)
    return Database.transaction((db) => {
      const updated = db
        .update(SessionControlRecordTable)
        .set({ payload, time_updated: now })
        .where(
          and(
            eq(SessionControlRecordTable.id, input.id),
            eq(SessionControlRecordTable.session_id, input.sessionID),
            eq(SessionControlRecordTable.status, "pending"),
          ),
        )
        .returning()
        .get()
      return updated ? fromRow(updated) : undefined
    })
  }

  export function consume(input: { id: string; sessionID: string }): Record | undefined {
    const now = Date.now()
    return Database.transaction((db) => {
      const current = db
        .select()
        .from(SessionControlRecordTable)
        .where(
          and(
            eq(SessionControlRecordTable.id, input.id),
            eq(SessionControlRecordTable.session_id, input.sessionID),
            eq(SessionControlRecordTable.status, "pending"),
          ),
        )
        .get()
      if (!current) return undefined
      db.update(SessionControlRecordTable)
        .set({ status: "consumed", time_updated: now, time_consumed: now })
        .where(eq(SessionControlRecordTable.id, input.id))
        .run()
      return fromRow({ ...current, status: "consumed", time_updated: now, time_consumed: now })
    })
  }

  export function fail(input: {
    id: string
    sessionID: string
    error: string
    payload?: z.input<typeof PersistedPayload>
  }): Record | undefined {
    const now = Date.now()
    const replacementPayload = input.payload ? PersistedPayload.parse(input.payload) : undefined
    return Database.transaction((db) => {
      const current = db
        .select()
        .from(SessionControlRecordTable)
        .where(
          and(
            eq(SessionControlRecordTable.id, input.id),
            eq(SessionControlRecordTable.session_id, input.sessionID),
            eq(SessionControlRecordTable.status, "pending"),
          ),
        )
        .get()
      if (!current) return undefined
      const payload = { ...(replacementPayload ?? current.payload), error: input.error }
      db.update(SessionControlRecordTable)
        .set({ status: "failed", payload, time_updated: now })
        .where(
          and(
            eq(SessionControlRecordTable.id, input.id),
            eq(SessionControlRecordTable.session_id, input.sessionID),
            eq(SessionControlRecordTable.status, "pending"),
          ),
        )
        .run()
      return fromRow({ ...current, status: "failed", payload, time_updated: now })
    })
  }
}
