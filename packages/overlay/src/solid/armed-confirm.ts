import { createSignal, onCleanup, type Accessor } from "solid-js"

export interface ArmedConfirm {
  /** Reactive armed flag for confirm affordance styling. */
  armed: Accessor<boolean>
  /** Arm the action and start (or restart) the confirm window. */
  arm: () => void
  /** Clear the armed state immediately. */
  disarm: () => void
  /** First call arms, second call within the window commits. */
  confirm: (commit: () => void) => boolean
}

export function useArmedConfirm(windowMs = 3000): ArmedConfirm {
  const [armed, setArmed] = createSignal(false)
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  function disarm() {
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = undefined
    }
    setArmed(false)
  }

  function arm() {
    disarm()
    setArmed(true)
    resetTimer = setTimeout(disarm, windowMs)
  }

  onCleanup(disarm)

  return {
    armed,
    arm,
    disarm,
    confirm: (commit) => {
      if (armed()) {
        disarm()
        commit()
        return true
      }
      arm()
      return false
    },
  }
}
