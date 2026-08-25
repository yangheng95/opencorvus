import { randomUUID } from "node:crypto"
import z from "zod"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { projectProtocolDeliveryInTransaction } from "@/protocol/delivery-projection"
import {
  schedulerWakeMessageMatchesInTransaction,
  successfulSchedulerWakeReplyExistsInTransaction,
} from "@/protocol/session-wake-state"
import { Database, and, eq, sql } from "@/storage/db"
import { Identifier } from "@/id/id"
import { withKeyedLock } from "@/util/lock"
import { NamedError } from "@opencorvus-ai/util/error"
import { acquireControlLease, assertControlLeaseInTransaction, releaseControlLease, releaseControlLeaseInTransaction, releaseControlLeaseOnErrorPath, renewControlLease } from "@/engine/control-lease"

export const MISSION_EXECUTION_CLOSURE_EVENT_TYPES = {
  opened: "mission.execution.opened",
  closing: "mission.execution.closing",
  closed: "mission.execution.closed",
} as const

export const MissionExecutionClosurePayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
  })
  .strict()

export type MissionExecutionClosure = z.infer<typeof MissionExecutionClosurePayload> & {
  eventID: string
  sessionID: string
  operationID: string
  state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES
  source: string
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
  const state = (Object.entries(MISSION_EXECUTION_CLOSURE_EVENT_TYPES) as Array<[
    keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES,
    string,
  ]>).find(([, type]) => type === event.type)?.[0]
  if (
    !state ||
    event.aggregate !== "session" ||
    event.aggregateID !== event.sessionID ||
    !event.sessionID ||
    !event.correlationID
  ) {
    throw new Error(`Mission execution closure event ${event.id} has conflicting Session identity`)
  }
  return {
    ...payload,
    eventID: event.id,
    sessionID: event.sessionID,
    operationID: event.correlationID,
    state,
    source: event.source,
  }
}

export function currentMissionExecutionClosure(sessionID: string): MissionExecutionClosure | undefined {
  return Database.use((db) => currentMissionExecutionClosureInTransaction(db, sessionID))
}

function currentMissionExecutionClosureInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
): MissionExecutionClosure | undefined {
  const row = db.select().from(ProtocolEventTable).where(and(
    eq(ProtocolEventTable.aggregate_type, "session"),
    eq(ProtocolEventTable.aggregate_id, sessionID),
  )).all().filter((event) => Object.values(MISSION_EXECUTION_CLOSURE_EVENT_TYPES).includes(event.type as never))
    .toSorted((left, right) => right.seq - left.seq || right.id.localeCompare(left.id))[0]
  return closureFromEvent(row ? ProtocolStore.requireEvent(row.id) : undefined)
}

async function appendMissionExecutionClosure(
  input: z.input<typeof MissionExecutionClosurePayload> & { sessionID: string; operationID: string; state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES; source: string },
): Promise<MissionExecutionClosure> {
  const payload = MissionExecutionClosurePayload.parse({ missionID: input.missionID, requestID: input.requestID })
  const event = await ProtocolStore.appendEvent({
    kind: "event",
    type: MISSION_EXECUTION_CLOSURE_EVENT_TYPES[input.state],
    aggregate: "session",
    aggregate_id: input.sessionID,
    session_id: null,
    source: input.source,
    correlation_id: input.operationID,
    payload,
  })
  return closureFromEvent(event)!
}

