// ── Tree Writer ──
//
// SSE events → precise writes into cardTreeStore.
// The single mutation entry point: `applyEvent(event)`. No other module
// writes to cardTreeStore.
//
// Design:
//   - Internal bookkeeping maps (plain JS, not reactive) index sessions,
//     goals, interactions, and part positions by stable ids.
//   - Each handler updates the internal index, then writes the affected
//     path(s) of cardTreeStore via `setCardTreeStore(path, value)`.
//   - The CardNode shape stored IS the final renderable tree: `childIDs`
//     is string[] so moving a child between parents is two targeted writes.
//   - Unknown event types throw. No fallback per project rule 1.
//
// Behavioural fixture: for the P0 trace, the tree produced here must match the
// checked-in snapshot byte-for-byte. The equivalence test in
// `test/new-writer-equivalence.test.ts` enforces this.

import { batch, createEffect } from "solid-js"
import { produce } from "solid-js/store"
import {
  cardTreeStore,
  markCardTreeReplaced,
  markCardTreeVisibleChanged as markCardTreeVisibleChangedNow,
  publishCardTreeVisibleNow,
  replaceCardTreeOrder,
  setCardTreeStore,
  type CardNode,
  type CardStatus,
  type CardTerminalReason,
  type SessionTerminalReason,
} from "../store/card-tree"
import {
  flushCardStats as flushCardStatsNow,
  linkChildToParent,
  markCardStatsDirty,
  markCardStatsRemoved,
  unlinkChildFromParent,
} from "../store/card-tree-stats"
import { boardStore, setBoardProjectionHandler, setBoardStore } from "../store/board"
import { agentStageLabel, normalizeAgentRole, roleLabel } from "../utils/message"
import { isBoundaryMessagePart, isCardBodyMessagePart, messagePartHasDisplayContent } from "../utils/message-part"
import { conversationMessageDisplayStage, isDelegatedContextMessage, type MessageOrigin } from "../utils/message-origin"
import { stageAccent } from "../utils/card-color"
import { t } from "../utils/i18n"
import { normalizeToolPartRecord } from "../utils/tool"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { aggregateTurnUsage, type TurnUsageContribution } from "../utils/turn-usage"
import {
  compareTimelineOrderKeys,
  requireTimelineOrderKey,
  requireTimelineOrderKeyDomain,
  timelineOrderKeyTime,
} from "../utils/timeline-order"

/** Raw i18n key for a role/stage, normalized so that backend variants
 *  ("frontend_design", "frontend_design", "frontend-design") all resolve
 *  to the same canonical key (`chat.role.frontend-design`). The key is
 *  stored on the card; CardHeader calls `t()` at render time, keeping
 *  titles reactive to locale switches. */
function roleTitleKey(name: string): string {
  return `chat.role.${normalizeAgentRole(name)}`
}
import { interactionToCardSeeds, partitionInteractions } from "../utils/interaction"
import { isTreeWriterNoopEventType, isTreeWriterPassThroughEventType } from "./event-policy"

// ── Internal indices ──

function finitePositiveNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function usageProjectionFromInfo(info: any): MessageUsageProjection | undefined {
  if (String(info?.role || "") !== "assistant") return undefined
  const tokens = info?.tokens
  const cost = info?.cost
  if (!tokens && typeof cost !== "number") return undefined
  const model = modelProjectionFromInfo(info)
  if (!model) {
    throw new Error(`assistant message ${String(info?.id || "")} usage requires providerID/modelID`)
  }
  const inputTokens = finitePositiveNumber(tokens?.input)
  const outputTokens = finitePositiveNumber(tokens?.output)
  const reasoningTokens = finitePositiveNumber(tokens?.reasoning)
  const cacheReadTokens = finitePositiveNumber(tokens?.cache?.read)
  const cacheWriteTokens = finitePositiveNumber(tokens?.cache?.write)
  const totalTokens =
    finitePositiveNumber(tokens?.total) || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
  const costUSD = Number.isFinite(Number(cost)) ? Number(cost) : 0
  const contextTokens = inputTokens + cacheReadTokens + cacheWriteTokens
  if (inputTokens <= 0 && outputTokens <= 0 && totalTokens <= 0 && costUSD <= 0 && contextTokens <= 0) {
    return undefined
  }
  return {
    ...model,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costUSD,
    contextTokens,
  }
}

function messageInfoIsAssistant(info: any): boolean {
  return String(info?.role || "") === "assistant"
}

function assistantMessageWasAborted(info: any): boolean {
  return messageInfoIsAssistant(info) && String(info?.error?.name || "") === "MessageAbortedError"
}

