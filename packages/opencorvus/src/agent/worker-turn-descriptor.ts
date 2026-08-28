import z from "zod"
import { and, desc, eq, sql } from "@/storage/db"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { ProjectedAgentWorkScope } from "./projected-agent-work-scope"
import { materializeProjectedWorkerBinding, type ProjectedWorkerBinding } from "./projected-worker-binding"
import {
  findWorkerTurnDescriptorForDispatchInTransaction,
  parsePersistedWorkerTurnDescriptor,
  WorkerTurnDescriptorPayloadSchema,
  workerTurnDescriptorHash,
  workerTurnDescriptorInfoFromRow,
  type WorkerTurnDescriptorPayload,
} from "./worker-turn-descriptor-facts"

export namespace WorkerTurnDescriptor {
  export const Payload = WorkerTurnDescriptorPayloadSchema
  export type Payload = WorkerTurnDescriptorPayload

  export const Info = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      hash: z.string(),
      payload: Payload,
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .strict()
  export type Info = z.infer<typeof Info>

  export function hash(payload: Payload): string {
    return workerTurnDescriptorHash(payload)
  }

  export function parsePersisted(input: { id: string; agentIndex: string; hash: string; payload: unknown }): Payload {
    return parsePersistedWorkerTurnDescriptor(input)
  }

  function fromRow(row: typeof WorkerTurnDescriptorTable.$inferSelect): Info {
    return workerTurnDescriptorInfoFromRow(row)
  }

  export function prepare(input: { sessionID: string; payload: Payload }): Info {
    const now = Date.now()
    const parsed = Payload.parse(input.payload)
    const row = {
      id: Identifier.ascending("worker_turn_descriptor"),
      session_id: input.sessionID,
      hash: hash(parsed),
      agent: parsed.identity.agentID,
      payload: parsed,
      time_created: now,
      time_updated: now,
    } satisfies typeof WorkerTurnDescriptorTable.$inferInsert
    return fromRow(row)
  }

  export function persistPrepared(input: { descriptor: Info; onPersisted?: (descriptor: Info) => void }): Info {
    const descriptor = Info.parse(input.descriptor)
    const parsed = Payload.parse(descriptor.payload)
    if (descriptor.hash !== hash(parsed)) {
      throw new Error(`Prepared worker turn descriptor ${descriptor.id} hash does not match its payload`)
    }
    const row = {
      id: descriptor.id,
      session_id: descriptor.sessionID,
      hash: descriptor.hash,
      agent: parsed.identity.agentID,
      payload: parsed,
      time_created: descriptor.time.created,
      time_updated: descriptor.time.updated,
    } satisfies typeof WorkerTurnDescriptorTable.$inferInsert
    Database.transaction((db) => {
      db.insert(WorkerTurnDescriptorTable).values(row).run()
      input.onPersisted?.(descriptor)
    })
    return descriptor
  }

  export function create(input: {
    sessionID: string
    payload: Payload
    onPersisted?: (descriptor: Info) => void
  }): Info {
    return persistPrepared({
      descriptor: prepare(input),
      onPersisted: input.onPersisted,
    })
  }

  export function latestForSession(sessionID: string): Info | undefined {
    return Database.use((db) => {
      const row = db
        .select()
        .from(WorkerTurnDescriptorTable)
        .where(eq(WorkerTurnDescriptorTable.session_id, sessionID))
        .orderBy(desc(WorkerTurnDescriptorTable.time_created), desc(WorkerTurnDescriptorTable.id))
        .get()
      return row ? fromRow(row) : undefined
    })
  }

  export function listForTask(taskID: string): Info[] {
    return Database.use((db) =>
      db
        .select()
        .from(WorkerTurnDescriptorTable)
        .where(sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.lifecycle.taskID') = ${taskID}`)
        .orderBy(WorkerTurnDescriptorTable.time_created, WorkerTurnDescriptorTable.id)
        .all()
        .map(fromRow),
    )
  }

  export function findForDispatch(input: { sessionID: string; dispatchID: string }): Info | undefined {
    return Database.use((db) => findForDispatchInDatabase(db, input))
  }

  export function findForDispatchInDatabase(
    db: Database.TxOrDb,
    input: { sessionID: string; dispatchID: string },
  ): Info | undefined {
    return findWorkerTurnDescriptorForDispatchInTransaction(db, input)
  }

  export function findForMessageAuthority(input: { sessionID: string; inputMessageID: string }): Info | undefined {
    const rows = Database.use((db) =>
      db
        .select()
        .from(WorkerTurnDescriptorTable)
        .where(
          and(
            eq(WorkerTurnDescriptorTable.session_id, input.sessionID),
            sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.messageAuthority.user_message_id') = ${input.inputMessageID}`,
          ),
        )
        .all(),
    )
    if (rows.length > 1) {
      throw new Error(
        `Session ${input.sessionID} input message ${input.inputMessageID} has ${rows.length} Worker Turn descriptors`,
      )
    }
    return rows[0] ? fromRow(rows[0]) : undefined
  }

  export function latestProjectedBindingForSession(input: {
    sessionID: string
    taskID: string
    sessionKind: string
  }): { descriptor: Info; binding: ProjectedWorkerBinding } | undefined {
    const descriptor = latestForSession(input.sessionID)
    if (!descriptor) return undefined
    if (descriptor.payload.lifecycle.taskID !== input.taskID) {
      throw new Error(
        `Worker turn descriptor ${descriptor.id} task mismatch for ${input.sessionID}: expected ${input.taskID}, found ${descriptor.payload.lifecycle.taskID}`,
      )
    }
    if (descriptor.payload.identity.sessionKind !== input.sessionKind) {
      throw new Error(
        `Worker turn descriptor ${descriptor.id} session kind mismatch for ${input.sessionID}: expected ${input.sessionKind}, found ${descriptor.payload.identity.sessionKind}`,
      )
    }
    return {
      descriptor,
      binding: materializeProjectedWorkerBinding({
        identity: descriptor.payload.identity,
        expertSquadID: descriptor.payload.expertSquadID,
        workerTurnDescriptorID: descriptor.id,
        workerTurnDescriptorHash: descriptor.hash,
      }),
    }
  }

  export function get(input: { id: string; sessionID: string }): Info | undefined {
    return Database.use((db) => {
      const row = db.select().from(WorkerTurnDescriptorTable).where(eq(WorkerTurnDescriptorTable.id, input.id)).get()
      if (!row || row.session_id !== input.sessionID) return undefined
      return fromRow(row)
    })
  }
}
