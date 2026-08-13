import { createHash } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { EngineTaskTable } from "@/engine/engine.sql"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { deriveTaskStatus, isTaskActive } from "@/engine/task-status"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import { Identifier } from "@/id/id"
import { MessageTable, PartTable, SessionControlRecordTable, SessionTable } from "@/session/session.sql"
import { and, asc, Database, eq, inArray, lte, or, sql } from "@/storage/db"
import { TaskCreatorMetadata } from "@/task-api/task-creator"
import { ProtocolEventTable, ProtocolInboxTable } from "./protocol.sql"
import {
  ProtocolInboxDeliveryResult,
  SchedulerEndpoint,
  SchedulerMessageKind,
  SchedulerMessagePayload,
  type ProtocolAggregate,
} from "./schema"
import { ProtocolStore } from "./store"
import { requireMissionExecutionClosureEvent } from "@/mission/execution-closure"

const SCHEDULER_MESSAGE_EVENT_TYPE = "scheduler.message"
const ENDPOINT_PREFIX = "scheduler-endpoint:"

function sourceBodyFromPartData(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined
  const part = data as { type?: unknown; tool?: unknown; state?: { input?: { message?: unknown } }; text?: unknown }
  if (part.type === "tool" && part.tool === "scheduler_message" && typeof part.state?.input?.message === "string") {
    return part.state.input.message
  }
  return undefined
}

export const SchedulerMessageAuthorityError = NamedError.create(
  "SchedulerMessageAuthorityError",
  z.object({ message: z.string().min(1) }),
)

export const SchedulerMessageConflictError = NamedError.create(
  "SchedulerMessageConflictError",
  z.object({ message: z.string().min(1), eventID: z.string().min(1).optional() }),
)

export const SchedulerTargetOccurrenceStaleError = NamedError.create(
  "SchedulerTargetOccurrenceStaleError",
  z.object({
    message: z.string().min(1),
    taskID: Identifier.schema("task"),
    expectedStartedAt: z.number().int().positive(),
    currentStartedAt: z.number().int().positive(),
  }),
)

export type SchedulerDeliveryReceipt = {
  eventID: string
  inboxID: string
  threadID: string
  status: "pending" | "leased" | "delivered" | "dead_letter"
  replayed: boolean
}

function requireTaskTargetActive(
  db: Database.TxOrDb,
  target: Extract<z.infer<typeof SchedulerEndpoint>, { kind: "task_scheduler" }>,
) {
  const task = requireTaskEndpoint(db, target)
  if (!isTaskActive(task)) {
    throw new SchedulerMessageAuthorityError({
      message: `Scheduler message requires active Task ${task.id} (status=${deriveTaskStatus(task)}).`,
    })
  }
  return task
}

export function schedulerDeliveryIdentity(input: {
  invocationID: string
  kind: z.input<typeof SchedulerMessageKind>
  source: z.input<typeof SchedulerEndpoint>
  target: z.input<typeof SchedulerEndpoint>
}) {
  const source = SchedulerEndpoint.parse(input.source)
  const target = SchedulerEndpoint.parse(input.target)
  const kind = SchedulerMessageKind.parse(input.kind)
  const identityMaterial = JSON.stringify({ source, target, invocationID: input.invocationID, kind })
  const eventID = Identifier.deterministic("protocol_event", `scheduler-delivery\0${identityMaterial}`)
  return {
    eventID,
    inboxID: Identifier.deterministic("protocol_inbox", `scheduler-delivery\0${eventID}`),
  }
}

export function schedulerTargetOccurrenceIdentity(inboxID: string) {
  return {
    messageID: Identifier.deterministic("message", `scheduler-delivery\0${inboxID}`),
    textPartID: Identifier.deterministic("part", `scheduler-delivery\0${inboxID}`),
    controlID: Identifier.deterministic("session_control", `scheduler-delivery\0${inboxID}`),
  }
}

/** Fail closed before generic Session upserts can alias a different compact occurrence. */
export function assertSchedulerTargetOccurrenceAvailableInTransaction(
  db: Database.TxOrDb,
  input: { inboxID: string; messageID: string; textPartID: string; controlID: string },
) {
  Database.requireActiveTransaction("assertSchedulerTargetOccurrenceAvailableInTransaction")
  const message = db.select().from(MessageTable).where(eq(MessageTable.id, input.messageID)).get()
  const part = db.select().from(PartTable).where(eq(PartTable.id, input.textPartID)).get()
  const control = db
    .select()
    .from(SessionControlRecordTable)
    .where(eq(SessionControlRecordTable.id, input.controlID))
    .get()
  if (message || part || control) {
    throw new SchedulerMessageConflictError({
      message: `Scheduler inbox ${input.inboxID} target occurrence identity is already occupied.`,
    })
  }
}

export function encodeSchedulerEndpoint(endpoint: z.input<typeof SchedulerEndpoint>): string {
  return `${ENDPOINT_PREFIX}${JSON.stringify(SchedulerEndpoint.parse(endpoint))}`
}

