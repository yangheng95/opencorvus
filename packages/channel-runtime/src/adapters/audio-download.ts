import { assertSTTAudioSize, DEFAULT_STT_MAX_FILE_SIZE_BYTES } from "../stt/limits"
import type { AudioSource } from "../stt/types"

export type AudioDownloadOptions = {
  url: string
  headers?: HeadersInit
  metadataSize?: number
  maxFileSizeBytes?: number
  timeoutMs?: number
}

export type HttpAudioSourceOptions = Omit<AudioDownloadOptions, "maxFileSizeBytes" | "metadataSize"> & {
  mime: string
  filename?: string
  size?: number
  duration?: number
}

export function createHttpAudioSource(options: HttpAudioSourceOptions): AudioSource {
  return {
    mime: options.mime,
    filename: options.filename,
    size: options.size,
    duration: options.duration,
    read: (maxFileSizeBytes) =>
      downloadAudioBuffer({
        url: options.url,
        headers: options.headers,
        metadataSize: options.size,
        maxFileSizeBytes,
        timeoutMs: options.timeoutMs,
      }),
  }
}

export async function downloadAudioBuffer(options: AudioDownloadOptions): Promise<Buffer> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_STT_MAX_FILE_SIZE_BYTES
  if (options.metadataSize !== undefined) {
    assertSTTAudioSize(options.metadataSize, maxFileSizeBytes)
  }

  const response = await fetch(options.url, {
    headers: options.headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  })
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`)
  }

  const contentLength = parseContentLength(response.headers.get("content-length"))
  if (contentLength !== undefined) {
    assertSTTAudioSize(contentLength, maxFileSizeBytes)
  }

  if (!response.body) {
    throw new Error("Audio download response has no body")
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      total += value.byteLength
      assertSTTAudioSize(total, maxFileSizeBytes)
      chunks.push(Buffer.from(value))
    }
  } catch (err) {
    if (total > maxFileSizeBytes) {
      await reader.cancel().catch(() => undefined)
    }
    throw err
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, total)
}

function parseContentLength(value: string | null): number | undefined {
  if (value === null) return undefined
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid audio Content-Length: ${trimmed}`)
  }
  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid audio Content-Length: ${trimmed}`)
  }
  return parsed
}
