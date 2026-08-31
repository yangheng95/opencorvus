import { createHash, randomUUID } from "node:crypto"
import z from "zod"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { schedulerWakeMessageMatchesInTransaction } from "@/protocol/session-wake-state"
import { Database, and, asc, desc, eq, gt, lt, sql } from "@/storage/db"
import { Identifier } from "@/id/id"
import { NamedError } from "@opencorvus-ai/util/error"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"
import { executeMissionClosingEffects } from "./execution-close-effects"
import { abortAfterAny } from "@/util/abort"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { findActiveMissionTaskIDInTransaction } from "@/engine/store"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { SessionPromptState } from "@/session/prompt/state"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { Log } from "@/util/log"
import { canonicalDigestSource, canonicalJSONValue } from "@/util/canonical-digest"
import { Config } from "@/config/config"
import { Session } from "@/session"
import { Instance } from "@/project/instance"
import type { UserMessagePersistenceHooks } from "@/session/prompt/parts"
import { PersistedWakeReplay } from "@/session/persisted-wake-replay"
import {
  MissionExecutionCloseProvenance,
  MissionExecutionCloseSource,
  MissionExecutionOpenSource,
} from "./execution-closure-schema"
import { MissionOperatorWakeReason } from "./operator-wake-reason"
import { Bus } from "@/bus"
import {
  currentMissionDeleteRetentionIntentInTransaction,
  ensureMissionDeleteRetentionIntentInTransaction,
  sessionDeletedInTransaction,
} from "./retention-facts"

export {
  MissionExecutionCloseProvenance,
  MissionExecutionCloseSource,
  MissionExecutionOpenSource,
} from "./execution-closure-schema"

const log = Log.create({ service: "mission.execution-closure" })
let afterCloseLeaseAcquiredForTest:
  | ((closure: Extract<MissionExecutionClosure, { state: "closing" }>) => void | Promise<void>)
  | undefined
let afterClosedCommittedForTest:
  | ((closure: Extract<MissionExecutionClosure, { state: "closed" }>) => void | Promise<void>)
  | undefined

export const MISSION_EXECUTION_CLOSURE_EVENT_TYPES = {
  opened: "mission.execution.opened",
  closing: "mission.execution.closing",
  closed: "mission.execution.closed",
} as const

const MissionExecutionOpenedPayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

const MissionExecutionTerminalPayload = z
  .object({
    missionID: z.string().min(1),
    requestID: z.string().min(1),
    provenance: MissionExecutionCloseProvenance,
  })
  .strict()

export const MissionExecutionClosurePayload = z.union([MissionExecutionOpenedPayload, MissionExecutionTerminalPayload])

type MissionExecutionClosureBase = {
  missionID: string
  requestID: string
  eventID: string
  sessionID: string
  operationID: string
}

export type MissionExecutionClosure =
  | (MissionExecutionClosureBase & {
      state: "opened"
      source: "mission.dispatch" | "mission.wake"
      requestFingerprint: string
    })
  | (MissionExecutionClosureBase & {
      state: "closing"
      source: z.infer<typeof MissionExecutionCloseSource>
      provenance: z.infer<typeof MissionExecutionCloseProvenance>
    })
  | (MissionExecutionClosureBase & {
      state: "closed"
      source: z.infer<typeof MissionExecutionCloseSource>
      provenance: z.infer<typeof MissionExecutionCloseProvenance>
    })

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

export const MissionExecutionWakeInputConflictError = NamedError.create(
  "MissionExecutionWakeInputConflictError",
  z
    .object({
      message: z.string(),
      missionID: z.string().min(1),
      sessionID: z.string().min(1),
      requestID: z.string().min(1),
      acceptedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      receivedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      closureEventID: Identifier.schema("protocol_event"),
    })
    .strict(),
)

const MissionOperatorAttachmentInput = z
  .object({
    type: z.literal("file"),
    mime: z.string(),
    url: z.string(),
    filename: z.string().nullable(),
    presentation: z.literal("attachment-index").nullable(),
  })
  .strict()

export const MissionOperatorAcceptedInput = z
  .object({
    text: z.string(),
    model: z.string().nullable(),
    attachments: z.array(MissionOperatorAttachmentInput),
    configPatch: Config.Overlay,
    context: z.record(z.string(), z.unknown()),
  })
  .strict()
export type MissionOperatorAcceptedInput = z.input<typeof MissionOperatorAcceptedInput>

export function missionOperatorAttachmentInputs(parts: readonly unknown[]) {
  return parts.map((part) => {
    const value = z
      .object({
        type: z.literal("file"),
        mime: z.string(),
        url: z.string(),
        filename: z.string().optional(),
        presentation: z.literal("attachment-index").optional(),
      })
      .passthrough()
      .parse(part)
    return MissionOperatorAttachmentInput.parse({
      type: "file",
      mime: value.mime,
      url: value.url,
      filename: value.filename ?? null,
      presentation: value.presentation ?? null,
    })
  })
}

