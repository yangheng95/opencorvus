import { Bus } from "@/bus"
import { PermissionNext } from "@/permission/next"
import { ProtocolStore } from "@/protocol/store"
import { Question } from "@/question"
import { Message, Session, SessionStatus } from "@/session"
import { sessionRole, taskIDForSession } from "@/engine/task-session-lineage"
import {
  enrichMessageEventProperties,
  originSourceFromMessageExtra,
  overlayMeta,
} from "@/orchestrator/protocol/message-bridge"
import { Database, eq } from "@/storage/db"
import { SessionTable } from "@/session/session.sql"
import { timelineInteractionResponseOrderKey, timelineMessageOrderKey, timelineOrderKey } from "@/timeline/order"
import { persistedSessionAgentID } from "@/agent/persisted-session-identity"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { currentProjectDirectory } from "@/project/instance-context"

export type SessionBusEvent = {
  type: string
  properties: Record<string, unknown>
}

export type SessionMirrorEvent = {
  type: string
  summary?: string
  payload?: Record<string, unknown>
}

export function sessionBusEventSessionID(event: SessionBusEvent): string | undefined {
  const props = event.properties
  if (typeof props.sessionID === "string" && props.sessionID.length > 0) return props.sessionID
  const info = props.info
  if (typeof info === "object" && info !== null && typeof (info as Record<string, unknown>).sessionID === "string") {
    return (info as Record<string, unknown>).sessionID as string
  }
  const part = props.part
  if (typeof part === "object" && part !== null && typeof (part as Record<string, unknown>).sessionID === "string") {
    return (part as Record<string, unknown>).sessionID as string
  }
  return undefined
}

