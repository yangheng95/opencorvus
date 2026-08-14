import { expect, test } from "bun:test"
import {
  projectConversationAgentView,
  projectConversationView,
  type ConversationAgentSessionLedgerEntry,
} from "../src/conversation/view"
import { timelineOrderKey } from "../src/timeline/order"

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
