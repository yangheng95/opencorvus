import { createSignal } from "solid-js"

const [attachmentInputEnabled, setAttachmentInputEnabled] = createSignal(false)

export function setComposerAttachmentInputEnabled(enabled: boolean): void {
  setAttachmentInputEnabled(enabled)
}

export function canAcceptComposerAttachment(): boolean {
  return attachmentInputEnabled()
}
