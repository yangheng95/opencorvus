import { expect, test } from "bun:test"
import { lexer } from "marked"
import { conversationExport, ConversationExportError, type ConversationExportLabels } from "../src/services/conversation-export"

const labels: ConversationExportLabels = {
  sessionID: "Session ID", messageID: "Message ID", created: "Created", updated: "Updated",
  sessionData: "Original session data", messageData: "Original message data", empty: "This conversation has no messages.",
  stopped: "Stopped", failed: "Response incomplete",
}
const now = Date.UTC(2026, 9, 28, 4)
const options = { sessionID: "ses_export", locale: "en-US", timeZone: "UTC", labels }
const original = {
  session: { id: "ses_export", title: "交接 *说明* <draft>", time: { created: now, updated: now + 60000 } },
  messages: [
    { info: { id: "msg_controller", sessionID: "ses_export", role: "user", author: "goal-controller", time: { created: now } },
      parts: [{ type: "text", text: "保留原文\n\n```typescript\nconst answer = 42\n```" }] },
    { info: { id: "msg_assistant", sessionID: "ses_export", role: "assistant", author: "chat", time: { created: now + 1, completed: now + 2 },
      error: { name: "MessageAbortedError", data: { message: "session aborted", cancellation: { actor: "user", source: "session.abort", requestID: "stop-original" } } } },
      parts: [{ type: "text", text: "已输出部分🙂" }, { type: "tool", tool: "read", state: { status: "completed", output: "original ````` fence" } },
        { type: "source-file", sourceId: "source-original", path: "src/report.ts", range: { startLine: 4, endLine: 8 } }] },
  ],
}

test("Markdown preserves actual authors, original text and round-trippable session/message records", () => {
  const file = conversationExport(original, { ...options, format: "markdown" })
  const records = lexer(file.text).filter(token => token.type === "code" && token.lang === "json").map(token => JSON.parse(token.text))
  expect({ filename: file.filename, mime: file.mime }).toEqual({ filename: "交接 _说明_ _draft_ - ses_export.md", mime: "text/markdown;charset=utf-8" })
  expect(records).toEqual([original.session, ...original.messages])
  expect(file.text.split("\n\n").slice(0, 4)).toEqual([
    "# 交接 \\*说明\\* &lt;draft&gt;", "**Session ID:** ` ses_export `", "**Created:** Oct 28, 2026, 4:00 AM", "**Updated:** Oct 28, 2026, 4:01 AM",
  ])
  expect(file.text.includes("## goal\\-controller")).toBe(true)
  expect(file.text.includes(original.messages[0].parts[0].text!)).toBe(true)
  expect(file.text.includes("> **Stopped**\n> session aborted")).toBe(true)
})

test("JSON returns the complete original snapshot and current canonical title filename", () => {
  expect(conversationExport(original, { ...options, format: "json" })).toEqual({
    filename: "交接 _说明_ _draft_ - ses_export.json", mime: "application/json;charset=utf-8", text: JSON.stringify(original, null, 2) + "\n",
  })
})

test("a conversation beyond a history page preserves every original message in order", () => {
  const messages = Array.from({ length: 121 }, (_, index) => ({
    info: { ...original.messages[0].info, id: `msg_${index}`, time: { created: now + index } },
    parts: [{ type: "text", text: `原文 ${index}\nUnicode 🙂` }],
  }))
  const snapshot = { session: original.session, messages }
  const file = conversationExport(snapshot, { ...options, format: "markdown" })
  expect(lexer(file.text).filter(token => token.type === "code" && token.lang === "json").map(token => JSON.parse(token.text)))
    .toEqual([snapshot.session, ...messages])
})

test("an empty conversation exports its original session metadata and localized empty state", () => {
  const snapshot = { session: { id: "ses_export", title: "空对话", time: { created: now, updated: now } }, messages: [] }
  const file = conversationExport(snapshot, { ...options, format: "markdown", locale: "zh-CN", labels: { ...labels, empty: "此对话还没有消息。" } })
  expect(file.filename).toBe("空对话 - ses_export.md")
  expect(file.text.split("\n\n").at(-1)).toBe("此对话还没有消息。\n")
  expect(lexer(file.text).filter(token => token.type === "code" && token.lang === "json").map(token => JSON.parse(token.text))).toEqual([snapshot.session])
})

test("a source snapshot belonging to another session returns the explicit identity error", () => {
  let result: unknown
  try { conversationExport(original, { ...options, sessionID: "ses_other", format: "markdown" }) } catch (error) { result = error }
  expect(result).toBeInstanceOf(ConversationExportError)
  expect(result).toMatchObject({ name: "ConversationExportError", code: "CONVERSATION_EXPORT_IDENTITY_MISMATCH", field: "session.id" })
})

test("an invalid text Part returns its exact data field error", () => {
  const snapshot = { session: original.session, messages: [{ info: original.messages[0].info, parts: [{ type: "text", text: 42 }] }] }
  let result: unknown
  try { conversationExport(snapshot, { ...options, format: "markdown" }) } catch (error) { result = error }
  expect(result).toMatchObject({ name: "ConversationExportError", code: "INVALID_CONVERSATION_EXPORT", field: "messages[0].parts[0].text" })
})

test("a message from another session returns its exact ownership error", () => {
  const snapshot = { session: original.session, messages: [{ ...original.messages[0], info: { ...original.messages[0].info, sessionID: "ses_other" } }] }
  let result: unknown
  try { conversationExport(snapshot, { ...options, format: "markdown" }) } catch (error) { result = error }
  expect(result).toMatchObject({ name: "ConversationExportError", code: "CONVERSATION_EXPORT_IDENTITY_MISMATCH", field: "messages[0].info.sessionID" })
})

test("duplicate message identities return the precise snapshot contract error", () => {
  const snapshot = { session: original.session, messages: [original.messages[0], original.messages[0]] }
  let result: unknown
  try { conversationExport(snapshot, { ...options, format: "markdown" }) } catch (error) { result = error }
  expect(result).toMatchObject({ name: "ConversationExportError", code: "INVALID_CONVERSATION_EXPORT", field: "messages[1].info.id" })
})
