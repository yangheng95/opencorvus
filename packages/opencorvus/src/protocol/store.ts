import { Identifier } from "@/id/id"
import { Database, and, asc, desc, eq, gt, lte, or, sql } from "@/storage/db"
import { Context } from "@/util/context"
import { withKeyedLock } from "@/util/lock"
import { Log } from "@/util/log"
import { runOutsideInstanceContext } from "@/project/instance"
import { MessageTable, SessionTable, WorkerTurnDescriptorTable } from "@/session/session.sql"
import { ProtocolEventTable } from "./protocol.sql"
import type { ProtocolAggregate, ProtocolKind } from "./schema"
import { requireTimelineOrderKeyDomain, timelineOrderKey } from "@/timeline/order"
import { projectLifecycleProperties } from "./lifecycle-projection"
import { projectMailboxAcknowledgementPayload, projectMailboxAgentMessagePayload } from "@/engine/mailbox-event"

const eventLocks = new Map<string, Promise<void>>()
const log = Log.create({ service: "protocol.store" })

type Payload = Record<string, unknown>
export type TaskLiveReplayResult = { expired: false; events: EventView[] } | { expired: true; event: EventView }

export type EventInput = {
  id?: string
  kind: ProtocolKind
  type: string
  aggregate: ProtocolAggregate
  aggregate_id: string
  task_id?: string | null
  session_id?: string | null
  interaction_id?: string | null
  stream_id?: string | null
  source: string
  target?: string | null
  causation_id?: string | null
  correlation_id?: string | null
  reply_to?: string | null
  deadline_ms?: number | null
  emitted_at?: number
  order_key?: string | null
  payload?: Payload | null
  seq?: number
}

type EventRow = typeof ProtocolEventTable.$inferSelect
export type ProtocolEventView = ReturnType<typeof eventView>
type EventView = ProtocolEventView
type EventFilter = {
  aggregate?: ProtocolAggregate
  taskID?: string
  sessionID?: string
  interactionID?: string
  types?: string[]
}
type EventSubscription = {
  filter?: EventFilter
  dispatch(event: EventView): Promise<void>
  close(): void
}

const SESSION_LIFECYCLE_ORDERED_EVENT_TYPES = new Set(["agent.execution.lifecycle", "session.error"])

export function protocolEventRequiresPayloadOrderKey(type: string): boolean {
  return SESSION_LIFECYCLE_ORDERED_EVENT_TYPES.has(type)
}

async function publishEventSideEffects(input: EventInput, event: EventView) {
  if (input.aggregate === "task" && TASK_TERMINAL_EVENT_TYPES.has(input.type)) {
    clearTaskLiveReplay(input.aggregate_id)
  }
  await dispatchEvent(event)
}

function explicitPayloadOrderKey(payload: Payload | null | undefined): string {
  const orderKey = payload && typeof payload.orderKey === "string" ? payload.orderKey.trim() : ""
  return orderKey
}

