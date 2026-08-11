// ── Card Tree Store ──
//
// Single reactive source of truth for the overlay's conversation view.
//
// Shape: flat `cards` dict keyed by stable id + an ordered list of top-level
// ids. Children are referenced by id (`childIDs: string[]`), NOT inlined,
// so adding/removing a child writes only to the parent's `childIDs` array.
// Part lists work the same way — `CardNode.parts` is the canonical array,
// targeted writes update `cardTreeStore.cards[id].parts[idx].<field>`.
//
// ID conventions (deterministic, construction-time):
//   <stage>:session:<sid>:message:<mid>                    — agent run-segment card
//                                                            (mid is the first message in the segment;
//                                                            consecutive messages from the same
//                                                            session reuse the card until another
//                                                            session interrupts)
//   part:<messageID>:<partID>                              — part inside a session card
//   interaction:<interactionID>                            — interaction card
//
// The writer (services/tree-writer.ts) is the only module that mutates
// this store. Components read only. No memos, no derivations — components
// walk `cardTreeStore.cards[id]` through the Solid proxy, and Solid's
// fine-grained reactivity handles the rest.

import { createStore, produce, reconcile } from "solid-js/store"
import type { ScreenshotBrowserItem } from "../utils/screenshot-browser"
import type { UsageAggregate } from "../utils/format-usage"
import type { SessionStatus } from "@opencorvus-ai/sdk"

export type CardKind =
  | "agent" // per-session agent card (orchestrator, build worker, planner, ...)
  | "tool" // promoted tool call (nested card for task/subagent)
  | "message" // user / system message bubble
  | "review" // top-level running/completed review stream card

export type CardStatus =
  | "pending"
  | "running" // LLM stream actively in flight (spinner ON)
  | "idle" // session alive but between turns, awaiting next user message / wake (no spinner)
  | "completed"
  | "error"
  | "skipped"

export type SessionTerminalStatus = Extract<SessionStatus, { type: "terminal" }>
export type SessionTerminalReason = SessionTerminalStatus["reason"] | "coordinated"
/** Card terminal semantics intentionally collapse missing durable artifacts
 *  into the existing error presentation instead of adding a parallel User
 *  Interface (UI) state. The accepted input reasons remain owned by the
 *  generated Software Development Kit (SDK) type. */
export type CardTerminalReason = SessionTerminalReason

/** Synthetic "part" used by the renderer to emit a role separator between
 *  flattened messages. Carries the effective role and optional timestamp. */
export interface BoundaryPart {
  type: "boundary"
  role: string
  roleLabel: string
  time?: number
}

/** Activity counts surfaced by collapsed bubble headers. Stored as a
 *  cached aggregate (`CardNode.subtreeCounts`) so the renderer reads
 *  `node.subtreeCounts` in O(1) instead of walking the subtree on every
 *  SSE event — see the stats kernel below. */
export interface ActivityCounts {
  messages: number
  tools: number
  agents: number
  skills: number
}

/** Cached "latest activity" hit used by `collectLatestActivityText`. The
 *  renderer wants the most recent text-or-tool moment in the subtree; we
 *  cache the (timeline-order-key time,index)-tuple plus the rendered text
 *  so collapsed bubble reads are O(1). `text` is the already-formatted line
 *  (markdown for text parts, "Tool: detail" for tool parts) — see
 *  toolHitText / partText in utils/card-tree.ts. */
export interface LatestActivityHit {
  time: number
  index: number
  text: string
}

/** Cached todo-list hit (most-recent TODO tool call in the subtree). The
 *  renderer's `collectTodoSummary` derives counts from `todos`. */
export interface TodoActivityHit {
  time: number
  index: number
  todos: any[]
}

/** Exact Large Language Model (LLM) usage contributed by one observed
 * provider/model pair inside a visible Conversation turn. Cost is normalized
 * to United States dollars (USD) by the engine before this projection. */
export interface CardModelUsage {
  providerID: string
  modelID: string
  display: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUSD: number
}

/** Complete actual usage for one visible Conversation turn. `models` preserves
 * every exact provider/model contributor instead of deriving historical facts
 * from the model currently selected in the Composer. */
export interface CardUsage {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUSD: number
  models: CardModelUsage[]
}

/** CardNode is the fundamental unit of the conversation tree. Child
 *  relationships are ALWAYS stored as ids, never inline objects; the renderer
 *  dereferences through `cardTreeStore.cards[id]`. This indirection is what makes targeted
 *  writes cheap — moving a card between parents is two `setCardTreeStore`
 *  calls (remove from old, add to new) rather than a full tree rebuild. */
