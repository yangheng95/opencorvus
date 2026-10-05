import { createStore, reconcile } from "solid-js/store"
import { parseQuotation, type Quotation } from "./quotation"
import { randomUUID } from "../utils/random-id"
import { composerMentionDirectiveRanges, setComposerMentionDirectiveSelected } from "./composer-mention"

export interface ComposerDraftEntry {
  text: string
  quotation?: Quotation
  submission?: { messageID: string; text: string }
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

export function workspaceComposerDraftKey(taskID: string, sessionID: string, directory: string): string {
  if (taskID) return composerDraftKey("task", taskID)
  if (sessionID) return composerDraftKey("session", sessionID)
  return directory ? composerDraftKey("launcher", "new", directory) : composerDraftKey("launcher", "new")
}

function connectionIndependentText(text: string): string {
  let result = text
  for (const directive of composerMentionDirectiveRanges(text)) {
    result = setComposerMentionDirectiveSelected(result, directive.kind, directive.value, false)
  }
  return result
}

function connectionIndependentRecords(records: ComposerDraftRecords): ComposerDraftRecords {
  return Object.fromEntries(
    Object.entries(records).map(([key, entry]) => [
      key,
      {
        text: connectionIndependentText(entry.text),
        updated: entry.updated,
      },
    ]),
  )
}

let preparedDeparture: { records: ComposerDraftRecords } | undefined

/** All ordinary writes update this transaction's parsed projection before writing the sole store. */
function writeComposerDraftRecords(records: ComposerDraftRecords): void {
  if (preparedDeparture) preparedDeparture.records = connectionIndependentRecords(records)
  setComposerDraftStore("drafts", reconcile(records))
  persistComposerDraftRecords(records)
}

/** A temporary preparation of the existing store; confirmed commit performs no parsing. */
export function prepareComposerDraftDeparture(currentKey: string): { commit: () => boolean; release: () => void } {
  if (preparedDeparture) throw new DOMException("Composer departure preparation is busy", "AbortError")
  const prepared = { records: connectionIndependentRecords(composerDraftStore.drafts) }
  preparedDeparture = prepared
  const release = () => {
    if (preparedDeparture === prepared) preparedDeparture = undefined
  }
  return {
    release,
    commit: () => {
      const retiredReferences = Object.entries(composerDraftStore.drafts).some(
        ([key, entry]) => !!entry.quotation || !!entry.submission || entry.text !== prepared.records[key]?.text,
      )
      const next = { ...prepared.records }
      const currentText = next[currentKey]?.text
      if (currentText) {
        const launcher = workspaceComposerDraftKey("", "", "")
        const previous = next[launcher]?.text ?? ""
        next[launcher] = {
          text: previous && currentKey !== launcher ? `${previous}\n\n${currentText}` : currentText,
          updated: Date.now(),
        }
        if (currentKey !== launcher) delete next[currentKey]
      }
      const retained = pruneComposerDraftRecords(next)
      release()
      writeComposerDraftRecords(retained)
      return retiredReferences
    },
  }
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
    const quotation = parseQuotation((value as { quotation?: unknown }).quotation)
    const submitted = (value as { submission?: ComposerDraftEntry["submission"] }).submission
    const submission =
      submitted &&
      typeof submitted.messageID === "string" &&
      submitted.messageID.startsWith("msg_") &&
      typeof submitted.text === "string"
        ? { messageID: submitted.messageID, text: submitted.text }
        : undefined
    records[key] = { text, updated, ...(quotation ? { quotation } : {}), ...(submission ? { submission } : {}) }
  }
  return records
}

export function pruneComposerDraftRecords(
  records: ComposerDraftRecords,
  maxEntries = MAX_COMPOSER_DRAFTS,
): ComposerDraftRecords {
  const entries = Object.entries(records)
    .filter(([, entry]) => entry.text.length > 0 || entry.quotation)
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
  if (input.text.length === 0 && !next[key]?.quotation) {
    delete next[key]
  } else {
    next[key] = { ...next[key], text: input.text, updated: input.updated }
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
  writeComposerDraftRecords(next)
}

export function clearComposerDraft(key: string | null | undefined): void {
  setComposerQuotation(key, undefined)
  setComposerDraft(key, "")
}

/** Retain one request identity across transport retries, including panel reopen/reload. */
export function composerSubmission(key: string, text: string): { messageID: string; text: string } {
  const current = composerDraftStore.drafts[key]
  if (current?.submission?.text === text) return current.submission
  const submission = { messageID: `msg_${randomUUID()}`, text }
  const next = {
    ...composerDraftStore.drafts,
    [key]: { ...current, text: current?.text ?? text, updated: Date.now(), submission },
  }
  writeComposerDraftRecords(next)
  return submission
}

export function composerQuotation(key: string | null | undefined): Quotation | undefined {
  return composerDraftStore.drafts[normalizeComposerDraftKey(key)]?.quotation
}

export function setComposerQuotation(key: string | null | undefined, quotation: Quotation | undefined): void {
  const normalized = normalizeComposerDraftKey(key)
  if (!normalized) return
  const next = pruneComposerDraftRecords({
    ...composerDraftStore.drafts,
    [normalized]: {
      text: composerDraftText(key),
      updated: Date.now(),
      ...(quotation ? { quotation } : {}),
    },
  })
  writeComposerDraftRecords(next)
}
