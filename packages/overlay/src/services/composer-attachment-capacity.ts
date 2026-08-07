import { COMPOSER_FILE_ATTACHMENT_LIMIT, COMPOSER_FOLDER_ATTACHMENT_LIMIT } from "@opencorvus-ai/transport-protocol"

export type ComposerAttachmentKind = "file" | "folder"

export interface ComposerAttachmentKinded {
  kind: ComposerAttachmentKind
}

export function composerAttachmentCounts(attachments: readonly ComposerAttachmentKinded[]): {
  files: number
  folders: number
} {
  let files = 0
  let folders = 0
  for (const attachment of attachments) {
    if (attachment.kind === "folder") folders += 1
    else files += 1
  }
  return { files, folders }
}

export function composerAttachmentCapacity(
  attachments: readonly ComposerAttachmentKinded[],
  kind: ComposerAttachmentKind,
): number {
  const counts = composerAttachmentCounts(attachments)
  return kind === "folder"
    ? Math.max(0, COMPOSER_FOLDER_ATTACHMENT_LIMIT - counts.folders)
    : Math.max(0, COMPOSER_FILE_ATTACHMENT_LIMIT - counts.files)
}
