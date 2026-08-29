import { randomUUID } from "node:crypto"
import z from "zod"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { schedulerMissionWakeDispositionInTransaction } from "@/protocol/session-wake-state"
import { ProtocolDeliveryReceipt } from "@/protocol/schema"
import { Database, and, eq } from "@/storage/db"
import { Identifier } from "@/id/id"
import { withKeyedLock } from "@/util/lock"
import { NamedError } from "@opencorvus-ai/util/error"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"
import { TaskCancellationRequestBody } from "@opencorvus-ai/transport-protocol"

export const MissionExecutionCloseSource = z.enum(["mission.abort", "mission.delete", "mission.archive"])
export type MissionExecutionCloseSource = z.infer<typeof MissionExecutionCloseSource>

export const MISSION_EXECUTION_CLOSURE_EVENT_TYPES = {
  opened: "mission.execution.opened",
  closing: "mission.execution.closing",
  closed: "mission.execution.closed",
} as const

const MISSION_EXECUTION_PROVENANCE_EVENT_TYPES = {
  required: "mission.execution.cancellation_provenance.required",
  unavailable_terminal: "mission.execution.cancellation_provenance.unavailable_terminal",
  supplied: "mission.execution.cancellation_provenance.supplied",
} as const

const MissionExecutionOpenedOccurrence = z
  .object({
    eventID: Identifier.schema("protocol_event"),
    operationID: z.string().uuid(),
  })
  .strict()

export const MissionExecutionClosurePayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    cancellation: TaskCancellationRequestBody.optional(),
    openedOccurrence: MissionExecutionOpenedOccurrence.optional(),
  })
  .strict()

export type MissionExecutionClosure = z.infer<typeof MissionExecutionClosurePayload> & {
  eventID: string
  sessionID: string
  operationID: string
  state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES | "recovery_blocked"
  source: string
  provenanceAuthorityEventID?: string
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
      state: z.enum(["closing", "closed", "recovery_blocked"]),
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

export const MissionExecutionWakeOccurrenceChangedError = NamedError.create(
  "MissionExecutionWakeOccurrenceChangedError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
      expectedOperationID: z.string().uuid(),
      expectedClosureEventID: z.string().min(1),
      currentOperationID: z.string().uuid(),
      currentClosureEventID: z.string().min(1),
    })
    .strict(),
)

export const MissionExecutionCancellationProvenanceRequiredError = NamedError.create(
  "MissionExecutionCancellationProvenanceRequiredError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
      operationID: z.string().uuid(),
      closureEventID: Identifier.schema("protocol_event"),
      authorityEventID: Identifier.schema("protocol_event"),
      requiredSource: MissionExecutionCloseSource,
    })
    .strict(),
)

export type MissionExecutionWakePersistence = Readonly<{
  openedEventID: string
  openedOperationID: string
  /** Exact occurrence fence executed inside the Message bundle write transaction. */
  preflightBundle: () => void
}>

const missionExecutionAdmissionLocks = new Map<string, Promise<unknown>>()

export function withMissionExecutionAdmission<T>(sessionID: string, operation: () => Promise<T>): Promise<T> {
  return withKeyedLock(missionExecutionAdmissionLocks, sessionID, operation)
}

const HistoricalMissionExecutionClosurePayload = z
  .object({ missionID: z.string().min(1), requestID: z.string().min(1) })
  .strict()

const MissionExecutionProvenanceBoundaryPayload = z
  .object({
    version: z.literal(1),
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    requiredSource: MissionExecutionCloseSource,
  })
  .strict()

const MissionExecutionSuppliedProvenancePayload = z
  .object({
    version: z.literal(1),
    missionID: z.string().min(1),
    originalRequestID: z.string().min(1),
    requestID: z.string().min(1),
    source: MissionExecutionCloseSource,
    cancellation: TaskCancellationRequestBody,
  })
  .strict()

function provenanceEventsForClosure(event: ProtocolEventView): ProtocolEventView[] {
  return Database.use((db) =>
    db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, event.aggregateID),
          eq(ProtocolEventTable.causation_id, event.id),
        ),
      )
      .all()
      .map((row) => ProtocolStore.requireEvent(row.id))
      .filter((candidate) => Object.values(MISSION_EXECUTION_PROVENANCE_EVENT_TYPES).includes(candidate.type as never)),
  )
}

