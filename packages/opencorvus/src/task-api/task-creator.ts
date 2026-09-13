import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { isRightSidebarConversationSession } from "@/chat/session"
import { suppliedTaskCreatorMetadataKeys } from "./task-caller-metadata"
import { MissionVisibleExpertSquadIDs } from "@/mission/schema"
import { createHash } from "node:crypto"
import { currentMissionExecutionClosure, type MissionExecutionClosure } from "@/mission/execution-closure"
import { Database } from "@/storage/db"
import { MessageTable, PartTable, SessionTable, ToolPartRequestTable } from "@/session/session.sql"
import { and, eq } from "drizzle-orm"
import {
  MissionTaskRequestSourceError,
  missionTaskRequestAuthoritySources,
  missionTaskRequestHasAuthenticatedSource,
  type TaskRequestSourceMessage,
} from "@/engine/task-request-source"

export const MissionTaskCreationOpenedOccurrence = z
  .object({
    eventID: Identifier.schema("protocol_event"),
    operationID: z.string().uuid(),
  })
  .strict()
export type MissionTaskCreationOpenedOccurrence = z.infer<typeof MissionTaskCreationOpenedOccurrence>

export const TaskCreatorActor = z.enum([
  "user",
  "control_agent",
  "mission",
  "right_sidebar_conversation",
  "orchestrator",
])
export type TaskCreatorActor = z.infer<typeof TaskCreatorActor>

const SessionTaskCreatorActor = z.enum(["control_agent", "right_sidebar_conversation", "orchestrator"])

export const TaskCreator = z.discriminatedUnion("actor", [
  z.object({ actor: z.literal("user") }).strict(),
  z
    .object({
      actor: z.literal("mission"),
      sessionID: Identifier.schema("session"),
      openedOccurrence: MissionTaskCreationOpenedOccurrence,
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
      toolPartID: Identifier.schema("part").optional(),
    })
    .strict(),
  z
    .object({
      actor: SessionTaskCreatorActor,
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
      toolPartID: Identifier.schema("part").optional(),
    })
    .strict(),
])
export type TaskCreator = z.infer<typeof TaskCreator>