export interface CardNode {
  id: string
  kind: CardKind
  /** Back-pointer maintained by `tree-writer.linkChildToParent` whenever a
   *  cardID is placed into another card's `childIDs`. Read only by the
   *  stats kernel (`bubbleStatsFromCard`) to walk ancestors in O(depth)
   *  without rescanning the whole `cards` dict. Components never read this
   *  field, so writing it does not trigger spurious re-renders. */
  parentID?: string
  /** Runtime session id that owns this card. Drives trace, reply, cancel,
   *  and agent-rail projection without parsing identity from the card id. */
  sessionID?: string
  /** Durable execution parent supplied by the backend. This distinguishes a
   * child-owned message turn from the root task transcript without guessing
   * from labels or runtime roles. */
  parentSessionID?: string
  /** Exact projected worker identity for non-user agent cards. The stage
   * remains runtime-template/display metadata and must not replace this ID. */
  agentID?: string
  /** Durable message id that opened this display segment. Consecutive
   *  `message.updated` rows from the same session can share this card;
   *  once another session interrupts, the next message opens a new segment.
   *  Unset on interaction and task-context cards. */
  messageID?: string
  /** Terminal artifacts authored for the exact user/assistant turn represented
   * by this card. The backend resolves immutable completion locators; the
   * renderer never infers ownership from the currently selected Task. */
  turnArtifacts?: Array<{
    messageID: string
    userMessageID: string
    task: {
      id: string
      title: string
      status: "completed" | "failed" | "cancelled"
      reason?: string
    }
    declaredOutputs: Array<{
      declarationLocator: unknown
      producer: Record<string, unknown> | null
      label: string
      artifactType?: string
      resources: Array<{
        snapshot: Record<string, unknown>
        tree: string
        path: string
        media_type: string
        bytes: number
        sha256: string
      }>
    }>
    entries: Array<{
      source: "engine_artifact" | "task_artifact"
      kind: string
      artifact_type: string
      label?: string | null
      resource_count: number
      locator: unknown
    }>
    catalogComplete: boolean
    providerErrors: Array<{
      source: "engine_artifact" | "task_artifact"
      message: string
    }>
  }>
  /** Message segments that contain runtime-delegated user-role context.
   * Content remains in `parts`; the renderer only changes its default
   * disclosure state, so transcript visibility has one source. */
  collapsedContextMessageIDs?: string[]
  /** Projected display role or exact dynamic agent stage. */
  stage?: string
  /** Resolved accent colour for this card's stage. */
  accent?: string
  status?: CardStatus
  role?: string
  title: string
  subtitle?: string
  /** Optional display sequence metadata supplied by the owning event. */
  round?: number
  /** Optional attempt metadata supplied by the owning event. */
  attempt?: number
  /** Inline leaves — text / reasoning / tool / patch / file / subtask / boundary /
   *  interaction-question / interaction-permission. Tool parts that are "promoted"
   *  become their own CardNode instead (with `toolPart` populated). */
  parts: any[]
  /** Child card ids (resolved by the renderer via `cardTreeStore.cards[id]`).
   *  The renderer dereferences each id through the store proxy, preserving
   *  fine-grained reactivity. Writer-created cards populate `[]` by default;
   *  transient tool cards do not own descendants. */
  childIDs?: string[]
  /** Durable cross-domain order key from the backend. Stored top-level cards
   *  must carry it; transient inline cards may omit it because they never
   *  participate in timeline ordering. */
  orderKey?: string
  /** Display timestamp in ms. Required for durations, headers, and rewind
   *  pruning. It is deliberately not the card ordering source. */
  time: number
  defaultExpanded?: boolean
  /** Raw tool part for kind="tool" nodes — rendered by <Card> via
   *  InlineToolPart mode="body". Always undefined for non-tool kinds. */
  toolPart?: any
  contextTokens?: number
  contextTokensEstimated?: boolean
  /** Per-message LLM usage projected from `Message.Assistant.{tokens,cost}`
   *  in tree-writer's `handleMessageUpdated`. The engine writes
   *  cumulative-within-message tokens onto the message row
   *  (session/processor.ts step-finish + build/agent.ts case "usage")
   *  and message.updated carries them through unchanged — the single
   *  source. The aggregate and exact per-model breakdown remain one value.
   *  Stays undefined for non-assistant cards. */
  usage?: CardUsage
  /** Actual model observed on assistant message info. Projected from
   *  `Message.Assistant.{providerID,modelID}` by tree-writer when the
   *  backend emits or hydrates the message; renderers must not derive this
   *  from current config because config may have changed after the turn. */
  model?: {
    providerID: string
    modelID: string
    display: string
  }
  /** Timestamp (ms) when the session this card represents transitioned to
   *  a terminal state (idle / error / done). Stamped by tree-writer's
   *  `handleSessionStatus` on the terminal flip. CardHeader subtracts
   *  `time` to render the running-or-finished duration. */
  timeCompleted?: number
  /** Free-text error reason carried by `agent.execution.lifecycle.status.error`.
   *  Surfaced in CardHeader as a read-only chip when present so the operator
   *  sees why the card flipped red instead of only the badge color change. */
  errorReason?: string
  /** Terminal display semantic projected from `agent.execution.lifecycle`.
   *  Overlay keeps this separate from `status` because cancelled/aborted
   *  sessions intentionally use the terminal status channel while rendering
   *  differently from hard errors. */
  terminalReason?: CardTerminalReason
  reviewStream?: {
    phase: "integrity"
    currentStep?: "manifest" | "runtime" | "visual" | "specialist" | "agent" | "post_repair"
    activity?: string
    reviewerID?: string
    roundID?: string
    elapsedMs?: number
    summary?: string
  }
  /** Cached activity counts for this card's subtree (own parts/toolPart +
   *  all reachable descendants). Maintained by the stats kernel below,
   *  invalidated by tree-writer whenever a part/toolPart/childIDs write
   *  could change the result. Components read this field directly via
   *  `collectActivityCounts` to render collapsed bubble headers in O(1). */
  subtreeCounts?: ActivityCounts
  /** Cached "latest text-or-tool activity" hit for this card's subtree.
   *  Source of truth for the collapsed bubble preview line — components
   *  read this via `collectLatestActivityText`. */
  subtreeLatestHit?: LatestActivityHit
  /** Cached most-recent TODO-tool hit in this card's subtree. The renderer
   *  derives the user-facing `TodoSummary` from this via
   *  `collectTodoSummary`. */
  subtreeTodoHit?: TodoActivityHit
  /** Cached bounded screenshot items for this card's subtree. Maintained by
   *  the same stats kernel as subtreeCounts / subtreeLatestHit /
   *  subtreeTodoHit, so the screenshot browser can read top-level subtree
   *  aggregates without walking every child card on toolbar open. */
  subtreeScreenshotItems?: ScreenshotBrowserItem[]
  /** Cached usage aggregate for this card's subtree. Maintained by the same
   *  stats kernel so the always-mounted chat header usage strip never scans
   *  the entire card dictionary on SSE updates. */
  subtreeUsageAggregate?: UsageAggregate
}

