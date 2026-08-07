// ── Card Tree Stats Kernel ──
//
// Incrementally-maintained card-tree aggregates for collapsed bubble headers
// and the chat-header usage strip.
//
// Why this exists: the collapsed bubble UI surfaces three subtree aggregates
// per card — activity counts (agents/tools/messages), latest text-or-tool
// activity line, and the most-recent TODO snapshot. Without caching, each
// visible collapsed bubble's `createMemo` recursively walks its subtree on
// every SSE event because Solid tracks `cardTreeStore.cards[childID]` reads
// through the recursion. At 500 cards and ~10 visible collapsed bubbles
// the per-event cost is O(visible × subtree) ≈ O(N²).
//
// Fix: store `subtreeCounts` / `subtreeLatestHit` / `subtreeTodoHit` /
// `subtreeUsageAggregate` on each CardNode, maintained by an explicit
// O(depth) bubble-up walk from the affected leaf when tree-writer mutates
// parts/usage/childIDs. The Solid memos then read these fields directly —
// O(1) per bubble, invalidating only when the cached value actually changes
// (we equality-check before writing). Net per-event work shrinks from
// O(visible × subtree) to O(depth). The chat-header usage strip reads
// `cardTreeStore.usageAggregate`, which is maintained from a per-card own
// usage index so the always-mounted header does not scan
// `Object.values(cardTreeStore.cards)` on every SSE event.
//
// Contract:
//   - `markCardStatsDirty(cardID)` queues a card whose own-level inputs
//     changed (parts, toolPart, usage/context tokens, or childIDs touched).
//   - `flushCardStats()` drains the queue, walking each card's ancestor
//     chain via `parentID` and rewriting cached fields where they differ.
//   - Tree-writer must call `flushCardStats()` inside every reactivity
//     batch (`applyVisibleCardTreeEvent` epilogue + `flushBufferedPartDeltas`
//     epilogue + `rebuildBoardDerivedCards` epilogue). Outside a batch we
//     would emit one notification per ancestor — inside one batch the whole
//     chain coalesces into one render frame.
//   - `linkChildToParent(parentID, childID)` and `unlinkChildFromParent(childID)`
//     are the parentID maintenance hooks. Tree-writer calls them whenever it
//     writes `cards[parentID].childIDs`. Stale entries (orphan childID that
//     was moved to a new parent) are corrected by the new parent's link call
//     overwriting the field.
//
// Transient tool cards never flow through tree-writer, so their cache is never
// populated. The public collectors in `utils/card-tree.ts` keep a direct
// recursive path for cards without cached aggregates.

import { toolNameKey, displayToolDetail, isAgentDispatchTool } from "../utils/tool"
import { extractTodos } from "../utils/todos"
import { timelineOrderKeyTime } from "../utils/timeline-order"
import {
  collectScreenshotBrowserItemsFromCard,
  mergeScreenshotBrowserItemSets,
  screenshotBrowserItemKey,
  SCREENSHOT_BROWSER_ITEM_LIMIT,
  type ScreenshotBrowserItem,
} from "../utils/screenshot-browser"
import { aggregateUsageAcrossSessions, type UsageAggregate } from "../utils/format-usage"
import {
  cardTreeStore,
  registerCardTreeOrderStatsHandler,
  registerCardTreePruneStatsHandler,
  setCardTreeStore,
  type ActivityCounts,
  type CardNode,
  type LatestActivityHit,
  type TodoActivityHit,
} from "./card-tree"

// ── Own-level computation (mirrors utils/card-tree.ts policy) ──
//
// These functions own the "what counts as an activity / preview hit / todo
// hit" policy for a SINGLE node's own parts + toolPart. The recursive path
// in `utils/card-tree.ts` serves transient cards; both must stay
// byte-equivalent, which the cache-invariant test enforces by comparing
// cached output to a recursive recomputation on the same fixture.

const TODO_TOOLS = new Set(["todowrite", "todoread", "todoupdate", "updateplan"])

const PREVIEW_SUPPRESS_TOOLS = new Set(["structuredoutput", "structured_output"])

function isSkillTool(key: string): boolean {
  return key === "skill" || /skill/.test(key)
}

