import { AppLog } from "./log"
import { createAnimationFrameScheduler } from "./animation-frame"

/** Temporary observation of real pointer/focus ordering; removed before delivery. */
export function observeActivation297(container: HTMLElement): () => void {
  let retired = false
  let sequence = 0
  let pressed: Element | null = null
  let records: unknown[] = []
  const identities = new WeakMap<Element, number>()
  const shape = (element: Element | null) => {
    if (!element) return null
    if (!identities.has(element)) identities.set(element, ++sequence)
    const rect = element.getBoundingClientRect()
    return { identity: identities.get(element), tag: element.tagName, class: element.className,
      connected: element.isConnected, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      pointerEvents: getComputedStyle(element).pointerEvents, style: element.getAttribute("style"),
      sessionID: element.closest("[data-session-id]")?.getAttribute("data-session-id") }
  }
  const sample = (phase: string, event: Event) => {
    if (retired) return
    const target = event.target instanceof Element ? event.target : null
    records.push({ phase, time: performance.now(), target: shape(target), pressed: shape(pressed),
      buttons: Array.from(container.querySelectorAll(".subagent-progress-card__activation")).map(shape),
      focus: shape(document.activeElement), top: container.scrollTop,
      window: shape(container.querySelector(".conversation-virtual-window")),
      x: event instanceof MouseEvent ? event.clientX : undefined,
      y: event instanceof MouseEvent ? event.clientY : undefined,
      detail: event instanceof MouseEvent ? event.detail : undefined })
    records = records.slice(-64)
  }
  let lastEvent: Event | undefined
  const flush = createAnimationFrameScheduler(() => {
    if (retired || !lastEvent) return
    sample(`${lastEvent.type}:frame`, lastEvent)
    AppLog.info("activation-297", "Actual conversation activation trace", { records })
    records = []
  })
  const observe = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    const button = target?.closest(".subagent-progress-card__activation") ?? null
    if (event.type === "pointerdown") pressed = button
    sample(event.type, event)
    queueMicrotask(() => sample(`${event.type}:microtask`, event))
    lastEvent = event
    if (["pointerup", "pointercancel", "click", "focusin"].includes(event.type)) flush.schedule()
  }
  const events = ["pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup", "click", "focusin", "focusout"]
  for (const type of events) container.addEventListener(type, observe, true)
  return () => {
    retired = true
    flush.cancel()
    for (const type of events) container.removeEventListener(type, observe, true)
  }
}
