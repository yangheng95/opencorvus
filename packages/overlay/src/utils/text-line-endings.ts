import { MapMode, type ChangeDesc, type ChangeSet, type Text } from "@codemirror/state"

export type LineSeparator = "\n" | "\r\n" | "\r"
export interface TextLineEnding {
  /** The single newline position in canonical Text, independent of its encoding. */
  pos: number
  separator: LineSeparator
}
export interface TextLineEndings {
  preferred: LineSeparator
  entries: readonly TextLineEnding[]
}

export function readTextLineEndings(value: string): TextLineEndings {
  const entries: TextLineEnding[] = []
  let extra = 0
  for (const match of value.matchAll(/\r\n|\r|\n/g)) {
    entries.push({ pos: match.index - extra, separator: match[0] as LineSeparator })
    extra += match[0].length - 1
  }
  return { preferred: entries[0]?.separator ?? "\n", entries }
}

export function mapTextLineEndings(entries: readonly TextLineEnding[], changes: ChangeDesc): TextLineEnding[] {
  return entries.flatMap((entry) => {
    // Track the newline character itself, including deletion exactly at a boundary.
    const pos = changes.mapPos(entry.pos, 1, MapMode.TrackAfter)
    return pos === null ? [] : [{ pos, separator: entry.separator }]
  })
}

export function changeTextLineEndings(value: TextLineEndings, changes: ChangeSet): TextLineEndings {
  if (changes.empty) return value
  const entries = mapTextLineEndings(value.entries, changes)
  changes.iterChanges((_from, _to, from, to, inserted) => {
    let pos = from
    for (const line of inserted.iterLines()) {
      pos += line.length
      if (pos < to) entries.push({ pos, separator: value.preferred })
      pos++
    }
  })
  entries.sort((a, b) => a.pos - b.pos)
  return { preferred: value.preferred, entries }
}

export function overrideTextLineEndings(value: TextLineEndings, overrides: readonly TextLineEnding[]): TextLineEndings {
  const byPosition = new Map(overrides.map((entry) => [entry.pos, entry.separator]))
  return {
    preferred: value.preferred,
    entries: value.entries.map((entry) => ({ pos: entry.pos, separator: byPosition.get(entry.pos) ?? entry.separator })),
  }
}

/** Format facts needed after applying the inverse change, in the original coordinates. */
export function invertTextLineEndings(
  value: TextLineEndings,
  changes: ChangeSet,
  overrides: readonly TextLineEnding[],
): TextLineEnding[] {
  if (changes.empty && !overrides.length) return []
  const changedPositions = new Set(mapTextLineEndings(overrides, changes.invertedDesc).map((entry) => entry.pos))
  return value.entries.filter((entry) => changedPositions.has(entry.pos) || changes.mapPos(entry.pos, 1, MapMode.TrackAfter) === null)
}

export function writeTextLineEndings(doc: Text, value: TextLineEndings): string {
  const parts: string[] = []
  let index = 0
  for (const line of doc.iterLines()) {
    if (index) parts.push(value.entries[index - 1]!.separator)
    parts.push(line)
    index++
  }
  return parts.join("")
}
