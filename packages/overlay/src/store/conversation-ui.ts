import { batch } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { getServerUrl, type ApiAuthority } from "../services/api-state"
import type { BoardSource } from "./board"
import type { ConversationReadingAnchor, TextReadingAnchor } from "../utils/conversation-reading-anchor"

export type ConversationReadingPosition = { top: number; following: boolean; anchor?: ConversationReadingAnchor }
export type ToolPayloadDisplayState = {
  raw?: boolean
  expanded?: boolean
  limit?: number
  readingPosition?: { top: number; anchor?: TextReadingAnchor }
  rawReadingPosition?: { top: number; anchor?: TextReadingAnchor }
}
export type MainConversationReadingPosition = ConversationReadingPosition & {
  viewportWidth: number
}
export type ConversationArtifactDisplayState = {
  outputsExpanded?: boolean
  recordsExpanded?: boolean
  openOutputID?: string
  openArtifactID?: string
  query?: string
  selectedResourceKey?: string
}

type ConversationUiState = {
  storageKey: string
  expandedCards: Record<string, boolean>
  expandedDisclosures: Record<string, boolean>
  sourceExcerptPositions: Record<string, { top: number; anchor?: TextReadingAnchor }>
  sideChatReadingPositions: Record<string, ConversationReadingPosition>
  toolPayloadDisplays: Record<string, ToolPayloadDisplayState>
  artifactDisplays: Record<string, ConversationArtifactDisplayState>
}

const [store, setStore] = createStore({
  activeKey: "",
  conversations: {} as Record<string, ConversationUiState | undefined>,
  mainReadingPositions: {} as Record<string, MainConversationReadingPosition>,
})

export { store as conversationUiStore }

// ── localStorage persistence ──
// Only card folding persists across reloads. Reading positions and other
// disclosures live in the one record owned by the current API/source identity.
// Both storage and memory retain a bounded set of recently visited conversations.
const STORAGE_PREFIX = "oc_card_expand:"
const STORAGE_INDEX_KEY = "oc_card_expand_index"
const MAX_CONVERSATIONS = 50
const MAX_UI_ENTRIES = 200
const MAX_MAIN_READERS = 50
let captureMainReader: (() => void) | undefined
let recentConversations: string[] = []

const currentState = () => store.conversations[store.activeKey]

function remember<T>(record: Record<string, T>, id: string, value: T): Record<string, T> {
  const entries = Object.entries(record).filter(([key]) => key !== id)
  entries.push([id, value])
  return Object.fromEntries(entries.slice(-MAX_UI_ENTRIES))
}

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage
  } catch {
    return false
  }
}

function readIndex(): string[] {
  if (!isStorageAvailable()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function writeIndex(ids: string[]): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(ids))
  } catch {
    // storage full / quota — give up silently; persistence is best-effort
  }
}

function bumpIndex(key: string): void {
  const idx = readIndex().filter((id) => id !== key)
  idx.unshift(key)
  while (idx.length > MAX_CONVERSATIONS) {
    const evict = idx.pop()!
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + evict)
    } catch {
      // ignore
    }
  }
  writeIndex(idx)
}

function loadFromStorage(key: string): Record<string, boolean> {
  if (!isStorageAvailable() || !key) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>).slice(-MAX_UI_ENTRIES)) {
      if (typeof v !== "boolean") continue
      out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

// Fold changes are explicit, bounded presentation choices. Commit the active
// source's record before the page can close or change its selection.
function saveActiveConversation(): void {
  const current = currentState()
  if (!current || !isStorageAvailable()) return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + current.storageKey, JSON.stringify(current.expandedCards))
    bumpIndex(current.storageKey)
  } catch {
    // ignore quota errors
  }
}

/** All conversation kinds select one presentation record at the same boundary. */
export function loadConversationUiStateForSource(source: Pick<BoardSource, "kind" | "id">, authority: ApiAuthority): void {
  const key = JSON.stringify([authority.revision, source.kind, source.id])
  if (store.activeKey === key) return
  const storageKey = JSON.stringify([getServerUrl(), source.kind, source.id])
  const next = [...recentConversations.filter((item) => item !== key), key].slice(-MAX_CONVERSATIONS)
  batch(() => {
    if (!store.conversations[key]) {
      setStore("conversations", key, {
        storageKey,
        expandedCards: loadFromStorage(storageKey),
        expandedDisclosures: {},
        sourceExcerptPositions: {},
        sideChatReadingPositions: {},
        toolPayloadDisplays: {},
        artifactDisplays: {},
      })
    }
    for (const retired of recentConversations) {
      if (!next.includes(retired)) setStore("conversations", retired, undefined)
    }
    recentConversations = next
    setStore("activeKey", key)
  })
}

