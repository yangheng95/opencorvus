import { afterEach, expect, test } from "bun:test"
import { createVisibilityInterval } from "../src/utils/visibility-interval"

const originalDocument = globalThis.document
const originalSetInterval = globalThis.setInterval
const originalClearInterval = globalThis.clearInterval

let hidden = false
let nextTimerID = 1
let activeTimers = new Map<number, () => void>()
let listeners = new Set<() => void>()
let removedListeners = 0

function installTimerStubs(): void {
  nextTimerID = 1
  activeTimers = new Map()
  listeners = new Set()
  removedListeners = 0
  hidden = false

  globalThis.setInterval = ((callback: () => void) => {
    const id = nextTimerID++
    activeTimers.set(id, callback)
    return id
  }) as typeof setInterval
  globalThis.clearInterval = ((id: number) => {
    activeTimers.delete(id)
  }) as typeof clearInterval

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get hidden() {
        return hidden
      },
      addEventListener(type: string, listener: EventListener) {
        if (type === "visibilitychange") listeners.add(listener as () => void)
      },
      removeEventListener(type: string, listener: EventListener) {
        if (type === "visibilitychange" && listeners.delete(listener as () => void)) removedListeners += 1
      },
    },
  })
}

function fireVisibilityChange(): void {
  for (const listener of [...listeners]) listener()
}

function tickAllTimers(): void {
  for (const callback of [...activeTimers.values()]) callback()
}

afterEach(() => {
  globalThis.setInterval = originalSetInterval
  globalThis.clearInterval = originalClearInterval
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  })
})

test("createVisibilityInterval clears the timer while hidden, restarts when visible, and disposes cleanly", () => {
  installTimerStubs()
  let calls = 0
  let visibleCalls = 0

  const interval = createVisibilityInterval(
    () => {
      calls += 1
    },
    4000,
    {
      onVisible: () => {
        visibleCalls += 1
      },
    },
  )

  interval.start()
  expect(activeTimers.size).toBe(1)
  expect(listeners.size).toBe(1)
  tickAllTimers()
  expect(calls).toBe(1)

  hidden = true
  fireVisibilityChange()
  expect(activeTimers.size).toBe(0)
  tickAllTimers()
  expect(calls).toBe(1)

  hidden = false
  fireVisibilityChange()
  expect(visibleCalls).toBe(1)
  expect(activeTimers.size).toBe(1)
  tickAllTimers()
  expect(calls).toBe(2)

  interval.dispose()
  expect(activeTimers.size).toBe(0)
  expect(listeners.size).toBe(0)
  expect(removedListeners).toBe(1)
  fireVisibilityChange()
  tickAllTimers()
  expect(calls).toBe(2)
})
