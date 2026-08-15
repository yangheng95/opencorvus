import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { Database, eq } from "@/storage/db"
import { ProtocolStore, protocolEventRequiresPayloadOrderKey, type EventInput } from "@/protocol/store"
import { EngineTaskTable } from "./engine.sql"
import { MessageTable } from "@/session/session.sql"
import { timelineOrderKey } from "@/timeline/order"

type Meta = {
  kind?: "event" | "command" | "reply"
  taskID?: string
  sessionID?: string
  interactionID?: string
  source?: string
  target?: string
  correlationID?: string
  causationID?: string
  emittedAt?: number
}

function text(input: Record<string, unknown>, key: string) {
  const value = input[key]
  return typeof value === "string" && value ? value : undefined
}

function payload<Definition extends BusEvent.Definition>(properties: z.output<Definition["properties"]>) {
  return structuredClone(properties) as Record<string, unknown>
}

function causalOrderKeyForProtocolEvent(type: string, data: Record<string, unknown>): string | undefined {
  if (!protocolEventRequiresPayloadOrderKey(type)) return undefined
  const inputMessageID = text(data, "inputMessageID")
  if (!inputMessageID) throw new Error(`protocol event ${type} is missing inputMessageID for orderKey`)
  const row = Database.use((db) =>
    db.select({ timeCreated: MessageTable.time_created }).from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get(),
  )
  if (!row) throw new Error(`protocol event ${type} references missing input Message ${inputMessageID}`)
  return timelineOrderKey({
    domain: "session",
    time: row.timeCreated,
    id: inputMessageID,
  })
}

export namespace EngineProtocol {
  function eventInput<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    meta: Meta = {},
  ) {
    const data = payload(BusEvent.parseProperties(def, properties))
    const taskID = meta.taskID ?? text(data, "taskID")
    if (!taskID) throw new Error(`protocol event ${def.type} is missing taskID`)
    const task = Database.use((db) =>
      db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
    )
    if (!task) throw new Error(`protocol event ${def.type} references missing task ${taskID}`)
    // Bus projections carry Task identity for transient routing. Durable Task
    // facts own it once, in the aggregate tuple.
    delete data.taskID
    const now = meta.emittedAt ?? Date.now()
    const sessionID = meta.sessionID ?? text(data, "sessionID") ?? undefined
    const interactionID = meta.interactionID ?? text(data, "interactionID") ?? undefined
    const orderKey = causalOrderKeyForProtocolEvent(def.type, data)
    delete data.sessionID
    delete data.interactionID
    delete data.orderKey
    if (def.type === "task.updated") delete data.status
    if (["task.completed", "task.failed", "task.cancelled"].includes(def.type)) delete data.timeCompleted
    return {
      kind: meta.kind ?? "event",
      type: def.type,
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: sessionID ?? null,
      interaction_id: interactionID ?? null,
      stream_id: null,
      source: meta.source ?? "assistant",
      target: meta.target ?? null,
      correlation_id: meta.correlationID ?? null,
      causation_id: meta.causationID ?? null,
      reply_to: null,
      emitted_at: now,
      order_key: orderKey,
      payload: data,
    } satisfies EventInput
  }

  export async function emit<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    meta: Meta = {},
  ) {
    return ProtocolStore.appendEvent(eventInput(def, properties, meta))
  }

  export function emitInTransaction<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    meta: Meta = {},
  ) {
    return ProtocolStore.appendEventInTransaction(eventInput(def, properties, meta))
  }
}
