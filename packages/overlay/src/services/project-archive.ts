import { bytesToArrayBuffer } from "../utils/binary"
import { apiRequest, ApiError } from "./api"

export const ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS = 15 * 60 * 1000

function contentDispositionFilename(header: string | undefined): string | undefined {
  if (!header) return undefined
  const match = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header)
  const raw = match?.[1]?.trim()
  if (!raw) return undefined
  return raw.replace(/[\\/:*?"<>|]+/g, "-") || undefined
}

function saveBytesAsDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytesToArrayBuffer(bytes)], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function decodeBinaryErrorBody(body: Uint8Array): unknown {
  const text = new TextDecoder().decode(body).trim()
  if (!text) return body
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function downloadZipArchive(input: { path: string }): Promise<boolean> {
  const response = await apiRequest<Uint8Array>(input.path, {
    responseKind: "binary",
    timeoutMilliseconds: ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS,
  })
  if (!response.ok) {
    throw new ApiError(response.status, input.path, decodeBinaryErrorBody(response.body))
  }
  const filename = contentDispositionFilename(
    response.headers["content-disposition"] || response.headers["Content-Disposition"],
  )
  if (!filename) {
    throw new Error(`ZIP archive response is missing a Content-Disposition filename for ${input.path}`)
  }
  saveBytesAsDownload(response.body, filename)
  return true
}

export async function downloadProjectArchive(input: { path: string }): Promise<boolean> {
  return downloadZipArchive(input)
}
