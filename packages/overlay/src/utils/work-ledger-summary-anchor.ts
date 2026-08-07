/**
 * Keep Work Ledger summary cards beside the complete left project column while
 * preserving the hovered row's vertical position.
 */
export function workLedgerSummaryAnchorRect(row: HTMLElement | undefined): DOMRect | undefined {
  if (!row) return undefined
  const sidebar = row.closest<HTMLElement>("#sidebar")
  if (!sidebar) return undefined
  const rowRect = row.getBoundingClientRect()
  const sidebarRect = sidebar.getBoundingClientRect()
  return new DOMRect(sidebarRect.left, rowRect.top, sidebarRect.width, rowRect.height)
}
