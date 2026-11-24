import { expect, test } from "bun:test"
import { renderedListPageIndex } from "../src/utils/rendered-list-navigation"

test("rendered paging uses actual distances across variable row heights", () => {
  const rows = [
    { top: 0, height: 30 },
    { top: 40, height: 36 },
    { top: 82, height: 36 },
    { top: 125, height: 44 },
    { top: 181, height: 30 },
    { top: 250, height: 50 },
  ]
  const measure = (index: number) => rows[index]
  expect(renderedListPageIndex(0, rows.length, 1, 147, measure)).toBe(2)
  expect(renderedListPageIndex(4, rows.length, -1, 138, measure)).toBe(2)
})

test("rendered paging reaches the adjacent item when its bounds exceed the available page", () => {
  const rows = [{ top: 0, height: 90 }, { top: 100, height: 70 }, { top: 175, height: 65 }]
  const measure = (index: number) => rows[index]
  expect(renderedListPageIndex(0, rows.length, 1, 50, measure)).toBe(1)
  expect(renderedListPageIndex(1, rows.length, 1, 50, measure)).toBe(2)
  expect(renderedListPageIndex(1, rows.length, -1, 50, measure)).toBe(0)
})
