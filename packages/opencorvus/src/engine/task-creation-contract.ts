import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { and, eq, isNull } from "drizzle-orm"
import { Database } from "@/storage/db"
import {
  EngineChannelBindingTable,
  EngineTaskCreationContractTable,
  EngineTaskTable,
  type EngineMetadata,
} from "./engine.sql"
import { insertEngineChannelBinding } from "./channel-binding"
import {
  TaskChannelBindingGlobalCreationConflictError,
  TaskChannelBindingProjectConflictError,
  TaskCreationAcceptedTargetUnavailableError,
} from "./task-project-error"
import { taskDeletedInTransaction } from "./store"
import {
  canonicalTaskCreationContract,
  assertCurrentTaskCreationContract,
  assertCurrentTaskCreationRequest,
  canonicalInlineUploadAttachment,
  globalTaskRequestContract,
  panelTaskCreationCallerInput,
  taskCreationCallerRequest,
  taskCreationContractFingerprint,
  type CanonicalJSON,
  type TaskCreationCallerInput,
} from "./task-creation-request"
import { canonicalJSONValue } from "@/util/canonical-digest"

export {
  canonicalTaskCreationContract,
  assertCurrentTaskCreationContract,
  assertCurrentTaskCreationRequest,
  canonicalInlineUploadAttachment,
  globalTaskRequestContract,
  panelTaskCreationCallerInput,
  taskCreationCallerRequest,
  taskCreationContractFingerprint,
  type CanonicalJSON,
  type TaskCreationCallerInput,
} from "./task-creation-request"

export const TaskCreationContractConflictError = NamedError.create(
  "TaskCreationContractConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    identityKind: z.enum(["request", "channel", "tool"]),
    identity: z.string(),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    actualFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
)

export const TaskCreationIdentityConflictError = NamedError.create(
  "TaskCreationIdentityConflictError",
  z.object({
    message: z.string(),
    projectID: z.string(),
    requestTaskID: z.string().nullable(),
    channelTaskID: z.string().nullable(),
    toolTaskID: z.string().nullable(),
  }),
)


export type TaskCreationRequestFact = Readonly<{
  request: Record<string, CanonicalJSON>
  fingerprint: string
  creatorToolPartID?: string
}>

export type TaskCreationContractFact = Readonly<{
  contract: Record<string, CanonicalJSON>
  /** Fingerprint of canonical caller semantics only. Resolved defaults and
   * first-accept environment snapshots are durable evidence, never replay
   * comparison inputs. */
  fingerprint: string
  creatorToolPartID?: string
}>

export function buildTaskCreationRequestFact(input: {
  request: unknown
  creatorToolPartID?: string
}): TaskCreationRequestFact {
  const request = assertCurrentTaskCreationRequest({ protocol: "task-create-request-v1", input: input.request })
  return Object.freeze({
    request,
    fingerprint: taskCreationContractFingerprint(request),
    ...(input.creatorToolPartID ? { creatorToolPartID: input.creatorToolPartID } : {}),
  })
}

export function buildTaskCreationContractFact(input: {
  request: TaskCreationRequestFact
  resolved: unknown
}): TaskCreationContractFact {
  const contract = assertCurrentTaskCreationContract({
    protocol: "task-creation-contract-v2",
    request: input.request.request,
    resolved: input.resolved,
  })
  return Object.freeze({
    contract,
    fingerprint: input.request.fingerprint,
    ...(input.request.creatorToolPartID ? { creatorToolPartID: input.request.creatorToolPartID } : {}),
  })
}

export function insertTaskCreationContract(
  db: Database.TxOrDb,
  input: { taskID: string; fact: TaskCreationContractFact; timeCreated: number },
): void {
  db.insert(EngineTaskCreationContractTable)
    .values({
      task_id: input.taskID,
      fingerprint: input.fact.fingerprint,
      contract: input.fact.contract,
      creator_tool_part_id: input.fact.creatorToolPartID,
      time_created: input.timeCreated,
    })
    .run()
}

export type TaskCreationClaims = Readonly<{
  projectID: string
  requestID?: string
  channelBinding?: Readonly<{
    platform: string
    channel: string
    thread: string
    payload?: EngineMetadata
  }>
  creatorToolPartID?: string
}>

/** A one-call Global Task necessarily creates a new carrying Project, so an
 * already accepted channel claim can be rejected before allocation. */