function bumpForPart(part: any, counts: ActivityCounts): void {
  if (!part) return
  if (part.type === "text" || part.type === "reasoning") {
    if (String(part.text || "").trim()) counts.messages += 1
    return
  }
  if (part.type !== "tool") return
  const key = toolNameKey(part.tool || "")
  if (!key) return
  if (isAgentDispatchTool(String(part.tool || ""))) {
    counts.agents += 1
    return
  }
  if (isSkillTool(key)) {
    counts.skills += 1
    return
  }
  counts.tools += 1
}

function partText(part: any): string {
  if (!part) return ""
  if (part.type === "text") {
    return String(part.text || "").trim()
  }
  return ""
}

function toolHitText(part: any): string {
  if (!part || part.type !== "tool") return ""
  const name = String(part.tool || "").trim()
  if (!name) return ""
  const key = toolNameKey(name)
  if (TODO_TOOLS.has(key)) return ""
  if (PREVIEW_SUPPRESS_TOOLS.has(key)) return ""
  const state = part.state || {}
  const detail = displayToolDetail(name, state.input, state, "")
  return detail ? `${name}: ${detail}` : name
}

function extractTodoList(part: any): any[] | null {
  if (!part || part.type !== "tool") return null
  const key = toolNameKey(part.tool || "")
  if (!TODO_TOOLS.has(key)) return null
  return extractTodos(part.state || {})
}

/** Newer hit wins by (time, index). Tied null + non-null returns non-null. */
function pickLater<T extends { time: number; index: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b
  if (!b) return a
  if (b.time > a.time || (b.time === a.time && b.index > a.index)) return b
  return a
}

/** Compute a single card's OWN-LEVEL contributions (parts + toolPart only,
 *  no recursion). Returns a tuple ready to be combined with cached child
 *  aggregates. */
function activityHitTime(part: any, label: string): number {
  return timelineOrderKeyTime(part?.orderKey, label)
}

function ownLevelStats(card: CardNode): {
  counts: ActivityCounts
  latestHit: LatestActivityHit | undefined
  todoHit: TodoActivityHit | undefined
  screenshotItems: ScreenshotBrowserItem[]
} {
  const counts: ActivityCounts = { messages: 0, tools: 0, agents: 0, skills: 0 }
  let latestHit: LatestActivityHit | undefined
  let todoHit: TodoActivityHit | undefined
  const baseTime = typeof card.time === "number" ? card.time : 0

  if (card.kind === "tool" && card.toolPart) {
    bumpForPart(card.toolPart, counts)
    const t = toolHitText(card.toolPart)
    if (t) {
      latestHit = pickLater(latestHit, {
        time: activityHitTime(card.toolPart, `card-tree stats tool card ${card.id}`),
        index: 0,
        text: t,
      })
    }
    const todos = extractTodoList(card.toolPart)
    if (todos && todos.length > 0) {
      todoHit = pickLater(todoHit, { time: baseTime, index: 0, todos })
    }
  }
  const parts = card.parts || []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    bumpForPart(part, counts)
    const text = partText(part)
    if (text) {
      latestHit = pickLater(latestHit, {
        time: activityHitTime(part, `card-tree stats part ${card.id}/${i}`),
        index: i,
        text,
      })
    } else {
      const tt = toolHitText(part)
      if (tt) {
        latestHit = pickLater(latestHit, {
          time: activityHitTime(part, `card-tree stats tool part ${card.id}/${i}`),
          index: i,
          text: tt,
        })
      }
    }
    const todos = extractTodoList(part)
    if (todos && todos.length > 0) {
      todoHit = pickLater(todoHit, { time: baseTime, index: i, todos })
    }
  }
  return { counts, latestHit, todoHit, screenshotItems: collectScreenshotBrowserItemsFromCard(card) }
}

function equalCounts(a: ActivityCounts | undefined, b: ActivityCounts): boolean {
  return (
    a !== undefined &&
    a.messages === b.messages &&
    a.tools === b.tools &&
    a.agents === b.agents &&
    a.skills === b.skills
  )
}

function equalLatestHit(a: LatestActivityHit | undefined, b: LatestActivityHit | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.time === b.time && a.index === b.index && a.text === b.text
}

function equalTodoHit(a: TodoActivityHit | undefined, b: TodoActivityHit | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.time !== b.time || a.index !== b.index) return false
  // Object identity is enough: we only ever store the original tool-call's
  // todos array; a new hit means a new tool call with a fresh array.
  return a.todos === b.todos
}

