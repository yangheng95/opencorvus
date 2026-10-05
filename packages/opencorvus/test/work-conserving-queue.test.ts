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


function stream(next: () => Promise<IteratorResult<number>>, close: () => Promise<IteratorResult<number>>): AsyncIterable<number> {
  return { [Symbol.asyncIterator]: () => ({ next, return: close }) }
}
const done = (): IteratorResult<number> => ({ done: true, value: undefined })

for (const concurrency of [1, 4]) {
  test(`already-aborted owner retains its exact reason after cleanup at concurrency ${concurrency}`, async () => {
    const controller = new AbortController()
    const reason = { owner: "exact-aborted-owner" }
    const events: string[] = []
    controller.abort(reason)
    const items = stream(async () => done(), async () => { events.push("closed"); return done() })
    const error = await settledWork<number, number>({ concurrency, items, signal: controller.signal, run: async (item) => item }).catch((e) => e)
    expect(error).toBe(reason)
    expect(events).toEqual(["closed"])
  })

  test(`pending iterator fully unwinds before original cancellation at concurrency ${concurrency}`, async () => {
    const controller = new AbortController()
    const reason = new Error("exact pending-read cancellation")
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let count = 0
    const events: string[] = []
    const items = stream(async () => {
      const index = count++
      if (count === concurrency) started.resolve()
      await release.promise
      events.push(`read:${index}`)
      return done()
    }, async () => { events.push("closed"); return done() })
    const error = settledWork<number, number>({ concurrency, items, signal: controller.signal, run: async (item) => item }).catch((e) => e)
    await started.promise
    controller.abort(reason)
    release.resolve()
    expect(await error).toBe(reason)
    expect(events).toEqual([...Array.from({ length: concurrency }, (_, i) => `read:${i}`), "closed"])
  })

  test(`active callbacks and async cleanup join before cancellation at concurrency ${concurrency}`, async () => {
    const controller = new AbortController()
    const reason = new Error("exact active-work cancellation")
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const closing = Promise.withResolvers<void>()
    const closed = Promise.withResolvers<void>()
    let cursor = 0
    let active = 0
    const events: string[] = []
    const items = stream(async () => cursor < concurrency ? { done: false, value: cursor++ } : done(), async () => {
      events.push("closing"); closing.resolve(); await closed.promise; events.push("closed"); return done()
    })
    const error = settledWork<number, number>({ concurrency, items, signal: controller.signal, run: async (item) => {
      if (++active === concurrency) started.resolve()
      await release.promise
      active--
      events.push(`work:${item}`)
      return item
    } }).catch((e) => e)
    await started.promise
    controller.abort(reason)
    release.resolve()
    await closing.promise
    expect({ active, events }).toEqual({ active: 0, events: [...Array.from({ length: concurrency }, (_, i) => `work:${i}`), "closing"] })
    closed.resolve()
    expect(await error).toBe(reason)
    expect(events.at(-1)).toBe("closed")
  })
}

test("mixed source, owner and cleanup faults retain their original causes", async () => {
  const controller = new AbortController()
  const owner = new Error("exact cancellation")
  const source = new Error("real source failure")
  const cleanup = new Error("real cleanup failure")
  const events: string[] = []
  const items = stream(async () => { controller.abort(owner); throw source }, async () => { events.push("cleanup"); throw cleanup })
  const error = await settledWork<number, number>({ concurrency: 4, items, signal: controller.signal, run: async (item) => item }).catch((e) => e)
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([source, owner, owner, owner, cleanup])
  expect(events).toEqual(["cleanup"])
})

for (const streaming of [false, true]) {
  test(`terminal abort retains first real item cause with streaming=${streaming}`, async () => {
    const controller = new AbortController()
    const owner = new Error("exact cancellation after real item failures")
    const first = new Error("first real item failure")
    const second = new Error("second real item failure")
    let cursor = 0
    const consumed: PromiseSettledResult<number>[] = []
    const items = stream(async () => {
      if (cursor < 2) return { done: false, value: cursor++ }
      controller.abort(owner); throw owner
    }, async () => done())
    const error = await settledWork<number, number>({ concurrency: 1, items, signal: controller.signal,
      onSettled: streaming ? (result) => { consumed.push(result) } : undefined,
      run: async (item) => { throw item === 0 ? first : second },
    }).catch((e) => e)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.errors).toEqual([owner, first])
    if (streaming) expect(consumed).toEqual([{ status: "rejected", reason: first }, { status: "rejected", reason: second }])
  })
}

