import { expect, test } from "bun:test"
import { markdownSectionIndex } from "../src/utils/markdown-section"

test("section fragments locate the corresponding readable heading", () => {
  const labels = ["Navigation notes", "Context", "Summary"]
  expect(markdownSectionIndex(labels, "navigation-notes")).toBe(0)
  expect(markdownSectionIndex(labels, "summary")).toBe(2)
})

test("duplicate labels and authored suffixes follow their document order", () => {
  const labels = ["Summary", "Summary", "Summary-1", "Summary"]
  expect(markdownSectionIndex(labels, "summary-1")).toBe(1)
  expect(markdownSectionIndex(labels, "summary-1-1")).toBe(2)
  expect(markdownSectionIndex(labels, "summary-2")).toBe(3)
})

test("encoded Unicode fragments locate exact labels and repeated chapters", () => {
  const labels = ["Résumé", "中文章节", "中文章节"]
  expect(markdownSectionIndex(labels, "r%C3%A9sum%C3%A9")).toBe(0)
  expect(markdownSectionIndex(labels, "%E4%B8%AD%E6%96%87%E7%AB%A0%E8%8A%82-1")).toBe(2)
})

test("readable nested formatting and literal entity spellings retain distinct labels", () => {
  const labels = ["Nested emphasis", "Literal &amp;", "Guide icon"]
  expect(markdownSectionIndex(labels, "nested-emphasis")).toBe(0)
  expect(markdownSectionIndex(labels, "literal-amp")).toBe(1)
  expect(markdownSectionIndex(labels, "guide-icon")).toBe(2)
})

test("each document starts its own repeated-heading sequence", () => {
  expect(markdownSectionIndex(["Summary", "Summary"], "summary-1")).toBe(1)
  expect(markdownSectionIndex(["Other", "Summary"], "summary")).toBe(1)
})

test("authored spaces in readable code labels retain their own section identity", () => {
  expect(markdownSectionIndex([" A ", "A"], "-a-")).toBe(0)
  expect(markdownSectionIndex([" A ", "A"], "a")).toBe(1)
})
