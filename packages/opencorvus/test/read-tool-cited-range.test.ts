import { describe, expect, test } from "bun:test"
import { citedReadRange } from "@/tool/read"
import { readTextFilePageContent } from "@/tool/text-file"

const file = (lines: number) =>
  Array.from({ length: lines }, (_, index) => `line ${index + 1}`).join("\n")

describe("read citations name a location, not a receipt", () => {
  test("a windowed read cites the window it read", () => {
    const page = readTextFilePageContent(file(400), { offset: 120, limit: 30 })
    expect(citedReadRange(page)).toEqual({ range: { startLine: 120, endLine: 149 } })
  })

  test("a truncated first page still cites where it stopped", () => {
    const page = readTextFilePageContent(file(400), { limit: 50 })
    expect(page.offset).toBe(1)
    expect(page.truncated).toBe(true)
    expect(citedReadRange(page)).toEqual({ range: { startLine: 1, endLine: 50 } })
  })
})
