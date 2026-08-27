import { afterEach, expect, test } from "bun:test"
import {
  applyLiveConversationAgentMessageUpdated,
  applyLiveConversationAgentMessageRemoved,
  applyLiveConversationAgentPartDelta,
  applyLiveConversationAgentPartRemoved,
  applyLiveConversationAgentPartUpdated,
  conversationAgentRecordForSourceSession,
  conversationAgentRecordsForSource,
  flushLiveConversationAgentPartDeltas,
  hydrateConversationAgentView,
  resetConversationAgentView,
} from "../src/store/conversation-agents"
import { testMessageOrderKey, testPartOrderKey } from "./fixtures/timeline-order"

const source = { kind: "task" as const, id: "tsk_agent_activity" }
const sourceKey = "task:tsk_agent_activity"
const sessionID = "ses_worker"
const messageID = "msg_answer"
const inputMessageID = "msg_input"
const partID = "prt_text"
const messageOrderKey = testMessageOrderKey(messageID, 1_000)
const partOrderKey = testPartOrderKey(partID, 1_100)

function properties(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionID,
    messageID,
    parentMessageID: inputMessageID,
    parentSessionID: "ses_root",
    role: "assistant",
    author: "researcher",
    agentID: "researcher",
    sessionAgentID: "researcher",
    channel: "delegated-worker",
    resolvedRole: "researcher",
    orderKey: messageOrderKey,
    ...extra,
  }
}

function emitted(type: string, time: number, eventProperties: Record<string, unknown>) {
  return { type, orderKey: messageOrderKey, time: { emitted: time }, properties: eventProperties }
}

function selectSource(): void {
  hydrateConversationAgentView(
    sourceKey,
    { sessions: [], messages: [], topLevelExecutionIDs: [] },
    { validated: true },
  )
}

afterEach(() => resetConversationAgentView())

test("visible Text deltas update the exact child-Agent occurrence before the completed Part", () => {
  resetConversationAgentView()
  selectSource()
  applyLiveConversationAgentMessageUpdated(
    sourceKey,
    emitted("message.updated", 1_000, {
      info: {
        id: messageID,
        sessionID,
        parentID: inputMessageID,
        parentSessionID: "ses_root",
        role: "assistant",
        author: "researcher",
        agentID: "researcher",
        sessionAgentID: "researcher",
        channel: "delegated-worker",
        resolvedRole: "researcher",
        originSource: "task",
        orderKey: messageOrderKey,
        time: { created: 1_000 },
      },
    }),
  )
  applyLiveConversationAgentPartUpdated(
    sourceKey,
    emitted(
      "message.part.updated",
      1_100,
      properties({
        part: { id: partID, sessionID, messageID, type: "text", text: "", orderKey: partOrderKey },
      }),
    ),
  )
  applyLiveConversationAgentPartDelta(
    sourceKey,
    emitted(
      "message.part.delta",
      1_200,
      properties({ partID, partType: "text", field: "text", delta: "first visible words" }),
    ),
  )
  flushLiveConversationAgentPartDeltas()

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([
    { id: partID, messageID, orderKey: partOrderKey, type: "text", text: "first visible words" },
  ])

  applyLiveConversationAgentPartUpdated(
    sourceKey,
    emitted(
      "message.part.updated",
      1_300,
      properties({
        part: {
          id: partID,
          sessionID,
          messageID,
          type: "text",
          text: "first visible words and completed answer",
          orderKey: partOrderKey,
        },
      }),
    ),
  )

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([
    { id: partID, messageID, orderKey: partOrderKey, type: "text", text: "first visible words and completed answer" },
  ])
})