export interface CardTreeStore {
  /** Top-level card ids in display order. */
  order: string[]
  /** Every card by id, flat. Includes cards referenced from any `childIDs`. */
  cards: Record<string, CardNode>
  /** Bounded newest screenshots for the visible top-level card tree.
   *  Maintained by `card-tree-stats.ts` from per-card
   *  `subtreeScreenshotItems`; UI surfaces read this directly so opening the
   *  screenshot browser does not scan top-level roots. */
  screenshotItems: ScreenshotBrowserItem[]
  /** Whole card-tree usage aggregate maintained by `card-tree-stats.ts`
   *  from each card's own usage payload. This preserves the historic
   *  chat-header semantics of aggregating every card in the dictionary,
   *  including message cards that already have usage but no visible parts. */
  usageAggregate: UsageAggregate
  /** Monotonic transcript-generation counter. Increments only when the whole
   *  visible tree is replaced, so scroll owners can drop follow-lock from the
   *  previous transcript instance without guessing from DOM emptiness. */
  treeEpoch: number
  /** Scroll intent stamped onto the most recent whole-tree replacement.
   *  `bottom` is used for explicit task switches where the operator should
   *  land on the latest content of the newly selected task. `preserve` is
   *  used for same-task hydrate/recovery so a user reading history does not
   *  get yanked to the tail. */
  treeReplacementScrollIntent: "preserve" | "bottom"
  /** Human-readable replacement cause for diagnostics / tests. */
  treeReplacementCause: string
  /** Monotonic visible-content version. The conversation scroll owner reads
   *  this single signal instead of observing rendered DOM mutations. */
  visibleVersion: number
  /** Rewind cursor (ms). When non-null, cards with time > cursor have been
   *  pruned from `order` + `cards` by pruneCardsAfterCursor(). The backend
   *  also filters its describe outputs, so any SSE event stream for this
   *  task will not re-deliver the pruned slice unless the cursor is cleared. */
  rewindCursor: number | null
}

export const [cardTreeStore, setCardTreeStore] = createStore<CardTreeStore>({
  order: [],
  cards: {},
  screenshotItems: [],
  usageAggregate: { tokens: 0, costUSD: 0, estimated: false },
  treeEpoch: 0,
  treeReplacementScrollIntent: "preserve",
  treeReplacementCause: "init",
  visibleVersion: 0,
  rewindCursor: null,
})

let visibleChangeScheduled = false

export function markCardTreeReplaced(
  options: {
    scrollIntent?: "preserve" | "bottom"
    cause?: string
  } = {},
): void {
  setCardTreeStore("treeReplacementScrollIntent", options.scrollIntent ?? "preserve")
  setCardTreeStore("treeReplacementCause", options.cause ?? "unspecified")
  setCardTreeStore("treeEpoch", (epoch) => epoch + 1)
}

