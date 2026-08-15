import { createHash } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import {
  EngineControlActivationLeaseTable,
  EngineTaskRootIngressTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { deriveTaskStatus, isTaskActive } from "@/engine/task-status"
import { Identifier } from "@/id/id"
import { MessageTable, PartTable, ToolPartRequestTable, SessionControlRecordTable, SessionTable } from "@/session/session.sql"
import { Message } from "@/session/message"
import { and, asc, Database, eq, inArray, sql } from "@/storage/db"
import { TaskCreatorMetadata } from "@/task-api/task-creator"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "./protocol.sql"
import { projectProtocolDeliveryInTransaction, type ProtocolDeliveryRow } from "./delivery-projection"
import { acquireControlLease, currentControlLeaseInTransaction, renewControlLease } from "@/engine/control-lease"
import {
  ProtocolInboxDeliveryResult,
  SchedulerEndpoint,
  SchedulerMessageKind,
  SchedulerMessagePayload,
  type ProtocolAggregate,
} from "./schema"
import { ProtocolStore } from "./store"
import { currentMissionExecutionClosure, requireMissionExecutionClosureEvent } from "@/mission/execution-closure"
import { assertTaskNotDeletedInTransaction, projectTaskRowInTransaction, type TaskRow } from "@/engine/store"
import {
  schedulerWakeMessageMatchesInTransaction,
  successfulSchedulerWakeReplyExistsInTransaction,
} from "./session-wake-state"

const SCHEDULER_MESSAGE_EVENT_TYPE = "scheduler.message"
const ENDPOINT_PREFIX = "scheduler-endpoint:"

function sourceBodyFromPartData(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined
  const part = data as { type?: unknown; tool?: unknown; input?: { message?: unknown }; state?: { input?: { message?: unknown } }; text?: unknown }
  if (
    (part.type === "tool-request" || part.type === "tool") &&
    part.tool === "scheduler_message" &&
    typeof (part.input?.message ?? part.state?.input?.message) === "string"
  ) {
    return (part.input?.message ?? part.state?.input?.message) as string
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
    expectedEpoch: z.number().int().positive(),
    currentEpoch: z.number().int().positive(),
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
  const task = Database.use((db) => {
    const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
    if (row) assertTaskNotDeletedInTransaction(db, taskID)
    return row
  })
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
  const task = Database.use((db) => {
    const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
    if (row) assertTaskNotDeletedInTransaction(db, taskID)
    return row
  })
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
  return projectTaskRowInTransaction(db, task)
}

function missionOwner(task: Pick<TaskRow, "metadata">): { missionID: string; sessionID: string } | undefined {
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
  sourceTaskExecutionEpoch: number | null
  targetTaskExecutionEpoch: number | null
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
    expectedEpoch: number | null,
    currentEpoch: number | null,
  ) => {
    if (endpoint.kind !== "task_scheduler" || expectedEpoch === currentEpoch) return
    if (expectedEpoch === null || currentEpoch === null) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler reply does not preserve the Task occurrence of request ${requestRow.id}.`,
        eventID: requestRow.id,
      })
    }
    throw new SchedulerTargetOccurrenceStaleError({
      message: `Scheduler reply to ${requestRow.id} targets stale Task ${endpoint.task_id} epoch ${expectedEpoch}; current epoch is ${currentEpoch}.`,
      taskID: endpoint.task_id,
      expectedEpoch,
      currentEpoch,
    })
  }
  staleReversedTaskOccurrence(
    input.source,
    requestPayload.target_task_execution_epoch,
    input.sourceTaskExecutionEpoch,
  )
  staleReversedTaskOccurrence(
    input.target,
    requestPayload.source_task_execution_epoch,
    input.targetTaskExecutionEpoch,
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
          ),
        )
        .get() ?? db.select({ id: ToolPartRequestTable.id }).from(ToolPartRequestTable).where(and(
          eq(ToolPartRequestTable.id, input.sourcePartID),
          eq(ToolPartRequestTable.message_id, input.sourceMessageID),
        )).get()
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
  const assistant = Message.Assistant.safeParse(message?.data)
  if (!assistant.success || !assistant.data.activationID) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} has no exact Task ingress occurrence.`,
    })
  }
  const lease = db.select().from(EngineControlActivationLeaseTable)
    .where(and(
      eq(EngineControlActivationLeaseTable.id, assistant.data.activationID),
      eq(EngineControlActivationLeaseTable.target, "task_root_ingress"),
    )).get()
  const ingress = lease
    ? db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, lease.target_id)).get()
    : undefined
  if (!ingress || ingress.task_id !== input.source.task_id) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} names an ingress outside Task ${input.source.task_id}.`,
    })
  }
  const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, ingress.task_id)).get()
  if (task?.session_id !== input.source.root_session_id) {
    throw new SchedulerMessageAuthorityError({
      message: `Task scheduler source Message ${input.sourceMessageID} does not match its persisted Task ingress provenance.`,
    })
  }
  return ingress.execution_epoch
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
  const part = db.select({ data: ToolPartRequestTable.data }).from(ToolPartRequestTable)
    .where(eq(ToolPartRequestTable.id, input.sourcePartID!)).get()
    ?? db.select({ data: PartTable.data }).from(PartTable).where(eq(PartTable.id, input.sourcePartID!)).get()
  const body = sourceBodyFromPartData(part?.data)
  if (!body?.trim()) {
    throw new SchedulerMessageAuthorityError({
      message: `Scheduler source Part ${input.sourcePartID} has no message body.`,
    })
  }
  return body
}

function parseDeliveryRow(row: ProtocolDeliveryRow) {
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
  inbox: ProtocolDeliveryRow,
  result: z.infer<typeof ProtocolInboxDeliveryResult>,
) {
  if (result.kind === "dead_letter") return
  if (result.kind === "mission_closed") {
    const closure = requireMissionExecutionClosureEvent(result.closure_event_id)
    const currentClosure = currentMissionExecutionClosure(inbox.actor_id)
    if (
      inbox.actor !== "session" ||
      closure.sessionID !== inbox.actor_id ||
      (closure.state !== "closing" && closure.state !== "closed") ||
      currentClosure?.operationID !== closure.operationID
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler inbox ${inbox.id} mission_closed result does not name an active closure for its recipient Mission Session.`,
        eventID: inbox.envelope_id,
      })
    }
    return
  }
  if (result.kind === "session_wake" || result.kind === "mission_wake_closed") {
    if (
      inbox.actor !== "session" ||
      !schedulerWakeMessageMatchesInTransaction(db, {
        sessionID: inbox.actor_id,
        messageID: result.message_id,
        eventID: inbox.envelope_id,
        inboxID: inbox.id,
      })
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler inbox ${inbox.id} ${result.kind} result does not name its exact Message occurrence in the recipient Session.`,
        eventID: inbox.envelope_id,
      })
    }
    if (result.kind === "mission_wake_closed") {
      const closure = requireMissionExecutionClosureEvent(result.closure_event_id)
      const currentClosure = currentMissionExecutionClosure(inbox.actor_id)
      if (
        closure.sessionID !== inbox.actor_id ||
        (closure.state !== "closing" && closure.state !== "closed") ||
        currentClosure?.operationID !== closure.operationID
      ) {
        throw new SchedulerMessageConflictError({
          message: `Scheduler inbox ${inbox.id} mission_wake_closed result does not name an active closure for its recipient Mission Session.`,
          eventID: inbox.envelope_id,
        })
      }
    }
    return
  }
  const message = db
    .select({ id: MessageTable.id, data: MessageTable.data })
    .from(MessageTable)
    .where(eq(MessageTable.id, result.message_id))
    .get()
  const ingress = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(eq(EngineTaskRootIngressTable.id, result.ingress_id))
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
  const provenance = messageData?.extra?.task_root_message
  if (
    inbox.actor !== "task" ||
    !message ||
    !ingress ||
    ingress.task_id !== inbox.actor_id ||
    ingress.source !== "message" ||
    ingress.source_id !== result.message_id ||
    provenance?.taskID !== inbox.actor_id ||
    provenance.schedulerDelivery?.eventID !== inbox.envelope_id ||
    provenance.schedulerDelivery.inboxID !== inbox.id ||
    !["mission", "orchestrator"].includes(provenance.kind ?? "")
  ) {
    throw new SchedulerMessageConflictError({
      message: `Scheduler inbox ${inbox.id} task_ingress result does not name its exact Message and accepted ingress occurrence in the recipient Task.`,
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
  let sourceTaskExecutionEpoch: number | null = null
  if (source.kind === "task_scheduler") {
    const sourceTask = requireTaskEndpoint(db, source)
    if (input.sourceMessageID && !isTaskActive(sourceTask)) {
      throw new SchedulerMessageAuthorityError({
        message: `Scheduler Message source requires active Task ${sourceTask.id} (status=${deriveTaskStatus(sourceTask)}).`,
      })
    }
    sourceTaskExecutionEpoch = input.sourceMessageID
      ? requireTaskSourceMessageOccurrence(db, { source, sourceMessageID: input.sourceMessageID })
      : taskLifecycleProjectionInTransaction(db, sourceTask.id).epoch
    const currentSourceEpoch = taskLifecycleProjectionInTransaction(db, sourceTask.id).epoch
    if (input.sourceMessageID && sourceTaskExecutionEpoch !== currentSourceEpoch) {
      throw new SchedulerMessageAuthorityError({
        message:
          `Scheduler source Message ${input.sourceMessageID} belongs to Task ${sourceTask.id} epoch ` +
          `${sourceTaskExecutionEpoch}, not current epoch ${currentSourceEpoch}.`,
      })
    }
  }
  const targetTask = target.kind === "task_scheduler" ? requireTaskTargetActive(db, target) : undefined
  const targetTaskExecutionEpoch = targetTask ? taskLifecycleProjectionInTransaction(db, targetTask.id).epoch : null
  requireReplyAuthority({
    db,
    kind,
    source,
    target,
    replyTo: input.replyTo,
    correlationID,
    threadID,
    sourceTaskExecutionEpoch,
    targetTaskExecutionEpoch,
  })
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
      payload.source_task_execution_epoch !== sourceTaskExecutionEpoch ||
      payload.target_task_execution_epoch !== targetTaskExecutionEpoch ||
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
      status: projectProtocolDeliveryInTransaction(db, existingInbox).status,
      replayed: true,
    }
  }
  const now = input.now ?? Date.now()
  const payload = SchedulerMessagePayload.parse({
    protocol: "scheduler-message-v3",
    invocation_id: input.invocationID,
    message_kind: kind,
    thread_id: threadID,
    source_message_id: input.sourceMessageID,
    source_part_id: input.sourcePartID,
    source_terminal_event_id: input.sourceTerminalEventID,
    source_task_execution_epoch: sourceTaskExecutionEpoch,
    target_task_execution_epoch: targetTaskExecutionEpoch,
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
      visible_at: now,
      time_created: now,
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
  const row = Database.use((db) => {
    const persisted = db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, inboxID)).get()
    return persisted ? projectProtocolDeliveryInTransaction(db, persisted) : undefined
  })
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
  const row = Database.use((db) => {
    const rows = db
      .select()
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .where(
        and(
          eq(ProtocolInboxTable.actor, input.actor),
          eq(ProtocolInboxTable.actor_id, input.actorID),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
      .all()
    return rows.map((candidate) => projectProtocolDeliveryInTransaction(db, candidate.protocol_inbox, now)).find((candidate) => candidate.status === "pending" && candidate.visible_at <= now)
  })
  if (!row) return undefined
  const acquired = acquireControlLease({ target: "protocol_delivery", targetID: row.id, ownerOccurrenceID: input.ownerID, now, leaseMilliseconds: input.leaseMilliseconds })
  return acquired.acquired ? parseDeliveryRow(Database.use((db) => projectProtocolDeliveryInTransaction(db, db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, row.id)).get()!, now))) : undefined
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
  const projected = projectProtocolDeliveryInTransaction(db, current, now)
  requireDeliveryResultOccurrence(db, projected, result)
  const terminal = db.select().from(ProtocolDeliveryReceiptTable)
    .where(and(eq(ProtocolDeliveryReceiptTable.inbox_id, input.inboxID), sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') <> 'retry_wait'`)).get()
  if (terminal) {
    if (JSON.stringify(terminal.receipt) !== JSON.stringify(result)) {
      throw new Error(`Scheduler delivery ${input.inboxID} conflicts with its immutable terminal receipt`)
    }
    return parseDeliveryRow(projectProtocolDeliveryInTransaction(db, current, now))
  }
  const lease = currentControlLeaseInTransaction(db, "protocol_delivery", input.inboxID)
  if (!lease || lease.owner_occurrence_id !== input.ownerID || lease.expires_at <= now) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
  db.insert(ProtocolDeliveryReceiptTable).values({ id: Identifier.ascending("protocol_inbox"), inbox_id: input.inboxID, receipt: result, time_created: now }).run()
  return parseDeliveryRow(projectProtocolDeliveryInTransaction(db, current, now))
}

