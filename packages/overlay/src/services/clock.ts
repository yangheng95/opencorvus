// ── Shared 1Hz tick signal ──
//
// Single source of "now" for any UI that renders live elapsed time
// (CardHeader duration chip for running cards, future per-card timers).
// TaskStatusHeader uses selected-task SSE activity, not this wall-clock tick.
// One module-level signal, one
// interval, visibility-gated so the overlay window in the background
// does not burn battery.
//
// Reference-counted: the first subscriber starts the interval, the last
// unsubscribe (onCleanup) stops it. Visibility hidden pauses the
// interval without un-mounting subscribers.
//
// Mirrors the gating behavior previously inlined in TaskStatusHeader's
// createEffect (window-visibility + battery saver) but lets every
// running card piggy-back on a single timer instead of one per card.

import { createSignal, onCleanup } from "solid-js"

const [now, setNow] = createSignal(Date.now())

let refCount = 0
let intervalHandle: ReturnType<typeof setInterval> | undefined
let visibilityListenerAttached = false
// Default to visible: only the `visibilitychange` listener flips this
// off. Reading `document.visibilityState` at module-load time is brittle
// because test harnesses polyfill `document` with `visibilityState`
// stuck at "prerender" / "" and would suppress the interval entirely.
let windowVisible: boolean = true

function start(intervalMs: number) {
  if (intervalHandle !== undefined) return
  if (!windowVisible) return
  setNow(Date.now())
  intervalHandle = setInterval(() => setNow(Date.now()), intervalMs)
}

function stop() {
  if (intervalHandle === undefined) return
  clearInterval(intervalHandle)
  intervalHandle = undefined
}

function ensureVisibilityListener(intervalMs: number) {
  if (visibilityListenerAttached) return
  if (typeof document === "undefined") return
  // Some test harnesses install a partial `document` stub on globalThis
  // with no addEventListener; skip attachment in that case rather than
  // crashing the first subscriber.
  if (typeof (document as any).addEventListener !== "function") return
  visibilityListenerAttached = true
  document.addEventListener("visibilitychange", () => {
    windowVisible = document.visibilityState === "visible"
    if (refCount === 0) return
    if (windowVisible) start(intervalMs)
    else stop()
  })
}

/**
 * Vanilla subscribe — increments the shared ref count, starts the
 * interval if this is the first subscriber, and returns an unsubscribe
 * function. Use this directly only when you cannot run inside a Solid
 * reactive scope (e.g. tests); prefer `useNowTick` from components.
 */
export function subscribeNowTick(intervalMs: number = 1000): {
  now: () => number
  unsubscribe: () => void
} {
  ensureVisibilityListener(intervalMs)
  refCount += 1
  if (refCount === 1) start(intervalMs)
  let released = false
  return {
    now,
    unsubscribe() {
      if (released) return
      released = true
      refCount = Math.max(0, refCount - 1)
      if (refCount === 0) stop()
    },
  }
}

/**
 * Subscribe to a shared 1Hz (or custom-interval) "now" signal. Returns
 * the read accessor; subscribers must call this hook inside a Solid
 * reactive scope so the matching `onCleanup` decrements the ref count.
 *
 * The interval is shared across all subscribers — calling this hook
 * twice does not create a second timer. The first subscriber starts it,
 * the last unsubscribe stops it.
 */
export function useNowTick(intervalMs: number = 1000): () => number {
  const { now: read, unsubscribe } = subscribeNowTick(intervalMs)
  onCleanup(unsubscribe)
  return read
}

/** Test-only escape hatch — resets ref count and stops the interval.
 *  Production callers must rely on onCleanup, not this. */
export function __resetNowTickForTests(): void {
  refCount = 0
  stop()
}
