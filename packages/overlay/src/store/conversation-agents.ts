import { createStore } from "solid-js/store"
import { batch } from "solid-js"
import type { AgentActivityRecord, AgentActivityStatus } from "../utils/agent-activity"
import { normalizeAgentRole } from "../utils/message"
import type { BoardSource } from "./board"
import { conversationUserInputTextForMessage, renderedConversationCardTargetForMessage } from "../services/tree-writer"
import {
  compareTimelineOrderKeys,
  requireTimelineOrderKey,
  requireTimelineOrderKeyDomain,
} from "../utils/timeline-order"
import { messagePartHasDisplayContent } from "../utils/message-part"
import {
  CONVERSATION_AGENT_ACTIVITY_LIMIT,
  projectConversationAgentActivityPart,
  type ConversationAgentActivityItem,
} from "@opencorvus-ai/transport-protocol"
import { canonicalTodos, type TodoItem } from "../utils/todos"

export interface ConversationAgentSessionView {
  executionID?: string
  inputMessageID?: string
  sessionID: string
  agentID: string
  orderKey: string
  stage: string
  parentSessionID?: string
  messageIDs?: string[]
  lastDisplayMessageID?: string
  firstMessageTime: number
  lastMessageTime: number
  firstObservedAt?: number
  lastObservedAt?: number
  status?: AgentActivityStatus
  activity: ConversationAgentActivityItem[]
  todos?: TodoItem[]
  todoUpdatedAt?: number
  errorReason?: string
  inputPreview?: AgentActivityRecord["inputPreview"]
  placement?: "top_level"
}

export interface ConversationAgentMessageView {
  messageID: string
  inputMessageID: string
  orderKey: string
  sessionID: string
  sessionAgentID: string
  agentID: string
  stage: string
  parentSessionID?: string
  time: number
  placement?: "top_level"
}

export interface ConversationAgentView {
  topLevelExecutionIDs: string[]
  sessions?: ConversationAgentSessionView[]
  messages?: ConversationAgentMessageView[]
}

export interface ConversationAgentStore {
  taskID: string
  records: AgentActivityRecord[]
}

export const [conversationAgentStore, setConversationAgentStore] = createStore<ConversationAgentStore>({
  taskID: "",
  records: [],
})
function conversationAgentIndexForOccurrence(
  records: readonly AgentActivityRecord[],
  input: { sessionID: string; inputMessageID?: string; messageID?: string },
): number | undefined {
  if (input.inputMessageID) {
    const exact = records.findIndex(
      (record) => record.sessionID === input.sessionID && record.inputMessageID === input.inputMessageID,
    )
    return exact >= 0 ? exact : undefined
  }
  if (input.messageID) {
    const exact = records.findIndex(
      (record) => record.sessionID === input.sessionID && record.messageIDs?.includes(input.messageID!),
    )
    return exact >= 0 ? exact : undefined
  }
  let selected: number | undefined
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!
    if (record.sessionID !== input.sessionID) continue
    if (
      selected === undefined ||
      record.lastObservedAt > records[selected]!.lastObservedAt ||
      (record.lastObservedAt === records[selected]!.lastObservedAt && record.startedAt > records[selected]!.startedAt)
    ) {
      selected = index
    }
  }
  return selected
}

type ConversationAgentTargetRecord = Pick<
  AgentActivityRecord,
  | "sessionID"
  | "parentSessionID"
  | "agentID"
  | "stage"
  | "rawStage"
  | "viewSource"
  | "orderKey"
  | "startedAt"
  | "lastObservedAt"
  | "targetMessageID"
  | "targetObservedAt"
  | "cardID"
  | "renderedCardID"
> & { inputMessageID: string }

const pendingTargetsBySource = new Map<string, Map<string, ConversationAgentTargetRecord>>()
const pendingInputPreviewsBySource = new Map<string, Map<string, NonNullable<AgentActivityRecord["inputPreview"]>>>()
type AgentTodoSnapshot = Pick<AgentActivityRecord, "todos" | "todoUpdatedAt">
const pendingTodosBySource = new Map<string, Map<string, AgentTodoSnapshot>>()

type AgentRenderedTarget = Pick<AgentActivityRecord, "cardID" | "renderedCardID">
type AgentProjectedRecordTarget = {
  orderKey: string
  targetMessageID: string
  target: AgentRenderedTarget
}

export function conversationAgentSourceKey(source: BoardSource | null): string {
  return source ? `${source.kind}:${source.id}` : ""
}

export function conversationAgentRecordsForSource(source: BoardSource | null): AgentActivityRecord[] {
  const key = conversationAgentSourceKey(source)
  return key && conversationAgentStore.taskID === key
    ? conversationAgentStore.records.map(recordWithCurrentProjection)
    : []
}

export function conversationAgentRecordForSourceSession(
  source: BoardSource | null,
  sessionID: string,
): AgentActivityRecord | undefined {
  const key = conversationAgentSourceKey(source)
  if (!key || conversationAgentStore.taskID !== key) return undefined
  const index = conversationAgentIndexForOccurrence(conversationAgentStore.records, { sessionID })
  const record = index === undefined ? undefined : conversationAgentStore.records[index]
  return record ? recordWithCurrentProjection(record) : undefined
}

function agentRenderedTargetFromProjection(target: { cardID?: string; renderedCardID: string }): AgentRenderedTarget {
  return {
    ...(target.cardID ? { cardID: target.cardID } : {}),
    renderedCardID: target.renderedCardID,
  }
}

function renderedTargetForMessage(message: ConversationAgentMessageView): AgentRenderedTarget | null {
  const messageID = String(message?.messageID || "")
  if (!messageID) return null
  const orderKey = requireTimelineOrderKeyDomain(
    message?.orderKey,
    `conversation agent message ${messageID}`,
    "message",
  )
  const target = renderedConversationCardTargetForMessage(messageID)
  if (!target) return null
  if (target.orderKey !== orderKey) {
    throw new Error(`conversation agent message ${messageID} orderKey drift between rail view and tree-writer target`)
  }
  return agentRenderedTargetFromProjection(target)
}

function sessionDisplayMessageID(session: ConversationAgentSessionView): string {
  const explicit = String(session?.lastDisplayMessageID || "")
  if (explicit) return explicit
  const messageIDs = Array.isArray(session?.messageIDs) ? session.messageIDs : []
  const lastMessageID = messageIDs.at(-1)
  return typeof lastMessageID === "string" ? lastMessageID : ""
}

function renderedTargetForSession(session: ConversationAgentSessionView, stage: string): AgentRenderedTarget | null {
  const messageID = sessionDisplayMessageID(session)
  if (!messageID) return null
  if (!stage) return null
  const target = renderedConversationCardTargetForMessage(messageID)
  return target ? agentRenderedTargetFromProjection(target) : null
}

