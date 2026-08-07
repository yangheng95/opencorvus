// ── Card Tree — render-side helpers ──
//
// The canonical source of truth for the card tree types (`CardNode`,
// `CardKind`, `CardStatus`, and `BoundaryPart`) is
// `store/card-tree.ts`. Per CLAUDE.md rule 22 (no dual-source), this file
// re-exports those types so consumers can keep importing from utils
// without forking the type, and holds render-side helpers used by Card /
// CardHeader.
import { cardTreeStore } from "../store/card-tree"
import type {
  CardNode,
  CardKind,
  CardStatus,
  BoundaryPart,
  ActivityCounts as StoreActivityCounts,
} from "../store/card-tree"
import { toolNameKey, displayToolDetail, isAgentDispatchTool } from "./tool"
import { extractTodos, summarizeTodos, type TodoSummary } from "./todos"
import { isBoundaryMessagePart, isCardBodyMessagePart } from "./message-part"
import { normalizeAgentRole } from "./message"
import { timelineOrderKeyTime } from "./timeline-order"

export type { CardNode, CardKind, CardStatus, BoundaryPart } from "../store/card-tree"

// Transient tool cards never flow through tree-writer's mutation pipeline, so
// their cached subtree fields are never populated. Store-backed cards always
// carry the cache after the first `flushCardStats` call; cards without cached
// counts use the direct recursive walk below.
function shouldUseCachedStats(node: CardNode): boolean {
  if (!node) return false
  return node.subtreeCounts !== undefined
}

// ── Status normalisation ──

function normStatus(raw: any): CardStatus | undefined {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
  if (s === "pending" || s === "running" || s === "completed" || s === "error" || s === "skipped") {
    return s as CardStatus
  }
  if (s === "failed" || s === "fail") return "error"
  if (s === "done" || s === "ok" || s === "passed") return "completed"
  return undefined
}

// Todo tools render a structured checklist; inline chips would hide the list,
// and a collapsed completed card would hide the plan itself — so they stay
// expanded regardless of completion status.
const TODO_TOOLS = new Set(["todowrite", "todoread", "todoupdate", "updateplan"])

function isFinishedConversationStatus(status: CardStatus | undefined): boolean {
  return status === "completed" || status === "error" || status === "skipped"
}

function isUserAuthoredCard(node: CardNode): boolean {
  return normalizeAgentRole(node.role || node.stage || "") === "user"
}

function ownsInteractivePresentation(node: CardNode): boolean {
  return node.parts.some((part) => part?.type === "interactive-artifact")
}

// ── Part flattening ──

// ── Default fold policy ──
// Used by <Card> and the folding store (S3) to decide what to show when no
// explicit user override is present.

export function defaultExpandedForNode(
  node: CardNode,
  cards: Record<string, CardNode | undefined> = cardTreeStore.cards,
): boolean {
  if (typeof node.defaultExpanded === "boolean") return node.defaultExpanded
  // Raw tool execution details are auxiliary transcript material. Todo tools
  // remain open because their structured checklist is the task plan surface.
  if (node.kind === "tool" && TODO_TOOLS.has(toolNameKey(node.toolPart?.tool || ""))) return true
  if (node.kind === "tool") return false
  if (node.status === "running") return true
  if ((node.kind === "agent" || node.kind === "message") && isUserAuthoredCard(node)) return true
  // An Interactive Artifact is the turn's durable presentation surface. Keep
  // its sole renderer mounted when the turn finishes; cardExpanded still owns
  // and preserves any explicit operator collapse.
  if ((node.kind === "agent" || node.kind === "message") && ownsInteractivePresentation(node)) return true
  // Finished non-user conversation bodies default to their lightweight
  // summary projection. An explicit operator choice in conversation-ui remains
  // authoritative across this runtime status transition.
  if ((node.kind === "agent" || node.kind === "message") && isFinishedConversationStatus(node.status)) return false
  if (node.kind === "agent") return true
  if (node.kind === "message") return true
  return node.status !== "completed"
}

// ── Text collection (for copy-to-clipboard) ──
// Walks a card node and its descendants, emitting the human-readable prose
// parts: text / reasoning. Tool input/output and binary parts are skipped —
// they rarely belong in a pasted transcript.

function partText(part: any): string {
  if (!part) return ""
  if (part.type === "text" || part.type === "reasoning") {
    return String(part.text || "").trim()
  }
  return ""
}