export function decodeSchedulerEndpoint(value: string): z.infer<typeof SchedulerEndpoint> {
  if (!value.startsWith(ENDPOINT_PREFIX)) {
    throw new SchedulerMessageAuthorityError({ message: `Invalid scheduler endpoint encoding.` })
  }
  try {
    return SchedulerEndpoint.parse(JSON.parse(value.slice(ENDPOINT_PREFIX.length)))
  } catch (error) {
    throw new SchedulerMessageAuthorityError({
      message: `Invalid scheduler endpoint: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
}

export function renderSchedulerParticipantMessage(input: {
  eventID: string
  kind: z.input<typeof SchedulerMessageKind>
  source: z.input<typeof SchedulerEndpoint>
  threadID: string
  replyTo?: string
  subject: string
  message: string
}): string {
  const source = SchedulerEndpoint.parse(input.source)
  const kind = SchedulerMessageKind.parse(input.kind)
  if (kind === "reply" && !input.replyTo) {
    throw new SchedulerMessageConflictError({ message: `Scheduler reply participant Message requires reply_to.` })
  }
  const sourceLabel =
    source.kind === "task_scheduler" ? `Task scheduler ${source.task_id}` : `Mission scheduler ${source.mission_id}`
  return [
    `Scheduler ${kind} from ${sourceLabel}.`,
    `event_id: ${input.eventID}`,
    `thread_id: ${input.threadID}`,
    ...(input.replyTo ? [`reply_to: ${input.replyTo}`] : []),
    `subject: ${input.subject}`,
    "message:",
    input.message,
    ...(kind === "request"
      ? [`Reply through scheduler_message with kind=reply and reply_to=${input.eventID}.`]
      : kind === "reply"
        ? [
            `This correlated reply resolves request ${input.replyTo}; process it now and do not keep waiting for that request.`,
          ]
        : []),
  ].join("\n")
}

export function taskSchedulerEndpoint(taskID: string): Extract<SchedulerEndpoint, { kind: "task_scheduler" }> {
  const task = Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get())
  if (!task?.session_id) throw new SchedulerMessageAuthorityError({ message: `Task ${taskID} has no root Session.` })
  return SchedulerEndpoint.parse({
    kind: "task_scheduler",
    project_id: task.project_id,
    task_id: task.id,
    root_session_id: task.session_id,
  }) as Extract<SchedulerEndpoint, { kind: "task_scheduler" }>
}

export function owningMissionSchedulerEndpoint(
  taskID: string,
): Extract<SchedulerEndpoint, { kind: "mission_scheduler" }> {
  const task = Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get())
  if (!task) throw new SchedulerMessageAuthorityError({ message: `Task ${taskID} does not exist.` })
  const owner = missionOwner(task)
  if (!owner) throw new SchedulerMessageAuthorityError({ message: `Task ${taskID} is not owned by a Mission.` })
  return SchedulerEndpoint.parse({
    kind: "mission_scheduler",
    project_id: task.project_id,
    mission_id: owner.missionID,
    session_id: owner.sessionID,
  }) as Extract<SchedulerEndpoint, { kind: "mission_scheduler" }>
}

function endpointRecipient(endpoint: z.infer<typeof SchedulerEndpoint>): {
  actor: ProtocolAggregate
  actorID: string
  aggregate: ProtocolAggregate
  aggregateID: string
} {
  if (endpoint.kind === "mission_scheduler") {
    return { actor: "session", actorID: endpoint.session_id, aggregate: "session", aggregateID: endpoint.session_id }
  }
  return { actor: "task", actorID: endpoint.task_id, aggregate: "task", aggregateID: endpoint.task_id }
}

function requireMissionEndpoint(
  db: Database.TxOrDb,
  endpoint: Extract<z.infer<typeof SchedulerEndpoint>, { kind: "mission_scheduler" }>,
) {
  const session = db.select().from(SessionTable).where(eq(SessionTable.id, endpoint.session_id)).get()
  const mission =
    session?.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? (session.metadata as { mission?: { id?: unknown } }).mission
      : undefined
  if (
    !session ||
    session.project_id !== endpoint.project_id ||
    session.kind !== "mission" ||
    mission?.id !== endpoint.mission_id
  ) {
    throw new SchedulerMessageAuthorityError({
      message: `Mission scheduler endpoint ${endpoint.mission_id}/${endpoint.session_id} is not a current Project Mission.`,
    })
  }
  return session
}

function requireTaskEndpoint(
  db: Database.TxOrDb,
  endpoint: Extract<z.infer<typeof SchedulerEndpoint>, { kind: "task_scheduler" }>,
) {
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, endpoint.task_id)).get()
  if (!task || task.project_id !== endpoint.project_id || task.session_id !== endpoint.root_session_id) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler endpoint ${endpoint.task_id} is not bound to the declared Project/root Session.`,
    })
  }
  return task
}

function missionOwner(task: typeof EngineTaskTable.$inferSelect): { missionID: string; sessionID: string } | undefined {
  const creator = TaskCreatorMetadata.parse(task.metadata)
  return creator.actor === "mission"
    ? { missionID: creator.mission.id, sessionID: creator.mission.session_id }
    : undefined
}

function requireEndpointAuthority(
  db: Database.TxOrDb,
  source: z.infer<typeof SchedulerEndpoint>,
  target: z.infer<typeof SchedulerEndpoint>,
) {
  if (source.project_id !== target.project_id) {
    throw new SchedulerMessageAuthorityError({ message: `Scheduler messages cannot cross Projects.` })
  }
  if (source.kind === "mission_scheduler" && target.kind !== "mission_scheduler") {
    requireMissionEndpoint(db, source)
    const targetTask = requireTaskEndpoint(db, target)
    const owner = missionOwner(targetTask)
    if (owner?.missionID !== source.mission_id || owner.sessionID !== source.session_id) {
      throw new SchedulerMessageAuthorityError({ message: `Mission does not own target Task ${targetTask.id}.` })
    }
    return
  }
  if (source.kind !== "mission_scheduler" && target.kind === "mission_scheduler") {
    const sourceTask = requireTaskEndpoint(db, source)
    requireMissionEndpoint(db, target)
    const owner = missionOwner(sourceTask)
    if (owner?.missionID !== target.mission_id || owner.sessionID !== target.session_id) {
      throw new SchedulerMessageAuthorityError({ message: `Task ${sourceTask.id} is not owned by target Mission.` })
    }
    return
  }
  if (source.kind !== "mission_scheduler" && target.kind !== "mission_scheduler") {
    const sourceTask = requireTaskEndpoint(db, source)
    const targetTask = requireTaskEndpoint(db, target)
    if (sourceTask.id === targetTask.id) {
      throw new SchedulerMessageAuthorityError({
        message: `Task scheduler ${sourceTask.id} cannot address itself; peer messages require a sibling Task.`,
      })
    }
    const sourceOwner = missionOwner(sourceTask)
    const targetOwner = missionOwner(targetTask)
    if (
      !sourceOwner ||
      !targetOwner ||
      sourceOwner.missionID !== targetOwner.missionID ||
      sourceOwner.sessionID !== targetOwner.sessionID
    ) {
      throw new SchedulerMessageAuthorityError({ message: `Scheduler peer Tasks must share one exact owning Mission.` })
    }
    return
  }
  throw new SchedulerMessageAuthorityError({ message: `Mission-to-Mission scheduler messages are not authorized.` })
}

