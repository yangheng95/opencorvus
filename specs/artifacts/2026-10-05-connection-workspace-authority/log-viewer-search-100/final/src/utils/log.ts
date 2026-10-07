// ── AppLog ──
// Integrates with store/app.ts appendLog for reactive log display,
// and flushes entries to the server via services/api.ts.

import { appStore, appendLog, type LogEntry, type LogLevel } from "../store/app"
import { apiJson } from "../services/api"
import { formatErrorDetails } from "./error-details"
import { matchesSearchParts } from "../services/text-search"

// ── Types ──

export interface AppLogEntry {
  ts: string
  level: LogLevel
  service: string
  message: string
  extra: unknown
}

// ── Internal state ──

const MAX_ENTRIES = 2000
const MAX_FLUSH_FAILURES = 5

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const entries: AppLogEntry[] = []
const LOG_UPLOAD_BATCH_LIMIT = 50
let filterLevel: LogLevel = "debug"
let _flushQueue: AppLogEntry[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _flushInFlight = 0
let _flushFailCount = 0
let _flushFailureReported = false
let _flushActivityRevision = 0

// ── Helpers ──

function now(): string {
  return new Date().toISOString().split(".")[0]
}

function recordFlushActivity(): void {
  _flushActivityRevision++
}

function flushPending(): boolean {
  return _flushTimer !== null || _flushQueue.length > 0 || _flushInFlight > 0
}

function flushSnapshot(): string {
  return `timer=${_flushTimer !== null} queue=${_flushQueue.length} inFlight=${_flushInFlight} failures=${_flushFailCount}`
}

function add(level: LogLevel, service: string, message: string, extra: unknown): AppLogEntry {
  const entry: AppLogEntry = { ts: now(), level, service, message, extra }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  return entry
}

function scheduleFlush(): void {
  if (!_flushTimer) {
    _flushTimer = setTimeout(flush, 500)
    recordFlushActivity()
  }
}

function appendStoreEntry(entry: AppLogEntry): void {
  const storeEntry: LogEntry = {
    ts: entry.ts,
    level: entry.level,
    service: entry.service,
    delta: "",
    message: entry.message,
    fields: entry.extra && typeof entry.extra === "object" ? (entry.extra as Record<string, unknown>) : {},
    raw: "",
    source: "overlay",
  }
  appendLog(storeEntry)
}

function reportFlushFailure(entry: AppLogEntry, error: unknown): void {
  if (_flushFailureReported) return
  _flushFailureReported = true
  const diagnostic = add("error", "system", "Overlay log upload failed", {
    failedEntry: entry,
    diagnosticID: "system:overlay-log-upload-failed",
    message: `OpenCorvus could not write overlay log entry "${entry.message}" to the backend log store.`,
    details: formatErrorDetails(error),
  })
  appendStoreEntry(diagnostic)
}

function flush(): void {
  _flushTimer = null
  recordFlushActivity()
  if (!appStore.connected) {
    _flushQueue.length = 0
    recordFlushActivity()
    return
  }
  if (_flushInFlight > 0) return
  const batch = _flushQueue.splice(0, LOG_UPLOAD_BATCH_LIMIT)
  if (batch.length === 0) return
  recordFlushActivity()
  const payload = batch.map((entry) => {
    const extraObj =
      entry.extra && typeof entry.extra === "object" ? (entry.extra as Record<string, unknown>) : undefined
    const msg = entry.extra && !extraObj ? `${entry.message} ${entry.extra}` : entry.message
    return { service: `overlay:${entry.service}`, level: entry.level, message: msg, extra: extraObj }
  })
  _flushInFlight = 1
  recordFlushActivity()
  void apiJson("log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: payload }),
  })
    .then(() => {
      _flushFailCount = 0
      recordFlushActivity()
    })
    .catch((error) => {
      _flushFailCount++
      if (_flushFailCount <= MAX_FLUSH_FAILURES) _flushQueue.unshift(...batch)
      reportFlushFailure(batch[0]!, error)
      recordFlushActivity()
    })
    .finally(() => {
      _flushInFlight = 0
      if (_flushFailCount === 0 && _flushQueue.length === 0) _flushFailureReported = false
      if (_flushQueue.length > 0) scheduleFlush()
      recordFlushActivity()
    })
}

function persist(entry: AppLogEntry): void {
  if (!appStore.connected) return
  _flushQueue.push(entry)
  recordFlushActivity()
  scheduleFlush()
}

