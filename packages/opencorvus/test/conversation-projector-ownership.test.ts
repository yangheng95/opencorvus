import { expect, test } from "bun:test"
import {
  projectConversationAgentView,
  projectConversationView,
  type ConversationAgentSessionLedgerEntry,
} from "../src/conversation/view"
import { timelineOrderKey } from "../src/timeline/order"
import { TaskConversationSessionView } from "../src/engine/model"
import { Identifier } from "../src/id/id"

const inputMessageID = "message_user_input"
const assistantMessageID = "message_architect_reply"
const sessionID = "session_architect"

const transcript = [
  {
    info: {
      id: inputMessageID,
      sessionID,
      time: { created: 1_000 },
      role: "user",
      author: "user",
      agentID: "user",
      sessionAgentID: "user",
      channel: "main",
      originSource: "operator",
    },
    parts: [{ type: "text", text: "Design the storage boundary" }],
  },
  {
    info: {
      id: assistantMessageID,
      sessionID,
      parentID: inputMessageID,
      time: { created: 1_100 },
      role: "assistant",
      author: "architect",
      agentID: "architect",
      sessionAgentID: "architect",
      channel: "architect",
      originSource: "agent",
    },
    parts: [{ type: "text", text: "Use one explicit registry." }],
  },
]

const ledgerSessions: ConversationAgentSessionLedgerEntry[] = [
  {
    sessionID,
    agentID: "architect",
    orderKey: timelineOrderKey({ domain: "session", time: 900, id: sessionID }),
    stage: "architect",
    timeCreated: 900,
    timeUpdated: 1_100,
  },
]

test("projects transcript ownership separately from execution lifecycle", () => {
  const view = projectConversationView({ transcript, ledgerSessions })

  expect(view).toEqual({
    topLevelSessionIDs: [sessionID],
    sessions: [
      expect.objectContaining({
        sessionID,
        agentID: "architect",
        stage: "architect",
        messageIDs: [inputMessageID, assistantMessageID],
        lastDisplayMessageID: assistantMessageID,
      }),
    ],
    messages: [
      expect.objectContaining({ messageID: inputMessageID, sessionID, agentID: "user" }),
      expect.objectContaining({ messageID: assistantMessageID, sessionID, agentID: "architect" }),
    ],
  })

  const agentView = projectConversationAgentView(
    transcript,
    [
      {
        type: "agent.execution.lifecycle",
        emittedAt: 1_200,
        payload: {
          eventID: "event_completed",
          sequence: 1,
          sessionID,
          inputMessageID,
          agentID: "architect",
          kind: "architect",
          status: { type: "terminal", reason: "completed" },
        },
      },
    ],
    ledgerSessions,
    new Map(),
    new Map(),
    [{ inputMessageID, sessionID, agent: "architect", kind: "architect", preparedAt: 950 }],
  )

  expect(agentView).toEqual({
    topLevelExecutionIDs: [inputMessageID],
    sessions: [
      expect.objectContaining({
        executionID: inputMessageID,
        inputMessageID,
        sessionID,
        agentID: "architect",
        status: "completed",
        messageIDs: [inputMessageID, assistantMessageID],
      }),
    ],
    messages: view.messages,
  })
})

test("conversation Agent occurrences preserve each durable input lifecycle", () => {
  const secondInput = {
    ...transcript[0]!,
    info: { ...transcript[0]!.info, id: "message_second_input", time: { created: 2_000 } },
  }
  const secondAnswer = {
    ...transcript[1]!,
    info: {
      ...transcript[1]!.info,
      id: "message_second_answer",
      parentID: "message_second_input",
      time: { created: 2_100 },
    },
  }
  const lifecycle = (inputID: string, type: string, at: number) => ({
    type: "agent.execution.lifecycle",
    emittedAt: at,
    payload: { sessionID, inputMessageID: inputID, agentID: "architect", channel: "architect", status: { type } },
  })
  const view = projectConversationAgentView(
    [...transcript, secondInput, secondAnswer],
    [lifecycle(inputMessageID, "idle", 1_900), lifecycle("message_second_input", "streaming", 2_200)],
    ledgerSessions,
  )
  expect(view.topLevelExecutionIDs).toEqual([inputMessageID, "message_second_input"])
  expect(
    view.sessions.map((row) => ({ input: row.inputMessageID, status: row.status, messages: row.messageIDs })),
  ).toEqual([
    { input: inputMessageID, status: "idle", messages: [inputMessageID, assistantMessageID] },
    { input: "message_second_input", status: "running", messages: ["message_second_input", "message_second_answer"] },
  ])
})

