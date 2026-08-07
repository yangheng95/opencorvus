import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { Database, eq } from "@/storage/db"
import { ProtocolStore, protocolEventRequiresPayloadOrderKey, type EventInput } from "@/protocol/store"
import { EngineTaskTable } from "./engine.sql"
import { SessionTable } from "@/session/session.sql"
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
}

function text(input: Record<string, unknown>, key: string) {
  const value = input[key]
  return typeof value === "string" && value ? value : undefined
}

function payload<Definition extends BusEvent.Definition>(properties: z.output<Definition["properties"]>) {
  return structuredClone(properties) as Record<string, unknown>
}

function sessionOrderKeyForProtocolEvent(type: string, sessionID: string | undefined): string | undefined {
  if (!protocolEventRequiresPayloadOrderKey(type)) return undefined
  if (!sessionID) throw new Error(`protocol event ${type} is missing sessionID for orderKey`)
  const row = Database.use((db) =>
    db.select({ timeCreated: SessionTable.time_created }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
  )
  if (!row) throw new Error(`protocol event ${type} references missing session ${sessionID}`)
  return timelineOrderKey({
    domain: "session",
    time: row.timeCreated,
    id: sessionID,
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
    const now = Date.now()
    const sessionID = meta.sessionID ?? text(data, "sessionID") ?? undefined
    const orderKey = sessionOrderKeyForProtocolEvent(def.type, sessionID)
    if (orderKey) data.orderKey = orderKey
    return {
      kind: meta.kind ?? "event",
      type: def.type,
      aggregate: "task",
      aggregate_id: taskID,
      task_id: taskID,
      session_id: sessionID ?? null,
      interaction_id: meta.interactionID ?? text(data, "interactionID") ?? null,
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
