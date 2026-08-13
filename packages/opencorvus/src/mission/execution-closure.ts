import { randomUUID } from "node:crypto"
import z from "zod"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
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

export async function openMissionExecution(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
}): Promise<MissionExecutionClosure> {
  const closing = activeCloseOperations.get(input.sessionID)
  if (closing) await closing
  return withMissionExecutionAdmission(input.sessionID, async () => {
    const current = currentMissionExecutionClosure(input.sessionID)
    if (current && current.missionID !== input.missionID) {
      throw new Error(
        `Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`,
      )
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
      if (current?.state === "closed" || current?.state === "closing") return current
      return appendMissionExecutionClosure({
        missionID: input.missionID,
        sessionID: input.sessionID,
        operationID: randomUUID(),
        state: "closing",
        source: input.source,
        requestID: input.requestID,
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