function sameEndpoint(left: z.infer<typeof SchedulerEndpoint>, right: z.infer<typeof SchedulerEndpoint>): boolean {
  return encodeSchedulerEndpoint(left) === encodeSchedulerEndpoint(right)
}

function requireReplyAuthority(input: {
  db: Database.TxOrDb
  kind: z.infer<typeof SchedulerMessageKind>
  source: z.infer<typeof SchedulerEndpoint>
  target: z.infer<typeof SchedulerEndpoint>
  replyTo?: string
  correlationID: string
  threadID: string
  sourceTaskOccurrenceStartedAt: number | null
  targetTaskOccurrenceStartedAt: number | null
}) {
  if (input.kind !== "reply") {
    if (input.replyTo) throw new SchedulerMessageConflictError({ message: `Only a reply may carry reply_to.` })
    return
  }
  if (!input.replyTo) throw new SchedulerMessageConflictError({ message: `Scheduler reply requires reply_to.` })
  const requestRow = input.db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, input.replyTo)).get()
  if (!requestRow || requestRow.type !== SCHEDULER_MESSAGE_EVENT_TYPE || requestRow.kind !== "command") {
    throw new SchedulerMessageConflictError({ message: `Scheduler reply target is not a pending request.` })
  }
  const requestPayload = SchedulerMessagePayload.parse(requestRow.payload)
  if (requestPayload.message_kind !== "request") {
    throw new SchedulerMessageConflictError({ message: `Scheduler reply target is not a request.` })
  }
  if (
    !sameEndpoint(decodeSchedulerEndpoint(requestRow.source), input.target) ||
    !requestRow.target ||
    !sameEndpoint(decodeSchedulerEndpoint(requestRow.target), input.source) ||
    requestRow.correlation_id !== input.correlationID ||
    requestPayload.thread_id !== input.threadID
  ) {
    throw new SchedulerMessageConflictError({
      message: `Scheduler reply endpoints, correlation, or thread do not reverse request ${requestRow.id}.`,
      eventID: requestRow.id,
    })
  }
  const staleReversedTaskOccurrence = (
    endpoint: z.infer<typeof SchedulerEndpoint>,
    expectedStartedAt: number | null,
    currentStartedAt: number | null,
  ) => {
    if (endpoint.kind !== "task_scheduler" || expectedStartedAt === currentStartedAt) return
    if (expectedStartedAt === null || currentStartedAt === null) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler reply does not preserve the Task occurrence of request ${requestRow.id}.`,
        eventID: requestRow.id,
      })
    }
    throw new SchedulerTargetOccurrenceStaleError({
      message: `Scheduler reply to ${requestRow.id} targets stale Task ${endpoint.task_id} occurrence ${expectedStartedAt}; current occurrence is ${currentStartedAt}.`,
      taskID: endpoint.task_id,
      expectedStartedAt,
      currentStartedAt,
    })
  }
  staleReversedTaskOccurrence(
    input.source,
    requestPayload.target_task_occurrence_started_at,
    input.sourceTaskOccurrenceStartedAt,
  )
  staleReversedTaskOccurrence(
    input.target,
    requestPayload.source_task_occurrence_started_at,
    input.targetTaskOccurrenceStartedAt,
  )
  const existingReply = input.db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        eq(ProtocolEventTable.kind, "reply"),
        eq(ProtocolEventTable.reply_to, requestRow.id),
      ),
    )
    .get()
  if (existingReply) {
    throw new SchedulerMessageConflictError({
      message: `Scheduler request ${requestRow.id} already has reply ${existingReply.id}.`,
      eventID: existingReply.id,
    })
  }
}

function requireSourceOccurrence(
  db: Database.TxOrDb,
  input: {
    source: SchedulerEndpoint
    sourceMessageID?: string
    sourcePartID?: string
    sourceTerminalEventID?: string
  },
) {
  const hasMessage = Boolean(input.sourceMessageID || input.sourcePartID)
  const hasTerminal = Boolean(input.sourceTerminalEventID)
  if (hasMessage === hasTerminal) {
    throw new SchedulerMessageAuthorityError({
      message: `Scheduler message requires exactly one source occurrence: Message/Part or Task terminal event.`,
    })
  }
  if (hasMessage && (!input.sourceMessageID || !input.sourcePartID)) {
    throw new SchedulerMessageAuthorityError({
      message: `Scheduler Message source requires both source Message and exact Part identities.`,
    })
  }
  if (input.sourceMessageID) {
    const expectedSessionID =
      input.source.kind === "mission_scheduler" ? input.source.session_id : input.source.root_session_id
    const message = db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.id, input.sourceMessageID))
      .get()
    const sourceSessionAuthorized = (() => {
      if (!message) return false
      if (input.source.kind !== "task_scheduler") return message.sessionID === expectedSessionID
      let cursor: string | null | undefined = message.sessionID
      const visited = new Set<string>()
      while (cursor && !visited.has(cursor)) {
        if (cursor === input.source.root_session_id) return true
        visited.add(cursor)
        cursor = db
          .select({ parentID: SessionTable.parent_id })
          .from(SessionTable)
          .where(eq(SessionTable.id, cursor))
          .get()?.parentID
      }
      return false
    })()
    if (!message || !sourceSessionAuthorized) {
      throw new SchedulerMessageAuthorityError({
        message: `Scheduler source Message ${input.sourceMessageID} does not belong to source endpoint Session lineage ${expectedSessionID}.`,
      })
    }
    const sourceSession = db
      .select({ kind: SessionTable.kind })
      .from(SessionTable)
      .where(eq(SessionTable.id, message.sessionID))
      .get()
    if (input.source.kind === "task_scheduler" && sourceSession?.kind !== "orchestrator") {
      throw new SchedulerMessageAuthorityError({
        message: `Task scheduler source Message ${input.sourceMessageID} must belong to its Orchestrator Session, not ${sourceSession?.kind ?? "a missing Session"}.`,
      })
    }
    const messageData = message.data as { role?: unknown } | undefined
    if (messageData?.role !== "assistant") {
      throw new SchedulerMessageAuthorityError({
        message: `Scheduler source Message ${input.sourceMessageID} must be the assistant tool-call Message.`,
      })
    }
    if (input.sourcePartID) {
      const part = db
        .select({ id: PartTable.id })
        .from(PartTable)
        .where(
          and(
            eq(PartTable.id, input.sourcePartID),
            eq(PartTable.message_id, input.sourceMessageID),
            eq(PartTable.session_id, message.sessionID),
          ),
        )
        .get()
      if (!part) {
        throw new SchedulerMessageAuthorityError({
          message: `Scheduler source Part ${input.sourcePartID} does not belong to source Message ${input.sourceMessageID}.`,
        })
      }
    }
  }
  if (input.sourceTerminalEventID) {
    if (input.source.kind === "mission_scheduler") {
      throw new SchedulerMessageAuthorityError({
        message: `Mission scheduler cannot author a Task terminal occurrence.`,
      })
    }
    const event = db
      .select()
      .from(ProtocolEventTable)
      .where(eq(ProtocolEventTable.id, input.sourceTerminalEventID))
      .get()
    if (
      !event ||
      event.aggregate_type !== "task" ||
      event.aggregate_id !== input.source.task_id ||
      !["task.completed", "task.failed", "task.cancelled"].includes(event.type)
    ) {
      throw new SchedulerMessageAuthorityError({
        message: `Scheduler terminal source ${input.sourceTerminalEventID} does not belong to Task ${input.source.task_id}.`,
      })
    }
  }
}

function requireTaskSourceMessageOccurrence(
  db: Database.TxOrDb,
  input: { source: Extract<SchedulerEndpoint, { kind: "task_scheduler" }>; sourceMessageID: string },
): number {
  const message = db
    .select({ data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, input.sourceMessageID))
    .get()
  const taskIngress = z
    .object({
      role: z.literal("assistant"),
      taskIngress: z.object({ id: Identifier.schema("artifact"), kind: z.string().min(1) }).strict(),
    })
    .passthrough()
    .safeParse(message?.data)
  if (!taskIngress.success) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} has no exact Task ingress occurrence.`,
    })
  }
  const artifact = db
    .select({ taskID: EngineArtifactTable.task_id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.id, taskIngress.data.taskIngress.id),
        eq(EngineArtifactTable.kind, "queued_operator_wake"),
      ),
    )
    .get()
  if (!artifact || artifact.taskID !== input.source.task_id) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} names an ingress outside Task ${input.source.task_id}.`,
    })
  }
  const ingress = QueuedTaskIngressSchema.parse(artifact.payload)
  if (
    ingress.root_session_id !== input.source.root_session_id ||
    ingress.source_kind !== taskIngress.data.taskIngress.kind
  ) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} does not match its persisted Task ingress provenance.`,
    })
  }
  return ingress.task_occurrence_started_at
}