const ResolvedTaskCreator = z.discriminatedUnion("actor", [
  z.object({ actor: z.literal("user") }).strict(),
  z
    .object({
      actor: z.literal("mission"),
      missionID: z.string().min(1),
      heldExpertSquadIDs: MissionVisibleExpertSquadIDs,
      sessionID: Identifier.schema("session"),
      openedOccurrence: MissionTaskCreationOpenedOccurrence,
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
      toolPartID: Identifier.schema("part").optional(),
      toolInput: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
  z
    .object({
      actor: SessionTaskCreatorActor,
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
      toolPartID: Identifier.schema("part").optional(),
      toolInput: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
])

export const TaskCreatorMetadata = z
  .discriminatedUnion("actor", [
    z.object({ actor: z.literal("user") }).passthrough(),
    z
      .object({
        actor: z.literal("mission"),
        mission: z
          .object({
            id: z.string().min(1),
            session_id: Identifier.schema("session"),
          })
          .strict(),
      })
      .passthrough(),
    z
      .object({
        actor: SessionTaskCreatorActor,
        actor_session_id: Identifier.schema("session"),
      })
      .passthrough(),
  ])
  .superRefine((metadata, context) => {
    if (metadata.actor !== "mission" && "mission" in metadata) {
      context.addIssue({ code: "custom", message: "Only Mission creator metadata may contain mission." })
    }
    if ((metadata.actor === "user" || metadata.actor === "mission") && "actor_session_id" in metadata) {
      context.addIssue({
        code: "custom",
        message: `${metadata.actor} creator metadata cannot contain actor_session_id.`,
      })
    }
  })

export const TaskCreatorAuthorityError = NamedError.create(
  "TaskCreatorAuthorityError",
  z.object({ message: z.string() }),
)

export const TaskCreatorSessionError = NamedError.create("TaskCreatorSessionError", z.object({ message: z.string() }))

export const MissionTaskCreationClosureError = NamedError.create(
  "MissionTaskCreationClosureError",
  z
    .object({
      message: z.string(),
      sessionID: Identifier.schema("session"),
      expectedOpenedEventID: Identifier.schema("protocol_event").nullable(),
      expectedOperationID: z.string().uuid().nullable(),
      currentState: z.enum(["not_opened", "opened", "closing", "closed"]),
      currentClosureEventID: Identifier.schema("protocol_event").nullable(),
      currentOperationID: z.string().uuid().nullable(),
    })
    .strict(),
)

export const MissionExpertSquadAuthorityError = NamedError.create(
  "MissionExpertSquadAuthorityError",
  z.object({
    message: z.string(),
    missionSessionID: Identifier.schema("session"),
    requestedProfileID: z.string().nullable(),
    heldExpertSquadCount: z.number().int().positive(),
    heldExpertSquadSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
)

function missionTaskCreationClosureError(input: {
  sessionID: string
  expected?: MissionTaskCreationOpenedOccurrence
  current?: MissionExecutionClosure
}) {
  const currentState = input.current?.state ?? "not_opened"
  return new MissionTaskCreationClosureError({
    message:
      currentState === "opened"
        ? `Mission Session ${input.sessionID} Task creation belongs to stale opened event ${input.expected?.eventID}; current opened event is ${input.current!.eventID}.`
        : `Mission Session ${input.sessionID} Task creation requires its exact opened occurrence; current execution state is ${currentState}.`,
    sessionID: input.sessionID,
    expectedOpenedEventID: input.expected?.eventID ?? null,
    expectedOperationID: input.expected?.operationID ?? null,
    currentState,
    currentClosureEventID: input.current?.eventID ?? null,
    currentOperationID: input.current?.operationID ?? null,
  })
}

/** Capture the immutable Mission occurrence that authorizes one real panel.create_task call. */
export function requireMissionTaskCreationOpenedOccurrence(sessionID: string): MissionTaskCreationOpenedOccurrence {
  const current = currentMissionExecutionClosure(sessionID)
  if (!current || current.state !== "opened") {
    throw missionTaskCreationClosureError({ sessionID, current })
  }
  return MissionTaskCreationOpenedOccurrence.parse({
    eventID: current.eventID,
    operationID: current.operationID,
  })
}

export function assertMissionTaskCreationOpenedOccurrence(input: {
  sessionID: string
  openedOccurrence: MissionTaskCreationOpenedOccurrence
}): void {
  const expected = MissionTaskCreationOpenedOccurrence.parse(input.openedOccurrence)
  const current = currentMissionExecutionClosure(input.sessionID)
  if (
    current?.state === "opened" &&
    current.eventID === expected.eventID &&
    current.operationID === expected.operationID
  ) {
    return
  }
  throw missionTaskCreationClosureError({ sessionID: input.sessionID, expected, current })
}

/**
 * Compare-and-set the exact Mission opened occurrence from inside the Task
 * aggregate writer transaction. The caller must run this immediately before
 * the Task/root Session/initial ingress insert in that same transaction.
 */
export function assertMissionTaskCreationOpenedOccurrenceInTransaction(input: {
  sessionID: string
  openedOccurrence: MissionTaskCreationOpenedOccurrence
}): void {
  Database.requireActiveTransaction("assertMissionTaskCreationOpenedOccurrenceInTransaction")
  assertMissionTaskCreationOpenedOccurrence(input)
}

export function assertNoCallerSuppliedTaskCreatorMetadata(metadata: Record<string, unknown> | undefined): void {
  const supplied = suppliedTaskCreatorMetadataKeys(metadata)
  if (supplied.length === 0) return
  throw new TaskCreatorAuthorityError({
    message: `Task creator metadata is server-owned; remove reserved keys: ${supplied.join(", ")}`,
  })
}

export async function resolveTaskCreator(rawCreator: z.input<typeof TaskCreator>) {
  const creator = TaskCreator.parse(rawCreator)
  if (creator.actor === "user") return creator
  const session = await Session.assertLineageInProject({
    sessionID: creator.sessionID,
    projectID: Instance.project.id,
  })
  const toolIdentity = [creator.messageID, creator.toolCallID, creator.toolPartID]
  if (toolIdentity.some(Boolean) && !toolIdentity.every(Boolean)) {
    throw new TaskCreatorAuthorityError({
      message: "Task creator Tool provenance requires messageID, toolCallID and toolPartID together.",
    })
  }
  let toolInput: Record<string, unknown> | undefined
  if (creator.toolPartID) {
    const request = Database.use((db) =>
      db
        .select({ data: ToolPartRequestTable.data })
        .from(ToolPartRequestTable)
        .innerJoin(MessageTable, eq(MessageTable.id, ToolPartRequestTable.message_id))
        .where(
          and(
            eq(ToolPartRequestTable.id, creator.toolPartID!),
            eq(ToolPartRequestTable.message_id, creator.messageID!),
            eq(MessageTable.session_id, creator.sessionID),
          ),
        )
        .get(),
    )
    if (!request || request.data.callID !== creator.toolCallID || request.data.tool !== "panel_create_task") {
      throw new TaskCreatorAuthorityError({
        message: `Task creator Tool occurrence ${creator.toolPartID} is not the exact persisted panel request.`,
      })
    }
    toolInput = z.record(z.string(), z.unknown()).parse(request.data.input)
  }
  if (creator.actor === "orchestrator" && session.kind !== "orchestrator") {
    throw new TaskCreatorSessionError({
      message: `Orchestrator task creator session ${creator.sessionID} must have kind orchestrator.`,
    })
  }
  if (creator.actor === "right_sidebar_conversation" && !isRightSidebarConversationSession(session)) {
    throw new TaskCreatorSessionError({
      message: `Right-sidebar task creator session ${creator.sessionID} is not a right-sidebar conversation.`,
    })
  }
  if (
    creator.actor === "control_agent" &&
    (session.kind !== "assistant" || isRightSidebarConversationSession(session))
  ) {
    throw new TaskCreatorSessionError({
      message: `Control Agent task creator session ${creator.sessionID} must be a non-conversation assistant session.`,
    })
  }
  if (creator.actor !== "mission") return ResolvedTaskCreator.parse({ ...creator, ...(toolInput ? { toolInput } : {}) })
  if (session.kind !== "mission") {
    throw new TaskCreatorSessionError({
      message: `Mission task creator session ${creator.sessionID} must have kind mission.`,
    })
  }
  const mission = (session.metadata as Record<string, unknown> | undefined)?.mission
  const missionID =
    mission && typeof mission === "object" && !Array.isArray(mission)
      ? (mission as Record<string, unknown>).id
      : undefined
  if (typeof missionID !== "string" || missionID.length === 0) {
    throw new TaskCreatorSessionError({
      message: `Mission task creator session ${creator.sessionID} is missing metadata.mission.id`,
    })
  }
  const heldExpertSquadIDs = MissionVisibleExpertSquadIDs.parse(
    (mission as Record<string, unknown>).visibleExpertSquadIDs,
  )
  if (toolInput && creator.messageID) {
    assertMissionTaskRequestFromAuthenticatedUserHistory({
      missionSessionID: creator.sessionID,
      creatorMessageID: creator.messageID,
      request: toolInput.request,
    })
  }
  return ResolvedTaskCreator.parse({ ...creator, missionID, heldExpertSquadIDs, ...(toolInput ? { toolInput } : {}) })
}

/**
 * Mission may allocate a user's request to a Task, but it cannot author a
 * second semantic request at the creation boundary. The check is byte-level
 * provenance only: the Host neither interprets nor rewrites business text.
 */
export function assertMissionTaskRequestFromAuthenticatedUserHistory(input: {
  missionSessionID: string
  creatorMessageID: string
  request: unknown
}): void {
  Database.use((db) => assertMissionTaskRequestFromAuthenticatedUserHistoryInDatabase(db, input))
}

export function assertMissionTaskRequestFromAuthenticatedUserHistoryInDatabase(
  db: Database.TxOrDb,
  input: {
    missionSessionID: string
    creatorMessageID: string
    request: unknown
  },
): void {
  const request = typeof input.request === "string" ? input.request : ""
  const creator = db
    .select({ data: MessageTable.data })
    .from(MessageTable)
    .where(and(eq(MessageTable.id, input.creatorMessageID), eq(MessageTable.session_id, input.missionSessionID)))
    .get()
  const info = creator?.data as { role?: unknown; author?: unknown }
  const readMessage = (messageID: string): TaskRequestSourceMessage | undefined => {
    const message = db
      .select({ id: MessageTable.id, sessionID: MessageTable.session_id, data: MessageTable.data, timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(eq(MessageTable.id, messageID))
      .get()
    if (!message) return undefined
    return {
      messageID: message.id,
      sessionID: message.sessionID,
      timeCreated: message.timeCreated,
      info: message.data,
      parts: db
        .select({ id: PartTable.id, timeCreated: PartTable.time_created, data: PartTable.data })
        .from(PartTable)
        .where(eq(PartTable.message_id, message.id))
        .orderBy(PartTable.time_created, PartTable.id)
        .all(),
    }
  }
  const sourceMessages = missionTaskRequestAuthoritySources({
    missionSessionID: input.missionSessionID,
    creatorMessageID: input.creatorMessageID,
    store: {
      session(sessionID) {
        const session = db
          .select({
            sessionID: SessionTable.id,
            projectID: SessionTable.project_id,
            kind: SessionTable.kind,
            metadata: SessionTable.metadata,
          })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get()
        return session
      },
      message: readMessage,
      messages(sessionID) {
        return db
          .select({ id: MessageTable.id })
          .from(MessageTable)
          .where(eq(MessageTable.session_id, sessionID))
          .orderBy(MessageTable.time_created, MessageTable.id)
          .all()
          .flatMap((message) => {
            const value = readMessage(message.id)
            return value ? [value] : []
          })
      },
    },
  })
  if (
    missionTaskRequestHasAuthenticatedSource({
      creatorRole: info?.role,
      creatorAuthor: info?.author,
      request,
      sourceMessages,
    })
  ) {
    return
  }
  throw new MissionTaskRequestSourceError({
    message:
      "Mission panel_create_task.request must contain only ordered non-empty verbatim fragments from authenticated real-user authority history.",
    missionSessionID: input.missionSessionID,
    creatorMessageID: input.creatorMessageID,
    acceptedUserMessageIDs: sourceMessages
      .filter((source) => source.info?.role === "user" && source.info.author === "user")
      .map((source) => source.messageID),
  })
}

export function assertTaskCreatorExpertSquadAuthority(input: {
  creator: z.infer<typeof ResolvedTaskCreator>
  promptProfile?: string
}): void {
  if (input.creator.actor !== "mission") return
  const held = input.creator.heldExpertSquadIDs
  if (input.promptProfile && held.includes(input.promptProfile)) return
  throw new MissionExpertSquadAuthorityError({
    message: input.promptProfile
      ? `Mission may create a Task only with a held Expert Squad; received ${JSON.stringify(input.promptProfile)}.`
      : "Mission Task creation requires one explicit held Expert Squad promptProfile.",
    missionSessionID: input.creator.sessionID,
    requestedProfileID: input.promptProfile ?? null,
    heldExpertSquadCount: held.length,
    heldExpertSquadSnapshotHash: createHash("sha256").update(JSON.stringify(held)).digest("hex"),
  })
}

export function projectTaskCreatorMetadata(
  metadata: Record<string, unknown> | undefined,
  creator: z.infer<typeof ResolvedTaskCreator>,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    actor: creator.actor,
    ...(creator.actor === "mission"
      ? { mission: { id: creator.missionID, session_id: creator.sessionID } }
      : creator.actor === "user"
        ? {}
        : { actor_session_id: creator.sessionID }),
  }
}