function operatorAcceptedInputFingerprint(input: MissionOperatorAcceptedInput): string {
  return canonicalDigestSource("mission-operator-accepted-input-v1", MissionOperatorAcceptedInput.parse(input)).sha256
}

function deterministicOperationUUID(material: string): string {
  const bytes = createHash("sha256").update("opencorvus.mission.operator-operation.v1\0").update(material).digest()
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
  if (state === "opened") {
    return {
      ...MissionExecutionOpenedPayload.parse(event.payload),
      eventID: event.id,
      sessionID: event.sessionID,
      operationID: z.string().uuid().parse(event.correlationID),
      state,
      source: MissionExecutionOpenSource.parse(event.source),
    }
  }
  const terminal = {
    ...MissionExecutionTerminalPayload.parse(event.payload),
    eventID: event.id,
    sessionID: event.sessionID,
    operationID: z.string().uuid().parse(event.correlationID),
    source: MissionExecutionCloseSource.parse(event.source),
  }
  return state === "closing" ? { ...terminal, state: "closing" } : { ...terminal, state: "closed" }
}

export function currentMissionExecutionClosure(sessionID: string): MissionExecutionClosure | undefined {
  return Database.use((db) => currentMissionExecutionClosureInTransaction(db, sessionID))
}

export function currentMissionExecutionClosureInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
): MissionExecutionClosure | undefined {
  const row = db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, sessionID),
        sql`${ProtocolEventTable.type} IN (${sql.join(
          Object.values(MISSION_EXECUTION_CLOSURE_EVENT_TYPES).map((type) => sql`${type}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.id))
    .limit(1)
    .get()
  return closureFromEvent(row ? ProtocolStore.requireEvent(row.id) : undefined)
}

function assertMissionRetentionAdmissionInTransaction(
  db: Database.TxOrDb,
  input: {
    missionID: string
    sessionID: string
    closure: Extract<MissionExecutionClosure, { state: "closed" }>
  },
): void {
  Database.requireActiveTransaction("assertMissionRetentionAdmissionInTransaction")
  const session = db
    .select({ archivedAt: SessionTable.time_archived })
    .from(SessionTable)
    .where(eq(SessionTable.id, input.sessionID))
    .get()
  const deleted = sessionDeletedInTransaction(db, input.sessionID)
  const deleteGate = currentMissionDeleteRetentionIntentInTransaction(db, input.sessionID)
  if (session?.archivedAt === null && !deleted && !deleteGate) return
  throw new MissionExecutionWakeClosedError({
    message: deleted || deleteGate
      ? `Mission ${input.missionID} was deleted under closure event ${input.closure.eventID}.`
      : `Mission ${input.missionID} is archived under closure event ${input.closure.eventID}.`,
    missionID: input.missionID,
    sessionID: input.sessionID,
    state: "closed",
    operationID: input.closure.operationID,
    closureEventID: input.closure.eventID,
  })
}

function commitMissionRetentionGateInTransaction(
  db: Database.TxOrDb,
  input: {
    closure: Extract<MissionExecutionClosure, { state: "closing" }>
    settledAt: number
  },
): void {
  Database.requireActiveTransaction("commitMissionRetentionGateInTransaction")
  if (input.closure.source === "mission.archive") {
    const row = db
      .update(SessionTable)
      .set({ time_archived: input.settledAt, time_updated: input.settledAt })
      .where(eq(SessionTable.id, input.closure.sessionID))
      .returning()
      .get()
    if (!row) throw new Error(`Mission ${input.closure.missionID} Session disappeared before archive gate`)
    Bus.publishOwnedInTransaction(Session.Event.Updated, { info: Session.fromRow(row) })
    return
  }
  if (input.closure.source === "mission.delete") {
    ensureMissionDeleteRetentionIntentInTransaction(db, {
      missionID: input.closure.missionID,
      sessionID: input.closure.sessionID,
      requestID: input.closure.requestID,
      provenance: input.closure.provenance,
    })
  }
}