function equalScreenshotItem(a: ScreenshotBrowserItem | undefined, b: ScreenshotBrowserItem | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.role === b.role &&
    a.ownerKey === b.ownerKey &&
    a.ownerID === b.ownerID &&
    a.ownerRole === b.ownerRole &&
    a.ownerSessionID === b.ownerSessionID &&
    a.ownerMessageID === b.ownerMessageID &&
    a.ownerTime === b.ownerTime &&
    a.ownerLabel === b.ownerLabel &&
    a.src === b.src &&
    a.thumbnailSrc === b.thumbnailSrc &&
    a.alt === b.alt &&
    a.title === b.title &&
    a.detail === b.detail &&
    a.time === b.time &&
    a.messageID === b.messageID &&
    a.partID === b.partID &&
    a.source === b.source
  )
}

function equalScreenshotItems(
  a: readonly ScreenshotBrowserItem[] | undefined,
  b: readonly ScreenshotBrowserItem[],
): boolean {
  if (a === b) return true
  if (!a || a.length !== b.length) return false
  for (let index = 0; index < b.length; index += 1) {
    if (!equalScreenshotItem(a[index], b[index])) return false
  }
  return true
}

// ── Dirty queue + bubble-up ──

interface TopLevelScreenshotOwnedItem {
  rootID: string
  item: ScreenshotBrowserItem
  index: number
}

interface TopLevelScreenshotHeapEntry extends TopLevelScreenshotOwnedItem {
  key: string
}

const dirtyCardIDs = new Set<string>()
let topLevelRootIDs = new Set<string>()
let topLevelRootRank = new Map<string, number>()
let topLevelScreenshotRootItemKeys = new Map<string, Set<string>>()
let topLevelScreenshotItemOwners = new Map<string, Map<string, TopLevelScreenshotOwnedItem>>()
let topLevelScreenshotActiveOwners = new Map<string, TopLevelScreenshotOwnedItem>()
let topLevelScreenshotHeap: TopLevelScreenshotHeapEntry[] = []
let topLevelScreenshotHeapIndexes = new Map<string, number>()
let cardUsageAggregates = new Map<string, UsageAggregate>()
let topLevelScreenshotItemsDirty = true
let usageAggregateDirty = true

function compareTopLevelScreenshotOwnedItem(a: TopLevelScreenshotOwnedItem, b: TopLevelScreenshotOwnedItem): number {
  const rootRankA = topLevelRootRank.get(a.rootID) ?? Number.MAX_SAFE_INTEGER
  const rootRankB = topLevelRootRank.get(b.rootID) ?? Number.MAX_SAFE_INTEGER
  if (rootRankA !== rootRankB) return rootRankA - rootRankB
  return a.index - b.index
}

function isTopLevelScreenshotHeapEntryHigher(a: TopLevelScreenshotHeapEntry, b: TopLevelScreenshotHeapEntry): boolean {
  if (a.item.time !== b.item.time) return a.item.time > b.item.time
  const ownerOrder = compareTopLevelScreenshotOwnedItem(a, b)
  if (ownerOrder !== 0) return ownerOrder < 0
  return a.key < b.key
}

function swapTopLevelScreenshotHeapEntries(left: number, right: number): void {
  const current = topLevelScreenshotHeap[left]
  topLevelScreenshotHeap[left] = topLevelScreenshotHeap[right]
  topLevelScreenshotHeap[right] = current
  topLevelScreenshotHeapIndexes.set(topLevelScreenshotHeap[left].key, left)
  topLevelScreenshotHeapIndexes.set(topLevelScreenshotHeap[right].key, right)
}

function bubbleTopLevelScreenshotHeapUp(index: number): number {
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (!isTopLevelScreenshotHeapEntryHigher(topLevelScreenshotHeap[index], topLevelScreenshotHeap[parent])) break
    swapTopLevelScreenshotHeapEntries(index, parent)
    index = parent
  }
  return index
}

function bubbleTopLevelScreenshotHeapDown(index: number): void {
  while (true) {
    const left = index * 2 + 1
    const right = left + 1
    let highest = index
    if (
      left < topLevelScreenshotHeap.length &&
      isTopLevelScreenshotHeapEntryHigher(topLevelScreenshotHeap[left], topLevelScreenshotHeap[highest])
    ) {
      highest = left
    }
    if (
      right < topLevelScreenshotHeap.length &&
      isTopLevelScreenshotHeapEntryHigher(topLevelScreenshotHeap[right], topLevelScreenshotHeap[highest])
    ) {
      highest = right
    }
    if (highest === index) break
    swapTopLevelScreenshotHeapEntries(index, highest)
    index = highest
  }
}

