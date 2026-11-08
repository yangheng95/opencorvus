import { test, expect, afterEach, beforeEach } from "bun:test"
import { __resetNowTickForTests, subscribeNowTick } from "../src/services/clock"

beforeEach(() => {
  __resetNowTickForTests()
})

afterEach(() => {
  __resetNowTickForTests()
})

test("subscribeNowTick returns the current Date.now() seed", () => {
  const { now, unsubscribe } = subscribeNowTick()
  try {
    const value = now()
    expect(typeof value).toBe("number")
    expect(Math.abs(value - Date.now())).toBeLessThan(1000)
  } finally {
    unsubscribe()
  }
})

test("multiple subscribers share one setInterval handle", () => {
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  let started = 0
  let cleared = 0
  globalThis.setInterval = ((handler: any, ms?: number, ...rest: any[]) => {
    started += 1
    return originalSetInterval(handler, ms, ...rest)
  }) as typeof setInterval
  globalThis.clearInterval = ((handle: any) => {
    cleared += 1
    return originalClearInterval(handle)
  }) as typeof clearInterval

  try {
    const a = subscribeNowTick()
    const b = subscribeNowTick()
    expect(started).toBe(1)

    a.unsubscribe()

    b.unsubscribe()
    expect(cleared).toBe(1)
  } finally {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  }
})

test("a remaining subscriber receives later wall-clock values after duplicate release", async () => {
  const a = subscribeNowTick()
  const b = subscribeNowTick()
  a.unsubscribe()
  a.unsubscribe()
  try {
    const initial = b.now()
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(b.now()).toBeGreaterThan(initial)
  } finally {
    b.unsubscribe()
  }
})