function assistantMessageErrorReason(info: any): string | undefined {
  if (!messageInfoIsAssistant(info) || !info?.error) return undefined
  const error = info.error
  if (typeof error === "object") {
    const dataMessage = error?.data?.message
    if (typeof dataMessage === "string" && dataMessage.trim()) return dataMessage.trim()
    const message = error?.message
    if (typeof message === "string" && message.trim()) return message.trim()
    const name = error?.name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  throw new Error(`assistant message ${String(info.id || "")} has an error without a displayable reason`)
}

function applyAssistantMessageSettlement(cardID: string, info: any): void {
  if (!messageInfoIsAssistant(info)) return
  const completedAt = Number(info?.time?.completed)
  if (assistantMessageWasAborted(info)) {
    applyProjectedSessionStatus(cardID, {
      cardStatus: "completed",
      terminalReason: "aborted",
      ...(completedAt > 0 ? { timeCompleted: completedAt } : {}),
    })
    return
  }
  const errorReason = assistantMessageErrorReason(info)
  if (errorReason) {
    applyProjectedSessionStatus(cardID, {
      cardStatus: "error",
      terminalReason: "error",
      errorReason,
      ...(completedAt > 0 ? { timeCompleted: completedAt } : {}),
    })
    return
  }
  if (completedAt > 0) {
    applyProjectedSessionStatus(cardID, {
      cardStatus: "completed",
      terminalReason: "completed",
      timeCompleted: completedAt,
    })
  }
}

function modelProjectionFromInfo(info: any): MessageModelProjection | undefined {
  if (!messageInfoIsAssistant(info)) return undefined
  const providerID = typeof info?.providerID === "string" ? info.providerID.trim() : ""
  const modelID = typeof info?.modelID === "string" ? info.modelID.trim() : ""
  if (!providerID || !modelID) return undefined
  return {
    providerID,
    modelID,
    display: `${providerID}/${modelID}`,
  }
}

function projectModelOntoCard(
  session: SessionInfo,
  messageID: string,
  model: MessageModelProjection | undefined,
): void {
  session.messageModels.set(messageID, model)
  const targetCardID = session.messageCardIDs.get(messageID)
  if (!targetCardID) {
    throw new Error(`message ${messageID} missing rendered card projection for model metadata`)
  }
  refreshModelProjectionForCard(targetCardID)
}

function refreshModelProjectionForCard(targetCardID: string): void {
  if (!cardTreeStore.cards[targetCardID]) return
  let sharedModel: MessageModelProjection | undefined
  let distinctModelCount = 0
  const seenModels = new Set<string>()
  for (const ownerSession of sessions.values()) {
    for (const [mid, projected] of ownerSession.messageModels) {
      if (ownerSession.messageCardIDs.get(mid) !== targetCardID) continue
      if (!projected) continue
      const key = `${projected.providerID}\u0000${projected.modelID}`
      if (seenModels.has(key)) continue
      seenModels.add(key)
      distinctModelCount += 1
      sharedModel = projected
    }
  }
  setCardTreeStore("cards", targetCardID, "model", distinctModelCount === 1 ? sharedModel : undefined)
}

function projectUsageOntoCard(session: SessionInfo, messageID: string, usage: MessageUsageProjection): void {
  session.messageUsage.set(messageID, usage)
  const targetCardID = session.messageCardIDs.get(messageID)
  if (!targetCardID) {
    throw new Error(`message ${messageID} missing rendered card projection for usage metadata`)
  }
  refreshUsageProjectionForCard(targetCardID)
}

function refreshUsageProjectionForCard(targetCardID: string): void {
  if (!cardTreeStore.cards[targetCardID]) return
  let latestContext = 0
  let latestContextTime = Number.NEGATIVE_INFINITY
  const contributions: TurnUsageContribution[] = []
  for (const ownerSession of sessions.values()) {
    for (const [mid, u] of ownerSession.messageUsage) {
      if (ownerSession.messageCardIDs.get(mid) !== targetCardID) continue
      const time = messages.get(mid)?.time ?? 0
      contributions.push({
        messageID: mid,
        observedAt: time,
        providerID: u.providerID,
        modelID: u.modelID,
        display: u.display,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        reasoningTokens: u.reasoningTokens,
        cacheReadTokens: u.cacheReadTokens,
        cacheWriteTokens: u.cacheWriteTokens,
        totalTokens: u.totalTokens,
        costUSD: u.costUSD,
      })
      if (u.contextTokens > 0 && time >= latestContextTime) {
        latestContext = u.contextTokens
        latestContextTime = time
      }
    }
  }
  setCardTreeStore(
    "cards",
    targetCardID,
    "usage",
    contributions.length > 0 ? aggregateTurnUsage(contributions) : undefined,
  )
  if (latestContext > 0) {
    setCardTreeStore("cards", targetCardID, "contextTokens", latestContext)
    setCardTreeStore("cards", targetCardID, "contextTokensEstimated", false)
  } else {
    setCardTreeStore("cards", targetCardID, "contextTokens", undefined)
    setCardTreeStore("cards", targetCardID, "contextTokensEstimated", undefined)
  }
  markCardStatsDirty(targetCardID)
}

function refreshMetadataProjectionForCard(cardID: string): void {
  refreshUsageProjectionForCard(cardID)
  refreshModelProjectionForCard(cardID)
}

/** A part's exact display target: which card owns it and at which index in
 *  that card's `parts` array. Carrying the cardID (not just the index) is
 *  mandatory — a long-lived session has many turn cards, and a late delta
 *  for an older message must land on the card that owns the original part,
 *  not on whatever turn is currently active (spec §3.3 / §11.1). */
interface PartTarget {
  cardID: string
  index: number
}

interface SessionInfo {
  sessionID: string
  agentID?: string
  stage: string
  parentSessionID: string
  /** ids of messages that landed in this session's bucket, preserved to derive status. */
  messageIDs: Set<string>
  /** messageID → the ordinary display card that owns that message. */
  messageCardIDs: Map<string, string>
  /** Exact execution occurrence input message → the card owned by that
   * occurrence. This is independent from the card that renders the input
   * user message itself. */
  occurrenceCardIDs: Map<string, string>
  occurrenceIdentities: Map<string, { agentID: string; stage: string }>
  activeOccurrenceInputMessageID?: string
  activeOccurrenceOrderKey?: string
  /** The message turn currently receiving session-level events
   *  (agent.execution.lifecycle / session.error). The newest `message.updated` for
   *  this session sets it. */
  activeMessageID?: string
  /** Display card for `activeMessageID`. Session lifecycle events
   *  mutate THIS card only — older turn cards are frozen history. */
  activeCardID?: string
  /** Per-message cumulative usage observed for assistant messages in
   *  this session. A segment card can own multiple adjacent messages, so the
   *  projection records per-message totals and writes the sum onto the
   *  resolved owner card. */
  messageUsage: Map<string, MessageUsageProjection>
  /** Per-message actual model observed from assistant Message info. A
   *  multi-message owner displays a card-level model only when all
   *  model-bearing messages agree. */
  messageModels: Map<string, MessageModelProjection | undefined>
  /** part id → its exact {cardID,index} target — O(1) lookup for updates. */
  partIndex: Map<string, PartTarget>
  /** Last known top-level visibility; avoids rebuilding order when content
   *  changes do not alter whether this session has a visible turn card. */
  topLevelVisible: boolean
}

interface MessageInfo {
  id: string
  sessionID: string
  /** Canonical execution-session owner projected by the backend bridge. */
  sessionAgentID: string
  /** Truthful participant identity for this exact message. */
  agentID: string
  stage: string
  role: string
  author: string
  channel: string
  source: string
  resolvedRole: string
  agent: string
  parentSessionID: string
  parentMessageID: string
  orderKey: string
  time: number
  serverTimeConfirmed: boolean
  completed: boolean
  delegatedContext: boolean
}

interface PendingPartFirstMessageInfo extends MessageInfo {
  pendingPartFirst: true
}

interface MessageUsageProjection {
  providerID: string
  modelID: string
  display: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUSD: number
  contextTokens: number
}

interface MessageModelProjection {
  providerID: string
  modelID: string
  display: string
}

const sessions = new Map<string, SessionInfo>()
const messages = new Map<string, MessageInfo>()
const pendingPartFirstMessages = new Map<string, PendingPartFirstMessageInfo>()
let latestTimelineMessage: MessageInfo | undefined
/** Integrity events that arrived before their owning session's first
 *  message.updated. Keyed by sessionID so ensureSessionCard can drain a
 *  single pending payload per session. Holding the raw payload here (NOT in
 *  cardTreeStore.cards) preserves the invariant "every entry in
 *  cardTreeStore.cards is reachable via order or some parent's childIDs" —
 *  an integrity event that never finds its session stays in this map until
 *  resetWriter() clears it, never materializing into an unreachable ghost. */
/** Session lifecycle status buffered until the owning session card materializes.
 *  `agent.execution.lifecycle` events from packages/opencorvus/src/session/status.ts may
 *  reach the writer before the session's first `message.updated` in the
 *  normalized SSE stream order (especially on reconnect replay). Same pattern
 *  Single source of truth for every session's lifecycle, including the
 *  orchestrator root and all dynamically projected agents. */
interface ProjectedSessionStatus {
  sessionID?: string
  inputMessageID?: string
  cardStatus: CardStatus
  terminalReason?: CardTerminalReason
  errorReason?: string
  timeCompleted?: number
}
const pendingSessionStatus = new Map<string, ProjectedSessionStatus>()

interface TerminalCardProjection {
  cardStatus: Extract<CardStatus, "completed" | "error">
  terminalReason: CardTerminalReason
}

const terminalCardProjectionByReason = {
  completed: { cardStatus: "completed", terminalReason: "completed" },
  coordinated: { cardStatus: "completed", terminalReason: "coordinated" },
  error: { cardStatus: "error", terminalReason: "error" },
  aborted: { cardStatus: "completed", terminalReason: "aborted" },
} satisfies Record<SessionTerminalReason, TerminalCardProjection>
/** Raw Question.ask interactions for standalone session conversations such as
 *  Mission. Engine task questions are normalized by the backend into
 *  board.interactions and must not be duplicated here. */
const standaloneQuestionInteractions = new Map<string, any>()
interface BufferedPartDelta {
  event: any
  delta: string
}

const PART_DELTA_FLUSH_INTERVAL_MS = 50
var bufferedPartDeltas = new Map<string, BufferedPartDelta>()
var bufferedPartDeltaTimer: ReturnType<typeof setTimeout> | null = null
let projectionDeferralDepth = 0
let deferredTimelineRegroup = false
let deferredHierarchyRebuild = false
let deferredBoardProjection = false
let deferredTopLevelRebuild = false
let deferredStatsFlush = false
let deferredVisibleChange = false

function flushCardStats(): void {
  if (projectionDeferralDepth > 0) {
    deferredStatsFlush = true
    return
  }
  flushCardStatsNow()
}

function markCardTreeVisibleChanged(): void {
  if (projectionDeferralDepth > 0) {
    deferredVisibleChange = true
    return
  }
  markCardTreeVisibleChangedNow()
}

export function deferConversationTreeProjection(run: () => void): void {
  if (projectionDeferralDepth === 0) settlePendingCardTreeDisplayAggregates()
  projectionDeferralDepth += 1
  let completed = false
  try {
    run()
    completed = true
  } finally {
    projectionDeferralDepth -= 1
    if (projectionDeferralDepth === 0) {
      const projectBoard = deferredBoardProjection
      const regroupTimeline = deferredTimelineRegroup
      const rebuildHierarchy = deferredHierarchyRebuild
      const rebuildTopLevel = deferredTopLevelRebuild
      const flushStats = deferredStatsFlush
      const changeVisible = deferredVisibleChange
      deferredBoardProjection = false
      deferredTimelineRegroup = false
      deferredHierarchyRebuild = false
      deferredTopLevelRebuild = false
      deferredStatsFlush = false
      deferredVisibleChange = false
      if (completed) {
        if (projectBoard) {
          rebuildBoardDerivedCards()
        } else {
          if (regroupTimeline) regroupTimelineSegments({ deferHierarchy: true })
          if (rebuildHierarchy) rebuildCardHierarchy()
          else if (rebuildTopLevel) rebuildTopLevelOrder()
          if (flushStats) flushCardStats()
          if (changeVisible) markCardTreeVisibleChanged()
        }
      }
    }
  }
}

// ── Entry point ──

/** Reset all writer state + cardTreeStore. Called on task switch, hydrate,
 *  recovery, and in tests. The caller must stamp the replacement scroll
 *  intent explicitly so the conversation view does not guess whether this
 *  replacement should preserve the operator's viewport or jump to the tail. */
export function resetWriter(
  options: {
    scrollIntent?: "preserve" | "bottom"
    cause?: string
  } = {},
): void {
  // Reset is a source-ownership boundary. Pending deltas belong to the source
  // being discarded, so executing them here would mutate the old tree before
  // clearing it and could prevent the clear if a stale delta is malformed.
  cancelBufferedPartDeltaTimer()
  // A pending display-aggregate settlement belongs to the tree being replaced.
  cancelCardTreeDisplayAggregateSettlement()
  bufferedPartDeltas.clear()
  sessions.clear()
  messages.clear()
  pendingPartFirstMessages.clear()
  latestTimelineMessage = undefined
  runningReviews.clear()
  terminalReviewOrderKeys.clear()
  pendingSessionStatus.clear()
  standaloneQuestionInteractions.clear()
  // Drop every key explicitly — plain assignment on a store merges instead of
  // replacing the existing keyed card collection.
  replaceCardTreeOrder([])
  setCardTreeStore(
    "cards",
    produce((c: Record<string, CardNode>) => {
      for (const k of Object.keys(c)) {
        markCardStatsRemoved(k)
        delete c[k]
      }
    }),
  )
  setCardTreeStore("screenshotItems", [])
  setCardTreeStore("rewindCursor", null)
  flushCardStats()
  markCardTreeReplaced({
    scrollIntent: options.scrollIntent ?? "preserve",
    cause: options.cause ?? "writer-reset",
  })
  markCardTreeVisibleChanged()
}

// ── Display-aggregate settlement ──
//
// `flushCardStats` recomputes a touched card's own aggregates by walking all of
// its parts and then bubbling to its ancestors, so its cost tracks the size of
// the card, not the size of the change. Running it once per event made it the
// single most expensive thing the live path did.
//
// It is a display cache — collapsed-bubble counters, the latest-activity line,
// the header usage strip — and nothing that resolves identity or placement
// reads it. The projection the agent rail reads back synchronously right after
// each write (card order, hierarchy, message→card ownership) therefore stays
// synchronous; only this cache is coalesced.
//
// The frame callback runs before the browser paints, so a frame is never
// painted from a stale cache. Events landing in the same frame collapse into
// one recompute per touched card because the dirty set already dedupes.
const cardStatsSettlementFrame = createAnimationFrameScheduler(() => {
  cardStatsSettlementScheduled = false
  settleCardTreeDisplayAggregates()
})
let cardStatsSettlementScheduled = false

/** Coalescing needs the host's frame clock to decide when "before the next
 *  paint" is. Where there is none there is also nothing to paint, so the same
 *  settlement runs immediately instead — same result, no coalescing. */
function hostSchedulesFrames(): boolean {
  return typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function"
}

function settleCardTreeDisplayAggregates(): void {
  batch(() => {
    flushCardStats()
    // Already inside the frame that will paint: publish now so the projection
    // token never runs ahead of the aggregates it is meant to publish.
    if (projectionDeferralDepth > 0) markCardTreeVisibleChanged()
    else publishCardTreeVisibleNow()
  })
}

/** Settle a pending frame's aggregates now. A deferred projection block owns
 *  its own settlement, so it must start from a settled cache rather than race a
 *  frame scheduled by the live events that came before it. */
function settlePendingCardTreeDisplayAggregates(): void {
  if (!cardStatsSettlementScheduled) return
  cardStatsSettlementScheduled = false
  cardStatsSettlementFrame.cancel()
  settleCardTreeDisplayAggregates()
}

function cancelCardTreeDisplayAggregateSettlement(): void {
  if (!cardStatsSettlementScheduled) return
  cardStatsSettlementScheduled = false
  cardStatsSettlementFrame.cancel()
}

function scheduleCardTreeDisplayAggregates(): void {
  if (!hostSchedulesFrames()) {
    settleCardTreeDisplayAggregates()
    return
  }
  if (cardStatsSettlementScheduled) return
  cardStatsSettlementScheduled = true
  cardStatsSettlementFrame.schedule()
}

function applyVisibleCardTreeEvent(handler: () => void): void {
  batch(() => {
    handler()
  })
  scheduleCardTreeDisplayAggregates()
}

function cancelBufferedPartDeltaTimer(): void {
  if (bufferedPartDeltaTimer === null) return
  clearTimeout(bufferedPartDeltaTimer)
  bufferedPartDeltaTimer = null
}

export function hasProjectedPart(sessionID: string, partID: string): boolean {
  return sessions.get(sessionID)?.partIndex.has(partID) === true
}

export type ProjectionPrerequisiteEntity = "session" | "message" | "part"

export class ProjectionPrerequisiteError extends Error {
  readonly code = "projection_prerequisite_missing" as const
  readonly eventType: string
  readonly missingEntity: ProjectionPrerequisiteEntity
  readonly missingID: string
  readonly sessionID?: string

  constructor(input: {
    eventType: string
    missingEntity: ProjectionPrerequisiteEntity
    missingID: string
    sessionID?: string
  }) {
    super(
      `${input.eventType}: missing ${input.missingEntity} projection ${input.missingID}` +
        (input.sessionID ? ` in session ${input.sessionID}` : ""),
    )
    this.name = "ProjectionPrerequisiteError"
    this.eventType = input.eventType
    this.missingEntity = input.missingEntity
    this.missingID = input.missingID
    this.sessionID = input.sessionID
  }
}

export function isProjectionPrerequisiteError(error: unknown): error is ProjectionPrerequisiteError {
  return error instanceof ProjectionPrerequisiteError && error.code === "projection_prerequisite_missing"
}

function requireSessionProjection(sessionID: string, eventType: string): SessionInfo {
  const session = sessions.get(sessionID)
  if (!session) {
    throw new ProjectionPrerequisiteError({
      eventType,
      missingEntity: "session",
      missingID: sessionID,
      sessionID,
    })
  }
  return session
}

function requirePartProjection(session: SessionInfo, partID: string, eventType: string): PartTarget {
  const target = session.partIndex.get(partID)
  if (!target) {
    throw new ProjectionPrerequisiteError({
      eventType,
      missingEntity: "part",
      missingID: partID,
      sessionID: session.sessionID,
    })
  }
  return target
}

function requireMessageCardProjection(session: SessionInfo, messageID: string, eventType: string): string {
  const cardID = session.messageCardIDs.get(messageID)
  if (!cardID) {
    throw new ProjectionPrerequisiteError({
      eventType,
      missingEntity: "message",
      missingID: messageID,
      sessionID: session.sessionID,
    })
  }
  return cardID
}

function validatePartDeltaTarget(event: any): {
  key: string
  delta: string
} {
  const p = propsOf(event)
  const partID = String(p.partID || "")
  const sessionID = String(p.sessionID || "")
  const field = String(p.field || "")
  if (!partID || !sessionID || !field) {
    throw new Error("message.part.delta missing partID/sessionID/field")
  }
  const session = requireSessionProjection(sessionID, "message.part.delta")
  requirePartProjection(session, partID, "message.part.delta")
  return {
    key: `${sessionID}|${partID}|${field}`,
    delta: typeof p.delta === "string" ? p.delta : "",
  }
}

function mergedPartDeltaEvent(entry: BufferedPartDelta): any {
  const props = propsOf(entry.event)
  if (entry.event?.properties && typeof entry.event.properties === "object" && !Array.isArray(entry.event.properties)) {
    return { ...entry.event, properties: { ...props, delta: entry.delta } }
  }
  return { ...entry.event, payload: { ...props, delta: entry.delta } }
}

function queuePartDelta(event: any): void {
  const { key, delta } = validatePartDeltaTarget(event)
  const buffered = bufferedPartDeltas.get(key)
  if (buffered) {
    buffered.delta += delta
  } else {
    bufferedPartDeltas.set(key, { event, delta })
  }
  if (bufferedPartDeltaTimer !== null) return
  bufferedPartDeltaTimer = setTimeout(() => {
    bufferedPartDeltaTimer = null
    flushBufferedPartDeltas()
  }, PART_DELTA_FLUSH_INTERVAL_MS)
}

export function flushBufferedPartDeltas(): void {
  if (bufferedPartDeltas.size === 0) {
    cancelBufferedPartDeltaTimer()
    return
  }
  cancelBufferedPartDeltaTimer()
  const entries = [...bufferedPartDeltas.entries()]
  batch(() => {
    for (const [key, entry] of entries) {
      bufferedPartDeltas.delete(key)
      handlePartDelta(mergedPartDeltaEvent(entry))
    }
  })
  scheduleCardTreeDisplayAggregates()
}

/** Top-level dispatcher. Unknown event types throw by design (rule 1:
 *  let-it-crash). Keeping the branches close together makes coverage
 *  auditable — every event type the overlay processes lives here. */
export function applyEvent(event: any): void {
  const type: string = String(event?.type || "")
  if (!type) throw new Error("tree-writer: event missing type")
  if (type === "message.part.delta") return queuePartDelta(event)

  // Exact board/interaction events must be handled before prefix pass-through
  // checks. Prefixes such as `task.`, `goal.`, and `interaction.` cover many
  // router-level events, but these concrete event types mutate the visible
  // tree and would otherwise be swallowed.
  if (type === "task.created" || type === "task.updated" || type === "task.completed") {
    flushBufferedPartDeltas()
    return handleTaskChanged(event)
  }
  if (type === "interaction.requested" || type === "interaction.resolved") {
    flushBufferedPartDeltas()
    return handleInteraction(event)
  }
  if (type === "question.asked" || type === "question.replied" || type === "question.rejected") {
    flushBufferedPartDeltas()
    return applyVisibleCardTreeEvent(() => handleStandaloneQuestion(event))
  }

  if (
    type === "goal.created" ||
    type === "approval.request" ||
    type === "input.request" ||
    type === "permission.asked" ||
    type === "permission.replied" ||
    type === "diff.delta" ||
    isTreeWriterNoopEventType(type) ||
    isTreeWriterPassThroughEventType(type)
  ) {
    return
  }
  flushBufferedPartDeltas()

  // ── Message stream ──
  if (type === "message.moved") return applyVisibleCardTreeEvent(() => handleMessageMoved(event))
  if (type === "message.updated") return applyVisibleCardTreeEvent(() => handleMessageUpdated(event))
  if (type === "message.part.updated") return applyVisibleCardTreeEvent(() => handlePartUpdated(event))
  if (type === "message.removed") return applyVisibleCardTreeEvent(() => handleMessageRemoved(event))
  if (type === "message.part.removed") return applyVisibleCardTreeEvent(() => handlePartRemoved(event))

  if (type === "review.stream.started") {
    return applyVisibleCardTreeEvent(() => handleReviewStreamStarted(event))
  }
  if (type === "review.stream.progress") {
    return applyVisibleCardTreeEvent(() => handleReviewStreamProgress(event))
  }
  if (type === "review.stream.chunk") {
    return applyVisibleCardTreeEvent(() => handleReviewStreamChunk(event))
  }

  // ── Session lifecycle (single source) ──
  // agent.execution.lifecycle from packages/opencorvus/src/session/status.ts is the
  // only signal that writes terminal lifecycle reasons. Display cards may use
  // running/completed to mark the currently active rendered turn, but terminal
  // completed/error/aborted ownership comes from this event. Carries
  // `{sessionID, status:{type:"streaming"|"idle"|"retry"|"terminal", ...}}`.
  // Applies to every session — orchestrator root, requirements / architect /
  // frontend-design / frontend-research / workload_analysis / visual_qa /
  // projected-agent and scheduler-tool result surfaces. See
  // specs/current/architecture/07-panel-reactivity.md §session 终态信号源.
  if (type === "agent.execution.lifecycle") {
    return applyVisibleCardTreeEvent(() => handleSessionStatus(event))
  }
  if (type === "session.error") return

  // ── Interactive prompts that need operator response. ──
  // approval.request / input.request payloads carry { id, approval / questions }
  // — they DO need a UI surface (Round-4 work), but until that lands we
  // accept them silently rather than spamming console.error from the SSE
  // try/catch. The runtime message stream emits these for permission
  // permission prompts and structured questions.
  if (type === "approval.request" || type === "input.request") return
  // permission.* events fire alongside approval.request when an agent
  // pauses on a tool call. Handled inline by
  // InteractionCard — tree-writer just acknowledges.
  if (type === "permission.asked" || type === "permission.replied") return
  // diff.delta is a streaming preview from the agent runtime — boardStore
  // already tracks the diff, the writer doesn't need to project it as a card.
  if (type === "diff.delta") return

  // ── No-op events (control plane / telemetry). Listed explicitly so the
  //    final `throw` catches truly unknown types. ──
  if (isTreeWriterNoopEventType(type)) return

  // Broad-prefix pass-through (no state change in the writer; boardStore
  // handles these on its own side, and rebuildBoardDerivedCards reads
  // boardStore lazily). Enumerated explicitly — unknown prefixes still throw.
  if (isTreeWriterPassThroughEventType(type)) return

  throw new Error(`tree-writer: unhandled event type "${type}"`)
}

export function ingestPersistedConversationMessage(input: { info: any; parts: any[] }): void {
  if (!input?.info?.id) {
    throw new Error("ingestPersistedConversationMessage: persisted message missing info.id")
  }
  if (!Array.isArray(input.parts)) {
    throw new Error(`ingestPersistedConversationMessage: message ${input.info.id} missing parts array`)
  }
  batch(() => {
    applyEvent({
      type: "message.updated",
      orderKey: input.info.orderKey,
      properties: { info: input.info },
    })
    for (const part of input.parts) {
      if (!part) continue
      projectPersistedConversationPart(input.info, part)
    }
  })
}

// ── Helpers ──

function propsOf(event: any): Record<string, any> {
  const p = event?.properties
  const base =
    p && typeof p === "object" && !Array.isArray(p)
      ? p
      : event?.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? event.payload
        : {}
  // Protocol envelopes own Task and Session identity: EngineProtocol.emit
  // moves `taskID`/`sessionID` out of the payload into the aggregate tuple,
  // which reaches the overlay as `task_id`/`session_id`. Republish both under
  // their payload names so handlers read one identity, not two shapes.
  const envelopeTaskID = typeof event?.task_id === "string" ? event.task_id : ""
  const envelopeSessionID = typeof event?.session_id === "string" ? event.session_id : ""
  if (!envelopeTaskID && !envelopeSessionID) return base
  const normalized = { ...base }
  if (envelopeTaskID) {
    const payloadTaskID = typeof base.taskID === "string" ? base.taskID : ""
    if (payloadTaskID && payloadTaskID !== envelopeTaskID) {
      throw new Error(`protocol event task identity conflict: envelope=${envelopeTaskID} payload=${payloadTaskID}`)
    }
    normalized.taskID = envelopeTaskID
  }
  if (envelopeSessionID) {
    const payloadSessionID = typeof base.sessionID === "string" ? base.sessionID : ""
    if (payloadSessionID && payloadSessionID !== envelopeSessionID) {
      throw new Error(
        `protocol event session identity conflict: envelope=${envelopeSessionID} payload=${payloadSessionID}`,
      )
    }
    normalized.sessionID = envelopeSessionID
  }
  return normalized
}

/** Dedicated, message-turn-less card id. Only the integrity review uses
 *  this form: integrity is a real session but its reasoning/verdict reach
 *  the overlay through `integrity.review.*` events (NOT `message.updated`),
 *  so there is no durable messageID to scope a turn card by. The card is
 *  single per integrity session, which is the desired display anyway. */
function sessionCardID(stage: string, sid: string): string {
  return `${stage}:session:${sid}`
}

/** Stable top-level message segment card id. A runtime session can produce
 *  many real `message.updated` rows; adjacent compatible rows share the
 *  first message's card identity, while non-adjacent rows get their own
 *  segment card. Sorting is by backend `CardNode.orderKey`, never by id. */
function messageTurnCardID(stage: string, sid: string, messageID: string): string {
  return `${stage}:session:${sid}:message:${messageID}`
}

function occurrenceCardID(stage: string, sid: string, inputMessageID: string): string {
  return `${stage}:session:${sid}:occurrence:${inputMessageID}`
}

function isUserStage(stage: string): boolean {
  return normalizeAgentRole(stage) === "user"
}

function initialSessionCardStatus(stage: string): CardStatus {
  return isUserStage(stage) ? "completed" : "running"
}

function conversationPartHasDisplay(part: any): boolean {
  return messagePartHasDisplayContent(part)
}

function conversationPartIsProjectable(part: any): boolean {
  return isCardBodyMessagePart(part)
}

function transcriptMessageHasDisplay(message: any): boolean {
  return Boolean(
    assistantMessageErrorReason(message?.info) ||
      (Array.isArray(message?.parts) && message.parts.some(conversationPartHasDisplay)),
  )
}

function createSessionCardNode(
  cardID: string,
  stage: string,
  agentID: string | undefined,
  orderKey: string,
  time: number,
  sessionID: string,
  messageID: string,
  parts: any[] = [],
  childIDs: string[] = [],
  parentSessionID = "",
): CardNode {
  const userStage = isUserStage(stage)
  const exactAgentID = agentID?.trim()
  if (!userStage && !exactAgentID) {
    throw new Error(`agent session card ${cardID} missing exact agentID`)
  }
  return {
    id: cardID,
    kind: userStage ? "message" : "agent",
    role: userStage ? "user" : undefined,
    sessionID,
    parentSessionID: parentSessionID || undefined,
    ...(!userStage ? { agentID: exactAgentID } : {}),
    ...(messageID ? { messageID } : {}),
    stage,
    accent: !userStage && stage ? stageAccent(stage) : undefined,
    status: initialSessionCardStatus(stage),
    title: userStage ? roleTitleKey("user") : stage ? roleTitleKey(stage) : "chat.role.assistant",
    round: userStage ? undefined : 0,
    parts,
    childIDs,
    orderKey,
    time,
  }
}

function interactionCardID(messageID: string): string {
  return `interaction-card:${messageID}`
}

// ── Handlers ──

function handleMessageUpdated(event: any): void {
  const info = propsOf(event).info
  if (!info || typeof info !== "object") throw new Error("message.updated missing info")

  const id = String(info.id || "")
  const sessionID = String(info.sessionID || "")
  if (!id || !sessionID) throw new Error("message.updated info missing id/sessionID")

  // No assistant-fallback (一个萝卜一个坑). Every event must arrive with role
  // + resolvedRole already populated by the server bridge (overlayMeta). If
  // either is missing, throw — silently routing role-less events into the
  // generic assistant card orphans the actual agent's stream.
  const rawRole = info.role
  if (typeof rawRole !== "string" || rawRole.length === 0) {
    throw new Error(`message.updated info missing role for message ${info.id}; bridge must enrich it`)
  }
  const role = rawRole
  const origin = requireMessageOrigin(info, id)
  const canonicalAgentID = requireCanonicalMessageAgentID(info.agentID, origin, id)
  const sessionAgentID = String(info.sessionAgentID || "").trim()
  if (!sessionAgentID) {
    throw new Error(`message.updated info missing sessionAgentID for message ${info.id}; bridge must enrich it`)
  }
  const rawResolvedRole = info.resolvedRole
  if (typeof rawResolvedRole !== "string" || rawResolvedRole.length === 0) {
    throw new Error(`message.updated info missing resolvedRole for message ${info.id}`)
  }
  const agent = typeof info.agent === "string" ? info.agent : ""
  const parentSessionID = String(info.parentSessionID || "")
  const incomingTimeCreated = Number(info?.time?.created)
  if (!(incomingTimeCreated > 0)) {
    throw new Error(
      `message.updated info.time.created must be positive (got ${info?.time?.created}); server emitter is the single source of truth`,
    )
  }
  const envelopeOrderKey = requireTimelineOrderKeyDomain(event?.orderKey, `message.updated ${id} envelope`, "message")
  const infoOrderKey = requireTimelineOrderKeyDomain(info.orderKey, `message.updated ${id}`, "message")
  if (envelopeOrderKey !== infoOrderKey) {
    throw new Error(`message.updated ${id} orderKey drift between envelope and info`)
  }
  const orderKey = envelopeOrderKey
  const existingMessage = messages.get(id)
  if (existingMessage && existingMessage.orderKey !== orderKey) {
    throw new Error(`message.updated ${id} orderKey drift from existing message owner`)
  }
  const pendingPartFirstMessage = pendingPartFirstMessages.get(id)
  if (pendingPartFirstMessage && pendingPartFirstMessage.orderKey !== orderKey) {
    throw new Error(`message.updated ${id} orderKey drift from pending part-first owner`)
  }
  pendingPartFirstMessages.delete(id)
  const timeCreated = existingMessage?.serverTimeConfirmed ? existingMessage.time : incomingTimeCreated
  const completed = Number.isFinite(info?.time?.completed) && Number(info.time.completed) > 0

  // Channel-driven stage. Bridge stamps it on every event; an absent
  // channel is a bridge bug, not a case we silently accommodate.
  const stage = deriveSessionStage(origin)
  const displayRole = displayRoleForResolvedRole(rawResolvedRole)
  const nextMessageInfo: MessageInfo = {
    id,
    sessionID,
    sessionAgentID,
    agentID: canonicalAgentID,
    stage,
    role,
    author: origin.author,
    channel: origin.channel,
    source: origin.source,
    resolvedRole: displayRole,
    agent,
    parentSessionID,
    parentMessageID: String(info?.parentID || ""),
    orderKey,
    time: timeCreated,
    serverTimeConfirmed: true,
    completed,
    delegatedContext: isDelegatedContextMessage(origin),
  }
  const runtimeStage = deriveRuntimeSessionStage(origin.channel)
  const session = ensureSessionProjection(sessionID, {
    agentID: isUserStage(runtimeStage) ? undefined : sessionAgentID,
    stage: runtimeStage,
    parentSessionID,
  })
  const insertsBeforeKnownTail =
    !existingMessage && latestTimelineMessage ? messageTimeOrder(nextMessageInfo, latestTimelineMessage) < 0 : false

  // Index the message.
  messages.set(id, nextMessageInfo)
  if (!latestTimelineMessage || messageTimeOrder(latestTimelineMessage, nextMessageInfo) <= 0) {
    latestTimelineMessage = nextMessageInfo
  } else if (latestTimelineMessage.id === id) {
    latestTimelineMessage = [...messages.values()].sort(messageTimeOrder).at(-1)
  }

  const priorMessageCount = session.messageIDs.size
  session.messageIDs.add(id)

  const messageCardID = ensureMessageTurnProjection(session, id, {
    stage,
    agentID: isUserStage(stage) ? undefined : canonicalAgentID,
    collapseContext: nextMessageInfo.delegatedContext,
    orderKey,
    time: timeCreated,
    stampServerTime: true,
    occurrenceInputMessageID: role === "user" ? id : String(info?.parentID || "") || undefined,
  })
  applyAssistantMessageSettlement(messageCardID, info)
  const needsIntegrityHierarchyRebuild = stage === "integrity" && Boolean(parentSessionID || session.parentSessionID)

  // Regroup ordinary cards from the authoritative message timeline; doing
  // that from live arrival order would make card identity arrival-dependent.
  const needsTimelineRegroup = priorMessageCount > 0 || insertsBeforeKnownTail
  if (needsTimelineRegroup) {
    regroupTimelineSegments()
  } else if (needsIntegrityHierarchyRebuild) {
    rebuildCardHierarchy()
    rebuildTopLevelOrder()
  } else if (
    (Array.isArray(boardStore.board?.interactions) && boardStore.board.interactions.length > 0) ||
    standaloneQuestionInteractions.size > 0
  ) {
    rebuildCardHierarchy()
  } else {
    rebuildTopLevelOrder()
  }

  // Project per-message LLM usage (tokens + cost) onto this turn's card.
  // The engine writes cumulative-within-message tokens onto
  // `Message.Assistant.tokens` (session/processor.ts step-finish) and
  // `cost` likewise; provider usage metadata follows the same convention via
  // `build/agent.ts:case "usage"`. message.updated is the single source —
  // there is no parallel usage.updated event.
  //
  // Segment cards can own multiple assistant messages, so usage stays
  // per-message and is summed onto the ordinary owner card.
  const usageProjection = usageProjectionFromInfo(info)
  if (usageProjection) projectUsageOntoCard(session, id, usageProjection)
  if (messageInfoIsAssistant(info)) {
    projectModelOntoCard(session, id, modelProjectionFromInfo(info))
  }

  drainPendingSessionStatus(sessionID)
}

interface EnsuredPartProjection {
  session: SessionInfo
  cardID: string
  partID: string
  messageID: string
  sessionID: string
  displayRole: string
  /** True only when this part arrived before its `message.updated` and had to
   *  create the message turn itself. That is the one part-driven way message
   *  segmentation can change, so it is the one case that must regroup. */
  createdMessageTurn: boolean
}

type PartEventRouteMeta = {
  agentID?: unknown
  sessionAgentID?: unknown
  channel?: unknown
  resolvedRole?: unknown
  role?: unknown
  author?: unknown
  originSource?: unknown
  parentSessionID?: unknown
  parentMessageID?: unknown
  orderKey?: unknown
}

function requirePartEventRouteMeta(
  meta: PartEventRouteMeta | undefined,
  messageID: string,
): {
  channel: string
  agentID: string
  sessionAgentID: string
  resolvedRole: string
  role: string
  author: string
  source: string
  parentSessionID: string
  parentMessageID: string
  orderKey: string
} {
  const channel = typeof meta?.channel === "string" ? meta.channel.trim() : ""
  const agentID = typeof meta?.agentID === "string" ? meta.agentID.trim() : ""
  const sessionAgentID = typeof meta?.sessionAgentID === "string" ? meta.sessionAgentID.trim() : ""
  const resolvedRole = typeof meta?.resolvedRole === "string" ? meta.resolvedRole.trim() : ""
  const role = typeof meta?.role === "string" ? meta.role.trim() : ""
  const author = typeof meta?.author === "string" ? meta.author.trim() : ""
  const source = typeof meta?.originSource === "string" ? meta.originSource.trim() : ""
  if (!agentID || !sessionAgentID || !channel || !resolvedRole || !role || !author) {
    throw new Error(
      `message.part.updated for ${messageID} missing top-level agentID/sessionAgentID/role/author/channel/resolvedRole; backend bridge must stamp origin metadata outside part`,
    )
  }
  requireCanonicalMessageAgentID(agentID, { role, author }, messageID)
  return {
    channel,
    agentID,
    sessionAgentID,
    resolvedRole,
    role,
    author,
    source,
    parentSessionID: String(meta?.parentSessionID || ""),
    parentMessageID: String(meta?.parentMessageID || ""),
    orderKey: requireTimelineOrderKeyDomain(meta?.orderKey, `message.part.updated ${messageID}`, "message"),
  }
}

function requirePositiveNumber(value: unknown, label: string): number {
  const number = Number(value)
  if (Number.isFinite(number) && number > 0) return number
  throw new Error(`${label} must be positive`)
}

function messageOrderKeyTime(eventType: string, messageID: string, orderKey: string): number {
  return timelineOrderKeyTime(orderKey, `${eventType} ${messageID}`)
}

function ensurePartProjection(part: any, opts: { routeMeta?: PartEventRouteMeta } = {}): EnsuredPartProjection | null {
  if (!part || typeof part !== "object") throw new Error("message.part.updated missing part")
  const partID = String(part.id || "")
  const messageID = String(part.messageID || "")
  const sessionID = String(part.sessionID || "")
  if (!partID || !messageID || !sessionID) {
    throw new Error("message.part.updated part missing id/messageID/sessionID")
  }
  const partHasDisplay = conversationPartHasDisplay(part)
  const routeOrderKey = requireTimelineOrderKeyDomain(
    opts.routeMeta?.orderKey,
    `message.part.updated ${messageID}`,
    "message",
  )
  const partOrderKey = requireTimelineOrderKeyDomain(part.orderKey, `message.part.updated part ${partID}`, "part")

  const existingSession = sessions.get(sessionID)
  let session = existingSession
  let cardID = session?.messageCardIDs.get(messageID)
  let createdMessageTurn = false
  let displayRole = ""
  const existingMessage = messages.get(messageID)
  if (existingMessage) {
    if (existingMessage.orderKey !== routeOrderKey) {
      throw new Error(`message.part.updated ${messageID} orderKey drift from existing message owner`)
    }
    displayRole = existingMessage.resolvedRole
  } else {
    const pendingMessage = pendingPartFirstMessages.get(messageID)
    if (pendingMessage) {
      if (pendingMessage.orderKey !== routeOrderKey) {
        throw new Error(`message.part.updated ${messageID} orderKey drift from pending part-first owner`)
      }
      displayRole = pendingMessage.resolvedRole
    }
  }
  const eventResolvedRole = typeof opts.routeMeta?.resolvedRole === "string" ? opts.routeMeta.resolvedRole.trim() : ""
  if (!displayRole && eventResolvedRole) displayRole = displayRoleForResolvedRole(eventResolvedRole)
  let route: ReturnType<typeof requirePartEventRouteMeta> | undefined

  if (!session || !cardID) {
    // Bridge stamps channel/parentSessionID onto the event payload.
    // A part can arrive before its message.updated (saveMessage is silent;
    // updatePart fires before updateMessage). Because messageID is already
    // known, the turn card's deterministic id and message-domain orderKey time
    // are too — build it now from backend timeline evidence; no synthetic stub
    // or rename.
    route = requirePartEventRouteMeta(opts.routeMeta, messageID)
    const stage = deriveSessionStage(route)
    displayRole = displayRoleForResolvedRole(route.resolvedRole)
    const runtimeStage = deriveRuntimeSessionStage(route.channel)
    session = ensureSessionProjection(sessionID, {
      agentID: isUserStage(runtimeStage) ? undefined : route.sessionAgentID,
      stage: runtimeStage,
      parentSessionID: route.parentSessionID,
    })
    cardID = session.messageCardIDs.get(messageID)
  }

  if (!session) {
    throw new Error(`message.part.updated could not ensure session ${sessionID}`)
  }
  if (!cardID) {
    if (!partHasDisplay) return null
    if (!displayRole) {
      throw new Error(`message.part.updated for ${messageID} missing resolved display role`)
    }
    if (!route) route = requirePartEventRouteMeta(opts.routeMeta, messageID)
    const turnStage = deriveSessionStage(route)
    const messageTime = messageOrderKeyTime("message.part.updated", messageID, route.orderKey)
    pendingPartFirstMessages.set(messageID, {
      id: messageID,
      sessionID,
      sessionAgentID: route.sessionAgentID,
      agentID: route.agentID,
      stage: session.stage,
      role: route.role,
      author: route.author,
      channel: route.channel,
      source: route.source,
      resolvedRole: displayRole,
      agent: displayRole,
      parentSessionID: route.parentSessionID,
      parentMessageID: route.parentMessageID,
      orderKey: route.orderKey,
      time: messageTime,
      serverTimeConfirmed: false,
      completed: false,
      delegatedContext: isDelegatedContextMessage(route),
      pendingPartFirst: true,
    })
    cardID = ensureMessageTurnProjection(session, messageID, {
      stage: turnStage,
      agentID: isUserStage(turnStage) ? undefined : route.agentID,
      collapseContext: isDelegatedContextMessage(route),
      orderKey: route.orderKey,
      time: messageTime,
      stampServerTime: false,
      occurrenceInputMessageID: route.role === "user" ? messageID : route.parentMessageID || undefined,
    })
    createdMessageTurn = true
    drainPendingSessionStatus(sessionID)
  }

  if (!conversationPartIsProjectable(part)) return null

  upsertPart(session, messageID, cardID, partID, { ...part, orderKey: partOrderKey })
  if (!displayRole) {
    throw new Error(
      `message.part.updated for ${messageID} could not resolve display role from message or event metadata`,
    )
  }
  return { session, cardID, partID, messageID, sessionID, displayRole, createdMessageTurn }
}

function handlePartUpdated(event: any): void {
  const props = propsOf(event)
  const part = props.part
  const envelopeMessageID = String(part?.messageID || "")
  const envelopeOrderKey = requireTimelineOrderKeyDomain(
    event?.orderKey,
    `message.part.updated ${envelopeMessageID} envelope`,
    "message",
  )
  if (typeof props?.orderKey === "string" && props.orderKey.length > 0 && props.orderKey !== envelopeOrderKey) {
    throw new Error(`message.part.updated ${envelopeMessageID} orderKey drift between envelope and payload`)
  }
  const projection = ensurePartProjection(part, {
    routeMeta: { ...props, orderKey: envelopeOrderKey },
  })
  if (!projection) return
  const { session } = projection
  // `ensurePartProjection` has already placed this part: `upsertPart` either
  // rewrote it in place or inserted it at its exact order-key position inside
  // the owning message's run, keeping `partIndex` correct. Message segmentation
  // is derived from the message timeline, not from parts, so a part landing in
  // an already-projected message turn cannot change it — regrouping there would
  // re-derive the identical segments and rewrite every card in the conversation.
  // The one part-driven exception is a part that arrived before its message and
  // had to create the turn itself; that new message may merge into an adjacent
  // segment, which only the regroup can settle. `handleMessageUpdated` already
  // guards its own regroup the same way.
  if (conversationPartHasDisplay(part) && projection.createdMessageTurn) {
    regroupTimelineSegments()
  } else {
    rebuildTopLevelOrder()
  }
  syncSessionTopLevelVisibility(session)
}

function projectPersistedConversationPart(info: any, part: any): void {
  if (!part || typeof part !== "object") throw new Error("persisted message part missing part")
  const messageID = String(part.messageID || "")
  const sessionID = String(part.sessionID || "")
  const partID = String(part.id || "")
  const infoID = String(info?.id || "")
  const infoSessionID = String(info?.sessionID || "")
  if (!partID || !messageID || !sessionID) {
    throw new Error("persisted message part missing id/messageID/sessionID")
  }
  if (messageID !== infoID || sessionID !== infoSessionID) {
    throw new Error(`persisted message part ${partID} does not belong to message ${infoID}`)
  }
  const session = sessions.get(sessionID)
  const cardID = session?.messageCardIDs.get(messageID)
  const message = messages.get(messageID)
  if (!session || !cardID || !message) {
    throw new Error(`persisted message ${messageID} was not projected before part ${partID}`)
  }
  const partOrderKey = requireTimelineOrderKeyDomain(part.orderKey, `persisted message part ${partID}`, "part")
  if (!conversationPartIsProjectable(part)) return

  upsertPart(session, messageID, cardID, partID, { ...part, orderKey: partOrderKey })
  if (conversationPartHasDisplay(part)) rebuildTopLevelOrder()
  syncSessionTopLevelVisibility(session)
}

function handlePartDelta(event: any): void {
  const p = propsOf(event)
  const partID = String(p.partID || "")
  const sessionID = String(p.sessionID || "")
  const field = String(p.field || "")
  const delta = typeof p.delta === "string" ? p.delta : ""
  if (!partID || !sessionID || !field) {
    throw new Error("message.part.delta missing partID/sessionID/field")
  }

  const session = requireSessionProjection(sessionID, "message.part.delta")
  const target = requirePartProjection(session, partID, "message.part.delta")

  // Resolve the EXACT card that owns this part. A late delta for an older
  // message turn must land on that turn's card, never on whatever turn is
  // currently active for the session (spec §3.3 — primary failure mode).
  const cardBefore = cardTreeStore.cards[target.cardID]
  const part = cardBefore?.parts?.[target.index]
  const wasHiddenSessionCard = shouldHideSessionCard(cardBefore)
  const sessionWasTopLevelVisible = session.topLevelVisible
  if (field === "raw" && part?.type === "tool") {
    setCardTreeStore(
      "cards",
      target.cardID,
      "parts",
      target.index,
      "state",
      "raw",
      (prev: any) => String(prev ?? "") + delta,
    )
  } else {
    setCardTreeStore(
      "cards",
      target.cardID,
      "parts",
      target.index,
      field as any,
      (prev: any) => String(prev ?? "") + delta,
    )
  }
  markCardStatsDirty(target.cardID)
  const cardAfter = cardTreeStore.cards[target.cardID]
  const isHiddenSessionCard = shouldHideSessionCard(cardAfter)
  if (wasHiddenSessionCard && !isHiddenSessionCard && sessionWasTopLevelVisible) {
    rebuildTopLevelOrder()
  }
  syncSessionTopLevelVisibility(session)
}

function removeCardReferences(cardID: string): void {
  if (cardTreeStore.order.includes(cardID)) {
    replaceCardTreeOrder(cardTreeStore.order.filter((id) => id !== cardID))
  }
  const affectedParents: string[] = []
  setCardTreeStore(
    "cards",
    produce((cards: Record<string, CardNode>) => {
      for (const card of Object.values(cards)) {
        if (!Array.isArray(card.childIDs) || !card.childIDs.includes(cardID)) continue
        card.childIDs = card.childIDs.filter((id) => id !== cardID)
        affectedParents.push(card.id)
      }
      markCardStatsRemoved(cardID)
      delete cards[cardID]
    }),
  )
  // The deleted card's contribution to ancestor aggregates has to be
  // subtracted — mark each parent that just lost this child so the next
  // flushCardStats bubbles the new totals upward.
  for (const parentID of affectedParents) markCardStatsDirty(parentID)
}

function removeIndexedParts(
  session: SessionInfo,
  cardID: string,
  shouldRemove: (part: any, index: number) => boolean,
): number {
  const card = cardTreeStore.cards[cardID]
  const parts = Array.isArray(card?.parts) ? card.parts : []
  const nextParts: any[] = []
  const indexMap = new Map<number, number>()
  let removed = 0
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (shouldRemove(part, i)) {
      removed += 1
      continue
    }
    indexMap.set(i, nextParts.length)
    nextParts.push(part)
  }
  if (removed === 0) return 0
  setCardTreeStore("cards", cardID, "parts", nextParts)
  markCardStatsDirty(cardID)
  for (const [partID, target] of [...session.partIndex]) {
    if (target.cardID !== cardID) continue
    const nextIndex = indexMap.get(target.index)
    if (nextIndex === undefined) {
      session.partIndex.delete(partID)
    } else {
      session.partIndex.set(partID, { cardID, index: nextIndex })
    }
  }
  return removed
}

