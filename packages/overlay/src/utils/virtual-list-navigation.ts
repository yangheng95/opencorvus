import type { VirtualizerHandle } from "virtua/solid"

type PageGeometry = Pick<VirtualizerHandle, "viewportSize" | "getItemSize" | "getItemOffset" | "findItemIndex">

export function virtualListPageIndex(
  geometry: PageGeometry,
  index: number,
  rowCount: number,
  direction: -1 | 1,
): number {
  const adjacent = index + direction
  if (adjacent < 0 || adjacent >= rowCount) return index

  const distance = Math.max(1, geometry.viewportSize - geometry.getItemSize(index))
  const offset = geometry.getItemOffset(index) + direction * distance
  let candidate = geometry.findItemIndex(offset)
  // When moving up, the containing row can start before the intended page.
  if (direction === -1 && geometry.getItemOffset(candidate) < offset) candidate += 1
  return direction === 1 ? Math.max(adjacent, candidate) : Math.min(adjacent, candidate)
}
