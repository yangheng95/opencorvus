import { Identifier } from "@/id/id"
import { Database, and, eq } from "@/storage/db"
import {
  EngineInteractionRequestTable,
  type EngineInteractionStatus,
  type EngineInteractionType,
  type EngineMetadata,
} from "./engine.sql"
import { Event } from "./model"
import { EngineProtocol } from "./protocol"
import type { InteractionRow } from "./store"

export interface InsertEngineInteractionRequestInput {
  taskID: string
  sessionID: string
  externalID: string
  requestType: EngineInteractionType
  title: string
  body: string
  payload: EngineMetadata
  eventSource: string
  eventSummary: string
  timeCreated?: number
}

export function insertEngineInteractionRequest(
  db: Database.TxOrDb,
  input: InsertEngineInteractionRequestInput,
): string {
  const id = Identifier.ascending("interaction")
  const timeCreated = input.timeCreated ?? Date.now()
  db.insert(EngineInteractionRequestTable)
    .values({
      id,
      task_id: input.taskID,
      session_id: input.sessionID,
      external_id: input.externalID,
      request_type: input.requestType,
      status: "pending",
      title: input.title,
      body: input.body,
      payload: input.payload,
      time_created: timeCreated,
      time_updated: timeCreated,
    })
    .run()
  Database.effect(() =>
    EngineProtocol.emit(
      Event.InteractionRequested,
      {
        taskID: input.taskID,
        interactionID: id,
        requestType: input.requestType,
        summary: input.eventSummary,
      },
      { taskID: input.taskID, interactionID: id, source: input.eventSource },
    ),
  )
  return id
}

export interface ResolveEngineInteractionRequestInput {
  row: InteractionRow
  status: Exclude<EngineInteractionStatus, "pending">
  response: EngineMetadata
  eventSource: string
  timeResolved?: number
}

export function resolveEngineInteractionRequest(
  db: Database.TxOrDb,
  input: ResolveEngineInteractionRequestInput,
): void {
  const timeResolved = input.timeResolved ?? Date.now()
  const requestType = input.row.request_type
  if (!requestType) throw new Error(`Interaction ${input.row.id} has no request type ownership`)
  const sessionID = input.row.session_id
  if (!sessionID) throw new Error(`Interaction ${input.row.id} has no session ownership`)
  const summaryByStatus: Record<Exclude<EngineInteractionStatus, "pending">, string> = {
    answered: "Interaction answered",
    rejected: "Interaction rejected by operator",
    expired: "Interaction deadline expired",
  }
  const updated = db
    .update(EngineInteractionRequestTable)
    .set({
      status: input.status,
      response: input.response,
      time_resolved: timeResolved,
      time_updated: timeResolved,
    })
    .where(
      and(
        eq(EngineInteractionRequestTable.id, input.row.id),
        eq(EngineInteractionRequestTable.external_id, input.row.external_id),
        eq(EngineInteractionRequestTable.session_id, sessionID),
        eq(EngineInteractionRequestTable.request_type, requestType),
        eq(EngineInteractionRequestTable.status, "pending"),
      ),
    )
    .returning({ id: EngineInteractionRequestTable.id })
    .get()
  if (!updated) {
    throw new Error(`Interaction ${input.row.id} terminal resolution lost pending compare-and-set ownership`)
  }
  Database.effect(() =>
    EngineProtocol.emit(
      Event.InteractionResolved,
      {
        taskID: input.row.task_id,
        interactionID: input.row.id,
        status: input.status,
        summary: summaryByStatus[input.status],
      },
      {
        taskID: input.row.task_id,
        interactionID: input.row.id,
        source: input.eventSource,
      },
    ),
  )
}
