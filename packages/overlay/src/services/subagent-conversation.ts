import type { BoardSource } from "../store/board"
import type { CardNode } from "../store/card-tree"
import type { AgentActivityRecord } from "../utils/agent-activity"
import { isDelegatedContextMessage } from "../utils/message-origin"
import { orderedMessageParts, roleLabel } from "../utils/message"
import { compareTimelineOrderKeys, requireTimelineOrderKeyDomain } from "../utils/timeline-order"
import { apiJson } from "./api"
import { formatErrorDetails } from "./diagnostics"

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
  sessionID: string
  messages: SubagentTranscriptMessage[]
  lastLiveSequence: number
  liveEpoch: number
  transcriptMode: "snapshot" | "delta"
  removedMessageIDs: string[]
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
  const messages = conversation.messages
  const first = messages[0]
  if (!first) return null
  const last = messages.at(-1) ?? first
  const errorReason = messages
    .map((message) => message.info.error)
    .filter(Boolean)
    .map(formatErrorDetails)
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
    for (const part of orderedMessageParts({ parts: message.parts })) {
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
  source: BoardSource
  sessionID: string
  directory: string
  afterSequence?: number
  afterLiveEpoch?: number
  signal?: AbortSignal
}): Promise<SubagentConversationTranscript> {
  const sessionID = String(input.sessionID || "").trim()
  const directory = String(input.directory || "").trim()
  if (!sessionID) throw new Error("subagent conversation requires a sessionID")
  if (!directory) throw new Error(`subagent conversation ${sessionID} requires a project directory`)
  const payload = requireObject(
    await apiJson(subagentConversationPath({ ...input, sessionID, directory }), { signal: input.signal }),
    `subagent conversation ${sessionID}`,
  )
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

  const messages = viewMessages.map((raw) => {
    const meta = requireObject(raw, `subagent conversation ${sessionID} view message`)
    const messageID = String(meta.messageID || "")
    const ownerSessionID = String(meta.sessionID || "")
    const agentID = String(meta.agentID || "")
    const stage = String(meta.stage || "")
    const parentSessionID = String(meta.parentSessionID || "") || undefined
    const time = Number(meta.time || 0)
    if (!messageID || !ownerSessionID || !agentID || !stage || !(time > 0)) {
      throw new Error(`subagent conversation ${sessionID} view message has incomplete identity`)
    }
    const orderKey = requireTimelineOrderKeyDomain(
      meta.orderKey,
      `subagent conversation ${sessionID} message ${messageID}`,
      "message",
    )
    const message = transcriptByMessageID.get(messageID)
    if (!message) throw new Error(`subagent conversation ${sessionID} missing transcript message ${messageID}`)
    const info = requireObject(message.info, `subagent conversation ${sessionID} message ${messageID} info`)
    if (String(info.sessionID || "") !== ownerSessionID) {
      throw new Error(`subagent conversation ${sessionID} message ${messageID} session identity drift`)
    }
    return {
      messageID,
      sessionID: ownerSessionID,
      agentID,
      stage,
      parentSessionID,
      time,
      orderKey,
      info,
      parts: requireArray(message.parts, `subagent conversation ${sessionID} message ${messageID} parts`),
    } satisfies SubagentTranscriptMessage
  })
  messages.sort((left, right) =>
    compareTimelineOrderKeys(left.orderKey, right.orderKey, `subagent conversation ${sessionID}`),
  )
  const lastLiveSequence = Math.max(0, Number(payload.lastLiveSequence || 0))
  const liveEpoch =
    input.source.kind === "task"
      ? Math.max(0, Number(payload.liveEpoch || 0))
      : 0
  const transcriptMode =
    input.source.kind === "task"
      ? String(payload.transcriptMode || "")
      : "snapshot"
  if (transcriptMode !== "snapshot" && transcriptMode !== "delta") {
    throw new Error(`subagent conversation ${sessionID} transcriptMode must be snapshot or delta`)
  }
  const removedMessageIDs = requireArray(
    payload.removedMessageIDs ?? [],
    `subagent conversation ${sessionID} removedMessageIDs`,
  ).map((value) => String(value || "")).filter(Boolean)
  return { sessionID, messages, lastLiveSequence, liveEpoch, transcriptMode, removedMessageIDs }
}

export function mergeSubagentConversation(
  current: SubagentConversationTranscript,
  delta: SubagentConversationTranscript,
): SubagentConversationTranscript {
  if (current.sessionID !== delta.sessionID) return delta
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
    sessionID: current.sessionID,
    messages,
    lastLiveSequence: delta.lastLiveSequence,
    liveEpoch: delta.liveEpoch,
    transcriptMode: "delta",
    removedMessageIDs: [],
  }
}