export function schedulerSourceBodyInTransaction(
  db: Database.TxOrDb,
  input: { source: SchedulerEndpoint; sourceMessageID?: string; sourcePartID?: string; sourceTerminalEventID?: string },
): string {
  requireSourceOccurrence(db, input)
  if (input.sourceTerminalEventID) {
    const event = db
      .select()
      .from(ProtocolEventTable)
      .where(eq(ProtocolEventTable.id, input.sourceTerminalEventID))
      .get()
    if (!event) throw new SchedulerMessageAuthorityError({ message: `Scheduler terminal source is missing.` })
    return JSON.stringify(event.payload ?? {})
  }
  const part = db.select({ data: PartTable.data }).from(PartTable).where(eq(PartTable.id, input.sourcePartID!)).get()
  const body = sourceBodyFromPartData(part?.data)
  if (!body?.trim()) {
    throw new SchedulerMessageAuthorityError({
      message: `Scheduler source Part ${input.sourcePartID} has no message body.`,
    })
  }
  return body
}

function parseDeliveryRow(row: typeof ProtocolInboxTable.$inferSelect) {
  return {
    id: row.id,
    envelopeID: row.envelope_id,
    actor: row.actor,
    actorID: row.actor_id,
    status: row.status,
    leaseOwner: row.lease_owner ?? undefined,
    leaseUntil: row.lease_until ?? undefined,
    attempt: row.attempt,
    visibleAt: row.visible_at,
    lastError: row.last_error ?? undefined,
    deliveryResult: row.delivery_result ? ProtocolInboxDeliveryResult.parse(row.delivery_result) : undefined,
    timeCompleted: row.time_completed ?? undefined,
  }
}

