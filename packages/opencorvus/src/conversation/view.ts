import { compareTimelineOrderKeys, timelineMessageOrderKey, timelineOrderKey } from "@/timeline/order"
import {
  CONVERSATION_AGENT_ACTIVITY_LIMIT,
  conversationMessageDisplayStage,
  isConversationDisplayMessagePartType,
  parseConversationInteractiveArtifactMessagePart,
  projectConversationAgentActivityPart,
  type ConversationAgentActivityItem,
} from "@opencorvus-ai/transport-protocol"
import { AgentRoleContract } from "@/agent/role-contract"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { isMissionCallerReceiptParticipant } from "@/mission/caller-participant"
import type { Todo } from "@/session/todo"
import type { TodoStore } from "@/session/todo-store"

export interface ConversationSessionView {
  executionID?: string
  inputMessageID?: string
  sessionID: string
  agentID: string
  orderKey: string
  stage: string
  parentSessionID?: string
  messageIDs: string[]
  lastDisplayMessageID?: string
  firstMessageTime: number
  lastMessageTime: number
  firstObservedAt?: number
  lastObservedAt?: number
  status?: "pending" | "running" | "idle" | "completed" | "error" | "skipped"
  activity: ConversationAgentActivityItem[]
  todos: Todo.Info[]
  todoUpdatedAt: number
  errorReason?: string
  inputPreview?: {
    text: string
    messageID: string
    observedAt: number
    source: "user_message"
  }
  placement: "top_level"
}

export interface ConversationMessageView {
  messageID: string
  inputMessageID: string
  orderKey: string
  sessionID: string
  /** Canonical execution-session owner Agent Identifier (ID). */
  sessionAgentID: string
  /** Truthful participant Agent Identifier (ID) for this exact message. */
  agentID: string
  stage: string
  parentSessionID?: string
  time: number
  placement: ConversationSessionView["placement"]
}

export interface ConversationView {
  topLevelSessionIDs: string[]
  sessions: ConversationSessionView[]
  messages: ConversationMessageView[]
}

export interface ConversationAgentView {
  topLevelExecutionIDs: string[]
  sessions: ConversationSessionView[]
  messages: ConversationMessageView[]
}

export interface ConversationAgentSessionLedgerEntry {
  sessionID: string
  agentID: string
  orderKey: string
  stage: string
  parentSessionID?: string
  timeCreated: number
  timeUpdated: number
  latestStatus?: {
    type: string
    reason?: string
    error?: string
  }
  latestStatusEmittedAt?: number
}

interface ConversationLifecycleEvent {
  type?: string
  emittedAt?: number
  timestamp?: number
  payload?: Record<string, unknown>
  properties?: Record<string, unknown>
}

interface ConversationPreparedExecution {
  inputMessageID: string
  sessionID: string
  agent: string
  kind: string
  preparedAt?: number
}

export function executionProjectionLifecycleEvents(projection: {
  occurrences: Array<{
    inputMessageID: string
    sessionID: string
    agent: string
    kind: string
    events: Array<{ eventID: string; sequence: number; status: unknown; emittedAt: number }>
  }>
}): ConversationLifecycleEvent[] {
  return projection.occurrences.flatMap((occurrence) =>
    occurrence.events.map((event) => ({
      type: "agent.execution.lifecycle",
      emittedAt: event.emittedAt,
      payload: {
        eventID: event.eventID,
        sequence: event.sequence,
        sessionID: occurrence.sessionID,
        inputMessageID: occurrence.inputMessageID,
        agentID: occurrence.agent,
        kind: occurrence.kind,
        status: event.status,
      },
    })),
  )
}

export function conversationTranscriptMessageOrder(left: any, right: any): number {
  return compareTimelineOrderKeys(timelineMessageOrderKey(left), timelineMessageOrderKey(right))
}

