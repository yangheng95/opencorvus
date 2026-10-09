import type { BoardSource } from "../store/board"
import type { CardNode } from "../store/card-tree"
import type { AgentActivityRecord } from "../utils/agent-activity"
import { conversationMessageDisplayStage, isDelegatedContextMessage } from "../utils/message-origin"
import {
  assistantMessageErrorReason,
  conversationMessageHasDisplayContent,
  isCardBodyMessagePart,
} from "../utils/message-part"
import { orderedMessageParts, roleLabel } from "../utils/message"
import { compareTimelineOrderKeys, requireTimelineOrderKeyDomain } from "../utils/timeline-order"
import { apiJson, assertApiAuthorityCurrent, captureApiAuthority, type ApiAuthority } from "./api"

export interface SubagentTranscriptMessage {
  messageID: string
  sessionID: string
  agentID: string
  stage: string
  parentSessionID?: string
  time: number
  orderKey: string
  info: Record<string, unknown>
  parts: any[]
}

export interface SubagentConversationTranscript {
  targetKey: string
  sessionID: string
  messages: SubagentTranscriptMessage[]
  lastLiveSequence: number
  liveEpoch: number
  transcriptMode: "snapshot" | "delta"
  removedMessageIDs: string[]
}

export interface SubagentConversationLiveProjection {
  sessionID: string
  messageInfos: Record<string, Record<string, unknown>>
  parts: Record<
    string,
    {
      messageID: string
      partID: string
      snapshot?: Record<string, unknown>
      deltas: Record<string, string>
      anchors: Record<string, string>
      removed?: boolean
    }
  >
  removedMessageIDs: string[]
}

type SubagentConversationLiveListener = (event: unknown) => void

const subagentConversationLiveListeners = new Set<SubagentConversationLiveListener>()

export function publishSubagentConversationLiveEvent(event: unknown): void {
  for (const listener of subagentConversationLiveListeners) listener(event)
}

export function listenSubagentConversationLiveEvents(listener: SubagentConversationLiveListener): () => void {
  subagentConversationLiveListeners.add(listener)
  return () => subagentConversationLiveListeners.delete(listener)
}

export function createSubagentConversationLiveProjection(sessionID: string): SubagentConversationLiveProjection {
  return {
    sessionID: sessionID.trim(),
    messageInfos: {},
    parts: {},
    removedMessageIDs: [],
  }
}

function liveEventProperties(event: unknown): Record<string, any> {
  if (!event || typeof event !== "object" || Array.isArray(event)) return {}
  const value = event as Record<string, any>
  const properties = value.properties ?? value.payload
  return properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {}
}

function liveEventType(event: unknown): string {
  return event && typeof event === "object" && !Array.isArray(event)
    ? String((event as Record<string, unknown>).type || "")
    : ""
}

function liveEventIdentity(event: unknown): {
  sessionID: string
  messageID: string
  partID: string
  properties: Record<string, any>
} {
  const properties = liveEventProperties(event)
  const info = properties.info && typeof properties.info === "object" ? properties.info : {}
  const part = properties.part && typeof properties.part === "object" ? properties.part : {}
  return {
    sessionID: String(properties.sessionID || info.sessionID || part.sessionID || ""),
    messageID: String(properties.messageID || info.id || part.messageID || ""),
    partID: String(properties.partID || part.id || ""),
    properties,
  }
}

function livePartKey(messageID: string, partID: string): string {
  return JSON.stringify([messageID, partID])
}

/**
 * Compact exact selected-Session message events into an overlay for the
 * persisted transcript. Full snapshots supersede older deltas; only deltas
 * observed after that snapshot remain append operations.
 */