function persistedEventOrderKey(input: EventInput, seq: number, now: number, id: string): string {
  const explicit = typeof input.order_key === "string" ? input.order_key.trim() : ""
  const payloadOrderKey = explicitPayloadOrderKey(input.payload)
  if (protocolEventRequiresPayloadOrderKey(input.type) && !explicit) {
    throw new Error(`ProtocolStore.appendEvent ${input.type} missing envelope order_key`)
  }
  if (protocolEventRequiresPayloadOrderKey(input.type) && explicit) {
    requireTimelineOrderKeyDomain(explicit, `ProtocolStore.appendEvent ${input.type} order_key`, "session")
    const derived =
      input.type === "agent.execution.lifecycle"
        ? (() => {
            const inputMessageID =
              input.payload && typeof input.payload.inputMessageID === "string" ? input.payload.inputMessageID : ""
            if (!inputMessageID)
              throw new Error(`ProtocolStore.appendEvent ${input.type} missing immutable input Message identity`)
            const message = Database.use((db) =>
              db
                .select({ timeCreated: MessageTable.time_created })
                .from(MessageTable)
                .where(eq(MessageTable.id, inputMessageID))
                .get(),
            )
            if (!message)
              throw new Error(
                `ProtocolStore.appendEvent ${input.type} references missing input Message ${inputMessageID}`,
              )
            return timelineOrderKey({ domain: "session", time: message.timeCreated, id: inputMessageID })
          })()
        : (() => {
            const sessionID = input.aggregate === "session" ? input.aggregate_id : input.session_id
            if (!sessionID)
              throw new Error(`ProtocolStore.appendEvent ${input.type} missing immutable Session identity`)
            const session = Database.use((db) =>
              db
                .select({ timeCreated: SessionTable.time_created })
                .from(SessionTable)
                .where(eq(SessionTable.id, sessionID))
                .get(),
            )
            if (!session)
              throw new Error(`ProtocolStore.appendEvent ${input.type} references missing Session ${sessionID}`)
            return timelineOrderKey({ domain: "session", time: session.timeCreated, id: sessionID })
          })()
    if (explicit !== derived)
      throw new Error(`ProtocolStore.appendEvent ${input.type} order_key conflicts with its immutable input Message`)
  }
  if (payloadOrderKey) throw new Error(`ProtocolStore.appendEvent ${input.type} payload must not duplicate order_key`)
  if (explicit) {
    return explicit
  }
  return timelineOrderKey({ domain: "protocol", time: now, sequence: seq, id })
}

export function protocolTimelineOrderKey(
  row: Pick<
    EventRow,
    "id" | "type" | "aggregate_type" | "aggregate_id" | "session_id" | "seq" | "emitted_at" | "payload"
  >,
): string {
  if (row.type === "agent.execution.lifecycle") {
    const inputMessageID =
      row.payload && typeof row.payload.inputMessageID === "string" ? row.payload.inputMessageID : ""
    if (!inputMessageID) throw new Error(`protocol_event ${row.id} missing immutable input Message identity`)
    const message = Database.use((db) =>
      db
        .select({ timeCreated: MessageTable.time_created })
        .from(MessageTable)
        .where(eq(MessageTable.id, inputMessageID))
        .get(),
    )
    if (!message) throw new Error(`protocol_event ${row.id} references missing input Message ${inputMessageID}`)
    return timelineOrderKey({ domain: "session", time: message.timeCreated, id: inputMessageID })
  }
  if (row.type === "session.error") {
    const sessionID = row.aggregate_type === "session" ? row.aggregate_id : row.session_id
    if (!sessionID) throw new Error(`protocol_event ${row.id} missing immutable Session identity`)
    const session = Database.use((db) =>
      db
        .select({ timeCreated: SessionTable.time_created })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get(),
    )
    if (!session) throw new Error(`protocol_event ${row.id} references missing Session ${sessionID}`)
    return timelineOrderKey({ domain: "session", time: session.timeCreated, id: sessionID })
  }
  return timelineOrderKey({ domain: "protocol", time: row.emitted_at, sequence: row.seq, id: row.id })
}

