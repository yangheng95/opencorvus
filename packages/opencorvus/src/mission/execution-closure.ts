import { randomUUID } from "node:crypto"
import z from "zod"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
import { ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolInboxDeliveryResult } from "@/protocol/schema"
import {
  schedulerWakeMessageMatchesInTransaction,
  successfulSchedulerWakeReplyExistsInTransaction,
} from "@/protocol/session-wake-state"
import { Database, and, eq, sql } from "@/storage/db"
import { withKeyedLock } from "@/util/lock"
import { NamedError } from "@opencorvus-ai/util/error"

export const MISSION_EXECUTION_CLOSURE_EVENT_TYPE = "mission.execution.closure"

export const MissionExecutionClosurePayload = z
  .object({
    protocol: z.literal("mission-execution-closure-v1"),
    missionID: z.string().min(1),
    sessionID: z.string().min(1),
    operationID: z.string().uuid(),
    state: z.enum(["opened", "closing", "closed"]),
    source: z.string().min(1),
    requestID: z.string().min(1),
  })
  .strict()

export type MissionExecutionClosure = z.infer<typeof MissionExecutionClosurePayload> & {
  eventID: string
}

export const MissionExecutionClosingError = NamedError.create(
  "MissionExecutionClosingError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
      operationID: z.string().uuid(),
      closureEventID: z.string().min(1),
    })
    .strict(),
)

export const MissionExecutionWakeClosedError = NamedError.create(
  "MissionExecutionWakeClosedError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
      state: z.enum(["closing", "closed"]),
      operationID: z.string().uuid(),
      closureEventID: z.string().min(1),
    })
    .strict(),
)

export const MissionExecutionWakeNotOpenedError = NamedError.create(
  "MissionExecutionWakeNotOpenedError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
    })
    .strict(),
)

const missionExecutionAdmissionLocks = new Map<string, Promise<unknown>>()

export function withMissionExecutionAdmission<T>(sessionID: string, operation: () => Promise<T>): Promise<T> {
  return withKeyedLock(missionExecutionAdmissionLocks, sessionID, operation)
}

function closureFromEvent(event: ProtocolEventView | undefined): MissionExecutionClosure | undefined {
  if (!event) return undefined
  const payload = MissionExecutionClosurePayload.parse(event.payload)
  if (
    event.type !== MISSION_EXECUTION_CLOSURE_EVENT_TYPE ||
    event.aggregate !== "session" ||
    event.aggregateID !== payload.sessionID ||
    event.sessionID !== payload.sessionID
  ) {
    throw new Error(`Mission execution closure event ${event.id} has conflicting Session identity`)
  }
  return { ...payload, eventID: event.id }
}

export function currentMissionExecutionClosure(sessionID: string): MissionExecutionClosure | undefined {
  return closureFromEvent(ProtocolStore.latestSessionEvent(sessionID, MISSION_EXECUTION_CLOSURE_EVENT_TYPE))
}

async function appendMissionExecutionClosure(
  input: Omit<z.input<typeof MissionExecutionClosurePayload>, "protocol">,
): Promise<MissionExecutionClosure> {
  const payload = MissionExecutionClosurePayload.parse({ protocol: "mission-execution-closure-v1", ...input })
  const event = await ProtocolStore.appendEvent({
    kind: "event",
    type: MISSION_EXECUTION_CLOSURE_EVENT_TYPE,
    aggregate: "session",
    aggregate_id: payload.sessionID,
    session_id: payload.sessionID,
    source: payload.source,
    correlation_id: payload.operationID,
    payload,
  })
  return { ...payload, eventID: event.id }
}

function appendMissionExecutionClosureInTransaction(
  input: Omit<z.input<typeof MissionExecutionClosurePayload>, "protocol">,
): MissionExecutionClosure {
  Database.requireActiveTransaction("appendMissionExecutionClosureInTransaction")
  const payload = MissionExecutionClosurePayload.parse({ protocol: "mission-execution-closure-v1", ...input })
  const event = ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: MISSION_EXECUTION_CLOSURE_EVENT_TYPE,
    aggregate: "session",
    aggregate_id: payload.sessionID,
    session_id: payload.sessionID,
    source: payload.source,
    correlation_id: payload.operationID,
    payload,
  })
  return { ...payload, eventID: event.id }
}