function requireDeliveryResultOccurrence(
  db: Database.TxOrDb,
  inbox: typeof ProtocolInboxTable.$inferSelect,
  result: z.infer<typeof ProtocolInboxDeliveryResult>,
) {
  if (result.kind === "dead_letter") return
  if (result.kind === "mission_closed") {
    const closure = requireMissionExecutionClosureEvent(result.closure_event_id)
    if (
      inbox.actor !== "session" ||
      closure.sessionID !== inbox.actor_id ||
      (closure.state !== "closing" && closure.state !== "closed")
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler inbox ${inbox.id} mission_closed result does not name an active closure for its recipient Mission Session.`,
        eventID: inbox.envelope_id,
      })
    }
    return
  }
  if (result.kind === "session_wake") {
    const message = db
      .select({ id: MessageTable.id, data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, result.message_id), eq(MessageTable.session_id, inbox.actor_id)))
      .get()
    const messageData = message?.data as
      | { extra?: { wake_reason?: { source?: string; eventID?: string; inboxID?: string } } }
      | undefined
    const reason = messageData?.extra?.wake_reason
    if (
      inbox.actor !== "session" ||
      !message ||
      reason?.source !== "scheduler.message" ||
      reason.eventID !== inbox.envelope_id ||
      reason.inboxID !== inbox.id
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler inbox ${inbox.id} session_wake result does not name its exact Message occurrence in the recipient Session.`,
        eventID: inbox.envelope_id,
      })
    }
    return
  }
  const message = db
    .select({ id: MessageTable.id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, result.message_id))
    .get()
  const ingress = db
    .select({
      id: EngineArtifactTable.id,
      taskID: EngineArtifactTable.task_id,
      kind: EngineArtifactTable.kind,
      payload: EngineArtifactTable.payload,
    })
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, result.ingress_id))
    .get()
  const messageData = message?.data as
    | {
        extra?: {
          task_root_message?: {
            taskID?: string
            kind?: string
            schedulerDelivery?: { eventID?: string; inboxID?: string }
          }
        }
      }
    | undefined
  const ingressPayload = ingress?.payload as
    | {
        message_id?: string
        source_kind?: string
        event?: {
          rootMessage?: {
            messageID?: string
            kind?: string
            schedulerDelivery?: { eventID?: string; inboxID?: string }
          }
        }
      }
    | undefined
  const provenance = messageData?.extra?.task_root_message
  const rootMessage = ingressPayload?.event?.rootMessage
  if (
    inbox.actor !== "task" ||
    !message ||
    !ingress ||
    ingress.taskID !== inbox.actor_id ||
    ingress.kind !== "queued_operator_wake" ||
    provenance?.taskID !== inbox.actor_id ||
    provenance.schedulerDelivery?.eventID !== inbox.envelope_id ||
    provenance.schedulerDelivery.inboxID !== inbox.id ||
    ingressPayload?.message_id !== result.message_id ||
    !["mission_message", "orchestrator_message"].includes(ingressPayload?.source_kind ?? "") ||
    rootMessage?.messageID !== result.message_id ||
    rootMessage.schedulerDelivery?.eventID !== inbox.envelope_id ||
    rootMessage.schedulerDelivery.inboxID !== inbox.id
  ) {
    throw new SchedulerMessageConflictError({
      message: `Scheduler inbox ${inbox.id} task_ingress result does not name its exact Message and queued ingress occurrence in the recipient Task.`,
      eventID: inbox.envelope_id,
    })
  }
}

