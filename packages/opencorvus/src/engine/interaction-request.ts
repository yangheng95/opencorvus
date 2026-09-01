import { Identifier } from "@/id/id"
import { Database, and, eq } from "@/storage/db"
import {
  EngineInteractionRequestTable,
  EngineInteractionOutcomeTable,
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
  source?: { kind: "bus_question" | "permission_request"; id: string }
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
      task_id: input.source ? null : input.taskID,
      source_kind: input.source?.kind ?? null,
      source_id: input.source?.id ?? null,
      session_id: input.source ? null : input.sessionID,
      external_id: input.source ? null : input.externalID,
      request_type: input.source ? null : input.requestType,
      title: input.source ? null : input.title,
      body: input.source ? null : input.body,
      payload: input.source ? null : input.payload,
      time_created: input.source ? null : timeCreated,
    })
    .run()
  EngineProtocol.emitInTransaction(
    Event.InteractionRequested,
    {
      taskID: input.taskID,
      interactionID: id,
      requestType: input.requestType,
      summary: input.eventSummary,
    },
    { taskID: input.taskID, interactionID: id, source: input.eventSource },
  )
  return id
}

export interface ResolveEngineInteractionRequestInput {
  row: InteractionRow
  status: Exclude<EngineInteractionStatus, "pending">
  response: EngineMetadata
  eventSource: string
  timeResolved?: number
  sourceOccurrenceID?: string
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
  const current = db
    .select()
    .from(EngineInteractionRequestTable)
    .where(eq(EngineInteractionRequestTable.id, input.row.id))
    .get()
  if (!current) throw new Error(`Interaction ${input.row.id} request fact disappeared before outcome append`)
  const id = Identifier.deterministic("interaction", `interaction-outcome\0${input.row.id}`)
  const existing = db
    .select()
    .from(EngineInteractionOutcomeTable)
    .where(eq(EngineInteractionOutcomeTable.interaction_id, input.row.id))
    .get()
  if (existing) {
    if (input.sourceOccurrenceID && existing.source_occurrence_id === input.sourceOccurrenceID) return
    if (
      !input.sourceOccurrenceID &&
      existing.source_occurrence_id === null &&
      existing.outcome === input.status &&
      JSON.stringify(existing.response) === JSON.stringify(input.response)
    )
      return
    throw new Error(`Interaction ${input.row.id} has a conflicting immutable outcome ${existing.id}`)
  }
  if ((current.source_kind === "bus_question") !== Boolean(input.sourceOccurrenceID)) {
    throw new Error(`Interaction ${input.row.id} outcome does not match its immutable owner branch`)
  }
  db.insert(EngineInteractionOutcomeTable)
    .values({
      id,
      interaction_id: input.row.id,
      source_occurrence_id: input.sourceOccurrenceID ?? null,
      outcome: input.sourceOccurrenceID ? null : input.status,
      response: input.sourceOccurrenceID ? null : input.response,
      time_created: input.sourceOccurrenceID ? null : timeResolved,
    })
    .run()
  EngineProtocol.emitInTransaction(
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
  )
}
