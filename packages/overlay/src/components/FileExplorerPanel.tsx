import {
  createDeferred,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  untrack,
  type Accessor,
} from "solid-js"
import { ContextMenu } from "./ui/ContextMenu"
import { Virtualizer, type CustomContainerComponentProps, type CustomItemComponentProps } from "virtua/solid"
import { apiJson } from "../services/api"
import { showAppDialog } from "../services/app-dialog"
import {
  closeFileEditorIfDeleted,
  copyFileItem,
  createFileItem,
  deleteFileItem,
  loadFileDirectory,
  moveFileItem,
  openFileEditor,
  selectedFileTarget,
  updateOpenFilePathAfterMove,
  uploadDroppedFiles,
  type FileCopyResult,
  type FileMoveResult,
  type FileNode,
  type FileOperationScope,
} from "../services/file-workbench"
import { currentUIScale } from "../utils/layout-tokens"
import { t, tc } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { SearchField } from "./ui/SearchField"
import { FileRowContent } from "./ui/FileRow"
import { SurfaceHeader } from "./ui/SurfaceHeader"

const VIRTUAL_EXPLORER_ROW_THRESHOLD = 120
const FILE_EXPLORER_ROW_HEIGHT_PX = 32
const FILE_EXPLORER_ROW_INDENT_PX = 16
const FILE_EXPLORER_ROW_CHEVRON_WIDTH_PX = 14
const FILE_EXPLORER_ROW_ICON_WIDTH_PX = 16
const FILE_EXPLORER_ROW_GAP_PX = 6
const FILE_EXPLORER_ROW_PADDING_START_PX = 8
const FILE_EXPLORER_ROW_PADDING_END_PX = 8
const SEARCH_LIMIT = 80
const INITIAL_DIRECTORY_LOAD_DELAY_MS = 250
const ACTIVE_DIRECTORY_REFRESH_INTERVAL_MS = 15_000
const EXPLORER_SELECTION_MIME = "application/x-opencorvus-explorer-selection"

type ExplorerRow =
  | { kind: "node"; key: string; node: FileNode; depth: number; expanded: boolean; loading: boolean; error: string }
  | { kind: "search"; key: string; path: string; depth: number }

type ExplorerSelection = {
  path: string
  name: string
  type: "file" | "directory"
}

type FileMutationKind = "create-file" | "create-directory" | "rename" | "copy" | "move" | "delete" | "refresh" | ""
type FileMutationOperation = {
  token: number
  kind: FileMutationKind
  directory: string
}
type ExplorerDropStatus = "move" | "upload" | "invalid"

export interface FileExplorerPanelProps {
  active?: Accessor<boolean>
  directory?: Accessor<string>
}

function ExplorerVirtualWindow(props: CustomContainerComponentProps) {
  const setRef = (node: HTMLDivElement) => {
    if (typeof props.ref === "function") props.ref(node)
  }
  return (
    <div ref={setRef} class="file-explorer-virtual-window" style={props.style}>
      {props.children}
    </div>
  )
}

function ExplorerVirtualItem(props: CustomItemComponentProps) {
  const setRef = (node: HTMLDivElement) => {
    if (typeof props.ref === "function") props.ref(node)
  }
  return (
    <div ref={setRef} class="file-explorer-virtual-item" style={props.style}>
      {props.children}
    </div>
  )
}