function appendMissionExecutionClosureInTransaction(
  input:
    | (z.input<typeof MissionExecutionOpenedPayload> & {
        sessionID: string
        operationID: string
        eventID?: string
        state: "opened"
        source: string
      })
    | (z.input<typeof MissionExecutionTerminalPayload> & {
        sessionID: string
        operationID: string
        eventID?: string
        state: "closing" | "closed"
        source: string
      }),
): MissionExecutionClosure {
  Database.requireActiveTransaction("appendMissionExecutionClosureInTransaction")
  const payload =
    input.state === "opened"
      ? MissionExecutionOpenedPayload.parse({
          missionID: input.missionID,
          requestID: input.requestID,
          requestFingerprint: input.requestFingerprint,
        })
      : MissionExecutionTerminalPayload.parse({
          missionID: input.missionID,
          requestID: input.requestID,
          provenance: input.provenance,
        })
  const event = ProtocolStore.appendEventInTransaction({
    id: input.eventID,
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

function assertMissionSchedulerWakesSettledForClosureInTransaction(
  db: Database.TxOrDb,
  closure: MissionExecutionClosure,
): void {
  Database.requireActiveTransaction("assertMissionSchedulerWakesSettledForClosureInTransaction")
  if (closure.state !== "closing") {
    throw new Error(`Mission wake terminal assertion requires closing state, got ${closure.state}`)
  }
  const closingEvent = db
    .select({ seq: ProtocolEventTable.seq })
    .from(ProtocolEventTable)
    .where(eq(ProtocolEventTable.id, closure.eventID))
    .get()
  if (!closingEvent) throw new Error(`Mission closure event ${closure.eventID} disappeared before terminal assertion`)
  const openedEvent = db
    .select({ id: ProtocolEventTable.id, seq: ProtocolEventTable.seq })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, closure.sessionID),
        eq(ProtocolEventTable.type, MISSION_EXECUTION_CLOSURE_EVENT_TYPES.opened),
        lt(ProtocolEventTable.seq, closingEvent.seq),
      ),
    )
    .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.id))
    .limit(1)
    .get()
  if (!openedEvent) {
    const impossibleWake = db
      .select({ inboxID: ProtocolInboxTable.id })
      .from(ProtocolInboxTable)
      .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
      .innerJoin(
        ProtocolDeliveryReceiptTable,
        eq(ProtocolDeliveryReceiptTable.inbox_id, ProtocolInboxTable.id),
      )
      .where(
        and(
          eq(ProtocolInboxTable.actor, "session"),
          eq(ProtocolInboxTable.actor_id, closure.sessionID),
          eq(ProtocolEventTable.type, "scheduler.message"),
          lt(ProtocolEventTable.seq, closingEvent.seq),
          sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') = 'session_wake'`,
        ),
      )
      .limit(1)
      .get()
    if (impossibleWake) {
      throw new Error(
        `Draft Mission closure ${closure.eventID} found scheduler wake ${impossibleWake.inboxID} without an opened occurrence`,
      )
    }
    return
  }
  const unsettled = db
    .select({
      inboxID: ProtocolInboxTable.id,
      eventID: ProtocolInboxTable.envelope_id,
      messageID: sql<string>`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.message_id')`,
    })
    .from(ProtocolInboxTable)
    .innerJoin(ProtocolEventTable, eq(ProtocolEventTable.id, ProtocolInboxTable.envelope_id))
    .innerJoin(
      ProtocolDeliveryReceiptTable,
      eq(ProtocolDeliveryReceiptTable.inbox_id, ProtocolInboxTable.id),
    )
    .where(
      and(
        eq(ProtocolInboxTable.actor, "session"),
        eq(ProtocolInboxTable.actor_id, closure.sessionID),
        eq(ProtocolEventTable.type, "scheduler.message"),
        gt(ProtocolEventTable.seq, openedEvent.seq),
        lt(ProtocolEventTable.seq, closingEvent.seq),
        sql`json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.kind') = 'session_wake'`,
        sql`NOT EXISTS (
          SELECT 1
          FROM ${MessageTable} AS scheduler_terminal_reply
          WHERE scheduler_terminal_reply.session_id = ${closure.sessionID}
            AND json_extract(scheduler_terminal_reply.data, '$.role') = 'assistant'
            AND json_extract(scheduler_terminal_reply.data, '$.parentID') = json_extract(${ProtocolDeliveryReceiptTable.receipt}, '$.message_id')
            AND json_extract(scheduler_terminal_reply.data, '$.time.completed') IS NOT NULL
        )`,
      ),
    )
    .limit(1)
    .get()
  if (!unsettled) return
  if (
    !schedulerWakeMessageMatchesInTransaction(db, {
      sessionID: closure.sessionID,
      messageID: unsettled.messageID,
      eventID: unsettled.eventID,
      inboxID: unsettled.inboxID,
    })
  ) {
    throw new Error(
      `Scheduler inbox ${unsettled.inboxID} session wake Message occurrence is invalid during Mission closure`,
    )
  }
  throw new Error(
    `Mission ${closure.missionID} scheduler wake ${unsettled.inboxID} has no terminal assistant reply before closed`,
  )
}

type MissionExecutionWakeAdmissionBase = {
  closureEventID: string
  operationID: string
  messageID: string
  textPartID: string
  controlID: string
  preflightBundle: NonNullable<UserMessagePersistenceHooks["preflightBundle"]>
  commitBundle: NonNullable<UserMessagePersistenceHooks["commitBundle"]>
  ownerPreflight: (db: Database.TxOrDb) => void
  ownerLifecycle: (owner: AbortSignal) => Disposable
}

export type MissionOperatorWakeAdmission = MissionExecutionWakeAdmissionBase & {
  kind: "operator"
  operatorRequest: { requestID: string; requestFingerprint: string }
}

export type MissionNonOperatorWakeAdmission = MissionExecutionWakeAdmissionBase & {
  kind: "non_operator"
}

export type MissionExecutionWakeAdmission = MissionOperatorWakeAdmission | MissionNonOperatorWakeAdmission

