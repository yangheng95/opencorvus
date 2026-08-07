import z from "zod"
import { TaskCancellationReason, TaskCancellationRequestSurface } from "@opencorvus-ai/transport-protocol"
import { ChannelSurface } from "@/channel/catalog"
import { Identifier } from "@/id/id"
import { MissionID } from "@/mission/schema"

/**
 * Server-owned identity for the participant that requested task cancellation.
 * User-interface-specific actor names are normalized before they enter this
 * protocol.
 */
export const TaskCancellationActor = z.enum([
  "user",
  "control_agent",
  "mission",
  "right_sidebar_conversation",
  "orchestrator",
])

/**
 * Canonical code path that accepted the cancellation request. `surface`
 * remains a separate required field because one source can be invoked from
 * multiple product surfaces.
 */
export const TaskCancellationSource = z.enum([
  "task.cancel",
  "task.delete",
  "task.archive",
  "mission.abort",
  "mission.archive",
  "mission.delete",
  "panel.cancel_task",
  "orchestrator.cancel_task",
  "session.delete",
  "project.delete",
])

export const TaskCancellationSurface = z.enum([
  ...TaskCancellationRequestSurface.options,
  ...ChannelSurface.options,
  "right-sidebar",
  "orchestrator",
])

const NonEmptyCancellationIdentity = z.string().trim().min(1)
const CancellationSessionID = Identifier.schema("session")
const CancellationMessageID = Identifier.schema("message")
const CancellationToolPartID = Identifier.schema("part")

const NoCancellationToolIdentity = {
  messageID: z.never().optional(),
  toolCallID: z.never().optional(),
  toolPartID: z.never().optional(),
}

const CompleteCancellationToolIdentity = {
  messageID: CancellationMessageID,
  toolCallID: NonEmptyCancellationIdentity,
  toolPartID: CancellationToolPartID,
}

const CancellationToolIdentity = z.union([
  z.object(NoCancellationToolIdentity).strict(),
  z.object(CompleteCancellationToolIdentity).strict(),
])

const CancellationOriginBase = {
  surface: TaskCancellationSurface,
  requestID: NonEmptyCancellationIdentity,
  reason: TaskCancellationReason,
}

const DirectUserCancellationSource = z.enum(["task.cancel", "task.delete", "task.archive", "project.delete"])

const MissionCancellationSource = z.enum(["mission.abort", "mission.archive", "mission.delete"])

const NonMissionPanelAgentCancellationActor = z.enum(["control_agent", "right_sidebar_conversation"])

/**
 * Exact provenance recorded by `task.cancellation.requested`.
 *
 * The protocol-event envelope owns source, request correlation, and session
 * identity. The event payload owns the remaining actor/surface/reason fields;
 * callers must not mirror this structure into task metadata or Decision Log.
 */
export const TaskCancellationOrigin = z.union([
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("user"),
      source: DirectUserCancellationSource,
      sessionID: z.never().optional(),
      ...NoCancellationToolIdentity,
      missionID: z.never().optional(),
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("user"),
      source: MissionCancellationSource,
      sessionID: CancellationSessionID,
      ...NoCancellationToolIdentity,
      missionID: MissionID,
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("user"),
      source: z.literal("panel.cancel_task"),
      sessionID: z.never().optional(),
      ...NoCancellationToolIdentity,
      missionID: z.never().optional(),
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("mission"),
      source: z.enum(["panel.cancel_task", "session.delete"]),
      sessionID: CancellationSessionID,
      ...CompleteCancellationToolIdentity,
      missionID: MissionID,
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: NonMissionPanelAgentCancellationActor,
      source: z.enum(["panel.cancel_task", "session.delete"]),
      sessionID: CancellationSessionID,
      ...CompleteCancellationToolIdentity,
      missionID: z.never().optional(),
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("user"),
      source: z.literal("session.delete"),
      // Direct Session deletion records the target Session here. A panel
      // user-interface request has no caller Session and therefore omits it.
      sessionID: CancellationSessionID.optional(),
      ...NoCancellationToolIdentity,
      missionID: z.never().optional(),
    })
    .strict(),
  z
    .object({
      ...CancellationOriginBase,
      actor: z.literal("orchestrator"),
      source: z.literal("orchestrator.cancel_task"),
      surface: z.literal("orchestrator"),
      sessionID: CancellationSessionID,
      ...CompleteCancellationToolIdentity,
      missionID: z.never().optional(),
    })
    .strict(),
])

export type TaskCancellationOrigin = z.infer<typeof TaskCancellationOrigin>

export const TASK_CANCELLATION_REQUESTED_EVENT_TYPE = "task.cancellation.requested"
export const TASK_CANCELLED_EVENT_TYPE = "task.cancelled"

