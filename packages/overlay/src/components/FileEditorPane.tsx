import { batch, createEffect, createMemo, createSignal, lazy, Match, onCleanup, Show, Switch, untrack } from "solid-js"
import { base64ToUint8 } from "@opencorvus-ai/transport-protocol"
import { ApiError, apiJson, apiRequest, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import {
  closeFileEditor,
  fileEditorRevealRevision,
  fileEditorReserved,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
  type FileContent,
  type FileEditorTarget,
} from "../services/file-workbench"
import { projectScopedPath } from "../services/project-directory"
import { downloadBlob } from "../services/file-download"
import { t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { restoreRightDockFocus } from "../utils/right-dock-focus"
import { pathWithForwardSeparators } from "../utils/server-path"
import { bytesToArrayBuffer } from "../utils/binary"
import { Icon } from "./ui/Icon"
// CodeMirror and its Lezer grammars are only needed once a file is actually
// open. This pane stays mounted to keep its state, so the editor itself is what
// loads on demand.
const CodeEditor = lazy(async () => ({ default: (await import("./ui/CodeEditor")).CodeEditor }))
const PdfPreview = lazy(async () => ({ default: (await import("./PdfPreview")).PdfPreview }))
import { Button } from "./ui/Button"
import { Badge } from "./ui/Badge"
import { Dialog } from "./ui/Dialog"
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

function saveFailureMessageKey(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object"
  ) {
    const name = (error.body as { name?: unknown }).name
    if (error.status === 409 && name === "FileWriteConflictError") return "file_editor.save_conflict"
    if (error.status === 404 && name === "FileNotFoundError") return "file_editor.save_missing"
  }
  return "file_editor.save_failed"
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

type FileEditorFailure = { messageKey: string; cause?: unknown }
type ComparisonMode = "disk-draft" | "base-disk" | "base-draft"
type FileComparison = {
  target: FileEditorTarget
  authority: ApiAuthority
  controller: AbortController
} & (
  | { status: "loading" }
  | { status: "loaded"; content: FileContent | null }
  | { status: "failed"; cause: unknown }
)

export function FileEditorPane() {
  const [draft, setDraft] = createSignal("")
  const [savedBaseline, setSavedBaseline] = createSignal<Pick<FileContent, "content" | "revision"> | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [reloading, setReloading] = createSignal(false)
  const [downloading, setDownloading] = createSignal(false)
  const [error, setError] = createSignal<FileEditorFailure | null>(null)
  const [loadFailure, setLoadFailure] = createSignal<{ error: unknown } | null>(null)
  const [leaveDialogOpen, setLeaveDialogOpen] = createSignal(false)
  const [leaveSaving, setLeaveSaving] = createSignal(false)
  const [leaveReason, setLeaveReason] = createSignal<"leave" | "reload">("leave")
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
  let draftRevision = 0
  let saveGeneration = 0
  let reloadGeneration = 0
  let activeTargetIdentity = ""
  let downloadController: AbortController | undefined

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

  const [content, setContent] = createSignal<FileContent | null>(null)
  const [loading, setLoading] = createSignal(false)
  const target = createMemo(() => selectedFileTarget())
  const revealFocusOrigin = createMemo(() => {
    fileEditorRevealRevision()
    return document.activeElement
  })
  const path = createMemo(() => target()?.path ?? "")
  const displayName = createMemo(() => target()?.displayName ?? content()?.displayName)
  const fileTitle = createMemo(() => displayName() ?? pathWithForwardSeparators(
    path(), target()?.sourceAbsolutePath || target()?.directory || "",
  ).split("/").at(-1) ?? "")
  const textContent = createMemo(() => canEdit(content()))
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
  const projectBinary = createMemo(() => content()?.type === "binary" && !target()?.sourceAbsolutePath)
  const downloadable = () => textContent() || content()?.encoding === "base64" || projectBinary()
  const identityOf = (file: FileEditorTarget | null) => file
    ? `${file.directory}\u0000${file.path}\u0000${file.sourceAbsolutePath ?? ""}` : ""
  const resourceReady = () => !loading() && identityOf(target()) === activeTargetIdentity
  const isBusy = () => !resourceReady() || saving() || reloading()
  const currentErrorMessage = () => {
    const failure = error()
    return failure && t(failure.messageKey)
  }

  const comparisonPair = createMemo(() => {
    const read = comparison()
    const baseline = savedBaseline()
    if (read?.status !== "loaded" || !canEdit(read.content) || !baseline) return undefined
    const disk = read.content!.content
    switch (comparisonMode()) {
      case "base-disk":
        return { before: baseline.content, after: disk, left: "file_editor.compare_base", right: "file_editor.compare_disk" }
      case "base-draft":
        return { before: baseline.content, after: draft(), left: "file_editor.compare_base", right: "file_editor.compare_draft" }
      case "disk-draft":
        return { before: disk, after: draft(), left: "file_editor.compare_disk", right: "file_editor.compare_draft" }
    }
  })
  const retireComparison = () => {
    comparison()?.controller.abort()
    setComparison(null)
  }
  const compareWithDisk = async (resetMode = true) => {
    const file = target()
    if (!file || !writable() || !savedBaseline() || isBusy() || fileEditorReserved()) return
    comparison()?.controller.abort()
    if (resetMode) setComparisonMode("disk-draft")
    const authority = captureApiAuthority()
    const controller = new AbortController()
    const request = { target: file, authority, controller }
    setComparison({ ...request, status: "loading" })
    const current = () => comparison()?.controller === controller && !controller.signal.aborted &&
      ownsFileTarget(file) && isApiAuthorityCurrent(authority)
    try {
      const next = await readFileContent(file, authority, controller.signal)
      if (current()) setComparison({ ...request, status: "loaded", content: next })
    } catch (cause) {
      if (current()) setComparison({ ...request, status: "failed", cause })
    }
  }
  const conflictComparisonAction = () => error()?.messageKey === "file_editor.save_conflict" ? (
      <Button type="button" variant="outline" size="sm" tone="neutral"
        disabled={!resourceReady() || fileEditorReserved()} aria-disabled={isBusy() || fileEditorReserved() || undefined}
        onClick={() => void compareWithDisk()}>
        {t("file_editor.compare")}
      </Button>
  ) : undefined

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
    setError(null)
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
      if (current()) downloadBlob(blob, filename)
    } catch (cause) {
      if (current() && !controller.signal.aborted) setError({ messageKey: "file.download_failed", cause })
    } finally {
      if (downloadController === controller) {
        downloadController = undefined
        setDownloading(false)
      }
    }
  }

  const applyContent = (next: FileContent | null) => batch(() => {
    setContent(next)
    setError(null)
    draftRevision += 1
    setDraft(canEdit(next) ? next!.content : "")
    setSavedBaseline(canEdit(next) ? { content: next!.content, revision: next!.revision } : null)
  })

  createEffect(() => {
    const file = contentTarget()
    const authority = captureApiAuthority()
    untrack(() => {
      retireComparison()
      retireDownload()
      const identity = identityOf(file)
      const retainDraft = identity === activeTargetIdentity && dirty()
      activeTargetIdentity = identity
      const generation = ++loadGeneration
      saveGeneration += 1
      reloadGeneration += 1
      setSaving(false)
      setReloading(false)
      setLoading(false)
      finishLeaveDecision(false)
      if (retainDraft) return
      applyContent(null)
      setLoadFailure(null)
      if (!file) return
      setLoading(true)
      const current = () => generation === loadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)
      void readFileContent(file, authority).then((next) => {
        if (current()) applyContent(next)
      }, (cause) => {
        if (current()) setLoadFailure({ error: cause })
      }).finally(() => {
        if (current()) setLoading(false)
      })
    })
  })

  const save = async (): Promise<boolean> => {
    const file = target()
    if (fileEditorReserved() || isBusy()) return false
    if (!file || !writable() || !dirty()) return !dirty()
    const expectedRevision = savedBaseline()?.revision
    if (!expectedRevision) {
      setError({ messageKey: "file_editor.revision_required" })
      return false
    }
    const authority = captureApiAuthority()
    const submittedDraft = draft()
    const submittedRevision = draftRevision
    const requestGeneration = ++saveGeneration
    setSaving(true)
    setError(null)
    try {
      const next = await writeFileContent(file, submittedDraft, expectedRevision, authority)
      if (requestGeneration !== saveGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return false
      setSavedBaseline({ content: next.content, revision: next.revision })
      const ownsSubmittedDraft = draftRevision === submittedRevision
      if (ownsSubmittedDraft) setDraft(next.content)
      draftRevision += 1
      return ownsSubmittedDraft
    } catch (err) {
      if (requestGeneration === saveGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) {
        setError({ messageKey: saveFailureMessageKey(err), cause: err })
      }
      return false
    } finally {
      if (requestGeneration === saveGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) setSaving(false)
    }
  }

  const updateDraft = (next: string) => {
    if (fileEditorReserved()) return
    draftRevision += 1
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
    if (!dirty()) return Promise.resolve(draftRevision)
    if (pendingLeaveDecision) return pendingLeaveDecision
    decisionRevision = draftRevision
    const focused = document.activeElement
    leaveFocus = focused instanceof HTMLElement
      ? { element: focused, targetIdentity: activeTargetIdentity, authority: captureApiAuthority() }
      : undefined
    setLeaveReason(reason)
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
  })
  onCleanup(() => {
    retireComparison()
    retireDownload()
    loadGeneration += 1
    reloadGeneration += 1
    saveGeneration += 1
    unregisterBeforeNavigate()
    leaveFocus = undefined
    finishLeaveDecision(false)
  })

  const reload = async (): Promise<void> => {
    const file = target()
    if (!file || fileEditorReserved() || isBusy()) return
    const generation = ++reloadGeneration
    const authority = captureApiAuthority()
    const approvedRevision = await decideBeforeNavigate("reload")
    if (approvedRevision === null || approvedRevision !== draftRevision || fileEditorReserved()) return
    if (generation !== reloadGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return
    const requestedDraftRevision = draftRevision
    setReloading(true)
    setError(null)
    try {
      const next = await readFileContent(file, authority)
      if (generation !== reloadGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return
      if (draftRevision !== requestedDraftRevision) {
        setError({ messageKey: "file_editor.reload_edited" })
        return
      }
      setLoadFailure(null)
      applyContent(next)
    } catch (cause) {
      if (generation === reloadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) {
        if (loadFailure()) setLoadFailure({ error: cause })
        else setError({ messageKey: "file_editor.reload_failed", cause })
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
          event.isComposing ||
          event.altKey ||
          event.shiftKey ||
          !(event.ctrlKey || event.metaKey) ||
          event.key.toLowerCase() !== "s"
        )
          return
        event.preventDefault()
        void save()
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
        <header class="file-editor-header">
          <div class="file-editor-title" title={[displayName(), target()?.sourceAbsolutePath || path()].filter(Boolean).join("\n")}>
            <span class="file-editor-title-name">{fileTitle()}</span>
            <Show when={dirty()}>
              <span class="file-editor-dirty" aria-label={t("file_editor.unsaved")}>
                *
              </span>
            </Show>
          </div>
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
                {saving() ? t("common.saving") : t("common.save")}
              </Button>
            }
          >
            <Badge tone="neutral" size="sm">{t("file_editor.read_only")}</Badge>
          </Show>
          <Show when={writable()}>
            <Button type="button" variant="ghost" size="icon" tone="neutral"
              data-ui="file-editor-compare" disabled={!resourceReady() || fileEditorReserved()}
              aria-disabled={isBusy() || fileEditorReserved() || undefined}
              title={t("file_editor.compare")} aria-label={t("file_editor.compare")}
              onClick={() => void compareWithDisk()}>
              <Icon name="git-compare" />
            </Button>
          </Show>
          <Show when={downloadable()}>
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
            title={t("file_editor.close", { path: fileTitle() })}
            aria-label={t("file_editor.close", { path: fileTitle() })}
          >
            <Icon name="close" />
          </Button>
        </header>
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
                  title={t("file_editor.load_failed")}
                  details={loadFailure() ? formatErrorDetails(loadFailure()!.error) : undefined}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      disabled={!resourceReady() || fileEditorReserved()}
                      aria-disabled={isBusy() || fileEditorReserved() || undefined}
                      aria-busy={reloading() || undefined}
                      onClick={() => void reload()}
                    >
                      {reloading() ? t("common.loading") : t("common.retry")}
                    </Button>
                  }
                >
                  {t("file_editor.load_failed_hint")}
                </Feedback>
              }
            >
              <Switch fallback={
                <div class="file-editor-empty">
                  <Icon name="file-document" size="medium" />
                  <p>{t(projectBinary() ? "file_editor.binary_download_hint" : "file_editor.binary")}</p>
                  <Show when={projectBinary()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      disabled={!resourceReady() || fileEditorReserved()}
                      aria-disabled={isBusy() || fileEditorReserved() || downloading() || undefined}
                      aria-busy={downloading() || undefined}
                      onClick={() => void downloadCurrentFile()}
                    >
                      {t(downloading() ? "file.downloading" : "file.download")}
                    </Button>
                  </Show>
                </div>
              }>
                <Match when={imageSource()}>
                  {(src) => <div class="file-editor-image"><PreviewableImage src={src()} alt={displayName() ?? path()} /></div>}
                </Match>
                <Match when={pdfSource()}>
                  {(url) => <PdfPreview url={url()} label={displayName() ?? path()} class="file-editor-pdf" />}
                </Match>
                <Match when={textContent()}>
                  <CodeEditor
                    value={draft()}
                    path={path()}
                    lineRange={target()?.range}
                    revealRevision={fileEditorRevealRevision()}
                    revealFocusOrigin={revealFocusOrigin()}
                    ariaLabel={fileTitle()}
                    onValueChange={updateDraft}
                    readOnly={!writable() || fileEditorReserved()}
                  />
                </Match>
              </Switch>
            </Show>
          </Show>
        </div>
        <Show when={error()}>{(failure) =>
          <Feedback
              class="file-editor-error file-editor-compare-feedback"
            tone="error"
            details={formatErrorDetails(failure().cause) || undefined}
            actions={conflictComparisonAction()}
          >
            {currentErrorMessage()}
          </Feedback>
        }
        </Show>
      </Show>
      <Dialog
        id="fileEditorUnsavedDialog"
        open={leaveDialogOpen()}
        title={t("file_editor.unsaved")}
        backdropClose={false}
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
              aria-disabled={leaveSaving() || undefined}
              onClick={() => { if (!leaveSaving()) finishLeaveDecision(false) }}
            >
              {t("common.cancel")}
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
              {t(leaveReason() === "reload" ? "file_editor.discard_reload" : "file_editor.discard")}
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
              {leaveSaving() ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <p>
          {t(leaveReason() === "reload" ? "file_editor.reload_unsaved_message" : "file_editor.unsaved_message", {
            path: path(),
          })}
        </p>
        <Show when={error()}>{(failure) =>
            <Feedback class="file-editor-compare-feedback" tone="error" details={formatErrorDetails(failure().cause) || undefined} actions={conflictComparisonAction()}>
            {currentErrorMessage()}
          </Feedback>
        }
        </Show>
      </Dialog>
      <Dialog
        id="fileEditorComparisonDialog"
        open={comparison() !== null}
        title={t("file_editor.compare_title", { path: fileTitle() })}
        wide
        formClass="file-comparison-frame"
        onClose={retireComparison}
        footer={
          <>
            <Button type="button" variant="ghost" size="md" tone="neutral"
                onClick={() => void compareWithDisk(false)}>
              {t("file_editor.compare_refresh")}
            </Button>
            <Button type="button" variant="solid" size="md" tone="neutral" onClick={retireComparison}>
              {t("common.close")}
            </Button>
          </>
        }
      >
        <Show when={comparison()}>
          {(read) => (
            <div class="file-comparison-content">
              <p class="file-comparison-path">{read().target.path}</p>
              <p class="file-comparison-hint">{t("file_editor.compare_hint")}</p>
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
                <Match when={read().status === "loaded"}>
                  <Show when={comparisonPair()} fallback={<Feedback tone="warning">{t("file_editor.compare_non_text")}</Feedback>}>
                    {(pair) => (
                      <>
                        <div class="file-comparison-labels">
                          <span>− {t(pair().left)}</span><span>+ {t(pair().right)}</span>
                        </div>
                        <div class="file-comparison-diff" tabIndex={0} role="region" aria-label={t("file_editor.compare_versions")}>
                          <TextDiffView before={pair().before} after={pair().after} />
                        </div>
                      </>
                    )}
                  </Show>
                </Match>
              </Switch>
            </div>
          )}
        </Show>
      </Dialog>
    </section>
  )
}