function upsertTopLevelScreenshotHeap(entry: TopLevelScreenshotHeapEntry): void {
  const existingIndex = topLevelScreenshotHeapIndexes.get(entry.key)
  if (existingIndex === undefined) {
    topLevelScreenshotHeap.push(entry)
    topLevelScreenshotHeapIndexes.set(entry.key, topLevelScreenshotHeap.length - 1)
    bubbleTopLevelScreenshotHeapUp(topLevelScreenshotHeap.length - 1)
    return
  }
  topLevelScreenshotHeap[existingIndex] = entry
  topLevelScreenshotHeapIndexes.set(entry.key, existingIndex)
  const bubbledIndex = bubbleTopLevelScreenshotHeapUp(existingIndex)
  bubbleTopLevelScreenshotHeapDown(bubbledIndex)
}

function popTopLevelScreenshotHeap(): TopLevelScreenshotHeapEntry | undefined {
  const first = topLevelScreenshotHeap[0]
  const last = topLevelScreenshotHeap.pop()
  if (!first || !last) return first
  topLevelScreenshotHeapIndexes.delete(first.key)
  if (topLevelScreenshotHeap.length === 0) return first
  topLevelScreenshotHeap[0] = last
  topLevelScreenshotHeapIndexes.set(last.key, 0)
  bubbleTopLevelScreenshotHeapDown(0)
  return first
}

function removeTopLevelScreenshotHeapEntry(key: string): void {
  const index = topLevelScreenshotHeapIndexes.get(key)
  if (index === undefined) return
  topLevelScreenshotHeapIndexes.delete(key)
  const last = topLevelScreenshotHeap.pop()
  if (!last || index >= topLevelScreenshotHeap.length) return
  topLevelScreenshotHeap[index] = last
  topLevelScreenshotHeapIndexes.set(last.key, index)
  const bubbledIndex = bubbleTopLevelScreenshotHeapUp(index)
  bubbleTopLevelScreenshotHeapDown(bubbledIndex)
}

function rebuildTopLevelScreenshotHeapFromActiveOwners(): void {
  topLevelScreenshotHeap = []
  topLevelScreenshotHeapIndexes = new Map<string, number>()
  for (const [key, owner] of topLevelScreenshotActiveOwners) {
    upsertTopLevelScreenshotHeap({ ...owner, key })
  }
}

function setTopLevelScreenshotActiveOwner(key: string, owner: TopLevelScreenshotOwnedItem | undefined): void {
  const previous = topLevelScreenshotActiveOwners.get(key)
  if (!owner) {
    if (!previous) return
    topLevelScreenshotActiveOwners.delete(key)
    removeTopLevelScreenshotHeapEntry(key)
    topLevelScreenshotItemsDirty = true
    return
  }
  if (
    previous &&
    previous.rootID === owner.rootID &&
    previous.index === owner.index &&
    equalScreenshotItem(previous.item, owner.item)
  ) {
    return
  }
  topLevelScreenshotActiveOwners.set(key, owner)
  upsertTopLevelScreenshotHeap({ ...owner, key })
  topLevelScreenshotItemsDirty = true
}

function chooseTopLevelScreenshotOwner(key: string): TopLevelScreenshotOwnedItem | undefined {
  const owners = topLevelScreenshotItemOwners.get(key)
  if (!owners || owners.size === 0) return undefined
  let selected: TopLevelScreenshotOwnedItem | undefined
  for (const owner of owners.values()) {
    if (!selected || compareTopLevelScreenshotOwnedItem(owner, selected) < 0) selected = owner
  }
  return selected
}

function reconcileTopLevelScreenshotItemOwner(key: string): void {
  setTopLevelScreenshotActiveOwner(key, chooseTopLevelScreenshotOwner(key))
}

function removeTopLevelRootScreenshotItems(rootID: string): void {
  const keys = topLevelScreenshotRootItemKeys.get(rootID)
  if (!keys) return
  topLevelScreenshotRootItemKeys.delete(rootID)
  for (const key of keys) {
    const owners = topLevelScreenshotItemOwners.get(key)
    if (!owners) continue
    owners.delete(rootID)
    if (owners.size === 0) topLevelScreenshotItemOwners.delete(key)
    reconcileTopLevelScreenshotItemOwner(key)
  }
}