function closureFromEvent(event: ProtocolEventView | undefined): MissionExecutionClosure | undefined {
  if (!event) return undefined
  const state = (
    Object.entries(MISSION_EXECUTION_CLOSURE_EVENT_TYPES) as Array<
      [keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES, string]
    >
  ).find(([, type]) => type === event.type)?.[0]
  if (
    !state ||
    event.aggregate !== "session" ||
    event.aggregateID !== event.sessionID ||
    !event.sessionID ||
    !event.correlationID
  ) {
    throw new Error(`Mission execution closure event ${event.id} has conflicting Session identity`)
  }
  const parsedCurrent = MissionExecutionClosurePayload.safeParse(event.payload)
  const hasInlineAuthority = parsedCurrent.success && (state === "opened" || Boolean(parsedCurrent.data.cancellation))
  const provenanceEvents = provenanceEventsForClosure(event)
  if (hasInlineAuthority && provenanceEvents.length > 0) {
    throw new Error(`Mission execution closure event ${event.id} has conflicting inline and addendum provenance`)
  }
  if (!hasInlineAuthority && state !== "opened") {
    const historical = HistoricalMissionExecutionClosurePayload.parse(event.payload)
    const boundaryType =
      state === "closing"
        ? MISSION_EXECUTION_PROVENANCE_EVENT_TYPES.required
        : MISSION_EXECUTION_PROVENANCE_EVENT_TYPES.unavailable_terminal
    const boundaries = provenanceEvents.filter((candidate) => candidate.type === boundaryType)
    const supplied = provenanceEvents.filter(
      (candidate) => candidate.type === MISSION_EXECUTION_PROVENANCE_EVENT_TYPES.supplied,
    )
    if (boundaries.length !== 1 || supplied.length > 1) {
      throw new Error(`Historical Mission execution ${state} event ${event.id} has ambiguous provenance authority`)
    }
    const authority = boundaries[0]!
    const boundary = MissionExecutionProvenanceBoundaryPayload.parse(authority.payload)
    if (
      authority.correlationID !== event.correlationID ||
      boundary.missionID !== historical.missionID ||
      boundary.requestID !== historical.requestID ||
      boundary.requiredSource !== event.source
    ) {
      throw new Error(`Historical Mission execution ${state} event ${event.id} has conflicting provenance authority`)
    }
    if (state === "closed") {
      if (supplied.length > 0) {
        throw new Error(`Historical closed Mission execution ${event.id} cannot accept supplied provenance`)
      }
      return {
        ...historical,
        eventID: event.id,
        sessionID: event.sessionID,
        operationID: event.correlationID,
        state,
        source: event.source,
        provenanceAuthorityEventID: authority.id,
      }
    }
    if (supplied.length === 0) {
      return {
        ...historical,
        eventID: event.id,
        sessionID: event.sessionID,
        operationID: event.correlationID,
        state: "recovery_blocked",
        source: event.source,
        provenanceAuthorityEventID: authority.id,
      }
    }
    const suppliedEvent = supplied[0]!
    const suppliedPayload = MissionExecutionSuppliedProvenancePayload.parse(suppliedEvent.payload)
    if (
      suppliedEvent.correlationID !== event.correlationID ||
      suppliedPayload.missionID !== historical.missionID ||
      suppliedPayload.originalRequestID !== historical.requestID ||
      suppliedPayload.source !== event.source
    ) {
      throw new Error(`Historical Mission closing event ${event.id} has conflicting supplied provenance`)
    }
    return {
      missionID: historical.missionID,
      requestID: suppliedPayload.requestID,
      cancellation: suppliedPayload.cancellation,
      eventID: event.id,
      sessionID: event.sessionID,
      operationID: event.correlationID,
      state: "closing",
      source: event.source,
      provenanceAuthorityEventID: suppliedEvent.id,
    }
  }
  const payload = MissionExecutionClosurePayload.parse(event.payload)
  if (state === "opened" && (payload.cancellation || payload.openedOccurrence)) {
    throw new Error(`Mission execution open event ${event.id} cannot carry close or recovery provenance`)
  }
  if (state !== "opened" && !payload.cancellation) {
    throw new Error(`Mission execution ${state} event ${event.id} is missing cancellation provenance`)
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
  input: z.input<typeof MissionExecutionClosurePayload> & {
    eventID?: string
    sessionID: string
    operationID: string
    state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES
    source: string
  },
): Promise<MissionExecutionClosure> {
  const payload = MissionExecutionClosurePayload.parse({
    missionID: input.missionID,
    requestID: input.requestID,
    ...(input.cancellation ? { cancellation: input.cancellation } : {}),
    ...(input.openedOccurrence ? { openedOccurrence: input.openedOccurrence } : {}),
  })
  const event = await ProtocolStore.appendEvent({
    kind: "event",
    ...(input.eventID ? { id: input.eventID } : {}),
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
  input: z.input<typeof MissionExecutionClosurePayload> & {
    eventID?: string
    sessionID: string
    operationID: string
    state: keyof typeof MISSION_EXECUTION_CLOSURE_EVENT_TYPES
    source: string
  },
): MissionExecutionClosure {
  Database.requireActiveTransaction("appendMissionExecutionClosureInTransaction")
  const payload = MissionExecutionClosurePayload.parse({
    missionID: input.missionID,
    requestID: input.requestID,
    ...(input.cancellation ? { cancellation: input.cancellation } : {}),
    ...(input.openedOccurrence ? { openedOccurrence: input.openedOccurrence } : {}),
  })
  const event = ProtocolStore.appendEventInTransaction({
    kind: "event",
    ...(input.eventID ? { id: input.eventID } : {}),
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
  if (closure.state !== "closing" && closure.state !== "closed" && closure.state !== "recovery_blocked") {
    throw new Error(`Mission wake closure settlement requires a terminal-fenced state, got ${closure.state}`)
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
  for (const row of rows) {
    const terminalReceipt = db
      .select()
      .from(ProtocolDeliveryReceiptTable)
      .where(eq(ProtocolDeliveryReceiptTable.inbox_id, row.inbox.id))
      .all()
      .map((receipt) => ProtocolDeliveryReceipt.parse(receipt.receipt))
      .find((receipt) => receipt.kind !== "retry_wait")
    if (terminalReceipt?.kind !== "session_wake") continue
    const disposition = schedulerMissionWakeDispositionInTransaction(db, {
      sessionID: closure.sessionID,
      messageID: terminalReceipt.message_id,
      eventID: row.eventID,
      inboxID: row.inbox.id,
    })
    if (disposition.kind === "answered" || disposition.kind === "integrity_boundary") continue
    if (disposition.kind === "mission_closed") {
      settled += 1
      continue
    }
    throw new Error(
      `Scheduler inbox ${row.inbox.id} cannot reduce against Mission closure ${closure.eventID}: ${
        disposition.kind === "invalid_binding" ? disposition.reason : "wake remained unanswered"
      }`,
    )
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
    if (current?.state === "closing" || current?.state === "recovery_blocked") {
      throw new MissionExecutionClosingError({
        message: `Mission ${input.missionID} execution is still ${current.state === "recovery_blocked" ? "blocked on operator cancellation provenance" : "closing"}; complete the durable close operation before reopening it.`,
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
  wake: (persistence: MissionExecutionWakePersistence) => Promise<Receipt>
}): Promise<Receipt> {
  const closing = activeCloseOperations.get(input.sessionID)
  if (closing) await closing
  return withMissionExecutionAdmission(input.sessionID, async () => {
    const opened = await openMissionExecutionUnderAdmission({
      missionID: input.missionID,
      sessionID: input.sessionID,
      source: input.source,
      requestID: input.requestID,
    })
    const receipt = await input.wake(missionExecutionWakePersistence(opened))
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
  wake: (persistence: MissionExecutionWakePersistence) => Receipt | Promise<Receipt>
}): Promise<Receipt> {
  return withMissionExecutionAdmission(input.sessionID, async () => {
    const opened = requireOpenedMissionExecutionWake({
      missionID: input.missionID,
      sessionID: input.sessionID,
    })
    const receipt = await input.wake(missionExecutionWakePersistence(opened))
    await receipt.activation
    return receipt
  })
}

function requireOpenedMissionExecutionWake(input: {
  missionID: string
  sessionID: string
  expected?: MissionExecutionClosure
}): MissionExecutionClosure {
  const current = currentMissionExecutionClosure(input.sessionID)
  if (!current) {
    throw new MissionExecutionWakeNotOpenedError({
      message: `Mission ${input.missionID} has no opened execution occurrence for non-operator wake activation.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
    })
  }
  if (current.missionID !== input.missionID) {
    throw new Error(`Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`)
  }
  if (current.state !== "opened") {
    throw new MissionExecutionWakeClosedError({
      message: `Mission ${input.missionID} ${current.state} occurrence rejects non-operator wake activation under closure event ${current.eventID}.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      state: current.state,
      operationID: current.operationID,
      closureEventID: current.eventID,
    })
  }
  if (
    input.expected &&
    (current.eventID !== input.expected.eventID || current.operationID !== input.expected.operationID)
  ) {
    throw new MissionExecutionWakeOccurrenceChangedError({
      message: `Mission ${input.missionID} wake occurrence changed from ${input.expected.eventID} to ${current.eventID} before Message commit.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      expectedOperationID: input.expected.operationID,
      expectedClosureEventID: input.expected.eventID,
      currentOperationID: current.operationID,
      currentClosureEventID: current.eventID,
    })
  }
  return current
}

function missionExecutionWakePersistence(opened: MissionExecutionClosure): MissionExecutionWakePersistence {
  if (opened.state !== "opened") throw new Error(`Mission wake persistence requires an opened occurrence`)
  return {
    openedEventID: opened.eventID,
    openedOperationID: opened.operationID,
    preflightBundle: () => {
      Database.requireActiveTransaction("Mission execution wake Message preflight")
      requireOpenedMissionExecutionWake({
        missionID: opened.missionID,
        sessionID: opened.sessionID,
        expected: opened,
      })
    },
  }
}

const activeCloseOperations = new Map<string, Promise<MissionExecutionClosure>>()

export const MissionExecutionClosureTestHooks = {
  /** Simulates another process, whose process-local owner map is empty. */
  forgetLocalCloseOwner(sessionID: string) {
    activeCloseOperations.delete(sessionID)
  },
}

function runMissionExecutionClosingOperation(input: {
  closing: MissionExecutionClosure
  close: (signal: AbortSignal) => Promise<void>
}): Promise<MissionExecutionClosure> {
  const active = activeCloseOperations.get(input.closing.sessionID)
  if (active) return active

  const operation = (async () => {
    const closing = input.closing
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
    const postAcquire = currentMissionExecutionClosure(closing.sessionID)
    if (postAcquire?.state === "closed") {
      // The canonical terminal fact is already committed by the winning
      // owner. Hand this now-redundant lease back without replacing that
      // successful result if storage becomes unavailable during handoff.
      releaseControlLeaseOnErrorPath({
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      return postAcquire
    }
    if (
      !postAcquire ||
      postAcquire.state !== "closing" ||
      postAcquire.missionID !== closing.missionID ||
      postAcquire.operationID !== closing.operationID
    ) {
      releaseControlLeaseOnErrorPath({
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      throw new Error(`Mission execution closure ${closing.sessionID} changed while acquiring its lifecycle lease`)
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
                cancellation: closing.cancellation,
                ...(closing.openedOccurrence ? { openedOccurrence: closing.openedOccurrence } : {}),
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
  activeCloseOperations.set(input.closing.sessionID, operation)
  void operation.then(
    () => {
      if (activeCloseOperations.get(input.closing.sessionID) === operation) {
        activeCloseOperations.delete(input.closing.sessionID)
      }
    },
    () => {
      if (activeCloseOperations.get(input.closing.sessionID) === operation) {
        activeCloseOperations.delete(input.closing.sessionID)
      }
    },
  )
  return operation
}

export async function closeMissionExecutionOperation(input: {
  missionID: string
  sessionID: string
  source: MissionExecutionCloseSource
  requestID: string
  provenance: z.input<typeof TaskCancellationRequestBody>
  close: (signal: AbortSignal) => Promise<void>
}): Promise<MissionExecutionClosure> {
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
    if (current?.state === "recovery_blocked") {
      if (!current.provenanceAuthorityEventID) {
        throw new Error(`Mission execution recovery block ${current.eventID} has no authority event`)
      }
      if (current.source !== input.source) {
        throw new MissionExecutionCancellationProvenanceRequiredError({
          message: `Mission execution ${current.eventID} requires a real ${current.source} operator request before recovery.`,
          missionID: current.missionID,
          sessionID: current.sessionID,
          operationID: current.operationID,
          closureEventID: current.eventID,
          authorityEventID: current.provenanceAuthorityEventID,
          requiredSource: MissionExecutionCloseSource.parse(current.source),
        })
      }
      return Database.immediateTransaction((db) => {
        const blocked = currentMissionExecutionClosureInTransaction(db, input.sessionID)
        if (
          !blocked ||
          blocked.state !== "recovery_blocked" ||
          blocked.eventID !== current.eventID ||
          blocked.operationID !== current.operationID
        ) {
          if (blocked?.state === "closing" || blocked?.state === "closed") return blocked
          throw new Error(`Mission execution recovery boundary ${current.eventID} changed before provenance supply`)
        }
        ProtocolStore.appendEventInTransaction({
          id: Identifier.deterministic(
            "protocol_event",
            `mission-closing-provenance-supplied\0${blocked.eventID}\0${input.requestID}`,
          ),
          kind: "event",
          type: MISSION_EXECUTION_PROVENANCE_EVENT_TYPES.supplied,
          aggregate: "session",
          aggregate_id: blocked.sessionID,
          session_id: null,
          source: input.source,
          causation_id: blocked.eventID,
          correlation_id: blocked.operationID,
          payload: MissionExecutionSuppliedProvenancePayload.parse({
            version: 1,
            missionID: blocked.missionID,
            originalRequestID: blocked.requestID,
            requestID: input.requestID,
            source: input.source,
            cancellation: input.provenance,
          }),
        })
        return currentMissionExecutionClosureInTransaction(db, input.sessionID)!
      })
    }
    return Database.immediateTransaction((db) => {
      const closure = appendMissionExecutionClosureInTransaction({
        missionID: input.missionID,
        sessionID: input.sessionID,
        operationID: randomUUID(),
        state: "closing",
        source: input.source,
        requestID: input.requestID,
        cancellation: TaskCancellationRequestBody.parse(input.provenance),
        ...(current?.state === "opened"
          ? { openedOccurrence: { eventID: current.eventID, operationID: current.operationID } }
          : {}),
      })
      settleMissionSchedulerWakesForClosureInTransaction(db, closure)
      return closure
    })
  })
  if (closing.state === "closed") return closing
  return runMissionExecutionClosingOperation({ closing, close: input.close })
}

export type ResumeMissionExecutionClosingResult =
  | { status: "not_closing"; closure: MissionExecutionClosure | undefined }
  | { status: "already_running"; closure: MissionExecutionClosure }
  | { status: "closed"; closure: MissionExecutionClosure }

/**
 * Continue only an exact durable `closing` occurrence. Recovery has no
 * authority to convert an `opened` occurrence into a close request.
 */
export async function resumeMissionExecutionClosingOperation(input: {
  sessionID: string
  close: (signal: AbortSignal) => Promise<void>
}): Promise<ResumeMissionExecutionClosingResult> {
  if (activeCloseOperations.has(input.sessionID)) {
    const current = currentMissionExecutionClosure(input.sessionID)
    if (current?.state === "closing") return { status: "already_running", closure: current }
  }
  const closing = await withMissionExecutionAdmission(input.sessionID, async () => {
    const current = currentMissionExecutionClosure(input.sessionID)
    if (current?.state !== "closing") return undefined
    settleMissionSchedulerWakesForClosure(current)
    return current
  })
  if (!closing) {
    return { status: "not_closing", closure: currentMissionExecutionClosure(input.sessionID) }
  }
  return {
    status: "closed",
    closure: await runMissionExecutionClosingOperation({ closing, close: input.close }),
  }
}

export function requireMissionExecutionClosureEvent(eventID: string): MissionExecutionClosure {
  return closureFromEvent(ProtocolStore.requireEvent(eventID))!
}