test("main conversation Text deltas stay outside child-Agent activity", () => {
  resetConversationAgentView()
  selectSource()
  const mainProperties = {
    ...properties({}),
    sessionID: "ses_root",
    messageID: "msg_root_answer",
    parentMessageID: "msg_root_input",
    channel: "main",
    role: "assistant",
    author: "orchestrator",
    agentID: "orchestrator",
    sessionAgentID: "orchestrator",
  }
  applyLiveConversationAgentPartUpdated(
    sourceKey,
    emitted("message.part.updated", 1_400, {
      ...mainProperties,
      part: {
        id: "prt_root",
        sessionID: "ses_root",
        messageID: "msg_root_answer",
        type: "text",
        text: "",
        orderKey: testPartOrderKey("prt_root", 1_400),
      },
    }),
  )
  applyLiveConversationAgentPartDelta(
    sourceKey,
    emitted("message.part.delta", 1_500, {
      ...mainProperties,
      partID: "prt_root",
      partType: "text",
      field: "text",
      delta: "root output",
    }),
  )
  flushLiveConversationAgentPartDeltas()

  expect(conversationAgentRecordForSourceSession(source, "ses_root")).toBeUndefined()
})

test("hydrated child-Agent activity anchors retained Text deltas after reconnect", () => {
  resetConversationAgentView()
  hydrateConversationAgentView(
    sourceKey,
    {
      topLevelExecutionIDs: [inputMessageID],
      messages: [],
      sessions: [
        {
          executionID: inputMessageID,
          inputMessageID,
          sessionID,
          agentID: "researcher",
          orderKey: messageOrderKey,
          stage: "researcher",
          parentSessionID: "ses_root",
          messageIDs: [messageID],
          firstMessageTime: 1_000,
          lastMessageTime: 1_100,
          firstObservedAt: 1_000,
          lastObservedAt: 1_100,
          status: "running",
          activity: [{ id: partID, messageID, orderKey: partOrderKey, type: "text", text: "persisted prefix" }],
        },
      ],
    },
    { validated: true },
  )

  applyLiveConversationAgentPartDelta(
    sourceKey,
    emitted(
      "message.part.delta",
      1_200,
      properties({ partID, partType: "text", field: "text", delta: " plus retained delta" }),
    ),
  )
  flushLiveConversationAgentPartDeltas()

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([
    { id: partID, messageID, orderKey: partOrderKey, type: "text", text: "persisted prefix plus retained delta" },
  ])
})

test("Part removal removes the matching activity from the reused Session occurrence", () => {
  resetConversationAgentView()
  selectSource()
  applyLiveConversationAgentMessageUpdated(
    sourceKey,
    emitted("message.updated", 2_000, {
      info: {
        id: messageID,
        sessionID,
        parentID: inputMessageID,
        role: "assistant",
        author: "researcher",
        agentID: "researcher",
        sessionAgentID: "researcher",
        channel: "delegated-worker",
        resolvedRole: "researcher",
        originSource: "task",
        orderKey: messageOrderKey,
        time: { created: 2_000 },
      },
    }),
  )
  applyLiveConversationAgentPartUpdated(
    sourceKey,
    emitted(
      "message.part.updated",
      2_100,
      properties({
        part: { id: partID, sessionID, messageID, type: "text", text: "visible", orderKey: partOrderKey },
      }),
    ),
  )
  applyLiveConversationAgentPartRemoved(
    sourceKey,
    emitted("message.part.removed", 2_200, properties({ partID, partType: "text" })),
  )

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([])
})

test("Message removal clears only Parts owned by the exact child-Agent Message", () => {
  resetConversationAgentView()
  selectSource()
  applyLiveConversationAgentMessageUpdated(
    sourceKey,
    emitted("message.updated", 3_000, {
      info: {
        id: messageID,
        sessionID,
        parentID: inputMessageID,
        role: "assistant",
        author: "researcher",
        agentID: "researcher",
        sessionAgentID: "researcher",
        channel: "delegated-worker",
        resolvedRole: "researcher",
        originSource: "task",
        orderKey: messageOrderKey,
        time: { created: 3_000 },
      },
    }),
  )
  applyLiveConversationAgentPartUpdated(
    sourceKey,
    emitted(
      "message.part.updated",
      3_100,
      properties({
        part: { id: partID, sessionID, messageID, type: "text", text: "removed with message", orderKey: partOrderKey },
      }),
    ),
  )

  applyLiveConversationAgentMessageRemoved(
    sourceKey,
    emitted("message.removed", 3_200, {
      sessionID,
      messageID,
      info: { id: messageID, sessionID, role: "assistant" },
    }),
  )

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([])
})

