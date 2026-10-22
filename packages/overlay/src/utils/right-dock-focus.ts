/** Return a completed Dock action to its current visible controls. */
export function restoreRightDockFocus(dock: HTMLElement, origin: Element): void {
  if (!dock.isConnected || dock.inert || dock.dataset.open !== "true") return
  if (document.activeElement !== origin && document.activeElement !== document.body) return

  const target = dock.querySelector('.right-dock-tab-shell[data-open="true"]')
    ? dock.querySelector<HTMLButtonElement>('.right-dock-tab[aria-selected="true"]:enabled')
    : dock.querySelector<HTMLButtonElement>(".right-dock-add")
  if (
    target &&
    !target.disabled &&
    !target.closest('[inert], [hidden], [aria-hidden="true"]') &&
    target.getClientRects().length
  ) {
    target.focus({ preventScroll: true })
  }
}
