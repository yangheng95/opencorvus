import { afterEach, expect, test } from "bun:test"
import { ProtocolStore } from "@/protocol/store"
import { Instance } from "@/project/instance"
import { requireTask } from "@/engine/store"
import { appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { Database } from "@/storage/db"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })

// The live replay buffer keeps a bounded recent window of ephemeral task
// events. Everything trimmed out of that window raises a per-task retention
// floor that is never lowered for the life of the process, so within minutes
// of a task streaming anything the floor is non-zero permanently.
const RETENTION_WINDOW_MS = 30_000

for (const terminalType of ["task.completed", "task.failed", "task.cancelled"]) {
  test(`${terminalType} retires payloads while preserving the live cursor through reopen`, async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: terminalType })
      const otherID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Independent live Task" })
      const sessionID = requireTask(taskID).session_id!
      for (let index = 1; index <= 3; index++) dispatchDelta(taskID, index)
      dispatchDelta(otherID, 1)
      const cursor = ProtocolStore.currentTaskLiveSequence(taskID)
      const liveEpoch = ProtocolStore.currentTaskLiveEpoch()
      await ProtocolStore.appendEvent({ kind: "event", type: terminalType, aggregate: "task",
        aggregate_id: taskID, session_id: sessionID, source: "test.terminal-live-replay",
        payload: { execution_epoch: 1 } })
      expect(ProtocolStore.currentTaskLiveSequence(taskID)).toBe(cursor)
      expect(ProtocolStore.listTaskLiveEventsAfter(taskID, cursor - 1, { liveEpoch })).toMatchObject({ expired: true })
      Database.immediateTransaction((db) => appendTaskReopenedInTransaction({
        db, taskID, sessionID, now: Date.now(), source: "test.reopened-live-replay",
      }))
      dispatchDelta(taskID, 4)
      const replay = ProtocolStore.listTaskLiveEventsAfter(taskID, cursor, { liveEpoch })
      expect(replay).toMatchObject({ expired: false, events: [{
        taskID, liveEpoch, liveSequence: cursor + 1, payload: { delta: "delta 4" },
      }] })
      expect(ProtocolStore.listTaskLiveEventsAfter(otherID, 0, { liveEpoch })).toMatchObject({
        expired: false, events: [{ taskID: otherID, liveSequence: 1, payload: { delta: "delta 1" } }],
      })
    } })
  })
}

function dispatchDelta(taskID: string, index: number): void {
  ProtocolStore.dispatchEphemeral({
    type: "message.part.delta",
    aggregate: "task",
    taskID,
    sessionID: `ses_${taskID}`,
    source: "test.task-live-replay-retention",
    orderKey: `live/${String(index).padStart(4, "0")}`,
    payload: {
      sessionID: `ses_${taskID}`,
      messageID: "msg_live_replay",
      partID: `prt_${index}`,
      partType: "text",
      field: "text",
      delta: `delta ${index}`,
    },
  })
}

test("live replay retention reports an expired resume and returns the current window to a fresh subscriber", () => {
  const taskID = "tsk_live_replay_retention"
  dispatchDelta(taskID, 1)
  dispatchDelta(taskID, 2)
  dispatchDelta(taskID, 3)
  expect(ProtocolStore.currentTaskLiveSequence(taskID)).toBe(3)

  // Age every retained delta out of the window so the retention floor rises.
  ProtocolStore.compactLiveReplay(Date.now() + RETENTION_WINDOW_MS * 2)

  const epoch = ProtocolStore.currentTaskLiveEpoch()
  // A subscriber resuming from a cursor below the floor genuinely missed
  // events; telling it to re-hydrate is the whole point of the floor.
  expect(ProtocolStore.listTaskLiveEventsAfter(taskID, 1, { liveEpoch: epoch })).toMatchObject({ expired: true })

  // A freshly selected task presents no live cursor at all. It has consumed
  // nothing, so it cannot have fallen behind: expiring it closed the stream
  // immediately on every task switch and cost a full reconnect for a
  // handshake nothing was wrong with.
  expect(ProtocolStore.listTaskLiveEventsAfter(taskID, 0)).toEqual({ expired: false, events: [] })

  // ...and that fresh subscriber still receives what is retained from here on.
  dispatchDelta(taskID, 4)
  const fresh = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
  expect(fresh.expired).toBe(false)
  expect(fresh.expired ? [] : fresh.events.map((event) => event.liveSequence)).toEqual([4])
})