function insertProtocolEvent(input: EventInput, seq: number, now: number): EventView {
  const id = Identifier.ascending("protocol_event", input.id)
  const orderKey = persistedEventOrderKey(input, seq, now, id)
  const relatedTaskID = input.aggregate === "task" ? null : (input.task_id ?? null)
  const relatedSessionID = input.aggregate === "session" ? null : (input.session_id ?? null)
  const sessionReferenceID = input.aggregate === "session" ? input.aggregate_id : relatedSessionID
  Database.use((db) => {
    if (
      sessionReferenceID &&
      !db.select({ id: SessionTable.id }).from(SessionTable).where(eq(SessionTable.id, sessionReferenceID)).get()
    ) {
      throw new Error(`Protocol event ${input.type} references missing Session ${input.session_id}`)
    }
    db.insert(ProtocolEventTable)
      .values({
        id,
        kind: input.kind,
        type: input.type,
        aggregate_type: input.aggregate,
        aggregate_id: input.aggregate_id,
        task_id: relatedTaskID,
        session_id: relatedSessionID,
        interaction_id: input.interaction_id ?? null,
        stream_id: input.stream_id ?? null,
        source: input.source,
        target: input.target ?? null,
        causation_id: input.causation_id ?? null,
        correlation_id: input.correlation_id ?? null,
        reply_to: input.reply_to ?? null,
        seq,
        deadline_ms: input.deadline_ms ?? null,
        emitted_at: now,
        payload: input.payload ?? null,
      })
      .run()
  })
  return eventView({
    id,
    kind: input.kind,
    type: input.type,
    aggregate_type: input.aggregate,
    aggregate_id: input.aggregate_id,
    task_id: relatedTaskID,
    session_id: relatedSessionID,
    interaction_id: input.interaction_id ?? null,
    stream_id: input.stream_id ?? null,
    source: input.source,
    target: input.target ?? null,
    causation_id: input.causation_id ?? null,
    correlation_id: input.correlation_id ?? null,
    reply_to: input.reply_to ?? null,
    seq,
    deadline_ms: input.deadline_ms ?? null,
    emitted_at: now,
    payload: input.payload ?? null,
  })
}

// ── Global subscription registry ──
// Subscriptions MUST be global (not per-Instance) because:
// 1. Database is a global singleton — events from any Instance land in the same DB.
// 2. SSE handlers register subscriptions from one Instance context, but events may
//    be written from a different Instance context (e.g. cross-Instance bridge in
//    task-message-protocol-bridge writes events in hostDirectory context while the
//    SSE client connected from a different directory).
// 3. matchesEvent() already filters by taskID/sessionID — Instance-level
//    isolation is redundant and causes real-time events to be silently dropped
//    when the writer and reader are in different Instance contexts.
const globalSubscriptions = new Set<EventSubscription>()
const subscriptionDeliveryContext = Context.create<EventSubscription>("protocol event subscription delivery")
const TASK_LIVE_REPLAY_MAX_EVENTS = 4096
const TASK_LIVE_REPLAY_MAX_AGE_MS = 30_000
const TASK_LIVE_REPLAY_SWEEP_MS = 10_000
const TASK_LIVE_EPOCH = Date.now()
const taskLiveSequences = new Map<string, number>()
const taskLiveReplayEvents = new Map<string, EventView[]>()
const taskLiveRetentionFloors = new Map<string, number>()
let taskLiveReplaySweepStarted = false
const TASK_TERMINAL_EVENT_TYPES = new Set(["task.completed", "task.failed", "task.cancelled"])

function eventKey(input: { aggregate: ProtocolAggregate; aggregate_id: string }) {
  return `${input.aggregate}:${input.aggregate_id}`
}

function payloadText(payload: Payload | null, key: string) {
  const value = payload?.[key]
  return typeof value === "string" && value ? value : undefined
}

function matchesEvent(event: EventView, filter?: EventFilter) {
  if (!filter) return true
  if (filter.aggregate && event.aggregate !== filter.aggregate) return false
  if (filter.taskID && event.taskID !== filter.taskID) return false
  if (filter.sessionID && event.sessionID !== filter.sessionID) return false
  if (filter.interactionID && event.interactionID !== filter.interactionID) return false
  if (filter.types && !filter.types.includes(event.type)) return false
  return true
}