export function assertGlobalTaskChannelClaimAvailable(input: {
  requestID: string
  channelBinding?: TaskCreationClaims["channelBinding"]
}): void {
  if (!input.channelBinding) return
  const winner = Database.use((db) =>
    db
      .select({
        taskID: EngineChannelBindingTable.task_id,
        projectID: EngineTaskTable.project_id,
      })
      .from(EngineChannelBindingTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineChannelBindingTable.task_id))
      .where(
        and(
          eq(EngineChannelBindingTable.platform, input.channelBinding!.platform),
          eq(EngineChannelBindingTable.channel, input.channelBinding!.channel),
          eq(EngineChannelBindingTable.thread, input.channelBinding!.thread),
        ),
      )
      .get(),
  )
  if (!winner) return
  throw new TaskChannelBindingGlobalCreationConflictError({
    message: `Global Task request ${input.requestID} channel ${channelIdentity(input.channelBinding)} is already accepted by Task ${winner.taskID}`,
    requestID: input.requestID,
    platform: input.channelBinding.platform,
    channel: input.channelBinding.channel,
    thread: input.channelBinding.thread,
    taskID: winner.taskID,
    projectID: winner.projectID,
  })
}

function channelIdentity(binding: NonNullable<TaskCreationClaims["channelBinding"]>): string {
  return `${binding.platform}/${binding.channel}/${binding.thread}`
}

function winnersInTransaction(db: Database.TxOrDb, claims: TaskCreationClaims) {
  const requestTaskID = claims.requestID
    ? (db
        .select({ id: EngineTaskTable.id })
        .from(EngineTaskTable)
        .where(and(eq(EngineTaskTable.project_id, claims.projectID), eq(EngineTaskTable.request_id, claims.requestID)))
        .get()?.id ?? null)
    : null
  const channelWinner = claims.channelBinding
    ? db
        .select({ taskID: EngineChannelBindingTable.task_id, projectID: EngineTaskTable.project_id })
        .from(EngineChannelBindingTable)
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineChannelBindingTable.task_id))
        .where(
          and(
            eq(EngineChannelBindingTable.platform, claims.channelBinding.platform),
            eq(EngineChannelBindingTable.channel, claims.channelBinding.channel),
            eq(EngineChannelBindingTable.thread, claims.channelBinding.thread),
          ),
        )
        .get()
    : null
  if (channelWinner && channelWinner.projectID !== claims.projectID) {
    throw new TaskChannelBindingProjectConflictError({
      message: `Channel ${channelIdentity(claims.channelBinding!)} is already bound in another Project`,
      platform: claims.channelBinding!.platform,
      channel: claims.channelBinding!.channel,
      thread: claims.channelBinding!.thread,
      taskID: channelWinner.taskID,
      projectID: channelWinner.projectID,
      activeProjectID: claims.projectID,
    })
  }
  const channelTaskID = channelWinner?.taskID ?? null
  const toolTaskID = claims.creatorToolPartID
    ? (db
        .select({ taskID: EngineTaskCreationContractTable.task_id })
        .from(EngineTaskCreationContractTable)
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineTaskCreationContractTable.task_id))
        .where(
          and(
            eq(EngineTaskTable.project_id, claims.projectID),
            eq(EngineTaskCreationContractTable.creator_tool_part_id, claims.creatorToolPartID),
          ),
        )
        .get()?.taskID ?? null)
    : null
  return { requestTaskID, channelTaskID, toolTaskID }
}

function identityForWinner(claims: TaskCreationClaims, winners: ReturnType<typeof winnersInTransaction>) {
  if (winners.toolTaskID) return { kind: "tool" as const, identity: claims.creatorToolPartID! }
  if (winners.channelTaskID) return { kind: "channel" as const, identity: channelIdentity(claims.channelBinding!) }
  return { kind: "request" as const, identity: claims.requestID! }
}

/** Resolve every supplied durable claim as one intersection. If one winner
 * exists, this function verifies the complete contract and acquires only
 * still-unbound request/channel aliases in the same immediate transaction. */
