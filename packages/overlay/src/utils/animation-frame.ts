export interface AnimationFrameScheduler {
  schedule: () => void
  cancel: () => void
}

export function hasRunningLayoutAnimation(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.getAnimations().some((animation) =>
      animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime),
    )) return true
  }
  return false
}

export function createAnimationFrameScheduler(run: () => void): AnimationFrameScheduler {
  let frame = 0

  const cancel = () => {
    if (!frame) return
    cancelAnimationFrame(frame)
    frame = 0
  }

  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      run()
    })
  }

  return { schedule, cancel }
}