export async function waitForLogDrain(inactivityTimeoutMs = 2_000): Promise<void> {
  if (!Number.isFinite(inactivityTimeoutMs) || inactivityTimeoutMs <= 0) {
    throw new Error("waitForLogDrain requires a positive finite inactivity timeout")
  }
  let observedRevision = _flushActivityRevision
  let lastActivityAt = Date.now()
  while (flushPending()) {
    if (observedRevision !== _flushActivityRevision) {
      observedRevision = _flushActivityRevision
      lastActivityAt = Date.now()
    }
    const inactiveForMs = Date.now() - lastActivityAt
    if (inactiveForMs >= inactivityTimeoutMs) {
      throw new Error(`Overlay log drain had no activity for ${inactivityTimeoutMs}ms (${flushSnapshot()})`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

function log(level: LogLevel, service: string, message: string, extra?: unknown): AppLogEntry {
  const entry = add(level, service, message, extra)
  persist(entry)
  appendStoreEntry(entry)

  return entry
}

// ── Public API ──

export const AppLog = {
  debug: (service: string, msg: string, extra?: unknown) => log("debug", service, msg, extra),
  info: (service: string, msg: string, extra?: unknown) => log("info", service, msg, extra),
  warn: (service: string, msg: string, extra?: unknown) => log("warn", service, msg, extra),
  error: (service: string, msg: string, extra?: unknown) => log("error", service, msg, extra),

  /** All accumulated entries (mutable reference, mirrors app.js behaviour). */
  entries,

  get filterLevel(): LogLevel {
    return filterLevel
  },
  set filterLevel(v: LogLevel) {
    filterLevel = v
  },

  /** Return entries filtered to at least the current filterLevel. */
  filtered(): AppLogEntry[] {
    const min = LOG_LEVEL_ORDER[filterLevel] ?? 0
    return entries.filter((e) => (LOG_LEVEL_ORDER[e.level] ?? 0) >= min)
  },

  /** Clear the in-memory entry buffer. */
  clear(): void {
    entries.length = 0
  },
}

// ── Current log parsing and display helpers ──

export function matchesLogEntrySearch(
  entry: Pick<ServerLogEntry, "source" | "level" | "ts" | "delta" | "service" | "message" | "fields" | "raw">,
  query: string,
): boolean {
  return matchesSearchParts(query, [
    entry.source,
    entry.level,
    entry.ts,
    entry.delta,
    entry.service,
    entry.message,
    stringifyLogValue(entry.fields),
    entry.raw,
  ])
}

// ── stringifyLogValue ──

export function stringifyLogValue(value: unknown, space = 0): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, space)
  } catch {
    return String(value ?? "")
  }
}

// ── fmtElapsed ──
// Format a millisecond duration as a short human-readable string.

export function fmtElapsed(ms: number): string {
  const s = ms / 1000
  if (s < 60) return s.toFixed(1) + "s"
  const m = Math.floor(s / 60)
  return m + "m" + (s - m * 60).toFixed(0) + "s"
}

// ── parseServerLogLine ──
// Parse a single raw server-log line into a structured log entry object.

interface ServerLogEntry {
  level: string
  ts: string
  delta: string
  service: string
  message: string
  fields: Record<string, unknown>
  raw: string
  source?: string
}

function parsePinoLogLine(raw: string): ServerLogEntry | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const level = typeof record.level === "string" ? record.level : "info"
  const ts = typeof record.time === "string" ? record.time.replace(/\.\d{3}Z$/, "") : ""
  const message = typeof record.message === "string" ? record.message : ""
  const service = typeof record.service === "string" ? record.service : ""
  const fields = { ...record }
  delete fields.level
  if (typeof record.time === "string") delete fields.time
  delete fields.message
  return {
    level,
    ts,
    delta:
      record.data &&
      typeof record.data === "object" &&
      !Array.isArray(record.data) &&
      typeof (record.data as Record<string, unknown>).duration === "number"
        ? fmtElapsed((record.data as Record<string, unknown>).duration as number)
        : "",
    service,
    message,
    fields,
    raw,
  }
}

export function parseServerLogLine(raw: string): ServerLogEntry {
  return parsePinoLogLine(raw) ?? { level: "info", ts: "", delta: "", service: "", message: raw, fields: {}, raw }
}
// ── logDetailFields ──
// Strip the "service" key from a fields object (it is displayed separately).

export function logDetailFields(fields: unknown): Record<string, unknown> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {}
  return Object.fromEntries(Object.entries(fields as Record<string, unknown>).filter(([key]) => key !== "service"))
}

// ── ndjsonEventTypeLabel ──
// Format a dotted event-type string for display.

export function ndjsonEventTypeLabel(type: string): string {
  return (type || "").replace(/\./g, " › ")
}
