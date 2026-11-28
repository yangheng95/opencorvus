import type { InteractiveArtifactPayload } from "./interactive-artifact"
import { matchesSearchTerms } from "./text-search"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
export type ArtifactTableCell = TablePayload["rows"][number][string] | undefined
export type ArtifactTableDataType = TablePayload["columns"][number]["dataType"]

function artifactTableDate(value: ArtifactTableCell): Date | undefined {
  if (value === null || value === undefined) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Compare instants while keeping unparsed cells together in source order. */
export function compareArtifactTableDates(left: ArtifactTableCell, right: ArtifactTableCell): number {
  const a = artifactTableDate(left)
  const b = artifactTableDate(right)
  if (!a || !b) return a ? -1 : b ? 1 : 0
  return Math.sign(a.getTime() - b.getTime())
}

export function createArtifactTablePresentation(locale: string, labels: { yes: string; no: string }) {
  const numbers = new Intl.NumberFormat(locale, { maximumSignificantDigits: 21 })
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const formatCell = (value: ArtifactTableCell, dataType: ArtifactTableDataType): string => {
    if (value === null || value === undefined) return "—"
    if (dataType === "boolean" && typeof value === "boolean") return value ? labels.yes : labels.no
    if (dataType === "number" && typeof value === "number") return numbers.format(value)
    if (dataType === "date") {
      const date = artifactTableDate(value)
      if (date) return dates.format(date)
    }
    return String(value)
  }
  return {
    formatCell,
    matchesRow: (query: string, row: TablePayload["rows"][number], columns: readonly TablePayload["columns"][number][]) =>
      matchesSearchTerms(query, columns.flatMap((column) => [row[column.id], formatCell(row[column.id], column.dataType)])),
  }
}