export function settleMissionSchedulerWakesForClosureInTransaction(
  db: Database.TxOrDb,
  closure: MissionExecutionClosure,
): number {
  Database.requireActiveTransaction("settleMissionSchedulerWakesForClosureInTransaction")
  if (closure.state !== "closing" && closure.state !== "closed") {
    throw new Error(`Mission wake closure settlement requires closing or closed state, got ${closure.state}`)
  }
  const rows = db
    .select({
      id: ProtocolInboxTable.id,
      eventID: ProtocolInboxTable.envelope_id,
      deliveryResult: ProtocolInboxTable.delivery_result,
    })
    .from(ProtocolInboxTable)
    .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
    .where(
      and(
        eq(ProtocolInboxTable.actor, "session"),
        eq(ProtocolInboxTable.actor_id, closure.sessionID),
        eq(ProtocolInboxTable.status, "delivered"),
        eq(ProtocolEventTable.type, "scheduler.message"),
      ),
    )
    .all()
  let settled = 0
  const now = Date.now()
  for (const row of rows) {
    const result = row.deliveryResult ? ProtocolInboxDeliveryResult.parse(row.deliveryResult) : undefined
    if (!result || result.kind !== "session_wake") continue
    if (
      !schedulerWakeMessageMatchesInTransaction(db, {
        sessionID: closure.sessionID,
        messageID: result.message_id,
        eventID: row.eventID,
        inboxID: row.id,
      })
    ) {
      throw new Error(`Scheduler inbox ${row.id} session wake Message occurrence is invalid during Mission closure`)
    }
    if (
      successfulSchedulerWakeReplyExistsInTransaction(db, {
        sessionID: closure.sessionID,
        messageID: result.message_id,
      })
    ) {
      continue
    }
    const updated = db
      .update(ProtocolInboxTable)
      .set({
        delivery_result: {
          kind: "mission_wake_closed",
          message_id: result.message_id,
          closure_event_id: closure.eventID,
        },
        time_completed: now,
        time_updated: now,
      })
      .where(
        and(
          eq(ProtocolInboxTable.id, row.id),
          eq(ProtocolInboxTable.status, "delivered"),
          sql`json_extract(${ProtocolInboxTable.delivery_result}, '$.kind') = 'session_wake'`,
          sql`json_extract(${ProtocolInboxTable.delivery_result}, '$.message_id') = ${result.message_id}`,
        ),
      )
      .returning({ id: ProtocolInboxTable.id })
      .get()
    if (updated) settled += 1
  }
  return settled
}

export function settleMissionSchedulerWakesForClosure(closure: MissionExecutionClosure): number {
  return Database.immediateTransaction((db) => settleMissionSchedulerWakesForClosureInTransaction(db, closure))
}