export function missionOperatorWakeReason(admission: MissionOperatorWakeAdmission, missionID: string) {
  return MissionOperatorWakeReason.parse({
    source: "mission.operator",
    missionID,
    requestID: admission.operatorRequest.requestID,
    requestFingerprint: admission.operatorRequest.requestFingerprint,
    openedEventID: admission.closureEventID,
  })
}

let beforeOperatorWakeBundleCommitForTest:
  | ((input: {
      missionID: string
      sessionID: string
      source: "mission.dispatch" | "mission.wake"
      requestID: string
      admission: MissionOperatorWakeAdmission
    }) => void | Promise<void>)
  | undefined

function assertMissionExecutionWakeAdmissionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; missionID: string; closureEventID: string; operationID: string },
): void {
  Database.requireActiveTransaction("assertMissionExecutionWakeAdmissionInTransaction")
  const current = currentMissionExecutionClosureInTransaction(db, input.sessionID)
  if (
    current?.state !== "opened" ||
    current.missionID !== input.missionID ||
    current.eventID !== input.closureEventID ||
    current.operationID !== input.operationID
  ) {
    if (current?.state === "closing" || current?.state === "closed") {
      throw new MissionExecutionWakeClosedError({
        message: `Mission ${input.missionID} ${current.state} occurrence rejects wake persistence or Prompt ownership.`,
        missionID: input.missionID,
        sessionID: input.sessionID,
        state: current.state,
        operationID: current.operationID,
        closureEventID: current.eventID,
      })
    }
    throw new Error(`Mission ${input.missionID} wake occurrence changed before durable admission`)
  }
}

function missionExecutionWakeAdmission(
  closure: Extract<MissionExecutionClosure, { state: "opened" }>,
  identityKey: string,
  operator: {
    requestID: string
    requestFingerprint: string
    acceptedInput: z.output<typeof MissionOperatorAcceptedInput>
    commitConfigInTransaction: (db: Database.TxOrDb) => void
  },
): MissionOperatorWakeAdmission
function missionExecutionWakeAdmission(
  closure: Extract<MissionExecutionClosure, { state: "opened" }>,
  identityKey?: string,
  operator?: undefined,
): MissionNonOperatorWakeAdmission
function missionExecutionWakeAdmission(
  closure: Extract<MissionExecutionClosure, { state: "opened" }>,
  identityKey = `mission-wake\0${closure.sessionID}\0${closure.source}\0${closure.requestID}`,
  operator?: {
    requestID: string
    requestFingerprint: string
    acceptedInput: z.output<typeof MissionOperatorAcceptedInput>
    commitConfigInTransaction: (db: Database.TxOrDb) => void
  },
): MissionExecutionWakeAdmission {
  const input = {
    sessionID: closure.sessionID,
    missionID: closure.missionID,
    closureEventID: closure.eventID,
    operationID: closure.operationID,
    messageID: Identifier.deterministic("message", `${identityKey}\0message`),
    textPartID: Identifier.deterministic("part", `${identityKey}\0text`),
    controlID: Identifier.deterministic("session_control", `${identityKey}\0control`),
  }
  let messageExistedBeforeBundle = false
  const assertAcceptedBundle = (message: { id: string }, parts: Array<Record<string, unknown>>) => {
    if (!operator) return
    if (message.id !== input.messageID) {
      throw new Error(`Mission operator request ${closure.requestID} persisted an unexpected Message identity`)
    }
    const text = parts.find((part) => part.id === input.textPartID && part.type === "text")?.text
    const attachments = missionOperatorAttachmentInputs(parts.filter((part) => part.type === "file"))
    const reason = (message as { extra?: { wake_reason?: unknown } }).extra?.wake_reason
    const model = (message as { model?: { providerID?: unknown; modelID?: unknown } }).model
    const modelReference =
      typeof model?.providerID === "string" && typeof model.modelID === "string"
        ? `${model.providerID}/${model.modelID}`
        : undefined
    const expectedReason = {
      source: "mission.operator",
      missionID: closure.missionID,
      requestID: operator.requestID,
      requestFingerprint: operator.requestFingerprint,
      openedEventID: closure.eventID,
    }
    if (
      text !== operator.acceptedInput.text ||
      canonicalJSONValue(attachments) !== canonicalJSONValue(operator.acceptedInput.attachments) ||
      (operator.acceptedInput.model !== null && modelReference !== operator.acceptedInput.model) ||
      canonicalJSONValue(reason) !== canonicalJSONValue(expectedReason)
    ) {
      throw new MissionExecutionWakeInputConflictError({
        message: `Mission ${closure.missionID} operator request ${closure.requestID} Message bundle differs from its accepted input.`,
        missionID: closure.missionID,
        sessionID: closure.sessionID,
        requestID: closure.requestID,
        acceptedFingerprint: closure.requestFingerprint,
        receivedFingerprint: canonicalDigestSource("mission-operator-message-bundle-v1", { text, attachments }).sha256,
        closureEventID: closure.eventID,
      })
    }
  }
  const ownerLifecycle = (owner: AbortSignal): Disposable => {
    const observe = () => {
      if (owner.aborted) return
      try {
        const current = currentMissionExecutionClosure(closure.sessionID)
        if (current?.state === "opened" && current.eventID === closure.eventID) return
        const close = current?.state === "closing" || current?.state === "closed" ? current : undefined
        const provenance = close?.provenance ?? {
          surface: "mission-lifecycle",
          reason: `Mission execution occurrence ${closure.eventID} was superseded`,
        }
        SessionPromptState.cancelOwned(closure.sessionID, undefined, owner, {
          settlementRequired: true,
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: close?.source ?? "runtime.prompt_owner",
            surface: provenance.surface,
            requestID: close?.requestID ?? closure.requestID,
            reason: provenance.reason,
            targetSessionID: closure.sessionID,
            missionID: closure.missionID,
            causationEventID: close?.eventID,
          }),
        })
      } catch (error) {
        log.error("Mission Prompt owner closure observation failed", {
          sessionID: closure.sessionID,
          openedEventID: closure.eventID,
          error,
        })
      }
    }
    const timer = setInterval(observe, 100)
    timer.unref()
    observe()
    return { [Symbol.dispose]: () => clearInterval(timer) }
  }
  const base: MissionExecutionWakeAdmissionBase = {
    closureEventID: closure.eventID,
    operationID: closure.operationID,
    messageID: input.messageID,
    textPartID: input.textPartID,
    controlID: input.controlID,
    preflightBundle: (message, parts) => {
      assertAcceptedBundle(message, parts as Array<Record<string, unknown>>)
      Database.use((db) => {
        assertMissionExecutionWakeAdmissionInTransaction(db, input)
        messageExistedBeforeBundle = Boolean(
          db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, input.messageID)).get(),
        )
        if (messageExistedBeforeBundle) throw new PersistedWakeReplay(input.sessionID, input.messageID)
      })
    },
    commitBundle: () => {
      if (!messageExistedBeforeBundle) Database.use((db) => operator?.commitConfigInTransaction(db))
    },
    ownerPreflight: (db) => assertMissionExecutionWakeAdmissionInTransaction(db, input),
    ownerLifecycle,
  }
  return operator
    ? {
        ...base,
        kind: "operator",
        operatorRequest: { requestID: operator.requestID, requestFingerprint: operator.requestFingerprint },
      }
    : { ...base, kind: "non_operator" }
}