function previewPlainText(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/^```[^\n]*\n?/, "")
        .replace(/\n?```$/, "")
        .trim(),
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[A-Za-z][\w:-]*>/g, " ")
}

/** Sanitize markdown noise but preserve line breaks; CSS owns clamping. */
export function collapsedActivityPreviewText(text: string, title?: string): string {
  const sanitized = previewPlainText(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
  if (!sanitized) return ""
  const normalizedTitle = String(title || "")
    .replace(/\s+/g, " ")
    .trim()
  let preview = sanitized
  if (normalizedTitle) {
    const firstLine = preview.split("\n", 1)[0]
    if (firstLine.toLowerCase().startsWith(normalizedTitle.toLowerCase())) {
      const stripped = firstLine.slice(normalizedTitle.length).replace(/^[\s:：-]+/, "")
      preview = (stripped + preview.slice(firstLine.length)).replace(/^\s+/, "")
    }
  }
  return preview
}

export function collectCardText(node: CardNode): string {
  if (!node) return ""
  const chunks: string[] = []
  for (const part of node.parts || []) {
    const text = partText(part)
    if (text) chunks.push(text)
  }
  // Store-backed cards reference children by id — dereference via the store.
  for (const cid of node.childIDs || []) {
    const child = cardTreeStore.cards[cid]
    if (!child) continue
    const sub = collectCardText(child)
    if (sub) chunks.push(sub)
  }
  return chunks.filter(Boolean).join("\n\n")
}

/** Collect only message prose that is visible when work details are collapsed. */
export function collectCardAnswerText(node: CardNode): string {
  if (!node) return ""
  const chunks: string[] = []
  for (const part of node.parts || []) {
    if (part?.type !== "text") continue
    const text = String(part.text || "").trim()
    if (text) chunks.push(text)
  }
  for (const childID of node.childIDs || []) {
    const child = cardTreeStore.cards[childID]
    if (!child) continue
    const text = collectCardAnswerText(child)
    if (text) chunks.push(text)
  }
  return chunks.join("\n\n")
}

export function reachableCardIDsFromTree(
  order: readonly string[],
  cards: Record<string, Pick<CardNode, "childIDs"> | undefined>,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const visit = (id: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push(id)
    const card = cards[id]
    for (const childID of card?.childIDs ?? []) visit(childID)
  }
  for (const id of order) visit(id)
  return out
}

export function orderedReachableCardIDs(): string[] {
  return reachableCardIDsFromTree(cardTreeStore.order, cardTreeStore.cards)
}

export function parentIDChainForCard(
  cardID: string,
  cards: Record<string, Pick<CardNode, "parentID"> | undefined> = cardTreeStore.cards,
): string[] {
  const ancestors: string[] = []
  const seen = new Set<string>()
  let current = String(cardID || "")
  while (current) {
    if (seen.has(current)) throw new Error(`card-tree: parentID cycle at ${current}`)
    seen.add(current)
    const parentID = cards[current]?.parentID
    if (!parentID) break
    if (!cards[parentID]) throw new Error(`card-tree: card ${current} references missing parent ${parentID}`)
    ancestors.unshift(parentID)
    current = parentID
  }
  return ancestors
}

export function topLevelCardIDForCard(
  cardID: string,
  order: readonly string[] = cardTreeStore.order,
  cards: Record<string, Pick<CardNode, "parentID"> | undefined> = cardTreeStore.cards,
): string | undefined {
  const orderSet = new Set(order)
  if (orderSet.has(cardID)) return cardID
  for (const parentID of parentIDChainForCard(cardID, cards)) {
    if (orderSet.has(parentID)) return parentID
  }
  return undefined
}

export function visibleChildIDsForCard(
  node: CardNode,
  cards: Record<string, CardNode | undefined> = cardTreeStore.cards,
): string[] {
  const childIDs = node.childIDs ?? []
  const visible: string[] = []
  for (const childID of childIDs) {
    const child = cards[childID]
    if (!child) {
      throw new Error(`card-tree: card ${node.id} references missing child ${childID}`)
    }
    visible.push(childID)
  }
  return visible
}

// ── Latest-activity preview (collapsed header) ──
// Walks the subtree and keeps only the single most recent activity by
// (part order-key time, part-index). An activity is either:
//   - a text part (assistant prose), or
//   - a tool part (formatted as "<ToolName>: <detail>" so the
//     operator can see "what is this card actually doing right now").
// This is the canonical preview source — text and tool calls compete
// for the same line so the operator always sees the actual latest
// signal, not whichever channel happened to be picked. Reasoning is
// intentionally excluded because Codex-style transcripts keep thinking
// behind its own disclosure instead of making it default body preview.

interface LatestHit {
  time: number
  index: number
  text: string
}

// Internal-only tools whose tool name + state carry no operator-visible
// signal. StructuredOutput is the Zod-call wrapper used for decompose /
// architect; surfacing it as preview text produces "StructuredOutput:
// Structured Output" — pure noise. Suppressed alongside TODO tools.
const PREVIEW_SUPPRESS_TOOLS = new Set(["structuredoutput", "structured_output"])

function toolHitText(part: any): string {
  if (!part || part.type !== "tool") return ""
  const name = String(part.tool || "").trim()
  if (!name) return ""
  const key = toolNameKey(name)
  // Todo tools own a dedicated UI row; surfacing them here would steal
  // attention from the actual work that happened around the plan.
  if (TODO_TOOLS.has(key)) return ""
  if (PREVIEW_SUPPRESS_TOOLS.has(key)) return ""
  const state = part.state || {}
  const detail = displayToolDetail(name, state.input, state, "")
  return detail ? `${name}: ${detail}` : name
}

function activityHitTime(part: any, label: string): number {
  return timelineOrderKeyTime(part?.orderKey, label)
}

function gatherLatest(node: CardNode, hits: LatestHit[]): void {
  if (!node) return
  if (node.kind === "tool" && node.toolPart) {
    const toolText = toolHitText(node.toolPart)
    if (toolText) {
      hits.push({
        time: activityHitTime(node.toolPart, `collapsed preview tool card ${node.id}`),
        index: 0,
        text: toolText,
      })
    }
  }
  const parts = node.parts || []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part?.type === "reasoning") continue
    const text = partText(part)
    if (text) {
      hits.push({ time: activityHitTime(part, `collapsed preview part ${node.id}/${i}`), index: i, text })
      continue
    }
    const toolText = toolHitText(part)
    if (toolText) {
      hits.push({
        time: activityHitTime(part, `collapsed preview tool part ${node.id}/${i}`),
        index: i,
        text: toolText,
      })
    }
  }
  for (const cid of node.childIDs || []) {
    const child = cardTreeStore.cards[cid]
    if (child) gatherLatest(child as unknown as CardNode, hits)
  }
}

