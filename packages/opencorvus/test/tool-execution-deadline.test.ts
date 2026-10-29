import { expect, test } from "bun:test"
import {
  assertToolExecutionDeadline,
  createToolExecutionDeadline,
  type ToolExecutionDeadline,
} from "../src/tool/execution-deadline"
import { withStreamActivity } from "../src/util/stream-activity"

const aborted = (signal: AbortSignal) =>
  signal.aborted
    ? Promise.resolve(signal.reason)
    : new Promise<unknown>((resolve) => signal.addEventListener("abort", () => resolve(signal.reason), { once: true }))

test("the executor arms its published fixed deadline and bounded settlement", async () => {
  using deadline = createToolExecutionDeadline({
    timeoutMs: 40,
    settlementMs: 100,
    signal: new AbortController().signal,
  })
  const reason = await aborted(deadline.signal)
  expect({
    reason,
    observedAt: Date.now(),
    settlement: deadline.settlementDeadlineAt - deadline.deadlineAt,
  }).toMatchObject({
    reason: { name: "TimeoutError", message: `Tool execution deadline ${deadline.deadlineAt} exceeded` },
    settlement: 100,
  })
  expect(reason).toBe(deadline.timeoutReason)
  expect(Date.now()).toBeGreaterThanOrEqual(deadline.deadlineAt)
})

test("the caller cancellation keeps its exact physical reason", async () => {
  const controller = new AbortController()
  using deadline = createToolExecutionDeadline({ timeoutMs: 1_000, settlementMs: 100, signal: controller.signal })
  const reason = new DOMException("Cancel this owned execution", "AbortError")
  controller.abort(reason)
  expect(await aborted(deadline.signal)).toBe(reason)
})

test("plain metadata receives the explicit unarmed-deadline error", () => {
  const data = { deadlineAt: Date.now() + 60_000, settlementDeadlineAt: Date.now() + 61_000 } as ToolExecutionDeadline
  expect(() => assertToolExecutionDeadline(data)).toThrow("Tool execution deadline must come from the armed executor")
})

test("a closed executor deadline receives the explicit unarmed-deadline error", () => {
  const deadline = createToolExecutionDeadline({
    timeoutMs: 1_000,
    settlementMs: 100,
    signal: new AbortController().signal,
  })
  deadline[Symbol.dispose]()
  expect(() => assertToolExecutionDeadline(deadline)).toThrow(
    "Tool execution deadline must come from the armed executor",
  )
})

test("an unreleased finite handoff expires as the real paused boundary", async () => {
  const monitor = withStreamActivity({ idleMs: 1_000, maxPauseMs: 30, label: "finite-tool" })
  monitor.pause()
  const deadlineAt = Date.now() + 90
  using hold = monitor.holdPauseUntil(deadlineAt)
  try {
    const reason = await aborted(monitor.signal)
    expect(reason).toMatchObject({ name: "AbortError", message: expect.stringContaining("stream paused > 30ms") })
    expect(Date.now()).toBeGreaterThanOrEqual(deadlineAt)
  } finally {
    monitor.dispose()
  }
})

test("handoff release returns a silent publication to its finite guard", async () => {
  const monitor = withStreamActivity({ idleMs: 1_000, maxPauseMs: 30, label: "handoff-returned" })
  monitor.pause()
  const hold = monitor.holdPauseUntil(Date.now() + 10_000)
  const returnedAt = Date.now()
  hold[Symbol.dispose]()
  try {
    expect(await aborted(monitor.signal)).toMatchObject({
      name: "AbortError",
      message: expect.stringContaining("stream paused > 30ms"),
    })
    expect(Date.now() - returnedAt).toBeLessThan(1_000)
  } finally {
    monitor.dispose()
  }
})