export function enqueueSchedulerMessageInTransaction(
  db: Database.TxOrDb,
  input: {
    invocationID: string
    kind: z.input<typeof SchedulerMessageKind>
    source: z.input<typeof SchedulerEndpoint>
    target: z.input<typeof SchedulerEndpoint>
    subject: string
    sourceMessageID?: string
    sourcePartID?: string
    sourceTerminalEventID?: string
    correlationID?: string
    threadID?: string
    replyTo?: string
    now?: number
  },
): SchedulerDeliveryReceipt {
  Database.requireActiveTransaction("enqueueSchedulerMessageInTransaction")
  const source = SchedulerEndpoint.parse(input.source)
  const target = SchedulerEndpoint.parse(input.target)
  const kind = SchedulerMessageKind.parse(input.kind)
  requireEndpointAuthority(db, source, target)
  const sourceBody = schedulerSourceBodyInTransaction(db, {
    source,
    sourceMessageID: input.sourceMessageID,
    sourcePartID: input.sourcePartID,
    sourceTerminalEventID: input.sourceTerminalEventID,
  })
  const sourceBodySHA256 = createHash("sha256").update(sourceBody).digest("hex")
  const correlationID = input.correlationID?.trim() || input.invocationID
  const threadID = input.threadID?.trim() || correlationID
  const { eventID, inboxID } = schedulerDeliveryIdentity({
    invocationID: input.invocationID,
    kind,
    source,
    target,
  })
  const recipient = endpointRecipient(target)
  const expectedEventKind = kind === "request" ? "command" : kind === "reply" ? "reply" : "event"
  const expectedSessionID = target.kind === "mission_scheduler" ? target.session_id : target.root_session_id
  const expectedCausationID = input.replyTo ?? input.sourceTerminalEventID ?? null
  const existingInbox = db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, inboxID)).get()
  const existingEvent = db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, eventID)).get()
  if (existingInbox || existingEvent) {
    if (
      !existingInbox ||
      !existingEvent ||
      existingInbox.envelope_id !== eventID ||
      existingInbox.actor !== recipient.actor ||
      existingInbox.actor_id !== recipient.actorID ||
      existingEvent.kind !== expectedEventKind ||
      existingEvent.type !== SCHEDULER_MESSAGE_EVENT_TYPE ||
      existingEvent.aggregate_type !== recipient.aggregate ||
      existingEvent.aggregate_id !== recipient.aggregateID ||
      existingEvent.task_id !== null ||
      existingEvent.session_id !== expectedSessionID ||
      existingEvent.source !== encodeSchedulerEndpoint(source) ||
      existingEvent.target !== encodeSchedulerEndpoint(target) ||
      existingEvent.correlation_id !== correlationID ||
      existingEvent.causation_id !== expectedCausationID ||
      existingEvent.reply_to !== (input.replyTo ?? null)
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler invocation ${input.invocationID} conflicts with its persisted delivery.`,
        eventID,
      })
    }
    const parsedPayload = SchedulerMessagePayload.safeParse(existingEvent.payload)
    if (!parsedPayload.success) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler invocation ${input.invocationID} conflicts with its persisted delivery.`,
        eventID,
      })
    }
    const payload = parsedPayload.data
    if (
      payload.invocation_id !== input.invocationID ||
      payload.message_kind !== kind ||
      payload.thread_id !== threadID ||
      payload.subject !== input.subject ||
      payload.source_message_id !== input.sourceMessageID ||
      payload.source_part_id !== input.sourcePartID ||
      payload.source_terminal_event_id !== input.sourceTerminalEventID ||
      payload.source_body_sha256 !== sourceBodySHA256
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler invocation ${input.invocationID} was replayed with different content.`,
        eventID,
      })
    }
    return {
      eventID,
      inboxID,
      threadID: payload.thread_id,
      status: existingInbox.status,
      replayed: true,
    }
  }
  let sourceTaskOccurrenceStartedAt: number | null = null
  if (source.kind === "task_scheduler") {
    const sourceTask = requireTaskEndpoint(db, source)
    if (input.sourceMessageID && !isTaskActive(sourceTask)) {
      throw new SchedulerMessageAuthorityError({
        message: `Scheduler Message source requires active Task ${sourceTask.id} (status=${deriveTaskStatus(sourceTask)}).`,
      })
    }
    sourceTaskOccurrenceStartedAt = input.sourceMessageID
      ? requireTaskSourceMessageOccurrence(db, { source, sourceMessageID: input.sourceMessageID })
      : sourceTask.time_started
    if (input.sourceMessageID && sourceTaskOccurrenceStartedAt !== sourceTask.time_started) {
      throw new SchedulerMessageAuthorityError({
        message:
          `Scheduler source Message ${input.sourceMessageID} belongs to Task ${sourceTask.id} occurrence ` +
          `${sourceTaskOccurrenceStartedAt}, not current occurrence ${sourceTask.time_started}.`,
      })
    }
  }
  const targetTask = target.kind === "task_scheduler" ? requireTaskTargetActive(db, target) : undefined
  const targetTaskOccurrenceStartedAt = targetTask?.time_started ?? null
  requireReplyAuthority({
    db,
    kind,
    source,
    target,
    replyTo: input.replyTo,
    correlationID,
    threadID,
    sourceTaskOccurrenceStartedAt,
    targetTaskOccurrenceStartedAt,
  })

  const now = input.now ?? Date.now()
  const payload = SchedulerMessagePayload.parse({
    protocol: "scheduler-message-v2",
    invocation_id: input.invocationID,
    message_kind: kind,
    thread_id: threadID,
    source_message_id: input.sourceMessageID,
    source_part_id: input.sourcePartID,
    source_terminal_event_id: input.sourceTerminalEventID,
    source_task_occurrence_started_at: sourceTaskOccurrenceStartedAt,
    target_task_occurrence_started_at: targetTaskOccurrenceStartedAt,
    source_body_sha256: sourceBodySHA256,
    subject: input.subject,
  })
  ProtocolStore.appendEventInTransaction({
    id: eventID,
    kind: expectedEventKind,
    type: SCHEDULER_MESSAGE_EVENT_TYPE,
    aggregate: recipient.aggregate,
    aggregate_id: recipient.aggregateID,
    // Scheduler endpoint encoding is the immutable Task identity. Keeping this
    // optional projection null prevents physical Task deletion from cascading
    // away the scheduler audit event and its typed inbox disposition.
    task_id: null,
    session_id: expectedSessionID,
    source: encodeSchedulerEndpoint(source),
    target: encodeSchedulerEndpoint(target),
    correlation_id: correlationID,
    causation_id: expectedCausationID,
    reply_to: input.replyTo ?? null,
    emitted_at: now,
    payload,
  })
  db.insert(ProtocolInboxTable)
    .values({
      id: inboxID,
      envelope_id: eventID,
      actor: recipient.actor,
      actor_id: recipient.actorID,
      status: "pending",
      attempt: 0,
      visible_at: now,
      delivery_result: null,
      time_completed: null,
      time_created: now,
      time_updated: now,
    })
    .run()
  return {
    eventID,
    inboxID,
    threadID,
    status: "pending",
    replayed: false,
  }
}

export function findSchedulerDelivery(inboxID: string) {
  const row = Database.use((db) => db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, inboxID)).get())
  if (!row) return undefined
  const event = ProtocolStore.requireEvent(row.envelope_id)
  if (event.type !== SCHEDULER_MESSAGE_EVENT_TYPE || !event.target) {
    throw new Error(`Protocol inbox ${inboxID} does not reference a scheduler message`)
  }
  return {
    ...parseDeliveryRow(row),
    event,
    source: decodeSchedulerEndpoint(event.source),
    target: decodeSchedulerEndpoint(event.target),
    message: SchedulerMessagePayload.parse(event.payload),
  }
}

export function requireSchedulerDelivery(inboxID: string) {
  const delivery = findSchedulerDelivery(inboxID)
  if (!delivery) throw new Error(`Scheduler delivery not found: ${inboxID}`)
  return delivery
}

export function claimNextSchedulerDelivery(input: {
  actor: "task" | "session"
  actorID: string
  ownerID: string
  leaseMilliseconds: number
  now?: number
}) {
  const now = input.now ?? Date.now()
  return Database.immediateTransaction((db) => {
    const row = db
      .select()
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .where(
        and(
          eq(ProtocolInboxTable.actor, input.actor),
          eq(ProtocolInboxTable.actor_id, input.actorID),
          or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
      .get()
    if (!row) return undefined
    if (row.protocol_inbox.visible_at > now) return undefined
    if (
      row.protocol_inbox.status === "leased" &&
      row.protocol_inbox.lease_until !== null &&
      row.protocol_inbox.lease_until > now
    ) {
      return undefined
    }
    const claimed = db
      .update(ProtocolInboxTable)
      .set({
        status: "leased",
        lease_owner: input.ownerID,
        lease_until: now + input.leaseMilliseconds,
        attempt: sql`${ProtocolInboxTable.attempt} + 1`,
        time_updated: now,
      })
      .where(
        and(
          eq(ProtocolInboxTable.id, row.protocol_inbox.id),
          or(
            eq(ProtocolInboxTable.status, "pending"),
            and(eq(ProtocolInboxTable.status, "leased"), lte(ProtocolInboxTable.lease_until, now)),
          ),
        ),
      )
      .returning()
      .get()
    return claimed ? parseDeliveryRow(claimed) : undefined
  })
}

export function settleSchedulerDeliveryInTransaction(
  db: Database.TxOrDb,
  input: { inboxID: string; ownerID: string; result: z.input<typeof ProtocolInboxDeliveryResult>; now?: number },
) {
  Database.requireActiveTransaction("settleSchedulerDeliveryInTransaction")
  const now = input.now ?? Date.now()
  const result = ProtocolInboxDeliveryResult.parse(input.result)
  const current = db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, input.inboxID)).get()
  if (!current) throw new Error(`Scheduler delivery not found: ${input.inboxID}`)
  requireDeliveryResultOccurrence(db, current, result)
  const updated = db
    .update(ProtocolInboxTable)
    .set({
      status: result.kind === "dead_letter" ? "dead_letter" : "delivered",
      delivery_result: result,
      time_completed: now,
      lease_owner: null,
      lease_until: null,
      last_error: result.kind === "dead_letter" ? result.message : null,
      time_updated: now,
    })
    .where(
      and(
        eq(ProtocolInboxTable.id, input.inboxID),
        eq(ProtocolInboxTable.status, "leased"),
        eq(ProtocolInboxTable.lease_owner, input.ownerID),
      ),
    )
    .returning()
    .get()
  if (!updated) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
  return parseDeliveryRow(updated)
}

export function renewSchedulerDeliveryLease(input: {
  inboxID: string
  ownerID: string
  leaseMilliseconds: number
  now?: number
}) {
  const now = input.now ?? Date.now()
  return Database.immediateTransaction((db) => {
    const updated = db
      .update(ProtocolInboxTable)
      .set({ lease_until: now + input.leaseMilliseconds, time_updated: now })
      .where(
        and(
          eq(ProtocolInboxTable.id, input.inboxID),
          eq(ProtocolInboxTable.status, "leased"),
          eq(ProtocolInboxTable.lease_owner, input.ownerID),
        ),
      )
      .returning()
      .get()
    if (!updated) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
    return parseDeliveryRow(updated)
  })
}

export function deadLetterSchedulerDelivery(input: { inboxID: string; ownerID: string; error: unknown; now?: number }) {
  const error = input.error instanceof Error ? input.error : new Error(String(input.error))
  return Database.immediateTransaction((db) =>
    settleSchedulerDeliveryInTransaction(db, {
      inboxID: input.inboxID,
      ownerID: input.ownerID,
      result: { kind: "dead_letter", error_name: error.name || "Error", message: error.message },
      now: input.now,
    }),
  )
}

export function rescheduleSchedulerDelivery(input: {
  inboxID: string
  ownerID: string
  error: unknown
  visibleAt: number
  now?: number
}) {
  const now = input.now ?? Date.now()
  const error = input.error instanceof Error ? input.error.message : String(input.error)
  return Database.immediateTransaction((db) => {
    const updated = db
      .update(ProtocolInboxTable)
      .set({
        status: "pending",
        lease_owner: null,
        lease_until: null,
        visible_at: input.visibleAt,
        last_error: error,
        time_updated: now,
      })
      .where(
        and(
          eq(ProtocolInboxTable.id, input.inboxID),
          eq(ProtocolInboxTable.status, "leased"),
          eq(ProtocolInboxTable.lease_owner, input.ownerID),
        ),
      )
      .returning()
      .get()
    if (!updated) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
    return parseDeliveryRow(updated)
  })
}

export function deadLetterSchedulerSessionDeliveriesInTransaction(
  db: Database.TxOrDb,
  input: { sessionIDs: readonly string[]; errorName: string; message: string; now?: number },
): number {
  Database.requireActiveTransaction("deadLetterSchedulerSessionDeliveriesInTransaction")
  if (input.sessionIDs.length === 0) return 0
  const now = input.now ?? Date.now()
  return db
    .update(ProtocolInboxTable)
    .set({
      status: "dead_letter",
      delivery_result: {
        kind: "dead_letter",
        error_name: input.errorName,
        message: input.message,
      },
      time_completed: now,
      lease_owner: null,
      lease_until: null,
      last_error: input.message,
      time_updated: now,
    })
    .where(
      and(
        eq(ProtocolInboxTable.actor, "session"),
        inArray(ProtocolInboxTable.actor_id, [...input.sessionIDs]),
        or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
      ),
    )
    .returning({ id: ProtocolInboxTable.id })
    .all().length
}

export function deadLetterSchedulerTaskDeliveriesInTransaction(
  db: Database.TxOrDb,
  input: { taskIDs: readonly string[]; errorName: string; message: string; now?: number },
): number {
  Database.requireActiveTransaction("deadLetterSchedulerTaskDeliveriesInTransaction")
  if (input.taskIDs.length === 0) return 0
  const now = input.now ?? Date.now()
  return db
    .update(ProtocolInboxTable)
    .set({
      status: "dead_letter",
      delivery_result: {
        kind: "dead_letter",
        error_name: input.errorName,
        message: input.message,
      },
      time_completed: now,
      lease_owner: null,
      lease_until: null,
      last_error: input.message,
      time_updated: now,
    })
    .where(
      and(
        eq(ProtocolInboxTable.actor, "task"),
        inArray(ProtocolInboxTable.actor_id, [...input.taskIDs]),
        or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
      ),
    )
    .returning({ id: ProtocolInboxTable.id })
    .all().length
}

export function deadLetterSchedulerSourceDeliveriesInTransaction(
  db: Database.TxOrDb,
  input: { sessionIDs: readonly string[]; errorName: string; message: string; now?: number },
): number {
  Database.requireActiveTransaction("deadLetterSchedulerSourceDeliveriesInTransaction")
  if (input.sessionIDs.length === 0) return 0
  const now = input.now ?? Date.now()
  const sourceMessageIDs = db
    .select({ id: MessageTable.id })
    .from(MessageTable)
    .where(inArray(MessageTable.session_id, [...input.sessionIDs]))
    .all()
    .map((row) => row.id)
  if (sourceMessageIDs.length === 0) return 0
  const sourceEventIDs = db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        inArray(sql`json_extract(${ProtocolEventTable.payload}, '$.source_message_id')`, sourceMessageIDs),
      ),
    )
    .all()
    .map((row) => row.id)
  if (sourceEventIDs.length === 0) return 0
  return db
    .update(ProtocolInboxTable)
    .set({
      status: "dead_letter",
      delivery_result: {
        kind: "dead_letter",
        error_name: input.errorName,
        message: input.message,
      },
      time_completed: now,
      lease_owner: null,
      lease_until: null,
      last_error: input.message,
      time_updated: now,
    })
    .where(
      and(
        inArray(ProtocolInboxTable.envelope_id, sourceEventIDs),
        or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
      ),
    )
    .returning({ id: ProtocolInboxTable.id })
    .all().length
}

export function detachProtocolEventsFromDeletedTasksInTransaction(
  db: Database.TxOrDb,
  taskIDs: readonly string[],
): number {
  Database.requireActiveTransaction("detachProtocolEventsFromDeletedTasksInTransaction")
  if (taskIDs.length === 0) return 0
  return db
    .update(ProtocolEventTable)
    .set({ task_id: null })
    .where(inArray(ProtocolEventTable.task_id, [...taskIDs]))
    .returning({ id: ProtocolEventTable.id })
    .all().length
}

export function listPendingSchedulerRecipientIDs(input: {
  actor: "task" | "session"
  projectID?: string
  now?: number
}): string[] {
  const now = input.now ?? Date.now()
  return Database.use((db) => {
    const eligible = and(
      eq(ProtocolInboxTable.actor, input.actor),
      lte(ProtocolInboxTable.visible_at, now),
      or(
        eq(ProtocolInboxTable.status, "pending"),
        and(eq(ProtocolInboxTable.status, "leased"), lte(ProtocolInboxTable.lease_until, now)),
      ),
      eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
    )
    if (input.actor === "session") {
      return db
        .selectDistinct({ actorID: ProtocolInboxTable.actor_id })
        .from(ProtocolInboxTable)
        .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
        .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
        .where(and(eligible, ...(input.projectID ? [eq(SessionTable.project_id, input.projectID)] : [])))
        .all()
        .map((row) => row.actorID)
    }
    return db
      .selectDistinct({ actorID: ProtocolInboxTable.actor_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
      .where(and(eligible, ...(input.projectID ? [eq(EngineTaskTable.project_id, input.projectID)] : [])))
      .all()
      .map((row) => row.actorID)
  })
}

export function listPendingSchedulerProjectIDs(): string[] {
  return Database.use((db) => {
    const incomplete = and(
      or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
      eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
    )
    const sessions = db
      .selectDistinct({ projectID: SessionTable.project_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
      .where(and(incomplete, eq(ProtocolInboxTable.actor, "session")))
      .all()
    const tasks = db
      .selectDistinct({ projectID: EngineTaskTable.project_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
      .where(and(incomplete, eq(ProtocolInboxTable.actor, "task")))
      .all()
    const unansweredWakes = db
      .selectDistinct({ projectID: SessionTable.project_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
      .where(
        and(
          eq(ProtocolInboxTable.actor, "session"),
          eq(ProtocolInboxTable.status, "delivered"),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
          sql`json_extract(${ProtocolInboxTable.delivery_result}, '$.kind') = 'session_wake'`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${MessageTable}
            WHERE ${MessageTable.session_id} = ${ProtocolInboxTable.actor_id}
              AND json_extract(${MessageTable.data}, '$.role') = 'assistant'
              AND json_extract(${MessageTable.data}, '$.parentID') = json_extract(${ProtocolInboxTable.delivery_result}, '$.message_id')
              AND json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL
              AND json_extract(${MessageTable.data}, '$.error') IS NULL
          )`,
        ),
      )
      .all()
    return [...new Set([...sessions, ...tasks, ...unansweredWakes].map((row) => row.projectID))]
  })
}