export function observeSubagentConversationLiveEvent(
  current: SubagentConversationLiveProjection,
  event: unknown,
  base?: SubagentConversationTranscript,
): SubagentConversationLiveProjection {
  const type = liveEventType(event)
  const identity = liveEventIdentity(event)
  if (!current.sessionID || identity.sessionID !== current.sessionID || !identity.messageID) return current

  if (type === "message.updated") {
    const info = identity.properties.info
    if (!info || typeof info !== "object" || Array.isArray(info)) return current
    return {
      ...current,
      messageInfos: { ...current.messageInfos, [identity.messageID]: { ...info } },
      removedMessageIDs: current.removedMessageIDs.filter((messageID) => messageID !== identity.messageID),
    }
  }

  if (type === "message.removed") {
    return current.removedMessageIDs.includes(identity.messageID)
      ? current
      : { ...current, removedMessageIDs: [...current.removedMessageIDs, identity.messageID] }
  }

  if (!identity.partID) return current
  const key = livePartKey(identity.messageID, identity.partID)
  const previous = current.parts[key]

  if (type === "message.part.updated") {
    const part = identity.properties.part
    if (!part || typeof part !== "object" || Array.isArray(part)) return current
    return {
      ...current,
      parts: {
        ...current.parts,
        [key]: {
          messageID: identity.messageID,
          partID: identity.partID,
          snapshot: { ...part },
          deltas: {},
          anchors: Object.fromEntries(
            Object.entries(part)
              .filter((entry): entry is [string, string] => typeof entry[1] === "string")
              .map(([field, value]) => [field, value]),
          ),
        },
      },
    }
  }

  if (type === "message.part.delta") {
    const field = String(identity.properties.field || "")
    const delta = typeof identity.properties.delta === "string" ? identity.properties.delta : ""
    if (!field || !delta) return current
    const persistedPart = base?.messages
      .find((message) => message.messageID === identity.messageID)
      ?.parts.find((part) => String(part?.id || "") === identity.partID)
    const anchor =
      previous?.anchors[field] ??
      (typeof previous?.snapshot?.[field] === "string"
        ? previous.snapshot[field]
        : typeof persistedPart?.[field] === "string"
          ? persistedPart[field]
          : "")
    return {
      ...current,
      parts: {
        ...current.parts,
        [key]: {
          messageID: identity.messageID,
          partID: identity.partID,
          snapshot: previous?.snapshot,
          deltas: {
            ...(previous?.deltas ?? {}),
            [field]: `${previous?.deltas[field] ?? ""}${delta}`,
          },
          anchors: { ...(previous?.anchors ?? {}), [field]: anchor },
        },
      },
    }
  }

  if (type === "message.part.removed") {
    return {
      ...current,
      parts: {
        ...current.parts,
        [key]: {
          messageID: identity.messageID,
          partID: identity.partID,
          deltas: {},
          anchors: {},
          removed: true,
        },
      },
    }
  }

  return current
}

function projectLivePartField(persisted: unknown, anchor: string, delta: string): string {
  const persistedValue = typeof persisted === "string" ? persisted : ""
  if (!persistedValue.startsWith(anchor)) return `${anchor}${delta}`
  const absorbed = persistedValue.slice(anchor.length)
  if (delta.startsWith(absorbed)) return `${persistedValue}${delta.slice(absorbed.length)}`
  if (absorbed.startsWith(delta)) return persistedValue
  return anchor ? `${anchor}${delta}` : `${persistedValue}${delta}`
}

function liveMessageFromInfo(
  sessionID: string,
  messageID: string,
  info: Record<string, unknown>,
  parts: any[],
): SubagentTranscriptMessage {
  const ownerSessionID = String(info.sessionID || "")
  const agentID = String(info.agentID || "")
  const role = String(info.role || "")
  const author = String(info.author || "")
  const channel = String(info.channel || "")
  // The message bridge represents an absent origin marker as an empty string.
  // The persisted conversation view accepts that value too; only the field's
  // type is required for live messages.
  const source = info.originSource
  const time = Number((info.time as Record<string, unknown> | undefined)?.created || 0)
  if (
    ownerSessionID !== sessionID ||
    !agentID ||
    !role ||
    !author ||
    !channel ||
    typeof source !== "string" ||
    !(time > 0)
  ) {
    throw new Error(`subagent conversation ${sessionID} live message ${messageID} has incomplete identity`)
  }
  return {
    messageID,
    sessionID: ownerSessionID,
    agentID,
    stage: conversationMessageDisplayStage({ role, author, channel, source }),
    parentSessionID: String(info.parentSessionID || "") || undefined,
    time,
    orderKey: requireTimelineOrderKeyDomain(
      info.orderKey,
      `subagent conversation ${sessionID} live message ${messageID}`,
      "message",
    ),
    info,
    parts,
  }
}

