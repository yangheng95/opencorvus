// ── LogViewer Component ──
// Full-featured log viewer dialog that merges overlay client logs, server logs,
// and pipeline newline-delimited JSON (NDJSON) events. Ports renderLogViewer / renderNdjsonLogPanel /
// renderLogEntryDetail / logViewerEntries ( lines 10947–11155) and all
// supporting helpers (parseServerLogLine, stringifyLogValue, etc., lines
// 10795–10926).

import { createEffect, createSignal, createMemo, For, onCleanup, Show } from "solid-js"
import type { JSX } from "solid-js"
import { VList, type VListHandle } from "virtua/solid"
import { appStore, setAppStore, filteredLogEntries } from "../store/app"
import type { LogEntry, LogLevel, LogSource } from "../store/app"
import { t } from "../utils/i18n"
import { apiJson } from "../services/api"
import { nativeOpen } from "../utils/native"
import { useAsyncAction } from "../solid/async-action"
import { Dialog } from "./ui/Dialog"
import { Disclosure } from "./ui/Disclosure"
import { Button } from "./ui/Button"
import { SelectControl } from "./ui/SelectControl"
import { fmtElapsed, logDetailFields, parseServerLogLine, stringifyLogValue } from "../utils/log"

// ── Re-export types so callers can use them without importing store/app ──
export type { LogEntry, LogLevel, LogSource }

const LOG_LEVEL_OPTIONS: LogLevel[] = ["debug", "info", "warn", "error"]
type LogLevelSelectOption = { value: LogLevel; label: string }
const LOG_LEVEL_SELECT_OPTIONS: LogLevelSelectOption[] = LOG_LEVEL_OPTIONS.map((level) => ({
  value: level,
  label: level.toUpperCase(),
}))

// ── Internal server-log state ──
// Stored as module-level variables (same pattern as ) so they survive
// across component remounts but are not reactive (refresh is triggered
// explicitly by the user or on open).

interface ServerLogState {
  path: string
  lines: string[]
}

const EMPTY_SERVER_LOG_STATE: ServerLogState = { path: "", lines: [] }

let _serverLogState: ServerLogState = EMPTY_SERVER_LOG_STATE

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseServerLogTailResponse(data: unknown): ServerLogState {
  const body = data as { path?: unknown; lines?: unknown }
  if (!body || typeof body.path !== "string" || !body.path.trim()) {
    throw new Error("log/tail response is missing the current log file path")
  }
  if (!Array.isArray(body.lines) || body.lines.some((line) => typeof line !== "string")) {
    throw new Error("log/tail response lines must be a string array")
  }
  return {
    path: body.path,
    lines: body.lines,
  }
}

async function fetchServerLogs(): Promise<ServerLogState> {
  const data = await apiJson("log/tail?n=500")
  return parseServerLogTailResponse(data)
}

