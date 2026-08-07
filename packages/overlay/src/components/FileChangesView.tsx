import { ListboxItem, ListboxRoot } from "./ui/Listbox"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import {
  Virtualizer,
  type CustomContainerComponentProps,
  type CustomItemComponentProps,
  type VirtualizerHandle,
} from "virtua/solid"
import { isKnownTextDiff, summarizeChangeGroups, type ChangeGroup, type DiffTarget } from "../services/diff"
import { t, tc } from "../utils/i18n"
import { changeStatusLabel, type FileChange } from "./DiffView"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { FileRowContent } from "./ui/FileRow"
import { SegmentedControl, type SegmentedControlOption } from "./ui/SegmentedControl"
import { SearchField } from "./ui/SearchField"
import { Checkbox } from "./ui/Checkbox"
import { DiffPreviewPanel } from "./DiffPreviewPanel"
import {
  completeReviewFocus,
  failReviewFocus,
  pendingReviewFocus,
  resolveReviewFocusTarget,
  reviewFocusFailure,
} from "../services/review-focus"

export interface FileChangesViewProps {
  groups: ChangeGroup[]
  hasSelectedTask?: boolean
  showHeading?: boolean
  focusEvent?: string
  scopeKey?: string
  groupsSettled?: boolean
}

const VIRTUAL_CHANGE_ROW_THRESHOLD = 80
const ESTIMATED_CHANGE_ROW_HEIGHT = 28
const VIRTUAL_CHANGE_ROW_BUFFER_PIXELS = ESTIMATED_CHANGE_ROW_HEIGHT * 10

type ChangeStatusFilter = "all" | FileChange["status"]

const CHANGE_STATUS_FILTERS: ChangeStatusFilter[] = ["all", "modified", "added", "deleted"]

interface ChangeRowModel {
  group: ChangeGroup
  item: FileChange
  key: string
  index: number
  fileName: string
  directory: string
  groupLabel: string
  groupTitle: string
  searchText: string
}

interface VisibleGroup {
  group: ChangeGroup
  label: string
  title: string
  rows: ChangeRowModel[]
}

interface ChangeRowCollectionNode {
  type: "item" | "section"
  key: string
  rawValue: ChangeRowModel
  textValue: string
  disabled: boolean
  level: number
  index: number
  prevKey?: string
  nextKey?: string
}

function splitFilePath(file: string): { fileName: string; directory: string } {
  const normalized = String(file || "").replace(/\\/g, "/")
  const idx = normalized.lastIndexOf("/")
  if (idx < 0) return { fileName: normalized, directory: "" }
  return {
    fileName: normalized.slice(idx + 1) || normalized,
    directory: normalized.slice(0, idx),
  }
}

function shortCommit(ref: string | undefined): string {
  const value = String(ref || "").trim()
  return value.length > 12 ? value.slice(0, 12) : value
}

function groupLabel(group: ChangeGroup): string {
  return group.agentID || group.sessionID || group.artifactID || group.id.replace(/^(agent|node|artifact):/, "")
}

function groupTitle(group: ChangeGroup): string {
  return [group.agentID, group.sessionID].filter(Boolean).join(" - ") || groupLabel(group)
}

function ChangeRowContent(props: { row: ChangeRowModel; showScope: boolean }) {
  return (
    <FileRowContent
      name={props.row.fileName}
      icon="file-document"
      detail={props.row.directory}
      prefix={
        props.showScope ? (
          <span class="change-scope" title={props.row.groupTitle}>
            {props.row.groupLabel}
          </span>
        ) : undefined
      }
      trailing={
        <>
          <span class="change-status" data-status={props.row.item.status}>
            {changeStatusLabel(props.row.item.status)}
          </span>
          <span class="diff-dialog-stat" data-tone="add">
            +{props.row.item.additions ?? 0}
          </span>
          <span class="diff-dialog-stat" data-tone="del">
            -{props.row.item.deletions ?? 0}
          </span>
        </>
      }
    />
  )
}

