import { afterEach, beforeEach, expect, test } from "bun:test"

import { createAnimationFrameScheduler } from "../src/utils/animation-frame"

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

let nextFrameID = 1
let frames: Map<number, FrameRequestCallback>

beforeEach(() => {
  nextFrameID = 1
  frames = new Map()
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const frameID = nextFrameID++
    frames.set(frameID, callback)
    return frameID
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((frameID: number) => {
    frames.delete(frameID)
  }) as typeof cancelAnimationFrame
})

afterEach(() => {
  globalThis.requestAnimationFrame = originalRequestAnimationFrame
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame
})

function flushFrames(): void {
  const callbacks = Array.from(frames.values())
  frames.clear()
  for (const callback of callbacks) callback(0)
}

test("animation-frame scheduler coalesces repeated work into one frame", () => {
  let runs = 0
  const scheduler = createAnimationFrameScheduler(() => {
    runs += 1
  })

  scheduler.schedule()
  scheduler.schedule()
  scheduler.schedule()

  expect(frames.size).toBe(1)
  flushFrames()
  expect(runs).toBe(1)
})
