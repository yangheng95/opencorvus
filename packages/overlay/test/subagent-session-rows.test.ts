import { expect, test } from "bun:test"
import { CONVERSATION_AGENT_ACTIVITY_STATUSES } from "@opencorvus-ai/transport-protocol"
import type { AgentActivityRecord, AgentActivityStatus } from "../src/utils/agent-activity"
import { statusIconName } from "../src/utils/status-mapping"
import { subagentSessionRows } from "../src/utils/subagent-presentation"
import { testMessageOrderKey } from "./fixtures/timeline-order"

function activity(input: {
  sessionID: string
  executionID: string
  parentSessionID: string
  status: AgentActivityStatus
  observedAt: number
}): AgentActivityRecord {
  return {
    id: input.executionID,
    sessionID: input.sessionID,
    parentSessionID: input.parentSessionID,
    agentID: "reviewer",
    stage: "reviewer",
    status: input.status,
    orderKey: testMessageOrderKey(input.executionID, input.observedAt),
    startedAt: input.observedAt,
    lastObservedAt: input.observedAt,
    attempts: 1,
    depth: input.parentSessionID ? 1 : 0,
    activity: [],
    todos: [],
    todoUpdatedAt: 0,
  }
}

test("child Session rows carry identity and latest activity from their own scope", () => {
  const root = activity({
    sessionID: "ses_parent",
    executionID: "msg_parent",
    parentSessionID: "",
    status: "idle",
    observedAt: 1_000,
  })
  const previous = activity({
    sessionID: "ses_review_1001",
    executionID: "msg_previous",
    parentSessionID: root.sessionID,
    status: "idle",
    observedAt: 1_100,
  })
  const peer = activity({
    sessionID: "ses_review_1002",
    executionID: "msg_peer",
    parentSessionID: root.sessionID,
    status: "completed",
    observedAt: 1_200,
  })
  const latest = activity({
    sessionID: previous.sessionID,
    executionID: "msg_latest",
    parentSessionID: root.sessionID,
    status: "running",
    observedAt: 1_300,
  })

  const current = subagentSessionRows([root, previous, peer, latest])
  expect(current).toEqual([
    { sessionID: latest.sessionID, agentID: "reviewer", suffix: "1001", label: "reviewer · 1001", activity: latest },
    { sessionID: peer.sessionID, agentID: "reviewer", suffix: "1002", label: "reviewer · 1002", activity: peer },
  ])

  const next = activity({
    sessionID: "ses_other_1101",
    executionID: "msg_other",
    parentSessionID: "ses_other_parent",
    status: "unobserved",
    observedAt: 1_400,
  })
  expect(subagentSessionRows([next])).toEqual([
    { sessionID: next.sessionID, agentID: "reviewer", suffix: "", label: "reviewer", activity: next },
  ])
  expect(current.map((row) => [row.activity.id, row.activity.status])).toEqual([
    ["msg_latest", "running"],
    ["msg_peer", "completed"],
  ])
})

test("conversation activity states have explicit status icons", () => {
  expect(Object.fromEntries(CONVERSATION_AGENT_ACTIVITY_STATUSES.map((status) => [status, statusIconName(status)]))).toEqual({
    unobserved: "file-document",
    pending: "status-idle",
    running: "status-active",
    idle: "status-idle",
    completed: "status-completed",
    error: "status-failed",
    skipped: "status-cancelled",
  })
})