export function renewSchedulerDeliveryLease(input: {
  inboxID: string
  ownerID: string
  leaseMilliseconds: number
  now?: number
}) {
  const now = input.now ?? Date.now()
  const lease = Database.use((db) => currentControlLeaseInTransaction(db, "protocol_delivery", input.inboxID))
  if (!lease || lease.owner_occurrence_id !== input.ownerID || lease.expires_at <= now) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
  renewControlLease({ target: "protocol_delivery", targetID: input.inboxID, leaseID: lease.id, ownerOccurrenceID: input.ownerID, now, expiresAt: now + input.leaseMilliseconds })
  return findSchedulerDelivery(input.inboxID)!
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
    const current = db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, input.inboxID)).get()
    const lease = currentControlLeaseInTransaction(db, "protocol_delivery", input.inboxID)
    if (!current || !lease || lease.owner_occurrence_id !== input.ownerID || lease.expires_at <= now) throw new Error(`Scheduler delivery ${input.inboxID} is not leased by ${input.ownerID}`)
    db.insert(ProtocolDeliveryReceiptTable).values({ id: Identifier.ascending("protocol_inbox"), inbox_id: input.inboxID, receipt: { kind: "retry_wait", visible_at: input.visibleAt, error }, time_created: now }).run()
    return parseDeliveryRow(projectProtocolDeliveryInTransaction(db, current, now))
  })
}

