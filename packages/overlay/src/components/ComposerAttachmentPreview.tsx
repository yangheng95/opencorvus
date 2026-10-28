import { Show, createEffect, createSignal } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import type { StoredAttachmentReference } from "../services/attachment-upload"
import { boardStore } from "../store/board"
import { t } from "../utils/i18n"
import { FilePart } from "./FilePart"
import { ResourceTextPreview } from "./ResourceTextPreview"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"

export function ComposerAttachmentPreview(props: { attachment: StoredAttachmentReference }) {
  let trigger: HTMLButtonElement | undefined
  const [open, setOpen] = createSignal(false)
  const [context, setContext] = createSignal<{ authority: ApiAuthority; selection: number }>()
  const current = () => {
    const entry = context()
    return !!entry && isApiAuthorityCurrent(entry.authority) && boardStore.selectEpoch === entry.selection
  }
  createEffect(() => {
    if (context() && !current()) setOpen(false)
  })
  const text = () => props.attachment.mime.startsWith("text/") || props.attachment.mime === "application/json"

  return (
    <>
      <Button
        ref={trigger}
        class="composer-attachment-file-trigger"
        type="button"
        variant="ghost"
        size="sm"
        tone="neutral"
        data-ui="composer-attachment-preview"
        title={t("chat.attachment.preview", { name: props.attachment.filename })}
        aria-label={t("chat.attachment.preview", { name: props.attachment.filename })}
        onClick={() => {
          setContext({ authority: captureApiAuthority(), selection: boardStore.selectEpoch })
          setOpen(true)
        }}
      >
        <span class="chat-attachment-icon">{props.attachment.filename.split(".").pop()?.toUpperCase() || "FILE"}</span>
        <span class="chat-attachment-name">{props.attachment.filename}</span>
      </Button>
      <Dialog
        open={open()}
        wide
        class="composer-attachment-dialog"
        title={props.attachment.filename}
        returnFocusTarget={() => (current() ? trigger ?? null : null)}
        onClose={() => setOpen(false)}
        footer={
          <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        }
      >
        <Show when={open()}>
          <Show when={text()} fallback={<FilePart part={{ type: "file", ...props.attachment }} />}>
            <ResourceTextPreview
              url={props.attachment.url}
              filename={props.attachment.filename}
              label={props.attachment.filename}
              authority={context()?.authority}
            />
          </Show>
        </Show>
      </Dialog>
    </>
  )
}
