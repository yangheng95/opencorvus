import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { Instance, runOutsideInstanceContext, type ProjectDeletionAdmission } from "@/project/instance"
import { runWithProjectDeletionIdentity } from "@/project/independent-project-owner"
import { ProtocolStore } from "@/protocol/store"
import { projectLifecycleProperties } from "@/protocol/lifecycle-projection"
import { SessionEvents } from "@/session/events"
import { Message } from "@/session/message"
import { Todo } from "@/session/todo"
import { executionLifecycleOrderKey, SessionStatus, sessionLifecycleOrderKey } from "@/session/status"
import { Log } from "@/util/log"
import { Database, and, eq } from "@/storage/db"
import { MessageTable, PartTable, SessionTable, ToolPartRequestTable, type SessionKind } from "@/session/session.sql"
import {
  taskIDForSession,
  taskSession,
  sessionRole,
  sessionParentID,
  sessionLineageIdentity,
} from "@/engine/task-session-lineage"
import { timelineMessageOrderKey, timelineOrderKey, timelinePartOrderKey } from "@/timeline/order"
import { persistedSessionAgentID } from "@/agent/persisted-session-identity"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import {
  type MissionCallerReceiptParticipantEvidence,
  resolveMissionCallerReceiptParticipant,
} from "@/mission/caller-participant"
import { rightSidebarConversationAgentID } from "@/chat/session"
import { Context } from "@/util/context"

const log = Log.create({ service: "task-message-protocol-bridge" })
let globalRelayInitialized = false
const initializedLocalDirectories = new Set<string>()
let crossInstanceBridgeQueue = Promise.resolve()
let crossInstanceBridgeFailures: unknown[] = []
const projectDeletionBridgeAdmission = Context.create<ProjectDeletionAdmission>(
  "task-message-protocol-bridge-project-deletion-admission",
)

export function provideTaskMessageProtocolBridgeProjectDeletionAdmission<R>(
  admission: ProjectDeletionAdmission,
  fn: () => R,
): R {
  return projectDeletionBridgeAdmission.provide(admission, fn)
}

export async function awaitTaskMessageProtocolBridgeIdle() {
  while (true) {
    const current = crossInstanceBridgeQueue
    await current
    if (current !== crossInstanceBridgeQueue) continue
    const failures = crossInstanceBridgeFailures
    crossInstanceBridgeFailures = []
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, `${failures.length} cross-instance message bridge operations failed`)
    }
    return
  }
}

export const TaskMessageProtocolBridgeTestHooks = {
  trackLifecycle(operation: Promise<void>): Promise<void> {
    const queued = crossInstanceBridgeQueue.then(() =>
      Database.runLifecycleActivity("test-held message bridge", () => operation),
    )
    crossInstanceBridgeQueue = queued.then(
      () => undefined,
      (error) => {
        crossInstanceBridgeFailures.push(error)
      },
    )
    return queued
  },
}

// ── Overlay rendering metadata ──
//
// `session.kind` is the authoritative source for "what is this session for".
// The overlay renders a card per kind; this module's job is to stamp the kind
// (and parentSessionID) onto every outgoing message event payload so
// the frontend can route without re-deriving anything.
//
// Routing metadata belongs to the event envelope and message info. It must not
// be copied into Message.Part: parts are a strict persisted protocol model.
// `orderKey` is part of that DTO projection, not overlay routing metadata.

/** Display channel — which card the overlay groups this message under.
 *  "main" is the top-level conversation; the rest mirror SessionKind values
 *  (minus "root", which is the task container, not a card). */
export type OverlayChannel = "main" | Exclude<SessionKind, "root">

export type OverlayResolvedRole = string

type OverlayMessageInfo = {
  id?: string
  role?: string
  author?: string
  agent?: string
  parentID?: string
  orderKey?: string
  extra?: Record<string, unknown>
}

/**
 * Compute overlay metadata for a message event.
 *
 * `session.kind` owns the display channel. `info.author` owns the participant.
 * Provider-facing `info.role` never determines authorship.
 */
