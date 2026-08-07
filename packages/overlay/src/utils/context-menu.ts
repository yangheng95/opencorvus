export type ContextMenuEventTarget = Pick<EventTarget, "addEventListener">

type ClosestEventTarget = EventTarget & {
  closest?: (selector: string) => unknown
}

function hasAppContextMenuTrigger(event: Event): boolean {
  const target = event.target as ClosestEventTarget | null
  return typeof target?.closest === "function" && Boolean(target.closest('[data-app-context-menu-trigger="true"]'))
}

export function suppressNativeContextMenu(event: Event): void {
  if (hasAppContextMenuTrigger(event)) return
  event.preventDefault()
}

export function installNativeContextMenuSuppression(target: ContextMenuEventTarget, signal?: AbortSignal): void {
  target.addEventListener("contextmenu", suppressNativeContextMenu, {
    capture: true,
    signal,
  })
}
