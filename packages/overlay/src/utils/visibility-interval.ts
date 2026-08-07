export interface VisibilityInterval {
  start: () => void
  stop: () => void
  dispose: () => void
}

export interface VisibilityIntervalOptions {
  onVisible?: () => void
}

function documentIsHidden(): boolean {
  return typeof document !== "undefined" && document.hidden === true
}

function canListenForVisibility(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.addEventListener === "function" &&
    typeof document.removeEventListener === "function"
  )
}

export function createVisibilityInterval(
  fn: () => void,
  ms: number,
  options: VisibilityIntervalOptions = {},
): VisibilityInterval {
  let active = false
  let disposed = false
  let timer: ReturnType<typeof setInterval> | undefined
  let listening = false

  const clearTimer = () => {
    if (timer === undefined) return
    clearInterval(timer)
    timer = undefined
  }

  const startTimer = () => {
    if (disposed || !active || timer !== undefined || documentIsHidden()) return
    timer = setInterval(fn, ms)
  }

  const onVisibility = () => {
    if (documentIsHidden()) {
      clearTimer()
      return
    }
    if (active) options.onVisible?.()
    startTimer()
  }

  const ensureListener = () => {
    if (listening || !canListenForVisibility()) return
    document.addEventListener("visibilitychange", onVisibility)
    listening = true
  }

  return {
    start() {
      if (disposed) return
      active = true
      ensureListener()
      startTimer()
    },
    stop() {
      active = false
      clearTimer()
    },
    dispose() {
      if (disposed) return
      disposed = true
      active = false
      clearTimer()
      if (listening) {
        document.removeEventListener("visibilitychange", onVisibility)
        listening = false
      }
    },
  }
}