function addTopLevelRootScreenshotItems(rootID: string, items: readonly ScreenshotBrowserItem[]): void {
  if (!topLevelRootIDs.has(rootID)) return
  const keys = new Set<string>()
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item?.src) continue
    const key = screenshotBrowserItemKey(item)
    if (keys.has(key)) continue
    keys.add(key)
    let owners = topLevelScreenshotItemOwners.get(key)
    if (!owners) {
      owners = new Map<string, TopLevelScreenshotOwnedItem>()
      topLevelScreenshotItemOwners.set(key, owners)
    }
    owners.set(rootID, { rootID, item, index })
  }
  if (keys.size > 0) topLevelScreenshotRootItemKeys.set(rootID, keys)
  for (const key of keys) reconcileTopLevelScreenshotItemOwner(key)
}

function syncTopLevelRootScreenshotItems(cardID: string, items: readonly ScreenshotBrowserItem[]): void {
  if (!topLevelRootIDs.has(cardID)) return
  removeTopLevelRootScreenshotItems(cardID)
  if (items.length > 0) addTopLevelRootScreenshotItems(cardID, items)
}

function clearTopLevelScreenshotIndex(): void {
  topLevelRootIDs = new Set<string>()
  topLevelRootRank = new Map<string, number>()
  topLevelScreenshotRootItemKeys = new Map<string, Set<string>>()
  topLevelScreenshotItemOwners = new Map<string, Map<string, TopLevelScreenshotOwnedItem>>()
  topLevelScreenshotActiveOwners = new Map<string, TopLevelScreenshotOwnedItem>()
  topLevelScreenshotHeap = []
  topLevelScreenshotHeapIndexes = new Map<string, number>()
}

function uniqueTopLevelOrder(order: readonly string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const cardID of order) {
    if (seen.has(cardID)) continue
    seen.add(cardID)
    unique.push(cardID)
  }
  return unique
}

function equalStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < b.length; index += 1) {
    if (a[index] !== b[index]) return false
  }
  return true
}

function reconcileAllTopLevelScreenshotItemOwners(): void {
  for (const key of Array.from(topLevelScreenshotItemOwners.keys())) reconcileTopLevelScreenshotItemOwner(key)
}

function addTopLevelRootFromStore(cardID: string): void {
  const card = cardTreeStore.cards[cardID]
  if (!card) throw new Error(`card-tree stats order references missing card ${cardID}`)
  const items = card.subtreeScreenshotItems
  if (Array.isArray(items)) {
    if (items.length > 0) addTopLevelRootScreenshotItems(cardID, items)
    return
  }
  markCardStatsDirty(cardID)
}

function applyTopLevelOrderChange(_previousOrder: readonly string[], nextOrder: readonly string[]): void {
  const previousRootIDs = topLevelRootIDs
  const nextRootList = uniqueTopLevelOrder(nextOrder)
  const nextRootIDs = new Set(nextRootList)
  const retainedBefore = Array.from(previousRootIDs).filter((cardID) => nextRootIDs.has(cardID))
  const retainedAfter = nextRootList.filter((cardID) => previousRootIDs.has(cardID))
  const retainedRootsReordered = !equalStringList(retainedBefore, retainedAfter)

  for (const cardID of previousRootIDs) {
    if (!nextRootIDs.has(cardID)) removeTopLevelRootScreenshotItems(cardID)
  }

  topLevelRootIDs = nextRootIDs
  topLevelRootRank = new Map(nextRootList.map((cardID, index) => [cardID, index]))

  for (const cardID of nextRootList) {
    if (previousRootIDs.has(cardID)) continue
    addTopLevelRootFromStore(cardID)
  }

  if (retainedRootsReordered) {
    reconcileAllTopLevelScreenshotItemOwners()
    rebuildTopLevelScreenshotHeapFromActiveOwners()
    topLevelScreenshotItemsDirty = true
  }
}

function collectTopLevelScreenshotItemsFromHeap(): ScreenshotBrowserItem[] {
  const retained: TopLevelScreenshotHeapEntry[] = []
  const items: ScreenshotBrowserItem[] = []
  while (topLevelScreenshotHeap.length > 0 && items.length < SCREENSHOT_BROWSER_ITEM_LIMIT) {
    const entry = popTopLevelScreenshotHeap()
    if (!entry) break
    retained.push(entry)
    items.push(entry.item)
  }
  for (const entry of retained) upsertTopLevelScreenshotHeap(entry)
  return items
}

