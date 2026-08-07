// ── MemoryPanel Component ──
// Knowledge/memory panel that lists memory files for the current task, supports
// search, inline detail expansion, and deletion.
// Ports renderMemory ( 10549–10582), loadMemory (10487–10509),
// searchMemory (10511–10540), openMemoryDetail (10586–10610), deleteMemory
// (10612–10621), and knowledgeScopeLabel (10542–10547).

import { createSignal, createMemo, createEffect, For, Show } from "solid-js"
import { t } from "../utils/i18n"
import { apiJson } from "../services/api"
import { nativeMessage } from "../services/app-dialog"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { syncActiveDirectoryApiContext } from "../services/workspace"
import { Button } from "./ui/Button"
import { ArmedConfirmButton } from "./ui/ArmedConfirmButton"
import { Badge } from "./ui/Badge"
import { SearchField } from "./ui/SearchField"
import { Icon } from "./ui/Icon"
import { SettingsEmpty, SettingsState } from "./settings/layout"

// ── Types ──

export interface MemoryFile {
  id: string
  title: string
  scope: string
  source: string
  score?: number
  snippet?: string
  timeUpdated: number
}

interface MemoryDetail {
  title: string
  scope: string
  source: string
  timeCreated: number
  timeUpdated: number
  content: string
}

interface MemoryDetailState {
  loading: boolean
  error: string
  detail: MemoryDetail | null
}

interface MemoryFilesSource {
  taskID: string | undefined
  directory: string
}

// ── Helpers ──

function knowledgeScopeLabel(scope: string): string {
  if (scope === "session") return t("memory.scope.session")
  if (scope === "cwd") return t("memory.scope.cwd")
  if (scope === "global") return t("memory.scope.global")
  return scope || ""
}

function memoryDialogErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function showMemoryMessage(
  owner: string,
  message: string,
  options: { title?: string; kind?: string } = {},
): Promise<void> {
  try {
    await nativeMessage(message, options)
  } catch (error) {
    reportError({
      id: `memory-panel:${owner}`,
      title: t("common.error"),
      message: memoryDialogErrorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

function formatDate(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleDateString()
}

function formatDateTime(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString()
}

// ── MemoryPanel ──

export interface MemoryPanelProps {
  taskID?: string | (() => string | undefined)
  directory?: string | (() => string | undefined)
  active?: boolean
  compact?: boolean
}

export function MemoryPanel(props: MemoryPanelProps) {
  const [files, setFiles] = createSignal<MemoryFile[]>([])
  const [searchMode, setSearchMode] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [errorMessage, setErrorMessage] = createSignal("")
  const [expandedFileId, setExpandedFileId] = createSignal<string | null>(null)
  const [detailStates, setDetailStates] = createSignal<Record<string, MemoryDetailState>>({})
  const [filesSource, setFilesSource] = createSignal<MemoryFilesSource | null>(null)
  const [deletingKeys, setDeletingKeys] = createSignal<ReadonlySet<string>>(new Set())
  const currentTaskID = () => (typeof props.taskID === "function" ? props.taskID() : props.taskID)
  const isActive = () => props.active ?? true
  const currentDirectory = () => {
    if (props.directory !== undefined) {
      const value = typeof props.directory === "function" ? props.directory() : props.directory
      const directory = String(value || "").trim()
      return directory
    }
    return syncActiveDirectoryApiContext().trim()
  }
  let memoryLoadOwner: symbol | null = null

  function sourceMatches(taskID: string | undefined, directory: string): boolean {
    return String(currentTaskID() || "") === String(taskID || "") && currentDirectory() === directory
  }

  function deleteKey(fileID: string, source = filesSource()): string {
    return source ? `${source.taskID ?? ""}\u0000${source.directory}\u0000${fileID}` : ""
  }

  function memoryPath(path: string, directory: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams()
    if (directory) query.set("directory", directory)
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value)
    }
    const suffix = query.toString()
    return suffix ? `${path}?${suffix}` : path
  }

  // ── Data loading ──

  const loadMemory = async (taskID = currentTaskID(), directory = currentDirectory()) => {
    if (!taskID || !directory) {
      setFiles([])
      setFilesSource(null)
      setSearchMode(false)
      setExpandedFileId(null)
      setDetailStates({})
      setErrorMessage("")
      return
    }
    const token = Symbol("memory-load")
    memoryLoadOwner = token
    setLoading(true)
    try {
      const data = await apiJson(memoryPath("panel/knowledge/memory", directory, { taskID }))
      if (!sourceMatches(taskID, directory)) return
      setFiles(Array.isArray(data) ? data : [])
      setFilesSource({ taskID, directory })
      setSearchMode(false)
      setExpandedFileId(null)
      setDetailStates({})
      setErrorMessage("")
    } catch (err) {
      if (sourceMatches(taskID, directory)) {
        setFiles([])
        setFilesSource(null)
        setSearchMode(false)
        setExpandedFileId(null)
        setDetailStates({})
        setErrorMessage(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (memoryLoadOwner === token) {
        memoryLoadOwner = null
        setLoading(false)
      }
    }
  }

  const doSearch = async (q: string) => {
    if (!q || !q.trim()) {
      return loadMemory()
    }
    const directory = currentDirectory()
    if (!currentTaskID() || !directory) {
      return loadMemory(currentTaskID(), directory)
    }
    const taskID = currentTaskID()
    const query = q.trim()
    const token = Symbol("memory-search")
    memoryLoadOwner = token
    setLoading(true)
    try {
      // Body-only branch — no implicit fallback to old results, every search
      // call either succeeds or surfaces the error to the operator below.
      const results = await apiJson(memoryPath("panel/knowledge/memory/search", directory), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q.trim(),
          taskID: currentTaskID() || undefined,
          limit: 20,
        }),
      })
      if (!sourceMatches(taskID, directory) || searchQuery().trim() !== query) return
      const mapped: MemoryFile[] = (Array.isArray(results) ? results : []).map((r: any) => ({
        id: r.fileId,
        title: r.fileTitle,
        scope: r.scope || "global",
        source: t("memory.search_source"),
        score: r.score,
        snippet: r.content ? r.content.slice(0, 200) : "",
        timeUpdated: r.timeCreated || 0,
      }))
      setFiles(mapped)
      setFilesSource({ taskID, directory })
      setSearchMode(true)
      setExpandedFileId(null)
      setDetailStates({})
      setErrorMessage("")
    } catch (err) {
      if (!sourceMatches(taskID, directory) || searchQuery().trim() !== query) return
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg)
      console.error("[MemoryPanel] search failed", err)
      void showMemoryMessage("search-failed", t("memory.search_failed", { error: msg }), {
        title: t("memory.search_failed_title"),
      })
    } finally {
      if (memoryLoadOwner === token) {
        memoryLoadOwner = null
        setLoading(false)
      }
    }
  }

  const handleSearchClear = () => {
    setSearchQuery("")
    if (searchMode()) void loadMemory()
  }

  const handleDeleteInline = async (fileId: string, source = filesSource()) => {
    if (!source || !sourceMatches(source.taskID, source.directory)) return
    const operationKey = deleteKey(fileId, source)
    if (!operationKey || deletingKeys().has(operationKey)) return
    setDeletingKeys((current) => new Set([...current, operationKey]))
    try {
      await apiJson(memoryPath(`panel/knowledge/memory/${encodeURIComponent(fileId)}`, source.directory), {
        method: "DELETE",
      })
      if (!sourceMatches(source.taskID, source.directory)) return
      await loadMemory(source.taskID, source.directory)
      if (!sourceMatches(source.taskID, source.directory)) return
      setDetailStates((current) => {
        const next = { ...current }
        delete next[fileId]
        return next
      })
    } catch (err) {
      if (!sourceMatches(source.taskID, source.directory)) return
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[MemoryPanel] inline delete failed", err)
      await showMemoryMessage("delete-failed", t("memory.delete_failed", { error: msg }), {
        title: t("memory.delete_failed_title"),
      })
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(`[data-action="delete-memory"][data-id="${CSS.escape(fileId)}"]`)
          ?.focus()
      })
    } finally {
      setDeletingKeys((current) => {
        const next = new Set(current)
        next.delete(operationKey)
        return next
      })
    }
  }

  const loadMemoryDetail = async (fileId: string) => {
    const taskID = currentTaskID()
    const directory = currentDirectory()
    setDetailStates((current) => ({
      ...current,
      [fileId]: { loading: true, error: "", detail: current[fileId]?.detail ?? null },
    }))
    try {
      const data = await apiJson(memoryPath(`panel/knowledge/memory/${encodeURIComponent(fileId)}`, directory))
      if (!sourceMatches(taskID, directory)) return
      const f = data.file
      setDetailStates((current) => ({
        ...current,
        [fileId]: {
          loading: false,
          error: "",
          detail: {
            title: f.title,
            scope: f.scope,
            source: f.source,
            timeCreated: f.timeCreated,
            timeUpdated: f.timeUpdated,
            content: data.content || "",
          },
        },
      }))
    } catch (e: any) {
      if (!sourceMatches(taskID, directory)) return
      setDetailStates((current) => ({
        ...current,
        [fileId]: {
          loading: false,
          error: e?.message || t("memory.load_failed"),
          detail: null,
        },
      }))
    }
  }

  const toggleMemoryDetail = (fileId: string) => {
    if (!filesSourceActive()) return
    const next = expandedFileId() === fileId ? null : fileId
    setExpandedFileId(next)
    if (next && !detailStates()[next]) void loadMemoryDetail(next)
  }

  // Reload when taskID changes (reactive)
  createEffect(() => {
    if (!isActive()) return
    const taskID = currentTaskID()
    const directory = currentDirectory()
    void loadMemory(taskID, directory)
  })

  const badge = createMemo(() => {
    const n = files().length
    return n > 0 ? String(n) : ""
  })

  const filesSourceActive = createMemo(() => {
    const source = filesSource()
    return !!source && sourceMatches(source.taskID, source.directory)
  })

  const emptyHint = createMemo(() => {
    if (loading()) return t("common.loading")
    if (errorMessage()) return errorMessage()
    if (searchMode()) return t("memory.no_results")
    if (!currentTaskID()) return t("memory.none_unselected")
    if (!currentDirectory()) return t("memory.scope_unavailable")
    return t("memory.none")
  })

  const emptyState = () => {
    if (props.compact) return <div class="empty-hint">{emptyHint()}</div>
    if (errorMessage()) return <SettingsState tone="error">{emptyHint()}</SettingsState>
    if (loading()) return <SettingsState>{emptyHint()}</SettingsState>
    if (!currentDirectory() || !currentTaskID()) {
      return (
        <SettingsState
          tone="warning"
          title={currentTaskID() ? t("memory.scope_unavailable_title") : t("memory.task_required_title")}
        >
          {emptyHint()}
        </SettingsState>
      )
    }
    return <SettingsEmpty>{emptyHint()}</SettingsEmpty>
  }

  return (
    <div class="memory-panel" data-compact={props.compact ? "true" : "false"}>
      {/* Search toolbar */}
      <div class="knowledge-toolbar">
        <SearchField
          class="memory-search"
          inputID="memorySearch"
          size={props.compact ? "sm" : "md"}
          value={searchQuery()}
          placeholder={t("memory.search_placeholder")}
          disabled={loading() || !currentTaskID() || !currentDirectory()}
          onValueChange={setSearchQuery}
          onClear={handleSearchClear}
          clearDataUI="memory-search-clear"
          onSubmit={() => void doSearch(searchQuery())}
          submitDataUI="memory-search-submit"
        />
      </div>

      {/* List */}
      <div id="memoryList" class="knowledge-list">
        <Show when={files().length > 0} fallback={emptyState()}>
          <For each={files()}>
            {(f) => {
              const time = formatDate(f.timeUpdated)
              const mode = searchMode() ? "search" : "list"
              const scoreHint = f.score != null ? ` · ${t("memory.score", { value: f.score.toFixed(2) })}` : ""
              const meta = `${f.source}${scoreHint}${time ? ` · ${time}` : ""}`
              const detailState = () => detailStates()[f.id]
              const detail = () => detailState()?.detail ?? null
              const expanded = () => expandedFileId() === f.id
              const detailElementId = () => `memory-detail-${f.id.replace(/[^A-Za-z0-9_-]/g, "-")}`

              return (
                <div
                  class="knowledge-item"
                  data-mode={mode}
                  data-id={f.id}
                  data-expanded={expanded() ? "true" : "false"}
                >
                  <div class="knowledge-item-row">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="knowledge-item-main"
                      data-chrome="row-action"
                      data-ui="memory-row-main"
                      aria-expanded={expanded()}
                      aria-controls={expanded() ? detailElementId() : undefined}
                      disabled={!filesSourceActive()}
                      onClick={() => toggleMemoryDetail(f.id)}
                    >
                      <span class="knowledge-item-title">{f.title}</span>
                      <span class="knowledge-item-meta-row">
                        <span class="knowledge-item-meta">{meta}</span>
                        <Badge class="knowledge-scope" tone="neutral" size="sm" data-scope={f.scope}>
                          {knowledgeScopeLabel(f.scope)}
                        </Badge>
                      </span>
                      <Show when={!!f.snippet}>
                        <span class="knowledge-item-meta">{f.snippet}</span>
                      </Show>
                    </Button>
                    <ArmedConfirmButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      tone="danger"
                      data-chrome="icon-action"
                      data-action="delete-memory"
                      data-id={f.id}
                      label={t("memory.delete_button_title")}
                      armedDescription={t("memory.delete_confirm")}
                      disabled={!filesSourceActive() || deletingKeys().has(deleteKey(f.id))}
                      onConfirm={() => void handleDeleteInline(f.id)}
                      confirmChildren={<Icon name="check" size="compact" />}
                    >
                      <Icon name="delete" />
                    </ArmedConfirmButton>
                  </div>
                  <Show when={expanded()}>
                    <div id={detailElementId()} class="memory-inline-detail">
                      <Show when={detailState()?.loading}>
                        <div class="loading-hint">{t("common.loading")}</div>
                      </Show>
                      <Show when={!detailState()?.loading && !!detailState()?.error}>
                        <SettingsState tone="error" data-ui="memory-detail-error">
                          {detailState()?.error}
                        </SettingsState>
                      </Show>
                      <Show when={!detailState()?.loading && !detailState()?.error && detail()}>
                        {(d) => (
                          <>
                            <div class="memory-detail-meta">
                              <span>{t("memory.source", { value: d().source })}</span>
                              <span>{t("memory.created", { value: formatDateTime(d().timeCreated) })}</span>
                              <span>{t("memory.updated", { value: formatDateTime(d().timeUpdated) })}</span>
                            </div>
                            <pre class="memory-detail-content">{d().content || t("memory.empty_value")}</pre>
                          </>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>
              )
            }}
          </For>
        </Show>
      </div>
    </div>
  )
}