function agentRecordFromSession(session: ConversationAgentSessionView): AgentActivityRecord | null {
  const executionID = String(session?.executionID || session?.inputMessageID || session?.sessionID || "")
  const sessionID = String(session?.sessionID || "")
  const rawStage = String(session?.stage || "")
  const agentID = String(session?.agentID || "")
  const stage = normalizeAgentRole(rawStage)
  const startedAt = Number(session?.firstObservedAt ?? session?.firstMessageTime ?? 0)
  const orderKey = requireTimelineOrderKey(session?.orderKey, `conversation agent session ${sessionID}`)
  if (!sessionID) throw new Error("conversation agent session missing sessionID")
  if (!stage) throw new Error(`conversation agent session ${sessionID} missing stage`)
  if (rawStage === "filtered") {
    throw new Error(`conversation agent session ${sessionID} uses the retired hidden stage`)
  }
  if (stage === "user") return null
  if (!agentID) throw new Error(`conversation agent session ${sessionID} missing agentID`)
  if (!(startedAt > 0)) throw new Error(`conversation agent session ${sessionID} missing positive observed time`)
  const target = renderedTargetForSession(session, stage)
  const lastDisplayMessageID = sessionDisplayMessageID(session)
  const targetMessageID = lastDisplayMessageID
  const targetObservedAt = targetMessageID ? Math.max(0, Number(session?.lastMessageTime ?? 0)) : 0
  const lastObservedAt = Math.max(startedAt, Number(session?.lastObservedAt ?? session?.lastMessageTime ?? 0))
  const status = session.status || "pending"
  const inputPreviewText = String(session?.inputPreview?.text || "").trim()
  const terminal = status === "completed" || status === "error" || status === "skipped"
  const todos =
    session.todos === undefined ? [] : requireTodoList(session.todos, `conversation agent session ${sessionID}`)
  const todoUpdatedAt = session.todoUpdatedAt === undefined ? 0 : Number(session.todoUpdatedAt)
  if (!Number.isInteger(todoUpdatedAt) || todoUpdatedAt < 0) {
    throw new Error(`conversation agent session ${sessionID} has invalid todoUpdatedAt`)
  }
  return {
    id: executionID,
    inputMessageID: String(session?.inputMessageID || "") || undefined,
    messageIDs: Array.isArray(session?.messageIDs) ? [...session.messageIDs] : [],
    sessionID,
    parentSessionID: String(session?.parentSessionID || ""),
    agentID: agentID,
    stage,
    rawStage,
    viewSource: "hydrate",
    status,
    activity: Array.isArray(session.activity) ? session.activity : [],
    todos,
    todoUpdatedAt,
    errorReason: String(session.errorReason || "").trim() || undefined,
    orderKey,
    startedAt,
    lastObservedAt,
    ...(terminal ? { completedAt: lastObservedAt } : {}),
    attempts: 1,
    depth: 0,
    targetMessageID,
    ...(targetObservedAt > 0 ? { targetObservedAt } : {}),
    ...(inputPreviewText && session.inputPreview
      ? {
          inputPreview: {
            text: inputPreviewText,
            messageID: session.inputPreview.messageID,
            observedAt: session.inputPreview.observedAt,
            source: "user_message",
          },
        }
      : {}),
    ...(target ? { ...target } : {}),
  }
}

function projectedTargetForRecord(record: {
  sessionID: string
  targetMessageID?: string
}): AgentProjectedRecordTarget | null {
  const targetMessageID = String(record.targetMessageID || "")
  if (targetMessageID) {
    const target = renderedConversationCardTargetForMessage(targetMessageID)
    if (target) {
      return {
        orderKey: target.orderKey,
        targetMessageID,
        target: agentRenderedTargetFromProjection(target),
      }
    }
  }
  return null
}

function requireProjectedTargetForRecord(
  record: {
    sessionID: string
    targetMessageID?: string
  },
  label: string,
): AgentProjectedRecordTarget {
  const projected = projectedTargetForRecord(record)
  if (!projected) throw new Error(`${label} has no current tree-writer projection`)
  return projected
}

function clearRecordTarget(record: AgentActivityRecord): AgentActivityRecord {
  const { cardID: _cardID, renderedCardID: _renderedCardID, targetObservedAt: _targetObservedAt, ...rest } = record
  return {
    ...rest,
    targetMessageID: "",
  }
}

function clearRecordRenderedProjection(record: AgentActivityRecord): AgentActivityRecord {
  const { cardID: _cardID, renderedCardID: _renderedCardID, ...rest } = record
  return { ...rest }
}