test("visible messages without execution evidence retain an unobserved record", () => {
  const view = projectConversationAgentView(transcript, [], ledgerSessions)
  expect(view.topLevelExecutionIDs).toEqual([inputMessageID])
  expect(view.sessions).toEqual([
    expect.objectContaining({
      executionID: inputMessageID,
      inputMessageID,
      status: "unobserved",
      messageIDs: [inputMessageID, assistantMessageID],
    }),
  ])
})

const batchInputID = "message_batch_tail"
const batchReplyID = "message_batch_reply"
const batchTranscript = [
  transcript[0]!,
  {
    ...transcript[0]!,
    info: { ...transcript[0]!.info, id: batchInputID, time: { created: 1_050 } },
  },
  {
    ...transcript[1]!,
    info: {
      ...transcript[1]!.info,
      id: batchReplyID,
      parentID: batchInputID,
      acceptedInputMessageIDs: [inputMessageID, batchInputID],
    },
  },
]
const batchLifecycle = {
  type: "agent.execution.lifecycle",
  emittedAt: 1_200,
  payload: {
    sessionID,
    inputMessageID: batchInputID,
    agentID: "architect",
    status: { type: "idle" },
  },
}

test("one reply acceptance batch projects its complete input messages under the actual execution", () => {
  const view = projectConversationAgentView(batchTranscript, [batchLifecycle], ledgerSessions)
  expect(view.topLevelExecutionIDs).toEqual([batchInputID])
  expect(view.sessions).toEqual([
    expect.objectContaining({
      sessionID,
      inputMessageID: batchInputID,
      status: "idle",
      messageIDs: [inputMessageID, batchInputID, batchReplyID],
    }),
  ])
  expect(view.messages.map(({ messageID, inputMessageID }) => ({ messageID, inputMessageID }))).toEqual([
    { messageID: inputMessageID, inputMessageID: batchInputID },
    { messageID: batchInputID, inputMessageID: batchInputID },
    { messageID: batchReplyID, inputMessageID: batchInputID },
  ])
  expect(
    projectConversationView({ transcript: batchTranscript, ledgerSessions }).messages.map((row) => row.messageID),
  ).toEqual([inputMessageID, batchInputID, batchReplyID])
})

test("repeated reply steps retain batch identity alongside a later input observation", () => {
  const laterInputID = "message_waiting_input"
  const repeatedReplyID = "message_batch_tool_reply"
  const view = projectConversationAgentView(
    [
      ...batchTranscript,
      {
        ...batchTranscript[2]!,
        info: { ...batchTranscript[2]!.info, id: repeatedReplyID, time: { created: 1_150 } },
      },
      { ...transcript[0]!, info: { ...transcript[0]!.info, id: laterInputID, time: { created: 1_300 } } },
    ],
    [batchLifecycle],
    ledgerSessions,
  )
  expect(
    view.sessions.map(({ inputMessageID, status, messageIDs }) => ({ inputMessageID, status, messageIDs })),
  ).toEqual([
    {
      inputMessageID: batchInputID,
      status: "idle",
      messageIDs: [inputMessageID, batchInputID, batchReplyID, repeatedReplyID],
    },
    { inputMessageID: laterInputID, status: "unobserved", messageIDs: [laterInputID] },
  ])
})

