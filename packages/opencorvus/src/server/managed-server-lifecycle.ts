import { ParentWatchdog } from "./parent-watchdog"
import type { RuntimeProcessOccurrenceInfo } from "../runtime/process-occurrence"

export namespace ManagedServerLifecycle {
  export interface StartInput {
    /** The exact host occurrence, not a reusable process number. */
    parent: RuntimeProcessOccurrenceInfo
    onParentExit: (reason: string) => void
    watchdogIntervalMilliseconds?: number
  }

  export interface Handle {
    release(): void
  }

  /** Admit either an unmanaged server or one complete launcher-minted parent
   * occurrence. A partial/PID-only managed identity has no ownership meaning. */
  export function parentInput(input: {
    pid?: number
    processInstanceID?: string
    occurrenceID?: string
  }): { parent: RuntimeProcessOccurrenceInfo } | undefined {
    const processInstanceID = input.processInstanceID?.trim()
    if (input.pid === undefined && processInstanceID === undefined) return undefined
    if (!Number.isSafeInteger(input.pid) || input.pid! <= 0) {
      throw new Error("Managed serve requires a positive safe-integer --parent-pid")
    }
    if (!processInstanceID) {
      throw new Error("Managed serve requires --parent-process-instance-id with --parent-pid")
    }
    return {
      parent: {
        pid: input.pid!,
        processInstanceID,
        occurrenceID: input.occurrenceID?.trim() || `managed-parent:${input.pid}:${processInstanceID}`,
      },
    }
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