/** Deselect the current view; its bounded record remains available on return. */
export function clearConversationUiState(): void {
  setStore("activeKey", "")
}

/** Read the effective expanded state for a card. */
export function cardExpanded(id: string, defaultVal = true): boolean {
  if (!id) return defaultVal
  return currentState()?.expandedCards[id] ?? defaultVal
}

/** Flip the card's operator-owned expanded state. */
export function toggleCard(id: string, defaultVal = true): void {
  setCardExpanded(id, !cardExpanded(id, defaultVal))
}

/** Directly set a card's expanded state (used by bulk operations). */
export function setCardExpanded(id: string, value: boolean): void {
  const current = currentState()
  if (!id || !current) return
  setStore("conversations", store.activeKey, "expandedCards", reconcile(remember(current.expandedCards, id, value), { merge: false }))
  saveActiveConversation()
}

/** Read conversation-scoped execution/reasoning presentation state. Unlike card
 * folding, disclosures are intentionally independent of runtime status: a
 * data refresh must not rewrite the operator's current page arrangement. */
export function conversationDisclosureExpanded(id: string, defaultVal = false): boolean {
  if (!id) return defaultVal
  return currentState()?.expandedDisclosures[id] ?? defaultVal
}

export function setConversationDisclosureExpanded(id: string, value: boolean): void {
  const current = currentState()
  if (!id || !current) return
  setStore("conversations", store.activeKey, "expandedDisclosures", reconcile(remember(current.expandedDisclosures, id, value), { merge: false }))
}

/** Source reading intent belongs to the same retained conversation record. */
export function sourceExcerptReadingPosition(id: string): { top: number; anchor?: TextReadingAnchor } | undefined {
  return currentState()?.sourceExcerptPositions[id]
}

export function setSourceExcerptReadingPosition(id: string, position: { top: number; anchor?: TextReadingAnchor }): void {
  const current = currentState()
  if (!id || !current || !Number.isFinite(position.top)) return
  setStore("conversations", store.activeKey, "sourceExcerptPositions", reconcile(remember(current.sourceExcerptPositions, id, { ...position, top: Math.max(0, position.top) }), { merge: false }))
}

export function sideChatReadingPosition(id: string): ConversationReadingPosition | undefined {
  return currentState()?.sideChatReadingPositions[id]
}

export function toolPayloadDisplayState(id: string): ToolPayloadDisplayState | undefined {
  return currentState()?.toolPayloadDisplays[id]
}

export function setToolPayloadDisplayState(id: string, value: ToolPayloadDisplayState): void {
  const current = currentState()
  if (!id || !current) return
  const next = { ...current.toolPayloadDisplays[id], ...value }
  setStore("conversations", store.activeKey, "toolPayloadDisplays", reconcile(remember(current.toolPayloadDisplays, id, next), { merge: false }))
}

/** Delivery browsing follows the same API/source lifetime as other disclosures.
 * Only presentation keys live here; resources and content remain reader-owned. */
export function conversationArtifactDisplayState(id: string): ConversationArtifactDisplayState | undefined {
  return currentState()?.artifactDisplays[id]
}

export function setConversationArtifactDisplayState(id: string, value: ConversationArtifactDisplayState): void {
  const current = currentState()
  if (!id || !current) return
  const next = { ...current.artifactDisplays[id], ...value }
  setStore("conversations", store.activeKey, "artifactDisplays", reconcile(remember(current.artifactDisplays, id, next), { merge: false }))
}

export function setSideChatReadingPosition(id: string, position: ConversationReadingPosition): void {
  const current = currentState()
  if (!id || !current || !Number.isFinite(position.top)) return
  setStore("conversations", store.activeKey, "sideChatReadingPositions", reconcile(remember(current.sideChatReadingPositions, id, { ...position, top: Math.max(0, position.top) }), { merge: false }))
}

/** One visible main reader supplies its actual intent before projection retirement. */
export function registerMainReadingCapture(capture: () => void): () => void {
  captureMainReader = capture
  return () => {
    if (captureMainReader === capture) captureMainReader = undefined
  }
}

export function captureMainReadingPosition(): void {
  captureMainReader?.()
}

export function mainReadingPosition(key: string): MainConversationReadingPosition | undefined {
  return store.mainReadingPositions[key]
}

/** Main view memory crosses primary selection, but not its captured API authority. */
export function setMainReadingPosition(key: string, position: MainConversationReadingPosition): void {
  if (!key || !Number.isFinite(position.top)) return
  const entries = Object.entries(store.mainReadingPositions).filter(([id]) => id !== key)
  entries.push([key, { ...position, top: Math.max(0, position.top) }])
  setStore("mainReadingPositions", reconcile(Object.fromEntries(entries.slice(-MAX_MAIN_READERS)), { merge: false }))
}
