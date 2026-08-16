// ── Cited file locations (`path:line[:column]`) ──
//
// Agents cite source locations the way every terminal and compiler does:
// `src/engine/pipeline.ts:42`. The renderer used to throw the location half
// away and open the file at the top, so a citation click landed nowhere near
// the cited code. Parsing lives here — free of `marked`, i18n and DOM imports —
// so the markdown renderer, the click delegation in `main.tsx` and the unit
// tests all agree on exactly one grammar.

/** Attribute carrying the cited path on a rendered codespan reference. */
export const FILE_REFERENCE_PATH_ATTRIBUTE = "data-file-path"
/** Attribute carrying the cited path on a rendered markdown link. */
export const PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE = "data-project-file-path"
const FILE_REFERENCE_LINE_ATTRIBUTE = "data-file-line"
const FILE_REFERENCE_COLUMN_ATTRIBUTE = "data-file-column"

// Lazy path half plus an anchored numeric tail, so a Windows drive letter
// (`C:\repo\a.ts`) is never mistaken for a location separator: the tail must
// run to the end of the string as digits.
const LOCATION_SUFFIX_RE = /^(.+?):(\d+)(?::(\d+))?$/

export interface FileReferenceLocation {
  line: number
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
  const line = positiveLineNumber(match[2])
  if (line === undefined) return { path: text }
  const column = positiveLineNumber(match[3])
  if (match[3] !== undefined && column === undefined) return { path: text }
  return { path: match[1]!, line, ...(column === undefined ? {} : { column }) }
}

/**
 * The inclusive editor range for a cited location. A citation names a single
 * line, so the range collapses onto it; callers that already carry a multi-line
 * range (source-file parts) pass their own.
 */
export function fileReferenceRange(
  reference: Partial<FileReferenceLocation> | undefined,
): { startLine: number; endLine: number } | undefined {
  const line = reference?.line
  if (line === undefined || !Number.isSafeInteger(line) || line < 1) return undefined
  return { startLine: line, endLine: line }
}

/** Serialise a reference into HTML attributes for the delegated click handler. */
export function fileReferenceHtmlAttributes(
  pathAttribute: string,
  reference: FileReference,
  escape: (value: string) => string,
): string {
  const attributes = [`${pathAttribute}="${escape(reference.path)}"`]
  if (reference.line !== undefined) attributes.push(`${FILE_REFERENCE_LINE_ATTRIBUTE}="${reference.line}"`)
  if (reference.column !== undefined) attributes.push(`${FILE_REFERENCE_COLUMN_ATTRIBUTE}="${reference.column}"`)
  return ` ${attributes.join(" ")}`
}

/** Read back a reference the renderer serialised onto an element. */
export function elementFileReference(element: Element, pathAttribute: string): FileReference | null {
  const path = element.getAttribute(pathAttribute)?.trim()
  if (!path) return null
  const line = positiveLineNumber(element.getAttribute(FILE_REFERENCE_LINE_ATTRIBUTE) ?? undefined)
  const column = positiveLineNumber(element.getAttribute(FILE_REFERENCE_COLUMN_ATTRIBUTE) ?? undefined)
  return {
    path,
    ...(line === undefined ? {} : { line }),
    ...(line === undefined || column === undefined ? {} : { column }),
  }
}