function cardStillOwnsSessionMessage(session: SessionInfo, cardID: string): boolean {
  for (const mappedCardID of session.messageCardIDs.values()) {
    if (mappedCardID === cardID) return true
  }
  return false
}

function cardCanReceiveSessionLifecycle(session: SessionInfo, cardID: string): boolean {
  const card = cardTreeStore.cards[cardID]
  if (!card) return false
  return card.kind === "agent" && (!card.sessionID || card.sessionID === session.sessionID)
}

function sessionHasExecutableLifecycle(session: SessionInfo): boolean {
  return !isUserStage(session.stage)
}

function sessionLifecycleHasVisiblePreOutput(projected: ProjectedSessionStatus): boolean {
  return projected.cardStatus === "running" || projected.cardStatus === "error"
}

function holdSessionLifecycleForExecutableCard(
  event: any,
  session: SessionInfo,
  projected: ProjectedSessionStatus,
): void {
  if (!projected.sessionID || !projected.inputMessageID) {
    throw new Error("execution lifecycle pending projection requires occurrence identity")
  }
  const pendingKey = `${projected.sessionID}:${projected.inputMessageID}`
  if (!sessionHasExecutableLifecycle(session)) {
    pendingSessionStatus.delete(pendingKey)
    return
  }
  if (sessionLifecycleHasVisiblePreOutput(projected)) {
    materializeLifecycleCard(event, session, projected)
    return
  }
  pendingSessionStatus.set(pendingKey, projected)
}

