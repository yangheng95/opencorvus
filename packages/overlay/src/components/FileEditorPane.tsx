import { batch, createEffect, createMemo, createSignal, lazy, onCleanup, Show, untrack } from "solid-js"
import { ApiError, apiJson, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import {
  closeFileEditor,
  fileEditorRevealRevision,
  fileEditorReserved,
  registerFileEditorBeforeNavigate,
  selectedFileTarget,
  shortWorkbenchPath,
  type FileContent,
  type FileEditorTarget,
} from "../services/file-workbench"
import { projectScopedPath } from "../services/project-directory"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
// CodeMirror and its Lezer grammars are only needed once a file is actually
// open. This pane stays mounted to keep its state, so the editor itself is what
// loads on demand.
const CodeEditor = lazy(async () => ({ default: (await import("./ui/CodeEditor")).CodeEditor }))
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"

function fileContentPath(target: FileEditorTarget): string {
  const query = new URLSearchParams({
    path: target.sourceAbsolutePath || target.path,
    directory: target.directory,
  })
  return `file/${target.sourceAbsolutePath ? "source-content" : "content"}?${query.toString()}`
}

async function readFileContent(target: FileEditorTarget | null, authority: ApiAuthority): Promise<FileContent | null> {
  if (!target) return null
  return (await apiJson(fileContentPath(target), { authority })) as FileContent
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

function errorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.body &&
    typeof error.body === "object" &&
    (error.body as { name?: unknown }).name === "FileWriteConflictError"
  )
    return t("file_editor.save_conflict")
  return error instanceof Error ? error.message : String(error)
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

export function FileEditorPane() {
  const [draft, setDraft] = createSignal("")
  const [savedBaseline, setSavedBaseline] = createSignal<Pick<FileContent, "content" | "revision"> | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [reloading, setReloading] = createSignal(false)
  const [error, setError] = createSignal("")
  const [loadError, setLoadError] = createSignal("")
  const [leaveDialogOpen, setLeaveDialogOpen] = createSignal(false)
  const [leaveSaving, setLeaveSaving] = createSignal(false)
  const [leaveReason, setLeaveReason] = createSignal<"leave" | "reload">("leave")
  let pendingLeaveDecision: Promise<number | null> | undefined
  let settleLeaveDecision: ((revision: number | null) => void) | undefined
  let decisionRevision = 0
  let loadGeneration = 0
  let draftRevision = 0
  let saveGeneration = 0
  let reloadGeneration = 0
  let activeTargetIdentity = ""

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
  const path = createMemo(() => target()?.path ?? "")
  const contentLoadError = createMemo(() => loadError())
  const textContent = createMemo(() => canEdit(content()))
  const writable = createMemo(() => textContent() && !target()?.sourceAbsolutePath)
  const dirty = createMemo(() => writable() && draft() !== savedBaseline()?.content)
  const identityOf = (file: FileEditorTarget | null) => file
    ? `${file.directory}\u0000${file.path}\u0000${file.sourceAbsolutePath ?? ""}` : ""
  const isBusy = () => loading() || saving() || reloading() || identityOf(target()) !== activeTargetIdentity

  const applyContent = (next: FileContent | null) => batch(() => {
    setContent(next)
    setError("")
    draftRevision += 1
    setDraft(canEdit(next) ? next!.content : "")
    setSavedBaseline(canEdit(next) ? { content: next!.content, revision: next!.revision } : null)
  })

  createEffect(() => {
    const file = contentTarget()
    const authority = captureApiAuthority()
    untrack(() => {
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
      setLoadError("")
      if (!file) return
      setLoading(true)
      const current = () => generation === loadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)
      void readFileContent(file, authority).then((next) => {
        if (current()) applyContent(next)
      }, (cause) => {
        if (current()) setLoadError(errorMessage(cause))
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
      setError(t("file_editor.revision_required"))
      return false
    }
    const authority = captureApiAuthority()
    const submittedDraft = draft()
    const submittedRevision = draftRevision
    const requestGeneration = ++saveGeneration
    setSaving(true)
    setError("")
    try {
      const next = await writeFileContent(file, submittedDraft, expectedRevision, authority)
      if (requestGeneration !== saveGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return false
      setSavedBaseline({ content: next.content, revision: next.revision })
      const ownsSubmittedDraft = draftRevision === submittedRevision
      if (ownsSubmittedDraft) setDraft(next.content)
      draftRevision += 1
      return ownsSubmittedDraft
    } catch (err) {
      if (requestGeneration === saveGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) setError(errorMessage(err))
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
    setLeaveDialogOpen(false)
    setLeaveSaving(false)
    settle?.(allowed ? approvedRevision : null)
  }

  const decideBeforeNavigate = (reason: "leave" | "reload" = "leave"): Promise<number | null> => {
    if (fileEditorReserved() || isBusy()) return Promise.resolve(null)
    if (!dirty()) return Promise.resolve(draftRevision)
    if (pendingLeaveDecision) return pendingLeaveDecision
    decisionRevision = draftRevision
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
    loadGeneration += 1
    reloadGeneration += 1
    saveGeneration += 1
    unregisterBeforeNavigate()
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
    setError("")
    try {
      const next = await readFileContent(file, authority)
      if (generation !== reloadGeneration || !ownsFileTarget(file) || !isApiAuthorityCurrent(authority)) return
      if (draftRevision !== requestedDraftRevision) {
        setError(t("file_editor.reload_edited"))
        return
      }
      setLoadError("")
      applyContent(next)
    } catch (cause) {
      if (generation === reloadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) setError(errorMessage(cause))
    } finally {
      if (generation === reloadGeneration && ownsFileTarget(file) && isApiAuthorityCurrent(authority)) setReloading(false)
    }
  }

  const closeCurrentFile = async (): Promise<void> => {
    const file = target()
    const authority = captureApiAuthority()
    const generation = loadGeneration
    try {
      await closeFileEditor()
    } catch (cause) {
      if (generation === loadGeneration && isApiAuthorityCurrent(authority) && (!file || ownsFileTarget(file))) {
        setError(errorMessage(cause))
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
          <div class="file-editor-title" title={path()}>
            <span class="file-editor-title-name">{shortWorkbenchPath(path())}</span>
            <Show when={dirty()}>
              <span class="file-editor-dirty" aria-label={t("file_editor.unsaved")}>
                *
              </span>
            </Show>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone={dirty() ? "accent" : "neutral"}
            data-ui="file-editor-save"
            data-dirty={dirty() ? "true" : "false"}
            title={`${t("common.save")} (Ctrl/Cmd+S)`}
            aria-keyshortcuts="Control+s Meta+s"
            disabled={!dirty() || isBusy() || fileEditorReserved()}
            onClick={() => void save()}
          >
            {saving() ? t("common.saving") : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-ui="file-editor-reload"
            disabled={isBusy() || fileEditorReserved()}
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
            disabled={isBusy() || fileEditorReserved()}
            onClick={() => void closeCurrentFile()}
            title={t("workspace.close")}
            aria-label={t("workspace.close")}
          >
            <Icon name="close" />
          </Button>
        </header>
        <div class="file-editor-body">
          <Show
            when={!loading()}
            fallback={
              <div class="file-editor-empty">
                <p>{t("diff.loading")}</p>
              </div>
            }
          >
            <Show
              when={!contentLoadError()}
              fallback={
                <div
                  class="file-editor-empty"
                  data-ui="file-editor-load-error"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <Icon name="status-failed" size="medium" />
                  <p>{t("file_editor.load_failed", { message: contentLoadError() })}</p>
                </div>
              }
            >
              <Show
                when={textContent()}
                fallback={
                  <div class="file-editor-empty">
                    <Icon name="file-document" size="medium" />
                    <p>{t("file_editor.binary")}</p>
                  </div>
                }
              >
                <CodeEditor
                  value={draft()}
                  path={path()}
                  lineRange={target()?.range}
                  lineRangeRevealRevision={fileEditorRevealRevision()}
                  ariaLabel={t("file_editor.title")}
                  onValueChange={updateDraft}
                  readOnly={!!target()?.sourceAbsolutePath || fileEditorReserved()}
                />
              </Show>
            </Show>
          </Show>
        </div>
        <Show when={error()}>
          <footer class="file-editor-error" role="alert" aria-live="assertive" aria-atomic="true">
            {error()}
          </footer>
        </Show>
      </Show>
      <Dialog
        id="fileEditorUnsavedDialog"
        open={leaveDialogOpen()}
        title={t("file_editor.unsaved")}
        backdropClose={false}
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
              disabled={leaveSaving()}
              onClick={() => finishLeaveDecision(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="danger"
              disabled={leaveSaving()}
              data-ui="file-editor-discard"
              onClick={() => finishLeaveDecision(true)}
            >
              {t(leaveReason() === "reload" ? "file_editor.discard_reload" : "file_editor.discard")}
            </Button>
            <Button
              type="button"
              variant="solid"
              size="md"
              tone="accent"
              disabled={leaveSaving()}
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
        <Show when={error()}>
          <Feedback tone="error">{error()}</Feedback>
        </Show>
      </Dialog>
    </section>
  )
}
