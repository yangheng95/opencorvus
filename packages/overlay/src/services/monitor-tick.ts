// ── Connection monitor tick (testable) ──
//
// audit-2026-04-29 W2-V24. Lifted out of connection.ts so the
// re-entrance guard is unit-testable without driving real timers
// through setInterval / setTimeout.

export interface MonitorTickDeps {
  /** Skip the tick when the overlay window is hidden (battery savings). */
  isHidden: () => boolean
  /** True when the overlay considered itself online before this probe. */
  isConnected: () => boolean
  /** Stable managed-server identity, such as the Tauri sidecar process ID. */
  connectionIdentity?: () => string | number | undefined
  /** False when the owning monitor has been stopped or superseded. */
  isCurrent?: () => boolean
  /** Probe the server. Resolves true on success, false on failure. */
  check: () => Promise<boolean>
  /** Optional post-success hook (reload tasks, etc.). */
  onReconnect?: () => void | Promise<void>
  /** Override for tests; defaults to console.warn. */
  warn?: (...args: unknown[]) => void
}

/**
 * Build a single-arity async function that the host can pass to
 * setInterval. The guard ensures only ONE tick is in-flight at any
 * time — `checkConnection` for a managed local server has a budget
 * of ≈42 s but the monitor's setInterval fires every 10 s.
 * setInterval doesn't wait for the previous async callback to
 * finish, so on a hung backend we'd accumulate 4-5 overlapping
 * tick calls — each holding an AbortController + spawning fresh
 * fetches + chasing onReconnect handlers. The flag drops new ticks
 * while the previous one is alive.
 */
export function makeMonitorTick(deps: MonitorTickDeps): () => Promise<void> {
  let inFlight = false
  const warn = deps.warn ?? ((...a: unknown[]) => console.warn(...a))
  const isCurrent = deps.isCurrent ?? (() => true)
  return async () => {
    if (!isCurrent()) return
    if (deps.isHidden()) return
    if (inFlight) return
    inFlight = true
    try {
      if (!isCurrent()) return
      const wasConnected = deps.isConnected()
      const identityBefore = deps.connectionIdentity?.()
      const ok = await deps.check()
      if (!isCurrent()) return
      const identityAfter = deps.connectionIdentity?.()
      const managedServerReplaced =
        identityBefore !== undefined && identityAfter !== undefined && identityBefore !== identityAfter
      if (ok && (!wasConnected || managedServerReplaced)) {
        await deps.onReconnect?.()
      }
    } catch (err) {
      warn("[connection] monitor retry failed", err)
    } finally {
      inFlight = false
    }
  }
}