test("Message removal clears persisted activity whose owner is outside the Card Tree tail", () => {
  resetConversationAgentView()
  hydrateConversationAgentView(
    sourceKey,
    {
      topLevelExecutionIDs: [inputMessageID],
      messages: [],
      sessions: [
        {
          executionID: inputMessageID,
          inputMessageID,
          sessionID,
          agentID: "researcher",
          orderKey: messageOrderKey,
          stage: "researcher",
          messageIDs: [inputMessageID],
          firstMessageTime: 1_000,
          lastMessageTime: 1_100,
          status: "running",
          activity: [{ id: partID, messageID, orderKey: partOrderKey, type: "text", text: "outside tree tail" }],
        },
      ],
    },
    { validated: true },
  )

  applyLiveConversationAgentMessageRemoved(
    sourceKey,
    emitted("message.removed", 1_200, {
      sessionID,
      messageID,
      info: { id: messageID, sessionID, role: "assistant" },
    }),
  )

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([])
})

test("removing one authoritative input removes only that occurrence from a reused Session", () => {
  resetConversationAgentView()
  const secondInputMessageID = "msg_input_second"
  const secondMessageID = "msg_answer_second"
  hydrateConversationAgentView(
    sourceKey,
    {
      topLevelExecutionIDs: [inputMessageID, secondInputMessageID],
      messages: [],
      sessions: [
        {
          executionID: inputMessageID,
          inputMessageID,
          sessionID,
          agentID: "researcher",
          orderKey: messageOrderKey,
          stage: "researcher",
          messageIDs: [inputMessageID, messageID],
          firstMessageTime: 1_000,
          lastMessageTime: 1_100,
          status: "completed",
          activity: [{ id: partID, messageID, orderKey: partOrderKey, type: "text", text: "first occurrence" }],
        },
        {
          executionID: secondInputMessageID,
          inputMessageID: secondInputMessageID,
          sessionID,
          agentID: "researcher",
          orderKey: testMessageOrderKey(secondInputMessageID, 2_000),
          stage: "researcher",
          messageIDs: [secondInputMessageID, secondMessageID],
          firstMessageTime: 2_000,
          lastMessageTime: 2_100,
          status: "running",
          activity: [
            {
              id: "prt_second",
              messageID: secondMessageID,
              orderKey: testPartOrderKey("prt_second", 2_100),
              type: "text",
              text: "second occurrence",
            },
          ],
        },
      ],
    },
    { validated: true },
  )

  applyLiveConversationAgentMessageRemoved(
    sourceKey,
    emitted("message.removed", 2_200, {
      sessionID,
      messageID: inputMessageID,
      info: { id: inputMessageID, sessionID, role: "user" },
    }),
  )

  expect(conversationAgentRecordsForSource(source).map((record) => record.inputMessageID)).toEqual([
    secondInputMessageID,
  ])
})

test("Part removal resolves a bounded-tail occurrence by globally unique Part identity", () => {
  resetConversationAgentView()
  hydrateConversationAgentView(
    sourceKey,
    {
      topLevelExecutionIDs: [inputMessageID],
      messages: [],
      sessions: [
        {
          executionID: inputMessageID,
          inputMessageID,
          sessionID,
          agentID: "researcher",
          orderKey: messageOrderKey,
          stage: "researcher",
          messageIDs: [inputMessageID],
          firstMessageTime: 1_000,
          lastMessageTime: 1_100,
          status: "running",
          activity: [{ id: partID, messageID, orderKey: partOrderKey, type: "text", text: "outside tree tail" }],
        },
      ],
    },
    { validated: true },
  )

  applyLiveConversationAgentPartRemoved(
    sourceKey,
    emitted("message.part.removed", 1_200, properties({ partID, partType: "text" })),
  )

  expect(conversationAgentRecordForSourceSession(source, sessionID)?.activity).toEqual([])
})