test("a real earlier lifecycle retains its occurrence when a later reply accepts that input again", () => {
  const view = projectConversationAgentView(
    [
      batchTranscript[0]!,
      {
        ...transcript[1]!,
        info: { ...transcript[1]!.info, time: { created: 1_030 } },
      },
      batchTranscript[1]!,
      batchTranscript[2]!,
    ],
    [
      {
        ...batchLifecycle,
        emittedAt: 1_040,
        payload: { ...batchLifecycle.payload, inputMessageID, status: { type: "terminal", reason: "error" } },
      },
      batchLifecycle,
    ],
    ledgerSessions,
  )
  expect(
    view.sessions.map(({ inputMessageID, status, messageIDs }) => ({ inputMessageID, status, messageIDs })),
  ).toEqual([
    { inputMessageID, status: "error", messageIDs: [inputMessageID, assistantMessageID] },
    { inputMessageID: batchInputID, status: "idle", messageIDs: [inputMessageID, batchInputID, batchReplyID] },
  ])
  expect(view.messages.find((row) => row.messageID === inputMessageID)?.inputMessageID).toBe(inputMessageID)
})

test("prepared execution and another Session input preserve their distinct evidence", () => {
  const otherSessionID = "session_other_architect"
  const otherInputID = "message_other_input"
  const view = projectConversationAgentView(
    [
      ...batchTranscript,
      {
        ...transcript[0]!,
        info: { ...transcript[0]!.info, id: otherInputID, sessionID: otherSessionID, time: { created: 1_300 } },
      },
    ],
    [batchLifecycle],
    [
      ...ledgerSessions,
      {
        ...ledgerSessions[0]!,
        sessionID: otherSessionID,
        orderKey: timelineOrderKey({ domain: "session", time: 1_250, id: otherSessionID }),
        timeCreated: 1_250,
      },
    ],
    new Map(),
    new Map(),
    [{ inputMessageID, sessionID, agent: "architect", kind: "architect", preparedAt: 950 }],
  )
  expect(view.sessions.map(({ sessionID, inputMessageID, status }) => ({ sessionID, inputMessageID, status }))).toEqual(
    [
      { sessionID, inputMessageID, status: "pending" },
      { sessionID, inputMessageID: batchInputID, status: "idle" },
      { sessionID: otherSessionID, inputMessageID: otherInputID, status: "unobserved" },
    ],
  )
})

test("a durable queued input projects a pending execution", () => {
  const queued = { ...transcript[0]!, info: { ...transcript[0]!.info, pendingDelivery: true } }
  const view = projectConversationAgentView([queued], [], ledgerSessions)
  expect(view.sessions).toEqual([
    expect.objectContaining({ inputMessageID, status: "pending", messageIDs: [inputMessageID] }),
  ])
})

test("an exact lifecycle establishes the state of a queued input", () => {
  const queued = { ...transcript[0]!, info: { ...transcript[0]!.info, pendingDelivery: true } }
  const view = projectConversationAgentView(
    [queued],
    [
      {
        type: "agent.execution.lifecycle",
        emittedAt: 1_200,
        payload: { sessionID, inputMessageID, agentID: "architect", status: { type: "terminal", reason: "completed" } },
      },
    ],
    ledgerSessions,
  )
  expect(view.sessions).toEqual([
    expect.objectContaining({ inputMessageID, status: "completed", messageIDs: [inputMessageID] }),
  ])
})

test("a ledger identity without execution facts is an unobserved record", () => {
  const view = projectConversationAgentView([], [], ledgerSessions)
  expect(view.sessions).toEqual([expect.objectContaining({ sessionID, agentID: "architect", status: "unobserved" })])
})

test("the public conversation schema carries the unobserved status", () => {
  const inputID = Identifier.ascending("message")
  const input = { ...transcript[0]!, info: { ...transcript[0]!.info, id: inputID } }
  const row = projectConversationAgentView([input], [], ledgerSessions).sessions[0]!
  expect(TaskConversationSessionView.parse(row)).toMatchObject({
    executionID: inputID,
    inputMessageID: inputID,
    status: "unobserved",
  })
})
