import { createHash } from "node:crypto"
import z from "zod"
import { and, desc, eq, sql } from "@/storage/db"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { ProjectedWorkerIdentitySchema } from "./projected-worker-identity"
import { ProjectedAgentWorkScope, ProjectedAgentWorkScopeSchema } from "./projected-agent-work-scope"
import { materializeProjectedWorkerBinding, type ProjectedWorkerBinding } from "./projected-worker-binding"
import { DispatchTurnSchema, WorkerInputMessageAuthoritySchema } from "@/orchestrator/dispatch-turn-projection"

export class PersistedWorkerTurnDescriptorIncompatibleError extends Error {
  override readonly name = "PersistedWorkerTurnDescriptorIncompatibleError"

  constructor(
    readonly descriptorID: string,
    readonly issues: Array<{ path: PropertyKey[]; message: string }>,
  ) {
    super(
      `Worker turn descriptor ${descriptorID} is incompatible with the current runtime contract: ${issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
    )
  }
}

export namespace WorkerTurnDescriptor {
  export const Payload = z
    .object({
      identity: ProjectedWorkerIdentitySchema,
      expertSquadID: z.string(),
      packageRevision: z
        .object({
          scope: z.enum(["built_in", "project", "global"]),
          projectID: z.string().min(1).nullable(),
          namespace: z.string(),
          id: z.string(),
          version: z.string(),
          packageDigest: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
        .superRefine((revision, context) => {
          if ((revision.scope === "project") !== (revision.projectID !== null)) {
            context.addIssue({
              code: "custom",
              path: ["projectID"],
              message: "project package revision requires projectID and non-project revisions require null",
            })
          }
        }),
      model: z.discriminatedUnion("selection", [
        z.object({
          selection: z.literal("explicit"),
          providerID: z.string(),
          modelID: z.string(),
        }),
        z.object({
          selection: z.literal("provider-default"),
          providerID: z.string(),
        }),
      ]),
      prompt: z.object({
        systemMode: z.literal("complete"),
        systemSha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
      tools: z.object({
        enabled: z.array(z.string()),
        switches: z.record(z.string(), z.boolean()).optional(),
        coordinationHandoff: z.literal("request_orchestrator_decision").optional(),
      }),
      output: z.object({
        format: z.literal("text"),
        resultMode: z.literal("reply"),
      }),
      lifecycle: z.object({
        taskID: z.string().min(1),
        workScope: ProjectedAgentWorkScopeSchema,
        attemptID: z.string().optional(),
        priorLifecycleEventID: z.string().min(1).optional(),
      }),
      messageAuthority: WorkerInputMessageAuthoritySchema,
      dispatchTurn: DispatchTurnSchema.optional(),
    })
    .strict()
    .refine((payload) => payload.packageRevision.id === payload.expertSquadID, {
      message: "package revision ID must match expert squad ID",
      path: ["packageRevision", "id"],
    })
  export type Payload = z.infer<typeof Payload>

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

  function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
        .join(",")}}`
    }
    return JSON.stringify(value)
  }

  export function hash(payload: Payload): string {
    return createHash("sha256").update(stable(payload)).digest("hex")
  }

  export function parsePersisted(input: { id: string; agentIndex: string; hash: string; payload: unknown }): Payload {
    const parsed = Payload.safeParse(input.payload)
    if (!parsed.success) {
      throw new PersistedWorkerTurnDescriptorIncompatibleError(
        input.id,
        parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      )
    }
    const payload = parsed.data
    if (input.agentIndex !== payload.identity.agentID) {
      throw new Error(
        `Worker turn descriptor ${input.id} agent index mismatch: expected ${payload.identity.agentID}, found ${input.agentIndex}`,
      )
    }
    const expectedHash = hash(payload)
    if (input.hash !== expectedHash) {
      throw new Error(`Worker turn descriptor ${input.id} hash mismatch: expected ${expectedHash}, found ${input.hash}`)
    }
    return payload
  }

  function fromRow(row: typeof WorkerTurnDescriptorTable.$inferSelect): Info {
    const payload = parsePersisted({ id: row.id, agentIndex: row.agent, hash: row.hash, payload: row.payload })
    return {
      id: row.id,
      sessionID: row.session_id,
      hash: row.hash,
      payload,
      time: {
        created: row.time_created,
        updated: row.time_updated,
      },
    }
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
    const rows = Database.use((db) =>
      db
        .select()
        .from(WorkerTurnDescriptorTable)
        .where(
          and(
            eq(WorkerTurnDescriptorTable.session_id, input.sessionID),
            sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id') = ${input.dispatchID}`,
          ),
        )
        .all(),
    )
    if (rows.length > 1) {
      throw new Error(
        `Session ${input.sessionID} dispatch ${input.dispatchID} has ${rows.length} Worker Turn descriptors`,
      )
    }
    return rows[0] ? fromRow(rows[0]) : undefined
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
