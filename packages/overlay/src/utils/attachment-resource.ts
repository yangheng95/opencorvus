import { ATTACHMENT_IMAGE_PREVIEW_VARIANT } from "@opencorvus-ai/transport-protocol"

export function isStoredAttachmentUrl(url: string): boolean {
  return /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/i.test(url)
}

export function attachmentImagePreviewUrl(url: string, mime: string): string {
  return mime.toLowerCase() === "image/svg+xml" && isStoredAttachmentUrl(url)
    ? `${url}?variant=${ATTACHMENT_IMAGE_PREVIEW_VARIANT}`
    : url
}
