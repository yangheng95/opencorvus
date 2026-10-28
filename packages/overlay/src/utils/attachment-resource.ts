import { ATTACHMENT_IMAGE_PREVIEW_VARIANT } from "@opencorvus-ai/transport-protocol"

export function isStoredAttachmentUrl(url: string): boolean {
  return /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/i.test(url)
}

// Stored attachment names carry their canonical media extension; the original
// HTTP route uses that same extension for its SVG download-only contract.
export function attachmentImagePreviewUrl(url: string): string {
  return isStoredAttachmentUrl(url) && /\.svg$/i.test(url)
    ? `${url}?variant=${ATTACHMENT_IMAGE_PREVIEW_VARIANT}`
    : url
}