export function collectLatestActivityText(node: CardNode): string {
  if (!node) return ""
  if (shouldUseCachedStats(node)) {
    const cached = node.subtreeLatestHit
    if (cached?.text) return cached.text
    return ""
  }
  const hits: LatestHit[] = []
  gatherLatest(node, hits)
  if (hits.length === 0) return ""
  let best = hits[0]
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i]
    if (h.time > best.time || (h.time === best.time && h.index > best.index)) {
      best = h
    }
  }
  return best.text
}

// ── Message segmentation ──
//
// A card aggregates N message turns into one flat `parts` array, with a
// `BoundaryPart` (carrying the effective role + timestamp) marking each
// turn transition. Splitting the array back at those boundaries yields the
// individual messages — this is the single source for that operation,
// shared by the Board streaming surfaces and the ConversationAgentRail
// "latest message" preview. Role is preserved verbatim (empty string when
// the boundary carried none); callers that require a role assert it
// themselves rather than this splitter inventing an assistant role.

export interface CardMessageSegment {
  id: string
  role: string
  time: number
  parts: any[]
}

export function cardMessageSegments(card: CardNode): CardMessageSegment[] {
  const parts = card.parts || []
  if (parts.length === 0) return []
  const segments: CardMessageSegment[] = []
  let boundary: BoundaryPart | null = null
  let buffer: any[] = []
  // A message-turn card IS one message and carries no in-card boundary
  // (the card itself is the boundary). Use the card's own
  // role/stage for that single segment. Phase-absorbed cards still carry
  // boundary parts (they fold N sub-sessions) and split exactly as before.
  const cardRole =
    typeof card.role === "string" && card.role.length > 0 ? card.role : typeof card.stage === "string" ? card.stage : ""
  const flush = () => {
    if (buffer.length === 0) return
    segments.push({
      id: `${card.id}:msg:${segments.length}`,
      role: typeof boundary?.role === "string" && boundary.role.length > 0 ? boundary.role : cardRole,
      time: boundary?.time ?? card.time ?? 0,
      parts: buffer,
    })
    buffer = []
  }
  for (const part of parts) {
    if (isBoundaryMessagePart(part)) {
      flush()
      boundary = part as BoundaryPart
      continue
    }
    buffer.push(part)
  }
  flush()
  return segments
}

