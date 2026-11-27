import type { StoredAttachmentReference } from "../services/attachment-reference"
import { openAttachmentPreview } from "../services/attachment-preview"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"

export function ComposerAttachmentPreview(props: { attachment: StoredAttachmentReference; displayLabel: string }) {
  return (
    <Button
      class="composer-attachment-file-trigger"
      type="button"
      variant="ghost"
      size="sm"
      tone="neutral"
      data-ui="composer-attachment-preview"
      title={t("chat.attachment.preview", { name: props.displayLabel })}
      aria-label={t("chat.attachment.preview", { name: props.displayLabel })}
      onClick={(event) => openAttachmentPreview({
        url: props.attachment.url, reference: props.attachment,
        label: props.displayLabel, trigger: event.currentTarget,
      })}
    >
      <span class="chat-attachment-icon">{props.attachment.filename.split(".").pop()?.toUpperCase() || "FILE"}</span>
      <span class="chat-attachment-name">{props.displayLabel}</span>
    </Button>
  )
}
