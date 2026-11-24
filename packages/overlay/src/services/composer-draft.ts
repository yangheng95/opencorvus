import { createStore, reconcile } from "solid-js/store"
import { parseQuotation, type Quotation } from "./quotation"
import { randomUUID } from "../utils/random-id"
import { composerMentionDirectiveRanges, setComposerMentionDirectiveSelected } from "./composer-mention"
import { openBrowserRecord, type BrowserRecord, type BrowserRecordMutation } from "./browser-record-storage"

export interface ComposerDraftEntry {
  text: string
  quotation?: Quotation
  submission?: { messageID: string; text: string }
  updated: number
}

export type ComposerDraftRecords = Record<string, ComposerDraftEntry>
type DraftMutationResult<T> = BrowserRecordMutation<ComposerDraftRecords, T>
type DraftMutation<T> = (records: ComposerDraftRecords) => DraftMutationResult<T>

const LEGACY_DRAFT_STORAGE_KEY = "oc_composer_drafts_v1"
const DRAFT_CHANNEL_NAME = "opencorvus-composer-drafts"
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

function departComposerDrafts(
  currentKey: string,
  records: ComposerDraftRecords,
  detached: ComposerDraftRecords,
  updated: number,
) {
  const retiredReferences = Object.entries(records).some(
    ([key, entry]) => !!entry.quotation || !!entry.submission || entry.text !== detached[key]?.text,
  )
  const next = { ...detached }
  const currentText = next[currentKey]?.text
  if (currentText) {
    const launcher = workspaceComposerDraftKey("", "", "")
    const previous = next[launcher]?.text ?? ""
    next[launcher] = {
      text: previous && currentKey !== launcher ? `${previous}\n\n${currentText}` : currentText,
      updated,
    }
    if (currentKey !== launcher) delete next[currentKey]
  }
  return { records: pruneComposerDraftRecords(next), value: retiredReferences }
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
      const updated = Date.now()
      const preview = departComposerDrafts(currentKey, composerDraftStore.drafts, prepared.records, updated)
      release()
      void mutateComposerDrafts(
        (records) => departComposerDrafts(currentKey, records, connectionIndependentRecords(records), updated),
        preview,
      )
      return preview.value
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

function readLegacyDrafts(): ComposerDraftRecords {
  return pruneComposerDraftRecords(parseComposerDraftRecords(localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)))
}

function retireLegacyDrafts(): void {
  try {
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
  } catch (err) {
    console.warn("[composer-draft] could not remove the migrated draft entry", err)
  }
}

export const [composerDraftStore, setComposerDraftStore] = createStore<{ drafts: ComposerDraftRecords }>({
  drafts: {},
})

interface DraftStorageOwner {
  database: Promise<BrowserRecord<ComposerDraftRecords>>
  channel: BroadcastChannel
}

let draftStorage: DraftStorageOwner | undefined
const pendingDraftPreviews = new Set<DraftMutation<unknown>>()

function publishDrafts(records: ComposerDraftRecords): void {
  if (preparedDeparture) preparedDeparture.records = connectionIndependentRecords(records)
  setComposerDraftStore("drafts", reconcile(records))
}

function publishCommittedDrafts(records: ComposerDraftRecords): void {
  for (const preview of pendingDraftPreviews) records = preview(records).records
  publishDrafts(records)
}

function retireDraftStorage(owner: DraftStorageOwner): void {
  if (draftStorage !== owner) return
  draftStorage = undefined
  pendingDraftPreviews.clear()
  owner.channel.close()
  void owner.database.then((database) => database.close(), () => {})
}

function reportDraftStorageError(owner: DraftStorageOwner, error: unknown): void {
  if (draftStorage !== owner) return
  retireDraftStorage(owner)
  console.warn("[composer-draft] persistent draft storage became unavailable", error)
}

export function startComposerDraftStorage(): () => void {
  const owner: DraftStorageOwner = {
    channel: new BroadcastChannel(DRAFT_CHANNEL_NAME),
    database: openBrowserRecord({
      name: "opencorvus-composer-drafts",
      store: "drafts",
      key: "records",
      migration: { read: readLegacyDrafts, retire: retireLegacyDrafts },
    }),
  }
  draftStorage = owner
  const refresh = () => {
    void owner.database
      .then((database) => database.read())
      .then((records) => {
        if (draftStorage === owner) publishCommittedDrafts(records)
      }, (error) => reportDraftStorageError(owner, error))
  }
  owner.channel.onmessage = refresh
  refresh()
  return () => retireDraftStorage(owner)
}

function mutateComposerDrafts<T>(
  mutate: DraftMutation<T>,
  preview?: true | DraftMutationResult<T>,
): Promise<T> {
  const owner = draftStorage
  const current = composerDraftStore.drafts
  if (!owner) {
    const result = preview && preview !== true ? preview : mutate(current)
    publishDrafts(result.records)
    return Promise.resolve(result.value)
  }
  const local = preview === true ? mutate(current) : preview
  if (local) {
    pendingDraftPreviews.add(mutate)
    publishDrafts(local.records)
  }
  return owner.database.then((database) => database.write(mutate)).then(
    ({ records, value }) => {
      if (draftStorage === owner) {
        pendingDraftPreviews.delete(mutate)
        publishCommittedDrafts(records)
        owner.channel.postMessage(null)
      }
      return value
    },
    (error) => {
      reportDraftStorageError(owner, error)
      if (local) return local.value
      const result = mutate(composerDraftStore.drafts)
      publishDrafts(result.records)
      return result.value
    },
  )
}

