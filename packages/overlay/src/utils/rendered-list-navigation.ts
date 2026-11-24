type RowBounds = { top: number; height: number }

export function revealRenderedListRow(row: HTMLElement, viewport: HTMLElement): void {
  const block = row.getBoundingClientRect().height > viewport.clientHeight ? "start" : "nearest"
  row.scrollIntoView({ block, inline: "nearest" })
}

export function renderedListPageIndex(
  index: number,
  rowCount: number,
  direction: -1 | 1,
  viewportSize: number,
  measureRow: (index: number) => RowBounds | undefined,
): number | undefined {
  const adjacent = index + direction
  if (adjacent < 0 || adjacent >= rowCount) return
  const current = measureRow(index)
  if (!current) return

  const distance = Math.max(1, viewportSize - current.height)
  let target = adjacent
  for (let candidate = adjacent + direction; candidate >= 0 && candidate < rowCount; candidate += direction) {
    const row = measureRow(candidate)
    if (!row || (row.top - current.top) * direction > distance) break
    target = candidate
  }
  return target
}
