import { createSignal } from "solid-js"
import { boardStore } from "../store/board"
import { isStoredAttachmentUrl } from "../utils/attachment-resource"
import { captureApiAuthority, type ApiAuthority } from "./api"
import type { StoredAttachmentReference } from "./attachment-reference"

interface AttachmentPreviewState {
  open: boolean
  url: string
  reference?: StoredAttachmentReference
  label: string
  trigger: HTMLElement
  authority: ApiAuthority
  selection: number
}

const [attachmentPreviewState, setAttachmentPreviewState] = createSignal<AttachmentPreviewState>()
export { attachmentPreviewState }

export function openAttachmentPreview(input: {
  url: string
  reference?: StoredAttachmentReference
  label: string
  trigger: HTMLElement
}): void {
  if (!isStoredAttachmentUrl(input.url)) throw new Error("Attachment preview requires a canonical attachment URL")
  setAttachmentPreviewState({
    ...input, open: true, authority: captureApiAuthority(), selection: boardStore.selectEpoch,
  })
}

export function closeAttachmentPreview(): void {
  setAttachmentPreviewState((entry) => entry ? { ...entry, open: false } : undefined)
}