function flushTopLevelScreenshotItems(): void {
  if (!topLevelScreenshotItemsDirty) return
  topLevelScreenshotItemsDirty = false
  const screenshotItems = collectTopLevelScreenshotItemsFromHeap()
  if (!equalScreenshotItems(cardTreeStore.screenshotItems, screenshotItems)) {
    setCardTreeStore("screenshotItems", screenshotItems)
  }
}

function equalUsageAggregate(a: UsageAggregate | undefined, b: UsageAggregate): boolean {
  return a !== undefined && a.tokens === b.tokens && a.costUSD === b.costUSD && a.estimated === b.estimated
}

function isZeroUsageAggregate(aggregate: UsageAggregate): boolean {
  return aggregate.tokens === 0 && aggregate.costUSD === 0 && !aggregate.estimated
}

function combineUsageAggregates(aggregates: Iterable<UsageAggregate>): UsageAggregate {
  let tokens = 0
  let costUSD = 0
  let estimated = false
  for (const aggregate of aggregates) {
    tokens += aggregate.tokens
    costUSD += aggregate.costUSD
    estimated = estimated || aggregate.estimated
  }
  return { tokens, costUSD, estimated }
}

function removeCardUsageAggregate(cardID: string): boolean {
  const removed = cardUsageAggregates.delete(cardID)
  if (removed) usageAggregateDirty = true
  return removed
}

function syncCardOwnUsageAggregate(cardID: string, aggregate: UsageAggregate): void {
  if (isZeroUsageAggregate(aggregate)) {
    removeCardUsageAggregate(cardID)
    return
  }
  if (!equalUsageAggregate(cardUsageAggregates.get(cardID), aggregate)) {
    cardUsageAggregates.set(cardID, aggregate)
    usageAggregateDirty = true
  }
}

function flushUsageAggregate(): void {
  if (!usageAggregateDirty) return
  usageAggregateDirty = false
  const aggregate = combineUsageAggregates(cardUsageAggregates.values())
  if (!equalUsageAggregate(cardTreeStore.usageAggregate, aggregate)) {
    setCardTreeStore("usageAggregate", aggregate)
  }
}

/** Mark a card as needing a subtree-stats recompute. Cheap; safe to call
 *  many times per batch — recompute happens once in `flushCardStats`. */
export function markCardStatsDirty(cardID: string): void {
  if (cardID) dirtyCardIDs.add(cardID)
}

export function markCardStatsRemoved(cardID: string): void {
  if (!cardID) return
  dirtyCardIDs.delete(cardID)
  removeCardUsageAggregate(cardID)
}

/** Maintain the back-pointer used by `bubbleStatsFromCard`. Tree-writer
 *  calls this whenever a cardID is placed into a parent's childIDs. */
export function linkChildToParent(parentID: string, childID: string): void {
  if (!childID) return
  const card = cardTreeStore.cards[childID]
  if (!card) return
  if (card.parentID === parentID) return
  setCardTreeStore("cards", childID, "parentID", parentID)
}

/** Clear the back-pointer when a card is detached from its parent (delete
 *  or move-without-new-parent). Called from `removeCardReferences`. */
export function unlinkChildFromParent(childID: string): void {
  if (!childID) return
  const card = cardTreeStore.cards[childID]
  if (!card || card.parentID === undefined) return
  setCardTreeStore("cards", childID, "parentID", undefined)
}

/** Recompute one card's cached aggregates from its own parts/toolPart plus
 *  the cached aggregates of its direct children. Returns `true` when ANY
 *  cached field actually changed (drives the early-exit during bubble-up
 *  — once an ancestor's aggregate is stable, ancestors further up cannot
 *  have changed either). */
