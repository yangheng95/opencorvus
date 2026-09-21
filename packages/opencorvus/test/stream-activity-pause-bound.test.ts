import { describe, expect, test } from "bun:test"
import { SessionStatus } from "../src/session/status"
import { withStreamActivity } from "../src/util/stream-activity"

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("stream activity pause bound", () => {
  test("trips when one pause region never resumes", async () => {
    const monitor = withStreamActivity({
      idleMs: 10_000,
      maxPauseMs: 40,
      label: "pause-bound",
      describePause: () => "tool-call:call_one, protocol-publication:part-update",
    })
    monitor.pause()
    expect(monitor.diagnostics()).toMatchObject({
      paused: true,
      pauseDepth: 1,
      pauseOwners: ["tool-call:call_one", "protocol-publication:part-update"],
      timedOut: false,
    })
    await settle(120)
    expect(monitor.diagnostics()).toMatchObject({
      paused: true,
      pauseDepth: 1,
      pauseOwners: ["tool-call:call_one", "protocol-publication:part-update"],
      timedOut: true,
      abortReason: expect.stringContaining("paused"),
    })
    expect(String(monitor.signal.reason)).toContain("paused")
    monitor.dispose()
  })

  test("a resumed pause never trips and restores idle monitoring", async () => {
    const monitor = withStreamActivity({ idleMs: 10_000, maxPauseMs: 60, label: "pause-resumed" })
    monitor.pause()
    await settle(20)
    monitor.resume()
    expect(monitor.paused()).toBe(false)
    await settle(120)
    expect(monitor.timedOut()).toBe(false)
    monitor.dispose()
  })

  test("nested owners share one handoff window instead of extending it", async () => {
    const monitor = withStreamActivity({ idleMs: 10_000, maxPauseMs: 60, label: "pause-nested" })
    monitor.pause()
    await settle(30)
    // A second owner acquired inside the first must not restart the bound.
    monitor.pause()
    await settle(60)
    expect(monitor.timedOut()).toBe(true)
    monitor.dispose()
  })

  test("durable progress renews the paused inactivity window for the exact Session", async () => {
    const active = withStreamActivity({ idleMs: 10_000, maxPauseMs: 200, label: "active-session" })
    const inactive = withStreamActivity({ idleMs: 10_000, maxPauseMs: 200, label: "inactive-session" })
    const unregisterActive = SessionStatus.registerActivityMonitor("session-progress-active", active)
    const unregisterInactive = SessionStatus.registerActivityMonitor("session-progress-inactive", inactive)
    try {
      active.pause()
      inactive.pause()
      await settle(120)
      SessionStatus.observeActivity("session-progress-active")
      await settle(120)
      expect(SessionStatus.listActivity()).toMatchObject({
        "session-progress-active": { paused: true, pause_depth: 1, timed_out: false },
        "session-progress-inactive": { paused: true, pause_depth: 1, timed_out: true },
      })
      await settle(120)
      expect(active.timedOut()).toBe(true)
    } finally {
      unregisterActive()
      unregisterInactive()
      active.dispose()
      inactive.dispose()
    }
  })

  test("an unbounded monitor keeps the previous forever-pause behaviour", async () => {
    const monitor = withStreamActivity({ idleMs: 30, label: "pause-unbounded" })
    monitor.pause()
    await settle(120)
    expect(monitor.timedOut()).toBe(false)
    monitor.dispose()
  })

  test("rejects a non-positive pause bound", () => {
    expect(() => withStreamActivity({ idleMs: 10_000, maxPauseMs: 0 })).toThrow(/maxPauseMs/)
  })
})