function canonicalTargetObservedAt(
  record: Pick<AgentActivityRecord, "targetMessageID" | "targetObservedAt" | "lastObservedAt">,
): number {
  if (!String(record.targetMessageID || "")) return 0
  const explicit = Number(record.targetObservedAt || 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const fallback = Number(record.lastObservedAt || 0)
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
}

function recordWithCurrentProjection(record: AgentActivityRecord): AgentActivityRecord {
  const projected = projectedTargetForRecord(record)
  if (!projected) {
    return record.targetMessageID || record.cardID || record.renderedCardID ? clearRecordTarget(record) : record
  }
  const targetMessageID = String(projected.targetMessageID || record.targetMessageID || "")
  const targetObservedAt = targetMessageID ? canonicalTargetObservedAt(record) : 0
  if (
    record.targetMessageID === targetMessageID &&
    Number(record.targetObservedAt || 0) === targetObservedAt &&
    record.cardID === projected.target.cardID &&
    record.renderedCardID === projected.target.renderedCardID
  ) {
    return record
  }
  return {
    ...record,
    targetMessageID,
    ...(targetObservedAt > 0 ? { targetObservedAt } : {}),
    cardID: projected.target.cardID,
    renderedCardID: projected.target.renderedCardID,
  }
}

function recordWithCurrentProjectionPreservingCanonicalTarget(record: AgentActivityRecord): AgentActivityRecord {
  const projected = projectedTargetForRecord(record)
  if (!projected) {
    return record.targetMessageID || record.cardID || record.renderedCardID
      ? clearRecordRenderedProjection(record)
      : record
  }
  const targetMessageID = String(projected.targetMessageID || record.targetMessageID || "")
  const targetObservedAt = targetMessageID ? canonicalTargetObservedAt(record) : 0
  return {
    ...record,
    targetMessageID,
    ...(targetObservedAt > 0 ? { targetObservedAt } : {}),
    cardID: projected.target.cardID,
    renderedCardID: projected.target.renderedCardID,
  }
}

function mergeTargetIntoRecord(
  existing: AgentActivityRecord,
  target: ConversationAgentTargetRecord,
): AgentActivityRecord {
  if (existing.agentID !== target.agentID) {
    throw new Error(
      `conversation agent session ${existing.sessionID} agentID drift: ${existing.agentID} -> ${target.agentID}`,
    )
  }
  const incomingProjection = requireProjectedTargetForRecord(target, `conversation agent target ${target.sessionID}`)
  const existingProjection = projectedTargetForRecord(existing)
  const replaceTarget =
    !existingProjection ||
    compareTimelineOrderKeys(
      incomingProjection.orderKey,
      existingProjection.orderKey,
      `conversation agent target ${existing.sessionID}`,
    ) >= 0
  const existingOrderKey = requireTimelineOrderKey(existing.orderKey, `conversation agent record ${existing.sessionID}`)
  const incomingOrderKey = requireTimelineOrderKey(
    incomingProjection.orderKey,
    `conversation agent target ${target.sessionID} projection`,
  )
  return {
    ...existing,
    orderKey:
      compareTimelineOrderKeys(incomingOrderKey, existingOrderKey, "conversation agent merge") < 0
        ? incomingOrderKey
        : existingOrderKey,
    startedAt: Math.min(existing.startedAt, target.startedAt),
    lastObservedAt: Math.max(existing.lastObservedAt, target.lastObservedAt),
    parentSessionID: target.parentSessionID || existing.parentSessionID,
    agentID: existing.agentID,
    stage: target.stage || existing.stage,
    rawStage: target.rawStage || existing.rawStage,
    viewSource: target.viewSource || existing.viewSource,
    ...(replaceTarget
      ? {
          targetMessageID: incomingProjection.targetMessageID || target.targetMessageID || "",
          ...(incomingProjection.targetMessageID && (target.targetObservedAt || 0) > 0
            ? { targetObservedAt: target.targetObservedAt }
            : {}),
          cardID: incomingProjection.target.cardID,
          renderedCardID: incomingProjection.target.renderedCardID,
        }
      : existingProjection
        ? {
            targetMessageID: existingProjection.targetMessageID || existing.targetMessageID || "",
            ...(existingProjection.targetMessageID && canonicalTargetObservedAt(existing) > 0
              ? { targetObservedAt: canonicalTargetObservedAt(existing) }
              : {}),
            cardID: existingProjection.target.cardID,
            renderedCardID: existingProjection.target.renderedCardID,
          }
        : {}),
  }
}

function mergeConversationAgentActivity(
  left: ConversationAgentActivityItem[],
  right: ConversationAgentActivityItem[],
): ConversationAgentActivityItem[] {
  const byID = new Map<string, ConversationAgentActivityItem>()
  for (const item of [...left, ...right]) byID.set(item.id, item)
  return [...byID.values()]
    .sort((first, second) => compareTimelineOrderKeys(first.orderKey, second.orderKey, "conversation agent activity"))
    .slice(-CONVERSATION_AGENT_ACTIVITY_LIMIT)
}

function applyConversationAgentActivityToStore(
  sourceKey: string,
  sessionID: string,
  activity: ConversationAgentActivityItem,
  observedAt: number,
  messageID?: string,
): void {
  if (conversationAgentStore.taskID !== sourceKey) return
  const index = conversationAgentIndexForOccurrence(conversationAgentStore.records, {
    sessionID,
    messageID,
  })
  if (index === undefined) {
    throw new Error(`conversation agent activity ${activity.id} missing canonical session ${sessionID}`)
  }
  setConversationAgentStore("records", index, (record) => ({
    ...record,
    status: record.status === "pending" || record.status === "idle" ? "running" : record.status,
    lastObservedAt: Math.max(record.lastObservedAt, observedAt),
    activity: mergeConversationAgentActivity(record.activity, [activity]),
  }))
}

function upsertLiveConversationAgentIdentity(
  sourceKey: string,
  input: {
    inputMessageID: string
    messageID: string
    sessionID: string
    parentSessionID: string
    agentID: string
    stage: string
    rawStage: string
    orderKey: string
    observedAt: number
  },
): void {
  if (conversationAgentStore.taskID !== sourceKey) return
  const currentRecords = conversationAgentStore.records
  const index = conversationAgentIndexForOccurrence(currentRecords, {
    sessionID: input.sessionID,
    inputMessageID: input.inputMessageID,
  })
  const pendingTodos = takePendingTodos(sourceKey, input.sessionID)
  if (index === undefined) {
    const nextRecords = [...currentRecords]
    nextRecords.push({
      id: input.inputMessageID,
      inputMessageID: input.inputMessageID,
      messageIDs: [...new Set([input.inputMessageID, input.messageID])],
      sessionID: input.sessionID,
      parentSessionID: input.parentSessionID,
      agentID: input.agentID,
      stage: input.stage,
      rawStage: input.rawStage,
      viewSource: "live",
      status: "running",
      orderKey: input.orderKey,
      startedAt: input.observedAt,
      lastObservedAt: input.observedAt,
      attempts: 1,
      depth: 0,
      activity: [],
      ...(pendingTodos ?? { todos: [], todoUpdatedAt: 0 }),
      targetMessageID: "",
    })
    setConversationAgentStore({
      taskID: sourceKey,
      records: applyDepth(sortAgentRecords(nextRecords)),
    })
    return
  }
  const existing = currentRecords[index]!
  if (existing.agentID !== input.agentID) {
    throw new Error(
      `conversation agent session ${input.sessionID} agentID drift: ${existing.agentID} -> ${input.agentID}`,
    )
  }
  const updated: AgentActivityRecord = {
    ...existing,
    messageIDs: [...new Set([...(existing.messageIDs ?? []), input.inputMessageID, input.messageID])],
    ...(pendingTodos
      ? newerTodoSnapshot({ todos: existing.todos, todoUpdatedAt: existing.todoUpdatedAt }, pendingTodos)
      : {}),
    parentSessionID: input.parentSessionID || existing.parentSessionID,
    stage: input.stage,
    rawStage: input.rawStage,
    viewSource: "live",
    orderKey:
      compareTimelineOrderKeys(existing.orderKey, input.orderKey, "conversation agent live identity") <= 0
        ? existing.orderKey
        : input.orderKey,
    startedAt: Math.min(existing.startedAt, input.observedAt),
    lastObservedAt: Math.max(existing.lastObservedAt, input.observedAt),
    status:
      existing.status === "completed" || existing.status === "error" || existing.status === "skipped"
        ? existing.status
        : "running",
  }
  if (updated.orderKey === existing.orderKey && updated.parentSessionID === existing.parentSessionID) {
    setConversationAgentStore("records", index, updated)
    return
  }
  const nextRecords = [...currentRecords]
  nextRecords[index] = updated
  setConversationAgentStore({
    taskID: sourceKey,
    records: applyDepth(sortAgentRecords(nextRecords)),
  })
}

function sortAgentRecords(records: AgentActivityRecord[]): AgentActivityRecord[] {
  return records.sort((left, right) =>
    compareTimelineOrderKeys(left.orderKey, right.orderKey, "conversation agent record"),
  )
}

function pendingTargetsForSource(sourceKey: string): Map<string, ConversationAgentTargetRecord> {
  const existing = pendingTargetsBySource.get(sourceKey)
  if (existing) return existing
  const created = new Map<string, ConversationAgentTargetRecord>()
  pendingTargetsBySource.set(sourceKey, created)
  return created
}

function pendingInputPreviewsForSource(
  sourceKey: string,
): Map<string, NonNullable<AgentActivityRecord["inputPreview"]>> {
  const existing = pendingInputPreviewsBySource.get(sourceKey)
  if (existing) return existing
  const created = new Map<string, NonNullable<AgentActivityRecord["inputPreview"]>>()
  pendingInputPreviewsBySource.set(sourceKey, created)
  return created
}

function requireTodoList(value: unknown, label: string): TodoItem[] {
  if (!Array.isArray(value)) throw new Error(`${label} missing todos`)
  const todos = canonicalTodos(value)
  if (!todos) throw new Error(`${label} has invalid todos`)
  return todos
}

function newerTodoSnapshot(left: AgentTodoSnapshot, right: AgentTodoSnapshot): AgentTodoSnapshot {
  return right.todoUpdatedAt >= left.todoUpdatedAt ? right : left
}

function rememberPendingTodos(sourceKey: string, sessionID: string, snapshot: AgentTodoSnapshot): void {
  const pending = pendingTodosBySource.get(sourceKey) ?? new Map<string, AgentTodoSnapshot>()
  pending.set(sessionID, pending.has(sessionID) ? newerTodoSnapshot(pending.get(sessionID)!, snapshot) : snapshot)
  pendingTodosBySource.set(sourceKey, pending)
}

function takePendingTodos(sourceKey: string, sessionID: string): AgentTodoSnapshot | undefined {
  const pending = pendingTodosBySource.get(sourceKey)
  const snapshot = pending?.get(sessionID)
  if (!snapshot) return undefined
  pending!.delete(sessionID)
  if (pending!.size === 0) pendingTodosBySource.delete(sourceKey)
  return snapshot
}

function newerInputPreview(
  left: AgentActivityRecord["inputPreview"],
  right: AgentActivityRecord["inputPreview"],
): AgentActivityRecord["inputPreview"] {
  if (!left) return right
  if (!right) return left
  return right.observedAt >= left.observedAt ? right : left
}

function rememberInputPreview(
  sourceKey: string,
  inputMessageID: string,
  preview: NonNullable<AgentActivityRecord["inputPreview"]>,
): void {
  const pending = pendingInputPreviewsForSource(sourceKey)
  pending.set(inputMessageID, newerInputPreview(pending.get(inputMessageID), preview)!)
}

function takePendingInputPreview(sourceKey: string, inputMessageID: string): AgentActivityRecord["inputPreview"] {
  const pending = pendingInputPreviewsBySource.get(sourceKey)
  const preview = pending?.get(inputMessageID)
  if (!preview) return undefined
  pending!.delete(inputMessageID)
  if (pending!.size === 0) pendingInputPreviewsBySource.delete(sourceKey)
  return preview
}

function rememberPendingTarget(sourceKey: string, target: ConversationAgentTargetRecord): void {
  const pending = pendingTargetsForSource(sourceKey)
  const existing = pending.get(target.inputMessageID)
  if (
    !existing ||
    compareTimelineOrderKeys(
      target.orderKey,
      existing.orderKey,
      `conversation agent pending target ${target.sessionID}`,
    ) >= 0
  ) {
    pending.set(target.inputMessageID, target)
  }
}

function forgetPendingTargets(sourceKey: string, inputMessageIDs: Set<string>): void {
  const pending = pendingTargetsBySource.get(sourceKey)
  if (!pending) return
  for (const inputMessageID of inputMessageIDs) pending.delete(inputMessageID)
  if (pending.size === 0) pendingTargetsBySource.delete(sourceKey)
}

function pendingTargetsForCurrentRecords(
  sourceKey: string,
  records: AgentActivityRecord[],
): ConversationAgentTargetRecord[] {
  const pending = pendingTargetsBySource.get(sourceKey)
  if (!pending) return []
  const inputMessageIDs = new Set(records.map((record) => record.inputMessageID || record.id))
  const current: ConversationAgentTargetRecord[] = []
  for (const target of pending.values()) {
    if (!inputMessageIDs.has(target.inputMessageID)) continue
    if (!projectedTargetForRecord(target)) {
      pending.delete(target.inputMessageID)
      continue
    }
    current.push(target)
  }
  if (pending.size === 0) pendingTargetsBySource.delete(sourceKey)
  return current
}

function applyTargetRecordsToStore(sourceKey: string, targets: ConversationAgentTargetRecord[]): void {
  if (conversationAgentStore.taskID !== sourceKey) {
    for (const target of targets) rememberPendingTarget(sourceKey, target)
    return
  }
  const currentRecords = conversationAgentStore.records
  const nextRecords = [...currentRecords]
  const attachedInputMessageIDs = new Set<string>()
  let structureChanged = false
  for (const target of targets) {
    const index = conversationAgentIndexForOccurrence(nextRecords, {
      sessionID: target.sessionID,
      inputMessageID: target.inputMessageID,
      messageID: target.targetMessageID,
    })
    if (index === undefined) continue
    const existing = nextRecords[index]!
    const updated = mergeTargetIntoRecord(existing, target)
    structureChanged ||= updated.orderKey !== existing.orderKey || updated.parentSessionID !== existing.parentSessionID
    nextRecords[index] = updated
    attachedInputMessageIDs.add(target.inputMessageID)
  }
  for (const target of targets) {
    if (!attachedInputMessageIDs.has(target.inputMessageID)) rememberPendingTarget(sourceKey, target)
  }
  forgetPendingTargets(sourceKey, attachedInputMessageIDs)
  if (structureChanged) {
    setConversationAgentStore({
      taskID: sourceKey,
      records: applyDepth(sortAgentRecords(nextRecords)),
    })
    return
  }
  for (let index = 0; index < nextRecords.length; index += 1) {
    if (nextRecords[index] === currentRecords[index]) continue
    setConversationAgentStore("records", index, nextRecords[index]!)
  }
}

function agentTargetRecordsFromMessages(messages: ConversationAgentMessageView[]): ConversationAgentTargetRecord[] {
  const byOccurrence = new Map<string, ConversationAgentTargetRecord>()
  for (const message of messages) {
    const sessionID = String(message?.sessionID || "")
    const inputMessageID = String(message?.inputMessageID || "")
    const sessionAgentID = String(message?.sessionAgentID || "")
    const participantAgentID = String(message?.agentID || "")
    if (!inputMessageID) {
      throw new Error(`conversation agent message ${String(message?.messageID || "<unknown>")} missing inputMessageID`)
    }
    if (!sessionAgentID) {
      throw new Error(`conversation agent message ${String(message?.messageID || "<unknown>")} missing sessionAgentID`)
    }
    if (!participantAgentID) {
      throw new Error(`conversation agent message ${String(message?.messageID || "<unknown>")} missing agentID`)
    }
    const rawStage = String(message?.stage || "")
    const stage = normalizeAgentRole(rawStage)
    const observedAt = Number(message?.time || 0)
    const orderKey = requireTimelineOrderKeyDomain(
      message?.orderKey,
      `conversation agent message ${message?.messageID || ""}`,
      "message",
    )
    if (rawStage === "filtered") {
      throw new Error(
        `conversation agent message ${String(message?.messageID || "<unknown>")} uses the retired hidden stage`,
      )
    }
    if (!sessionID || !stage || stage === "user" || !(observedAt > 0)) {
      continue
    }
    const target = renderedTargetForMessage(message)
    if (!target) continue
    const existing = byOccurrence.get(inputMessageID)
    if (!existing) {
      byOccurrence.set(inputMessageID, {
        inputMessageID,
        sessionID,
        parentSessionID: String(message?.parentSessionID || ""),
        agentID: sessionAgentID,
        stage,
        rawStage,
        orderKey,
        startedAt: observedAt,
        lastObservedAt: observedAt,
        targetMessageID: String(message.messageID || ""),
        targetObservedAt: observedAt,
        ...target,
      })
      continue
    }
    if (existing.agentID !== sessionAgentID) {
      throw new Error(`conversation agent session ${sessionID} agentID drift: ${existing.agentID} -> ${sessionAgentID}`)
    }
    const isLatestTarget =
      compareTimelineOrderKeys(orderKey, existing.orderKey, "conversation agent message target") >= 0
    existing.startedAt = Math.min(existing.startedAt, observedAt)
    existing.lastObservedAt = Math.max(existing.lastObservedAt, observedAt)
    if (isLatestTarget) {
      existing.orderKey = orderKey
      existing.stage = stage
      existing.rawStage = rawStage
      existing.parentSessionID = String(message?.parentSessionID || existing.parentSessionID || "")
      existing.targetMessageID = String(message.messageID || "")
      existing.targetObservedAt = observedAt
      existing.cardID = target.cardID
      existing.renderedCardID = target.renderedCardID
    }
  }
  return [...byOccurrence.values()]
}

function applyDepth(records: AgentActivityRecord[]): AgentActivityRecord[] {
  const byID = new Map(records.map((record) => [record.sessionID, record]))
  const visiting = new Set<string>()
  const memo = new Map<string, number>()
  const depthOf = (sessionID: string): number => {
    if (memo.has(sessionID)) return memo.get(sessionID)!
    if (visiting.has(sessionID)) return 0
    visiting.add(sessionID)
    const parent = byID.get(sessionID)?.parentSessionID || ""
    const depth = parent && byID.has(parent) ? depthOf(parent) + 1 : 0
    visiting.delete(sessionID)
    memo.set(sessionID, depth)
    return depth
  }
  return records.map((record) => ({ ...record, depth: depthOf(record.sessionID) }))
}

function statusRank(status: AgentActivityStatus): number {
  const rank: Record<AgentActivityStatus, number> = {
    pending: 0,
    idle: 1,
    skipped: 2,
    running: 3,
    completed: 4,
    error: 5,
  }
  return rank[status]
}

function statusKeepsCompletedAt(status: AgentActivityStatus): boolean {
  return status === "completed" || status === "error" || status === "skipped" || status === "idle"
}

function existingRecordOwnsLifecycle(existing: AgentActivityRecord, hydrated: AgentActivityRecord): boolean {
  if (existing.lastObservedAt !== hydrated.lastObservedAt) {
    return existing.lastObservedAt > hydrated.lastObservedAt
  }
  return statusRank(existing.status) >= statusRank(hydrated.status)
}

function targetRecordFromCurrentRecord(record: AgentActivityRecord): ConversationAgentTargetRecord | null {
  const projected = projectedTargetForRecord(record)
  if (!projected) return null
  return {
    inputMessageID: record.inputMessageID || record.id,
    sessionID: record.sessionID,
    parentSessionID: record.parentSessionID,
    agentID: record.agentID,
    stage: record.stage,
    rawStage: record.rawStage,
    orderKey: projected.orderKey,
    startedAt: record.startedAt,
    lastObservedAt: record.lastObservedAt,
    targetMessageID: projected.targetMessageID,
    targetObservedAt: projected.targetMessageID ? canonicalTargetObservedAt(record) : undefined,
    ...(projected.target.cardID ? { cardID: projected.target.cardID } : {}),
    renderedCardID: projected.target.renderedCardID,
  }
}

function mergeHydratedRecordWithCurrentRecord(
  hydrated: AgentActivityRecord,
  current: AgentActivityRecord,
): AgentActivityRecord {
  const keepCurrentLifecycle = existingRecordOwnsLifecycle(current, hydrated)
  const status = keepCurrentLifecycle ? current.status : hydrated.status
  const todoSnapshot = newerTodoSnapshot(
    { todos: hydrated.todos, todoUpdatedAt: hydrated.todoUpdatedAt },
    { todos: current.todos, todoUpdatedAt: current.todoUpdatedAt },
  )
  let merged: AgentActivityRecord = {
    ...hydrated,
    viewSource: current.viewSource,
    parentSessionID: hydrated.parentSessionID || current.parentSessionID,
    startedAt: Math.min(hydrated.startedAt, current.startedAt),
    lastObservedAt: Math.max(hydrated.lastObservedAt, current.lastObservedAt),
    attempts: Math.max(hydrated.attempts, current.attempts),
    orderKey:
      compareTimelineOrderKeys(current.orderKey, hydrated.orderKey, "conversation agent hydrate merge") < 0
        ? current.orderKey
        : hydrated.orderKey,
    model: hydrated.model || current.model,
    activity: mergeConversationAgentActivity(hydrated.activity, current.activity),
    ...todoSnapshot,
    errorReason:
      status === "error"
        ? keepCurrentLifecycle
          ? current.errorReason || hydrated.errorReason
          : hydrated.errorReason || current.errorReason
        : undefined,
    inputPreview: newerInputPreview(hydrated.inputPreview, current.inputPreview),
    status,
    ...(statusKeepsCompletedAt(status)
      ? {
          completedAt: Math.max(hydrated.completedAt || 0, current.completedAt || 0),
        }
      : {}),
  }
  const currentTarget = targetRecordFromCurrentRecord(current)
  if (currentTarget) merged = mergeTargetIntoRecord(merged, currentTarget)
  const hydratedTargetMessageID = String(hydrated.targetMessageID || "")
  const currentTargetMessageID = String(current.targetMessageID || "")
  const hydratedTargetObservedAt = canonicalTargetObservedAt(hydrated)
  const currentTargetObservedAt = canonicalTargetObservedAt(current)
  if (currentTargetMessageID && (!hydratedTargetMessageID || currentTargetObservedAt > hydratedTargetObservedAt)) {
    merged = {
      ...merged,
      targetMessageID: currentTargetMessageID,
      ...(currentTargetObservedAt > 0 ? { targetObservedAt: currentTargetObservedAt } : {}),
    }
  } else if (hydratedTargetMessageID) {
    merged = {
      ...merged,
      targetMessageID: hydratedTargetMessageID,
      ...(hydratedTargetObservedAt > 0 ? { targetObservedAt: hydratedTargetObservedAt } : {}),
    }
  }
  return recordWithCurrentProjectionPreservingCanonicalTarget(merged)
}

function mergeHydratedRecordsWithCurrentSource(
  sourceKey: string,
  recordsBySession: Map<string, AgentActivityRecord>,
): Map<string, AgentActivityRecord> {
  if (conversationAgentStore.taskID !== sourceKey) return recordsBySession
  const merged = new Map(recordsBySession)
  for (const currentRecord of conversationAgentStore.records.map(
    recordWithCurrentProjectionPreservingCanonicalTarget,
  )) {
    if (currentRecord.viewSource !== "live") continue
    const hydratedRecord = merged.get(currentRecord.id)
    if (!hydratedRecord) {
      merged.set(currentRecord.id, { ...currentRecord })
      continue
    }
    merged.set(currentRecord.id, mergeHydratedRecordWithCurrentRecord(hydratedRecord, currentRecord))
  }
  return merged
}

export function resetConversationAgentView(): void {
  pendingTargetsBySource.clear()
  pendingInputPreviewsBySource.clear()
  pendingTodosBySource.clear()
  setConversationAgentStore({ taskID: "", records: [] })
}

export function clearConversationAgentRenderedTargets(sourceKeyInput?: string): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (sourceKey && conversationAgentStore.taskID !== sourceKey) {
    pendingTargetsBySource.delete(sourceKey)
    return
  }
  if (sourceKey) pendingTargetsBySource.delete(sourceKey)
  else pendingTargetsBySource.clear()
  if (!conversationAgentStore.taskID) return
  setConversationAgentStore({
    taskID: conversationAgentStore.taskID,
    records: applyDepth(sortAgentRecords(conversationAgentStore.records.map(clearRecordRenderedProjection))),
  })
}