async function openMissionExecutionUnderAdmission(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
}): Promise<MissionExecutionClosure> {
  const current = currentMissionExecutionClosure(input.sessionID)
  if (current && current.missionID !== input.missionID) {
    throw new Error(`Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`)
  }
  if (current?.state === "closing") {
    throw new MissionExecutionClosingError({
      message: `Mission ${input.missionID} execution is still closing; retry or complete the durable close operation before reopening it.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      operationID: current.operationID,
      closureEventID: current.eventID,
    })
  }
  return appendMissionExecutionClosure({
    ...input,
    operationID: randomUUID(),
    state: "opened",
  })
}

export async function openMissionExecution(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
}): Promise<MissionExecutionClosure> {
  const closing = activeCloseOperations.get(input.sessionID)
  if (closing) await closing
  return withMissionExecutionAdmission(input.sessionID, () => openMissionExecutionUnderAdmission(input))
}

export async function openMissionExecutionWithWake<Receipt extends { activation: Promise<unknown> }>(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
  wake: () => Promise<Receipt>
}): Promise<Receipt> {
  const closing = activeCloseOperations.get(input.sessionID)
  if (closing) await closing
  return withMissionExecutionAdmission(input.sessionID, async () => {
    await openMissionExecutionUnderAdmission({
      missionID: input.missionID,
      sessionID: input.sessionID,
      source: input.source,
      requestID: input.requestID,
    })
    const receipt = await input.wake()
    await receipt.activation
    return receipt
  })
}

/**
 * Admit a non-operator wake only while the current Mission occurrence remains
 * active. This never opens or reopens an occurrence; explicit operator ingress
 * is the sole authority for that transition.
 */
export function admitMissionExecutionWake<Receipt extends { activation: Promise<unknown> }>(input: {
  missionID: string
  sessionID: string
  wake: () => Receipt | Promise<Receipt>
}): Promise<Receipt> {
  return withMissionExecutionAdmission(input.sessionID, async () => {
    const current = currentMissionExecutionClosure(input.sessionID)
    if (!current) {
      throw new MissionExecutionWakeNotOpenedError({
        message: `Mission ${input.missionID} has no opened execution occurrence for non-operator wake activation.`,
        missionID: input.missionID,
        sessionID: input.sessionID,
      })
    }
    if (current.missionID !== input.missionID) {
      throw new Error(
        `Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`,
      )
    }
    if (current.state === "closing" || current.state === "closed") {
      throw new MissionExecutionWakeClosedError({
        message: `Mission ${input.missionID} ${current.state} occurrence rejects non-operator wake activation under closure event ${current.eventID}.`,
        missionID: input.missionID,
        sessionID: input.sessionID,
        state: current.state,
        operationID: current.operationID,
        closureEventID: current.eventID,
      })
    }
    const receipt = await input.wake()
    await receipt.activation
    return receipt
  })
}

const activeCloseOperations = new Map<string, Promise<MissionExecutionClosure>>()

export function closeMissionExecutionOperation(input: {
  missionID: string
  sessionID: string
  source: "mission.abort" | "mission.delete" | "mission.archive"
  requestID: string
  close: () => Promise<void>
}): Promise<MissionExecutionClosure> {
  const active = activeCloseOperations.get(input.sessionID)
  if (active) return active

  const operation = (async () => {
    const closing = await withMissionExecutionAdmission(input.sessionID, async () => {
      const current = currentMissionExecutionClosure(input.sessionID)
      if (current && current.missionID !== input.missionID) {
        throw new Error(
          `Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`,
        )
      }
      if (current?.state === "closed" || current?.state === "closing") {
        settleMissionSchedulerWakesForClosure(current)
        return current
      }
      return Database.immediateTransaction((db) => {
        const closure = appendMissionExecutionClosureInTransaction({
          missionID: input.missionID,
          sessionID: input.sessionID,
          operationID: randomUUID(),
          state: "closing",
          source: input.source,
          requestID: input.requestID,
        })
        settleMissionSchedulerWakesForClosureInTransaction(db, closure)
        return closure
      })
    })
    if (closing.state === "closed") return closing
    await input.close()
    return appendMissionExecutionClosure({
      missionID: closing.missionID,
      sessionID: closing.sessionID,
      operationID: closing.operationID,
      state: "closed",
      source: closing.source,
      requestID: closing.requestID,
    })
  })()
  activeCloseOperations.set(input.sessionID, operation)
  void operation.then(
    () => {
      if (activeCloseOperations.get(input.sessionID) === operation) activeCloseOperations.delete(input.sessionID)
    },
    () => {
      if (activeCloseOperations.get(input.sessionID) === operation) activeCloseOperations.delete(input.sessionID)
    },
  )
  return operation
}

export function requireMissionExecutionClosureEvent(eventID: string): MissionExecutionClosure {
  return closureFromEvent(ProtocolStore.requireEvent(eventID))!
}
