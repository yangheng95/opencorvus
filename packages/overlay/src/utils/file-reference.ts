// ── Cited file locations (`path:line[:column]`, `path:line-end`, `path#Lline[-Lend]`) ──
//
// Agents cite source locations the way every terminal and compiler does:
// `src/engine/pipeline.ts:42`. The renderer used to throw the location half
// away and open the file at the top, so a citation click landed nowhere near
// the cited code. Parsing lives here — free of `marked`, i18n and DOM imports —
// so the markdown renderer, the click delegation in `main.tsx` and the unit
// tests all agree on exactly one grammar.

import type { SourceFileRange } from "@opencorvus-ai/sdk"

/** Attribute carrying the cited path on a rendered codespan reference. */
export const FILE_REFERENCE_PATH_ATTRIBUTE = "data-file-path"
/** Attribute carrying the cited path on a rendered markdown link. */
export const PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE = "data-project-file-path"
const FILE_REFERENCE_LINE_ATTRIBUTE = "data-file-line"
const FILE_REFERENCE_END_LINE_ATTRIBUTE = "data-file-end-line"
const FILE_REFERENCE_COLUMN_ATTRIBUTE = "data-file-column"

// Lazy path half plus an anchored numeric tail, so a Windows drive letter
// (`C:\repo\a.ts`) is never mistaken for a location separator: the tail must
// run to the end of the string as digits.
const LOCATION_SUFFIX_RE = /^(.+?)(?::(\d+)(?::(\d+)|-(\d+))?|#L(\d+)(?:-L(\d+))?)$/

export interface FileReferenceLocation {
  line: number
  endLine?: number
  column?: number
}

export interface FileReference extends Partial<FileReferenceLocation> {
  path: string
}

function positiveLineNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined
}

/**
 * Split a cited reference into its path and optional 1-based location. Text
 * without a well-formed trailing location is returned unchanged as the path —
 * a reference is never rejected just because it has no line number.
 */
export function parseFileReference(raw: string): FileReference {
  const text = String(raw ?? "").trim()
  const match = text.match(LOCATION_SUFFIX_RE)
  if (!match) return { path: text }
  const line = positiveLineNumber(match[2] ?? match[5])
  if (line === undefined) return { path: text }
  const column = positiveLineNumber(match[3])
  if (match[3] !== undefined && column === undefined) return { path: text }
  const rawEndLine = match[4] ?? match[6]
  const endLine = positiveLineNumber(rawEndLine)
  if (rawEndLine !== undefined && (endLine === undefined || endLine < line)) return { path: text }
  return {
    path: match[1]!,
    line,
    ...(endLine === undefined ? {} : { endLine }),
    ...(column === undefined ? {} : { column }),
  }
}

/**
 * Convert a cited location into the canonical inclusive editor range. A single
 * line collapses onto itself; a cited range retains its supplied end.
 */
export function fileReferenceRange(
  reference: Partial<FileReferenceLocation> | undefined,
): SourceFileRange | undefined {
  const line = reference?.line
  if (line === undefined || !Number.isSafeInteger(line) || line < 1) return undefined
  const endLine = reference?.endLine ?? line
  if (!Number.isSafeInteger(endLine) || endLine < line) return undefined
  if (reference?.column !== undefined && endLine !== line) return undefined
  return {
    startLine: line,
    endLine,
    ...(reference?.column === undefined ? {} : { startColumn: reference.column }),
  }
}

/** Serialise a reference into HTML attributes for the delegated click handler. */
export function fileReferenceHtmlAttributes(
  pathAttribute: string,
  reference: FileReference,
  escape: (value: string) => string,
): string {
  const attributes = [`${pathAttribute}="${escape(reference.path)}"`]
  if (reference.line !== undefined) attributes.push(`${FILE_REFERENCE_LINE_ATTRIBUTE}="${reference.line}"`)
  if (reference.endLine !== undefined) attributes.push(`${FILE_REFERENCE_END_LINE_ATTRIBUTE}="${reference.endLine}"`)
  if (reference.column !== undefined) attributes.push(`${FILE_REFERENCE_COLUMN_ATTRIBUTE}="${reference.column}"`)
  return ` ${attributes.join(" ")}`
}

/** Read back a reference the renderer serialised onto an element. */
export function elementFileReference(element: Element, pathAttribute: string): FileReference | null {
  const path = element.getAttribute(pathAttribute)
  if (!path?.trim()) return null
  const line = positiveLineNumber(element.getAttribute(FILE_REFERENCE_LINE_ATTRIBUTE) ?? undefined)
  const rawEndLine = element.getAttribute(FILE_REFERENCE_END_LINE_ATTRIBUTE)
  const endLine = positiveLineNumber(rawEndLine ?? undefined)
  const column = positiveLineNumber(element.getAttribute(FILE_REFERENCE_COLUMN_ATTRIBUTE) ?? undefined)
  if (rawEndLine !== null && (line === undefined || endLine === undefined || endLine < line)) return null
  if (column !== undefined && endLine !== undefined && endLine !== line) return null
  return {
    path,
    ...(line === undefined ? {} : { line }),
    ...(endLine === undefined ? {} : { endLine }),
    ...(line === undefined || column === undefined ? {} : { column }),
  }
}
