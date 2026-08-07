export interface AnimationFrameScheduler {
  schedule: () => void
  cancel: () => void
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