export function overlayMeta(
  sessionID: string,
  rootSessionID: string,
  info: OverlayMessageInfo,
): {
  resolvedRole: OverlayResolvedRole
  channel: OverlayChannel
  agentID: string
  sessionAgentID: string
  participantEvidence?: MissionCallerReceiptParticipantEvidence
} {
  // No "assistant" fallback (rule: 一个萝卜一个坑). Every message MUST carry
  // an explicit role. Falling back silently routes role-less messages into
  // the generic assistant card and orphans the actual agent's stream — fix
  // the emitter, don't paper over it here.
  if (typeof info.role !== "string" || info.role.length === 0) {
    throw new Error(
      `overlayMeta: message on session ${sessionID} has no info.role. ` +
        `Every message emitter must set role explicitly (user / assistant). ` +
        `Find the upstream caller that constructed this message and add the role.`,
    )
  }
  const role = info.role
  if (typeof info.author !== "string" || info.author.length === 0) {
    throw new Error(`overlayMeta: message on session ${sessionID} has no info.author`)
  }
  const author = info.author
  const declaredAgentID = typeof info.agent === "string" ? info.agent.trim() : ""
  if (!declaredAgentID) throw new Error(`overlayMeta: message on session ${sessionID} has no info.agent`)

  const kind = sessionRole(sessionID)
  if (!kind) {
    throw new Error(
      `overlayMeta: session ${sessionID} has no kind in the DB. Every session ` +
        `must be created via Session.createNext({kind: ...}); a row missing kind ` +
        `means a code path bypassed createNext or the row was inserted directly.`,
    )
  }
  const parentID = sessionParentID(sessionID)
  const isRoot = (!!rootSessionID && sessionID === rootSessionID) || (!rootSessionID && kind === "root" && !parentID)

  if (isRoot) {
    if (role !== "user") {
      throw new Error(`overlayMeta: root session ${sessionID} requires role=user; got role=${role} author=${author}`)
    }
    // Root user messages are addressed to an agent, so the author and target
    // agent are intentionally independent identities. For example, an
    // operator reply is authored by `user` and addressed to `orchestrator`.
    return {
      resolvedRole: author,
      channel: "main",
      agentID: declaredAgentID,
      sessionAgentID: declaredAgentID,
    }
  }

  if (kind === "root") {
    throw new Error(
      `overlayMeta: child session ${sessionID} has kind="root" (only the ` +
        `task's session_id should be a root). Probably a Session.createNext ` +
        `call passed kind="root" with a parentID.`,
    )
  }
  if (role === "assistant" && author === "user") {
    throw new Error(`overlayMeta: assistant message on session ${sessionID} has non-agent author ${author}`)
  }
  const occurrenceInputMessageID = role === "user" ? String(info.id || "").trim() : String(info.parentID || "").trim()
  const projectedIdentity = occurrenceInputMessageID
    ? WorkerTurnDescriptor.findForMessageAuthority({ sessionID, inputMessageID: occurrenceInputMessageID })?.payload
        .identity
    : undefined
  const helperParticipant =
    role === "assistant" && author === declaredAgentID && HelperAgentRegistry.isID(declaredAgentID)
  const participantEvidence = resolveMissionCallerReceiptParticipant({
    ownerSessionID: sessionID,
    messageID: String(info.id || ""),
    parentMessageID: typeof info.parentID === "string" ? info.parentID : undefined,
    author,
    agentID: declaredAgentID,
  })
  const externalParticipant = helperParticipant || participantEvidence !== undefined
  const sessionRow = Database.use((db) =>
    db.select({ metadata: SessionTable.metadata }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
  )
  if (!sessionRow) throw new Error(`overlayMeta: session ${sessionID} disappeared while resolving its owner`)
  const rightSidebarOwner = rightSidebarConversationAgentID({ kind, metadata: sessionRow.metadata })
  const sessionAgentID =
    externalParticipant || rightSidebarOwner
      ? persistedSessionAgentID({
          sessionID,
          sessionKind: kind,
          metadata: sessionRow.metadata,
          projectedIdentity,
        })
      : projectedIdentity
        ? persistedSessionAgentID({ sessionID, sessionKind: kind, projectedIdentity })
        : RuntimeTemplateRegistry.isWorkerSessionKind(kind)
          ? persistedSessionAgentID({ sessionID, sessionKind: kind })
          : declaredAgentID
  const agentID = externalParticipant ? declaredAgentID : sessionAgentID
  if (declaredAgentID !== agentID) {
    throw new Error(
      `overlayMeta: message on session ${sessionID} agent ${declaredAgentID} does not match persisted agent ${agentID}`,
    )
  }
  if (role === "assistant" && author !== agentID) {
    throw new Error(
      `overlayMeta: assistant message on session ${sessionID} author ${author} does not match persisted agent ${agentID}`,
    )
  }
  return {
    resolvedRole: author,
    channel: kind,
    agentID,
    sessionAgentID,
    ...(participantEvidence ? { participantEvidence } : {}),
  }
}

function sessionFromProperties(properties: Record<string, unknown>) {
  if (typeof properties.sessionID === "string" && properties.sessionID) return properties.sessionID
  const info = properties.info
  if (info && typeof info === "object" && "sessionID" in info && typeof info.sessionID === "string") {
    return info.sessionID
  }
  const part = properties.part
  if (part && typeof part === "object" && "sessionID" in part && typeof part.sessionID === "string") {
    return part.sessionID
  }
  return ""
}

function hostProjectDirectoryForSession(sessionID: string): string {
  const row = Database.use((db) =>
    db
      .select({ worktree: ProjectTable.worktree })
      .from(SessionTable)
      .innerJoin(ProjectTable, eq(SessionTable.project_id, ProjectTable.id))
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  if (!row) throw new Error(`cross-instance message bridge cannot resolve host project for session ${sessionID}`)
  return row.worktree
}

type MessageEventIdentity = {
  id: string
  role: string
  author: string
  agent: string
  parentID?: string
  orderKey: string
  originSource: string
}

const messageInfoCache = new Map<string, MessageEventIdentity>()

function rememberMessageInfo(messageID: string, info: MessageEventIdentity) {
  if (!messageID) return
  messageInfoCache.set(messageID, info)
  if (messageInfoCache.size > 500) {
    const first = messageInfoCache.keys().next().value
    if (first) messageInfoCache.delete(first)
  }
}

export function originSourceFromMessageExtra(extra: unknown): string {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return ""
  const record = extra as { source?: unknown; wake_reason?: unknown }
  const directSource = typeof record.source === "string" ? record.source : ""
  const wakeReason =
    record.wake_reason && typeof record.wake_reason === "object" && !Array.isArray(record.wake_reason)
      ? (record.wake_reason as { source?: unknown })
      : undefined
  const wakeSource = typeof wakeReason?.source === "string" ? wakeReason.source : ""
  return directSource || wakeSource
}

function cacheMessageInfo(properties: Record<string, unknown>) {
  const info = properties.info as any
  if (!info?.id) return
  if (typeof info.role !== "string" || info.role.length === 0) {
    throw new Error(
      `cacheMessageInfo: message ${info.id} missing info.role — every emitter ` +
        `must set role explicitly; no "assistant" fallback (一个萝卜一个坑).`,
    )
  }
  if (typeof info.orderKey !== "string" || info.orderKey.length === 0) {
    throw new Error(`cacheMessageInfo: message ${info.id} missing info.orderKey`)
  }
  if (typeof info.author !== "string" || info.author.length === 0) {
    throw new Error(`cacheMessageInfo: message ${info.id} missing info.author`)
  }
  if (typeof info.agent !== "string" || info.agent.length === 0) {
    throw new Error(`cacheMessageInfo: message ${info.id} missing info.agent`)
  }
  rememberMessageInfo(info.id, {
    id: info.id,
    role: info.role,
    author: info.author,
    agent: info.agent,
    ...(typeof info.parentID === "string" ? { parentID: info.parentID } : {}),
    orderKey: info.orderKey,
    originSource: originSourceFromMessageExtra(info.extra),
  })
}

function readPersistedMessageInfo(messageID: string): MessageEventIdentity | undefined {
  const row = Database.use((db) =>
    db
      .select({ data: MessageTable.data, timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(eq(MessageTable.id, messageID))
      .get(),
  )
  if (!row) return undefined
  const role =
    row.data && typeof row.data === "object" && "role" in row.data
      ? (row.data as Record<string, unknown>).role
      : undefined
  if (typeof role !== "string" || !role) return undefined
  const author =
    row.data && typeof row.data === "object" && "author" in row.data
      ? (row.data as Record<string, unknown>).author
      : undefined
  if (typeof author !== "string" || !author) return undefined
  const agent =
    row.data && typeof row.data === "object" && "agent" in row.data
      ? (row.data as Record<string, unknown>).agent
      : undefined
  if (typeof agent !== "string" || !agent) return undefined
  const originSource =
    row.data && typeof row.data === "object" && "extra" in row.data
      ? originSourceFromMessageExtra((row.data as Record<string, unknown>).extra)
      : undefined
  const info = {
    id: messageID,
    role,
    author,
    agent,
    ...(row.data && typeof row.data === "object" && typeof (row.data as Record<string, unknown>).parentID === "string"
      ? { parentID: (row.data as Record<string, unknown>).parentID as string }
      : {}),
    originSource: originSource ?? "",
    orderKey: timelineMessageOrderKey({
      info: {
        id: messageID,
        time: { created: row.timeCreated },
      },
    }),
  }
  rememberMessageInfo(messageID, info)
  return info
}

function partRecord(properties: Record<string, unknown>): Record<string, unknown> {
  const part = properties.part
  if (!part || typeof part !== "object" || Array.isArray(part)) {
    throw new Error("bridge: part event missing part while enriching event")
  }
  return part as Record<string, unknown>
}

function partOrderKeysForEvent(properties: Record<string, unknown>): { messageOrderKey: string; partOrderKey: string } {
  const part = partRecord(properties)
  const partID = typeof part.id === "string" ? part.id : ""
  const messageID = typeof part.messageID === "string" ? part.messageID : ""
  const sessionID = typeof part.sessionID === "string" ? part.sessionID : ""
  if (!partID || !messageID || !sessionID) {
    throw new Error("bridge: part event missing part id/messageID/sessionID while enriching event")
  }
  const rows = Database.use((db) => {
    const genericPart = db
      .select({ messageID: PartTable.message_id, timeCreated: PartTable.time_created })
      .from(PartTable)
      .where(eq(PartTable.id, partID))
      .get()
    const toolRequest = db
      .select({ messageID: ToolPartRequestTable.message_id, timeCreated: ToolPartRequestTable.time_created })
      .from(ToolPartRequestTable)
      .where(eq(ToolPartRequestTable.id, partID))
      .get()
    if (genericPart && toolRequest) {
      throw new Error(`bridge: part ${partID} has conflicting persisted owners`)
    }
    const part = genericPart ?? toolRequest
    if (part && part.messageID !== messageID) {
      throw new Error(`bridge: part ${partID} belongs to message ${part.messageID}, not ${messageID}`)
    }
    return {
      message: db
        .select({ timeCreated: MessageTable.time_created })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, messageID), eq(MessageTable.session_id, sessionID)))
        .get(),
      part,
    }
  })
  if (!rows.message) throw new Error(`bridge: message ${messageID} missing persisted row while enriching part event`)
  if (!rows.part) throw new Error(`bridge: part ${partID} missing persisted row while enriching event`)
  const messageOrderKey = timelineMessageOrderKey({
    info: {
      id: messageID,
      time: { created: rows.message.timeCreated },
    },
  })
  const partOrderKey = timelinePartOrderKey({ id: partID, timeCreated: rows.part.timeCreated })
  const provided = part.orderKey
  if (typeof provided === "string" && provided.length > 0 && provided !== partOrderKey) {
    throw new Error(`bridge: part ${partID} orderKey drift between payload and persisted row`)
  }
  const eventOrderKey = properties.orderKey
  if (typeof eventOrderKey === "string" && eventOrderKey.length > 0 && eventOrderKey !== messageOrderKey) {
    throw new Error(`bridge: part event ${partID} orderKey drift between payload and owning message`)
  }
  return { messageOrderKey, partOrderKey }
}

function infoForEvent(properties: Record<string, unknown>): {
  id: string
  role: string
  author: string
  agent: string
  parentID?: string
  orderKey: string
  originSource: string
} {
  const info = properties.info as any
  if (info && typeof info === "object" && info.role) {
    if (typeof info.orderKey !== "string" || info.orderKey.length === 0) {
      throw new Error(`bridge: message ${String(info.id || "<unknown>")} missing info.orderKey`)
    }
    if (typeof info.author !== "string" || info.author.length === 0) {
      throw new Error(`bridge: message ${String(info.id || "<unknown>")} missing info.author`)
    }
    if (typeof info.agent !== "string" || info.agent.length === 0) {
      throw new Error(`bridge: message ${String(info.id || "<unknown>")} missing info.agent`)
    }
    return {
      id: String(info.id || ""),
      role: String(info.role),
      author: String(info.author),
      agent: String(info.agent),
      ...(typeof info.parentID === "string" ? { parentID: info.parentID } : {}),
      orderKey: info.orderKey,
      originSource: originSourceFromMessageExtra(info.extra),
    }
  }
  const part = properties.part as any
  const messageID = part?.messageID || (properties as any).messageID || ""
  if (messageID && messageInfoCache.has(messageID)) {
    return messageInfoCache.get(messageID)!
  }
  if (messageID) {
    const persisted = readPersistedMessageInfo(messageID)
    if (persisted) return persisted
    throw new Error(`bridge: message ${messageID} missing role/author in cache and DB while enriching event`)
  }
  throw new Error("bridge: event missing both info.role/info.author and messageID")
}

/**
 * Stamp resolvedRole / channel / parentSessionID onto every event.
 * Source of truth: session.kind and session.parent_id.
 */
export function enrichMessageEventProperties(
  type: string,
  properties: Record<string, unknown>,
  sessionID: string,
  taskID?: string,
): Record<string, unknown> {
  const info = infoForEvent(properties)
  let rootSessionID = ""
  if (taskID !== undefined) {
    const persistedRootSessionID = taskSession(taskID)
    if (!persistedRootSessionID) {
      throw new Error(`bridge: task-owned message event for ${taskID} has no persisted root session`)
    }
    rootSessionID = persistedRootSessionID
  }
  const meta = overlayMeta(sessionID, rootSessionID, info)
  const parentSessionID = sessionParentID(sessionID)
  const enriched = { ...properties }

  if (type === Message.Event.PartUpdated.type) {
    const { messageOrderKey, partOrderKey } = partOrderKeysForEvent(properties)
    enriched.part = { ...partRecord(properties), orderKey: partOrderKey }
    enriched.orderKey = messageOrderKey
  } else if (enriched.info && typeof enriched.info === "object") {
    const infoWithMeta = {
      ...(enriched.info as any),
      resolvedRole: meta.resolvedRole,
      channel: meta.channel,
      agentID: meta.agentID,
      sessionAgentID: meta.sessionAgentID,
      ...(meta.participantEvidence ? { participantEvidence: meta.participantEvidence } : {}),
      originSource: info.originSource,
      ...(parentSessionID ? { parentSessionID } : {}),
    }
    if (typeof infoWithMeta.orderKey !== "string" || infoWithMeta.orderKey.length === 0) {
      throw new Error(`bridge: message ${String((infoWithMeta as any).id || "<unknown>")} missing info.orderKey`)
    }
    enriched.info = {
      ...infoWithMeta,
      orderKey: infoWithMeta.orderKey,
    }
    enriched.orderKey = info.orderKey
  } else {
    enriched.orderKey = info.orderKey
  }
  enriched.resolvedRole = meta.resolvedRole
  enriched.channel = meta.channel
  enriched.agentID = meta.agentID
  enriched.sessionAgentID = meta.sessionAgentID
  if (meta.participantEvidence) enriched.participantEvidence = meta.participantEvidence
  enriched.role = info.role
  enriched.author = info.author
  enriched.originSource = info.originSource
  if (info.parentID) enriched.parentMessageID = info.parentID
  if (parentSessionID) enriched.parentSessionID = parentSessionID
  return enriched
}

/**
 * Project one already-persisted task message through the same bridge used by
 * live message events. Route responses and live events must expose one
 * identical visible-message contract; otherwise the overlay's immediate
 * ingestion can fail before the matching live event arrives.
 */
export type ProjectedTaskMessage<TInfo extends Message.Info = Message.Info> = {
  info: TInfo & {
    orderKey: string
    resolvedRole: OverlayResolvedRole
    channel: OverlayChannel
    agentID: string
    sessionAgentID: string
    originSource: string
    parentSessionID?: string
  }
  parts: Message.VisiblePart[]
}

function projectPersistedMessage<TInfo extends Message.Info>(
  message: { info: TInfo; parts: Message.Part[] },
  taskID?: string,
): ProjectedTaskMessage<TInfo> {
  const sessionID = message.info.sessionID
  const messageProperties = enrichMessageEventProperties(
    Message.Event.Updated.type,
    { info: message.info },
    sessionID,
    taskID,
  )
  const parts = message.parts.map((part) => {
    const partProperties = enrichMessageEventProperties(
      Message.Event.PartUpdated.type,
      { part },
      part.sessionID,
      taskID,
    )
    return partProperties.part as Message.VisiblePart
  })
  return {
    info: messageProperties.info as ProjectedTaskMessage<TInfo>["info"],
    parts,
  }
}

export function projectPersistedSessionMessage<TInfo extends Message.Info>(message: {
  info: TInfo
  parts: Message.Part[]
}): ProjectedTaskMessage<TInfo> {
  return projectPersistedMessage(message)
}

export function projectPersistedTaskMessage<TInfo extends Message.Info>(
  message: { info: TInfo; parts: Message.Part[] },
  taskID: string,
): ProjectedTaskMessage<TInfo> {
  return projectPersistedMessage(message, taskID)
}

function ephemeralEnvelopeOrderKey(type: string, payload: Record<string, unknown>): string {
  if (type === Message.Event.Updated.type) {
    const info = payload.info
    const orderKey = info && typeof info === "object" ? (info as Record<string, unknown>).orderKey : undefined
    if (typeof orderKey === "string" && orderKey.length > 0) return orderKey
    throw new Error("bridge: message.updated missing envelope orderKey")
  }
  const orderKey = payload.orderKey
  if (typeof orderKey === "string" && orderKey.length > 0) return orderKey
  throw new Error(`bridge: ${type} missing envelope orderKey`)
}

/**
 * Stamp routing metadata onto lifecycle events without requiring a message
 * role. `agent.execution.lifecycle` is about one input-message execution occurrence;
 * they do not have an authoring message and therefore must not enter
 * `infoForEvent()`.
 */
export function enrichLifecycleProperties(
  properties: Record<string, unknown>,
  sessionID: string,
  input?: { orderKey?: string },
): Record<string, unknown> {
  const orderKey = input?.orderKey ?? (typeof properties.orderKey === "string" ? properties.orderKey.trim() : "")
  if (!orderKey) throw new Error(`bridge: lifecycle event for session ${sessionID} has no orderKey`)
  return projectLifecycleProperties(properties, sessionID, { orderKey })
}

/**
 * Stamp Session-scoped routing metadata without inventing an execution
 * input-message authority. Provider stream errors can occur before or between
 * message execution facts; a worker's latest durable Turn descriptor supplies
 * its projected identity while the Session row remains the routing authority.
 */
export function enrichSessionErrorProperties(
  properties: Record<string, unknown>,
  sessionID: string,
  input: { orderKey: string },
): Record<string, unknown> {
  const kind = sessionRole(sessionID)
  if (!kind) {
    throw new Error(
      `bridge: session error for session ${sessionID} has no kind in the database. ` +
        `Every session error must target a persisted Session row.`,
    )
  }
  const row = Database.use((db) =>
    db.select({ metadata: SessionTable.metadata }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
  )
  if (!row) throw new Error(`bridge: session error for session ${sessionID} has no persisted Session row`)
  const projectedIdentity = RuntimeTemplateRegistry.isWorkerSessionKind(kind)
    ? WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity
    : undefined
  const agentID = persistedSessionAgentID({
    sessionID,
    sessionKind: kind,
    metadata: row.metadata,
    projectedIdentity,
  })
  const provided = typeof properties.orderKey === "string" ? properties.orderKey.trim() : ""
  if (provided && provided !== input.orderKey) {
    throw new Error(`bridge: session error for session ${sessionID} orderKey drift between input and session row`)
  }
  const parentSessionID = sessionParentID(sessionID)
  return {
    ...properties,
    orderKey: input.orderKey,
    channel: kind === "root" ? "main" : kind,
    agentID,
    ...(kind === "root" ? {} : { resolvedRole: agentID }),
    ...(parentSessionID ? { parentSessionID } : {}),
  }
}

function bridgeFailureSummary(type: string, error: string) {
  return `Session bridge failed to persist ${type}: ${error}`
}

function durableBridgePayload(input: Record<string, unknown>): Record<string, unknown> {
  const payload = structuredClone(input)
  delete payload.taskID
  delete payload.sessionID
  delete payload.interactionID
  delete payload.orderKey
  delete payload.channel
  delete payload.agentID
  delete payload.resolvedRole
  delete payload.parentSessionID
  return payload
}

function appendBridgePersistFailure(input: {
  taskID: string
  sessionID: string
  type: string
  error: string
  properties: Record<string, unknown>
}) {
  const now = Date.now()
  return ProtocolStore.appendEvent({
    kind: "event",
    type: "session.bridge.persist_failed",
    aggregate: "task",
    aggregate_id: input.taskID,
    task_id: null,
    session_id: input.sessionID,
    interaction_id: null,
    stream_id: null,
    source: "session.bridge",
    target: null,
    correlation_id: null,
    causation_id: null,
    reply_to: null,
    emitted_at: now,
    payload: {
      failed_type: input.type,
      error: input.error,
      summary: bridgeFailureSummary(input.type, input.error),
    },
  })
}

async function appendBridgeEvent(
  input: {
    type: string
    taskID: string
    sessionID: string
    orderKey?: string
    payload: Record<string, unknown>
  },
  options?: { required?: boolean },
) {
  const now = Date.now()
  try {
    await ProtocolStore.appendEvent({
      kind: "event",
      type: input.type,
      aggregate: "task",
      aggregate_id: input.taskID,
      task_id: null,
      session_id: input.sessionID,
      interaction_id: null,
      stream_id: null,
      source: "session.bridge",
      target: null,
      correlation_id: null,
      causation_id: null,
      reply_to: null,
      emitted_at: now,
      order_key: input.orderKey,
      payload: durableBridgePayload(input.payload),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    log.warn("bridge: session event persist failed", { type: input.type, error: detail })
    try {
      await appendBridgePersistFailure({
        taskID: input.taskID,
        sessionID: input.sessionID,
        type: input.type,
        error: detail,
        properties: input.payload,
      })
    } catch (diagnosticError) {
      log.error("bridge: failed to persist bridge diagnostic event", {
        type: input.type,
        error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
      })
      throw new AggregateError(
        [err, diagnosticError],
        `bridge: failed to persist ${input.type} and its diagnostic event`,
        { cause: err },
      )
    }
    if (options?.required) throw err
  }
}

async function appendBridgePreparationFailure(input: {
  type: string
  properties: Record<string, unknown>
  error: string
}) {
  const sessionID = sessionFromProperties(input.properties)
  if (!sessionID) {
    log.warn("bridge: cannot persist bridge preparation failure without session id", {
      type: input.type,
      error: input.error,
    })
    return
  }
  const taskID = taskIDForSession(sessionID)
  if (!taskID) {
    log.warn("bridge: cannot persist bridge preparation failure for non-task-owned session", {
      type: input.type,
      sessionID,
      error: input.error,
    })
    return
  }
  try {
    await appendBridgePersistFailure({
      taskID,
      sessionID,
      type: input.type,
      error: input.error,
      properties: input.properties,
    })
  } catch (diagnosticError) {
    log.error("bridge: failed to persist bridge preparation diagnostic event", {
      type: input.type,
      sessionID,
      error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
    })
    throw diagnosticError
  }
}

function messageEventDiagnosticProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const diagnostic: Record<string, unknown> = {}
  if (typeof properties.sessionID === "string" && properties.sessionID) diagnostic.sessionID = properties.sessionID
  if (typeof properties.messageID === "string" && properties.messageID) diagnostic.messageID = properties.messageID
  if (typeof properties.partID === "string" && properties.partID) diagnostic.partID = properties.partID
  if (typeof properties.field === "string" && properties.field) diagnostic.field = properties.field

  const info = properties.info
  if (info && typeof info === "object") {
    const value = info as Record<string, unknown>
    diagnostic.info = {
      ...(typeof value.id === "string" && value.id ? { id: value.id } : {}),
      ...(typeof value.sessionID === "string" && value.sessionID ? { sessionID: value.sessionID } : {}),
      ...(typeof value.role === "string" && value.role ? { role: value.role } : {}),
    }
  }

  const part = properties.part
  if (part && typeof part === "object") {
    const value = part as Record<string, unknown>
    diagnostic.part = {
      ...(typeof value.id === "string" && value.id ? { id: value.id } : {}),
      ...(typeof value.sessionID === "string" && value.sessionID ? { sessionID: value.sessionID } : {}),
      ...(typeof value.messageID === "string" && value.messageID ? { messageID: value.messageID } : {}),
      ...(typeof value.type === "string" && value.type ? { type: value.type } : {}),
    }
  }

  return diagnostic
}

function bridgeDiagnosticPropertiesForType(
  type: string,
  properties: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const diagnostic = type.startsWith("message.") ? messageEventDiagnosticProperties(properties) : { ...properties }
  return extra ? { ...diagnostic, ...extra } : diagnostic
}

/**
 * Push a message event through live SSE subscriptions only.
 *
 * Message events are NEVER persisted to `protocol_event`. Source of truth for
 * messages is the `message` / `part` tables — clients hydrate from those on
 * reconnect (see Session.messages). Persisting would be a 双源 violation
 * (rule 23) and historically blew up `protocol_event.payload` to hundreds of
 * MB by re-snapshotting the full message on every update.
 */
/**
 * Push one occurrence-bound execution lifecycle event through Server-Sent Events (SSE)
 * AND persist it in `protocol_event`. Unlike message events, lifecycle events
 * are tiny (sessionID + status enum + optional reason/error) and benefit from
 * persistence: an overlay reconnect replays from `protocol_event`, so cards
 * reload with their last terminal status instead of falling back to the
 * default `running` and re-spinning forever.
 *
 * Single source of truth for session lifecycle, per
 * `specs/current/architecture/07-panel-reactivity.md`. Physical prompt
 * ownership remains in SessionPromptState and is never inferred from these
 * historical lifecycle facts.
 */
export async function persistTaskSessionLifecycle(type: string, properties: Record<string, unknown>) {
  let event!: Parameters<typeof appendBridgeEvent>[0]
  try {
    const sessionID = sessionFromProperties(properties)
    if (!sessionID) return
    if (typeof properties.inputMessageID !== "string" || properties.inputMessageID.length === 0) {
      throw new Error(`execution lifecycle ${sessionID} has no input message identity`)
    }
    const inputMessageID = properties.inputMessageID
    const lineageTaskID = taskIDForSession(sessionID)
    const explicitTaskID = typeof properties.taskID === "string" ? properties.taskID : undefined
    if (explicitTaskID && lineageTaskID && explicitTaskID !== lineageTaskID) {
      throw new Error(
        `session lifecycle ${sessionID} explicit task ${explicitTaskID} conflicts with lineage task ${lineageTaskID}`,
      )
    }
    const taskID = explicitTaskID ?? lineageTaskID
    if (!taskID) return
    const orderKey = executionLifecycleOrderKey(sessionID, inputMessageID)
    const enriched = enrichLifecycleProperties(properties, sessionID, { orderKey })
    event = { type, taskID, sessionID, orderKey, payload: enriched }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await appendBridgePreparationFailure({ type, properties, error })
    log.warn("bridge: session lifecycle preparation failed", { type, error })
    throw err
  }
  await appendBridgeEvent(event, { required: true })
}

async function persistPublishedTaskSessionLifecycle(type: string, properties: Record<string, unknown>) {
  const sessionID = sessionFromProperties(properties)
  if (!sessionID) throw new Error(`published execution lifecycle ${type} has no session identity`)
  const hostDirectory = hostProjectDirectoryForSession(sessionID)
  if (Project.samePath(Instance.directory, hostDirectory)) {
    await persistTaskSessionLifecycle(type, properties)
    return
  }
  await enqueueCrossInstanceBridge(type, properties, hostDirectory, Instance.directory, async (props) => {
    await persistTaskSessionLifecycle(type, props)
  })
  await awaitTaskMessageProtocolBridgeIdle()
}

/**
 * Persist one task-owned Session lifecycle fact as part of the caller's
 * active database transaction. This is the exact synchronous counterpart of
 * `persistTaskSessionLifecycle`; preparation failures are allowed to abort the
 * surrounding unit of work instead of being converted into a later diagnostic.
 */
export function persistTaskSessionLifecycleInTransaction(type: string, properties: Record<string, unknown>) {
  const sessionID = sessionFromProperties(properties)
  if (!sessionID) throw new Error(`session lifecycle ${type} has no session identity`)
  if (typeof properties.inputMessageID !== "string" || properties.inputMessageID.length === 0) {
    throw new Error(`execution lifecycle ${sessionID} has no input message identity`)
  }
  const inputMessageID = properties.inputMessageID
  const lineageTaskID = taskIDForSession(sessionID)
  const explicitTaskID = typeof properties.taskID === "string" ? properties.taskID : undefined
  if (explicitTaskID && lineageTaskID && explicitTaskID !== lineageTaskID) {
    throw new Error(
      `session lifecycle ${sessionID} explicit task ${explicitTaskID} conflicts with lineage task ${lineageTaskID}`,
    )
  }
  const taskID = explicitTaskID ?? lineageTaskID
  if (!taskID) throw new Error(`session lifecycle ${sessionID} has no task lineage`)
  const orderKey = executionLifecycleOrderKey(sessionID, inputMessageID)
  const payload = enrichLifecycleProperties(properties, sessionID, { orderKey })
  return ProtocolStore.appendEventInTransaction({
    kind: "event",
    type,
    aggregate: "task",
    aggregate_id: taskID,
    task_id: null,
    session_id: sessionID,
    interaction_id: null,
    stream_id: null,
    source: "session.bridge",
    target: null,
    correlation_id: null,
    causation_id: null,
    reply_to: null,
    emitted_at: Date.now(),
    order_key: orderKey,
    payload: durableBridgePayload(payload),
  })
}

function sessionErrorSummary(properties: Record<string, unknown>): string {
  const error = properties.error as { data?: { message?: unknown }; message?: unknown; name?: unknown } | undefined
  const dataMessage = error?.data?.message
  if (typeof dataMessage === "string" && dataMessage.length > 0) return dataMessage
  const message = error?.message
  if (typeof message === "string" && message.length > 0) return message
  const name = error?.name
  if (typeof name === "string" && name.length > 0) return name
  return "session stream error"
}

/**
 * Persist session stream/provider errors independently of terminal lifecycle.
 * A provider can fail while the processor later reports a secondary symptom
 * (for example a runtime or provider error). The operator must see the original
 * stream error, so it gets its own tiny replayable event instead of being only
 * a process log line.
 */
async function bridgeSessionError(type: string, properties: Record<string, unknown>) {
  let event!: Parameters<typeof appendBridgeEvent>[0]
  try {
    const sessionID = sessionFromProperties(properties)
    if (!sessionID) return
    const taskID = taskIDForSession(sessionID)
    if (!taskID) return
    const orderKey = sessionLifecycleOrderKey(sessionID)
    const enriched = enrichSessionErrorProperties(properties, sessionID, { orderKey })
    event = {
      type,
      taskID,
      sessionID,
      orderKey,
      payload: {
        ...enriched,
        summary: sessionErrorSummary(properties),
      },
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await appendBridgePreparationFailure({ type, properties, error })
    log.warn("bridge: session error preparation failed", { type, error })
    return
  }
  await appendBridgeEvent(event)
}

async function bridgeEvent(type: string, properties: Record<string, unknown>) {
  // Top-level guard: subscribers run synchronously inside Bus.dispatch's for-loop;
  // a sync throw here would abort dispatch for sibling subscribers. Old code hid
  // this behind enqueueBridgeWork's swallowed promise — keep the same behaviour
  // explicitly so transient DB / lookup failures degrade an event, not the bus.
  try {
    const sessionID = sessionFromProperties(properties)
    if (!sessionID) return
    const taskID = taskIDForSession(sessionID)
    const enriched = enrichMessageEventProperties(type, properties, sessionID, taskID)
    const lineage = sessionLineageIdentity(sessionID)
    if (!lineage) throw new Error(`bridge: message event Session ${sessionID} has no durable lineage`)
    ProtocolStore.dispatchEphemeral({
      type,
      aggregate: taskID ? "task" : "session",
      ...(taskID ? { taskID } : {}),
      sessionID,
      source: "session.bridge",
      orderKey: ephemeralEnvelopeOrderKey(type, enriched),
      payload: {
        ...enriched,
        projectID: lineage.projectID,
        rootSessionID: lineage.rootSessionID,
        sessionLineage: lineage.sessionIDs,
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await appendBridgePreparationFailure({ type, properties: messageEventDiagnosticProperties(properties), error })
    log.warn("bridge: live message event preparation failed", { type, error })
  }
}

async function bridgeMovedEvent(properties: Record<string, unknown>) {
  const sessionID = sessionFromProperties(properties)
  if (!sessionID) throw new Error("bridge: message.moved has no target Session identity")
  const taskID = taskIDForSession(sessionID)
  const enriched = enrichMessageEventProperties(Message.Event.Moved.type, properties, sessionID, taskID)
  const lineage = sessionLineageIdentity(sessionID)
  if (!lineage) throw new Error(`bridge: message.moved target Session ${sessionID} has no durable lineage`)
  ProtocolStore.dispatchEphemeral({
    type: Message.Event.Moved.type,
    aggregate: taskID ? "task" : "session",
    ...(taskID ? { taskID } : {}),
    sessionID,
    source: "session.bridge",
    orderKey: ephemeralEnvelopeOrderKey(Message.Event.Moved.type, enriched),
    payload: {
      ...enriched,
      projectID: lineage.projectID,
      rootSessionID: lineage.rootSessionID,
      sessionLineage: lineage.sessionIDs,
    },
  })
}

async function bridgeTodoUpdated(properties: Record<string, unknown>) {
  try {
    const sessionID = sessionFromProperties(properties)
    if (!sessionID) return
    const taskID = taskIDForSession(sessionID)
    if (!taskID) return
    const updatedAt = Number(properties.updatedAt)
    if (!Number.isInteger(updatedAt) || updatedAt <= 0) {
      throw new Error(`bridge: todo.updated for session ${sessionID} missing positive updatedAt`)
    }
    const orderKey = timelineOrderKey({
      domain: "protocol",
      time: updatedAt,
      id: `${sessionID}_todo`,
    })
    ProtocolStore.dispatchEphemeral({
      type: Todo.Event.Updated.type,
      aggregate: "task",
      taskID,
      sessionID,
      source: "session.bridge",
      orderKey,
      payload: {
        ...properties,
        taskID,
        sessionID,
        orderKey,
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await appendBridgePreparationFailure({ type: Todo.Event.Updated.type, properties, error })
    log.warn("bridge: live todo event preparation failed", { error })
  }
}

function enqueueCrossInstanceBridge(
  type: string,
  props: Record<string, unknown>,
  hostDirectory: string,
  sourceDirectory: string | undefined,
  handler: (props: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  let queued: Promise<void> | undefined
  const deletionAdmission = projectDeletionBridgeAdmission.tryUse()
  const provideHostIdentity = async (fn: () => Promise<void>): Promise<void> => {
    if (deletionAdmission) {
      await runWithProjectDeletionIdentity({
        directory: hostDirectory,
        projectDeletionAdmission: deletionAdmission,
        fn,
      })
      return
    }
    await runOutsideInstanceContext(() => Instance.provideProjectIdentity({ directory: hostDirectory, fn }))
  }
  Database.runOutsideContext(() => {
    const operation = crossInstanceBridgeQueue
      .then(() =>
        Database.runLifecycleActivity(`cross-instance message bridge ${type}`, () =>
          provideHostIdentity(async () => await handler(props)),
        ),
      )
      .catch(async (err) => {
        const error = err instanceof Error ? err.message : String(err)
        try {
          await Database.runOutsideContext(() =>
            Database.runLifecycleActivity(`cross-instance message bridge diagnostic ${type}`, () =>
              provideHostIdentity(
                async () =>
                  await appendBridgePreparationFailure({
                    type,
                    properties: bridgeDiagnosticPropertiesForType(type, props, {
                      ...(sourceDirectory ? { sourceDirectory } : {}),
                    }),
                    error,
                  }),
              ),
            ),
          )
        } catch (diagnosticError) {
          log.error("bridge: failed to persist cross-instance relay diagnostic", {
            type,
            sourceDirectory,
            error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
          })
          throw new AggregateError(
            [err, diagnosticError],
            `bridge: cross-instance relay ${type} and its diagnostic both failed`,
            { cause: err },
          )
        }
        log.error("bridge: cross-instance relay failed", {
          type,
          sourceDirectory,
          error,
        })
        throw err
      })
    crossInstanceBridgeQueue = operation.then(
      () => undefined,
      (error) => {
        crossInstanceBridgeFailures.push(error)
      },
    )
    queued = crossInstanceBridgeQueue
  })
  if (!queued) throw new Error(`cross-instance message bridge ${type} was not queued`)
  return queued
}

// Cross-Instance event types and their handlers. Additions don't require
// touching dispatch logic — register the type → handler here.
const CROSS_INSTANCE_HANDLERS: Record<string, (props: Record<string, unknown>) => Promise<void>> = {
  [Message.Event.Updated.type]: async (props) => {
    cacheMessageInfo(props)
    await bridgeEvent(Message.Event.Updated.type, props)
  },
  [Message.Event.PartUpdated.type]: async (props) => {
    await bridgeEvent(Message.Event.PartUpdated.type, props)
  },
  [Message.Event.Removed.type]: async (props) => {
    await bridgeEvent(Message.Event.Removed.type, props)
  },
  [Message.Event.PartRemoved.type]: async (props) => {
    await bridgeEvent(Message.Event.PartRemoved.type, props)
  },
  [Message.Event.PartDelta.type]: async (props) => {
    await bridgeEvent(Message.Event.PartDelta.type, props)
  },
  [Todo.Event.Updated.type]: async (props) => {
    await bridgeTodoUpdated(props)
  },
  [SessionEvents.Error.type]: async (props) => {
    await bridgeSessionError(SessionEvents.Error.type, props)
  },
}

const RELAY_EVENT_TYPES = new Set(Object.keys(CROSS_INSTANCE_HANDLERS))

export function ensureTaskMessageProtocolBridge() {
  const localDirectory = Instance.directory
  if (!initializedLocalDirectories.has(localDirectory)) {
    initializedLocalDirectories.add(localDirectory)

    Bus.subscribe(
      Message.Event.Moved,
      async (event) => {
        cacheMessageInfo(event.properties)
        await bridgeMovedEvent(event.properties)
      },
      { durableID: "task-message-protocol-bridge.message-moved", effect: "idempotent_by_occurrence" },
    )
    Bus.subscribe(Message.Event.Updated, async (event) => {
      cacheMessageInfo(event.properties)
      await bridgeEvent(Message.Event.Updated.type, event.properties)
    })
    Bus.subscribe(Message.Event.PartUpdated, async (event) => {
      await bridgeEvent(Message.Event.PartUpdated.type, event.properties)
    })
    Bus.subscribe(Message.Event.Removed, async (event) => {
      await bridgeEvent(Message.Event.Removed.type, event.properties)
    })
    Bus.subscribe(Message.Event.PartRemoved, async (event) => {
      await bridgeEvent(Message.Event.PartRemoved.type, event.properties)
    })
    Bus.subscribe(Message.Event.PartDelta, async (event) => {
      await bridgeEvent(Message.Event.PartDelta.type, event.properties)
    })
    Bus.subscribe(Todo.Event.Updated, async (event) => {
      await bridgeTodoUpdated(event.properties)
    })
    Bus.subscribe(SessionStatus.Event.Status, async (event) => {
      await persistPublishedTaskSessionLifecycle(SessionStatus.Event.Status.type, event.properties)
    })
    Bus.subscribe(Bus.InstanceDisposed, (event) => {
      initializedLocalDirectories.delete(event.properties.directory)
    })
  }

  if (globalRelayInitialized) return
  globalRelayInitialized = true

  // Cross-Instance bridge: executor sessions run in worktree Instances whose
  // Bus.publish() never reaches the main Instance's subscribers. GlobalBus
  // sees all Instances; we re-execute inside the host Instance context so
  // Database lookups (sessionRole etc.) use the main DB, not the worktree's.
  GlobalBus.on("event", (envelope) => {
    if (!envelope.payload || !RELAY_EVENT_TYPES.has(envelope.payload.type)) return
    const props = envelope.payload.properties
    if (!props) return
    const sessionID = sessionFromProperties(props)
    if (!sessionID) throw new Error(`cross-instance message bridge ${envelope.payload.type} has no session identity`)
    const hostDirectory = hostProjectDirectoryForSession(sessionID)
    if (
      envelope.payload.type !== SessionEvents.Error.type &&
      envelope.directory &&
      Project.samePath(envelope.directory, hostDirectory)
    ) {
      return
    }
    const handler = CROSS_INSTANCE_HANDLERS[envelope.payload.type]
    if (!handler) return
    return enqueueCrossInstanceBridge(envelope.payload.type, props, hostDirectory, envelope.directory, handler)
  })
}
