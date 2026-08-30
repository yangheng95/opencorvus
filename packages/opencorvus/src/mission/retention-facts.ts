import { randomUUID } from "node:crypto"
import z from "zod"
import { Identifier } from "@/id/id"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Database, and, eq } from "@/storage/db"
import { MissionExecutionCloseProvenance } from "./execution-closure-schema"

export const MISSION_DELETE_RETENTION_EVENT_TYPE = "mission.retention.delete_requested"

const MissionDeleteRetentionPayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    provenance: MissionExecutionCloseProvenance,
  })
  .strict()

export type MissionDeleteRetentionIntent = z.infer<typeof MissionDeleteRetentionPayload> & {
  eventID: string
  sessionID: string
  operationID: string
}

export function currentMissionDeleteRetentionIntentInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
): MissionDeleteRetentionIntent | undefined {
  const row = db
    .select({
      id: ProtocolEventTable.id,
      correlationID: ProtocolEventTable.correlation_id,
      payload: ProtocolEventTable.payload,
    })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, sessionID),
        eq(ProtocolEventTable.type, MISSION_DELETE_RETENTION_EVENT_TYPE),
      ),
    )
    .limit(1)
    .get()
  if (!row) return undefined
  return {
    ...MissionDeleteRetentionPayload.parse(row.payload),
    eventID: Identifier.schema("protocol_event").parse(row.id),
    sessionID,
    operationID: z.string().uuid().parse(row.correlationID),
  }
}

export function currentMissionDeleteRetentionIntent(sessionID: string): MissionDeleteRetentionIntent | undefined {
  return Database.use((db) => currentMissionDeleteRetentionIntentInTransaction(db, sessionID))
}

export function ensureMissionDeleteRetentionIntentInTransaction(
  db: Database.TxOrDb,
  input: {
    missionID: string
    sessionID: string
    requestID: string
    provenance: z.input<typeof MissionExecutionCloseProvenance>
  },
): MissionDeleteRetentionIntent {
  Database.requireActiveTransaction("ensureMissionDeleteRetentionIntentInTransaction")
  const existing = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
  if (existing) {
    if (existing.missionID !== input.missionID) {
      throw new Error(
        `Mission delete retention ${existing.eventID} belongs to Mission ${existing.missionID}, not ${input.missionID}`,
      )
    }
    return existing
  }
  const payload = MissionDeleteRetentionPayload.parse({
    missionID: input.missionID,
    requestID: input.requestID,
    provenance: input.provenance,
  })
  const operationID = randomUUID()
  const event = ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: MISSION_DELETE_RETENTION_EVENT_TYPE,
    aggregate: "session",
    aggregate_id: input.sessionID,
    source: "mission.delete",
    correlation_id: operationID,
    payload,
  })
  return {
    ...payload,
    eventID: event.id,
    sessionID: input.sessionID,
    operationID,
  }
}

export function sessionDeletedInTransaction(db: Database.TxOrDb, sessionID: string): boolean {
  return Boolean(
    db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, sessionID),
          eq(ProtocolEventTable.type, "session.deleted"),
        ),
      )
      .limit(1)
      .get(),
  )
}