export function validateConversationAgentView(
  view: ConversationAgentView,
  options: { rootSessionID?: string } = {},
): void {
  const executionIDs = new Set<string>()
  const records = (Array.isArray(view?.sessions) ? view.sessions : [])
    .map(agentRecordFromSession)
    .filter((candidate): candidate is AgentActivityRecord => !!candidate)
  const recordsBySession = new Map<string, AgentActivityRecord>()
  for (const record of records) {
    if (executionIDs.has(record.id)) {
      throw new Error(`conversation agent hydrate contains duplicate execution ${record.id}`)
    }
    executionIDs.add(record.id)
    recordsBySession.set(record.sessionID, recordsBySession.get(record.sessionID) ?? record)
  }
  const topLevelExecutionIDs = Array.isArray(view?.topLevelExecutionIDs) ? view.topLevelExecutionIDs : undefined
  if (!topLevelExecutionIDs) throw new Error("conversation agent hydrate is missing topLevelExecutionIDs")
  const expectedTopLevelExecutionIDs = (Array.isArray(view?.sessions) ? view.sessions : [])
    .filter((session) => session?.placement === "top_level" && Boolean(session?.executionID))
    .map((session) => String(session.executionID))
  if (
    topLevelExecutionIDs.length !== expectedTopLevelExecutionIDs.length ||
    topLevelExecutionIDs.some((executionID, index) => executionID !== expectedTopLevelExecutionIDs[index])
  ) {
    throw new Error("conversation agent hydrate topLevelExecutionIDs do not match projected executions")
  }
  const rootSessionID = String(options.rootSessionID || "").trim()
  if (rootSessionID) {
    const rootRecord = recordsBySession.get(rootSessionID)
    if (rootRecord && String(rootRecord.parentSessionID || "").trim()) {
      throw new Error(`conversation agent hydrate root session ${rootSessionID} must not have a parent`)
    }
    for (const record of records) {
      const visited = new Set<string>()
      let cursor = record.sessionID
      while (cursor !== rootSessionID) {
        if (visited.has(cursor)) {
          throw new Error(`conversation agent hydrate contains parent cycle at session ${cursor}`)
        }
        visited.add(cursor)
        const current = recordsBySession.get(cursor)
        const parentSessionID = String(current?.parentSessionID || "").trim()
        if (!parentSessionID) {
          throw new Error(
            `conversation agent hydrate session ${record.sessionID} is not anchored to root ${rootSessionID}`,
          )
        }
        cursor = parentSessionID
      }
    }
  }
  agentTargetRecordsFromMessages(Array.isArray(view?.messages) ? view.messages : [])
}

