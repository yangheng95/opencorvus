import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"
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

export interface CapturedComposerFile {
  bytes: Uint8Array
  mime: string
}

export async function captureComposerFile(file: File): Promise<CapturedComposerFile> {
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    mime: file.type || "application/octet-stream",
  }
}

export async function uploadComposerBytes(input: {
  bytes: Uint8Array
  mime: string
  filename: string
  directory: string
}): Promise<StoredAttachmentReference> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("Attachment upload requires an active project directory")
  const query = new URLSearchParams({ filename: input.filename })
  return await apiJson<StoredAttachmentReference>(
    directoryScopedPath(`attachment?${query.toString()}`, directory, "upload attachment"),
    {
      method: "POST",
      headers: { "Content-Type": input.mime },
      body: input.bytes as unknown as BodyInit,
      timeoutMilliseconds: null,
    },
  )
}

export async function uploadComposerDirectoryReference(
  path: string,
  directoryInput: string,
): Promise<StoredDirectoryReference> {
  const directory = directoryInput.trim()
  if (!directory) throw new Error("Directory reference requires an active project directory")
  return await apiJson<StoredDirectoryReference>(
    directoryScopedPath("attachment/directory-reference", directory, "reference directory attachment"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    },
  )
}

export async function uploadComposerDataUrl(input: {
  dataUrl: string
  mime: string
  filename: string
  directory: string
}): Promise<StoredAttachmentReference> {
  const response = await fetch(input.dataUrl)
  if (!response.ok) throw new Error(`Could not read composer attachment ${input.filename}`)
  return await uploadComposerBytes({
    bytes: new Uint8Array(await response.arrayBuffer()),
    mime: input.mime,
    filename: input.filename,
    directory: input.directory,
  })
}
