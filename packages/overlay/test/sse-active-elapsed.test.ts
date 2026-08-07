import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import {
  advanceSseActiveElapsed,
  pauseSseActiveElapsed,
  type SseActiveElapsedState,
} from "../src/utils/sse-active-elapsed"
import {
  __resetSelectedTaskSseActivityForTest,
  pauseSelectedTaskSseActivity,
  recordSelectedTaskSseActivity,
  recordSelectedTaskSseEventActivity,
  recordSelectedTaskSseSnapshot,
  selectedTaskSseActiveElapsedMs,
  taskRuntimeActivityKey,
} from "../src/services/task-runtime-activity"

test("SSE active elapsed restores from the latest active activity timestamp", () => {
  const key = "tsk_active:1776000000000"
  let state: SseActiveElapsedState = { key: "", elapsedMs: 0 }

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 1000, activityAt: 900 })
  expect(state.elapsedMs).toBe(0)

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 1000, activityAt: 2600 })
  expect(state.elapsedMs).toBe(1600)

  state = advanceSseActiveElapsed(state, { key, active: false, startedAt: 1000, activityAt: 9000 })
  expect(state.elapsedMs).toBe(1600)
  expect(state.observedAt).toBe(2600)

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 1000, activityAt: 2000 })
  expect(state.elapsedMs).toBe(1600)

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 1000, activityAt: 12_700 })
  expect(state.elapsedMs).toBe(11_700)
})

test("SSE active elapsed resets on a new task run key", () => {
  const key = "tsk_reconnect:1776000000000"
  let state: SseActiveElapsedState = { key: "", elapsedMs: 0 }

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 100, activityAt: 600 })
  state = pauseSseActiveElapsed(state, key)
  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 100, activityAt: 10_000 })
  expect(state.elapsedMs).toBe(9900)

  state = advanceSseActiveElapsed(state, {
    key: "tsk_reconnect:1776000010000",
    active: true,
    startedAt: 11_000,
    activityAt: 11_000,
  })
  expect(state.elapsedMs).toBe(0)
})

test("selected task SSE activity service is reactive and keyed by task run", () => {
  createRoot((dispose) => {
    __resetSelectedTaskSseActivityForTest()
    const key = taskRuntimeActivityKey({ taskID: "tsk_service", startedAt: 1_776_000_000_000 })

    recordSelectedTaskSseActivity({ key, active: true, startedAt: 10, activityAt: 1010 })
    expect(selectedTaskSseActiveElapsedMs(key)).toBe(1000)
    recordSelectedTaskSseActivity({ key, active: true, startedAt: 10, activityAt: 510 })
    expect(selectedTaskSseActiveElapsedMs(key)).toBe(1000)
    pauseSelectedTaskSseActivity(key)
    recordSelectedTaskSseActivity({ key, active: true, startedAt: 10, activityAt: 8510 })
    expect(selectedTaskSseActiveElapsedMs(key)).toBe(8500)

    dispose()
  })
})

test("selected task SSE activity extracts persisted task message watermarks", () => {
  const key = taskRuntimeActivityKey({ taskID: "tsk_watermark", startedAt: 1_776_000_000_000 })
  __resetSelectedTaskSseActivityForTest()

  recordSelectedTaskSseEventActivity({
    taskID: "tsk_watermark",
    task: {
      id: "tsk_watermark",
      time: { created: 1_776_000_000_000, started: 1_776_000_000_000 },
    },
    active: true,
    event: {
      type: "task.messages.changed",
      task_id: "tsk_watermark",
      payload: { taskID: "tsk_watermark", watermark: 1_776_000_006_000 },
      emittedAt: 1_776_000_006_500,
    },
  })

  expect(selectedTaskSseActiveElapsedMs(key)).toBe(6000)
})

test("selected task SSE activity ignores old replayed events after a restored watermark", () => {
  createRoot((dispose) => {
    __resetSelectedTaskSseActivityForTest()
    const key = taskRuntimeActivityKey({ taskID: "tsk_replay", startedAt: 1_776_000_000_000 })

    recordSelectedTaskSseActivity({
      key,
      active: true,
      startedAt: 1_776_000_000_000,
      activityAt: 1_776_000_020_000,
    })
    recordSelectedTaskSseActivity({
      key,
      active: true,
      startedAt: 1_776_000_000_000,
      activityAt: 1_776_000_005_000,
    })

    expect(selectedTaskSseActiveElapsedMs(key)).toBe(20_000)
    dispose()
  })
})

test("selected task SSE snapshot restores existing elapsed when entering an active task", () => {
  createRoot((dispose) => {
    __resetSelectedTaskSseActivityForTest()
    const key = taskRuntimeActivityKey({ taskID: "tsk_snapshot", startedAt: 1_776_000_001_000 })

    recordSelectedTaskSseSnapshot({
      taskID: "tsk_snapshot",
      task: {
        id: "tsk_snapshot",
        time: { created: 1_776_000_000_000, started: 1_776_000_001_000 },
      },
      active: true,
      activityAt: 1_776_000_011_000,
    })

    expect(selectedTaskSseActiveElapsedMs(key)).toBe(10_000)
    dispose()
  })
})

test("selected task SSE snapshot does not start queued tasks", () => {
  createRoot((dispose) => {
    __resetSelectedTaskSseActivityForTest()
    const key = taskRuntimeActivityKey({ taskID: "tsk_queued", startedAt: 1_776_000_000_000 })

    recordSelectedTaskSseSnapshot({
      taskID: "tsk_queued",
      task: {
        id: "tsk_queued",
        time: { created: 1_776_000_000_000 },
      },
      active: false,
      activityAt: 1_776_000_011_000,
    })

    expect(selectedTaskSseActiveElapsedMs(key)).toBe(0)
    dispose()
  })
})

test("legacy interval start from zero regression is gone", () => {
  const key = "tsk_regression:1776000000000"
  let state: SseActiveElapsedState = { key: "", elapsedMs: 0 }

  state = advanceSseActiveElapsed(state, { key, active: true, startedAt: 100, activityAt: 600 })
  expect(state.elapsedMs).toBe(500)
})

test("SSE active elapsed rejects invalid timestamps instead of using wall-clock fallback", () => {
  expect(() =>
    advanceSseActiveElapsed(
      { key: "tsk_invalid:1", elapsedMs: 0 },
      { key: "tsk_invalid:1", active: true, startedAt: 1, activityAt: NaN },
    ),
  ).toThrow("SSE active elapsed activity timestamp must be positive")
  expect(() =>
    advanceSseActiveElapsed(
      { key: "tsk_invalid:1", elapsedMs: 0 },
      { key: "tsk_invalid:1", active: true, startedAt: 0, activityAt: 1 },
    ),
  ).toThrow("SSE active elapsed start timestamp must be positive")
  expect(() => taskRuntimeActivityKey({ taskID: "tsk_invalid", startedAt: 0 })).toThrow(
    "runtime activity requires a positive task.time.started timestamp",
  )
  expect(() =>
    recordSelectedTaskSseEventActivity({
      taskID: "tsk_invalid",
      task: { id: "tsk_invalid", time: { created: 1, started: 1 } },
      active: true,
      event: { type: "task.messages.changed", payload: { taskID: "tsk_invalid" }, emittedAt: 5 },
    }),
  ).toThrow("task.messages.changed missing positive payload.watermark")
})