export function deadLetterSchedulerSessionDeliveriesInTransaction(
  db: Database.TxOrDb,
  input: { sessionIDs: readonly string[]; errorName: string; message: string; now?: number },
): number {
  Database.requireActiveTransaction("deadLetterSchedulerSessionDeliveriesInTransaction")
  if (input.sessionIDs.length === 0) return 0
  const now = input.now ?? Date.now()
  const rows = db.select().from(ProtocolInboxTable).where(and(eq(ProtocolInboxTable.actor, "session"), inArray(ProtocolInboxTable.actor_id, [...input.sessionIDs]))).all()
  return appendDeadLetterReceipts(db, rows, input.errorName, input.message, now)
}

export function deadLetterSchedulerTaskDeliveriesInTransaction(
  db: Database.TxOrDb,
  input: { taskIDs: readonly string[]; errorName: string; message: string; now?: number },
): number {
  Database.requireActiveTransaction("deadLetterSchedulerTaskDeliveriesInTransaction")
  if (input.taskIDs.length === 0) return 0
  const now = input.now ?? Date.now()
  const rows = db.select().from(ProtocolInboxTable).where(and(eq(ProtocolInboxTable.actor, "task"), inArray(ProtocolInboxTable.actor_id, [...input.taskIDs]))).all()
  return appendDeadLetterReceipts(db, rows, input.errorName, input.message, now)
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
  const rows = db.select().from(ProtocolInboxTable).where(inArray(ProtocolInboxTable.envelope_id, sourceEventIDs)).all()
  return appendDeadLetterReceipts(db, rows, input.errorName, input.message, now)
}

