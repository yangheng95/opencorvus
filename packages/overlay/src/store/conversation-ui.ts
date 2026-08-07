import { createStore, reconcile } from "solid-js/store"

const [store, setStore] = createStore({
  // Operator-owned presentation state. Runtime card status must never rewrite
  // an explicit expand/collapse choice.
  expandedCards: {} as Record<string, boolean>,
  /** Task-scoped operator disclosures that must survive conversation tree
   * replacement without becoming persisted message data. */
  expandedDisclosures: {} as Record<string, boolean>,
})

export { store as conversationUiStore }

// ── localStorage persistence ──
// Card collapse is per-task (cleared on selectTask), but persisting across
// page reloads keeps the operator's review state when they refresh or the
// overlay restarts. Stored under `oc_card_expand:<taskID>`. We cap the
// persisted task list (LRU) so localStorage doesn't grow unbounded across
// hundreds of tasks. Per-task entry count is also capped to keep the JSON
// size sub-100KB.
const STORAGE_PREFIX = "oc_card_expand:"
const STORAGE_INDEX_KEY = "oc_card_expand_index"
const MAX_PERSISTED_TASKS = 50
const MAX_ENTRIES_PER_TASK = 200
let activeTaskID = ""
let saveTimer: any = null
const SAVE_DEBOUNCE_MS = 400

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

function bumpIndex(taskID: string): void {
  const idx = readIndex().filter((id) => id !== taskID)
  idx.unshift(taskID)
  while (idx.length > MAX_PERSISTED_TASKS) {
    const evict = idx.pop()!
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + evict)
    } catch {
      // ignore
    }
  }
  writeIndex(idx)
}

function loadFromStorage(taskID: string): Record<string, boolean> {
  if (!isStorageAvailable() || !taskID) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + taskID)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "boolean") continue
      out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

// Synchronous flush for the currently-active task. Called both by the
// debounced timer AND by the task-switch path so the previous task's
// in-flight changes never get dropped when the operator switches before
// the 400ms debounce fires. Returns true on a successful write.
function flushActiveTaskNow(): boolean {
  if (!activeTaskID || !isStorageAvailable()) return false
  try {
    const entries = Object.entries(store.expandedCards)
    // Cap entries — if a task touched >200 cards, drop the oldest by
    // iteration order (Object.entries preserves insertion order).
    const trimmed = entries.slice(-MAX_ENTRIES_PER_TASK)
    const payload = Object.fromEntries(trimmed)
    window.localStorage.setItem(STORAGE_PREFIX + activeTaskID, JSON.stringify(payload))
    bumpIndex(activeTaskID)
    return true
  } catch {
    // ignore quota errors
    return false
  }
}

function scheduleSave(): void {
  if (!activeTaskID || !isStorageAvailable()) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushActiveTaskNow()
  }, SAVE_DEBOUNCE_MS)
}

/** Switch the active task — load that task's persisted collapse state into
 *  the in-memory store at the task-selection boundary.
 *  CRITICAL: flushes the previous task's pending debounced save BEFORE
 *  swapping in the new state, so rapid task switches don't drop the
 *  prior task's collapse changes. */
export function loadConversationUiStateForTask(taskID: string): void {
  if (activeTaskID === taskID) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    // Drain any debounced edits from the previous task synchronously
    // before the activeTaskID flip — otherwise the new taskID would
    // capture the previous task's keys.
    flushActiveTaskNow()
  }
  activeTaskID = taskID
  const persisted = loadFromStorage(taskID)
  setStore("expandedCards", reconcile(persisted, { merge: false }))
  setStore("expandedDisclosures", reconcile({}, { merge: false }))
}

export function clearConversationUiState(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    // Same race as loadConversationUiStateForTask — flush before clear
    // so explicit "no task selected" doesn't drop the prior task's edits.
    flushActiveTaskNow()
  }
  activeTaskID = ""
  setStore("expandedCards", reconcile({}, { merge: false }))
  setStore("expandedDisclosures", reconcile({}, { merge: false }))
}

/** Read the effective expanded state for a card. */
export function cardExpanded(id: string, defaultVal = true): boolean {
  if (!id) return defaultVal
  return store.expandedCards[id] ?? defaultVal
}

/** Flip the card's operator-owned expanded state. */
export function toggleCard(id: string, defaultVal = true): void {
  if (!id) return
  const cur = cardExpanded(id, defaultVal)
  setStore("expandedCards", id, !cur)
  scheduleSave()
}

/** Directly set a card's expanded state (used by bulk operations). */
export function setCardExpanded(id: string, value: boolean): void {
  if (!id) return
  setStore("expandedCards", id, value)
  scheduleSave()
}

/** Read task-scoped execution/reasoning presentation state. Unlike card
 * folding, disclosures are intentionally independent of runtime status: a
 * data refresh must not rewrite the operator's current page arrangement. */
export function conversationDisclosureExpanded(id: string, defaultVal = false): boolean {
  if (!id) return defaultVal
  return store.expandedDisclosures[id] ?? defaultVal
}

export function setConversationDisclosureExpanded(id: string, value: boolean): void {
  if (!id) return
  setStore("expandedDisclosures", id, value)
}