const TaskCancellationRequestedPayloadBase = {
  taskID: Identifier.schema("task"),
  actor: TaskCancellationActor,
  surface: TaskCancellationSurface,
  reason: TaskCancellationReason,
  summary: z.string().trim().min(1),
  missionID: MissionID.optional(),
}

/**
 * Durable request payload identity is either absent or complete. Session
 * identity remains in the event envelope and is checked together with this
 * payload by `parseTaskCancellationRequestEvent`.
 */
export const TaskCancellationRequestedPayload = z
  .object({
    ...TaskCancellationRequestedPayloadBase,
    messageID: CancellationMessageID.optional(),
    toolCallID: NonEmptyCancellationIdentity.optional(),
    toolPartID: CancellationToolPartID.optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    const identity = CancellationToolIdentity.safeParse({
      ...(payload.messageID ? { messageID: payload.messageID } : {}),
      ...(payload.toolCallID ? { toolCallID: payload.toolCallID } : {}),
      ...(payload.toolPartID ? { toolPartID: payload.toolPartID } : {}),
    })
    if (!identity.success) {
      context.addIssue({
        code: "custom",
        path: ["messageID"],
        message: "Cancellation tool identity must provide messageID, toolCallID, and toolPartID together.",
      })
    }
  })

export const TaskCancelledPayload = z
  .object({
    taskID: Identifier.schema("task"),
    status: z.literal("cancelled"),
    summary: z.string().trim().min(1),
    error: z.string().trim().min(1),
    timeCompleted: z.number().int().positive(),
  })
  .strict()

/**
 * Causal pointer passed from the persisted request event into the terminal
 * task writer. The event identifier is constrained to the protocol-event
 * identifier namespace so message/tool identifiers cannot be written as
 * causation identifiers.
 */
export const TaskCancellationEventLink = z
  .object({
    eventID: Identifier.schema("protocol_event"),
  })
  .strict()

export type TaskCancellationEventLink = z.infer<typeof TaskCancellationEventLink>

export const TaskCancellationProjection = z
  .object({
    requestEventID: Identifier.schema("protocol_event"),
    terminalEventID: Identifier.schema("protocol_event"),
    requestedAt: z.number().int().positive(),
    terminalAt: z.number().int().positive(),
    source: TaskCancellationSource,
    requestID: z.string().trim().min(1),
    actor: TaskCancellationActor,
    surface: TaskCancellationSurface,
    reason: TaskCancellationReason,
    sessionID: CancellationSessionID.optional(),
    messageID: CancellationMessageID.optional(),
    toolCallID: z.string().trim().min(1).optional(),
    toolPartID: CancellationToolPartID.optional(),
    missionID: MissionID.optional(),
  })
  .strict()

export type TaskCancellationProjection = z.infer<typeof TaskCancellationProjection>

/**
 * Minimal durable protocol-event view consumed by the pure cancellation
 * integrity contract. Both the live ProtocolStore projection and storage
 * initialization normalize their rows to this shape so cancellation meaning
 * is never reimplemented at the database boundary.
 */
export type TaskCancellationProtocolEvent = {
  id: string
  kind: string
  type: string
  aggregate: string
  aggregateID: string
  taskID?: string
  sessionID?: string
  source: string
  causationID?: string
  correlationID?: string
  sequence: number
  payload?: Record<string, unknown>
  time: {
    emitted: number
  }
}

export function parseTaskCancellationRequestEvent(
  taskID: string,
  eventID: string,
  requested: TaskCancellationProtocolEvent | undefined,
) {
  Identifier.schema("protocol_event").parse(eventID)
  if (!requested) throw new Error(`Protocol event not found: ${eventID}`)
  Identifier.schema("protocol_event").parse(requested.id)
  if (
    requested.kind !== "event" ||
    requested.type !== TASK_CANCELLATION_REQUESTED_EVENT_TYPE ||
    requested.aggregate !== "task" ||
    requested.aggregateID !== taskID ||
    requested.taskID !== taskID
  ) {
    throw new Error(
      `Cancellation request event ${eventID} does not belong to task ${taskID} as ${TASK_CANCELLATION_REQUESTED_EVENT_TYPE}.`,
    )
  }
  if (!requested.correlationID) {
    throw new Error(`Cancellation request event ${eventID} is missing its correlation identifier.`)
  }
  const payload = TaskCancellationRequestedPayload.parse(requested.payload)
  if (payload.taskID !== taskID) {
    throw new Error(`Cancellation request event ${eventID} payload belongs to task ${payload.taskID}, not ${taskID}.`)
  }
  const parsedOrigin = TaskCancellationOrigin.safeParse({
    actor: payload.actor,
    source: requested.source,
    surface: payload.surface,
    requestID: requested.correlationID,
    reason: payload.reason,
    ...(requested.sessionID ? { sessionID: requested.sessionID } : {}),
    ...(payload.messageID ? { messageID: payload.messageID } : {}),
    ...(payload.toolCallID ? { toolCallID: payload.toolCallID } : {}),
    ...(payload.toolPartID ? { toolPartID: payload.toolPartID } : {}),
    ...(payload.missionID ? { missionID: payload.missionID } : {}),
  })
  if (!parsedOrigin.success) {
    throw new Error(`Cancellation request event ${eventID} has invalid origin: ${z.prettifyError(parsedOrigin.error)}`)
  }
  return {
    event: requested,
    payload,
    origin: parsedOrigin.data,
  }
}