function exactOperatorRequestClosure(input: {
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
  messageID: string
}):
  | {
      opened: Extract<MissionExecutionClosure, { state: "opened" }>
      requestFingerprint: string
      terminal?: Extract<MissionExecutionClosure, { state: "closing" | "closed" }>
    }
  | undefined {
  return Database.use((db) => {
    const message = db
      .select({ data: MessageTable.data })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
      .get()
    let messageReason: MissionOperatorWakeReason | undefined
    if (message) {
      if (message.data.role !== "user") {
        throw new Error(`Mission operator request Message ${input.messageID} is not a user Message`)
      }
      const userData = message.data as typeof message.data & { extra?: Record<string, unknown> }
      const reason = MissionOperatorWakeReason.parse(userData.extra?.wake_reason)
      if (reason.requestID !== input.requestID) {
        throw new Error(`Mission operator request Message ${input.messageID} has conflicting ingress identity`)
      }
      messageReason = reason
    }
    const openedRows = db
      .select({ id: ProtocolEventTable.id, seq: ProtocolEventTable.seq })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, input.sessionID),
          eq(ProtocolEventTable.type, MISSION_EXECUTION_CLOSURE_EVENT_TYPES.opened),
          ...(messageReason
            ? [eq(ProtocolEventTable.id, messageReason.openedEventID)]
            : [
                eq(ProtocolEventTable.source, input.source),
                sql`json_extract(${ProtocolEventTable.payload}, '$.requestID') = ${input.requestID}`,
              ]),
        ),
      )
      .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.id))
      .limit(2)
      .all()
    if (openedRows.length > 1) {
      throw new Error(
        `Mission operator request ${input.requestID} has multiple opened authorities for Session ${input.sessionID}`,
      )
    }
    const openedRow = openedRows[0]
    if (!openedRow) return undefined
    const opened = closureFromEvent(ProtocolStore.requireEvent(openedRow.id))
    if (!opened || opened.state !== "opened") {
      throw new Error(`Mission operator request event ${openedRow.id} is not an opened occurrence`)
    }
    const nextOpened = db
      .select({ id: ProtocolEventTable.id, seq: ProtocolEventTable.seq })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, input.sessionID),
          eq(ProtocolEventTable.type, MISSION_EXECUTION_CLOSURE_EVENT_TYPES.opened),
          gt(ProtocolEventTable.seq, openedRow.seq),
        ),
      )
      .orderBy(asc(ProtocolEventTable.seq), asc(ProtocolEventTable.id))
      .limit(1)
      .get()
    const terminalRow = db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, input.sessionID),
          sql`${ProtocolEventTable.type} IN (${MISSION_EXECUTION_CLOSURE_EVENT_TYPES.closing}, ${MISSION_EXECUTION_CLOSURE_EVENT_TYPES.closed})`,
          gt(ProtocolEventTable.seq, openedRow.seq),
          ...(nextOpened ? [lt(ProtocolEventTable.seq, nextOpened.seq)] : []),
        ),
      )
      .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.id))
      .limit(1)
      .get()
    const terminal = terminalRow ? closureFromEvent(ProtocolStore.requireEvent(terminalRow.id)) : undefined
    if (terminal?.state === "opened") throw new Error(`Mission closure frontier query returned opened event`)
    return { opened, requestFingerprint: messageReason?.requestFingerprint ?? opened.requestFingerprint, terminal }
  })
}

