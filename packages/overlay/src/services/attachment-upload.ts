import { apiJson, captureApiAuthority, type ApiAuthority } from "./api"
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
  const bytes = new Uint8Array(await file.arrayBuffer())
  let mime = file.type || "application/octet-stream"
  const essence = mime.split(";", 1)[0].trim().toLowerCase()
  // Windows also associates .ts source files with MPEG transport streams.
  // Resolve that specific ambiguity from the complete captured bytes.
  if (
    file.name?.toLowerCase().endsWith(".ts") &&
    ["application/octet-stream", "video/mp2t", "video/vnd.dlna.mpeg-tts"].includes(essence) &&
    !bytes.some((value) => value <= 0x08 || value === 0x0b || (value >= 0x0e && value <= 0x1a) || (value >= 0x1c && value <= 0x1f))
  ) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      mime = "text/plain"
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
    }
  }
  return {
    bytes,
    mime,
  }
}

export async function uploadComposerBytes(input: {
  bytes: Uint8Array
  mime: string
  filename: string
  directory: string
  authority?: ApiAuthority
}): Promise<StoredAttachmentReference> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("Attachment upload requires an active project directory")
  const query = new URLSearchParams({ filename: input.filename })
  return await apiJson<StoredAttachmentReference>(
    directoryScopedPath(`attachment?${query.toString()}`, directory, "upload attachment"),
    {
      authority: input.authority,
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
  authority = captureApiAuthority(),
): Promise<StoredDirectoryReference> {
  const directory = directoryInput.trim()
  if (!directory) throw new Error("Directory reference requires an active project directory")
  return await apiJson<StoredDirectoryReference>(
    directoryScopedPath("attachment/directory-reference", directory, "reference directory attachment"),
    {
      authority,
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
  authority?: ApiAuthority
}): Promise<StoredAttachmentReference> {
  const authority = input.authority ?? captureApiAuthority()
  const response = await fetch(input.dataUrl)
  if (!response.ok) throw new Error(`Could not read composer attachment ${input.filename}`)
  return await uploadComposerBytes({
    bytes: new Uint8Array(await response.arrayBuffer()),
    mime: input.mime,
    filename: input.filename,
    directory: input.directory,
    authority,
  })
}
