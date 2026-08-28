import { Log } from "../util/log"
import { observeRuntimeProcessOccurrence, type RuntimeProcessOccurrenceInfo } from "../runtime/process-occurrence"

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
    /** The exact host occurrence established by the launcher before spawn. */
    parent: RuntimeProcessOccurrenceInfo
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
      const observation = observe(opts.parent)
      if (observation !== "exact_live") {
        orphan(
          observation === "dead_or_reused"
            ? "parent-watchdog: parent process occurrence exited or its identifier was reused"
            : "parent-watchdog: parent process occurrence can no longer be observed exactly",
        )
        return
      }
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