export function hydrateConversationAgentView(
  taskID: string,
  view: ConversationAgentView,
  options: { validated?: boolean } = {},
): void {
  if (!options.validated) validateConversationAgentView(view)
  let recordsBySession = new Map<string, AgentActivityRecord>()
  const sessionRecords = (Array.isArray(view?.sessions) ? view.sessions : [])
    .map(agentRecordFromSession)
    .filter((record): record is AgentActivityRecord => !!record)
  for (const record of sessionRecords) recordsBySession.set(record.id, { ...record })
  for (const [executionID, record] of recordsBySession) {
    const pendingInputPreview = takePendingInputPreview(taskID, record.inputMessageID || record.id)
    if (!pendingInputPreview) continue
    recordsBySession.set(executionID, {
      ...record,
      inputPreview: newerInputPreview(record.inputPreview, pendingInputPreview),
    })
  }
  for (const [executionID, record] of recordsBySession) {
    const newerSameSession = sessionRecords.some(
      (candidate) => candidate.sessionID === record.sessionID && candidate.lastObservedAt > record.lastObservedAt,
    )
    if (newerSameSession) continue
    const sessionID = record.sessionID
    const pendingTodos = takePendingTodos(taskID, sessionID)
    if (!pendingTodos) continue
    recordsBySession.set(executionID, {
      ...record,
      ...newerTodoSnapshot({ todos: record.todos, todoUpdatedAt: record.todoUpdatedAt }, pendingTodos),
    })
  }
  for (const target of agentTargetRecordsFromMessages(Array.isArray(view?.messages) ? view.messages : [])) {
    const existing = [...recordsBySession.values()].find(
      (record) =>
        record.sessionID === target.sessionID &&
        (record.inputMessageID === target.inputMessageID || record.id === target.inputMessageID),
    )
    if (!existing) continue
    recordsBySession.set(existing.id, mergeTargetIntoRecord(existing, target))
  }
  recordsBySession = mergeHydratedRecordsWithCurrentSource(taskID, recordsBySession)
  const sourcePendingTargets = pendingTargetsForCurrentRecords(taskID, [...recordsBySession.values()])
  for (const target of sourcePendingTargets) {
    const existing = [...recordsBySession.values()].find(
      (record) =>
        record.sessionID === target.sessionID &&
        (record.inputMessageID === target.inputMessageID || record.id === target.inputMessageID),
    )
    if (!existing) continue
    recordsBySession.set(existing.id, mergeTargetIntoRecord(existing, target))
  }
  forgetPendingTargets(taskID, new Set(sourcePendingTargets.map((target) => target.inputMessageID)))
  const records = sortAgentRecords([...recordsBySession.values()])
  setConversationAgentStore({
    taskID,
    records: applyDepth(records),
  })
}

