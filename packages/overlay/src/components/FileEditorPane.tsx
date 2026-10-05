import { createEffect, createMemo, createResource, createSignal, lazy, onCleanup, Show } from "solid-js"
import { ApiError, apiJson } from "../services/api"
import {
  closeFileEditor,
  fileEditorRevealRevision,
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

async function readFileContent(target: FileEditorTarget | null): Promise<FileContent | null> {
  if (!target) return null
  return (await apiJson(fileContentPath(target))) as FileContent
}

async function writeFileContent(
  target: FileEditorTarget,
  content: string,
  expectedRevision: string,
): Promise<FileContent> {
  if (target.sourceAbsolutePath) throw new Error("Absolute source files are read-only")
  return (await apiJson(projectScopedPath("file/content", target.directory), {
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
  let pendingLeaveDecision: Promise<boolean> | undefined
  let settleLeaveDecision: ((allowed: boolean) => void) | undefined
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

  const [content, { mutate: setContent }] = createResource(contentTarget, async (target) => {
    try {
      const next = await readFileContent(target)
      if (target && ownsFileTarget(target)) setLoadError("")
      return next
    } catch (err) {
      if (target && ownsFileTarget(target)) setLoadError(errorMessage(err))
      return null
    }
  })

  createEffect(() => {
    const current = selectedFileTarget()
    const identity = current ? `${current.directory}\u0000${current.path}` : ""
    if (identity === activeTargetIdentity) return
    activeTargetIdentity = identity
    saveGeneration += 1
    reloadGeneration += 1
    draftRevision += 1
    setSaving(false)
    setReloading(false)
  })

  createEffect(() => {
    const next = content()
    setError("")
    draftRevision += 1
    if (!canEdit(next)) {
      setDraft("")
      setSavedBaseline(null)
      return
    }
    setDraft(next!.content)
    setSavedBaseline({ content: next!.content, revision: next!.revision })
  })

  const target = createMemo(() => selectedFileTarget())
  const path = createMemo(() => target()?.path ?? "")
  const contentLoadError = createMemo(() => loadError())
  const textContent = createMemo(() => canEdit(content()))
  const writable = createMemo(() => textContent() && !target()?.sourceAbsolutePath)
  const dirty = createMemo(() => writable() && draft() !== savedBaseline()?.content)

  const save = async (): Promise<boolean> => {
    const file = target()
    if (!file || !writable() || !dirty() || saving() || reloading()) return !dirty()
    const expectedRevision = savedBaseline()?.revision
    if (!expectedRevision) {
      setError(t("file_editor.revision_required"))
      return false
    }
    const submittedDraft = draft()
    const submittedRevision = draftRevision
    const requestGeneration = ++saveGeneration
    setSaving(true)
    setError("")
    try {
      const next = await writeFileContent(file, submittedDraft, expectedRevision)
      if (requestGeneration !== saveGeneration || !ownsFileTarget(file)) return false
      setSavedBaseline({ content: next.content, revision: next.revision })
      const ownsSubmittedDraft = draftRevision === submittedRevision
      if (ownsSubmittedDraft) setDraft(next.content)
      return ownsSubmittedDraft
    } catch (err) {
      if (requestGeneration === saveGeneration && ownsFileTarget(file)) setError(errorMessage(err))
      return false
    } finally {
      if (requestGeneration === saveGeneration && ownsFileTarget(file)) setSaving(false)
    }
  }

  const updateDraft = (next: string) => {
    draftRevision += 1
    setDraft(next)
  }

  const finishLeaveDecision = (allowed: boolean) => {
    const settle = settleLeaveDecision
    settleLeaveDecision = undefined
    pendingLeaveDecision = undefined
    setLeaveDialogOpen(false)
    settle?.(allowed)
  }

  const decideBeforeNavigate = (reason: "leave" | "reload" = "leave"): Promise<boolean> => {
    if (!dirty()) return Promise.resolve(true)
    if (pendingLeaveDecision) return pendingLeaveDecision
    setLeaveReason(reason)
    setLeaveDialogOpen(true)
    pendingLeaveDecision = new Promise<boolean>((resolve) => {
      settleLeaveDecision = resolve
    })
    return pendingLeaveDecision
  }

  const unregisterBeforeNavigate = registerFileEditorBeforeNavigate(decideBeforeNavigate)
  onCleanup(() => {
    reloadGeneration += 1
    saveGeneration += 1
    unregisterBeforeNavigate()
    finishLeaveDecision(false)
  })

  const reload = async (): Promise<void> => {
    const file = target()
    if (!file || saving() || reloading()) return
    const generation = ++reloadGeneration
    if (!(await decideBeforeNavigate("reload"))) return
    if (generation !== reloadGeneration || !ownsFileTarget(file)) return
    const requestedDraftRevision = draftRevision
    setReloading(true)
    setError("")
    try {
      const next = await readFileContent(file)
      if (generation !== reloadGeneration || !ownsFileTarget(file)) return
      if (draftRevision !== requestedDraftRevision) {
        setError(t("file_editor.reload_edited"))
        return
      }
      setLoadError("")
      setContent(next)
    } catch (cause) {
      if (generation === reloadGeneration && ownsFileTarget(file)) setError(errorMessage(cause))
    } finally {
      if (generation === reloadGeneration && ownsFileTarget(file)) setReloading(false)
    }
  }

  const saveAndLeave = async () => {
    if (leaveSaving()) return
    setLeaveSaving(true)
    try {
      if (await save()) finishLeaveDecision(true)
    } finally {
      setLeaveSaving(false)
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
            disabled={!dirty() || saving() || reloading()}
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
            disabled={saving() || reloading() || content.loading}
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
            onClick={() => void closeFileEditor()}
            title={t("workspace.close")}
            aria-label={t("workspace.close")}
          >
            <Icon name="close" />
          </Button>
        </header>
        <div class="file-editor-body">
          <Show
            when={!content.loading}
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
                  readOnly={!!target()?.sourceAbsolutePath}
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
