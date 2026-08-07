import { createStore, reconcile } from "solid-js/store"

export interface ComposerDraftEntry {
  text: string
  updated: number
}

export type ComposerDraftRecords = Record<string, ComposerDraftEntry>

export const COMPOSER_DRAFT_STORAGE_KEY = "oc_composer_drafts_v1"
export const MAX_COMPOSER_DRAFTS = 120

export function normalizeComposerDraftKey(key: string | null | undefined): string {
  return typeof key === "string" ? key.trim() : ""
}

export function composerDraftKey(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join(":")
}

export function parseComposerDraftRecords(raw: string | null | undefined): ComposerDraftRecords {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  const records: ComposerDraftRecords = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) continue
    const text = (value as { text?: unknown }).text
    const updated = (value as { updated?: unknown }).updated
    if (typeof text !== "string") continue
    if (typeof updated !== "number" || !Number.isFinite(updated) || updated <= 0) continue
    records[key] = { text, updated }
  }
  return records
}

export function pruneComposerDraftRecords(
  records: ComposerDraftRecords,
  maxEntries = MAX_COMPOSER_DRAFTS,
): ComposerDraftRecords {
  const entries = Object.entries(records)
    .filter(([, entry]) => entry.text.length > 0)
    .sort((left, right) => right[1].updated - left[1].updated)
    .slice(0, Math.max(0, maxEntries))
  return Object.fromEntries(entries)
}

export function nextComposerDraftRecords(input: {
  records: ComposerDraftRecords
  key: string | null | undefined
  text: string
  updated: number
  maxEntries?: number
}): ComposerDraftRecords {
  const key = normalizeComposerDraftKey(input.key)
  if (!key) return input.records
  const next: ComposerDraftRecords = { ...input.records }
  if (input.text.length === 0) {
    delete next[key]
  } else {
    next[key] = { text: input.text, updated: input.updated }
  }
  return pruneComposerDraftRecords(next, input.maxEntries ?? MAX_COMPOSER_DRAFTS)
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function loadComposerDraftRecords(): ComposerDraftRecords {
  const target = storage()
  if (!target) return {}
  try {
    return pruneComposerDraftRecords(parseComposerDraftRecords(target.getItem(COMPOSER_DRAFT_STORAGE_KEY)))
  } catch {
    return {}
  }
}

function persistComposerDraftRecords(records: ComposerDraftRecords): void {
  const target = storage()
  if (!target) return
  try {
    if (Object.keys(records).length === 0) {
      target.removeItem(COMPOSER_DRAFT_STORAGE_KEY)
    } else {
      target.setItem(COMPOSER_DRAFT_STORAGE_KEY, JSON.stringify(records))
    }
  } catch (err) {
    console.warn("[composer-draft] failed to persist scoped draft", err)
  }
}

export const [composerDraftStore, setComposerDraftStore] = createStore({
  drafts: loadComposerDraftRecords(),
})

export function composerDraftText(key: string | null | undefined): string {
  const normalized = normalizeComposerDraftKey(key)
  return normalized ? (composerDraftStore.drafts[normalized]?.text ?? "") : ""
}

export function setComposerDraft(key: string | null | undefined, text: string): void {
  if (!normalizeComposerDraftKey(key)) return
  const next = nextComposerDraftRecords({
    records: composerDraftStore.drafts,
    key,
    text,
    updated: Date.now(),
  })
  setComposerDraftStore("drafts", reconcile(next))
  persistComposerDraftRecords(next)
}

export function clearComposerDraft(key: string | null | undefined): void {
  setComposerDraft(key, "")
}