function stageFromMessageInfo(info: any): string {
  if (typeof info?.originSource !== "string") {
    throw new Error(`projectConversationView: message ${String(info?.id || "<unknown>")} missing info.originSource`)
  }
  return conversationMessageDisplayStage({
    role: String(info?.role || ""),
    author: String(info?.author || ""),
    channel: String(info?.channel || ""),
    source: info.originSource,
  })
}

function agentIDFromMessageInfo(info: any): string {
  const agentID = String(info?.agentID || "").trim()
  if (!agentID)
    throw new Error(`projectConversationView: message ${String(info?.id || "<unknown>")} missing info.agentID`)
  return agentID
}

function conversationLedgerAgentID(ledger: ConversationAgentSessionLedgerEntry, participantAgentID: string): string {
  const ledgerAgentID = String(ledger.agentID || "").trim()
  if (ledger.stage === "assistant" && ledgerAgentID === "assistant" && AgentRoleContract.isRoleID(participantAgentID)) {
    const participant = AgentRoleContract.get(participantAgentID)
    if (participant.controlSurface === "primary" && participant.sessionKind === null) return participantAgentID
  }
  return ledgerAgentID
}

function placementOf(): ConversationSessionView["placement"] {
  return "top_level"
}

function stageFromLedgerStage(stage: unknown): string {
  const value = String(stage || "").trim()
  if (!value) throw new Error("projectConversationAgentView: ledger session missing stage")
  if (value === "filtered") throw new Error("projectConversationAgentView: retired hidden session stage is invalid")
  if (value === "root") return "user"
  return value
}

function shouldIncludeAgentStage(stage: string): boolean {
  return stage !== "user" && stage !== "system"
}

function statusFromLifecycleStatus(status: unknown): NonNullable<ConversationSessionView["status"]> {
  const value =
    status && typeof status === "object" && !Array.isArray(status) ? (status as Record<string, unknown>) : {}
  const type = String(value.type || "")
  if (type === "streaming" || type === "retry") return "running"
  if (type === "idle") return "idle"
  if (type === "terminal") {
    const reason = String(value.reason || "")
    if (reason === "error") return "error"
    if (reason === "completed" || reason === "coordinated") return "completed"
    if (reason === "aborted") return "skipped"
  }
  throw new Error(`projectConversationAgentView: unknown lifecycle status ${JSON.stringify(status)}`)
}

function lifecyclePayload(event: ConversationLifecycleEvent): Record<string, unknown> {
  if (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)) return event.payload
  throw new Error(`projectConversationAgentView: lifecycle event ${event.type || "<missing>"} missing payload`)
}

function lifecycleObservedAt(event: ConversationLifecycleEvent): number {
  if (typeof event.emittedAt === "number" && event.emittedAt > 0) return event.emittedAt
  throw new Error(`projectConversationAgentView: lifecycle event ${event.type || "<missing>"} missing emittedAt`)
}

function applyLifecycleSession(
  bySession: Map<string, ConversationSessionView>,
  event: ConversationLifecycleEvent,
): void {
  if (event.type !== "agent.execution.lifecycle") return
  const payload = lifecyclePayload(event)
  const sessionID = String(payload.sessionID || "")
  if (!sessionID) throw new Error("projectConversationAgentView: execution lifecycle missing sessionID")
  const existing = bySession.get(sessionID)
  if (!existing) return
  const stage = existing.stage
  if (!shouldIncludeAgentStage(stage)) return
  const observedAt = lifecycleObservedAt(event)
  const parentSessionID = String(payload.parentSessionID || existing.parentSessionID || "")
  const status = statusFromLifecycleStatus(payload.status)
  existing.firstObservedAt = Math.min(existing.firstObservedAt ?? existing.firstMessageTime, observedAt)
  existing.lastObservedAt = Math.max(existing.lastObservedAt ?? existing.lastMessageTime, observedAt)
  existing.status = status
  const lifecycleStatus =
    payload.status && typeof payload.status === "object" && !Array.isArray(payload.status)
      ? (payload.status as Record<string, unknown>)
      : {}
  const errorReason = String(lifecycleStatus.error || "").trim()
  if (errorReason) existing.errorReason = errorReason
  if (!existing.parentSessionID && parentSessionID) existing.parentSessionID = parentSessionID
}