test("cleanup-blocked results retain the first actual item failure", async () => {
  const failure = new Error("real item failure")
  const cleanup = new Error("real cleanup failure")
  let cursor = 0
  const items = stream(async () => cursor++ === 0 ? { done: false, value: 0 } : done(), async () => { throw cleanup })
  const error = await settledWork<number, number>({ concurrency: 1, items, run: async () => { throw failure } }).catch((e) => e)
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([cleanup, failure])
})

test("real active item fault remains observable after all parallel callbacks unwind", async () => {
  const controller = new AbortController()
  const owner = new Error("exact concurrent cancellation")
  const failure = new Error("real active item failure")
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let active = 0
  const consumed: Array<{ index: number; result: PromiseSettledResult<number> }> = []
  const errorPromise = settledWork<number, number>({ concurrency: 4, items: [0, 1, 2, 3], signal: controller.signal,
    onSettled: (result, index) => { consumed.push({ index, result }) },
    run: async (item) => {
      if (++active === 4) started.resolve()
      await release.promise
      active--
      if (item === 2) throw failure
      return item
    },
  }).catch((e) => e)
  await started.promise
  controller.abort(owner)
  release.resolve()
  const error = await errorPromise
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([owner, owner, owner, owner, failure])
  expect({ active, consumed }).toEqual({ active: 0, consumed: [
    { index: 0, result: { status: "fulfilled", value: 0 } },
    { index: 1, result: { status: "fulfilled", value: 1 } },
    { index: 2, result: { status: "rejected", reason: failure } },
    { index: 3, result: { status: "fulfilled", value: 3 } },
  ] })
})

test("normal streaming preserves all consumed results and its empty return", async () => {
  const failure = new Error("normal item failure")
  const consumed: PromiseSettledResult<number>[] = []
  const results = await settledWork<number, number>({ concurrency: 1, items: [0, 1, 2], onSettled: (result) => { consumed.push(result) }, run: async (item) => { if (item === 1) throw failure; return item } })
  expect({ results, consumed }).toEqual({ results: [], consumed: [
    { status: "fulfilled", value: 0 }, { status: "rejected", reason: failure }, { status: "fulfilled", value: 2 },
  ] })
})

test("normal results retain the real rejection at its input index", async () => {
  const failure = new Error("normal returned item failure")
  expect(await settledWork<number, number>({ concurrency: 4, items: [0, 1, 2], run: async (item) => { if (item === 1) throw failure; return item } })).toEqual([
    { status: "fulfilled", value: 0 }, { status: "rejected", reason: failure }, { status: "fulfilled", value: 2 },
  ])
})

test("original item and streaming observer faults remain separate causes", async () => {
  const item = new Error("real item failure")
  const observer = new Error("real observer failure")
  const error = await settledWork<number, number>({ concurrency: 1, items: [0], run: async () => { throw item }, onSettled: () => { throw observer } }).catch((e) => e)
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([observer, item])
})


test("source, cleanup and first item causes all survive cancellation with streaming consumption", async () => {
  const controller = new AbortController()
  const owner = new Error("exact cancellation with three real causes")
  const item = new Error("real item before source failure")
  const source = new Error("real source failure racing cancellation")
  const cleanup = new Error("real cleanup failure racing cancellation")
  let cursor = 0
  const consumed: PromiseSettledResult<number>[] = []
  const items = stream(async () => {
    if (cursor++ === 0) return { done: false, value: 0 }
    controller.abort(owner)
    throw source
  }, async () => { throw cleanup })
  const error = await settledWork<number, number>({ concurrency: 1, items, signal: controller.signal,
    onSettled: (result) => { consumed.push(result) }, run: async () => { throw item },
  }).catch((e) => e)
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([source, cleanup, item])
  expect(consumed).toEqual([{ status: "rejected", reason: item }])
})

test("exact cancellation from worker slots and iterator cleanup preserves one owner reason", async () => {
  const controller = new AbortController()
  const owner = new Error("exact owner reason from cleanup")
  controller.abort(owner)
  const items = stream(async () => done(), async () => { throw owner })
  expect(await settledWork<number, number>({ concurrency: 4, items, signal: controller.signal, run: async (item) => item }).catch((e) => e)).toBe(owner)
})

test("single original discovery failure retains its original value after successful cleanup", async () => {
  const source = new Error("single original source failure")
  const events: string[] = []
  const items = stream(async () => { throw source }, async () => { events.push("closed"); return done() })
  expect(await settledWork<number, number>({ concurrency: 1, items, run: async (item) => item }).catch((e) => e)).toBe(source)
  expect(events).toEqual(["closed"])
})
