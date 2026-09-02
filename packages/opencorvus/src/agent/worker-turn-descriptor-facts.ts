import { createHash } from "node:crypto"
import { DispatchTurnSchema, WorkerInputMessageAuthoritySchema } from "@/orchestrator/dispatch-turn-projection"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import type { Database } from "@/storage/db"
import { and, eq, sql } from "drizzle-orm"
import z from "zod"
import { ProjectedAgentWorkScopeSchema } from "./projected-agent-work-scope"
import { ProjectedWorkerIdentitySchema } from "./projected-worker-identity"
import { StageToolMaterializerBindingSchema } from "./stage-tool-materializer"

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

export const WorkerTurnDescriptorPayloadSchema = z
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
      stageOwned: z.array(z.string()),
      stageMaterializers: z.record(z.string(), StageToolMaterializerBindingSchema),
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

export type WorkerTurnDescriptorPayload = z.infer<typeof WorkerTurnDescriptorPayloadSchema>

export interface WorkerTurnDescriptorInfo {
  id: string
  sessionID: string
  hash: string
  payload: WorkerTurnDescriptorPayload
  time: {
    created: number
    updated: number
  }
}

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

export function workerTurnDescriptorHash(payload: WorkerTurnDescriptorPayload): string {
  return createHash("sha256").update(stable(payload)).digest("hex")
}

export function parsePersistedWorkerTurnDescriptor(input: {
  id: string
  agentIndex: string
  hash: string
  payload: unknown
}): WorkerTurnDescriptorPayload {
  const parsed = WorkerTurnDescriptorPayloadSchema.safeParse(input.payload)
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
  const expectedHash = workerTurnDescriptorHash(payload)
  if (input.hash !== expectedHash) {
    throw new Error(`Worker turn descriptor ${input.id} hash mismatch: expected ${expectedHash}, found ${input.hash}`)
  }
  return payload
}

export function workerTurnDescriptorInfoFromRow(
  row: typeof WorkerTurnDescriptorTable.$inferSelect,
): WorkerTurnDescriptorInfo {
  const payload = parsePersistedWorkerTurnDescriptor({
    id: row.id,
    agentIndex: row.agent,
    hash: row.hash,
    payload: row.payload,
  })
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

export function findWorkerTurnDescriptorForDispatchInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; dispatchID: string },
): WorkerTurnDescriptorInfo | undefined {
  const row = db
    .select()
    .from(WorkerTurnDescriptorTable)
    .where(
      and(
        eq(WorkerTurnDescriptorTable.session_id, input.sessionID),
        sql`json_extract(${WorkerTurnDescriptorTable.payload}, '$.dispatchTurn.current_dispatch_id') = ${input.dispatchID}`,
      ),
    )
    .get()
  return row ? workerTurnDescriptorInfoFromRow(row) : undefined
}