export function nextSchedulerDeliveryDueAt(projectID: string): number | undefined {
  return Database.use((db) => {
    const sessionRows = db
      .select({
        actorID: ProtocolInboxTable.actor_id,
        status: ProtocolInboxTable.status,
        visibleAt: ProtocolInboxTable.visible_at,
        leaseUntil: ProtocolInboxTable.lease_until,
        sequence: ProtocolEventTable.seq,
      })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
      .where(
        and(
          eq(SessionTable.project_id, projectID),
          eq(ProtocolInboxTable.actor, "session"),
          or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
    const taskRows = db
      .select({
        actorID: ProtocolInboxTable.actor_id,
        status: ProtocolInboxTable.status,
        visibleAt: ProtocolInboxTable.visible_at,
        leaseUntil: ProtocolInboxTable.lease_until,
        sequence: ProtocolEventTable.seq,
      })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
      .where(
        and(
          eq(EngineTaskTable.project_id, projectID),
          eq(ProtocolInboxTable.actor, "task"),
          or(eq(ProtocolInboxTable.status, "pending"), eq(ProtocolInboxTable.status, "leased")),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
    const heads = [...sessionRows, ...taskRows].filter(
      (row, index, rows) => rows.findIndex((candidate) => candidate.actorID === row.actorID) === index,
    )
    const due = heads.map((row) =>
      row.status === "leased" ? Math.max(row.visibleAt, row.leaseUntil ?? row.visibleAt) : row.visibleAt,
    )
    return due.length > 0 ? Math.min(...due) : undefined
  })
}

export function listUnansweredSchedulerSessionWakes(projectID: string): Array<{
  sessionID: string
  messageID: string
}> {
  return Database.use((db) =>
    db
      .select({
        sessionID: ProtocolInboxTable.actor_id,
        deliveryResult: ProtocolInboxTable.delivery_result,
        sequence: ProtocolEventTable.seq,
        eventID: ProtocolEventTable.id,
      })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
      .where(
        and(
          eq(SessionTable.project_id, projectID),
          eq(ProtocolInboxTable.actor, "session"),
          eq(ProtocolInboxTable.status, "delivered"),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
          sql`json_extract(${ProtocolInboxTable.delivery_result}, '$.kind') = 'session_wake'`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${MessageTable}
            WHERE ${MessageTable.session_id} = ${ProtocolInboxTable.actor_id}
              AND json_extract(${MessageTable.data}, '$.role') = 'assistant'
              AND json_extract(${MessageTable.data}, '$.parentID') = json_extract(${ProtocolInboxTable.delivery_result}, '$.message_id')
              AND json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL
              AND json_extract(${MessageTable.data}, '$.error') IS NULL
          )`,
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
      .flatMap((row) => {
        const result = row.deliveryResult ? ProtocolInboxDeliveryResult.safeParse(row.deliveryResult) : undefined
        return result?.success && result.data.kind === "session_wake"
          ? [{ sessionID: row.sessionID, messageID: result.data.message_id }]
          : []
      }),
  )
}

export const SchedulerMessageProtocol = {
  eventType: SCHEDULER_MESSAGE_EVENT_TYPE,
}
