import { describe, expect, test } from "bun:test"
import { FifoPermitPool, settledWork } from "@/util/queue"

describe("work-conserving physical admission", () => {
  test("refills the first released worker slot while preserving settled result order", async () => {
    const releaseFirst = Promise.withResolvers<void>()
    const fifthStarted = Promise.withResolvers<void>()
    let active = 0
    let maximumActive = 0
    const results = settledWork({
      concurrency: 4,
      items: [0, 1, 2, 3, 4],
      run: async (item) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        if (item === 0) await releaseFirst.promise
        else {
          if (item === 4) fifthStarted.resolve()
          await Bun.sleep(5)
        }
        active -= 1
        return `settled:${item}`
      },
    })
    await fifthStarted.promise
    releaseFirst.resolve()
    expect({ maximumActive, results: await results }).toEqual({
      maximumActive: 4,
      results: [0, 1, 2, 3, 4].map((item) => ({ status: "fulfilled", value: `settled:${item}` })),
    })
  })

  test("hands the next FIFO permit to the next live waiter after an exact caller abort", async () => {
    const pool = new FifoPermitPool(1)
    const releaseOwner = await pool.acquire()
    const controller = new AbortController()
    const reason = new DOMException("second waiter stopped", "AbortError")
    const second = pool.acquire(controller.signal)
    const third = pool.acquire()
    controller.abort(reason)
    expect(await second.catch((error) => error)).toBe(reason)
    releaseOwner()
    const releaseThird = await third
    expect(pool.snapshot).toEqual({ active: 1, pending: 0, limit: 1 })
    releaseThird()
    expect(pool.snapshot).toEqual({ active: 0, pending: 0, limit: 1 })
  })
})