function prepareOperatorWakeAdmission(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
  requestFingerprint: string
  acceptedInput: z.output<typeof MissionOperatorAcceptedInput>
  commitConfigInTransaction: (db: Database.TxOrDb) => void
}): MissionOperatorWakeAdmission {
  const occurrenceIdentityKey = `mission-operator-wake\0${input.sessionID}\0${input.source}\0${input.requestID}\0${input.requestFingerprint}`
  const requestIdentityKey = `mission-operator-request\0${input.sessionID}\0${input.source}\0${input.requestID}`
  const plannedOpenedEventID = Identifier.deterministic("protocol_event", `${occurrenceIdentityKey}\0opened`)
  const plannedMessageID = Identifier.deterministic("message", `${requestIdentityKey}\0message`)
  const exactRequest = exactOperatorRequestClosure({
    sessionID: input.sessionID,
    source: input.source,
    requestID: input.requestID,
    messageID: plannedMessageID,
  })
  const current = currentMissionExecutionClosure(input.sessionID)
  if (current && current.missionID !== input.missionID) {
    throw new Error(`Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`)
  }
  if (exactRequest && exactRequest.opened.missionID !== input.missionID) {
    throw new Error(`Mission operator request ${input.requestID} belongs to Mission ${exactRequest.opened.missionID}`)
  }
  if (exactRequest && exactRequest.requestFingerprint !== input.requestFingerprint) {
    throw new MissionExecutionWakeInputConflictError({
      message: `Mission ${input.missionID} operator request ${input.requestID} was already accepted with different input.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      requestID: input.requestID,
      acceptedFingerprint: exactRequest.requestFingerprint,
      receivedFingerprint: input.requestFingerprint,
      closureEventID: exactRequest.opened.eventID,
    })
  }
  if (current?.state === "opened" && exactRequest?.opened.eventID === current.eventID) {
    return missionExecutionWakeAdmission(current, requestIdentityKey, input)
  }
  if (exactRequest?.terminal) {
    throw new MissionExecutionWakeClosedError({
      message: `Mission ${input.missionID} operator request ${input.requestID} already belongs to ${exactRequest.terminal.state} occurrence ${exactRequest.terminal.operationID}.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      state: exactRequest.terminal.state,
      operationID: exactRequest.terminal.operationID,
      closureEventID: exactRequest.terminal.eventID,
    })
  }
  if (exactRequest) {
    throw new Error(`Mission operator request ${input.requestID} was superseded without its terminal closure fact`)
  }
  if (current?.state === "closing") {
    throw new MissionExecutionClosingError({
      message: `Mission ${input.missionID} execution is still closing; complete the durable close before reopening it.`,
      missionID: input.missionID,
      sessionID: input.sessionID,
      operationID: current.operationID,
      closureEventID: current.eventID,
    })
  }
  if (current?.state === "opened") return missionExecutionWakeAdmission(current, requestIdentityKey, input)

  const planned: Extract<MissionExecutionClosure, { state: "opened" }> = {
    missionID: input.missionID,
    sessionID: input.sessionID,
    requestID: input.requestID,
    source: input.source,
    state: "opened",
    requestFingerprint: input.requestFingerprint,
    operationID: deterministicOperationUUID(occurrenceIdentityKey),
    eventID: plannedOpenedEventID,
  }
  const baselineEventID = current?.eventID
  const admission = missionExecutionWakeAdmission(planned, requestIdentityKey, input)
  return {
    ...admission,
    preflightBundle: (message, parts) =>
      Database.use((db) => {
        Database.requireActiveTransaction("prepareOperatorWakeAdmission.preflightBundle")
        const before = currentMissionExecutionClosureInTransaction(db, input.sessionID)
        if (before?.eventID === planned.eventID) {
          assertMissionExecutionWakeAdmissionInTransaction(db, {
            sessionID: input.sessionID,
            missionID: input.missionID,
            closureEventID: planned.eventID,
            operationID: planned.operationID,
          })
          return admission.preflightBundle(message, parts)
        }
        if (before?.eventID !== baselineEventID || (before && before.state !== "closed")) {
          const winningRequest = exactOperatorRequestClosure({
            sessionID: input.sessionID,
            source: input.source,
            requestID: input.requestID,
            messageID: plannedMessageID,
          })
          if (winningRequest && winningRequest.requestFingerprint !== input.requestFingerprint) {
            throw new MissionExecutionWakeInputConflictError({
              message: `Mission ${input.missionID} operator request ${input.requestID} was concurrently accepted with different input.`,
              missionID: input.missionID,
              sessionID: input.sessionID,
              requestID: input.requestID,
              acceptedFingerprint: winningRequest.requestFingerprint,
              receivedFingerprint: input.requestFingerprint,
              closureEventID: winningRequest.opened.eventID,
            })
          }
          if (before?.state === "closing" || before?.state === "closed") {
            throw new MissionExecutionWakeClosedError({
              message: `Mission ${input.missionID} closure changed before operator wake commit.`,
              missionID: input.missionID,
              sessionID: input.sessionID,
              state: before.state,
              operationID: before.operationID,
              closureEventID: before.eventID,
            })
          }
          throw new Error(`Mission ${input.missionID} execution occurrence changed before operator wake commit`)
        }
        if (before) {
          if (before.state !== "closed") {
            throw new Error(`Mission ${input.missionID} has no closed occurrence before operator wake commit`)
          }
          assertMissionRetentionAdmissionInTransaction(db, {
            missionID: input.missionID,
            sessionID: input.sessionID,
            closure: before,
          })
        }
        appendMissionExecutionClosureInTransaction({
          missionID: planned.missionID,
          sessionID: planned.sessionID,
          requestID: planned.requestID,
          source: planned.source,
          state: "opened",
          operationID: planned.operationID,
          eventID: planned.eventID,
          requestFingerprint: planned.requestFingerprint,
        })
        admission.preflightBundle(message, parts)
      }),
  }
}

