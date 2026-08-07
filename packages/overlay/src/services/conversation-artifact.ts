import { ApiError, apiRequest } from "./api"
import { activeProjectDirectory } from "./project-directory"
import { taskScopedPath } from "./task-path"

export type ArtifactReadLocator = Record<string, unknown> & { source: string }

type ArtifactByteChunk = {
  mediaType: string
  byteStart: number
  byteEnd: number
  totalBytes: number
  sha256: string
  attachment: boolean
  filename?: string
  bytes: Uint8Array
}

export type ConversationArtifactContent = {
  locator: ArtifactReadLocator
  mediaType: string
  sha256: string
  totalBytes: number
  text?: string
  bytes?: Uint8Array
  filename?: string
}

const READ_CHUNK_BYTES = 64 * 1024
const CONTENT_RANGE = /^bytes (\d+)-(\d+)\/(\d+)$/
const EMPTY_CONTENT_RANGE = "bytes */0"
const SHA256_ETAG = /^"sha256:([a-f0-9]{64})"$/
const ATTACHMENT_FILENAME = /^attachment; filename\*=UTF-8''(.+)$/

function responseHeader(headers: Record<string, string>, name: string): string {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  if (!entry || !entry[1]) throw new Error(`Artifact byte response has no ${name} header`)
  return entry[1]
}

function parseContentRange(value: string): { byteStart: number; byteEnd: number; totalBytes: number } {
  if (value === EMPTY_CONTENT_RANGE) return { byteStart: 0, byteEnd: 0, totalBytes: 0 }
  const match = CONTENT_RANGE.exec(value)
  if (!match) throw new Error("Artifact byte response has an invalid Content-Range")
  const byteStart = Number(match[1])
  const byteEnd = Number(match[2]) + 1
  const totalBytes = Number(match[3])
  if (
    !Number.isSafeInteger(byteStart) ||
    !Number.isSafeInteger(byteEnd) ||
    !Number.isSafeInteger(totalBytes) ||
    byteStart < 0 ||
    byteEnd <= byteStart ||
    byteEnd > totalBytes
  ) {
    throw new Error("Artifact byte response Content-Range is inconsistent")
  }
  return { byteStart, byteEnd, totalBytes }
}

function parseETag(value: string): string {
  const match = SHA256_ETAG.exec(value)
  if (!match) throw new Error("Artifact byte response has an invalid ETag")
  return match[1]!
}

function parseDisposition(value: string): { attachment: boolean; filename?: string } {
  if (value === "inline") return { attachment: false }
  const match = ATTACHMENT_FILENAME.exec(value)
  if (!match) throw new Error("Artifact byte response has an invalid Content-Disposition")
  return { attachment: true, filename: decodeURIComponent(match[1]!) }
}

async function readChunk(input: {
  taskID: string
  locator: ArtifactReadLocator
  byteOffset: number
  signal?: AbortSignal
}): Promise<ArtifactByteChunk> {
  const directory = activeProjectDirectory()
  const response = await apiRequest<Uint8Array>(taskScopedPath(input.taskID, directory, "/artifact-read"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locator: input.locator,
      byte_offset: input.byteOffset,
      max_bytes: READ_CHUNK_BYTES,
    }),
    responseKind: "binary",
    signal: input.signal,
  })
  if (!response.ok) throw new ApiError(response.status, "Conversation Artifact read", response.body)
  const range = parseContentRange(responseHeader(response.headers, "Content-Range"))
  const disposition = parseDisposition(responseHeader(response.headers, "Content-Disposition"))
  const bytes = response.body
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== range.byteEnd - range.byteStart) {
    throw new Error("Artifact byte response body does not match Content-Range")
  }
  return {
    ...range,
    ...disposition,
    mediaType: responseHeader(response.headers, "Content-Type"),
    sha256: parseETag(responseHeader(response.headers, "ETag")),
    bytes,
  }
}

export async function loadConversationArtifactContent(input: {
  taskID: string
  locator: ArtifactReadLocator
  signal?: AbortSignal
}): Promise<ConversationArtifactContent> {
  let offset = 0
  let mediaType = ""
  let sha256 = ""
  let totalBytes = -1
  const text: string[] = []
  for (;;) {
    input.signal?.throwIfAborted()
    const chunk = await readChunk({ ...input, byteOffset: offset })
    if (chunk.byteStart !== offset) throw new Error("Artifact read returned a discontinuous byte range")
    if (!mediaType) mediaType = chunk.mediaType
    if (!sha256) sha256 = chunk.sha256
    if (totalBytes < 0) totalBytes = chunk.totalBytes
    if (chunk.mediaType !== mediaType || chunk.sha256 !== sha256 || chunk.totalBytes !== totalBytes) {
      throw new Error("Artifact read metadata changed between chunks")
    }
    if (chunk.attachment) {
      if (chunk.byteStart !== 0 || chunk.byteEnd !== totalBytes || !chunk.filename) {
        throw new Error("Binary Artifact read is incomplete")
      }
      return {
        locator: input.locator,
        mediaType,
        sha256,
        totalBytes,
        bytes: chunk.bytes,
        filename: chunk.filename,
      }
    }
    text.push(new TextDecoder("utf-8", { fatal: true }).decode(chunk.bytes))
    if (chunk.byteEnd === totalBytes) {
      const value = text.join("")
      if (new TextEncoder().encode(value).byteLength !== totalBytes) {
        throw new Error("Text Artifact bytes do not match their declared total")
      }
      return { locator: input.locator, mediaType, sha256, totalBytes, text: value }
    }
    if (chunk.byteEnd <= offset) throw new Error("Artifact read did not advance")
    offset = chunk.byteEnd
  }
}