test("text replay starts at the latest full snapshot and retains subsequent live deltas", async () => {
  const taskID = "tsk_text_snapshot_replay"
  const sessionID = "ses_text_snapshot_replay"
  const messageID = "msg_text_snapshot_replay"
  const delivered: string[] = []
  const stop = ProtocolStore.subscribeEvents(
    (event) => {
      const part = event.payload?.part as { text?: string } | undefined
      delivered.push(part?.text ?? String(event.payload?.delta))
    },
    { aggregate: "task", taskID },
  )
  const snapshot = (text: string) =>
    ProtocolStore.dispatchEphemeral({
      type: "message.part.updated",
      aggregate: "task",
      taskID,
      sessionID,
      source: "test.text-snapshot",
      orderKey: "message/text-snapshot",
      payload: { part: { id: "prt_text", messageID, sessionID, type: "text", text } },
    })
  const delta = (text: string) =>
    ProtocolStore.dispatchEphemeral({
      type: "message.part.delta",
      aggregate: "task",
      taskID,
      sessionID,
      source: "test.text-snapshot",
      orderKey: "message/text-snapshot",
      payload: { partID: "prt_text", messageID, sessionID, field: "text", delta: text },
    })
  try {
    snapshot("")
    delta("A")
    snapshot("A")
    const cursor = ProtocolStore.currentTaskLiveSequence(taskID)
    delta("B")
    snapshot("AB")
    delta("C")
    const replay = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
    expect(replay).toMatchObject({
      expired: false,
      events: [
        { liveSequence: 5, payload: { part: { id: "prt_text", text: "AB" } } },
        { liveSequence: 6, payload: { delta: "C" } },
      ],
    })
    expect(ProtocolStore.listTaskLiveEventsAfter(taskID, cursor)).toEqual(replay)
    snapshot("Final")
    expect(ProtocolStore.listTaskLiveEventsAfter(taskID, 0)).toMatchObject({
      expired: false,
      events: [{ liveSequence: 7, payload: { part: { id: "prt_text", text: "Final" } } }],
    })
    snapshot("短")
    expect(ProtocolStore.listTaskLiveEventsAfter(taskID, 0)).toMatchObject({
      expired: false,
      events: [{ liveSequence: 8, payload: { part: { id: "prt_text", text: "短" } } }],
    })
    await stop.drain()
    expect(delivered).toEqual(["", "A", "A", "B", "AB", "C", "Final", "短"])
  } finally {
    stop()
  }
})

test("replay keeps exact message and Part identities across Tasks, metadata, transfer and deletion", () => {
  const taskID = "tsk_replay_identities"
  const publish = (type: string, payload: Record<string, unknown>, owner = taskID) =>
    ProtocolStore.dispatchEphemeral({
      type,
      aggregate: "task",
      taskID: owner,
      sessionID: "ses_from",
      source: "test.replay-identities",
      orderKey: "message/replay-identities",
      payload,
    })
  const info = { id: "msg_same", sessionID: "ses_from", value: "before" }
  const part = { id: "prt_same", messageID: info.id, sessionID: info.sessionID, type: "text", text: "before" }
  publish("message.updated", { info })
  publish("message.part.updated", { part })
  publish("message.part.updated", { part: { ...part, id: "prt_other", text: "other Part" } })
  publish("message.part.updated", { part: { ...part, sessionID: "ses_other", text: "other Session" } })
  publish("message.part.updated", { part: { ...part, text: "other Task" } }, "tsk_replay_other")
  publish("message.updated", { info: { ...info, value: "current" } })
  publish("message.part.updated", { part: { ...part, text: "current" } })
  const replay = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
  if (replay.expired) throw Error("Fresh identity replay expired")
  expect(replay.events.map((event) => event.payload)).toEqual([
    { part: { ...part, id: "prt_other", text: "other Part" } },
    { part: { ...part, sessionID: "ses_other", text: "other Session" } },
    { info: { ...info, value: "current" } },
    { part: { ...part, text: "current" } },
  ])
  publish("message.moved", {
    sourceSessionID: "ses_from",
    info: { ...info, sessionID: "ses_to", value: "current" },
    parts: [{ ...part, sessionID: "ses_to", text: "current" }],
  })
  publish("message.removed", { sessionID: "ses_to", messageID: info.id })
  const retired = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
  if (retired.expired) throw Error("Fresh deletion replay expired")
  expect(retired.events.map((event) => event.payload)).toEqual([
    { part: { ...part, sessionID: "ses_other", text: "other Session" } },
    { sessionID: "ses_to", messageID: info.id },
  ])
  expect(ProtocolStore.listTaskLiveEventsAfter("tsk_replay_other", 0)).toMatchObject({
    expired: false,
    events: [{ payload: { part: { ...part, text: "other Task" } } }],
  })
})

