import { resolveAgentModelRef } from "@/agent/model"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import {
  RIGHT_SIDEBAR_CONVERSATION_SOURCE,
  isRightSidebarConversationSession,
  rightSidebarConversationExperience,
} from "@/chat/session"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Session } from "@/session"
import { MessageTable, PartTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { Database, NotFoundError, eq } from "@/storage/db"
import { Log } from "@/util/log"
import { NamedError } from "@opencorvus-ai/util/error"
import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { MissionID } from "./schema"
import {
  MissionCallerMetadata,
  MissionCallerReceiptPartMetadata,
  MissionReceiptMetadata,
  missionCallerFromMetadata,
  missionMetadataRecord,
} from "./caller-participant"
import { missionCallerReceiptOccurrenceIdentity } from "./caller-receipt-identity"

export { MissionCallerMetadata, MissionReceiptMetadata } from "./caller-participant"

const log = Log.create({ service: "mission.caller-receipt" })
const initializedDirectories = new Set<string>()

export const MissionCallerReceiptIdentityConflictError = NamedError.create(
  "MissionCallerReceiptIdentityConflictError",
  z.object({ message: z.string().min(1), missionSessionID: Identifier.schema("session") }),
)

export const MissionHandoffEvent = BusEvent.define(
  "mission.handoff",
  z.object({
    projectID: z.string().min(1),
    directory: z.string().min(1),
    missionID: MissionID,
    missionSessionID: Identifier.schema("session"),
    callerSessionID: Identifier.schema("session"),
    callerExperience: z.enum(["chat", "work"]),
    callerMessageID: Identifier.schema("message"),
    timeCreated: z.number(),
  }),
)
export type MissionHandoffEvent = z.infer<typeof MissionHandoffEvent.properties>

function missionMetadata(session: Session.Info): Record<string, unknown> | undefined {
  return missionMetadataRecord(session.metadata)
}

function missionID(session: Session.Info): string {
  const id = missionMetadata(session)?.id
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`Mission session ${session.id} is missing metadata.mission.id`)
  }
  return id
}

function renderReceipt(input: {
  missionID: string
  missionSessionID: string
  status: Extract<SessionStatus.Info, { type: "terminal" }>
}): string {
  const reasonText =
    input.status.reason === "completed" ? "completed" : input.status.reason === "error" ? "failed" : "aborted"
  const lines = [`Mission ${input.missionID} ${reasonText}.`, `Mission session: ${input.missionSessionID}`]
  if (input.status.error) lines.push(`Error: ${input.status.error}`)
  return lines.join("\n")
}

export async function attachMissionCaller(input: {
  missionSessionID: string
  callerSession: Session.Info
  callerMessageID: string
}): Promise<Session.Info> {
  if (!isRightSidebarConversationSession(input.callerSession)) {
    throw new Error(`Mission caller must be a right-sidebar conversation: ${input.callerSession.id}`)
  }
  const missionSession = await Session.get(input.missionSessionID)
  if (missionSession.kind !== "mission") {
    throw new Error(`Mission caller can only be attached to a mission session: ${missionSession.id}`)
  }
  const mission = missionMetadata(missionSession)
  if (!mission) throw new Error(`Mission session ${missionSession.id} is missing metadata.mission`)
  const experience = rightSidebarConversationExperience(input.callerSession)
  if (!experience) {
    throw new Error(`Mission caller ${input.callerSession.id} is missing a conversation experience`)
  }
  const caller = MissionCallerMetadata.parse({
    session_id: input.callerSession.id,
    message_id: input.callerMessageID,
    surface: "right-sidebar",
    experience,
  })
  return Session.mergeMetadata({
    sessionID: missionSession.id,
    patch: {
      mission: {
        ...mission,
        caller,
      },
    },
  })
}

export function missionCaller(session: Session.Info): MissionCallerMetadata | undefined {
  return missionCallerFromMetadata(session.metadata)
}

export function missionReceipt(session: Session.Info): MissionReceiptMetadata | undefined {
  const raw = missionMetadata(session)?.receipt
  if (raw === undefined) return undefined
  return MissionReceiptMetadata.parse(raw)
}

/**
 * Publish the observable surface transition only after the Mission wake message
 * has been persisted. The Mission remains a separate Session; this event only
 * connects its already-durable caller lineage to the current user interface.
 */
export async function publishMissionHandoff(session: Session.Info): Promise<MissionHandoffEvent> {
  if (session.kind !== "mission") {
    throw new Error(`Mission handoff requires a mission session: ${session.id}`)
  }
  const caller = missionCaller(session)
  if (!caller) throw new Error(`Mission session ${session.id} is missing caller metadata`)
  const event = MissionHandoffEvent.properties.parse({
    projectID: session.projectID,
    directory: session.directory,
    missionID: missionID(session),
    missionSessionID: session.id,
    callerSessionID: caller.session_id,
    callerExperience: caller.experience,
    callerMessageID: caller.message_id,
    timeCreated: Date.now(),
  })
  await Bus.publish(MissionHandoffEvent, event)
  return event
}

