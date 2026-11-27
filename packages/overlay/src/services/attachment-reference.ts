import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"

export interface StoredAttachmentReference {
  sha: string
  url: string
  mime: string
  size: number
  filename: string
}

export interface StoredDirectoryReference extends StoredAttachmentReference {
  kind: "folder"
  path: string
  mime: typeof DIRECTORY_REFERENCE_MIME
}

export function attachmentDownloadFilename(reference: Pick<StoredAttachmentReference, "mime" | "filename">): string {
  return reference.mime === DIRECTORY_REFERENCE_MIME
    ? `${reference.filename}.directory.json`
    : reference.filename
}