function sessionEventMeta(sessionID: string): { channel: string; resolvedRole: string; agentID: string } {
  const row = Database.use((db) =>
    db
      .select({ kind: SessionTable.kind, metadata: SessionTable.metadata })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  const kind = row?.kind
  if (!kind) throw new Error(`session-mirror: session ${sessionID} has no kind for overlay enrichment`)
  if (kind === "root") return { channel: "main", resolvedRole: "user", agentID: "user" }
  const agentID = persistedSessionAgentID({
    sessionID,
    sessionKind: kind,
    metadata: row.metadata,
    projectedIdentity: WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity,
  })
  return { channel: kind, resolvedRole: agentID, agentID }
}

function sessionOrderKey(sessionID: string): string {
  const row = Database.use((db) =>
    db
      .select({ timeCreated: SessionTable.time_created })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  if (!row) throw new Error(`session-mirror: session ${sessionID} missing persisted row for overlay enrichment`)
  return timelineOrderKey({
    domain: "session",
    time: row.timeCreated,
    id: sessionID,
  })
}

function questionRequestID(props: Record<string, unknown>): string {
  const id = typeof props.id === "string" ? props.id : typeof props.requestID === "string" ? props.requestID : ""
  if (!id) throw new Error("session-mirror: question event missing id/requestID for overlay enrichment")
  return id
}

function questionRequestOrderKey(props: Record<string, unknown>): string {
  const requestID = questionRequestID(props)
  return timelineOrderKey({
    domain: "interaction",
    time: Number(props.timeCreated),
    id: requestID,
  })
}

function questionResponseOrderKey(props: Record<string, unknown>): string {
  return timelineInteractionResponseOrderKey({
    id: questionRequestID(props),
    timeResolved: props.timeResolved,
  })
}

function stampPayloadWithMeta(
  props: Record<string, unknown>,
  meta: { channel: string; resolvedRole: string; agentID?: string; orderKey?: string },
): Record<string, unknown> {
  const payload = { ...props }
  const info = payload.info
  if (info && typeof info === "object") {
    const stampedInfo: Record<string, unknown> = {
      ...(info as Record<string, unknown>),
      channel: meta.channel,
      resolvedRole: meta.resolvedRole,
      ...(meta.agentID ? { agentID: meta.agentID } : {}),
    }
    if (typeof stampedInfo.orderKey !== "string" || stampedInfo.orderKey.length === 0) {
      throw new Error(`session-mirror: message ${String(stampedInfo.id || "<unknown>")} missing info.orderKey`)
    }
    payload.info = {
      ...stampedInfo,
      orderKey: stampedInfo.orderKey,
    }
  }
  if ("orderKey" in meta) {
    payload.orderKey = meta.orderKey
  }
  payload.channel = meta.channel
  payload.resolvedRole = meta.resolvedRole
  if (meta.agentID) payload.agentID = meta.agentID
  return payload
}

function stampSessionEventPayload(
  sessionID: string,
  props: Record<string, unknown>,
  orderKey = sessionOrderKey(sessionID),
): Record<string, unknown> {
  return stampPayloadWithMeta(props, { ...sessionEventMeta(sessionID), orderKey })
}

export function enrichStandaloneSessionTranscript(messages: Message.WithParts[]): Message.WithParts[] {
  return messages.map((message) => {
    const meta = overlayMeta(message.info.sessionID, "", message.info)
    const source = originSourceFromMessageExtra((message.info as { extra?: unknown }).extra)
    return {
      ...message,
      info: {
        ...message.info,
        channel: meta.channel,
        resolvedRole: meta.resolvedRole,
        agentID: meta.agentID,
        sessionAgentID: meta.sessionAgentID,
        ...(meta.participantEvidence ? { participantEvidence: meta.participantEvidence } : {}),
        originSource: source,
        orderKey: timelineMessageOrderKey(message),
      } as unknown as Message.Info,
      parts: message.parts,
    }
  })
}

export function mapSessionBusEvent(
  event: SessionBusEvent,
  input: { sessionID: string },
): SessionMirrorEvent | undefined {
  const props = event.properties
  const sessionID = sessionBusEventSessionID(event)
  if (!sessionID) return
  if (sessionID !== input.sessionID) return

  if (event.type === SessionStatus.Event.Status.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    const status = props.status
    const statusType =
      status && typeof status === "object" && typeof (status as Record<string, unknown>).type === "string"
        ? String((status as Record<string, unknown>).type)
        : "unknown"
    const reason =
      status && typeof status === "object" && typeof (status as Record<string, unknown>).reason === "string"
        ? String((status as Record<string, unknown>).reason)
        : ""
    return {
      type: "agent.execution.lifecycle",
      summary: reason ? `execution lifecycle: ${statusType} (${reason})` : `execution lifecycle: ${statusType}`,
      payload,
    }
  }
  if (event.type === Session.Event.Diff.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "session.diff",
      summary: "Session diff updated",
      payload,
    }
  }
  if (event.type === Session.Event.ConfigChanged.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "config.changed",
      summary: "Session config changed",
      payload,
    }
  }
  if (event.type === Message.Event.Updated.type) {
    const payload = enrichMessageEventProperties(event.type, props, sessionID)
    const info = payload.info as Record<string, unknown>
    return {
      type: "message.updated",
      summary: typeof info.role === "string" ? `Message updated: ${info.role}` : "Message updated",
      payload,
    }
  }
  if (event.type === Message.Event.PartUpdated.type) {
    const payload = enrichMessageEventProperties(event.type, props, sessionID)
    const part = payload.part as Record<string, unknown>
    return {
      type: "message.part.updated",
      summary: typeof part.type === "string" ? `Part updated: ${part.type}` : "Part updated",
      payload,
    }
  }
  if (event.type === Message.Event.PartDelta.type) {
    const payload = enrichMessageEventProperties(event.type, props, sessionID)
    return {
      type: "message.part.delta",
      summary: typeof props.field === "string" ? `Delta: ${props.field}` : "Message delta",
      payload,
    }
  }
  if (event.type === Message.Event.Removed.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "message.removed",
      summary: "Message removed",
      payload,
    }
  }
  if (event.type === Message.Event.PartRemoved.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "message.part.removed",
      summary: "Part removed",
      payload,
    }
  }
  if (event.type === Session.Event.Error.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "session.error",
      summary: "Session error",
      payload,
    }
  }
  if (event.type === PermissionNext.Event.Asked.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "permission.asked",
      summary: `Permission requested: ${String(props.permission ?? "")}`.trim(),
      payload,
    }
  }
  if (event.type === PermissionNext.Event.Replied.type) {
    const payload = stampSessionEventPayload(sessionID, props)
    return {
      type: "permission.replied",
      summary: `Permission reply: ${String(props.reply ?? "")}`.trim(),
      payload,
    }
  }
  if (event.type === PermissionNext.Event.Abandoned.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionResponseOrderKey(props))
    return {
      type: "permission.abandoned",
      summary: "Permission abandoned by infrastructure",
      payload,
    }
  }
  if (event.type === Question.Event.Asked.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionRequestOrderKey(props))
    return {
      type: "question.asked",
      summary: "Question requested",
      payload,
    }
  }
  if (event.type === Question.Event.Replied.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionResponseOrderKey(props))
    return {
      type: "question.replied",
      summary: "Question answered",
      payload,
    }
  }
  if (event.type === Question.Event.Rejected.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionResponseOrderKey(props))
    return {
      type: "question.rejected",
      summary: "Question rejected",
      payload,
    }
  }
  if (event.type === Question.Event.Expired.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionResponseOrderKey(props))
    return {
      type: "question.expired",
      summary: "Question deadline expired",
      payload,
    }
  }
  if (event.type === Question.Event.Abandoned.type) {
    const payload = stampSessionEventPayload(sessionID, props, questionResponseOrderKey(props))
    return {
      type: "question.abandoned",
      summary: "Question abandoned by infrastructure",
      payload,
    }
  }
  return
}