export async function recordMissionCallerReceipt(input: {
  sessionID: string
  status: Extract<SessionStatus.Info, { type: "terminal" }>
}): Promise<MissionReceiptMetadata | undefined> {
  const missionSession = await Session.get(input.sessionID)
  if (missionSession.kind !== "mission") return undefined
  const caller = missionCaller(missionSession)
  if (!caller) return undefined
  const occurrence = missionCallerReceiptOccurrenceIdentity(missionSession.id)
  const existingReceipt = missionReceipt(missionSession)
  if (existingReceipt) {
    let persisted: Message.WithParts | undefined
    try {
      persisted = await MessageStore.get({
        sessionID: caller.session_id,
        messageID: existingReceipt.message_id,
      })
    } catch (error) {
      if (!NotFoundError.isInstance(error as Error)) throw error
    }
    const part = persisted?.parts[0]
    const expectedText = renderReceipt({
      missionID: missionID(missionSession),
      missionSessionID: missionSession.id,
      status: input.status,
    })
    const expectedPartMetadata = MissionCallerReceiptPartMetadata.parse({
      source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
      mission_id: missionID(missionSession),
      mission_session_id: missionSession.id,
      terminal_reason: input.status.reason,
    })
    const exact =
      existingReceipt.message_id === occurrence.messageID &&
      existingReceipt.part_id === occurrence.partID &&
      existingReceipt.terminal_reason === input.status.reason &&
      persisted?.info.role === "assistant" &&
      persisted.info.author === "mission" &&
      persisted.info.agent === "mission" &&
      persisted.info.parentID === caller.message_id &&
      persisted.info.time.created === existingReceipt.sent_at &&
      persisted.info.time.completed === existingReceipt.sent_at &&
      persisted.parts.length === 1 &&
      part?.id === occurrence.partID &&
      part.type === "text" &&
      part.text === expectedText &&
      part.source === "system" &&
      part.time?.start === existingReceipt.sent_at &&
      part.time.end === existingReceipt.sent_at &&
      isDeepStrictEqual(part.metadata, expectedPartMetadata)
    if (!exact) {
      throw new MissionCallerReceiptIdentityConflictError({
        message: `Mission caller receipt for ${missionSession.id} does not match its exact persisted occurrence.`,
        missionSessionID: missionSession.id,
      })
    }
    return existingReceipt
  }

  const callerSession = await Session.assertLineageInProject({
    sessionID: caller.session_id,
    projectID: missionSession.projectID,
  })
  if (!isRightSidebarConversationSession(callerSession)) {
    throw new Error(`Mission caller session ${caller.session_id} is not a right-sidebar conversation`)
  }

  const { messageID, partID } = occurrence
  const assertUnoccupied = () => {
    const messageRow = Database.use((db) =>
      db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get(),
    )
    const partRow = Database.use((db) =>
      db.select({ id: PartTable.id }).from(PartTable).where(eq(PartTable.id, partID)).get(),
    )
    if (!messageRow && !partRow) return
    throw new MissionCallerReceiptIdentityConflictError({
      message: `Mission caller receipt occurrence for ${missionSession.id} is already occupied.`,
      missionSessionID: missionSession.id,
    })
  }
  // Reject known compact-ID occupants before resolving the participant model.
  // The same check runs in the persistence transaction to fence a concurrent
  // occupant created after this read.
  assertUnoccupied()

  const now = Date.now()
  const text = renderReceipt({
    missionID: missionID(missionSession),
    missionSessionID: missionSession.id,
    status: input.status,
  })
  const mission = await PrimaryAssistantRegistry.get("mission")
  const model = await resolveAgentModelRef(mission.name, { sessionID: missionSession.id })
  const message: Message.Assistant = {
    id: messageID,
    sessionID: callerSession.id,
    role: "assistant",
    author: "mission",
    time: {
      created: now,
      completed: now,
    },
    parentID: caller.message_id,
    modelID: model.modelID,
    providerID: model.providerID,
    agent: mission.name,
    path: {
      cwd: callerSession.directory,
      root: Instance.worktree,
    },
    cost: 0,
    tokens: {
      total: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
  }
  const part: Message.TextPart = {
    id: partID,
    messageID,
    sessionID: callerSession.id,
    type: "text",
    text,
    source: "system",
    time: {
      start: now,
      end: now,
    },
    metadata: MissionCallerReceiptPartMetadata.parse({
      source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
      mission_id: missionID(missionSession),
      mission_session_id: missionSession.id,
      terminal_reason: input.status.reason,
    }),
  }
  const latestMissionSession = await Session.get(missionSession.id)
  const latestMission = missionMetadata(latestMissionSession)
  if (!latestMission) throw new Error(`Mission session ${missionSession.id} is missing metadata.mission`)
  const receipt = MissionReceiptMetadata.parse({
    message_id: messageID,
    part_id: partID,
    terminal_reason: input.status.reason,
    sent_at: now,
  })
  await Session.persistMessageWithCommit(
    {
      info: message,
      parts: [part],
      metadataPatches: [
        {
          sessionID: missionSession.id,
          patch: {
            mission: {
              ...latestMission,
              receipt,
            },
          },
        },
      ],
      touchSessionID: callerSession.id,
    },
    () => undefined,
    undefined,
    assertUnoccupied,
  )
  return receipt
}

export function ensureMissionCallerReceiptBridge() {
  const directory = Instance.directory
  if (initializedDirectories.has(directory)) return
  initializedDirectories.add(directory)
  Bus.subscribe(SessionStatus.Event.Status, async (event) => {
    const status = event.properties.status
    if (status.type !== "terminal") return
    await recordMissionCallerReceipt({
      sessionID: event.properties.sessionID,
      status,
    })
  })
  Bus.subscribe(Bus.InstanceDisposed, (event) => {
    initializedDirectories.delete(event.properties.directory)
  })
  log.info("installed mission caller receipt bridge", { directory })
}