export function attachConversationAgentViewTargets(
  sourceKeyInput: string,
  view: { messages?: ConversationAgentMessageView[] },
): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (!sourceKey) throw new Error("conversation agent target attachment requires a source key")
  const targets = agentTargetRecordsFromMessages(Array.isArray(view?.messages) ? view.messages : [])
  applyTargetRecordsToStore(sourceKey, targets)
}

function liveRawStageFromMessageInfo(info: any): string | null {
  const channel = String(info?.channel || "").trim()
  if (!channel) {
    throw new Error(`conversation agent live view: message info is missing channel. info=${JSON.stringify(info)}`)
  }
  if (channel === "filtered") {
    throw new Error("conversation agent live view: retired hidden channel is invalid")
  }
  if (channel === "main") return null
  return normalizeAgentRole(channel) === "user" ? null : channel
}

function liveStageFromMessageInfo(info: any): string | null {
  const rawStage = liveRawStageFromMessageInfo(info)
  return rawStage ? normalizeAgentRole(rawStage) : null
}

function liveEventProperties(event: any): any {
  return event?.properties && typeof event.properties === "object" ? event.properties : event?.payload
}

function liveEventObservedAt(event: any): number {
  const value = Number(event?.emittedAt || event?.emitted_at || event?.timestamp || event?.time?.emitted || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function livePartHasDisplay(part: any): boolean {
  return messagePartHasDisplayContent(part)
}

function liveMessageRecordTarget(
  sessionID: string,
  messageID: string,
): Pick<AgentActivityRecord, "cardID" | "renderedCardID"> | null {
  const target = renderedConversationCardTargetForMessage(messageID)
  void sessionID
  return target ? agentRenderedTargetFromProjection(target) : null
}

export function applyLiveConversationAgentMessageUpdated(sourceKeyInput: string, event: any): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (!sourceKey) throw new Error("conversation agent live view requires a source key")
  const properties = liveEventProperties(event)
  const info = properties?.info
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    throw new Error("conversation agent live view message.updated missing info")
  }
  const messageID = String(info.id || "")
  const sessionID = String(info.sessionID || "")
  if (!messageID || !sessionID) throw new Error("conversation agent live view missing message id/sessionID")
  const rawStage = liveRawStageFromMessageInfo(info)
  if (!rawStage) return
  if (String(info.role || "").trim() === "user") return
  const inputMessageID = String(info.parentID || "").trim()
  if (!inputMessageID) throw new Error(`conversation agent live message ${messageID} missing inputMessageID`)
  const agentID = String(info.agentID || "").trim()
  if (!agentID) throw new Error(`conversation agent live message ${messageID} missing info.agentID`)
  const sessionAgentID = String(info.sessionAgentID || "").trim()
  if (!sessionAgentID) {
    throw new Error(`conversation agent live message ${messageID} missing info.sessionAgentID`)
  }
  const author = String(info.author || "").trim()
  if (author !== agentID) {
    throw new Error(`conversation agent live message ${messageID} author ${author} does not match agentID ${agentID}`)
  }
  const stage = normalizeAgentRole(rawStage)
  const observedAt = Number(info?.time?.created || 0)
  const orderKey = requireTimelineOrderKey(event?.orderKey, `conversation agent live message ${messageID}`)
  if (typeof info?.orderKey === "string" && info.orderKey.length > 0 && info.orderKey !== orderKey) {
    throw new Error(`conversation agent live message ${messageID} orderKey drift between envelope and info`)
  }
  if (!(observedAt > 0)) {
    throw new Error(`conversation agent live view info.time.created must be positive (got ${info?.time?.created})`)
  }
  const parentSessionID = String(info.parentSessionID || "")
  const completedAt = Number(info?.time?.completed || 0)
  const completed = Number.isFinite(completedAt) && completedAt > 0
  batch(() => {
    upsertLiveConversationAgentIdentity(sourceKey, {
      inputMessageID,
      messageID,
      sessionID,
      parentSessionID,
      agentID: sessionAgentID,
      stage,
      rawStage,
      orderKey,
      observedAt,
    })
    const occurrenceIndex = conversationAgentIndexForOccurrence(conversationAgentStore.records, {
      sessionID,
      inputMessageID,
      messageID,
    })
    if (occurrenceIndex !== undefined) {
      setConversationAgentStore("records", occurrenceIndex, "messageIDs", (current) => [
        ...new Set([...(current ?? []), messageID]),
      ])
    }
    const target = liveMessageRecordTarget(sessionID, messageID)
    if (!target) return
    const nextObservedAt = completed ? Math.max(observedAt, completedAt) : observedAt
    applyTargetRecordsToStore(sourceKey, [
      {
        inputMessageID,
        sessionID,
        parentSessionID,
        agentID: sessionAgentID,
        stage,
        rawStage,
        viewSource: "live",
        orderKey,
        startedAt: observedAt,
        lastObservedAt: nextObservedAt,
        targetMessageID: messageID,
        targetObservedAt: observedAt,
        ...target,
      },
    ])
  })
}

