// ── LogViewer Component ──
// Full-featured log viewer dialog that merges overlay client logs, server logs,
// and pipeline newline-delimited JSON (NDJSON) events. Ports renderLogViewer / renderNdjsonLogPanel /
// renderLogEntryDetail / logViewerEntries ( lines 10947–11155) and all
// supporting helpers (parseServerLogLine, stringifyLogValue, etc., lines
// 10795–10926).

import { createEffect, createSignal, createMemo, For, on, onCleanup, Show } from "solid-js"
import type { JSX } from "solid-js"
import { VList, type VListHandle } from "virtua/solid"
import { appStore, setAppStore, filteredLogEntries } from "../store/app"
import type { LogEntry, LogLevel, LogSource } from "../store/app"
import { t } from "../utils/i18n"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { pathRevealFailureKey, pathRevealLabelKey, pathRevealNoticeKey, revealPath } from "../services/workspace"
import { useAsyncAction } from "../solid/async-action"
import { Dialog } from "./ui/Dialog"
import { Disclosure } from "./ui/Disclosure"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { SelectControl } from "./ui/SelectControl"
import { SearchField } from "./ui/SearchField"
import { fmtElapsed, logDetailFields, matchesLogEntrySearch, parseServerLogLine, stringifyLogValue } from "../utils/log"
import { copyText } from "../services/clipboard"
import { formatErrorDetails } from "../utils/error-details"

// ── Re-export types so callers can use them without importing store/app ──
export type { LogEntry, LogLevel, LogSource }

const LOG_LEVEL_OPTIONS: LogLevel[] = ["debug", "info", "warn", "error"]
const LOG_TAIL_TOLERANCE = 8
type LogLevelSelectOption = { value: LogLevel; label: string }
const LOG_LEVEL_SELECT_OPTIONS: LogLevelSelectOption[] = LOG_LEVEL_OPTIONS.map((level) => ({
  value: level,
  label: level.toUpperCase(),
}))