function advanceActiveOccurrence(
  session: SessionInfo,
  inputMessageID: string,
  orderKey: string,
  cardID?: string,
): void {
  const currentOrderKey = session.activeOccurrenceOrderKey
  if (
    currentOrderKey &&
    compareTimelineOrderKeys(orderKey, currentOrderKey, `active occurrence ${session.sessionID}`) < 0
  ) {
    return
  }
  session.activeOccurrenceInputMessageID = inputMessageID
  session.activeOccurrenceOrderKey = orderKey
  if (cardID) session.activeCardID = cardID
}

function handleMessageRemoved(event: any): void {
  const p = propsOf(event)
  const sessionID = String(p.sessionID || "")
  const messageID = String(p.messageID || "")
  if (!sessionID || !messageID) throw new Error("message.removed missing sessionID/messageID")

  const session = requireSessionProjection(sessionID, "message.removed")
  const cardID = requireMessageCardProjection(session, messageID, "message.removed")

  session.messageIDs.delete(messageID)
  session.messageCardIDs.delete(messageID)
  messages.delete(messageID)
  pendingPartFirstMessages.delete(messageID)

  removeIndexedParts(session, cardID, (part) => String(part?.messageID || "") === messageID)

  if (!cardStillOwnsSessionMessage(session, cardID)) {
    removeCardReferences(cardID)
    if (session.activeCardID === cardID) session.activeCardID = undefined
  }
  regroupTimelineSegments()
  syncSessionTopLevelVisibility(session)
}

function handleMessageMoved(event: any): void {
  const p = propsOf(event)
  const sourceSessionID = String(p.sourceSessionID || "")
  const info = p.info
  const parts = Array.isArray(p.parts) ? p.parts : undefined
  const messageID = String(info?.id || "")
  const targetSessionID = String(info?.sessionID || "")
  if (!sourceSessionID || !messageID || !targetSessionID || !parts) {
    throw new Error("message.moved missing sourceSessionID, target info, or parts")
  }
  if (sourceSessionID === targetSessionID) {
    throw new Error(`message.moved ${messageID} source and target Session must differ`)
  }

  const existing = messages.get(messageID)
  if (existing?.sessionID === sourceSessionID) {
    handleMessageRemoved({
      type: "message.removed",
      properties: { sessionID: sourceSessionID, messageID },
    })
  } else if (existing && existing.sessionID !== targetSessionID) {
    throw new Error(
      `message.moved ${messageID} existing owner ${existing.sessionID} is neither source ${sourceSessionID} nor target ${targetSessionID}`,
    )
  }

  handleMessageUpdated({ ...event, type: "message.updated", properties: { ...p, info } })
  for (const part of parts) {
    handlePartUpdated({
      ...event,
      type: "message.part.updated",
      properties: { ...p, orderKey: info.orderKey, part },
    })
  }
}

function handlePartRemoved(event: any): void {
  const p = propsOf(event)
  const sessionID = String(p.sessionID || "")
  const partID = String(p.partID || "")
  if (!sessionID || !partID) throw new Error("message.part.removed missing sessionID/partID")

  const session = requireSessionProjection(sessionID, "message.part.removed")
  const target = requirePartProjection(session, partID, "message.part.removed")

  removeIndexedParts(session, target.cardID, (_part, index) => index === target.index)
  syncSessionTopLevelVisibility(session)
}

function handleTaskChanged(event: any): void {
  // Source of truth for task.request and interactions is boardStore.board — the
  // live overlay writes to it via applyBoardDelta / loadBoard, tests write via
  // the replay harness. Tree-writer just projects the current boardStore view
  // into cardTreeStore; it does NOT read the event payload directly.
  //
  // Note: orchestrator root session terminal is no longer derived from
  // task.status — every session (including the root) emits its own
  // execution lifecycle terminal when its physical Turn closes.
  void event
  rebuildBoardDerivedCards()
}

/** Map a SessionStatus.Info bus payload onto a CardStatus.
 *  streaming / retry → running (spinner ON, the card is actively working)
 *  idle              → idle (no spinner, "between turns / awaiting input")
 *  terminal.completed → completed
 *  terminal.error → error
 *  terminal.aborted  → completed + terminalReason=aborted (badge renders as
 *                      cancelled, while the card is still non-error terminal) */
function terminalCardProjection(status: any): TerminalCardProjection {
  const reason = String(status?.reason || "")
  if (!Object.prototype.hasOwnProperty.call(terminalCardProjectionByReason, reason)) {
    throw new Error(`agent.execution.lifecycle unknown terminal reason: ${JSON.stringify(status)}`)
  }
  return terminalCardProjectionByReason[reason as SessionTerminalReason]
}

function mapSessionStatusToCardStatus(status: any): CardStatus | undefined {
  const t = String(status?.type || "")
  if (t === "streaming" || t === "retry") return "running"
  if (t === "idle") return "idle"
  if (t === "terminal") return terminalCardProjection(status).cardStatus
  return undefined
}

function projectSessionStatus(event: any): ProjectedSessionStatus {
  const props = propsOf(event)
  const sessionID = String(props.sessionID || "")
  const inputMessageID = String(props.inputMessageID || "")
  if (!sessionID || !inputMessageID) {
    throw new Error("agent.execution.lifecycle missing sessionID/inputMessageID")
  }
  const status = props.status
  const cardStatus = mapSessionStatusToCardStatus(status)
  if (!cardStatus) {
    throw new Error(`agent.execution.lifecycle unknown status shape: ${JSON.stringify(status)}`)
  }
  const projected: ProjectedSessionStatus = { sessionID, inputMessageID, cardStatus }
  if (status?.type === "terminal") {
    projected.terminalReason = terminalCardProjection(status).terminalReason
    projected.timeCompleted = eventEmittedAt(event, "agent.execution.lifecycle terminal")
    if (cardStatus === "error") {
      projected.errorReason = typeof status.error === "string" ? status.error : ""
    }
  }
  return projected
}

function applyProjectedSessionStatus(cardID: string, projected: ProjectedSessionStatus): void {
  if (
    projected.cardStatus === "idle" &&
    cardTreeStore.cards[cardID]?.status === "error" &&
    cardTreeStore.cards[cardID]?.errorReason
  ) {
    return
  }
  setCardTreeStore("cards", cardID, "status", projected.cardStatus)
  if (projected.terminalReason) {
    setCardTreeStore("cards", cardID, "terminalReason", projected.terminalReason)
  }
  if (
    (projected.cardStatus === "completed" || projected.cardStatus === "error") &&
    projected.timeCompleted &&
    !cardTreeStore.cards[cardID]?.timeCompleted
  ) {
    setCardTreeStore("cards", cardID, "timeCompleted", projected.timeCompleted)
  }
  if (projected.errorReason) {
    setCardTreeStore("cards", cardID, "errorReason", projected.errorReason)
  }
}

function applySessionLifecycleProjection(
  session: SessionInfo,
  cardID: string,
  projected: ProjectedSessionStatus,
): void {
  const cardWasHidden = shouldHideSessionCard(cardTreeStore.cards[cardID])
  const sessionWasVisible = session.topLevelVisible
  applyProjectedSessionStatus(cardID, projected)
  const cardIsHidden = shouldHideSessionCard(cardTreeStore.cards[cardID])
  syncSessionTopLevelVisibility(session)
  if (cardWasHidden !== cardIsHidden && sessionWasVisible === session.topLevelVisible) {
    rebuildTopLevelOrder()
  }
}

function handleSessionStatus(event: any): void {
  const props = propsOf(event)
  const sessionID = String(props.sessionID || "")
  if (!sessionID) {
    throw new Error("agent.execution.lifecycle missing sessionID")
  }
  const inputMessageID = String(props.inputMessageID || "")
  if (!inputMessageID) throw new Error("agent.execution.lifecycle missing inputMessageID")
  const lifecycleOrderKey = requireTimelineOrderKeyDomain(
    event?.orderKey,
    `agent.execution.lifecycle ${sessionID}`,
    "session",
  )
  const projected = projectSessionStatus(event)
  if (projected.terminalReason) {
    const reviewID = `integrity:${sessionID}`
    runningReviews.delete(reviewID)
    terminalReviewOrderKeys.set(reviewID, lifecycleOrderKey)
  }
  const info = ensureLifecycleSessionProjection(event, sessionID)
  const occurrenceOwnerCardID = info?.occurrenceCardIDs.get(inputMessageID)
  if (info) advanceActiveOccurrence(info, inputMessageID, lifecycleOrderKey, occurrenceOwnerCardID)
  if (
    info?.activeOccurrenceInputMessageID === inputMessageID &&
    boardStore.selectedSource?.kind === "session" &&
    boardStore.selectedSource.id === sessionID &&
    boardStore.board?.kind === "session" &&
    boardStore.board.sessionID === sessionID
  ) {
    const lifecycleType = String(props.status?.type || "")
    const boardStatus = lifecycleType === "streaming" || lifecycleType === "retry" ? "active" : lifecycleType
    if (boardStatus !== "active" && boardStatus !== "idle" && boardStatus !== "terminal") {
      throw new Error(
        `agent.execution.lifecycle ${sessionID} has unsupported board lifecycle ${lifecycleType || "<missing>"}`,
      )
    }
    setBoardStore("board", "status", boardStatus)
  }
  const pendingKey = `${sessionID}:${inputMessageID}`
  if (!info || !occurrenceOwnerCardID || !cardTreeStore.cards[occurrenceOwnerCardID]) {
    if (info && sessionHasExecutableLifecycle(info)) {
      if (sessionLifecycleHasVisiblePreOutput(projected)) {
        materializeLifecycleCard(event, info, projected)
      } else {
        pendingSessionStatus.set(pendingKey, projected)
      }
    }
    return
  }
  if (!cardCanReceiveSessionLifecycle(info, occurrenceOwnerCardID)) {
    holdSessionLifecycleForExecutableCard(event, info, projected)
    return
  }
  applySessionLifecycleProjection(info, occurrenceOwnerCardID, projected)
}

/** Materialize a real Agent lifecycle card before its first displayable
 * message. Running cards render as the pending thinking row; error cards retain
 * the ordinary diagnostic surface. The same deterministic card is migrated
 * into the first real message turn. */
function materializeLifecycleCard(event: any, session: SessionInfo, projected: ProjectedSessionStatus): void {
  const orderKey = requireTimelineOrderKeyDomain(event?.orderKey, `lifecycle ${session.sessionID}`, "session")
  const inputMessageID = projected.inputMessageID
  if (!inputMessageID) throw new Error(`lifecycle ${session.sessionID} missing execution occurrence identity`)
  const identity = session.occurrenceIdentities.get(inputMessageID)
  if (!identity) throw new Error(`lifecycle ${session.sessionID}/${inputMessageID} missing occurrence identity`)
  const cardID = occurrenceCardID(identity.stage, session.sessionID, inputMessageID)
  if (!cardTreeStore.cards[cardID]) {
    setCardTreeStore(
      "cards",
      cardID,
      createSessionCardNode(
        cardID,
        identity.stage,
        identity.agentID,
        orderKey,
        timelineOrderKeyTime(orderKey, `lifecycle ${session.sessionID}`),
        session.sessionID,
        "",
        [],
        [],
        session.parentSessionID,
      ),
    )
  }
  advanceActiveOccurrence(session, inputMessageID, orderKey, cardID)
  session.occurrenceCardIDs.set(inputMessageID, cardID)
  if (projected.sessionID && projected.inputMessageID) {
    pendingSessionStatus.delete(`${projected.sessionID}:${projected.inputMessageID}`)
  }
  rebuildCardHierarchy()
  applySessionLifecycleProjection(session, cardID, projected)
}

/** Drain any execution lifecycle buffered for this session. Called from
 *  ensureSessionCard after the session is committed, parallel to
 */
function drainPendingSessionStatus(sessionID: string): void {
  const session = sessions.get(sessionID)
  if (!session) return
  for (const [pendingKey, projected] of pendingSessionStatus) {
    if (projected.sessionID !== sessionID || !projected.inputMessageID) continue
    const cardID = session.occurrenceCardIDs.get(projected.inputMessageID)
    if (!cardID || !cardTreeStore.cards[cardID]) continue
    if (!cardCanReceiveSessionLifecycle(session, cardID)) {
      if (!sessionHasExecutableLifecycle(session)) pendingSessionStatus.delete(pendingKey)
      continue
    }
    pendingSessionStatus.delete(pendingKey)
    applySessionLifecycleProjection(session, cardID, projected)
  }
}

function lifecycleStageFromProps(props: Record<string, any>): string {
  const channel = String(props.channel || "").trim()
  if (!channel) throw new Error("tree-writer: lifecycle event is missing channel")
  if (channel === "filtered") throw new Error("tree-writer: retired hidden lifecycle channel is invalid")
  if (channel === "main") return "user"
  return channel
}

/** Index lifecycle metadata. Non-terminal lifecycle events stay buffered
 * until a real message/part materializes the session card; terminal failures
 * materialize a lifecycle card so pre-message startup failures remain visible. */
function ensureLifecycleSessionProjection(event: any, sessionID: string): SessionInfo | undefined {
  const props = propsOf(event)
  const existing = sessions.get(sessionID)
  const stage = lifecycleStageFromProps(props)
  const agentID = String(props.agentID || "").trim()
  if (!agentID) throw new Error(`tree-writer: lifecycle event for ${sessionID} is missing agentID`)
  const parentSessionID = String(props.parentSessionID || "")
  if (existing) {
    if (existing.parentSessionID && parentSessionID && existing.parentSessionID !== parentSessionID) {
      throw new Error(
        `tree-writer: lifecycle session ${sessionID} parentSessionID drift: ${existing.parentSessionID || "<none>"} -> ${parentSessionID || "<none>"}`,
      )
    }
  }
  const session = ensureSessionProjection(sessionID, {
    agentID: isUserStage(stage) ? undefined : agentID,
    stage,
    parentSessionID,
  })
  const inputMessageID = String(props.inputMessageID || "")
  if (!inputMessageID) throw new Error(`tree-writer: lifecycle event for ${sessionID} is missing inputMessageID`)
  const occurrenceIdentity = session.occurrenceIdentities.get(inputMessageID)
  if (occurrenceIdentity && (occurrenceIdentity.agentID !== agentID || occurrenceIdentity.stage !== stage)) {
    throw new Error(`tree-writer: lifecycle occurrence ${inputMessageID} identity changed`)
  }
  session.occurrenceIdentities.set(inputMessageID, { agentID, stage })
  return session
}

function handleInteraction(event: any): void {
  // Interactions are sourced from boardStore.board.interactions, not the event
  // payload — the board routes handle the write, we reproject.
  rebuildBoardDerivedCards()
}

function isSelectedStandaloneSession(sessionID: string): boolean {
  const selected = boardStore.selectedSource
  if (selected?.kind === "session") return selected.id === sessionID
  const board = boardStore.board
  if (board?.kind === "session") return String(board?.sessionID || "") === sessionID
  return false
}

function questionTitle(questions: any[]): string {
  const headers = questions.map((item) => (typeof item?.header === "string" ? item.header.trim() : "")).filter(Boolean)
  return headers.join(" / ") || "Question"
}