export async function openMissionExecutionWithWake<Receipt extends { activation: Promise<unknown> }>(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
  acceptedInput: MissionOperatorAcceptedInput
  wake: (admission: MissionOperatorWakeAdmission) => Promise<Receipt>
}): Promise<Receipt> {
  const acceptedInput = MissionOperatorAcceptedInput.parse(input.acceptedInput)
  const preparedConfig = await Session.prepareConfigOverlayMergeInProject({
    sessionID: input.sessionID,
    projectID: Instance.project.id,
    patch: acceptedInput.configPatch,
  })
  const admission = prepareOperatorWakeAdmission({
    ...input,
    acceptedInput,
    requestFingerprint: operatorAcceptedInputFingerprint(acceptedInput),
    commitConfigInTransaction: (db) => {
      preparedConfig.commitInTransaction(db)
    },
  })
  await beforeOperatorWakeBundleCommitForTest?.({ ...input, admission })
  const receipt = await input.wake(admission)
  await receipt.activation
  return receipt
}

/**
 * Admit a non-operator wake only while the current Mission occurrence remains
 * active. This never opens or reopens an occurrence; explicit operator ingress
 * is the sole authority for that transition.
 */
export async function admitMissionExecutionWake<Receipt extends { activation: Promise<unknown> }>(input: {
  missionID: string
  sessionID: string
  wake: (admission: MissionNonOperatorWakeAdmission) => Receipt | Promise<Receipt>
}): Promise<Receipt> {
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
  const receipt = await input.wake(missionExecutionWakeAdmission(current))
  await receipt.activation
  return receipt
}