function clipText(value: string, limit = 80): string {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`
}

function logPreviewValue(value: unknown): string {
  return clipText(stringifyLogValue(value), 80)
}

function logSourceLabel(source: LogSource): string {
  if (source === "server") return "Server"
  if (source === "pipeline") return "Pipeline"
  return "Overlay"
}

// ── Merge all log sources (

function buildLogEntries(overlayEntries: LogEntry[], ndjsonEvents: any[], filterLevel: LogLevel): LogEntry[] {
  const levelOrder: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }
  const threshold = levelOrder[filterLevel] ?? 0

  // Server log lines (parsed from raw strings)
  const serverLines: LogEntry[] = _serverLogState.lines
    .map((line): LogEntry => {
      const entry = parseServerLogLine(line)
      return {
        ...entry,
        level: entry.level as LogLevel,
        source: "server",
      }
    })
    .filter((e) => (levelOrder[e.level] ?? 0) >= threshold)

  // Pipeline NDJSON events
  const pipelineLines: LogEntry[] = (Array.isArray(ndjsonEvents) ? ndjsonEvents : [])
    .filter((ev) => ev.kind !== "tool_delta")
    .flatMap((ev) => {
      const level: LogLevel = ev.kind === "error" ? "error" : "info"
      if ((levelOrder[level] ?? 0) < threshold) return []
      const stage = ev.stage || ""
      const kind = ev.kind || ""
      const toolName = ev.toolName || ""
      const summary = ev.summary || ev.text || ""
      const parts: string[] = []
      if (kind === "tool_call" && toolName) parts.push(`→ ${toolName}`)
      else if (kind === "tool_result" && toolName) parts.push(`← ${toolName}`)
      else if (kind === "status") parts.push(summary)
      else if (kind === "message_delta") parts.push("[text delta]")
      if (kind !== "status" && summary) {
        parts.push(summary.length > 150 ? summary.slice(0, 150) + "…" : summary)
      }
      const elapsed = typeof ev.elapsed_ms === "number" ? fmtElapsed(ev.elapsed_ms) : ""
      return [
        {
          level,
          ts: ev.at || "",
          service: stage,
          delta: elapsed,
          message: parts.join(" "),
          fields: {
            kind,
            ...(toolName ? { tool: toolName } : {}),
            ...(ev.status ? { status: ev.status } : {}),
          },
          raw: "",
          source: "pipeline" as LogSource,
        },
      ]
    })

  return [...serverLines, ...pipelineLines, ...overlayEntries].sort((a, b) => (a.ts || "").localeCompare(b.ts || ""))
}

function formatLogText(entries: LogEntry[]): string {
  return entries
    .map((e) => {
      const parts = [`[${String(e.source || "client").toUpperCase()}]`, `[${String(e.level || "info").toUpperCase()}]`]
      if (e.ts) parts.push(e.ts)
      if (e.service) parts.push(e.service)
      parts.push(e.message || "")
      const fields = logDetailFields(e.fields)
      if (Object.keys(fields).length) parts.push(stringifyLogValue(fields))
      return parts.join(" ")
    })
    .join("\n")
}

async function copyText(text: string): Promise<boolean> {
  await navigator.clipboard.writeText(text)
  return true
}

// ── LogEntryDetail subcomponent ──
// Ports renderLogEntryDetail ( 10928–10944)

function LogEntryDetail(props: { entry: LogEntry }) {
  const fields = createMemo(() => logDetailFields(props.entry.fields))
  const items = createMemo(() => Object.entries(fields()))

  return (
    <>
      <Show when={items().length > 0}>
        <div class="log-fields">
          <For each={items().slice(0, 6)}>
            {([key, value]) => (
              <span class="log-chip">
                {key}={logPreviewValue(value)}
              </span>
            )}
          </For>
        </div>
        <Disclosure.Root class="log-detail">
          <Disclosure.Trigger>{t("log.details")}</Disclosure.Trigger>
          <Disclosure.Content>
            <div class="log-detail-block">
              <div class="log-detail-title oc-section-heading">{t("log.fields")}</div>
              <pre class="log-detail-pre">{stringifyLogValue(fields(), 2)}</pre>
            </div>
            <Show when={!!props.entry.raw}>
              <div class="log-detail-block">
                <div class="log-detail-title oc-section-heading">{t("log.raw")}</div>
                <pre class="log-detail-pre">{props.entry.raw}</pre>
              </div>
            </Show>
          </Disclosure.Content>
        </Disclosure.Root>
      </Show>
      <Show when={items().length === 0 && !!props.entry.raw}>
        <Disclosure.Root class="log-detail">
          <Disclosure.Trigger>{t("log.details")}</Disclosure.Trigger>
          <Disclosure.Content>
            <div class="log-detail-block">
              <div class="log-detail-title oc-section-heading">{t("log.raw")}</div>
              <pre class="log-detail-pre">{props.entry.raw}</pre>
            </div>
          </Disclosure.Content>
        </Disclosure.Root>
      </Show>
    </>
  )
}

// ── LogLine subcomponent ──

function LogLine(props: { entry: LogEntry }) {
  return (
    <div class="log-line" data-source={props.entry.source}>
      <div class="log-line-head">
        <span class="log-source" data-source={props.entry.source}>
          {logSourceLabel(props.entry.source)}
        </span>
        <span class={`log-level log-level-${props.entry.level}`}>[{props.entry.level.toUpperCase()}]</span>
        <Show when={!!props.entry.delta}>
          <span class="log-delta">{props.entry.delta}</span>
        </Show>
        <Show when={!!props.entry.service}>
          <span class="log-service">{props.entry.service}</span>
        </Show>
        <span class="log-ts">{props.entry.ts}</span>
      </div>
      <div class="log-msg">{props.entry.message || props.entry.raw || ""}</div>
      <LogEntryDetail entry={props.entry} />
    </div>
  )
}

// ── LogViewer component props ──

export interface LogViewerProps {
  /**
   * NDJSON pipeline events array. Pass the live ndjsonEvents array from the
   * or an empty array.
   */
  ndjsonEvents?: any[]
  /** Whether the dialog is open. */
  open?: boolean
  onClose?: () => void
}

// ── LogViewer ──

export function LogViewer(props: LogViewerProps) {
  const [serverLogsSeq, setServerLogsSeq] = createSignal(0)
  const [serverLogError, setServerLogError] = createSignal("")
  const [refreshPending, setRefreshPending] = createSignal(false)
  const [copyPending, setCopyPending] = createSignal(false)
  const [copyNotice, setCopyNotice] = createSignal<{ tone: "success" | "error"; message: string } | null>(null)
  let logList: VListHandle | undefined
  let refreshGeneration = 0
  let copyGeneration = 0
  let copyNoticeTimer: ReturnType<typeof setTimeout> | undefined

  // Merged & filtered log entries
  const entries = createMemo(() => {
    serverLogsSeq()
    return buildLogEntries(filteredLogEntries(), props.ndjsonEvents ?? [], appStore.logFilterLevel)
  })

  const invalidateRefresh = () => {
    refreshGeneration += 1
    setRefreshPending(false)
  }

  const invalidateCopy = () => {
    copyGeneration += 1
    if (copyNoticeTimer !== undefined) clearTimeout(copyNoticeTimer)
    copyNoticeTimer = undefined
    setCopyPending(false)
    setCopyNotice(null)
  }

  const refreshServerLogs = async () => {
    const generation = ++refreshGeneration
    const ownsRefresh = () => generation === refreshGeneration && props.open === true
    setServerLogError("")
    setRefreshPending(true)
    try {
      const next = await fetchServerLogs()
      if (!ownsRefresh()) return
      _serverLogState = next
    } catch (error) {
      if (!ownsRefresh()) return
      _serverLogState = EMPTY_SERVER_LOG_STATE
      setServerLogError(errorMessage(error))
    } finally {
      if (ownsRefresh()) {
        setRefreshPending(false)
        setServerLogsSeq((value) => value + 1)
      }
    }
  }

  const currentServerLogPath = createMemo(() => {
    serverLogsSeq()
    return _serverLogState.path.trim()
  })

  const listLogError = createMemo(() => {
    const message = serverLogError()
    if (!message || entries().length === 0) return ""
    return message
  })

  const openFileAction = useAsyncAction(async () => {
    setServerLogError("")
    const path = currentServerLogPath()
    if (!path) throw new Error("Log file path is not loaded")
    const opened = await nativeOpen(path)
    if (!opened) throw new Error("Host did not open the current log file")
  })

  const handleOpenLogFile = () => {
    void openFileAction.run().catch((error) => {
      setServerLogError(errorMessage(error))
    })
  }

  const handleCopy = async () => {
    const text = formatLogText(entries())
    if (!text) return
    const generation = ++copyGeneration
    const ownsCopy = () => generation === copyGeneration && props.open === true
    if (copyNoticeTimer !== undefined) clearTimeout(copyNoticeTimer)
    copyNoticeTimer = undefined
    setCopyNotice(null)
    setCopyPending(true)
    try {
      await copyText(text)
      if (!ownsCopy()) return
      setCopyNotice({ tone: "success", message: t("log.copy_success") })
      copyNoticeTimer = setTimeout(() => {
        if (!ownsCopy()) return
        setCopyNotice(null)
        copyNoticeTimer = undefined
      }, 2000)
    } catch (error) {
      if (!ownsCopy()) return
      setCopyNotice({ tone: "error", message: t("log.copy_failed", { error: errorMessage(error) }) })
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#btnLogCopy")?.focus())
    } finally {
      if (ownsCopy()) setCopyPending(false)
    }
  }

  const handleClear = () => {
    invalidateRefresh()
    // Clear overlay client log entries via the store
    setAppStore("logEntries", [])
    _serverLogState = EMPTY_SERVER_LOG_STATE
    setServerLogsSeq((value) => value + 1)
  }

  const handleClose = () => {
    invalidateRefresh()
    invalidateCopy()
    props.onClose?.()
  }

  const selectedLogLevelOption = () =>
    LOG_LEVEL_SELECT_OPTIONS.find((option) => option.value === appStore.logFilterLevel) ?? null

  const setLogLevel = (option: LogLevelSelectOption | null) => {
    if (!option) return
    setAppStore("logFilterLevel", option.value)
  }

  createEffect(() => {
    if (props.open) {
      void refreshServerLogs()
      return
    }
    invalidateRefresh()
    invalidateCopy()
  })

  onCleanup(() => {
    invalidateRefresh()
    invalidateCopy()
  })

  createEffect(() => {
    if (!props.open) return
    const count = entries().length
    if (count > 0) {
      queueMicrotask(() => logList?.scrollToIndex(count - 1, { align: "end" }))
    }
  })

  return (
    <Dialog
      id="logDialog"
      open={props.open === true}
      wide={true}
      formClass="log-viewer-dialog-form"
      title={t("log.title")}
      onClose={handleClose}
      headerActions={
        <>
          <SelectControl<LogLevelSelectOption>
            id="logLevelFilter"
            class="log-level-select"
            options={LOG_LEVEL_SELECT_OPTIONS}
            value={selectedLogLevelOption()}
            onChange={setLogLevel}
            optionValue="value"
            optionTextValue="label"
            disallowEmptySelection
            gutter={4}
            sameWidth
            ariaLabel={t("log.filter_level")}
            renderValue={(option) => <span>{option?.label ?? "DEBUG"}</span>}
            renderOptionLabel={(option) => option.label}
          />
          <Button
            type="button"
            id="btnLogRefresh"
            variant="ghost"
            size="sm"
            tone="neutral"
            onClick={() => void refreshServerLogs()}
            disabled={refreshPending()}
          >
            {t("common.refresh")}
          </Button>
          <Button
            type="button"
            id="btnLogOpenFile"
            variant="ghost"
            size="sm"
            tone="neutral"
            title={t("log.open_file_hint")}
            aria-label={t("log.open_file_hint")}
            onClick={handleOpenLogFile}
            disabled={refreshPending() || openFileAction.pending() || !currentServerLogPath()}
          >
            {t("log.open_file")}
          </Button>
          <Button
            type="button"
            id="btnLogCopy"
            variant="ghost"
            size="sm"
            tone="neutral"
            onClick={() => void handleCopy()}
            disabled={refreshPending() || copyPending() || entries().length === 0}
            aria-busy={copyPending()}
          >
            {copyPending() ? t("log.copying") : t("common.copy")}
          </Button>
          <Button type="button" id="btnLogClear" variant="ghost" size="sm" tone="danger" onClick={handleClear}>
            {t("common.clear")}
          </Button>
          <Button
            type="button"
            id="btnCloseLog"
            variant="ghost"
            size="sm"
            tone="neutral"
            onClick={handleClose}
          >
            {t("common.close")}
          </Button>
        </>
      }
    >
      <Show when={copyNotice()}>
        {(notice) => (
          <div
            class="log-copy-feedback"
            data-tone={notice().tone}
            data-ui="log-copy-feedback"
            role={notice().tone === "error" ? "alert" : "status"}
            aria-live="polite"
            aria-atomic="true"
          >
            {notice().message}
          </div>
        )}
      </Show>
      <Show when={listLogError()}>
        {(message) => (
          <div class="log-error-banner" role="alert">
            {message()}
          </div>
        )}
      </Show>
      <Show
        when={entries().length > 0}
        fallback={
          <div id="logViewerBody" class="log-viewer">
            <Show when={serverLogError()} fallback={<div class="empty-hint">{t("log.empty")}</div>}>
              {(message) => (
                <div class="empty-hint" role="alert">
                  {message()}
                </div>
              )}
            </Show>
          </div>
        }
      >
        <VList
          id="logViewerBody"
          class="log-viewer"
          data={entries()}
          itemSize={88}
          bufferSize={88 * 8}
          ref={(handle) => {
            logList = handle
          }}
        >
          {(entry) => <LogLine entry={entry} />}
        </VList>
      </Show>
    </Dialog>
  )
}