export function advanceLiveConversationAgentTranscriptSequence(sourceKeyInput: string, event: any): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  const sequence = Number(event?.liveSequence || event?.live_sequence || event?.sequence || 0)
  if (!sourceKey || !Number.isInteger(sequence) || sequence <= 0) return
  const properties = liveEventProperties(event)
  const info = properties?.info
  const part = properties?.part
  const sessionID = String(
    properties?.sessionID ||
      (info && typeof info === "object" ? info.sessionID : "") ||
      (part && typeof part === "object" ? part.sessionID : "") ||
      "",
  )
  if (!sessionID || conversationAgentStore.taskID !== sourceKey) return
  const messageID = String(
    properties?.messageID ||
      (info && typeof info === "object" ? info.id : "") ||
      (part && typeof part === "object" ? part.messageID : "") ||
      "",
  )
  if (!messageID) return
  const index = conversationAgentIndexForOccurrence(conversationAgentStore.records, { sessionID, messageID })
  if (index === undefined) return
  setConversationAgentStore("records", index, "transcriptSequence", (current) =>
    Math.max(Number(current || 0), sequence),
  )
}

export function applyLiveConversationAgentPartUpdated(sourceKeyInput: string, event: any): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (!sourceKey) throw new Error("conversation agent live view requires a source key")
  const properties = liveEventProperties(event)
  const part = properties?.part
  if (!part || typeof part !== "object" || Array.isArray(part)) return
  if (!livePartHasDisplay(part)) return
  const messageID = String(part.messageID || "")
  const sessionID = String(part.sessionID || "")
  if (!messageID || !sessionID) throw new Error("conversation agent live view part missing messageID/sessionID")
  const channel = typeof properties?.channel === "string" ? properties.channel.trim() : ""
  const resolvedRole = typeof properties?.resolvedRole === "string" ? properties.resolvedRole.trim() : ""
  const author = typeof properties?.author === "string" ? properties.author.trim() : ""
  const role = typeof properties?.role === "string" ? properties.role.trim() : ""
  const agentID = typeof properties?.agentID === "string" ? properties.agentID.trim() : ""
  const sessionAgentID = typeof properties?.sessionAgentID === "string" ? properties.sessionAgentID.trim() : ""
  if (!agentID || !sessionAgentID || !channel || !resolvedRole || !role || !author) {
    throw new Error(
      `conversation agent live view message.part.updated for ${messageID} missing top-level agentID/sessionAgentID/role/author/channel/resolvedRole`,
    )
  }
  const rawStage = liveRawStageFromMessageInfo({ channel, role })
  if (!rawStage) return
  const observedAt = liveEventObservedAt(event)
  if (!(observedAt > 0)) {
    throw new Error("conversation agent live view message.part.updated missing emitted time")
  }
  if (role === "user") {
    const text = conversationUserInputTextForMessage(messageID)
    if (!text) return
    const preview: NonNullable<AgentActivityRecord["inputPreview"]> = {
      text,
      messageID,
      observedAt,
      source: "user_message",
    }
    if (conversationAgentStore.taskID !== sourceKey) {
      rememberInputPreview(sourceKey, messageID, preview)
      return
    }
    const index = conversationAgentIndexForOccurrence(conversationAgentStore.records, {
      sessionID,
      inputMessageID: messageID,
      messageID,
    })
    if (index === undefined) {
      rememberInputPreview(sourceKey, messageID, preview)
      return
    }
    setConversationAgentStore("records", index, "inputPreview", (current) => newerInputPreview(current, preview))
    return
  }
  if (author !== agentID) {
    throw new Error(`conversation agent live part ${messageID} author ${author} does not match agentID ${agentID}`)
  }
  const stage = normalizeAgentRole(rawStage)
  const orderKey = requireTimelineOrderKey(event?.orderKey, `conversation agent live part ${messageID}`)
  const activityOrderKey = requireTimelineOrderKey(
    part.orderKey,
    `conversation agent live activity ${String(part.id || "")}`,
  )
  if (typeof properties?.orderKey === "string" && properties.orderKey.length > 0 && properties.orderKey !== orderKey) {
    throw new Error(`conversation agent live part ${messageID} orderKey drift between envelope and payload`)
  }
  const parentSessionID = String(properties.parentSessionID || "")
  const inputMessageID = String(properties.parentMessageID || "").trim()
  if (!inputMessageID) throw new Error(`conversation agent live part ${messageID} missing inputMessageID`)
  const activity = projectConversationAgentActivityPart({
    ...part,
    orderKey: activityOrderKey,
  })
  batch(() => {
    upsertLiveConversationAgentIdentity(sourceKey, {
      inputMessageID,
      messageID,
      sessionID,
      parentSessionID,
      agentID: sessionAgentID,
      stage,
      rawStage,
      orderKey,
      observedAt,
    })
    const target = liveMessageRecordTarget(sessionID, messageID)
    if (target) {
      applyTargetRecordsToStore(sourceKey, [
        {
          inputMessageID,
          sessionID,
          parentSessionID,
          agentID: sessionAgentID,
          stage,
          rawStage,
          viewSource: "live",
          orderKey,
          startedAt: observedAt,
          lastObservedAt: observedAt,
          targetMessageID: messageID,
          targetObservedAt: observedAt,
          ...target,
        },
      ])
    }
    if (activity) applyConversationAgentActivityToStore(sourceKey, sessionID, activity, observedAt, messageID)
  })
}

