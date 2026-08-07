import { describe, expect, test } from "bun:test"
import { makeMonitorTick } from "../src/services/monitor-tick"

/**
 * audit-2026-04-29 W2-V24. The connection monitor's setInterval
 * fires every 10 s but `checkConnection` for a managed local
 * server has a budget of 8 × 5 s + 7 × 350 ms ≈ 42 s.
 * setInterval does not wait for the previous async callback to
 * finish — pre-fix a hung backend accumulated 4-5 overlapping
 * checkConnection calls, each holding an AbortController, each
 * spawning fresh fetches and onReconnect handlers. The guard
 * drops new ticks while the previous one is in flight.
 */

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("makeMonitorTick (audit W2-V24)", () => {
  test("hidden document → skips tick entirely", async () => {
    let checks = 0
    const tick = makeMonitorTick({
      isHidden: () => true,
      isConnected: () => false,
      check: async () => {
        checks++
        return true
      },
    })
    await tick()
    expect(checks).toBe(0)
  })

  test("already-connected probes without reloading stable server state", async () => {
    let checks = 0
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => true,
      connectionIdentity: () => 101,
      check: async () => {
        checks++
        return true
      },
      onReconnect: async () => {
        reconnects++
      },
    })
    await tick()
    expect(checks).toBe(1)
    expect(reconnects).toBe(0)
  })

  test("online managed-server replacement reloads server-backed state", async () => {
    let serverProcessID = 101
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => true,
      connectionIdentity: () => serverProcessID,
      check: async () => {
        serverProcessID = 202
        return true
      },
      onReconnect: async () => {
        reconnects++
      },
    })

    await tick()

    expect(reconnects).toBe(1)
  })

  test("online failed probe marks no false recovery", async () => {
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => true,
      connectionIdentity: () => 101,
      check: async () => false,
      onReconnect: async () => {
        reconnects++
      },
    })

    await tick()

    expect(reconnects).toBe(0)
  })

  test("offline + healthy probe → fires onReconnect once", async () => {
    let checks = 0
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => {
        checks++
        return true
      },
      onReconnect: async () => {
        reconnects++
      },
    })
    await tick()
    expect(checks).toBe(1)
    expect(reconnects).toBe(1)
  })

  test("offline + failing probe → no onReconnect call", async () => {
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => false,
      onReconnect: async () => {
        reconnects++
      },
    })
    await tick()
    expect(reconnects).toBe(0)
  })

  test("stopped monitor after probe resolves skips onReconnect", async () => {
    const checkDeferred = deferred<boolean>()
    let reconnects = 0
    let current = true
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      isCurrent: () => current,
      check: async () => checkDeferred.promise,
      onReconnect: async () => {
        reconnects++
      },
    })

    const run = tick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    current = false
    checkDeferred.resolve(true)
    await run

    expect(reconnects).toBe(0)
  })

  test("REGRESSION: overlapping ticks while previous is in-flight are dropped", async () => {
    // The exact scenario the V24 fix covers: tick #2 fires before
    // tick #1's `await check()` resolves. Pre-fix tick #2 would
    // run a parallel check, accumulating in-flight work. Post-fix
    // it returns immediately.
    const checkDeferred = deferred<boolean>()
    let checks = 0
    let reconnects = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => {
        checks++
        return checkDeferred.promise
      },
      onReconnect: async () => {
        reconnects++
      },
    })

    const t1 = tick() // tick #1: enters, awaits check
    await new Promise((r) => setTimeout(r, 0)) // let tick #1 reach the await

    // Three more ticks fire while #1 is still awaiting check.
    const t2 = tick()
    const t3 = tick()
    const t4 = tick()
    // None of t2/t3/t4 should have entered the body — they all
    // dropped on the inFlight flag.
    expect(checks).toBe(1)

    // Resolve check; tick #1 completes; subsequent ticks would now
    // be allowed (but they already returned without running).
    checkDeferred.resolve(true)
    await Promise.all([t1, t2, t3, t4])
    expect(checks).toBe(1)
    expect(reconnects).toBe(1)

    // After tick #1 has finished, a fresh call DOES run.
    const checkDeferred2 = deferred<boolean>()
    const tick2 = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => {
        checks++
        return checkDeferred2.promise
      },
      onReconnect: async () => {
        reconnects++
      },
    })
    const t5 = tick2()
    await new Promise((r) => setTimeout(r, 0))
    checkDeferred2.resolve(false)
    await t5
    expect(checks).toBe(2) // fresh tick ran
  })

  test("error in check is logged via warn(), inFlight resets, future ticks succeed", async () => {
    const warnings: unknown[][] = []
    let checks = 0
    let attempt = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => {
        checks++
        attempt++
        if (attempt === 1) throw new Error("first attempt explodes")
        return true
      },
      warn: (...a) => warnings.push(a),
    })
    await tick() // throws inside, caught, inFlight reset
    expect(checks).toBe(1)
    expect(warnings.length).toBe(1)

    await tick() // succeeds — proves inFlight wasn't latched
    expect(checks).toBe(2)
  })

  test("onReconnect throw is logged AND inFlight still resets", async () => {
    const warnings: unknown[][] = []
    let checks = 0
    const tick = makeMonitorTick({
      isHidden: () => false,
      isConnected: () => false,
      check: async () => {
        checks++
        return true
      },
      onReconnect: async () => {
        throw new Error("reconnect failed")
      },
      warn: (...a) => warnings.push(a),
    })
    await tick()
    expect(checks).toBe(1)
    expect(warnings.length).toBe(1)
    // Subsequent tick still runs (inFlight reset in finally).
    await tick()
    expect(checks).toBe(2)
  })
})
