import { createReadStream } from "node:fs"
import * as fs from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"

export const DEFAULT_TEXT_FILE_LIMIT = 2000
const MAX_LINE_LENGTH = 2000
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`
const MAX_BYTES = 50 * 1024
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`

export type TextFilePage = {
  raw: string[]
  numbered: string[]
  offset: number
  lines: number
  totalLines: number
  lastReadLine: number
  nextOffset: number
  truncated: boolean
  truncatedByBytes: boolean
}

export async function readTextFilePage(
  filepath: string,
  input: { offset?: number; limit?: number },
): Promise<TextFilePage> {
  const limit = input.limit ?? DEFAULT_TEXT_FILE_LIMIT
  const offset = input.offset ?? 1
  const start = offset - 1
  const raw: string[] = []
  let bytes = 0
  let lines = 0
  let truncatedByBytes = false
  let hasMoreLines = false
  const stream = createReadStream(filepath, { encoding: "utf8" })
  const reader = createInterface({
    input: stream,
    // CR LF means Carriage Return + Line Feed. Treat the pair as one line ending.
    crlfDelay: Infinity,
  })
  try {
    for await (const text of reader) {
      lines += 1
      if (lines <= start) continue

      if (raw.length >= limit) {
        hasMoreLines = true
        continue
      }

      const line = text.length > MAX_LINE_LENGTH ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : text
      const size = Buffer.byteLength(line, "utf8") + (raw.length > 0 ? 1 : 0)
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true
        hasMoreLines = true
        break
      }

      raw.push(line)
      bytes += size
    }
  } finally {
    reader.close()
    stream.destroy()
  }

  if (lines < offset && !(lines === 0 && offset === 1)) {
    throw new Error(`Offset ${offset} is out of range for this file (${lines} lines)`)
  }

  const lastReadLine = offset + raw.length - 1
  return {
    raw,
    numbered: raw.map((line, index) => `${index + offset}: ${line}`),
    offset,
    lines: raw.length,
    totalLines: lines,
    lastReadLine,
    nextOffset: lastReadLine + 1,
    truncated: hasMoreLines || truncatedByBytes,
    truncatedByBytes,
  }
}

export function readTextFilePageContent(
  content: string,
  input: { offset?: number; limit?: number },
): TextFilePage {
  const limit = input.limit ?? DEFAULT_TEXT_FILE_LIMIT
  const offset = input.offset ?? 1
  const lines = content.split(/\r?\n/)
  if (content.endsWith("\n")) lines.pop()
  if (offset > lines.length && !(lines.length === 0 && offset === 1)) {
    throw new Error(`Offset ${offset} is out of range for this file (${lines.length} lines)`)
  }
  const raw: string[] = []
  let bytes = 0
  let truncatedByBytes = false
  for (const text of lines.slice(offset - 1, offset - 1 + limit)) {
    const line = text.length > MAX_LINE_LENGTH ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : text
    const size = Buffer.byteLength(line, "utf8") + (raw.length > 0 ? 1 : 0)
    if (bytes + size > MAX_BYTES) {
      truncatedByBytes = true
      break
    }
    raw.push(line)
    bytes += size
  }
  const lastReadLine = offset + raw.length - 1
  return {
    raw,
    numbered: raw.map((line, index) => `${index + offset}: ${line}`),
    offset,
    lines: raw.length,
    totalLines: lines.length,
    lastReadLine,
    nextOffset: lastReadLine + 1,
    truncated: truncatedByBytes || offset - 1 + raw.length < lines.length,
    truncatedByBytes,
  }
}

export function renderTextFilePage(page: TextFilePage) {
  let output = page.numbered.join("\n")
  if (page.truncatedByBytes) {
    output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${page.offset}-${page.lastReadLine}. Use offset=${page.nextOffset} to continue.)`
  } else if (page.truncated) {
    output += `\n\n(Showing lines ${page.offset}-${page.lastReadLine} of ${page.totalLines}. Use offset=${page.nextOffset} to continue.)`
  } else {
    output += `\n\n(End of file - total ${page.totalLines} lines)`
  }
  return output
}

export async function isBinaryFile(filepath: string, fileSize: number): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase()
  switch (ext) {
    case ".zip":
    case ".tar":
    case ".gz":
    case ".exe":
    case ".dll":
    case ".so":
    case ".class":
    case ".jar":
    case ".war":
    case ".7z":
    case ".doc":
    case ".docx":
    case ".xls":
    case ".xlsx":
    case ".ppt":
    case ".pptx":
    case ".odt":
    case ".ods":
    case ".odp":
    case ".bin":
    case ".dat":
    case ".obj":
    case ".o":
    case ".a":
    case ".lib":
    case ".wasm":
    case ".pyc":
    case ".pyo":
      return true
    default:
      break
  }

  if (fileSize === 0) return false

  const handle = await fs.open(filepath, "r")
  try {
    const sampleSize = Math.min(4096, fileSize)
    const bytes = Buffer.alloc(sampleSize)
    const result = await handle.read(bytes, 0, sampleSize, 0)
    if (result.bytesRead === 0) return false

    let nonPrintableCount = 0
    for (let index = 0; index < result.bytesRead; index++) {
      if (bytes[index] === 0) return true
      if (bytes[index] < 9 || (bytes[index] > 13 && bytes[index] < 32)) {
        nonPrintableCount++
      }
    }
    return nonPrintableCount / result.bytesRead > 0.3
  } finally {
    await handle.close()
  }
}

export function isBinaryBytes(filepath: string, bytes: Uint8Array): boolean {
  const ext = path.extname(filepath).toLowerCase()
  if ([".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class", ".jar", ".war", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".bin", ".dat", ".obj", ".o", ".a", ".lib", ".wasm", ".pyc", ".pyo"].includes(ext)) return true
  const sample = bytes.subarray(0, Math.min(4096, bytes.byteLength))
  if (sample.byteLength === 0) return false
  let nonPrintable = 0
  for (const value of sample) {
    if (value === 0) return true
    if (value < 9 || (value > 13 && value < 32)) nonPrintable++
  }
  return nonPrintable / sample.byteLength > 0.3
}
