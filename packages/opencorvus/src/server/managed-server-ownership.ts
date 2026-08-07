import { ParentWatchdog } from "./parent-watchdog"
import { SidecarLock } from "./sidecar-lock"

export namespace ManagedServerOwnership {
  export class ExistingOwnerError extends Error {
    override readonly name = "ManagedServerExistingOwnerError"

    constructor(public readonly existing: SidecarLock.LockInfo | null) {
      super(
        existing
          ? `existing managed server holds the ownership scope (PID=${existing.pid}, port=${existing.port})`
          : "another managed server is racing to acquire the ownership scope",
      )
    }
  }

  export interface AcquireInput {
    scope: string
    parentPid: number
    port: number
    hostname: string
    onParentExit: (reason: string) => void
    watchdogIntervalMilliseconds?: number
  }

  export interface Handle {
    release: () => void
  }

  export function acquire(input: AcquireInput): Handle {
    const existing = SidecarLock.detectExisting(input.scope)
    if (existing) throw new ExistingOwnerError(existing)

    let lock: ReturnType<typeof SidecarLock.acquire>
    try {
      lock = SidecarLock.acquire({
        pid: process.pid,
        port: input.port,
        hostname: input.hostname,
        parentPid: input.parentPid,
        workspace: input.scope,
        startedAt: Date.now(),
      })
    } catch (error) {
      if (error instanceof SidecarLock.SidecarLockContendedError) {
        throw new ExistingOwnerError(error.existing)
      }
      throw error
    }

    let watchdog: ReturnType<typeof ParentWatchdog.start>
    try {
      watchdog = ParentWatchdog.start({
        parentPid: input.parentPid,
        intervalMs: input.watchdogIntervalMilliseconds,
        onOrphan: input.onParentExit,
      })
    } catch (error) {
      lock.release()
      throw error
    }

    let released = false
    return {
      release() {
        if (released) return
        watchdog.stop()
        lock.release()
        released = true
      },
    }
  }
}
