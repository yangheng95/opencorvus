import { expect, test } from "bun:test"
import { ProtocolStore } from "@/protocol/store"

// The live replay buffer keeps a bounded recent window of ephemeral task
// events. Everything trimmed out of that window raises a per-task retention
// floor that is never lowered for the life of the process, so within minutes
// of a task streaming anything the floor is non-zero permanently.
const RETENTION_WINDOW_MS = 30_000

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

test("live replay retention expires a resuming cursor but never a fresh subscriber", () => {
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
