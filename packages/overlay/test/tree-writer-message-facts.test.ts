import { expect, test } from "bun:test"
import { prepareConversationView } from "../src/services/tree-writer"

function info(id: string, sessionID = "ses_facts", created = 1000) {
  return {
    id, sessionID, role: "assistant", author: "assistant", agent: "assistant",
    agentID: "assistant", sessionAgentID: "assistant", resolvedRole: "assistant",
    channel: "assistant", originSource: "", parentSessionID: "", parentID: "msg_input",
    orderKey: `v1:${String(created).padStart(16, "0")}:0000000000000030:0000000000000000:message:${id}`,
    time: { created },
  }
}

test("history coverage and actor integrity have precise preparation errors", () => {
  const message = info("msg_missing")
  const view = { messages: [], sessions: [{ sessionID: message.sessionID, agentID: "assistant", messageIDs: [message.id] }] }
  expect(() => prepareConversationView(view, [])).toThrow("expected message msg_missing missing matching transcript payload")
  expect(() => prepareConversationView(view, [{ info: { ...message, sessionAgentID: "" }, parts: [] }])).toThrow("message msg_missing missing canonical session actor")
})
