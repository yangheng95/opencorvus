import { describe, expect, test } from "bun:test"
import { abortableIterable } from "../src/util/stream-activity"

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
