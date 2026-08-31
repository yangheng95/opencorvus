const TEXT_APP_MIMES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/x-toml",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
  "application/x-shellscript",
  "application/sql",
])

const TEXT_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "java",
  "rb",
  "sh",
  "bat",
  "ps1",
  "html",
  "css",
  "scss",
  "less",
  "sql",
  "toml",
  "yaml",
  "yml",
  "json",
  "xml",
  "csv",
  "log",
  "md",
  "markdown",
  "txt",
  "rst",
])

/**
 * Returns true if the MIME type (+ optional filename) represents text content
 * that should be decoded and injected as readable text, rather than passed as
 * a binary file part to the model.
 */
export function isDecodableText(mime: string, filename?: string): boolean {
  const normalizedMime = mime.split(";", 1)[0].trim().toLowerCase()
  if (normalizedMime.startsWith("text/")) return true
  if (TEXT_APP_MIMES.has(normalizedMime)) return true
  if (normalizedMime.endsWith("+json") || normalizedMime.endsWith("+xml")) return true
  if (normalizedMime === "application/octet-stream" && filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? ""
    return TEXT_EXTS.has(ext)
  }
  return false
}

/**
 * Maximum bytes to decode from a text attachment.
 * Files larger than this are truncated — a note is appended so the model
 * knows content was cut off rather than silently receiving incomplete data.
 */
export const MAX_TEXT_DECODE_BYTES = 200_000

export function decodeTextBytes(raw: Uint8Array): string {
  const bytes = Buffer.from(raw)
  if (bytes.length > MAX_TEXT_DECODE_BYTES) {
    const truncated = bytes.subarray(0, MAX_TEXT_DECODE_BYTES).toString("utf-8")
    return `${truncated}\n\n[... truncated — file exceeds ${MAX_TEXT_DECODE_BYTES / 1024}KB limit ...]`
  }
  return bytes.toString("utf-8")
}

/**
 * Extract and decode the base64 payload from a data URL to UTF-8 text.
 * e.g. "data:text/markdown;base64,IyBIZWxsbw==" → "# Hello"
 *
 * Truncates at MAX_TEXT_DECODE_BYTES and appends a note when the file is
 * larger, so the model is explicitly aware of the truncation.
 */
export function decodeDataUrlText(dataUrl: string): string {
  return decodeTextBytes(decodeDataUrlBase64Bytes(dataUrl, "decodeDataUrlText"))
}

/**
 * Strictly extract the raw base64 payload from a `data:<mime>;base64,<bytes>`
 * URL. Throws when the input is anything other than a base64 data URL — the
 * caller is forwarding bytes to a strict downstream that rejects empty or
 * garbled buffers (e.g. `Buffer.from(undefined, "base64")` returns an empty
 * buffer that AttachmentStore.write would happily persist as "the user's
 * reference image"). Rule 7 — no silent fallback for binary attachments.
 *
 * Accepts `data:image/png;base64,<bytes>` and the percent-encoded variant
 * with optional padding; rejects URL-encoded payloads, http(s):// URLs, and
 * server-relative `/attachment/...` URLs (those are stored attachments and
 * should NEVER reach this helper — call AttachmentStore lookup instead).
 */
const DATA_URL_BASE64_PATTERN = /^data:[^;,]+(?:;[^;,]+)*;base64,/i

export function decodeDataUrlBase64(dataUrl: string, context: string): string {
  if (typeof dataUrl !== "string" || !DATA_URL_BASE64_PATTERN.test(dataUrl)) {
    const preview = typeof dataUrl === "string" && dataUrl.length > 60 ? `${dataUrl.slice(0, 60)}…` : String(dataUrl)
    throw new Error(
      `${context}: expected data URL of form "data:<mime>;base64,<bytes>", got ${JSON.stringify(preview)}`,
    )
  }
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1)
  decodeRawBase64Payload(payload, context)
  return payload
}

export function decodeDataUrlBase64Bytes(dataUrl: string, context: string): Buffer {
  return decodeRawBase64Payload(decodeDataUrlBase64(dataUrl, context), context)
}

import { decodeRawBase64Payload } from "@/util/base64"
export { decodeRawBase64Payload } from "@/util/base64"
