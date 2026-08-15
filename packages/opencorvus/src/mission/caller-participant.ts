import z from "zod"
import { Identifier } from "@/id/id"
import {
  RIGHT_SIDEBAR_CONVERSATION_SOURCE,
  isRightSidebarConversationSession,
  rightSidebarConversationAgentID,
} from "@/chat/session"
import { Database, and, eq } from "@/storage/db"
import { PartTable, SessionTable } from "@/session/session.sql"
import { MissionID } from "./schema"

export const MissionTerminalReason = z.enum(["completed", "error", "aborted"])

export const MissionCallerMetadata = z
  .object({
    session_id: Identifier.schema("session"),
    message_id: Identifier.schema("message"),
    surface: z.literal("right-sidebar"),
    experience: z.enum(["chat", "work"]),
  })
  .strict()
export type MissionCallerMetadata = z.infer<typeof MissionCallerMetadata>

export const MissionCallerReceiptPartMetadata = z
  .object({
    source: z.literal(RIGHT_SIDEBAR_CONVERSATION_SOURCE),
    mission_id: MissionID,
    mission_session_id: Identifier.schema("session"),
    terminal_reason: MissionTerminalReason,
  })
  .strict()
export type MissionCallerReceiptPartMetadata = z.infer<typeof MissionCallerReceiptPartMetadata>

export const MissionReceiptMetadata = z
  .object({
    message_id: Identifier.schema("message"),
    part_id: Identifier.schema("part"),
    terminal_reason: MissionTerminalReason,
    sent_at: z.number(),
  })
  .strict()
export type MissionReceiptMetadata = z.infer<typeof MissionReceiptMetadata>

export const MissionCallerReceiptParticipantEvidence = z
  .object({
    kind: z.literal("mission-caller-receipt"),
    ownerSessionID: Identifier.schema("session"),
    ownerAgentID: z.enum(["chat", "work"]),
    messageID: Identifier.schema("message"),
    parentMessageID: Identifier.schema("message"),
    missionSessionID: Identifier.schema("session"),
  })
  .strict()
export type MissionCallerReceiptParticipantEvidence = z.infer<typeof MissionCallerReceiptParticipantEvidence>

export function missionMetadataRecord(metadata: unknown): Record<string, unknown> | undefined {
  const mission = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).mission : undefined
  return mission && typeof mission === "object" && !Array.isArray(mission)
    ? (mission as Record<string, unknown>)
    : undefined
}

export function missionCallerFromMetadata(metadata: unknown): MissionCallerMetadata | undefined {
  const raw = missionMetadataRecord(metadata)?.caller
  if (raw === undefined) return undefined
  return MissionCallerMetadata.parse(raw)
}

/**
 * Resolve the one persisted relationship that permits a Mission-authored
 * receipt to participate in its caller Chat without becoming that Chat's
 * owner. The receipt TextPart and Mission caller metadata must independently
 * identify the same Mission, Chat, caller message, project, and directory.
 */
export function resolveMissionCallerReceiptParticipant(input: {
  ownerSessionID: string
  messageID: string
  parentMessageID?: string
  author: string
  agentID: string
}): MissionCallerReceiptParticipantEvidence | undefined {
  if (input.author !== "mission" || input.agentID !== "mission" || !input.messageID || !input.parentMessageID) {
    return undefined
  }

  const owner = Database.use((db) =>
    db
      .select({
        projectID: SessionTable.project_id,
        directory: SessionTable.directory,
        kind: SessionTable.kind,
        metadata: SessionTable.metadata,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, input.ownerSessionID))
      .get(),
  )
  if (!owner || !isRightSidebarConversationSession(owner)) return undefined
  const ownerAgentID = rightSidebarConversationAgentID(owner)
  if (!ownerAgentID) return undefined

  const parts = Database.use((db) =>
    db
      .select({ id: PartTable.id, data: PartTable.data })
      .from(PartTable)
      .where(eq(PartTable.message_id, input.messageID))
      .all(),
  )

  const receiptParts = parts.flatMap((row) => {
    const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : undefined
    if (!data || data.type !== "text" || data.source !== "system") return []
    const parsed = MissionCallerReceiptPartMetadata.safeParse(data.metadata)
    return parsed.success ? [{ id: row.id, metadata: parsed.data }] : []
  })
  if (receiptParts.length === 0) return undefined
  if (receiptParts.length > 1) {
    throw new Error(`Mission caller receipt ${input.messageID} has ${receiptParts.length} participant evidence parts`)
  }
  const receiptPart = receiptParts[0]!
  const receipt = receiptPart.metadata

  const mission = Database.use((db) =>
    db
      .select({
        projectID: SessionTable.project_id,
        directory: SessionTable.directory,
        kind: SessionTable.kind,
        metadata: SessionTable.metadata,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, receipt.mission_session_id))
      .get(),
  )
  if (!mission || mission.kind !== "mission") {
    throw new Error(`Mission caller receipt ${input.messageID} references a missing Mission session`)
  }
  if (mission.projectID !== owner.projectID || mission.directory !== owner.directory) {
    throw new Error(`Mission caller receipt ${input.messageID} crosses its caller project or directory`)
  }
  const missionMetadata = missionMetadataRecord(mission.metadata)
  if (missionMetadata?.id !== receipt.mission_id) {
    throw new Error(`Mission caller receipt ${input.messageID} does not match its Mission identity`)
  }
  const receiptPointer = MissionReceiptMetadata.safeParse(missionMetadata.receipt)
  if (
    !receiptPointer.success ||
    receiptPointer.data.message_id !== input.messageID ||
    receiptPointer.data.part_id !== receiptPart.id ||
    receiptPointer.data.terminal_reason !== receipt.terminal_reason
  ) {
    throw new Error(`Mission caller receipt ${input.messageID} does not match its formal receipt pointer`)
  }
  const caller = missionCallerFromMetadata(mission.metadata)
  if (caller?.session_id !== input.ownerSessionID || caller.message_id !== input.parentMessageID) {
    throw new Error(`Mission caller receipt ${input.messageID} does not match its persisted caller lineage`)
  }
  return MissionCallerReceiptParticipantEvidence.parse({
    kind: "mission-caller-receipt",
    ownerSessionID: input.ownerSessionID,
    ownerAgentID,
    messageID: input.messageID,
    parentMessageID: input.parentMessageID,
    missionSessionID: receipt.mission_session_id,
  })
}

export function isMissionCallerReceiptParticipant(
  value: unknown,
  identity: {
    participantAgentID: string
    ownerSessionID: string
    ownerAgentID: string
    messageID: string
    parentMessageID: string
  },
): value is MissionCallerReceiptParticipantEvidence {
  const parsed = MissionCallerReceiptParticipantEvidence.safeParse(value)
  return (
    identity.participantAgentID === "mission" &&
    parsed.success &&
    parsed.data.ownerSessionID === identity.ownerSessionID &&
    parsed.data.ownerAgentID === identity.ownerAgentID &&
    parsed.data.messageID === identity.messageID &&
    parsed.data.parentMessageID === identity.parentMessageID
  )
}