/**
 * Validate the terminal side before its causation pointer is dereferenced.
 * This preserves the exact corruption signal when a forged terminal row also
 * points at a missing request event.
 */
export function taskCancellationRequestEventID(
  taskID: string,
  terminal: TaskCancellationProtocolEvent | undefined,
): string {
  if (!terminal) {
    throw new Error(
      `Task cancellation data integrity violation: cancelled task ${taskID} has no terminal task.cancelled event.`,
    )
  }
  Identifier.schema("protocol_event").parse(terminal.id)
  if (
    terminal.type !== TASK_CANCELLED_EVENT_TYPE ||
    terminal.kind !== "event" ||
    terminal.aggregate !== "task" ||
    terminal.aggregateID !== taskID ||
    terminal.taskID !== taskID
  ) {
    throw new Error(
      `Task cancellation data integrity violation: terminal event ${terminal.id} does not belong exactly to task ${taskID}.`,
    )
  }
  const terminalPayload = TaskCancelledPayload.parse(terminal.payload)
  if (terminalPayload.taskID !== taskID) {
    throw new Error(
      `Task cancellation data integrity violation: terminal event ${terminal.id} payload belongs to task ${terminalPayload.taskID}, not ${taskID}.`,
    )
  }
  if (!terminal.causationID) {
    throw new Error(
      `Task cancellation data integrity violation: terminal event ${terminal.id} for task ${taskID} has no causation identifier.`,
    )
  }
  return Identifier.schema("protocol_event").parse(terminal.causationID)
}

/**
 * Project the cancellation request only through the terminal event's explicit
 * causation link. A stray or newer requested event can never become the Task's
 * reported cancellation origin.
 */
export function projectTaskCancellationEventChain(
  taskID: string,
  terminal: TaskCancellationProtocolEvent | undefined,
  requested: TaskCancellationProtocolEvent | undefined,
): TaskCancellationProjection {
  const requestEventID = taskCancellationRequestEventID(taskID, terminal)
  if (!terminal) throw new Error(`Task cancellation terminal validation did not return an event for ${taskID}.`)
  const request = parseTaskCancellationRequestEvent(taskID, requestEventID, requested)
  const requestEvent = request.event
  if (!requestEvent.correlationID || terminal.correlationID !== requestEvent.correlationID) {
    throw new Error(`Task cancellation event chain ${requestEvent.id} -> ${terminal.id} has correlation drift.`)
  }
  if (terminal.sessionID !== requestEvent.sessionID) {
    throw new Error(`Task cancellation event chain ${requestEvent.id} -> ${terminal.id} has session drift.`)
  }
  if (
    !Number.isInteger(requestEvent.sequence) ||
    requestEvent.sequence <= 0 ||
    !Number.isInteger(terminal.sequence) ||
    terminal.sequence <= requestEvent.sequence
  ) {
    throw new Error(`Task cancellation event chain ${requestEvent.id} -> ${terminal.id} has sequence drift.`)
  }
  // Aggregate sequence supplies strict ordering. Millisecond timestamps may
  // be equal, but the terminal clock must never precede the request clock.
  if (
    !Number.isInteger(requestEvent.time.emitted) ||
    requestEvent.time.emitted <= 0 ||
    !Number.isInteger(terminal.time.emitted) ||
    terminal.time.emitted < requestEvent.time.emitted
  ) {
    throw new Error(`Task cancellation event chain ${requestEvent.id} -> ${terminal.id} has chronological drift.`)
  }
  const origin = request.origin
  return TaskCancellationProjection.parse({
    requestEventID: requestEvent.id,
    terminalEventID: terminal.id,
    requestedAt: requestEvent.time.emitted,
    terminalAt: terminal.time.emitted,
    source: origin.source,
    requestID: origin.requestID,
    actor: origin.actor,
    surface: origin.surface,
    reason: origin.reason,
    ...(origin.sessionID ? { sessionID: origin.sessionID } : {}),
    ...(origin.messageID ? { messageID: origin.messageID } : {}),
    ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
    ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
    ...(origin.missionID ? { missionID: origin.missionID } : {}),
  })
}