export function projectSubagentConversationLive(
  base: SubagentConversationTranscript,
  live: SubagentConversationLiveProjection,
): SubagentConversationTranscript {
  if (base.sessionID !== live.sessionID) return base
  if (
    live.removedMessageIDs.length === 0 &&
    Object.keys(live.messageInfos).length === 0 &&
    Object.keys(live.parts).length === 0
  ) {
    return base
  }
  const removedMessageIDs = new Set(live.removedMessageIDs)
  const changesByMessageID = new Map<string, SubagentConversationLiveProjection["parts"][string][]>()
  for (const change of Object.values(live.parts)) {
    const changes = changesByMessageID.get(change.messageID) ?? []
    changes.push(change)
    changesByMessageID.set(change.messageID, changes)
  }
  const projectParts = (messageID: string, persistedParts: any[]) => {
    const changes = changesByMessageID.get(messageID) ?? []
    const parts = [...persistedParts]
    for (const change of changes) {
      const index = parts.findIndex((part) => String(part?.id || "") === change.partID)
      if (change.removed) {
        if (index >= 0) parts.splice(index, 1)
        continue
      }
      const persisted = index >= 0 ? parts[index] : undefined
      const source = change.snapshot ?? persisted
      if (!source || typeof source !== "object" || Array.isArray(source)) continue
      const next = { ...(persisted && typeof persisted === "object" ? persisted : {}), ...source }
      for (const [field, delta] of Object.entries(change.deltas)) {
        next[field] = projectLivePartField(persisted?.[field], change.anchors[field] ?? "", delta)
      }
      if (index >= 0) parts[index] = next
      else parts.push(next)
    }
    return parts
  }
  const messages = base.messages
    .filter((message) => !removedMessageIDs.has(message.messageID))
    .map((message) => {
      const changes = changesByMessageID.get(message.messageID) ?? []
      if (!live.messageInfos[message.messageID] && changes.length === 0) return message
      return {
        ...message,
        info: live.messageInfos[message.messageID] ?? message.info,
        parts: projectParts(message.messageID, message.parts),
      }
    })
  const persistedMessageIDs = new Set(messages.map((message) => message.messageID))
  for (const [messageID, info] of Object.entries(live.messageInfos)) {
    if (persistedMessageIDs.has(messageID) || removedMessageIDs.has(messageID)) continue
    messages.push(liveMessageFromInfo(base.sessionID, messageID, info, projectParts(messageID, [])))
  }
  messages.sort((left, right) =>
    compareTimelineOrderKeys(left.orderKey, right.orderKey, `subagent conversation ${base.sessionID} live projection`),
  )
  return { ...base, messages }
}

export interface SubagentConversationTarget {
  source: BoardSource
  sessionID: string
  directory: string
  authority: ApiAuthority
}

export function subagentConversationTargetKey(input: SubagentConversationTarget): string {
  return JSON.stringify({
    source: input.source,
    sessionID: input.sessionID.trim(),
    directory: input.directory.trim(),
    authority: input.authority,
  })
}

export const SUBAGENT_TRANSCRIPT_REFRESH_INTERVAL_MS = 120

export interface SubagentTranscriptRefreshController {
  observe(target: string, revision: string, ready?: boolean): void
  dispose(): void
}

/**
 * Convert bursty transcript revisions into bounded refresh work. The first
 * observation for a target belongs to the resource's immediate initial load;
 * later revisions share one timer, one in-flight refresh, and at most one
 * trailing refresh when more revisions arrive during that request.
 */
