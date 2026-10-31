const VIEWPORT_COVERAGE_TRANSITION_EVENT = "opencorvus:viewport-coverage-transition"
const pendingRequests = new Set<{ element: HTMLElement }>()

/** Keep floating controls in their actual page-owned top layer. */
export function topLayerPortalMount(anchor: Element | undefined): Element | undefined {
  const workspace = anchor?.closest("[data-artifact-workspace]:popover-open, .msg-artifact--mcp-pip:popover-open")
  if (workspace) return workspace
  const fullscreen = anchor?.ownerDocument.fullscreenElement
  return fullscreen && anchor && fullscreen.contains(anchor) ? fullscreen : undefined
}

/** Expand the original mounted artifact inside the application viewport. */
export function openArtifactWorkspace(element: HTMLElement): void {
  const request = { element }
  const document = element.ownerDocument
  pendingRequests.add(request)
  document.dispatchEvent(new CustomEvent(VIEWPORT_COVERAGE_TRANSITION_EVENT, { detail: true }))
  try {
    const slot = element.parentElement
    if (slot?.classList.contains("msg-artifact-slot")) {
      slot.style.setProperty("--artifact-inline-height", `${element.getBoundingClientRect().height}px`)
    }
    element.setAttribute("data-artifact-workspace", "")
    element.setAttribute("popover", "auto")
    element.showPopover()
  } finally {
    pendingRequests.delete(request)
    document.dispatchEvent(new CustomEvent(VIEWPORT_COVERAGE_TRANSITION_EVENT, { detail: false }))
  }
}

export function closeArtifactWorkspace(element: HTMLElement): void {
  if (element.matches(":popover-open")) element.hidePopover()
  element.removeAttribute("popover")
  element.removeAttribute("data-artifact-workspace")
  if (element.parentElement?.classList.contains("msg-artifact-slot")) {
    element.parentElement.style.removeProperty("--artifact-inline-height")
  }
}

export function isReadingViewportVisible(viewport: HTMLElement): boolean {
  const document = viewport.ownerDocument
  if (document.fullscreenElement && !document.fullscreenElement.contains(viewport)) return false
  const workspace = document.querySelector("[data-artifact-workspace]:popover-open")
  if (workspace && !workspace.contains(viewport)) return false
  for (const { element } of pendingRequests) {
    if (element.ownerDocument === document && !element.contains(viewport)) return false
  }
  return true
}

export function observeReadingViewport(viewport: HTMLElement, changed: (beforeRequest: boolean) => void): () => void {
  const document = viewport.ownerDocument
  const transitionChanged = (event: Event) => changed((event as CustomEvent<boolean>).detail)
  const fullscreenChanged = () => changed(false)
  const workspaceChanged = (event: Event) => {
    if (event.target instanceof Element && event.target.hasAttribute("data-artifact-workspace")) changed(false)
  }
  document.addEventListener(VIEWPORT_COVERAGE_TRANSITION_EVENT, transitionChanged)
  document.addEventListener("fullscreenchange", fullscreenChanged)
  document.addEventListener("toggle", workspaceChanged, true)
  return () => {
    document.removeEventListener(VIEWPORT_COVERAGE_TRANSITION_EVENT, transitionChanged)
    document.removeEventListener("fullscreenchange", fullscreenChanged)
    document.removeEventListener("toggle", workspaceChanged, true)
  }
}
