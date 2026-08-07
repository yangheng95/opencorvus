import { Log } from "../util/log"

const log = Log.create({ service: "parent-watchdog" })

export namespace ParentWatchdog {
  /**
   * Poll for the existence of `parentPid` every `intervalMs`. When the
   * parent process disappears, invoke `onOrphan(reason)` exactly once and
   * stop polling.
   *
   * Used by managed desktop hosts so a parent-process crash, force quit, or
   * out-of-memory termination never leaves the server as an orphan that holds
   * the Database lock indefinitely.
   *
   * Returns a stop() handle for graceful teardown when the sidecar is
   * shutting down for legitimate reasons.
   */
  export function start(opts: { parentPid: number; intervalMs?: number; onOrphan: (reason: string) => void }): {
    stop: () => void
  } {
    const intervalMs = opts.intervalMs ?? 5000
    let stopped = false
    let fired = false

    const tick = () => {
      if (stopped || fired) return
      try {
        process.kill(opts.parentPid, 0)
      } catch (err: any) {
        if (err?.code === "ESRCH") {
          fired = true
          log.warn("parent gone, triggering self-shutdown", { parentPid: opts.parentPid })
          try {
            opts.onOrphan("parent-watchdog: parent process exited")
          } catch (e) {
            log.error("onOrphan threw", { error: String(e) })
          }
          return
        }
        // EPERM means parent exists but we can't signal it; treat as alive.
      }
    }

    const handle = setInterval(tick, intervalMs)
    // Don't keep event loop alive solely for this watchdog.
    if (typeof handle.unref === "function") handle.unref()

    log.info("started", { parentPid: opts.parentPid, intervalMs })

    return {
      stop: () => {
        if (stopped) return
        stopped = true
        clearInterval(handle)
        log.info("stopped")
      },
    }
  }
}