export function createSubagentTranscriptRefreshController(
  refresh: () => unknown | Promise<unknown>,
  intervalMs = SUBAGENT_TRANSCRIPT_REFRESH_INTERVAL_MS,
): SubagentTranscriptRefreshController {
  let target = ""
  let revision = ""
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight = false
  let pending = false
  let disposed = false

  const clearTimer = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const schedule = () => {
    if (disposed || !target || timer !== undefined || inFlight) return
    const scheduledGeneration = generation
    timer = setTimeout(
      () => {
        timer = undefined
        if (disposed || scheduledGeneration !== generation || !target) return
        inFlight = true
        pending = false
        void Promise.resolve(refresh())
          .catch(() => undefined)
          .finally(() => {
            if (disposed || scheduledGeneration !== generation) return
            inFlight = false
            if (!pending) return
            schedule()
          })
      },
      Math.max(0, intervalMs),
    )
  }

  return {
    observe(nextTarget, nextRevision, ready = true) {
      if (disposed) return
      if (nextTarget !== target) {
        generation += 1
        clearTimer()
        target = nextTarget
        revision = nextRevision
        inFlight = false
        pending = false
        return
      }
      if (!target) return
      if (nextRevision !== revision) {
        revision = nextRevision
        pending = true
      }
      if (!pending || !ready || inFlight) return
      schedule()
    },
    dispose() {
      disposed = true
      generation += 1
      clearTimer()
      target = ""
      revision = ""
      inFlight = false
      pending = false
    },
  }
}

/** Exact selected-session transcript revision.
 *
 * The full transcript remains owned by the backend route. This bounded key
 * follows only canonical facts that can change that selected Session's
 * rendered transcript; broad Conversation-tree versions and TODO-only progress
 * must never become network request identity. */
export function subagentConversationTranscriptRevision(
  record: Pick<AgentActivityRecord, "sessionID" | "transcriptSequence">,
): string {
  return JSON.stringify([record.sessionID, Math.max(0, Number(record.transcriptSequence || 0))])
}

function messageSource(info: Record<string, any>): string {
  const extra = info.extra && typeof info.extra === "object" ? info.extra : {}
  return String(info.originSource || info.source || extra.source || "")
}

function delegatedContextMessage(message: SubagentTranscriptMessage): boolean {
  return isDelegatedContextMessage({
    role: String(message.info.role || ""),
    author: String(message.info.author || ""),
    channel: String(message.info.channel || message.stage),
    source: messageSource(message.info),
  })
}

/** Project one exact child session into the same continuous card surface used
 * by the main conversation. Message boundaries remain inside the card; the
 * Dock never fragments one session into an unrelated stack of cards. */
export function projectSubagentConversationCard(
  conversation: SubagentConversationTranscript,
  status: CardNode["status"] = "completed",
): CardNode | null {
  const messages = conversation.messages.filter(conversationMessageHasDisplayContent)
  const first = messages[0]
  if (!first) return null
  const last = messages.at(-1) ?? first
  const errorReason = messages
    .map((message) => assistantMessageErrorReason(message.info))
    .filter(Boolean)
    .at(-1)
  const parts: any[] = []
  for (const [index, message] of messages.entries()) {
    if (index > 0) {
      parts.push({
        type: "boundary",
        messageID: message.messageID,
        role: message.stage,
        roleLabel: roleLabel(message.stage),
        time: message.time,
      })
    }
    for (const part of orderedMessageParts({ parts: message.parts.filter(isCardBodyMessagePart) })) {
      parts.push({
        ...part,
        messageID: String(part.messageID || message.messageID),
        sessionID: String(part.sessionID || message.sessionID),
      })
    }
  }
  return {
    id: `subagent-transcript:${conversation.sessionID}`,
    kind: "agent",
    sessionID: conversation.sessionID,
    agentID: last.agentID,
    messageID: first.messageID,
    stage: last.stage,
    role: last.stage,
    status: errorReason ? "error" : status,
    errorReason,
    title: last.agentID,
    parts,
    childIDs: [],
    collapsedContextMessageIDs: messages.filter(delegatedContextMessage).map((message) => message.messageID),
    orderKey: first.orderKey,
    time: first.time,
  }
}

function requireObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, any>
}