export async function closeMissionExecutionOperation(input: {
  missionID: string
  sessionID: string
  source: "mission.abort" | "mission.delete" | "mission.archive"
  requestID: string
  provenance: z.input<typeof MissionExecutionCloseProvenance>
  signal?: AbortSignal
}): Promise<MissionExecutionClosure> {
  const closing = Database.immediateTransaction((db) => {
    const current = currentMissionExecutionClosureInTransaction(db, input.sessionID)
    if (current && current.missionID !== input.missionID) {
      throw new Error(
        `Mission execution closure for Session ${input.sessionID} belongs to Mission ${current.missionID}`,
      )
    }
    if (current?.state === "closed" || current?.state === "closing") {
      return current
    }
    const closure = appendMissionExecutionClosureInTransaction({
      missionID: input.missionID,
      sessionID: input.sessionID,
      operationID: randomUUID(),
      state: "closing",
      source: input.source,
      requestID: input.requestID,
      provenance: input.provenance,
    })
    return closure
  })
  if (closing.state === "closed") return closing
  const ownerOccurrenceID = Identifier.ascending("call")
  const targetID = `mission:${closing.sessionID}`
  const leaseMilliseconds = 120_000
  const acquired = acquireControlLease({
    target: "lifecycle",
    targetID,
    ownerOccurrenceID,
    now: Date.now(),
    leaseMilliseconds,
  })
  if (!acquired.acquired) {
    const current = currentMissionExecutionClosure(closing.sessionID)
    if (current?.state === "closed") return current
    throw new MissionExecutionClosingError({
      message: `Mission ${closing.missionID} close operation ${closing.operationID} is owned until ${acquired.lease.expires_at}.`,
      missionID: closing.missionID,
      sessionID: closing.sessionID,
      operationID: closing.operationID,
      closureEventID: closing.eventID,
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
  const ownedClosing = postAcquire
  const owner = new AbortController()
  const deadline = abortAfterAny(120_000, owner.signal, ...(input.signal ? [input.signal] : []))
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
    await afterCloseLeaseAcquiredForTest?.(ownedClosing)
    await executeMissionClosingEffects({ closure: ownedClosing, signal: deadline.signal })
    if (renewalFailure) throw renewalFailure
    deadline.signal.throwIfAborted()
    const closed = Database.immediateTransaction((db) => {
      const settledAt = Date.now()
      assertControlLeaseInTransaction(db, {
        target: "lifecycle",
        targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: settledAt,
      })
      const current = currentMissionExecutionClosureInTransaction(db, closing.sessionID)
      if (
        !current ||
        current.state !== "closing" ||
        current.eventID !== closing.eventID ||
        current.operationID !== closing.operationID
      ) {
        throw new Error(`Mission execution closure ${closing.sessionID} changed before terminal commit`)
      }
      if (SessionPromptOwner.currentInTransaction(db, closing.sessionID)) {
        throw new Error(`Mission ${closing.missionID} still has a durable Prompt owner before closed`)
      }
      const projectID = db
        .select({ projectID: SessionTable.project_id })
        .from(SessionTable)
        .where(eq(SessionTable.id, closing.sessionID))
        .get()?.projectID
      if (!projectID) throw new Error(`Mission ${closing.missionID} Session disappeared before closed`)
      const activeChildID = findActiveMissionTaskIDInTransaction(db, {
        projectID,
        missionID: closing.missionID,
        sessionID: closing.sessionID,
      })
      if (activeChildID) {
        throw new Error(
          `Mission ${closing.missionID} still has active child Task before closed: ${activeChildID}`,
        )
      }
      assertMissionSchedulerWakesSettledForClosureInTransaction(db, current)
      const result = appendMissionExecutionClosureInTransaction({
        missionID: closing.missionID,
        sessionID: closing.sessionID,
        operationID: closing.operationID,
        state: "closed",
        source: closing.source,
        requestID: closing.requestID,
        provenance: ownedClosing.provenance,
      })
      commitMissionRetentionGateInTransaction(db, { closure: current, settledAt })
      // The closure fact is terminal, so this owner is finished. Contenders
      // receive the typed durable `closing` projection and never busy-poll.
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
    await afterClosedCommittedForTest?.(closed as Extract<MissionExecutionClosure, { state: "closed" }>)
    return closed
  } finally {
    clearInterval(renewal)
    deadline.clearTimeout()
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
}

/** Resume the one durable Mission close occurrence without inventing a new
 * request. Startup recovery and peer takeover use this same executor. */
export function resumeMissionExecutionClosure(input: {
  sessionID: string
  signal?: AbortSignal
}): Promise<MissionExecutionClosure> {
  const current = currentMissionExecutionClosure(input.sessionID)
  if (!current || current.state === "opened") {
    throw new Error(`Mission Session ${input.sessionID} has no durable closing occurrence to resume`)
  }
  if (current.state === "closed") return Promise.resolve(current)
  return closeMissionExecutionOperation({
    missionID: current.missionID,
    sessionID: current.sessionID,
    source: current.source,
    requestID: current.requestID,
    provenance: current.provenance,
    signal: input.signal,
  })
}

export function requireMissionExecutionClosureEvent(eventID: string): MissionExecutionClosure {
  return closureFromEvent(ProtocolStore.requireEvent(eventID))!
}

export const MissionExecutionClosureTestHooks = {
  installBeforeOperatorWakeBundleCommit(
    hook: (input: {
      missionID: string
      sessionID: string
      source: "mission.dispatch" | "mission.wake"
      requestID: string
      admission: MissionOperatorWakeAdmission
    }) => void | Promise<void>,
  ): Disposable {
    if (beforeOperatorWakeBundleCommitForTest) {
      throw new Error("Mission operator wake bundle-commit hook is already installed")
    }
    beforeOperatorWakeBundleCommitForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeOperatorWakeBundleCommitForTest === hook) beforeOperatorWakeBundleCommitForTest = undefined
      },
    }
  },
  installAfterCloseLeaseAcquired(
    hook: (closure: Extract<MissionExecutionClosure, { state: "closing" }>) => void | Promise<void>,
  ): Disposable {
    if (afterCloseLeaseAcquiredForTest) throw new Error("Mission close lease-acquired hook is already installed")
    afterCloseLeaseAcquiredForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterCloseLeaseAcquiredForTest === hook) afterCloseLeaseAcquiredForTest = undefined
      },
    }
  },
  installAfterClosedCommitted(
    hook: (closure: Extract<MissionExecutionClosure, { state: "closed" }>) => void | Promise<void>,
  ): Disposable {
    if (afterClosedCommittedForTest) throw new Error("Mission closed-commit hook is already installed")
    afterClosedCommittedForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterClosedCommittedForTest === hook) afterClosedCommittedForTest = undefined
      },
    }
  },
}