export function markCardTreeVisibleChanged(): void {
  if (visibleChangeScheduled) return
  visibleChangeScheduled = true
  requestAnimationFrame(() => {
    visibleChangeScheduled = false
    setCardTreeStore("visibleVersion", (version) => version + 1)
  })
}

/** Reactive publication token for the complete visible card-tree projection.
 * Consumers read this before deriving from nested order/card paths so an
 * atomic projection is observed only after its final hierarchy is published. */
export function publishedCardTreeVersion(): number {
  return cardTreeStore.visibleVersion
}

export function setHydratedRewindCursor(cursorTime: number | null): void {
  if (cursorTime !== null && (!Number.isFinite(cursorTime) || cursorTime <= 0)) {
    throw new Error(`setHydratedRewindCursor: cursorTime must be positive or null, got ${JSON.stringify(cursorTime)}`)
  }
  setCardTreeStore("rewindCursor", cursorTime)
  markCardTreeVisibleChanged()
}

let pruneStatsHandler: (() => void) | undefined
let orderStatsHandler: ((previousOrder: readonly string[], nextOrder: readonly string[]) => void) | undefined

export function registerCardTreePruneStatsHandler(handler: () => void): void {
  pruneStatsHandler = handler
}

export function registerCardTreeOrderStatsHandler(
  handler: (previousOrder: readonly string[], nextOrder: readonly string[]) => void,
): void {
  orderStatsHandler = handler
}

function flushPrunedCardTreeStats(): void {
  if (!pruneStatsHandler) {
    throw new Error("pruneCardsAfterCursor requires the card-tree stats kernel to be registered")
  }
  pruneStatsHandler()
}

function notifyCardTreeOrderStats(previousOrder: readonly string[], nextOrder: readonly string[]): void {
  if (!orderStatsHandler) {
    throw new Error("card tree order changes require the card-tree stats kernel to be registered")
  }
  orderStatsHandler(previousOrder, nextOrder)
}

function equalCardTreeOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let index = 0; index < b.length; index += 1) {
    if (a[index] !== b[index]) return false
  }
  return true
}

function requirePrunableCardTime(card: CardNode, id: string): number {
  const time = Number(card.time)
  if (!Number.isFinite(time) || time <= 0) {
    throw new Error(`pruneCardsAfterCursor card ${id} missing positive time`)
  }
  return time
}

export function replaceCardTreeOrder(
  nextOrder: readonly string[] | ((order: readonly string[]) => readonly string[]),
): void {
  let changed = false
  let previousSnapshot: string[] = []
  let nextSnapshot: string[] = []
  setCardTreeStore("order", (current) => {
    const next = typeof nextOrder === "function" ? Array.from(nextOrder(current)) : Array.from(nextOrder)
    if (equalCardTreeOrder(current, next)) return current
    previousSnapshot = Array.from(current)
    nextSnapshot = next
    changed = true
    return next
  })
  if (changed) notifyCardTreeOrderStats(previousSnapshot, nextSnapshot)
}

/**
 * Prune all top-level cards (and their orphaned children) whose `time` is
 * strictly greater than `cursorTime`. Called when the backend emits
 * `task.rewound` — we do NOT full-refresh the overlay; instead we walk the
 * store and remove the tail of the timeline that got filtered out on the
 * server side.
 *
 * Idempotent: re-calling with the same cursor is a no-op.
 */
export function pruneCardsAfterCursor(cursorTime: number) {
  setCardTreeStore("rewindCursor", cursorTime)
  replaceCardTreeOrder((order) =>
    order.filter((id) => {
      const card = cardTreeStore.cards[id]
      if (!card) return false
      return requirePrunableCardTime(card, id) <= cursorTime
    }),
  )
  // Remove child cards whose time exceeds cursor as well. Keeping them
  // orphaned in `cards` wastes memory and risks stale references if the
  // renderer dereferences through childIDs.
  const survivors: Record<string, CardNode> = {}
  for (const [id, card] of Object.entries(cardTreeStore.cards)) {
    if (requirePrunableCardTime(card, id) <= cursorTime) survivors[id] = card
  }
  setCardTreeStore("cards", reconcile(survivors, { merge: false }))
  const liveCardIDs = new Set(Object.keys(survivors))
  setCardTreeStore(
    "cards",
    produce((cards) => {
      for (const card of Object.values(cards)) {
        if (!card?.childIDs?.length) continue
        const nextChildIDs = card.childIDs.filter((childID) => liveCardIDs.has(childID))
        if (nextChildIDs.length !== card.childIDs.length) {
          card.childIDs = nextChildIDs
        }
      }
    }),
  )
  flushPrunedCardTreeStats()
  markCardTreeVisibleChanged()
}
