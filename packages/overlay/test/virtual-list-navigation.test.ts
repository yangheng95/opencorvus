import { expect, test } from "bun:test"
import { virtualListPageIndex } from "../src/utils/virtual-list-navigation"

function measuredRows(viewportSize: number, sizes: number[]) {
  let offset = 0
  const offsets = sizes.map((size) => {
    const start = offset
    offset += size
    return start
  })
  return {
    viewportSize,
    getItemSize: (index: number) => sizes[index]!,
    getItemOffset: (index: number) => offsets[index]!,
    findItemIndex: (position: number) => Math.max(0, offsets.findLastIndex((start) => start <= position)),
  }
}

test("virtual paging keeps one row of overlap and rounds toward the current row", () => {
  const sizes = Array<number>(14).fill(36)
  const list = measuredRows(180, sizes)
  const firstPage = virtualListPageIndex(list, 0, sizes.length, 1)
  const secondPage = virtualListPageIndex(list, firstPage, sizes.length, 1)
  expect([firstPage, secondPage]).toEqual([4, 8])

  const unevenList = measuredRows(160, [22, 38, 46, 30, 44, 32, 40])
  expect(virtualListPageIndex(unevenList, 5, 7, -1)).toBe(2)
})

test("virtual paging reaches adjacent rows and the first and last rows in a short viewport", () => {
  const list = measuredRows(70, [48, 56, 44])
  expect(virtualListPageIndex(list, 0, 3, 1)).toBe(1)
  expect(virtualListPageIndex(list, 1, 3, 1)).toBe(2)
  expect(virtualListPageIndex(list, 2, 3, 1)).toBe(2)
  expect(virtualListPageIndex(list, 2, 3, -1)).toBe(1)
  expect(virtualListPageIndex(list, 1, 3, -1)).toBe(0)
  expect(virtualListPageIndex(list, 0, 3, -1)).toBe(0)
})