function appendDeadLetterReceipts(db: Database.TxOrDb, rows: Array<typeof ProtocolInboxTable.$inferSelect>, errorName: string, message: string, now: number): number {
  const unresolved = rows.filter((row) => {
    const status = projectProtocolDeliveryInTransaction(db, row, now).status
    return status === "pending" || status === "leased"
  })
  for (const row of unresolved) db.insert(ProtocolDeliveryReceiptTable).values({ id: Identifier.ascending("protocol_inbox"), inbox_id: row.id, receipt: { kind: "dead_letter", error_name: errorName, message }, time_created: now }).run()
  return unresolved.length
}

export function detachProtocolEventsFromDeletedTasksInTransaction(
  db: Database.TxOrDb,
  taskIDs: readonly string[],
): number {
  Database.requireActiveTransaction("detachProtocolEventsFromDeletedTasksInTransaction")
  // Protocol facts outlive mutable Task projections. There is intentionally
  // nothing to detach: task_id is immutable causal identity, not ownership.
  return 0
}

export function listPendingSchedulerRecipientIDs(input: {
  actor: "task" | "session"
  projectID?: string
  now?: number
}): string[] {
  const now = input.now ?? Date.now()
  return Database.use((db) => {
    const rows = input.actor === "session"
      ? db
        .select({ inbox: ProtocolInboxTable, projectID: SessionTable.project_id })
        .from(ProtocolInboxTable)
        .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
        .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
        .where(and(eq(ProtocolInboxTable.actor, "session"), eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE)))
        .all()
      : db
        .select({ inbox: ProtocolInboxTable, projectID: EngineTaskTable.project_id })
        .from(ProtocolInboxTable)
        .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
        .where(and(eq(ProtocolInboxTable.actor, "task"), eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE)))
        .all()
    return [...new Set(rows.flatMap(({ inbox, projectID }) => {
      if (input.projectID && projectID !== input.projectID) return []
      const projected = projectProtocolDeliveryInTransaction(db, inbox, now)
      return projected.status === "pending" && projected.visible_at <= now ? [projected.actor_id] : []
    }))]
  })
}

