import { describe, expect, test } from "bun:test"
import { citedReadRange } from "@/tool/read"
import { readTextFilePageContent } from "@/tool/text-file"

const file = (lines: number) =>
  Array.from({ length: lines }, (_, index) => `line ${index + 1}`).join("\n")

describe("read citations name a location, not a receipt", () => {
  test("a whole-file read cites no range", () => {
    const page = readTextFilePageContent(file(40), {})
    expect(page.offset).toBe(1)
    expect(page.truncated).toBe(false)
    // Citing 1..40 would send every citation click to the top of the file
    // dressed up as a jump — indistinguishable from a jump that failed.
    expect(citedReadRange(page)).toBeUndefined()
  })

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

  test("an empty file cites nothing", () => {
    const page = readTextFilePageContent("", {})
    expect(citedReadRange(page)).toBeUndefined()
  })
})
