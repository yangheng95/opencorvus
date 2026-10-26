import type { InteractiveArtifactPayload } from "./interactive-artifact"
import { matchesSearchParts } from "./text-search"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
export type ArtifactTableCell = TablePayload["rows"][number][string] | undefined
export type ArtifactTableDataType = TablePayload["columns"][number]["dataType"]

export function createArtifactTablePresentation(locale: string, labels: { yes: string; no: string }) {
  const numbers = new Intl.NumberFormat(locale)
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const formatCell = (value: ArtifactTableCell, dataType: ArtifactTableDataType): string => {
    if (value === null || value === undefined) return "—"
    if (dataType === "boolean" && typeof value === "boolean") return value ? labels.yes : labels.no
    if (dataType === "number" && typeof value === "number") return numbers.format(value)
    if (dataType === "date") {
      const date = new Date(String(value))
      if (!Number.isNaN(date.getTime())) return dates.format(date)
    }
    return String(value)
  }
  return {
    formatCell,
    matchesCell: (query: string, value: ArtifactTableCell, dataType: ArtifactTableDataType) =>
      matchesSearchParts(query, [value, formatCell(value, dataType)]),
  }
}
