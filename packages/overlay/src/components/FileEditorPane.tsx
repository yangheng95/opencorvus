import { batch, createEffect, createMemo, createSignal, lazy, Match, on, onCleanup, Show, Switch, untrack } from "solid-js"
import { base64ToUint8 } from "@opencorvus-ai/transport-protocol"
import { classifyEntryBasename } from "@opencorvus-ai/util/entry-basename"
import { ApiError, apiJson, apiRequest, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { showAppDialog } from "../services/app-dialog"
import {
  closeFileEditor,
  createFileItem,
  fileEditorDiskChangeRevision,
  fileEditorRevealRevision,
  fileEditorAdmissionPhase,
  fileEditorReserved,
  observeFileEditorDiskChange,
  registerFileEditorBeforeNavigate,
  requestFileExplorerFolder,
  requestOpenFileDiskCheck,
  returnToFileDocument,
  selectedFileTarget,
  type FileContent,
  type FileEditorTarget,
} from "../services/file-workbench"
import { projectScopedPath } from "../services/project-directory"
import { downloadBlob } from "../services/file-download"
import { activeDirectory } from "../services/workspace"
import { boardStore } from "../store/board"
import { localeTag, t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { restoreRightDockFocus } from "../utils/right-dock-focus"
import {
  classifyProjectPathInput,
  decodeMarkdownFilePath,
  filePathLabel,
  isAbsoluteServerPath,
  isWindowsPath,
  normalizeProjectFilePath,
  parentProjectPath,
  pathWithForwardSeparators,
  projectFileLocation,
  resolveDocumentFilePath,
} from "../utils/server-path"
import { currentConversationFileChangeSource } from "../utils/file-change-summary"
import { toolFileChangesFromState } from "../utils/tool-file-changes"
import { relativePathFrom } from "../utils/tool"
import type { MarkdownImageReader } from "./MarkdownDocumentImages"
import { bytesToArrayBuffer } from "../utils/binary"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { restoreFileDocumentPosition } from "../utils/file-reference"
import { extToLang } from "../utils/markdown"
import { StaticTextPart, type MarkdownRenderedHandler } from "./TextPart"
import type { CodeEditorNavigation } from "./ui/CodeEditor"
import { Icon } from "./ui/Icon"
// CodeMirror and its Lezer grammars are only needed once a file is actually
// open. This pane stays mounted to keep its state, so the editor itself is what
// loads on demand.
const CodeEditor = lazy(async () => ({ default: (await import("./ui/CodeEditor")).CodeEditor }))
const PdfPreview = lazy(async () => ({ default: (await import("./PdfPreview")).PdfPreview }))
import { Button } from "./ui/Button"
import { Badge } from "./ui/Badge"
import { Dialog, dialogOpeningFocusTarget } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { PreviewableImage } from "./ImagePreview"
import { TextDiffView } from "./DiffView"
import { SegmentedControl } from "./ui/SegmentedControl"

function fileContentPath(target: FileEditorTarget): string {
  const query = new URLSearchParams({
    path: target.sourceAbsolutePath || target.path,
    directory: target.directory,
  })
  return `file/${target.sourceAbsolutePath ? "source-content" : "content"}?${query.toString()}`
}

async function readFileContent(target: FileEditorTarget | null, authority: ApiAuthority, signal?: AbortSignal): Promise<FileContent | null> {
  if (!target) return null
  return (await apiJson(fileContentPath(target), { authority, signal })) as FileContent
}

async function writeFileContent(
  target: FileEditorTarget,
  content: string,
  expectedRevision: string,
  authority: ApiAuthority,
): Promise<FileContent> {
  if (target.sourceAbsolutePath) throw new Error("Absolute source files are read-only")
  return (await apiJson(projectScopedPath("file/content", target.directory), {
    authority,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: target.path, content, expectedRevision }),
  })) as FileContent
}

function canEdit(content: FileContent | null | undefined): boolean {
  return !!content && content.type === "text" && !content.encoding
}

type EditableFileSnapshot = FileContent & { revision: string; resourceID: string }

function isEditableFileSnapshot(content: FileContent | null | undefined): content is EditableFileSnapshot {
  return canEdit(content) && typeof content?.content === "string" &&
    typeof content.revision === "string" && Boolean(content.revision) &&
    typeof content.resourceID === "string" && Boolean(content.resourceID)
}

function fileReadFailureKind(error: unknown): "missing" | "invalid_path" | "failed" {
  if (error instanceof ApiError && error.body && typeof error.body === "object") {
    const name = (error.body as { name?: unknown }).name
    if (error.status === 404 && name === "FileNotFoundError") return "missing"
    if (error.status === 400 && name === "FileInvalidPathError") return "invalid_path"
  }
  return "failed"
}

function saveFailureMessageKey(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object"
  ) {
    const name = (error.body as { name?: unknown }).name
    if (error.status === 409 && name === "FileWriteConflictError") return "file_editor.save_conflict"
    if (error.status === 404 && name === "FileNotFoundError") return "file_editor.save_missing"
    if (error.status === 400 && (name === "FileInvalidPathError" ||
      ("success" in error.body && error.body.success === false && "error" in error.body && Array.isArray(error.body.error)))) {
      return "file_editor.save_failed"
    }
  }
  return "file_editor.save_unconfirmed"
}

function isUnconfirmedSave(key: string | undefined): boolean {
  return key === "file_editor.save_unconfirmed" || key === "file_editor.save_unconfirmed_resource_changed"
}

function ownsFileTarget(target: FileEditorTarget): boolean {
  const current = selectedFileTarget()
  return (
    current?.directory === target.directory &&
    current.path === target.path &&
    current.sourceAbsolutePath === target.sourceAbsolutePath
  )
}

function sameFileResourceTarget(left: FileEditorTarget | null, right: FileEditorTarget | null): boolean {
  return (
    left?.directory === right?.directory &&
    left?.path === right?.path &&
    left?.sourceAbsolutePath === right?.sourceAbsolutePath
  )
}

type FileEditorFailure = { messageKey: string; cause?: unknown; observationCause?: unknown }

function isReloadFailure(failure: FileEditorFailure | null): boolean {
  return failure?.messageKey === "file_editor.reload_failed" || failure?.messageKey === "file_editor.reload_missing"
}

type AcceptedFileContent = { value: FileContent; target: FileEditorTarget; readerAuthority: ApiAuthority }
type ComparisonMode = "disk-draft" | "base-disk" | "base-draft"
type FileComparison = {
  target: FileEditorTarget
  authority: ApiAuthority
  controller: AbortController
  observationKey: string | null
  observedDiskRevision?: string | null
} & (
  | { status: "loading" }
  | { status: "loaded"; content: FileContent | null }
  | { status: "failed"; cause: unknown }
)

export type FileEditorTextShortcuts = {
  find: () => void
  goToLine: (event: KeyboardEvent) => boolean
}

