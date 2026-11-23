import { diffLines } from "diff"
import { readTextLineEndings, type LineSeparator } from "./text-line-endings"

export function splitComparisonLines(text: string): string[] {
  const value = text.replace(/\r\n|\r/g, "\n")
  if (!value) return []
  const lines = value.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

interface LineEndingChange {
  firstLine: number
  lastLine: number
  before: LineSeparator | null
  after: LineSeparator | null
}

export function compareLineEndings(before: string, after: string): LineEndingChange[] | undefined {
  if (before === after) return
  const oldLines = splitComparisonLines(before)
  const newLines = splitComparisonLines(after)
  if (oldLines.length !== newLines.length || oldLines.some((line, index) => line !== newLines[index])) return

  const oldEndings = readTextLineEndings(before).entries
  const newEndings = readTextLineEndings(after).entries
  const ranges: LineEndingChange[] = []
  for (let index = 0; index < oldLines.length; index++) {
    const previous = oldEndings[index]?.separator ?? null
    const next = newEndings[index]?.separator ?? null
    if (previous === next) continue
    const line = index + 1
    const range = ranges.at(-1)
    if (range && range.lastLine === index && range.before === previous && range.after === next) range.lastLine = line
    else ranges.push({ firstLine: line, lastLine: line, before: previous, after: next })
  }
  return ranges
}

export function textComparisonCounts(before: string, after: string): { additions: number; deletions: number } {
  const counts = { additions: 0, deletions: 0 }
  for (const change of diffLines(before, after)) {
    if (change.added) counts.additions += change.count ?? 0
    if (change.removed) counts.deletions += change.count ?? 0
  }
  return counts
}
