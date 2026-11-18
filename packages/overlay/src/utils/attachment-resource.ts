import { ATTACHMENT_IMAGE_DISPLAY_VARIANT } from "@opencorvus-ai/transport-protocol"

export function isStoredAttachmentUrl(url: string): boolean {
  return /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/i.test(url)
}

// The server selects the display representation from the verified publication
// media. A stored filename retains its original suffix, which may name another type.
export function attachmentImagePreviewUrl(url: string): string {
  return isStoredAttachmentUrl(url)
    ? `${url}?variant=${ATTACHMENT_IMAGE_DISPLAY_VARIANT}`
    : url
}
