import { createSignal } from "solid-js"

export type TooltipInputPriority = ReturnType<typeof createTooltipInputPriority>

const documentPointer = new WeakMap<Document, { id: number; x: number; y: number }>()

export function observeTooltipPointer(document: Document): () => void {
  function rememberPointer(event: PointerEvent): void {
    if (event.pointerType === "touch") return
    documentPointer.set(document, { id: event.pointerId, x: event.clientX, y: event.clientY })
  }

  const controller = new AbortController()
  const options = { capture: true, passive: true, signal: controller.signal }
  document.addEventListener("pointermove", rememberPointer, options)
  document.addEventListener("pointerdown", rememberPointer, options)
  return () => {
    controller.abort()
    documentPointer.delete(document)
  }
}

export function createTooltipInputPriority() {
  const [focusOnly, setFocusOnly] = createSignal(false)

  function preferFocus(): void {
    setFocusOnly(true)
  }

  function trackPointer(event: PointerEvent): void {
    if (event.pointerType === "touch") return
    if (event.type === "pointerenter" && event.currentTarget instanceof Element) {
      const last = documentPointer.get(event.currentTarget.ownerDocument)
      // Layout changes can enter a new trigger without physically moving the pointer.
      if (last?.id === event.pointerId && last.x === event.clientX && last.y === event.clientY) return
    }
    setFocusOnly(false)
  }

  return { focusOnly, preferFocus, trackPointer }
}
