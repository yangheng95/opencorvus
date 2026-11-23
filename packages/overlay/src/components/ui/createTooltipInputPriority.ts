import { createSignal } from "solid-js"

export function createTooltipInputPriority() {
  const [focusOnly, setFocusOnly] = createSignal(false)
  let pointerPosition: { x: number; y: number } | undefined

  function preferFocus(): void {
    setFocusOnly(true)
  }

  function trackPointer(event: PointerEvent): void {
    if (event.pointerType === "touch") return
    const { clientX: x, clientY: y } = event
    const moved = pointerPosition?.x !== x || pointerPosition?.y !== y
    pointerPosition = { x, y }
    // A different trigger can move under a stationary pointer and receive pointerenter.
    if (moved || event.type === "pointerdown") setFocusOnly(false)
  }

  return { focusOnly, preferFocus, trackPointer }
}