function ChangeRow(props: {
  node: ChangeRowCollectionNode
  row: ChangeRowModel
  showScope: boolean
  onSelect: (row: ChangeRowModel) => void
}) {
  const open = () => {
    props.onSelect(props.row)
  }

  return (
    <ListboxItem
      item={props.node}
      as="button"
      type="button"
      class="oc-file-row change-row"
      data-clickable="true"
      data-change-index={props.row.index}
      title={props.row.item.file}
      id={`change-row-${props.row.index}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        event.stopPropagation()
        open()
      }}
    >
      <ChangeRowContent row={props.row} showScope={props.showScope} />
    </ListboxItem>
  )
}

function diffTargetFromRow(row: ChangeRowModel): DiffTarget {
  return {
    filePath: row.item.file,
    groupID: row.group.id,
    ...(row.group.sessionID ? { sessionID: row.group.sessionID } : {}),
    ...(row.group.agentID ? { agentID: row.group.agentID } : {}),
  }
}

function ChangesVirtualWindow(props: CustomContainerComponentProps) {
  const setRef = (node: HTMLDivElement) => {
    if (typeof props.ref === "function") props.ref(node)
  }
  return (
    <div ref={setRef} class="changes-list-virtual-window" style={props.style}>
      {props.children}
    </div>
  )
}

function ChangesVirtualItem(props: CustomItemComponentProps) {
  const setRef = (node: HTMLDivElement) => {
    if (typeof props.ref === "function") props.ref(node)
  }
  return (
    <div ref={setRef} class="changes-list-virtual-item" style={props.style}>
      {props.children}
    </div>
  )
}

export function FileChangesView(props: FileChangesViewProps) {
  let rowVirtualizer: VirtualizerHandle | undefined
  let filterInputEl: HTMLInputElement | undefined
  let listEl: HTMLUListElement | undefined
  const [selectedRowKey, setSelectedRowKey] = createSignal("")
  const [filterQuery, setFilterQuery] = createSignal("")
  const [statusFilter, setStatusFilter] = createSignal<ChangeStatusFilter>("all")
  const [hideNonTextFiles, setHideNonTextFiles] = createSignal(false)

  createEffect(
    on(
      () => props.scopeKey,
      () => {
        setFilterQuery("")
        setStatusFilter("all")
        setHideNonTextFiles(false)
        setSelectedRowKey("")
      },
      { defer: true },
    ),
  )

  const groups = createMemo<ChangeGroup[]>(() => props.groups.filter((group) => group.changes.length > 0))
  const files = createMemo<FileChange[]>(() => groups().flatMap((group) => group.changes))
  const summary = createMemo(() => summarizeChangeGroups(groups()))
  const hasGroupLabels = createMemo(
    () => groups().length > 1 || groups().some((group) => !!group.sessionID || !!group.agentID),
  )
  const summaryCommitRef = createMemo(() => {
    const refs = [
      ...new Set(
        groups()
          .map((group) => group.commitRef)
          .filter((ref): ref is string => !!ref),
      ),
    ]
    return refs.length === 1 ? refs[0] : ""
  })
  const allRows = createMemo<ChangeRowModel[]>(() => {
    let index = 0
    return groups().flatMap((group) => {
      const label = groupLabel(group)
      const title = groupTitle(group)
      return group.changes.map((item) => {
        const path = splitFilePath(item.file)
        const status = changeStatusLabel(item.status)
        const row: ChangeRowModel = {
          group,
          item,
          key: `${group.id}:${index}:${item.file}`,
          index,
          fileName: path.fileName,
          directory: path.directory,
          groupLabel: label,
          groupTitle: title,
          searchText: `${item.file} ${status} ${label} ${title}`.toLowerCase(),
        }
        index += 1
        return row
      })
    })
  })
  const filteredRows = createMemo<ChangeRowModel[]>(() => {
    const query = filterQuery().trim().toLowerCase()
    const status = statusFilter()
    return allRows().filter((row) => {
      if (status !== "all" && row.item.status !== status) return false
      if (hideNonTextFiles() && !isKnownTextDiff(row.item)) return false
      if (query && !row.searchText.includes(query)) return false
      return true
    })
  })
  const visibleGroups = createMemo<VisibleGroup[]>(() => {
    const byGroup = new Map<string, ChangeRowModel[]>()
    for (const row of filteredRows()) {
      const bucket = byGroup.get(row.group.id) ?? []
      bucket.push(row)
      byGroup.set(row.group.id, bucket)
    }
    return groups().flatMap((group) => {
      const rows = byGroup.get(group.id) ?? []
      if (rows.length === 0) return []
      return [{ group, label: groupLabel(group), title: groupTitle(group), rows }]
    })
  })
  const statusCounts = createMemo<Record<ChangeStatusFilter, number>>(() => {
    const counts: Record<ChangeStatusFilter, number> = {
      all: 0,
      modified: 0,
      added: 0,
      deleted: 0,
    }
    for (const row of allRows()) {
      counts.all += 1
      counts[row.item.status] += 1
    }
    return counts
  })
  const shouldShowFilter = createMemo(() => allRows().length > 0)
  const shouldVirtualizeRows = createMemo(() => filteredRows().length > VIRTUAL_CHANGE_ROW_THRESHOLD)
  const selectedKeys = createMemo(() => (selectedRowKey() ? [selectedRowKey()] : []))
  const selectedRow = createMemo(() => allRows().find((row) => row.key === selectedRowKey()) || null)
  const selectedDiffTarget = createMemo<DiffTarget | null>(() => {
    const row = selectedRow()
    return row ? diffTargetFromRow(row) : null
  })
  const statusFilterLabel = (status: ChangeStatusFilter): string =>
    status === "all" ? t("files.status.all") : changeStatusLabel(status)
  const statusFilterOptions = createMemo<SegmentedControlOption<ChangeStatusFilter>[]>(() =>
    CHANGE_STATUS_FILTERS.map((status) => ({
      value: status,
      label: (
        <>
          <span class="changes-status-option-label">{statusFilterLabel(status)}</span>
          <span class="changes-status-option-count" aria-hidden="true">
            {statusCounts()[status]}
          </span>
        </>
      ),
      tone: status === "added" ? "ok" : status === "deleted" ? "bad" : status === "modified" ? "accent" : "neutral",
      title: statusFilterLabel(status),
    })),
  )

  createEffect(() => {
    const rows = filteredRows()
    const current = selectedRowKey()
    if (rows.length === 0) {
      if (current) setSelectedRowKey("")
      return
    }
    if (current && rows.some((row) => row.key === current)) return
    setSelectedRowKey(rows[0]!.key)
  })

  const selectRow = (row: ChangeRowModel) => setSelectedRowKey(row.key)

  const focusExactRow = (row: ChangeRowModel) => {
    setFilterQuery("")
    setStatusFilter("all")
    setHideNonTextFiles(false)
    setSelectedRowKey(row.key)
    window.requestAnimationFrame(() => {
      const position = filteredRows().findIndex((candidate) => candidate.key === row.key)
      if (position >= 0 && shouldVirtualizeRows()) rowVirtualizer?.scrollToIndex(position)
      window.requestAnimationFrame(() => {
        document.getElementById(`change-row-${row.index}`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
      })
    })
  }

  createEffect(() => {
    const request = pendingReviewFocus()
    if (!request || request.target.taskID !== props.scopeKey) return
    const target = resolveReviewFocusTarget(groups(), request.target)
    if (target) {
      const row = allRows().find(
        (candidate) => candidate.group.id === target.groupID && candidate.item.file === target.filePath,
      )
      if (!row) throw new Error(`Resolved Review target has no canonical row: ${target.groupID}:${target.filePath}`)
      focusExactRow(row)
      completeReviewFocus(request.id)
      return
    }
    if (props.groupsSettled ?? true) failReviewFocus(request.id)
  })

  const focusFilterInput = () => {
    if (!shouldShowFilter()) return false
    filterInputEl?.focus()
    filterInputEl?.select()
    return true
  }

  const onListShortcutKeyDown = (event: KeyboardEvent) => {
    if (event.key === "/" || (event.key.toLowerCase() === "f" && (event.ctrlKey || event.metaKey))) {
      if (focusFilterInput()) event.preventDefault()
    }
  }

  const scrollToSelectedItem = (key: string) => {
    const position = filteredRows().findIndex((row) => row.key === key)
    if (position >= 0 && shouldVirtualizeRows()) rowVirtualizer?.scrollToIndex(position)
  }

  const onFilterKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    if (filterQuery()) {
      setFilterQuery("")
      filterInputEl?.select()
      return
    }
    listEl?.focus()
  }

  onMount(() => {
    if (typeof window === "undefined" || !props.focusEvent) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionID?: string }>).detail
      const requestedRunID = detail?.sessionID
      if (!requestedRunID) return
      const match = allRows().find((row) => row.group.sessionID === requestedRunID)
      if (!match) return
      setSelectedRowKey(match.key)
      const position = filteredRows().findIndex((row) => row.key === match.key)
      if (position >= 0 && shouldVirtualizeRows()) rowVirtualizer?.scrollToIndex(position)
    }
    window.addEventListener(props.focusEvent, handler as EventListener)
    onCleanup(() => window.removeEventListener(props.focusEvent!, handler as EventListener))
  })

  return (
    <div class="file-changes-view">
      <Show when={props.showHeading}>
        <div class="file-changes-view__heading oc-section-heading">
          <Icon name="file-document" class="file-changes-view__heading-icon" />
          <span>{t("section.files")}</span>
        </div>
      </Show>
      <Show when={reviewFocusFailure()?.target.taskID === props.scopeKey}>
        <p class="empty-hint" role="alert">
          {t("files.focus_unavailable", { file: reviewFocusFailure()!.target.filePath })}
        </p>
      </Show>
      <Show when={files().length > 0}>
        <div class="changes-summary">
          <span>{tc("files.changed", files().length)}</span>
          <span class="changes-total">
            <Show when={summaryCommitRef()}>
              <span class="changes-commit" title={`commit ${summaryCommitRef()}`}>
                commit {shortCommit(summaryCommitRef())}
              </span>
            </Show>
            <span data-tone="add">+{summary().additions}</span>
            <span data-tone="del">-{summary().deletions}</span>
          </span>
        </div>

        <div class="changes-review-workspace">
          <section class="changes-diff-pane" aria-label={t("workspace.diff")}>
            <DiffPreviewPanel target={selectedDiffTarget()} scopeKey={props.scopeKey || ""} groups={groups()} />
          </section>

          <aside class="changes-file-pane" aria-label={t("section.files")}>
            <Show when={shouldShowFilter()}>
              <div class="changes-toolbar">
                <SearchField
                  class="changes-filter-field"
                  inputRef={(element) => {
                    filterInputEl = element
                  }}
                  inputDataUI="file-changes-search-input"
                  value={filterQuery()}
                  placeholder={t("files.filter_placeholder")}
                  onValueChange={setFilterQuery}
                  onKeyDown={onFilterKeyDown}
                  onClear={() => filterInputEl?.focus()}
                  clearLabel={t("files.clear_filter")}
                  clearDataUI="file-changes-search-clear"
                />
              </div>
            </Show>

            <Show when={allRows().length > 0}>
              <div class="changes-status-strip">
                <div class="changes-status-filter-group">
                  <SegmentedControl<ChangeStatusFilter>
                    options={statusFilterOptions()}
                    value={statusFilter()}
                    onChange={setStatusFilter}
                    onActivate={setStatusFilter}
                    ariaLabel={t("files.status_filter_label")}
                    class="changes-status-filter"
                    itemAttributes={(option) => ({
                      "data-ui": "file-changes-status-filter-option",
                      "data-status": option.value,
                      "data-size": "sm",
                    })}
                  />
                </div>
                <Checkbox
                  class="changes-non-text-filter"
                  data-ui="file-changes-non-text-filter"
                  checked={hideNonTextFiles()}
                  onChange={setHideNonTextFiles}
                >
                  {t("files.hide_non_text")}
                </Checkbox>
              </div>
            </Show>

            <ListboxRoot<ChangeRowModel>
              ref={listEl}
              class="changes-list"
              density="default"
              data-grouped={hasGroupLabels() ? "true" : "false"}
              data-virtualized={shouldVirtualizeRows() ? "true" : "false"}
              aria-label={t("section.files")}
              options={filteredRows()}
              optionValue={(row) => row.key}
              optionTextValue={(row) => row.searchText}
              value={selectedKeys()}
              onChange={(keys) => setSelectedRowKey([...keys][0] ?? "")}
              disallowEmptySelection={filteredRows().length > 0}
              virtualized
              scrollToItem={scrollToSelectedItem}
              onKeyDown={onListShortcutKeyDown}
            >
              {(collection) => {
                const nodeByKey = createMemo(() => {
                  const map = new Map<string, ChangeRowCollectionNode>()
                  for (const node of collection()) {
                    if (node.type === "item") map.set(node.key, node as ChangeRowCollectionNode)
                  }
                  return map
                })
                const nodeForRow = (row: ChangeRowModel): ChangeRowCollectionNode => {
                  const node = nodeByKey().get(row.key)
                  if (!node) throw new Error(`missing file change row node: ${row.key}`)
                  return node
                }

                return (
                  <Show
                    when={filteredRows().length > 0}
                    fallback={<p class="empty-hint changes-empty-hint">{t("files.no_matches")}</p>}
                  >
                    <Show
                      when={shouldVirtualizeRows()}
                      fallback={
                        <For each={visibleGroups()}>
                          {(entry) => (
                            <div class="changes-list-group" data-group-id={entry.group.id}>
                              <Show when={hasGroupLabels()}>
                                <div class="changes-group-header oc-section-heading" title={entry.title}>
                                  <span class="changes-group-label">{entry.label}</span>
                                  <span class="changes-group-meta">
                                    <Show when={entry.group.commitRef}>
                                      <span class="changes-group-commit">{shortCommit(entry.group.commitRef)}</span>
                                    </Show>
                                    <span>{entry.rows.length}</span>
                                  </span>
                                </div>
                              </Show>
                              <div class="changes-list-chunk" data-group-id={entry.group.id} data-active="true">
                                <For each={entry.rows}>
                                  {(row) => (
                                    <ChangeRow
                                      node={nodeForRow(row)}
                                      row={row}
                                      showScope={false}
                                      onSelect={selectRow}
                                    />
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      }
                    >
                      <Virtualizer
                        ref={(handle) => {
                          rowVirtualizer = handle
                        }}
                        data={filteredRows()}
                        bufferSize={VIRTUAL_CHANGE_ROW_BUFFER_PIXELS}
                        itemSize={ESTIMATED_CHANGE_ROW_HEIGHT}
                        as={ChangesVirtualWindow}
                        item={ChangesVirtualItem}
                      >
                        {(row) => (
                          <ChangeRow
                            node={nodeForRow(row)}
                            row={row}
                            showScope={hasGroupLabels()}
                            onSelect={selectRow}
                          />
                        )}
                      </Virtualizer>
                    </Show>
                  </Show>
                )
              }}
            </ListboxRoot>
          </aside>
        </div>
      </Show>
      <Show when={files().length === 0}>
        <p class="empty-hint">{props.hasSelectedTask ? t("files.none") : t("files.select_target")}</p>
      </Show>
    </div>
  )
}
