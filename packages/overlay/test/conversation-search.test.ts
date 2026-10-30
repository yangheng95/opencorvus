import { expect, test } from "bun:test"
import { readConversationSnapshot } from "../src/services/conversation-snapshot"
import { findConversationMessages } from "../src/services/conversation-search"
import { ConversationHistoryPageReader } from "../src/services/conversation-history-page-reader"
import { conversationSourceIdentity, conversationSourceLocation, conversationSourceExcerptKey } from "../src/utils/conversation-source"

const time = Date.UTC(2026, 9, 28, 6)
const session = { id: "ses_search", title: "搜索", time: { created: time, updated: time } }
const message = (id: string, body: string, author = "user") => ({
  info: { id, sessionID: session.id, role: "user", author, time: { created: time } },
  parts: [{ type: "text", text: body }],
})

test("complete snapshot search returns actual message identities, authors and Unicode text in producer order", () => {
  const snapshot = readConversationSnapshot({ session, messages: [message("m1", "中文🙂 Alpha 引用"), message("m2", "ALPHA 原始输出", "work")] }, session.id)
  expect(findConversationMessages(snapshot, " alpha ")).toEqual([
    { id: "m1", author: "user", created: time, preview: "中文🙂 Alpha 引用" },
    { id: "m2", author: "work", created: time, preview: "ALPHA 原始输出" },
  ])
})

test("a match beyond the initial history window retains its exact source message", () => {
  const messages = Array.from({ length: 121 }, (_, i) => message(`m${i}`, i === 120 ? "最后一页 唯一目标🙂" : `原消息 ${i}`))
  const snapshot = readConversationSnapshot({ session, messages }, session.id)
  expect(findConversationMessages(snapshot, "唯一目标")).toEqual([{ id: "m120", author: "user", created: time, preview: "最后一页 唯一目标🙂" }])
})

test("structured stop reason is searchable as its original error text", () => {
  const original = message("m_stop", "已输出部分", "chat")
  const info = { ...original.info, role: "assistant", error: { name: "MessageAbortedError", data: { message: "session aborted" } } }
  expect(findConversationMessages(readConversationSnapshot({ session, messages: [{ ...original, info }] }, session.id), "aborted"))
    .toEqual([{ id: "m_stop", author: "chat", created: time, preview: "已输出部分 session aborted" }])
})

test("case folding before a Unicode match keeps readable context intact", () => {
  const text = "İ 中文🙂 needle 后续"
  expect(findConversationMessages(readConversationSnapshot({ session, messages: [message("m_unicode", text)] }, session.id), "needle"))
    .toEqual([{ id: "m_unicode", author: "user", created: time, preview: text }])
})

test("saved file-source locations and excerpts return their original message and source identities", () => {
  const original = { ...message("m_file_source", "检索完成", "chat"), parts: [
    { type: "source-file", sourceId: "source_file_44", path: "C:\\project\\test_invoice.py", title: "test_invoice.py",
      range: { startLine: 44, endLine: 44, startColumn: 26 }, snippet: 'self.assertEqual(total("999.999"), "1000.00")' },
  ] }
  const snapshot = readConversationSnapshot({ session, messages: [original] }, session.id)
  for (const query of ["test_invoice.py:44:26", "999.999"]) {
    expect(findConversationMessages(snapshot, query)).toEqual([expect.objectContaining({
      id: "m_file_source", author: "chat", created: time, sourceId: "source_file_44", preview: expect.stringContaining(query),
    })])
  }
})

test("web and document source text keeps producer message order and readable Unicode previews", () => {
  const messages = [
    { ...message("m_web_source", "原网页", "work"), parts: [
      { type: "source-url", sourceId: "source_web", url: "https://example.test/guide", title: "Guide 中文🙂",
        snippet: "Original Proposal Documents excerpt" },
    ] },
    { ...message("m_document_source", "原文档", "chat"), parts: [
      { type: "source-document", sourceId: "source_document", mediaType: "application/pdf", title: "Proposal Documents 中文🙂", filename: "report.pdf" },
    ] },
  ]
  const snapshot = readConversationSnapshot({ session, messages }, session.id)
  expect(findConversationMessages(snapshot, "proposal documents").map(({ id, sourceId, author, created }) => ({ id, sourceId, author, created }))).toEqual([
    { id: "m_web_source", sourceId: "source_web", author: "work", created: time },
    { id: "m_document_source", sourceId: "source_document", author: "chat", created: time },
  ])
  expect(findConversationMessages(snapshot, "中文🙂")).toEqual([
    expect.objectContaining({ id: "m_web_source", sourceId: "source_web", preview: expect.stringContaining("中文🙂") }),
    expect.objectContaining({ id: "m_document_source", sourceId: "source_document", preview: expect.stringContaining("中文🙂") }),
  ])
})