function requireArray(value: unknown, label: string): any[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function subagentConversationPath(input: {
  source: BoardSource
  sessionID: string
  directory: string
  afterSequence?: number
  afterLiveEpoch?: number
}): string {
  const params = new URLSearchParams({ directory: input.directory })
  if (input.source.kind === "task") {
    if (input.afterSequence !== undefined) {
      params.set("after_live_sequence", String(Math.max(0, input.afterSequence)))
      params.set("after_live_epoch", String(Math.max(0, Number(input.afterLiveEpoch || 0))))
    }
    return `task/${encodeURIComponent(input.source.id)}/conversation/session/${encodeURIComponent(input.sessionID)}?${params.toString()}`
  }
  params.set("tail_limit", "2000")
  return `session/${encodeURIComponent(input.sessionID)}/conversation?${params.toString()}`
}

export async function loadSubagentConversation(input: {
  authority?: ApiAuthority
  source: BoardSource
  sessionID: string
  directory: string
  afterSequence?: number
  afterLiveEpoch?: number
  signal?: AbortSignal
}): Promise<SubagentConversationTranscript> {
  const authority = input.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const sessionID = String(input.sessionID || "").trim()
  const directory = String(input.directory || "").trim()
  if (!sessionID) throw new Error("subagent conversation requires a sessionID")
  if (!directory) throw new Error(`subagent conversation ${sessionID} requires a project directory`)
  const payload = requireObject(
    await apiJson(subagentConversationPath({ ...input, sessionID, directory }), { signal: input.signal, authority }),
    `subagent conversation ${sessionID}`,
  )
  return parseSubagentConversation({ ...input, sessionID, directory, authority }, payload)
}

/** Shared hydration parser for HTTP reads and the ordered Session connection snapshot. */
export function parseSubagentConversation(
  input: SubagentConversationTarget,
  payload: Record<string, any>,
): SubagentConversationTranscript {
  const { sessionID } = input
  const transcript = requireArray(payload.transcript, `subagent conversation ${sessionID} transcript`)
  const view = requireObject(payload.view, `subagent conversation ${sessionID} view`)
  const viewMessages = requireArray(view.messages, `subagent conversation ${sessionID} view.messages`)
  const transcriptByMessageID = new Map<string, any>()
  for (const item of transcript) {
    const message = requireObject(item, `subagent conversation ${sessionID} transcript message`)
    const info = requireObject(message.info, `subagent conversation ${sessionID} message.info`)
    const messageID = String(info.id || "")
    if (!messageID) throw new Error(`subagent conversation ${sessionID} transcript message missing id`)
    if (transcriptByMessageID.has(messageID)) {
      throw new Error(`subagent conversation ${sessionID} contains duplicate message ${messageID}`)
    }
    transcriptByMessageID.set(messageID, message)
  }

  const membership = new Map<string, { sessionID: string }>()
  for (const raw of requireArray(view.sessions, `subagent conversation ${sessionID} view.sessions`)) {
    const session = requireObject(raw, `subagent conversation ${sessionID} session`)
    if (!session.sessionID || !session.agentID)
      throw new Error(`subagent conversation ${sessionID} session has incomplete identity`)
    for (const id of requireArray(session.messageIDs, `subagent conversation ${sessionID} session.messageIDs`)) {
      if (typeof id !== "string" || !id || membership.has(id))
        throw new Error(`subagent conversation ${sessionID} invalid message membership ${id}`)
      membership.set(id, { sessionID: String(session.sessionID) })
    }
  }
  const messages: SubagentTranscriptMessage[] = []
  for (const [messageID, message] of transcriptByMessageID) {
    const owner = membership.get(messageID)
    if (!owner || owner.sessionID !== String(message.info.sessionID || ""))
      throw new Error(`subagent conversation ${sessionID} message ${messageID} session identity drift`)
    if (!String(message.info.sessionAgentID || "").trim())
      throw new Error(`subagent conversation ${sessionID} message ${messageID} missing session actor identity`)
    const parts = requireArray(message.parts, `subagent conversation ${sessionID} message ${messageID} parts`)
    for (const part of parts) {
      if (!part?.id || part.messageID !== messageID || part.sessionID !== owner.sessionID)
        throw new Error(`subagent conversation ${sessionID} message ${messageID} Part owner drift`)
      requireTimelineOrderKeyDomain(part.orderKey, `subagent conversation Part ${part.id}`, "part")
    }
    if (owner.sessionID === sessionID) messages.push(liveMessageFromInfo(sessionID, messageID, message.info, parts))
  }
  for (const messageID of membership.keys())
    if (!transcriptByMessageID.has(messageID))
      throw new Error(`subagent conversation ${sessionID} missing transcript message ${messageID}`)
  const visibleIDs = new Set<string>()
  for (const raw of viewMessages) {
    const meta = requireObject(raw, `subagent conversation ${sessionID} view message`)
    const messageID = String(meta.messageID || "")
    if (visibleIDs.has(messageID))
      throw new Error(`subagent conversation ${sessionID} duplicate view message ${messageID}`)
    visibleIDs.add(messageID)
    const original = transcriptByMessageID.get(messageID)
    if (!original) throw new Error(`subagent conversation ${sessionID} missing transcript message ${messageID}`)
    const actual = liveMessageFromInfo(String(original.info.sessionID || ""), messageID, original.info, original.parts)
    if (
      meta.sessionID !== actual.sessionID ||
      meta.sessionAgentID !== String(original.info.sessionAgentID) ||
      meta.agentID !== actual.agentID ||
      meta.stage !== actual.stage ||
      meta.time !== actual.time ||
      meta.orderKey !== actual.orderKey ||
      (String(meta.parentSessionID || "") || undefined) !== actual.parentSessionID
    )
      throw new Error(`subagent conversation ${sessionID} message ${messageID} view identity drift`)
  }
  messages.sort((left, right) =>
    compareTimelineOrderKeys(left.orderKey, right.orderKey, `subagent conversation ${sessionID}`),
  )
  const lastLiveSequence = Math.max(0, Number(payload.lastLiveSequence || 0))
  const liveEpoch = input.source.kind === "task" ? Math.max(0, Number(payload.liveEpoch || 0)) : 0
  const transcriptMode = input.source.kind === "task" ? String(payload.transcriptMode || "") : "snapshot"
  if (transcriptMode !== "snapshot" && transcriptMode !== "delta") {
    throw new Error(`subagent conversation ${sessionID} transcriptMode must be snapshot or delta`)
  }
  const removedMessageIDs = requireArray(
    payload.removedMessageIDs ?? [],
    `subagent conversation ${sessionID} removedMessageIDs`,
  )
    .map((value) => String(value || ""))
    .filter(Boolean)
  return {
    targetKey: subagentConversationTargetKey({
      source: input.source,
      sessionID,
      directory: input.directory,
      authority: input.authority,
    }),
    sessionID,
    messages,
    lastLiveSequence,
    liveEpoch,
    transcriptMode,
    removedMessageIDs,
  }
}

export function mergeSubagentConversation(
  current: SubagentConversationTranscript,
  delta: SubagentConversationTranscript,
): SubagentConversationTranscript {
  if (current.targetKey !== delta.targetKey) return delta
  if (
    delta.transcriptMode === "snapshot" ||
    current.liveEpoch !== delta.liveEpoch ||
    delta.lastLiveSequence < current.lastLiveSequence
  ) {
    return { ...delta, removedMessageIDs: [] }
  }
  const merged = new Map(current.messages.map((message) => [message.messageID, message]))
  for (const messageID of delta.removedMessageIDs) merged.delete(messageID)
  for (const message of delta.messages) merged.set(message.messageID, message)
  const messages = [...merged.values()].sort((left, right) =>
    compareTimelineOrderKeys(left.orderKey, right.orderKey, `subagent conversation ${current.sessionID}`),
  )
  return {
    targetKey: current.targetKey,
    sessionID: current.sessionID,
    messages,
    lastLiveSequence: delta.lastLiveSequence,
    liveEpoch: delta.liveEpoch,
    transcriptMode: "delta",
    removedMessageIDs: [],
  }
}