// ── Activity counts (collapsed header) ──
// Tally the work that has happened inside a card subtree so the collapsed
// header can show agent/tool/skill/message counts and the operator gets a sense
// of activity volume without expanding the card.

export interface ActivityCounts {
  messages: number
  tools: number
  agents: number
  skills: number
}

function isSkillTool(key: string): boolean {
  // Claude-Code-style Skill tool, plus any tool whose key contains "skill"
  // (covers "skill", "invokeskill", "useskill", etc).
  return key === "skill" || /skill/.test(key)
}

function bumpCountsForPart(part: any, counts: ActivityCounts): void {
  if (!part) return
  if (part.type === "text" || part.type === "reasoning") {
    if (String(part.text || "").trim()) counts.messages++
    return
  }
  if (part.type !== "tool") return
  const key = toolNameKey(part.tool || "")
  if (!key) return
  if (isAgentDispatchTool(String(part.tool || ""))) {
    counts.agents++
    return
  }
  if (isSkillTool(key)) {
    counts.skills++
    return
  }
  counts.tools++
}

function gatherCounts(node: CardNode, counts: ActivityCounts): void {
  if (!node) return
  if (node.kind === "tool" && node.toolPart) {
    bumpCountsForPart(node.toolPart, counts)
  }
  for (const part of node.parts || []) {
    bumpCountsForPart(part, counts)
  }
  for (const cid of node.childIDs || []) {
    const child = cardTreeStore.cards[cid]
    if (child) gatherCounts(child as unknown as CardNode, counts)
  }
}

export function collectActivityCounts(node: CardNode): ActivityCounts {
  if (shouldUseCachedStats(node)) {
    const cached = node.subtreeCounts as StoreActivityCounts | undefined
    if (cached) {
      return {
        messages: cached.messages,
        tools: cached.tools,
        agents: cached.agents,
        skills: cached.skills,
      }
    }
  }
  const counts: ActivityCounts = { messages: 0, tools: 0, agents: 0, skills: 0 }
  gatherCounts(node, counts)
  return counts
}

// ── Todo summary (collapsed header) ──
// Walks the subtree to find the most recent TodoWrite/UpdatePlan tool part
// and reports counts + the in-progress (or last completed) item title.
// Returns null when no todo tool calls exist anywhere in the subtree —
// the header then skips the third row entirely.

export type { TodoSummary } from "./todos"

function extractTodoList(part: any): any[] | null {
  if (!part || part.type !== "tool") return null
  const key = toolNameKey(part.tool || "")
  if (!TODO_TOOLS.has(key)) return null
  return extractTodos(part.state || {})
}

interface TodoHit {
  time: number
  index: number
  todos: any[]
}

function gatherTodos(node: CardNode, hits: TodoHit[]): void {
  if (!node) return
  const baseTime = typeof node.time === "number" ? node.time : 0
  // kind="tool" cards carry the tool part on `toolPart` (parts[] is empty
  // because the tool was promoted into its own card).
  if (node.kind === "tool" && node.toolPart) {
    const todos = extractTodoList(node.toolPart)
    if (todos && todos.length > 0) hits.push({ time: baseTime, index: 0, todos })
  }
  const parts = node.parts || []
  for (let i = 0; i < parts.length; i++) {
    const todos = extractTodoList(parts[i])
    if (todos && todos.length > 0) hits.push({ time: baseTime, index: i, todos })
  }
  for (const cid of node.childIDs || []) {
    const child = cardTreeStore.cards[cid]
    if (child) gatherTodos(child as unknown as CardNode, hits)
  }
}

export function collectTodoSummary(node: CardNode): TodoSummary | null {
  if (!node) return null
  let best: TodoHit | undefined
  if (shouldUseCachedStats(node)) {
    const cached = node.subtreeTodoHit
    if (!cached || !Array.isArray(cached.todos) || cached.todos.length === 0) return null
    best = { time: cached.time, index: cached.index, todos: cached.todos }
  } else {
    const hits: TodoHit[] = []
    gatherTodos(node, hits)
    if (hits.length === 0) return null
    best = hits[0]
    for (let i = 1; i < hits.length; i++) {
      const h = hits[i]
      if (h.time > best.time || (h.time === best.time && h.index > best.index)) {
        best = h
      }
    }
  }
  return summarizeTodos(best.todos)
}