test("subscription drain settles its accepted prefix while a later delivery has its own lifetime", async () => {
  const taskID = "tsk_subscription_drain"
  let releaseFirst!: () => void
  let releaseThird!: () => void
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const third = new Promise<void>((resolve) => {
    releaseThird = resolve
  })
  const completed: string[] = []
  const stop = ProtocolStore.subscribeEvents(
    async (event) => {
      const value = String(event.payload?.delta)
      if (value === "delta 1") await first
      if (value === "delta 3") await third
      completed.push(value)
    },
    { aggregate: "task", taskID },
  )
  try {
    dispatchDelta(taskID, 1)
    dispatchDelta(taskID, 2)
    const prefix = stop.drain()
    dispatchDelta(taskID, 3)
    releaseFirst()
    await prefix
    expect(completed).toEqual(["delta 1", "delta 2"])
    releaseThird()
    await stop.drain()
    expect(completed).toEqual(["delta 1", "delta 2", "delta 3"])
  } finally {
    releaseFirst()
    releaseThird()
    stop()
  }
})

test("pending Tool snapshots replay the latest input per call and retire at real admission", () => {
  const taskID = "tsk_pending_input_replay"
  const snapshot = (id: string, raw: string) => ProtocolStore.dispatchEphemeral({
    type: "message.part.updated", aggregate: "task", taskID, sessionID: "ses_input_replay",
    source: "test.input-transport", orderKey: "message/input-replay",
    payload: { part: {
      id, sessionID: "ses_input_replay", messageID: "msg_input_replay", type: "tool", tool: "echo",
      state: { status: "pending", raw },
    } },
  })
  snapshot("prt_first", '{"value":"a')
  snapshot("prt_second", '{"value":"b')
  snapshot("prt_first", '{"value":"actual latest')
  const replay = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
  expect(replay).toMatchObject({ expired: false })
  if (replay.expired) throw new Error("Fresh draft replay expired")
  expect(replay.events.map((event) => event.payload?.part)).toEqual([
    expect.objectContaining({ id: "prt_second", state: { status: "pending", raw: '{"value":"b' } }),
    expect.objectContaining({ id: "prt_first", state: { status: "pending", raw: '{"value":"actual latest' } }),
  ])
  ProtocolStore.dispatchEphemeral({
    type: "message.part.removed", aggregate: "task", taskID, sessionID: "ses_input_replay",
    source: "test.input-transport", orderKey: "message/input-replay",
    payload: { sessionID: "ses_input_replay", messageID: "msg_input_replay", partID: "prt_first", partType: "tool" },
  })
  const retired = ProtocolStore.listTaskLiveEventsAfter(taskID, 0)
  expect(retired).toMatchObject({ expired: false })
  if (retired.expired) throw new Error("Fresh draft retirement replay expired")
  expect(retired.events.map((event) => event.type)).toEqual(["message.part.updated", "message.part.removed"])
  expect(retired.events[0]!.payload?.part).toMatchObject({ id: "prt_second", state: { status: "pending" } })
})
