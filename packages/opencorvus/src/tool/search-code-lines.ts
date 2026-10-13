import type { Ripgrep } from "../file/ripgrep"

export interface SearchCodeLine {
  lineNum: number
  endLine: number
  lineText: string
  matchOffset: number
  startColumn?: number
}

/** Extra display lines before each ripgrep LF record, from actual bare-CR records. */
export function searchCodeLineOffsets(records: readonly Ripgrep.ParsedMatch[]) {
  const files = new Map<string, Array<{ line: number; count: number }>>()
  for (const { data, lineBytes } of records) {
    let count = 0
    for (let index = 0; index < lineBytes.length; index++) {
      if (lineBytes[index] === 13 && lineBytes[index + 1] !== 10) count++
    }
    const entries = files.get(data.path.text) ?? []
    entries.push({ line: data.line_number, count })
    files.set(data.path.text, entries)
  }
  for (const entries of files.values()) {
    entries.sort((a, b) => a.line - b.line)
    let total = 0
    for (const entry of entries) entry.count = total += entry.count
  }
  return (file: string, line: number): number => {
    const entries = files.get(file) ?? []
    let low = 0, high = entries.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (entries[mid]!.line < line) low = mid + 1
      else high = mid
    }
    return low ? entries[low - 1]!.count : 0
  }
}

/** Project original byte spans into the same CR/LF/CRLF lines as read and CodeMirror. */
export function searchCodeLines(record: Ripgrep.ParsedMatch, precedingBareCR: number): SearchCodeLine[] {
  const { data, lineBytes } = record
  const lines: Array<{ from: number; to: number }> = []
  let from = 0
  for (let index = 0; index < lineBytes.length; index++) {
    if (lineBytes[index] !== 13 && lineBytes[index] !== 10) continue
    lines.push({ from, to: index })
    if (lineBytes[index] === 13 && lineBytes[index + 1] === 10) index++
    from = index + 1
  }
  if (from < lineBytes.length || !lines.length) lines.push({ from, to: lineBytes.length })
  const lineAt = (byte: number) => {
    let low = 0, high = lines.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (lines[mid]!.from <= byte) low = mid + 1
      else high = mid
    }
    return Math.max(0, low - 1)
  }
  const spans: Array<{ from: number; to: number; byte: number }> = []
  for (const match of data.submatches) {
    const start = lineAt(match.start), end = lineAt(Math.max(match.start, match.end - 1))
    const previous = spans.at(-1)
    if (previous && start <= previous.to) previous.to = Math.max(previous.to, end)
    else spans.push({ from: start, to: end, byte: match.start })
  }
  // ripgrep can report a real zero-width match without submatch coordinates.
  // Its complete record is the only evidenced range; do not guess a position.
  if (!spans.length) spans.push({ from: 0, to: lines.length - 1, byte: 0 })
  return spans.map((span) => {
    const first = lines[span.from]!
    const bytes = lineBytes.subarray(first.from, first.to)
    const byte = Math.min(span.byte - first.from, bytes.length)
    const prefix = bytes.subarray(0, byte).toString("utf8")
    const suffix = bytes.subarray(byte).toString("utf8")
    const firstText = bytes.toString("utf8")
    // A byte regex may split a UTF-8 decoding unit. Anchor its displayed start.
    const matchOffset = prefix.length - (prefix + suffix === firstText ? 0 : 1)
    return {
      lineNum: data.line_number + precedingBareCR + span.from,
      endLine: data.line_number + precedingBareCR + span.to,
      lineText: lines.slice(span.from, span.to + 1).map((line) => lineBytes.subarray(line.from, line.to).toString("utf8")).join("\n"),
      matchOffset,
      ...(data.submatches.length && span.from === span.to ? { startColumn: matchOffset + 1 } : {}),
    }
  })
}
