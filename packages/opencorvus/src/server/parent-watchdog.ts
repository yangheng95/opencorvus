import { Log } from "../util/log"
import {
  isProcessNumberAlive,
  observeRuntimeProcessOccurrence,
  type RuntimeProcessOccurrenceInfo,
} from "../runtime/process-occurrence"

const log = Log.create({ service: "parent-watchdog" })

export namespace ParentWatchdog {
  /**
   * Watch the exact parent process OCCURRENCE every `intervalMs`. When that
   * occurrence is gone, invoke `onOrphan(reason)` exactly once and stop.
   *
   * A bare PID is not an identity: after the desktop parent dies the operating
   * system reuses its number, and a PID-only watchdog then reads an unrelated
   * process as its own host and keeps the backend — with its listener, its
   * database lock and its runtime — alive forever. The supervisor therefore
   * hands over the parent's process-instance fingerprint alongside the PID,
   * and reuse is terminal exactly like exit.
   *
   * Returns a stop() handle for graceful teardown when the sidecar is
   * shutting down for legitimate reasons.
   */
  export function start(opts: {
    /** The host occurrence. `processInstanceID` is absent only where the
     *  platform cannot fingerprint a process, and the watch then keeps the
     *  weaker process-number liveness rather than a fabricated identity. */
    parent: { pid: number; processInstanceID?: string; occurrenceID?: string }
    intervalMs?: number
    onOrphan: (reason: string) => void
    observe?: (owner: RuntimeProcessOccurrenceInfo) => "exact_live" | "dead_or_reused" | "unknown_live"
  }): {
    stop: () => void
  } {
    const intervalMs = opts.intervalMs ?? 5000
    const observe = opts.observe ?? observeRuntimeProcessOccurrence
    let stopped = false
    let fired = false

    const orphan = (reason: string) => {
      fired = true
      log.warn("parent occurrence gone, triggering self-shutdown", {
        parentPid: opts.parent.pid,
        parentInstance: opts.parent.processInstanceID,
        reason,
      })
      try {
        opts.onOrphan(reason)
      } catch (e) {
        log.error("onOrphan threw", { error: String(e) })
      }
    }

    const tick = () => {
      if (stopped || fired) return
      const fingerprint = opts.parent.processInstanceID
      const observation = fingerprint
        ? observe({
            pid: opts.parent.pid,
            processInstanceID: fingerprint,
            occurrenceID: opts.parent.occurrenceID ?? "",
          })
        : isProcessNumberAlive(opts.parent.pid)
          ? ("unknown_live" as const)
          : ("dead_or_reused" as const)
      if (observation === "dead_or_reused") {
        orphan("parent-watchdog: parent process occurrence exited or its identifier was reused")
        return
      }
      // "exact_live" is the host still running; "unknown_live" is a process
      // this platform cannot fingerprint, which stays the pre-existing
      // liveness answer rather than a false orphan.
    }

    const handle = setInterval(tick, intervalMs)
    // Don't keep event loop alive solely for this watchdog.
    if (typeof handle.unref === "function") handle.unref()

    log.info("started", {
      parentPid: opts.parent.pid,
      parentInstance: opts.parent.processInstanceID,
      intervalMs,
    })

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
