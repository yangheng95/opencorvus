import { isDecodableText } from "@opencorvus-ai/util/text-mime"
import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { apiJson, isApiAuthorityCurrent } from "../services/api"
import { attachmentPreviewState, closeAttachmentPreview } from "../services/attachment-preview"
import { attachmentDownloadFilename, type StoredAttachmentReference } from "../services/attachment-reference"
import { boardStore } from "../store/board"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { FilePart } from "./FilePart"
import { createResourceTextRead, ResourceTextDownload, ResourceTextPreview } from "./ResourceTextPreview"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"

export function AttachmentPreviewHost() {
  const [reference, setReference] = createSignal<StoredAttachmentReference>()
  const [error, setError] = createSignal<unknown>()
  const [loading, setLoading] = createSignal(false)
  const [attempt, setAttempt] = createSignal(0)
  let retryOrigin: HTMLButtonElement | undefined
  let closeButton: HTMLButtonElement | undefined
  const current = () => {
    const entry = attachmentPreviewState()
    return !!entry && isApiAuthorityCurrent(entry.authority) && boardStore.selectEpoch === entry.selection
  }
  createEffect(() => {
    if (attachmentPreviewState()?.open && !current()) closeAttachmentPreview()
  })
  createEffect(() => {
    attachmentPreviewState()
    retryOrigin = undefined
    setError(undefined)
  })
  createEffect(() => {
    const entry = attachmentPreviewState()
    attempt()
    const origin = retryOrigin
    retryOrigin = undefined
    setReference(undefined)
    setLoading(false)
    if (!entry?.open || !current()) return
    if (entry.reference) {
      setReference(entry.reference)
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    setLoading(true)
    void apiJson<StoredAttachmentReference>(`${entry.url}/reference`, {
      authority: entry.authority, signal: controller.signal,
    }).then((value) => {
      if (controller.signal.aborted) return
      const restoreFocus = origin && (document.activeElement === origin ||
        (!origin.isConnected && document.activeElement === document.body))
      setReference(value)
      setError(undefined)
      if (restoreFocus) closeButton?.focus({ preventScroll: true })
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
  })
  const open = () => !!attachmentPreviewState()?.open && current()
  const label = () => reference()?.filename ?? attachmentPreviewState()?.label ?? ""
  const text = () => {
    const value = reference()
    return !!value && isDecodableText(value.mime, value.filename)
  }
  const textRead = createResourceTextRead(() => {
    const value = reference()
    return open() && value && text()
      ? { url: value.url, mime: value.mime, authority: attachmentPreviewState()!.authority }
      : undefined
  })
  return (
    <Dialog
      open={open()}
      wide
      class="attachment-preview-dialog"
      formClass="attachment-preview-dialog__frame"
      title={label()}
      returnFocusTarget={() => current() ? attachmentPreviewState()?.trigger ?? null : null}
      onClose={closeAttachmentPreview}
      footer={<>
        <Show when={reference()}>{(value) => <Show when={text()}>
          <ResourceTextDownload read={textRead} filename={attachmentDownloadFilename(value())} label={label()} />
        </Show>}</Show>
        <Button ref={closeButton} type="button" variant="outline" size="sm" tone="neutral" onClick={closeAttachmentPreview}>
          {t("common.close")}
        </Button>
      </>}
    >
      <div class="attachment-preview-dialog__body">
        <Show when={open()}>
          <Show when={!error()} fallback={
            <Feedback tone="error" details={formatErrorDetails(error())} actions={
              <Button type="button" variant="outline" size="sm" tone="neutral"
                aria-disabled={loading() || undefined} aria-busy={loading() || undefined}
                aria-label={`${t("file.retry_preview")}: ${label()}`}
                onClick={(event) => {
                  if (loading()) return
                  retryOrigin = event.currentTarget
                  setAttempt((value) => value + 1)
                }}>
                {t(loading() ? "common.retrying" : "file.retry_preview")}
              </Button>
            }>{t("file.load_failed", { name: label() })}</Feedback>
          }>
            <Show when={reference()} fallback={<div role="status">{t("common.loading")}</div>}>
              {(value) => <Show when={text()} fallback={<FilePart part={{ type: "file", ...value() }} />}>
                <ResourceTextPreview read={textRead} filename={value().filename} label={label()} />
              </Show>}
            </Show>
          </Show>
        </Show>
      </div>
    </Dialog>
  )
}