function shouldMirrorSessionScopedStream(sessionID: string): boolean {
  const role = sessionRole(sessionID)
  if (role === "mission") return true
  return role === "assistant"
}

export async function mirrorSessionBusEvent(event: SessionBusEvent, sessionID: string): Promise<void> {
  if (sessionBusEventSessionID(event) !== sessionID) return
  const mapped = mapSessionBusEvent(event, { sessionID })
  if (!mapped) return
  const orderKey = mapped.payload?.orderKey
  if (typeof orderKey !== "string" || orderKey.length === 0) {
    throw new Error(`session-mirror: ${mapped.type} missing envelope orderKey`)
  }
  if (sessionRole(sessionID) === "root" && mapped.type === "config.changed") {
    const taskID = taskIDForSession(sessionID)
    if (!taskID) return
    ProtocolStore.dispatchEphemeral({
      type: mapped.type,
      aggregate: "task",
      taskID,
      sessionID,
      source: "session.bridge",
      orderKey,
      payload: {
        ...(mapped.payload ?? {}),
        taskID,
        summary: mapped.summary ?? mapped.type,
      },
    })
    return
  }
  if (!shouldMirrorSessionScopedStream(sessionID)) return
  ProtocolStore.dispatchEphemeral({
    type: mapped.type,
    aggregate: "session",
    sessionID,
    source: "session.bridge",
    orderKey,
    payload: {
      ...(mapped.payload ?? {}),
      summary: mapped.summary ?? mapped.type,
    },
  })
}

const initializedLocalDirectories = new Set<string>()

export function ensureSessionProtocolBridge(): void {
  const localDirectory = currentProjectDirectory()
  if (initializedLocalDirectories.has(localDirectory)) return
  initializedLocalDirectories.add(localDirectory)

  Bus.subscribeAll(async (event: SessionBusEvent) => {
    const sessionID = sessionBusEventSessionID(event)
    if (!sessionID) return
    await mirrorSessionBusEvent(event, sessionID)
  })
  Bus.subscribe(Bus.InstanceDisposed, (event) => {
    initializedLocalDirectories.delete(event.properties.directory)
  })
}
