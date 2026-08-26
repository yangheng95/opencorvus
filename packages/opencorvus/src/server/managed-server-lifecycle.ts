import { ParentWatchdog } from "./parent-watchdog"

export namespace ManagedServerLifecycle {
  export interface StartInput {
    /** The exact host occurrence, not a reusable process number. */
    parent: { pid: number; processInstanceID?: string; occurrenceID?: string }
    onParentExit: (reason: string) => void
    watchdogIntervalMilliseconds?: number
  }

  export interface Handle {
    release(): void
  }

  /** Bind a managed backend to its exact host lifetime without claiming a
   * database, data directory, listener port or global sidecar scope. */
  export function start(input: StartInput): Handle {
    const watchdog = ParentWatchdog.start({
      parent: input.parent,
      intervalMs: input.watchdogIntervalMilliseconds,
      onOrphan: input.onParentExit,
    })
    let released = false
    return {
      release() {
        if (released) return
        watchdog.stop()
        released = true
      },
    }
  }
}