export function applyLiveConversationAgentTodoUpdated(sourceKeyInput: string, event: any): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (!sourceKey) throw new Error("conversation agent live TODO view requires a source key")
  const properties = liveEventProperties(event)
  const sessionID = String(properties?.sessionID || "")
  if (!sessionID) throw new Error("conversation agent live todo.updated missing sessionID")
  const todos = requireTodoList(properties?.todos, `conversation agent live todo.updated for ${sessionID}`)
  const updatedAt = Number(properties?.updatedAt)
  if (!Number.isInteger(updatedAt) || updatedAt <= 0) {
    throw new Error("conversation agent live todo.updated missing updatedAt")
  }
  const observedAt = liveEventObservedAt(event)
  if (!(observedAt > 0)) throw new Error("conversation agent live todo.updated missing emitted time")
  const snapshot = { todos, todoUpdatedAt: updatedAt }
  if (conversationAgentStore.taskID !== sourceKey) {
    rememberPendingTodos(sourceKey, sessionID, snapshot)
    return
  }
  const index = conversationAgentIndexForOccurrence(conversationAgentStore.records, { sessionID })
  if (index === undefined) {
    rememberPendingTodos(sourceKey, sessionID, snapshot)
    return
  }
  setConversationAgentStore("records", index, (record) => ({
    ...record,
    viewSource: "live",
    lastObservedAt: Math.max(record.lastObservedAt, observedAt),
    ...newerTodoSnapshot({ todos: record.todos, todoUpdatedAt: record.todoUpdatedAt }, snapshot),
  }))
}

function liveAgentStatusFromSessionStatus(status: any): AgentActivityStatus {
  const type = String(status?.type || "")
  if (type === "streaming" || type === "retry") return "running"
  if (type === "idle") return "idle"
  if (type === "terminal") {
    const reason = String(status?.reason || "")
    if (reason === "error") return "error"
    if (reason === "completed") return "completed"
    if (reason === "coordinated") return "completed"
    if (reason === "aborted") return "skipped"
  }
  throw new Error(`conversation agent live view unknown execution lifecycle: ${JSON.stringify(status)}`)
}

export function applyLiveConversationAgentSessionStatus(sourceKeyInput: string, event: any): void {
  const sourceKey = String(sourceKeyInput || "").trim()
  if (!sourceKey) throw new Error("conversation agent live view requires a source key")
  const properties = liveEventProperties(event)
  const sessionID = String(properties?.sessionID || "")
  if (!sessionID) throw new Error("conversation agent live view execution lifecycle missing sessionID")
  const inputMessageID = String(properties?.inputMessageID || "")
  if (!inputMessageID) throw new Error("conversation agent live view execution lifecycle missing inputMessageID")
  const rawStage = liveRawStageFromMessageInfo(properties)
  if (!rawStage) return
  const agentID = String(properties.agentID || "").trim()
  if (!agentID) throw new Error(`conversation agent live session ${sessionID} missing agentID`)
  const stage = normalizeAgentRole(rawStage)
  const status = liveAgentStatusFromSessionStatus(properties?.status)
  const pendingInputPreview = takePendingInputPreview(sourceKey, inputMessageID)
  const observedAt = liveEventObservedAt(event)
  const orderKey = requireTimelineOrderKeyDomain(
    event?.orderKey,
    `conversation agent live session ${sessionID}`,
    "session",
  )
  if (!(observedAt > 0)) {
    throw new Error("conversation agent live view execution lifecycle missing emitted time")
  }
  const existingRecords = conversationAgentStore.taskID === sourceKey ? conversationAgentStore.records : []
  const index = existingRecords.findIndex((record) => record.id === inputMessageID)
  const terminal = status === "completed" || status === "error" || status === "skipped"
  if (index === -1) {
    const nextRecords = [...existingRecords]
    const created: AgentActivityRecord = {
      id: inputMessageID,
      inputMessageID,
      messageIDs: [inputMessageID],
      sessionID,
      parentSessionID: String(properties.parentSessionID || ""),
      agentID: agentID,
      stage,
      rawStage,
      viewSource: "live",
      status,
      orderKey,
      startedAt: observedAt,
      lastObservedAt: observedAt,
      ...(terminal ? { completedAt: observedAt } : {}),
      attempts: 1,
      depth: 0,
      activity: [],
      ...(takePendingTodos(sourceKey, sessionID) ?? { todos: [], todoUpdatedAt: 0 }),
      errorReason: status === "error" ? String(properties?.status?.error || "").trim() || undefined : undefined,
      targetMessageID: "",
      ...(pendingInputPreview ? { inputPreview: pendingInputPreview } : {}),
    }
    const pendingTarget = pendingTargetsForSource(sourceKey).get(inputMessageID)
    nextRecords.push(pendingTarget ? mergeTargetIntoRecord(created, pendingTarget) : created)
    const records = applyDepth(sortAgentRecords(nextRecords))
    forgetPendingTargets(sourceKey, new Set([inputMessageID]))
    setConversationAgentStore({
      taskID: sourceKey,
      records,
    })
    return
  }
  const existing = recordWithCurrentProjection(existingRecords[index]!)
  const updated = recordWithCurrentProjection({
    ...existing,
    parentSessionID: String(properties.parentSessionID || existing.parentSessionID || ""),
    agentID: agentID,
    stage,
    rawStage,
    viewSource: "live",
    status,
    orderKey:
      existing.orderKey && compareTimelineOrderKeys(existing.orderKey, orderKey, "conversation agent live session") <= 0
        ? existing.orderKey
        : orderKey,
    startedAt: Math.min(existing.startedAt, observedAt),
    lastObservedAt: Math.max(existing.lastObservedAt, observedAt),
    ...(terminal ? { completedAt: Math.max(existing.completedAt || 0, observedAt) } : {}),
    inputPreview: newerInputPreview(existing.inputPreview, pendingInputPreview),
    errorReason:
      status === "error"
        ? String(properties?.status?.error || existing.errorReason || "").trim() || undefined
        : existing.errorReason,
  })
  forgetPendingTargets(sourceKey, new Set([inputMessageID]))
  if (updated.orderKey === existing.orderKey && updated.parentSessionID === existing.parentSessionID) {
    setConversationAgentStore("records", index, updated)
    return
  }
  const nextRecords = [...existingRecords]
  nextRecords[index] = updated
  setConversationAgentStore({
    taskID: sourceKey,
    records: applyDepth(sortAgentRecords(nextRecords)),
  })
}
