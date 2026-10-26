import { csvParseRows } from "d3-dsv"
import Decimal from "decimal.js"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>

/** Compare decimal text precisely while leaving every displayed cell intact. */
export function csvCellComparator(locale: string): (left: unknown, right: unknown) => number {
  const collator = new Intl.Collator(locale, { numeric: true })
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
  const category = (text: string) => (text === "" ? 0 : decimal.test(text) ? 1 : 2)
  return (left, right) => {
    const a = String(left ?? ""),
      b = String(right ?? "")
    const aCategory = category(a),
      bCategory = category(b)
    if (aCategory !== bCategory) return aCategory - bCategory
    if (aCategory === 1) return new Decimal(a).comparedTo(b)
    return collator.compare(a, b)
  }
}

/** Present canonical CSV cells as text; downloads retain the original source. */
export function csvArtifactTable(
  title: string,
  source: string,
  columnLabel: (position: number) => string,
): TablePayload {
  const records = csvParseRows(source.startsWith("\uFEFF") ? source.slice(1) : source)
  const header = records[0] ?? []
  const width = records.reduce((maximum, record) => Math.max(maximum, record.length), 1)
  const columns = Array.from({ length: width }, (_, index) => ({
    id: `column-${index}`,
    label: header[index] || columnLabel(index + 1),
    dataType: "string" as const,
  }))
  return {
    schemaVersion: "1",
    renderer: "table@1",
    title,
    columns,
    rows: records
      .slice(1)
      .map((record) => Object.fromEntries(columns.map((column, index) => [column.id, record[index] ?? ""]))),
  }
}
