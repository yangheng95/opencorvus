import { describe, expect, test } from "bun:test"
import { withStreamActivity } from "../src/util/stream-activity"

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("stream activity pause bound", () => {
  test("trips when one pause region never resumes", async () => {
    const monitor = withStreamActivity({ idleMs: 10_000, maxPauseMs: 40, label: "pause-bound" })
    monitor.pause()
    expect(monitor.paused()).toBe(true)
    expect(monitor.timedOut()).toBe(false)
    await settle(120)
    expect(monitor.timedOut()).toBe(true)
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