function normalizeExplorerPath(path: string): string {
  return String(path || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/")
}

function joinExplorerPath(parent: string, child: string): string {
  const normalizedParent = normalizeExplorerPath(parent)
  const normalizedChild = normalizeExplorerPath(child)
  return [normalizedParent, normalizedChild].filter(Boolean).join("/")
}

function parentPath(path: string): string {
  const parts = normalizeExplorerPath(path).split("/").filter(Boolean)
  parts.pop()
  return parts.join("/")
}

function fileName(path: string): string {
  const parts = normalizeExplorerPath(path).split("/").filter(Boolean)
  return parts.at(-1) || path
}

function copyNameSuggestion(path: string): string {
  const name = fileName(path)
  const extensionStart = name.lastIndexOf(".")
  if (extensionStart > 0 && extensionStart < name.length - 1) {
    return `${name.slice(0, extensionStart)}-copy${name.slice(extensionStart)}`
  }
  return `${name}-copy`
}

function dirname(path: string): string {
  return parentPath(path)
}

function isPathOrDescendant(path: string, root: string): boolean {
  const normalizedPath = normalizeExplorerPath(path)
  const normalizedRoot = normalizeExplorerPath(root)
  if (!normalizedRoot) return normalizedPath.length > 0
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
}

function replacePathPrefix(path: string, previousPath: string, nextPath: string): string {
  const normalizedPath = normalizeExplorerPath(path)
  const normalizedPrevious = normalizeExplorerPath(previousPath)
  const normalizedNext = normalizeExplorerPath(nextPath)
  if (normalizedPath === normalizedPrevious) return normalizedNext
  const suffix = normalizedPath.slice(normalizedPrevious.length).replace(/^\/+/, "")
  return joinExplorerPath(normalizedNext, suffix)
}

function selectionFromNode(node: FileNode): ExplorerSelection {
  return {
    path: normalizeExplorerPath(node.path),
    name: node.name,
    type: node.type,
  }
}

function selectionFromFilePath(path: string): ExplorerSelection {
  return {
    path: normalizeExplorerPath(path),
    name: fileName(path),
    type: "file",
  }
}

function selectionFromRow(row: ExplorerRow): ExplorerSelection {
  return row.kind === "search" ? selectionFromFilePath(row.path) : selectionFromNode(row.node)
}

function scaledExplorerRowHeight(): number {
  return FILE_EXPLORER_ROW_HEIGHT_PX * currentUIScale()
}

function dragHasFiles(event: DragEvent): boolean {
  const transfer = event.dataTransfer
  if (!transfer) return false
  if (transfer.files.length > 0) return true
  return Array.from(transfer.items ?? []).some((item) => item.kind === "file")
}

function dataTransferFiles(dataTransfer: DataTransfer | null): File[] {
  return Array.from(dataTransfer?.files ?? [])
}

function FileExplorerContextMenuItem(props: {
  dataUi: string
  label: string
  detail?: string
  tone?: "neutral" | "danger"
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <ContextMenu.Item
      as="button"
      type="button"
      class="file-explorer-menu-item"
      data-ui={props.dataUi}
      data-tone={props.tone ?? "neutral"}
      title={props.detail ? `${props.label} - ${props.detail}` : props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onSelect={props.onSelect}
    >
      <span class="file-explorer-menu-item-label">{props.label}</span>
      <Show when={props.detail}>
        <span class="file-explorer-menu-item-detail">{props.detail}</span>
      </Show>
    </ContextMenu.Item>
  )
}

async function searchFiles(query: string, scope: FileOperationScope): Promise<string[]> {
  const directory = scope.directory.trim()
  if (!directory) throw new Error("searchFiles: directory is required")
  const params = new URLSearchParams({
    query,
    type: "file",
    limit: String(SEARCH_LIMIT),
    directory,
  })
  return (await apiJson(`find/file?${params.toString()}`)) as string[]
}

export function FileExplorerPanel(props: FileExplorerPanelProps = {}) {
  const [query, setQuery] = createSignal("")
  const deferredQuery = createDeferred(() => query().trim())
  const [expandedPaths, setExpandedPaths] = createSignal(new Set<string>([""]))
  const [childrenByPath, setChildrenByPath] = createSignal(new Map<string, FileNode[]>())
  const [loadingPaths, setLoadingPaths] = createSignal(new Set<string>())
  const [directoryErrors, setDirectoryErrors] = createSignal(new Map<string, string>())
  const [uploadOperation, setUploadOperation] = createSignal<{ token: number; directory: string } | null>(null)
  const [uploadMessage, setUploadMessage] = createSignal("")
  const [uploadMessageStatus, setUploadMessageStatus] = createSignal<"active" | "error">("active")
  const [selectedItems, setSelectedItems] = createSignal(new Map<string, ExplorerSelection>())
  const [selectionAnchorPath, setSelectionAnchorPath] = createSignal("")
  const [draggedItems, setDraggedItems] = createSignal<ExplorerSelection[]>([])
  const [dropTargetPath, setDropTargetPath] = createSignal<string | null>(null)
  const [dropTargetRowPath, setDropTargetRowPath] = createSignal<string | null>(null)
  const [dropStatus, setDropStatus] = createSignal<ExplorerDropStatus>("move")
  const [mutationOperation, setMutationOperation] = createSignal<FileMutationOperation | null>(null)
  const [mutationMessage, setMutationMessage] = createSignal("")
  const [mutationMessageStatus, setMutationMessageStatus] = createSignal<"active" | "error">("active")
  const [searchErrorMessage, setSearchErrorMessage] = createSignal("")
  const active = createMemo(() => props.active?.() ?? true)
  const directory = createMemo(() => (props.directory ? props.directory().trim() : ""))
  const uploading = createMemo(() => uploadOperation()?.directory === directory())
  let directoryLoadSequence = 0
  let uploadOperationSequence = 0
  let mutationOperationSequence = 0
  let uploadInputRef: HTMLInputElement | undefined
  let uploadInputTargetDir = ""
  let uploadInputScope: FileOperationScope | null = null
  const directoryLoadTokens = new Map<string, number>()
  const requiredDirectoryLoadTokens = new Map<string, number>()

  createEffect(
    on(
      directory,
      () => {
        setQuery("")
        setExpandedPaths(new Set([""]))
        setMutationOperation(null)
        setMutationMessage("")
        setMutationMessageStatus("active")
        setSearchErrorMessage("")
        mutationOperationSequence += 1
      },
      { defer: true },
    ),
  )

  function currentOperationScope(): FileOperationScope | null {
    const projectDirectory = directory().trim()
    return projectDirectory ? { directory: projectDirectory } : null
  }

  function ownsExplorerOperation(scope: FileOperationScope): boolean {
    return directory().trim() === scope.directory.trim()
  }

  const loadDirectory = async (path: string, opts?: { force?: boolean; required?: boolean }) => {
    const normalizedPath = normalizeExplorerPath(path)
    if (!opts?.force && (childrenByPath().has(normalizedPath) || loadingPaths().has(normalizedPath))) return
    if (!opts?.required && requiredDirectoryLoadTokens.has(normalizedPath)) return
    const token = ++directoryLoadSequence
    const tokenMap = opts?.required ? requiredDirectoryLoadTokens : directoryLoadTokens
    if (opts?.required) directoryLoadTokens.delete(normalizedPath)
    tokenMap.set(normalizedPath, token)
    const ownsLoad = () => tokenMap.get(normalizedPath) === token
    const scope = currentOperationScope()
    if (!scope) return
    setLoadingPaths((prev) => new Set(prev).add(normalizedPath))
    setDirectoryErrors((prev) => {
      const next = new Map(prev)
      next.delete(normalizedPath)
      return next
    })
    try {
      const nodes = await loadFileDirectory(normalizedPath, scope)
      if (!ownsLoad() || !ownsExplorerOperation(scope)) return
      setChildrenByPath((prev) => {
        const next = new Map(prev)
        next.set(
          normalizedPath,
          nodes.map((node) => ({
            ...node,
            path: normalizeExplorerPath(node.path),
          })),
        )
        return next
      })
    } catch (error) {
      if (!ownsLoad() || !ownsExplorerOperation(scope)) return
      if (!opts?.required) console.error("[file-explorer] list failed", normalizedPath, error)
      const message = error instanceof Error ? error.message : String(error)
      setDirectoryErrors((prev) => {
        const next = new Map(prev)
        next.set(normalizedPath, message)
        return next
      })
      if (opts?.required) throw error
    } finally {
      if (!ownsLoad() || !ownsExplorerOperation(scope)) return
      tokenMap.delete(normalizedPath)
      setLoadingPaths((prev) => {
        const next = new Set(prev)
        next.delete(normalizedPath)
        return next
      })
    }
  }

  createEffect(() => {
    const currentDirectory = directory()
    if (!active() || !currentDirectory) return
    setChildrenByPath(new Map())
    setLoadingPaths(new Set<string>())
    setDirectoryErrors(new Map())
    setSelectedItems(new Map())
    setSelectionAnchorPath("")
    clearExplorerDrag()
    uploadInputTargetDir = ""
    uploadInputScope = null
    setUploadOperation(null)
    setUploadMessage("")
    directoryLoadSequence += 1
    directoryLoadTokens.clear()
    requiredDirectoryLoadTokens.clear()
    const timer = window.setTimeout(() => void loadDirectory(""), INITIAL_DIRECTORY_LOAD_DELAY_MS)
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const currentDirectory = directory()
    if (!active() || !currentDirectory) return
    const interval = window.setInterval(() => {
      const paths = new Set(["", ...expandedPaths()])
      for (const path of paths) {
        if (path === "" || childrenByPath().has(path) || directoryErrors().has(path)) {
          void loadDirectory(path, { force: true })
        }
      }
    }, ACTIVE_DIRECTORY_REFRESH_INTERVAL_MS)
    onCleanup(() => window.clearInterval(interval))
  })

  createEffect(() => {
    const currentDirectory = directory()
    if (!active() || !currentDirectory) return
    const selectedTarget = selectedFileTarget()
    if (!selectedTarget || selectedTarget.directory !== currentDirectory) return
    const selected = selectedTarget.path
    setSingleSelection(selectionFromFilePath(selected))
    const ancestors: string[] = []
    let current = parentPath(selected)
    while (current) {
      ancestors.unshift(current)
      current = parentPath(current)
    }
    setExpandedPaths((prev) => new Set([...prev, "", ...ancestors]))
    untrack(() => {
      for (const path of ["", ...ancestors]) void loadDirectory(path)
    })
  })

  const [searchResults, { refetch: refetchSearch }] = createResource(
    () => {
      const currentDirectory = directory()
      if (!active() || !currentDirectory) return undefined
      return { query: deferredQuery(), directory: currentDirectory }
    },
    async (source) => {
      if (!source.query) {
        setSearchErrorMessage("")
        return { query: source.query, paths: [] }
      }
      const scope = currentOperationScope()
      if (!scope) return { query: source.query, paths: [] }
      try {
        const results = await searchFiles(source.query, scope)
        if (!ownsExplorerOperation(scope)) return { query: source.query, paths: [] }
        setSearchErrorMessage("")
        return { query: source.query, paths: results }
      } catch (error) {
        if (!ownsExplorerOperation(scope)) return { query: source.query, paths: [] }
        setSearchErrorMessage(error instanceof Error ? error.message : String(error))
        return { query: source.query, paths: [] }
      }
    },
  )

  const rows = createMemo<ExplorerRow[]>(() => {
    const search = deferredQuery()
    if (search) {
      const current = searchResults()
      const latest = searchResults.latest
      const resolved = current?.query === search ? current : latest?.query === search ? latest : undefined
      return (resolved?.paths ?? []).map((path) => ({
        kind: "search",
        key: `search:${path}`,
        path,
        depth: 0,
      }))
    }

    const expanded = expandedPaths()
    const children = childrenByPath()
    const loading = loadingPaths()
    const errors = directoryErrors()
    const output: ExplorerRow[] = []
    const pushChildren = (path: string, depth: number) => {
      for (const node of children.get(path) ?? []) {
        const nodeExpanded = node.type === "directory" && expanded.has(node.path)
        output.push({
          kind: "node",
          key: `node:${node.path}`,
          node,
          depth,
          expanded: nodeExpanded,
          loading: loading.has(node.path),
          error: errors.get(node.path) ?? "",
        })
        if (nodeExpanded) pushChildren(node.path, depth + 1)
      }
    }
    pushChildren("", 0)
    return output
  })

  const shouldVirtualize = createMemo(() => rows().length > VIRTUAL_EXPLORER_ROW_THRESHOLD)
  const explorerRowItemSize = () => scaledExplorerRowHeight()
  const rootLoading = createMemo(() => !deferredQuery() && loadingPaths().has("") && !childrenByPath().has(""))
  const searchLoading = createMemo(() => {
    const query = deferredQuery()
    if (!query || !searchResults.loading) return false
    const current = searchResults()
    return current?.query !== query && searchResults.latest?.query !== query
  })
  const rootError = createMemo(() => (!deferredQuery() ? (directoryErrors().get("") ?? "") : ""))
  const searchError = createMemo(() => (deferredQuery() ? searchErrorMessage() : ""))
  const explorerPanelStyle = () => ({
    "--file-explorer-row-height": `calc(${FILE_EXPLORER_ROW_HEIGHT_PX}px * var(--ui-scale))`,
    "--file-explorer-row-indent": `calc(${FILE_EXPLORER_ROW_INDENT_PX}px * var(--ui-scale))`,
    "--file-explorer-row-chevron-width": `calc(${FILE_EXPLORER_ROW_CHEVRON_WIDTH_PX}px * var(--ui-scale))`,
    "--file-explorer-row-icon-width": `calc(${FILE_EXPLORER_ROW_ICON_WIDTH_PX}px * var(--ui-scale))`,
    "--file-explorer-row-gap": `calc(${FILE_EXPLORER_ROW_GAP_PX}px * var(--ui-scale))`,
    "--file-explorer-row-padding-start": `calc(${FILE_EXPLORER_ROW_PADDING_START_PX}px * var(--ui-scale))`,
    "--file-explorer-row-padding-end": `calc(${FILE_EXPLORER_ROW_PADDING_END_PX}px * var(--ui-scale))`,
  })
  const selectedItemList = createMemo(() => Array.from(selectedItems().values()))
  const selectedItemPathSet = createMemo(() => new Set(selectedItems().keys()))
  const currentFilePath = createMemo(() => {
    const target = selectedFileTarget()
    return target && target.directory === directory() ? normalizeExplorerPath(target.path) : ""
  })
  const commandBusy = createMemo(() => mutationOperation()?.directory === directory())

  function uniquePaths(paths: string[]): string[] {
    return [...new Set(paths.map(normalizeExplorerPath))]
  }

  function mutationErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function setMutationSuccess(message: string): void {
    setMutationMessageStatus("active")
    setMutationMessage(message)
  }

  function setMutationError(message: string): void {
    setMutationMessageStatus("error")
    setMutationMessage(message)
  }

  function setSingleSelection(item: ExplorerSelection): void {
    setSelectedItems(new Map([[item.path, item]]))
    setSelectionAnchorPath(item.path)
  }

  function clearSelection(): void {
    setSelectedItems(new Map())
    setSelectionAnchorPath("")
  }

  function isSelected(item: ExplorerSelection): boolean {
    return selectedItemPathSet().has(item.path)
  }

  function visibleSelections(): ExplorerSelection[] {
    return rows().map(selectionFromRow)
  }

  function selectRangeTo(item: ExplorerSelection): void {
    const visible = visibleSelections()
    const targetIndex = visible.findIndex((entry) => entry.path === item.path)
    const anchor = selectionAnchorPath() || item.path
    const anchorIndex = visible.findIndex((entry) => entry.path === anchor)
    if (targetIndex < 0 || anchorIndex < 0) {
      setSingleSelection(item)
      return
    }
    const start = Math.min(anchorIndex, targetIndex)
    const end = Math.max(anchorIndex, targetIndex)
    setSelectedItems(new Map(visible.slice(start, end + 1).map((entry) => [entry.path, entry])))
  }

  function toggleSelection(item: ExplorerSelection): void {
    setSelectedItems((prev) => {
      const next = new Map(prev)
      if (next.has(item.path)) next.delete(item.path)
      else next.set(item.path, item)
      return next
    })
    setSelectionAnchorPath(item.path)
  }

  function handleRowClick(event: MouseEvent, item: ExplorerSelection, activate: () => void): void {
    if (event.shiftKey) {
      event.preventDefault()
      selectRangeTo(item)
      return
    }
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      toggleSelection(item)
      return
    }
    setSingleSelection(item)
    activate()
  }

  function prepareContextSelection(item: ExplorerSelection): void {
    if (selectedItemPathSet().has(item.path)) return
    setSingleSelection(item)
  }

  function contextSelectionFor(item: ExplorerSelection): ExplorerSelection[] {
    return selectedItemPathSet().has(item.path) ? selectedItemList() : [item]
  }

  function contextSelectionDetail(items: ExplorerSelection[]): string | undefined {
    return items.length > 1 ? t("explorer.selected_count", { count: items.length }) : undefined
  }

  function topLevelActionSelections(items: ExplorerSelection[]): ExplorerSelection[] {
    const unique = Array.from(new Map(items.map((item) => [item.path, item])).values())
    return unique.filter(
      (item) =>
        !unique.some((candidate) => candidate.path !== item.path && isPathOrDescendant(item.path, candidate.path)),
    )
  }

  function contextTargetDirectory(item: ExplorerSelection | null): string {
    if (item?.type === "directory") return item.path
    if (item?.type === "file") return parentPath(item.path)
    return ""
  }

  function clearExplorerDrag(): void {
    setDraggedItems([])
    setDropTargetPath(null)
    setDropTargetRowPath(null)
    setDropStatus("move")
  }

  function canPlaceSelectionsInDirectory(items: ExplorerSelection[], targetDirInput: string): boolean {
    const targetDir = normalizeExplorerPath(targetDirInput)
    return !topLevelActionSelections(items).some(
      (item) => item.type === "directory" && (targetDir === item.path || isPathOrDescendant(targetDir, item.path)),
    )
  }

  function dragTargetStatus(event: DragEvent, targetDir: string): ExplorerDropStatus | null {
    if (dragHasFiles(event)) return "upload"
    const items = draggedItems()
    if (items.length === 0 && !Array.from(event.dataTransfer?.types ?? []).includes(EXPLORER_SELECTION_MIME))
      return null
    return canPlaceSelectionsInDirectory(items, targetDir) ? "move" : "invalid"
  }

  function beginExplorerRowDrag(event: DragEvent, item: ExplorerSelection): void {
    if (commandBusy()) {
      event.preventDefault()
      return
    }
    const targets = topLevelActionSelections(contextSelectionFor(item))
    if (!isSelected(item)) setSingleSelection(item)
    const dragTargets = targets.length > 0 ? targets : [item]
    setDraggedItems(dragTargets)
    event.dataTransfer?.setData(EXPLORER_SELECTION_MIME, JSON.stringify(dragTargets.map((entry) => entry.path)))
    event.dataTransfer?.setData("text/plain", dragTargets.map((entry) => entry.path).join("\n"))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  }

  function updateExplorerDropTarget(event: DragEvent, targetDirInput: string, rowPath?: string): void {
    const targetDir = normalizeExplorerPath(targetDirInput)
    const status = dragTargetStatus(event, targetDir)
    if (!status) return
    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = status === "upload" ? "copy" : status === "move" ? "move" : "none"
    setDropTargetPath(targetDir)
    setDropTargetRowPath(rowPath ? normalizeExplorerPath(rowPath) : null)
    setDropStatus(status)
  }

  async function moveSelectionsToDirectory(items: ExplorerSelection[], targetDirInput: string): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const targetDir = normalizeExplorerPath(targetDirInput)
    const targets = topLevelActionSelections(items)
    if (!canPlaceSelectionsInDirectory(targets, targetDir)) {
      setMutationError(t("explorer.drop_move_invalid"))
      return
    }
    await runMutation("move", scope, async () => {
      const moved: FileMoveResult[] = []
      for (const item of targets) {
        const nextPath = joinExplorerPath(targetDir, item.name)
        if (nextPath === item.path) continue
        moved.push(await moveFileItem(item.path, nextPath, scope))
      }
      if (moved.length === 0) return
      const message =
        moved.length === 1
          ? t("explorer.move_success", { path: moved[0]?.path ?? "" })
          : t("explorer.move_many_success", { count: moved.length, target: targetDir || "." })
      await applyMoveResults(moved, message, scope)
    })
  }

  async function handleExplorerDrop(event: DragEvent, targetDirInput: string): Promise<void> {
    const targetDir = normalizeExplorerPath(targetDirInput)
    const status = dragTargetStatus(event, targetDir)
    if (!status) return
    event.preventDefault()
    event.stopPropagation()
    try {
      if (status === "upload") {
        await uploadFiles(targetDir, dataTransferFiles(event.dataTransfer))
        return
      }
      if (status === "invalid") {
        setMutationError(t("explorer.drop_move_invalid"))
        return
      }
      await moveSelectionsToDirectory(draggedItems(), targetDir)
    } finally {
      clearExplorerDrag()
    }
  }

  function openExplorerFile(path: string): void {
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    if (!ownsExplorerOperation(scope)) return
    void openFileEditor(path, scope)
  }

  async function runMutation(
    kind: FileMutationKind,
    scope: FileOperationScope,
    fn: () => Promise<void>,
  ): Promise<void> {
    if (commandBusy()) return
    const token = ++mutationOperationSequence
    setMutationOperation({ token, kind, directory: scope.directory.trim() })
    setMutationMessage("")
    const ownsMutationOperation = () => mutationOperation()?.token === token
    try {
      await fn()
    } catch (error) {
      if (ownsMutationOperation() && ownsExplorerOperation(scope)) setMutationError(mutationErrorMessage(error))
    } finally {
      if (ownsMutationOperation()) setMutationOperation(null)
    }
  }

  function clearDirectoryCaches(paths: string[], subtreeRoots: string[] = []): void {
    const normalizedPaths = uniquePaths(paths)
    const normalizedSubtreeRoots = uniquePaths(subtreeRoots).filter(Boolean)
    const keepEntry = (key: string) => {
      const normalizedKey = normalizeExplorerPath(key)
      if (normalizedPaths.includes(normalizedKey)) return false
      return !normalizedSubtreeRoots.some((root) => isPathOrDescendant(normalizedKey, root))
    }
    setChildrenByPath((prev) => {
      const next = new Map(prev)
      for (const key of prev.keys()) {
        if (!keepEntry(key)) next.delete(key)
      }
      return next
    })
    setDirectoryErrors((prev) => {
      const next = new Map(prev)
      for (const key of prev.keys()) {
        if (!keepEntry(key)) next.delete(key)
      }
      return next
    })
  }

  async function refreshDirectories(paths: string[]): Promise<void> {
    await Promise.all(uniquePaths(paths).map((path) => loadDirectory(path, { force: true, required: true })))
  }

  async function refreshActiveSearchResults(): Promise<void> {
    if (!deferredQuery()) return
    await refetchSearch()
  }

  async function refreshVisibleDirectories(): Promise<void> {
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    await runMutation("refresh", scope, async () => {
      await refreshDirectories(["", ...expandedPaths()])
      if (!ownsExplorerOperation(scope)) return
      await refreshActiveSearchResults()
      if (!ownsExplorerOperation(scope)) return
      setMutationSuccess(t("explorer.refresh_success"))
    })
  }

  async function retryRootDirectory(): Promise<void> {
    setMutationMessage("")
    await loadDirectory("", { force: true })
  }

  function updateExpandedPathsAfterMove(previousPath: string, nextPath: string): void {
    const normalizedPrevious = normalizeExplorerPath(previousPath)
    const normalizedNext = normalizeExplorerPath(nextPath)
    setExpandedPaths((prev) => {
      const next = new Set<string>()
      for (const path of prev) {
        if (path === normalizedPrevious || isPathOrDescendant(path, normalizedPrevious)) {
          next.add(replacePathPrefix(path, normalizedPrevious, normalizedNext))
        } else {
          next.add(path)
        }
      }
      next.add(parentPath(normalizedNext))
      return next
    })
  }

  async function applyMoveResults(
    results: FileMoveResult[],
    message: string,
    scope: FileOperationScope,
  ): Promise<void> {
    if (!ownsExplorerOperation(scope)) return
    const refreshTargets: string[] = []
    const cacheTargets: string[] = []
    const subtreeTargets: string[] = []
    const nextSelection = new Map<string, ExplorerSelection>()
    for (const result of results) {
      const normalizedPrevious = normalizeExplorerPath(result.previousPath)
      const normalizedNext = normalizeExplorerPath(result.path)
      const previousParent = parentPath(normalizedPrevious)
      const nextParent = parentPath(normalizedNext)
      updateExpandedPathsAfterMove(normalizedPrevious, normalizedNext)
      updateOpenFilePathAfterMove(normalizedPrevious, normalizedNext, scope)
      refreshTargets.push(previousParent, nextParent, result.node.type === "directory" ? normalizedNext : "")
      cacheTargets.push(previousParent, nextParent, normalizedPrevious, normalizedNext)
      subtreeTargets.push(normalizedPrevious)
      const selection = selectionFromNode(result.node)
      nextSelection.set(selection.path, selection)
    }
    clearDirectoryCaches(cacheTargets, subtreeTargets)
    setSelectedItems(nextSelection)
    setSelectionAnchorPath(results.at(-1)?.path ?? "")
    await refreshDirectories(refreshTargets)
    if (!ownsExplorerOperation(scope)) return
    await refreshActiveSearchResults()
    if (!ownsExplorerOperation(scope)) return
    setMutationSuccess(message)
  }

  async function applyCopyResults(
    results: FileCopyResult[],
    message: string,
    scope: FileOperationScope,
  ): Promise<void> {
    if (!ownsExplorerOperation(scope)) return
    const refreshTargets: string[] = []
    const cacheTargets: string[] = []
    const nextSelection = new Map<string, ExplorerSelection>()
    const expandedParents = new Set<string>()
    for (const result of results) {
      const normalizedSource = normalizeExplorerPath(result.sourcePath)
      const normalizedNext = normalizeExplorerPath(result.path)
      const sourceParent = parentPath(normalizedSource)
      const nextParent = parentPath(normalizedNext)
      refreshTargets.push(sourceParent, nextParent)
      cacheTargets.push(sourceParent, nextParent, normalizedNext)
      expandedParents.add(nextParent)
      const selection = selectionFromNode(result.node)
      nextSelection.set(selection.path, selection)
    }
    setExpandedPaths((prev) => new Set([...prev, ...expandedParents]))
    clearDirectoryCaches(cacheTargets)
    setSelectedItems(nextSelection)
    setSelectionAnchorPath(results.at(-1)?.path ?? "")
    await refreshDirectories(refreshTargets)
    if (!ownsExplorerOperation(scope)) return
    await refreshActiveSearchResults()
    if (!ownsExplorerOperation(scope)) return
    setMutationSuccess(message)
  }

  async function createEntry(type: "file" | "directory", targetDirInput?: string): Promise<void> {
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const targetDir = normalizeExplorerPath(targetDirInput ?? contextTargetDirectory(selectedItemList()[0] ?? null))
    const result = await showAppDialog({
      kind: `file-${type}-create`,
      title: type === "file" ? t("explorer.new_file") : t("explorer.new_folder"),
      message: t("explorer.create_in", { target: targetDir || "." }),
      input: true,
      inputLabel: type === "file" ? t("explorer.file_name") : t("explorer.folder_name"),
      inputPlaceholder: type === "file" ? t("explorer.file_name_placeholder") : t("explorer.folder_name_placeholder"),
      okLabel: type === "file" ? t("explorer.create_file") : t("explorer.create_folder"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const name = String(result.value || "").trim()
    if (!name) {
      setMutationError(t("explorer.name_required"))
      return
    }
    await runMutation(type === "file" ? "create-file" : "create-directory", scope, async () => {
      const node = await createFileItem(
        {
          path: joinExplorerPath(targetDir, name),
          type,
          content: type === "file" ? "" : undefined,
        },
        scope,
      )
      if (!ownsExplorerOperation(scope)) return
      const parent = parentPath(node.path)
      setExpandedPaths((prev) => new Set([...prev, parent]))
      clearDirectoryCaches([parent])
      await refreshDirectories([parent])
      if (!ownsExplorerOperation(scope)) return
      await refreshActiveSearchResults()
      if (!ownsExplorerOperation(scope)) return
      setSingleSelection(selectionFromNode(node))
      if (type === "file") await openFileEditor(node.path, scope)
      setMutationSuccess(t("explorer.create_success", { path: node.path }))
    })
  }

  async function renameItem(item: ExplorerSelection | null): Promise<void> {
    if (!item) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-rename",
      title: t("explorer.rename"),
      message: t("explorer.rename_message", { path: item.path }),
      input: true,
      inputLabel: t("explorer.new_name"),
      inputValue: item.name,
      okLabel: t("explorer.rename"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const name = String(result.value || "").trim()
    if (!name) {
      setMutationError(t("explorer.name_required"))
      return
    }
    const nextPath = joinExplorerPath(parentPath(item.path), name)
    if (normalizeExplorerPath(nextPath) === item.path) return
    await runMutation("rename", scope, async () => {
      const result = await moveFileItem(item.path, nextPath, scope)
      await applyMoveResults([result], t("explorer.rename_success", { path: result.path }), scope)
    })
  }

  async function moveItem(item: ExplorerSelection | null): Promise<void> {
    if (!item) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-move",
      title: t("explorer.move"),
      message: t("explorer.move_message", { path: item.path }),
      input: true,
      inputLabel: t("explorer.destination_path"),
      inputValue: item.path,
      okLabel: t("explorer.move"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const nextPath = normalizeExplorerPath(String(result.value || "").trim())
    if (!nextPath) {
      setMutationError(t("explorer.name_required"))
      return
    }
    if (nextPath === item.path) return
    await runMutation("move", scope, async () => {
      const result = await moveFileItem(item.path, nextPath, scope)
      await applyMoveResults([result], t("explorer.move_success", { path: result.path }), scope)
    })
  }

  async function moveItems(items: ExplorerSelection[]): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    if (items.length === 1) {
      await moveItem(items[0] ?? null)
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-move-many",
      title: t("explorer.move"),
      message: t("explorer.move_many_message", { count: items.length }),
      input: true,
      inputLabel: t("explorer.destination_directory"),
      inputPlaceholder: "src",
      okLabel: t("explorer.move"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const targetDir = normalizeExplorerPath(String(result.value || "").trim())
    if (!targetDir) {
      setMutationError(t("explorer.name_required"))
      return
    }
    await moveSelectionsToDirectory(items, targetDir)
  }

  async function copySelectionsToDirectory(items: ExplorerSelection[], targetDirInput: string): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const targetDir = normalizeExplorerPath(targetDirInput)
    const targets = topLevelActionSelections(items)
    if (!canPlaceSelectionsInDirectory(targets, targetDir)) {
      setMutationError(t("explorer.copy_invalid"))
      return
    }
    await runMutation("copy", scope, async () => {
      const copied: FileCopyResult[] = []
      for (const item of targets) {
        const nextPath = joinExplorerPath(targetDir, item.name)
        copied.push(await copyFileItem(item.path, nextPath, scope))
      }
      const message =
        copied.length === 1
          ? t("explorer.copy_success", { path: copied[0]?.path ?? "" })
          : t("explorer.copy_many_success", { count: copied.length, target: targetDir || "." })
      await applyCopyResults(copied, message, scope)
    })
  }

  async function copyItem(item: ExplorerSelection | null): Promise<void> {
    if (!item) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-copy",
      title: t("explorer.copy"),
      message: t("explorer.copy_message", { path: item.path }),
      input: true,
      inputLabel: t("explorer.destination_path"),
      inputValue: joinExplorerPath(parentPath(item.path), copyNameSuggestion(item.path)),
      okLabel: t("explorer.copy"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const nextPath = normalizeExplorerPath(String(result.value || "").trim())
    if (!nextPath) {
      setMutationError(t("explorer.name_required"))
      return
    }
    if (item.type === "directory" && (nextPath === item.path || isPathOrDescendant(nextPath, item.path))) {
      setMutationError(t("explorer.copy_invalid"))
      return
    }
    await runMutation("copy", scope, async () => {
      const result = await copyFileItem(item.path, nextPath, scope)
      await applyCopyResults([result], t("explorer.copy_success", { path: result.path }), scope)
    })
  }

  async function copyItems(items: ExplorerSelection[]): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    if (items.length === 1) {
      await copyItem(items[0] ?? null)
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-copy-many",
      title: t("explorer.copy"),
      message: t("explorer.copy_many_message", { count: items.length }),
      input: true,
      inputLabel: t("explorer.destination_directory"),
      inputPlaceholder: "src",
      okLabel: t("explorer.copy"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    const targetDir = normalizeExplorerPath(String(result.value || "").trim())
    if (!targetDir) {
      setMutationError(t("explorer.name_required"))
      return
    }
    await copySelectionsToDirectory(items, targetDir)
  }

  async function deleteItems(items: ExplorerSelection[], capturedScope?: FileOperationScope): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = capturedScope ?? currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const targets = topLevelActionSelections(items)
    await runMutation("delete", scope, async () => {
      const deletedPaths: string[] = []
      for (const item of targets) {
        const deleted = await deleteFileItem(item.path, scope)
        deletedPaths.push(normalizeExplorerPath(deleted.path))
      }
      if (!ownsExplorerOperation(scope)) return
      const parents = deletedPaths.map(parentPath)
      for (const deletedPath of deletedPaths) closeFileEditorIfDeleted(deletedPath, scope)
      setExpandedPaths((prev) => {
        const next = new Set<string>()
        for (const path of prev) {
          if (!deletedPaths.some((deletedPath) => isPathOrDescendant(path, deletedPath))) next.add(path)
        }
        next.add("")
        return next
      })
      clearSelection()
      clearDirectoryCaches([...parents, ...deletedPaths], deletedPaths)
      await refreshDirectories(parents)
      if (!ownsExplorerOperation(scope)) return
      await refreshActiveSearchResults()
      if (!ownsExplorerOperation(scope)) return
      setMutationSuccess(
        deletedPaths.length === 1
          ? t("explorer.delete_success", { path: deletedPaths[0] ?? "" })
          : t("explorer.delete_many_success", { count: deletedPaths.length }),
      )
    })
  }

  async function confirmDeleteItems(items: ExplorerSelection[]): Promise<void> {
    if (items.length === 0) {
      setMutationError(t("explorer.select_required"))
      return
    }
    const scope = currentOperationScope()
    if (!scope) {
      setMutationError(t("explorer.directory_required"))
      return
    }
    const result = await showAppDialog({
      kind: "file-delete",
      title: t("explorer.delete"),
      message:
        items.length === 1
          ? t("explorer.delete_message", { path: items[0]?.path ?? "" })
          : t("explorer.delete_many_message", { count: items.length }),
      okLabel: t("explorer.confirm_delete"),
      cancel: true,
    })
    if (!result.confirmed) return
    if (!ownsExplorerOperation(scope)) return
    await deleteItems(items, scope)
  }

  const toggleDirectory = (path: string) => {
    const normalizedPath = normalizeExplorerPath(path)
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(normalizedPath)) next.delete(normalizedPath)
      else next.add(normalizedPath)
      return next
    })
    void loadDirectory(normalizedPath)
  }

  function openUploadPicker(targetDirInput: string): void {
    const scope = currentOperationScope()
    if (!scope) {
      setUploadMessageStatus("error")
      setUploadMessage(t("explorer.directory_required"))
      return
    }
    if (!uploadInputRef) throw new Error("file upload input is not mounted")
    uploadInputTargetDir = normalizeExplorerPath(targetDirInput)
    uploadInputScope = scope
    uploadInputRef.value = ""
    uploadInputRef.click()
  }

  async function uploadFiles(
    targetDirInput: string,
    files: File[],
    capturedScope?: FileOperationScope | null,
  ): Promise<void> {
    const scope = capturedScope ?? currentOperationScope()
    if (!scope) {
      setUploadMessageStatus("error")
      setUploadMessage(t("explorer.directory_required"))
      return
    }
    if (!ownsExplorerOperation(scope)) return
    const targetDir = normalizeExplorerPath(targetDirInput)
    if (files.length === 0) return
    const uploadToken = ++uploadOperationSequence
    const ownsUploadOperation = () => uploadOperation()?.token === uploadToken && ownsExplorerOperation(scope)
    setUploadOperation({ token: uploadToken, directory: scope.directory.trim() })
    setUploadMessageStatus("active")
    setUploadMessage(t("explorer.uploading"))
    try {
      const uploaded = await uploadDroppedFiles(targetDir, files, scope)
      if (!ownsUploadOperation()) return
      setExpandedPaths((prev) => new Set([...prev, targetDir]))
      try {
        await loadDirectory(targetDir, { force: true, required: true })
        if (!ownsUploadOperation()) return
      } catch (error) {
        if (!ownsUploadOperation()) return
        setUploadMessageStatus("error")
        setUploadMessage(
          t("explorer.upload_reload_error", { message: error instanceof Error ? error.message : String(error) }),
        )
        return
      }
      if (!ownsUploadOperation()) return
      setUploadMessageStatus("active")
      setUploadMessage(tc("explorer.upload_success", uploaded.length, { target: targetDir || "." }))
    } catch (error) {
      if (!ownsUploadOperation()) return
      setUploadMessageStatus("error")
      setUploadMessage(t("explorer.upload_error", { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      if (ownsUploadOperation()) {
        setUploadOperation(null)
      }
    }
  }

  async function handleUploadInputChange(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement
    const files = Array.from(input.files ?? [])
    const targetDir = uploadInputTargetDir
    const scope = uploadInputScope
    uploadInputTargetDir = ""
    uploadInputScope = null
    input.value = ""
    await uploadFiles(targetDir, files, scope)
  }

  function renderItemContextMenu(item: ExplorerSelection, options: { isDirectory: boolean; expanded?: boolean }) {
    const targets = () => contextSelectionFor(item)
    const hasMultipleTargets = () => targets().length > 1
    const targetDetail = () => contextSelectionDetail(targets())
    return (
      <ContextMenu.Portal>
        <ContextMenu.Content class="file-explorer-context-menu">
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-open"
            label={
              options.isDirectory
                ? options.expanded
                  ? t("explorer.collapse")
                  : t("explorer.expand")
                : t("explorer.open")
            }
            detail={targetDetail()}
            disabled={hasMultipleTargets() || commandBusy()}
            onSelect={() => {
              setSingleSelection(item)
              if (options.isDirectory) toggleDirectory(item.path)
              else openExplorerFile(item.path)
            }}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-upload"
            label={t("explorer.upload_files")}
            detail={targetDetail()}
            disabled={hasMultipleTargets() || commandBusy() || uploading()}
            onSelect={() => openUploadPicker(contextTargetDirectory(item))}
          />
          <Show when={options.isDirectory && !hasMultipleTargets()}>
            <FileExplorerContextMenuItem
              dataUi="file-explorer-context-new-file"
              label={t("explorer.new_file")}
              disabled={commandBusy()}
              onSelect={() => void createEntry("file", item.path)}
            />
            <FileExplorerContextMenuItem
              dataUi="file-explorer-context-new-folder"
              label={t("explorer.new_folder")}
              disabled={commandBusy()}
              onSelect={() => void createEntry("directory", item.path)}
            />
          </Show>
          <ContextMenu.Separator />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-rename"
            label={t("explorer.rename")}
            detail={targetDetail()}
            disabled={hasMultipleTargets() || commandBusy()}
            onSelect={() => void renameItem(targets()[0] ?? null)}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-copy"
            label={t("explorer.copy")}
            detail={targetDetail()}
            disabled={commandBusy()}
            onSelect={() => void copyItems(targets())}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-move"
            label={t("explorer.move")}
            detail={targetDetail()}
            disabled={commandBusy()}
            onSelect={() => void moveItems(targets())}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-delete"
            label={t("explorer.delete")}
            detail={targetDetail()}
            tone="danger"
            disabled={commandBusy()}
            onSelect={() => void confirmDeleteItems(targets())}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    )
  }

  function renderBackgroundContextMenu() {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Content class="file-explorer-context-menu" data-scope="root">
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-upload"
            label={t("explorer.upload_files")}
            disabled={commandBusy() || uploading()}
            onSelect={() => openUploadPicker("")}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-new-file"
            label={t("explorer.new_file")}
            disabled={commandBusy()}
            onSelect={() => void createEntry("file", "")}
          />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-new-folder"
            label={t("explorer.new_folder")}
            disabled={commandBusy()}
            onSelect={() => void createEntry("directory", "")}
          />
          <ContextMenu.Separator />
          <FileExplorerContextMenuItem
            dataUi="file-explorer-context-refresh"
            label={t("explorer.refresh")}
            disabled={commandBusy()}
            onSelect={() => void refreshVisibleDirectories()}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    )
  }

  const renderRow = (row: ExplorerRow) => {
    if (row.kind === "search") {
      const item = selectionFromFilePath(row.path)
      const isSearchRowSelected = () => isSelected(item)
      const isSearchRowCurrent = () => currentFilePath() === item.path
      const isSearchRowDragging = () => draggedItems().some((entry) => entry.path === item.path)
      const isSearchRowDropTarget = () => dropTargetRowPath() === item.path
      return (
        <ContextMenu.Root>
          <ContextMenu.Trigger
            as={Button}
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            class="oc-file-row file-explorer-row"
            data-ui="file-explorer-row"
            data-app-context-menu-trigger="true"
            data-kind="file"
            data-active={isSearchRowSelected() ? "true" : "false"}
            data-selected={isSearchRowSelected() ? "true" : "false"}
            data-dragging={isSearchRowDragging() ? "true" : undefined}
            data-drop-target={isSearchRowDropTarget() ? dropStatus() : undefined}
            aria-current={isSearchRowCurrent() ? "true" : undefined}
            draggable={!commandBusy()}
            style={{ "--file-explorer-row-depth": String(row.depth) }}
            title={row.path}
            onContextMenu={(event) => {
              event.stopPropagation()
              prepareContextSelection(item)
            }}
            onPointerDown={(event) => {
              if (event.button === 2) prepareContextSelection(item)
            }}
            onDragStart={(event) => beginExplorerRowDrag(event, item)}
            onDragEnd={clearExplorerDrag}
            onDragEnter={(event) => {
              event.stopPropagation()
              updateExplorerDropTarget(event, parentPath(item.path), item.path)
            }}
            onDragOver={(event) => {
              event.stopPropagation()
              updateExplorerDropTarget(event, parentPath(item.path), item.path)
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              if (dropTargetRowPath() === item.path) {
                setDropTargetPath(null)
                setDropTargetRowPath(null)
              }
            }}
            onDrop={(event) => void handleExplorerDrop(event, parentPath(item.path))}
            onClick={(event) => handleRowClick(event, item, () => openExplorerFile(item.path))}
          >
            <FileRowContent name={fileName(row.path)} icon="file-document" detail={dirname(row.path)} />
          </ContextMenu.Trigger>
          {renderItemContextMenu(item, { isDirectory: false })}
        </ContextMenu.Root>
      )
    }

    const node = row.node
    const isDirectory = node.type === "directory"
    const item = selectionFromNode(node)
    const isNodeSelected = () => isSelected(item)
    const isNodeCurrent = () => currentFilePath() === item.path
    const isNodeDragging = () => draggedItems().some((entry) => entry.path === item.path)
    const isNodeDropTarget = () => dropTargetRowPath() === item.path
    const rowDropDirectory = () => contextTargetDirectory(item)
    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger
          as={Button}
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          class="oc-file-row file-explorer-row"
          data-ui="file-explorer-row"
          data-app-context-menu-trigger="true"
          data-kind={node.type}
          data-active={isNodeSelected() ? "true" : "false"}
          data-selected={isNodeSelected() ? "true" : "false"}
          data-dragging={isNodeDragging() ? "true" : undefined}
          data-drop-target={isNodeDropTarget() ? dropStatus() : undefined}
          data-ignored={node.ignored ? "true" : "false"}
          aria-current={isNodeCurrent() ? "true" : undefined}
          aria-expanded={isDirectory ? row.expanded : undefined}
          draggable={!commandBusy()}
          style={{ "--file-explorer-row-depth": String(row.depth) }}
          title={node.path}
          onContextMenu={(event) => {
            event.stopPropagation()
            prepareContextSelection(item)
          }}
          onPointerDown={(event) => {
            if (event.button === 2) prepareContextSelection(item)
          }}
          onDragStart={(event) => beginExplorerRowDrag(event, item)}
          onDragEnd={clearExplorerDrag}
          onDragEnter={(event) => {
            event.stopPropagation()
            updateExplorerDropTarget(event, rowDropDirectory(), item.path)
          }}
          onDragOver={(event) => {
            event.stopPropagation()
            updateExplorerDropTarget(event, rowDropDirectory(), item.path)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            if (dropTargetRowPath() === item.path) {
              setDropTargetPath(null)
              setDropTargetRowPath(null)
            }
          }}
          onDrop={(event) => void handleExplorerDrop(event, rowDropDirectory())}
          onClick={(event) => {
            handleRowClick(event, item, () => {
              if (isDirectory) toggleDirectory(item.path)
              else openExplorerFile(item.path)
            })
          }}
        >
          <FileRowContent
            name={node.name}
            icon={isDirectory ? (row.expanded ? "folder-open" : "folder") : "file-document"}
            expandable={isDirectory}
            expanded={row.expanded}
            trailing={row.loading ? t("common.loading") : !row.loading && row.error ? t("common.error") : undefined}
          />
        </ContextMenu.Trigger>
        {renderItemContextMenu(item, { isDirectory, expanded: row.expanded })}
      </ContextMenu.Root>
    )
  }

  return (
    <section
      class="file-explorer-panel"
      aria-label={t("explorer.title")}
      data-uploading={uploading() ? "true" : "false"}
      style={explorerPanelStyle()}
    >
      <input
        ref={(node) => {
          uploadInputRef = node
        }}
        type="file"
        multiple
        class="file-explorer-upload-input"
        data-ui="file-explorer-upload-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void handleUploadInputChange(event)}
      />
      <SurfaceHeader
        variant="panel"
        data-ui="file-explorer-toolbar"
        actions={
          <SearchField
            class="file-explorer-search"
            value={query()}
            placeholder={t("explorer.search_placeholder")}
            onValueChange={setQuery}
            onClear={() => setQuery("")}
            clearDataUI="file-explorer-search-clear"
          />
        }
      />
      <Show when={uploadMessage()}>
        <div
          class="file-explorer-upload-message"
          data-status={uploadMessageStatus()}
          role={uploadMessageStatus() === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
        >
          {uploadMessage()}
        </div>
      </Show>
      <Show when={mutationMessage()}>
        <div
          class="file-explorer-command-message"
          data-status={mutationMessageStatus()}
          data-ui="file-explorer-command-message"
          role={mutationMessageStatus() === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
        >
          {mutationMessage()}
        </div>
      </Show>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          as="div"
          class="file-explorer-list"
          data-app-context-menu-trigger="true"
          data-drop-target={dropTargetPath() === "" && dropTargetRowPath() === null ? dropStatus() : undefined}
          data-virtualized={shouldVirtualize() ? "true" : "false"}
          data-searching={deferredQuery() ? "true" : "false"}
          onDragEnter={(event) => updateExplorerDropTarget(event, "")}
          onDragOver={(event) => updateExplorerDropTarget(event, "")}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setDropTargetPath(null)
            setDropTargetRowPath(null)
          }}
          onDrop={(event) => void handleExplorerDrop(event, "")}
        >
          <Show
            when={!rootLoading() && !searchLoading()}
            fallback={<p class="empty-hint file-explorer-empty">{t("common.loading")}</p>}
          >
            <Show
              when={!rootError() && !searchError()}
              fallback={
                <div class="empty-hint file-explorer-empty">
                  <p>{searchError() ? t("explorer.search_failed") : t("explorer.load_failed")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    tone="danger"
                    data-ui={searchError() ? "file-explorer-search-retry" : "file-explorer-retry"}
                    onClick={() => (searchError() ? void refetchSearch() : void retryRootDirectory())}
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              }
            >
              <Show
                when={rows().length > 0}
                fallback={
                  <p class="empty-hint file-explorer-empty">
                    {deferredQuery() ? t("explorer.no_matches") : t("explorer.empty")}
                  </p>
                }
              >
                <Show when={shouldVirtualize()} fallback={<For each={rows()}>{renderRow}</For>}>
                  <Virtualizer
                    data={rows()}
                    itemSize={explorerRowItemSize()}
                    bufferSize={explorerRowItemSize() * 12}
                    as={ExplorerVirtualWindow}
                    item={ExplorerVirtualItem}
                  >
                    {renderRow}
                  </Virtualizer>
                </Show>
              </Show>
            </Show>
          </Show>
        </ContextMenu.Trigger>
        {renderBackgroundContextMenu()}
      </ContextMenu.Root>
    </section>
  )
}