export function composerDraftText(key: string | null | undefined): string {
  const normalized = normalizeComposerDraftKey(key)
  return normalized ? (composerDraftStore.drafts[normalized]?.text ?? "") : ""
}

export function setComposerDraft(key: string | null | undefined, text: string): void {
  const normalized = normalizeComposerDraftKey(key)
  if (!normalized) return
  const updated = Date.now()
  void mutateComposerDrafts((records) => ({
    records: nextComposerDraftRecords({ records, key: normalized, text, updated }),
    value: undefined,
  }), true)
}

/** Transfer input to its admitted workspace scope while preserving independently authored drafts. */
export function moveComposerDraft(sourceKey: string, targetKey: string): void {
  const source = normalizeComposerDraftKey(sourceKey)
  const target = normalizeComposerDraftKey(targetKey)
  if (!source || !target || source === target) return
  const updated = Date.now()
  void mutateComposerDrafts((records) => {
    const entry = records[source]
    const destination = records[target]
    if (!entry || destination?.text || destination?.quotation) return { records, value: undefined }
    const next = { ...records, [target]: { text: entry.text, quotation: entry.quotation, updated } }
    delete next[source]
    return { records: pruneComposerDraftRecords(next), value: undefined }
  }, true)
}

export interface ComposerDraftRevision {
  key: string
  entry: ComposerDraftEntry
}

/** Capture the actual record owned by a request, without another persisted draft. */
export function captureComposerDraftRevision(key: string | null | undefined): ComposerDraftRevision | undefined {
  const normalized = normalizeComposerDraftKey(key)
  const entry = composerDraftStore.drafts[normalized]
  return entry ? {
    key: normalized,
    entry: {
      ...entry,
      ...(entry.quotation ? { quotation: { ...entry.quotation } } : {}),
      ...(entry.submission ? { submission: { ...entry.submission } } : {}),
    },
  } : undefined
}

/** Match complete author revisions, including their scope and retained request identity. */
export function sameComposerDraftRevision(a: ComposerDraftRevision, b: ComposerDraftRevision): boolean {
  return a.key === b.key && a.entry.updated === b.entry.updated && a.entry.text === b.entry.text &&
    a.entry.quotation?.text === b.entry.quotation?.text &&
    a.entry.quotation?.sessionID === b.entry.quotation?.sessionID &&
    a.entry.quotation?.messageID === b.entry.quotation?.messageID &&
    a.entry.submission?.messageID === b.entry.submission?.messageID &&
    a.entry.submission?.text === b.entry.submission?.text
}

/** Consume only the unchanged author's record after its real acceptance receipt. */
export function clearComposerDraftRevision(revision: ComposerDraftRevision): Promise<boolean> {
  return mutateComposerDrafts((records) => {
    const current = records[revision.key]
    if (!current || !sameComposerDraftRevision(revision, { key: revision.key, entry: current })) {
      return { records, value: false }
    }
    const next = { ...records }
    delete next[revision.key]
    return { records: next, value: true }
  })
}

/** A confirmed operator cancellation retires its retry identity, preserving prose. */
export function forgetComposerSubmission(key: string, messageID: string): void {
  const updated = Date.now()
  void mutateComposerDrafts((records) => {
    const current = records[key]
    if (current?.submission?.messageID !== messageID) return { records, value: undefined }
    const { submission, ...entry } = current
    return {
      records: pruneComposerDraftRecords({ ...records, [key]: { ...entry, updated } }),
      value: undefined,
    }
  }, true)
}

/** Retain one identity for exact serialized request content across transport retries. */
export function composerSubmission(key: string, text: string): Promise<{ messageID: string; text: string }> {
  const submission = { messageID: `msg_${randomUUID()}`, text }
  const updated = Date.now()
  return mutateComposerDrafts((records) => {
    const current = records[key]
    if (current?.submission?.text === text) return { records, value: current.submission }
    return {
      records: { ...records, [key]: { ...current, text: current?.text ?? text, updated, submission } },
      value: submission,
    }
  })
}

export function composerQuotation(key: string | null | undefined): Quotation | undefined {
  return composerDraftStore.drafts[normalizeComposerDraftKey(key)]?.quotation
}

export function setComposerQuotation(key: string | null | undefined, quotation: Quotation | undefined): void {
  const normalized = normalizeComposerDraftKey(key)
  if (!normalized) return
  const updated = Date.now()
  const source = quotation ? { ...quotation } : undefined
  void mutateComposerDrafts((records) => ({
    records: pruneComposerDraftRecords({
      ...records,
      [normalized]: { text: records[normalized]?.text ?? "", updated, ...(source ? { quotation: source } : {}) },
    }),
    value: undefined,
  }), true)
}
