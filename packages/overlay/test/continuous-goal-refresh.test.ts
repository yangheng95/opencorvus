import { afterEach, expect, test } from "bun:test"
import { captureApiAuthority, configure } from "../src/services/api"
import {
  listenContinuousGoalRefresh,
  observeContinuousGoalRefresh,
  type ContinuousGoalRefreshReason,
} from "../src/services/continuous-goal"
import { connectSideChat } from "../src/services/side-chat"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, StreamHandlers, StreamOpenRequest } from "../src/services/host-transport"

afterEach(() => __setHostTransportForTest(undefined))

test("completed execution and reconnect notifications reach their exact Chat, Task and Mission projection", () => {
  configure({ serverUrl: "http://goal-refresh-contract.invalid", password: "" })
  const authority = captureApiAuthority()
  const received: Array<{ kind: string; reason: ContinuousGoalRefreshReason }> = []
  const kinds = ["chat", "task", "mission"] as const
  const stops = kinds.map((kind) =>
    listenContinuousGoalRefresh({ kind, id: "owner-one", directory: "D:/Goal Project" }, authority, (reason) =>
      received.push({ kind, reason }),
    ),
  )
  try {
    for (const kind of kinds) {
      const target = { kind, id: "owner-one", directory: "d:\\goal project\\" }
      observeContinuousGoalRefresh(target, authority, {
        type: kind === "task" ? "task.connected" : "session.connected",
      })
      observeContinuousGoalRefresh(target, authority, {
        type: "message.updated",
        payload: { info: { role: "assistant", time: { completed: 42 } } },
      })
      observeContinuousGoalRefresh(target, authority, {
        type: "agent.execution.lifecycle",
        properties: { status: { type: "terminal", reason: "completed" } },
      })
    }
    expect(received).toEqual(
      kinds.flatMap((kind) => [
        { kind, reason: "connected" },
        { kind, reason: "settled" },
        { kind, reason: "settled" },
      ]),
    )
  } finally {
    for (const stop of stops) stop()
  }
})

test("durable Task intent and terminal notifications request the same canonical projection", () => {
  const authority = captureApiAuthority(),
    target = { kind: "task" as const, id: "task-current", directory: "/project/current" }
  const reasons: ContinuousGoalRefreshReason[] = []
  const stop = listenContinuousGoalRefresh(target, authority, (reason) => reasons.push(reason))
  try {
    for (const type of [
      "continuous_goal.created",
      "continuous_goal.updated",
      "continuous_goal.continuation_requested",
      "task.completed",
      "task.failed",
      "task.cancelled",
    ])
      observeContinuousGoalRefresh(target, authority, { type })
    expect(reasons).toEqual(["intent", "intent", "intent", "settled", "settled", "settled"])
  } finally {
    stop()
  }
})

test("equal owner identities in different Projects retain their exact read scopes", () => {
  const authority = captureApiAuthority()
  const directories = ["D:/Project One", "D:/Project Two"]
  const received: Array<{ directory: string; reason: ContinuousGoalRefreshReason }> = []
  const stops = directories.map((directory) =>
    listenContinuousGoalRefresh({ kind: "chat", id: "same-owner", directory }, authority, (reason) =>
      received.push({ directory, reason }),
    ),
  )
  try {
    for (const directory of directories)
      observeContinuousGoalRefresh({ kind: "chat", id: "same-owner", directory }, authority, {
        type: "agent.execution.lifecycle",
        payload: { status: { type: "terminal", reason: "completed" } },
      })
    expect(received).toEqual(directories.map((directory) => ({ directory, reason: "settled" })))
  } finally {
    for (const stop of stops) stop()
  }
})

test("a SideChat transport settlement reaches its independently scoped Goal reader", () => {
  configure({ serverUrl: "http://side-goal-refresh-contract.invalid", password: "" })
  const authority = captureApiAuthority(),
    target = { sessionID: "ses-side-current", directory: "D:/Side Project", authority }
  let handlers!: StreamHandlers, opened!: StreamOpenRequest
  __setHostTransportForTest({
    openStream(request: StreamOpenRequest, callbacks: StreamHandlers) {
      opened = request
      handlers = callbacks
      return { close() {} }
    },
  } as unknown as HostTransport)
  const reasons: ContinuousGoalRefreshReason[] = []
  const stop = listenContinuousGoalRefresh(
    { kind: "chat", id: target.sessionID, directory: target.directory },
    authority,
    (reason) => reasons.push(reason),
  )
  const close = connectSideChat(target, {
    transcript() {},
    connection() {},
    activity() {},
    interactions() {},
    error(error) {
      throw error
    },
  })
  try {
    handlers.onEvent(
      JSON.stringify({
        type: "agent.execution.lifecycle",
        session_id: target.sessionID,
        payload: { inputMessageID: "original-input", status: { type: "terminal", reason: "cancelled" } },
      }),
    )
    expect({ path: opened.path, directory: opened.query?.directory, authority: opened.authority }).toEqual({
      path: `session/${target.sessionID}/events`,
      directory: target.directory,
      authority,
    })
    expect(reasons).toEqual(["settled"])
  } finally {
    close()
    stop()
  }
})
