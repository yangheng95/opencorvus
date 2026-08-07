import { describe, expect, test } from "bun:test"
import { lazy } from "../src/lazy"

/**
 * audit-2026-04-29 W2-V11 — `loaded = true` ran before `fn()`. When
 * `fn()` threw, the second call took the cached fast-path and
 * returned `value as T === undefined as T` silently. First crash
 * was loud, every subsequent failure was a phantom `undefined`.
 *
 * Post-fix: only mark `loaded` after `fn()` returns; an init throw
 * keeps the lazy in unloaded state so the next caller retries.
 */

describe("lazy (audit W2-V11)", () => {
  test("happy path: fn runs once, value is cached, identity preserved", () => {
    let calls = 0
    const obj = { x: 42 }
    const get = lazy(() => {
      calls++
      return obj
    })
    const a = get()
    const b = get()
    expect(calls).toBe(1)
    expect(a).toBe(obj)
    expect(b).toBe(obj)
  })

  test("init throw on first call leaves the lazy unloaded — second call retries", () => {
    let calls = 0
    let shouldThrow = true
    const get = lazy(() => {
      calls++
      if (shouldThrow) throw new Error("init failed")
      return "ok" as const
    })
    expect(() => get()).toThrow("init failed")
    expect(calls).toBe(1)
    // Pre-fix the second call returned `undefined` silently because
    // `loaded === true`. Post-fix the second call sees `loaded ===
    // false` and re-runs fn(). With the throw flipped off, that
    // succeeds.
    shouldThrow = false
    const v = get()
    expect(calls).toBe(2)
    expect(v).toBe("ok")
    // After successful init, further calls hit the cache.
    const v2 = get()
    expect(calls).toBe(2)
    expect(v2).toBe("ok")
  })

  test("repeated throws stay loud (never silently degrade to undefined)", () => {
    let calls = 0
    const get = lazy<string>(() => {
      calls++
      throw new Error(`call ${calls}`)
    })
    expect(() => get()).toThrow("call 1")
    expect(() => get()).toThrow("call 2")
    expect(() => get()).toThrow("call 3")
    expect(calls).toBe(3)
  })

  test("falsy values cache correctly (0, '', null) — not retriggered as if unloaded", () => {
    // Defensive — the implementation guards on `loaded`, not on
    // `value`. A truthy/falsy mistake here would cause `lazy(() =>
    // 0)()` to re-invoke fn forever.
    let calls = 0
    const getZero = lazy(() => {
      calls++
      return 0
    })
    expect(getZero()).toBe(0)
    expect(getZero()).toBe(0)
    expect(getZero()).toBe(0)
    expect(calls).toBe(1)
  })
})