async function dispatchEvent(event: EventView) {
  const deliveries: Promise<void>[] = []
  for (const subscription of globalSubscriptions) {
    if (!matchesEvent(event, subscription.filter)) continue
    deliveries.push(subscription.dispatch(event))
  }
  const settled = await Promise.allSettled(deliveries)
  const failures = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason)
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} protocol subscriber delivery failure(s) for ${event.type}`)
  }
}

function eventView(row: EventRow) {
  const orderKey = protocolTimelineOrderKey(row)
  const sessionID = row.aggregate_type === "session" ? row.aggregate_id : row.session_id
  const taskID = row.aggregate_type === "task" ? row.aggregate_id : (row.task_id ?? undefined)
  const projectedPayload: Payload | null | undefined = (() => {
    if (row.type === "mailbox.message") return projectMailboxAgentMessagePayload(row)
    if (row.type === "mailbox.acknowledged") return projectMailboxAcknowledgementPayload(row)
    if (row.type === "agent.execution.lifecycle") {
      if (!sessionID) throw new Error(`Protocol event ${row.id} (${row.type}) has no Session identity`)
      return projectLifecycleProperties(row.payload ?? {}, sessionID, { orderKey })
    }
    if (!sessionID || row.type !== "session.error") return row.payload
    const session = Database.use((db) =>
      db
        .select({ kind: SessionTable.kind, parentID: SessionTable.parent_id })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get(),
    )
    if (!session) return row.payload
    const descriptor = Database.use((db) =>
      db
        .select({ agent: WorkerTurnDescriptorTable.agent })
        .from(WorkerTurnDescriptorTable)
        .where(eq(WorkerTurnDescriptorTable.session_id, sessionID))
        .orderBy(desc(WorkerTurnDescriptorTable.time_created), desc(WorkerTurnDescriptorTable.id))
        .get(),
    )
    const agentID = descriptor?.agent ?? session.kind
    return {
      ...(row.payload ?? {}),
      channel: session.kind === "root" ? "main" : session.kind,
      agentID,
      ...(session.kind === "root" ? {} : { resolvedRole: agentID }),
      ...(session.parentID ? { parentSessionID: session.parentID } : {}),
    }
  })()
  return {
    id: row.id,
    kind: row.kind,
    type: row.type,
    aggregate: row.aggregate_type,
    aggregateID: row.aggregate_id,
    // Aggregate identity is immutable protocol authority; typed correlations
    // are immutable non-owning locators for other aggregates.
    taskID,
    sessionID: sessionID ?? undefined,
    interactionID: row.interaction_id ?? undefined,
    streamID: row.stream_id ?? undefined,
    source: row.source,
    target: row.target ?? undefined,
    causationID: row.causation_id ?? undefined,
    correlationID: row.correlation_id ?? undefined,
    replyTo: row.reply_to ?? undefined,
    sequence: row.seq,
    orderKey,
    liveSequence: undefined as number | undefined,
    liveEpoch: undefined as number | undefined,
    deadlineMs: row.deadline_ms ?? undefined,
    summary: payloadText(row.payload, "summary") ?? row.type,
    payload: projectedPayload ?? undefined,
    time: {
      emitted: row.emitted_at,
      created: row.emitted_at,
      updated: row.emitted_at,
    },
  }
}

function eventLiveReplayKey(event: EventView): string {
  const payload = event.payload ?? {}
  if (event.type === "message.part.delta") {
    const partID = typeof payload.partID === "string" ? payload.partID : ""
    const messageID = typeof payload.messageID === "string" ? payload.messageID : ""
    const sessionID = typeof payload.sessionID === "string" ? payload.sessionID : (event.sessionID ?? "")
    const field = typeof payload.field === "string" ? payload.field : ""
    return `${event.taskID ?? ""}|${sessionID}|${messageID}|${partID}|${field}`
  }
  const part = payload.part && typeof payload.part === "object" ? (payload.part as Record<string, unknown>) : undefined
  const partID = typeof part?.id === "string" ? part.id : typeof payload.partID === "string" ? payload.partID : ""
  const messageID =
    typeof part?.messageID === "string"
      ? part.messageID
      : typeof payload.messageID === "string"
        ? payload.messageID
        : ""
  const sessionID =
    typeof part?.sessionID === "string"
      ? part.sessionID
      : typeof payload.sessionID === "string"
        ? payload.sessionID
        : (event.sessionID ?? "")
  return `${event.taskID ?? ""}|${sessionID}|${messageID}|${partID}|`
}

function markLiveReplayFloor(taskID: string, sequence: number) {
  if (sequence <= 0) return
  taskLiveRetentionFloors.set(taskID, Math.max(taskLiveRetentionFloors.get(taskID) ?? 0, sequence))
}

function trimTaskLiveReplay(taskID: string, now: number) {
  const events = taskLiveReplayEvents.get(taskID)
  if (!events?.length) return
  const minTime = now - TASK_LIVE_REPLAY_MAX_AGE_MS
  while (events.length > 0 && (events.length > TASK_LIVE_REPLAY_MAX_EVENTS || events[0]!.time.emitted < minTime)) {
    markLiveReplayFloor(taskID, events.shift()!.liveSequence ?? 0)
  }
  if (events.length === 0) taskLiveReplayEvents.delete(taskID)
}

function compactTaskLiveReplay(now: number) {
  for (const taskID of [...taskLiveReplayEvents.keys()]) {
    trimTaskLiveReplay(taskID, now)
  }
}

function clearTaskLiveReplay(taskID: string) {
  taskLiveReplayEvents.delete(taskID)
  taskLiveSequences.delete(taskID)
  taskLiveRetentionFloors.delete(taskID)
}

function ensureTaskLiveReplaySweep() {
  if (taskLiveReplaySweepStarted) return
  taskLiveReplaySweepStarted = true
  const timer = setInterval(() => compactTaskLiveReplay(Date.now()), TASK_LIVE_REPLAY_SWEEP_MS)
  const unrefTimer = timer as { unref?: () => void }
  unrefTimer.unref?.()
}

function partUpdatedClosed(payload: Payload | undefined): boolean {
  const part = payload?.part && typeof payload.part === "object" ? (payload.part as Record<string, any>) : undefined
  if (!part) return false
  if ((part.type === "text" || part.type === "reasoning") && typeof part.time?.end === "number") return true
  if (part.type === "tool" && part.state?.status && part.state.status !== "pending") return true
  return false
}

function pruneLiveReplayEvents(taskID: string, predicate: (event: EventView) => boolean) {
  const events = taskLiveReplayEvents.get(taskID)
  if (!events?.length) return
  const next = events.filter((event) => !predicate(event))
  if (next.length === 0) taskLiveReplayEvents.delete(taskID)
  else if (next.length !== events.length) taskLiveReplayEvents.set(taskID, next)
}

function pruneClosedLiveDeltas(taskID: string, event: EventView) {
  if (event.type === "message.part.updated" && partUpdatedClosed(event.payload)) {
    const closedKey = eventLiveReplayKey(event)
    pruneLiveReplayEvents(
      taskID,
      (candidate) => candidate.type === "message.part.delta" && eventLiveReplayKey(candidate).startsWith(closedKey),
    )
    return
  }
  if (event.type === "message.part.removed") {
    const removedKey = eventLiveReplayKey(event)
    pruneLiveReplayEvents(taskID, (candidate) => eventLiveReplayKey(candidate).startsWith(removedKey))
    return
  }
  if (event.type === "message.removed") {
    const payload = event.payload ?? {}
    const messageID =
      typeof payload.messageID === "string"
        ? payload.messageID
        : typeof payload.info === "object" &&
            payload.info &&
            typeof (payload.info as Record<string, unknown>).id === "string"
          ? String((payload.info as Record<string, unknown>).id)
          : ""
    const sessionID = typeof payload.sessionID === "string" ? payload.sessionID : (event.sessionID ?? "")
    pruneLiveReplayEvents(taskID, (candidate) => {
      const candidatePayload = candidate.payload ?? {}
      const candidatePart =
        candidatePayload.part && typeof candidatePayload.part === "object"
          ? (candidatePayload.part as Record<string, unknown>)
          : undefined
      const candidateMessageID =
        typeof candidatePart?.messageID === "string"
          ? candidatePart.messageID
          : typeof candidatePayload.messageID === "string"
            ? candidatePayload.messageID
            : ""
      const candidateSessionID =
        typeof candidatePart?.sessionID === "string"
          ? candidatePart.sessionID
          : typeof candidatePayload.sessionID === "string"
            ? candidatePayload.sessionID
            : (candidate.sessionID ?? "")
      return candidateSessionID === sessionID && candidateMessageID === messageID
    })
  }
}

function taskLiveReplayExpiredEvent(taskID: string, reason: string): EventView {
  const now = Date.now()
  const id = Identifier.ascending("protocol_event")
  return {
    id,
    kind: "event",
    type: "task.live_replay_expired",
    aggregate: "task",
    aggregateID: taskID,
    taskID,
    sessionID: undefined,
    interactionID: undefined,
    streamID: undefined,
    source: "protocol.live-replay",
    target: undefined,
    causationID: undefined,
    correlationID: undefined,
    replyTo: undefined,
    sequence: 0,
    orderKey: timelineOrderKey({ domain: "protocol", time: now, sequence: 0, id }),
    liveSequence: undefined,
    liveEpoch: undefined,
    deadlineMs: undefined,
    summary: reason,
    payload: {
      taskID,
      reason,
      liveEpoch: TASK_LIVE_EPOCH,
    },
    time: { emitted: now, created: now, updated: now },
  }
}

export namespace ProtocolStore {
  export function requireEvent(eventID: string) {
    const row = Database.use((db) =>
      db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.id, eventID)).get(),
    )
    if (!row) throw new Error(`Protocol event not found: ${eventID}`)
    return eventView(row)
  }

  export function latestSessionEvent(sessionID: string, type: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(ProtocolEventTable)
        .where(
          and(
            or(
              and(eq(ProtocolEventTable.aggregate_type, "session"), eq(ProtocolEventTable.aggregate_id, sessionID)),
              eq(ProtocolEventTable.session_id, sessionID),
            ),
            eq(ProtocolEventTable.type, type),
          ),
        )
        .orderBy(desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
        .get(),
    )
    return row ? eventView(row) : undefined
  }

  export function latestSessionOccurrenceEvent(sessionID: string, type: string, inputMessageID: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(ProtocolEventTable)
        .where(
          and(
            or(
              and(eq(ProtocolEventTable.aggregate_type, "session"), eq(ProtocolEventTable.aggregate_id, sessionID)),
              eq(ProtocolEventTable.session_id, sessionID),
            ),
            eq(ProtocolEventTable.type, type),
            sql`json_extract(${ProtocolEventTable.payload}, '$.inputMessageID') = ${inputMessageID}`,
          ),
        )
        .orderBy(desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
        .get(),
    )
    return row ? eventView(row) : undefined
  }

  export async function appendEvent(input: EventInput) {
    const now = input.emitted_at ?? Date.now()
    const insert = (seq: number) => {
      const event = insertProtocolEvent(input, seq, now)
      Database.effect(() => publishEventSideEffects(input, event))
      return event
    }

    return withKeyedLock(eventLocks, eventKey(input), async () =>
      Database.transaction(() => {
        const sequence =
          typeof input.seq === "number" && input.seq > 0
            ? reserveExplicitAggregateSequence(input.aggregate, input.aggregate_id, input.seq)
            : nextAggregateSequence(input.aggregate, input.aggregate_id)
        return insert(sequence)
      }),
    )
  }

  export function appendEventInTransaction(input: EventInput) {
    Database.requireActiveTransaction("ProtocolStore.appendEventInTransaction")
    const now = input.emitted_at ?? Date.now()
    const seq =
      typeof input.seq === "number" && input.seq > 0
        ? reserveExplicitAggregateSequence(input.aggregate, input.aggregate_id, input.seq)
        : nextAggregateSequence(input.aggregate, input.aggregate_id)
    const event = insertProtocolEvent(input, seq, now)
    Database.effect(() => publishEventSideEffects(input, event))
    return event
  }

  export function listTaskEventsAfter(taskID: string, sequence: number, opts?: { until?: number; limit?: number }) {
    const conditions = [
      eq(ProtocolEventTable.aggregate_type, "task"),
      eq(ProtocolEventTable.aggregate_id, taskID),
      gt(ProtocolEventTable.seq, sequence),
    ]
    if (typeof opts?.until === "number") {
      conditions.push(lte(ProtocolEventTable.seq, opts.until))
    }
    return Database.use((db) => {
      const query = db
        .select()
        .from(ProtocolEventTable)
        .where(and(...conditions))
        .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
      return typeof opts?.limit === "number" ? query.limit(opts.limit).all() : query.all()
    }).map(eventView)
  }

  export function listTaskEvents(taskID: string) {
    return listTaskEventsAfter(taskID, 0)
  }

  /**
   * Returns the newest raw event that claims a Task through either envelope
   * identity. The cancellation read model validates both identities exactly;
   * querying only already-valid rows would hide a newer corrupted terminal
   * fact and silently project an older one.
   */
  export function latestTaskEvent(taskID: string, type: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(ProtocolEventTable)
        .where(
          and(
            eq(ProtocolEventTable.type, type),
            or(eq(ProtocolEventTable.aggregate_id, taskID), eq(ProtocolEventTable.task_id, taskID)),
          ),
        )
        .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.emitted_at), desc(ProtocolEventTable.id))
        .get(),
    )
    return row ? eventView(row) : undefined
  }

  export function latestTaskSequence(taskID: string) {
    const row = Database.use((db) =>
      db
        .select({ seq: ProtocolEventTable.seq })
        .from(ProtocolEventTable)
        .where(and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, taskID)))
        .orderBy(desc(ProtocolEventTable.seq))
        .get(),
    )
    return row?.seq ?? 0
  }

  export function currentTaskLiveEpoch() {
    return TASK_LIVE_EPOCH
  }

  export function currentTaskLiveSequence(taskID: string) {
    return taskLiveSequences.get(taskID) ?? 0
  }

  export function listTaskLiveEventsAfter(
    taskID: string,
    liveSequence: number,
    opts?: { liveEpoch?: number },
  ): TaskLiveReplayResult {
    compactTaskLiveReplay(Date.now())
    const after = Math.max(0, Math.floor(Number(liveSequence) || 0))
    if (typeof opts?.liveEpoch === "number" && opts.liveEpoch !== TASK_LIVE_EPOCH) {
      return {
        expired: true,
        event: taskLiveReplayExpiredEvent(taskID, "selected task live replay epoch changed"),
      }
    }
    // The retention floor only expires a *resuming* subscriber. `after === 0`
    // means the subscriber presents no live cursor at all: it has consumed
    // nothing, so it cannot have fallen behind the trimmed window — it just
    // hydrated the persisted conversation over HTTP and is asking for whatever
    // live deltas are still retained. Expiring that case closed the stream on
    // every task switch (the floor is raised the first time a task's live
    // events age past TASK_LIVE_REPLAY_MAX_AGE_MS and is never lowered), which
    // cost the overlay a full reconnect backoff and a visible disconnected
    // banner for a handshake nothing was wrong with.
    const floor = taskLiveRetentionFloors.get(taskID) ?? 0
    if (after > 0 && after < floor) {
      return {
        expired: true,
        event: taskLiveReplayExpiredEvent(taskID, "selected task live replay retention expired"),
      }
    }
    const events = taskLiveReplayEvents.get(taskID) ?? []
    return {
      expired: false,
      events: events.filter((event) => (event.liveSequence ?? 0) > after),
    }
  }

  export function subscribeEvents(callback: (event: EventView) => void | Promise<void>, filter?: EventFilter) {
    let closed = false
    let tail = Promise.resolve()
    const subscription: EventSubscription = {
      filter,
      dispatch(event) {
        if (closed) return Promise.resolve()
        const invoke = () =>
          subscriptionDeliveryContext.provide(subscription, async () => {
            await Database.runOutsideContext(() =>
              runOutsideInstanceContext(async () => {
                await callback(event)
              }),
            )
          })
        const nested = subscriptionDeliveryContext.tryUse() === subscription
        const delivery = nested ? invoke() : tail.then(invoke)
        if (!nested) tail = delivery.catch(() => undefined)
        return delivery.catch((error) => {
          log.error("protocol subscriber failed", {
            aggregate: event.aggregate,
            type: event.type,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        })
      },
      close() {
        closed = true
      },
    }
    globalSubscriptions.add(subscription)
    return () => {
      if (!globalSubscriptions.delete(subscription)) return
      subscription.close()
    }
  }

  /**
   * Push an event through live subscriptions WITHOUT writing to DB.
   * Used for events whose source of truth lives in another table — clients
   * see them live via SSE; on reconnect they hydrate from the canonical
   * store (message/part tables for `message.*` events) instead of replaying
   * an event log. Avoids the 双源 footgun where the same content is held in
   * two places (rule 23) and prevents `protocol_event.payload` blowing up
   * by re-snapshotting full message state on every update.
   */
  export function dispatchEphemeral(input: {
    type: string
    aggregate: ProtocolAggregate
    taskID?: string
    sessionID?: string
    source: string
    orderKey: string
    payload?: Payload | null
  }) {
    const now = Date.now()
    const orderKey = typeof input.orderKey === "string" ? input.orderKey.trim() : ""
    if (!orderKey) throw new Error(`ProtocolStore.dispatchEphemeral ${input.type} missing orderKey`)
    const taskID = input.aggregate === "task" ? input.taskID : undefined
    const aggregateID = input.aggregate === "task" ? taskID : input.sessionID
    const liveSequence = taskID ? (taskLiveSequences.get(taskID) ?? 0) + 1 : undefined
    if (taskID && liveSequence !== undefined) taskLiveSequences.set(taskID, liveSequence)
    const event: EventView = {
      id: Identifier.ascending("protocol_event"),
      kind: "event",
      type: input.type,
      aggregate: input.aggregate,
      aggregateID: aggregateID ?? "",
      taskID,
      sessionID: input.sessionID,
      interactionID: undefined,
      streamID: undefined,
      source: input.source,
      target: undefined,
      causationID: undefined,
      correlationID: undefined,
      replyTo: undefined,
      sequence: 0,
      orderKey,
      liveSequence,
      liveEpoch: taskID ? TASK_LIVE_EPOCH : undefined,
      deadlineMs: undefined,
      summary: payloadText(input.payload ?? null, "summary") ?? input.type,
      payload: input.payload ?? undefined,
      time: { emitted: now, created: now, updated: now },
    }
    if (taskID) {
      ensureTaskLiveReplaySweep()
      pruneClosedLiveDeltas(taskID, event)
      const events = taskLiveReplayEvents.get(taskID) ?? []
      events.push(event)
      taskLiveReplayEvents.set(taskID, events)
      compactTaskLiveReplay(now)
    }
    void dispatchEvent(event).catch((error) => {
      log.error("ephemeral protocol subscriber failed", {
        aggregate: event.aggregate,
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  export function compactLiveReplay(now = Date.now()) {
    compactTaskLiveReplay(now)
  }

  export function liveReplayStats() {
    let events = 0
    for (const list of taskLiveReplayEvents.values()) events += list.length
    return {
      tasks: taskLiveReplayEvents.size,
      events,
      sequenceTasks: taskLiveSequences.size,
      retentionFloorTasks: taskLiveRetentionFloors.size,
      subscriptions: globalSubscriptions.size,
    }
  }
}

function nextAggregateSequence(aggregate: ProtocolAggregate, aggregateID: string) {
  Database.requireActiveTransaction("ProtocolStore.nextAggregateSequence")
  return Database.use(
    (db) =>
      db
        .select({ sequence: sql<number>`coalesce(max(${ProtocolEventTable.seq}), 0) + 1` })
        .from(ProtocolEventTable)
        .where(and(eq(ProtocolEventTable.aggregate_type, aggregate), eq(ProtocolEventTable.aggregate_id, aggregateID)))
        .get()!.sequence,
  )
}

function reserveExplicitAggregateSequence(aggregate: ProtocolAggregate, aggregateID: string, sequence: number) {
  Database.requireActiveTransaction("ProtocolStore.reserveExplicitAggregateSequence")
  const current = nextAggregateSequence(aggregate, aggregateID) - 1
  if (sequence <= current) {
    throw new Error(
      `Protocol aggregate ${aggregate}:${aggregateID} explicit sequence ${sequence} conflicts with current ${current}`,
    )
  }
  return sequence
}