function applyLedgerSession(
  bySession: Map<string, ConversationSessionView>,
  ledger: ConversationAgentSessionLedgerEntry,
): void {
  const sessionID = String(ledger?.sessionID || "")
  if (!sessionID) throw new Error("projectConversationAgentView: ledger session missing sessionID")
  const stage = stageFromLedgerStage(ledger.stage)
  const agentID = String(ledger.agentID || "").trim()
  if (!agentID) throw new Error(`projectConversationAgentView: ledger session ${sessionID} missing agentID`)
  if (!shouldIncludeAgentStage(stage)) return
  const observedAt = Number(ledger.timeCreated || 0)
  if (!(observedAt > 0))
    throw new Error(`projectConversationAgentView: ledger session ${sessionID} missing timeCreated`)
  if (typeof ledger.orderKey !== "string" || !ledger.orderKey) {
    throw new Error(`projectConversationAgentView: ledger session ${sessionID} missing orderKey`)
  }
  const lastObservedAt = Math.max(observedAt, Number(ledger.timeUpdated || 0))
  const parentSessionID = String(ledger.parentSessionID || "")
  const placement = placementOf()
  const existing = bySession.get(sessionID)
  if (!existing) {
    const created: ConversationSessionView = {
      sessionID,
      agentID,
      orderKey: ledger.orderKey,
      stage,
      parentSessionID: parentSessionID || undefined,
      messageIDs: [],
      firstMessageTime: observedAt,
      lastMessageTime: lastObservedAt,
      firstObservedAt: observedAt,
      lastObservedAt,
      status: "pending",
      activity: [],
      todos: [],
      todoUpdatedAt: 0,
      placement,
    }
    applyLedgerLatestStatus(created, ledger)
    bySession.set(sessionID, created)
    return
  }
  existing.firstObservedAt = Math.min(existing.firstObservedAt ?? existing.firstMessageTime, observedAt)
  existing.lastObservedAt = Math.max(existing.lastObservedAt ?? existing.lastMessageTime, lastObservedAt)
  existing.status = existing.status || "pending"
  if (!existing.parentSessionID && parentSessionID) existing.parentSessionID = parentSessionID
  applyLedgerLatestStatus(existing, ledger)
}

function applyLedgerLatestStatus(session: ConversationSessionView, ledger: ConversationAgentSessionLedgerEntry): void {
  if (!ledger.latestStatus) {
    if (ledger.latestStatusEmittedAt != null) {
      throw new Error(`projectConversationAgentView: ledger session ${ledger.sessionID} status missing payload`)
    }
    return
  }
  const observedAt = Number(ledger.latestStatusEmittedAt || 0)
  if (!(observedAt > 0)) {
    throw new Error(`projectConversationAgentView: ledger session ${ledger.sessionID} status missing emitted time`)
  }
  session.status = statusFromLifecycleStatus(ledger.latestStatus)
  const errorReason = String(ledger.latestStatus.error || "").trim()
  if (errorReason) session.errorReason = errorReason
  session.firstObservedAt = Math.min(session.firstObservedAt ?? session.firstMessageTime, observedAt)
  session.lastObservedAt = Math.max(session.lastObservedAt ?? session.lastMessageTime, observedAt)
}

export function conversationPartHasDisplay(part: any): boolean {
  const type = String(part?.type || "")
  if (!type || !isConversationDisplayMessagePartType(type)) return false
  if (type === "interactive-artifact") {
    parseConversationInteractiveArtifactMessagePart(part)
    return true
  }
  if (type === "reasoning") return !!String(part?.text || "").replace(/[\[\]\s]/g, "")
  if (type === "text") {
    return !!String(part?.text || "").trim()
  }
  return true
}