export function resolveTaskCreationClaims(input: {
  claims: TaskCreationClaims
  fact: Pick<TaskCreationRequestFact, "fingerprint" | "creatorToolPartID">
}): string | undefined {
  return Database.immediateTransaction((db) => {
    const winners = winnersInTransaction(db, input.claims)
    const distinct = [...new Set(Object.values(winners).filter((value): value is string => value !== null))]
    if (distinct.length === 0) return undefined
    if (distinct.length !== 1) {
      throw new TaskCreationIdentityConflictError({
        message: "Task creation identities resolve to different accepted Tasks",
        projectID: input.claims.projectID,
        ...winners,
      })
    }
    const taskID = distinct[0]!
    if (taskDeletedInTransaction(db, taskID)) {
      throw new TaskCreationAcceptedTargetUnavailableError({
        message: `Task creation occurrence was accepted as tombstoned Task ${taskID}`,
        taskID,
        projectID: input.claims.projectID,
      })
    }
    const row = db
      .select({
        requestID: EngineTaskTable.request_id,
        fingerprint: EngineTaskCreationContractTable.fingerprint,
        creatorToolPartID: EngineTaskCreationContractTable.creator_tool_part_id,
      })
      .from(EngineTaskTable)
      .innerJoin(EngineTaskCreationContractTable, eq(EngineTaskCreationContractTable.task_id, EngineTaskTable.id))
      .where(and(eq(EngineTaskTable.id, taskID), eq(EngineTaskTable.project_id, input.claims.projectID)))
      .get()
    if (!row) throw new Error(`Task ${taskID} is missing its immutable creation contract`)
    if (row.fingerprint !== input.fact.fingerprint) {
      const identity = identityForWinner(input.claims, winners)
      throw new TaskCreationContractConflictError({
        message: `${identity.kind} ${identity.identity} is already accepted as Task ${taskID} with another creation contract`,
        taskID,
        identityKind: identity.kind,
        identity: identity.identity,
        expectedFingerprint: row.fingerprint,
        actualFingerprint: input.fact.fingerprint,
      })
    }
    if (input.claims.creatorToolPartID && row.creatorToolPartID !== input.claims.creatorToolPartID) {
      throw new TaskCreationIdentityConflictError({
        message: `Task ${taskID} is owned by another persisted Tool occurrence`,
        projectID: input.claims.projectID,
        ...winners,
      })
    }
    if (input.claims.requestID) {
      if (row.requestID && row.requestID !== input.claims.requestID) {
        throw new TaskCreationIdentityConflictError({
          message: `Task ${taskID} is already bound to another request identity`,
          projectID: input.claims.projectID,
          ...winners,
        })
      }
      if (!row.requestID) {
        db.update(EngineTaskTable)
          .set({ request_id: input.claims.requestID })
          .where(and(eq(EngineTaskTable.id, taskID), isNull(EngineTaskTable.request_id)))
          .run()
      }
    }
    if (input.claims.channelBinding && !winners.channelTaskID) {
      insertEngineChannelBinding(db, {
        taskID,
        ...input.claims.channelBinding,
        payload: input.claims.channelBinding.payload ?? {},
      })
    } else if (input.claims.channelBinding) {
      const binding = db
        .select({ payload: EngineChannelBindingTable.payload })
        .from(EngineChannelBindingTable)
        .where(
          and(
            eq(EngineChannelBindingTable.task_id, taskID),
            eq(EngineChannelBindingTable.platform, input.claims.channelBinding.platform),
            eq(EngineChannelBindingTable.channel, input.claims.channelBinding.channel),
            eq(EngineChannelBindingTable.thread, input.claims.channelBinding.thread),
          ),
        )
        .get()
      if (
        !binding ||
        canonicalJSONValue(binding.payload, "persisted channel claim") !==
          canonicalJSONValue(input.claims.channelBinding.payload ?? {}, "requested channel claim")
      ) {
        throw new TaskCreationIdentityConflictError({
          message: `Task ${taskID} channel claim has another immutable payload`,
          projectID: input.claims.projectID,
          ...winners,
        })
      }
    }
    return taskID
  })
}

export function taskIDForCreatorToolPart(toolPartID: string): string | undefined {
  return Database.use((db) => {
    const taskID = db
        .select({ taskID: EngineTaskCreationContractTable.task_id })
        .from(EngineTaskCreationContractTable)
        .where(eq(EngineTaskCreationContractTable.creator_tool_part_id, toolPartID))
        .get()?.taskID
    if (taskID && taskDeletedInTransaction(db, taskID)) {
      const task = db.select({ projectID: EngineTaskTable.project_id }).from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, taskID)).get()
      throw new TaskCreationAcceptedTargetUnavailableError({
        message: `Tool occurrence ${toolPartID} was accepted as tombstoned Task ${taskID}`,
        taskID,
        projectID: task?.projectID ?? "retained",
      })
    }
    return taskID
  })
}
