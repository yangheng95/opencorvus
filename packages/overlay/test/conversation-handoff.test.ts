import { expect, test } from "bun:test"
import { activeConversationHandoff } from "../src/services/conversation-session"

const event = {
  type: "work-ledger.conversation-handoff" as const,
  sourceType: "conversation.handoff" as const,
  projectID: "project-alpha",
  directory: "D:/repo",
  sessionID: "ses_work_alpha",
  experience: "work" as const,
  callerSessionID: "ses_chat_alpha",
  callerExperience: "chat" as const,
  callerMessageID: "msg_chat_alpha",
  sequence: 10,
}

test("Chat-to-Work handoff selects only the exact active caller and preserves archive identity", () => {
  expect(
    activeConversationHandoff(event, {
      kind: "session",
      id: "ses_chat_alpha",
      directory: "D:/repo",
      sessionKind: "conversation",
      experience: "chat",
    }),
  ).toEqual({
    sessionID: "ses_work_alpha",
    directory: "D:/repo",
    experience: "work",
    callerSessionID: "ses_chat_alpha",
    callerExperience: "chat",
  })
  expect(
    activeConversationHandoff(event, {
      kind: "session",
      id: "ses_other",
      directory: "D:/repo",
      sessionKind: "conversation",
      experience: "chat",
    }),
  ).toBeNull()
  expect(
    activeConversationHandoff(event, {
      kind: "session",
      id: "ses_chat_alpha",
      directory: "D:/repo",
      sessionKind: "conversation",
      experience: "work",
    }),
  ).toBeNull()
  expect(
    activeConversationHandoff(event, {
      kind: "session",
      id: "ses_chat_alpha",
      directory: "D:/repo",
      sessionKind: "mission",
    }),
  ).toBeNull()
})