export function conversationMessageHasDisplay(message: any): boolean {
  if (String(message?.info?.role || "") === "assistant" && message?.info?.error) return true
  return Array.isArray(message?.parts) && message.parts.some(conversationPartHasDisplay)
}

function userMessageInputPreview(message: any): ConversationSessionView["inputPreview"] | undefined {
  if (String(message?.info?.role || "") !== "user") return undefined
  const messageID = String(message?.info?.id || "")
  const observedAt = Number(message?.info?.time?.created || 0)
  const text = (Array.isArray(message?.parts) ? message.parts : [])
    .filter((part: any) => part?.type === "text")
    .map((part: any) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
  return text ? { text, messageID, observedAt, source: "user_message" } : undefined
}

export function projectConversationView(
  input: {
    transcript: any[]
    ledgerSessions?: ConversationAgentSessionLedgerEntry[]
  },
): ConversationView {
  const { transcript, ledgerSessions = [] } = input
  const sorted = [...(Array.isArray(transcript) ? transcript : [])].sort(conversationTranscriptMessageOrder)
  const ledgerBySession = new Map<string, ConversationAgentSessionLedgerEntry>()
  for (const ledger of ledgerSessions) {
    // Root/system rows are control-plane sessions, not callable agent
    // invocations. Their persisted agentID names the session kind and must
    // not overwrite the truthful participant projected from root messages.
    if (ledger?.stage === "root" || ledger?.stage === "system") continue
    const sessionID = String(ledger?.sessionID || "")
    const agentID = String(ledger?.agentID || "").trim()
    if (!sessionID || !agentID) continue
    const existing = ledgerBySession.get(sessionID)
    if (existing && existing.agentID !== agentID) {
      throw new Error(
        `projectConversationView: ledger session ${sessionID} agentID drift: ${existing.agentID} -> ${agentID}`,
      )
    }
    ledgerBySession.set(sessionID, ledger)
  }

  const bySession = new Map<string, ConversationSessionView>()
  const messages: ConversationMessageView[] = []
  for (const message of sorted) {
    const info = message?.info
    const messageID = String(info?.id || "")
    const sessionID = String(info?.sessionID || "")
    const created = Number(info?.time?.created)
    if (!messageID || !sessionID) {
      throw new Error("projectConversationView: transcript message missing id/sessionID")
    }
    if (!(created > 0)) {
      throw new Error(`projectConversationView: message ${messageID} missing info.time.created`)
    }
    const role = String(info?.role || "").trim()
    if (!role) throw new Error(`projectConversationView: message ${messageID} missing info.role`)
    const author = String(info?.author || "").trim()
    if (!author) throw new Error(`projectConversationView: message ${messageID} missing info.author`)
    const stage = stageFromMessageInfo(info)
    const agentID = agentIDFromMessageInfo(info)
    if (role !== "user" && author !== agentID) {
      throw new Error(
        `projectConversationView: message ${messageID} author ${author} does not match agentID ${agentID}`,
      )
    }
    const helperParticipant = HelperAgentRegistry.isID(agentID)
    const missionCallerReceiptParticipant = isMissionCallerReceiptParticipant(info?.participantEvidence, {
      participantAgentID: agentID,
      ownerSessionID: sessionID,
      ownerAgentID: String(info?.sessionAgentID || "").trim(),
      messageID,
      parentMessageID: String(info?.parentID || "").trim(),
    })
    if (info?.participantEvidence !== undefined && !missionCallerReceiptParticipant) {
      throw new Error(`projectConversationView: message ${messageID} has invalid participant evidence`)
    }
    const ledger = ledgerBySession.get(sessionID)
    const ledgerAgentID = ledger ? conversationLedgerAgentID(ledger, agentID) : undefined
    const persistedSessionAgentID = String(info?.sessionAgentID || "").trim()
    const evidencedSessionAgentID = missionCallerReceiptParticipant ? persistedSessionAgentID : ""
    if (missionCallerReceiptParticipant && !evidencedSessionAgentID) {
      throw new Error(`projectConversationView: message ${messageID} missing evidenced sessionAgentID`)
    }
    const messageSessionAgentID = persistedSessionAgentID || agentID
    if (messageSessionAgentID !== agentID && !helperParticipant && !missionCallerReceiptParticipant) {
      throw new Error(
        `projectConversationView: message ${messageID} owner ${messageSessionAgentID} does not match participant ${agentID}`,
      )
    }
    const parentSessionID = String(info?.parentSessionID || "")
    const occurrenceInputMessageID = role === "user" ? messageID : String(info?.parentID || "").trim()
    if (!occurrenceInputMessageID) {
      throw new Error(`projectConversationView: message ${messageID} missing execution input message identity`)
    }
    const displayMessageID = conversationMessageHasDisplay(message) ? messageID : ""
    const inputPreview = displayMessageID ? userMessageInputPreview(message) : undefined
    const placement = placementOf()
    if (displayMessageID) {
      const orderKey = timelineMessageOrderKey(message)
      messages.push({
        messageID,
        inputMessageID: occurrenceInputMessageID,
        orderKey,
        sessionID,
        sessionAgentID: messageSessionAgentID,
        agentID,
        stage,
        parentSessionID: parentSessionID || undefined,
        time: created,
        placement,
      })
    }
    const existing = bySession.get(sessionID)
    if (existing) {
      existing.agentID = ledgerAgentID || messageSessionAgentID
      existing.stage = ledger ? stageFromLedgerStage(ledger.stage) : stage
      existing.messageIDs.push(messageID)
      if (displayMessageID) existing.lastDisplayMessageID = displayMessageID
      if (inputPreview) existing.inputPreview = inputPreview
      existing.lastMessageTime = created
      if (!existing.parentSessionID && parentSessionID) existing.parentSessionID = parentSessionID
      continue
    }
    const sessionAgentID = ledgerAgentID || messageSessionAgentID
    bySession.set(sessionID, {
      sessionID,
      agentID: sessionAgentID,
      orderKey: timelineOrderKey({
        domain: "session",
        time: created,
        id: sessionID,
      }),
      stage: ledger ? stageFromLedgerStage(ledger.stage) : stage,
      parentSessionID: parentSessionID || undefined,
      messageIDs: [messageID],
      lastDisplayMessageID: displayMessageID || undefined,
      firstMessageTime: created,
      lastMessageTime: created,
      firstObservedAt: created,
      lastObservedAt: created,
      activity: [],
      todos: [],
      todoUpdatedAt: 0,
      ...(inputPreview ? { inputPreview } : {}),
      placement,
    })
  }
  const sessions = [...bySession.values()].sort((left, right) => {
    return compareTimelineOrderKeys(left.orderKey, right.orderKey)
  })
  const topLevelSessionIDs = sessions
    .filter((session) => session.placement === "top_level" && session.messageIDs.length > 0)
    .map((session) => session.sessionID)

  return {
    topLevelSessionIDs,
    sessions,
    messages,
  }
}

export function projectConversationAgentView(
  transcript: any[],
  lifecycleEvents: ConversationLifecycleEvent[] = [],
  ledgerSessions: ConversationAgentSessionLedgerEntry[] = [],
  persistedActivityByExecution: ReadonlyMap<string, ConversationAgentActivityItem[]> = new Map(),
  todoSnapshotsBySession: ReadonlyMap<string, TodoStore.Snapshot> = new Map(),
  preparedExecutions: ConversationPreparedExecution[] = [],
): ConversationAgentView {
  const view = projectConversationView({ transcript, ledgerSessions })
  const bySession = new Map<string, ConversationSessionView>()
  const projectedSessions = new Map(view.sessions.map((session) => [session.sessionID, session]))
  for (const session of ledgerSessions) {
    const projected = projectedSessions.get(session.sessionID)
    const agentID = projected ? conversationLedgerAgentID(session, projected.agentID) : session.agentID
    applyLedgerSession(bySession, agentID === session.agentID ? session : { ...session, agentID })
  }
  for (const session of view.sessions) {
    const existing = bySession.get(session.sessionID)
    if (!existing) continue
    if (existing.agentID !== session.agentID) {
      throw new Error(
        `projectConversationAgentView: session ${session.sessionID} agentID drift: ${existing.agentID} -> ${session.agentID}`,
      )
    }
    existing.messageIDs = session.messageIDs
    existing.lastDisplayMessageID = session.lastDisplayMessageID
    existing.firstMessageTime = Math.min(existing.firstMessageTime, session.firstMessageTime)
    existing.lastMessageTime = Math.max(existing.lastMessageTime, session.lastMessageTime)
    existing.firstObservedAt = Math.min(existing.firstObservedAt ?? existing.firstMessageTime, session.firstMessageTime)
    existing.lastObservedAt = Math.max(existing.lastObservedAt ?? existing.lastMessageTime, session.lastMessageTime)
    if (
      session.inputPreview &&
      (!existing.inputPreview || session.inputPreview.observedAt >= existing.inputPreview.observedAt)
    ) {
      existing.inputPreview = session.inputPreview
    }
    if (!existing.parentSessionID && session.parentSessionID) existing.parentSessionID = session.parentSessionID
  }
  const sessionStatusEvents = [...lifecycleEvents]
    .filter((event) => event.type === "agent.execution.lifecycle")
    .sort((left, right) => {
      const time = lifecycleObservedAt(left) - lifecycleObservedAt(right)
      if (time !== 0) return time
      return Number(lifecyclePayload(left).sequence || 0) - Number(lifecyclePayload(right).sequence || 0)
    })
  const transcriptByMessageID = new Map(
    (Array.isArray(transcript) ? transcript : []).map((message) => [String(message?.info?.id || ""), message]),
  )
  const executionSessions = new Map<string, ConversationSessionView>()
  const sessionsWithExecutions = new Set<string>()
  const ensureExecution = (input: ConversationPreparedExecution): ConversationSessionView | undefined => {
    const sessionID = String(input.sessionID || "")
    const inputMessageID = String(input.inputMessageID || "")
    const agentID = String(input.agent || "")
    const kind = String(input.kind || "")
    if (!sessionID || !inputMessageID || !agentID || !kind) {
      throw new Error("projectConversationAgentView: prepared execution has incomplete identity")
    }
    const base = bySession.get(sessionID)
    if (!base) return undefined
    sessionsWithExecutions.add(sessionID)
    const existing = executionSessions.get(inputMessageID)
    if (existing) {
      if (existing.sessionID !== sessionID) {
        throw new Error(`projectConversationAgentView: input message ${inputMessageID} belongs to multiple Sessions`)
      }
      if (existing.agentID !== agentID || existing.stage !== kind) {
        throw new Error(`projectConversationAgentView: execution ${inputMessageID} identity changed`)
      }
      return existing
    }
    const inputMessage = transcriptByMessageID.get(inputMessageID)
    const scopedMessageIDs = (Array.isArray(transcript) ? transcript : [])
      .filter(
        (message) =>
          String(message?.info?.sessionID || "") === sessionID &&
          (String(message?.info?.id || "") === inputMessageID ||
            String(message?.info?.parentID || "") === inputMessageID),
      )
      .sort(conversationTranscriptMessageOrder)
      .map((message) => String(message.info.id))
    const observedAt = inputMessage
      ? Number(inputMessage.info?.time?.created || 0)
      : Number(input.preparedAt || base.firstMessageTime || 0)
    const execution: ConversationSessionView = {
      ...base,
      agentID,
      stage: kind,
      executionID: inputMessageID,
      inputMessageID,
      orderKey: inputMessage
        ? timelineMessageOrderKey(inputMessage)
        : timelineOrderKey({ domain: "message", time: observedAt, id: inputMessageID }),
      messageIDs: scopedMessageIDs,
      lastDisplayMessageID: scopedMessageIDs.includes(String(base.lastDisplayMessageID || ""))
        ? base.lastDisplayMessageID
        : scopedMessageIDs.at(-1),
      firstMessageTime: observedAt,
      lastMessageTime: observedAt,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      status: "pending",
      inputPreview: inputMessage ? userMessageInputPreview(inputMessage) : undefined,
      activity: [],
    }
    executionSessions.set(inputMessageID, execution)
    return execution
  }
  for (const prepared of preparedExecutions) ensureExecution(prepared)
  for (const event of sessionStatusEvents) {
    const payload = lifecyclePayload(event)
    const sessionID = String(payload.sessionID || "")
    const inputMessageID = String(payload.inputMessageID || "")
    if (!sessionID || !inputMessageID) {
      throw new Error("projectConversationAgentView: execution lifecycle missing sessionID/inputMessageID")
    }
    const execution = ensureExecution({
      sessionID,
      inputMessageID,
      agent: String(payload.agentID || ""),
      kind: String(payload.kind || ""),
      preparedAt: lifecycleObservedAt(event),
    })
    if (!execution) continue
    applyLifecycleSession(new Map([[sessionID, execution]]), event)
  }
  for (const [sessionID, session] of bySession) {
    if (!sessionsWithExecutions.has(sessionID)) executionSessions.set(`precommit:${sessionID}`, session)
  }
  const transcriptActivityByMessageID = new Map<string, ConversationAgentActivityItem[]>()
  for (const message of Array.isArray(transcript) ? transcript : []) {
    const sessionID = String(message?.info?.sessionID || "")
    if (!sessionID) continue
    const activity = (Array.isArray(message?.parts) ? message.parts : [])
      .map(projectConversationAgentActivityPart)
      .filter((item): item is ConversationAgentActivityItem => !!item)
    if (activity.length === 0) continue
    transcriptActivityByMessageID.set(String(message.info.id), activity)
  }
  const latestExecutionBySession = new Map<string, ConversationSessionView>()
  for (const session of executionSessions.values()) {
    const current = latestExecutionBySession.get(session.sessionID)
    if (!current || compareTimelineOrderKeys(session.orderKey, current.orderKey) > 0) {
      latestExecutionBySession.set(session.sessionID, session)
    }
  }
  for (const session of executionSessions.values()) {
    const exactTranscriptActivity = session.messageIDs.flatMap(
      (messageID) => transcriptActivityByMessageID.get(messageID) ?? [],
    )
    const isLatestExecution = latestExecutionBySession.get(session.sessionID)?.executionID === session.executionID
    const activityExecutionID = session.executionID ?? `precommit:${session.sessionID}`
    const source = persistedActivityByExecution.get(activityExecutionID) ?? exactTranscriptActivity
    const byID = new Map(source.map((item) => [item.id, item]))
    session.activity = [...byID.values()]
      .sort((left, right) => compareTimelineOrderKeys(left.orderKey, right.orderKey))
      .slice(-CONVERSATION_AGENT_ACTIVITY_LIMIT)
    const todoSnapshot = isLatestExecution ? todoSnapshotsBySession.get(session.sessionID) : undefined
    session.todos = todoSnapshot?.todos ?? []
    session.todoUpdatedAt = todoSnapshot?.updatedAt ?? 0
  }
  const sessions = [...executionSessions.values()].sort((left, right) => {
    return compareTimelineOrderKeys(left.orderKey, right.orderKey)
  })
  const sessionIDs = new Set(sessions.map((session) => session.sessionID))
  return {
    topLevelExecutionIDs: sessions
      .filter(
        (session): session is ConversationSessionView & { executionID: string } =>
          session.placement === "top_level" && Boolean(session.executionID),
      )
      .map((session) => session.executionID),
    sessions,
    messages: view.messages.filter((message) => sessionIDs.has(message.sessionID)),
  }
}
