const FULLSCREEN_TRANSITION_EVENT = "opencorvus:fullscreen-transition"
const pendingRequests = new Set<{ element: HTMLElement }>()

/** Notify readers before the browser resizes the viewport for native fullscreen. */
export async function requestNativeFullscreen(element: HTMLElement): Promise<void> {
  const request = { element }
  const document = element.ownerDocument
  pendingRequests.add(request)
  document.dispatchEvent(new CustomEvent(FULLSCREEN_TRANSITION_EVENT, { detail: true }))
  try {
    await element.requestFullscreen()
  } finally {
    pendingRequests.delete(request)
    document.dispatchEvent(new CustomEvent(FULLSCREEN_TRANSITION_EVENT, { detail: false }))
  }
}

export function isFullscreenViewportVisible(viewport: HTMLElement): boolean {
  const document = viewport.ownerDocument
  if (document.fullscreenElement && !document.fullscreenElement.contains(viewport)) return false
  for (const { element } of pendingRequests) {
    if (element.ownerDocument === document && !element.contains(viewport)) return false
  }
  return true
}

export function observeFullscreenViewport(viewport: HTMLElement, changed: (beforeRequest: boolean) => void): () => void {
  const document = viewport.ownerDocument
  const transitionChanged = (event: Event) => changed((event as CustomEvent<boolean>).detail)
  const fullscreenChanged = () => changed(false)
  document.addEventListener(FULLSCREEN_TRANSITION_EVENT, transitionChanged)
  document.addEventListener("fullscreenchange", fullscreenChanged)
  return () => {
    document.removeEventListener(FULLSCREEN_TRANSITION_EVENT, transitionChanged)
    document.removeEventListener("fullscreenchange", fullscreenChanged)
  }
}
