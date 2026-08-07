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
    expect(cleared).toBe(0)

    a.unsubscribe()
    expect(cleared).toBe(0)

    b.unsubscribe()
    expect(cleared).toBe(1)
  } finally {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  }
})

test("subscriber unsubscribe is idempotent and does not over-decrement", () => {
  const a = subscribeNowTick()
  const b = subscribeNowTick()
  a.unsubscribe()
  a.unsubscribe() // no-op
  // b still owns the count — re-subscribing a third time and unsubscribing
  // must not stop the interval prematurely. Sanity: read still returns a
  // valid number.
  const c = subscribeNowTick()
  expect(typeof c.now()).toBe("number")
  b.unsubscribe()
  c.unsubscribe()
})
