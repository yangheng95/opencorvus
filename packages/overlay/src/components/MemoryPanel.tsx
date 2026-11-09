import { Feedback } from "./ui/Feedback"
// ── MemoryPanel Component ──
// Project semantic knowledge: search, inline original content, and deletion.
// The protected Project MEMORY.MD is read separately by MemoryContextPanel.

import { batch, createSignal, createMemo, createEffect, onCleanup, untrack, For, Show } from "solid-js"
import { localeTag, t } from "../utils/i18n"
import type { PanelKnowledgeMemoryGetResponse, PanelKnowledgeMemoryListResponse, PanelKnowledgeMemorySearchResponse } from "@opencorvus-ai/sdk"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { nativeMessage } from "../services/app-dialog"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { syncActiveDirectoryApiContext } from "../services/workspace"
import { Button } from "./ui/Button"
import { ArmedConfirmButton } from "./ui/ArmedConfirmButton"
import { Badge } from "./ui/Badge"
import { SearchField } from "./ui/SearchField"
import { Icon } from "./ui/Icon"
import { SettingsEmpty } from "./settings/layout"

// ── Types ──

type MemoryFile = Pick<PanelKnowledgeMemoryListResponse[number], "id" | "title" | "scope" | "source"> & {
  score?: number
  snippet?: string
  timeUpdated?: number
}

interface MemoryDetail {
  title: string
  scope: string
  source: string
  timeCreated: number
  timeUpdated: number
  content: string
}

type MemoryDetailState =
  | { status: "loading" }
  | { status: "error" | "retrying"; cause: unknown }
  | { status: "ready"; detail: MemoryDetail }

interface MemoryFilesSource {
  directory: string
  authority: ApiAuthority
  generation: number
}

// ── Helpers ──

function knowledgeScopeLabel(scope: string): string {
  if (scope === "project") return t("memory.scope.project")
  return scope || ""
}

function memoryDialogErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function showMemoryMessage(
  owner: string,
  message: string,
  options: { title?: string; kind?: string } = {},
  isCurrent: () => boolean,
): Promise<void> {
  if (!isCurrent()) return
  try {
    await nativeMessage(message, options)
  } catch (error) {
    if (!isCurrent()) return
    reportError({
      id: `memory-panel:${owner}`,
      title: t("common.error"),
      message: memoryDialogErrorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

function formatDate(ts: number | undefined): string {
  if (!ts) return ""
  return new Date(ts).toLocaleDateString(localeTag())
}

function formatDateTime(ts: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(localeTag())
}

// ── MemoryPanel ──

export interface MemoryPanelProps {
  directory?: string | (() => string | undefined)
  active?: boolean
  compact?: boolean
}

export function MemoryPanel(props: MemoryPanelProps) {
  const [files, setFiles] = createSignal<MemoryFile[]>([])
  const [searchMode, setSearchMode] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [failure, setFailure] = createSignal<{ operation: "list" | "search"; cause: unknown }>()
  const [expandedFileId, setExpandedFileId] = createSignal<string | null>(null)
  const [detailStates, setDetailStates] = createSignal<Record<string, MemoryDetailState>>({})
  const [filesSource, setFilesSource] = createSignal<MemoryFilesSource | null>(null)
  const [deletingKeys, setDeletingKeys] = createSignal<ReadonlySet<string>>(new Set())
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
  let sourceGeneration = 0
  let listElement: HTMLDivElement | undefined
  let searchInput: HTMLInputElement | undefined

  function captureSource(): MemoryFilesSource {
    return {
      directory: currentDirectory(),
      authority: captureApiAuthority(),
      generation: sourceGeneration,
    }
  }

  function sourceMatches(source: MemoryFilesSource): boolean {
    return (
      isActive() &&
      source.generation === sourceGeneration &&
      isApiAuthorityCurrent(source.authority) &&
      currentDirectory() === source.directory
    )
  }

  function deleteKey(fileID: string, source = filesSource()): string {
    return source
      ? `${source.authority.revision}\u0000${source.generation}\u0000${source.directory}\u0000${fileID}`
      : ""
  }

  function memoryPath(path: string, directory: string): string {
    const query = new URLSearchParams()
    if (directory) query.set("directory", directory)
    const suffix = query.toString()
    return suffix ? `${path}?${suffix}` : path
  }

  // ── Data loading ──

  const loadMemory = async (source = captureSource(), retryTrigger?: HTMLButtonElement) => {
    if (!sourceMatches(source)) return
    const { directory, authority } = source
    const token = Symbol("memory-load")
    memoryLoadOwner = token
    const ownsLoad = () => memoryLoadOwner === token && sourceMatches(source)
    if (!directory) {
      setFiles([])
      setFilesSource(null)
      setSearchMode(false)
      setExpandedFileId(null)
      setDetailStates({})
      setFailure(undefined)
      setLoading(false)
      return
    }
    batch(() => {
      if (!retryTrigger) setFailure(undefined)
      setLoading(true)
    })
    let restoreFocus = false
    try {
      const data = await apiJson<PanelKnowledgeMemoryListResponse>(memoryPath("panel/knowledge/memory", directory), { authority })
      if (!ownsLoad()) return
      restoreFocus = !!retryTrigger && retryTrigger.ownerDocument.activeElement === retryTrigger
      batch(() => {
        setFiles(Array.isArray(data) ? data : [])
        setFilesSource(source)
        setSearchMode(false)
        setExpandedFileId(null)
        setDetailStates({})
        setFailure(undefined)
      })
    } catch (err) {
      if (ownsLoad()) {
        setFiles([])
        setFilesSource(null)
        setSearchMode(false)
        setExpandedFileId(null)
        setDetailStates({})
        setFailure({ operation: "list", cause: err })
      }
    } finally {
      if (ownsLoad()) {
        memoryLoadOwner = null
        setLoading(false)
        if (restoreFocus) {
          const destination = listElement?.querySelector<HTMLButtonElement>('[data-ui="memory-row-main"]') ?? searchInput
          destination?.focus({ preventScroll: true })
        }
      }
    }
  }

  const doSearch = async (q: string) => {
    const source = captureSource()
    if (!sourceMatches(source)) return
    if (!q || !q.trim()) {
      return loadMemory()
    }
    const directory = currentDirectory()
    if (!directory) {
      return loadMemory(source)
    }
    const query = q.trim()
    const token = Symbol("memory-search")
    memoryLoadOwner = token
    const ownsSearch = () => memoryLoadOwner === token && sourceMatches(source) && searchQuery().trim() === query
    batch(() => {
      setFiles([])
      setFilesSource(null)
      setSearchMode(true)
      setExpandedFileId(null)
      setDetailStates({})
      setFailure(undefined)
      setLoading(true)
    })
    try {
      const results = await apiJson<PanelKnowledgeMemorySearchResponse>(memoryPath("panel/knowledge/memory/search", directory), {
        authority: source.authority,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q.trim(),
          limit: 20,
        }),
      })
      if (!ownsSearch()) return
      const mapped = new Map<string, MemoryFile>()
      for (const result of results) {
        if (mapped.has(result.fileId)) continue
        mapped.set(result.fileId, {
          id: result.fileId,
          title: result.fileTitle,
          scope: result.scope,
          source: result.source,
          score: result.score,
          snippet: result.content ? result.content.slice(0, 200) : "",
        })
      }
      batch(() => {
        setFiles([...mapped.values()])
        setFilesSource(source)
      })
    } catch (err) {
      if (!ownsSearch()) return
      setFailure({ operation: "search", cause: err })
      console.error("[MemoryPanel] search failed", err)
    } finally {
      if (memoryLoadOwner === token && sourceMatches(source)) {
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
    if (!source || !sourceMatches(source)) return
    const operationKey = deleteKey(fileId, source)
    if (!operationKey || deletingKeys().has(operationKey)) return
    setDeletingKeys((current) => new Set([...current, operationKey]))
    try {
      await apiJson(memoryPath(`panel/knowledge/memory/${encodeURIComponent(fileId)}`, source.directory), {
        authority: source.authority,
        method: "DELETE",
      })
      if (!sourceMatches(source)) return
      await loadMemory(source)
      if (!sourceMatches(source)) return
      setDetailStates((current) => {
        const next = { ...current }
        delete next[fileId]
        return next
      })
    } catch (err) {
      if (!sourceMatches(source)) return
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[MemoryPanel] inline delete failed", err)
      await showMemoryMessage(
        "delete-failed",
        t("memory.delete_failed", { error: msg }),
        {
          title: t("memory.delete_failed_title"),
        },
        () => sourceMatches(source),
      )
      requestAnimationFrame(() => {
        if (!sourceMatches(source)) return
        document
          .querySelector<HTMLButtonElement>(`[data-action="delete-memory"][data-id="${CSS.escape(fileId)}"]`)
          ?.focus()
      })
    } finally {
      if (!sourceMatches(source)) return
      setDeletingKeys((current) => {
        const next = new Set(current)
        next.delete(operationKey)
        return next
      })
    }
  }

  const loadMemoryDetail = async (
    fileId: string,
    retry?: { trigger: HTMLButtonElement; focusContent: () => void },
  ) => {
    if (!filesSourceActive() || expandedFileId() !== fileId) return
    const current = detailStates()[fileId]
    if (current && current.status !== "error") return
    const source = captureSource()
    const { directory, authority } = source
    const pending: MemoryDetailState = retry && current?.status === "error"
      ? { status: "retrying", cause: current.cause }
      : { status: "loading" }
    const ownsDetail = () => sourceMatches(source) && detailStates()[fileId] === pending
    setDetailStates((current) => ({
      ...current,
      [fileId]: pending,
    }))
    try {
      const data = await apiJson<PanelKnowledgeMemoryGetResponse>(
        memoryPath(`panel/knowledge/memory/${encodeURIComponent(fileId)}`, directory),
        { authority },
      )
      if (!ownsDetail()) return
      const f = data.file
      const restoreFocus = retry && expandedFileId() === fileId && retry.trigger.ownerDocument.activeElement === retry.trigger
      setDetailStates((current) => ({
        ...current,
        [fileId]: {
          status: "ready",
          detail: {
            title: f.title,
            scope: f.scope,
            source: f.source,
            timeCreated: f.timeCreated,
            timeUpdated: f.timeUpdated,
            content: data.content,
          },
        },
      }))
      if (restoreFocus) retry.focusContent()
    } catch (cause) {
      if (!ownsDetail()) return
      setDetailStates((current) => ({
        ...current,
        [fileId]: { status: "error", cause },
      }))
    }
  }

  const toggleMemoryDetail = (fileId: string) => {
    if (!filesSourceActive()) return
    const next = expandedFileId() === fileId ? null : fileId
    setExpandedFileId(next)
    if (next) void loadMemoryDetail(next)
  }

  // The retained panel retires its source even while inactive.
  createEffect(() => {
    const active = isActive()
    currentDirectory()
    captureApiAuthority()
    sourceGeneration += 1
    memoryLoadOwner = null
    setFiles([])
    setFilesSource(null)
    setSearchMode(false)
    setSearchQuery("")
    setExpandedFileId(null)
    setDetailStates({})
    setDeletingKeys(new Set<string>())
    setLoading(false)
    setFailure(undefined)
    if (active) untrack(() => void loadMemory())
    onCleanup(() => {
      sourceGeneration += 1
      memoryLoadOwner = null
    })
  })

  const badge = createMemo(() => {
    const n = files().length
    return n > 0 ? String(n) : ""
  })

  const filesSourceActive = createMemo(() => {
    const source = filesSource()
    return !!source && sourceMatches(source)
  })

  const listFailure = createMemo(() => {
    const current = failure()
    return current?.operation === "list" ? current : undefined
  })

  const emptyHint = createMemo(() => {
    if (loading()) return t("common.loading")
    const currentFailure = failure()
    if (currentFailure) return t(currentFailure.operation === "search" ? "memory.search_failed_title" : "memory.notes_list_load_failed")
    if (searchMode()) return t("memory.no_results")
    if (!currentDirectory()) return t("memory.none_unselected")
    return t("memory.none")
  })

  const ordinaryEmptyState = () => {
    if (props.compact) return <div class="empty-hint">{emptyHint()}</div>
    if (loading()) return <Feedback>{emptyHint()}</Feedback>
    const currentFailure = failure()
    if (currentFailure) {
      return <Feedback tone="error" details={formatErrorDetails(currentFailure.cause)}>{emptyHint()}</Feedback>
    }
    if (!currentDirectory()) {
      return (
        <Feedback
          tone="neutral"
          title={t("memory.project_required_title")}
        >
          {emptyHint()}
        </Feedback>
      )
    }
    return <SettingsEmpty>{emptyHint()}</SettingsEmpty>
  }

  const emptyState = () => (
    <Show when={!props.compact && listFailure()} fallback={ordinaryEmptyState()}>
      {(current) => (
        <Feedback
          tone="error"
          details={formatErrorDetails(current().cause)}
          actions={(
            <Button
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              aria-disabled={loading() || undefined}
              onClick={(event) => {
                if (!loading()) void loadMemory(captureSource(), event.currentTarget)
              }}
            >
              <Icon name="refresh" />{t(loading() ? "common.loading" : "common.retry")}
            </Button>
          )}
        >
          {t("memory.notes_list_load_failed")}
        </Feedback>
      )}
    </Show>
  )

  return (
    <div class="memory-panel" data-compact={props.compact ? "true" : "false"}>
      {/* Search toolbar */}
      <div class="knowledge-toolbar">
        <SearchField
          clearable
          class="memory-search"
          inputID="memorySearch"
          size={props.compact ? "sm" : "md"}
          value={searchQuery()}
          inputRef={(element) => { searchInput = element }}
          placeholder={t("memory.search_placeholder")}
          disabled={!currentDirectory()}
          readOnly={loading()}
          onValueChange={setSearchQuery}
          onClear={handleSearchClear}
          clearDataUI="memory-search-clear"
          onSubmit={() => void doSearch(searchQuery())}
          submitDataUI="memory-search-submit"
        />
      </div>

      {/* List */}
      <div id="memoryList" class="knowledge-list" ref={listElement}>
        <Show when={files().length > 0} fallback={emptyState()}>
          <For each={files()}>
            {(f) => {
              const meta = () => {
                const time = formatDate(f.timeUpdated)
                const scoreHint = f.score != null
                  ? ` · ${t("memory.score", { value: new Intl.NumberFormat(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(f.score) })}`
                  : ""
                return `${f.source}${scoreHint}${time ? ` · ${time}` : ""}`
              }
              const detailState = () => detailStates()[f.id]
              const detail = () => {
                const state = detailState()
                return state?.status === "ready" ? state.detail : undefined
              }
              const detailFailure = () => {
                const state = detailState()
                return state?.status === "error" || state?.status === "retrying" ? state : undefined
              }
              const expanded = () => expandedFileId() === f.id
              const detailElementId = () => `memory-detail-${f.id.replace(/[^A-Za-z0-9_-]/g, "-")}`
              let originalContent: HTMLPreElement | undefined

              return (
                <div
                  class="knowledge-item"
                  data-mode={searchMode() ? "search" : "list"}
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
                      <span class="knowledge-item-title">
                        {f.title}
                        <Show when={searchMode()}>
                          <span class="knowledge-item-search-label">{` (${t("memory.search_result")})`}</span>
                        </Show>
                      </span>
                      <span class="knowledge-item-meta-row">
                        <span class="knowledge-item-meta">{meta()}</span>
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
                      <Show when={detailState()?.status === "loading"}>
                        <div class="loading-hint">{t("common.loading")}</div>
                      </Show>
                      <Show when={detailFailure()}>
                        {(failure) => (
                          <Feedback
                            tone="error"
                            data-ui="memory-detail-error"
                            details={formatErrorDetails(failure().cause)}
                            actions={(
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                tone="neutral"
                                aria-disabled={failure().status === "retrying" || undefined}
                                onClick={(event) => void loadMemoryDetail(f.id, {
                                  trigger: event.currentTarget,
                                  focusContent: () => originalContent?.focus(),
                                })}
                              >
                                <Icon name="refresh" />
                                {t(failure().status === "retrying" ? "common.loading" : "common.retry")}
                              </Button>
                            )}
                          >
                            {t("memory.original_load_failed")}
                          </Feedback>
                        )}
                      </Show>
                      <Show when={detail()}>
                        {(d) => (
                          <>
                            <div class="memory-detail-meta">
                              <span>{t("memory.source", { value: d().source })}</span>
                              <span>{t("memory.created", { value: formatDateTime(d().timeCreated) })}</span>
                              <span>{t("memory.updated", { value: formatDateTime(d().timeUpdated) })}</span>
                            </div>
                            <pre
                              class="memory-detail-content"
                              role="region"
                              aria-label={t("memory.original_content_label", { title: d().title })}
                              tabIndex={0}
                              ref={(element) => { originalContent = element }}
                            >
                              {d().content || t("memory.empty_value")}
                            </pre>
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