interface ServerLogTail {
  path: string
  lines: string[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseServerLogTailResponse(data: unknown): ServerLogTail {
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

async function fetchServerLogs(authority: ApiAuthority): Promise<ServerLogTail> {
  const data = await apiJson("log/tail?n=500", { authority })
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

const LOG_SOURCE_KEYS = {
  overlay: "log.source_overlay",
  server: "log.source_server",
  pipeline: "log.source_pipeline",
} satisfies Record<LogSource, string>

function logSourceLabel(source: LogSource): string {
  return t(LOG_SOURCE_KEYS[source])
}

// ── Merge all log sources (

function buildLogEntries(
  serverLogLines: readonly string[],
  overlayEntries: LogEntry[],
  ndjsonEvents: any[],
  filterLevel: LogLevel,
): LogEntry[] {
  const levelOrder: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }
  const threshold = levelOrder[filterLevel] ?? 0

  // Server log lines (parsed from raw strings)
  const serverLines: LogEntry[] = serverLogLines
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

type LogIssue = { operation: "refresh" | "reveal"; cause: unknown }

// ── LogViewer ──

export function LogViewer(props: LogViewerProps) {
  const [searchQuery, setSearchQuery] = createSignal("")
  const [serverLog, setServerLog] = createSignal<{ authority: ApiAuthority; tail: ServerLogTail } | null>(null)
  const [logIssue, setLogIssue] = createSignal<LogIssue | null>(null)
  const [refreshPending, setRefreshPending] = createSignal(false)
  const [copyPending, setCopyPending] = createSignal(false)
  const [copyNotice, setCopyNotice] = createSignal<{ tone: "success" | "error"; message: string } | null>(null)
  let logList: VListHandle | undefined
  let followTail = true
  let refreshGeneration = 0
  let copyGeneration = 0
  let copyNoticeTimer: ReturnType<typeof setTimeout> | undefined

  const currentServerLog = createMemo(() => {
    const accepted = serverLog()
    return accepted && isApiAuthorityCurrent(accepted.authority) ? accepted.tail : null
  })
  const waitingForServerLog = () => refreshPending() && !currentServerLog()

  // Current level-qualified records, independent of the local search query.
  const loadedEntries = createMemo(() =>
    buildLogEntries(currentServerLog()?.lines ?? [], filteredLogEntries(), props.ndjsonEvents ?? [], appStore.logFilterLevel),
  )

  const entries = createMemo(() => {
    const loaded = loadedEntries()
    const query = searchQuery()
    return query.trim() ? loaded.filter((entry) => matchesLogEntrySearch(entry, query, logSourceLabel(entry.source))) : loaded
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

  const ownsOpenConnection = (authority: ApiAuthority) => props.open === true && isApiAuthorityCurrent(authority)

  const refreshServerLogs = async () => {
    const authority = captureApiAuthority()
    const generation = ++refreshGeneration
    const ownsRefresh = () => generation === refreshGeneration && ownsOpenConnection(authority)
    setLogIssue(null)
    setRefreshPending(true)
    try {
      const tail = await fetchServerLogs(authority)
      if (!ownsRefresh()) return
      setServerLog({ authority, tail })
    } catch (error) {
      if (!ownsRefresh()) return
      setServerLog(null)
      setLogIssue({ operation: "refresh", cause: error })
    } finally {
      if (ownsRefresh()) setRefreshPending(false)
    }
  }

  const currentServerLogPath = () => currentServerLog()?.path.trim() ?? ""

  /** Show a short-lived notice, replacing whatever one is on screen. */
  function flashNotice(tone: "success" | "error", message: string): void {
    if (copyNoticeTimer !== undefined) clearTimeout(copyNoticeTimer)
    setCopyNotice({ tone, message })
    copyNoticeTimer = setTimeout(() => {
      setCopyNotice(null)
      copyNoticeTimer = undefined
    }, 2000)
  }

  const openFileAction = useAsyncAction(async (authority: ApiAuthority, path: string) => {
    setLogIssue(null)
    const outcome = await revealPath(path)
    const notice = pathRevealNoticeKey(outcome)
    if (notice && ownsOpenConnection(authority)) flashNotice("success", t(notice, { path }))
  })

  const handleOpenLogFile = () => {
    const path = currentServerLogPath()
    if (!path || refreshPending() || openFileAction.pending()) return
    const authority = captureApiAuthority()
    void openFileAction.run(authority, path).catch((error) => {
      if (ownsOpenConnection(authority)) setLogIssue({ operation: "reveal", cause: error })
    })
  }

  const handleCopy = async () => {
    if (refreshPending() || copyPending()) return
    const text = formatLogText(entries())
    if (!text) return
    const authority = captureApiAuthority()
    const generation = ++copyGeneration
    const ownsCopy = () => generation === copyGeneration && ownsOpenConnection(authority)
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
      requestAnimationFrame(() => {
        if (ownsCopy()) document.querySelector<HTMLButtonElement>("#btnLogCopy")?.focus()
      })
    } finally {
      if (ownsCopy()) setCopyPending(false)
    }
  }

  const handleClear = () => {
    invalidateRefresh()
    // Clear overlay client log entries via the store
    setAppStore("logEntries", [])
    setServerLog(null)
  }

  const handleClose = () => {
    setSearchQuery("")
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

  createEffect(on(
    () => [props.open, captureApiAuthority().revision] as const,
    ([open, revision], previous) => {
      const authorityChanged = previous?.[1] !== revision
      if (authorityChanged) {
        setServerLog(null)
        setLogIssue(null)
      }
      if (authorityChanged || !open) {
        invalidateRefresh()
        invalidateCopy()
      }
      if (open) void refreshServerLogs()
      else setSearchQuery("")
    },
  ))

  onCleanup(() => {
    invalidateRefresh()
    invalidateCopy()
  })

  createEffect(
    on(
      () => [props.open, searchQuery().trim(), appStore.logFilterLevel, entries()] as const,
      ([open, query, level, rows], previous) => {
        if (!open) return
        if (!previous?.[0] || previous[1] !== query || previous[2] !== level || !rows.length) followTail = true
        if (!followTail || !rows.length) return
        queueMicrotask(() => {
          if (!props.open || !followTail) return
          const last = entries().length - 1
          if (last >= 0) logList?.scrollToIndex(last, { align: "end" })
        })
      },
    ),
  )

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
            onClick={() => {
              if (!refreshPending()) void refreshServerLogs()
            }}
            aria-disabled={refreshPending() || undefined}
            aria-busy={refreshPending() || undefined}
          >
            {t(refreshPending() ? "log.refreshing" : "common.refresh")}
          </Button>
          <Button
            type="button"
            id="btnLogOpenFile"
            variant="ghost"
            size="sm"
            tone="neutral"
            title={t(pathRevealLabelKey())}
            aria-label={t(pathRevealLabelKey())}
            onClick={handleOpenLogFile}
            disabled={refreshPending() || openFileAction.pending() || !currentServerLogPath()}
          >
            {t(pathRevealLabelKey())}
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
          <Button type="button" id="btnCloseLog" variant="ghost" size="sm" tone="neutral" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </>
      }
    >
      <SearchField
        clearable
        class="log-viewer-search"
        value={searchQuery()}
        placeholder={t("log.search_loaded")}
        clearLabel={t("log.clear_search")}
        onValueChange={setSearchQuery}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
      />
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
      <Show when={logIssue()}>
        {(issue) => (
          <Feedback tone="error" details={formatErrorDetails(issue().cause)}>
            {t(issue().operation === "refresh" ? "log.refresh_failed" : pathRevealFailureKey())}
          </Feedback>
        )}
      </Show>
      <Show
        when={entries().length > 0}
        fallback={
          <Show when={logIssue()?.operation !== "refresh"}>
            <div id="logViewerBody" class="log-viewer" classList={{ "log-viewer-loading": waitingForServerLog() }}>
              <Show
                when={waitingForServerLog()}
                fallback={<div class="empty-hint">{t(searchQuery().trim() ? "log.search_empty" : "log.empty")}</div>}
              >
                <div class="log-viewer-loading-message" role="status">
                  <Icon name="loading" />
                  <span>{t("log.loading_server")}</span>
                </div>
              </Show>
            </div>
          </Show>
        }
      >
        <VList
          id="logViewerBody"
          class="log-viewer"
          data={entries()}
          itemSize={88}
          bufferSize={88 * 8}
          onScroll={(offset) => {
            if (logList) followTail = logList.scrollSize - logList.viewportSize - offset <= LOG_TAIL_TOLERANCE
          }}
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