function appendMissionExecutionClosureInTransaction(
  input: z.input<typeof MissionExecutionClosurePayload> & { sessionID: string; operationID: string; state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES; source: string },
): MissionExecutionClosure {
  Database.requireActiveTransaction("appendMissionExecutionClosureInTransaction")
  const payload = MissionExecutionClosurePayload.parse({ missionID: input.missionID, requestID: input.requestID })
  const event = ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: MISSION_EXECUTION_CLOSURE_EVENT_TYPES[input.state],
    aggregate: "session",
    aggregate_id: input.sessionID,
    session_id: null,
    source: input.source,
    correlation_id: input.operationID,
    payload,
  })
  return closureFromEvent(event)!
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
      inbox: ProtocolInboxTable,
      eventID: ProtocolInboxTable.envelope_id,
    })
    .from(ProtocolInboxTable)
    .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
    .where(
      and(
        eq(ProtocolInboxTable.actor, "session"),
        eq(ProtocolInboxTable.actor_id, closure.sessionID),
        eq(ProtocolEventTable.type, "scheduler.message"),
      ),
    )
    .all()
  let settled = 0
  const now = Date.now()
  for (const row of rows) {
    const delivery = projectProtocolDeliveryInTransaction(db, row.inbox, now)
    const result = delivery.delivery_result
    if (delivery.status !== "delivered" || !result || result.kind !== "session_wake") continue
    if (
      !schedulerWakeMessageMatchesInTransaction(db, {
        sessionID: closure.sessionID,
        messageID: result.message_id,
        eventID: row.eventID,
        inboxID: row.inbox.id,
      })
    ) {
      throw new Error(`Scheduler inbox ${row.inbox.id} session wake Message occurrence is invalid during Mission closure`)
    }
    if (
      successfulSchedulerWakeReplyExistsInTransaction(db, {
        sessionID: closure.sessionID,
        messageID: result.message_id,
      })
    ) {
      continue
    }
    const receiptID = Identifier.deterministic(
      "protocol_inbox",
      `mission-wake-closure-receipt\0${row.inbox.id}\0${closure.eventID}`,
    )
    // The settlement boundary is the inbox, not the minted receipt identity: an
    // inbox carries at most one non-retry receipt, which is exactly what
    // `protocol_delivery_receipt_terminal_idx` enforces. That index is partial,
    // so it cannot serve as an ON CONFLICT target; this restates its predicate
    // instead. The surrounding transaction is immediate, so the read and the
    // insert settle atomically.
    const settledReceipt = db
      .select()
      .from(ProtocolDeliveryReceiptTable)
      .where(
        and(
          eq(ProtocolDeliveryReceiptTable.inbox_id, row.inbox.id),
          sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') <> 'retry_wait'`,
        ),
      )
      .get()
    if (!settledReceipt) {
      db.insert(ProtocolDeliveryReceiptTable)
        .values({
          id: receiptID,
          inbox_id: row.inbox.id,
          receipt: {
            kind: "mission_wake_closed",
            message_id: result.message_id,
            closure_event_id: closure.eventID,
          },
          time_created: now,
        })
        .run()
      settled += 1
      continue
    }
    const existingResult = settledReceipt.receipt
    // A prior closure of the same wake is a valid settled state; only a receipt
    // that settles a different Message contradicts the immutable fact.
    if (
      existingResult?.kind !== "mission_wake_closed" ||
      existingResult.message_id !== result.message_id
    ) throw new Error(`Mission wake closure receipt ${receiptID} conflicts with the immutable settlement fact`)
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
  return Database.immediateTransaction((db) => {
    const exact = db.select({ id: ProtocolEventTable.id }).from(ProtocolEventTable).where(and(
      eq(ProtocolEventTable.aggregate_type, "session"),
      eq(ProtocolEventTable.aggregate_id, input.sessionID),
      eq(ProtocolEventTable.type, MISSION_EXECUTION_CLOSURE_EVENT_TYPES.opened),
      eq(ProtocolEventTable.source, input.source),
    )).all().map((row) => closureFromEvent(ProtocolStore.requireEvent(row.id))!)
      .find((event) => event.requestID === input.requestID)
    if (exact) {
      if (exact.missionID !== input.missionID) {
        throw new Error(`Mission open request ${input.requestID} conflicts with Mission ${exact.missionID}`)
      }
      return exact
    }
    const current = currentMissionExecutionClosureInTransaction(db, input.sessionID)
    if (current && current.missionID !== input.missionID) {
      throw new Error(`Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`)
    }
    // An opened Session is already the one live Mission occurrence. A
    // different dispatch/wake request is another activation of that occurrence,
    // not authority to mint a second lifecycle boundary.
    if (current?.state === "opened") return current
    if (current?.state === "closing") {
      throw new MissionExecutionClosingError({
        message: `Mission ${input.missionID} execution is still closing; retry or complete the durable close operation before reopening it.`,
        missionID: input.missionID,
        sessionID: input.sessionID,
        operationID: current.operationID,
        closureEventID: current.eventID,
      })
    }
    return appendMissionExecutionClosureInTransaction({
      ...input,
      operationID: randomUUID(),
      state: "opened",
    })
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

export const MissionExecutionClosureTestHooks = {
  /** Simulates another process, whose process-local owner map is empty. */
  forgetLocalCloseOwner(sessionID: string) {
    activeCloseOperations.delete(sessionID)
  },
}

export function closeMissionExecutionOperation(input: {
  missionID: string
  sessionID: string
  source: "mission.abort" | "mission.delete" | "mission.archive"
  requestID: string
  close: (signal: AbortSignal) => Promise<void>
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
    const ownerOccurrenceID = Identifier.ascending("call")
    const targetID = `mission:${closing.sessionID}`
    const leaseMilliseconds = 120_000
    let acquired = acquireControlLease({
      target: "lifecycle",
      targetID,
      ownerOccurrenceID,
      now: Date.now(),
      leaseMilliseconds,
    })
    while (!acquired.acquired) {
      const current = currentMissionExecutionClosure(closing.sessionID)
      if (current?.state === "closed") return current
      const waitMilliseconds = Math.max(10, Math.min(100, acquired.lease.expires_at - Date.now()))
      await new Promise((resolve) => setTimeout(resolve, waitMilliseconds))
      acquired = acquireControlLease({
        target: "lifecycle",
        targetID,
        ownerOccurrenceID,
        now: Date.now(),
        leaseMilliseconds,
      })
    }
    const owner = new AbortController()
    let renewalFailure: unknown
    const renewal = setInterval(() => {
      if (renewalFailure) return
      try {
        const now = Date.now()
        renewControlLease({
          target: "lifecycle",
          targetID,
          leaseID: acquired.lease.id,
          ownerOccurrenceID,
          now,
          expiresAt: now + leaseMilliseconds,
        })
      } catch (error) {
        renewalFailure = error
        owner.abort(error)
      }
    }, 40_000)
    renewal.unref()
    let settled = false
    try {
      await input.close(owner.signal)
      if (renewalFailure) throw renewalFailure
      const closed = Database.immediateTransaction((db) => {
        const settledAt = Date.now()
        assertControlLeaseInTransaction(db, {
          target: "lifecycle",
          targetID,
          leaseID: acquired.lease.id,
          ownerOccurrenceID,
          now: settledAt,
        })
        const current = currentMissionExecutionClosure(closing.sessionID)
        const result =
          current?.state === "closed"
            ? current
            : appendMissionExecutionClosureInTransaction({
                missionID: closing.missionID,
                sessionID: closing.sessionID,
                operationID: closing.operationID,
                state: "closed",
                source: closing.source,
                requestID: closing.requestID,
              })
        // The closure fact is terminal, so this owner is finished. The next
        // closure waits for the lease by polling every 10-100 ms, which means
        // an unreleased lease turns the next close into a busy wait for the
        // full lease duration.
        releaseControlLeaseInTransaction(db, {
          target: "lifecycle",
          targetID,
          leaseID: acquired.lease.id,
          ownerOccurrenceID,
          now: settledAt,
        })
        return result
      })
      settled = true
      return closed
    } finally {
      clearInterval(renewal)
      // A close that ended without a closure fact leaves the Mission open for
      // another attempt. That attempt cannot start while this dead owner still
      // holds the lease.
      if (!settled) {
        releaseControlLeaseOnErrorPath({
          target: "lifecycle",
          targetID,
          leaseID: acquired.lease.id,
          ownerOccurrenceID,
          now: Date.now(),
        })
      }
    }
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