test("a source result preview belongs to its matching saved source", () => {
  const original = { ...message("m_neighbors", "原消息正文"), parts: [
    { type: "source-url", sourceId: "source_first", url: "https://example.test/first", title: "İ 中文🙂", snippet: "Proposal Documents" },
    { type: "source-file", sourceId: "source_next", path: "src/invoice.py", snippet: "def sum_due(rows):" },
  ] }
  expect(findConversationMessages(readConversationSnapshot({ session, messages: [original] }, session.id), "proposal documents"))
    .toEqual([{ id: "m_neighbors", author: "user", created: time, sourceId: "source_first",
      preview: "İ 中文🙂 https://example.test/first Proposal Documents" }])
})

test("case-folded source offsets retain the matching source across Unicode expansions", () => {
  const sources = [
    { type: "source-url", sourceId: "source_expanded", url: "https://example.test/first", title: "İ".repeat(12), snippet: "needle" },
    { type: "source-file", sourceId: "source_following", path: "report.txt", snippet: "second target" },
  ]
  const original = { ...message("m_expansions", ""), parts: sources }
  const snapshot = readConversationSnapshot({ session, messages: [original] }, session.id)
  expect(findConversationMessages(snapshot, "needle")).toEqual([
    { id: "m_expansions", author: "user", created: time, sourceId: "source_expanded",
      preview: "İ".repeat(12) + " https://example.test/first needle" },
  ])
  expect(findConversationMessages(snapshot, "second target")).toEqual([
    { id: "m_expansions", author: "user", created: time, sourceId: "source_following", preview: "report.txt second target" },
  ])
})

test("the shared source location retains the exact path, range and parent identity", () => {
  const source = { type: "source-file" as const, sourceId: "original_source", sessionID: session.id, messageID: "m_original",
    path: "C:\\项目\\说明 文档.py", range: { startLine: 4, endLine: 8 } }
  expect(conversationSourceLocation(source)).toBe("C:\\项目\\说明 文档.py:4-8")
  expect(conversationSourceIdentity(source)).toBe(JSON.stringify(["source-file", session.id, "m_original", "original_source"]))
  expect(conversationSourceExcerptKey(source)).toBe(`source-excerpt:${conversationSourceIdentity(source)}`)
  expect(conversationSourceLocation({ ...source, range: { startLine: 44, endLine: 44, startColumn: 26 } })).toBe("C:\\项目\\说明 文档.py:44:26")
})

test("invalid source identity, address and line range return precise snapshot field errors", () => {
  const base = { type: "source-file", sourceId: "source_original", path: "src/report.ts", title: "report.ts" }
  for (const [source, field] of [
    [{ ...base, sourceId: "" }, "sourceId"],
    [{ ...base, path: 42 }, "path"],
    [{ ...base, snippet: 42 }, "snippet"],
    [{ ...base, range: { startLine: 4, endLine: 3 } }, "range.endLine"],
    [{ ...base, range: { startLine: 4, endLine: 8, startColumn: 2 } }, "range.startColumn"],
  ] as const) {
    const original = { ...message("m_invalid_source", "原记录"), parts: [source] }
    let result: unknown
    try { readConversationSnapshot({ session, messages: [original] }, session.id) } catch (error) { result = error }
    expect(result).toMatchObject({ name: "ConversationExportError", code: "INVALID_CONVERSATION_EXPORT", field: `messages[0].parts[0].${field}` })
  }
})

test("scroll and explicit navigation receive the same source-owned page promise", async () => {
  const reader = new ConversationHistoryPageReader()
  const first = reader.read("session:a:authority:1", async () => true)
  const navigation = reader.read("session:a:authority:1", async () => true)
  expect(navigation).toBe(first)
  expect(await Promise.all([first, navigation])).toEqual([true, true])
})

test("completion of an earlier source preserves the current source page owner", async () => {
  const reader = new ConversationHistoryPageReader()
  let finishA!: (value: boolean) => void, finishB!: (value: boolean) => void
  const a = reader.read("session:a:authority:1", () => new Promise(resolve => { finishA = resolve }))
  const b = reader.read("session:b:authority:2", () => new Promise(resolve => { finishB = resolve }))
  await Promise.resolve()
  finishA(true)
  expect(await a).toBe(true)
  const joinedB = reader.read("session:b:authority:2", async () => true)
  expect(joinedB).toBe(b)
  finishB(true)
  expect(await joinedB).toBe(true)
  expect(await reader.read("session:b:authority:2", async () => true)).toBe(true)
})

test("a failed page retains its original error and the same scope can read a new page", async () => {
  const reader = new ConversationHistoryPageReader(), failure = new TypeError("history page unavailable")
  let caught: unknown
  try { await reader.read("session:a:authority:1", async () => { throw failure }) } catch (error) { caught = error }
  expect(caught).toBe(failure)
  expect(await reader.read("session:a:authority:1", async () => true)).toBe(true)
})
