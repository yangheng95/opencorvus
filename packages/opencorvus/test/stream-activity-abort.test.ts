import { describe, expect, test } from "bun:test"
import {
  abortableIterable,
  activityTrackedReadableStream,
  withStreamActivity,
  type ReadableStreamActivitySettlement,
} from "../src/util/stream-activity"

describe("abortableIterable cancellation settlement", () => {
  test("returns the exact abort outcome after requesting cleanup from a parked provider iterator", async () => {
    const controller = new AbortController()
    const reason = new DOMException("operator stopped the provider stream", "AbortError")
    let cleanupRequests = 0
    const parked = new Promise<IteratorResult<string>>(() => undefined)
    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => parked,
          return: () => {
            cleanupRequests += 1
            return parked
          },
        }
      },
    }

    const outcome = (async () => {
      try {
        for await (const _value of abortableIterable(source, controller.signal)) {
          // The provider is deliberately parked before its first value.
        }
      } catch (error) {
        return { kind: "aborted" as const, error }
      }
      return { kind: "completed" as const, error: undefined }
    })()

    controller.abort(reason)

    expect(await outcome).toEqual({ kind: "aborted", error: reason })
    expect(cleanupRequests).toBe(1)
  })

  test("completes an ordinary consumer close after upstream cleanup completes", async () => {
    const events: string[] = []
    let reportCleanupStarted!: () => void
    const cleanupStarted = new Promise<void>((resolve) => {
      reportCleanupStarted = resolve
    })
    let completeCleanup!: () => void
    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: false as const, value: "provider value" }),
          return: () =>
            new Promise<IteratorResult<string>>((resolve) => {
              completeCleanup = () => {
                events.push("upstream cleanup completed")
                resolve({ done: true, value: undefined })
              }
              reportCleanupStarted()
            }),
        }
      },
    }
    const iterator = abortableIterable(source, new AbortController().signal)

    expect(await iterator.next()).toEqual({ done: false, value: "provider value" })
    const closed = iterator.return(undefined).then((result) => {
      events.push("wrapper close completed")
      return result
    })
    await cleanupStarted
    completeCleanup()

    expect(await closed).toEqual({ done: true, value: undefined })
    expect(events).toEqual(["upstream cleanup completed", "wrapper close completed"])
  })
})

describe("activity-tracked response stream settlement", () => {
  test("returns the exact activity abort and requests cancellation of a parked response reader", async () => {
    const external = new AbortController()
    const activity = withStreamActivity({ idleMs: 20, signal: external.signal, label: "provider-response-abort" })
    const reason = new DOMException("semantic activity replaced this provider attempt", "AbortError")
    const settlements: ReadableStreamActivitySettlement[] = []
    let cancelledWith: unknown
    let reportCancellation!: () => void
    const cancellationRequested = new Promise<void>((resolve) => {
      reportCancellation = resolve
    })
    const parked = new Promise<void>(() => undefined)
    const source = new ReadableStream<string>({
      pull: () => parked,
      cancel(cancelReason) {
        cancelledWith = cancelReason
        reportCancellation()
      },
    })
    const reader = activityTrackedReadableStream({
      source,
      activity,
      onSettlement: (settlement) => settlements.push(settlement),
    }).getReader()
    const outcome = reader.read().then(
      (value) => ({ kind: "value" as const, value }),
      (error) => ({ kind: "aborted" as const, error }),
    )

    external.abort(reason)
    await cancellationRequested

    expect(await outcome).toEqual({ kind: "aborted", error: reason })
    expect({ settlements, cancelledWith }).toEqual({ settlements: ["aborted"], cancelledWith: reason })
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect({ settlement: settlements[0], physicalTimeout: activity.timedOut() }).toEqual({
      settlement: "aborted",
      physicalTimeout: false,
    })
  })

  test("awaits ordinary consumer cancellation before reporting upstream response cleanup", async () => {
    const activity = withStreamActivity({ idleMs: 1_000, label: "provider-response-consumer-close" })
    const events: string[] = []
    let completeCleanup!: () => void
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("provider byte")
      },
      cancel() {
        return new Promise<void>((resolve) => {
          completeCleanup = () => {
            events.push("upstream cleanup completed")
            resolve()
          }
        })
      },
    })
    const reader = activityTrackedReadableStream({
      source,
      activity,
      onSettlement: (settlement) => events.push(`settled:${settlement}`),
    }).getReader()

    expect(await reader.read()).toEqual({ done: false, value: "provider byte" })
    const closed = reader.cancel("consumer complete").then(() => events.push("consumer close completed"))
    await Promise.resolve()
    completeCleanup()
    await closed

    expect(events).toEqual(["settled:cancelled", "upstream cleanup completed", "consumer close completed"])
  })

  test("reports ordinary EOF and response read failure through the same settlement contract", async () => {
    const eofSettlements: ReadableStreamActivitySettlement[] = []
    const eofActivity = withStreamActivity({ idleMs: 1_000, label: "provider-response-eof" })
    const eofReader = activityTrackedReadableStream({
      source: new ReadableStream<string>({
        start(controller) {
          controller.enqueue("complete response")
          controller.close()
        },
      }),
      activity: eofActivity,
      onSettlement: (settlement) => eofSettlements.push(settlement),
    }).getReader()
    expect([await eofReader.read(), await eofReader.read(), eofSettlements]).toEqual([
      { done: false, value: "complete response" },
      { done: true, value: undefined },
      ["eof"],
    ])

    const failure = new Error("provider response body failed")
    const errorSettlements: ReadableStreamActivitySettlement[] = []
    const errorActivity = withStreamActivity({ idleMs: 1_000, label: "provider-response-error" })
    const errorReader = activityTrackedReadableStream({
      source: new ReadableStream<string>({
        start(controller) {
          controller.error(failure)
        },
      }),
      activity: errorActivity,
      onSettlement: (settlement) => errorSettlements.push(settlement),
    }).getReader()
    const errorOutcome = await errorReader.read().catch((error) => error)

    expect({ errorOutcome, errorSettlements }).toEqual({ errorOutcome: failure, errorSettlements: ["error"] })
  })
})