export function listPendingSchedulerProjectIDs(): string[] {
  return Database.use((db) => {
    const sessions = db
      .select({ inbox: ProtocolInboxTable, projectID: SessionTable.project_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(SessionTable, eq(SessionTable.id, ProtocolInboxTable.actor_id))
      .where(and(eq(ProtocolInboxTable.actor, "session"), eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE)))
      .all()
    const tasks = db
      .select({ inbox: ProtocolInboxTable, projectID: EngineTaskTable.project_id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
      .where(and(eq(ProtocolInboxTable.actor, "task"), eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE)))
      .all()
    const projects = [...sessions, ...tasks].flatMap(({ inbox, projectID }) => {
      const projected = projectProtocolDeliveryInTransaction(db, inbox)
      if (projected.status === "pending" || projected.status === "leased") return [projectID]
      const result = projected.delivery_result
      if (
        inbox.actor === "session" &&
        projected.status === "delivered" &&
        result?.kind === "session_wake" &&
        !successfulSchedulerWakeReplyExistsInTransaction(db, { sessionID: inbox.actor_id, messageID: result.message_id })
      ) return [projectID]
      return []
    })
    return [...new Set(projects)]
  })
}

export function nextSchedulerDeliveryDueAt(projectID: string): number | undefined {
  return Database.use((db) => {
    const sessionRows = db
      .select({
        inbox: ProtocolInboxTable,
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
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
    const taskRows = db
      .select({
        inbox: ProtocolInboxTable,
        sequence: ProtocolEventTable.seq,
        eventID: ProtocolEventTable.id,
      })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, ProtocolInboxTable.actor_id))
      .where(
        and(
          eq(EngineTaskTable.project_id, projectID),
          eq(ProtocolInboxTable.actor, "task"),
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
    const projectedRows = [...sessionRows, ...taskRows]
      .map((row) => ({ ...row, delivery: projectProtocolDeliveryInTransaction(db, row.inbox) }))
      .filter((row) => row.delivery.status === "pending" || row.delivery.status === "leased")
    const heads = projectedRows.filter((row, index, rows) =>
      rows.findIndex((candidate) => candidate.delivery.actor_id === row.delivery.actor_id) === index,
    )
    const due = heads.map(({ delivery }) => delivery.status === "leased"
      ? Math.max(delivery.visible_at, delivery.lease_until ?? delivery.visible_at)
      : delivery.visible_at)
    return due.length > 0 ? Math.min(...due) : undefined
  })
}

export function listUnansweredSchedulerSessionWakes(projectID: string): Array<{
  inboxID: string
  sessionID: string
  messageID: string
}> {
  return Database.use((db) => {
    const rows = db
      .select({
        inbox: ProtocolInboxTable,
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
          eq(ProtocolEventTable.type, SCHEDULER_MESSAGE_EVENT_TYPE),
        ),
      )
      .orderBy(ProtocolInboxTable.actor_id, ProtocolEventTable.seq, ProtocolEventTable.id)
      .all()
    return rows.flatMap(({ inbox }) => {
      const delivery = projectProtocolDeliveryInTransaction(db, inbox)
      const result = delivery.delivery_result
      if (
        delivery.status !== "delivered" ||
        result?.kind !== "session_wake" ||
        successfulSchedulerWakeReplyExistsInTransaction(db, { sessionID: inbox.actor_id, messageID: result.message_id })
      ) return []
      return [{ inboxID: inbox.id, sessionID: inbox.actor_id, messageID: result.message_id }]
    })
  })
}

export function schedulerSessionWakeNeedsRecovery(input: {
  inboxID: string
  sessionID: string
  messageID: string
}): boolean {
  return Database.use((db) => {
    const inbox = db.select().from(ProtocolInboxTable).where(eq(ProtocolInboxTable.id, input.inboxID)).get()
    if (!inbox || inbox.actor !== "session" || inbox.actor_id !== input.sessionID) return false
    const row = projectProtocolDeliveryInTransaction(db, inbox)
    const result = row.delivery_result
    if (row.status !== "delivered" || result?.kind !== "session_wake" || result.message_id !== input.messageID) {
      return false
    }
    if (
      !schedulerWakeMessageMatchesInTransaction(db, {
        sessionID: input.sessionID,
        messageID: input.messageID,
        eventID: row.envelope_id,
        inboxID: input.inboxID,
      })
    ) {
      throw new SchedulerMessageConflictError({
        message: `Scheduler inbox ${input.inboxID} recovery does not name its exact Message occurrence.`,
        eventID: row.envelope_id,
      })
    }
    return !successfulSchedulerWakeReplyExistsInTransaction(db, {
      sessionID: input.sessionID,
      messageID: input.messageID,
    })
  })
}

export const SchedulerMessageProtocol = {
  eventType: SCHEDULER_MESSAGE_EVENT_TYPE,
}
