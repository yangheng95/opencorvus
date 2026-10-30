import { expect, test } from "bun:test"
import { readTaskConversationSnapshot } from "../src/services/conversation-snapshot"
import { findConversationMessages } from "../src/services/conversation-search"

const created = Date.UTC(2026, 9, 30, 4)
const transcript = [
  { info: { id: "msg_request", sessionID: "ses_orchestrator", role: "user", author: "mission", time: { created } },
    parts: [{ type: "text", text: "核对 Decimal 账单🙂" }] },
  { info: { id: "msg_delivery", sessionID: "ses_builder", role: "assistant", author: "dynamic-builder", time: { created: created + 1 } },
    parts: [{ type: "text", text: "Decimal 已精确合计" }, { type: "tool", tool: "read", state: { status: "completed", output: "原始工具结果" } }] },
]

test("Task transcript retains original participants, source records and producer order across Sessions", () => {
  const snapshot = readTaskConversationSnapshot(transcript)
  expect(snapshot.messages.map(message => ({ id: message.id, sessionID: message.info.sessionID, author: message.author }))).toEqual([
    { id: "msg_request", sessionID: "ses_orchestrator", author: "mission" },
    { id: "msg_delivery", sessionID: "ses_builder", author: "dynamic-builder" },
  ])
  expect(snapshot.messages.map(message => message.original)).toEqual(transcript)
  expect(snapshot.messages[1].original).toBe(transcript[1])
  expect(findConversationMessages(snapshot, "decimal")).toEqual([
    { id: "msg_request", author: "mission", created, preview: "核对 Decimal 账单🙂" },
    { id: "msg_delivery", author: "dynamic-builder", created: created + 1, preview: "Decimal 已精确合计" },
  ])
})

test("duplicate Task Message identity returns the named transcript integrity error", () => {
  const conflicting = { ...transcript[1], info: { ...transcript[1].info, id: transcript[0].info.id } }
  const result = (() => { try { return readTaskConversationSnapshot([transcript[0], conflicting]) } catch (error) { return error } })()
  expect(result).toMatchObject({ name: "ConversationExportError", code: "INVALID_CONVERSATION_EXPORT", field: "messages[1].info.id" })
})