function questionBody(questions: any[]): string {
  return questions
    .map((item) => (typeof item?.question === "string" ? item.question.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
}

function standaloneQuestionInteraction(request: any): any {
  const requestID = String(request?.id || "")
  const sessionID = String(request?.sessionID || "")
  if (!requestID || !sessionID) {
    throw new Error("standalone question hydration missing requestID/sessionID")
  }
  const questions = Array.isArray(request?.questions) ? request.questions : []
  if (questions.length === 0) throw new Error(`standalone question ${requestID} missing questions`)
  const orderKey = requireTimelineOrderKeyDomain(request?.orderKey, `standalone question ${requestID}`, "interaction")
  const created = requirePositiveNumber(request?.timeCreated, `standalone question ${requestID} timeCreated`)
  const orderTime = timelineOrderKeyTime(orderKey, `standalone question ${requestID}`)
  if (orderTime !== created) {
    throw new Error(`standalone question ${requestID} orderKey time ${orderTime} does not match timeCreated ${created}`)
  }
  return {
    id: requestID,
    orderKey,
    sessionID,
    type: "question",
    status: "pending",
    title: questionTitle(questions),
    body: questionBody(questions),
    payload: {
      questions,
      ...(request?.tool ? { tool: request.tool } : {}),
      ...(request?.automatic ? { automatic: request.automatic } : {}),
    },
    replyEndpoint: "question",
    time: { created },
  }
}

export function prepareStandaloneQuestionInteractions(requests: any[]): any[] {
  if (!Array.isArray(requests)) throw new Error("standalone question hydration requires an array")
  const prepared: any[] = []
  const requestIDs = new Set<string>()
  for (const request of requests) {
    const interaction = standaloneQuestionInteraction(request)
    if (requestIDs.has(interaction.id)) {
      throw new Error(`standalone question hydration contains duplicate request ${interaction.id}`)
    }
    requestIDs.add(interaction.id)
    prepared.push(interaction)
  }
  return prepared
}

export function commitStandaloneQuestionInteractions(interactions: any[]): void {
  for (const interaction of interactions) {
    standaloneQuestionInteractions.set(interaction.id, interaction)
  }
}

export function hydrateStandaloneQuestionInteractions(requests: any[]): void {
  commitStandaloneQuestionInteractions(prepareStandaloneQuestionInteractions(requests))
}

function handleStandaloneQuestion(event: any): void {
  const type = String(event?.type || "")
  const props = propsOf(event)
  const requestID = String(props.id || props.requestID || "")
  const sessionID = String(props.sessionID || props.session_id || "")
  if (!requestID || !sessionID) {
    throw new Error(`${type} missing requestID/sessionID`)
  }
  const session = sessions.get(sessionID)
  const isKnownMissionSession = session?.stage === "mission"
  if (
    !isSelectedStandaloneSession(sessionID) &&
    !isKnownMissionSession &&
    !standaloneQuestionInteractions.has(requestID)
  ) {
    return
  }

  if (type === "question.asked") {
    standaloneQuestionInteractions.set(
      requestID,
      standaloneQuestionInteraction({ ...props, orderKey: event?.orderKey }),
    )
    regroupTimelineSegments({ deferHierarchy: true })
    rebuildCardHierarchy()
    return
  }

  const existing = standaloneQuestionInteractions.get(requestID)
  if (!existing) return
  const responseOrderKey = requireTimelineOrderKeyDomain(
    event?.orderKey,
    `${type} ${requestID} response`,
    "interaction",
  )
  const resolved = requirePositiveNumber(props.timeResolved, `${type} ${requestID} timeResolved`)
  const responseOrderTime = timelineOrderKeyTime(responseOrderKey, `${type} ${requestID} response`)
  if (responseOrderTime !== resolved) {
    throw new Error(
      `${type} ${requestID} response orderKey time ${responseOrderTime} does not match timeResolved ${resolved}`,
    )
  }
  standaloneQuestionInteractions.set(requestID, {
    ...existing,
    status: type === "question.rejected" ? "rejected" : "answered",
    responseOrderKey,
    response: type === "question.replied" ? { answers: Array.isArray(props.answers) ? props.answers : [] } : {},
    time: {
      ...(existing.time || {}),
      resolved,
    },
  })
  regroupTimelineSegments({ deferHierarchy: true })
  rebuildCardHierarchy()
}

// ── Shared review stream + completed review bodies ──

function integrityCardID(sessionID: string): string {
  return sessionCardID("integrity", sessionID)
}

type ReviewStreamPhase = "integrity"
type ReviewStreamStep = "manifest" | "runtime" | "visual" | "specialist" | "agent" | "post_repair"

interface RunningReviewPayload {
  taskID: string
  reviewID: string
  phase: ReviewStreamPhase
  sessionID?: string
  agentID: string
  orderKey: string
  startedAt: number
  attempt: number
  elapsedMs: number
  currentStep?: ReviewStreamStep
  activity?: string
  reviewerID?: string
  roundID?: string
  summary?: string
}
const runningReviews = new Map<string, RunningReviewPayload>()
/** Canonical Session lifecycle terminal tombstones. They prevent delayed
 * review-stream events from recreating a running review after its occurrence
 * has ended; a genuinely later review.started opens the next occurrence. */
const terminalReviewOrderKeys = new Map<string, string>()

function acceptReviewEvent(reviewID: string, orderKey: string, opensOccurrence = false): boolean {
  const terminalOrderKey = terminalReviewOrderKeys.get(reviewID)
  if (terminalOrderKey) {
    if (!opensOccurrence) return false
    if (compareTimelineOrderKeys(orderKey, terminalOrderKey, `review ${reviewID} terminal`) <= 0) return false
    terminalReviewOrderKeys.delete(reviewID)
  }
  const active = runningReviews.get(reviewID)
  return !active || compareTimelineOrderKeys(orderKey, active.orderKey, `review ${reviewID} active`) >= 0
}

function normalizeReviewPhase(raw: string): ReviewStreamPhase {
  if (raw === "integrity") return raw
  throw new Error(`review.stream phase unsupported: ${raw}`)
}

function normalizeReviewStep(raw: string): ReviewStreamStep | undefined {
  if (!raw) return undefined
  if (
    raw === "manifest" ||
    raw === "runtime" ||
    raw === "visual" ||
    raw === "specialist" ||
    raw === "agent" ||
    raw === "post_repair"
  )
    return raw
  throw new Error(`review.stream progress currentStep unsupported: ${raw}`)
}

function reviewCardID(p: Pick<RunningReviewPayload, "phase" | "reviewID" | "sessionID">): string {
  if (!p.sessionID) throw new Error(`review.stream.${p.phase} missing sessionID (reviewID=${p.reviewID})`)
  return integrityCardID(p.sessionID)
}

function eventEmittedAt(event: any, context?: string): number {
  const emittedAt = Number(event?.emittedAt || event?.emitted_at || event?.timestamp || 0)
  if (Number.isFinite(emittedAt) && emittedAt > 0) return emittedAt
  const eventType = context || String(event?.type || "event")
  throw new Error(`${eventType} missing emittedAt/timestamp; server emitter is the single source of truth`)
}

function integritySessionIDFromReviewID(reviewID: string): string | undefined {
  const prefix = "integrity:"
  if (!reviewID.startsWith(prefix)) return undefined
  const sessionID = reviewID.slice(prefix.length)
  return sessionID.startsWith("ses") ? sessionID : undefined
}

function requireExactReviewAgentID(value: unknown, reviewID: string): string {
  const agentID = String(value || "").trim()
  if (!agentID) throw new Error(`review stream ${reviewID} missing exact agentID`)
  return agentID
}

function reconstructRunningIntegrityReview(input: {
  taskID: string
  reviewID: string
  phase: ReviewStreamPhase
  event: any
  attempt: number
  elapsedMs?: number
  agentID: string
}): RunningReviewPayload | undefined {
  if (input.phase !== "integrity") return undefined
  const sessionID = integritySessionIDFromReviewID(input.reviewID)
  if (!sessionID) return undefined
  const elapsedMs = Math.max(0, Number(input.elapsedMs || 0))
  const payload: RunningReviewPayload = {
    taskID: input.taskID,
    reviewID: input.reviewID,
    phase: input.phase,
    sessionID,
    agentID: input.agentID,
    orderKey: requireTimelineOrderKey(input.event?.orderKey, `review.stream.${input.phase} ${input.reviewID}`),
    startedAt: Math.max(1, eventEmittedAt(input.event, `review.stream.${input.phase} ${input.reviewID}`) - elapsedMs),
    attempt: input.attempt,
    elapsedMs,
  }
  materializeRunningReview(payload)
  runningReviews.set(input.reviewID, payload)
  return payload
}

function ensureIntegrityReviewProjection(input: {
  taskID: string
  reviewID: string
  phase: ReviewStreamPhase
  event: any
  attempt: number
  elapsedMs?: number
  agentID: string
}): RunningReviewPayload | undefined {
  const exactAgentID = requireExactReviewAgentID(input.agentID, input.reviewID)
  const existing = runningReviews.get(input.reviewID)
  if (existing) {
    if (existing.agentID !== exactAgentID) {
      throw new Error(`review stream ${input.reviewID} agentID drift: ${existing.agentID} -> ${exactAgentID}`)
    }
    return existing
  }
  return reconstructRunningIntegrityReview({ ...input, agentID: exactAgentID })
}

function handleReviewStreamStarted(event: any): void {
  const props = propsOf(event)
  const taskID = String(props.taskID || "")
  const reviewID = String(props.reviewID || "")
  const phase = normalizeReviewPhase(String(props.phase || ""))
  const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
  if (!taskID) throw new Error("review.stream.started missing taskID")
  if (!reviewID) throw new Error(`review.stream.started missing reviewID (taskID=${taskID})`)
  const agentID = requireExactReviewAgentID(props.agentID, reviewID)
  if (phase === "integrity" && !sessionID)
    throw new Error(`review.stream.started integrity missing sessionID (taskID=${taskID})`)
  const orderKey = requireTimelineOrderKey(event?.orderKey, `review.stream.started ${reviewID}`)
  if (!acceptReviewEvent(reviewID, orderKey, true)) return
  const payload: RunningReviewPayload = {
    taskID,
    reviewID,
    phase,
    sessionID,
    agentID,
    orderKey,
    startedAt: eventEmittedAt(event, `review.stream.started ${reviewID}`),
    attempt: 0,
    elapsedMs: 0,
  }
  const existing = runningReviews.get(reviewID)
  if (existing && existing.agentID !== agentID) {
    throw new Error(`review stream ${reviewID} agentID drift: ${existing.agentID} -> ${agentID}`)
  }
  materializeRunningReview(payload)
  runningReviews.set(reviewID, payload)
}

function handleReviewStreamProgress(event: any): void {
  const props = propsOf(event)
  const taskID = String(props.taskID || "")
  const reviewID = String(props.reviewID || "")
  const phase = normalizeReviewPhase(String(props.phase || ""))
  if (!taskID) throw new Error("review.stream.progress missing taskID")
  if (!reviewID) throw new Error(`review.stream.progress missing reviewID (taskID=${taskID})`)
  const attempt = Number(props.attempt || 0)
  const elapsedMs = Number(props.elapsedMs || props.elapsed_ms || 0)
  const agentID = requireExactReviewAgentID(props.agentID, reviewID)
  const orderKey = requireTimelineOrderKey(event?.orderKey, `review.stream.progress ${reviewID}`)
  if (!acceptReviewEvent(reviewID, orderKey)) return
  const existing = ensureIntegrityReviewProjection({
    taskID,
    reviewID,
    phase,
    event,
    attempt,
    elapsedMs,
    agentID,
  })
  if (!existing) {
    throw new Error(`review.stream.progress arrived before started (taskID=${taskID}, reviewID=${reviewID})`)
  }
  const payload: RunningReviewPayload = {
    ...existing,
    taskID,
    reviewID,
    phase,
    orderKey,
    startedAt: existing.startedAt,
    attempt,
    elapsedMs,
    currentStep: normalizeReviewStep(String(props.currentStep || props.current_step || "")),
    activity: typeof props.activity === "string" ? props.activity : undefined,
    reviewerID: typeof props.reviewerID === "string" ? props.reviewerID : undefined,
    roundID: typeof props.roundID === "string" ? props.roundID : undefined,
    summary: typeof props.summary === "string" ? props.summary : undefined,
  }
  materializeRunningReview(payload)
  runningReviews.set(reviewID, payload)
}

function handleReviewStreamChunk(event: any): void {
  const props = propsOf(event)
  const taskID = String(props.taskID || "")
  const reviewID = String(props.reviewID || "")
  const phase = normalizeReviewPhase(String(props.phase || ""))
  if (!taskID) throw new Error("review.stream.chunk missing taskID")
  if (!reviewID) throw new Error(`review.stream.chunk missing reviewID (taskID=${taskID})`)
  const kind = String(props.kind || "")
  const delta = String(props.delta || "")
  const attempt = Number(props.attempt || 1)
  const agentID = requireExactReviewAgentID(props.agentID, reviewID)
  const orderKey = requireTimelineOrderKey(event?.orderKey, `review.stream.chunk ${reviewID}`)
  if (!acceptReviewEvent(reviewID, orderKey)) return
  if (kind !== "reasoning") {
    throw new Error(`review.stream.chunk unexpected kind: ${kind}`)
  }
  if (!delta) return

  const running = ensureIntegrityReviewProjection({
    taskID,
    reviewID,
    phase,
    event,
    attempt,
    agentID,
  })
  if (!running) {
    throw new Error(`review.stream.chunk arrived before started (taskID=${taskID}, reviewID=${reviewID})`)
  }
  const cardID = reviewCardID({ ...running, phase })
  const existing = cardTreeStore.cards[cardID]
  if (!existing) {
    throw new Error(`review.stream.chunk missing materialized card (taskID=${taskID}, reviewID=${reviewID})`)
  }

  const partID = `review:${reviewID}:reasoning:${attempt}`

  setCardTreeStore(
    "cards",
    cardID,
    "parts",
    produce((parts: any[]) => {
      const idx = parts.findIndex((p) => p?.partID === partID)
      if (idx >= 0) {
        parts[idx].text = String(parts[idx].text || "") + delta
      } else {
        parts.push({
          type: "reasoning",
          partID,
          orderKey: requireTimelineOrderKey(event?.orderKey, partID),
          text: delta,
        })
      }
    }),
  )
  markCardStatsDirty(cardID)
  rebuildTopLevelOrder()
}

/** Integrity is a real session, but its reasoning/verdict reach the overlay
 *  through `integrity.review.*` events (NOT `message.updated`), so there is
 *  no durable messageID to scope a message-turn card by. It therefore keeps
 *  a single dedicated card id (`integrity:session:<sid>`). We still register
 *  a SessionInfo so execution lifecycle / usage routing (active turn card) works
 *  uniformly — `activeCardID` is pinned to the dedicated card. */
function ensureIntegritySession(
  sessionID: string,
  agentID: string,
  orderKey: string,
  time: number,
): { session: SessionInfo; cardID: string } {
  const exactAgentID = agentID.trim()
  if (!exactAgentID) throw new Error(`integrity session ${sessionID} missing exact agentID`)
  const session = ensureSessionProjection(sessionID, {
    agentID: exactAgentID,
    stage: "integrity",
    parentSessionID: "",
  })
  const cardID = sessionCardID("integrity", sessionID)
  const created = !cardTreeStore.cards[cardID]
  if (created) {
    setCardTreeStore(
      "cards",
      cardID,
      createSessionCardNode(cardID, "integrity", exactAgentID, orderKey, time, sessionID, ""),
    )
  } else if (cardTreeStore.cards[cardID]?.agentID !== exactAgentID) {
    throw new Error(
      `integrity session ${sessionID} agentID drift: ${String(cardTreeStore.cards[cardID]?.agentID || "<missing>")} -> ${exactAgentID}`,
    )
  }
  session.activeCardID = cardID
  if (created) {
    rebuildCardHierarchy()
    drainPendingSessionStatus(sessionID)
  }
  return { session, cardID }
}

/** Upsert the running-phase integrity session card. Integrity is now a normal
 *  agent session, so lifecycle events target the session card directly. */
function materializeRunningReview(p: RunningReviewPayload): void {
  if (!p.sessionID) throw new Error(`review.stream integrity missing sessionID (reviewID=${p.reviewID})`)
  materializeRunningIntegrity({
    taskID: p.taskID,
    reviewID: p.reviewID,
    sessionID: p.sessionID,
    agentID: p.agentID,
    orderKey: p.orderKey,
    startedAt: p.startedAt,
    attempt: p.attempt,
    elapsedMs: p.elapsedMs,
    phase: p.phase,
    currentStep: p.currentStep,
    activity: p.activity,
    reviewerID: p.reviewerID,
    roundID: p.roundID,
    summary: p.summary,
  })
}

function materializeRunningIntegrity(p: RunningReviewPayload & { sessionID: string }): void {
  const { cardID } = ensureIntegritySession(p.sessionID, p.agentID, p.orderKey, p.startedAt)
  const existing = cardTreeStore.cards[cardID]
  // Subtitle carries only the retry attempt label (when applicable).
  // The live elapsed-time display is owned by CardHeader's
  // `.card__duration` chip, which subtracts `time` from a shared 1Hz
  // tick (services/clock.ts). `p.elapsedMs` stays on the payload
  // because it still reconstructs `startedAt` on SSE replay above.
  const subtitle = p.attempt > 0 ? t("integrity.attempt_label", { value: String(p.attempt) }) : undefined
  // Progress ticks every 20s. If the card already exists, patch only the
  // volatile fields (status + subtitle) — writing a fresh card with
  // `parts: []` would wipe any reasoning/tool_input chunks that have
  // streamed in between two Progress events.
  if (existing) {
    setCardTreeStore("cards", cardID, {
      ...existing,
      status: "running",
      subtitle,
      stage: "integrity",
      accent: stageAccent("integrity"),
      title: roleTitleKey("integrity"),
      reviewStream: {
        phase: "integrity",
        currentStep: p.currentStep,
        activity: p.activity,
        reviewerID: p.reviewerID,
        roundID: p.roundID,
        elapsedMs: p.elapsedMs,
        summary: p.summary,
      },
    })
    return
  }
  throw new Error(`integrity session card missing after ensureIntegritySession (sessionID=${p.sessionID})`)
}

// ── Session & part bookkeeping ──

function deriveRuntimeSessionStage(channelInput: unknown): string {
  const channel = String(channelInput || "").trim()
  if (!channel) throw new Error("tree-writer: message is missing channel")
  if (channel === "main") return "user"
  if (channel === "filtered") throw new Error("tree-writer: retired hidden message channel is invalid")
  return channel
}

function deriveSessionStage(origin: MessageOrigin): string {
  // `channel` is the single authoritative signal stamped by the backend
  // bridge (task-message-protocol-bridge.overlayMeta). It is derived from
  // the session's DB `kind` plus the message role, so every semantically
  // distinct bubble already has a correct stage at the source.
  //
  // Reading this as a cascading derivation (channel → agent → resolvedRole →
  // role) previously routed root-session user messages to stage="build"
  // because `info.agent` on user rows is a Primary assistant identity. That
  // cascade conflated runtime identity with session kind and turned a user
  // bubble into a worker-stage card.
  //
  // Channel values:
  //   "main"      → root-session user bubble → stage "user"
  //   SessionKind → stage = kind (build / requirements / architect / ...)
  //   missing     → bridge bug — fail loud, do not guess
  return conversationMessageDisplayStage(origin)
}

function requireCanonicalMessageAgentID(
  value: unknown,
  origin: { role: string; author: string },
  messageID: string,
): string {
  const agentID = String(value || "").trim()
  if (!agentID) {
    throw new Error(`tree-writer: message ${messageID} missing canonical agentID`)
  }
  if (origin.role !== "user" && origin.author !== agentID) {
    throw new Error(
      `tree-writer: message ${messageID} author ${origin.author} does not match canonical agentID ${agentID}`,
    )
  }
  return agentID
}

function requireMessageOrigin(
  info: any,
  messageID: string,
): {
  role: string
  author: string
  channel: string
  source: string
} {
  const role = String(info?.role || "").trim()
  const author = String(info?.author || "").trim()
  const channel = String(info?.channel || "").trim()
  if (!role || !author || !channel) {
    throw new Error(
      `tree-writer: message ${messageID} missing role/author/channel; backend bridge must preserve persisted origin`,
    )
  }
  if (typeof info?.originSource !== "string") {
    throw new Error(
      `tree-writer: message ${messageID} missing originSource; backend bridge must normalize persisted source`,
    )
  }
  const source = info.originSource.trim()
  const persistedSource = info?.extra?.source
  if (persistedSource !== undefined && String(persistedSource).trim() !== source) {
    throw new Error(`tree-writer: message ${messageID} originSource conflicts with persisted extra.source`)
  }
  return { role, author, channel, source }
}

function displayRoleForResolvedRole(resolvedRole: string): string {
  return resolvedRole
}

interface EnsureSessionOpts {
  agentID?: string
  stage: string
  parentSessionID: string
}

/** Register / backfill the runtime session index. NEVER creates a display
 *  card — display identity is per message turn, not per session (spec
 *  §2.3). `ensureMessageTurnProjection` owns card creation. */
function ensureSessionProjection(sessionID: string, opts: EnsureSessionOpts): SessionInfo {
  const existing = sessions.get(sessionID)
  if (existing) {
    if (!existing.agentID && opts.agentID) existing.agentID = opts.agentID
    if (!existing.stage && opts.stage) existing.stage = opts.stage
    if (!existing.parentSessionID && opts.parentSessionID) {
      existing.parentSessionID = opts.parentSessionID
      rebuildCardHierarchy()
    }
    return existing
  }
  const info: SessionInfo = {
    sessionID,
    agentID: opts.agentID,
    stage: opts.stage || "",
    parentSessionID: opts.parentSessionID || "",
    messageIDs: new Set(),
    messageCardIDs: new Map(),
    occurrenceCardIDs: new Map(),
    occurrenceIdentities: new Map(),
    partIndex: new Map(),
    topLevelVisible: false,
    messageUsage: new Map(),
    messageModels: new Map(),
  }
  sessions.set(sessionID, info)
  return info
}

interface EnsureTurnCardOpts {
  stage: string
  agentID?: string
  collapseContext: boolean
  orderKey: string
  time: number
  /** message.updated carries the authoritative server time; a part-before-
   *  message projection uses the backend message orderKey time and must not
   *  overwrite a server time already on the card. */
  stampServerTime: boolean
  /** Hydrate replays many turns then rebuilds once at the end. */
  deferHierarchy?: boolean
  occurrenceInputMessageID?: string
}

function migrateLifecycleCardToTurnCard(
  session: SessionInfo,
  fromCardID: string,
  toCardID: string,
  messageID: string,
  orderKey: string,
  time: number,
): void {
  if (fromCardID === toCardID || !cardTreeStore.cards[fromCardID] || cardTreeStore.cards[toCardID]) return
  setCardTreeStore(
    "cards",
    produce((cards: Record<string, CardNode>) => {
      const from = cards[fromCardID]
      if (!from) return
      cards[toCardID] = {
        ...from,
        id: toCardID,
        messageID,
        orderKey,
        time,
      }
      markCardStatsRemoved(fromCardID)
      delete cards[fromCardID]
    }),
  )
  markCardStatsDirty(toCardID)
  if (session.activeCardID === fromCardID) session.activeCardID = toCardID
  for (const [inputMessageID, occurrenceOwnerCardID] of session.occurrenceCardIDs) {
    if (occurrenceOwnerCardID === fromCardID) session.occurrenceCardIDs.set(inputMessageID, toCardID)
  }
}

/** Create or refresh the ordinary display card for one message turn and
 *  point the session's active pointers at it. */
function ensureMessageTurnProjection(session: SessionInfo, messageID: string, opts: EnsureTurnCardOpts): string {
  const stage = opts.stage || session.stage || ""
  if (!isUserStage(stage) && !opts.agentID) {
    throw new Error(`message ${messageID} agent turn requires canonical agentID`)
  }
  const canonicalCardID = messageTurnCardID(stage, session.sessionID, messageID)
  let cardID = canonicalCardID
  const activeOccurrenceInputMessageID = opts.occurrenceInputMessageID ?? session.activeOccurrenceInputMessageID
  const lifecycleCardID = activeOccurrenceInputMessageID
    ? occurrenceCardID(stage, session.sessionID, activeOccurrenceInputMessageID)
    : sessionCardID(stage, session.sessionID)
  const preserveDedicatedLifecycleCard = stage === "integrity" && Boolean(cardTreeStore.cards[lifecycleCardID])

  const prior = session.messageCardIDs.get(messageID)
  if (prior) cardID = prior

  if (preserveDedicatedLifecycleCard) {
    session.messageCardIDs.set(messageID, lifecycleCardID)
    session.activeMessageID = messageID
    session.activeCardID = lifecycleCardID
    if (!opts.deferHierarchy) rebuildCardHierarchy()
    return lifecycleCardID
  }

  if (!prior && lifecycleCardID !== cardID && cardTreeStore.cards[lifecycleCardID]) {
    migrateLifecycleCardToTurnCard(session, lifecycleCardID, cardID, messageID, opts.orderKey, opts.time)
  }
  const existing = cardTreeStore.cards[cardID]
  if (existing) {
    setCardTreeStore("cards", cardID, "sessionID", session.sessionID)
    if (existing.parentSessionID !== session.parentSessionID) {
      setCardTreeStore("cards", cardID, "parentSessionID", session.parentSessionID || undefined)
    }
    if (!isUserStage(stage) && existing.agentID !== opts.agentID) {
      setCardTreeStore("cards", cardID, "agentID", opts.agentID)
    }
    if (!existing.messageID) setCardTreeStore("cards", cardID, "messageID", messageID)
    if (existing.orderKey !== opts.orderKey) setCardTreeStore("cards", cardID, "orderKey", opts.orderKey)
    if (opts.stampServerTime && prior && existing.messageID === messageID && existing.time !== opts.time) {
      setCardTreeStore("cards", cardID, "time", opts.time)
      markCardStatsDirty(cardID)
    }
    if (!existing.terminalReason) {
      setCardTreeStore("cards", cardID, "status", initialSessionCardStatus(stage))
    }
  } else {
    setCardTreeStore(
      "cards",
      cardID,
      createSessionCardNode(
        cardID,
        stage,
        opts.agentID,
        opts.orderKey,
        opts.time,
        session.sessionID,
        messageID,
        [],
        [],
        session.parentSessionID,
      ),
    )
  }
  // Freeze the previous still-running turn: a newer real message in the
  // same session means the older turn is no longer the active stream.
  const prevCardID = session.activeCardID
  if (prevCardID && prevCardID !== cardID && cardTreeStore.cards[prevCardID]?.status === "running") {
    setCardTreeStore("cards", prevCardID, "status", "completed")
  }

  const projectedCard = cardTreeStore.cards[cardID]
  if (projectedCard) {
    const collapsed = new Set(projectedCard.collapsedContextMessageIDs || [])
    if (opts.collapseContext) collapsed.add(messageID)
    else collapsed.delete(messageID)
    setCardTreeStore("cards", cardID, "collapsedContextMessageIDs", [...collapsed])
  }

  session.messageCardIDs.set(messageID, cardID)
  if (opts.occurrenceInputMessageID) {
    session.occurrenceCardIDs.set(opts.occurrenceInputMessageID, cardID)
    advanceActiveOccurrence(session, opts.occurrenceInputMessageID, opts.orderKey, cardID)
  }
  session.activeMessageID = messageID
  if (!preserveDedicatedLifecycleCard && !opts.occurrenceInputMessageID) session.activeCardID = cardID

  if (!opts.deferHierarchy) rebuildCardHierarchy()
  return cardID
}

interface TimelineSegment {
  key: string
  cardID: string
  session: SessionInfo
  stage: string
  messages: MessageInfo[]
}

type TimelineProjectionItem = { orderKey: string; message: MessageInfo }

function messageTimeOrder(left: MessageInfo, right: MessageInfo): number {
  return compareTimelineOrderKeys(left.orderKey, right.orderKey, "message timeline")
}

function isMessageTurnCardID(cardID: string): boolean {
  return cardID.includes(":session:") && cardID.includes(":message:")
}

function timelineCardID(stage: string, sessionID: string, messageID: string): string {
  return messageTurnCardID(stage, sessionID, messageID)
}

function timelineSegmentKey(message: MessageInfo, session: SessionInfo, stage: string): string {
  return JSON.stringify({
    placement: "top_level",
    sessionID: message.sessionID,
    agentID: isUserStage(stage) ? "" : message.agentID,
    stage,
    parentSessionID: message.parentSessionID || session.parentSessionID || "",
  })
}

function timelineProjectionItemOrder(left: TimelineProjectionItem, right: TimelineProjectionItem): number {
  const byOrderKey = compareTimelineOrderKeys(left.orderKey, right.orderKey, "visible message segment")
  if (byOrderKey !== 0) return byOrderKey
  const leftID = left.message.id
  const rightID = right.message.id
  return leftID < rightID ? -1 : leftID > rightID ? 1 : 0
}

export interface RenderedConversationCardTarget {
  cardID?: string
  renderedCardID: string
  orderKey: string
  time: number
  sessionID?: string
  messageID?: string
}

function renderedCardTargetFromProjectedCardID(
  cardID: string,
  source: {
    orderKey: string
    time: number
    sessionID?: string
    messageID?: string
  },
): RenderedConversationCardTarget | null {
  const card = cardTreeStore.cards[cardID]
  if (!card) return null
  const orderKey = requireTimelineOrderKey(source.orderKey, `rendered conversation card ${cardID}`)
  const time = requirePositiveNumber(source.time, `rendered conversation card ${cardID} time`)
  return {
    renderedCardID: cardID,
    orderKey,
    time,
    ...(source?.sessionID ? { sessionID: source.sessionID } : {}),
    ...(source?.messageID ? { messageID: source.messageID } : {}),
  }
}

function cardIsRenderedReachable(cardID: string): boolean {
  const targetCardID = String(cardID || "")
  if (!targetCardID) return false
  const seen = new Set<string>()
  const visit = (id: string): boolean => {
    if (!id || seen.has(id)) return false
    seen.add(id)
    if (id === targetCardID) return true
    const card = cardTreeStore.cards[id]
    if (!card) return false
    for (const childID of card.childIDs || []) {
      if (visit(childID)) return true
    }
    return false
  }
  for (const id of cardTreeStore.order) {
    if (visit(id)) return true
  }
  return false
}

export function renderedConversationCardTargetForMessage(
  messageIDInput: string,
): RenderedConversationCardTarget | null {
  const messageID = String(messageIDInput || "")
  if (!messageID) return null
  const message = messages.get(messageID) ?? pendingPartFirstMessages.get(messageID)
  if (!message) return null
  const session = sessions.get(message.sessionID)
  const cardID = session?.messageCardIDs.get(messageID)
  if (!cardID) return null
  const card = cardTreeStore.cards[cardID]
  if (!card) return null
  if (!cardIsRenderedReachable(cardID)) return null
  return renderedCardTargetFromProjectedCardID(cardID, {
    orderKey: message.orderKey,
    time: message.time,
    sessionID: message.sessionID,
    messageID,
  })
}

function isReviewStreamPart(part: any): boolean {
  return String(part?.partID || "").startsWith("review:integrity:")
}

/** Boundary rows are rebuilt as fresh objects on every regroup and carry a
 *  translated label, so they are compared by value. Every other part is carried
 *  over by reference from the card it already lives in. */
function projectedPartIsUnchanged(existing: any, next: any): boolean {
  if (existing === next) return true
  if (!isBoundaryMessagePart(existing) || !isBoundaryMessagePart(next)) return false
  return (
    existing.messageID === next.messageID &&
    existing.role === next.role &&
    existing.roleLabel === next.roleLabel &&
    existing.time === next.time
  )
}

/** True when the card already in the store is exactly what this regroup derived. */
function projectedCardIsUnchanged(
  existing: CardNode,
  fields: {
    sessionID: string
    parentSessionID: string | undefined
    agentID: string | undefined
    messageID: string
    stage: string
    accent: string | undefined
    title: string
    orderKey: string
    time: number
    status: CardStatus
    collapsedContextMessageIDs: string[]
  },
  parts: readonly any[],
): boolean {
  const current = existing as Record<string, any>
  if (
    current.sessionID !== fields.sessionID ||
    current.parentSessionID !== fields.parentSessionID ||
    current.agentID !== fields.agentID ||
    current.messageID !== fields.messageID ||
    current.stage !== fields.stage ||
    current.accent !== fields.accent ||
    current.title !== fields.title ||
    current.orderKey !== fields.orderKey ||
    current.time !== fields.time ||
    current.status !== fields.status
  ) {
    return false
  }
  const collapsed = existing.collapsedContextMessageIDs ?? []
  if (collapsed.length !== fields.collapsedContextMessageIDs.length) return false
  for (let index = 0; index < collapsed.length; index += 1) {
    if (collapsed[index] !== fields.collapsedContextMessageIDs[index]) return false
  }
  const currentParts = existing.parts ?? []
  if (currentParts.length !== parts.length) return false
  for (let index = 0; index < currentParts.length; index += 1) {
    if (!projectedPartIsUnchanged(currentParts[index], parts[index])) return false
  }
  return true
}

function collectTimelineParts(messageIDs: Set<string>): Map<string, any[]> {
  const byMessage = new Map<string, any[]>()
  const seenPartIDs = new Set<string>()
  for (const card of Object.values(cardTreeStore.cards)) {
    for (const part of card?.parts || []) {
      if (!part || isBoundaryMessagePart(part)) continue
      if (!conversationPartIsProjectable(part)) continue
      const messageID = String(part.messageID || "")
      if (!messageIDs.has(messageID)) continue
      const partID = String(part.id || "")
      if (partID && seenPartIDs.has(partID)) continue
      if (partID) seenPartIDs.add(partID)
      const list = byMessage.get(messageID)
      if (list) list.push(part)
      else byMessage.set(messageID, [part])
    }
  }
  for (const [messageID, parts] of byMessage) {
    parts.sort((left, right) => compareTimelineOrderKeys(left.orderKey, right.orderKey, `message ${messageID} parts`))
  }
  return byMessage
}

function clearTimelinePartIndexes(messageIDs: Set<string>): void {
  for (const session of sessions.values()) {
    for (const [partID, target] of [...session.partIndex]) {
      const part = cardTreeStore.cards[target.cardID]?.parts?.[target.index]
      const indexedMessageID =
        part?.messageID || (partID.startsWith("__boundary__:") ? partID.slice(partID.lastIndexOf(":") + 1) : "")
      if (messageIDs.has(String(indexedMessageID || ""))) {
        session.partIndex.delete(partID)
      }
    }
  }
}

function clearMessageCardOwnershipForCard(cardID: string): void {
  for (const session of sessions.values()) {
    for (const [messageID, mappedCardID] of [...session.messageCardIDs]) {
      if (mappedCardID === cardID) session.messageCardIDs.delete(messageID)
    }
    for (const [inputMessageID, mappedCardID] of [...session.occurrenceCardIDs]) {
      if (mappedCardID === cardID) session.occurrenceCardIDs.delete(inputMessageID)
    }
    if (session.activeCardID === cardID) {
      session.activeCardID = undefined
      session.activeMessageID = undefined
    }
  }
}

/** Rebuild ordinary message segment card ownership from the authoritative
 *  message timeline. Live `message.*` events are ephemeral and can arrive
 *  out of chronological order. Only an immediately adjacent message with
 *  the same segment key is absorbed into the previous segment card. */
function regroupTimelineSegments(opts: { deferHierarchy?: boolean } = {}): void {
  if (projectionDeferralDepth > 0) {
    deferredTimelineRegroup = true
    if (!opts.deferHierarchy) deferredHierarchyRebuild = true
    return
  }
  const timelineMessages = new Map<string, MessageInfo>()
  for (const message of pendingPartFirstMessages.values()) timelineMessages.set(message.id, message)
  for (const message of messages.values()) timelineMessages.set(message.id, message)
  const ordered = [...timelineMessages.values()]
    .filter((message) => sessions.has(message.sessionID))
    .sort(messageTimeOrder)
  if (ordered.length === 0) return
  const projectionItems: TimelineProjectionItem[] = []
  for (const message of ordered) {
    const session = sessions.get(message.sessionID)
    if (!session) continue
    projectionItems.push({ orderKey: message.orderKey, message })
  }
  projectionItems.sort(timelineProjectionItemOrder)
  const interactionBoundaryKeys = conversationInteractions(boardStore.board)
    .flatMap((interaction) => interactionToCardSeeds(interaction))
    .map((seed) => seed.info.orderKey)
    .sort((left, right) => compareTimelineOrderKeys(left, right, "interaction segment boundary"))

  const segments: TimelineSegment[] = []
  const desiredCardByMessage = new Map<string, string>()
  const targetMessageIDs = new Set<string>()
  let previousAdjacentSegment: TimelineSegment | undefined
  let previousMessageOrderKey = ""

  for (const item of projectionItems) {
    const message = item.message
    const session = sessions.get(message.sessionID)
    if (!session) continue
    const stage = message.stage || session.stage
    const key = timelineSegmentKey(message, session, stage)
    const interactionBreaksAdjacency =
      previousMessageOrderKey.length > 0 &&
      interactionBoundaryKeys.some(
        (boundaryKey) =>
          compareTimelineOrderKeys(previousMessageOrderKey, boundaryKey, "interaction boundary start") < 0 &&
          compareTimelineOrderKeys(boundaryKey, message.orderKey, "interaction boundary end") < 0,
      )
    let segment =
      !interactionBreaksAdjacency && previousAdjacentSegment?.key === key ? previousAdjacentSegment : undefined
    if (!segment) {
      const cardID = timelineCardID(stage, message.sessionID, message.id)
      segment = { key, cardID, session, stage, messages: [] }
      segments.push(segment)
    }
    previousAdjacentSegment = segment
    segment.messages.push(message)
    desiredCardByMessage.set(message.id, segment.cardID)
    targetMessageIDs.add(message.id)
    previousMessageOrderKey = message.orderKey
  }
  if (segments.length === 0) return

  const oldOwnedCardIDs = new Set<string>()
  for (const session of sessions.values()) {
    for (const [messageID, cardID] of session.messageCardIDs) {
      if (isMessageTurnCardID(cardID)) oldOwnedCardIDs.add(cardID)
    }
  }

  const partsByMessage = collectTimelineParts(targetMessageIDs)
  clearTimelinePartIndexes(targetMessageIDs)

  const activeBySession = new Map<string, { messageID: string; cardID: string; orderKey: string }>()
  for (const message of ordered) {
    const cardID = desiredCardByMessage.get(message.id)
    if (!cardID) continue
    const current = activeBySession.get(message.sessionID)
    if (!current || compareTimelineOrderKeys(message.orderKey, current.orderKey, "active session message") >= 0) {
      activeBySession.set(message.sessionID, { messageID: message.id, cardID, orderKey: message.orderKey })
    }
  }

  for (const [messageID, cardID] of desiredCardByMessage) {
    const message = timelineMessages.get(messageID)
    const session = message ? sessions.get(message.sessionID) : undefined
    if (session && message) {
      session.messageCardIDs.set(messageID, cardID)
      const occurrenceInputMessageID = message.role === "user" ? message.id : message.parentMessageID
      if (occurrenceInputMessageID) session.occurrenceCardIDs.set(occurrenceInputMessageID, cardID)
    }
  }

  for (const segment of segments) {
    const first = segment.messages[0]
    if (!first) continue
    const existing = cardTreeStore.cards[segment.cardID]
    const active = activeBySession.get(first.sessionID)?.cardID === segment.cardID
    const status: CardStatus = (() => {
      if (isUserStage(segment.stage)) return "completed"
      if (active) {
        if (existing?.status === "error") return "error"
        if (existing?.terminalReason) return existing.status ?? "completed"
        return "running"
      }
      return existing?.status === "error" ? "error" : "completed"
    })()
    const projectedFields = {
      sessionID: first.sessionID,
      parentSessionID: segment.session.parentSessionID || undefined,
      agentID: isUserStage(segment.stage) ? undefined : first.agentID,
      messageID: first.id,
      stage: segment.stage,
      accent: !isUserStage(segment.stage) && segment.stage ? stageAccent(segment.stage) : undefined,
      title: roleTitleKey(segment.stage),
      orderKey: first.orderKey,
      time: first.time,
      status,
      collapsedContextMessageIDs: segment.messages
        .filter((message) => message.delegatedContext)
        .map((message) => message.id),
    }

    // The part index is authoritative for live updates and was just cleared for
    // every target message, so it is rebuilt whether or not the card itself
    // changed. Only the store write below is conditional.
    const rebuiltParts: any[] = existing?.parts?.filter(isReviewStreamPart) ?? []
    for (const [index, message] of segment.messages.entries()) {
      if (index > 0) {
        const boundaryKey = `__boundary__:${segment.session.sessionID}:${message.id}`
        const boundary = {
          type: "boundary",
          messageID: message.id,
          role: message.stage,
          roleLabel: roleLabel(message.stage),
          time: message.time > 0 ? message.time : undefined,
        }
        segment.session.partIndex.set(boundaryKey, {
          cardID: segment.cardID,
          index: rebuiltParts.length,
        })
        rebuiltParts.push(boundary)
      }
      for (const part of partsByMessage.get(message.id) || []) {
        const partID = String(part.id || "")
        if (partID) {
          segment.session.partIndex.set(partID, {
            cardID: segment.cardID,
            index: rebuiltParts.length,
          })
        }
        rebuiltParts.push(part)
      }
    }

    // A regroup re-derives every segment, but one new message changes at most
    // its own segment and the one it split. Writing an identical projection back
    // is not free: it hands a fresh `parts` array to every mounted card, invalidates
    // their memos, and dirties the whole subtree-stats chain. Skip the write when
    // the derived projection is the one already in the store.
    if (existing && projectedCardIsUnchanged(existing, projectedFields, rebuiltParts)) continue

    const base =
      existing ??
      createSessionCardNode(
        segment.cardID,
        segment.stage,
        isUserStage(segment.stage) ? undefined : first.agentID,
        first.orderKey,
        first.time,
        first.sessionID,
        first.id,
        [],
        [],
        segment.session.parentSessionID,
      )
    setCardTreeStore("cards", segment.cardID, { ...base, ...projectedFields, parts: rebuiltParts })
    refreshMetadataProjectionForCard(segment.cardID)
    markCardStatsDirty(segment.cardID)
  }

  const targetCardIDs = new Set(segments.map((segment) => segment.cardID))
  for (const cardID of oldOwnedCardIDs) {
    if (targetCardIDs.has(cardID)) continue
    clearMessageCardOwnershipForCard(cardID)
    removeCardReferences(cardID)
  }

  for (const [sessionID, active] of activeBySession) {
    const session = sessions.get(sessionID)
    if (!session) continue
    session.activeMessageID = active.messageID
    session.activeCardID = active.cardID
    const activeMessage = timelineMessages.get(active.messageID)
    const occurrenceInputMessageID = activeMessage?.role === "user" ? activeMessage.id : activeMessage?.parentMessageID
    if (occurrenceInputMessageID) {
      advanceActiveOccurrence(session, occurrenceInputMessageID, active.orderKey, active.cardID)
    }
  }

  if (!opts.deferHierarchy) rebuildCardHierarchy()
}

export function conversationUserInputTextForMessage(messageIDInput: string): string {
  const messageID = String(messageIDInput || "")
  if (!messageID) return ""
  return (collectTimelineParts(new Set([messageID])).get(messageID) || [])
    .filter((part) => part?.type === "text")
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
}

export interface HydrateMessageMeta {
  messageID: string
  inputMessageID: string
  sessionID: string
  sessionAgentID: string
  agentID: string
  stage: string
  parentSessionID: string
  orderKey: string
  time: number
}

export interface PreparedConversationView {
  transcriptByMessageID: Map<string, any>
  ordered: HydrateMessageMeta[]
}

function hydrateMessageMetaOrder(left: HydrateMessageMeta, right: HydrateMessageMeta): number {
  return compareTimelineOrderKeys(left.orderKey, right.orderKey, "hydrate message")
}

function parseHydrateMessageMeta(raw: any): HydrateMessageMeta {
  const messageID = String(raw?.messageID || "")
  const inputMessageID = String(raw?.inputMessageID || "")
  const sessionID = String(raw?.sessionID || "")
  const sessionAgentID = String(raw?.sessionAgentID || "").trim()
  const agentID = String(raw?.agentID || "").trim()
  const stage = String(raw?.stage || "")
  const time = Number(raw?.time || 0)
  if (!messageID || !inputMessageID || !sessionID || !sessionAgentID || !agentID) {
    throw new Error(
      "hydrateConversationView: view.messages entry missing messageID/inputMessageID/sessionID/sessionAgentID/agentID",
    )
  }
  if (!stage) throw new Error(`hydrateConversationView: view message ${messageID} missing stage`)
  if (stage === "filtered") {
    throw new Error(`hydrateConversationView: view message ${messageID} uses the retired hidden stage`)
  }
  if (!(time > 0)) throw new Error(`hydrateConversationView: view message ${messageID} missing positive time`)
  return {
    messageID,
    inputMessageID,
    sessionID,
    sessionAgentID,
    agentID,
    stage,
    parentSessionID: String(raw?.parentSessionID || ""),
    orderKey: requireTimelineOrderKeyDomain(raw?.orderKey, `hydrateConversationView message ${messageID}`, "message"),
    time,
  }
}

export function prepareConversationView(view: any, transcript: any[]): PreparedConversationView {
  const all = Array.isArray(transcript) ? transcript : []
  const transcriptByMessageID = new Map<string, any>()
  const displayTranscriptMessageIDs = new Set<string>()
  for (const message of all) {
    const info = message?.info
    if (!info || typeof info !== "object") {
      throw new Error("hydrateConversationView: transcript message missing info")
    }
    const messageID = String(info.id || "")
    if (!messageID) throw new Error("hydrateConversationView: transcript message missing id")
    if (transcriptByMessageID.has(messageID)) {
      throw new Error(`hydrateConversationView: duplicate transcript message ${messageID}`)
    }
    transcriptByMessageID.set(messageID, message)
    if (transcriptMessageHasDisplay(message)) displayTranscriptMessageIDs.add(messageID)
  }
  const viewMessages = Array.isArray(view?.messages) ? view.messages : []
  if (displayTranscriptMessageIDs.size > 0 && viewMessages.length === 0) {
    throw new Error("hydrateConversationView: view.messages metadata required for display transcript messages")
  }
  const ordered = viewMessages.map(parseHydrateMessageMeta).sort(hydrateMessageMetaOrder)
  const viewMessageIDs = new Set<string>()
  for (const meta of ordered) {
    if (viewMessageIDs.has(meta.messageID)) {
      throw new Error(`hydrateConversationView: duplicate view message ${meta.messageID}`)
    }
    viewMessageIDs.add(meta.messageID)
  }
  const sessionAgentIDs = new Map<string, string>()
  for (const rawSession of Array.isArray(view?.sessions) ? view.sessions : []) {
    const sessionID = String(rawSession?.sessionID || "")
    const agentID = String(rawSession?.agentID || "").trim()
    if (!sessionID || !agentID) {
      throw new Error("hydrateConversationView: view.sessions entry missing sessionID/agentID")
    }
    const existing = sessionAgentIDs.get(sessionID)
    if (existing && existing !== agentID) {
      throw new Error(`hydrateConversationView: view session ${sessionID} agentID drift: ${existing} -> ${agentID}`)
    }
    sessionAgentIDs.set(sessionID, agentID)
  }
  for (const meta of ordered) {
    const sessionAgentID = sessionAgentIDs.get(meta.sessionID)
    if (!sessionAgentID) {
      throw new Error(`hydrateConversationView: view message ${meta.messageID} missing session identity`)
    }
    const message = transcriptByMessageID.get(meta.messageID)
    const info = message?.info
    if (!info || typeof info !== "object") {
      throw new Error(`hydrateConversationView: view message ${meta.messageID} missing transcript payload`)
    }
    const origin = requireMessageOrigin(info, meta.messageID)
    requireCanonicalMessageAgentID(meta.agentID, origin, meta.messageID)
    const transcriptAgentID = String(info.agentID || "").trim()
    if (transcriptAgentID !== meta.agentID) {
      throw new Error(`hydrateConversationView: message ${meta.messageID} agentID drift between transcript and view`)
    }
    const transcriptSessionAgentID = String(info.sessionAgentID || "").trim()
    if (transcriptSessionAgentID !== meta.sessionAgentID) {
      throw new Error(
        `hydrateConversationView: message ${meta.messageID} sessionAgentID drift between transcript and view`,
      )
    }
    const transcriptStage = deriveSessionStage(origin)
    if (transcriptStage !== meta.stage) {
      throw new Error(`hydrateConversationView: message ${meta.messageID} stage drift between transcript and view`)
    }
  }
  const viewDisplayMessageIDs = new Set(ordered.map((message) => message.messageID))
  for (const messageID of displayTranscriptMessageIDs) {
    if (!viewDisplayMessageIDs.has(messageID)) {
      throw new Error(`hydrateConversationView: display transcript message ${messageID} missing from view.messages`)
    }
  }
  const partOwners = new Map<string, string>()
  for (const meta of ordered) {
    const message = transcriptByMessageID.get(meta.messageID)
    const info = message?.info
    const messageID = String(info?.id || "")
    const sessionID = String(info?.sessionID || "")
    if (!messageID || !sessionID) {
      throw new Error("hydrateConversationView: transcript message missing id/sessionID")
    }
    if (messageID !== meta.messageID || sessionID !== meta.sessionID) {
      throw new Error(`hydrateConversationView: view metadata drift for message ${meta.messageID}`)
    }
    const rawRole = info?.role
    if (typeof rawRole !== "string" || rawRole.length === 0) {
      throw new Error(`hydrateConversationView: message ${messageID} missing info.role`)
    }
    const origin = requireMessageOrigin(info, messageID)
    requireCanonicalMessageAgentID(meta.agentID, origin, messageID)
    const rawResolvedRole = info?.resolvedRole
    if (typeof rawResolvedRole !== "string" || rawResolvedRole.length === 0) {
      throw new Error(`hydrateConversationView: message ${messageID} missing resolvedRole`)
    }
    const transcriptTimeCreated = Number(info?.time?.created || 0)
    if (transcriptTimeCreated > 0 && transcriptTimeCreated !== meta.time) {
      throw new Error(`hydrateConversationView: message ${messageID} time drift between transcript and view`)
    }
    const transcriptOrderKey = requireTimelineOrderKeyDomain(
      info.orderKey,
      `transcript message ${messageID}`,
      "message",
    )
    if (transcriptOrderKey && transcriptOrderKey !== meta.orderKey) {
      throw new Error(`hydrateConversationView: message ${messageID} orderKey drift between transcript and view`)
    }
    for (const part of Array.isArray(message?.parts) ? message.parts : []) {
      const partID = String(part?.id || "")
      if (!partID) {
        throw new Error(`hydrateConversationView: message ${messageID} contains part without id`)
      }
      const partMessageID = String(part?.messageID || "")
      const partSessionID = String(part?.sessionID || "")
      if (!partMessageID || !partSessionID) {
        throw new Error(`hydrateConversationView: part ${partID} missing messageID/sessionID`)
      }
      if (partMessageID !== messageID || partSessionID !== sessionID) {
        throw new Error(`hydrateConversationView: part ${partID} metadata drift for message ${messageID}`)
      }
      const partOwnerKey = `${sessionID}\u0000${partID}`
      if (partOwners.has(partOwnerKey)) {
        throw new Error(`hydrateConversationView: duplicate part ${partID} in session ${sessionID}`)
      }
      partOwners.set(partOwnerKey, messageID)
      requireTimelineOrderKeyDomain(part.orderKey, `persisted message part ${partID}`, "part")
    }
  }
  return { transcriptByMessageID, ordered }
}

/** Replay a validated persisted task into the exact same visible card identity
 *  the live SSE stream would have built. Display message metadata comes from
 *  `view.messages[]`; transcript rows only provide payload and per-message
 *  role/model/usage fields. */
export function commitPreparedConversationView(prepared: PreparedConversationView): void {
  const { transcriptByMessageID, ordered } = prepared
  const touched = new Set<string>()
  for (const meta of ordered) {
    const message = transcriptByMessageID.get(meta.messageID)
    if (!message) {
      throw new Error(`hydrateConversationView: view message ${meta.messageID} missing transcript payload`)
    }
    const info = message?.info
    if (!info || typeof info !== "object") {
      throw new Error("hydrateConversationView: transcript message missing info")
    }
    const messageID = String(info.id || "")
    const sessionID = String(info.sessionID || "")
    if (!messageID || !sessionID) {
      throw new Error("hydrateConversationView: transcript message missing id/sessionID")
    }
    if (messageID !== meta.messageID || sessionID !== meta.sessionID) {
      throw new Error(`hydrateConversationView: view metadata drift for message ${meta.messageID}`)
    }
    // No assistant-fallback (一个萝卜一个坑) — replay must reflect the same
    // role attribution the live event stream carries.
    const rawRole = info.role
    if (typeof rawRole !== "string" || rawRole.length === 0) {
      throw new Error(`hydrateConversationView: message ${messageID} missing info.role`)
    }
    const role = rawRole
    const origin = requireMessageOrigin(info, messageID)
    const canonicalAgentID = requireCanonicalMessageAgentID(meta.agentID, origin, messageID)
    const rawResolvedRole = info.resolvedRole
    if (typeof rawResolvedRole !== "string" || rawResolvedRole.length === 0) {
      throw new Error(`hydrateConversationView: message ${messageID} missing resolvedRole`)
    }
    const parentSessionID = meta.parentSessionID
    const timeCreated = meta.time
    const transcriptTimeCreated = Number(info?.time?.created || 0)
    if (transcriptTimeCreated > 0 && transcriptTimeCreated !== timeCreated) {
      throw new Error(`hydrateConversationView: message ${messageID} time drift between transcript and view`)
    }
    const transcriptOrderKey = requireTimelineOrderKeyDomain(
      info.orderKey,
      `transcript message ${messageID}`,
      "message",
    )
    if (transcriptOrderKey && transcriptOrderKey !== meta.orderKey) {
      throw new Error(`hydrateConversationView: message ${messageID} orderKey drift between transcript and view`)
    }
    const completed = Number.isFinite(info?.time?.completed) && Number(info.time.completed) > 0
    const stage = meta.stage
    const displayRole = displayRoleForResolvedRole(rawResolvedRole)
    const runtimeStage = deriveRuntimeSessionStage(origin.channel)
    const session = ensureSessionProjection(sessionID, {
      agentID: isUserStage(runtimeStage) ? undefined : meta.sessionAgentID,
      stage: runtimeStage,
      parentSessionID,
    })
    messages.set(messageID, {
      id: messageID,
      sessionID,
      sessionAgentID: meta.sessionAgentID,
      agentID: canonicalAgentID,
      stage,
      role,
      author: origin.author,
      channel: origin.channel,
      source: origin.source,
      resolvedRole: displayRole,
      agent: typeof info.agent === "string" ? info.agent : "",
      parentSessionID,
      parentMessageID: String(info?.parentID || ""),
      orderKey: meta.orderKey,
      time: timeCreated,
      serverTimeConfirmed: true,
      completed,
      delegatedContext: isDelegatedContextMessage(origin),
    })
    session.messageIDs.add(messageID)
    const cardID = ensureMessageTurnProjection(session, messageID, {
      stage,
      agentID: isUserStage(stage) ? undefined : canonicalAgentID,
      collapseContext: isDelegatedContextMessage(origin),
      orderKey: meta.orderKey,
      time: timeCreated,
      stampServerTime: true,
      deferHierarchy: true,
      occurrenceInputMessageID:
        String(info?.role || "") === "user" ? messageID : String(info?.parentID || "") || undefined,
    })
    const parts = Array.isArray(message?.parts) ? message.parts : []
    for (const part of parts) {
      const partID = String(part?.id || "")
      if (!partID) {
        throw new Error(`hydrateConversationView: message ${messageID} contains part without id`)
      }
      const partMessageID = String(part?.messageID || "")
      const partSessionID = String(part?.sessionID || "")
      if (!partMessageID || !partSessionID) {
        throw new Error(`hydrateConversationView: part ${partID} missing messageID/sessionID`)
      }
      if (partMessageID !== messageID || partSessionID !== sessionID) {
        throw new Error(`hydrateConversationView: part ${partID} metadata drift for message ${messageID}`)
      }
      requireTimelineOrderKeyDomain(part.orderKey, `persisted message part ${partID}`, "part")
      if (!conversationPartIsProjectable(part)) continue
      upsertPart(session, messageID, cardID, partID, part)
    }
    touched.add(sessionID)
  }
  regroupTimelineSegments({ deferHierarchy: true })
  for (const meta of ordered) {
    const message = transcriptByMessageID.get(meta.messageID)
    const info = message?.info
    const messageID = meta.messageID
    const sessionID = meta.sessionID
    const session = sessions.get(sessionID)
    const usageProjection = usageProjectionFromInfo(info)
    if (usageProjection) {
      if (!session) throw new Error(`message ${messageID} missing session projection for usage metadata`)
      projectUsageOntoCard(session, messageID, usageProjection)
    }
    if (messageInfoIsAssistant(info)) {
      if (!session) throw new Error(`message ${messageID} missing session projection for model metadata`)
      projectModelOntoCard(session, messageID, modelProjectionFromInfo(info))
    }
    if (messageInfoIsAssistant(info)) {
      if (!session) throw new Error(`message ${messageID} missing session projection for settlement metadata`)
      const cardID = session.messageCardIDs.get(messageID)
      if (!cardID) throw new Error(`message ${messageID} missing card projection for settlement metadata`)
      applyAssistantMessageSettlement(cardID, info)
    }
  }
  rebuildCardHierarchy()
  for (const sessionID of touched) {
    drainPendingSessionStatus(sessionID)
  }
  flushCardStats()
  markCardTreeVisibleChanged()
}

export function applyConversationTurnArtifacts(
  summaries: ReadonlyArray<NonNullable<CardNode["turnArtifacts"]>[number]>,
): void {
  const byCardID = new Map<string, NonNullable<CardNode["turnArtifacts"]>>()
  for (const [cardID, card] of Object.entries(cardTreeStore.cards)) {
    if (card?.turnArtifacts) setCardTreeStore("cards", cardID, "turnArtifacts", [])
  }
  for (const summary of summaries) {
    const message = messages.get(summary.messageID)
    if (!message) continue
    const session = sessions.get(message.sessionID)
    const cardID = session?.messageCardIDs.get(summary.messageID)
    if (!cardID || !cardTreeStore.cards[cardID]) {
      throw new Error(`Turn Artifact summary message ${summary.messageID} is missing its conversation card`)
    }
    const entries = byCardID.get(cardID)
    if (entries) entries.push(summary)
    else byCardID.set(cardID, [summary])
  }
  for (const [cardID, entries] of byCardID) {
    setCardTreeStore("cards", cardID, "turnArtifacts", entries)
  }
}

export function hydrateConversationView(view: any, transcript: any[]): void {
  commitPreparedConversationView(prepareConversationView(view, transcript))
}

function upsertPart(session: SessionInfo, messageID: string, cardID: string, partID: string, part: any): void {
  const existing = session.partIndex.get(partID)
  const sameCard = existing !== undefined && existing.cardID === cardID
  if (existing && !sameCard) {
    throw new Error(`part ${partID} is already owned by card ${existing.cardID}`)
  }
  const previousPart = sameCard ? cardTreeStore.cards[cardID]?.parts?.[existing!.index] : undefined
  const normalizedPart = normalizeToolPartRecord(part, previousPart) as any
  if (sameCard) {
    if (previousPart?.orderKey !== normalizedPart.orderKey) {
      throw new Error(`part ${partID} orderKey drift from existing part owner`)
    }
    setCardTreeStore("cards", cardID, "parts", existing!.index, normalizedPart)
    markCardStatsDirty(cardID)
    return
  }
  const newIdx = insertSessionPartByOrderKey(session, messageID, cardID, normalizedPart)
  session.partIndex.set(partID, { cardID, index: newIdx })
}

function insertSessionPartByOrderKey(session: SessionInfo, messageID: string, cardID: string, part: any): number {
  const current = cardTreeStore.cards[cardID]?.parts
  if (!Array.isArray(current)) {
    throw new Error(`insertSessionPartByOrderKey: card ${cardID} missing parts array`)
  }
  const targetMessage = messages.get(messageID) ?? pendingPartFirstMessages.get(messageID)
  if (!targetMessage) {
    throw new Error(`insertSessionPartByOrderKey: message ${messageID} missing timeline projection`)
  }
  const targetMessageOrderKey = requireTimelineOrderKey(
    targetMessage.orderKey,
    `message ${messageID} live part segment`,
  )
  let insertionIndex = current.length
  let ownsMessageSegment = false
  for (let index = 0; index < current.length; index += 1) {
    const candidate = current[index]
    const candidateMessageID = String(candidate?.messageID || "")
    if (!candidateMessageID) continue
    if (candidateMessageID !== messageID) {
      if (ownsMessageSegment) {
        insertionIndex = index
        break
      }
      const candidateMessage = messages.get(candidateMessageID) ?? pendingPartFirstMessages.get(candidateMessageID)
      if (
        candidateMessage &&
        compareTimelineOrderKeys(
          targetMessageOrderKey,
          candidateMessage.orderKey,
          `message ${messageID} live segment placement`,
        ) < 0
      ) {
        insertionIndex = index
        break
      }
      continue
    }
    ownsMessageSegment = true
    if (isBoundaryMessagePart(candidate)) continue
    if (compareTimelineOrderKeys(part.orderKey, candidate.orderKey, `message ${messageID} live parts`) < 0) {
      insertionIndex = index
      break
    }
  }
  const next = [...current.slice(0, insertionIndex), part, ...current.slice(insertionIndex)]
  setCardTreeStore("cards", cardID, "parts", next)
  markCardStatsDirty(cardID)
  for (const [indexedPartID, target] of session.partIndex) {
    if (target.cardID === cardID && target.index >= insertionIndex) {
      session.partIndex.set(indexedPartID, { cardID, index: target.index + 1 })
    }
  }
  return insertionIndex
}

// ── Board-derived projections ──

function rebuildBoardDerivedCards(): void {
  if (projectionDeferralDepth > 0) {
    deferredBoardProjection = true
    return
  }
  // Agent and user messages remain owned by their real sessions. Board
  // snapshots only trigger hierarchy reconciliation for durable projections.
  batch(() => {
    regroupTimelineSegments({ deferHierarchy: true })
    rebuildCardHierarchy()
    // Drain the stats dirty queue inside the same batch as the structural
    // rewrites so collapsed bubble caches reflect the new hierarchy before
    // any subscriber observes the visible-version bump.
    flushCardStats()
    markCardTreeVisibleChanged()
  })
}

function interactionCardOrderKey(cardID: string): string {
  return requireTimelineOrderKey(cardTreeStore.cards[cardID]?.orderKey, `interaction card ${cardID}`)
}

function upsertInteractionCard(seed: {
  info: { id: string; orderKey: string; role: string; time: { created: number } }
  parts: any[]
}): string {
  const seedID = String(seed?.info?.id || "")
  if (!seedID) throw new Error("interaction card seed missing info.id")
  const cardID = interactionCardID(seedID)
  const role = String(seed?.info?.role || "system")
  const time = Number(seed?.info?.time?.created || 0)
  if (!(time > 0)) {
    throw new Error(
      `interaction card seed ${seedID} missing info.time.created; server emitter is the single source of truth`,
    )
  }
  const orderKey = requireTimelineOrderKey(seed?.info?.orderKey, `interaction card seed ${seedID}`)
  const parts = Array.isArray(seed?.parts) ? seed.parts.slice() : []
  setCardTreeStore("cards", cardID, {
    id: cardID,
    kind: "message",
    role,
    title: roleTitleKey(role),
    parts,
    childIDs: [],
    orderKey,
    time,
  })
  markCardStatsDirty(cardID)
  return cardID
}

function sessionTurnCardAtOrBefore(session: SessionInfo | undefined, orderKey: string): string | undefined {
  if (!session) return undefined
  let selectedCardID = ""
  let selectedOrderKey = ""
  for (const cardID of new Set(session.messageCardIDs.values())) {
    const card = cardTreeStore.cards[cardID]
    const cardOrderKey = requireTimelineOrderKey(card?.orderKey, `interaction owner card ${cardID}`)
    if (compareTimelineOrderKeys(cardOrderKey, orderKey, "interaction owner") > 0) continue
    if (
      !selectedCardID ||
      compareTimelineOrderKeys(cardOrderKey, selectedOrderKey, "interaction owner selected") >= 0
    ) {
      selectedCardID = cardID
      selectedOrderKey = cardOrderKey
    }
  }
  return selectedCardID || undefined
}

function rebuildInteractionCards(board: any): {
  bySessionCardID: Map<string, string[]>
  topLevel: string[]
} {
  const knownSessionIDs = new Set<string>(sessions.keys())
  const interactions = conversationInteractions(board)
  const { bySession, orphan } = partitionInteractions(interactions, knownSessionIDs)
  const aliveCardIDs = new Set<string>()
  const bySessionCardID = new Map<string, string[]>()
  const topLevel: string[] = []

  const addMessages = (items: any[], sessionID?: string) => {
    const ordered = (Array.isArray(items) ? items : [])
      .flatMap((interaction) => interactionToCardSeeds(interaction))
      .sort((left, right) => compareTimelineOrderKeys(left?.info?.orderKey, right?.info?.orderKey, "interaction seed"))
    for (const seed of ordered) {
      const cardID = upsertInteractionCard(seed)
      aliveCardIDs.add(cardID)
      if (sessionID) {
        const session = sessions.get(sessionID)
        // Attach to the latest turn that existed at the interaction time.
        // Rebuilds can run after newer turns appear; using activeCardID here
        // would make old prompts drift onto the newest card.
        const ownerCardID = sessionTurnCardAtOrBefore(session, seed.info.orderKey)
        if (!ownerCardID) {
          topLevel.push(cardID)
          continue
        }
        const bucket = bySessionCardID.get(ownerCardID)
        if (bucket) bucket.push(cardID)
        else bySessionCardID.set(ownerCardID, [cardID])
      } else {
        topLevel.push(cardID)
      }
    }
  }

  for (const [sessionID, claimed] of bySession.entries()) {
    addMessages(claimed, sessionID)
  }
  addMessages(orphan)

  setCardTreeStore(
    "cards",
    produce((cards: Record<string, CardNode>) => {
      const removedCardIDs: string[] = []
      for (const cardID of Object.keys(cards)) {
        if (!cardID.startsWith("interaction-card:")) continue
        if (!aliveCardIDs.has(cardID)) {
          removedCardIDs.push(cardID)
          delete cards[cardID]
        }
      }
      for (const cardID of removedCardIDs) markCardStatsRemoved(cardID)
    }),
  )

  topLevel.sort((a, b) =>
    compareTimelineOrderKeys(interactionCardOrderKey(a), interactionCardOrderKey(b), "interaction top-level"),
  )
  for (const ids of bySessionCardID.values()) {
    ids.sort((a, b) =>
      compareTimelineOrderKeys(interactionCardOrderKey(a), interactionCardOrderKey(b), "interaction child"),
    )
  }
  return { bySessionCardID, topLevel }
}

function conversationInteractions(board: any): any[] {
  const boardInteractions = Array.isArray(board?.interactions) ? board.interactions : []
  return [...boardInteractions, ...standaloneQuestionInteractions.values()]
}

export function validateConversationBoardInteractions(board: any, standaloneInteractions: any[] = []): void {
  const boardInteractions = Array.isArray(board?.interactions) ? board.interactions : []
  const seedIDs = new Set<string>()
  const seeds = [...boardInteractions, ...standaloneInteractions]
    .flatMap((interaction) => interactionToCardSeeds(interaction))
    .sort((left, right) => compareTimelineOrderKeys(left?.info?.orderKey, right?.info?.orderKey, "interaction seed"))
  for (const seed of seeds) {
    const seedID = String(seed?.info?.id || "")
    if (!seedID) throw new Error("interaction card seed missing info.id")
    if (seedIDs.has(seedID)) throw new Error(`duplicate interaction card seed ${seedID}`)
    seedIDs.add(seedID)
    requireTimelineOrderKey(seed?.info?.orderKey, `interaction card seed ${seedID}`)
  }
}

function sessionSortOrderKey(cardID: string | undefined): string {
  if (!cardID) return ""
  return typeof cardTreeStore.cards[cardID]?.orderKey === "string" ? cardTreeStore.cards[cardID]!.orderKey : ""
}

/** Display cards this session owns for hierarchy and visibility. Integrity
 *  may pin activeCardID to its dedicated lifecycle card. */
function sessionOwnedCardIDs(info: SessionInfo): string[] {
  const ids = new Set<string>()
  for (const cid of info.messageCardIDs.values()) ids.add(cid)
  if (info.activeCardID) ids.add(info.activeCardID)
  return [...ids]
}

function pushUniqueChild(target: string[], childID: string): void {
  if (!childID || target.includes(childID)) return
  target.push(childID)
}

function cardHasDisplayPart(card: CardNode | undefined): boolean {
  if (!card) return false
  for (const part of card.parts || []) {
    if (messagePartHasDisplayContent(part)) return true
  }
  return false
}

function shouldHideSessionCard(card: CardNode | undefined): boolean {
  if (!card || cardHasDisplayPart(card)) return false
  if (card.status === "running") return false
  if (card.status === "error") return false
  return true
}

function syncSessionTopLevelVisibility(session: SessionInfo | undefined): void {
  if (!session) return
  let visible = false
  for (const cid of sessionOwnedCardIDs(session)) {
    const card = cardTreeStore.cards[cid]
    if (card && !shouldHideSessionCard(card)) {
      visible = true
      break
    }
  }
  if (session.topLevelVisible === visible) return
  session.topLevelVisible = visible
  rebuildTopLevelOrder()
}

function rebuildCardHierarchy(): void {
  if (projectionDeferralDepth > 0) {
    deferredHierarchyRebuild = true
    return
  }
  // batch ensures that the interaction-card GC inside rebuildInteractionCards
  // and the final childIDs write at the bottom of this function are visible
  // atomically to downstream reactions. Otherwise a parent card can be
  // observed holding a `childIDs` entry whose corresponding child was just
  // deleted by the GC, causing visibleChildIDsForCard to throw
  // "references missing child …".
  batch(() => rebuildCardHierarchyImpl())
}

function rebuildCardHierarchyImpl(): void {
  const nextChildIDs = new Map<string, string[]>()
  const interactions = rebuildInteractionCards(boardStore.board)

  // Ordinary message-turn cards are top-level by design. Their
  // `orderKey` puts an orchestrator turn that ran after a child agent after
  // that child's card. No parent claim, no "move parent after child" logic.
  const orderedSessions = [...sessions.values()].sort((a, b) => {
    const left = sessionSortOrderKey(a.activeCardID)
    const right = sessionSortOrderKey(b.activeCardID)
    if (!left && !right) return 0
    if (!left) return -1
    if (!right) return 1
    return compareTimelineOrderKeys(left, right, "session hierarchy")
  })
  for (const info of orderedSessions) {
    for (const cid of sessionOwnedCardIDs(info)) {
      if (cardTreeStore.cards[cid]) nextChildIDs.set(cid, nextChildIDs.get(cid) || [])
    }
  }
  for (const [sessionCardID, childIDs] of interactions.bySessionCardID.entries()) {
    const bucket = nextChildIDs.get(sessionCardID) || []
    for (const childID of childIDs) {
      pushUniqueChild(bucket, childID)
      nextChildIDs.set(childID, nextChildIDs.get(childID) || [])
    }
    nextChildIDs.set(sessionCardID, bucket)
  }
  for (const childID of interactions.topLevel) {
    nextChildIDs.set(childID, nextChildIDs.get(childID) || [])
  }

  // Snapshot every affected parent's childIDs BEFORE the produce so we can
  // diff: which children got newly attached (need parentID link + dirty
  // parent), which got detached from a parent without landing in any other
  // (need parentID unlink), and which parents lost or gained any child
  // (need their cached aggregates recomputed). Without this snapshot, an
  // old parent whose child moves to a different parent keeps the
  // stale child's contributions baked into its cached counts forever.
  const affectedParents = new Set<string>()
  for (const info of sessions.values()) {
    for (const cid of sessionOwnedCardIDs(info)) affectedParents.add(cid)
  }
  for (const parentID of nextChildIDs.keys()) affectedParents.add(parentID)

  const childIDsBefore = new Map<string, string[]>()
  for (const parentID of affectedParents) {
    const existing = cardTreeStore.cards[parentID]?.childIDs
    childIDsBefore.set(parentID, Array.isArray(existing) ? [...existing] : [])
  }

  setCardTreeStore(
    "cards",
    produce((cards: Record<string, CardNode>) => {
      // Reset every session-owned turn card's childIDs from nextChildIDs so
      // a removed interaction child is cleared, not left dangling.
      for (const info of sessions.values()) {
        for (const cid of sessionOwnedCardIDs(info)) {
          if (cards[cid]) cards[cid].childIDs = nextChildIDs.get(cid) || []
        }
      }
      for (const [cardID, childIDs] of nextChildIDs.entries()) {
        if (cards[cardID]) cards[cardID].childIDs = childIDs
      }
    }),
  )

  // Build the parent-after map across every affected parent so we can tell
  // whether a child that disappeared from one parent's childIDs landed in
  // ANOTHER parent's (move — handled by linkChildToParent below) or in
  // none (orphan — needs unlinkChildFromParent so the bubble-up walk does
  // not keep climbing through a parent that no longer reaches it).
  const parentAfterByChild = new Map<string, string>()
  for (const parentID of affectedParents) {
    const after = cardTreeStore.cards[parentID]?.childIDs ?? []
    for (const childID of after) parentAfterByChild.set(childID, parentID)
  }

  for (const parentID of affectedParents) {
    const before = childIDsBefore.get(parentID) ?? []
    for (const childID of before) {
      // Detached from this parent. If another affected parent claimed it,
      // the link below repoints the back-pointer; otherwise it is an orphan
      // and we explicitly clear parentID so bubble-up stops here.
      if (!parentAfterByChild.has(childID)) unlinkChildFromParent(childID)
    }
    markCardStatsDirty(parentID)
  }
  // Link every (new) parent→child edge. Idempotent when the link already
  // matched the prior parent; overwrites stale links from a previous attempt.
  for (const [childID, parentID] of parentAfterByChild.entries()) {
    linkChildToParent(parentID, childID)
  }

  rebuildTopLevelOrder()
}

// ── Top-level ordering ──
//
// One rule: every top-level card sorts by backend `orderKey`. No grouping,
// no per-kind priority lanes. User-request, session cards (orchestrator,
// requirements, architect, planner, build, ...), orphan
// interactions (question / permission), and optimistic bubbles
// all interleave on a single durable timeline axis. Card identity rules
// (see specs/current/architecture/07-panel-reactivity.md §身份规则) still decide
// *whether* a card surfaces at the top level — not where.
//
// Invariants this function relies on, enforced by the writer elsewhere:
//   • Every surfacing card carries `orderKey` from the backend projection.
//   • Integrity and tool cards are always claimed as childIDs of their
//     owning real session before this runs.

function rebuildTopLevelOrder(): void {
  if (projectionDeferralDepth > 0) {
    deferredTopLevelRebuild = true
    return
  }
  const claimedChildIDs = new Set<string>()
  for (const node of Object.values(cardTreeStore.cards)) {
    for (const childID of node.childIDs || []) claimedChildIDs.add(childID)
  }

  // A contentless running Agent card is the real pre-output lifecycle fact and
  // remains visible as the pending thinking row. Contentless idle/completed/
  // aborted cards stay out of the conversation, while a pre-output error keeps
  // its ordinary diagnostic card.
  const hiddenSessionCardIDs = new Set<string>()
  for (const info of sessions.values()) {
    for (const cid of sessionOwnedCardIDs(info)) {
      if (shouldHideSessionCard(cardTreeStore.cards[cid])) hiddenSessionCardIDs.add(cid)
    }
  }

  const order: string[] = []
  for (const cardID of Object.keys(cardTreeStore.cards)) {
    if (claimedChildIDs.has(cardID)) continue
    if (hiddenSessionCardIDs.has(cardID)) continue
    const card = cardTreeStore.cards[cardID]
    if (!card) continue
    if (card.kind === "tool") continue
    order.push(cardID)
  }

  order.sort((a, b) => {
    const ca = cardTreeStore.cards[a]
    const cb = cardTreeStore.cards[b]
    return compareTimelineOrderKeys(ca?.orderKey, cb?.orderKey, "top-level card")
  })

  replaceCardTreeOrder(order)
}

// ── Board projection hook ──
//
// `loadBoard()` applies board snapshots via fine-grained `setBoardStore`
// writes (`setBoardStore("board", key, value)`). A detached effect that reads
// only `boardStore.board` does not reliably rerun for those nested writes, so
// request / interaction cards can stay stale until an unrelated task event
// happens to force a rebuild. Register an explicit post-delta hook at the
// store boundary instead: every successful board apply triggers exactly one
// re-projection with the fully-updated snapshot.
setBoardProjectionHandler(() => {
  rebuildBoardDerivedCards()
})
if (boardStore.board) rebuildBoardDerivedCards()

// The optimistic user bubble uses the real server-issued message ID.
// Interactions are projected directly into cardTreeStore via
// rebuildInteractionCards/upsertInteractionCard.
// One source per card; no parallel mirror to keep in sync.
