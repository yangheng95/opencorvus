import { expect, test } from "bun:test"
import { compareLineEndings, textComparisonCounts } from "../src/utils/text-comparison"

test("groups consecutive lines with the same ending change", () => {
  const before = "Manifest\nPallets: 12\nReceived\n"
  const after = "Manifest\r\nPallets: 12\r\nReceived\r\n"

  expect(compareLineEndings(before, after)).toEqual([
    { firstLine: 1, lastLine: 3, before: "\n", after: "\r\n" },
  ])
  expect(textComparisonCounts(before, after)).toEqual({ additions: 3, deletions: 3 })
})

test("reports exact affected lines when separator formats are mixed", () => {
  expect(compareLineEndings("A\r\nB\nC\rD\n", "A\rB\nC\r\nD")).toEqual([
    { firstLine: 1, lastLine: 1, before: "\r\n", after: "\r" },
    { firstLine: 3, lastLine: 3, before: "\r", after: "\r\n" },
    { firstLine: 4, lastLine: 4, before: "\n", after: null },
  ])
})

test("reports an added ending on the same last line", () => {
  expect(compareLineEndings("Checklist\nEnd", "Checklist\nEnd\n")).toEqual([
    { firstLine: 2, lastLine: 2, before: null, after: "\n" },
  ])
})