export function FileEditorPane(props: {
  active: () => boolean
  onTextShortcutsChange: (shortcuts: FileEditorTextShortcuts | undefined) => void
}) {
  const [draft, setDraft] = createSignal("")
  const [savedBaseline, setSavedBaseline] = createSignal<Pick<FileContent, "content" | "revision" | "resourceID"> | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [reloading, setReloading] = createSignal(false)
  const [downloading, setDownloading] = createSignal(false)
  const [textView, setTextView] = createSignal<"source" | "preview" | null>(null)
  const [editorNavigation, setEditorNavigation] = createSignal<CodeEditorNavigation>()
  const [error, setError] = createSignal<FileEditorFailure | null>(null)
  const [savedDraftCopyPath, setSavedDraftCopyPath] = createSignal<string>()
  const [loadFailure, setLoadFailure] = createSignal<{ error: unknown } | null>(null)
  const [leaveDialogOpen, setLeaveDialogOpen] = createSignal(false)
  const [leaveSaving, setLeaveSaving] = createSignal(false)
  const [leavePrompt, setLeavePrompt] = createSignal<{ reason: "leave" | "reload"; path: string }>({
    reason: "leave",
    path: "",
  })
  const [comparison, setComparison] = createSignal<FileComparison | null>(null)
  const [comparisonMode, setComparisonMode] = createSignal<ComparisonMode>("disk-draft")
  let pendingLeaveDecision: Promise<number | null> | undefined
  let settleLeaveDecision: ((revision: number | null) => void) | undefined
  let leaveFocus: {
    element: HTMLElement
    targetIdentity: string
    authority: ReturnType<typeof captureApiAuthority>
  } | undefined
  let decisionRevision = 0
  let loadGeneration = 0
  let adoptedComparisonGeneration: number | undefined
  let draftRevision = 0
  let saveGeneration = 0
  let reloadGeneration = 0
  let activeTargetIdentity = ""
  let contentAuthority: ApiAuthority | undefined
  let downloadController: AbortController | undefined
  let draftCopyDialog: AbortController | undefined
  const [markdownPreview, setMarkdownPreview] = createSignal<HTMLElement>()
  const [linkedSectionMiss, setLinkedSectionMiss] = createSignal<{ revision: number; text: string }>()
  const [imagePreviewTrigger, setImagePreviewTrigger] = createSignal<HTMLButtonElement>()
  const [pdfNavigation, setPdfNavigation] = createSignal<HTMLDivElement>()
  let loadRetryButton: HTMLButtonElement | undefined
  let keepEditingButton: HTMLButtonElement | undefined
  let binaryDownloadButton: HTMLButtonElement | undefined
  let binaryDownloadFeedback: HTMLDivElement | undefined
  let previewRevealedRevision: number | undefined
  let previewReadingPosition: { scrollTop: number; revealRevision: number; draftRevision: number } | undefined

  const contentTarget = createMemo(
    () => {
      const current = selectedFileTarget()
      return current
        ? {
            directory: current.directory,
            path: current.path,
            sourceAbsolutePath: current.sourceAbsolutePath,
          }
        : null
    },
    null,
    { equals: sameFileResourceTarget },
  )

  const [acceptedContent, setAcceptedContent] = createSignal<AcceptedFileContent | null>(null)
  const content = createMemo(() => acceptedContent()?.value ?? null)
  const [loadedObservationKey, setLoadedObservationKey] = createSignal<string | null>(null)
  const observationKey = createMemo(() => {
    const file = contentTarget()
    if (!file || file.sourceAbsolutePath) return null
    const diskChangeRevision = fileEditorDiskChangeRevision()
    const source = currentConversationFileChangeSource()
    const relevantInputs = source.directory === file.directory ? source.inputs : []
    const matchesPath = (path: string) => {
      const relative = isAbsoluteServerPath(path) ? relativePathFrom(file.directory, path) : path
      return Boolean(relative) && normalizeProjectFilePath(relative, file.directory) === file.path
    }
    const identities = relevantInputs.flatMap(({ part }) => {
      if (!part || typeof part !== "object") return []
      const tool = part as { type?: unknown; id?: unknown; sessionID?: unknown; messageID?: unknown; state?: unknown }
      if (tool.type !== "tool" || typeof tool.id !== "string" || typeof tool.sessionID !== "string" || typeof tool.messageID !== "string") return []
      const affected = toolFileChangesFromState(tool.state, file.directory).some(
        (change) => matchesPath(change.openPath) || Boolean(change.previousPath && matchesPath(change.previousPath)),
      )
      return affected ? [JSON.stringify([tool.sessionID, tool.messageID, tool.id])] : []
    })
    return diskChangeRevision || identities.length ? JSON.stringify([diskChangeRevision, [...new Set(identities)].sort()]) : null
  })
  const [loading, setLoading] = createSignal(false)
  const target = createMemo(() => selectedFileTarget())
  const [pendingDiskCheck, setPendingDiskCheck] = createSignal<{
    file: FileEditorTarget
    authority: ReturnType<typeof captureApiAuthority>
  }>()
  const revealFocusOrigin = createMemo(() => {
    fileEditorRevealRevision()
    return document.activeElement
  })
  const path = createMemo(() => target()?.path ?? "")
  const displayName = createMemo(() => target()?.displayName ?? content()?.displayName)
  const fileTitle = createMemo(() => displayName() ?? pathWithForwardSeparators(
    path(), target()?.sourceAbsolutePath || target()?.directory || "",
  ).split("/").at(-1) ?? "")
  const fileTitleLabel = createMemo(() => displayName() ?? filePathLabel(fileTitle()))
  const fileLocation = createMemo(() => pathWithForwardSeparators(
    path(), target()?.directory || "",
  ))
  const textContent = createMemo(() => canEdit(content()))
  const markdownFile = () => textContent() && extToLang(path()) === "markdown"
  const previewVisible = () => markdownFile() && textView() === "preview"
  const previewImages = createMemo<MarkdownImageReader | undefined>(() => {
    const loaded = acceptedContent()
    if (!loaded) return
    const { target: document, readerAuthority } = loaded
    return {
      read: async (reference, signal) => {
        const path = resolveDocumentFilePath(decodeMarkdownFilePath(reference), document)
        const image = await readFileContent({
          directory: document.directory,
          path,
          ...(document.sourceAbsolutePath ? { sourceAbsolutePath: path } : {}),
        }, readerAuthority, signal)
        if (image?.encoding === "base64" && image.mimeType?.startsWith("image/")) {
          return `data:${image.mimeType};base64,${image.content}`
        }
        throw new Error(t("file.load_failed", { name: reference }))
      },
    }
  })
  createEffect(() => {
    fileEditorRevealRevision()
    if (target()?.range) setTextView("source")
    else if (target()?.markdownSection || target()?.documentPosition) setTextView("preview")
  })
  const imageSource = createMemo(() => {
    const file = content()
    return file?.encoding === "base64" && file.mimeType?.startsWith("image/")
      ? `data:${file.mimeType};base64,${file.content}`
      : undefined
  })
  const pdfSource = createMemo(() => {
    const file = content()
    return file?.encoding === "base64" && file.mimeType === "application/pdf"
      ? `data:${file.mimeType};base64,${file.content}`
      : undefined
  })
  const writable = createMemo(() => textContent() && content()?.revision !== undefined && !target()?.sourceAbsolutePath)
  const dirty = createMemo(() => writable() && draft() !== savedBaseline()?.content)
  const showFileLocation = () => !target()?.sourceAbsolutePath && fileLocation() !== fileTitle()
  const folderTarget = () => {
    const file = target()
    return file?.directory === activeDirectory().trim() && !file.sourceAbsolutePath && content() ? file : undefined
  }
  const saveStatus = () => {
    if (saving()) return t("common.saving")
    if (dirty()) return t(previewVisible() ? "file_editor.preview_draft_hint" : "file_editor.unsaved")
    return t("file_editor.no_unsaved_changes")
  }
  const projectBinary = createMemo(() => content()?.type === "binary" && !target()?.sourceAbsolutePath)
  const originalDownloadOnly = () => projectBinary() && content()?.encoding !== "base64"
  const binarySizeLabel = createMemo(() => {
    const size = originalDownloadOnly() ? content()?.sizeBytes : undefined
    if (size === undefined) return undefined
    return new Intl.NumberFormat(localeTag(), { style: "unit", unit: "byte", unitDisplay: "long" }).format(size)
  })
  const originalDownloadFailure = () => {
    const failure = error()
    return originalDownloadOnly() && failure?.messageKey === "file.download_failed" ? failure : null
  }
  const downloadable = () => textContent() || content()?.encoding === "base64" || projectBinary()
  const identityOf = (file: FileEditorTarget | null) => file
    ? `${file.directory}\u0000${file.path}\u0000${file.sourceAbsolutePath ?? ""}` : ""
  const resourceReady = () => !loading() && identityOf(target()) === activeTargetIdentity
  const previewFocusTarget = () => previewVisible() ? markdownPreview()
    : imageSource() ? imagePreviewTrigger()
    : pdfSource() ? pdfNavigation() : undefined
  const ownsRenderedPreview = (preview: HTMLElement): boolean => {
    const loaded = acceptedContent()
    return !!loaded && resourceReady() && !fileEditorReserved() && ownsFileTarget(loaded.target) &&
      isApiAuthorityCurrent(loaded.readerAuthority) && preview.isConnected &&
      preview.clientWidth > 0 && preview.clientHeight > 0 && !preview.closest("[inert], [hidden]")
  }
  const claimPreviewFocus = (preview: HTMLElement, revision: number): boolean => {
    if (previewRevealedRevision === revision) return false
    previewRevealedRevision = revision
    const active = document.activeElement
    return active === revealFocusOrigin() || active === document.body || active === preview
  }
  const revealPreview = createAnimationFrameScheduler(() => {
    if (previewVisible() && (target()?.markdownSection || target()?.documentPosition)) return
    const preview = previewFocusTarget()
    if (preview && ownsRenderedPreview(preview) && claimPreviewFocus(preview, fileEditorRevealRevision())) {
      preview.focus({ preventScroll: true })
    }
  })
  const revealRenderedDocument = createMemo<MarkdownRenderedHandler | undefined>(() => {
    const fragment = target()?.markdownSection
    const position = target()?.documentPosition
    const readingPosition = previewVisible() ? previewReadingPosition : undefined
    if (!fragment && !position && !readingPosition) return
    const revision = fileEditorRevealRevision()
    return (revealSection) => {
      const preview = markdownPreview()
      if (!preview || revision !== fileEditorRevealRevision() || !previewVisible() || !ownsRenderedPreview(preview)) return
      if (readingPosition && readingPosition === previewReadingPosition) {
        previewReadingPosition = undefined
        if (readingPosition.revealRevision === revision && readingPosition.draftRevision === draftRevision) {
          preview.scrollTop = readingPosition.scrollTop
          return
        }
      }
      if (!fragment && !position) return
      const moveFocus = claimPreviewFocus(preview, revision)
      if (position) {
        if (moveFocus) restoreFileDocumentPosition(preview, position)
      } else if (fragment) {
        const result = revealSection(fragment, moveFocus)
        setLinkedSectionMiss(result === "missing" ? { revision, text: draft() } : undefined)
        if (moveFocus && result !== "found") preview.focus({ preventScroll: true })
      }
    }
  })
  const missingLinkedSection = () => {
    const miss = linkedSectionMiss()
    return miss?.revision === fileEditorRevealRevision() && miss.text === draft()
  }
  createEffect(() => {
    fileEditorRevealRevision()
    if (previewFocusTarget() && resourceReady() && !fileEditorReserved()) revealPreview.schedule()
    else revealPreview.cancel()
  })
  const isBusy = () => !resourceReady() || saving() || reloading()
  const comparisonReading = () => comparison()?.status === "loading"
  const comparisonUnavailable = () => comparisonReading() || isBusy() || fileEditorReserved()
  const pendingDiskUpdate = () => observationKey() !== null && observationKey() !== loadedObservationKey()
  const switchTextView = (view: "source" | "preview") => {
    if (view === "source" && previewVisible()) {
      const preview = markdownPreview()
      if (preview && ownsRenderedPreview(preview)) {
        previewReadingPosition = { scrollTop: preview.scrollTop, revealRevision: fileEditorRevealRevision(), draftRevision }
      }
    }
    setTextView(view)
  }
  const textNavigationTarget = () => {
    const file = target()
    const navigation = editorNavigation()
    if (!file || !navigation || !textContent() || isBusy() || fileEditorReserved()) return
    return { file, navigation }
  }
  const runTextNavigation = (action: "find" | "goToLine") => {
    const current = textNavigationTarget()
    if (!current) return
    const { file, navigation } = current
    const generation = loadGeneration
    const authority = captureApiAuthority()
    switchTextView("source")
    // Solid reveals the retained editor before its native panel claims focus.
    queueMicrotask(() => {
      if (
        generation === loadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority) &&
        editorNavigation() === navigation && !isBusy() && !fileEditorReserved()
      ) navigation[action]()
    })
  }
  const findInFile = () => runTextNavigation("find")
  const handleGoToLineShortcut = (event: KeyboardEvent) =>
    !event.getModifierState("AltGraph") && (textNavigationTarget()?.navigation.handleGoToLineShortcut(event) ?? false)
  const textShortcuts = { find: findInFile, goToLine: handleGoToLineShortcut }
  createEffect(() => props.onTextShortcutsChange(textNavigationTarget() ? textShortcuts : undefined))
  onCleanup(() => props.onTextShortcutsChange(undefined))
  const currentErrorMessage = () => {
    const failure = error()
    return failure && t(failure.messageKey)
  }
  const fileErrorDetails = (failure: FileEditorFailure) =>
    [failure.cause, failure.observationCause].map(formatErrorDetails).filter(Boolean).join("\n\n") || undefined
  const needsDiskComparison = () => {
    const key = error()?.messageKey
    return key === "file_editor.save_conflict" || isUnconfirmedSave(key)
  }
  const readFailureKind = createMemo(() => fileReadFailureKind(loadFailure()?.error))

  const comparisonDiskContent = () => {
    const read = comparison()
    return read?.status === "loaded" ? read.content : null
  }
  const comparisonOutdated = () => {
    const read = comparison()
    return read?.status === "loaded" && isEditableFileSnapshot(read.content) &&
      read.observedDiskRevision !== undefined && read.observedDiskRevision !== read.content.revision
  }
  const observeComparedDiskRevision = (file: FileEditorTarget, revision: string | null) => {
    setComparison((read) => {
      if (!read || read.status === "failed" || read.observedDiskRevision === revision ||
        !sameFileResourceTarget(read.target, file) || !isApiAuthorityCurrent(read.authority)) return read
      return { ...read, observedDiskRevision: revision }
    })
  }
  const comparisonPair = createMemo(() => {
    const baseline = savedBaseline()
    if (!baseline) return undefined
    const mode = comparisonMode()
    if (mode === "base-draft") {
      return { before: baseline.content, after: draft(), left: "file_editor.compare_base", right: "file_editor.compare_draft" }
    }
    const disk = comparisonDiskContent()
    if (!disk || !canEdit(disk)) return undefined
    return mode === "base-disk"
      ? { before: baseline.content, after: disk.content, left: "file_editor.compare_base", right: "file_editor.compare_disk" }
      : { before: disk.content, after: draft(), left: "file_editor.compare_disk", right: "file_editor.compare_draft" }
  })
  const retireComparison = () => {
    comparison()?.controller.abort()
    setComparison(null)
  }
  const comparedDiskForBase = () => {
    const read = comparison()
    const disk = comparisonDiskContent()
    if (
      !read || !canEdit(disk) || !disk?.revision || !writable() || !dirty() ||
      read.controller.signal.aborted ||
      !ownsFileTarget(read.target) || !isApiAuthorityCurrent(read.authority) ||
      disk.revision === savedBaseline()?.revision
    ) return null
    return disk
  }
  const comparisonAdoptionUnavailable = () => isBusy() || fileEditorReserved() || comparisonOutdated()
  const adoptComparedDiskBase = () => {
    if (comparisonAdoptionUnavailable()) return
    const read = comparison()
    const disk = comparedDiskForBase()
    const revision = disk?.revision
    if (!read || !disk || !revision) return
    batch(() => {
      setAcceptedContent({ value: disk, target: read.target, readerAuthority: read.authority })
      setSavedBaseline({ content: disk.content, revision, resourceID: disk.resourceID })
      setLoadedObservationKey(read.observationKey)
      // The adopted snapshot replaces the base that produced this conflict.
      if (needsDiskComparison()) setError(null)
      adoptedComparisonGeneration = loadGeneration
      retireComparison()
    })
  }
  const compareWithDisk = async (resetMode = true) => {
    const file = target()
    if (!file || !writable() || !savedBaseline() || comparisonUnavailable()) return
    adoptedComparisonGeneration = undefined
    comparison()?.controller.abort()
    if (resetMode) setComparisonMode("disk-draft")
    const authority = captureApiAuthority()
    const controller = new AbortController()
    const request = { target: file, authority, controller, observationKey: observationKey() }
    setComparison({ ...request, status: "loading" })
    const current = () => {
      const read = comparison()
      if (read?.status !== "loading" || read.controller !== controller || controller.signal.aborted ||
        !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return undefined
      return read
    }
    try {
      const next = await readFileContent(file, authority, controller.signal)
      const read = current()
      if (read) setComparison({ ...read, status: "loaded", content: next })
    } catch (cause) {
      const read = current()
      if (read) setComparison({ ...read, status: "failed", cause })
    }
  }
  const canSaveDraftCopy = () => {
    const key = error()?.messageKey
    return dirty() && (key === "file_editor.reload_missing" || key === "file_editor.save_missing")
  }

  async function saveDraftCopy(opener: HTMLButtonElement): Promise<void> {
    const file = target()
    if (!file || !canSaveDraftCopy() || isBusy() || fileEditorReserved() || draftCopyDialog) return
    const authority = captureApiAuthority()
    const generation = loadGeneration
    const dialog = new AbortController()
    draftCopyDialog = dialog
    const owns = () => generation === loadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)
    const windows = isWindowsPath(file.directory)
    const originalPath = normalizeProjectFilePath(file.path, file.directory)
    let destination = ""
    try {
      await showAppDialog({
        kind: "file-draft-copy",
        title: t("file_editor.save_draft_copy"),
        message: t("file_editor.draft_copy_destination", { directory: file.directory }),
        input: true,
        inputLabel: t("file_editor.draft_copy_path"),
        inputValue: `recovered-${originalPath.split("/").at(-1)}`,
        inputRequired: true,
        cancel: true,
        okLabel: t("file_editor.save_draft_copy"),
        signal: dialog.signal,
        openingGuard: owns,
        returnFocusTarget: () => owns() ? opener : null,
        validateInput: (value) => {
          if (classifyProjectPathInput(value, file.directory) === "rooted") return t("explorer.destination_relative_required")
          const path = normalizeProjectFilePath(value, file.directory)
          if (path.split("/").some((name) => classifyEntryBasename(name, windows) !== "valid")) {
            return t("file_editor.draft_copy_invalid_path")
          }
          if (windows ? path.toLowerCase() === originalPath.toLowerCase() : path === originalPath) {
            return t("file_editor.draft_copy_distinct_path")
          }
        },
        confirmErrorSummary: (cause) => {
          if (cause instanceof ApiError && cause.status === 409 &&
            (cause.body as { name?: unknown } | null)?.name === "FileConflictError") {
            return t("explorer.error.destination_exists", { path: destination })
          }
          return t("file_editor.draft_copy_failed")
        },
        onConfirm: async (value) => {
          if (!owns()) return
          if (!dirty()) throw new Error(t("file_editor.draft_copy_changed"))
          destination = normalizeProjectFilePath(value ?? "", file.directory)
          const revision = draftRevision
          try {
            const copy = await createFileItem({ path: destination, type: "file", content: draft() }, { directory: file.directory, authority })
            if (owns() && revision === draftRevision) setSavedDraftCopyPath(copy.path)
          } catch (cause) {
            if (owns()) throw cause
          }
        },
      })
    } catch (cause) {
      if (owns()) setError({ messageKey: "file_editor.draft_copy_failed", cause })
    } finally {
      if (draftCopyDialog === dialog) draftCopyDialog = undefined
    }
  }

  const saveComparisonAction = () => needsDiskComparison() ? (
      <Button type="button" variant="outline" size="sm" tone="neutral"
        disabled={!resourceReady() || fileEditorReserved()} aria-disabled={comparisonUnavailable() || undefined}
        onClick={() => void compareWithDisk()}>
        {t("file_editor.compare")}
      </Button>
  ) : undefined

  const fileFeedbackAction = () => canSaveDraftCopy() ? (
      <Button type="button" variant="outline" size="sm" tone="neutral"
        disabled={!resourceReady() || fileEditorReserved()} aria-disabled={isBusy() || undefined}
        onClick={(event) => void saveDraftCopy(event.currentTarget)}>
        {t("file_editor.save_draft_copy")}
      </Button>
  ) : saveComparisonAction()

  const retireDownload = () => {
    downloadController?.abort()
    downloadController = undefined
    setDownloading(false)
  }

  const downloadCurrentFile = async () => {
    const file = content()
    const resource = target()
    if (!file || !resource || !downloadable() || isBusy() || fileEditorReserved() || downloading()) return
    const authority = captureApiAuthority()
    const filename = fileTitle()
    const controller = new AbortController()
    downloadController = controller
    setDownloading(true)
    const current = () => downloadController === controller && ownsFileTarget(resource) && isApiAuthorityCurrent(authority)
    try {
      let blob: Blob
      if (file.encoding === "base64") {
        blob = new Blob([bytesToArrayBuffer(base64ToUint8(file.content))], { type: file.mimeType ?? "application/octet-stream" })
      } else if (file.type === "text") {
        blob = new Blob([draft()], { type: "text/plain;charset=utf-8" })
      } else {
        const requestPath = `file/download?${new URLSearchParams({ path: resource.path, directory: resource.directory })}`
        const response = await apiRequest<Uint8Array>(requestPath, { authority, responseKind: "binary", signal: controller.signal })
        if (!response.ok) throw new ApiError(response.status, requestPath, response.body, response.headers, "GET")
        blob = new Blob([bytesToArrayBuffer(response.body)], { type: response.headers["content-type"] ?? "application/octet-stream" })
      }
      if (current()) {
        downloadBlob(blob, filename)
        if (originalDownloadFailure() && binaryDownloadButton?.isConnected &&
          binaryDownloadFeedback?.contains(binaryDownloadButton.ownerDocument.activeElement)) {
          binaryDownloadButton.focus({ preventScroll: true })
        }
        setError((failure) => failure?.messageKey === "file.download_failed" ? null : failure)
      }
    } catch (cause) {
      if (current() && !controller.signal.aborted) setError({ messageKey: "file.download_failed", cause })
    } finally {
      if (downloadController === controller) {
        downloadController = undefined
        setDownloading(false)
      }
    }
  }

  const applyContent = (loaded: AcceptedFileContent | null, observed: string | null) => batch(() => {
    const next = loaded?.value ?? null
    if (next && textView() === null) {
      setTextView(
        canEdit(next) && extToLang(path()) === "markdown" && !target()?.range &&
          (next.content.length > 0 || target()?.markdownSection || target()?.documentPosition)
          ? "preview"
          : "source",
      )
    }
    setAcceptedContent(loaded)
    setLoadedObservationKey(next ? observed : null)
    setError(null)
    setSavedDraftCopyPath(undefined)
    draftRevision += 1
    setDraft(canEdit(next) ? next!.content : "")
    setSavedBaseline(canEdit(next) ? { content: next!.content, revision: next!.revision, resourceID: next!.resourceID } : null)
  })

  createEffect((previousRevealRevision: number) => {
    const file = contentTarget()
    const authority = captureApiAuthority()
    const observed = observationKey()
    const revealRevision = fileEditorRevealRevision()
    const revealRequested = revealRevision !== previousRevealRevision
    const admissionActive = fileEditorAdmissionPhase() !== "idle"
    untrack(() => {
      const identity = identityOf(file)
      if (identity === activeTargetIdentity && contentAuthority && isApiAuthorityCurrent(contentAuthority)) {
        if (dirty() || saving() || reloading() || downloading() || admissionActive) return
        if (content() && observed === loadedObservationKey()) return
      }
      retireComparison()
      retireDownload()
      draftCopyDialog?.abort()
      draftCopyDialog = undefined
      setSavedDraftCopyPath(undefined)
      previewReadingPosition = undefined
      const retainDraft = identity === activeTargetIdentity && dirty()
      if (identity !== activeTargetIdentity) {
        setTextView(null)
      }
      activeTargetIdentity = identity
      contentAuthority = authority
      const generation = ++loadGeneration
      saveGeneration += 1
      reloadGeneration += 1
      setSaving(false)
      setReloading(false)
      setLoading(false)
      finishLeaveDecision(false)
      if (retainDraft) {
        setAcceptedContent((previous) => previous && { ...previous, readerAuthority: authority })
        return
      }
      applyContent(null, null)
      setLoadFailure(null)
      if (!file) return
      const focusOrigin = revealRequested ? revealFocusOrigin() : null
      setLoading(true)
      const current = () => generation === loadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)
      void readFileContent(file, authority).then((next) => {
        if (current()) applyContent(next && { value: next, target: file, readerAuthority: authority }, observed)
      }, (cause) => {
        if (current()) setLoadFailure({ error: cause })
      }).finally(() => {
        if (!current()) return
        setLoading(false)
        const action = loadFailure() ? loadRetryButton : originalDownloadOnly() ? binaryDownloadButton : undefined
        if (
          !revealRequested || fileEditorRevealRevision() !== revealRevision || fileEditorReserved() ||
          !action?.isConnected || !action.clientWidth || !action.clientHeight || !current()
        ) return
        const { activeElement, body } = action.ownerDocument
        if (activeElement === focusOrigin || activeElement === body) action.focus({ preventScroll: true })
      })
    })
    return revealRevision
  }, 0)

  const save = async (): Promise<boolean> => {
    const file = target()
    if (fileEditorReserved() || isBusy()) return false
    if (!file || !writable() || !dirty()) return !dirty()
    const baseline = savedBaseline()
    const expectedRevision = baseline?.revision
    if (!expectedRevision) {
      setError({ messageKey: "file_editor.revision_required" })
      return false
    }
    const authority = captureApiAuthority()
    const observed = observationKey()
    const submittedDraft = draft()
    const submittedRevision = draftRevision
    const requestGeneration = ++saveGeneration
    const owns = () => requestGeneration === saveGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)
    const acceptSavedSnapshot = (next: EditableFileSnapshot): boolean => {
      const ownsSubmittedDraft = draftRevision === submittedRevision
      batch(() => {
        setSavedBaseline({ content: next.content, revision: next.revision, resourceID: next.resourceID })
        setLoadedObservationKey(observed)
        if (ownsSubmittedDraft) setDraft(next.content)
        draftRevision += 1
      })
      return ownsSubmittedDraft
    }
    setSaving(true)
    setError(null)
    try {
      const next = await writeFileContent(file, submittedDraft, expectedRevision, authority)
      if (!owns()) return false
      if (!isEditableFileSnapshot(next)) throw new Error("File write did not return a complete editable snapshot")
      return acceptSavedSnapshot(next)
    } catch (cause) {
      if (!owns()) return false
      let messageKey = saveFailureMessageKey(cause)
      let observationCause: unknown
      if (messageKey === "file_editor.save_unconfirmed" && baseline?.resourceID) {
        try {
          const disk = await readFileContent(file, authority)
          if (!owns()) return false
          if (isEditableFileSnapshot(disk)) {
            if (disk.resourceID !== baseline.resourceID) messageKey = "file_editor.save_unconfirmed_resource_changed"
            else if (disk.content === submittedDraft) return acceptSavedSnapshot(disk)
          }
        } catch (error) {
          observationCause = error
        }
      }
      if (owns()) setError({ messageKey, cause, observationCause })
      return false
    } finally {
      if (owns()) setSaving(false)
    }
  }

  const updateDraft = (next: string) => {
    if (fileEditorReserved()) return
    draftRevision += 1
    setSavedDraftCopyPath(undefined)
    setDraft(next)
  }

  const finishLeaveDecision = (allowed: boolean, approvedRevision = decisionRevision) => {
    const settle = settleLeaveDecision
    settleLeaveDecision = undefined
    pendingLeaveDecision = undefined
    if (allowed) leaveFocus = undefined
    setLeaveDialogOpen(false)
    setLeaveSaving(false)
    settle?.(allowed ? approvedRevision : null)
  }

  const decideBeforeNavigate = (reason: "leave" | "reload" = "leave"): Promise<number | null> => {
    if (fileEditorReserved() || isBusy()) return Promise.resolve(null)
    const file = target()
    if (!file || !dirty()) return Promise.resolve(draftRevision)
    if (pendingLeaveDecision) return pendingLeaveDecision
    decisionRevision = draftRevision
    const focused = document.activeElement
    leaveFocus = focused instanceof HTMLElement
      ? { element: dialogOpeningFocusTarget(focused), targetIdentity: activeTargetIdentity, authority: captureApiAuthority() }
      : undefined
    setLeavePrompt({ reason, path: projectFileLocation(file) })
    setLeaveDialogOpen(true)
    pendingLeaveDecision = new Promise<number | null>((resolve) => {
      settleLeaveDecision = resolve
    })
    return pendingLeaveDecision
  }

  const unregisterBeforeNavigate = registerFileEditorBeforeNavigate({
    confirmLeave: decideBeforeNavigate,
    isDirty: dirty,
    getRevision: () => draftRevision,
    isBusy,
    resourceID: () => savedBaseline()?.resourceID,
    requestDiskCheck: () => {
      const file = target()
      if (file) setPendingDiskCheck({ file, authority: captureApiAuthority() })
    },
  })
  createEffect(on(props.active, (active) => {
    const loaded = acceptedContent()
    if (
      active && loaded && isEditableFileSnapshot(loaded.value) &&
      ownsFileTarget(loaded.target) && isApiAuthorityCurrent(loaded.readerAuthority)
    ) requestOpenFileDiskCheck()
  }, { defer: true }))
  createEffect(() => {
    const request = pendingDiskCheck()
    if (!request) return
    if (!ownsFileTarget(request.file) || !isApiAuthorityCurrent(request.authority)) {
      setPendingDiskCheck(undefined)
      return
    }
    if (isBusy() || fileEditorAdmissionPhase() !== "idle" || downloading() || leaveDialogOpen()) return
    setPendingDiskCheck(undefined)
    untrack(() => void reload("disk-check"))
  })
  onCleanup(() => {
    revealPreview.cancel()
    retireComparison()
    retireDownload()
    draftCopyDialog?.abort()
    loadGeneration += 1
    reloadGeneration += 1
    saveGeneration += 1
    unregisterBeforeNavigate()
    leaveFocus = undefined
    finishLeaveDecision(false)
  })

  async function reload(reason: "explicit" | "disk-check" = "explicit"): Promise<void> {
    const file = target()
    const checkingDisk = reason === "disk-check"
    if (!file || fileEditorReserved() || isBusy() || (checkingDisk && file.sourceAbsolutePath)) return
    const generation = ++reloadGeneration
    const authority = captureApiAuthority()
    const approvedRevision = checkingDisk ? draftRevision : await decideBeforeNavigate("reload")
    if (approvedRevision === null || approvedRevision !== draftRevision || fileEditorReserved()) return
    if (generation !== reloadGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return
    const requestedDraftRevision = draftRevision
    const observed = observationKey()
    setReloading(true)
    if (!checkingDisk) setError(null)
    try {
      const next = await readFileContent(file, authority)
      if (generation !== reloadGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return
      if (checkingDisk) {
        const baseline = savedBaseline()
        const disk = isEditableFileSnapshot(next) ? next : null
        observeComparedDiskRevision(file, disk?.revision ?? null)
        const sameResource = baseline && disk && disk.resourceID === baseline.resourceID
        setError((failure) => {
          if (isReloadFailure(failure) || (sameResource && failure?.messageKey === "file_editor.save_missing")) return null
          return failure
        })
        if (sameResource && disk.revision === baseline.revision) {
          setLoadedObservationKey(observed)
          return
        }
      }
      if (draftRevision !== requestedDraftRevision || (checkingDisk && dirty())) {
        if (checkingDisk) observeFileEditorDiskChange(file.directory)
        else setError({ messageKey: "file_editor.reload_edited" })
        return
      }
      setLoadFailure(null)
      applyContent(next && { value: next, target: file, readerAuthority: authority }, observed)
    } catch (cause) {
      if (generation === reloadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) {
        const missing = fileReadFailureKind(cause) === "missing"
        if (checkingDisk && missing) observeComparedDiskRevision(file, null)
        if (loadFailure()) setLoadFailure({ error: cause })
        else {
          const messageKey = missing ? "file_editor.reload_missing" : "file_editor.reload_failed"
          setError((failure) => checkingDisk && failure && !isReloadFailure(failure) ? failure : { messageKey, cause })
        }
      }
    } finally {
      if (generation === reloadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) setReloading(false)
    }
  }

  const closeCurrentFile = async (): Promise<void> => {
    if (isBusy() || fileEditorReserved()) return
    const file = target()
    const authority = captureApiAuthority()
    const generation = loadGeneration
    const origin = document.activeElement
    const dock = origin?.closest<HTMLElement>("#rightDock")
    try {
      const closed = await closeFileEditor()
      if (closed && origin && dock) {
        requestAnimationFrame(() => {
          if (isApiAuthorityCurrent(authority)) restoreRightDockFocus(dock, origin)
        })
      }
    } catch (cause) {
      if (generation === loadGeneration && isApiAuthorityCurrent(authority) && (!file || ownsFileTarget(file))) {
        setError({ messageKey: "file_editor.close_failed", cause })
      }
    }
  }

  const returnToPreviousDocument = async (): Promise<void> => {
    if (isBusy() || fileEditorReserved()) return
    const file = target()
    const authority = captureApiAuthority()
    try {
      await returnToFileDocument()
    } catch (cause) {
      if (file === target() && isApiAuthorityCurrent(authority)) {
        setError({ messageKey: "file_editor.return_to_document_failed", cause })
      }
    }
  }

  function showContainingFolder(origin: HTMLButtonElement): void {
    const file = folderTarget()
    if (!file || isBusy() || fileEditorReserved()) return
    requestFileExplorerFolder({
      directory: file.directory,
      authority: captureApiAuthority(),
      selectionEpoch: boardStore.selectEpoch,
      path: parentProjectPath(file.path, file.directory),
      origin,
    })
  }

  const saveAndLeave = async () => {
    if (leaveSaving()) return
    const decision = pendingLeaveDecision
    setLeaveSaving(true)
    try {
      if (await save() && decision === pendingLeaveDecision) finishLeaveDecision(true, draftRevision)
    } finally {
      if (decision === pendingLeaveDecision) setLeaveSaving(false)
    }
  }

  return (
    <section
      class="file-editor-pane"
      aria-label={t("file_editor.title")}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.isComposing ||
          event.shiftKey ||
          !(event.ctrlKey || event.metaKey)
        )
          return
        if (event.altKey) {
          if (handleGoToLineShortcut(event)) {
            event.preventDefault()
            event.stopPropagation()
          }
          return
        }
        const key = event.key.toLowerCase()
        if (key === "s") {
          event.preventDefault()
          void save()
        } else if (key === "f" && textContent()) {
          event.preventDefault()
          event.stopPropagation()
          findInFile()
        }
      }}
    >
      <Show
        when={path()}
        fallback={
          <div class="file-editor-empty">
            <Icon name="file-document" size="medium" />
            <p>{t("file_editor.empty")}</p>
          </div>
        }
      >
        <header class="file-editor-header" data-text-navigation={textContent() ? "" : undefined}>
          <div class="file-editor-identity">
            <Show when={target()?.previousDocument}>
              <Button type="button" variant="ghost" size="icon" tone="neutral"
                disabled={isBusy() || fileEditorReserved()}
                title={t("file_editor.return_to_document")} aria-label={t("file_editor.return_to_document")}
                onClick={() => void returnToPreviousDocument()}>
                <Icon name="nav-back" />
              </Button>
            </Show>
            <div class="file-editor-title" title={[displayName(), filePathLabel(target()?.sourceAbsolutePath || path())].filter(Boolean).join("\n")}>
              <span class="file-editor-title-name">{fileTitleLabel()}</span>
            </div>
          </div>
          <div class="file-editor-actions">
            <Show
              when={!loading() && content() && !writable() || target()?.sourceAbsolutePath}
              fallback={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone={dirty() ? "accent" : "neutral"}
                  data-ui="file-editor-save"
                  data-dirty={dirty() ? "true" : "false"}
                  title={`${t("common.save")} (Ctrl/Cmd+S)`}
                  aria-keyshortcuts="Control+s Meta+s"
                  disabled={!resourceReady() || fileEditorReserved()}
                  aria-disabled={!dirty() || isBusy() || fileEditorReserved() || undefined}
                  aria-busy={saving() || undefined}
                  onClick={() => void save()}
                >
                  {t("common.save")}
                </Button>
              }
            >
              <Badge tone="neutral" size="sm">{t("file_editor.read_only")}</Badge>
            </Show>
            <Show when={folderTarget()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                disabled={isBusy() || fileEditorReserved()}
                title={t("file_editor.show_containing_folder")}
                aria-label={t("file_editor.show_containing_folder")}
                onClick={(event) => showContainingFolder(event.currentTarget)}
              >
                <Icon name="folder-open" />
              </Button>
            </Show>
            <Show when={textContent()}>
              <Button type="button" variant="ghost" size="icon" tone="neutral"
                disabled={!textNavigationTarget()}
                title={`${t("file_editor.find")} (Ctrl/Cmd+F)`}
                aria-label={t("file_editor.find")} aria-keyshortcuts="Control+f Meta+f"
                onClick={findInFile}>
                <Icon name="search" />
              </Button>
              <Button type="button" variant="ghost" size="icon" tone="neutral"
                disabled={!textNavigationTarget()}
                title={`${t("code_editor.go_to_line")} (Ctrl/Cmd+Alt+G)`}
                aria-label={t("code_editor.go_to_line")} aria-keyshortcuts="Control+Alt+G Meta+Alt+G"
                onClick={() => runTextNavigation("goToLine")}>
                <Icon name="locate-current" />
              </Button>
            </Show>
            <Show when={writable()}>
              <Button type="button" variant="ghost" size="icon" tone="neutral"
                data-ui="file-editor-compare" disabled={!resourceReady() || fileEditorReserved()}
                aria-disabled={comparisonUnavailable() || undefined}
                title={t("file_editor.compare")} aria-label={t("file_editor.compare")}
                onClick={() => void compareWithDisk()}>
                <Icon name="git-compare" />
              </Button>
            </Show>
            <Show when={downloadable() && !originalDownloadOnly()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                disabled={!resourceReady() || fileEditorReserved()}
                aria-disabled={isBusy() || fileEditorReserved() || downloading() || undefined}
                aria-busy={downloading() || undefined}
                title={t(downloading() ? "file.downloading" : dirty() ? "file_editor.download_draft" : "file.download")}
                aria-label={t(downloading() ? "file.downloading" : dirty() ? "file_editor.download_draft" : "file.download")}
                onClick={() => void downloadCurrentFile()}
              >
                <Icon name={downloading() ? "loading" : "download"} />
              </Button>
            </Show>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="file-editor-reload"
              disabled={!resourceReady() || fileEditorReserved()}
              aria-disabled={isBusy() || fileEditorReserved() || undefined}
              aria-busy={reloading() || undefined}
              title={t("file_editor.reload")}
              aria-label={t("file_editor.reload")}
              onClick={() => void reload()}
            >
              <Icon name={reloading() ? "loading" : "refresh"} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui="file-editor-close"
              disabled={!resourceReady() || fileEditorReserved()}
              aria-disabled={isBusy() || fileEditorReserved() || undefined}
              onClick={() => void closeCurrentFile()}
              title={t("file_editor.close", { path: fileTitleLabel() })}
              aria-label={t("file_editor.close", { path: fileTitleLabel() })}
            >
              <Icon name="close" />
            </Button>
          </div>
          <Show when={showFileLocation() || writable()}>
            <div class="file-editor-meta">
              <Show when={showFileLocation()}>
                <span class="file-editor-title-path" title={filePathLabel(path())}>{filePathLabel(fileLocation())}</span>
              </Show>
              <Show when={writable()}>
                <span class="file-editor-save-status" role="status" aria-atomic="true" data-dirty={dirty() && !saving() || undefined}>
                  {saveStatus()}
                </span>
              </Show>
            </div>
          </Show>
        </header>
        <Show when={markdownFile()}>
          <div class="file-editor-text-toolbar">
            <SegmentedControl<"source" | "preview">
              size="sm"
              value={textView() === "preview" ? "preview" : "source"}
              ariaLabel={t("file_editor.view")}
              options={[
                { value: "source", label: t("file_editor.view_source") },
                { value: "preview", label: t("file_editor.view_preview") },
              ]}
              onChange={switchTextView}
            />
          </div>
        </Show>
        <Show when={pendingDiskUpdate() && content() && resourceReady() && !needsDiskComparison()}>
          <Feedback
            class="file-editor-load-feedback file-editor-compare-feedback"
            tone="info"
            actions={<>
              <Show when={writable()}>
                <Button type="button" variant="outline" size="sm" tone="neutral"
                  disabled={isBusy() || fileEditorReserved()} aria-disabled={comparisonUnavailable() || undefined}
                  onClick={() => void compareWithDisk()}>
                  {t("file_editor.compare")}
                </Button>
              </Show>
              <Button type="button" variant="outline" size="sm" tone="accent"
                disabled={isBusy() || fileEditorReserved()} onClick={() => void reload()}>
                {t("file_editor.reload")}
              </Button>
            </>}
          >
            {t(dirty() ? "file_editor.disk_update_dirty" : "file_editor.disk_update")}
          </Feedback>
        </Show>
        <div class="file-editor-body">
          <Show
            when={!loading()}
            fallback={
              <div class="file-editor-empty">
                <p>{t("common.loading")}</p>
              </div>
            }
          >
            <Show
              when={!loadFailure()}
              fallback={
                <Feedback
                  class="file-editor-load-feedback"
                  data-ui="file-editor-load-error"
                  tone="error"
                  title={t(`file_editor.load_${readFailureKind()}`)}
                  details={loadFailure() ? formatErrorDetails(loadFailure()!.error) : undefined}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      ref={loadRetryButton}
                      disabled={!resourceReady() || fileEditorReserved()}
                      aria-disabled={isBusy() || fileEditorReserved() || undefined}
                      aria-busy={reloading() || undefined}
                      onClick={() => void reload()}
                    >
                      {reloading() ? t("common.loading") : t("common.retry")}
                    </Button>
                  }
                >
                  <div class="file-editor-failure-path">{target()?.sourceAbsolutePath || path()}</div>
                  <div>{t(`file_editor.load_${readFailureKind()}_hint`)}</div>
                </Feedback>
              }
            >
              <Switch fallback={
                <div class="file-editor-empty">
                  <Icon name="file-document" size="medium" />
                  <p>{t(projectBinary() ? "file_editor.binary_download_hint" : "file_editor.binary")}</p>
                  <Show when={binarySizeLabel()}>{(size) => <p>{size()}</p>}</Show>
                  <Show when={projectBinary()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      ref={binaryDownloadButton}
                      disabled={!resourceReady() || fileEditorReserved()}
                      aria-disabled={isBusy() || fileEditorReserved() || downloading() || undefined}
                      aria-busy={downloading() || undefined}
                      onClick={() => void downloadCurrentFile()}
                    >
                      {t(downloading() ? "file.downloading" : originalDownloadFailure() ? "file_editor.retry_download" : "file.download")}
                    </Button>
                  </Show>
                  <Show when={originalDownloadFailure()}>
                    {(failure) => (
                      <Feedback class="file-editor-binary-download-feedback" ref={binaryDownloadFeedback}
                        tone="error" details={fileErrorDetails(failure())}>
                        {t(failure().messageKey)}
                      </Feedback>
                    )}
                  </Show>
                </div>
              }>
                <Match when={imageSource()}>
                  {(src) => (
                    <div class="file-editor-image">
                      <PreviewableImage src={src()} alt={displayName() ?? path()} triggerRef={setImagePreviewTrigger} />
                    </div>
                  )}
                </Match>
                <Match when={pdfSource()}>
                  {(url) => (
                    <PdfPreview url={url()} label={displayName() ?? path()} class="file-editor-pdf"
                      onNavigationReady={setPdfNavigation} />
                  )}
                </Match>
                <Match when={textContent()}>
                  <CodeEditor
                    hidden={previewVisible()}
                    value={draft()}
                    path={path()}
                    lineRange={target()?.range}
                    revealRevision={fileEditorRevealRevision()}
                    revealFocusOrigin={revealFocusOrigin()}
                    ariaLabel={fileTitleLabel()}
                    onValueChange={updateDraft}
                    onNavigationReady={setEditorNavigation}
                    onGoToLineShortcut={() => runTextNavigation("goToLine")}
                    readOnly={!writable() || fileEditorReserved()}
                  />
                  <Show when={previewVisible()}>
                    <Show when={missingLinkedSection()}>
                      <Feedback class="file-editor-section-feedback" tone="info">
                        {t("file_editor.linked_section_missing")}
                      </Feedback>
                    </Show>
                    <section
                      ref={setMarkdownPreview}
                      class="file-editor-markdown-preview md-content"
                      tabIndex={0}
                      aria-label={`${fileTitleLabel()} · ${t("file_editor.view_preview")}`}
                    >
                      <StaticTextPart text={draft()} images={previewImages()} onRendered={revealRenderedDocument()} />
                    </section>
                  </Show>
                </Match>
              </Switch>
            </Show>
          </Show>
        </div>
        <Show when={!leaveDialogOpen() && !originalDownloadFailure() && error()}>{(failure) =>
          <Feedback
              class="file-editor-error file-editor-compare-feedback"
            tone={isUnconfirmedSave(failure().messageKey) ? "warning" : "error"}
            details={fileErrorDetails(failure())}
            actions={fileFeedbackAction()}
          >
            {currentErrorMessage()}
            <Show when={canSaveDraftCopy() && savedDraftCopyPath()}>
              {(path) => <p>{t("file_editor.draft_copy_saved", { path: path() })}</p>}
            </Show>
          </Feedback>
        }
        </Show>
      </Show>
      <Dialog
        id="fileEditorUnsavedDialog"
        open={leaveDialogOpen()}
        title={t("file_editor.unsaved")}
        backdropClose={false}
        onOpenAutoFocus={(event) => {
          const origin = document.activeElement
          event.preventDefault()
          queueMicrotask(() => {
            if (!leaveDialogOpen() || !keepEditingButton?.isConnected) return
            const { activeElement, body } = keepEditingButton.ownerDocument
            if (activeElement === origin || activeElement === body) keepEditingButton.focus({ preventScroll: true })
          })
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const intent = leaveFocus
          leaveFocus = undefined
          if (
            intent && intent.targetIdentity === activeTargetIdentity && isApiAuthorityCurrent(intent.authority) &&
            intent.element.isConnected && intent.element.getClientRects().length > 0
          ) intent.element.focus({ preventScroll: true })
        }}
        onClose={() => {
          if (!leaveSaving()) finishLeaveDecision(false)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              tone="neutral"
              data-ui="file-editor-leave-cancel"
              ref={keepEditingButton}
              aria-disabled={leaveSaving() || undefined}
              onClick={() => { if (!leaveSaving()) finishLeaveDecision(false) }}
            >
              {t("file_editor.keep_editing")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="danger"
              aria-disabled={leaveSaving() || undefined}
              data-ui="file-editor-discard"
              onClick={() => { if (!leaveSaving()) finishLeaveDecision(true) }}
            >
              {t(leavePrompt().reason === "reload" ? "file_editor.discard_reload" : "file_editor.discard")}
            </Button>
            <Button
              type="button"
              variant="solid"
              size="md"
              tone="accent"
              aria-disabled={leaveSaving() || undefined}
              aria-busy={leaveSaving() || undefined}
              data-ui="file-editor-save-and-leave"
              onClick={() => void saveAndLeave()}
            >
              {leaveSaving() ? t("common.saving") : t(leavePrompt().reason === "reload" ? "file_editor.save_reload" : "file_editor.save_continue")}
            </Button>
          </>
        }
      >
        <p>
          {t(leavePrompt().reason === "reload" ? "file_editor.reload_unsaved_message" : "file_editor.unsaved_message")}
        </p>
        <p class="file-editor-dialog-path">
          <bdi>{leavePrompt().path}</bdi>
        </p>
        <Show when={error()}>{(failure) =>
            <Feedback class="file-editor-compare-feedback" tone={isUnconfirmedSave(failure().messageKey) ? "warning" : "error"}
              details={fileErrorDetails(failure())} actions={saveComparisonAction()}>
            {currentErrorMessage()}
          </Feedback>
        }
        </Show>
      </Dialog>
      <Dialog
        id="fileEditorComparisonDialog"
        open={comparison() !== null}
        title={t("file_editor.compare_title", { path: fileTitleLabel() })}
        wide
        formClass="file-comparison-frame"
        onClose={retireComparison}
        onCloseAutoFocus={(event) => {
          const generation = adoptedComparisonGeneration
          adoptedComparisonGeneration = undefined
          if (generation !== loadGeneration || error()) return
          const action = document.querySelector<HTMLButtonElement>(
            leaveDialogOpen()
              ? '#fileEditorUnsavedDialog [data-ui="file-editor-leave-cancel"]'
              : '#centerWorkbenchFile [data-ui="file-editor-compare"]',
          )
          if (
            !action?.isConnected || action.disabled || action.getAttribute("aria-disabled") === "true" ||
            !action.getClientRects().length
          ) return
          event.preventDefault()
          action.focus({ preventScroll: true })
        }}
        footer={
          <>
            <Button type="button" variant="ghost" size="md" tone="neutral"
                aria-disabled={comparisonUnavailable() || undefined}
                aria-busy={comparisonReading() || undefined}
                onClick={() => void compareWithDisk(false)}>
              {t(comparisonReading() ? "common.loading" : "file_editor.compare_refresh")}
            </Button>
            <Show when={comparedDiskForBase()}>
              <Button type="button" variant="outline" size="md" tone="accent"
                aria-disabled={comparisonAdoptionUnavailable() || undefined} onClick={adoptComparedDiskBase}>
                {t("file_editor.compare_adopt_disk")}
              </Button>
            </Show>
            <Button type="button" variant="solid" size="md" tone="neutral" onClick={retireComparison}>
              {t("common.close")}
            </Button>
          </>
        }
      >
        <Show when={comparison()}>
          {(read) => (
            <div class="file-comparison-content">
              <p class="file-editor-dialog-path">
                <bdi>{projectFileLocation(read().target)}</bdi>
              </p>
              <p class="file-comparison-hint">{t("file_editor.compare_hint")}</p>
              <Show when={comparisonOutdated()} fallback={
                <Show when={comparedDiskForBase()}>
                  <Feedback tone="warning">{t("file_editor.compare_adopt_hint")}</Feedback>
                </Show>
              }>
                <Feedback tone="warning">{t("file_editor.compare_disk_outdated")}</Feedback>
              </Show>
              <SegmentedControl<ComparisonMode>
                value={comparisonMode()} onChange={setComparisonMode} ariaLabel={t("file_editor.compare_versions")}
                options={[
                  { value: "disk-draft", label: t("file_editor.compare_disk_draft") },
                  { value: "base-disk", label: t("file_editor.compare_base_disk") },
                  { value: "base-draft", label: t("file_editor.compare_base_draft") },
                ]}
              />
              <Switch>
                <Match when={read().status === "loading"}>
                  <Feedback tone="neutral">{t("common.loading")}</Feedback>
                </Match>
                <Match when={read().status === "failed"}>
                  <Feedback tone="error" details={read().status === "failed" ? formatErrorDetails((read() as Extract<FileComparison, { status: "failed" }>).cause) : undefined}>
                    {t("file_editor.compare_failed")}
                  </Feedback>
                </Match>
                <Match when={read().status === "loaded" && !canEdit(comparisonDiskContent())}>
                  <Feedback tone="warning">{t("file_editor.compare_non_text")}</Feedback>
                </Match>
              </Switch>
              <Show when={comparisonPair()}>
                {(pair) => (
                  <>
                    <div class="file-comparison-labels">
                      <span>− {t(pair().left)}</span><span>+ {t(pair().right)}</span>
                    </div>
                    <div
                      class="file-comparison-diff"
                      tabIndex={0}
                      role="region"
                      aria-label={t("file_editor.compare_result", { before: t(pair().left), after: t(pair().right) })}
                    >
                      <TextDiffView before={pair().before} after={pair().after} showLineHeader={pair().before !== pair().after} />
                    </div>
                  </>
                )}
              </Show>
            </div>
          )}
        </Show>
      </Dialog>
    </section>
  )
}