function recomputeNodeStats(cardID: string): boolean {
  const card = cardTreeStore.cards[cardID]
  if (!card) return removeCardUsageAggregate(cardID)
  const own = ownLevelStats(card)
  let counts = own.counts
  let latestHit = own.latestHit
  let todoHit = own.todoHit
  const ownUsageAggregate = aggregateUsageAcrossSessions([card])
  syncCardOwnUsageAggregate(cardID, ownUsageAggregate)
  let usageAggregate = ownUsageAggregate
  const screenshotItemSets: Array<readonly ScreenshotBrowserItem[]> = [own.screenshotItems]
  for (const childID of card.childIDs ?? []) {
    const child = cardTreeStore.cards[childID]
    if (!child) continue
    const childCounts = child.subtreeCounts
    if (childCounts) {
      counts = {
        messages: counts.messages + childCounts.messages,
        tools: counts.tools + childCounts.tools,
        agents: counts.agents + childCounts.agents,
        skills: counts.skills + childCounts.skills,
      }
    }
    latestHit = pickLater(latestHit, child.subtreeLatestHit)
    todoHit = pickLater(todoHit, child.subtreeTodoHit)
    if (child.subtreeScreenshotItems) screenshotItemSets.push(child.subtreeScreenshotItems)
    if (child.subtreeUsageAggregate) {
      usageAggregate = combineUsageAggregates([usageAggregate, child.subtreeUsageAggregate])
    }
  }
  const screenshotItems = mergeScreenshotBrowserItemSets(screenshotItemSets)
  let changed = false
  if (!equalCounts(card.subtreeCounts, counts)) {
    setCardTreeStore("cards", cardID, "subtreeCounts", counts)
    changed = true
  }
  if (!equalLatestHit(card.subtreeLatestHit, latestHit)) {
    setCardTreeStore("cards", cardID, "subtreeLatestHit", latestHit)
    changed = true
  }
  if (!equalTodoHit(card.subtreeTodoHit, todoHit)) {
    setCardTreeStore("cards", cardID, "subtreeTodoHit", todoHit)
    changed = true
  }
  if (!equalScreenshotItems(card.subtreeScreenshotItems, screenshotItems)) {
    setCardTreeStore("cards", cardID, "subtreeScreenshotItems", screenshotItems)
    syncTopLevelRootScreenshotItems(cardID, screenshotItems)
    changed = true
  }
  if (!equalUsageAggregate(card.subtreeUsageAggregate, usageAggregate)) {
    setCardTreeStore("cards", cardID, "subtreeUsageAggregate", usageAggregate)
    changed = true
  }
  return changed
}

/** Walk up the ancestor chain via `parentID`, recomputing each ancestor's
 *  cached aggregates. Stops early when an ancestor's aggregate doesn't
 *  change (transitively all further ancestors stay the same). */
function bubbleStatsFromCard(cardID: string, seen: Set<string>): void {
  let current: string | undefined = cardID
  while (current && !seen.has(current)) {
    seen.add(current)
    const changed = recomputeNodeStats(current)
    if (!changed) return
    current = cardTreeStore.cards[current]?.parentID
  }
}

/** Drain the dirty queue. Each entry's ancestor chain is recomputed once;
 *  ancestors visited via a prior entry are skipped. Safe to call when the
 *  queue is empty (no-op). */
export function flushCardStats(): void {
  if (dirtyCardIDs.size > 0) {
    const toFlush = [...dirtyCardIDs]
    dirtyCardIDs.clear()
    const seen = new Set<string>()
    // Re-seeding seen from scratch each flush is correct: a card touched in
    // a prior flush has its cache already settled relative to its descendants;
    // a new flush only needs to revisit ancestors of cards dirtied THIS round.
    for (const id of toFlush) bubbleStatsFromCard(id, seen)
  }
  flushTopLevelScreenshotItems()
  flushUsageAggregate()
}

/** Test-only escape hatch: clear queue without flushing. Production code
 *  should never need this — tree-writer always flushes at batch end. */
export function __resetCardStatsForTests(): void {
  dirtyCardIDs.clear()
  clearTopLevelScreenshotIndex()
  cardUsageAggregates = new Map<string, UsageAggregate>()
  topLevelScreenshotItemsDirty = true
  usageAggregateDirty = true
}

registerCardTreeOrderStatsHandler(applyTopLevelOrderChange)

registerCardTreePruneStatsHandler(() => {
  for (const cardID of cardUsageAggregates.keys()) {
    if (!cardTreeStore.cards[cardID]) removeCardUsageAggregate(cardID)
  }
  for (const [cardID, card] of Object.entries(cardTreeStore.cards)) {
    const parentID = card?.parentID
    if (parentID) {
      const parent = cardTreeStore.cards[parentID]
      if (!parent || !Array.isArray(parent.childIDs) || !parent.childIDs.includes(cardID)) {
        unlinkChildFromParent(cardID)
      }
    }
    markCardStatsDirty(cardID)
  }
  flushCardStats()
})
